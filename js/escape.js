// escape.js — Chapter 4 "Bến sông": over the kiln's west fence and along the river trail to a jetty, chased by the
// ring's men throwing stones; the boat of ông Tư (a Vietnamese fisherman on the river); the Vietnamese and
// Cambodian police boats. Then the flight home: boarding at the airport in Cambodia, take-off, landing at
// Tân Sơn Nhất, and the family (the epilogue in story2.js).
// The team version (team_escape.js) runs on the same engine (G.esc, at the bottom): it supplies who can be chased and
// hit (CH.pick, CH.victims, CH.caught) and on guests the men only follow the host's snapshots (CH.replica).
(function (G) {
'use strict';
const T = G.T, V3 = T.Vector3;
const P = G.player, ui = G.ui, S = G.state, ST = G.story;
const L = () => G.LOC, npc = (k) => G.npcs[k];
const { run, wait, card, fx } = ST;
// dialogue inside a cutscene: closing a dialog frees the player (game.js closeDlg), so put the cutscene's hold back
const sayHold = (lines) => (n) => { const pose = P.pose; ui.say(lines, () => { P.frozen = true; P.pose = pose; S.busy = true; n(); }); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const HP_MAX = 6, GRAV = 16, HIT_GAP = 1500; // ms after a hit in which no other stone counts (a stagger must not chain into a knock-out)
const VICTIMS = [
  { shirt: 0x6a5a4a, pants: 0x2a2a2a, skin: 0xc79a74, bruises: true },
  { shirt: 0x8a6a6a, pants: 0x2a2a2a, skin: 0xd6a985, longHair: true, bruises: true },
  { shirt: 0x4a5a6a, pants: 0x2a2a2a, skin: 0xb5835e, bruises: true },
  { shirt: 0x5a6a4a, pants: 0x2a2a2a, skin: 0xa8754f, longHair: true, bruises: true },
];
// the ring's men: no uniform, tank tops and shorts, a cap or two
const THUG_LOOKS = [
  { shirt: 0x2a2a2a, pants: 0x3a3a30, skin: 0xa8754f, sleeveless: true, cap: 0x7a1a1a },
  { shirt: 0x5a3a2a, pants: 0x1c1c1c, skin: 0x9a6a48, shorts: true, bald: true },
  { shirt: 0x3a4a5a, pants: 0x2a2a24, skin: 0xb07a58, tattoo: true, sleeveless: true },
  { shirt: 0x6a2a2a, pants: 0x1a1a1a, skin: 0xa8754f, cap: 0x1a1a1a },
  { shirt: 0x2a3a2a, pants: 0x3a3428, skin: 0x9a6a48, shorts: true },
  { shirt: 0x4a4038, pants: 0x1c1c20, skin: 0xb88760, longSleeve: true, cap: 0x2a3a5a },
  { shirt: 0x1c1c1c, pants: 0x2e2a24, skin: 0xa07050, sleeveless: true, bald: true, tattoo: true },
  { shirt: 0x5a5a3a, pants: 0x222222, skin: 0xb5835e, shorts: true, cap: 0x5a4a2a },
  { shirt: 0x3a2a3a, pants: 0x2a2a2a, skin: 0x9a6a48 },
  { shirt: 0x2a2a3a, pants: 0x3a3a30, skin: 0xa8754f, sleeveless: true },
];
let thugs = [], rocks = [], splashes = [], CH = null;
// solo: the only one to chase
const ME = { me: true, pos: P.pos, get vx() { return P.dir.x * P.speed; }, get vz() { return P.dir.z * P.speed; } };
const rockGeo = new T.DodecahedronGeometry(0.13, 0), rockMat = G.std({ color: G.C(0xd2c8b6), emissive: G.C(0x3a332a), roughness: 1 }); // big and pale enough to see coming
const ringGeo = new T.RingGeometry(0.18, 0.3, 20), ringMat = new T.MeshBasicMaterial({ color: 0x8a9a9c, transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide });

// ===================== the chase =====================
function makeThug(look, x, z, group, delay) {
  const h = G.Humanoid(Object.assign({}, look));
  const th = { h, pos: new V3(x, 0, z), yaw: Math.PI, speed: 0, phase: Math.random() * 6, state: 'idle', group, delay: delay || 0, cd: 1.2 + Math.random() * 2.2, timer: 0,
    off: (Math.random() - 0.5) * 3.2, spd: group === 'A' ? 5.1 : 4.6, stuck: 0, side: 0, sideDir: 1, spot: null };
  h.group.position.copy(th.pos); thugs.push(th); return th;
}
const activate = (g) => { if (CH.groups[g]) return; CH.groups[g] = true; for (const th of thugs) if (th.group === g) th.state = 'chase'; if (g !== 'A') G.sfx('mob'); };
function nextIdx(p) { const pa = L().path; let i = 0; while (i < pa.length - 1 && pa[i][1] < p.z + 2) i++; return i; }
function thugTarget(th, to) {
  if (th.pos.z < 0.8 && to.z > 0.5) { // still inside the fence: out through the gate first (x 14..20)
    const gx = L().gate.x;
    return Math.abs(th.pos.x - gx) < 2.2 ? { x: gx + th.off * 0.5, z: 3 } : { x: gx, z: -1.2 };
  }
  if (dist(th.pos, to) < 13 && !G.losBlocked(th.pos.x, th.pos.z, to.x, to.z)) return to;
  const i = nextIdx(th.pos); if (i > nextIdx(to)) return to;
  const w = L().path[i]; return { x: w[0] + th.off, z: w[1] };
}
function moveThug(th, tgt, spd, dt) {
  const dx = tgt.x - th.pos.x, dz = tgt.z - th.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { th.speed = 0; return; }
  let k = 1; for (const z of G.slowZones) if (G.inRect(th.pos.x, th.pos.z, z)) k = Math.min(k, z.k);
  let ax = dx / d, az = dz / d;
  if (th.side > 0) { th.side -= dt; ax = ax * 0.3 - az * th.sideDir; az = az * 0.3 + (dx / d) * th.sideDir; const n = Math.hypot(ax, az) || 1; ax /= n; az /= n; }
  const step = Math.min(d, spd * k * dt), ox = th.pos.x, oz = th.pos.z;
  th.pos.x += ax * step; th.pos.z += az * step; G.collide(th.pos, 0.32, 0);
  const moved = Math.hypot(th.pos.x - ox, th.pos.z - oz);
  th.stuck = moved < step * 0.3 ? th.stuck + dt : 0;
  if (th.stuck > 0.6) { th.stuck = 0; th.side = 0.8; th.sideDir = Math.random() < 0.5 ? -1 : 1; }
  th.yaw += G.angDiff(th.yaw, Math.atan2(ax, az)) * Math.min(1, dt * 10);
  th.speed = moved / Math.max(dt, 1e-3);
}
const face = (th, p) => { th.yaw += G.angDiff(th.yaw, Math.atan2(p.x - th.pos.x, p.z - th.pos.z)) * 0.3; };
const handPos = (th) => new V3(th.pos.x + Math.cos(th.yaw) * 0.25, 1.95, th.pos.z - Math.sin(th.yaw) * 0.25);
function addRock(o, v, boat) {
  const m = new T.Mesh(rockGeo, rockMat); m.position.copy(o); m.castShadow = true; G.add(m);
  rocks.push({ m, v: new V3(v.x, v.y, v.z), life: 4, live: true, whoosh: false, boat: !!boat });
  if (dist(o, G.camera.position) < 60) G.sfx('throw');
}
function launch(o, tgt, boat) {
  const dx = tgt.x - o.x, dz = tgt.z - o.z, tf = G.clamp(Math.hypot(dx, dz) / 15, 0.45, 1.4);
  const v = new V3(dx / tf, ((tgt.y || 1.1) - o.y) / tf + 0.5 * GRAV * tf, dz / tf);
  addRock(o, v, boat);
  if (CH.launched && !boat) CH.launched(o, v); // team: the host tells the others about every stone
}
function throwAt(th, tg) { // aimed where a runner who keeps straight will be, so changing direction is what dodges
  const o = handPos(th), vx = tg.vx, vz = tg.vz;
  let x = tg.pos.x, z = tg.pos.z;
  for (let i = 0; i < 4; i++) { const tf = G.clamp(Math.hypot(x - o.x, z - o.z) / 15, 0.45, 1.4); x = tg.pos.x + vx * tf; z = tg.pos.z + vz * tf; } // flight time ↔ landing point
  const e = (1.0 + dist(o, tg.pos) * 0.07) * (CH.err || 1), a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * e;
  launch(o, { x: x + Math.cos(a) * r, y: 1.1, z: z + Math.sin(a) * r });
}
const liveRocks = () => rocks.filter((r) => r.live).length;
function hitPlayer() {
  S.f.hp = Math.max(0, S.f.hp - 1); S.f.hits = (S.f.hits || 0) + 1;
  G.sfx('stoneHit'); G.shake(0.35); ui.flash('#8a0c0c', 0.42); P.slowT = 0.5;
  if (S.f.hp === 2) ui.toast('Nam choáng váng. Trúng thêm vài viên nữa là gục!', 2600);
  if (S.f.hp <= 0) chaseFail('down');
}
function chaseFail(kind) {
  if (CH.over) return; CH.over = true;
  S.busy = true; P.frozen = true; P.pose = 'lie'; G.input.run = false; G.sfx('caught'); G.sfx('arrest'); ui.flash(); G.shake(0.35);
  ui.toast(kind === 'down' ? 'NAM GỤC XUỐNG!' : 'BỊ TÓM!', 2000);
  const ch = CH; setTimeout(() => { if (S.phase === 'ch4' && CH === ch) ST.failScreen('chase'); }, 2100); // (not on a fresh retry)
}
function splashAt(x, z, loud, dust) { // a ring on the water, or a small puff of dirt on the trail
  const m = new T.Mesh(ringGeo, ringMat.clone()); if (dust) m.material.color.set(0xb09878); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); G.add(m); splashes.push({ m, t: 0 });
  if (loud) G.sfx('splash');
}
const overWater = (x, z) => x < L().bank || (z > 67 && z < 71);
function updateRocks(dt) {
  const boat = L().boat, bl = boat.userData;
  const victims = !CH.on || CH.over || CH.boat ? [] : CH.victims ? CH.victims() : performance.now() - CH.hitAt > HIT_GAP ? [{ me: true, pos: P.pos, hit() { CH.hitAt = performance.now(); hitPlayer(); } }] : [];
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i], p = r.m.position;
    if (r.live) {
      r.v.y -= GRAV * dt; const ox = p.x, oy = p.y, oz = p.z; p.addScaledVector(r.v, dt); r.m.rotation.x += dt * 8; r.m.rotation.z += dt * 5;
      for (let k = 0; k < victims.length && r.live; k++) for (const f of [0.5, 1]) {
        const who = victims[k], x = ox + (p.x - ox) * f, y = oy + (p.y - oy) * f, z = oz + (p.z - oz) * f, hd = Math.hypot(x - who.pos.x, z - who.pos.z);
        if (hd < 0.42 && y > who.pos.y + 0.15 && y < who.pos.y + 1.85) { r.live = false; victims.splice(k, 1); who.hit(); break; }
        if (who.me && !r.whoosh && hd < 1.7 && y > 0.4 && y < 2.4) { r.whoosh = true; G.sfx('whoosh'); }
      }
      if (r.live && r.boat) { // on the hull or the deck: a hollow knock
        const lp = boat.worldToLocal(p.clone());
        if (Math.abs(lp.x) < bl.len / 2 && Math.abs(lp.z) < bl.beam / 2 && lp.y < bl.deckY + 0.4) { r.live = false; r.v.set(0, 0, 0); G.sfx('woodThud'); r.life = Math.min(r.life, 0.6); }
      }
      if (r.live && p.y <= 0.07) {
        r.live = false; r.v.set(0, 0, 0); p.y = 0.07;
        if (overWater(p.x, p.z)) { splashAt(p.x, p.z, dist(p, G.camera.position) < 45); r.life = 0.05; }
        else if (dist(p, P.pos) < 16) { G.sfx('clack'); splashAt(p.x, p.z, false, true); }
      }
      if (r.live) for (const c of G.colliders) if (c.solid && !c.off && c.los !== false && p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1 && p.y > c.y0 && p.y < c.y1) { r.live = false; r.v.set(0, 0, 0); p.x = ox; p.z = oz; if (dist(p, P.pos) < 16) G.sfx('clack'); break; }
    }
    r.life -= dt; if (r.life <= 0) { if (r.m.parent) r.m.parent.remove(r.m); rocks.splice(i, 1); }
  }
  for (let i = splashes.length - 1; i >= 0; i--) { const s = splashes[i]; s.t += dt; const k = s.t / 0.7; s.m.scale.setScalar(1 + k * 3); s.m.material.opacity = 0.5 * (1 - k); if (k >= 1) { if (s.m.parent) s.m.parent.remove(s.m); splashes.splice(i, 1); } }
}
function separate() {
  for (let i = 0; i < thugs.length; i++) for (let j = i + 1; j < thugs.length; j++) {
    const a = thugs[i].pos, b = thugs[j].pos, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d > 0.01 && d < 0.75) { const k = (0.75 - d) / d * 0.5; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
  }
}
function updateThug(th, dt, t) {
  let pose = 'stand';
  const frozen = !CH.boat && !CH.over && !CH.alarm && (CH.team ? !CH.on : S.busy); // dialogs stop the chase (they do run for the alarm shot)
  if (th.gone) { th.h.group.visible = false; return; }
  if (!CH.boat && CH.replica && CH.replica()) { // a guest: follow the host's men
    const ox = th.pos.x, oz = th.pos.z;
    if (th.net) {
      const k = 1 - Math.exp(-10 * dt);
      th.pos.x += (th.net.x - th.pos.x) * k; th.pos.z += (th.net.z - th.pos.z) * k; th.yaw += G.angDiff(th.yaw, th.net.yaw) * k; th.state = th.net.st;
    }
    th.speed = G.damp(th.speed, Math.hypot(th.pos.x - ox, th.pos.z - oz) / Math.max(dt, 1e-3), 8, dt);
    if (th.state === 'wind') pose = 'raise'; else if (th.state === 'recover') pose = 'strike';
  } else if (th.state === 'idle' || frozen) th.speed = 0;
  else if (CH.over) { // close in round the fallen Nam
    if (!th.spot) { const a = Math.random() * Math.PI * 2; th.spot = { x: P.pos.x + Math.sin(a) * 1.4, z: P.pos.z + Math.cos(a) * 1.4 }; }
    if (dist(th.pos, P.pos) < 9 && dist(th.pos, th.spot) > 0.3) moveThug(th, th.spot, 3.2, dt); else { th.speed = 0; if (dist(th.pos, P.pos) < 9) { face(th, P.pos); pose = 'point'; } }
  } else if (CH.boat) { // at the jetty: throw at the boat while it is in range
    if (!th.spot) { const k = thugs.indexOf(th); th.spot = { x: L().bank - 1 - (k % 6) * 2.1, z: 191.4 + (k % 2) * 1.6 }; if (k >= 6) th.spot = { x: L().bank + 1.5 + (k - 6) * 1.2, z: 187 + (k % 2) * 3 }; }
    const bp = L().boat.position;
    if (th.state === 'wind') { th.speed = 0; face(th, bp); pose = 'raise'; th.timer -= dt; if (th.timer <= 0) { const o = handPos(th); launch(o, { x: bp.x + G.rr(-3, 3), y: 0.6, z: bp.z + G.rr(-4, 4) }, true); th.state = 'recover'; th.timer = 0.3; } }
    else if (th.state === 'recover') { th.speed = 0; pose = 'strike'; th.timer -= dt; if (th.timer <= 0) th.state = 'chase'; }
    else if (dist(th.pos, th.spot) > 0.4) moveThug(th, th.spot, 4.6, dt);
    else { th.speed = 0; face(th, bp); th.cd -= dt; const d = dist(th.pos, bp); if (d < 44 && th.cd <= 0) { th.state = 'wind'; th.timer = 0.45; th.cd = G.rr(0.7, 1.6); } else if (d >= 44) pose = 'point'; }
  } else if (th.state === 'wind') {
    th.speed = 0; const tg = th.tg;
    if (!tg) th.state = 'chase'; // (a new host takes over mid-throw)
    else { face(th, tg.pos); pose = 'raise'; th.timer -= dt; if (th.timer <= 0) { throwAt(th, tg); th.state = 'recover'; th.timer = 0.3; } }
  }
  else if (th.state === 'recover') { th.speed = 0; pose = 'strike'; th.timer -= dt; if (th.timer <= 0) th.state = 'chase'; }
  else if (th.state === 'chase') {
    if (th.delay > 0) { th.delay -= dt; th.speed = 0; }
    else {
      const tg = th.tg = CH.pick ? CH.pick(th) : ME;
      const d = tg ? dist(th.pos, tg.pos) : 99;
      if (tg && d < 0.95 && CH.on) { if (CH.caught) CH.caught(tg); else chaseFail('caught'); return; }
      th.cd -= dt;
      if (!tg) { const to = CH.away ? CH.away(th) : null; if (to) moveThug(th, to, 3.0, dt); else th.speed = 0; } // everybody is down or aboard
      else if (CH.on && d > 5.5 && d < 22 && th.cd <= 0 && liveRocks() < (CH.maxRocks || 3) && !G.losBlocked(th.pos.x, th.pos.z, tg.pos.x, tg.pos.z)) { th.state = 'wind'; th.timer = 0.5; th.cd = G.rr(3.0, 4.8); }
      else moveThug(th, thugTarget(th, tg.pos), th.group === 'A' && d > 21 ? 6.7 : th.spd, dt); // the pack closes the gap when far behind
    }
  }
  th.phase += th.speed * dt * (G.gaitRate ? G.gaitRate(Math.max(th.speed, 0.6), { run: th.speed > 3, h: th.h }) : 2.5);
  G.animHuman(th.h, { pose, speed: th.speed, amt: th.speed / 3.4, phase: th.phase, run: th.speed > 3, t });
  th.h.group.position.copy(th.pos); th.h.group.rotation.y = th.yaw;
}
// ---- the boat: a path down the river; passengers ride in the boat's own frame ----
const ROUTE = [[-57.9, 188.6], [-64, 201], [-76, 232], [-88, 282], [-95, 350], [-98, 450], [-98, 720]];
function routeAt(s) {
  let acc = 0;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const a = ROUTE[i], b = ROUTE[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= acc + l) { const f = (s - acc) / l; return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, hx: (b[0] - a[0]) / l, hz: (b[1] - a[1]) / l }; }
    acc += l;
  }
  const a = ROUTE[ROUTE.length - 2], b = ROUTE[ROUTE.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return { x: b[0], z: b[1], hx: (b[0] - a[0]) / l, hz: (b[1] - a[1]) / l };
}
// yaw of an object whose local +x is its nose, heading along (hx, hz)
const noseYaw = (hx, hz) => Math.atan2(-hz, hx);
function placeRiders(boat, list) {
  const th = boat.rotation.y, c = Math.cos(th), s = Math.sin(th);
  for (const r of list) {
    const w = boat.localToWorld(new V3(r.lx, boat.userData.deckY, r.lz));
    const fx = r.fx * c + r.fz * s, fz = -r.fx * s + r.fz * c, yaw = Math.atan2(fx, fz);
    if (r.who === 'P') { P.pos.copy(w); P.yaw = yaw; }
    else if (r.peer) { r.peer.pos.copy(w); r.peer.tpos.copy(w); r.peer.yaw = r.peer.tyaw = yaw; } // a teammate
    else { const n = npc(r.who); if (n) { n.pos.copy(w); n.yaw = yaw; n.run = null; } }
  }
}
function boatTick(dt, t) {
  const B = CH.ride; if (!B) return;
  B.v = G.damp(B.v, B.vt, 0.6, dt); B.s += B.v * dt;
  const r = routeAt(B.s), boat = L().boat;
  boat.position.x = r.x; boat.position.z = r.z; boat.rotation.y += G.angDiff(boat.rotation.y, noseYaw(r.hx, r.hz)) * Math.min(1, dt * 1.5);
  boat.rotation.z = Math.sin(t * 1.3) * 0.015; boat.rotation.x = Math.sin(t * 0.9) * 0.012; boat.position.y = -0.55 + Math.sin(t * 1.7) * 0.03;
  placeRiders(boat, B.riders);
  if (B.wake && B.v > 1.5 && Math.random() < dt * 6) { const w = boat.localToWorld(new V3(-boat.userData.len / 2, 0, (Math.random() - 0.5) * 2)); splashAt(w.x, w.z, false); }
  // police boats: ease to their spots
  if (CH.police) for (const pb of CH.police) {
    const b = pb.boat, dx = pb.to.x - b.position.x, dz = pb.to.z - b.position.z, d = Math.hypot(dx, dz);
    if (d > 0.3) { const sp = Math.min(9, d * 0.6); b.position.x += dx / d * sp * dt; b.position.z += dz / d * sp * dt; b.rotation.y += G.angDiff(b.rotation.y, noseYaw(dx / d, dz / d)) * Math.min(1, dt * 1.2); }
    else b.rotation.y += G.angDiff(b.rotation.y, pb.yaw) * Math.min(1, dt * 0.8);
    b.position.y = -0.5 + Math.sin(t * 1.5 + pb.ph) * 0.03;
    placeRiders(b, pb.riders);
  }
}
function stepChase(dt) {
  if (!CH) return;
  dt = Math.min(dt || 0.016, 0.05); const t = performance.now() / 1000, replica = !!(CH.replica && CH.replica());
  if (CH.on && !CH.over && !CH.boat && !replica) { const front = CH.lead ? CH.lead() : P.pos.z; if (front > 72) activate('B'); if (front > 138) activate('C'); }
  for (const th of thugs) updateThug(th, dt, t);
  if (!replica || CH.boat) separate();
  updateRocks(dt); boatTick(dt, t);
  // how close the pack is (heartbeat, red edge, HUD meter)
  let nd = 99; if (CH.on && !CH.boat && !S.out && !S.tied) for (const th of thugs) if (th.state !== 'idle' && !th.gone) nd = Math.min(nd, dist(th.pos, P.pos));
  CH.near = nd;
}
function chaseTick(dt) {
  stepChase(dt);
  if (CH && CH.on && !CH.over && !CH.boat && !S.busy && G.near(L().dockEnd, 2.4)) ch4Board();
}
G.mapMarks = () => (CH && S.phase === 'ch4' && CH.on && !CH.boat ? thugs.filter((th) => th.state !== 'idle' && !th.gone).map((th) => th.pos) : []);
G.extraDet = () => (CH && S.phase === 'ch4' && CH.on && !CH.boat && !CH.over && !S.out && !S.tied ? G.clamp(1 - (CH.near - 1.5) / 14, 0, 1) : 0);
G.detLabel = (det) => (S.phase === 'ch4' && CH && CH.on && !CH.boat ? (det > 0.72 ? 'Bị đuổi sát!' : det > 0.33 ? 'Bọn chúng đang đuổi' : 'Còn cách xa') : null);
ST.soloBanner = function () {
  if (S.phase !== 'ch4' || !CH || !CH.on || CH.boat || CH.over || S.ended) return null;
  const hp = S.f.hp, near = CH.near < 99 ? Math.round(CH.near) : null;
  return [hp <= 2 ? 'bad' : '', 'Sức lực ' + '●'.repeat(hp) + '○'.repeat(HP_MAX - hp) + ' · ' + (near !== null ? 'Kẻ đuổi cách ' + near + ' m · ' : '') + (P.running ? 'Chạy zig-zag để né đá' : G.input.touch ? 'Bật nút Chạy!' : 'Giữ Shift để chạy!')];
};

