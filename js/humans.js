// humans.js — people and dogs that look like people and dogs.
// One skinned mesh per character, sculpted in code (no model files): a body lofted from anatomical cross-sections,
// a head whose face is driven by sliders (face width, jaw, chin, cheekbones, eye size / spacing / tilt / lids, nose
// width / length / bridge / tip, mouth width and lips, brows, ears), real eyes and lids, hands with fingers, and
// clothes cut as garments — T-shirt, long sleeves, tank top, polo, shirt, track jacket, hoodie; trousers, jeans,
// joggers, cargo pants, shorts, skirt — with their folds in the geometry. Hair grows as locks over the scalp and
// shoes are built on real soles (wardrobe.js). Every region is coloured and detailed in the shader: skin with pores
// and warmth, brows / lips / lashes / beards painted on the face, fabric weave, ribbing, zips, stripes, buttons,
// denim, canvas, rubber soles, hair lit along its strands. The skeleton is the same set of nodes the old block
// figures used (hips, spine, head, arms, elbows, legs, knees), so every pose and animation drives the bodies
// unchanged — and a body can be re-cut in place (G.restyle) when the player changes their look.
(function (G) {
'use strict';
const T = G.T, C = G.C;
const HIPS = 0, SPINE = 1, HEAD = 2, ARM_L = 3, EL_L = 4, ARM_R = 5, EL_R = 6, LEG_L = 7, KN_L = 8, LEG_R = 9, KN_R = 10, ANK_L = 11, ANK_R = 12, TOE_L = 13, TOE_R = 14;
// the toe joints (metatarsophalangeal) sit over the ball of the foot, ~3 cm above the bottom of the shoe
const MTP_H = 0.03;
// regions (aReg), grouped so the shader can branch by range
const R = { skin: 0, face: 1, ear: 2, top: 3, inner: 4, trim: 5, bottom: 6, shoe: 7, sole: 8, lace: 9, hair: 10, eye: 11, extra: 12, cap: 13, frame: 14, lens: 15, metal: 16 };
// garment parts (aGar.z); each cut carries its own coordinates in aGar.xy (u around, v along) and a stripe distance in .w
const PT = { top: 1, sleeve: 2, rib: 3, collar: 4, hood: 5, leg: 10, waist: 11, cuff: 12, skirt: 13, pocket: 14, lock: 20, shell: 21, upper: 30, sole: 31, rim: 32, lace: 34, heel: 35 };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const angd = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const hsh = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hsh(ix, iy), hsh(ix + 1, iy), ux), lerp(hsh(ix, iy + 1), hsh(ix + 1, iy + 1), ux), uy);
}
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; }; }
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]), norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

// ---------------- geometry builder ----------------
function Builder() { this.p = []; this.r = []; this.si = []; this.sw = []; this.ix = []; this.g = []; }
Builder.prototype.v = function (x, y, z, reg, w, g) {
  this.p.push(x, y, z); this.r.push(reg);
  const a = w[0], b = w[1] || [a[0], 0], c = w[2] || [a[0], 0];   // up to three bones per vertex (skirts hang from both thighs)
  this.si.push(a[0], b[0], c[0], 0); this.sw.push(a[1], b[1], c[1], 0);
  if (g) this.g.push(g[0], g[1], g[2], g[3]); else this.g.push(0, 0, 0, 9);
  return this.p.length / 3 - 1;
};
Builder.prototype.tri = function (a, b, c) { this.ix.push(a, b, c); };
// loft: rings = [{ c, ax, ay, rx, ry, pw, reg, w, part, v, sa, gw, fold }] joined in order, optional end caps.
//  reg / w may be functions of the angle around; fold(th, u) adds to the radius (wrinkles); part / v / sa / gw feed
//  the garment coordinates; opt.open = [a0, a1] makes an open band instead of a closed tube.
Builder.prototype.loft = function (rings, segs, capA, capB, opt) {
  const open = opt && opt.open, n = open ? segs + 1 : segs, s0 = this.p.length / 3;
  for (const r of rings) for (let k = 0; k < n; k++) {
    const u = k / segs, th = open ? open[0] + (open[1] - open[0]) * u : u * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th), e = 2 / (r.pw || 2);
    const cx = Math.sign(c) * Math.pow(Math.abs(c), e), sy = Math.sign(s) * Math.pow(Math.abs(s), e);
    const f = r.fold ? r.fold(th, u) : 0, rx = r.rx + f, ry = r.ry + f;
    const reg = typeof r.reg === 'function' ? r.reg(th, c, s, u) : r.reg;
    const w = typeof r.w === 'function' ? r.w(th, c, s) : r.w;
    let g = null;
    if (r.part) {
      const sw = r.gw !== undefined ? r.gw : r.sa === 'sides' ? Math.min(Math.abs(angd(th, 0)), Math.abs(angd(th, Math.PI))) : r.sa !== undefined ? angd(th, r.sa) : 9;
      g = [u, r.v || 0, r.part, sw];
    }
    this.v(r.c[0] + r.ax[0] * cx * rx + r.ay[0] * sy * ry, r.c[1] + r.ax[1] * cx * rx + r.ay[1] * sy * ry, r.c[2] + r.ax[2] * cx * rx + r.ay[2] * sy * ry, reg, w, g);
  }
  if (rings.length < 2) return;
  // winding test on the first quad against the ring centre, so normals point out
  const P = this.p, a0 = s0, b0 = s0 + 1, c0 = s0 + n;
  const ux = P[b0 * 3] - P[a0 * 3], uy = P[b0 * 3 + 1] - P[a0 * 3 + 1], uz = P[b0 * 3 + 2] - P[a0 * 3 + 2];
  const vx = P[c0 * 3] - P[a0 * 3], vy = P[c0 * 3 + 1] - P[a0 * 3 + 1], vz = P[c0 * 3 + 2] - P[a0 * 3 + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const r0 = rings[0], ox = P[a0 * 3] - r0.c[0], oy = P[a0 * 3 + 1] - r0.c[1], oz = P[a0 * 3 + 2] - r0.c[2];
  let flip = nx * ox + ny * oy + nz * oz < 0;
  if (opt && opt.flip) flip = !flip;
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < segs; k++) {
    const a = s0 + i * n + k, b = s0 + i * n + (open ? k + 1 : (k + 1) % segs), c = a + n, d = b + n;
    if (!flip) { this.tri(a, b, c); this.tri(b, d, c); } else { this.tri(a, c, b); this.tri(b, c, d); }
  }
  if (open) return;
  const cap = (ri, ext, rev) => {
    const r = rings[ri], last = s0 + ri * n;
    const reg = typeof r.reg === 'function' ? r.reg(0, 1, 0, 0) : r.reg, w = typeof r.w === 'function' ? r.w(0, 1, 0) : r.w;
    const pole = this.v(r.c[0] + ext[0], r.c[1] + ext[1], r.c[2] + ext[2], reg, w, r.part ? [0, r.v || 0, r.part, r.gw !== undefined ? r.gw : 9] : null);
    for (let k = 0; k < segs; k++) { const a = last + k, b = last + (k + 1) % segs; if ((!flip) !== rev) this.tri(a, pole, b); else this.tri(a, b, pole); }
  };
  if (capA) cap(0, capA, false);
  if (capB) cap(rings.length - 1, capB, true);
};
// a deformed sphere (lat-long grid); fn(dx,dy,dz) -> [x,y,z] for a unit direction; reg / w / g may be functions
Builder.prototype.sphere = function (nu, nv, fn, reg, w, frontDense, gfn) {
  const s0 = this.p.length / 3;
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, ph = Math.PI / 2 - Math.PI * v;
    for (let k = 0; k < nu; k++) {
      let t = 2 * k / nu - 1; if (frontDense) t = Math.sign(t) * Math.pow(Math.abs(t), frontDense);
      const th = Math.PI * t, cp = Math.cos(ph);
      const d = [Math.sin(th) * cp, Math.sin(ph), Math.cos(th) * cp];
      const p = fn(d[0], d[1], d[2]);
      this.v(p[0], p[1], p[2], typeof reg === 'function' ? reg(d, p) : reg, typeof w === 'function' ? w(d, p) : w, gfn ? gfn(d, p) : null);
    }
  }
  for (let j = 0; j < nv; j++) for (let k = 0; k < nu; k++) {
    const a = s0 + j * nu + k, b = s0 + j * nu + (k + 1) % nu, c = a + nu, d = b + nu;
    this.tri(a, c, b); this.tri(b, c, d);
  }
};
// a tube along a path (laces, cords, locks of hair): rad(i, n) -> [half-width, half-thickness]; frames by parallel
// transport, or opt.normal(i, p, t) gives the way the thickness faces (away from the head for a lock of hair)
Builder.prototype.tube = function (pts, rad, segs, reg, w, opt) {
  opt = opt || {};
  const n = pts.length, rings = [];
  let N = opt.up || [0, 1, 0];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const t = v3.norm(v3.sub(b, a));
    let Ni = opt.normal ? opt.normal(i, pts[i], t) : N;
    Ni = v3.sub(Ni, v3.mul(t, v3.dot(Ni, t)));
    if (v3.len(Ni) < 1e-6) Ni = Math.abs(t[1]) < 0.9 ? v3.cross(t, [0, 1, 0]) : v3.cross(t, [1, 0, 0]);
    Ni = v3.norm(Ni);
    const Bn = v3.cross(t, Ni), rr = rad(i, n);
    rings.push({ c: pts[i], ax: Bn, ay: Ni, rx: rr[0], ry: rr[1], pw: opt.pw || 2, reg: typeof reg === 'function' ? reg(i) : reg, w: typeof w === 'function' ? w(i, pts[i]) : w,
      part: opt.part, v: i / Math.max(1, n - 1), gw: opt.gw, sa: opt.sa });
    N = Ni;
  }
  const t0 = v3.norm(v3.sub(pts[0], pts[1])), t1 = v3.norm(v3.sub(pts[n - 1], pts[n - 2]));
  this.loft(rings, segs, opt.capA ? v3.mul(t0, opt.capA) : null, opt.capB ? v3.mul(t1, opt.capB) : null);
};
Builder.prototype.geometry = function () {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
  g.setAttribute('aReg', new T.Float32BufferAttribute(this.r, 1));
  g.setAttribute('aGar', new T.Float32BufferAttribute(this.g, 4));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(this.si, 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(this.sw, 4));
  g.setIndex(this.ix);
  g.computeVertexNormals();
  g.computeBoundingSphere(); g.boundingSphere.radius += 0.3;
  return g;
};
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const W1 = (b) => [[b, 1]];
const W2 = (a, b, t) => (t <= 0 ? [[a, 1]] : t >= 1 ? [[b, 1]] : [[a, 1 - t], [b, t]]);
// piecewise-linear lookup in a table of rows sorted by their first column (descending)
function rowAt(rows, key) {
  if (key >= rows[0][0]) return rows[0].slice(1);
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    if (key <= a[0] && key >= b[0]) { const t = (a[0] - key) / ((a[0] - b[0]) || 1); return a.slice(1).map((v, j) => lerp(v, b[j + 1], t)); }
  }
  return rows[rows.length - 1].slice(1);
}
// keys from a down to b, roughly every `step` (when step > 0), always including the given keys
function samples(a, b, step, keys) {
  const out = new Set();
  if (step > 0) { const n = Math.max(1, Math.round((a - b) / step)); for (let i = 0; i <= n; i++) out.add(+(a + (b - a) * i / n).toFixed(4)); }
  for (const k of keys) if (k <= a + 1e-6 && k >= b - 1e-6) out.add(+k.toFixed(4));
  return [...out].sort((x, y) => y - x);
}

// ---------------- what people wear: the cut of each garment ----------------
// top: sleeve kind, hem height (bind space, m), ease (how far the cloth stands off the body), neckline
const TOPS = {
  tee:     { id: 0, sleeve: 'short', hem: 0.965, pad: 0.008, neck: 'crew' },
  longtee: { id: 1, sleeve: 'long', hem: 0.965, pad: 0.008, neck: 'crew' },
  tank:    { id: 2, sleeve: 'none', hem: 0.965, pad: 0.007, neck: 'scoop' },
  polo:    { id: 3, sleeve: 'short', hem: 0.955, pad: 0.01, neck: 'polo' },
  shirt:   { id: 4, sleeve: 'cuff', hem: 0.935, pad: 0.012, neck: 'shirt' },
  track:   { id: 5, sleeve: 'loose', hem: 0.875, pad: 0.03, neck: 'stand', loose: 1 },
  hoodie:  { id: 6, sleeve: 'loose', hem: 0.865, pad: 0.034, neck: 'hood', loose: 1.15 },
};
// bottom: ease at the thigh / lower leg, hem height (bind, m: at the shoe top for trousers), cuffs, folds
const BOTS = {
  trousers: { id: 0, pad: [0.013, 0.02], hem: 0.095 },
  jeans:    { id: 1, pad: [0.008, 0.012], hem: 0.08 },
  track:    { id: 2, pad: [0.03, 0.036], hem: 0.125, cuff: true, folds: 1 },
  cargo:    { id: 3, pad: [0.024, 0.03], hem: 0.09, folds: 0.6 },
  shorts:   { id: 4, pad: [0.022, 0.022], hem: 0.555 },
  skirt:    { id: 5, skirt: true },
};
const SHOES = { sneaker: 0, slipon: 1, boot: 2, dress: 3 };
const PATTERNS = { solid: 0, stripes: 1, checks: 2 };
const BROWS = {
  normal:   { arch: 0.0065, slope: -0.004, tin: 0.0042, tout: 0.0018, len: 0.042 },
  thin:     { arch: 0.006, slope: -0.003, tin: 0.0026, tout: 0.0012, len: 0.04 },
  thick:    { arch: 0.0055, slope: -0.004, tin: 0.0058, tout: 0.0028, len: 0.044 },
  straight: { arch: 0.0016, slope: -0.0015, tin: 0.0045, tout: 0.0024, len: 0.043 },
  arched:   { arch: 0.0095, slope: -0.006, tin: 0.0038, tout: 0.0015, len: 0.042 },
  angled:   { arch: 0.0035, slope: 0.003, tin: 0.0045, tout: 0.002, len: 0.043 },
};
const FACIAL = { none: [0, 0, 0, 0], stubble: [0.6, 0, 0, 0], mustache: [0.25, 1, 0, 0], goatee: [0.25, 1, 1, 0], beard: [0.4, 1, 1, 0.72], full: [0.3, 1, 1, 1] };

