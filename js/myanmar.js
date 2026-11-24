// myanmar.js — the long team map "Myanmar · Khu Sương Đen" (what to do: myanmar_missions.js, where: levels/myanmar.js).
//
// It starts as the river escape (team_escape.js); in the boat ông Tư turns out to be the ring's man. Then five acts in
// Myanmar, then the flight home (team_escape.js again, dressed as Bangkok).
//  · The host owns the mission state { e, act, i, d, fails, out } and sends it ('ms') on every change and every 1.5 s;
//    players send what they did ('act'). A new host carries on from the last state it received.
//      e      counts every act start and redo: a message from an older one is ignored
//      i, d   the current mission of the act and that mission's own progress
//      fails  times an act was redone: also re-draws the codes and orders
//  · What is open in the world follows from the state alone (worldSync), so an act can be rebuilt at any time.
//  · Everybody down or out of time = that act again. Each browser remembers the furthest act, and a host can resume
//    there (room option `from`).
(function (G) {
'use strict';
const T = G.T, C = G.C;
const P = G.player, ui = G.ui, S = G.state, ST = G.story, NET = G.net, ESC = G.esc, KIT = ST.kit, BK = G.bots.kit;
const { ACTS, draw, total } = G.MYANMAR;
const L = () => G.LOC, npc = (k) => G.npcs[k];
const now = () => performance.now();
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const round2 = (v) => Math.round(v * 100) / 100;
const peers = () => [...NET.peers.values()];
const bots = () => peers().filter((p) => p.bot);
const popcount = (b) => { let n = 0; for (let v = b | 0; v; v &= v - 1) n++; return n; };
const SAVE = 'mnbl-myanmar';
const PENALTY = 15;          // seconds lost for a wrong answer
const GRACE = 6, FREE_GRACE = 3; // not watched: after (re)starting an act, after being untied
const HOURS = { day: 8, dusk: 17.2, night: 20.5 };
const FEW = { 3: ['detOut', 'boss', 'dorm', 'yardN', 'villaW', 'dogE', 'dogS'], 4: ['w2', 'cp2', 'dogW'] };
const MORE = { 3: ['outA', 'yardS', 'power', 'clinic', 'hall'], 4: ['w1', 'grove', 'cp'] };
const ACT_OF = {};
ACTS.forEach((a, n) => a.missions.forEach((m, i) => { ACT_OF[m.id] = { act: n, i }; }));

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function saved() {
  try { return Math.max(0, Math.min(5, parseInt(localStorage.getItem(SAVE), 10) || 0)); } catch (e) { return 0; }
}
function save(act) {
  try { if (act === null) localStorage.removeItem(SAVE); else if (act >= 1 && act <= 5 && act > saved()) localStorage.setItem(SAVE, String(act)); } catch (e) { /* storage blocked */ }
}
// players in this round: me + everybody else; { me?, p?, id, pos }
function members() {
  return [{ me: true, id: NET.id, pos: P.pos }].concat(peers().map((p) => ({ p, id: p.id, pos: p.bot && NET.isHost() ? p.tpos : p.pos })));
}
function upAndAbout(m) {
  return m.me ? !S.tied && !S.busy && !S.ended : !m.p.td && !m.p.b && NET.fresh(m.p);
}

// ================================ the state ================================
let M = null;   // { s, draw, built: {act, fails}, seen, pending, beat, items, talk, sent }
const ACT = () => ACTS[M.s.act];
const mission = () => (M && !M.s.out ? ACT().missions[M.s.i] || null : null);
const live = () => !!M && S.teamPlay && !S.ended;
function isDone(id) {
  const at = ACT_OF[id];
  return M.s.act > at.act || (M.s.act === at.act && M.s.i > at.i);
}
function redraw() { M.draw = draw(rng(M.seed + M.s.fails * 7919)); }
function freshData(m) {
  if (!m) return {};
  switch (m.type) {
    case 'multi': return { b: 0 };
    case 'carry': return { c: m.items(L()).map(() => 0) };   // 0 in its place · -1 delivered · an id: carried · [x, z] dropped
    case 'sync': return { s: 0 };
    case 'seq': return { n: 0 };
    case 'window': return { b: 0, t: 0 };
    case 'escort': return { p: 0 };                         // metres along the way
    case 'paddle': return { n: 0, need: strokes(m) };
    default: return {};
  }
}
const strokes = (m) => m.per * Math.min(3, 1 + peers().filter((p) => !p.bot).length);
function stats(m, d) {
  const o = { bits: d.b | 0, count: 0, got: 0, secs: 0, left: 0, total: 0, need: 0 };
  if (m.type === 'multi' || m.type === 'window') {
    o.count = popcount(o.bits); o.left = Math.ceil(d.t || 0);
    if (m.hit) for (let k = 0; k < 16; k++) if ((o.bits >> k) & 1 && m.hit(k, M.draw)) o.got++;
  } else if (m.type === 'carry') o.count = (d.c || []).filter((v) => v === -1).length;
  else if (m.type === 'sync') o.secs = Math.floor(d.s || 0);
  else if (m.type === 'seq') o.count = d.n || 0;
  else if (m.type === 'gather') { const all = members(); o.total = all.length; o.count = d.all ? all.length : gathered(m, all).length; }
  else if (m.type === 'paddle') { o.need = d.need || strokes(m); o.count = d.all ? o.need : Math.floor(d.n || 0); }
  return o;
}
const gathered = (m, all) => all.filter((x) => upAndAbout(x) && dist(x.pos, m.at(L())) < m.r);

// what a player did → the host
function act(k, x) {
  if (!live() || M.pending) return;
  const o = { t: 'act', k, e: M.s.e, i: M.s.i, x: x === undefined ? 0 : x };
  if (NET.isHost()) handle(Object.assign({ from: NET.id }, o)); else NET.send(o);
}
function whereIs(id) {
  if (id === NET.id) return P.pos;
  const p = NET.peers.get(id);
  return p ? (p.bot ? p.tpos : p.pos) : P.pos;
}
function handle(a) {
  if (!live() || !NET.isHost() || M.pending || a.e !== M.s.e || a.i !== M.s.i) return;
  const m = mission(); if (!m) return;
  const d = M.s.d, x = a.x | 0, from = a.from;
  if (a.k === 'bad' && m.type === 'panel') { alarm(whereIs(from)); return; }
  if (a.k === 'dn' && ['do', 'support', 'together', 'panel'].includes(m.type)) { complete(); return; }
  if (a.k === 'sp' && m.type === 'multi') {
    const spots = m.spots(L(), M.draw);
    if (x < 0 || x >= spots.length || (d.b >> x) & 1 || (m.ordered && x !== popcount(d.b))) return;
    d.b |= 1 << x;
    const st = stats(m, d);
    if (m.want ? st.got >= m.want : st.count >= spots.length) complete(); else commit();
  } else if (a.k === 'pick' && m.type === 'carry') {
    if (x < 0 || x >= d.c.length || d.c[x] === -1 || (typeof d.c[x] === 'number' && d.c[x] > 0) || d.c.includes(from)) return;
    d.c[x] = from; commit();
  } else if (a.k === 'put' && m.type === 'carry') {
    const k = d.c.indexOf(from); if (k < 0) return;
    d.c[k] = -1;
    if (d.c.every((v) => v === -1)) complete(); else commit();
  } else if (a.k === 'lev' && m.type === 'seq') {
    const order = m.order(M.draw);
    if (order[d.n] === x) { d.n++; if (d.n >= order.length) complete(); else commit(); }
    else if (!order.slice(0, d.n).includes(x)) { d.n = 0; alarm(whereIs(from)); commit(); }
  } else if (a.k === 'val' && m.type === 'window') {
    const n = m.spots(L()).length;
    if (x < 0 || x >= n) return;
    if (!d.b) d.t = m.secs;
    d.b |= 1 << x;
    if (popcount(d.b) >= n) complete(); else commit();
  } else if (a.k === 'row' && m.type === 'paddle') {
    d.n++;
    if (d.n >= d.need) complete(); else M.dirty = true;
  }
}
function alarm(at) { // a wrong answer: the nearest guards come, and it costs time
  G.sfx('alert');
  G.makeNoise(at.x, at.z, 22, 'alarm', true);
  const mt = G.mtimer;
  if (mt.total && !mt.fired) mt.left = Math.max(5, mt.left - PENALTY);
}
function complete() {
  const s = M.s, def = ACT();
  s.i++; s.d = {};
  if (s.i < def.missions.length) { s.d = freshData(def.missions[s.i]); commit(); return; }
  if (s.act === 5) { s.out = 1; ST.world('border'); commit(); return; } // over the river: the scene, then the flight
  startAct(s.act + 1);
}
function startAct(n) {
  const s = M.s;
  s.act = n; s.i = 0; s.e++; s.out = 0;
  s.d = {};
  if (n >= 1 && n <= 4 && M.built && M.built.act >= 1 && M.built.act <= 4) s.d = freshData(ACTS[n].missions[0]);
  commit();
}
function commit() {
  send();
  onState();
}
function send() {
  if (!NET.isHost()) return;
  M.beat = 1.5; M.dirty = false;
  const s = M.s;
  const d = {};
  for (const [k, v] of Object.entries(s.d)) d[k] = typeof v === 'number' ? round2(v) : v;
  NET.send({ t: 'ms', s: { e: s.e, act: s.act, i: s.i, d, fails: s.fails, out: s.out } });
}
G.onNetAct = (m) => { if (live()) handle(m); };
G.onNetMission = function (s) {
  if (!live()) return;
  const n = (v) => Math.max(0, v | 0), a = n(s.act);
  if (a >= ACTS.length || !s.d || typeof s.d !== 'object') return;
  const d = s.d, safe = {};
  for (const k of ['b', 's', 'n', 't', 'p', 'need']) if (typeof d[k] === 'number' && isFinite(d[k])) safe[k] = d[k];
  if (Array.isArray(d.c)) safe.c = d.c.slice(0, 8).map((v) => (Array.isArray(v) ? [+v[0] || 0, +v[1] || 0] : +v || 0));
  Object.assign(M.s, { e: n(s.e), act: a, i: Math.min(n(s.i), ACTS[a].missions.length), d: safe, fails: n(s.fails), out: s.out ? 1 : 0 });
  onState();
};
// every screen: what changed since the last state it showed
function onState() {
  const s = M.s, was = M.seen;
  M.seen = { e: s.e, act: s.act, i: s.i, fails: s.fails, out: s.out, b: s.d.b || 0, sec: s.d.s || 0, n: s.d.n || 0 };
  if (s.fails !== was.fails) { redraw(); transition('retry', was.act); return; }
  if (s.e !== was.e) {
    if (was.act >= 1 && was.act <= 4 && s.act === was.act + 1) announce(ACTS[was.act].missions.slice(-1)[0]);
    const same = M.built && s.act >= 2 && s.act <= 4 && M.built.act >= 1 && M.built.act <= 4 && !M.pending;
    if (same) nextActHere(); else transition('next', was.act);
    return;
  }
  if (M.pending || s.act < 1 || s.act > 5) return;
  if (s.i !== was.i) {
    for (let k = was.i; k < s.i; k++) announce(ACT().missions[k]);
    newMission();
    if (s.out && !was.out) outScene();
    return;
  }
  const m = mission(); if (!m) return;
  if (m.type === 'multi' && s.d.b !== was.b) {
    for (let k = 0; k < 16; k++) {
      if (!((s.d.b >> k) & 1) || (was.b >> k) & 1) continue;
      G.sfx(m.id === 'cells' ? 'cage' : 'pickup');
      if (m.found) ui.toast(m.found(k, M.draw), 2800);
    }
    worldSync();
  } else if (m.type === 'seq' && (s.d.n || 0) !== was.n) {
    G.sfx(s.d.n ? 'door2' : 'buzz');
    if (!s.d.n) ui.toast('Sai thứ tự. Báo động kêu, gạt lại từ đầu!', 3000);
  } else if (m.type === 'window' && (s.d.b || 0) !== was.b) {
    G.sfx(s.d.b ? 'door2' : 'buzz');
    if (!s.d.b) ui.toast('Quá 28 giây, van tự khóa lại. Làm lại cả 3 van.', 3000);
  } else if (m.type === 'sync' && m.lines) {
    for (const [at, who, text] of m.lines) if (was.sec < at && (s.d.s || 0) >= at) talk([[who, text]]);
  } else if (m.type === 'carry') worldSync();
}
function announce(m) {
  if (!m) return;
  G.sfx('pickup');
  const extra = {
    bars: 'Song cửa đã cong. Chui ra được rồi.', exit: 'Cửa khu giam mở.', entry: 'Tòa A đã mở.', cams: 'Camera đã tắt hết.', levers: 'Máy phát chạy. Có điện rồi.',
    cut: 'Đèn pha tắt hết!', send: 'Tin cầu cứu đã đi. Đèn pha sáng lại!', ring: 'Có chìa khóa khu phạt.', spy: 'Đã biết mã két.', safe: 'Đã lấy được cuốn sổ.', grate: 'Miệng cống đã mở.',
    planks: 'Cầu đã bắc qua suối.', gate: 'Cổng chốt đã mở.', bamboo: 'Đủ tre làm bè.', lash: 'Bè đã buộc chắc.',
  }[m.id];
  ui.toast(extra || 'Xong nhiệm vụ. Sang việc tiếp theo.', 2600);
  if (m.say) talk(m.say);
}

// ---- short lines during play: nobody stops, nobody clicks ----
function talk(lines) { if (M) for (const l of lines) M.talk.push(l); }
function hush() {
  if (!M) return;
  M.talk.length = 0; M.talkT = 0;
  document.body.classList.remove('field-talk');
}
function talkTick(dt) {
  if (M.talkT > 0) {
    M.talkT -= dt;
    if (M.talkT <= 0 && !M.talk.length) { KIT.sub(); document.body.classList.remove('field-talk'); }
    if (M.talkT > 0) return;
  }
  const next = M.talk.shift(); if (!next) return;
  KIT.sub(next[0], next[1]);
  document.body.classList.add('field-talk');
  M.talkT = Math.min(8, 2 + next[1].length * 0.05);
}

// ================================ building an act ================================
const LOOK = {
  nhan: { shirt: 0x7a5a6a, pants: 0x2a2a30, skin: 0xc79a74, longHair: true, longSleeve: true },
  boatman: { shirt: 0x5a7a8a, pants: 0x2a2a2a, skin: 0x9a6a48, hair: 0x9a948c, cap: 0x8a7a5a }, // as on his boat (escape.js)
  boss: { shirt: 0x2a2a38, pants: 0x18181c, skin: 0xb88760, longSleeve: true },
  loc: { shirt: 0x5a6a4a, pants: 0x2a2a2a, skin: 0xb5835e, bruises: true },
  victim: [
    { shirt: 0x6a5a4a, pants: 0x2a2a2a, skin: 0xc79a74, bruises: true },
    { shirt: 0x8a6a6a, pants: 0x2a2a2a, skin: 0xd6a985, longHair: true, bruises: true },
    { shirt: 0x4a5a6a, pants: 0x2a2a2a, skin: 0xa8754f, bruises: true },
  ],
  thai: { shirt: 0x6a5a3c, pants: 0x3a3226, skin: 0xa8754f, cap: 0x3a3226, longSleeve: true, label: 'POLICE' },
  viet: { shirt: 0x3d5a3a, pants: 0x2e3e2c, skin: 0xb08560, cap: 0x2e3e2c, longSleeve: true, label: 'CẢNH SÁT' },
  thiri: { shirt: 0xc05a7a, pants: 0x3a4a5a, skin: 0xa8754f, longHair: true },
};
function letterSigns() {
  L().levers.forEach((p, k) => {
    const mat = new T.SpriteMaterial({ map: G.signTex(['ABCDE'[k]], { bg: '#dcd4be', fg: '#20262a', w: 96, h: 96, grime: false }), fog: false });
    const spr = new T.Sprite(mat); spr.scale.set(0.5, 0.5, 1); spr.position.set(p.x, 2.2, p.z); G.add(spr);
  });
}
function castCompound() {
  const l = L(), D = M.draw, add = (k, look, at, yaw, pose) => G.addNpc(k, look, { x: at.x, z: at.z, yaw: yaw || 0, pose: pose || 'stand' });
  add('nhan', LOOK.nhan, l.nhan, -1.2, 'floor');
  l.witness.forEach((p, k) => add('wit' + k, LOOK.victim[k], p, [1.4, 1.6, 1.4][k], 'talk'));
  l.suspects.forEach((p, k) => {
    const s = D.suspects[k];
    add('sus' + k, { shirt: s.color[1], pants: 0x2a2a2a, skin: [0xc79a74, 0xb5835e, 0xa8754f, 0xc49a76][k], cap: s.cap ? 0x1c1c20 : undefined, longSleeve: s.sleeves }, p, 0, 'stand');
  });
  l.cells.forEach((c, k) => add('vic' + k, LOOK.victim[k % 3], { x: c.x - 0.3, z: c.z - 0.2 }, 0.2, 'floor'));
  add('loc', LOOK.loc, l.injured, 1.2, 'floor');
  add('boatman', LOOK.boatman, l.boatmanSeat, Math.PI / 2, 'talk');
  add('boss', LOOK.boss, l.bossSeat, -Math.PI / 2, 'talk');
  letterSigns();
}
function castBorder() {
  const add = (k, look, x, z, yaw, pose) => G.addNpc(k, look, { x, z, yaw, pose: pose || 'stand' });
  add('thiri', LOOK.thiri, 2.6, 6.4, -2.4, 'point');
  add('anan', LOOK.thai, -1.8, 249.6, Math.PI, 'raise');
  add('thai2', LOOK.thai, 3.4, 251, Math.PI);
  add('minh', LOOK.viet, 1.2, 249.2, Math.PI, 'raise');
}
function weather() {
  const o = S.teamOpts || {}, n = M.s.act;
  const hour = (HOURS[o.tod] || HOURS.night) + Math.max(0, n - 1) * (o.tod === 'day' ? 1.5 : 1.1);
  const rain = { dry: 0, rain: 0.5, storm: 0.95 }[o.wx || 'rain'];
  G.overcast = { dry: 0.3, rain: 0.8, storm: 1 }[o.wx || 'rain'] * (ACT().border ? 0.65 : 1);
  G.setRain(rain); G.lightningOn = o.wx === 'storm';
  S.clock = hour * 60; S.clockRate = 0.05; G.setTime(hour);
}
function actLabel() {
  S.actLabel = 'Chặng ' + (M.s.act + 1) + '/' + ACTS.length;
  S.phaseLabel = ACT().name;
}
// the level of act n, without anybody placed yet
function buildLand() {
  const n = M.s.act, def = ACTS[n], leg = def.border ? 4 : 3, o = S.teamOpts || {};
  dropCans();
  KIT.enterLeg(STAGE, leg, 'myanmar');
  P.load = 0;
  G.guardFilter = (defs) => ST.teamGuards({ few: FEW[leg], more: MORE[leg] }, defs, o.guards);
  try { G.loadLevel(def.border ? 'border' : 'myanmar'); } finally { G.guardFilter = null; }
  G.setGuardsMode('night');
  for (const g of G.guards) if (g.kind === 'office') g.noBreak = true; // he only gets up when somebody lures him
  G.titleOrbit = def.border ? { r: 90, h: 40, cx: 0, cz: 130 } : { r: 135, h: 58, cx: 0, cz: 0 };
  M.items = []; M.built = { act: n, fails: M.s.fails }; M.grace = new Map(); M.allDown = 0; M.wasTd = new Map();
  if (def.border) castBorder(); else castCompound();
  S.chapter = 3; S.mood = null;
  S.teamDone = ACTS.slice(0, n).reduce((k, a) => k + a.missions.length, 0);
  actLabel(); worldSync();
}
function spotFor(id) {
  const a = L().spawns[ACT().spawn], k = KIT.slot(id);
  return { x: a.x + ((k % 3) - 1) * 0.95, z: a.z + (k < 3 ? -0.5 : 0.5), yaw: M.s.act === 5 ? 0 : M.s.act === 1 ? 0 : Math.PI / 2 };
}
function placeAll() {
  const me = spotFor(NET.id);
  G.placePlayer(me.x, me.z, me.yaw);
  if (!NET.isHost()) return;
  for (const b of bots()) {
    const p = spotFor(b.id);
    b.tpos.set(p.x, 0, p.z); b.pos.copy(b.tpos); b.tyaw = b.yaw = p.yaw; b.ai = {}; b.got = true; b.last = now();
  }
}
function beginPlay() {
  KIT.sub(); G.cineOff();
  for (const p of peers()) p.hold = null;
  S.f.scene = false; S.busy = false; S.stealthPhase = true; S.clockRun = true;
  P.frozen = false; P.pose = null;
  G.input.crouch = true; G.input.run = false;
  ui.hud(true); ui.black(false);
  objectives(); newMission();
  for (const x of members()) M.grace.set(x.id, GRACE);
  save(M.s.act);
}
// arriving in act n (the level is built and everybody stands at its start)
function arrive(how) {
  hush();
  if (NET.isHost()) { M.s.d = freshData(ACT().missions[M.s.i]); send(); }
  if (how === 'next' && M.s.act === 1) { wakeScene(); return; }
  beginPlay();
  if (how === 'retry') ui.toast('Làm lại ' + S.actLabel + ': ' + ACT().name + ' (lần ' + M.s.fails + ')', 4200);
  else { ui.toast(S.actLabel + ': ' + ACT().name + ' · đã lưu', 3600); talk(ACT().intro); }
}
// the next act in the same level: nobody is moved
function nextActHere() {
  M.built.act = M.s.act;
  S.teamDone = ACTS.slice(0, M.s.act).reduce((k, a) => k + a.missions.length, 0);
  if (S.tied) { S.tied = false; P.frozen = false; P.pose = null; G.resetStance(); }
  for (const p of peers()) p.td = false;
  for (const x of members()) M.grace.set(x.id, FREE_GRACE);
  actLabel(); objectives(); newMission();
  save(M.s.act);
  ui.toast(S.actLabel + ': ' + ACT().name + ' · đã lưu', 3600);
  talk(ACT().intro);
}
// black, then build whatever the state says
function transition(how, from) {
  M.pending = true;
  G.panel.close(); hush();
  S.hold = null; S.stealthPhase = false; G.stealth = false; P.climb = 0; P.frozen = true; P.speed = 0; P.load = 0;
  G.OBJ = []; G.INTER = [];
  const ch = ESC.ch();
  if (S.teamLeg === 1 && ch) ch.on = false;
  if (how === 'retry') { G.sfx('caught'); ui.flash(); ui.toast(M.why === 'time' ? 'HẾT GIỜ! Làm lại chặng này.' : 'CẢ ĐỘI BỊ BẮT LẠI! Làm lại chặng này.', 2600); }
  M.why = '';
  KIT.play([KIT.toBlack(), [0.25, () => { G.cam.drug = 0; blur(0); M.pending = false; build(how, from); }]]);
}
function build(how) {
  const def = ACT();
  if (def.airport) {
    dropCans(); G.panel.close();
    M.built = null;
    KIT.airportBuild();
    S.teamDone = total - 1;
    S.actLabel = 'Chặng ' + ACTS.length + '/' + ACTS.length;
    return;
  }
  if (def.river) {
    KIT.riverBuild();
    KIT.riverWeather(false);
    G.OBJ[0].time = Math.round(G.OBJ[0].time * ST.teamTimeK());
    M.built = null;
    const sp = KIT.river.spawn();
    G.placePlayer(sp.x, sp.z, sp.yaw);
    if (NET.isHost()) bots().forEach((b, i) => { const p = KIT.river.botSpawn(i); b.tpos.set(p.x, 0, p.z); b.pos.copy(b.tpos); b.tyaw = b.yaw = 0; b.last = now(); });
    actLabel(); S.phaseLabel = '';
    KIT.riverIntro();
    return;
  }
  buildLand(); weather(); placeAll(); arrive(how);
}

// ================================ the world follows the state ================================
function setCol(o, open) { o.group.visible = !open; o.col.off = open; }
function openIf(door, open) { if (open && !door.open) G.openDoor(door); }
function show(key, on) { const n = npc(key); if (n) n.show = on; }
function worldSync() {
  if (!M.built) return;
  const l = L(), m = mission(), d = M.s.d;
  if (ACT().border) {
    const built = isDone('planks');
    l.bridge.group.visible = built; l.bridge.col.off = built;
    setCol(l.gate, isDone('gate'));
    const logs = isDone('bamboo') ? 4 : m && m.id === 'bamboo' ? stats(m, d).count : 0;
    l.raftLogs.forEach((g, k) => { g.visible = k < logs; });
    l.raftRopes.visible = isDone('lash');
    l.ribbonMesh.forEach((r, k) => { r.visible = !(isDone('ribbon') || (m && m.id === 'ribbon' && (d.b >> k) & 1)); });
    show('thiri', !isDone('planks'));
    return;
  }
  if (!l.bars) return;
  setCol(l.bars, isDone('bars'));
  openIf(l.detDoor, isDone('exit'));
  openIf(l.towerDoor, isDone('entry')); openIf(l.towerSide, isDone('entry'));
  for (const s of G.searchlights) if (s.red) s.off = isDone('cams');
  l.genLed.material.color.setHex(isDone('levers') ? 0x30ff60 : 0xff2020);
  G.lightsOut = isDone('cut') && !isDone('send');
  openIf(l.villaDoor, isDone('spy'));
  setCol(l.grate, isDone('grate'));
  l.cells.forEach((c, k) => {
    const open = isDone('cells') || (!!m && m.id === 'cells' && !!((d.b >> k) & 1));
    openIf(c.door, open);
    const v = npc('vic' + k); if (v && open) v.pose = 'kneel';
    show('vic' + k, !isDone('escort'));
  });
  const nh = npc('nhan');
  if (nh) {
    const at = isDone('exit') ? l.alley : l.nhan;
    nh.pos.set(at.x + (isDone('exit') ? -0.9 : 0.3), 0, at.z);
    nh.pose = isDone('exit') ? 'talk' : isDone('nhan') ? 'kneel' : 'floor';
    nh.yaw = isDone('exit') ? Math.PI / 2 : -1.2;
  }
  const mole = npc('sus' + M.draw.mole);
  if (mole && isDone('mole')) mole.pose = 'tied';
  show('boatman', !isDone('spy')); show('boss', !isDone('spy'));
  const lo = npc('loc');
  if (lo) {
    if (isDone('escort')) { lo.run = null; lo.pos.set(l.hideout.x, 0, l.hideout.z); lo.pose = 'floor'; }
    else if (!(m && m.id === 'escort')) { lo.pos.set(l.injured.x, 0, l.injured.z); lo.pose = 'floor'; }
  }
}

// ---- things to carry ----
const ITEM = {};
function itemMesh(look) {
  if (!ITEM[look]) {
    const std = (hex) => G.std({ color: C(hex), roughness: 0.7 });
    ITEM[look] = {
      can: () => new T.Mesh(new T.BoxGeometry(0.36, 0.48, 0.22), std(0xa8261e)),
      kit: () => new T.Mesh(new T.BoxGeometry(0.46, 0.3, 0.3), std(0xe8e8e2)),
      plank: () => new T.Mesh(new T.BoxGeometry(2.2, 0.08, 0.36), G.MAT.planks),
      pole: () => {
        const geo = new T.CylinderGeometry(0.13, 0.13, 2.6, 8); geo.rotateZ(Math.PI / 2);
        return new T.Mesh(geo, G.MAT.bamboo);
      },
    }[look];
  }
  const m = ITEM[look](); m.castShadow = true; G.add(m); return m;
}
function itemsFor(m) {
  for (const it of M.items) if (it.parent) it.parent.remove(it);
  M.items = m && m.type === 'carry' ? m.items(L()).map(() => itemMesh(m.look)) : [];
}
function itemHome(m, d, k) {
  const v = d.c && d.c[k];
  return Array.isArray(v) ? { x: v[0], z: v[1] } : m.items(L())[k];
}
function myLoad(m, d) { return m && m.type === 'carry' && d.c ? d.c.indexOf(NET.id) : -1; }
function drawItems(m, d) {
  if (!m || m.type !== 'carry' || !d.c) return;
  const to = m.to(L());
  let heap = 0;
  M.items.forEach((it, k) => {
    const v = d.c[k];
    it.visible = true;
    if (v === -1) { it.position.set(to.x + 1.1, 0.2 + heap * 0.14, to.z - 0.5); it.rotation.y = 0; heap++; return; }
    if (typeof v === 'number' && v > 0) {
      const me = v === NET.id, p = me ? null : NET.peers.get(v);
      if (!me && !p) { it.visible = false; return; }
      const pos = me ? P.pos : p.pos, yaw = me ? P.yaw : p.yaw, crouched = me ? P.crouch : p.c;
      it.position.set(pos.x + Math.sin(yaw) * 0.42, crouched ? 0.8 : 1.12, pos.z + Math.cos(yaw) * 0.42);
      it.rotation.y = yaw; return;
    }
    const h = itemHome(m, d, k);
    it.position.set(h.x, 0.26, h.z); it.rotation.y = 0.3;
  });
}

// ---- the walk with anh Lộc ----
function wayPts(m) { return [[m.from(L()).x, m.from(L()).z]].concat(m.via(), [[m.to(L()).x, m.to(L()).z]]); }
function wayLen(pts) { let n = 0; for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return n; }
function wayAt(pts, s) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az) || 1e-3;
    if (s <= len) return { x: ax + (bx - ax) * s / len, z: az + (bz - az) * s / len };
    s -= len;
  }
  const e = pts[pts.length - 1];
  return { x: e[0], z: e[1] };
}
const locAt = (m, d) => wayAt(wayPts(m), d.p || 0);

