// motion.js — how the people move. Built on measured human movement (sources in the character review):
//  · Legs are placed by inverse kinematics: a foot on the ground stays where it is while the body moves over it (no
//    sliding). The shoe is rigid, so it rolls on its own outline (measured from the mesh): heel → flat → ball → toe tip,
//    which keeps every part of it above the floor. The height of the pelvis follows from the legs: highest over the
//    standing leg and lowest with both feet down when walking; lowest mid-stance and highest in the air when running.
//  · Step length and cadence follow the speed (walking ~0.72 m and ~108 steps a minute at 1.3 m/s, the foot down ~60 %
//    of the stride). People change from walking to running at about 2 m/s, so a faster "walk" is a jog; running steps
//    grow from ~1.3 m (160/min) to ~2 m (183/min at 6.2 m/s), the foot down 40 → 25 % of the stride, both feet off the
//    ground between steps. Whoever moves a character advances its cycle with G.gaitRate(speed).
//  · The rest of the body walks too: the pelvis turns and drops a little over each step and shifts over the standing
//    leg (tilts forward when running), the shoulders turn against it, the arms swing opposite to the legs (elbows bent
//    ~90° running), the head stays level and looks ahead.
//  · Sitting puts the pelvis on whatever seat is under it and the feet flat on the floor; kneeling puts the knees on
//    the floor, lying puts the back and heels on it; hands go where the action is (keyboard, mouth, phone, knees).
//  · Joints stay inside human ranges of motion (AAOS); breathing, small weight shifts, glances, blinking (~15 a minute)
//    and lips that move when talking keep people alive when they stand still.
(function (G) {
'use strict';
const T = G.T, HUM = G.HUM;
const legacy = G.animHuman; // the block figure's animation (only if a body has no ankles)
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const V = (x, y, z) => new T.Vector3(x || 0, y || 0, z || 0);
const _e = new T.Euler(), _m = new T.Matrix4(), _q1 = new T.Quaternion(), _q2 = new T.Quaternion();
const _a = V(), _b = V(), _c = V(), _d = V(), _u = V(), _x = V(), _y = V(), _z = V();
const qE = (q, x, y, z, order) => q.setFromEuler(_e.set(x, y, z, order || 'XYZ'));
function noise1(x) { const i = Math.floor(x), f = x - i, h = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1; }
// joint limits used everywhere (radians): knee ≤ 135°, elbow ≤ 150°, ankle dorsiflexion ≤ 30°, plantarflexion ≤ 50°
const KNEE_MAX = 2.36, ELBOW_MAX = 2.6, ANK_DF = 0.52, ANK_PF = 0.87, TOE_MAX = 1.5;

// ---------------- gait: step length / cadence by speed ----------------
// metres per step at a speed (m/s). Walking: 0.62 m at 1 m/s, 0.72 m at 1.3 (108 steps/min), 0.94 m at 2 m/s.
// Running: 1.28 m at 3.4 m/s (160/min), 1.58 m at 4.5 (171/min), 2.03 m at 6.2 (183/min). Sneaking: short steps.
function stepLength(v, mode) {
  if (mode === 'run') return clamp(0.36 + 0.27 * v, 0.9, 2.4);
  if (mode === 'crouch') return clamp(0.32 + 0.22 * v, 0.3, 0.8);
  return clamp(0.30 + 0.32 * v, 0.35, 1.0);
}
const modeOf = (o) => (o && o.crouch ? 'crouch' : o && o.run ? 'run' : 'walk');
// how much of a run the gait is: people switch from walking to running at ~2 m/s (preferred transition speed)
const PTS0 = 1.9, PTS1 = 2.5;
const runK = (v, mode) => (mode === 'run' ? 1 : mode === 'walk' ? sstep(PTS0, PTS1, v) : 0);
function stepFor(v, mode) { const k = runK(v, mode); return k <= 0 ? stepLength(v, mode) : k >= 1 ? stepLength(v, 'run') : lerp(stepLength(v, 'walk'), stepLength(v, 'run'), k); }
// radians of the walk cycle per metre travelled (one step = π)
G.gaitRate = function (v, o) {
  const size = o && o.h && o.h.group ? o.h.group.scale.x / 0.95 : 1;
  return Math.PI / (stepFor(Math.max(0.3, v || 0), modeOf(o)) * size);
};
// D: how far the ground moves under the body while a foot is down (bind units); bias: where that stretch is centred
// (behind the hips: the foot lands ~0.35 D ahead and leaves from the toes well behind); p0 / p1: the foot's pitch at
// heel strike (toes up) and toe-off (heel up); sF / sHO: foot flat / heel off (fractions of the stance)
function gaitParams(v, mode) {
  const l = stepLength(Math.max(0.3, v), mode) / 0.95;             // bind units (the size cancels out)
  if (mode === 'run') {
    const D = 0.8 + 0.02 * v, beta = clamp(D / (2 * l), 0.18, 0.45);   // foot down ~32 % of the stride jogging → ~22 % fast
    return { mode, beta, D, bias: -0.19 * D, lift: 0.12 + 0.035 * v, lPk: 0.32, lEnd: 0.85, hT: 0.03, mK: 0.6, relA: 0.35, relB: 0, p0: -0.1, p1: 1.15, pSw: -0.05, sF: 0.12, sHO: 0.42, clear: 0.02,
      width: 0.035, arm: 0.5 + 0.05 * v, armFwd: -0.22, elbow: 1.5, pelvisYaw: 0.1, list: 0.035, sway: 0.008, lean: 0.11 + 0.02 * clamp(v - 3, 0, 4), tilt: 0.06 + 0.012 * v };
  }
  if (mode === 'crouch') {
    const beta = 0.66, D = 2 * beta * l;
    return { mode, beta, D, bias: -0.08 * D, lift: 0.07, lPk: 0.35, lEnd: 0.8, hT: 0.018, mK: 1, relA: 0.2, relB: -0.05, p0: -0.12, p1: 0.6, pSw: -0.05, sF: 0.12, sHO: 0.55, clear: 0.012,
      width: 0.12, arm: 0.15, armFwd: -0.5, elbow: 1.05, pelvisYaw: 0.06, list: 0.03, sway: 0.012, lean: 0.42, tilt: 0 };
  }
  const k = sstep(1.4, 2.4, v); // 0 normal walking → 1 brisk walking
  const beta = lerp(0.61, 0.57, sstep(1.2, 2.2, v)), D = 2 * beta * l;   // foot down 61 % of the stride → 57 % brisk
  return { mode, beta, D, bias: -lerp(0.12, 0.1, k) * D, lift: 0.05 + 0.02 * v, lPk: 0.3, lEnd: 0.84, hT: 0.022, mK: 1, relA: 0.25, relB: -0.05, p0: -0.36, p1: 1.05 + 0.04 * Math.min(v, 2), pSw: -0.08, sF: 0.12, sHO: 0.55, clear: 0.012,
    width: lerp(0.06, 0.05, k), arm: 0.17 + 0.11 * Math.min(v, 2.4), armFwd: -0.04 - 0.06 * k, elbow: lerp(0.28, 0.6, k), pelvisYaw: 0.04 + 0.03 * Math.min(v, 2.4), list: lerp(0.06, 0.07, k), sway: lerp(0.024, 0.016, k), lean: 0.035 + 0.03 * Math.min(v, 2.4), tilt: 0 };
}
function mixParams(a, b, k) { const o = {}; for (const key in a) o[key] = typeof a[key] === 'number' ? lerp(a[key], b[key], k) : (k < 0.5 ? a[key] : b[key]); return o; }

// ---------------- the foot: a rigid shoe rolling on the ground ----------------
// The side outline of the foot (convex hull of its vertices around the ankle) is measured once per body; rolling it
// along the ground without slipping (heel → flat sole → ball → toe tip, or back onto the heel) gives where the ankle is
// for every pitch of the foot: the lowest point always touches the floor, the point it pivots on doesn't move.
function hull2(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop(); return lo.concat(up);
}
const ROLL_STEP = 0.02, ROLL_MIN = -1.2, ROLL_MAX = 2.8;
function rollTable(pts) {
  const Hl = hull2(pts), n = Math.round((ROLL_MAX - ROLL_MIN) / ROLL_STEP) + 1, i0 = Math.round(-ROLL_MIN / ROLL_STEP);
  const Y = new Float32Array(n), Z = new Float32Array(n);
  const wy = (j, p) => Hl[j][1] * Math.cos(p) - Hl[j][0] * Math.sin(p), wz = (j, p) => Hl[j][0] * Math.cos(p) + Hl[j][1] * Math.sin(p);
  const lowest = (p) => { let best = 1e9, bi = 0; for (let j = 0; j < Hl.length; j++) { const y = wy(j, p); if (y < best - 1e-7) { best = y; bi = j; } } return bi; };
  let y0 = 1e9; for (const q of Hl) y0 = Math.min(y0, q[1]);
  Y[i0] = -y0; Z[i0] = 0;
  for (const dir of [1, -1]) {
    let j = lowest(dir * ROLL_STEP), g = wz(j, 0);                  // first pivot: front of the sole / back of the heel
    for (let k = i0 + dir; k >= 0 && k < n; k += dir) {
      const p = ROLL_MIN + k * ROLL_STEP, j2 = lowest(p);
      if (j2 !== j) { g = g - wz(j, p) + wz(j2, p); j = j2; }       // the next point takes over where it touches down
      Y[k] = -wy(j, p); Z[k] = g - wz(j, p);
    }
  }
  return { Y, Z, n, len: Math.max(...Hl.map((q) => q[0])) - Math.min(...Hl.map((q) => q[0])) };
}
// two outlines: the foot behind the toe joints (what it stands and rolls on) and the whole foot with the toes straight
// (what has to clear the floor in the swing)
function footRoll(h) {
  const geo = h.body && h.body.geometry; if (!geo || !geo.attributes.skinIndex) return null;
  if (geo.userData.rollDims === h.dims) return geo.userData.roll;
  geo.userData.rollDims = h.dims; geo.userData.roll = null;
  const D = h.dims, pos = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, AK = HUM.ANK_L, TO = HUM.TOE_L;
  const rear = [], all = [];
  for (let i = 0; i < pos.count; i++) {
    const b = SW.getX(i) >= SW.getY(i) ? SI.getX(i) : SI.getY(i);
    if (b !== AK && b !== TO) continue;
    const y = pos.getY(i) - D.ankleH; if (y > 0.05) continue;       // the foot itself, not the collar or the sock
    const q = [pos.getZ(i), y];                                     // (forward, up) from the ankle joint
    all.push(q); if (b === AK) rear.push(q);
  }
  if (rear.length < 6) return null;
  const R = rollTable(rear); R.full = all.length > rear.length ? rollTable(all) : R;
  return (geo.userData.roll = R);
}
// a body's foot model: ankle(zr, p) → where the ankle is (zr: its ground spot when the foot is flat), low(y, p) →
// how high the lowest point is with the ankle at y; falls back to a heel / ball / toe-tip model
function footOf(h) {
  if (h._foot && h._footGeo === h.body.geometry && h._footDims === h.dims) return h._foot;
  const R = footRoll(h), D = h.dims;
  let Yf, Zf, Yfree = null;
  if (R) {
    const tab = (T, p) => { const f = clamp((p - ROLL_MIN) / ROLL_STEP, 0, T.n - 1.001), k = Math.floor(f), u = f - k; return T.Y[k] + (T.Y[k + 1] - T.Y[k]) * u; };
    Yfree = (p) => tab(R.full, p);
    Yf = (p) => tab(R, p);
    Zf = (p) => { const f = clamp((p - ROLL_MIN) / ROLL_STEP, 0, R.n - 1.001), k = Math.floor(f), u = f - k; return R.Z[k] + (R.Z[k + 1] - R.Z[k]) * u; };
  } else {
    const A = D.ankleH, tipY = 0.012, ps = Math.atan2(tipY, D.toe - D.toeBall), tz = D.toeBall + (D.toe - D.toeBall) * Math.cos(ps) + tipY * Math.sin(ps);
    Yf = (p) => (p < 0 ? A * Math.cos(p) - D.heel * Math.sin(p) : p < ps ? A * Math.cos(p) + D.toeBall * Math.sin(p) : (A - tipY) * Math.cos(p) + D.toe * Math.sin(p));
    Zf = (p) => (p < 0 ? -D.heel + A * Math.sin(p) + D.heel * Math.cos(p) : p < ps ? D.toeBall + A * Math.sin(p) - D.toeBall * Math.cos(p) : tz - D.toe * Math.cos(p) + (A - tipY) * Math.sin(p));
  }
  if (h.toeL && R) {
    // heel up: the foot turns about the toe joints (over the ball, MTP_H above the floor) while the toes stay flat
    const Yh = Yf, Zh = Zf, y0 = Yh(0), mz = D.toeBall, my = D.ankleH - HUM.MTP_H;
    Yf = (p) => (p <= 0 ? Yh(p) : y0 + my * (Math.cos(p) - 1) + mz * Math.sin(p));
    Zf = (p) => (p <= 0 ? Zh(p) : mz * (1 - Math.cos(p)) + my * Math.sin(p));
  }
  h._footGeo = h.body.geometry; h._footDims = h.dims;
  const Yfr = Yfree || Yf;
  return (h._foot = { ankle: (zr, p, out) => { out.y = Yf(p); out.z = zr + Zf(p); return out; }, Y: Yf, low: (y, p) => y - Yf(p), lowFree: (y, p) => y - Yfr(p), toes: !!h.toeL });
}
// one foot through the stride: u = 0 heel strike … beta toe-off … 1 next heel strike
const _a0 = {}, _a1 = {};
function footCycle(u, P, F, out) {
  if (u < P.beta) {
    const s = u / P.beta, zr = P.D * (0.5 - s) + P.bias;
    let p = 0;
    if (s < P.sF) p = P.p0 * (1 - sstep(0, P.sF, s));
    else if (s > P.sHO) p = P.p1 * sstep(P.sHO, 1, s);
    F.ankle(zr, p, out); out.p = p; out.stance = s; out.zr = zr; out.wRel = 0; out.rel = 0; out.clr = 0; out.sw = -1; return out;
  }
  const s = (u - P.beta) / (1 - P.beta);
  F.ankle(-P.D / 2 + P.bias, P.p1, _a0); F.ankle(P.D / 2 + P.bias, P.p0, _a1);
  const m = -(1 - P.beta) / P.beta * P.mK;                // the swing starts (and ends) moving with the ground
  const g = s * s * (3 - 2 * s) + m * s * (1 - s) * (1 - 2 * s);
  out.z = lerp(_a0.z, _a1.z, g);
  out.p = s < 0.35 ? lerp(P.p1, P.pSw, sstep(0, 0.35, s)) : lerp(P.pSw, P.p0, sstep(0.35, 1, s));
  const fall = sstep(P.lPk, P.lEnd, s);
  out.y = lerp(_a0.y, _a1.y, sstep(0.1, P.lEnd - 0.05, s)) + P.lift * sstep(0, P.lPk, s) * (1 - fall) + P.hT * fall * (1 - sstep(P.lEnd, 1, s));
  out.rel = lerp(P.relA, P.relB, sstep(0, 0.5, s)); out.wRel = sstep(0, 0.2, s) * (1 - sstep(0.72, 1, s));
  out.clr = P.clear * sstep(0, 0.12, s) * sstep(1, 0.88, s);  // toe clearance ~1-2 cm in mid-swing
  out.stance = -1; out.zr = 0; out.sw = s; out.ly = _a1.y; out.lz = _a1.z; return out;
}
const _fa = {}, _fb = {};
function feet(u, Pa, Pb, k, F, out) {
  if (!Pb) return footCycle(u, Pa, F, out);
  if (!Pa) return footCycle(u, Pb, F, out);
  footCycle(u, Pa, F, _fa); footCycle(u, Pb, F, _fb);
  out.y = lerp(_fa.y, _fb.y, k); out.z = lerp(_fa.z, _fb.z, k); out.p = lerp(_fa.p, _fb.p, k);
  const f = k < 0.5 ? _fa : _fb; out.stance = f.stance; out.zr = lerp(_fa.zr, _fb.zr, k);
  out.rel = lerp(_fa.rel, _fb.rel, k); out.wRel = lerp(_fa.wRel, _fb.wRel, k); out.clr = lerp(_fa.clr, _fb.clr, k); out.sw = f.sw;
  if (f.sw >= 0) { out.ly = lerp(_fa.ly || _fa.y, _fb.ly || _fb.y, k); out.lz = lerp(_fa.lz || _fa.z, _fb.lz || _fb.z, k); }
  return out;
}

// ---------------- inverse kinematics ----------------
// two bones from joint J to target W (root frame); pole: which way the middle joint points. Returns the first bone's
// world orientation (a basis with local -Y along the bone, +Z toward `front`) and the middle joint's bend (≤ maxBend).
function twoBone(J, W, pole, L1, L2, bendBack, maxBend, out) {
  _d.subVectors(W, J); const dl = _d.length() || 1e-6;
  const dmin = Math.sqrt(Math.max(0, L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(maxBend)));
  const dc = clamp(dl, Math.max(Math.abs(L1 - L2) + 0.002, dmin), L1 + L2 - 0.0008);
  _d.divideScalar(dl);
  const bend = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - dc * dc) / (2 * L1 * L2), -1, 1));
  const a = Math.acos(clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1));
  _a.copy(pole).addScaledVector(_d, -pole.dot(_d)); if (_a.lengthSq() < 1e-8) _a.set(0, 0, 1).addScaledVector(_d, -_d.z); _a.normalize();
  _u.copy(_d).multiplyScalar(Math.cos(a)).addScaledVector(_a, Math.sin(a));           // the first bone points here
  _y.copy(_u).negate();
  _z.copy(_a).addScaledVector(_u, -_a.dot(_u)).normalize();                              // toward the pole
  if (!bendBack) _z.negate();                                                           // elbows bend away from the pole
  _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z); out.q.setFromRotationMatrix(_m); out.bend = bend;
  return out;
}
const _leg = { q: new T.Quaternion(), bend: 0 }, _arm = { q: new T.Quaternion(), bend: 0 };
// leg: hip joint Hj, ankle target A (root frame), foot orientation qFoot (root), knee direction (root)
function legIK(h, side, qHips, Hj, A, qFoot, kneeDir) {
  const D = h.dims, leg = side < 0 ? h.legL : h.legR, kn = side < 0 ? h.knL : h.knR, ank = side < 0 ? h.ankL : h.ankR;
  twoBone(Hj, A, kneeDir, D.thigh, D.shin, true, KNEE_MAX, _leg);
  leg.quaternion.copy(_q1.copy(qHips).invert().multiply(_leg.q));
  kn.quaternion.copy(qE(_q2, _leg.bend, 0, 0));
  // the ankle turns the foot to the orientation asked for, within its range
  _q1.copy(_leg.q).multiply(_q2).invert().multiply(qFoot);
  _e.setFromQuaternion(_q1, 'XYZ');
  const ex = clamp(_e.x, -ANK_DF, ANK_PF), ey = clamp(_e.y, -0.3, 0.3), ez = clamp(_e.z, -0.25, 0.25);
  ank.quaternion.copy(qE(_q1, ex, ey, ez));
  return _e.x - ex; // how far past the ankle's range the foot wanted to go (− : more dorsiflexion than it has)
}
// arm: shoulder S, wrist target W (root frame), parent (spine) orientation, elbow pole (root), forearm twist
function armIK(h, side, qParent, S, W, pole, twist) {
  const D = h.dims, arm = side < 0 ? h.armL : h.armR, el = side < 0 ? h.elL : h.elR;
  twoBone(S, W, pole, D.upper, D.fore + 0.012, false, ELBOW_MAX, _arm);
  arm.quaternion.copy(_q1.copy(qParent).invert().multiply(_arm.q));
  el.quaternion.copy(qE(_q2, -_arm.bend, twist || 0, 0));
}
function armFK(h, side, x, z, e, twist) {
  const arm = side < 0 ? h.armL : h.armR, el = side < 0 ? h.elL : h.elR;
  // ranges: shoulder flexion ≤ 180°, extension ≤ 60°, abduction ≤ 180°, adduction ≤ 30°; elbow 0–150°
  // z here is abduction (+ out to the side, − across the body)
  x = clamp(x, -3.1, 1.0); const abd = clamp(z, -0.5, 3.1); e = clamp(e, -ELBOW_MAX, 0.03);
  arm.quaternion.copy(qE(_q1, x, 0, side * abd));
  // a little carrying angle (forearm out) when the elbow is straight
  el.quaternion.copy(qE(_q2, e, twist || 0, -side * -0.12 * Math.max(0, 1 + e / 1.2)));
}