// ---------------- face ----------------
// face sliders (0…1, 0.5 = average) → the numbers the head is sculpted with and the shader paints with
const FACE_KEYS = ['width', 'jaw', 'chin', 'cheek', 'ear', 'eyeSize', 'eyeGap', 'eyeTilt', 'lid', 'noseW', 'noseL', 'bridge', 'tip', 'mouthW', 'lips', 'browH', 'browThick', 'browArch', 'browTilt'];
function faceOf(cfg) {
  const F = cfg.face || {}, g = (k) => (F[k] === undefined ? 0.5 : F[k]), f = cfg.female;
  const es = lerp(0.86, 1.16, g('eyeSize'));
  return {
    w: lerp(0.93, 1.07, g('width')), jaw: (f ? 0.3 : 0.24) + (0.5 - g('jaw')) * 0.26, chin: lerp(0.3, 1.7, g('chin')), cheek: lerp(0.1, 2.0, g('cheek')),
    eye: { x: 0.0315 + (g('eyeGap') - 0.5) * 0.008, y: 0.0115, z: 0.0605, r: 0.0118 * es, hw: 0.0145 * es, up: 0.0058 * es * lerp(0.72, 1.25, g('lid')), lo: 0.0046 * es * lerp(0.82, 1.15, g('lid')), tilt: 0.0011 + (g('eyeTilt') - 0.5) * 0.0075 },
    noseW: lerp(0.8, 1.3, g('noseW')), noseL: (g('noseL') - 0.5) * 0.012, bridge: lerp(0.55, 1.45, g('bridge')), tip: lerp(0.5, 1.6, g('tip')),
    mouthW: lerp(0.84, 1.2, g('mouthW')), lips: lerp(0.55, 1.6, g('lips')) * (f ? 1.25 : 1),
    browY: 0.0335 + (g('browH') - 0.5) * 0.009, ear: lerp(0.85, 1.2, g('ear')),
    browThick: lerp(0.6, 1.5, g('browThick')), browArch: lerp(0.35, 1.65, g('browArch')), browTilt: (g('browTilt') - 0.5) * 0.008,
  };
}
const HK = (cfg) => (cfg.female ? 0.99 : 1.06);
function headCentre(cfg) { return cfg.female ? [0, 1.748, 0.004] : [0, 1.756, 0.006]; }
const lidUp = (E, u) => E.y + E.up * Math.pow(Math.max(0, 1 - u * u), 0.85) + E.tilt * u;
const lidLo = (E, u) => E.y - E.lo * Math.pow(Math.max(0, 1 - u * u), 0.85) + E.tilt * u;
const ballZ = (E, ex, ey) => { const r2 = E.r * E.r - ex * ex - ey * ey; return r2 > 0 ? E.z + Math.sqrt(r2) : null; };
function sculpt(cfg) {
  const f = cfg.female, HC = headCentre(cfg), k = HK(cfg), F = faceOf(cfg), E = F.eye;
  const ex = (x, y, cx, cy, sx, sy) => Math.exp(-((x - cx) * (x - cx)) / (2 * sx * sx) - ((y - cy) * (y - cy)) / (2 * sy * sy));
  const nt = f ? 0.8 : 1, tipY = -0.043 - F.noseL, nw = F.noseW, L = F.lips, mw = F.mouthW;
  return function (dx, dy, dz) {
    let x = dx * 0.0775 * F.w, y = dy * (dy > 0 ? 0.112 : 0.111), z = dz * (dz > 0 ? 0.094 : 0.104);
    // the jaw narrows toward the chin; the face is flatter than an egg
    const jaw = sstep(-0.02, -0.108, y) * sstep(-0.04, 0.05, z);
    x *= 1 - F.jaw * jaw;
    if (z > 0.052) z = 0.052 + (z - 0.052) * 0.74;
    const front = sstep(0.025, 0.07, z), ax = Math.abs(x);
    let d = 0;
    // nose: ramps out from the bridge between the eyes to the tip, then drops to the lip
    if (y < 0.024 && y > tipY - 0.02) {
      const t = sstep(0.022, tipY + 0.003, y), drop = sstep(tipY, tipY - 0.012, y);
      const h = (0.003 + 0.0145 * Math.pow(t, 1.35) * F.bridge) * (1 - drop) * nt, wd = (0.0048 + 0.0044 * t) * nw;
      d += h * Math.exp(-(x * x) / (2 * wd * wd));
    }
    d += 0.0047 * nt * F.tip * ex(x, y, 0, tipY, 0.0076 * nw, 0.0066);            // tip
    d += 0.0045 * ex(ax, y, 0.0145 * nw, tipY - 0.004, 0.0055, 0.0055);           // wings
    d += (f ? 0.003 : 0.0055) * ex(ax, y, 0.032, F.browY - 0.0025, 0.02, 0.0065); // brow ridge
    d -= 0.0055 * ex(ax, y, E.x, E.y, 0.018, 0.012);                              // socket
    d += 0.004 * F.cheek * ex(ax, y, 0.046, -0.015, 0.016, 0.018);                // cheekbones
    d += 0.0048 * L * ex(x, y, 0, -0.064, 0.0178 * mw, 0.0047);                   // upper lip
    d += 0.006 * L * ex(x, y, 0, -0.0785, 0.0155 * mw, 0.0058);                   // lower lip
    const nlx = 0.0205 * nw + (-0.05 - y) * 0.42;                                  // the folds from the nose to the mouth
    d -= 0.0016 * Math.exp(-((ax - nlx) * (ax - nlx)) / (2 * 0.0026 * 0.0026)) * sstep(-0.044, -0.054, y) * sstep(-0.088, -0.074, y);
    d -= 0.0026 * ex(x, y, 0, -0.0705, 0.022 * mw, 0.0013);                       // the line between
    d -= 0.002 * ex(ax, y, 0.0255 * mw, -0.0705, 0.004, 0.006);                   // corners
    d -= 0.0012 * ex(x, y, 0, -0.056, 0.0035, 0.004);                             // philtrum
    d += (f ? 0.005 : 0.008) * F.chin * ex(x, y, 0, -0.096, 0.016, 0.011);        // chin
    z += d * front;
    x += Math.sign(x) * 0.0025 * nw * ex(ax, y, 0.0145 * nw, tipY - 0.004, 0.0055, 0.0055) * front;
    // eyes: skin stays behind the eyeball inside the almond opening, and over it everywhere else (the lids)
    if (front > 0.2) {
      const exd = ax - E.x, eyd = y - E.y, bz = ballZ(E, exd, eyd);
      if (bz !== null) {
        const u = exd / E.hw, m = 0.0016;
        const inside = Math.abs(u) < 1.1 && y < lidUp(E, u) + m && y > lidLo(E, u) - m;
        z = inside ? Math.min(z, bz - 0.0016) : Math.max(z, bz + 0.0009);
      }
    }
    return [HC[0] + x * k, HC[1] + y * k, HC[2] + z * k];
  };
}