// ================================ objectives and what E does ================================
function nearest(list) {
  let best = null, bd = 1e9;
  for (const p of list) { const d = dist(P.pos, p); if (d < bd) { bd = d; best = p; } }
  return best;
}
function goalOf(m) {
  const l = L(), d = M.s.d, cur = mission() === m;
  switch (m.type) {
    case 'multi': {
      const s = m.spots(l, M.draw); if (!cur) return s[0];
      if (m.ordered) return s[Math.min(s.length - 1, popcount(d.b))];
      return nearest(s.filter((p, k) => !((d.b >> k) & 1))) || s[0];
    }
    case 'carry': {
      if (!cur || !d.c || myLoad(m, d) >= 0) return m.to(l);
      return nearest(d.c.map((v, k) => (v === 0 || Array.isArray(v) ? itemHome(m, d, k) : null)).filter(Boolean)) || m.to(l);
    }
    case 'sync': {
      const s = m.spots(l); if (s.length < 2 || !cur) return s[0];
      if (G.coopMine() === m.key + '1' || G.coopOthers(m.key + '0')) return s[1];
      return s[0];
    }
    case 'seq': {
      const s = m.spots(l); if (!cur) return s[0];
      const pulled = m.order(M.draw).slice(0, d.n || 0);
      return nearest(s.filter((p, k) => !pulled.includes(k))) || s[0];
    }
    case 'window': {
      const s = m.spots(l); if (!cur) return s[0];
      return nearest(s.filter((p, k) => !((d.b >> k) & 1))) || s[0];
    }
    case 'escort': return cur ? locAt(m, d) : m.from(l);
    case 'paddle': return l.farBank;
    default: return m.at(l);
  }
}
function secondOf(m) {
  const l = L(), d = M.s.d;
  if (m.type === 'support') return m.help(l);
  if (m.lure) return m.lure.at(l);
  if (m.type === 'sync') {
    const s = m.spots(l); if (s.length < 2) return null;
    return goalOf(m) === s[0] ? s[1] : s[0];
  }
  if (m.type === 'escort') return m.to(l);
  if (m.type === 'carry' && mission() === m && myLoad(m, d) < 0 && (d.c || []).some((v) => typeof v === 'number' && v > 0)) return m.to(l);
  return null;
}
function objectives() {
  const n = M.s.act, list = ACTS[n].missions;
  G.OBJ = list.map((m, k) => {
    const o = { at: () => goalOf(m) || P.pos, done: () => !live() || M.s.act > n || M.s.i > k, time: Math.round(m.time * ST.teamTimeK()), lv: m.lv };
    const progress = () => (M.s.act !== n || M.s.i > k ? fullData(m) : M.s.i === k ? M.s.d : {}); // finished · current · still to come
    Object.defineProperty(o, 't', { get: () => (typeof m.t === 'string' ? m.t : m.t(stats(m, progress()))) });
    if (m.type === 'support' || m.lure || m.type === 'sync' || m.type === 'escort' || m.type === 'carry') o.at2 = () => (mission() === m ? secondOf(m) : null);
    return o;
  });
}
function fullData(m) { // a finished mission in the list reads full
  switch (m.type) {
    case 'multi': return { b: m.hit ? M.draw.fuse.reduce((b, k) => b | (1 << k), 0) : (1 << m.spots(L(), M.draw).length) - 1 };
    case 'carry': return { c: m.items(L()).map(() => -1) };
    case 'sync': return { s: m.secs };
    case 'seq': return { n: m.order(M.draw).length };
    case 'window': return { b: (1 << m.spots(L()).length) - 1 };
    case 'paddle': case 'gather': return { all: true };
    default: return {};
  }
}
const untieInter = () => ({ at: () => (ST.tiedNear() || P).pos, r: 1.9, when: () => !!ST.tiedNear(), hold: 2.2, run: () => ST.freeMate(),
  label: () => 'Cởi trói cho ' + (ST.tiedNear() || { name: 'đồng đội' }).name + ' (giữ)' });