// the cast of the run: the pack behind the gate, two by the first stilt house, two in the trees near the jetty,
// the freed prisoners (already over the fence) and ông Tư at his boat
function riverCast(n) {
  thugs = []; rocks = []; splashes = [];
  const [na, nb, nc] = n || [6, 2, 2], look = (i) => THUG_LOOKS[i % THUG_LOOKS.length];
  for (let i = 0; i < na; i++) makeThug(look(i), 15 + (i % 3) * 1.6, -4 - Math.floor(i / 3) * 2.2, 'A', i * 0.22);
  [[8.2, 88.5], [8.3, 91]].slice(0, nb).forEach(([x, z], i) => makeThug(look(6 + i), x, z, 'B'));
  [[-6, 166], [-3, 171]].slice(0, nc).forEach(([x, z], i) => makeThug(look(8 + i), x, z, 'C'));
  for (const th of thugs) if (th.group !== 'A') { th.yaw = -Math.PI / 2; th.h.group.rotation.y = th.yaw; }
  VICTIMS.forEach((lk, i) => G.addNpc('rv' + i, lk, { x: -2.5 + i * 1.7, z: 2.6 + (i % 2) * 0.8, yaw: Math.PI, pose: 'stand' }));
  G.addNpc('tu', { shirt: 0x5a7a8a, pants: 0x2a2a2a, skin: 0x9a6a48, hair: 0x9a948c, cap: 0x8a7a5a }, { x: 0, z: 0, pose: 'raise' });
  placeRiders(L().boat, [{ who: 'tu', lx: -1.6, lz: 0.4, fx: 0, fz: 1 }]);
}
function victimsRun(done) {
  VICTIMS.forEach((lk, i) => {
    const v = npc('rv' + i); v.pose = 'stand';
    const pts = L().path.slice(1, -1).map(([x, z]) => [x + (i - 1.5) * 0.7, z]); pts.push([-50 - i * 1.2, 192.2]);
    G.npcGo(v, pts, { speed: 6.9 - i * 0.15, done: done ? (n) => done(n, i) : null });
  });
}
// over the 3.2 m fence: f 0 → 1
function climbPos(f, x, out) {
  if (f < 0.55) out.set(x, (f / 0.55) * 3.35, -0.45);
  else if (f < 0.75) { const g = (f - 0.55) / 0.2; out.set(x, 3.35 + Math.sin(g * Math.PI) * 0.2, -0.45 + g * 1.0); }
  else { const g = (f - 0.75) / 0.25; out.set(x, 3.35 * (1 - g * g), 0.55 + g * 1.05); }
  return out;
}

