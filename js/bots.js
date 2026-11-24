// bots.js — team-mode bots. The host's browser simulates them as extra players: grid path-finding over the map
// colliders, the support half of each two-person mission (hold the ladder, lure the guard, lift the shutter, hold the
// breaker), untying teammates, and the final run outside. Their state goes to the room through the server ('bst'),
// so on every other screen a bot looks and counts like a normal teammate.
(function (G) {
'use strict';
const S = G.state, ST = G.story, P = G.player, ui = G.ui;
const L = () => G.LOC;
const BOTS = G.bots = {};
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------------- navigation grid: 0.5 m cells, walls inflated by the body radius ----------------
const CS = 0.5, R = 0.42;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
let NG = null, ngSig = '';
const colSig = () => { let n = 0; for (const c of G.colliders) if (c.off) n++; return G.levelName + ':' + G.colliders.length + ':' + n; };
function buildGrid() {
  const b = G.levelCfg.bounds, W = Math.ceil((b.x1 - b.x0) / CS), H = Math.ceil((b.z1 - b.z0) / CS), blk = new Uint8Array(W * H);
  for (const c of G.colliders) {
    if (!c.solid || c.off || c.y1 < 0.35 || c.y0 > 1.7) continue;
    const i0 = Math.max(0, Math.floor((c.x0 - R - b.x0) / CS)), i1 = Math.min(W - 1, Math.floor((c.x1 + R - b.x0) / CS));
    const j0 = Math.max(0, Math.floor((c.z0 - R - b.z0) / CS)), j1 = Math.min(H - 1, Math.floor((c.z1 + R - b.z0) / CS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = b.x0 + (i + 0.5) * CS, z = b.z0 + (j + 0.5) * CS;
      const cx = x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x, cz = z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z;
      if ((x - cx) ** 2 + (z - cz) ** 2 < R * R) blk[j * W + i] = 1;
    }
  }
  // travel cost: lit ground ×3, ground a stationary guard can see from his post ×8 → bots take the dark way round
  const cost = new Float32Array(W * H).fill(1);
  const area = (cx, cz, r, k, fromGuard) => {
    const i0 = Math.max(0, Math.floor((cx - r - b.x0) / CS)), i1 = Math.min(W - 1, Math.floor((cx + r - b.x0) / CS));
    const j0 = Math.max(0, Math.floor((cz - r - b.z0) / CS)), j1 = Math.min(H - 1, Math.floor((cz + r - b.z0) / CS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = b.x0 + (i + 0.5) * CS, z = b.z0 + (j + 0.5) * CS;
      if ((x - cx) ** 2 + (z - cz) ** 2 > r * r || (fromGuard && G.losBlocked(cx, cz, x, z))) continue;
      cost[j * W + i] = Math.max(cost[j * W + i], k);
    }
  };
  for (const l of G.lit) area(l.x, l.z, l.r, 3, false);
  for (const g of G.guards) if (g.kind === 'office' || g.kind === 'sweep') area(g.day[0], g.day[1], 9, 8, true);
  NG = { b, W, H, blk, cost, g: new Float32Array(W * H), from: new Int32Array(W * H), seen: new Uint32Array(W * H), closed: new Uint32Array(W * H), gen: 0 };
}
const cellOf = (x, z) => { const i = Math.max(0, Math.min(NG.W - 1, Math.floor((x - NG.b.x0) / CS))), j = Math.max(0, Math.min(NG.H - 1, Math.floor((z - NG.b.z0) / CS))); return j * NG.W + i; };
const cellPos = (n) => ({ x: NG.b.x0 + ((n % NG.W) + 0.5) * CS, z: NG.b.z0 + (((n / NG.W) | 0) + 0.5) * CS });
function freeCellNear(n) {
  if (!NG.blk[n]) return n;
  const x0 = n % NG.W, z0 = (n / NG.W) | 0;
  for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = x0 + dx, z = z0 + dz; if (x < 0 || z < 0 || x >= NG.W || z >= NG.H) continue;
    const m = z * NG.W + x; if (!NG.blk[m]) return m;
  }
  return -1;
}
const snap = (p) => { const n = freeCellNear(cellOf(p.x, p.z)); return n < 0 || n === cellOf(p.x, p.z) ? { x: p.x, z: p.z } : cellPos(n); };
// straight segment is usable if it hits no wall and crosses no ground riskier than its two ends (keeps detours around light)
function lineClear(a, c) {
  const lim = Math.max(NG.cost[cellOf(a.x, a.z)], NG.cost[cellOf(c.x, c.z)]), n = Math.ceil(dist(a, c) / (CS * 0.5));
  for (let k = 1; k < n; k++) { const f = k / n, m = cellOf(a.x + (c.x - a.x) * f, a.z + (c.z - a.z) * f); if (NG.blk[m] || NG.cost[m] > lim) return false; }
  return true;
}
// A* over the grid → way-points smoothed by line of sight, or null when unreachable
function findPath(a, c) {
  const s = freeCellNear(cellOf(a.x, a.z)), t = freeCellNear(cellOf(c.x, c.z)); if (s < 0 || t < 0) return null;
  const { W, H, blk, cost, g, from, seen, closed } = NG, gen = ++NG.gen, tx = t % W, tz = (t / W) | 0;
  const h = (n) => { const dx = Math.abs(n % W - tx), dz = Math.abs(((n / W) | 0) - tz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const heap = [];
  const push = (n, f) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; const q = heap[p]; heap[p] = heap[k]; heap[k] = q; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; const q = heap[m]; heap[m] = heap[k]; heap[k] = q; k = m; } } return top[1]; };
  g[s] = 0; seen[s] = gen; from[s] = -1; push(s, h(s));
  let found = false, iter = 0;
  while (heap.length && iter++ < 90000) {
    const n = pop(); if (closed[n] === gen) continue; closed[n] = gen;
    if (n === t) { found = true; break; }
    const x = n % W, z = (n / W) | 0;
    for (const [dx, dz, w] of DIRS) {
      const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= W || zz >= H) continue;
      const m = zz * W + xx; if (blk[m] || closed[m] === gen) continue;
      if (dx && dz && (blk[z * W + xx] || blk[zz * W + x])) continue;
      const ng = g[n] + w * cost[m];
      if (seen[m] !== gen || ng < g[m]) { seen[m] = gen; g[m] = ng; from[m] = n; push(m, ng + h(m)); }
    }
  }
  if (!found) return null;
  const cells = []; for (let n = t; n !== -1; n = from[n]) cells.push(n);
  const pts = cells.reverse().map(cellPos); pts[pts.length - 1] = { x: c.x, z: c.z };
  const out = []; let anchor = { x: a.x, z: a.z }, k = 0;
  while (k < pts.length - 1) { let j = k + 1; while (j + 1 < pts.length && lineClear(anchor, pts[j + 1])) j++; out.push(pts[j]); anchor = pts[j]; k = j; }
  return out.length ? out : [{ x: c.x, z: c.z }];
}

// ---------------- where bots go: each team map's `bot` block (story2.js ST.TEAMMAPS) ----------------
//   support {objective index: role}  the support half a bot takes for that mission
//   spot / look / main / can          where it holds, which way it faces, where the human does the other half, when holding counts
//   lure                              the lure role: hide spot, when to make noise, when it is no longer needed
//   chore {objective index: true}     missions any number of bots can share (open cages / cells): see chores()
//   idle / preOut / outSpot           where spare bots wait, and where they go at the end
//   climb                             a fence they can climb once it is open (kiln): side(pos), inside / outside foot of it
//   (a leg of the river escape and the Myanmar map have their own botStep instead: team_escape.js, myanmar.js with BOTS.kit)
const TM = () => ST.teamMap(), CFG = () => ST.teamMap().bot;
const botList = () => [...G.net.peers.values()].filter((p) => p.bot);
const freeHumans = () => { const out = []; if (!S.tied && !S.out) out.push(P.pos); for (const p of G.net.peers.values()) if (!p.bot && !p.td && !p.o && p.got) out.push(p.pos); return out; };
let roleSig = '', sendT = 0;

function hopStep(b, cl, dt) { // over the fence
  const ai = b.ai, pos = b.tpos, h = ai.hop;
  h.t += dt; const f = Math.min(1, h.t / 1.5), k = Math.max(0, Math.min(1, (f - 0.4) / 0.3));
  pos.x = h.x + (h.to.x - h.x) * k; pos.z = h.z + (h.to.z - h.z) * k;
  pos.y = f < 0.45 ? f / 0.45 * cl.top : f < 0.65 ? cl.top : cl.top * (1 - ((f - 0.65) / 0.35) ** 2);
  b.p = 'climb'; b.s = 0; b.tyaw = h.to.x < h.x ? -Math.PI / 2 : Math.PI / 2;
  if (f >= 1) { pos.y = 0; ai.hop = null; ai.key = ''; }
}
function moveTo(b, goal, speed, dt) {
  const ai = b.ai, pos = b.tpos, cl = (CFG() || {}).climb;
  let hopTo = null;
  if (cl) {
    if (ai.hop) { hopStep(b, cl, dt); return false; }
    if (cl.open() && cl.side(pos) !== cl.side(goal)) { // the goal is on the other side: to the foot of the fence first
      const out = cl.side(pos);
      hopTo = out ? cl.inside : cl.outside; goal = out ? cl.outside : cl.inside;
    }
  }
  const key = goal.x.toFixed(1) + ',' + goal.z.toFixed(1);
  if (ai.key !== key) { ai.key = key; ai.goal = snap(goal); ai.path = null; ai.noPath = false; ai.replan = 0; }
  if (dist(pos, ai.goal) < 0.45) { b.s = 0; ai.stuck = 0; if (hopTo) { ai.hop = { t: 0, x: pos.x, z: pos.z, to: hopTo }; return false; } return true; }
  ai.replan = (ai.replan || 0) - dt;
  if (ai.replan <= 0 || (!ai.path && !ai.noPath)) { const p = findPath(pos, ai.goal); ai.path = p; ai.noPath = !p; ai.pi = 0; ai.replan = p ? 6 : 1.5; }
  if (!ai.path) { b.s = 0; return false; } // walled in (cage or prison still locked): wait here and look again soon
  let wp = ai.path[Math.min(ai.pi, ai.path.length - 1)];
  if (dist(pos, wp) < 0.35 && ai.pi < ai.path.length - 1) wp = ai.path[++ai.pi];
  const dx = wp.x - pos.x, dz = wp.z - pos.z, dd = Math.hypot(dx, dz) || 1, st = Math.min(dd, speed * dt), ox = pos.x, oz = pos.z;
  pos.x += dx / dd * st; pos.z += dz / dd * st; G.collide(pos, 0.3, 0);
  b.tyaw = Math.atan2(dx, dz); b.s = speed;
  ai.stuck = Math.hypot(pos.x - ox, pos.z - oz) < st * 0.3 ? (ai.stuck || 0) + dt : 0;
  if (ai.stuck > 1.2) { ai.stuck = 0; ai.replan = 0; pos.x += (Math.random() - 0.5) * 0.5; pos.z += (Math.random() - 0.5) * 0.5; }
  return false;
}
const face = (b, p) => { b.tyaw = Math.atan2(p.x - b.tpos.x, p.z - b.tpos.z); };

// ---------------- rescues ----------------
function tiedPos(t) {
  if (t.me) return S.tied ? P.pos : null;
  const p = G.net.peers.get(t.id); return p && p.td ? (p.bot ? p.tpos : p.pos) : null;
}
function critical(b, ctx) { // holding for a human who is doing the other half right now
  if (ctx.keep) return ctx.keep(b);
  const r = b.ai.role, main = CFG().main || {}; if (r !== ctx.activeRole || !b.hl || !main[r]) return false;
  return freeHumans().some((h) => dist(h, main[r]()) < 3.5);
}
function dispatchRescues(list, ctx) {
  for (const b of list) if (b.ai.rescue && (b.td || !tiedPos(b.ai.rescue))) { b.ai.rescue = null; b.ai.hold = 0; }
  const tied = []; if (S.tied) tied.push({ me: true, key: 'me' });
  for (const p of G.net.peers.values()) if (p.td) tied.push({ id: p.id, key: 'p' + p.id });
  for (const t of tied) {
    if (list.some((b) => b.ai.rescue && b.ai.rescue.key === t.key)) continue;
    const tp = tiedPos(t); let best = null, bd = 1e9;
    for (const b of list) { if (b.td || b.ai.rescue || b.id === t.id || critical(b, ctx)) continue; const d = dist(b.tpos, tp); if (d < bd) { bd = d; best = b; } }
    if (best) { best.ai.rescue = t; best.ai.hold = 0; best.ai.ap = null; }
  }
}
function freeTarget(b, t) {
  if (t.me) {
    if (!S.tied) return; S.tied = false; P.frozen = false; P.pose = null; G.resetStance(); G.sfx('pickup');
    ui.toast(b.name + ' đã cởi trói cho bạn! Chạy đi!', 3000); G.net.send({ t: 'free', id: G.net.id, as: b.id });
  } else {
    const p = G.net.peers.get(t.id); if (!p || !p.td) return;
    p.td = false; G.net.send({ t: 'free', id: p.id, as: b.id }); ui.toast(b.name + ' đã cởi trói cho ' + p.name, 2600);
  }
  S.f.frees = (S.f.frees || 0) + 1; G.missionTimerAdd(15);
}

// ---------------- the lure (S-7 gate, jungle bamboo, kiln fence) ----------------
function lureStep(b, dt, active, i) {
  const ai = b.ai, lu = CFG().lure, tl = TM().lure;
  if (!lu || !tl) { moveTo(b, CFG().idle(i), 2.4, dt); return; }
  const at = tl.at();
  if (!active || lu.done()) { moveTo(b, lu.hide(), 2.4, dt); return; }
  const ready = lu.ready() && performance.now() - (ai.lureAt || 0) > (lu.every || 12000);
  if (!ready) { ai.lureHold = 0; if (moveTo(b, lu.hide(), 2.4, dt)) face(b, at); return; }
  if (moveTo(b, at, 2.8, dt)) {
    b.s = 0; face(b, lu.face ? lu.face() : at); ai.lureHold = (ai.lureHold || 0) + dt;
    if (ai.lureHold > 1.2) {
      ai.lureHold = 0; ai.lureAt = performance.now(); S.f.lureAt = ai.lureAt;
      G.sfx('cage'); G.sfx('door2'); G.makeNoise(at.x, at.z, tl.r, 'lure', true);
      G.net.send({ t: 'say', k: 'lured', as: b.id }); ui.toast(b.name + tl.botToast, 3200);
    }
  }
}
// ---------------- shared jobs: open the nearest cage / cell nobody else is on ----------------
function choreStep(b, dt, i) {
  const ai = b.ai, list = CFG().chores ? CFG().chores() : [];
  if (!ai.chore || !list.some((c) => c.key === ai.chore.key)) {
    ai.chore = null; ai.hold = 0;
    const taken = new Set(botList().filter((x) => x !== b && x.ai && x.ai.chore).map((x) => x.ai.chore.key));
    let best = null, bd = 1e9;
    for (const c of list) { if (taken.has(c.key)) continue; const d = dist(b.tpos, c.at); if (d < bd) { bd = d; best = c; } }
    ai.chore = best;
  }
  if (!ai.chore) { moveTo(b, CFG().idle(i), 2.4, dt); return; }
  if (moveTo(b, ai.chore.at, 2.6, dt)) {
    b.s = 0; ai.hold = (ai.hold || 0) + dt;
    if (ai.hold >= ai.chore.hold) {
      const k = ai.chore.key; ai.chore = null; ai.hold = 0;
      G.applyWorld(k); G.net.emit(k, b.id); ui.toast(b.name + ' ' + ((TM().msg && TM().msg[k]) || ''), 2600);
    }
  }
}

// ---------------- one bot, one frame ----------------
function stepBot(b, dt, ctx, i) {
  const ai = b.ai, cfg = CFG(), tm = TM();
  b.got = true; b.last = performance.now(); b.r = false;
  if (b.td) { b.p = 'tied'; b.hl = ''; b.s = 0; b.c = false; ai.path = null; return; }
  b.p = 'stand'; b.hl = ''; b.c = true;
  const out = tm.isOut(b.tpos);
  if (out && !b.o) { G.net.send({ t: 'say', k: 'street', as: b.id }); ui.toast(b.name + ((tm.say && tm.say.street) || ' đã ra tới đường lớn'), 2200); }
  b.o = out;
  if (ai.rescue) { // hurry (still crouched inside the walls) to the tied teammate, then hold for 2.2 s
    const tp = tiedPos(ai.rescue); b.c = !out;
    if (!ai.ap || dist(ai.apFor, tp) > 1) { const d = dist(b.tpos, tp) || 1; ai.ap = { x: tp.x + (b.tpos.x - tp.x) / d * 1.0, z: tp.z + (b.tpos.z - tp.z) / d * 1.0 }; ai.apFor = { x: tp.x, z: tp.z }; }
    if (dist(b.tpos, tp) < 1.5 || moveTo(b, ai.ap, 2.9, dt)) {
      b.s = 0; face(b, tp); ai.hold = (ai.hold || 0) + dt;
      if (ai.hold >= 2.2) { freeTarget(b, ai.rescue); ai.rescue = null; ai.hold = 0; }
    }
    return;
  }
  const role = ai.role, active = role === ctx.activeRole;
  if (role === 'out') { b.c = !out; moveTo(b, tm.exitOpen() ? cfg.outSpot(i) : cfg.preOut(), b.c ? 2.6 : 3.2, dt); return; }
  if (role === 'lure') { lureStep(b, dt, active, i); return; }
  if (role === 'chore') { choreStep(b, dt, i); return; }
  if (!cfg.spot[role]) { moveTo(b, cfg.idle(i), 2.4, dt); return; }
  if (moveTo(b, cfg.spot[role](), 2.4, dt)) {
    face(b, cfg.look[role]());
    if (active && cfg.can[role]()) b.hl = role;
  }
}
function assignRoles(list, cur) {
  const cfg = CFG(), free = list.filter((b) => !b.td), last = G.OBJ.filter((o) => !o.opt).length - 1;
  free.forEach((b) => { b.ai.role = 'idle'; b.ai.chore = null; });
  if (cur < 0 || cur >= last) { free.forEach((b) => { b.ai.role = 'out'; }); return; }
  const shared = !!(cfg.chore && cfg.chore[cur]);
  // the current job + the next one, so a bot is already in place when the team gets there
  const roles = []; if (!shared) for (let k = cur; k < last && roles.length < 2; k++) if (cfg.support[k]) roles.push(cfg.support[k]);
  const pool = free.slice();
  for (const r of roles) {
    if (!pool.length) break; const sp = r === 'lure' ? cfg.lure.hide() : cfg.spot[r](); let bi = 0;
    pool.forEach((b, j) => { if (dist(b.tpos, sp) < dist(pool[bi].tpos, sp)) bi = j; });
    pool[bi].ai.role = r; pool.splice(bi, 1);
  }
  if (shared) pool.forEach((b) => { b.ai.role = 'chore'; });
}

// ---------------- for a map with its own botStep ----------------
BOTS.kit = {
  moveTo, face, tiedPos, free: freeTarget,
  prep(list) {
    const sig = colSig();
    if (NG && sig === ngSig) return;
    buildGrid(); ngSig = sig;
    for (const b of list) if (b.ai) { b.ai.path = null; b.ai.noPath = false; }
  },
  rescues: (list, keep) => dispatchRescues(list, { keep }),
};
// ---------------- public ----------------
BOTS.start = function () { // every client at round start; the host also places them at the map's start
  roleSig = ''; NG = null; ngSig = '';
  const host = G.net.isHost(), tm = TM();
  botList().forEach((b, i) => {
    b.ai = { role: 'idle' }; b.td = false; b.o = false; b.hl = ''; b.p = 'stand'; b.s = 0;
    if (!host) return;
    const sp = tm.botSpawn ? tm.botSpawn(i) : tm.spawn(i);
    b.tpos.set(sp.x, 0, sp.z); b.pos.copy(b.tpos); b.tyaw = b.yaw = sp.yaw != null ? sp.yaw : Math.PI; b.got = true; b.last = performance.now();
  });
};
BOTS.tick = function (dt) {
  if (!S.teamPlay || S.ended || !G.net.on || !G.net.isHost()) return;
  const list = botList(); if (!list.length) return;
  const own = ST.teamMap().botStep;
  if (own) { own(list, dt); sendStates(list, dt); return; } // the river escape / the airport
  const sig = colSig(); if (!NG || sig !== ngSig) { buildGrid(); ngSig = sig; list.forEach((b) => { if (b.ai) { b.ai.path = null; b.ai.noPath = false; } }); }
  list.forEach((b) => { if (!b.ai) b.ai = { role: 'idle' }; }); // adopted after a host change
  const o = G.currentObj(), cur = o ? G.OBJ.indexOf(o) : -1, ctx = { cur, activeRole: CFG().support[cur] };
  const rs = cur + ':' + list.filter((b) => !b.td).map((b) => b.id).join(',');
  if (rs !== roleSig) { roleSig = rs; assignRoles(list, cur); }
  dispatchRescues(list, ctx);
  list.forEach((b, i) => stepBot(b, dt, ctx, i));
  sendStates(list, dt);
};
function sendStates(list, dt) {
  sendT -= dt;
  if (sendT > 0) return;
  sendT = 1 / 12;
  for (const b of list) {
    G.net.send({ t: 'bst', id: b.id, e: S.teamLeg || 0, x: Math.round(b.tpos.x * 100) / 100, y: Math.round(b.tpos.y * 100) / 100, z: Math.round(b.tpos.z * 100) / 100, yaw: Math.round(b.tyaw * 100) / 100,
      c: !!b.c, r: !!b.r, s: b.s || 0, p: b.p || 'stand', hl: b.hl || '', td: !!b.td, o: !!b.o });
  }
}
BOTS.caught = function (b, src) { // host: a guard got one of the bots → tied to the post like anyone else
  if (!b || b.td || S.ended || b.o) return;
  b.td = true; b.hl = ''; if (b.ai) { b.ai.hop = null; b.ai.path = null; b.ai.rescue = null; b.ai.chore = null; }
  const tm = TM(), post = tm.post(b.tpos), a = (b.id % 6) / 6 * Math.PI * 2;
  b.tpos.set(post.x + Math.sin(a) * 0.62, 0, post.z + Math.cos(a) * 0.62); b.pos.copy(b.tpos); b.tyaw = b.yaw = a + Math.PI;
  G.sfx('arrestFar'); if (src === 'dog') G.sfx('bark');
  ui.toast(b.name + ' bị bắt, đang bị trói ở ' + tm.postName + '!', 3200);
  G.net.send({ t: 'say', k: 'tied', as: b.id });
};
})(window.G);
