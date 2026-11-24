// net.js — multiplayer client: rooms by code, no accounts. Talks to server.js over /ws.
// The first player in a room is the host: it runs the guards' AI and broadcasts their positions.
(function (G) {
'use strict';
const T = G.T, P = G.player, V3 = T.Vector3;
const STATES = ['patrol', 'suspicious', 'alert', 'investigate', 'return', 'sweep', 'sit', 'toSmoke', 'smoke', 'toOffice', 'sleep']; // (sent by index: only append)
const NET = G.net = { on: false, id: null, hostId: null, room: '', roomName: '', max: 6, min: 2, name: '', color: 0, peers: new Map(), offset: 0, ws: null, map: 'sihanouk', maps: null, opts: { tod: 'night', wx: 'rain', time: 'normal', guards: 'normal' }, myDet: 0, mySeen: false, sendT: 0, gsT: 0, kaTimer: null, lightT: 0 };
const roster = () => { if (G.onRoster) G.onRoster(); };
// room list for the lobby (served by server.js)
NET.fetchRooms = async () => { const r = await fetch('/api/rooms', { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
NET.isHost = () => NET.on && NET.id === NET.hostId;
NET.replica = () => NET.on && NET.id !== NET.hostId;
NET.supported = () => /^https?:$/.test(location.protocol) && !/claude\.ai$|claudeusercontent|claude\.site|anthropic/.test(location.hostname);
NET.now = () => (Date.now() + NET.offset) / 1000;
NET.send = (o) => { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); };

// ---------------- peers (other players) ----------------
function tagTexture(name, color) {
  return G.makeTex(256, 64, (g) => {
    g.font = '700 30px "Be Vietnam Pro", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(name, 128, 34);
    g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillText(name, 128, 34);
  }, { repeat: false });
}
function addPeer(p) {
  if (NET.peers.has(p.id)) return;
  // on the scene itself (like the player), not the level root: the round reloads the map and would drop them
  const look = p.look && G.lookFromCode ? G.lookFromCode(p.look) : null; // their own character from the creator (older clients: a coloured shirt)
  const h = G.Humanoid(Object.assign({}, look || { shirt: p.color, pants: 0x262a33, skin: [0xc79a74, 0xb5835e, 0xd6a985, 0xa8754f][p.id % 4] }, { parent: G.scene }));
  const tag = new T.Sprite(new T.SpriteMaterial({ map: tagTexture(p.name, p.color), depthTest: false, transparent: true }));
  tag.scale.set(1.7, 0.42, 1); tag.position.y = 2.3; h.group.add(tag); h.group.visible = false;
  NET.peers.set(p.id, { id: p.id, name: p.name, color: p.color, bot: !!p.bot, h, tag, pos: new V3(), tpos: new V3(), yaw: 0, tyaw: 0, c: false, r: false, s: 0, p: 'stand', b: false, phase: 0, got: false, last: 0, hl: '', td: false, o: false });
}
NET.sendLook = () => { if (G.lookCode && G.playerLook) NET.send({ t: 'look', look: G.lookCode(G.playerLook()) }); };
NET.isBot = (id) => { const p = NET.peers.get(id); return !!(p && p.bot); };
NET.addBot = () => NET.send({ t: 'bot_add' });
NET.kickBot = (id) => NET.send({ t: 'bot_kick', id });
function removePeer(id) {
  const p = NET.peers.get(id); if (!p) return;
  if (p.h.group.parent) p.h.group.parent.remove(p.h.group); NET.peers.delete(id);
}
// clear per-round state before a new round (positions arrive again with the first 'st')
NET.resetPeers = () => { NET.myDet = 0; NET.mySeen = false; for (const p of NET.peers.values()) { p.got = false; p.e = 0; p.hold = null; p.grace = 0; p.grab = 0; p.wasTd = false; p.hl = ''; p.td = false; p.o = false; p.p = 'stand'; p.h.group.visible = false; if (p.h.group.parent !== G.scene) G.scene.add(p.h.group); } };
NET.fresh = (p) => p.got && p.p !== 'gone' && performance.now() - p.last < 3000;
NET.targets = function () { // remote players the host's guards can see (not tied up, not already outside)
  const out = [], now = performance.now();
  for (const p of NET.peers.values()) {
    if (!p.got || p.b || p.td || p.o || p.p === 'gone' || now - p.last > 3000) continue;
    const lit = G.isLit(p.pos.x, p.pos.z);
    // bots are harder to notice (companion AI should not sink the team), but a guard who bumps into one still catches it
    out.push({ id: p.id, pos: p.pos, crouch: p.c, running: p.r, vis: (G.night > 0.5 ? (lit ? 1 : 0.6) : 1) * (p.c ? 0.6 : 1) * (p.r && !(G.state && G.state.teamPlay) ? 1.25 : 1) * (p.bot ? (G.night > 0.5 ? 0.45 : 0.195) : 1) }); // (0.195 by day = the same distance as 0.45 in the dark: 18 m of sight, everything lit)
  }
  return out;
};

// ---------------- connection ----------------
NET.connect = function (name, room) {
  return new Promise((resolve, reject) => {
    if (!NET.supported()) { reject('Chế độ nhiều người chỉ chạy khi mở game từ máy chủ riêng (link ngrok hoặc localhost).'); return; }
    let ws, done = false;
    const fail = (msg) => { if (done) return; done = true; clearTimeout(to); try { ws.close(); } catch (e) { /* ignore */ } reject(msg); };
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { reject('Không mở được kết nối.'); return; }
    const to = setTimeout(() => fail('Máy chủ không phản hồi. Kiểm tra máy chủ game còn chạy không.'), 8000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, room, look: G.lookCode && G.playerLook ? G.lookCode(G.playerLook()) : '' }));
    ws.onerror = () => fail('Không kết nối được máy chủ nhiều người chơi.');
    ws.onclose = () => { if (NET.on) { NET.on = false; clearInterval(NET.kaTimer); if (G.onNetLost) G.onNetLost(); } else fail('Mất kết nối.'); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      if (m.t === 'welcome') {
        if (done) return; done = true; clearTimeout(to);
        NET.peers.forEach((p, id) => removePeer(id));
        Object.assign(NET, { ws, on: true, id: m.id, hostId: m.hostId, room: m.room, roomName: m.name || m.room, max: m.max || 6, min: m.min || 2, name, color: m.color, offset: m.now - Date.now(), map: m.map || 'sihanouk', maps: Array.isArray(m.maps) ? m.maps : null, opts: Object.assign({}, NET.opts, { from: '0' }, m.opts || {}) });
        (m.peers || []).forEach(addPeer);
        NET.kaTimer = setInterval(() => NET.send({ t: 'ka' }), 5000);
        resolve(m);
      } else if (m.t === 'error') { if (NET.on) { if (G.onNetError) G.onNetError(m.msg); } else fail(m.msg || 'Không vào được phòng.'); }
      else if (NET.on) handle(m);
    };
  });
};
function handle(m) {
  switch (m.t) {
    case 'join': addPeer(m); if (G.netToast && !m.bot) G.netToast(m.name + ' đã vào phòng'); roster(); break;
    case 'look': { const p = NET.peers.get(m.id), L = G.lookFromCode ? G.lookFromCode(m.look) : null; if (p && L && G.restyle) G.restyle(p.h, L); break; }
    case 'leave': { const p = NET.peers.get(m.id); if (p && G.netToast) G.netToast(p.name + ' đã rời phòng'); removePeer(m.id); roster(); break; }
    case 'host': NET.hostId = m.id; if (NET.isHost() && G.onBecomeHost) G.onBecomeHost(); roster(); break;
    case 'map': NET.map = m.map || 'sihanouk'; roster(); break;
    case 'opts': if (m.opts) NET.opts = Object.assign({}, NET.opts, m.opts); roster(); break;
    case 'start': NET.resetPeers(); if (m.map) NET.map = m.map; if (m.opts) NET.opts = Object.assign({}, NET.opts, m.opts); if (G.onNetStart) G.onNetStart(m); break;
    case 'end': if (G.onNetEnd) G.onNetEnd(m.r); break;
    case 'free': if (G.onNetFree) G.onNetFree(m); break;
    case 'pause': if (G.onNetPause) G.onNetPause(m); break;
    case 'st': {
      const p = NET.peers.get(m.from); if (!p) return;
      p.e = m.e || 0;
      if (p.hold) return; // a cutscene places them
      if (p.e !== ((G.state && G.state.teamLeg) || 0)) { p.got = false; p.td = false; p.o = false; p.hl = ''; p.h.group.visible = false; return; } // on another leg of the escape
      p.tpos.set(m.x, m.y, m.z); p.tyaw = m.yaw; p.c = m.c; p.r = m.r; p.s = m.s; p.p = m.p || 'stand'; p.b = m.b; p.last = performance.now();
      p.hl = m.hl || ''; p.td = !!m.td; p.o = !!m.o;
      if (!p.got) { p.pos.copy(p.tpos); p.yaw = p.tyaw; p.got = true; }
      break;
    }
    case 'gs':
      if (NET.isHost()) return;
      (m.g || []).forEach((a, i) => { const g = G.guards[i]; if (g && Array.isArray(a)) g.net = { x: a[0], z: a[1], yaw: a[2], st: STATES[a[3]] || 'patrol', w: +a[4] || 0 }; });
      { const v = +(m.det && m.det[NET.id]) || 0; NET.myDet = Math.abs(v); NET.mySeen = v > 0; } // below zero = out of view, draining
      if (G.onNetClock) G.onNetClock(m.clock);
      if (m.mt && G.onNetTimer) G.onNetTimer(m.mt);
      break;
    case 'ev': if (G.applyWorld) G.applyWorld(m.k, m.name); break;
    case 'esc': if (G.onNetEsc && Array.isArray(m.th)) G.onNetEsc(m.th); break;               // the men chasing (river escape)
    case 'rock': if (G.onNetRock && Array.isArray(m.o) && Array.isArray(m.v)) G.onNetRock(m.o, m.v); break; // a stone thrown
    case 'noise':
      if (!NET.isHost()) return;
      if (m.k === 'light') G.alertNearest(m.x, m.z, true); else G.makeNoise(m.x, m.z, m.r, m.k, true);
      break;
    case 'act': if (NET.isHost() && G.onNetAct) G.onNetAct(m); break;                          // Myanmar: a player's piece of a mission
    case 'ms': if (!NET.isHost() && G.onNetMission && m.s && typeof m.s === 'object') G.onNetMission(m.s); break; // …and where the team stands
    case 'caught': if (G.onCaught) G.onCaught(m.src); break;
    case 'say': {
      // the team map may word these for its own place (jungle: tied to the tree, out at the stream…)
      const SAY = Object.assign({ tied: ' bị bắt, đang bị trói ở cột giữa sân! Tới cởi trói (giữ E)', street: ' đã ra tới đường lớn', back: ' quay vào trong tường', lured: ' đang rung cổng sắt dụ tên gác', dead: ' đã chết vì hết giờ' }, G.teamSay ? G.teamSay() : {});
      if (G.netToast && SAY[m.k]) G.netToast(m.name + SAY[m.k]);
      break;
    }
  }
}
NET.leave = () => {
  if (!NET.on) return;
  NET.send({ t: 'st', x: P.pos.x, y: 0, z: P.pos.z, yaw: P.yaw, s: 0, p: 'gone' });
  NET.on = false; clearInterval(NET.kaTimer);
  NET.peers.forEach((p, id) => removePeer(id));
  const ws = NET.ws; setTimeout(() => { try { ws.close(); } catch (e) { /* ignore */ } }, 300);
};
NET.emit = (k, as) => NET.send(as != null ? { t: 'ev', k, as } : { t: 'ev', k });
NET.setMap = (map) => NET.send({ t: 'map', map });
// a map this server does not know (it still runs an older server.js) cannot be picked
NET.knowsMap = (k) => !NET.maps || NET.maps.includes(k);
NET.setOpts = (o) => NET.send({ t: 'opts', opts: Object.assign({}, NET.opts, o) });
NET.say = (k) => NET.send({ t: 'say', k });

// ---------------- per-frame ----------------
NET.update = function (dt, t, gone) {
  if (!NET.on) return;
  const k = 1 - Math.exp(-12 * dt);
  for (const p of NET.peers.values()) {
    if (p.hold) continue; // posed by the cutscene (team_escape.js)
    p.h.group.visible = p.got && p.p !== 'gone' && p.pos.y > -10 && G.camera.position.distanceToSquared(p.pos) < 110 * 110;
    if (!p.got) continue;
    p.pos.lerp(p.tpos, k); p.yaw += G.angDiff(p.yaw, p.tyaw) * k;
    p.phase += p.s * dt * (G.gaitRate ? G.gaitRate(p.s, { run: p.r, crouch: p.c, h: p.h }) : 2.5);
    const pose = ['sit', 'type', 'climb', 'phone', 'tied', 'floor', 'lie', 'kneel', 'hug', 'drink'].includes(p.p) ? p.p : 'stand';
    G.animHuman(p.h, { pose, crouch: p.c, speed: p.s, amt: p.s / 3.4, phase: p.phase + (pose === 'climb' ? t * 6 : 0), run: p.r, t });
    p.h.group.position.copy(p.pos); p.h.group.rotation.y = p.yaw;
    if (p.tag) { const k = Math.min(1, G.camera.position.distanceTo(p.pos) / 7.5); p.tag.scale.set(1.7 * k, 0.42 * k, 1); } // a name right at the camera must not fill the screen
  }
  NET.sendT -= dt;
  if (NET.sendT <= 0) {
    NET.sendT = 1 / 12;
    const S = G.state;
    NET.send({ t: 'st', x: P.pos.x, y: P.pos.y, z: P.pos.z, yaw: P.yaw, c: !!P.crouch, r: !!P.running, s: P.speed, p: gone ? 'gone' : (P.frozen ? (P.pose || 'stand') : 'stand'), e: (S && S.teamLeg) || 0, b: !!(S && (S.busy || (S.f && S.f.scene))),
      hl: G.coopMine ? G.coopMine() : '', td: !!(S && S.tied), o: !!(S && S.out) });
  }
  if (NET.isHost()) {
    NET.gsT -= dt;
    if (NET.gsT <= 0) {
      NET.gsT = 0.1;
      const det = {}, team = !!G.state.teamPlay, seen = G.seenBy || {};
      for (const [id, v] of Object.entries(G.detBy || {})) if (id !== 'me') det[id] = (team && !seen[id] ? -1 : 1) * Math.max(0.01, Math.round(v * 100) / 100);
      const mt = G.mtimer && G.mtimer.obj ? [G.OBJ.indexOf(G.mtimer.obj), Math.round(G.mtimer.left * 10) / 10] : null;
      NET.send({ t: 'gs', clock: G.state.clock, det, mt, g: G.guards.map((g) => [Math.round(g.pos.x * 100) / 100, Math.round(g.pos.z * 100) / 100, Math.round(g.yaw * 100) / 100, Math.max(0, STATES.indexOf(g.state)), Math.round((g.wp || 0) * 100) / 100]) });
    }
  }
};
NET.STATES = STATES;
})(window.G);