const crouchBlock = (m) => (m.crouch && !P.crouch ? 'Cúi người ' + (G.input.touch ? '(nút Cúi)' : '(C)') + ' kẻo bị nghe thấy' : null);
// a spot the host counts, hidden for a moment once used (until the state comes back)
function sentNow(key) { return now() - (M.sent.get(key) || -1e9) < 1200; }
function sendOnce(k, x) { M.sent.set(k + x, now()); act(k, x); }
function interactions() {
  const m = mission(), l = L(), list = [untieInter()];
  G.INTER = list;
  if (!m) return;
  const is = () => mission() === m && !M.pending;
  const add = (it) => { const when = it.when; it.when = () => is() && (!when || when()); list.push(it); };
  const done = () => { G.sfx('pickup'); act('dn'); };
  switch (m.type) {
    case 'do':
      add({ at: () => m.at(l), r: m.r || 1.4, hold: m.hold, label: m.label, block: m.block, run: done });
      break;
    case 'support': {
      const it = { at: () => m.at(l), r: m.r || 1.5, hold: m.hold, label: m.label, run: done,
        block: () => crouchBlock(m) || (G.coopOthers(m.key) ? null : m.wait) };
      if (m.climb) {
        const down = () => { P.climb = 0; P.frozen = false; P.pose = null; P.pos.set(m.at(l).x, 0, m.at(l).z); };
        it.onHold = (p) => { const top = l.ladderTop; P.frozen = true; P.pose = 'climb'; P.climb = Math.max(0.01, p); P.pos.set(top.x, Math.min(1, p * 1.15) * top.y, top.z); P.yaw = Math.PI; P.phase += 0.2; };
        it.onCancel = down;
        it.run = () => { down(); done(); };
      }
      add(it);
      add({ at: () => m.help(l), r: 1.15, hold: Infinity, coop: m.key, run() {}, label: () => (G.coopMine() === m.key ? 'Đang giữ. Đừng buông!' : m.helpLabel) });
      break;
    }
    case 'together':
      add({ at: () => m.at(l), r: m.r || 1.8, hold: m.hold, coop: m.key, need: 2, label: m.label, run: done });
      break;
    case 'panel':
      add({ at: () => m.at(l), r: m.r || 1.5, label: m.label, run: () => {
        const e = M.s.e;
        G.panel.open(Object.assign({ kind: m.kind, done: () => { if (is() && M.s.e === e) act('dn'); }, wrong: () => { if (is() && M.s.e === e) act('bad'); } }, m.spec(M.draw)));
      } });
      break;
    case 'multi':
      m.spots(l, M.draw).forEach((p, k) => add({ at: () => p, r: m.r || 1.35, hold: m.hold, label: m.label,
        when: () => !((M.s.d.b >> k) & 1) && !sentNow('sp' + k) && (!m.ordered || popcount(M.s.d.b) === k), run: () => sendOnce('sp', k) }));
      break;
    case 'carry':
      m.items(l).forEach((p, k) => add({ at: () => itemHome(m, M.s.d, k), r: 1.5, hold: 1, label: 'Vác ' + m.what + ' (giữ)',
        when: () => { const v = (M.s.d.c || [])[k]; return (v === 0 || Array.isArray(v)) && myLoad(m, M.s.d) < 0 && !sentNow('pick' + k); }, run: () => sendOnce('pick', k) }));
      add({ at: () => m.to(l), r: 2.1, hold: 1.2, label: 'Đặt ' + m.what + ' xuống (giữ)', when: () => myLoad(m, M.s.d) >= 0 && !sentNow('put0'), run: () => sendOnce('put', 0) });
      break;
    case 'sync':
      m.spots(l).forEach((p, k) => add({ at: () => p, r: 1.35, hold: Infinity, coop: m.key + k, run() {}, block: () => crouchBlock(m),
        label: () => (G.coopMine() === m.key + k ? 'Đang giữ · ' + Math.floor(M.s.d.s || 0) + '/' + m.secs + ' giây' : m.labels[k]) }));
      break;
    case 'seq':
      m.spots(l).forEach((p, k) => add({ at: () => p, r: 1.4, hold: m.hold, label: m.label + ' ' + m.names[k] + ' (giữ)',
        when: () => !m.order(M.draw).slice(0, M.s.d.n || 0).includes(k) && !sentNow('lev' + k), run: () => sendOnce('lev', k) }));
      break;
    case 'window':
      m.spots(l).forEach((p, k) => add({ at: () => p, r: 1.6, hold: m.hold, label: m.label,
        when: () => !((M.s.d.b >> k) & 1) && !sentNow('val' + k), run: () => sendOnce('val', k) }));
      break;
    default: // escort, gather: just be there; paddle: its panel
  }
  if (m.lure) {
    add({ at: () => m.lure.at(l), r: 1.5, hold: 1.2, label: m.lure.label,
      block: () => (now() - (S.f.lureAt || -1e9) < 9000 ? 'Vừa gõ xong. Nấp đi!' : null),
      run: () => {
        const p = m.lure.at(l);
        S.f.lureAt = now(); G.sfx('cage'); G.sfx('door2');
        G.makeNoise(p.x, p.z, m.lure.r, 'lure'); NET.say('lured');
        ui.toast(m.lure.toast, 3600);
      } });
  }
}
function newMission() {
  const m = mission();
  G.panel.close();
  M.sent.clear(); M.noise = 0;
  worldSync(); interactions(); itemsFor(m);
  if (!m) return;
  if (m.warn) ui.toast(m.warn, 5200);
  if (m.type === 'paddle') boardRaft(m);
}