// ===================== Chapter 4: the run =====================
ST.startCh4 = function () {
  ST.reset(); S.chapter = 4; S.phase = 'ch4'; S.dark = false; G.saveCheckpoint(4); ui.black(false);
  G.loadLevel('river'); G.overcast = 0.25; G.setRain(0); G.lightningOn = false; G.setTime(5.98);
  S.mood = 'horror'; ui.hud(false); S.phaseLabel = ''; // (the chase meter needs that corner on a phone held upright)
  G.titleOrbit = { r: 80, h: 34, cx: -10, cz: 90 };
  thugs = []; rocks = []; splashes = [];
  CH = { on: false, over: false, boat: false, groups: {}, near: 99, hitAt: -1e9, ride: null, police: null };
  S.f.hp = HP_MAX; S.f.hits = 0;
  riverCast();
  G.placePlayer(0, -0.6, 0); P.frozen = true; P.pose = 'climb';
  G.OBJ = [{ t: 'Chạy theo đường mòn ra bến sông, nhảy lên tàu của ông Tư', at: () => L().dockEnd, done: () => !!S.f.boarded }];
  G.INTER = [];
  ST.tick = chaseTick;
  G.cine([5, 2.4, 8.5], [0, 1.9, 0], true, 1);
  run([
    ST.chapterCard(4, 'Bến sông', 'Đèn lò gạch vừa tắt. Bờ sông chỉ cách hàng rào phía tây vài trăm mét.'),
    sayHold([['Người bị giam', 'Qua được rồi! Anh Nam, leo nhanh lên!']]),
    (n) => { // over the fence: up the brick pile, over the top, drop down outside
      P.frozen = true; P.pose = 'climb'; S.busy = true;
      let k = 0; const iv = setInterval(() => {
        k++; const f = Math.min(1, k / 55); P.phase += 0.3;
        climbPos(f, 0, P.pos); // clear over the 3.2 m top
        if (k >= 55) { clearInterval(iv); P.pos.y = 0; P.pose = 'kneel'; G.sfx('punch'); G.shake(0.12); n(); }
      }, 40);
    },
    fx(() => { G.sfx('alert'); G.sfx('mob'); G.sfx('bark'); activate('A'); CH.alarm = true; G.cine([20.5, 2.3, 6.5], [16.5, 1.1, -3], false, 4); }), wait(1700), fx(() => { CH.alarm = false; }),
    sayHold([['Tay chân đường dây', 'Tụi nó trốn qua rào! Đuổi theo, đừng để đứa nào xuống được sông!'], ['Người bị giam', 'Chạy đi! Ra bến sông, có tàu chờ ở đó!']]),
    fx(() => {
      G.cineOff(); G.placePlayer(0, 1.6, 0); P.frozen = false; P.pose = null; S.busy = false; ui.hud(true); CH.on = true;
      G.input.crouch = false; G.input.run = true; // running is on from the start
      victimsRun();
      ui.toast('Chạy ra bến! Đổi hướng để né đá. Chấm đỏ trên bản đồ là kẻ đuổi.', 3600);
    }),
  ]);
};
function ch4Board() {
  S.f.boarded = true; CH.boat = true; S.busy = true; P.frozen = true; G.input.run = false; ui.hud(false);
  for (const r of rocks) r.live = false;
  const boat = L().boat;
  // seats on the deck, everybody low and looking back at the jetty
  const riders = [{ who: 'P', lx: 2.6, lz: 0.2, fx: -1, fz: 0 }, { who: 'tu', lx: -1.6, lz: 0.4, fx: 1, fz: 0 }];
  [[0.4, -0.7], [1.4, 0.7], [3.6, -0.6], [4.4, 0.6]].forEach(([lx, lz], i) => { riders.push({ who: 'rv' + i, lx, lz, fx: -1, fz: lz * 0.4 }); const v = npc('rv' + i); if (v) { v.run = null; v.pose = 'floor'; } });
  P.pose = 'floor'; npc('tu').pose = 'raise';
  CH.ride = { s: 0, v: 0, vt: 0, wake: true, riders }; placeRiders(boat, riders);
  G.engineSound(true);
  G.cine([-46, 2.2, 182], [-57, 0.8, 191], false, 1.6);
  run([
    sayHold([['Ông Tư', 'Lên rồi! Ngồi thấp xuống, bám chắc vào mạn tàu!']]),
    fx(() => { CH.ride.vt = 6.5; npc('tu').pose = 'stand'; G.cine([-42.2, 2.9, 187.2], [-58, 1, 197], false, 3); }), // from the bank, behind the men throwing
    wait(2600),
    sayHold([['Ông Tư', 'Tụi nó ném đá theo kìa! Cúi đầu xuống, đừng ngóc lên!']]),
    wait(3000),
    fx(() => { const b = L().boat.position; G.cine([b.x + 6, 2.4, b.z + 14], [b.x, 0.9, b.z - 2], false, 1); }),
    sayHold([['Ông Tư', 'Chú tên Tư, người Việt, sống trên khúc sông này ba mươi năm rồi. Mấy anh công an bên mình nhờ chú ra đón các cháu.'], ['Nam', 'Cảm ơn chú... cảm ơn chú nhiều lắm...'], ['Ông Tư', 'Đừng cảm ơn vội. Xuống tới hạ lưu đã, có người chờ ở đó.']]),
    (n) => ui.fade(n),
    fx(policeScene), wait(5200),
    sayHold([['Trung tá Sokha', '(qua phiên dịch) Cảnh sát Campuchia đây. Mọi người an toàn rồi.'],
      ['Đại úy Minh', 'Nam phải không? Anh là Minh, lực lượng đặc nhiệm Việt Nam. Em làm tốt lắm.'],
      ['Đại úy Minh', 'Lúc các em vượt rào, hai bên đã ập vào lò gạch. Đám đuổi theo các em trên bờ cũng đang bị truy bắt.'],
      ['Trung tá Sokha', '(qua phiên dịch) Đêm qua chúng tôi phối hợp đột kích cùng lúc khu nhà ở Sihanoukville và trại trong rừng.'],
      ['Đại úy Minh', 'Mẹ em báo tin ngay từ hôm em nhắn về. Tín hiệu vệ tinh từ trại rừng giúp lần ra cả đường dây.'],
      ['Đại úy Minh', 'Làm xong giấy tờ, sẽ có chuyến bay đưa các em về nước.'],
      ['Nam', 'Về nhà... con được về nhà rồi...']]),
    (n) => { G.engineSound(false); ui.fade(n, 400); },
  ], () => { CH = null; ST.finalChoice(); });
}
function policeScene() {
  for (const th of thugs) th.gone = true;
  for (const r of rocks) if (r.m.parent) r.m.parent.remove(r.m); rocks = [];
  CH.ride.s = 236; CH.ride.v = 2.5; CH.ride.vt = 0; S.mood = 'hope';
  const look = (o) => Object.assign({ pants: 0x1c2433, longSleeve: true }, o);
  G.addNpc('sokha', look({ shirt: 0x8a7a5a, pants: 0x5a4e3a, skin: 0x9a6a48, cap: 0x5a4e3a, label: 'POLICE' }), { pose: 'talk' });
  G.addNpc('minh', look({ shirt: 0x3d5a3a, pants: 0x2e3e2c, skin: 0xb08560, cap: 0x2e3e2c, label: 'CẢNH SÁT' }), { pose: 'talk' });
  G.addNpc('khp', look({ shirt: 0x8a7a5a, pants: 0x5a4e3a, skin: 0xa8754f, helmet: 0x222222, label: 'POLICE' }), { pose: 'stand' });
  G.addNpc('vnp', look({ shirt: 0x1c2433, skin: 0xc49a70, helmet: 0x111111, label: 'CẢNH SÁT', rifle: true }), { pose: 'stand' });
  const [p0, p1] = L().police; const r = routeAt(236);
  p0.visible = p1.visible = true;
  p0.position.set(r.x - 6, -0.5, r.z + 36); p1.position.set(r.x + 6, -0.5, r.z + 42); p0.rotation.y = p1.rotation.y = noseYaw(0, -1);
  CH.police = [
    { boat: p0, to: { x: r.x - 3.4, z: r.z + 6 }, yaw: noseYaw(0, -1), ph: 0.4, riders: [{ who: 'sokha', lx: 1.8, lz: 0.5, fx: 0, fz: 1 }, { who: 'khp', lx: 3.2, lz: -0.4, fx: 0, fz: 1 }] },
    { boat: p1, to: { x: r.x + 3.6, z: r.z + 9 }, yaw: noseYaw(0, -1), ph: 1.7, riders: [{ who: 'minh', lx: 1.8, lz: -0.5, fx: 0, fz: -1 }, { who: 'vnp', lx: 3.2, lz: 0.4, fx: 0, fz: -1 }] },
  ];
  placeRiders(p0, CH.police[0].riders); placeRiders(p1, CH.police[1].riders);
  G.sfx('siren'); setTimeout(() => G.sfx('siren'), 3600);
  ui.toast('Mười lăm phút sau · hạ lưu', 3000);
  G.cine([r.x + 13.5, 4.6, r.z - 7], [r.x, 1, r.z + 5], true, 1);
  G.setTime(6.3);
}