// ---------------- seats ----------------
// what a sitting character sits on: the highest surface 0.2–0.9 m up right under its pelvis (chairs, sofas, benches,
// beds, boxes, van seats); found once per place and remembered
const ray = new T.Raycaster(), DOWN = V(0, -1, 0);
let seatList = null, seatRoot = null, seatAt = 0, seatVer = 0, seatCount = -1;
const _bb = new T.Box3(), _bm = new T.Matrix4(), _bs = new T.Sphere();
// the level's surfaces with their world bounds (so a probe only tests what is actually under it); looked over every
// few seconds and rebuilt when the story has added or removed things
let seatLevel = null;
function seatMeshes() {
  const now = performance.now();
  if (seatRoot === G.root && seatList && seatLevel === G.levelName && now - seatAt < 4000) return seatList;
  seatAt = now; seatLevel = G.levelName; seatVer++;
  const found = [];
  const walk = (o) => {
    if (o.userData.human || !o.visible) return;
    if ((o.isMesh || o.isInstancedMesh) && !o.isSkinnedMesh && !o.userData.noSeat && o.layers.test(ray.layers) && !(o.material && o.material.transparent && o.material.opacity < 0.5)) found.push(o);
    for (const c of o.children) walk(c);
  };
  if (G.root) walk(G.root);
  if (seatRoot === G.root && seatList && found.length === seatCount && seatList.every((e, i) => e.o === found[i])) return seatList;
  seatRoot = G.root; seatCount = found.length;
  seatList = found.map((o) => bounds({ o }));
  return seatList;
}
// world bounds of a surface (kept up to date for things that move, like the van)
function bounds(e) {
  const o = e.o, me = o.matrixWorld.elements;
  e.m0 = me[0]; e.m2 = me[2]; e.m12 = me[12]; e.m13 = me[13]; e.m14 = me[14];
  {
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (o.isInstancedMesh) {
      if (!g.boundingSphere) g.computeBoundingSphere();
      _bb.makeEmpty();
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, _bm); _bs.copy(g.boundingSphere).applyMatrix4(_bm.premultiply(o.matrixWorld)); _bb.expandByPoint(_a.copy(_bs.center).addScalar(_bs.radius)); _bb.expandByPoint(_a.copy(_bs.center).addScalar(-_bs.radius)); }
    } else _bb.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
    e.x0 = _bb.min.x; e.x1 = _bb.max.x; e.y0 = _bb.min.y; e.y1 = _bb.max.y; e.z0 = _bb.min.z; e.z1 = _bb.max.z;
    return e;
  }
}
// the surfaces under a point between heights y0 and y1
function surfacesAt(x, z, y0, y1) {
  const out = [];
  for (const e of seatMeshes()) {
    const me = e.o.matrixWorld.elements;
    if (me[12] !== e.m12 || me[13] !== e.m13 || me[14] !== e.m14 || me[0] !== e.m0 || me[2] !== e.m2) bounds(e);
    if (x >= e.x0 - 0.01 && x <= e.x1 + 0.01 && z >= e.z0 - 0.01 && z <= e.z1 + 0.01 && e.y1 >= y0 && e.y0 <= y1) out.push(e.o);
  }
  return out;
}
// probes are spread out: at most a few per frame (a room full of people sitting down at once)
let probeT = -1, probeLeft = 0;
function probeOK() { const f = Math.floor(performance.now() / 12); if (f !== probeT) { probeT = f; probeLeft = 3; } return probeLeft-- > 0; }
function castDown(x, y, z, far) { ray.set(_b.set(x, y, z), DOWN); ray.far = far; return ray.intersectObjects(surfacesAt(x, z, y - far, y), false); }
// only people standing in the game world probe it (not the character studio, not previews)
function inGame(h) { let t = h.group; while (t.parent) t = t.parent; return t === G.scene && !!G.root; }
function floorUnder(h) {
  if (!inGame(h)) return 0;
  h.group.getWorldPosition(_c);
  seatMeshes();
  const key = Math.round(_c.x * 2) + ',' + Math.round(_c.z * 2) + ',' + Math.round(_c.y * 10) + ',' + seatVer;
  if (h._floorKey === key || !probeOK()) return h._floorY || 0;
  h._floorKey = key; h._floorY = 0;
  for (const hit of castDown(_c.x, _c.y + 0.6, _c.z, 0.8)) { const y = hit.point.y - _c.y; if (y < 0.12 && y > -0.12) { h._floorY = y; break; } }
  return h._floorY;
}
function seatUnder(h) {
  if (!inGame(h)) return null;
  h.group.getWorldPosition(_c);
  seatMeshes();
  const key = Math.round(_c.x * 10) + ',' + Math.round(_c.z * 10) + ',' + Math.round(_c.y * 10) + ',' + seatVer;
  if (h._seatKey === key || (h._seatKey !== undefined && !probeOK())) return h._seatY === undefined ? null : h._seatY;
  h._seatKey = key; h._seatY = null;
  // under the character's origin and under the sitting bones (~6 cm behind it): sitting on the edge of a bed, the pelvis
  // is over the mattress, not over the frame in front of it
  h.group.getWorldQuaternion(_q2); _d.set(0, 0, -0.06 * (h.group.scale.x || 1)).applyQuaternion(_q2);
  for (const k of [0, 1]) {
    for (const hit of castDown(_c.x + _d.x * k, _c.y + 1.15, _c.z + _d.z * k, 1.0)) {
      const y = hit.point.y - _c.y;
      if (y > 0.2 && y < 0.9) { if (h._seatY === null || y > h._seatY) h._seatY = y; break; }
    }
  }
  // where the seat ends in front (people slide forward on a high seat, but not off it)
  h._seatEdge = 0.19;
  if (h._seatY !== null) {
    let prev = 0;
    for (const f of [0.05, 0.11, 0.17, 0.23, 0.29]) {
      const k = -f / 0.06;
      let found = false;
      for (const hit of castDown(_c.x + _d.x * k, _c.y + 1.15, _c.z + _d.z * k, 1.0)) { const y = hit.point.y - _c.y; if (y > 0.2 && y < 0.9) { found = Math.abs(y - h._seatY) < 0.06; break; } }
      if (!found) { h._seatEdge = (prev + f) / 2; break; }
      prev = f;
    }
  } else h._seatKey = undefined;
  return h._seatY;
}