// ---------------- body: torso, arms, legs, cut for what they wear ----------------
// ---------------- skeleton ----------------
// Where the joints are (bind pose, before the height scale), from the ANSUR II body survey (US Army 2012, 6,068 people,
// ratios of stature): shoulder joints at ~0.79 of the height and ~0.20 of it apart, elbows at ~0.62, wrists at ~0.48,
// fingertips at ~0.375, hip joints at ~0.50, knees at ~0.27, ankles at ~0.05; upper arm, forearm and hand ~0.18 /
// 0.145 / 0.10, foot 0.15. The shoulder joints sit inside the body, under the deltoid — not out beside it.
const DIMS = {
  m: { hipsY: 0.99, hipX: 0.102, hipDY: -0.045, thigh: 0.445, shin: 0.41, ankleH: 0.09, shX: 0.19, shY: 0.495, upper: 0.335, fore: 0.27, headY: 0.60, ball: 0.064, heel: 0.072, toeBall: 0.148, toe: 0.214 },
  f: { hipsY: 0.99, hipX: 0.108, hipDY: -0.045, thigh: 0.445, shin: 0.41, ankleH: 0.09, shX: 0.177, shY: 0.49, upper: 0.325, fore: 0.258, headY: 0.60, ball: 0.056, heel: 0.07, toeBall: 0.142, toe: 0.205 },
};
const dimsOf = (female) => (female ? DIMS.f : DIMS.m);
// torso cross-sections: [height, half-width, half-depth, depth offset, squareness] — the trunk only: at the shoulders it
// ends where the deltoid begins (chest breadth ~0.165 of the height, waist ~0.19, hips ~0.20 male / ~0.22 female)
const TORSO_M = [
  [1.600, 0.066, 0.060, -0.010, 2.0], [1.578, 0.122, 0.074, -0.012, 2.2], [1.548, 0.168, 0.090, -0.012, 2.3], [1.515, 0.188, 0.100, -0.006, 2.5],
  [1.470, 0.180, 0.112, 0.004, 2.7], [1.400, 0.168, 0.122, 0.012, 2.5], [1.330, 0.162, 0.120, 0.014, 2.4], [1.250, 0.158, 0.112, 0.010, 2.35],
  [1.170, 0.158, 0.106, 0.007, 2.3], [1.090, 0.163, 0.104, 0.004, 2.3], [1.020, 0.176, 0.108, 0.000, 2.4], [0.960, 0.186, 0.113, -0.006, 2.5],
  [0.910, 0.182, 0.111, -0.008, 2.5], [0.875, 0.158, 0.098, -0.006, 2.4], [0.855, 0.104, 0.064, -0.004, 2.2],
];
const TORSO_F = [
  [1.600, 0.060, 0.056, -0.010, 2.0], [1.578, 0.110, 0.068, -0.012, 2.2], [1.548, 0.152, 0.084, -0.012, 2.3], [1.515, 0.170, 0.094, -0.006, 2.45],
  [1.470, 0.162, 0.106, 0.008, 2.5], [1.410, 0.150, 0.128, 0.026, 2.4], [1.350, 0.146, 0.124, 0.022, 2.4], [1.270, 0.136, 0.104, 0.010, 2.3],
  [1.190, 0.132, 0.096, 0.004, 2.3], [1.110, 0.142, 0.098, 0.002, 2.35], [1.030, 0.168, 0.108, -0.002, 2.45], [0.970, 0.192, 0.118, -0.010, 2.5],
  [0.920, 0.194, 0.118, -0.012, 2.5], [0.880, 0.168, 0.102, -0.008, 2.4], [0.858, 0.110, 0.066, -0.004, 2.2],
];
// folds of a loose top: drape hanging from the chest, blousing over the ribbed hem
function topFold(y, hem, seed, amt) {
  const drape = 0.007 * amt * sstep(1.45, 1.05, y), blouse = 0.009 * amt * sstep(hem + 0.16, hem + 0.06, y);
  return (th) => {
    const n1 = vnoise(th * 2.3 + seed, y * 8), n2 = vnoise(th * 5.3 + 7 + seed, y * 17);
    return drape * (Math.sin(th * 7 + n1 * 5) * 0.6 + (n2 - 0.5) * 0.9) + blouse * (0.55 + 0.45 * Math.sin(th * 10 + n2 * 4));
  };
}
function torso(B, cfg) {
  const f = cfg.female, top = TOPS[cfg.top] || TOPS.tee, bot = BOTS[cfg.bottom] || BOTS.trousers, bk = cfg.build;
  const rows = f ? TORSO_F : TORSO_M, hem = top.hem, loose = top.loose || 0, lod = cfg.lod || 0;
  const y0 = rows[0][0], y1 = rows[rows.length - 1][0];
  // build: slimmer or fuller at the waist and belly, a little at the chest
  const girth = (y) => 1 + (bk - 0.5) * (0.07 + 0.2 * sstep(1.42, 1.2, y) * sstep(0.9, 1.06, y));
  const belly = (y) => Math.max(0, bk - 0.5) * 0.05 * sstep(1.36, 1.2, y) * sstep(0.98, 1.1, y);
  const ribTop = hem + (loose ? 0.045 : 0.008);
  const keys = rows.map((r) => r[0]).concat([hem, hem + 0.004, ribTop]);
  const ys = samples(y0, y1, loose && !lod ? 0.03 : 0, keys);
  const rings = [];
  for (const y of ys) {
    const [rx0, rz0, cz0, pw] = rowAt(rows, y);
    const gk = girth(y), rx = rx0 * gk, rz = rz0 * gk + belly(y), cz = cz0 + belly(y) * 0.7;
    const shirt = y > hem + 1e-4;
    const rib = shirt && y <= ribTop + 1e-4 && (loose || top.id === 3);
    let pad;
    if (shirt) pad = rib ? (loose ? 0.011 : top.pad) : top.pad + (loose ? 0.008 * sstep(1.4, 1.05, y) : 0) + (!loose && y < hem + 0.07 ? 0.006 : 0);
    else pad = bot.skirt ? 0.012 : bot.id === 2 ? 0.012 : 0.006;
    const w = y >= 1.15 ? W1(SPINE) : y <= 1.01 ? W1(HIPS) : W2(HIPS, SPINE, (y - 1.01) / 0.14);
    const part = shirt ? (rib ? PT.rib : PT.top) : (y > 0.97 ? PT.waist : PT.leg);
    rings.push({ c: [0, y, cz], ax: X, ay: Z, rx: rx + pad, ry: rz + pad, pw, reg: shirt ? R.top : R.bottom, w, part, v: y, sa: shirt ? undefined : 'sides',
      fold: shirt && loose && !rib && !lod ? topFold(y, hem, cfg.seed || 0, loose) : null });
    // the hem: a lip where the top ends over the trousers
    if (Math.abs(y - (hem + 0.004)) < 1e-4) rings.push({ c: [0, hem + 0.002, cz], ax: X, ay: Z, rx: rx + pad + 0.003, ry: rz + pad + 0.002, pw, reg: R.top, w, part: PT.rib, v: y });
  }
  B.loft(rings, lod > 1 ? 18 : lod ? 30 : 44, [0, 0.025, 0], [0, -0.012, 0]);
  // neck (~0.072 of the height across, as measured)
  const neck = [], nk = (f ? 0.9 : 1) * (1 + (bk - 0.5) * 0.1);
  for (const [y, r] of [[1.585, 0.067], [1.615, 0.064], [1.650, 0.061], [1.690, 0.058], [1.725, 0.055]]) {
    const w = y <= 1.6 ? W1(SPINE) : y >= 1.665 ? W1(HEAD) : W2(SPINE, HEAD, (y - 1.6) / 0.065);
    neck.push({ c: [0, y, -0.012], ax: X, ay: Z, rx: r * nk, ry: r * nk * 1.05, pw: 2, reg: R.skin, w });
  }
  B.loft(neck, lod > 1 ? 8 : 20);
}
// folds of a loose sleeve: compression rings at the elbow and above the cuff, drape between
function sleeveFold(dy, U, seed, amt) {
  const comp = (0.5 * sstep(-U + 0.09, -U, dy) * sstep(-U - 0.11, -U - 0.02, dy) + sstep(-U - 0.1, -U - 0.17, dy)) * 0.006 * amt;
  return (th) => {
    const n1 = vnoise(th * 1.7 + seed, dy * 14), n2 = vnoise(th * 3.9 + seed * 2, dy * 30);
    return comp * Math.sin(dy * 140 + th * 2 + n1 * 6) + 0.004 * amt * (Math.sin(th * 5 + n2 * 5) * 0.5 + (n1 - 0.5));
  };
}
// arm cross-sections: [dy below the shoulder joint (for a 0.335 / 0.27 arm), half-width, half-depth]
const ARM_ROWS = [
  [0.035, 0.040, 0.040], [0.0, 0.054, 0.054], [-0.06, 0.053, 0.055], [-0.12, 0.048, 0.051], [-0.19, 0.045, 0.048],
  [-0.26, 0.041, 0.044], [-0.31, 0.037, 0.041], [-0.335, 0.036, 0.040], [-0.37, 0.040, 0.044], [-0.44, 0.039, 0.042],
  [-0.51, 0.034, 0.037], [-0.57, 0.027, 0.031], [-0.605, 0.023, 0.029],
];
// how far a top stands off the arm at a point (0 = bare)
function sleevePad(sl, dy, hemY, cuffTop, cuff) {
  if (sl === 'none' || dy < hemY - 1e-4) return 0;
  if (sl === 'loose') return cuff ? 0.009 : 0.026 + 0.01 * sstep(-0.13, -0.49, dy) + (dy < cuffTop + 0.03 ? 0.006 : 0);
  if (sl === 'cuff') return cuff ? 0.008 : 0.012;
  if (sl === 'long') return 0.006;
  return 0.008 + (Math.abs(dy - hemY) < 0.006 ? 0.002 : 0);
}
function arm(B, cfg, s) {
  const D = dimsOf(cfg.female), SH = s < 0 ? ARM_L : ARM_R, EL = s < 0 ? EL_L : EL_R, x0 = s * D.shX, y0 = D.hipsY + D.shY, f = cfg.female ? 0.88 : 1;
  const U = D.upper, Fo = D.fore, top = TOPS[cfg.top] || TOPS.tee, sl = top.sleeve, lod = cfg.lod || 0, lw = 1 + (cfg.build - 0.5) * 0.14;
  const outer = s > 0 ? 0 : Math.PI;
  const map = (d) => (d >= -0.335 ? d * U / 0.335 : -U + (d + 0.335) * Fo / 0.27);
  const rows = ARM_ROWS.map(([d, rx, rz]) => [map(d), rx, rz]);
  const wristY = -(U + Fo);
  const hemY = sl === 'long' ? wristY + 0.035 : sl === 'short' ? -U * 0.56 : sl === 'none' ? 0.1 : wristY + 0.04;
  const cuffTop = sl === 'loose' ? hemY + 0.05 : sl === 'cuff' ? hemY + 0.055 : hemY;
  const keys = rows.map((r) => r[0]).concat([hemY + 0.003, hemY - 0.001, cuffTop, cuffTop - 0.004, cuffTop + 0.012, -U]);
  const dys = samples(rows[0][0], wristY, sl === 'loose' && !lod ? 0.026 : 0, keys);
  // the elbow: the skin over it follows both bones, blended across the joint
  const wOf = (dy) => (dy > -U + 0.04 ? W1(SH) : dy < -U - 0.035 ? W1(EL) : W2(SH, EL, (-U + 0.04 - dy) / 0.075));
  const rings = [];
  for (const dy of dys) {
    const [rx, rz] = rowAt(rows, dy);
    const cloth = dy > hemY - 1e-4 && sl !== 'none';
    const cuff = cloth && dy <= cuffTop - 0.004 + 1e-4 && (sl === 'loose' || sl === 'cuff');
    const pad = sleevePad(sl, dy, hemY, cuffTop, cuff);
    rings.push({ c: [x0, y0 + dy, 0], ax: X, ay: Z, rx: rx * f * lw + pad, ry: rz * f * lw + pad, pw: 2, reg: cloth ? R.top : R.skin, w: wOf(dy),
      part: cloth ? (cuff ? PT.rib : PT.sleeve) : 0, v: -dy, sa: outer, fold: cloth && sl === 'loose' && !cuff && !lod ? sleeveFold(dy, U, (cfg.seed || 0) + s * 3, top.loose) : null });
  }
  B.loft(rings, lod > 1 ? 10 : lod ? 14 : sl === 'loose' ? 24 : 18, [0, 0.01, 0], [0, -0.006, 0]);
  // the shoulder: a ball centred on the joint (the deltoid over the top of the arm). It turns with the arm about its
  // own centre, so the arm stays joined to the body whatever the pose; its inner half lies inside the trunk.
  const bpad = sleevePad(sl, 0, hemY, cuffTop, false), br = D.ball * lw + bpad, bcloth = sl !== 'none';
  B.sphere(lod > 1 ? 10 : lod ? 16 : 26, lod > 1 ? 8 : lod ? 12 : 18, (dx, dy, dz) => [x0 + dx * br, y0 + dy * br * (dy > 0 ? 0.86 : 1.05), dz * br * 0.94],
    bcloth ? R.top : R.skin, W1(SH), 0, bcloth ? (d) => [0, 0, PT.sleeve, Math.atan2(d[2], Math.abs(d[0]) + Math.max(0, d[1]) * 0.8)] : null);
  // the elbow: a ball inside the joint fills out the back of the elbow when the arm bends
  const ecloth = sl !== 'none' && -U > hemY, epad = ecloth ? sleevePad(sl, -U, hemY, cuffTop, false) : 0;
  const erx = 0.036 * f * lw * 0.96 + epad, erz = 0.04 * f * lw * 0.96 + epad;
  B.sphere(lod > 1 ? 8 : 14, lod > 1 ? 6 : 10, (dx, dy, dz) => [x0 + dx * erx, y0 - U + dy * Math.min(erx, erz), dz * erz], ecloth ? R.top : R.skin, W1(EL), 0,
    ecloth ? () => [0, U, PT.sleeve, 9] : null);
  hand(B, cfg, s, x0, y0 + wristY, f, EL);
}
// hy: the wrist
function hand(B, cfg, s, x0, hy, f, EL) {
  const w = W1(EL), lod = cfg.lod || 0, k = 1.1 * f;
  const inward = -s; // the palm faces the body
  if ((s < 0 && cfg.fistL) || (s > 0 && cfg.fistR)) {
    // a fist around a handle that runs along the forearm
    B.sphere(14, 10, (dx, dy, dz) => [x0 + dx * 0.031 * k, hy - 0.055 * k + dy * 0.05 * k, 0.004 + dz * 0.044 * k], R.skin, w);
    B.loft([
      { c: [x0 + inward * 0.012, hy - 0.035 * k, 0.036 * k], ax: X, ay: Z, rx: 0.012 * k, ry: 0.011 * k, pw: 2, reg: R.skin, w },
      { c: [x0 + inward * 0.02, hy - 0.07 * k, 0.03 * k], ax: X, ay: Z, rx: 0.01 * k, ry: 0.009 * k, pw: 2, reg: R.skin, w },
    ], 10, null, [inward * 0.004, -0.01, -0.004]);
    return;
  }
  const palm = [];
  for (const [dy, hw, ht] of [[0.016, 0.022, 0.017], [0.0, 0.027, 0.016], [-0.02, 0.036, 0.016], [-0.05, 0.042, 0.015], [-0.085, 0.042, 0.013]]) {
    palm.push({ c: [x0 + inward * 0.002, hy + dy * k, 0.004], ax: Z, ay: X, rx: hw * k, ry: ht * k, pw: 2.6, reg: R.skin, w });
  }
  if (lod > 1) { // crowd: a mitten (palm and closed fingers in one)
    palm.push({ c: [x0 + inward * 0.008, hy - 0.125 * k, 0.004], ax: Z, ay: X, rx: 0.038 * k, ry: 0.012 * k, pw: 2.4, reg: R.skin, w }, { c: [x0 + inward * 0.014, hy - 0.16 * k, 0.004], ax: Z, ay: X, rx: 0.03 * k, ry: 0.01 * k, pw: 2.2, reg: R.skin, w });
    B.loft(palm, 6, [0, 0.006, 0], [inward * 0.004, -0.012, 0]); return;
  }
  B.loft(palm, 14, null, null);
  // fingers: three joints each, curling a little toward the palm (a relaxed hand)
  const fz = [0.028, 0.0095, -0.0095, -0.027], fl = [0.072, 0.082, 0.077, 0.062];
  for (let i = 0; i < 4; i++) {
    const rings = []; let px = x0 + inward * 0.004, py = hy - 0.085 * k, ang = 0.18 + i * 0.03;
    const seg = fl[i] * k / 3;
    for (let j = 0; j <= 3; j++) {
      const r = (0.0088 - j * 0.0007) * k;
      rings.push({ c: [px, py, (fz[i] + 0.002) * k], ax: Z, ay: X, rx: r, ry: r * 0.92, pw: 2, reg: R.skin, w });
      px += inward * Math.sin(ang) * seg; py -= Math.cos(ang) * seg; ang += 0.3;
    }
    B.loft(rings, 8, null, [inward * 0.002, -0.004, 0]);
  }
  const th = [];
  let tx = x0 + inward * 0.006, ty = hy - 0.02 * k, tz = 0.038 * k;
  for (let j = 0; j <= 3; j++) { th.push({ c: [tx, ty, tz], ax: X, ay: Z, rx: (0.011 - j * 0.0012) * k, ry: (0.0105 - j * 0.001) * k, pw: 2, reg: R.skin, w }); tx += inward * 0.012 * k; ty -= 0.016 * k; tz += 0.006 * k; }
  B.loft(th, 8, null, [inward * 0.003, -0.005, 0.002]);
}
// folds of loose trousers: at the knee, stacked above the ankle cuff, drape down the shin
function legFold(dy, Tl, seed, amt) {
  const knee = 0.005 * amt * sstep(-Tl + 0.085, -Tl, dy) * sstep(-Tl - 0.11, -Tl - 0.02, dy);
  const stack = 0.008 * amt * sstep(-0.62, -0.74, dy);
  return (th) => {
    const n1 = vnoise(th * 1.9 + seed, dy * 11), n2 = vnoise(th * 4.3 + seed * 3, dy * 25);
    return (knee + stack) * Math.sin(dy * 120 + th * 2.5 + n1 * 6) + 0.0045 * amt * (Math.sin(th * 4 + n2 * 4) * 0.5 + (n1 - 0.5) * 0.8);
  };
}
// leg cross-sections: [dy below the hip joint, half-width, half-depth, depth offset] — knee at -0.445, ankle at -0.855
const LEG_ROWS = [
  [0.070, 0.042, 0.042, 0], [0.035, 0.080, 0.084, 0], [0.000, 0.092, 0.095, 0.004], [-0.080, 0.090, 0.093, 0.006],
  [-0.180, 0.083, 0.086, 0.006], [-0.300, 0.070, 0.073, 0.004], [-0.390, 0.059, 0.062, 0.006], [-0.445, 0.055, 0.059, 0.012],
  [-0.500, 0.054, 0.057, 0.004], [-0.590, 0.058, 0.064, -0.010], [-0.680, 0.051, 0.056, -0.006], [-0.770, 0.039, 0.042, 0.0],
  [-0.830, 0.032, 0.036, 0.0], [-0.875, 0.033, 0.041, 0.004],
];
function leg(B, cfg, s) {
  const D = dimsOf(cfg.female), LG = s < 0 ? LEG_L : LEG_R, KN = s < 0 ? KN_L : KN_R, AK = s < 0 ? ANK_L : ANK_R;
  const x0 = s * D.hipX, y0 = D.hipsY + D.hipDY, f = cfg.female ? 0.93 : 1, Tl = D.thigh, Sl = D.shin;
  const bot = BOTS[cfg.bottom] || BOTS.trousers, lod = cfg.lod || 0, lw = 1 + (cfg.build - 0.5) * 0.12;
  const outer = s > 0 ? 0 : Math.PI;
  const bare = !!bot.skirt;
  const hemY = bare ? 0.1 : bot.hem - y0, cuffTop = bot.cuff ? hemY + 0.05 : hemY;
  const keys = LEG_ROWS.map((r) => r[0]).concat([hemY + 0.003, hemY - 0.001, cuffTop, cuffTop - 0.004, cuffTop + 0.012]);
  const dys = samples(0.07, -0.875, bot.folds && !lod ? 0.028 : 0, keys);
  // the knee and the ankle: skin over a joint follows both bones, blended across it
  const wOf = (dy) => {
    if (dy > -Tl + 0.045) return W1(LG);
    if (dy > -Tl - 0.055) return W2(LG, KN, (-Tl + 0.045 - dy) / 0.1);
    if (dy > -Tl - Sl + 0.035) return W1(KN);
    return W2(KN, AK, Math.min(1, (-Tl - Sl + 0.035 - dy) / 0.05));
  };
  const padOf = (dy, cuff) => (dy <= hemY - 1e-4 || bare ? 0 : cuff ? 0.008 : (dy < -0.45 ? bot.pad[1] : bot.pad[0]) + (bot.cuff && dy < cuffTop + 0.035 ? 0.008 : 0) + (!bot.cuff && Math.abs(dy - hemY) < 0.006 ? 0.004 : 0));
  const rings = [];
  for (const dy of dys) {
    const [rx, rz, cz] = rowAt(LEG_ROWS, dy);
    const cloth = !bare && dy > hemY - 1e-4;
    // under a skirt: the upper thigh wears the skirt's fabric (shorts underneath), so where the skirt stretches over the
    // hip when the legs swing or sit, no bare skin shows through; well above the hem, never seen below it
    const under = bare && dy > -0.33;
    const cuff = cloth && bot.cuff && dy <= cuffTop - 0.004 + 1e-4;
    const pad = padOf(dy, cuff);
    rings.push({ c: [x0, y0 + dy, cz], ax: X, ay: Z, rx: rx * f * lw + pad, ry: rz * f * lw + pad, pw: 2, reg: cloth || under ? R.bottom : R.skin, w: wOf(dy),
      part: cloth ? (cuff ? PT.cuff : PT.leg) : under ? PT.leg : 0, v: -dy, sa: outer, fold: cloth && bot.folds && !cuff && !lod ? legFold(dy, Tl, (cfg.seed || 0) + s * 5, bot.folds) : null });
  }
  B.loft(rings, lod > 1 ? 10 : lod ? 16 : bot.folds ? 24 : 20, [0, 0.02, 0], null);
  // the knee: a ball in the joint keeps the knee round when it bends (sitting, kneeling, crouching)
  const kcloth = !bare && -Tl > hemY, kpad = kcloth ? padOf(-Tl, false) : 0;
  const krx = 0.055 * f * lw * 0.95 + kpad, krz = 0.059 * f * lw * 0.95 + kpad;
  B.sphere(lod > 1 ? 8 : 16, lod > 1 ? 6 : 12, (dx, dy, dz) => [x0 + dx * krx, y0 - Tl + dy * Math.min(krx, krz), 0.008 + dz * krz], kcloth ? R.bottom : R.skin, W1(KN), 0,
    kcloth ? () => [0, Tl, PT.leg, 9] : null);
}
// the old plain shoe (used when wardrobe.js is missing)
function plainShoes(B, cfg) {
  for (const s of [-1, 1]) {
    const AK = s < 0 ? ANK_L : ANK_R, x0 = s * dimsOf(cfg.female).hipX, f = cfg.female ? 0.93 : 1, w = W1(AK), toe = s * 0.06;
    const rowsS = [[-0.065, 0.034, 0.068], [-0.04, 0.042, 0.084], [0.0, 0.045, 0.092], [0.05, 0.047, 0.078], [0.1, 0.047, 0.058], [0.15, 0.043, 0.045], [0.19, 0.034, 0.035], [0.214, 0.018, 0.024]];
    B.loft(rowsS.map(([z, hw, h]) => ({ c: [x0 + toe * Math.max(0, z) * 0.6, h / 2, z], ax: X, ay: Y, rx: hw * f, ry: h / 2, pw: 2.8, reg: (th, c, sn) => (sn < -0.75 ? R.sole : R.shoe), w })), cfg.lod > 1 ? 8 : 18, [0, 0, -0.008], [0, 0, 0.006]);
  }
}