// ===================== the flight home =====================
const PL = { mode: 'park', s: 0, v: 0, alt: 0, pitch: 0, cam: null };
const TAXI = [[10, -118], [40, -118], [92, -115], [102, -102], [102, -36], [100, -10], [94, 0]];
function polyAt(pts, s) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (s <= acc + l) { const f = (s - acc) / l; return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, hx: (b[0] - a[0]) / l, hz: (b[1] - a[1]) / l, end: false }; } acc += l; }
  const a = pts[pts.length - 2], b = pts[pts.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return { x: b[0], z: b[1], hx: (b[0] - a[0]) / l, hz: (b[1] - a[1]) / l, end: true };
}
function planeTick(dt, t) {
  const pl = L().plane; if (!pl) return;
  if (pl.userData.strobe) pl.userData.strobe.visible = (t % 1.2) < 0.08;
  if (PL.mode === 'taxi') {
    PL.v = G.damp(PL.v, 12, 0.8, dt); PL.s += PL.v * dt; const r = polyAt(TAXI, PL.s);
    pl.position.x = r.x; pl.position.z = r.z; pl.rotation.y += G.angDiff(pl.rotation.y, noseYaw(r.hx, r.hz)) * Math.min(1, dt * 2.2);
  } else if (PL.mode === 'roll') { // take-off toward −x along the centre line
    PL.v = Math.min(78, PL.v + 6 * dt); pl.position.x -= PL.v * dt; pl.position.z = G.damp(pl.position.z, 0, 2, dt);
    pl.rotation.y += G.angDiff(pl.rotation.y, Math.PI) * Math.min(1, dt * 3);
    if (PL.v > 56) PL.pitch = Math.min(0.17, PL.pitch + dt * 0.12);
    if (PL.v > 62) PL.alt += PL.v * Math.sin(PL.pitch) * dt * 0.9;
    if (PL.alt > 14) pl.userData.gear.visible = false;
  } else if (PL.mode === 'approach') { // landing toward −x: glide, flare, touch down at x ≈ 180, roll out
    if (PL.alt > 0) { PL.v = G.damp(PL.v, 66, 0.3, dt); pl.position.x -= PL.v * dt; PL.alt = Math.max(0, (pl.position.x - 180) * 0.13); PL.pitch = PL.alt < 6 ? 0.1 : 0.04; if (PL.alt === 0) { G.sfx('hit'); G.shake(0.05); } }
    else { PL.v = Math.max(0, PL.v - 7 * dt); pl.position.x -= PL.v * dt; PL.pitch = Math.max(0, PL.pitch - dt * 0.12); if (PL.v < 1) PL.mode = 'stopped'; }
    pl.rotation.y = Math.PI;
  }
  pl.position.y = PL.alt; pl.rotation.z = PL.pitch;
  if (P.pos.y < -10) { P.pos.x = pl.position.x; P.pos.z = pl.position.z; } // Nam is aboard: the sun's shadows follow the plane
  if (PL.cam) PL.cam(pl, dt);
  // the stairs lift a walker as they climb (NPCs move only on the ground plane)
  const sr = L().stairsRun; if (sr) for (const k of ['rv0', 'rv1', 'rv2', 'rv3', 'minh']) { const n = npc(k); if (!n || !n.h.group.visible) continue; n.pos.y = Math.abs(n.pos.x - L().door.x) < 1 && n.pos.z > sr.z0 && n.pos.z < sr.z1 + 0.6 ? G.clamp((n.pos.z - sr.z0) / (sr.z1 - sr.z0), 0, 1) * sr.y1 : 0; }
}
// everyone who sees them off + the plane's controller (the caller has just loaded the airport)
function airportCast() {
  G.airportDress('kh');
  Object.assign(PL, { mode: 'park', s: 0, v: 0, alt: 0, pitch: 0, cam: null });
  G.tickers.push(planeTick);
  const st = L().start, sb = L().stairsBottom, look = (o) => Object.assign({ pants: 0x1c2433, longSleeve: true }, o);
  G.addNpc('minh', look({ shirt: 0x3d5a3a, pants: 0x2e3e2c, skin: 0xb08560, cap: 0x2e3e2c, label: 'CẢNH SÁT' }), { x: st.x + 1.6, z: st.z + 1.2, yaw: Math.PI / 2, pose: 'talk' });
  G.addNpc('sokha', look({ shirt: 0x8a7a5a, pants: 0x5a4e3a, skin: 0x9a6a48, cap: 0x5a4e3a, label: 'POLICE' }), { x: sb.x - 2.4, z: sb.z - 1.6, yaw: Math.PI / 2, pose: 'stand' });
  [[sb.x - 8, sb.z - 2.2], [sb.x - 5, sb.z - 2.4]].forEach(([x, z], i) => G.addNpc('kh' + i, look({ shirt: 0x8a7a5a, pants: 0x5a4e3a, skin: 0xa8754f, cap: 0x5a4e3a, label: 'POLICE' }), { x, z, yaw: 0, pose: 'stand' }));
  [[sb.x - 12, sb.z - 2.2], [sb.x - 15, sb.z - 2.4]].forEach(([x, z], i) => G.addNpc('vn' + i, look({ shirt: 0x3d5a3a, pants: 0x2e3e2c, skin: 0xc49a70, cap: 0x2e3e2c, label: 'CẢNH SÁT' }), { x, z, yaw: 0, pose: 'stand' }));
  G.addNpc('crew', { shirt: 0x1d4f91, pants: 0x1d4f91, skin: 0xd6a985, longHair: true, longSleeve: true }, { x: L().door.x, z: L().door.z - 0.9, yaw: Math.PI, pose: 'talk' });
  npc('crew').pos.y = L().doorY;
  VICTIMS.forEach((lk, i) => G.addNpc('rv' + i, lk, { x: st.x + 3 + i * 1.3, z: st.z - 1.2 - (i % 2), yaw: Math.PI / 2, pose: 'stand' }));
}
function airportWalk(speed) {
  const sb = L().stairsBottom, v = speed || 1.4;
  VICTIMS.forEach((lk, i) => G.npcGo(npc('rv' + i), [[sb.x - 3 + i * 0.4, sb.z - 0.6], [sb.x, sb.z + 0.6], [L().door.x, L().stairsRun.z1], [L().door.x, L().door.z + 0.4]], { walk: true, speed: v + i * 0.05, hide: true }));
  G.npcGo(npc('minh'), [[sb.x - 1.6, sb.z - 0.8]], { walk: true, speed: v + 0.1, done: (n) => { n.pose = 'talk'; n.yaw = Math.PI / 2; } });
}
function planeLeave() { // door shut, stairs pull back, engines start, taxi
  const pl = L().plane; pl.userData.door.position.z += 0.02;
  for (let i = 0; i < 4; i++) { const v = npc('rv' + i); if (v) { v.run = null; v.h.group.visible = false; } } // everyone is on board
  let k = 0; const st = L().stairs, z0 = st.position.z; const iv = setInterval(() => { k++; st.position.z = z0 - Math.min(1, k / 50) * 7; if (k >= 50) clearInterval(iv); }, 40);
  G.jetSound(0.3); PL.mode = 'taxi'; PL.v = 0;
  PL.cam = (p) => G.cine([p.position.x - 26, 9, p.position.z - 30], [p.position.x + 4, 3, p.position.z], false, 1.6);
}
function planeRoll() { // lined up on the runway: take-off roll toward −x
  const pl = L().plane; pl.position.set(92, 0, 0); pl.rotation.y = Math.PI; PL.mode = 'roll'; PL.v = 4; G.jetSound(1);
  PL.cam = (p) => { if (p.position.x > -40) G.cine([-150, 2.6, 34], [p.position.x, 3 + PL.alt, p.position.z], false, 3); else G.cine([p.position.x + 70, 6 + PL.alt * 0.5, p.position.z + 46], [p.position.x, 3 + PL.alt, p.position.z], false, 2); };
  G.cine([-150, 2.6, 34], [92, 3, 0], true, 3);
}
function planeApproach() { // Tân Sơn Nhất
  const pl = L().plane;
  G.airportDress('vn'); G.setTime(16.4);
  for (const k in G.npcs) G.npcs[k].h.group.visible = false;
  pl.userData.gear.visible = true; pl.position.set(720, 75, 0); pl.rotation.y = Math.PI;
  Object.assign(PL, { mode: 'approach', v: 70, alt: 75, pitch: 0.04 }); L().stairs.visible = false;
  G.jetSound(0.45);
  PL.cam = (p) => { if (p.position.x > 170) G.cine([150, 2.2, 40], [p.position.x, 3 + PL.alt, 0], false, 4); else G.cine([p.position.x + 55, 5, p.position.z + 42], [p.position.x, 3, 0], false, 2); };
  G.cine([150, 2.2, 40], [720, 78, 0], true, 4);
}
ST.flightHome = function () {
  ST.reset(); S.phase = 'airport'; S.chapter = 5; S.dark = false; G.saveCheckpoint(5); ui.black(false);
  G.loadLevel('airport'); G.overcast = 0.15; G.setRain(0); G.lightningOn = false; G.setTime(8.2);
  S.mood = 'hope'; ui.hud(false); S.phaseLabel = 'Sân bay · buổi sáng';
  G.titleOrbit = { r: 120, h: 40, cx: 10, cz: -110 };
  airportCast();
  const st = L().start;
  G.placePlayer(st.x, st.z, Math.PI / 2); P.frozen = true;
  G.OBJ = [{ t: 'Đi cùng mọi người tới cầu thang máy bay', at: () => L().stairsBottom, done: () => !!S.f.boarding }];
  G.INTER = [{ at: () => L().stairsBottom, r: 2.4, when: () => !S.f.boarding, label: 'Lên máy bay', run: flightBoard }];
  ST.tick = () => {};
  G.cine([st.x + 7, 2.6, st.z - 6], [st.x + 1, 1.4, st.z + 0.5], true, 1);
  run([
    card([{ t: 'Sân bay · sáng hôm sau', c: 'place' }, { t: 'Sau khi lấy lời khai, nhóm của Nam được làm giấy tờ khẩn cấp để về nước. Hai lực lượng cảnh sát đưa họ ra tận chân máy bay.' }]),
    sayHold([['Đại úy Minh', 'Đi thôi Nam. Bố mẹ em đang chờ ở Tân Sơn Nhất.']]),
    fx(() => {
      G.cineOff(); P.frozen = false; P.pose = null; S.busy = false; ui.hud(true);
      airportWalk();
      ui.toast('Đi tới cầu thang máy bay (điểm vàng), rồi bấm E để lên máy bay.', 3800);
    }),
  ]);
};
function flightBoard() {
  S.f.boarding = true; S.busy = true; P.frozen = true; ui.hud(false);
  const sb = L().stairsBottom, sr = L().stairsRun, door = L().door;
  for (const k of ['kh0', 'kh1', 'vn0', 'vn1']) { const n = npc(k); if (n) { n.pose = 'raise'; n.yaw = Math.atan2(sb.x - n.pos.x, sb.z - n.pos.z); } }
  const so = npc('sokha'); so.yaw = Math.atan2(sb.x - so.pos.x, sb.z - so.pos.z); so.pose = 'talk';
  G.cine([sb.x - 7, 2.2, sb.z - 5], [sb.x - 1, 1.5, sb.z], false, 1.2);
  run([
    sayHold([['Trung tá Sokha', '(qua phiên dịch) Thượng lộ bình an. Những kẻ đã lừa các bạn sẽ phải ra tòa.'], ['Nam', 'Cảm ơn các anh. Cảm ơn rất nhiều.'], ['Đại úy Minh', 'Lên đi. Anh đi ngay sau em.']]),
    fx(() => { G.cine([door.x - 9, 3.5, door.z - 9], [door.x, 2, door.z - 2], false, 1); }),
    (n) => { // up the stairs
      S.busy = true; G.placePlayer(door.x, sr.z0 - 0.4, 0); P.frozen = true; P.pose = null; let k = 0;
      P.walkAmt = 0.45; P.walkSpeed = 1.4; // the frozen player still steps (actors.js)
      const iv = setInterval(() => { k++; const f = Math.min(1, k / 70); const z = sr.z0 - 0.4 + (sr.z1 + 0.5 - sr.z0) * f; P.pos.set(door.x, G.clamp((z - sr.z0) / (sr.z1 - sr.z0), 0, 1) * sr.y1, z); P.yaw = 0; P.phase += 0.16; if (k >= 70) { clearInterval(iv); P.walkAmt = 0; P.walkSpeed = 0; n(); } }, 40);
    },
    fx(() => { P.pos.set(10, -40, -118); G.npcGo(npc('minh'), [[door.x, sr.z0 - 0.2], [door.x, sr.z1], [door.x, door.z + 0.4]], { walk: true, speed: 1.5, hide: true }); npc('crew').h.group.visible = false; }),
    wait(3200),
    fx(planeLeave),
    wait(6500),
    (n) => ui.fade(n),
    fx(planeRoll),
    wait(17000),
    (n) => { G.jetSound(0.2); ui.fade(n); },
    fx(() => { G.jetSound(0); PL.cam = null; }),
    card([{ t: 'Chuyến bay hồi hương', c: 'big' }, { t: 'Một giờ sau, máy bay giảm độ cao trên những cánh đồng lúa miền Nam.' }]),
  ], flightLand);
}
function flightLand() {
  S.phaseLabel = 'Tân Sơn Nhất · chiều';
  planeApproach();
  run([
    wait(3800),
    sayHold([['', 'Bánh xe chạm đường băng. Trong khoang có người vỗ tay, có người bật khóc.'], ['Nam (nghĩ)', 'Về rồi. Mình về thật rồi.']]),
    (n) => { const iv = setInterval(() => { if (PL.mode === 'stopped' || PL.v < 6) { clearInterval(iv); n(); } }, 200); },
    (n) => { G.jetSound(0); ui.fade(n, 300); },
  ], () => { PL.cam = null; ST.epilogue(); });
}

// ===================== the engine, for the team version (team_escape.js) =====================
G.esc = {
  HP_MAX, PL,
  begin(opts) { CH = Object.assign({ on: false, over: false, boat: false, groups: {}, near: 99, hitAt: -1e9, ride: null, police: null }, opts); return CH; },
  ch: () => CH,
  thugs: () => thugs,
  riverCast, victimsRun, climbPos, activate, nextIdx, step: stepChase, addRock, placeRiders, policeScene,
  airportCast, airportWalk, planeLeave, planeRoll, planeApproach,
};
})(window.G);