// ---------------- the pose of the moment ----------------
const ST = { hipsPos: V(), qHips: new T.Quaternion(), qSpine: new T.Quaternion(), qHead: new T.Quaternion() };
const legT = [{ a: V(), p: 0, kd: V(), on: true, zr: 0, plant: false, wRel: 0, rel: 0, clr: 0, sw: -1, toes: false }, { a: V(), p: 0, kd: V(), on: true, zr: 0, plant: false, wRel: 0, rel: 0, clr: 0, sw: -1, toes: false }];
const _ls = { a: V() }, _fc = {}, _fL = {}, _fR = {}, _hj = [V(), V()], _qf = new T.Quaternion(), _sh = V(), _w = V(), _pole = V(), _qp = new T.Quaternion(), _an = {};
const STANDING = new Set(['stand', 'talk', 'smoke', 'point', 'raise', 'strike', 'hug', 'hands_up', 'phone', 'drink', 'shock']);
const SITTING = new Set(['sit', 'type', 'tied', 'phone_sit']);

G.animHuman = function (h, o) {
  if (!h.ankL || !h.dims) return legacy && legacy(h, o);
  const D = h.dims, pose = o.pose || 'stand', t = o.t || 0;
  const mo = h._mo || (h._mo = { seed: Math.random() * 50, blinkAt: 2 + Math.random() * 3, blinkT: -1, lastT: t });
  const F = footOf(h);
  const s = o.size || h.group.scale.x || 1;
  const v = o.speed !== undefined ? o.speed : (o.amt || 0) * 3.4;
  const fo = o.studio || o.seatY !== undefined ? 0 : (v > 0.6 && h._floorY !== undefined ? h._floorY : floorUnder(h)) / s;   // where the floor really is (bind units)
  const mode = modeOf(o);
  const hipJY = D.hipsY + D.hipDY;                        // hip joint height standing (bind)
  const Lmax = D.thigh + D.shin;
  let hx = 0, hy = D.hipsY, hz = 0, hpitch = 0, hyaw = 0, hlist = 0, lean = 0, twist = 0, sideTilt = 0, headX = 0, headY = 0, headZ = 0, elevL = 0, elevR = 0;
  let legsDone = false;
  const breath = Math.sin(TAU * t / 4.1 + mo.seed);        // ~15 breaths a minute
  const legsFK = (lx, kx, ax, splay) => { // simple legs (lying, climbing)
    for (const sd of [-1, 1]) {
      const leg = sd < 0 ? h.legL : h.legR, kn = sd < 0 ? h.knL : h.knR, ank = sd < 0 ? h.ankL : h.ankR;
      const L = Array.isArray(lx) ? lx[sd < 0 ? 0 : 1] : lx, K = Array.isArray(kx) ? kx[sd < 0 ? 0 : 1] : kx;
      leg.quaternion.copy(qE(_q1, clamp(L, -2.05, 0.5), sd * 0.05, -sd * (splay || 0)));
      kn.quaternion.copy(qE(_q1, clamp(K, 0, KNEE_MAX), 0, 0)); ank.quaternion.copy(qE(_q1, clamp(ax || 0, -ANK_DF, ANK_PF), 0, 0));
      const toe = sd < 0 ? h.toeL : h.toeR; if (toe) toe.quaternion.copy(qE(_q1, -0.05, 0, 0));
    }
    legsDone = true;
  };
  for (const L of legT) { L.plant = false; L.zr = 0; L.wRel = 0; L.rel = 0; L.clr = 0; L.sw = -1; L.toes = false; }
  // ----- the lower body -----
  let P = null, Pa = null, Pb = null, rk = 0, wGait = 0, crouchK = 0;
  if (STANDING.has(pose) && !o.climb) {
    const turn = Math.abs(o.turn || 0);
    wGait = Math.max(sstep(0.05, 0.55, v), v < 0.3 ? sstep(0.8, 1.8, turn) * 0.8 : 0);
    crouchK = o.crouch ? 1 : 0;
    const vv = Math.max(v, 0.6);
    rk = crouchK ? 0 : runK(vv, mode);
    Pa = rk < 1 ? gaitParams(vv, crouchK ? 'crouch' : 'walk') : null;
    Pb = rk > 0 ? gaitParams(vv, 'run') : null;
    if (v < 0.3 && turn > 0.8 && Pa) { Pa.D = 0.14; Pa.bias = 0; Pa.lift = 0.035; Pb = null; rk = 0; }  // small steps turning on the spot
    P = !Pb ? Pa : !Pa ? Pb : mixParams(Pa, Pb, rk);
    const ph = o.phase || 0;
    const uL = ((ph - Math.PI / 2) / TAU % 1 + 1) % 1, uR = (uL + 0.5) % 1;
    const fL = feet(uL, Pa, Pb, rk, F, _fL), fR = feet(uR, Pa, Pb, rk, F, _fR);
    // pelvis: turns with the leg that swings forward, drops on the swing side, shifts over the standing leg
    const zn = (f) => clamp(f.z / Math.max(0.05, P.D / 2), -1.3, 1.3);
    const mid = (f) => (f.stance >= 0 ? Math.sin(Math.PI * f.stance) : 0);
    hyaw = P.pelvisYaw * (zn(fL) - zn(fR)) * 0.5 * wGait;
    hlist = P.list * (mid(fR) - mid(fL)) * wGait;
    hx = P.sway * (mid(fR) - mid(fL)) * wGait;
    hpitch = P.tilt * wGait;                                // running: the pelvis tips forward a little
    lean = (P.lean - P.tilt) * wGait;
    // standing still: feet under the hips, a slow shift of the weight from one leg to the other, breathing
    const idle = 1 - wGait, shift = noise1(t * 0.13 + mo.seed) * 0.7 + Math.sin(t * 0.37 + mo.seed) * 0.3;
    hx += 0.016 * shift * idle * (1 - crouchK); hlist += -0.03 * shift * idle * (1 - crouchK);
    lean += (0.012 * breath + 0.01) * idle;
    // feet
    for (const sd of [-1, 1]) {
      const f = sd < 0 ? fL : fR, L = legT[sd < 0 ? 0 : 1];
      const wx = lerp(sd * (D.hipX + 0.014 + 0.05 * crouchK), sd * P.width, wGait);
      const sz = -0.025 + 0.05 * crouchK;
      L.a.set(wx, lerp(D.ankleH, f.y, wGait), lerp(sz, f.z, wGait)); L.p = f.p * wGait; L.on = f.stance >= 0 || wGait < 0.5;
      L.plant = L.on; L.zr = lerp(sz, f.zr, wGait); L.wRel = f.wRel * wGait; L.rel = f.rel; L.clr = f.clr * wGait; L.sw = wGait > 0.5 ? f.sw : -1; L.toes = L.on;
      L.kd.set(sd * (0.06 + 0.2 * crouchK), 0, 1).normalize();
    }
    // the height of the pelvis, from where the hip joints really are (the pelvis turns, tips and drops to one side)
    if (crouchK) hz = lerp(-0.1, 0, wGait);
    const qH = qE(_q1, hpitch, hyaw, hlist, 'YXZ');
    const hipJ = (sd, out) => out.set(sd * D.hipX, D.hipDY, 0).applyQuaternion(qH).add(_b.set(hx, 0, hz)); // y: above the pelvis bone
    const reachHy = (sd, L, len) => { hipJ(sd, _c); return reachY(_c, L.a, len) - _c.y; };              // highest pelvis this leg allows
    let hyW = D.hipsY, hyR = D.hipsY;
    const land = [];
    if (rk < 1) {
      // walking / standing: as high as the legs on the ground allow; the knee is nearly straight at heel strike
      // (~5°) and gives ~20° while the foot takes the weight
      for (const sd of [-1, 1]) {
        const L = legT[sd < 0 ? 0 : 1], f = sd < 0 ? fL : fR;
        if (!L.on) {
          // the body comes down onto the leg that is about to land (so the pelvis doesn't drop at heel strike)
          if (f.sw > 0.4 && wGait > 0) { _ls.a.set(L.a.x, f.ly, f.lz); land.push(reachHy(sd, _ls, Lmax * 0.998), sstep(0.4, 1, f.sw) * wGait); }
          continue;
        }
        const load = f.stance >= 0 && f.stance < 0.3 ? Math.sin(Math.PI * f.stance / 0.3) : 0;
        hyW = Math.min(hyW, reachHy(sd, L, Lmax * (0.998 - 0.013 * load * wGait)));
      }
      if (crouchK) { const sneak = D.ankleH + Lmax * 0.74, squat = 0.47; hyW = Math.min(hyW, lerp(squat, sneak, wGait) - D.hipDY); }
      // through the stride the pelvis is lowest just after each heel strike (both feet down) and highest over the
      // standing leg at mid-stance — two rises and falls per stride, as the body vaults over each leg
      if (wGait > 0 && Pa) {
        const dsU = Math.max(0.01, (Pa.beta - 0.5) / 2);
        const hAt = (u0) => { let hh = D.hipsY; for (let k = 0; k < 2; k++) { const u = (u0 + 0.5 * k) % 1, sd = k ? 1 : -1, f = footCycle(u, Pa, F, _fc); if (f.stance < 0) continue; _c.set(sd * D.hipX, 0, 0); _d.set(sd * Pa.width, f.y, f.z); hh = Math.min(hh, reachY(_c, _d, Lmax * 0.998) - D.hipDY); } return hh; };
        // lowest anywhere while both feet are down (heel strike → toe-off of the other foot), highest mid single support
        const ds = 2 * dsU, hS = hAt(0.004), hT = Math.min(hAt(dsU), hAt(ds - 0.004)), hMS = hAt(ds + (0.5 - ds) / 2), uh = uL % 0.5;
        let hc;
        if (uh <= ds) hc = lerp(hS, hT, uh / ds);                                     // both feet down: heel strike → toe-off
        else { const w = (uh - ds) / (0.5 - ds), base = lerp(hT, hS, w); hc = base + (hMS - base) * Math.pow(Math.sin(Math.PI * w), 2); }
        hyW = Math.min(hyW, lerp(D.hipsY, hc, wGait));
      }
      for (let i = 0; i < land.length; i += 2) if (land[i] < hyW) hyW += (land[i] - hyW) * land[i + 1];
    }
    if (rk > 0) {
      // running: the leg works like a spring — lowest mid-stance (knee ~45°), highest in the air
      const sL = fL.stance, sR = fR.stance, st = Math.max(sL, sR);
      const base = D.ankleH + Lmax * 0.95, comp = 0.05 - 0.003 * vv, fly = 0.055 - 0.004 * vv;
      hyR = (st >= 0 ? base - comp * Math.sin(Math.PI * st) : base + fly * Math.sin(Math.PI * clamp(flightS(uL, uR, P.beta), 0, 1))) - D.hipDY;
      for (const sd of [-1, 1]) {
        const L = legT[sd < 0 ? 0 : 1], f = sd < 0 ? fL : fR;
        if (f.stance >= 0) hyR = Math.min(hyR, reachHy(sd, L, Lmax * 0.995));
        else if (f.sw > 0.6 && wGait > 0) { _ls.a.set(L.a.x, f.ly, f.lz); const c = reachHy(sd, _ls, Lmax * 0.995); if (c < hyR) hyR += (c - hyR) * sstep(0.6, 1, f.sw) * wGait; }
      }
      hyR = lerp(D.hipsY - 0.004, hyR, wGait);
    }
    hy = lerp(hyW, hyR, rk);
    if (pose === 'shock') { hy -= 0.07 + 0.02 * Math.sin(t * 60); }
  } else if (SITTING.has(pose)) {
    const seat = o.seatY !== undefined ? o.seatY : seatUnder(h);
    const sy = (seat === null || seat === undefined ? 0.46 : seat) / s - fo;   // seat height above the floor
    // the sitting bones (ischia) are ~9 cm below the hip joints: the pelvis rests on the seat, a little back on it
    hy = sy + 0.088 - D.hipDY; hz = -0.05; hpitch = -0.08;
    lean = pose === 'type' ? 0.2 : pose === 'phone_sit' ? 0.24 : pose === 'tied' ? 0.12 : 0.1;
    lean += 0.008 * breath;
    // thighs rest on the seat: they can't slope below its front edge (~24 cm ahead of the hip joints); the shins go
    // down to the floor, feet flat — and on a seat too high for the legs, the toes point down to reach the floor
    // (someone whose feet still don't reach slides forward on the seat until they do)
    const hjY = hy + D.hipDY, edge = o.seatY !== undefined || h._seatEdge === undefined ? 0.19 : h._seatEdge / s;   // the seat's front edge
    let ay, az, p;
    for (let k = 0; k < 11; k++) {                         // up to perching on the front edge
      if (k && -0.05 + 0.02 * k > edge - 0.07) break;      // the buttocks stay on the seat
      hz = -0.05 + 0.02 * k;
      const slopeMax = Math.max(0, Math.atan2(hjY - 0.086 - sy, edge - hz));
      const slopeFlat = Math.asin(clamp((hjY - (D.ankleH + D.shin * Math.cos(0.12))) / D.thigh, -1, 1));
      const slope = Math.min(slopeFlat, slopeMax + 0.03);
      const kz = hz + D.thigh * Math.cos(slope), ky = hjY - D.thigh * Math.sin(slope);
      ay = ky - D.shin * Math.cos(0.12); az = kz + D.shin * Math.sin(0.12); p = 0;
      if (ay < D.ankleH) { ay = D.ankleH; az = kz + Math.sqrt(Math.max(0, D.shin * D.shin - (ky - ay) ** 2)); }
      else if (ay > D.ankleH + 0.002) { while (p < 0.82 && F.low(ay, p) > 0.002) p += 0.01; }
      if (F.low(ay, p) <= 0.003) break;
    }
    for (const sd of [-1, 1]) {
      const L = legT[sd < 0 ? 0 : 1];
      L.a.set(sd * (D.hipX + 0.035), ay, az); L.p = p; L.on = true; L.plant = p < 0.01; L.zr = az; L.toes = true; L.kd.set(sd * 0.12, 0, 1).normalize();
    }
  } else if (pose === 'floor') {
    // sitting on the floor, knees up: pelvis on the ground and tipped back (~23°), feet flat well in front, the back
    // leaning forward over the knees
    hpitch = -0.4; hy = 0.117 - D.hipDY * Math.cos(0.4); hz = -0.03; lean = 0.62 + 0.01 * breath;
    for (const sd of [-1, 1]) { const L = legT[sd < 0 ? 0 : 1]; L.a.set(sd * (D.hipX + 0.05), D.ankleH, 0.6); L.p = 0; L.on = true; L.plant = true; L.zr = 0.6; L.kd.set(sd * 0.25, 0.5, 1).normalize(); }
  } else if (pose === 'kneel') {
    // tall kneeling: knees on the floor under the hips, thighs upright, shins back along the floor, toes tucked under
    const kneeY = 0.07, p = 1.55, ay = F.Y(p);
    hy = kneeY + D.thigh - D.hipDY; hz = 0.02; lean = 0.05;
    const dz = Math.sqrt(Math.max(0.01, D.shin * D.shin - (ay - kneeY) ** 2));
    for (const sd of [-1, 1]) { const L = legT[sd < 0 ? 0 : 1]; L.a.set(sd * (D.hipX + 0.01), ay, hz - dz - 0.004); L.p = p; L.on = true; L.toes = true; L.kd.set(sd * 0.05, 0, 1).normalize(); }
  } else if (pose === 'lie') {
    // on the back: pelvis and shoulder blades on the floor, legs out with the heels resting on it, feet relaxed
    hy = h.cfg && h.cfg.female ? 0.143 : 0.125; hpitch = -Math.PI / 2; lean = 0;   // the pelvis rests on the buttocks (fuller on women)
    legsFK(0.0, 0.04, 0.3, 0.07);
  } else if (pose === 'climb' || o.climb) {
    const ph = o.phase || 0;
    legsFK([-0.75 + Math.sin(ph) * 0.5, -0.75 - Math.sin(ph) * 0.5], 1.05, -0.35, 0.05);
  } else {
    legsFK(0, 0.05, 0, 0);
  }
  if (fo) { hy += fo; for (const L of legT) L.a.y += fo; }
  // ----- the upper body by pose -----
  let arms = null; // [{ fk: [x, z, e, tw] } | { ik: target(root), pole, tw }, ...] left, right
  const fk = (x, z, e, tw) => ({ fk: [x, z, e, tw || 0] });
  const idleArm = () => fk(-0.03 - 0.02 * breath, 0.09, -0.16, 0);
  if (pose === 'stand' && wGait > 0.01 && P) {
    // arms swing opposite to the legs: the left arm goes forward as the right leg does
    const ph = o.phase || 0, uL = ((ph - Math.PI / 2) / TAU % 1 + 1) % 1, uR = (uL + 0.5) % 1;
    const fz = (u) => { const f = feet(u, Pa, Pb, rk, F, _fc); return clamp(f.z / Math.max(0.05, P.D / 2), -1.2, 1.2); };
    const nL = fz(uL), nR = fz(uR);
    const sw = (n) => {
      const a = P.armFwd + P.arm * n * 0.85;                        // + backward
      const e = -(P.elbow + lerp(0.35 * Math.max(0, -n) * (crouchK ? 0 : 1), 0.25 * -n, rk));
      return fk(lerp(-0.03, a, wGait), lerp(0.09, 0.07 + 0.05 * rk, wGait), lerp(-0.16, e, wGait), 0);
    };
    arms = [sw(nL), sw(nR)];
    // shoulders turn against the pelvis, the head keeps looking ahead
    twist = -1.25 * hyaw;
    if (crouchK) arms = arms.map((a) => fk(lerp(-0.45, a.fk[0] - 0.5, 0.5), 0.12, -1.0, 0));
  } else if (pose === 'stand' && crouchK) {
    // crouched still: forearms resting across the knees
    arms = [{ ik: 'crouch', sd: -1 }, { ik: 'crouch', sd: 1 }];
    lean = 0.62 + 0.01 * breath; headX = -0.08;   // eyes level, looking ahead
  } else if (pose === 'talk') {
    arms = [idleArm(), fk(-0.35 + Math.sin(t * 2.6) * 0.18, 0.12, -0.85 + Math.sin(t * 3.1) * 0.12, -0.3)];
    headX = 0.04 + Math.sin(t * 2.2) * 0.04;
  } else if (pose === 'smoke') {
    // brings the cigarette to the mouth for a couple of seconds, then holds it low
    const cyc = (t + mo.seed) % 7, up = sstep(0.2, 1.0, cyc) * (1 - sstep(2.8, 3.6, cyc));
    arms = [idleArm(), { ik: null, up }];
    headX = -0.05 * up;
  } else if (pose === 'point') {
    arms = [idleArm(), fk(-1.5, 0.06, -0.06, 0)];
  } else if (pose === 'raise') {
    arms = [fk(-0.3, 0.1, -0.5, 0), fk(-2.75, 0.12, -0.3, 0)]; elevR = 0.035; lean = -0.04;
  } else if (pose === 'strike') {
    const k = Math.sin(t * 14);
    arms = [fk(0.1, 0.12, -0.3, 0), fk(-0.95 - 0.65 * k, 0.1, -0.35 - 0.25 * k, 0)]; twist = -0.15 * k; lean = 0.12; elevR = 0.02 * Math.max(0, -k);
  } else if (pose === 'hug') {
    arms = [fk(-1.25, -0.42, -0.95, 0), fk(-1.25, -0.42, -0.95, 0)]; lean = 0.08;
  } else if (pose === 'hands_up') {
    arms = [fk(-2.95, 0.16, -0.25, 0), fk(-2.95, 0.16, -0.25, 0)]; elevL = elevR = 0.04; headX = -0.08;
  } else if (pose === 'phone' || pose === 'phone_sit') {
    arms = [{ ik: 'phone', sd: -1 }, { ik: 'phone', sd: 1 }]; headX = 0.42;
  } else if (pose === 'drink') {
    arms = [idleArm(), { ik: null, up: 1, drink: true }]; headX = -0.32;
  } else if (pose === 'shock') {
    const j = Math.sin(t * 60), j2 = Math.sin(t * 47 + 1);
    arms = [fk(-0.4 + 0.35 * j, 0.25, -1.2 + 0.3 * j2, 0), fk(-0.4 - 0.35 * j, 0.25, -1.2 - 0.3 * j2, 0)];
    lean = 0.22 + 0.1 * j; headX = 0.3 + 0.25 * j; headY = 0.15 * j2; elevL = elevR = 0.03;
  } else if (pose === 'type') {
    arms = [{ ik: 'type', sd: -1 }, { ik: 'type', sd: 1 }]; headX = -0.08;
  } else if (pose === 'tied') {
    arms = [fk(0.62, -0.22, -0.55, 0), fk(0.62, -0.22, -0.55, 0)]; headX = 0.62 + Math.sin(t * 0.7) * 0.05;
  } else if (pose === 'sit') {
    arms = [{ ik: 'knee', sd: -1 }, { ik: 'knee', sd: 1 }];
  } else if (pose === 'floor') {
    // forearms over the knees, hands loosely in front of the shins
    arms = [{ ik: V(-0.045, 0.27 + fo, 0.57), pole: V(-0.9, 0.1, -0.3), tw: 0 }, { ik: V(0.045, 0.27 + fo, 0.57), pole: V(0.9, 0.1, -0.3), tw: 0 }];
    headX = 0.3 + Math.sin(t * 0.9 + mo.seed) * 0.04;
  } else if (pose === 'kneel') {
    arms = [{ ik: V(-0.15, 0.62 + fo, 0.14), pole: V(-0.7, -0.2, -0.5), tw: 0 }, { ik: V(0.15, 0.62 + fo, 0.14), pole: V(0.7, -0.2, -0.5), tw: 0 }];
    headX = 0.42;
  } else if (pose === 'lie') {
    arms = [fk(0.1, 0.22, -0.15, 0), fk(0.1, 0.22, -0.15, 0)]; headX = -0.12; headY = 0.5;
  } else if (pose === 'climb' || o.climb) {
    const ph = o.phase || 0;
    arms = [fk(-2.7 + Math.sin(ph) * 0.35, 0.08, -0.3, 0), fk(-2.7 - Math.sin(ph) * 0.35, 0.08, -0.3, 0)]; elevL = elevR = 0.03;
  } else arms = [idleArm(), idleArm()];
  if (o.studio) arms = [fk(0.02, 0.33, -0.18, 0), fk(0.02, 0.33, -0.18, 0)];
  if (o.torch && pose === 'stand') arms[0] = fk(-1.1 + Math.sin(o.phase || 0) * 0.04 * wGait, 0.08, -0.24, 0); // flashlight held out, aimed ~13° down
  // a glance now and then when standing about (not when walking or talking)
  if (pose === 'stand' && !o.studio && wGait < 0.3 && !crouchK) {
    headY += 0.28 * noise1(t * 0.21 + mo.seed * 3) * (1 - wGait); headX += 0.06 * noise1(t * 0.17 + mo.seed);
  }
  // ----- put the body together -----
  qE(ST.qHips, hpitch, hyaw, hlist, 'YXZ');
  ST.hipsPos.set(hx, hy, hz);
  h.hips.position.copy(ST.hipsPos); h.hips.quaternion.copy(ST.qHips);
  qE(ST.qSpine, lean, twist, -hlist * 0.75 + sideTilt, 'XYZ');
  h.spine.quaternion.copy(ST.qSpine);
  // the head stays level and looks ahead whatever the pelvis and spine do (plus what the pose asks)
  const levelX = -(lean + hpitch) * (pose === 'lie' ? 0 : 0.85);
  qE(ST.qHead, clamp(headX + levelX, -0.95, 0.85), clamp(headY - (hyaw + twist), -1.25, 1.25), headZ, 'YXZ');
  h.head.quaternion.copy(ST.qHead);
  // shoulders: a little rise with each breath, more when the arm goes overhead
  const shY = D.shY + 0.0025 * (breath + 1);
  h.armL.position.set(-D.shX, shY + elevL, 0); h.armR.position.set(D.shX, shY + elevR, 0);
  // legs
  if (!legsDone) {
    for (const sd of [-1, 1]) {
      const L = legT[sd < 0 ? 0 : 1], hj = _hj[sd < 0 ? 0 : 1];
      hj.set(sd * D.hipX, D.hipDY, 0).applyQuaternion(ST.qHips).add(ST.hipsPos);
      const yawF = -sd * (0.1 + 0.15 * crouchK);                           // feet turned out ~6° (~15° crouched, under the knees)
      qE(_qf, L.p, yawF, 0, 'YXZ');
      if (L.sw >= 0) {
        // a swinging leg isn't dragged out straight: when the foot would be out of reach the knee bends and the heel
        // comes up instead
        const Rr = Lmax * 0.975, dx = L.a.x - hj.x, dz = L.a.z - hj.z, dxz = dx * dx + dz * dz, dy = hj.y - L.a.y;
        if (dxz + dy * dy > Rr * Rr) {
          if (dxz < Rr * Rr * 0.98) L.a.y = hj.y - Math.sqrt(Rr * Rr - dxz);
          else { const k = Rr * 0.99 / Math.sqrt(dxz); L.a.x = hj.x + dx * k; L.a.z = hj.z + dz * k; L.a.y = hj.y - Rr * 0.14; }
        }
      }
      let over = legIK(h, sd, ST.qHips, hj, L.a, _qf, L.kd);
      if (L.wRel > 0.001) {
        for (let it = 0; it < 2; it++) {
          L.p = lerp(L.p, neutralPitch() + L.rel, L.wRel); qE(_qf, L.p, yawF, 0, 'YXZ'); legIK(h, sd, ST.qHips, hj, L.a, _qf, L.kd);
          const pa = actualPitch(h, sd), relax = sstep(0.05, 0.4, Math.max(0, L.sw));            // toes straighten after push-off
          const low = lerp(F.low(L.a.y, pa), F.lowFree(L.a.y, pa), relax);
          if (low >= L.clr - 0.001) break;
          L.a.y += L.clr - low; legIK(h, sd, ST.qHips, hj, L.a, _qf, L.kd);
        }
      }
      // a planted foot whose ankle can't bend any further up (deep knee bend, long step): the heel comes up and the
      // foot rolls forward on the same spot of the ground instead
      for (let it = 0; it < 5 && L.plant && L.p > -0.02; it++) {
        const pa = actualPitch(h, sd);
        if (pa - L.p < 0.008 && over > -0.004) break;
        const p2 = Math.min(Math.max(pa, L.p - over) + 0.015, 1.25);
        F.ankle(L.zr, p2, _an); L.a.y = _an.y; L.a.z = _an.z; L.p = p2;
        qE(_qf, L.p, yawF, 0, 'YXZ'); over = legIK(h, sd, ST.qHips, hj, L.a, _qf, L.kd);
      }
      const toe = sd < 0 ? h.toeL : h.toeR;
      if (toe) {
        const bend = clamp(actualPitch(h, sd), 0, TOE_MAX) * (L.toes ? 1 : L.sw >= 0 ? 1 - sstep(0.05, 0.4, L.sw) : 0);
        toe.quaternion.copy(qE(_q1, -bend, 0, 0));
      }
    }
  }
  // arms
  _qp.copy(ST.qHips).multiply(ST.qSpine);
  for (const sd of [-1, 1]) {
    const A = arms[sd < 0 ? 0 : 1];
    if (A.fk) { armFK(h, sd, A.fk[0], A.fk[1], A.fk[2], A.fk[3]); continue; }
    // shoulder in the root frame
    _sh.set(sd * D.shX, shY + (sd < 0 ? elevL : elevR), 0).applyQuaternion(_qp).add(ST.hipsPos);
    let tw = A.tw || 0;
    if (A.ik === 'type') { _w.set(sd * 0.135 + Math.sin(t * 17 + sd) * 0.006, _sh.y - 0.29 + Math.sin(t * 19 + sd * 2) * 0.008, _sh.z + 0.37); _pole.set(sd * 0.7, -0.6, -0.4); tw = sd * 1.1; }
    else if (A.ik === 'phone') { _w.set(sd * 0.05, _sh.y - 0.3, _sh.z + 0.27); _pole.set(sd * 0.8, -0.6, -0.2); tw = sd * 0.7; }
    else if (A.ik === 'knee') { _w.set(sd * (D.hipX + 0.03), hy + D.hipDY + 0.125, hz + 0.33); _pole.set(sd * 0.7, -0.3, -0.6); }
    else if (A.ik === 'crouch') { _w.set(sd * 0.11, hy + D.hipDY + 0.14, hz + 0.47); _pole.set(sd * 0.7, -0.5, -0.4); tw = sd * 0.4; } // wrists just past the knees
    else if (A.ik === null) {
      // hand to the mouth (smoking, drinking): the mouth is ~9 cm above and ~10 cm in front of the head joint
      _a.set(0, 0.075, 0.11).applyQuaternion(_q1.copy(_qp).multiply(ST.qHead));
      _b.set(0, D.headY, 0).applyQuaternion(_qp).add(ST.hipsPos).add(_a);
      const up = A.up;
      _c.set(sd * 0.21, _sh.y - 0.42, _sh.z + 0.16);                        // the hand held low, elbow bent
      _w.copy(_c).lerp(_d.set(_b.x + sd * 0.035, _b.y - 0.085, _b.z + 0.075), up); _w.z += 0.07 * Math.sin(Math.PI * up);
      _pole.set(sd * 0.9, A.drink ? 0.1 : -0.5, -0.3); tw = sd * 0.3;
    } else { _w.copy(A.ik); _pole.copy(A.pole); }
    armIK(h, sd, _qp, _sh, _w, _pole.normalize(), tw);
  }
  micro(h, o, mo, t, pose);
};
const _q3 = new T.Quaternion(), _f3 = V();
function neutralPitch() { _q3.copy(_leg.q).multiply(_q2); _f3.set(0, 0, 1).applyQuaternion(_q3); return Math.atan2(-_f3.y, Math.hypot(_f3.x, _f3.z)); }
function actualPitch(h, sd) { _q3.copy(_leg.q).multiply(_q2).multiply((sd < 0 ? h.ankL : h.ankR).quaternion); _f3.set(0, 0, 1).applyQuaternion(_q3); return Math.atan2(-_f3.y, Math.hypot(_f3.x, _f3.z)); }
function flightS(uL, uR, beta) { // progress through the airborne part between two running steps
  const u = Math.min(((uL - beta) % 1 + 1) % 1, ((uR - beta) % 1 + 1) % 1), gap = 0.5 - beta;
  return gap > 0 ? u / gap : 0;
}
// the highest the hip joint can be with the ankle at `a` and the leg at most `L` long
function reachY(hj, a, L) { const dx = hj.x - a.x, dz = hj.z - a.z; return a.y + Math.sqrt(Math.max(1e-4, L * L - dx * dx - dz * dz)); }