// ---- the raft ----
function raftSeat(id) { const k = KIT.slot(id); return { x: ((k % 3) - 1) * 1.15, z: (k < 3 ? -0.75 : 0.75) }; }
function boardRaft(m) {
  S.tied = false; S.hold = null; S.stealthPhase = false; P.load = 0;
  for (const p of peers()) p.td = false;
  S.f.raft = true; S.f.raftK = 0;
  P.pose = 'kneel';
  const s = raftSeat(NET.id);
  G.placePlayer(s.x, L().raft.position.z + s.z, 0);
  G.panel.open({ kind: 'paddle', title: 'Chèo qua sông Moei', hint: 'Bấm đúng bên đang sáng, mỗi nhịp một lần.', locked: true,
    stroke: () => act('row'), progress: () => [M.s.d.n || 0, M.s.d.need || m.per] });
  P.frozen = true; P.pose = 'kneel';
}
function raftTick(dt) {
  if (!S.f.raft) return;
  const l = L(), m = mission(), k = M.s.out ? 1 : m && m.type === 'paddle' ? G.clamp((M.s.d.n || 0) / (M.s.d.need || 1), 0, 1) : 0;
  S.f.raftK = G.damp(S.f.raftK || 0, k, 2.5, dt);
  const z = l.raftFrom + (l.raftTo - l.raftFrom) * S.f.raftK, s = raftSeat(NET.id);
  l.raft.position.z = z;
  l.raft.position.y = 0.05 + Math.sin(now() / 480) * 0.025;
  if (S.f.ashore) return;
  P.pos.set(s.x, l.raft.position.y + 0.26, z + s.z); P.yaw = 0; P.frozen = true; P.pose = 'kneel';
}

