// team_escape.js — the escape for team mode: over the fence → "Bến sông" (chased, stones) → ông Tư's boat → the two
// countries' police → the flight → Tân Sơn Nhất and the families. Reached from the kiln's west fence (story2.js) or
// picked directly as the map "Bến sông". It runs on the engine of the solo chapter (G.esc in escape.js).
//
// A round has legs (S.teamLeg: 0 the map itself · 1 the river · 2 the airport); each player's state carries its leg
// (`e` in 'st'), so nobody counts a teammate who is still on the previous map.
//  · the host moves the men and the bots and sends snapshots ('esc') plus every stone thrown ('rock');
//  · each player judges the stones against itself (what you see is what hits you); the host judges them for bots;
//  · out of stamina or grabbed = down (S.tied): a teammate helps you up (hold E) or you get up alone after 10 s;
//    everybody down at once = the round is lost;
//  · the cutscenes are timelines on each player's own clock: no clicking (the team would drift apart), and they
//    stand still while the team pauses.
// The Myanmar map (myanmar.js) plays both legs too, with another end: its map object supplies `departKey`, `twist`
// (what happens on the boat instead) and `airport` (another airport's words); it uses the pieces in ST.kit.
(function (G) {
'use strict';
const T = G.T, V3 = T.Vector3;
const P = G.player, ui = G.ui, S = G.state, ST = G.story, NET = G.net, ESC = G.esc;
const L = () => G.LOC, npc = (k) => G.npcs[k];
const $ = (id) => document.getElementById(id);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const peers = () => [...NET.peers.values()];
const bots = () => peers().filter((p) => p.bot);
// the same order on every screen: everybody's id, sorted
const order = () => [NET.id].concat([...NET.peers.keys()]).sort((a, b) => a - b);
const slot = (id) => Math.max(0, order().indexOf(id)) % 6;
const DOWN_SECS = 10, UP_HP = 3, GRACE = 3, HIT_GAP = 1.5, WALK_SECS = 50;
const THUG_STATES = ['idle', 'chase', 'wind', 'recover'];
const PACK = { few: [3, 2, 1], normal: [6, 2, 2], many: [9, 2, 2] }; // gate · first stilt house · near the jetty
// seats in the boat's frame (x toward the bow): up to six players, then the four prisoners
const SEATS = [[2.6, 0.6], [2.6, -0.6], [1.3, 0.65], [1.3, -0.65], [3.7, 0.35], [3.7, -0.4]];
const V_SEATS = [[0, 0.65], [0, -0.65], [-1.1, -0.6], [4.7, 0]];
const seatOf = (id) => { const [lx, lz] = SEATS[slot(id)]; return { lx, lz, fx: -1, fz: lz * 0.3 }; };
const vSeat = (i) => ({ who: 'rv' + i, lx: V_SEATS[i][0], lz: V_SEATS[i][1], fx: -1, fz: 0 });

// ---------------- subtitles + timeline ----------------
function sub(who, text) {
  const el = $('subline');
  el.hidden = !text; if (!text) return;
  el.querySelector('b').textContent = who || ''; el.querySelector('b').hidden = !who;
  el.querySelector('p').textContent = text;
}
let TL = null, lastAt = 0;
// steps: [seconds, fn]: fn runs when the step begins
function play(steps, done) { TL = { steps, i: -1, left: 0, t: 0, done }; }
function runTimeline(dt) {
  if (!TL) return;
  TL.t += dt; TL.left -= dt;
  while (TL && TL.left <= 0) {
    const cur = TL; cur.i++;
    if (cur.i >= cur.steps.length) { TL = null; if (cur.done) cur.done(); return; }
    const [secs, fn] = cur.steps[cur.i];
    cur.left += secs; if (fn) fn();
  }
}
const line = (secs, who, text, fn) => [secs, () => { sub(who, text); if (fn) fn(); }];
const toBlack = (fn) => [1.05, () => { sub(); ui.black(true); if (fn) fn(); }];
// cutscene clock: real time, so a slow phone does not fall behind the others (the first frame after a pause counts 0.25 s at most)
function realDt() { const n = performance.now(), d = lastAt ? Math.min(0.25, (n - lastAt) / 1000) : 0.016; lastAt = n; return d; }
// a teammate placed by a cutscene: net.js leaves it alone while p.hold is set
function holdPeer(p, pose, hide) { p.hold = { pose: pose || 'stand', hide: !!hide, walk: 0 }; p.got = true; }
function poseHeld(dt) {
  const t = performance.now() / 1000;
  for (const p of peers()) {
    if (!p.hold) continue;
    p.h.group.visible = !p.hold.hide;
    if (p.hold.hide) continue;
    if (p.hold.walk) p.phase += p.hold.walk * dt * (G.gaitRate ? G.gaitRate(p.hold.walk, { h: p.h }) : 2.5);
    G.animHuman(p.h, { pose: p.hold.pose, speed: p.hold.walk, amt: p.hold.walk / 3.4, phase: p.phase, t });
    p.h.group.position.copy(p.pos); p.h.group.rotation.y = p.yaw;
  }
}
function enterLeg(stage, leg, phase) {
  S.teamStage = stage; S.teamLeg = leg; S.phase = phase;
  S.f = { frees: S.f.frees || 0 }; S.items = {};
  S.tied = false; S.out = false; S.busy = false; S.hold = null; S.stealthPhase = false; S.clockRun = false; G.stealth = false;
  P.chain = null; P.climb = 0; P.slowT = 0; P.walkAmt = 0; P.walkSpeed = 0; P.pose = null; P.frozen = true; P.speed = 0;
  G.OBJ = []; G.INTER = []; G.searchSus = 0; G.detBy = {};
  for (const p of peers()) {
    p.got = false; p.td = false; p.o = false; p.hl = ''; p.hold = null; p.grace = 0; p.grab = 0; p.wasTd = false; p.h.group.visible = false;
    if (p.bot) { p.ai = {}; p.s = 0; p.p = 'stand'; p.c = false; p.r = false; p.hp = ESC.HP_MAX; p.hitT = 0; p.upT = 0; p.e = leg; }
  }
}
const titled = (o) => { const f = o.t; if (typeof f === 'function') Object.defineProperty(o, 't', { get: f }); return o; };
const countText = () => ST.teamOut().join('/');

// ======================== leg 1: the river ========================
let cand = [], snapT = 0;
const river = ST.TEAMMAPS.river = {
  own: true, home: true, journey: 2,
  name: 'Bến sông', sub: 'Vượt rào, né đá, lên tàu, bay về Việt Nam',
  rules: [['Vượt rào', 'cả đội trèo rào lò gạch. Bọn tay chân tràn ra từ cổng và đuổi theo ném đá.'],
    ['Chạy ra bến', 'khoảng 200 m. Đổi hướng để né đá. Mỗi người có 6 điểm sức lực.'],
    ['Bị gục', 'đồng đội giữ E để đỡ dậy, hoặc tự gượng dậy sau 10 giây.'],
    ['Lên tàu', 'tàu của ông Tư chỉ rời bến khi đủ cả đội. Cảnh sát Việt Nam và Campuchia đón ở hạ lưu.'],
    ['Về nước', 'cả đội lên máy bay, hạ cánh Tân Sơn Nhất, gặp lại bố mẹ.'],
    ['Thua', 'khi hết giờ hoặc cả đội gục cùng lúc.']],
  night: 5.62, guardN: 10, few: ['A4', 'A5', 'A6', 'C2'], more: ['A7', 'A8', 'A9'], // (for the waiting room's head count: see PACK)
  hints: {
    tod: { day: 'Sáng rõ, thấy đá bay và thấy kẻ đuổi từ xa.', dusk: 'Trời chạng vạng, đá khó thấy hơn một chút.', night: 'Gần 6 giờ sáng, trời còn tối mờ: đá khó thấy nhất.' },
    wx: { dry: 'Bọn chúng ném chính xác nhất.', rain: 'Mưa làm chúng ném kém chính xác hơn.', storm: 'Mưa to, chúng ném trượt nhiều nhất.' },
    guards: { few: '6 kẻ đuổi. Hợp với người mới chơi.', normal: '10 kẻ đuổi như khi chơi một mình.', many: '13 kẻ đuổi.' },
  },
  postName: 'đường mòn', outWord: 'đã lên tàu', downWord: 'bị gục', freeWord: 'đỡ dậy', freeDone: 'đỡ', freeTail: ' dậy',
  say: { tied: ' bị gục! Tới đỡ dậy (giữ E)', street: ' đã nhảy lên tàu', back: '' },
  intro: 'Đèn lò gạch vừa tắt. Cả đội vượt rào phía tây, chạy ra bến sông. Bọn tay chân của đường dây đuổi theo ném đá.',
  goal: 'Tàu chỉ rời bến khi đủ người. Ai gục thì đồng đội đỡ dậy (giữ E). Cả đội gục cùng lúc là thua.',
  win: 'Cả đội vượt rào, đỡ nhau dậy dưới mưa đá, được cảnh sát hai nước đón trên sông và bay về với gia đình. Ngoài đời, đừng tự tìm đường trốn khi có thể gọi cho gia đình, công an hoặc Đại sứ quán.',
  caughtText: 'Cả đội gục trên đường mòn. Bọn tay chân lôi tất cả ngược về lò gạch, tàu của ông Tư phải rời bến.',
  timeText: 'Trời sáng hẳn mà cả đội chưa đủ người lên tàu. Ông Tư phải rời bến trước khi bị phát hiện.',
  spawn: () => ({ x: (slot(NET.id) - 2.5) * 1.15, z: -0.45, yaw: 0 }),
  botSpawn: (i) => { const b = bots()[i]; return { x: ((b ? slot(b.id) : i) - 2.5) * 1.15, z: -0.45, yaw: 0 }; },
  setup() { riverBuild(); },
  afterSpawn() { riverWeather(false); riverIntro(); },
  exitOpen: () => true,
  isOut: () => false, // (boarding sets S.out itself)
  post: () => ({ x: P.pos.x, z: P.pos.z }),
  caught() { if (canBeHurt()) knock('caught'); },
  tick: riverTick,
  banner: riverBanner,
  botStep: riverBots,
  apply(k) {
    if (k === 'depart' || k === 'twist') { if (!S.f.departed) depart(); }
    else if (k === 'takeoff') { airportBuild(); airport.apply(k); } // the host is a whole scene ahead of us
    else if (k !== 'river' && k !== 'border') return false;
    return true;
  },
  msg: {},
};
function riverBuild() {
  enterLeg(river, 1, 'ch4');
  G.loadLevel('river');
  S.chapter = 4; S.mood = 'horror';
  G.titleOrbit = { r: 80, h: 34, cx: -10, cz: 90 };
  const o = S.teamOpts || {};
  ESC.begin({
    team: true, pick, caught: grab, victims: stoneVictims, away: leaveBody,
    launched: (p, v) => NET.send({ t: 'rock', o: [p.x, p.y, p.z], v: [v.x, v.y, v.z] }),
    replica: () => NET.replica(),
    lead: () => cand.reduce((z, c) => Math.max(z, c.pos.z), 0),
    maxRocks: Math.min(6, 2 + Math.ceil((1 + NET.peers.size) / 2)),
  });
  ESC.riverCast(PACK[o.guards] || PACK.normal);
  Object.assign(S.f, { hp: ESC.HP_MAX, grace: 0, hitT: 0, down: false, scene: true });
  cand = []; snapT = 0; lastAt = 0; TL = null;
  G.input.crouch = false; G.input.run = false;
  G.OBJ = [titled({ t: () => 'Chạy ra bến, cả đội lên tàu của ông Tư (' + countText() + ')', at: () => L().dockEnd, done: () => !!S.f.departed, time: 150, lv: 3 })];
  G.INTER = [{ at: () => (ST.tiedNear() || P).pos, r: 1.9, when: () => !S.tied && !S.out && !!ST.tiedNear(), hold: 1.5, coop: 'up', run: () => { ST.freeMate(); S.f.grace = Math.max(S.f.grace || 0, 2); },
    label: () => 'Đỡ ' + (ST.tiedNear() || { name: 'đồng đội' }).name + ' dậy (giữ)' }];
}
// chained from the kiln it is dawn by the time they reach the river; picked directly it follows the room's option
function riverWeather(chained) {
  const o = S.teamOpts || {};
  const hour = o.tod === 'day' ? (chained ? 11 : 9.5) : o.tod === 'dusk' ? (chained ? 18.7 : 17.6) : chained ? 5.98 : river.night;
  const rain = { dry: 0, rain: 0.6, storm: 0.95 }[o.wx || 'rain'];
  G.overcast = { dry: 0.2, rain: 0.35, storm: 0.55 }[o.wx || 'rain']; // (darker than this and the stones cannot be seen) G.setRain(rain); G.lightningOn = o.wx === 'storm';
  S.clock = hour * 60; G.setTime(hour); S.phaseLabel = '';
  ESC.ch().err = 1 + 0.3 * rain;
}
function riverFromKiln() {
  riverBuild(); riverWeather(true);
  G.OBJ[0].time = Math.round(G.OBJ[0].time * ST.teamTimeK());
  const sp = river.spawn(); G.placePlayer(sp.x, sp.z, sp.yaw);
  if (NET.isHost()) bots().forEach((b, i) => { const s = river.botSpawn(i); b.tpos.set(s.x, 0, s.z); b.pos.copy(b.tpos); b.tyaw = b.yaw = 0; });
  riverIntro();
}
const _c = new V3();
function riverIntro() {
  S.f.scene = true; P.frozen = true; P.pose = 'climb';
  S.f.climbX = P.pos.x;
  ui.hud(false);
  G.cine([7, 2.8, 9.5], [0, 2, 0], true, 1);
  play([
    line(4.2, 'Người bị giam', 'Đạp lên vai nhau! Qua rào nhanh lên!', () => { ui.black(false); ui.hud(false); }),
    line(1.7, '', '', () => {
      const ch = ESC.ch();
      G.sfx('alert'); G.sfx('mob'); G.sfx('bark'); ch.alarm = true;
      if (NET.isHost()) ESC.activate('A');
      G.cine([20.5, 2.3, 6.5], [16.5, 1.1, -3], false, 4);
    }),
    line(2.6, 'Tay chân đường dây', 'Tụi nó trốn qua rào! Đuổi theo, đừng để đứa nào xuống được sông!', () => { ESC.ch().alarm = false; }),
  ], () => {
    sub();
    S.f.scene = false; G.cineOff(); G.placePlayer(S.f.climbX, 1.6, 0); P.frozen = false; P.pose = null;
    ui.hud(true); ESC.ch().on = true;
    G.input.crouch = false; G.input.run = true;
    ESC.victimsRun((n, i) => { if (S.teamLeg !== 1) return; ESC.placeRiders(L().boat, [vSeat(i)]); n.pose = 'floor'; });
    ui.toast('Chạy ra bến! Đổi hướng để né đá. Thấy đồng đội gục thì tới giữ E đỡ dậy.', 4000);
  });
}
// ---- who can be chased / hurt ----
const helping = () => G.coopMine() === 'up';
const canBeHurt = () => { const ch = ESC.ch(); return !!ch && ch.on && !ch.boat && !S.tied && !S.f.down && !S.out && !S.f.scene && !(S.f.grace > 0) && !helping(); };
function candidates() {
  cand = [];
  if (canBeHurt()) cand.push({ id: NET.id, me: true, pos: P.pos, vx: P.dir.x * P.speed, vz: P.dir.z * P.speed });
  for (const p of peers()) {
    if (!NET.fresh(p) || p.td || p.o || p.b || p.grace > 0 || p.grab > 0 || p.hl === 'up') continue; // ('up': busy helping someone to their feet)
    if (p.bot && ((p.ai && p.ai.rescue) || !ESC.ch().on)) continue; // a bot going back for someone is left alone
    cand.push({ id: p.id, p, bot: p.bot, pos: p.tpos, vx: Math.sin(p.tyaw) * p.s, vz: Math.cos(p.tyaw) * p.s });
  }
}
function pick(th) {
  let best = null, bd = 1e9;
  for (const c of cand) {
    const d = dist(th.pos, c.pos) * (c.bot ? 1.35 : 1) - (th.tg && th.tg.id === c.id ? 3 : 0); // people first, and no flip-flopping
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function grab(tg) {
  if (tg.me) { if (canBeHurt()) knock('caught'); }
  else if (tg.bot) botDown(tg.p);
  else if (!(tg.p.grab > 0)) { tg.p.grab = 1.5; NET.send({ t: 'caught', to: tg.id, src: 'guard' }); } // that player's own screen knocks it down
  cand = cand.filter((c) => c.id !== tg.id);
}
// nobody left for this man to chase: he steps away from whoever is lying there, so a teammate can get to them
function leaveBody(th) {
  let body = null, bd = 8;
  const see = (pos) => { const d = dist(th.pos, pos); if (d < bd) { bd = d; body = pos; } };
  if (S.tied) see(P.pos);
  for (const p of peers()) if (p.td && p.got) see(p.tpos);
  return body ? { x: body.x + ((ESC.thugs().indexOf(th) % 2) ? 1.5 : -1.5), z: Math.max(3, body.z - 9) } : null;
}
function stoneVictims() {
  const out = [];
  if (canBeHurt() && !(S.f.hitT > 0)) out.push({ me: true, pos: P.pos, hit: hitMe });
  if (NET.isHost()) for (const b of bots()) {
    if (!b.got || b.td || b.o || b.grace > 0 || b.hitT > 0 || (b.ai && b.ai.rescue)) continue;
    out.push({ pos: b.tpos, hit: () => { b.hitT = HIT_GAP; b.stagger = 0.5; b.hp = (b.hp === undefined ? ESC.HP_MAX : b.hp) - 1; if (b.hp <= 0) botDown(b); } });
  }
  return out;
}
function hitMe() {
  S.f.hp = Math.max(0, S.f.hp - 1); S.f.hitT = HIT_GAP;
  G.sfx('stoneHit'); G.shake(0.35); ui.flash('#8a0c0c', 0.42); P.slowT = 0.5;
  if (S.f.hp <= 0) knock('stones');
}
function knock(why) {
  S.tied = true; S.f.down = true; S.f.upT = DOWN_SECS; S.hold = null;
  P.frozen = true; P.pose = 'lie'; P.speed = 0; P.running = false; P.slowT = 0; P.pos.y = 0; G.input.run = false;
  S.caught++; S.stats.caughtTotal++;
  G.sfx('caught'); G.sfx('arrest'); ui.flash(); G.shake(0.3);
  NET.say('tied');
  ui.toast(why === 'caught' ? 'BỊ TÓM!' : 'BẠN GỤC XUỐNG!', 2000);
}
function backOnFeet() { // a teammate (onNetFree / a bot) or the 10 s count cleared S.tied
  S.tied = false; S.f.down = false; S.f.hp = UP_HP; S.f.grace = GRACE; S.f.hitT = 0;
  P.frozen = false; P.pose = null; G.input.crouch = false; G.input.run = true;
}
function botDown(b) {
  if (!b || b.td || b.o) return;
  b.td = true; b.upT = DOWN_SECS; b.s = 0; b.r = false; b.p = 'lie'; if (b.ai) b.ai.rescue = null;
  G.sfx('arrestFar');
  ui.toast(b.name + river.say.tied, 2400);
  NET.send({ t: 'say', k: 'tied', as: b.id });
}
// ---- every frame ----
function riverTick(dt) {
  const ch = ESC.ch(), rd = realDt(), host = NET.isHost();
  if (!ch) return;
  if (!$('card').hidden) return; // still reading the round's card
  runTimeline(rd);
  if (S.teamLeg !== 1) return;   // the timeline has moved on to the airport
  if (S.f.scene && !ch.on && !ch.boat && TL) { // climbing over, one after another
    const f = Math.min(1, Math.max(0, (TL.t - 0.4 - slot(NET.id) * 0.32) / 1.7));
    ESC.climbPos(f, S.f.climbX, P.pos); P.phase += dt * 8; P.pose = f < 1 ? 'climb' : 'kneel';
  }
  if (S.f.grace > 0) S.f.grace -= dt;
  if (S.f.hitT > 0) S.f.hitT -= dt;
  for (const p of peers()) {
    if (p.grace > 0) p.grace -= dt;
    if (p.grab > 0) p.grab -= dt;
    if (p.hitT > 0) p.hitT -= dt;
    if (p.wasTd && !p.td) p.grace = GRACE;
    p.wasTd = p.td;
  }
  if (!ch.boat && S.f.down) { // before anybody can grab again: up → grace
    S.f.upT -= dt;
    if (!S.tied) backOnFeet();
    else if (S.f.upT <= 0) { backOnFeet(); ui.toast('Bạn gượng dậy được. Chạy tiếp đi!', 2200); }
  }
  if (host && !ch.boat) candidates();
  ESC.step(dt);
  if (ch.boat) {
    poseHeld(dt);
    if (S.f.follow) { const b = L().boat.position; G.cine([b.x + 8.5, 3.6, b.z - 8.5], [b.x, 0.9, b.z + 2], false, 6); } // keep the boat in the shot
    return;
  }
  if (ch.on && !S.out && !S.tied && G.near(L().dockEnd, 2.4)) boardBoat();
  if (!host) return;
  if (ch.on && ST.allOut() && !S.f.departed) { ST.world(ST.teamBase().departKey || 'depart'); return; }
  S.f.allDownT = ST.allTied() ? (S.f.allDownT || 0) + dt : 0; // (a short wait: an "up" may still be on its way)
  if (S.f.allDownT > 0.7) { ST.teamEnd('caught'); return; }
  snapT -= dt;
  if (snapT <= 0) {
    snapT = 0.1;
    NET.send({ t: 'esc', th: ESC.thugs().map((th) => [Math.round(th.pos.x * 100) / 100, Math.round(th.pos.z * 100) / 100, Math.round(th.yaw * 100) / 100, Math.max(0, THUG_STATES.indexOf(th.state))]) });
  }
}
function riverBanner() {
  const ch = ESC.ch();
  if (!ch || S.f.scene || ch.boat) return null;
  if (S.tied) return ['bad', 'Bạn bị gục. Chờ đồng đội đỡ dậy, hoặc tự gượng dậy sau ' + Math.max(1, Math.ceil(S.f.upT || 0)) + ' giây.'];
  const down = peers().filter((p) => p.td).map((p) => p.name).join(', ');
  if (S.out) return ['good', 'Bạn đã lên tàu (' + countText() + '). ' + (down ? down + ' đang gục, sẽ tự dậy sau ít giây.' : 'Tàu chờ đủ cả đội.')];
  if (down) return ['bad', down + ' bị gục. Quay lại giữ E đỡ dậy (điểm đỏ).'];
  const hp = S.f.hp, how = P.running ? 'Zig-zag né đá' : G.input.touch ? 'Bật nút Chạy!' : 'Giữ Shift để chạy!';
  return [hp <= 2 ? 'bad' : '', 'Sức lực ' + '●'.repeat(hp) + '○'.repeat(ESC.HP_MAX - hp) + ' · ' + (ch.near < 99 ? 'cách ' + Math.round(ch.near) + ' m · ' : '') + how];
}
function boardBoat() {
  S.out = true; S.hold = null; P.frozen = true; P.pose = 'floor'; P.speed = 0; G.input.run = false;
  ESC.placeRiders(L().boat, [Object.assign({ who: 'P' }, seatOf(NET.id))]);
  G.cam.yaw = Math.atan2(-1, 0.6); // look back up the trail
  G.sfx('pickup'); NET.say('street');
}
// ---- the bots run the trail ----
function riverBots(list, dt) {
  const ch = ESC.ch(); if (!ch || S.teamLeg !== 1) return;
  if (ch.boat) { for (const b of list) { b.o = true; b.p = 'floor'; b.s = 0; b.last = performance.now(); } return; }
  const people = [];
  if (!S.tied && !S.out) people.push(P.pos);
  for (const p of peers()) if (!p.bot && p.got && !p.td && !p.o) people.push(p.tpos);
  const pace = people.length ? Math.min(...people.map((v) => v.z)) : 999;
  // who goes back for whom: the nearest free bot for each teammate who is down
  const downed = [];
  if (S.tied) downed.push({ id: NET.id, me: true, pos: P.pos });
  for (const p of peers()) if (p.td) downed.push({ id: p.id, p, pos: p.tpos });
  for (const b of list) { if (!b.ai) b.ai = {}; if (b.ai.rescue && (b.td || !downed.some((d) => d.id === b.ai.rescue))) { b.ai.rescue = null; b.ai.hold = 0; } }
  for (const d of downed) {
    if (d.id !== NET.id && d.p.bot && d.p.upT < 2) continue;
    if (list.some((b) => b.ai.rescue === d.id)) continue;
    let best = null, bd = 60;
    for (const b of list) { if (b.td || b.o || b.ai.rescue || b.id === d.id) continue; const q = dist(b.tpos, d.pos); if (q < bd) { bd = q; best = b; } }
    if (best) { best.ai.rescue = d.id; best.ai.hold = 0; }
  }
  list.forEach((b, i) => {
    const ai = b.ai, pos = b.tpos;
    if (b.hp === undefined) b.hp = ESC.HP_MAX;
    b.got = true; b.last = performance.now(); b.e = 1; b.hl = ''; b.c = false;
    if (b.o) { b.p = 'floor'; b.s = 0; b.r = false; return; }
    if (!ch.on) { // climbing over with everyone
      const f = TL ? Math.min(1, Math.max(0, (TL.t - 0.4 - slot(b.id) * 0.32) / 1.7)) : 0;
      ESC.climbPos(f, (slot(b.id) - 2.5) * 1.15, _c); pos.copy(_c); b.tyaw = 0; b.s = 0; b.r = false; b.p = f < 1 ? 'climb' : 'stand';
      return;
    }
    if (b.td) {
      b.upT = (b.upT === undefined ? DOWN_SECS : b.upT) - dt; b.p = 'lie'; b.s = 0; b.r = false;
      if (b.upT <= 0) { b.td = false; }
      else return;
    }
    if (b.hp <= 0) b.hp = UP_HP;
    b.p = 'stand'; pos.y = 0;
    let goal, speed;
    const d = ai.rescue ? downed.find((x) => x.id === ai.rescue) : null;
    if (d) {
      if (dist(pos, d.pos) < 1.5) {
        b.s = 0; b.r = false; b.p = 'kneel'; b.tyaw = Math.atan2(d.pos.x - pos.x, d.pos.z - pos.z);
        ai.hold = (ai.hold || 0) + dt;
        if (ai.hold >= 1.5) {
          ai.rescue = null; ai.hold = 0;
          if (d.me) S.tied = false; else d.p.td = false;
          NET.send({ t: 'free', id: d.id, as: b.id });
          S.f.frees = (S.f.frees || 0) + 1; G.missionTimerAdd(15);
          ui.toast(b.name + (d.me ? ' đã đỡ bạn dậy! Chạy đi!' : ' đã đỡ ' + d.p.name + ' dậy'), 2400);
        }
        return;
      }
      goal = d.pos; speed = 6.1;
    } else {
      const pa = L().path, k = ESC.nextIdx(pos), lane = k >= pa.length - 2 ? 0 : ((i % 3) - 1) * 0.8;
      goal = pos.z > 191 || k >= pa.length - 1 ? L().dockEnd : { x: pa[k][0] + lane, z: pa[k][1] };
      speed = pos.z < pace ? 6.3 : pos.z > pace + 10 ? 5.5 : 5.9; // keeps the people company
    }
    if (b.stagger > 0) { b.stagger -= dt; speed *= 0.5; }
    const dx = goal.x - pos.x, dz = goal.z - pos.z, dd = Math.hypot(dx, dz) || 1, st = Math.min(dd, speed * dt);
    pos.x += dx / dd * st; pos.z += dz / dd * st; G.collide(pos, 0.3, 0);
    b.tyaw = Math.atan2(dx, dz); b.s = speed; b.r = true;
    if (dist(pos, L().dockEnd) < 2.2 && !ai.rescue) {
      b.o = true; b.s = 0; b.r = false; b.p = 'floor';
      ESC.placeRiders(L().boat, [Object.assign({ peer: b }, seatOf(b.id))]);
      NET.send({ t: 'say', k: 'street', as: b.id }); ui.toast(b.name + river.say.street, 2000);
    }
  });
}
// ---- everybody is aboard ----
function depart() {
  const ch = ESC.ch(), boat = L().boat;
  S.teamDone = (S.teamDone || 0) + 1;
  S.f.departed = true; S.f.scene = true; S.f.down = false; S.tied = false; S.out = true; S.hold = null;
  P.frozen = true; P.pose = 'floor'; G.input.run = false;
  G.OBJ = []; G.INTER = [];
  ch.on = true; ch.boat = true; ch.alarm = false;
  for (const th of ESC.thugs()) { th.spot = null; th.timer = 0; if (th.state === 'idle') th.state = 'chase'; }
  const riders = [Object.assign({ who: 'P' }, seatOf(NET.id)), { who: 'tu', lx: -1.6, lz: 0.4, fx: 1, fz: 0 }];
  for (const p of peers()) { holdPeer(p, 'floor'); p.o = true; riders.push(Object.assign({ peer: p }, seatOf(p.id))); }
  for (let i = 0; i < 4; i++) { const v = npc('rv' + i); if (!v) continue; v.run = null; v.pose = 'floor'; v.h.group.visible = true; riders.push(vSeat(i)); }
  ch.ride = { s: 0, v: 0, vt: 0, wake: true, riders };
  ESC.placeRiders(boat, riders);
  ui.hud(false); G.engineSound(true);
  G.cine([-46, 2.2, 182], [-57, 0.8, 191], false, 1.6);
  if (ST.teamBase().twist) { ST.teamBase().twist(); return; }
  play([
    line(3, 'Ông Tư', 'Đủ người rồi! Ngồi thấp xuống, bám chắc vào mạn tàu!'),
    line(2.8, '', '', () => { ch.ride.vt = 6.5; npc('tu').pose = 'stand'; G.cine([-42.2, 2.9, 187.2], [-58, 1, 197], false, 3); }),
    line(3.6, 'Ông Tư', 'Tụi nó ném đá theo kìa! Cúi đầu xuống, đừng ngóc lên!'),
    line(5.4, 'Ông Tư', 'Chú tên Tư, người Việt, sống trên khúc sông này ba mươi năm rồi. Công an bên mình nhờ chú ra đón các cháu.', () => { S.f.follow = true; }),
    line(2.6, 'Cả đội', 'Cảm ơn chú... cảm ơn chú nhiều lắm!'),
    toBlack(),
    line(5.6, '', 'Mười lăm phút sau, ở hạ lưu', () => { S.f.follow = false; ESC.policeScene(); G.setRain(0); G.lightningOn = false; G.overcast = 0.25; G.setTime(6.3); ui.black(false); }),
    line(3.6, 'Trung tá Sokha', '(qua phiên dịch) Cảnh sát Campuchia đây. Mọi người an toàn rồi.'),
    line(4.4, 'Đại úy Minh', 'Anh là Minh, lực lượng đặc nhiệm Việt Nam. Các em làm tốt lắm, không bỏ ai lại.'),
    line(4.4, 'Đại úy Minh', 'Hai bên đã ập vào lò gạch. Đám đuổi theo các em trên bờ cũng đang bị truy bắt.'),
    line(3.4, 'Đại úy Minh', 'Làm xong giấy tờ, cả đội cùng bay về nước.'),
    line(2.2, 'Cả đội', 'Về nhà... được về nhà rồi...'),
    toBlack(() => G.engineSound(false)),
    [0.2, () => airportBuild()],
  ]);
}

// ======================== leg 2: the airport, the flight, the families ========================
const airport = {
  own: true,
  postName: 'sân bay', outWord: 'đã lên máy bay', downWord: '', say: { street: ' đã lên máy bay' },
  exitOpen: () => true, isOut: () => false, caught() { /* nobody hunts them here */ },
  tick: airportTick,
  banner() {
    if (S.f.flying || S.f.scene) return null;
    const left = Math.max(0, Math.ceil(WALK_SECS - (S.f.walkT || 0)));
    return [S.out ? 'good' : '', (S.out ? 'Bạn đã lên máy bay (' + countText() + '). ' : 'Đi tới cầu thang, bấm ' + (G.input.touch ? 'nút Dùng' : 'E') + ' để lên máy bay. ') + 'Cất cánh khi đủ người, chậm nhất sau ' + left + ' giây.'];
  },
  botStep: airportBots,
  apply(k) {
    if (k === 'takeoff') { if (!S.f.flying) takeoff(); }
    else if (k !== 'river' && k !== 'depart' && k !== 'twist' && k !== 'border') return false;
    return true;
  },
  msg: {},
};
function airportBuild() {
  enterLeg(airport, 2, 'airport');
  TL = null; sub(); G.engineSound(false);
  G.loadLevel('airport');
  G.overcast = 0.15; G.setRain(0); G.lightningOn = false; G.setTime(8.2);
  S.clock = 8.2 * 60; S.chapter = 5; S.mood = 'hope'; S.phaseLabel = 'Sân bay · buổi sáng';
  G.titleOrbit = { r: 120, h: 40, cx: 10, cz: -110 };
  ESC.airportCast();
  const W = ST.teamBase().airport || {};
  if (W.phase) S.phaseLabel = W.phase;
  if (W.dress) W.dress();
  const st = L().start, at = (id) => { const k = slot(id); return { x: st.x - (k % 3) * 1.25, z: st.z + 1.4 - Math.floor(k / 3) * 1.5 }; };
  const me = at(NET.id); G.placePlayer(me.x, me.z, Math.PI / 2); P.frozen = true;
  if (NET.isHost()) for (const b of bots()) { const a = at(b.id); b.tpos.set(a.x, 0, a.z); b.pos.copy(b.tpos); b.tyaw = b.yaw = Math.PI / 2; }
  G.input.run = false; G.input.crouch = false;
  S.f.walkT = 0; S.f.scene = true;
  G.OBJ = [titled({ t: () => 'Cả đội lên máy bay về Việt Nam (' + countText() + ')', at: () => L().stairsBottom, done: () => !!S.f.flying, lv: 1 })];
  G.INTER = [{ at: () => L().stairsBottom, r: 2.4, when: () => !S.out && !S.f.boardT && !S.f.scene, label: 'Lên máy bay', run: boardPlane }];
  ui.hud(false);
  G.cine([st.x + 8, 2.8, st.z - 7], [st.x + 1, 1.4, st.z + 0.5], true, 1);
  play([
    line(3.2, '', W.intro || 'Sáng hôm sau, hai lực lượng cảnh sát đưa cả đội ra tận chân máy bay.', () => ui.black(false)),
    line(2.8, 'Đại úy Minh', 'Đi thôi các em. Gia đình đang chờ ở Tân Sơn Nhất.', () => ESC.airportWalk(1.85)),
  ], () => {
    sub(); S.f.scene = false; G.cineOff(); P.frozen = false; P.pose = null; ui.hud(true);
    ui.toast('Đi tới cầu thang máy bay (điểm vàng), rồi bấm ' + (G.input.touch ? 'nút Dùng.' : 'E.'), 3400);
  });
}
function boardPlane() {
  const d = L().door;
  S.f.boardT = 0.0001; S.hold = null; G.input.run = false;
  P.frozen = true; P.pose = null; P.walkAmt = 0.45; P.walkSpeed = 1.4; P.speed = 1.4;
  G.cine([d.x - 9, 3.5, d.z - 9], [d.x, 2, d.z - 2], false, 1.4);
}
function climbStairs(pos, f) {
  const sr = L().stairsRun, z = sr.z0 - 0.4 + (sr.z1 + 0.5 - sr.z0) * f;
  pos.set(L().door.x, G.clamp((z - sr.z0) / (sr.z1 - sr.z0), 0, 1) * sr.y1, z);
}
function airportTick(dt) {
  const rd = realDt();
  runTimeline(rd);
  poseHeld(dt);
  if (S.f.reunion) reunionTick(dt);
  if (S.f.waitEnd > 0) { S.f.waitEnd -= rd; if (S.f.waitEnd <= 0) ST.teamEnd('win', true); } // the host's "end" never came
  if (S.f.flying) return;
  if (S.f.boardT && !S.out) {
    S.f.boardT += dt; const f = Math.min(1, S.f.boardT / 2.8);
    climbStairs(P.pos, f); P.yaw = 0; P.phase += dt * 4;
    if (f >= 1) { S.out = true; P.pos.y = -40; P.walkAmt = 0; P.walkSpeed = 0; P.speed = 0; NET.say('street'); G.sfx('pickup'); }
  }
  if (S.f.scene) return;
  S.f.walkT += rd;
  if (NET.isHost() && (ST.allOut() || S.f.walkT >= WALK_SECS)) ST.world('takeoff');
}
function airportBots(list, dt) {
  if (S.teamLeg !== 2) return;
  const sb = L().stairsBottom;
  list.forEach((b, i) => {
    b.got = true; b.last = performance.now(); b.e = 2; b.td = false; b.hl = ''; b.c = false; b.r = false; b.p = 'stand';
    if (!b.ai) b.ai = {};
    if (b.o || S.f.flying || S.f.scene) { b.s = 0; return; }
    const ai = b.ai, pos = b.tpos;
    if (ai.board !== undefined) {
      ai.board += dt; const f = Math.max(0, Math.min(1, ai.board / 2.8));
      climbStairs(pos, f); b.tyaw = 0; b.s = 1.4;
      if (f >= 1) { b.o = true; b.s = 0; pos.y = -40; NET.send({ t: 'say', k: 'street', as: b.id }); }
      return;
    }
    const goal = pos.x < sb.x - 3.4 ? { x: sb.x - 3, z: sb.z - 0.5 - (i % 2) * 0.7 } : sb; // round the engine, then the stairs
    const dx = goal.x - pos.x, dz = goal.z - pos.z, dd = Math.hypot(dx, dz);
    if (goal === sb && dd < 0.7) { ai.board = i * -0.9; return; }
    const st = Math.min(dd, 2.8 * dt);
    if (dd > 0.01) { pos.x += dx / dd * st; pos.z += dz / dd * st; b.tyaw = Math.atan2(dx, dz); }
    b.s = 2.8;
  });
}
function takeoff() {
  S.teamDone = (S.teamDone || 0) + 1;
  S.f.flying = true; S.f.scene = true; S.out = true; S.hold = null;
  P.frozen = true; P.walkAmt = 0; P.walkSpeed = 0; P.speed = 0; P.pos.y = -40;
  for (const p of peers()) { holdPeer(p, 'stand', true); p.o = true; }
  G.OBJ = []; G.INTER = []; ui.hud(false); ui.black(false);
  const d = L().door, W = ST.teamBase().airport || {};
  for (const k of ['kh0', 'kh1', 'vn0', 'vn1']) { const n = npc(k); if (n) { n.pose = 'raise'; n.yaw = Math.atan2(d.x - n.pos.x, d.z - n.pos.z); } }
  G.cine([d.x - 9, 3.5, d.z - 9], [d.x, 2, d.z - 2], false, 1.2);
  play([
    line(4.2, W.who || 'Trung tá Sokha', W.bye || '(qua phiên dịch) Thượng lộ bình an. Những kẻ đã lừa các bạn sẽ phải ra tòa.'),
    line(2.2, 'Cả đội', 'Cảm ơn các anh. Cảm ơn rất nhiều.'),
    line(6, '', '', () => { ESC.planeLeave(); for (const k of ['minh', 'crew']) if (npc(k)) npc(k).h.group.visible = false; }),
    toBlack(),
    [14.5, () => { ESC.planeRoll(); ui.black(false); }],
    toBlack(() => G.jetSound(0.2)),
    line(3.4, 'Chuyến bay hồi hương', W.flight || 'Một giờ sau, máy bay giảm độ cao trên những cánh đồng lúa miền Nam.', () => { G.jetSound(0); ESC.PL.cam = null; }),
    [7.9, () => { sub(); ESC.planeApproach(); S.phaseLabel = 'Tân Sơn Nhất · chiều'; ui.black(false); }],
    line(4.4, '', 'Bánh xe chạm đường băng Tân Sơn Nhất. Trong khoang có người vỗ tay, có người bật khóc.'),
    line(3.6, 'Cả đội', 'Về rồi. Về thật rồi.'),
    toBlack(() => G.jetSound(0)),
    line(3.4, 'Tân Sơn Nhất', 'Bố mẹ từng người đã đứng chờ dưới chân cầu thang.', reunion),
    line(3.2, 'Mẹ', 'Con ơi... con của mẹ...', () => { S.f.hug = true; }),
    line(4.4, 'Bố', 'Về là được rồi. Nợ nần gì thì cả nhà cùng tính. Không ai bắt con phải đi đâu xa nữa.', () => {
      const R = S.f.reunion; G.cine([R.cx - R.w - 2.4, 1.9, -134.2], [R.cx, 1.15, -131.2], false, 1.1);
    }),
    line(3.4, 'Cả đội', 'Con xin lỗi bố mẹ. Con về rồi.'),
  ], () => {
    sub();
    if (NET.isHost()) ST.teamEnd('win');
    else S.f.waitEnd = 10;
  });
}
const FOLKS = [[0x7a5a8a, 0x5a6a5a], [0x8a5a5a, 0x4a5a7a], [0x4a7a72, 0x7a6a52], [0x9a7a4a, 0x55555f], [0x6a6a9a, 0x6a5a4a], [0xa06a80, 0x4f6a5a]];
function reunion() {
  const pl = L().plane, stairs = L().stairs;
  Object.assign(ESC.PL, { mode: 'park', v: 0, alt: 0, pitch: 0, cam: null });
  pl.position.set(L().planeHome.x, 0, L().planeHome.z); pl.rotation.set(0, 0, 0); pl.userData.gear.visible = true;
  stairs.visible = true; stairs.position.z = L().door.z - 0.3;
  G.setTime(16.6);
  for (const k in G.npcs) G.npcs[k].h.group.visible = false;
  const ids = order(), n = ids.length, gap = 2.3, cx = 2, who = [];
  ids.forEach((id, i) => {
    const x = cx + (i - (n - 1) / 2) * gap, [a, b] = FOLKS[i % FOLKS.length];
    const mom = G.addNpc('tmom' + i, { shirt: a, pants: 0x3a3438, skin: 0xc49a76, hair: 0x2a2420, longHair: true, longSleeve: true }, { x, z: -131.85, yaw: 0, pose: 'talk' });
    G.addNpc('tdad' + i, { shirt: b, pants: 0x2a2a2a, skin: 0xb08560, hair: 0x6a6a68 }, { x: x + 0.72, z: -132.05, yaw: -0.3, pose: 'stand' });
    const p = id === NET.id ? null : NET.peers.get(id);
    if (id !== NET.id && !p) return;
    if (p) { holdPeer(p, 'stand'); p.pos.set(x, 0, -127.6); p.tpos.copy(p.pos); p.yaw = p.tyaw = Math.PI; }
    else { P.pos.set(x, 0, -127.6); P.yaw = Math.PI; P.pose = null; }
    who.push({ p, mom, z: -127.6 });
  });
  const w = (n - 1) * gap / 2;
  S.f.reunion = { cx, w, who };
  G.cine([cx + w + 3.6, 2.5, -135.6], [cx, 1.1, -130], true, 1);
  ui.black(false);
}
function reunionTick(dt) {
  for (const r of S.f.reunion.who) {
    const moving = r.z > -131.2;
    if (moving) r.z = Math.max(-131.2, r.z - 1.3 * dt);
    const pose = !moving && S.f.hug ? 'hug' : 'stand';
    if (pose === 'hug') r.mom.pose = 'hug';
    if (r.p) {
      if (!r.p.hold) continue;
      r.p.pos.z = r.z; r.p.tpos.z = r.z; r.p.hold.pose = pose; r.p.hold.walk = moving ? 1.3 : 0;
    } else {
      P.pos.y = 0; P.pos.z = r.z; P.yaw = Math.PI; P.pose = pose; P.walkAmt = moving ? 0.4 : 0; P.walkSpeed = moving ? 1.3 : 0;
      if (moving) P.phase += dt * 4;
    }
  }
}

// ======================== what the rest of the game calls ========================
// the kiln's fence → here (world event 'river', from the host)
ST.teamToRiver = function () {
  if (S.f.going) return;
  S.f.going = true; S.teamDone = (S.teamDone || 0) + G.OBJ.filter((o) => !o.opt).length;
  P.frozen = true; S.hold = null; lastAt = 0;
  play([toBlack(), [0.2, riverFromKiln]]);
};
ST.teamSceneTick = () => { if (TL) runTimeline(realDt()); };
ST.teamSceneStop = function () {
  TL = null; lastAt = 0; sub();
  P.walkAmt = 0; P.walkSpeed = 0;
  G.engineSound(false); G.jetSound(0);
  if (ESC.PL) ESC.PL.cam = null;
};
// the pieces another map can build on (myanmar.js)
ST.kit = {
  play, line, toBlack, sub, slot, holdPeer, poseHeld, enterLeg,
  tick: () => runTimeline(realDt()),
  river, riverBuild, riverWeather, riverIntro, airportBuild,
};
const caughtBase = G.onCaught;
G.onCaught = function (src) {
  const st = S.teamPlay ? ST.teamMap() : null;
  if (st && st.own) { if (!S.ended) st.caught(src); return; }
  caughtBase(src);
};
G.onNetEsc = function (th) {
  if (!S.teamPlay || S.teamLeg !== 1 || NET.isHost()) return;
  const men = ESC.thugs();
  th.forEach((a, i) => { if (men[i] && Array.isArray(a)) men[i].net = { x: a[0], z: a[1], yaw: a[2], st: THUG_STATES[a[3]] || 'idle' }; });
};
G.onNetRock = function (o, v) {
  const ch = ESC.ch();
  if (!S.teamPlay || S.teamLeg !== 1 || NET.isHost() || !ch || ch.boat || S.ended) return;
  ESC.addRock(new V3(o[0], o[1], o[2]), new V3(v[0], v[1], v[2]));
};
const hostBase = G.onBecomeHost;
G.onBecomeHost = function () {
  if (hostBase) hostBase();
  if (!S.teamPlay || S.teamLeg !== 1) return;
  const ch = ESC.ch(); if (!ch) return;
  for (const th of ESC.thugs()) { th.tg = null; th.timer = 0; if (th.state !== 'idle') { th.state = 'chase'; th.delay = 0; ch.groups[th.group] = true; } }
  for (const b of bots()) if (b.td) b.upT = DOWN_SECS / 2; // adopted mid-run
};
})(window.G);