// ---------------- blinking, talking ----------------
function micro(h, o, mo, t, pose) {
  const u = h.body && h.body.material && h.body.material.userData.chU;
  if (!u || !u.chBlink) return;
  if (t < mo.lastT - 1 || t > mo.lastT + 30) { mo.blinkAt = t + 1 + Math.random() * 3; mo.blinkT = -1; }
  mo.lastT = t;
  let blink = 0;
  if (pose === 'lie') blink = 1;                                         // knocked out: eyes shut
  else {
    if (mo.blinkT < 0 && t >= mo.blinkAt) { mo.blinkT = t; mo.blinkAt = t + 1.8 + Math.random() * 4.4; } // every ~4 s (≈15 a minute)
    if (mo.blinkT >= 0) { const k = (t - mo.blinkT) / 0.16; blink = k < 0.4 ? k / 0.4 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; if (k >= 1) { mo.blinkT = -1; blink = 0; } }
    if (pose === 'shock') blink = Math.max(blink, 0.55 + 0.45 * Math.sin(t * 40));
    if (pose === 'tied' || pose === 'floor') blink = Math.max(blink, 0.35);   // tired, eyes half shut
  }
  u.chBlink.value = clamp(blink, 0, 1);
  let talk = 0;
  if (pose === 'talk' || o.talk) {
    const phrase = sstep(-0.3, 0.2, Math.sin(t * 1.25 + mo.seed)), syl = 0.5 + 0.5 * Math.sin(t * 11.5 + Math.sin(t * 3.7) * 2);
    talk = phrase * (0.2 + 0.8 * syl);
  }
  u.chTalk.value = talk;
}
G.motionTest = { footOf, footRoll, gaitParams, stepFor, runK };
})(window.G);