// ================================ host: what it counts ================================
function hostTick(dt) {
  const m = mission();
  if (M.beat <= 0) send();
  if (!m || M.pending || S.f.scene) return;
  const d = M.s.d;
  let changed = false;
  if (m.type === 'sync') {
    const spots = m.spots(L()), all = spots.every((p, k) => G.coopCount(m.key + k) > 0), was = d.s || 0;
    if (all) d.s = Math.min(m.secs, was + dt);
    else if (m.atOnce) d.s = 0;
    const s = d.s || 0;
    if (all && m.noiseEvery && Math.floor(s / m.noiseEvery) > Math.floor(was / m.noiseEvery) && s < m.secs) { G.sfx('alert'); G.makeNoise(spots[0].x, spots[0].z, 24, 'alarm', true); }
    if (s >= m.secs) { complete(); return; }
    changed = Math.floor(s) !== Math.floor(was);
  } else if (m.type === 'window' && d.b) {
    const was = Math.ceil(d.t);
    d.t -= dt;
    if (d.t <= 0) { d.b = 0; d.t = 0; commit(); return; }
    changed = Math.ceil(d.t) !== was;
  } else if (m.type === 'carry' && d.c) {
    d.c.forEach((v, k) => {
      if (!(typeof v === 'number' && v > 0)) return;
      const me = v === NET.id, p = me ? null : NET.peers.get(v);
      if (me ? !S.tied && !S.busy : p && !p.td && !p.b && NET.fresh(p)) {
        const at = me ? P.pos : p.bot ? p.tpos : p.pos;
        M.carried.set(k, [round2(at.x), round2(at.z)]);
        return;
      }
      d.c[k] = M.carried.get(k) || 0; // dropped where they were caught
      changed = true;
    });
    if (changed) { commit(); return; }
  } else if (m.type === 'escort') {
    const pts = wayPts(m), end = wayLen(pts), at = wayAt(pts, d.p || 0);
    if (members().some((x) => upAndAbout(x) && dist(x.pos, at) < 5)) {
      const was = d.p || 0;
      d.p = Math.min(end, was + 1.9 * dt);
      if (d.p >= end) { complete(); return; }
      changed = Math.floor(d.p / 0.4) !== Math.floor(was / 0.4);
    }
  } else if (m.type === 'gather') {
    const all = members();
    M.gatherT = gathered(m, all).length >= all.length ? (M.gatherT || 0) + dt : 0;
    if (M.gatherT > 0.8) { M.gatherT = 0; complete(); return; }
  }
  if (changed) commit();
  else if (M.dirty && M.beat < 1.3) commit();
}

// ================================ scenes ================================
let cans = [];
function dropCans() { for (const c of cans) if (c.parent) c.parent.remove(c); cans = []; }
function handCans() {
  dropCans();
  const geo = new T.CylinderGeometry(0.036, 0.036, 0.13, 10), mat = G.std({ color: C(0xd8342c), metalness: 0.55, roughness: 0.35 });
  const who = [P.h].concat(peers().map((p) => p.h));
  for (let i = 0; i < 4; i++) if (npc('rv' + i)) who.push(npc('rv' + i).h);
  for (const h of who) {
    if (!h || !h.elR) continue;
    const c = new T.Mesh(geo, mat);
    c.position.set(0, -((h.dims ? h.dims.fore : 0.255) + 0.1), 0.03);
    h.elR.add(c); cans.push(c);
  }
}
function everyone(pose) {
  P.pose = pose;
  for (const p of peers()) if (p.hold) p.hold.pose = pose;
}
let blurAt = 0;
function blur(px) { const v = Math.round(px * 2) / 2; if (v === blurAt) return; blurAt = v; ui.blur(v); }
function twistScene() {
  const ch = ESC.ch(), boat = L().boat, n = 1 + NET.peers.size;
  const line = KIT.line, tu = () => npc('tu');
  const box = new T.Mesh(new T.BoxGeometry(0.75, 0.42, 0.5), G.std({ color: C(0x2f6fb0), roughness: 0.5 }));
  box.position.set(-1.0, boat.userData.deckY + 0.21, -0.55); boat.add(box);
  S.f.twist = true; S.f.drug = 0;
  S.f.lamp = G.addEmitter({ kind: 'lamp', pos: new T.Vector3(), target: new T.Vector3(), angle: 0.8, penumbra: 0.9, color: C(0xffc890), intensity: 3.4, range: 9, decay: 1.2, prio: 6, on: () => !!S.f.twistCam }); // the lamp under his awning
  KIT.play([
    line(3, 'Ông Tư', 'Đủ người rồi! Ngồi thấp xuống, bám chắc vào mạn tàu!'),
    line(2.8, '', '', () => { ch.ride.vt = 6.5; tu().pose = 'stand'; G.cine([-42.2, 2.9, 187.2], [-58, 1, 197], false, 3); }),
    line(3.6, 'Ông Tư', 'Tụi nó ném đá theo kìa! Cúi đầu xuống, đừng ngóc lên!'),
    line(5, 'Ông Tư', 'Chú tên Tư, người Việt, sống trên sông này ba mươi năm rồi. Công an bên mình nhờ chú ra đón các cháu.', () => { S.f.follow = true; }),
    line(2.8, 'Cả đội', 'Cảm ơn chú... cảm ơn chú nhiều lắm!'),
    line(5.2, 'Ông Tư', 'Chạy xa vậy chắc khát khô cổ rồi. Nước giải khát trong thùng đá đó, chú khui sẵn cho từng đứa.', () => { S.f.follow = false; S.f.twistCam = 'side'; ch.ride.vt = 3; tu().pose = 'point'; G.setTime(6.25); }),
    line(3.6, '', 'Ông Tư đưa cho mỗi người một lon nước ngọt ướp lạnh.', () => {
      G.sfx('pickup'); handCans(); everyone('drink');
      for (let i = 0; i < 4; i++) if (npc('rv' + i)) npc('rv' + i).pose = 'drink';
    }),
    line(3.8, 'Cả đội', 'Mát quá... Mà sao uống xong nó đăng đắng vậy chú?', () => { tu().pose = 'stand'; }),
    line(4.4, 'Ông Tư', 'Uống hết đi. Uống hết thì ngủ mới ngon.', () => { G.sfx('drug'); S.f.drugging = true; S.f.twistCam = 'tu'; }),
    line(3.8, 'Cả đội', 'Chân em... sao không nhấc lên được...', () => {
      dropCans(); everyone('lie'); G.sfx('heart');
      for (let i = 0; i < 4; i++) if (npc('rv' + i)) npc('rv' + i).pose = 'lie';
    }),
    line(6, 'Ông Tư', '(gọi điện) Ngủ hết rồi, cả thảy ' + (n + 4) + ' đứa. Khỏi trả về lò gạch, tôi chở thẳng qua Myanmar cho Khu Sương Đen.', () => { tu().pose = 'phone'; }),
    line(6.4, 'Ông Tư', 'Công an nào nhờ tao? Tao là người của băng lừa đảo Campuchia. Đứa nào chạy ra tới bến cũng là tiền của tao.', () => { tu().pose = 'point'; G.sfx('heart'); S.f.drug = 2; S.f.twistCam = 'face'; }),
    KIT.toBlack(() => { G.engineSound(false); G.sfx('drug'); }),
    line(4.6, '', 'Ba ngày sau. Hết xe tải rồi tới thuyền, rồi lại xe tải. Không ai biết đã qua bao nhiêu biên giới.', () => {
      S.f.drugging = false; S.f.twistCam = null; G.cam.drug = 0; blur(0);
      G.setRain(0); G.lightningOn = false;
    }),
  ], () => { KIT.sub(); S.f.twistDone = true; if (NET.isHost() && M.s.act === 0) startAct(1); });
}
function twistTick(dt) {
  if (S.f.twistCam) {
    const b = L().boat, W = (x, y, z) => b.localToWorld(new T.Vector3(x, y, z));
    const C3 = { side: [[1.2, 3.6, 5.6], [0.6, 1.5, 0]], tu: [[1.5, 2.5, 1.0], [-1.6, 2.2, 0.3]], face: [[0.0, 2.75, 0.85], [-1.6, 2.62, 0.4]] }[S.f.twistCam];
    const at = W.apply(null, C3[0]), to = W.apply(null, C3[1]);
    if (S.f.lamp) { S.f.lamp.pos.copy(W(0.4, 3.15, 1.0)); S.f.lamp.target.copy(W(-1.6, 2.4, 0.4)); }
    G.cine([at.x, at.y, at.z], [to.x, to.y, to.z], false, 4);
  }
  if (S.f.drugging) {
    S.f.drug += dt;
    G.cam.drug = Math.min(0.8, S.f.drug / 9);
    blur(Math.min(1.8, S.f.drug / 6));
  }
}
function wakeScene() {
  const c = L().cell, B = L().start, line = KIT.line;
  S.f.scene = true;
  S.busy = false; S.stealthPhase = false; P.frozen = true; P.pose = 'lie';
  for (const p of peers()) {
    KIT.holdPeer(p, 'lie');
    const a = spotFor(p.id);
    p.pos.set(a.x, 0, a.z); p.tpos.copy(p.pos); p.yaw = p.tyaw = 0;
  }
  G.addNpc('warden', LOOK.boss, { x: -67, z: -43.5, yaw: Math.PI, pose: 'point' }).show = true;
  ui.hud(false);
  G.cine([c.x1 - 1.2, 2.5, c.z0 + 0.9], [B.x, 0.7, B.z + 1.2], true, 1);
  KIT.play([
    line(4.6, '', 'Khu Sương Đen · Myanmar · một sào huyệt liên kết với băng lừa đảo Campuchia', () => { ui.black(false); ui.hud(false); blur(3); G.sfx('heart'); }),
    line(5.2, 'Gã quản khu', 'Dậy đi, hàng mới! Bên Campuchia bán tụi bây cho tao rồi. Mỗi đứa nợ tao mười lăm ngàn đô.', () => {
      blur(1.5); everyone('floor'); G.sfx('cage');
      G.cine([-65.2, 1.5, -49.4], [-67, 1.4, -43.6], false, 1.4);
    }),
    line(5, 'Gã quản khu', 'Trong này có lính, có chó, có tường. Ngoài tường là rừng, qua rừng là sông. Giỏi thì trốn thử coi.', () => { blur(0); }),
    line(3.6, 'Cả đội', 'Lon nước đó... Ông Tư bán tụi mình rồi.', () => {
      everyone('kneel'); show('warden', false);
      G.cine([c.x0 + 1.2, 2.2, c.z1 - 0.8], [B.x, 0.8, B.z - 0.4], false, 1.4);
    }),
    line(2.8, 'Cả đội', 'Không bỏ ai lại. Cùng nhau về nhà.', () => everyone('stand')),
  ], () => {
    blur(0);
    beginPlay();
    ui.toast(S.actLabel + ': ' + ACT().name + ' · đã lưu', 3600);
    if (NET.isHost()) send();
  });
}
function outScene() {
  const l = L(), line = KIT.line, all = members();
  G.panel.close(); hush();
  S.f.scene = true; S.stealthPhase = false; S.hold = null; P.frozen = true; P.pose = 'kneel';
  G.OBJ = []; G.INTER = []; ui.hud(false);
  G.cine([7.5, 3.6, 247.5], [0, 1, 240], false, 1.4);
  KIT.play([
    line(3.4, 'Thiếu tá Anan', '(qua phiên dịch) Nắm lấy tay tôi. Tới đất Thái rồi, mọi người an toàn.'),
    KIT.toBlack(() => {}),
    [0.3, () => {
      S.f.ashore = true;
      all.forEach((x) => {
        const k = KIT.slot(x.id), at = { x: ((k % 3) - 1) * 1.1 - 0.4, z: 246.2 - (k < 3 ? 0 : 1.1) };
        if (x.me) { P.pos.set(at.x, 0, at.z); P.yaw = 0; P.pose = 'stand'; }
        else { KIT.holdPeer(x.p, 'stand'); x.p.pos.set(at.x, 0, at.z); x.p.tpos.copy(x.p.pos); x.p.yaw = x.p.tyaw = 0; }
      });
      const mi = npc('minh'); if (mi) mi.pose = 'talk';
      G.cine([6.4, 2.6, 244.2], [0, 1.3, l.farBank.z + 0.6], true, 1);
    }],
    line(4.4, 'Đại úy Minh', 'Anh Minh đây. Giỏi lắm, không bỏ ai lại. Đưa anh cuốn sổ.', () => ui.black(false)),
    line(5.8, 'Đại úy Minh', 'Cảnh sát Thái sẽ lấy lời khai xác nhận nạn nhân, rồi xe đưa về Bangkok, gần 500 cây số. Đại sứ quán lo giấy tờ bay về.'),
    line(4.6, 'Thiếu tá Anan', '(qua phiên dịch) Tên ông lái tàu có trong sổ. Tối nay chúng tôi gửi sang cảnh sát Campuchia.'),
    KIT.toBlack(),
    line(6.6, '', 'Hai ngày sau, ông Tư bị bắt ngay trên con tàu của mình. Thùng đá vẫn còn đầy những lon nước khui sẵn.'),
  ], () => { KIT.sub(); S.f.outDone = true; if (NET.isHost()) startAct(6); });
}