// ---------------- head ----------------
// short hair as a shell on the skull (crowds, and the base under grown hair): forehead hairline, temples, sideburns,
// over the ears, the nape; long hair adds a curtain down the back
function hairLine(long, th) {
  if (th < 0.42) return long ? 0.07 : 0.075;
  if (th < 0.95) return lerp(long ? 0.07 : 0.075, 0.03, sstep(0.42, 0.95, th));
  if (th < 1.28) return long ? -0.02 : -0.034;   // sideburn in front of the ear
  if (th < 1.95) return 0.016;                    // over the ear
  return lerp(0.016, -0.082, sstep(1.95, 2.5, th)); // down to the nape
}
function shellHair(B, cfg, fn, P, o) {
  o = o || {};
  const HC = headCentre(cfg), k = HK(cfg), w = W1(HEAD), long = o.long !== undefined ? o.long : cfg.hair === 'long' || cfg.hair === 'pony' || cfg.hair === 'bun' || cfg.hair === 'bob';
  const thickA = o.thick !== undefined ? o.thick : (long ? 0.007 : 0.0045), thickB = o.thick !== undefined ? o.thick * 0.6 : (long ? 0.006 : 0.0065);
  const lineFn = o.line || ((th) => hairLine(long, th));
  const lod = cfg.lod || 0;
  B.sphere(lod > 1 ? 24 : lod ? 44 : 72, lod > 1 ? 14 : lod ? 30 : 48, (dx, dy, dz) => {
    const p = fn(dx, dy, dz), q = [(p[0] - HC[0]) / k, (p[1] - HC[1]) / k, (p[2] - HC[2]) / k];
    const th = Math.abs(Math.atan2(dx, dz));               // 0 = front … π = back
    const line = lineFn(th, dx);
    const m = sstep(line - 0.007, line + 0.007, q[1]);
    const thick = thickA + thickB * sstep(0.0, 0.08, q[1]) * (1 - 0.3 * sstep(1.8, 3.1, th));
    const t = m * thick - (1 - m) * 0.012;
    const n = Math.hypot(q[0], q[1], q[2]) || 1;
    return [p[0] + q[0] / n * t * k, p[1] + q[1] / n * t * k, p[2] + q[2] / n * t * k];
  }, R.hair, w, 1.2, () => [0, 0, PT.shell, 9]);
  if (long && o.curtain !== false && cfg.hair === 'long') {
    // the length: a curtain down the back, behind the ears and the neck
    const rings = [];
    for (const [dy, rx, rz, cz] of [[0.03, 0.084, 0.09, -0.01], [-0.03, 0.09, 0.088, -0.022], [-0.09, 0.092, 0.078, -0.042], [-0.16, 0.1, 0.066, -0.062], [-0.24, 0.115, 0.054, -0.078], [-0.3, 0.11, 0.04, -0.084]]) {
      rings.push({ c: P(0, dy, cz), ax: X, ay: Z, rx: rx * k, ry: rz * k, pw: 2.2, reg: R.hair, w, part: PT.shell });
    }
    const s0 = B.p.length / 3; B.loft(rings, lod > 1 ? 10 : 32, null, [0, -0.008, -0.004]);
    for (let i = s0; i < B.p.length / 3; i++) { const z = (B.p[i * 3 + 2] - HC[2]) / k; if (z > -0.03) B.p[i * 3 + 2] = HC[2] + (-0.03 - (z + 0.03) * 0.12) * k; }
  }
}
function head(B, cfg) {
  const HC = headCentre(cfg), k = HK(cfg), fn = sculpt(cfg), w = W1(HEAD), F = faceOf(cfg), E = F.eye, lod = cfg.lod || 0;
  const P = (x, y, z) => [HC[0] + x * k, HC[1] + y * k, HC[2] + z * k];
  B.sphere(lod > 1 ? 26 : lod ? 56 : 112, lod > 1 ? 18 : lod ? 40 : 80, fn, R.face, w, 1.55);
  for (const s of [-1, 1]) {
    // eyeball (only the almond shows between the lids)
    if (lod < 2) B.sphere(lod ? 12 : 20, lod ? 8 : 14, (dx, dy, dz) => P(s * E.x + dx * E.r, E.y + dy * E.r, E.z + dz * E.r), R.eye, w);
    // eyelids: soft rolls along the upper and lower edge of the opening
    if (!lod) for (const up of [true, false]) {
      const rings = [];
      for (let i = 0; i <= 14; i++) {
        const u = -1.08 + 2.16 * i / 14, uc = Math.max(-1, Math.min(1, u)), rl = (up ? 0.0019 : 0.0013) * (0.55 + 0.45 * Math.pow(Math.max(0, 1 - u * u), 0.5));
        const ly = up ? lidUp(E, uc) + rl * 0.7 : lidLo(E, uc) - rl * 0.7;
        const exd = u * E.hw, bz = ballZ(E, exd, ly - E.y) || E.z + 0.004;
        rings.push({ c: P(s * (E.x + exd), ly, bz + 0.0004), ax: [0, up ? 1 : -1, 0], ay: [0, 0, 1], rx: rl * k, ry: rl * k * 0.9, pw: 2, reg: R.face, w });
      }
      B.loft(rings, 8, null, null);
    }
    // ears
    const ea = s * 0.26, ca = Math.cos(ea), sa = Math.sin(ea), es = F.ear;
    B.sphere(lod > 1 ? 6 : 14, lod > 1 ? 5 : 12, (dx, dy, dz) => {
      let x = dx * 0.0085 * es, y = dy * 0.029 * es, z = dz * 0.0185 * es;
      if (s * dx > 0) x -= s * 0.004 * es * Math.exp(-(dy * dy + dz * dz) * 2.2);  // the bowl of the ear
      y *= 1 - 0.25 * Math.max(0, -dy);
      return P(s * 0.0775 * F.w + x * ca + z * sa, -0.006 + y, -0.008 - x * sa + z * ca);
    }, R.ear, w);
  }
  // hair
  if (cfg.hair !== 'bald' && !cfg.helmet) {
    if (lod > 1 || !G.HUM.hair) shellHair(B, cfg, fn, P);
    else G.HUM.hair(B, cfg, fn, P);
  }
  if (cfg.cap) {
    const rings = [];
    for (const [dy, r, cz] of [[0.04, 0.093, -0.004], [0.075, 0.091, -0.006], [0.103, 0.079, -0.008], [0.123, 0.057, -0.01], [0.133, 0.028, -0.01]]) rings.push({ c: P(0, dy, cz), ax: X, ay: Z, rx: r * 0.92 * k * F.w, ry: r * 1.03 * k, pw: 2, reg: R.cap, w });
    B.loft(rings, 32, null, [0, 0.003, 0]);
    const br = [];
    for (const [dz, hw] of [[0.07, 0.078], [0.105, 0.072], [0.142, 0.056], [0.16, 0.03]]) br.push({ c: P(0, 0.043 - (dz - 0.07) * 0.2, dz), ax: X, ay: Y, rx: hw * k, ry: 0.0035 * k, pw: 2.4, reg: R.cap, w });
    B.loft(br, 16, [0, 0, -0.004], [0, 0, 0.003]);
  }
  if (cfg.helmet) {
    const rings = [];
    for (const [dy, r] of [[-0.012, 0.108], [0.03, 0.111], [0.075, 0.103], [0.108, 0.084], [0.13, 0.054], [0.14, 0.02]]) rings.push({ c: P(0, dy, -0.006), ax: X, ay: Z, rx: r * 0.95 * k * F.w, ry: r * 1.04 * k, pw: 2, reg: R.cap, w });
    B.loft(rings, 32, null, [0, 0.003, 0]);
  }
  if (cfg.glasses) {
    const zf = 0.089, yy = E.y, rect = cfg.glasses === 'rect', clear = cfg.glasses !== 'sun';
    for (const s of [-1, 1]) {
      const cx = s * E.x;
      // clear lenses are left open (just the rims); sunglasses get dark glass
      B.loft([0, 1, 2].map((i) => ({ c: P(cx, yy, zf + 0.001 * i), ax: X, ay: Y, rx: (0.021 - i * 0.0005 - (clear ? 0.0012 * (i !== 1) : 0)) * k, ry: ((rect ? 0.012 : 0.0135) - i * 0.0004 - (clear ? 0.0012 * (i !== 1) : 0)) * k, pw: rect ? 4 : 3, reg: clear || i === 1 ? R.frame : R.lens, w })), 20, clear ? null : [0, 0, -0.001], clear ? null : [0, 0, 0.001]);
      B.loft([{ c: P(s * 0.053 * F.w, yy + 0.004, zf - 0.004), ax: Y, ay: X, rx: 0.0022, ry: 0.0014, pw: 2, reg: R.frame, w }, { c: P(s * 0.08 * F.w, yy + 0.002, -0.012), ax: Y, ay: X, rx: 0.002, ry: 0.0013, pw: 2, reg: R.frame, w }], 6);
    }
    B.loft([{ c: P(-0.012, yy + 0.002, zf + 0.002), ax: Y, ay: Z, rx: 0.002, ry: 0.0015, pw: 2, reg: R.frame, w }, { c: P(0.012, yy + 0.002, zf + 0.002), ax: Y, ay: Z, rx: 0.002, ry: 0.0015, pw: 2, reg: R.frame, w }], 6);
  }
}
function buildBody(cfg) {
  const B = new Builder();
  torso(B, cfg); arm(B, cfg, -1); arm(B, cfg, 1); leg(B, cfg, -1); leg(B, cfg, 1); head(B, cfg);
  if (G.HUM.wear) G.HUM.wear(B, cfg); else plainShoes(B, cfg);
  const g = B.geometry();
  toeBend(g, cfg);
  return g;
}
// the front of each foot / shoe (ahead of the ball) follows the toe joint, so when the heel comes up the toes stay
// flat on the ground and the shoe creases over the ball of the foot instead of the whole foot tipping onto its tip
function toeBend(g, cfg) {
  const D = dimsOf(cfg.female), pos = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const z0 = D.toeBall - 0.02, z1 = D.toeBall + 0.022, yTop = D.ankleH + 0.02;   // bind pose: ankle joints at y = ankleH, z = 0
  for (let i = 0; i < pos.count; i++) {
    const a = SI.getX(i), b = SI.getY(i), main = SW.getX(i) >= SW.getY(i) ? a : b;
    if ((main !== ANK_L && main !== ANK_R) || pos.getY(i) > yTop) continue;
    const t = sstep(z0, z1, pos.getZ(i)); if (t <= 0) continue;
    SI.setXYZW(i, main, main === ANK_L ? TOE_L : TOE_R, 0, 0); SW.setXYZW(i, 1 - t, t, 0, 0);
  }
  SI.needsUpdate = true; SW.needsUpdate = true;
}
// geometries are shared by everyone cut the same way (a few dozen kept)
const GEO = new Map();
function bodyGeo(cfg) {
  const k = JSON.stringify(cfg);
  let g = GEO.get(k);
  if (g) { GEO.delete(k); GEO.set(k, g); return g; }
  g = buildBody(cfg); GEO.set(k, g);
  if (GEO.size > 48) GEO.delete(GEO.keys().next().value);
  return g;
}

// ---------------- looks ----------------
// A look is everything the player can choose. Older code passes the short form ({ shirt, pants, skin, hair colour,
// longHair, bald, beard, sleeveless, longSleeve, shorts, cap, helmet, glasses, vest, bruises, tattoo }); both work.
const DEF = {
  sex: 'm', height: 0.5, build: 0.5, skin: 0xc79a74, iris: 0x2a1a10, brow: 'normal', browColor: null, lip: null, fh: 'stubble',
  hair: 'short', hairColor: 0x15110e, hairColor2: null, hairTips: 0,
  top: 'tee', topColor: 0x777777, topColor2: 0xe8e4dc, innerColor: 0xe9e6df, pattern: 'solid',
  bottom: 'trousers', bottomColor: 0x333333, bottomColor2: 0xe8e4dc,
  shoes: 'sneaker', shoeColor: 0x1c1a19, soleColor: 0x2b2926, laceColor: null, glasses: '',
};
G.LOOK_DEFAULTS = DEF;
const pick = (v, d) => (v === undefined || v === null ? d : v);
G.normLook = function (o) {
  o = o || {};
  if (o._norm) return o;
  const L = { _norm: true };
  L.sex = o.sex === 'f' || (o.sex === undefined && o.longHair) ? 'f' : 'm';
  L.height = pick(o.height, 0.5); L.build = pick(o.build, 0.5);
  L.skin = pick(o.skin, DEF.skin);
  L.face = Object.assign({}, o.face || {});
  L.iris = pick(o.iris, DEF.iris);
  L.brow = BROWS[o.brow] ? o.brow : 'normal';
  L.browColor = pick(o.browColor, null); L.lip = pick(o.lip, null);
  L.fh = FACIAL[o.fh] ? o.fh : (L.sex === 'f' || o.beard === 0 ? 'none' : 'stubble');
  L.fhAmt = typeof o.beard === 'number' ? o.beard / 0.6 : pick(o.fhAmt, 1);
  if (typeof o.hair === 'string') L.hair = o.hair; else L.hair = o.hairStyle || (o.bald ? 'bald' : o.longHair ? 'long' : 'short');
  L.hairColor = typeof o.hair === 'number' ? o.hair : pick(o.hairColor, DEF.hairColor);
  L.hairColor2 = pick(o.hairColor2, null); L.hairTips = pick(o.hairTips, 0);
  L.top = TOPS[o.top] ? o.top : (o.sleeveless ? 'tank' : o.longSleeve ? 'longtee' : 'tee');
  L.topColor = pick(o.topColor, pick(o.shirt, DEF.topColor)); L.topColor2 = pick(o.topColor2, DEF.topColor2); L.innerColor = pick(o.innerColor, DEF.innerColor);
  L.pattern = PATTERNS[o.pattern] !== undefined ? o.pattern : 'solid';
  L.bottom = BOTS[o.bottom] ? o.bottom : (o.shorts ? 'shorts' : 'trousers');
  L.bottomColor = pick(o.bottomColor, pick(o.pants, DEF.bottomColor)); L.bottomColor2 = pick(o.bottomColor2, DEF.bottomColor2);
  L.shoes = SHOES[o.shoes] !== undefined ? o.shoes : 'sneaker';
  L.shoeColor = pick(o.shoeColor, pick(o.shoe, DEF.shoeColor)); L.soleColor = pick(o.soleColor, DEF.soleColor); L.laceColor = pick(o.laceColor, null);
  L.glasses = o.glasses === true ? 'sun' : (o.glasses || '');
  L.cap = o.cap || null; L.helmet = o.helmet || null; L.vest = o.vest || null;
  L.bruises = !!o.bruises; L.tattoo = !!o.tattoo; L.seed = o.seed || 0;
  return L;
};
const q2 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 50) / 50;
function cfgOf(L, o) {
  o = o || {};
  const face = {};
  for (const k of FACE_KEYS) if (L.face[k] !== undefined && Math.abs(L.face[k] - 0.5) > 0.009) face[k] = q2(L.face[k]);
  return {
    female: L.sex === 'f', build: q2(L.build), face, top: L.top, bottom: L.bottom, shoes: L.shoes, hair: L.hair,
    cap: !!L.cap, helmet: !!L.helmet, glasses: L.glasses || '', fistL: !!(o.torch || o.fistL), fistR: !!(o.stun || o.stunBaton || o.fistR),
    lod: o.lod !== undefined ? o.lod : (G.gfx && G.gfx.P && G.gfx.P.tex <= 512 ? 1 : 0), seed: L.seed || 0,
  };
}
const heightScale = (L) => (L.sex === 'f' ? 0.91 : 0.95) * lerp(0.94, 1.06, L.height);