// ================================ bots ================================
const BOT_GO = 2.7, BOT_LOAD = 1.9, BOT_RUN = 4.6;
function seenFrom(p) { // how many guards could see a (crouched) bot standing at p
  let n = 0;
  for (const g of G.guards) {
    const d = dist(g.pos, p);
    if (d > 11) continue;
    if (g.dog && d < G.DOG_SMELL.sneak + 1) { n++; continue; }
    if (Math.abs(G.angDiff(g.yaw, Math.atan2(p.x - g.pos.x, p.z - g.pos.z))) > 0.95) continue;
    if (!G.losBlocked(g.pos.x, g.pos.z, p.x, p.z)) n++;
  }
  return n;
}
function hideNear(pos) {
  let best = null, score = 1e9;
  for (const r of [3.5, 6.5, 10]) for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, q = { x: pos.x + Math.sin(a) * r, z: pos.z + Math.cos(a) * r };
    if (G.colliders.some((c) => c.solid && !c.off && c.y1 > 0.35 && c.y0 < 1.7 && G.inRect(q.x, q.z, c, 0.45))) continue;
    const s = seenFrom(q) * 20 + r * 0.3;
    if (s < score) { score = s; best = q; }
  }
  return best;
}
function humans() { return members().filter((x) => (x.me || !x.p.bot) && upAndAbout(x)).map((x) => x.pos); }
function farFrom(people, p) { let d = 999; for (const h of people) d = Math.min(d, dist(h, p)); return d; }
// the support half of the current mission: [bot → { at, hl, hold, done, speed, kneel }]
function botJobs(list, m) {
  const jobs = new Map();
  if (!m) return jobs;
  const free = list.filter((b) => !b.td && !b.ai.rescue), d = M.s.d, l = L(), people = humans();
  if (!free.length) return jobs;
  const closest = (p) => free.filter((b) => !jobs.has(b)).sort((a, b) => dist(a.tpos, p) - dist(b.tpos, p))[0];
  const give = (p, job) => { const b = closest(p); if (b) jobs.set(b, Object.assign({ at: p }, job)); };
  const keep = (key, p, job) => { // the same bot stays on a job
    const b = free.find((x) => !jobs.has(x) && x.ai.job === key) || closest(p);
    if (b) jobs.set(b, Object.assign({ at: p, key }, job));
  };
  switch (m.type) {
    case 'support':
      if (!humansHold(m.key)) keep(m.key, m.help(l), { hl: m.key, kneel: !!m.crouch });
      break;
    case 'together': {
      const c = m.at(l);
      keep(m.key, c, { hl: m.key, near: 1.5 });
      break;
    }
    case 'sync': {
      const s = m.spots(l); if (s.length < 2) break;
      let k = humansHold(m.key + '0') ? 1 : humansHold(m.key + '1') ? 0 : -1;
      if (k < 0) {
        k = farFrom(people, s[0]) >= farFrom(people, s[1]) ? 0 : 1;
        const had = free.find((b) => b.ai.job === m.key + '0' || b.ai.job === m.key + '1');
        if (had) { const j = had.ai.job === m.key + '0' ? 0 : 1; if (farFrom(people, s[j]) > 1.6) k = j; }
      }
      keep(m.key + k, s[k], { hl: m.key + k });
      break;
    }
    case 'multi':
      if (m.bots === false) break;
      m.spots(l, M.draw).forEach((p, k) => {
        if ((d.b >> k) & 1 || farFrom(people, p) < 2.2) return;
        const b = free.find((x) => !jobs.has(x) && x.ai.job === 'sp' + k);
        if (b) jobs.set(b, { at: p, key: 'sp' + k, hold: m.hold * 2, done: ['sp', k] });
      });
      m.spots(l, M.draw)
        .map((p, k) => ({ p, k, f: farFrom(people, p) }))
        .filter((q) => !((d.b >> q.k) & 1) && q.f >= 2.2 && ![...jobs.values()].some((j) => j.key === 'sp' + q.k))
        .sort((a, b) => b.f - a.f)
        .forEach((q) => give(q.p, { key: 'sp' + q.k, hold: m.hold * 2, done: ['sp', q.k] }));
      break;
    case 'carry':
      if (!d.c) break;
      for (const b of free) {
        if (d.c.includes(b.id)) jobs.set(b, { at: m.to(l), key: 'put', near: 1.7, hold: 1.2, done: ['put', 0], speed: BOT_LOAD });
      }
      if (jobs.size < 2) {
        d.c.map((v, k) => ({ v, k }))
          .filter((q) => q.v === 0 || Array.isArray(q.v))
          .map((q) => ({ k: q.k, p: itemHome(m, d, q.k) }))
          .sort((a, b) => farFrom(people, b.p) - farFrom(people, a.p))
          .slice(0, 1)
          .forEach((q) => keep('pick' + q.k, q.p, { near: 1.3, hold: 1.2, done: ['pick', q.k] }));
      }
      break;
    case 'window': {
      const open = m.spots(l).map((p, k) => ({ p, k })).filter((q) => !((d.b >> q.k) & 1));
      const had = free.find((b) => /^val/.test(b.ai.job || '') && open.some((q) => 'val' + q.k === b.ai.job && farFrom(people, q.p) > 2));
      const q = had ? open.find((o) => 'val' + o.k === had.ai.job) : open.slice().sort((a, b) => farFrom(people, b.p) - farFrom(people, a.p))[0];
      if (q) keep('val' + q.k, q.p, d.b ? { near: 1.2, hold: m.hold, done: ['val', q.k] } : {}); // waits for a person to turn the first
      break;
    }
    case 'gather':
      free.forEach((b, i) => {
        const c = m.at(l);
        jobs.set(b, { at: { x: c.x + ((i % 3) - 1) * 0.9, z: c.z - 1.1 - Math.floor(i / 3) * 0.7 }, key: 'gather' });
      });
      break;
    default:
      if (m.lure) keep('lure', m.lure.at(l), { lure: m.lure });
  }
  return jobs;
}
function humansHold(key) {
  if (G.coopMine() === key) return true;
  return peers().some((p) => !p.bot && p.hl === key && NET.fresh(p));
}
function botLure(b, job, dt) {
  const ai = b.ai, lu = job.lure, g = G.guards.find((x) => x.id === 'station'), desk = L().deskKey;
  const ready = g && g.state === 'sit' && humans().some((h) => dist(h, desk) < 11) && now() - (ai.lureAt || -1e9) > 12000;
  if (!ready) { ai.hold = 0; BK.moveTo(b, { x: -71.6, z: -34.2 }, BOT_GO, dt); return; } // out of his way, in an empty cell
  if (!BK.moveTo(b, job.at, 3, dt)) return;
  ai.hold = (ai.hold || 0) + dt;
  if (ai.hold < 1) return;
  ai.hold = 0; ai.lureAt = now();
  G.sfx('cage'); G.sfx('door2');
  G.makeNoise(job.at.x, job.at.z, lu.r, 'lure', true);
  NET.send({ t: 'say', k: 'lured', as: b.id });
  ui.toast(b.name + ' đang gõ ống nước dụ tên trực. Lấy chìa khóa ngay!', 3400);
}
function botsStep(list, dt) {
  const m = mission(), still = M.pending || !M.built || S.f.scene;
  for (const b of list) {
    if (!b.ai) b.ai = {};
    b.got = true; b.last = now(); b.e = S.teamLeg; b.o = false; b.hl = ''; b.r = false; b.c = true; b.p = b.td ? 'tied' : 'stand';
    if (still || b.td) b.s = 0;
  }
  if (still) return;
  if (m && m.type === 'paddle') {
    for (const b of list) {
      const s = raftSeat(b.id), r = L().raft.position;
      b.td = false; b.p = 'kneel'; b.c = false; b.s = 0; b.tyaw = 0;
      b.tpos.set(s.x, r.y + 0.26, r.z + s.z);
    }
    return;
  }
  BK.prep(list);
  BK.rescues(list, (b) => !!b.ai.holding && humans().some((h) => dist(h, b.ai.holding) < 3.6));
  const jobs = botJobs(list, m);
  for (const b of list) {
    const ai = b.ai;
    b.tpos.y = 0;
    if (b.td) { ai.path = null; ai.away = null; ai.holding = null; ai.job = ''; continue; }
    const det = (G.detBy || {})[b.id] || 0, seen = !!(G.seenBy || {})[b.id];
    if (ai.away) {
      ai.awayT -= dt;
      const there = BK.moveTo(b, ai.away, BOT_RUN, dt);
      b.c = false; b.r = true;
      if (ai.awayT <= 0 || (there && !seen)) ai.away = null;
      else if (there) { ai.away = hideNear(b.tpos); ai.awayT = 3; }
      continue;
    }
    if (seen && det > (ai.holding || ai.rescue ? 0.6 : 0.3)) { // somebody is watching: out of the cone, then back to work
      ai.away = hideNear(b.tpos); ai.awayT = 3.2; ai.holding = null; ai.hold = 0;
      if (ai.away) continue;
    }
    if (ai.rescue) {
      const tp = BK.tiedPos(ai.rescue); ai.holding = null; ai.job = '';
      if (!tp) continue;
      if (!ai.ap || dist(ai.apFor, tp) > 1) {
        const d = dist(b.tpos, tp) || 1;
        ai.ap = { x: tp.x + (b.tpos.x - tp.x) / d, z: tp.z + (b.tpos.z - tp.z) / d }; ai.apFor = { x: tp.x, z: tp.z };
      }
      if (dist(b.tpos, tp) < 1.6 || BK.moveTo(b, ai.ap, 3.1, dt)) {
        b.s = 0; BK.face(b, tp); ai.hold = (ai.hold || 0) + dt;
        if (ai.hold >= 2.2) { BK.free(b, ai.rescue); ai.rescue = null; ai.ap = null; ai.hold = 0; }
      }
      continue;
    }
    const job = jobs.get(b);
    if (!job) { b.s = 0; ai.holding = null; ai.job = ''; ai.hold = 0; continue; }
    if (ai.job !== (job.key || '')) { ai.job = job.key || ''; ai.hold = 0; }
    if (job.lure) { botLure(b, job, dt); continue; }
    const close = job.near && dist(b.tpos, job.at) < job.near;
    if (!close && !BK.moveTo(b, job.at, job.speed || BOT_GO, dt)) { ai.holding = null; ai.hold = 0; continue; }
    b.s = 0; BK.face(b, job.at);
    if (job.hl) { b.hl = job.hl; ai.holding = job.at; if (job.kneel) b.p = 'kneel'; continue; }
    if (!job.done) continue;
    ai.hold = (ai.hold || 0) + dt;
    if (ai.hold < job.hold) continue;
    ai.hold = 0;
    handle({ from: b.id, k: job.done[0], x: job.done[1], e: M.s.e, i: M.s.i });
  }
}

// ================================ every frame of the Myanmar legs ================================
function landTick(dt) {
  if (!M) return;
  if (!document.getElementById('card').hidden) return; // still reading the round's card
  KIT.tick();
  if (!M.built || (S.teamLeg !== 3 && S.teamLeg !== 4)) return;
  KIT.poseHeld(dt);
  G.panel.tick(dt);
  const m = mission(), d = M.s.d;
  for (const [id, t] of M.grace) { if (t - dt <= 0) M.grace.delete(id); else M.grace.set(id, t - dt); }
  for (const x of members()) {
    const td = x.me ? !!S.tied : !!x.p.td;
    if (M.wasTd.get(x.id) && !td) M.grace.set(x.id, FREE_GRACE);
    M.wasTd.set(x.id, td);
  }
  P.load = !M.pending && !S.tied && !S.busy && myLoad(m, d) >= 0 ? 0.72 : 0;
  drawItems(m, d);
  raftTick(dt);
  for (const k in G.npcs) {
    const n = G.npcs[k];
    n.h.group.visible = n.show !== false && G.camera.position.distanceToSquared(n.pos) < 58 * 58;
  }
  if (m && m.type === 'escort') {
    const n = npc('loc');
    if (n) {
      const at = locAt(m, d);
      n.h.group.visible = true;
      if (dist(n.pos, at) > 0.3) { G.npcGo(n, [[at.x, at.z]], { walk: true, speed: dist(n.pos, at) > 3 ? 5 : 2.1 }); n.pose = 'stand'; }
      else if (!n.run) n.pose = 'kneel';
    }
  }
  if (!S.f.scene) talkTick(dt);
  if (!NET.isHost()) return;
  hostTick(dt);
  if (M.pending || S.f.scene) return;
  M.allDown = ST.allTied() ? (M.allDown || 0) + dt : 0;
  if (M.allDown > 0.8) { M.allDown = 0; ST.teamEnd('caught'); }
}
function penned(pos) {
  if (!M || !M.built || M.pending || S.f.scene || S.f.raft) return true;
  if (pos === P.pos) { if (M.grace.has(NET.id)) return true; }
  else for (const p of peers()) if (p.pos === pos) { if (M.grace.has(p.id)) return true; break; }
  return M.s.act === 1 && !isDone('bars') && G.inRect(pos.x, pos.z, L().cell);
}
function banner() {
  if (!M || M.pending || !M.built || S.f.scene) return null;
  const down = peers().filter((p) => p.td).map((p) => p.name).join(', ');
  if (S.tied) return ['bad', 'Bạn đang bị trói ở ' + STAGE.postName + '. Chờ đồng đội tới cởi trói. Cả đội bị trói là làm lại chặng này.'];
  if (down) return ['bad', down + ' đang bị trói ở ' + STAGE.postName + '. Tới cởi trói (điểm đỏ).'];
  const m = mission(); if (!m) return null;
  const d = M.s.d, st = stats(m, d), withBot = bots().some((b) => !b.td);
  switch (m.type) {
    case 'carry':
      if (myLoad(m, d) >= 0) return ['', 'Đang vác ' + m.what + ': đi chậm, không chạy được. Mang tới điểm vàng. Bị bắt thì rơi tại chỗ.'];
      if (withBot) return ['', 'Vác từng ' + m.what + '. Bot cũng phụ khiêng.'];
      break;
    case 'support':
      if (G.coopMine() === m.key) return ['', 'Đừng buông cho tới khi đồng đội làm xong.'];
      if (G.coopOthers(m.key)) return ['good', 'Đồng đội đang giữ. Tới điểm vàng làm ngay!'];
      if (withBot) return ['', 'Bot sẽ giữ ở điểm xanh. Bạn làm ở điểm vàng.'];
      break;
    case 'together':
      if (G.coopOthers(m.key)) return ['good', 'Đồng đội đang giữ. Tới giữ E cùng!'];
      if (withBot) return ['', 'Bot sẽ giữ cùng bạn.'];
      break;
    case 'sync': {
      const held = m.spots(L()).map((p, k) => G.coopCount(m.key + k) > 0);
      if (held.some((h) => h)) return [held.every((h) => h) ? 'good' : '', held.every((h) => h) ? 'Đang chạy: ' + st.secs + '/' + m.secs + ' giây' : 'Còn thiếu người giữ điểm còn lại.'];
      if (withBot && held.length > 1) return ['', 'Bot sẽ giữ một điểm, bạn giữ điểm kia.'];
      break;
    }
    case 'window':
      if (d.b) return ['bad', 'Còn ' + st.left + ' giây! Đã vặn ' + st.count + '/3 van.'];
      return ['', withBot ? 'Bot chờ sẵn ở một van. Bạn vặn trước thì bot vặn theo. Đồng hồ 28 giây.' : 'Chia nhau đứng sẵn ở các van rồi mới vặn. Van đầu tiên bắt đầu đếm 28 giây.'];
    case 'escort': {
      const at = locAt(m, d);
      return members().some((x) => upAndAbout(x) && dist(x.pos, at) < 5) ? ['good', 'Đang dìu anh Lộc. Đi cạnh anh, trong vòng 5 m.'] : ['', 'Anh Lộc đứng chờ. Phải có người đi cạnh trong vòng 5 m.'];
    }
    case 'gather': return ['', 'Đủ cả đội, không ai bị trói, đứng trong vòng ' + Math.round(m.r) + ' m quanh điểm vàng.'];
    default:
  }
  if (m.lure && withBot) return ['', 'Bot sẽ gõ ống nước khi bạn nấp gần phòng trực. Tên trực đi rồi thì lấy chìa khóa.'];
  const note = m.note ? m.note(st, M.draw) : '';
  return note ? ['', note] : null;
}