// ---------------- shading ----------------
const CH_VS_PARS = 'attribute float aReg;\nattribute vec4 aGar;\nvarying float vReg;\nvarying vec3 vBind;\nvarying vec4 vGar;\n';
const CH_VS_MAIN = 'vReg = aReg; vBind = position; vGar = aGar;\n';
const NOISE_GLSL = `
float chH( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float chN( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( chH( i ), chH( i + vec3( 1, 0, 0 ) ), f.x ), mix( chH( i + vec3( 0, 1, 0 ) ), chH( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( chH( i + vec3( 0, 0, 1 ) ), chH( i + vec3( 1, 0, 1 ) ), f.x ), mix( chH( i + vec3( 0, 1, 1 ) ), chH( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
vec3 chPerturb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir ) {
  vec3 sx = dFdx( surf_pos ), sy = dFdy( surf_pos ), r1 = cross( sy, surf_norm ), r2 = cross( surf_norm, sx );
  float det = dot( sx, r1 ) * faceDir;
  return normalize( abs( det ) * surf_norm - sign( det ) * ( dHdxy.x * r1 + dHdxy.y * r2 ) );
}
`;
const CH_FS_PARS = `
varying float vReg; varying vec3 vBind; varying vec4 vGar;
uniform vec3 chSkin; uniform vec3 chTop; uniform vec3 chBottom; uniform vec3 chHair;
uniform vec3 chTop2; uniform vec3 chInner; uniform vec3 chBottom2; uniform vec3 chShoe; uniform vec3 chShoe2; uniform vec3 chHair2;
uniform vec3 chExtra; uniform vec3 chCap; uniform vec3 chIris; uniform vec3 chLip; uniform vec3 chBrowC; uniform vec3 chLace;
uniform vec4 chFlags;   // x bruises, y tattoo, z female, w dyed tips
uniform vec4 chFH;      // facial hair: stubble, moustache, goatee, full beard
uniform vec4 chStyle;   // top cut, bottom cut, shoe kind, top pattern
uniform vec4 chEyeA; uniform vec4 chEyeB;   // eye x, y, z, r · half-width, upper lid, lower lid, tilt
uniform vec4 chBrowA; uniform vec4 chBrowB; // brow start, length, height, arch · thickness in, out, slope, -
uniform vec4 chMouth;   // lip line, width, fullness, -
uniform vec4 chNose;    // tip height, width, -, -
uniform vec3 chHead; uniform float chHeadK;
uniform vec3 chKeyDir; uniform vec3 chKeyCol;
uniform float chBlink; uniform float chTalk;
` + NOISE_GLSL;
// region colour, roughness, metalness, bump (metres) — runs right after the material's colour
const CH_FS_SURF = `
float chReg = floor( vReg + 0.5 );
vec3 chCol = chSkin; float chRough = 0.5; float chMetal = 0.0; float chBump = 0.0; float chHairK = 0.0;
float chDist = length( vViewPosition );
float chFine = smoothstep( 7.0, 1.5, chDist );          // fine detail fades out with distance (no shimmer)
vec3 chQ = ( vBind - chHead ) / chHeadK;
float gPart = floor( vGar.z + 0.5 );
if ( chReg < 2.5 ) {
  // skin: tone variation, redder ears / nose / cheeks / knuckles, pores
  float n1 = chN( vBind * 38.0 ), n2 = chN( vBind * 150.0 );
  chCol = chSkin * ( 0.93 + 0.1 * n1 ) * ( 0.97 + 0.06 * n2 );
  chRough = 0.62;
  if ( chReg > 1.5 ) chCol *= vec3( 1.06, 0.9, 0.88 );
  if ( chReg > 0.5 && chReg < 1.5 ) {
    vec2 q = vec2( abs( chQ.x ), chQ.y ); float front = smoothstep( 0.045, 0.075, chQ.z );
    float my = chMouth.x, mw = chMouth.y, mf = chMouth.z;
    // cheeks and nose a little warmer
    float warm = exp( - pow( ( q.x - 0.045 ) / 0.02, 2.0 ) - pow( ( q.y + 0.02 ) / 0.02, 2.0 ) ) * 0.5 + exp( - pow( q.x / ( 0.01 * chNose.y ), 2.0 ) - pow( ( q.y - chNose.x ) / 0.012, 2.0 ) ) * 0.4;
    chCol *= mix( vec3( 1.0 ), vec3( 1.07, 0.92, 0.9 ), warm * front );
    // facial hair: stubble, moustache, goatee, beard — painted hair with a little relief
    float hairN = 0.55 + 0.45 * chN( vBind * 900.0 );
    float jawZone = front * smoothstep( -0.03, -0.055, chQ.y ) * ( 1.0 - exp( - pow( q.x / ( 0.02 * mw ), 2.0 ) - pow( ( q.y - my - 0.0015 ) / ( 0.008 * mf ), 2.0 ) ) );
    float lipZone = front * exp( - pow( q.x / ( 0.021 * mw ), 2.0 ) - pow( ( q.y - my - 0.0135 ) / 0.005, 2.0 ) );
    float stub = chFH.x * ( jawZone + lipZone * 0.8 ) * hairN;
    float mx = q.x / ( 0.028 * mw );
    float mo = chFH.y * front * smoothstep( 1.05, 0.82, mx ) * smoothstep( 0.0052, 0.0022, abs( q.y - ( my + 0.0118 - 0.007 * mx * mx ) ) );
    float go = chFH.z * front * smoothstep( 0.024, 0.014, q.x ) * smoothstep( my - 0.007, my - 0.015, q.y ) * smoothstep( -0.122, -0.108, q.y );
    go += chFH.z * front * smoothstep( 0.0042, 0.0018, abs( q.x - 0.026 * mw ) ) * smoothstep( my + 0.012, my + 0.004, q.y ) * smoothstep( my - 0.022, my - 0.01, q.y );
    float lipsHole = clamp( smoothstep( 0.0, 0.003, abs( q.y - my ) - 0.0085 * mf ) + smoothstep( 0.024 * mw, 0.03 * mw, q.x ), 0.0, 1.0 );
    float be = chFH.w * smoothstep( -0.006, -0.034, chQ.y - 0.03 * smoothstep( 0.035, 0.075, q.x ) ) * smoothstep( -0.02, 0.01, chQ.z ) * lipsHole;
    float dense = clamp( max( max( mo, go ), be ), 0.0, 1.0 );
    float strands = chN( vec3( vBind.x * 2200.0, vBind.y * 650.0, vBind.z * 2200.0 ) );
    chCol = mix( chCol, chCol * vec3( 0.62, 0.6, 0.62 ), clamp( stub, 0.0, 1.0 ) * 0.5 );
    chCol = mix( chCol, chBrowC * ( 0.45 + 0.7 * strands ), dense * 0.94 );
    chBump += dense * ( ( strands - 0.5 ) * 0.0007 * chFine + 0.0011 );
    // lips
    float lw = 0.0245 * mw - 45.0 * pow( q.y - my - 0.0007, 2.0 ) / mf;
    float lip = smoothstep( lw, lw - 0.0045, q.x ) * smoothstep( 0.0092 * mf, 0.0062 * mf, abs( q.y - my + 0.0009 ) ) * front * ( 1.0 - dense * 0.85 );
    // nostrils
    chCol *= 1.0 - 0.6 * exp( - pow( ( q.x - 0.0085 * chNose.y ) / 0.0035, 2.0 ) - pow( ( q.y - chNose.x + 0.0075 ) / 0.0022, 2.0 ) ) * front;
    chCol = mix( chCol, chLip, lip * ( chFlags.z > 0.5 ? 0.9 : 0.72 ) );
    chRough = mix( chRough, 0.32, lip );
    if ( chTalk > 0.01 ) {
      float mo = chTalk * 0.0042 * mf;
      float open = smoothstep( 0.0006, -0.0004, abs( q.y - my + 0.0004 ) - mo ) * smoothstep( 0.021 * mw, 0.015 * mw, q.x ) * front;
      vec3 inside = mix( vec3( 0.06, 0.016, 0.02 ), vec3( 0.75, 0.72, 0.66 ), smoothstep( mo * 0.35, mo * 0.8, q.y - my + 0.0004 ) * step( 0.4, chTalk ) );
      chCol = mix( chCol, inside, open ); chRough = mix( chRough, 0.3, open );
    }
    // eyebrows: an arch over each eye, thicker at the inner end, drawn as hair strokes
    float bx = ( q.x - chBrowA.x ) / chBrowA.y;
    float by = chBrowA.z + chBrowA.w * sin( clamp( bx, 0.0, 1.0 ) * 2.6 ) + chBrowB.z * bx;
    float bth = mix( chBrowB.x, chBrowB.y, clamp( bx, 0.0, 1.0 ) );
    float brow = smoothstep( -0.07, 0.05, bx ) * smoothstep( 1.06, 0.9, bx ) * smoothstep( bth, bth * 0.4, abs( q.y - by ) ) * front;
    brow *= 0.72 + 0.28 * chN( vec3( vBind.x * 1400.0 + vBind.y * 500.0, vBind.y * 300.0, 0.0 ) );
    chCol = mix( chCol, chBrowC * 0.85, brow * 0.93 );
    chBump += brow * 0.00035 * chFine;
    // lash lines along the almond-shaped opening (upper dark and thick, lower faint), the crease above the lid
    float lu = ( q.x - chEyeA.x ) / chEyeB.x, lh = pow( max( 0.0, 1.0 - lu * lu ), 0.85 );
    float topY = chEyeA.y + chEyeB.y * lh + chEyeB.w * lu, botY = chEyeA.y - chEyeB.z * lh + chEyeB.w * lu;
    float lashU = smoothstep( 0.0017, 0.0005, abs( q.y - topY - 0.0003 ) ) * smoothstep( 1.18, 0.95, abs( lu ) );
    float lashL = smoothstep( 0.0011, 0.0003, abs( q.y - botY + 0.0002 ) ) * smoothstep( 1.05, 0.8, abs( lu ) ) * 0.45;
    chCol = mix( chCol, chBrowC * 0.18, clamp( lashU * ( chFlags.z > 0.5 ? 1.3 : 1.0 ) + lashL, 0.0, 1.0 ) * front );
    chCol *= 1.0 - 0.16 * exp( - pow( ( q.y - topY - 0.0058 ) / 0.0024, 2.0 ) ) * smoothstep( 1.3, 0.9, abs( lu ) ) * front;
    chCol *= 1.0 - 0.1 * exp( - pow( ( q.y - botY + 0.006 ) / 0.004, 2.0 ) ) * smoothstep( 1.2, 0.7, abs( lu ) ) * front;
    chRough = mix( chRough, 0.5, front * 0.6 );
    chRough = mix( chRough, 0.6, dense );
  }
  // bruises
  if ( chFlags.x > 0.5 ) { float b = smoothstep( 0.62, 0.8, chN( vBind * 9.0 + 3.1 ) ); chCol = mix( chCol, vec3( 0.12, 0.03, 0.05 ), b * 0.55 ); }
  // tattoo on the right arm
  if ( chFlags.y > 0.5 && chReg < 0.5 && vBind.x > 0.22 && vBind.y > 1.15 && vBind.y < 1.5 ) {
    float t = smoothstep( 0.42, 0.46, abs( sin( vBind.y * 90.0 + chN( vBind * 30.0 ) * 6.0 ) * cos( vBind.z * 70.0 ) ) );
    chCol = mix( chCol, vec3( 0.03, 0.05, 0.08 ), t * 0.75 );
  }
  chBump += ( chN( vBind * 1100.0 ) - 0.5 ) * 0.00012 * chFine;
} else if ( chReg < 5.5 ) {
  // tops: the garment (3), the shirt worn under it (4), trims in the accent colour (5)
  float cut = chStyle.x;   // 0 tee 1 long sleeves 2 tank 3 polo 4 shirt 5 track jacket 6 hoodie
  vec3 base = chReg < 3.5 ? chTop : ( chReg < 4.5 ? chInner : chTop2 );
  float folds = chN( vec3( vBind.x * 22.0, vBind.y * 34.0, vBind.z * 22.0 ) ) * 0.7 + chN( vBind * 55.0 ) * 0.3;
  float tricot = step( 4.5, cut ) * step( cut, 5.5 ) * step( chReg, 3.5 );   // the track jacket: smooth knit with a sheen
  chCol = base * ( 0.92 + 0.1 * chN( vBind * 12.0 ) ) * ( 0.95 + 0.07 * folds );
  chRough = mix( 0.86, 0.5, tricot );
  float weave = sin( vBind.x * 1900.0 + vBind.z * 1900.0 ) * sin( vBind.y * 1900.0 );
  chBump = ( folds - 0.5 ) * 0.0032 + weave * 0.00004 * chFine * ( 1.0 - tricot );
  if ( chReg < 3.5 ) {
    float pat = chStyle.w;
    if ( pat > 0.5 && pat < 1.5 ) chCol = mix( chCol, chTop2 * ( 0.92 + 0.1 * folds ), smoothstep( 0.48, 0.52, fract( vBind.y * 16.0 ) ) );
    else if ( pat > 1.5 ) {
      vec2 pq = fract( vec2( ( vBind.x + vBind.z ) * 9.0, vBind.y * 9.0 ) );
      float a = smoothstep( 0.6, 0.63, pq.x ) * smoothstep( 0.86, 0.83, pq.x ) * 0.5 + smoothstep( 0.6, 0.63, pq.y ) * smoothstep( 0.86, 0.83, pq.y ) * 0.5 + smoothstep( 0.94, 0.96, pq.x ) * 0.35;
      chCol = mix( chCol, chTop2 * ( 0.92 + 0.1 * folds ), clamp( a, 0.0, 1.0 ) * 0.85 );
    }
    // ribbing (cuffs, hems, neck bands)
    if ( gPart > 2.5 && gPart < 3.5 ) { float rib = sin( vGar.x * 6.2832 * 150.0 ); chBump += rib * 0.00028 * chFine; chCol *= 0.93 + 0.05 * rib; chRough = 0.9; }
    float du = abs( vGar.x - 0.25 );     // distance round from the centre front (torso)
    bool body = gPart > 0.5 && gPart < 1.5;
    if ( cut > 4.5 && cut < 5.5 ) {
      // track jacket: a contrast stripe down each sleeve; zipped up the front, open at the neck over the shirt beneath
      if ( gPart > 1.5 && gPart < 2.5 ) { float sw = abs( vGar.w ); chCol = mix( chCol, chTop2 * ( 0.94 + 0.08 * folds ), smoothstep( 0.19, 0.16, sw ) ); chRough = mix( chRough, 0.6, smoothstep( 0.19, 0.16, sw ) ); }
      if ( body || ( gPart > 2.5 && gPart < 3.5 && vBind.y > 0.8 && vBind.y < 0.95 ) ) {
        float open = max( 0.0, vBind.y - 1.52 ) * 0.36;
        if ( du < open && body ) { chCol = chInner * ( 0.93 + 0.08 * folds ); chRough = 0.88; }
        float edge = smoothstep( 0.003, 0.0, abs( du - open ) ) * step( 0.001, open );
        chCol *= 1.0 - 0.45 * edge;
        float zip = step( du, 0.0048 ) * step( open, du - 0.0001 );
        float teeth = step( 0.45, fract( vBind.y * 280.0 ) ) * step( du, 0.0024 );
        chCol = mix( chCol, mix( vec3( 0.03 ), vec3( 0.5, 0.51, 0.53 ), teeth ), zip );
        chMetal = mix( chMetal, 0.85, zip * teeth ); chRough = mix( chRough, 0.35, zip );
        chBump += zip * teeth * 0.0004;
      }
    }
    if ( cut > 1.5 && cut < 2.5 && body ) { // tank top: armholes and a scoop neck show the skin
      float ca = cos( vGar.x * 6.2832 ), sa = sin( vGar.x * 6.2832 );
      float sk = smoothstep( 0.84, 0.87, abs( ca ) ) * smoothstep( 1.425, 1.445, vBind.y ) + smoothstep( 0.66, 0.7, sa ) * smoothstep( 1.505, 1.525, vBind.y ) + smoothstep( -0.7, -0.74, sa ) * smoothstep( 1.55, 1.57, vBind.y );
      float edge = smoothstep( 0.08, 0.0, abs( clamp( sk, 0.0, 1.0 ) - 0.5 ) );
      if ( sk > 0.5 ) { chCol = chSkin * ( 0.93 + 0.1 * chN( vBind * 38.0 ) ) * ( 0.97 + 0.06 * chN( vBind * 150.0 ) ); chRough = 0.62; chBump = ( chN( vBind * 1100.0 ) - 0.5 ) * 0.00012 * chFine; }
      else chCol *= 1.0 - 0.18 * edge;
    }
    if ( cut > 5.5 && body ) { // hoodie: kangaroo pocket
      float px = du / 0.1, py = ( vBind.y - 0.92 ) / 0.17;
      float inP = step( px, 1.0 ) * step( 0.0, py ) * step( py, 1.0 - px * 0.3 );
      float seam = inP * ( 1.0 - smoothstep( 0.0, 0.05, min( 1.0 - px, min( py, 1.0 - px * 0.3 - py ) ) ) );
      chCol *= 1.0 - seam * 0.3; chBump += seam * 0.0007 + inP * 0.0008;
    }
    if ( cut > 3.5 && cut < 4.5 && body ) { // button-up shirt: placket and buttons down the front
      chCol *= 1.0 - 0.12 * smoothstep( 0.0015, 0.0, abs( du - 0.013 ) ) * chFine;
      float bt = smoothstep( 0.0058, 0.0042, length( vec2( du * 1.05, ( fract( ( 1.585 - vBind.y ) / 0.088 ) - 0.5 ) * 0.088 ) ) ) * step( 0.98, vBind.y );
      chCol = mix( chCol, vec3( 0.84, 0.83, 0.8 ), bt ); chRough = mix( chRough, 0.3, bt ); chBump += bt * 0.0007;
    }
    if ( cut > 2.5 && cut < 3.5 && body && vBind.y > 1.43 ) { // polo: a short placket with two buttons
      chCol *= 1.0 - 0.14 * smoothstep( 0.0016, 0.0, abs( du - 0.012 ) ) * chFine;
      float by = vBind.y > 1.51 ? 1.545 : 1.48;
      float bt = smoothstep( 0.0052, 0.0038, length( vec2( du, vBind.y - by ) ) );
      chCol = mix( chCol, chTop2 * 0.95, bt ); chRough = mix( chRough, 0.3, bt );
    }
  }
} else if ( chReg < 6.5 ) {
  // bottoms
  float cut = chStyle.y;   // 0 trousers 1 jeans 2 joggers 3 cargo 4 shorts 5 skirt
  float folds = chN( vec3( vBind.x * 26.0, vBind.y * 40.0, vBind.z * 26.0 ) ) * 0.7 + chN( vBind * 60.0 ) * 0.3;
  chCol = chBottom * ( 0.92 + 0.1 * chN( vBind * 10.0 ) ) * ( 0.95 + 0.07 * folds );
  chRough = 0.8;
  float tw = sin( ( vBind.y * 1.0 + vBind.x * 0.6 + vBind.z * 0.6 ) * 2600.0 );
  chBump = ( folds - 0.5 ) * 0.003 + tw * 0.00003 * chFine;
  float sw = abs( vGar.w );
  if ( cut > 0.5 && cut < 1.5 ) { // denim: twill, worn lighter on the thighs and knees, gold stitching on the outer seams
    float dtw = sin( ( vBind.y - vBind.x * 0.8 - vBind.z * 0.8 ) * 2400.0 );
    float wear = smoothstep( 0.45, 0.8, chN( vBind * vec3( 7.0, 3.0, 7.0 ) ) ) * ( 0.5 + 0.5 * smoothstep( 0.75, 0.45, vBind.y ) );
    chCol = chBottom * ( 0.86 + 0.12 * ( 0.5 + 0.5 * dtw ) * chFine ) * ( 1.0 + wear * 0.35 ) * ( 0.95 + 0.07 * folds );
    chBump = ( folds - 0.5 ) * 0.0026 + dtw * 0.00005 * chFine;
    float seam = smoothstep( 0.035, 0.018, abs( sw - 0.06 ) ) + smoothstep( 0.035, 0.018, abs( sw - 0.11 ) );
    chCol = mix( chCol, vec3( 0.78, 0.55, 0.22 ), clamp( seam, 0.0, 1.0 ) * 0.5 * chFine * step( 9.5, gPart ) * step( gPart, 10.5 ) );
    chRough = 0.85;
  }
  if ( cut > 1.5 && cut < 2.5 && sw < 3.5 && gPart < 11.5 ) chCol = mix( chCol, chBottom2 * ( 0.95 + 0.06 * folds ), smoothstep( 0.17, 0.14, sw ) ); // joggers: side stripes
  if ( gPart > 10.5 && gPart < 12.5 && cut > 1.5 && cut < 2.5 ) { float rib = sin( vGar.x * 6.2832 * 140.0 ); chBump += rib * 0.0003 * chFine; chCol *= 0.93 + 0.05 * rib; } // waistband, ankle cuffs
  if ( cut < 0.5 && gPart > 9.5 && gPart < 10.5 ) chCol *= 1.0 + 0.07 * smoothstep( 0.02, 0.0, abs( vGar.x - 0.25 ) ) * chFine;   // trousers: a pressed crease
  if ( cut > 2.5 && cut < 3.5 && gPart > 13.5 ) { chCol *= 0.92; chCol *= 1.0 - 0.25 * smoothstep( 0.004, 0.0, abs( vGar.y - 0.05 ) ); } // cargo pockets: the flap
  if ( cut > 4.5 && gPart > 12.5 && gPart < 13.5 ) { chCol *= 0.9 + 0.1 * smoothstep( -0.3, 0.6, sin( vGar.x * 6.2832 * 18.0 ) ); } // skirt pleats
} else if ( chReg < 7.5 ) {
  // shoe uppers: canvas (sneakers, slip-ons) or leather (boots, dress shoes)
  float kind = chStyle.z, z = vGar.y, canvas = step( kind, 1.5 );
  float wv = sin( vBind.x * 2600.0 + vBind.z * 400.0 ) * sin( vBind.y * 2600.0 + vBind.z * 900.0 );
  chCol = chShoe * ( 0.9 + 0.12 * chN( vBind * 40.0 ) );
  chRough = mix( mix( 0.58, 0.45, step( 2.5, kind ) ), 0.86, canvas );
  chBump = canvas * wv * 0.00005 * chFine + ( 1.0 - canvas ) * ( chN( vBind * 260.0 ) - 0.5 ) * 0.00012;
  if ( kind < 0.5 ) { chCol *= 1.0 - 0.07 * step( 0.155, z ); chCol = mix( chCol, chShoe2 * 0.9, step( z, -0.058 ) * step( 0.05, vBind.y ) ); } // toe cap, heel tab
  if ( kind > 0.5 && kind < 1.5 && gPart < 31.5 ) { // slip-on: elastic gores at the sides of the opening
    float gore = step( 0.055, vBind.y ) * smoothstep( 0.012, 0.004, abs( z - 0.015 ) ) * step( abs( vGar.w ), 0.75 );
    chCol = mix( chCol, chShoe * 0.45, gore ); chBump += gore * sin( vBind.y * 3000.0 ) * 0.00012;
  }
  if ( gPart > 31.5 && gPart < 32.5 ) { chCol *= 0.8; chRough = 0.7; }   // padded collar round the opening
} else if ( chReg < 8.5 ) {
  // soles: rubber, with a stripe on slip-ons, tread underneath
  float hy = vBind.y;
  chCol = chShoe2 * ( 0.92 + 0.08 * chN( vBind * 60.0 ) ); chRough = 0.72;
  if ( chStyle.z > 0.5 && chStyle.z < 1.5 ) chCol = mix( chCol, chShoe * 0.9, smoothstep( 0.0024, 0.0012, abs( hy - 0.017 ) ) );
  if ( chStyle.z > 2.5 ) chRough = 0.45;
  chCol *= mix( 0.6, 1.0, smoothstep( 0.0, 0.004, hy ) );
  chBump = sin( vBind.z * 900.0 ) * 0.00018 * smoothstep( 0.006, 0.0, hy ) + sin( hy * 1500.0 ) * 0.00005 * chFine;
} else if ( chReg < 9.5 ) {
  // laces and cords
  chCol = chLace * ( 0.85 + 0.15 * chN( vBind * 300.0 ) ); chRough = 0.82; chBump = ( chN( vBind * 1500.0 ) - 0.5 ) * 0.00006;
} else if ( chReg < 10.5 ) {
  // hair: locks with strands along them, darker roots, dyed tips if chosen, lit along the strands (below)
  float lockP = step( 19.5, gPart ) * step( gPart, 20.5 );
  float t = vGar.y, lr = fract( vGar.w * 7.31 );
  float st = chN( vec3( vGar.x * 26.0 + lr * 17.0, t * 6.0 + lr * 3.0, lr * 11.0 ) );
  float st2 = chN( vec3( vBind.x * 900.0, vBind.y * 90.0, vBind.z * 900.0 ) );
  float s = mix( st2, st, lockP );
  vec3 hc = mix( chHair, chHair2, chFlags.w * smoothstep( 0.3, 1.0, t ) * lockP );
  chCol = hc * ( 0.62 + 0.38 * s ) * mix( 1.0, 0.82 + 0.36 * lr, lockP ) * mix( 1.0, mix( 0.72, 1.06, t ), lockP );
  chRough = mix( 0.62, 0.48, lockP ) + 0.14 * s;
  chBump = ( s - 0.5 ) * 0.00016 * chFine;
  chHairK = lockP;
} else if ( chReg < 11.5 ) {
  // eye: sclera, iris with a darker ring, pupil, wet
  vec3 ec = vec3( sign( chQ.x ) * chEyeA.x, chEyeA.y, chEyeA.z );
  vec3 e = normalize( chQ - ec );
  float a = acos( clamp( e.z, -1.0, 1.0 ) );
  vec3 iris = chIris * ( 0.75 + 0.5 * chN( vec3( e.xy * 60.0, 1.0 ) ) );
  chCol = vec3( 0.78, 0.74, 0.7 ) * ( 0.92 + 0.08 * e.z );
  chCol = mix( chCol, iris, smoothstep( 0.5, 0.44, a ) );
  chCol = mix( chCol, iris * 0.4, smoothstep( 0.44, 0.47, a ) * smoothstep( 0.52, 0.47, a ) );
  chCol = mix( chCol, vec3( 0.005 ), smoothstep( 0.2, 0.16, a ) );
  chRough = 0.05;
  // blinking: the upper lid slides down over the eyeball to the lower one
  if ( chBlink > 0.01 ) {
    vec2 eq = vec2( abs( chQ.x ), chQ.y );
    float elu = ( eq.x - chEyeA.x ) / chEyeB.x, elh = pow( max( 0.0, 1.0 - elu * elu ), 0.85 );
    float etop = chEyeA.y + chEyeB.y * elh + chEyeB.w * elu, ebot = chEyeA.y - chEyeB.z * elh + chEyeB.w * elu;
    float lidY = mix( etop + 0.002, ebot - 0.0006, chBlink );
    if ( eq.y > lidY ) { chCol = chSkin * 0.9; chRough = 0.55; }
    chCol = mix( chCol, chBrowC * 0.18, smoothstep( 0.0011, 0.0, abs( eq.y - lidY ) ) );
  }
} else if ( chReg < 12.5 ) { chCol = chExtra * ( 0.9 + 0.12 * chN( vBind * 20.0 ) ); chRough = 0.7; }
else if ( chReg < 13.5 ) { chCol = chCap * ( 0.9 + 0.12 * chN( vBind * 40.0 ) ); chRough = 0.6; chBump = ( chN( vBind * 700.0 ) - 0.5 ) * 0.0001 * chFine; }
else if ( chReg < 14.5 ) { chCol = vec3( 0.015 ); chRough = 0.3; }
else if ( chReg < 15.5 ) { chCol = vec3( 0.01, 0.012, 0.014 ); chRough = 0.05; chMetal = 0.4; }
else { chCol = vec3( 0.62, 0.62, 0.64 ); chRough = 0.28; chMetal = 0.9; }
diffuseColor.rgb = chCol;
`;
const CH_FS_BUMP = `
if ( chBump != 0.0 ) normal = chPerturb( - vViewPosition, normal, vec2( dFdx( chBump ), dFdy( chBump ) ), faceDirection );
`;
// strand highlights on locks of hair (two lobes along the strand direction, from the main light)
const CH_FS_HAIRLIGHT = `
if ( chHairK > 0.5 ) {
  vec3 hq0 = dFdx( - vViewPosition ), hq1 = dFdy( - vViewPosition );
  float ht0 = dFdx( vGar.y ), ht1 = dFdy( vGar.y );
  vec3 hT = cross( hq1, normal ) * ht0 + cross( normal, hq0 ) * ht1;
  if ( dot( hT, hT ) > 1e-16 ) {
    hT = normalize( hT );
    vec3 hL = normalize( ( viewMatrix * vec4( chKeyDir, 0.0 ) ).xyz ), hV = normalize( vViewPosition );
    vec3 hH = normalize( hL + hV );
    float c1 = dot( hT, hH ), s1 = sqrt( max( 0.0, 1.0 - c1 * c1 ) );
    float c2 = dot( hT, normalize( hH - normal * 0.3 ) ), s2 = sqrt( max( 0.0, 1.0 - c2 * c2 ) );
    float vis = smoothstep( -0.15, 0.45, dot( normal, hL ) );
    vec3 hs = ( vec3( pow( s1, 90.0 ) * 0.22 ) + diffuseColor.rgb * pow( s2, 30.0 ) * 0.6 ) * chKeyCol * vis;
    #ifdef GFX_SURF
    hs *= gfxSkyVis;
    #endif
    reflectedLight.directSpecular += hs;
  }
}
`;
// the per-look numbers → uniform values
function lookValues(L, cfg) {
  const F = faceOf(cfg), E = F.eye, female = cfg.female;
  const hair = C(L.hairColor), skin = C(L.skin), brow = BROWS[L.brow] || BROWS.normal;
  const fh = (FACIAL[L.fh] || FACIAL.none).slice(); fh[0] *= L.fhAmt;
  const bt = F.browThick * (female ? 0.72 : 1);
  return {
    chSkin: skin, chTop: C(L.topColor), chTop2: C(L.topColor2), chInner: C(L.innerColor), chBottom: C(L.bottomColor), chBottom2: C(L.bottomColor2),
    chShoe: C(L.shoeColor), chShoe2: C(L.soleColor), chHair: hair, chHair2: L.hairColor2 !== null ? C(L.hairColor2) : hair.clone(),
    chExtra: C(L.vest || 0x333333), chCap: C(L.cap || L.helmet || 0x222222), chIris: C(L.iris),
    chLip: L.lip !== null ? C(L.lip) : skin.clone().multiply(new T.Color(1.0, 0.6, 0.6)),
    chBrowC: L.browColor !== null ? C(L.browColor) : hair.clone(), chLace: C(L.laceColor !== null ? L.laceColor : (L.shoes === 'boot' || L.shoes === 'dress' ? 0x1a1714 : 0xf0eee8)),
    chFlags: new T.Vector4(L.bruises ? 1 : 0, L.tattoo ? 1 : 0, female ? 1 : 0, L.hairColor2 !== null ? 0.85 * (L.hairTips || 1) : 0),
    chFH: new T.Vector4(fh[0], fh[1], fh[2], fh[3]),
    chStyle: new T.Vector4((TOPS[L.top] || TOPS.tee).id, (BOTS[L.bottom] || BOTS.trousers).id, SHOES[L.shoes] || 0, PATTERNS[L.pattern] || 0),
    chEyeA: new T.Vector4(E.x, E.y, E.z, E.r), chEyeB: new T.Vector4(E.hw, E.up, E.lo, E.tilt),
    chBrowA: new T.Vector4(0.012 + (E.x - 0.0315) * 0.6, brow.len, F.browY, brow.arch * F.browArch),
    chBrowB: new T.Vector4(brow.tin * bt, brow.tout * bt, brow.slope + F.browTilt, 0),
    chMouth: new T.Vector4(-0.0705, F.mouthW, 0.75 + 0.25 * F.lips, 0), chNose: new T.Vector4(-0.043 - F.noseL, F.noseW, 0, 0),
    chHead: new T.Vector3().fromArray(headCentre(cfg)), chHeadK: HK(cfg),
  };
}
function setLook(m, L, cfg) {
  const u = m.userData.chU, vals = lookValues(L, cfg);
  for (const k in vals) { if (!u[k]) u[k] = { value: vals[k] }; else if (u[k].value && u[k].value.copy) u[k].value.copy(vals[k]); else u[k].value = vals[k]; }
}
// opts.crowd: colours per instance (the work hall) with a little typing / head movement in the vertex shader
function charMaterial(look, opts) {
  opts = opts || {};
  const L = G.normLook(look), cfg = opts.cfg || cfgOf(L, opts);
  const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, skinning: !opts.crowd });
  m.userData.chU = {
    chKeyDir: (G.gfxU && G.gfxU.gfxSunDir) || { value: new T.Vector3(0.3, 0.8, 0.5).normalize() },
    chKeyCol: (G.gfxU && G.gfxU.gfxSunCol) || { value: new T.Vector3(1, 1, 1) },
  };
  if (opts.crowd) m.userData.chU.chTime = G.gfxU ? G.gfxU.gfxTime : { value: 0 };
  else { m.userData.chU.chBlink = { value: 0 }; m.userData.chU.chTalk = { value: 0 }; }
  setLook(m, L, cfg);
  m.gfxNoMacro = true;
  const crowd = !!opts.crowd;
  m.onBeforeCompile = function (sh, renderer) {
    let vs, fsPars = CH_FS_PARS;
    // region ids are not blended across a triangle (WebGL2): no stray bands of other regions along the edges
    const flat = renderer && renderer.capabilities && renderer.capabilities.isWebGL2 ? 'flat ' : '';
    if (crowd) {
      vs = CH_VS_PARS + 'attribute vec3 aBind; attribute vec2 aAnim; attribute vec3 aSkin; attribute vec3 aShirt; attribute vec4 aPants;\nvarying vec3 vSkin; varying vec3 vShirt; varying vec3 vPants; varying vec3 vHairC; varying float vBlinkC; uniform float chTime;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vReg = aReg; vBind = aBind; vGar = aGar; vSkin = aSkin; vShirt = aShirt; vPants = aPants.rgb;
vHairC = vec3( 0.010, 0.0075, 0.006 ) * ( 0.6 + 1.2 * fract( aPants.a * 7.13 ) );
float chPh = aPants.a * 40.0;
transformed.y += aAnim.y * 0.006 * sin( chTime * 17.0 + chPh ) * step( -0.25, sin( chTime * 0.6 + chPh ) );
transformed.y += aAnim.x * 0.004 * sin( chTime * 0.8 + chPh );
transformed.x += aAnim.x * 0.01 * sin( chTime * 0.31 + chPh * 1.7 );
float chBt = fract( chTime / ( 3.0 + 3.5 * fract( aPants.a * 13.1 ) ) + aPants.a * 7.0 );
vBlinkC = smoothstep( 0.0, 0.015, chBt ) * smoothstep( 0.045, 0.028, chBt );`);
      fsPars = CH_FS_PARS.replace('uniform float chBlink; uniform float chTalk;', 'varying float vBlinkC;\n#define chBlink vBlinkC\n#define chTalk 0.0').replace('uniform vec3 chSkin; uniform vec3 chTop; uniform vec3 chBottom; uniform vec3 chHair;',
        'varying vec3 vSkin; varying vec3 vShirt; varying vec3 vPants; varying vec3 vHairC;\n#define chSkin vSkin\n#define chTop vShirt\n#define chBottom vPants\n#define chHair vHairC');
    } else vs = CH_VS_PARS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + CH_VS_MAIN);
    sh.vertexShader = vs.replace('varying float vReg;', flat + 'varying float vReg;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + fsPars.replace('varying float vReg;', flat + 'varying float vReg;'))
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + CH_FS_SURF)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = chRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = chMetal;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + CH_FS_BUMP)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + CH_FS_HAIRLIGHT);
    Object.assign(sh.uniforms, this.userData.chU);
    G.gfxPatch(sh, this);
  };
  return m;
}
G.charMaterial = charMaterial;

// ---------------- the person ----------------
// o: a look (either form) plus props — torch / stun close the hands into fists; lod: 0 full, 1 lighter, 2 crowd
G.buildPerson = function (o) {
  o = o || {};
  const L = G.normLook(o), cfg = cfgOf(L, o);
  const geo = bodyGeo(cfg), mat = charMaterial(L, { cfg });
  const g = new T.Group(); g.userData.human = true;
  const bone = (name, x, y, z, parent) => { const b = new T.Bone(); b.name = name; b.position.set(x, y, z); parent.add(b); return b; };
  const D = dimsOf(cfg.female);
  const hips = bone('hips', 0, D.hipsY, 0, g);
  const spine = bone('spine', 0, 0, 0, hips);
  const headB = bone('head', 0, D.headY, 0, spine);
  const armL = bone('armL', -D.shX, D.shY, 0, spine), elL = bone('elL', 0, -D.upper, 0, armL);
  const armR = bone('armR', D.shX, D.shY, 0, spine), elR = bone('elR', 0, -D.upper, 0, armR);
  const legL = bone('legL', -D.hipX, D.hipDY, 0, hips), knL = bone('knL', 0, -D.thigh, 0, legL), ankL = bone('ankL', 0, -D.shin, 0, knL);
  const legR = bone('legR', D.hipX, D.hipDY, 0, hips), knR = bone('knR', 0, -D.thigh, 0, legR), ankR = bone('ankR', 0, -D.shin, 0, knR);
  const toeL = bone('toeL', 0, MTP_H - D.ankleH, D.toeBall, ankL), toeR = bone('toeR', 0, MTP_H - D.ankleH, D.toeBall, ankR);
  const mesh = new T.SkinnedMesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  g.add(mesh);
  g.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton([hips, spine, headB, armL, elL, armR, elR, legL, knL, legR, knR, ankL, ankR, toeL, toeR]), mesh.matrixWorld);
  g.scale.setScalar(heightScale(L));
  const H = { group: g, hips, spine, head: headB, armL, armR, elL, elR, legL, legR, knL, knR, ankL, ankR, toeL, toeR, torso: mesh, body: mesh, look: L, cfg, cfgKey: JSON.stringify(cfg), lodBase: cfg.lod, dims: D };
  if (cfg.lod < 2) LIVE.add(H);
  return H;
};
// level of detail by distance: full bodies close to the camera, lighter ones further off, crowd bodies far away
// (geometries are shared and cached; at most one new one is built per frame)
const LIVE = new Set(), _lp = new T.Vector3();
G.updateHumanLods = function () {
  const cam = G.camera.position; let built = 0;
  // full detail within LN m, lighter to LF m, crowd bodies beyond (phones switch sooner)
  const GP = G.gfx && G.gfx.P, LN = (GP && GP.lodNear) || 8, LF = (GP && GP.lodFar) || 24;
  for (const H of LIVE) {
    let top = H.group; while (top.parent) top = top.parent;
    if (top !== G.scene) { if (!H.group.parent || top.isScene) LIVE.delete(H); continue; }
    if (!H.group.visible || H.ownGeo) continue;
    H.group.getWorldPosition(_lp);
    const d = _lp.distanceTo(cam), cur = H.cfg.lod;
    let want = d < LN ? H.lodBase : d < LF ? Math.max(1, H.lodBase) : 2;
    if (want === cur) continue;
    if (want > cur && d < (cur === H.lodBase ? LN * 1.19 : LF * 1.125)) continue;   // a little hysteresis
    if (want < cur && d > (cur === 2 ? LF * 0.875 : LN * 0.81)) continue;
    const cfg = Object.assign({}, H.cfg, { lod: want }), key = JSON.stringify(cfg);
    if (!GEO.has(key) && built++ > 0) continue;
    H.body.geometry = bodyGeo(cfg); H.cfg = cfg; H.cfgKey = key;
  }
};
if (G.render) { const r0 = G.render; G.render = function () { G.updateHumanLods(); return r0.apply(this, arguments); }; }
// re-cut a built person for a new look in place: same bones, new body geometry if the cut changed, new colours
G.restyle = function (H, look, opts) {
  opts = opts || {};
  if (opts.lod !== undefined) H.lodBase = opts.lod;
  const L = G.normLook(look), cfg = cfgOf(L, { lod: opts.lod !== undefined ? opts.lod : H.cfg.lod, fistL: H.cfg.fistL, fistR: H.cfg.fistR });
  const key = JSON.stringify(cfg);
  if (key !== H.cfgKey) {
    const old = H.body.geometry;
    H.body.geometry = opts.noCache ? buildBody(cfg) : bodyGeo(cfg);
    if (H.ownGeo && old) old.dispose();
    H.ownGeo = !!opts.noCache;
    H.cfgKey = key; H.cfg = cfg;
  }
  // a man's and a woman's skeleton differ (shoulder width, arm length, hips): put the joints where the new body has them
  const D = dimsOf(cfg.female);
  if (H.dims && H.dims !== D) rebind(H, D);
  setLook(H.body.material, L, cfg);
  H.group.scale.setScalar(heightScale(L));
  H.look = L;
  return H;
};
function rebind(H, D) {
  const g = H.group, keep = { p: g.position.clone(), q: g.quaternion.clone(), s: g.scale.clone(), parent: g.parent };
  if (keep.parent) keep.parent.remove(g);
  g.position.set(0, 0, 0); g.quaternion.identity(); g.scale.set(1, 1, 1);
  for (const b of H.body.skeleton.bones) b.quaternion.identity();
  H.hips.position.set(0, D.hipsY, 0); H.spine.position.set(0, 0, 0); H.head.position.set(0, D.headY, 0);
  H.armL.position.set(-D.shX, D.shY, 0); H.armR.position.set(D.shX, D.shY, 0); H.elL.position.set(0, -D.upper, 0); H.elR.position.set(0, -D.upper, 0);
  H.legL.position.set(-D.hipX, D.hipDY, 0); H.legR.position.set(D.hipX, D.hipDY, 0); H.knL.position.set(0, -D.thigh, 0); H.knR.position.set(0, -D.thigh, 0);
  if (H.ankL) { H.ankL.position.set(0, -D.shin, 0); H.ankR.position.set(0, -D.shin, 0); }
  if (H.toeL) { H.toeL.position.set(0, MTP_H - D.ankleH, D.toeBall); H.toeR.position.set(0, MTP_H - D.ankleH, D.toeBall); }
  g.updateMatrixWorld(true);
  H.body.skeleton.calculateInverses();
  H.body.bind(H.body.skeleton, H.body.matrixWorld);
  g.position.copy(keep.p); g.quaternion.copy(keep.q); g.scale.copy(keep.s);
  if (keep.parent) keep.parent.add(g);
  H.dims = D;
  for (const b of [H.armL, H.armR]) delete b.userData.base;
}
G.lookHeight = heightScale;

// ---------------- crowds: posed, static, instanced ----------------
// For rows of people who barely move (the work hall): one body is posed once, its skinning baked into a plain mesh,
// and drawn as an InstancedMesh — skin, shirt, trousers and hair shade come per instance, and a little typing / head
// movement is added in the vertex shader. Same sculpted body and shading as everyone else, at crowd cost.
// a lighter copy of a mesh for far-away instances: vertices closer than `cell` are merged (per surface region, so skin,
// shirt and trousers keep their borders), triangles that collapse are dropped. Several times fewer triangles, same shape
// from a distance.
G.decimate = function (g, cell) {
  const pos = g.attributes.position, n = pos.count, reg = g.attributes.aReg, idx = g.index.array;
  const map = new Int32Array(n), cells = new Map(), reps = [], sum = [];
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = Math.floor(x / cell) + ',' + Math.floor(y / cell) + ',' + Math.floor(z / cell) + ',' + (reg ? Math.round(reg.getX(i)) : 0);
    let k = cells.get(key);
    if (k === undefined) { k = reps.length; cells.set(key, k); reps.push(i); sum.push(0, 0, 0, 0); }
    map[i] = k; sum[k * 4] += x; sum[k * 4 + 1] += y; sum[k * 4 + 2] += z; sum[k * 4 + 3]++;
  }
  const out = new T.BufferGeometry();
  for (const name in g.attributes) {
    if (name === 'normal') continue;
    const a = g.attributes[name], sz = a.itemSize, arr = new a.array.constructor(reps.length * sz);
    reps.forEach((i, k) => { for (let c = 0; c < sz; c++) arr[k * sz + c] = a.array[i * sz + c]; });
    out.setAttribute(name, new T.BufferAttribute(arr, sz, a.normalized));
  }
  const P = out.attributes.position.array;
  for (let k = 0; k < reps.length; k++) { const w = sum[k * 4 + 3]; P[k * 3] = sum[k * 4] / w; P[k * 3 + 1] = sum[k * 4 + 1] / w; P[k * 3 + 2] = sum[k * 4 + 2] / w; }
  const tri = [];
  for (let t = 0; t < idx.length; t += 3) { const a = map[idx[t]], b = map[idx[t + 1]], c = map[idx[t + 2]]; if (a !== b && b !== c && a !== c) tri.push(a, b, c); }
  out.setIndex(tri); out.computeVertexNormals(); out.computeBoundingSphere();
  return out;
};
G.posedBody = function (o, pose) {
  const p = G.buildPerson(Object.assign({ lod: 2 }, o));
  p.group.scale.setScalar(1); // baked at scale 1: G.crowd gives each instance its height
  pose(p);
  p.group.updateMatrixWorld(true);
  const sk = p.body, src = sk.geometry, n = src.attributes.position.count, v = new T.Vector3();
  const pos = new Float32Array(n * 3), anim = new Float32Array(n * 2), SI = src.attributes.skinIndex, SW = src.attributes.skinWeight;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(src.attributes.position, i); sk.boneTransform(i, v); v.toArray(pos, i * 3);
    let hw = 0, fw = 0;
    const bi = [SI.getX(i), SI.getY(i)], bw = [SW.getX(i), SW.getY(i)];
    for (let k = 0; k < 2; k++) { if (bi[k] === HEAD) hw += bw[k]; if (bi[k] === EL_L || bi[k] === EL_R) fw += bw[k]; }
    anim[i * 2] = hw; anim[i * 2 + 1] = fw;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('aBind', new T.Float32BufferAttribute(src.attributes.position.array.slice(), 3));
  g.setAttribute('aReg', new T.Float32BufferAttribute(src.attributes.aReg.array.slice(), 1));
  g.setAttribute('aGar', new T.Float32BufferAttribute(src.attributes.aGar.array.slice(), 4));
  g.setAttribute('aAnim', new T.Float32BufferAttribute(anim, 2));
  g.setIndex(new T.BufferAttribute(src.index.array.slice(), 1));
  g.computeVertexNormals(); g.computeBoundingSphere();
  sk.material.dispose();
  return g;
};
G.crowdMaterial = function (female, o) { return charMaterial(Object.assign({ sex: female ? 'f' : 'm' }, o || {}), { crowd: true, lod: 2 }); };
// people: [{ x, y, z, ry, skin, shirt, pants, female }] → per body type an InstancedMesh of crowd bodies, plus a few
// detailed bodies that take over for whoever is closest to the camera (swapped a few times a second)
G.crowd = function (people, pose, o) {
  o = o || {};
  const GP = G.gfx && G.gfx.P, PHONE = !!(GP && GP.crowd);
  const NEAR = o.near || (PHONE ? 9 : 7), NMAX = o.nearMax !== undefined ? o.nearMax : PHONE ? 24 : (GP && GP.tex <= 512 ? 0 : 10);
  const groups = [], zero = new T.Matrix4().makeScale(0, 0, 0);
  for (const female of [false, true]) {
    const list = people.filter((q) => !!q.female === female); if (!list.length) continue;
    const look = { sex: female ? 'f' : 'm', top: o.longSleeve ? 'longtee' : 'tee' };
    const mat = G.crowdMaterial(female, look), n = list.length, k = female ? 0.91 : 0.95;
    const mk = (lod, cnt, cell) => {
      let geo = G.posedBody(Object.assign({ lod }, look), pose);
      if (cell) geo = G.decimate(geo, cell);
      geo.setAttribute('aSkin', new T.InstancedBufferAttribute(new Float32Array(cnt * 3), 3));
      geo.setAttribute('aShirt', new T.InstancedBufferAttribute(new Float32Array(cnt * 3), 3));
      geo.setAttribute('aPants', new T.InstancedBufferAttribute(new Float32Array(cnt * 4), 4));
      const im = new T.InstancedMesh(geo, mat, cnt);
      im.castShadow = o.cast !== false; im.receiveShadow = true;
      (o.parent || G.root || G.scene).add(im);
      return im;
    };
    const far = PHONE ? mk(2, n, 0.04) : mk(2, n), near = NMAX ? mk(PHONE ? 2 : 1, Math.min(NMAX, n)) : null;
    const q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(k, k, k), lo = new T.Vector3(1e9, 1e9, 1e9), hi = lo.clone().negate();
    list.forEach((pp, i) => {
      pp.m = new T.Matrix4().compose(new T.Vector3(pp.x, pp.y || 0, pp.z), q.setFromEuler(e.set(0, pp.ry || 0, 0)), sc);
      pp.cs = C(pp.skin).toArray(); pp.ch = C(pp.shirt).toArray(); pp.cp = C(pp.pants).toArray().concat([Math.random()]);
      far.setMatrixAt(i, pp.m);
      far.geometry.attributes.aSkin.set(pp.cs, i * 3); far.geometry.attributes.aShirt.set(pp.ch, i * 3); far.geometry.attributes.aPants.set(pp.cp, i * 4);
      lo.min(new T.Vector3(pp.x, 0, pp.z)); hi.max(new T.Vector3(pp.x, 1.8, pp.z));
    });
    // one bounding sphere around the whole crowd, so it is skipped when the room is out of view
    const bs = new T.Sphere(lo.clone().add(hi).multiplyScalar(0.5), lo.distanceTo(hi) / 2 + 1.5);
    for (const im of [far, near]) if (im) { im.geometry.boundingSphere = bs; im.frustumCulled = true; }
    if (near) near.count = 0;
    groups.push({ list, far, near, cur: [] });
  }
  if (!NMAX) return groups;
  let acc = 1;
  G.tickers.push((dt) => {
    acc += dt; if (acc < 0.2) return; acc = 0;
    const c = G.camera.position;
    for (const g of groups) {
      const want = [];
      g.list.forEach((pp, i) => { const d = (pp.x - c.x) ** 2 + (pp.z - c.z) ** 2 + ((pp.y || 0) + 1 - c.y) ** 2; if (d < NEAR * NEAR) want.push([d, i]); });
      want.sort((a, b) => a[0] - b[0]);
      const ids = want.slice(0, g.near.instanceMatrix.count).map((w) => w[1]);
      if (ids.length === g.cur.length && ids.every((v, j) => v === g.cur[j])) continue;
      for (const i of g.cur) g.far.setMatrixAt(i, g.list[i].m);
      const na = g.near.geometry.attributes;
      ids.forEach((i, j) => { const pp = g.list[i]; g.far.setMatrixAt(i, zero); g.near.setMatrixAt(j, pp.m); na.aSkin.set(pp.cs, j * 3); na.aShirt.set(pp.ch, j * 3); na.aPants.set(pp.cp, j * 4); });
      na.aSkin.needsUpdate = na.aShirt.needsUpdate = na.aPants.needsUpdate = true;
      g.near.count = ids.length; g.near.instanceMatrix.needsUpdate = true; g.far.instanceMatrix.needsUpdate = true;
      g.cur = ids;
    }
  });
  return groups;
};

// ---------------- dog ----------------
// Same idea for the guard dogs: a lofted body, neck, head with muzzle and ears, four legs and a tail, all skinned to
// the nodes the dog animation already moves (body, head, legs, tail). Short fur in the shader.
G.buildDog = function (o) {
  const B = new Builder();
  const BODY = 0, HD = 1, L0 = 2, L1 = 3, L2 = 4, L3 = 5, TAIL = 6;
  const w1 = (b) => [[b, 1]];
  // body along z (chest +z), from rump (-0.45) to chest (0.38); body node at y 0.55
  const rows = [[-0.47, 0.06, 0.07, 0.03], [-0.42, 0.12, 0.13, 0.02], [-0.3, 0.135, 0.15, 0.0], [-0.12, 0.125, 0.14, -0.01], [0.05, 0.13, 0.16, 0.0], [0.2, 0.14, 0.175, 0.01], [0.32, 0.12, 0.16, 0.03], [0.4, 0.08, 0.1, 0.08]];
  B.loft(rows.map(([z, rx, ry, dy]) => ({ c: [0, 0.55 + dy, z], ax: X, ay: Y, rx, ry, pw: 2.2, reg: 0, w: w1(BODY) })), 22, [0, 0, -0.03], null);
  const hc = [0, 0.73, 0.45];
  B.loft([[0.36, 0.62, 0.075, 0.09, BODY], [0.42, 0.68, 0.068, 0.08, HD], [0.46, 0.73, 0.075, 0.08, HD]].map(([z, y, rx, ry, b]) => ({ c: [0, y, z], ax: X, ay: Y, rx, ry, pw: 2, reg: 0, w: w1(b) })), 16);
  // skull + muzzle
  B.sphere(24, 16, (dx, dy, dz) => [hc[0] + dx * 0.085, hc[1] + 0.02 + dy * 0.08, hc[2] + 0.05 + dz * 0.095], 0, w1(HD));
  B.loft([[0.12, 0.05, 0.048, 0.0], [0.2, 0.04, 0.038, -0.012], [0.27, 0.03, 0.03, -0.02]].map(([dz, rx, ry, dy]) => ({ c: [0, hc[1] + dy, hc[2] + dz], ax: X, ay: Y, rx, ry, pw: 2.2, reg: 0, w: w1(HD) })), 14, null, [0, 0, 0.01]);
  B.sphere(8, 6, (dx, dy, dz) => [dx * 0.016, hc[1] - 0.012 + dy * 0.013, hc[2] + 0.285 + dz * 0.012], 2, w1(HD)); // nose
  for (const s of [-1, 1]) {
    B.sphere(8, 6, (dx, dy, dz) => [s * 0.04 + dx * 0.011, hc[1] + 0.04 + dy * 0.011, hc[2] + 0.12 + dz * 0.008], 3, w1(HD)); // eyes
    B.loft([{ c: [s * 0.05, hc[1] + 0.08, hc[2] + 0.02], ax: Z, ay: X, rx: 0.03, ry: 0.008, pw: 2, reg: 0, w: w1(HD) }, { c: [s * 0.06, hc[1] + 0.16, hc[2] + 0.01], ax: Z, ay: X, rx: 0.012, ry: 0.004, pw: 2, reg: 0, w: w1(HD) }], 8, null, [0, 0.02, 0]); // ears
  }
  // legs: pivots at body (±0.11, -0.1, ±0.3) → feet on the ground
  [[-0.11, 0.3, L0], [0.11, 0.3, L1], [-0.11, -0.3, L2], [0.11, -0.3, L3]].forEach(([x, z, b]) => {
    const hind = z < 0;
    const pts = hind ? [[0.48, 0.07, 0.06, -0.01], [0.36, 0.05, 0.05, -0.04], [0.24, 0.032, 0.032, -0.02], [0.12, 0.025, 0.027, 0.01], [0.04, 0.024, 0.026, 0.015]] : [[0.48, 0.055, 0.06, 0.0], [0.34, 0.04, 0.045, 0.01], [0.2, 0.028, 0.03, 0.0], [0.08, 0.024, 0.026, 0.0], [0.035, 0.026, 0.03, 0.01]];
    B.loft(pts.map(([y, rx, rz, dz]) => ({ c: [x, y, z + dz], ax: X, ay: Z, rx, ry: rz, pw: 2, reg: 0, w: w1(b) })), 12, [0, 0.02, 0], [0, -0.03, 0.012]);
  });
  // tail
  B.loft([[-0.44, 0.62, 0.025], [-0.6, 0.6, 0.022], [-0.75, 0.55, 0.016], [-0.84, 0.5, 0.008]].map(([z, y, r]) => ({ c: [0, y, z], ax: X, ay: Y, rx: r, ry: r, pw: 2, reg: 0, w: w1(TAIL) })), 10, null, [0, -0.01, -0.01]);
  const geo = B.geometry();
  const fur = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, skinning: true });
  fur.userData.chU = { dogCol: { value: C(o.color || 0x2a2018) } };
  fur.gfxNoMacro = true;
  fur.onBeforeCompile = function (sh) {
    sh.vertexShader = CH_VS_PARS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + CH_VS_MAIN);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 dogCol;\nvarying float vReg; varying vec3 vBind; varying vec4 vGar;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dReg = floor( vReg + 0.5 ); float dRough = 0.85; float dBump = 0.0;
        float fz = chN( vec3( vBind.x * 900.0, vBind.y * 900.0, vBind.z * 160.0 ) );
        vec3 dc = dogCol * ( 0.8 + 0.3 * chN( vBind * 14.0 ) ) * ( 0.85 + 0.25 * fz );
        dc = mix( dc, dogCol * 0.45, smoothstep( 0.62, 0.5, vBind.y ) * 0.4 );
        if ( dReg > 1.5 && dReg < 2.5 ) { dc = vec3( 0.01 ); dRough = 0.25; }
        else if ( dReg > 2.5 ) { dc = vec3( 0.02, 0.012, 0.005 ); dRough = 0.05; }
        else dBump = ( fz - 0.5 ) * 0.0006 * smoothstep( 6.0, 1.5, length( vViewPosition ) );
        diffuseColor.rgb = dc;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = dRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif ( dBump != 0.0 ) normal = chPerturb( - vViewPosition, normal, vec2( dFdx( dBump ), dFdy( dBump ) ), faceDirection );');
    Object.assign(sh.uniforms, this.userData.chU);
    G.gfxPatch(sh, this);
  };
  const g = new T.Group();
  const bone = (x, y, z, p) => { const b = new T.Bone(); b.position.set(x, y, z); p.add(b); return b; };
  const body = bone(0, 0.55, 0, g), headB = bone(0, 0.18, 0.45, body);
  const legs = [[-0.11, 0.3], [0.11, 0.3], [-0.11, -0.3], [0.11, -0.3]].map(([x, z]) => bone(x, -0.1, z, body));
  const tail = bone(0, 0.1, -0.42, body);
  const mesh = new T.SkinnedMesh(geo, fur); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; g.add(mesh);
  g.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton([body, headB].concat(legs, [tail])), mesh.matrixWorld);
  return { group: g, body, head: headB, legs, tail, dog: true, mesh };
};

// ---------------- shared with wardrobe.js / creator.js ----------------
G.HUM = {
  Builder, R, PT, TOPS, BOTS, SHOES, PATTERNS, BROWS, FACIAL, FACE_KEYS, W1, W2, X, Y, Z,
  HIPS, SPINE, HEAD, ARM_L, EL_L, ARM_R, EL_R, LEG_L, KN_L, LEG_R, KN_R, ANK_L, ANK_R, TOE_L, TOE_R, MTP_H, DIMS, dimsOf, sleevePad,
  sstep, lerp, angd, vnoise, rng, v3, rowAt, samples, headCentre, HK, faceOf, sculpt, hairLine, shellHair, LEG_ROWS, ARM_ROWS, TORSO_M, TORSO_F,
  buildBody, cfgOf, lookValues, setLook,
  hair: null, wear: null,
};
})(window.G);