// ================================ the map ================================
const STAGE = {
  own: true, land: true,
  get postName() { return M && ACT().postName ? ACT().postName : 'cột giữa sân'; },
  say: {
    get tied() { return ' bị bắt, đang bị trói ở ' + STAGE.postName + '! Tới cởi trói (giữ E)'; },
    lured: ' đang gõ ống nước dụ tên trực', street: '', back: '',
  },
  exitOpen: () => false,
  isOut: () => false,
  post: (pos) => ACT().post(L(), pos || P.pos),
  caught(src) {
    if (S.busy || S.ended || !S.stealthPhase || !M || M.pending) return;
    G.panel.close();
    ST.teamTie(src);
  },
  spawn: () => spotFor(NET.id),
  botSpawn: (i) => spotFor((bots()[i] || { id: NET.id }).id),
  penned,
  tick: landTick,
  banner,
  botStep: botsStep,
  apply: (k) => k === 'border' || k === 'twist',
  msg: {},
};
const MAP = {
  own: true, home: true, journey: total,
  warn: 'Map khó nhất: ' + total + ' nhiệm vụ, 7 chặng, thường mất 45–90 phút. Cân nhắc có đủ thời gian rồi hãy chọn.',
  badge: 'Khó nhất · 45–90 phút',
  name: 'Myanmar', sub: 'Khu Sương Đen · plot twist trên tàu ông Tư · ' + total + ' nhiệm vụ',
  rulesTitle: 'Myanmar · Khu Sương Đen · map khó nhất',
  rules: [
    ['Rất dài', total + ' nhiệm vụ trong 7 chặng, thường mất 45–90 phút và có thể lâu hơn. Chỉ nên chọn khi cả đội có đủ thời gian.'],
    ['Bến sông', 'chạy ra tàu ông Tư dưới mưa đá. Lên được tàu chưa chắc đã thoát.'],
    ['Khu Sương Đen', 'trốn khu giam, lấy hộ chiếu, tìm kẻ chỉ điểm, dựng điện, phát tin cầu cứu, cứu người, lấy bằng chứng.'],
    ['Rừng biên giới', 'bắc cầu, qua chốt gác, làm bè, cùng chèo qua sông Moei sang Thái Lan rồi bay về Việt Nam.'],
    ['Khó hơn', 'việc phải phối hợp, mã đổi mỗi ván, vác đồ thì đi chậm. Trả lời sai là báo động và mất 15 giây.'],
    ['Kiên trì', 'hết giờ hoặc cả đội bị trói thì làm lại chặng đó, không phải làm lại từ đầu. Mỗi chặng được lưu trên máy từng người.'],
  ],
  night: HOURS.night, guardN: 20, few: FEW[3], more: MORE[3],
  hints: {
    time: { easy: 'Mỗi nhiệm vụ thêm 50 % thời gian. Nên chọn cho lần đầu chơi map này.', normal: 'Thời gian đã sát. Map này vốn rất khó.', hard: 'Chỉ còn 75 % thời gian. Cho đội đã thuộc map.' },
    guards: { few: 'Bớt 7 lính và chó. Nên chọn cho lần đầu chơi map này.', normal: '20 lính và chó trong khu, 9 trong rừng.', many: '25 lính và chó trong khu, 12 trong rừng.' },
  },
  postName: 'cột', departKey: 'twist',
  get intro() {
    const n = M && S.teamMap === 'myanmar' ? M.s.act : 0;
    return n ? 'Chơi tiếp từ chặng ' + MAP.actName(n) + '. Cả đội vẫn đang kẹt ở Myanmar.' : 'Cả đội chạy ra bến, nơi tàu của ông Tư đang chờ. Đây là map khó nhất: nhiều nhiệm vụ, rất mất thời gian.';
  },
  goal: 'Cùng nhau về tới Việt Nam. Hết giờ hoặc cả đội bị hạ thì làm lại chặng đang chơi.',
  win: 'Bị chính người mình tin bán sang Myanmar, cả đội vẫn không bỏ ai lại: trốn khỏi Khu Sương Đen, đưa người bị thương và bằng chứng qua sông Moei, rồi về với gia đình. Ông Tư bị bắt nhờ cuốn sổ đó. Ngoài đời, đừng nhận đồ uống hay lời đón đưa của người lạ. Cần cứu giúp ở nước ngoài, gọi tổng đài Bảo hộ công dân +84 981 84 84 84.',
  say: {},
  saved,
  actName: (n) => (n + 1) + '. ' + ACTS[n].name,
  post: () => ({ x: P.pos.x, z: P.pos.z }),
  exitOpen: () => false, isOut: () => false,
  caught() { /* every leg has its own */ },
  spawn: (k) => (S.teamLeg === 1 ? KIT.river.spawn(k) : spotFor(NET.id)),
  botSpawn: (i) => (S.teamLeg === 1 ? KIT.river.botSpawn(i) : STAGE.botSpawn(i)),
  apply: (k) => k === 'border' || k === 'twist',
  msg: {},
  setup() {
    const o = S.teamOpts || {}, from = Math.max(0, Math.min(5, parseInt(o.from, 10) || 0));
    M = {
      seed: (S.teamSeed || 1) % 2147483647, pending: false, built: null, beat: 1.5, dirty: false, items: [], talk: [], talkT: 0, sent: new Map(), carried: new Map(), grace: new Map(), wasTd: new Map(),
      s: { e: 1, act: from, i: 0, d: {}, fails: 0, out: 0 },
      seen: { e: 1, act: from, i: 0, fails: 0, out: 0, b: 0, sec: 0, n: 0 },
    };
    blurAt = 0;
    redraw();
    if (from === 0) KIT.riverBuild();
    else buildLand();
  },
  afterSpawn() {
    if (M.s.act === 0) { KIT.riverWeather(false); actLabel(); S.phaseLabel = ''; KIT.riverIntro(); return; }
    weather(); actLabel(); placeAll();
    arrive(M.s.act === 1 ? 'next' : 'resume');
  },
  twist: twistScene,
  retry(why) {
    if (!live() || M.pending || !NET.isHost()) return;
    const s = M.s;
    if (s.act > 5 || s.out || S.f.twist) return;
    M.why = why;
    s.fails++; s.e++; s.i = 0; s.d = {};
    commit();
  },
  baseTick(dt) {
    if (!live()) return;
    if (S.f.twist) twistTick(dt);
    if (!NET.isHost()) return;
    M.beat -= dt;
    if (S.teamLeg !== 3 && S.teamLeg !== 4 && M.beat <= 0) send();
    // a host who took over after the scene had already ended here
    if (S.f.twistDone && M.s.act === 0) startAct(1);
    if (S.f.outDone && M.s.act === 5) startAct(6);
  },
  ledger: () => [['Số lần làm lại chặng', M ? M.s.fails : 0]],
  savedText: () => (M && M.s.act >= 1 && M.s.act <= 5 ? ' Đã lưu tới chặng ' + MAP.actName(M.s.act) + ': chủ phòng chọn “Chơi tiếp” trong phòng chờ.' : ''),
  onEnd(r) { if (r === 'win') save(null); },
  airport: {
    phase: 'Sân bay Bangkok · buổi sáng',
    intro: 'Sau khi lấy lời khai, cảnh sát Thái Lan và Đại sứ quán Việt Nam đưa cả đội ra sân bay ở Bangkok.',
    who: 'Thiếu tá Anan',
    bye: '(qua phiên dịch) Thượng lộ bình an. Ông Tư và những kẻ mua bán các bạn sẽ phải ra tòa.',
    flight: 'Hơn một giờ bay, máy bay giảm độ cao trên những cánh đồng lúa miền Nam.',
    dress() { G.airportDress('th'); },
  },
};
ST.TEAMMAPS.myanmar = MAP;

const stopBase = ST.teamSceneStop;
ST.teamSceneStop = function () {
  if (stopBase) stopBase();
  G.panel.close(); dropCans();
  document.body.classList.remove('field-talk');
  G.cam.drug = 0; blur(0);
  P.load = 0; P.climb = 0; S.actLabel = '';
  if (M) { hush(); M.pending = false; }
};
const hostBase = G.onBecomeHost;
G.onBecomeHost = function () {
  if (hostBase) hostBase();
  if (!live() || S.teamMap !== 'myanmar') return;
  for (const b of bots()) b.ai = {};
  send();
};
MAP.debug = () => M; // test hook: the state this browser holds
})(window.G);
