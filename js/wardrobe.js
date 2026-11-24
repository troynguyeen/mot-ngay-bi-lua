// wardrobe.js — the parts of a person that are not the body: hair grown lock by lock over the scalp, shoes built on
// real soles, and the pieces garments add on top of the body's cut (collars, the hood, cords, the zip pull, pockets,
// the skirt). Everything here is added to the same skinned mesh as the body (humans.js) and shaded by its shader.
(function (G) {
'use strict';
const H = G.HUM;
const { R, PT, TOPS, BOTS, W1, W2, X, Y, Z, sstep, lerp, v3, rng, headCentre, HK, faceOf, hairLine, shellHair, HIPS, SPINE, HEAD, LEG_L, LEG_R, KN_L, KN_R, ANK_L, ANK_R, dimsOf } = H;
// the front of the trunk at a height (for things worn on the front: zips, cords)
const frontZ = (cfg, y, pad) => { const r = H.rowAt(cfg.female ? H.TORSO_F : H.TORSO_M, y); return r[1] * (1 + (cfg.build - 0.5) * 0.07) + r[2] + pad; };

// ---------------- hair ----------------
// Each style decides where locks grow, which way they are combed, how long they are, how they fall and wave, and
// where they are gathered (ponytail, bun). Locks are flattened tubes that taper to the tip; a thin shell on the
// scalp underneath keeps the skin from showing between them.
const fib = (i, n) => { const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.399963; return [Math.cos(a) * r, y, Math.sin(a) * r]; };
const away = (d, W) => v3.norm(v3.sub(v3.mul(d, v3.dot(d, W)), W));       // tangent at d pointing away from W
const downT = (d) => v3.norm([d[0] * d[1], d[1] * d[1] - 1, d[2] * d[1]]);  // tangent at d pointing down the head
const tang = (d, v) => { const t = v3.sub(v, v3.mul(d, v3.dot(v, d))); return v3.len(t) < 1e-6 ? downT(d) : v3.norm(t); };
function hairCtx(cfg, fn) {
  const HC = headCentre(cfg), k = HK(cfg), F = faceOf(cfg);
  const C0 = [HC[0], HC[1], HC[2]];
  const ax = (0.0775 * F.w + 0.001) * k, ay = 0.1125 * k, azf = 0.087 * k, azb = 0.105 * k;
  const browY = HC[1] + (F.browY + 0.008) * k;
  // keep a point outside the head (+ layer), the neck, and behind the shoulders for long hair
  const coll = (p, L, long) => {
    let d = v3.sub(p, C0);
    const az = (d[2] > 0 ? azf : azb) + L;
    const e = (d[0] / (ax + L)) ** 2 + (d[1] / (ay + L)) ** 2 + (d[2] / az) ** 2;
    if (e < 1) { d = v3.mul(d, 1 / Math.sqrt(e)); p = v3.add(C0, d); }
    // in front of the face: never below the brows
    if (p[2] > HC[2] + 0.02 * k && Math.abs(p[0]) < 0.08 * k && p[1] < browY && p[1] > HC[1] - 0.13 * k) {
      if (Math.abs(p[0]) < 0.04 * k && p[2] > HC[2] + 0.05 * k) p = [p[0], browY, p[2]];
      else p = [Math.sign(p[0] || 1) * 0.08 * k, p[1], Math.min(p[2], HC[2] + 0.07 * k)];
    }
    if (long) {
      // neck
      if (p[1] < HC[1] - 0.07 * k && p[1] > 1.35) {
        const nx = p[0], nz = p[2] + 0.012, r = Math.hypot(nx, nz), R0 = 0.07 + L;
        if (r < R0) { const s = R0 / (r || 1); p = [nx * s, p[1], nz * s - 0.012]; }
      }
      // shoulders and back: long hair falls behind them
      if (p[1] < 1.63 && Math.abs(p[0]) < 0.27) {
        const zb = lerp(-0.07, -0.135, sstep(1.63, 1.5, p[1])) - L;
        if (p[2] > zb) p = [p[0], p[1], zb];
      }
    }
    return p;
  };
  return { HC, k, F, C0, coll, browY, fn, lod: cfg.lod || 0 };
}
// grow one lock from scalp direction d (unit) combed along tangent dir
function growLock(ctx, d, dir, o) {
  const S = ctx.fn(d[0], d[1], d[2]), n = v3.norm(v3.sub(S, ctx.C0));
  const pts = [v3.add(S, v3.mul(n, -0.0015))];
  let p = pts[0], dd = v3.norm(v3.add(dir, v3.mul(n, o.lift || 0)));
  const seg = o.seg, step = o.len / seg;
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    dd = v3.norm(v3.add(dd, [0, -(o.grav || 0) * step * 14 * Math.pow(t, o.stiff || 1), 0]));
    if (o.target) { const tq = v3.sub(o.target, p), l = v3.len(tq); if (l > 1e-4) dd = v3.norm(v3.add(v3.mul(dd, 1 - o.pull), v3.mul(tq, o.pull / l))); }
    if (o.long && p[1] < ctx.C0[1] - 0.04) {
      const zb = lerp(-0.05, -0.125, sstep(1.66, 1.52, p[1])), pen = p[2] - (zb - 0.02);
      if (pen > 0) dd = v3.norm(v3.add(dd, [0, 0, -pen * 18]));
    }
    let np = v3.add(p, v3.mul(dd, step));
    const cp = ctx.coll(np, (o.layer || 0.004) + (o.layerGrow || 0.006) * t, o.long);
    if (cp !== np) {
      const nn = v3.norm(v3.sub(cp, ctx.C0)), td = v3.sub(dd, v3.mul(nn, v3.dot(dd, nn)));
      if (v3.len(td) > 1e-6) dd = v3.norm(td);
      np = cp;
    }
    p = np; pts.push(p);
  }
  return pts;
}
// waves / curls: offset each point sideways (and around for curls) along the lock
function shapeLock(ctx, pts, o, r) {
  if (!o.wave && !o.curl) return pts;
  const out = [pts[0]]; let s = 0;
  for (let i = 1; i < pts.length; i++) {
    s += v3.len(v3.sub(pts[i], pts[i - 1]));
    const t = v3.norm(v3.sub(pts[i], pts[i - 1])), nrm = v3.norm(v3.sub(pts[i], [ctx.C0[0], Math.min(pts[i][1], ctx.C0[1]), ctx.C0[2]]));
    const side = v3.norm(v3.cross(t, nrm)), ramp = sstep(0, 0.03, s);
    let off = [0, 0, 0];
    if (o.wave) off = v3.mul(side, Math.sin(s / o.wave[1] * 6.283 + r * 6.283) * o.wave[0] * ramp);
    if (o.curl) { const a = s / o.curl[1] * 6.283 + r * 6.283; off = v3.add(v3.mul(side, Math.cos(a) * o.curl[0] * ramp), v3.mul(nrm, (Math.sin(a) + 1) * o.curl[0] * 0.8 * ramp)); }
    out.push(v3.add(pts[i], off));
  }
  return out;
}
function addLock(B, ctx, pts, o, r) {
  const w0 = o.w * 1.75 * (0.8 + 0.45 * r), t0 = Math.max((o.th || o.w * 0.33) * 2.1, w0 * 0.36) * (0.85 + 0.3 * r);
  const k = ctx.k, C0 = ctx.C0, long = o.long;
  const tip = o.tip !== undefined ? o.tip : 0.12;
  B.tube(pts, (i, n) => { const t = i / (n - 1), tap = lerp(1, tip, Math.pow(t, 1.25)) * (i === 0 ? 0.7 : 1); return [w0 * tap, t0 * tap]; }, ctx.lod ? 5 : 7, R.hair,
    (i, p) => (long && p[1] < C0[1] - 0.09 * k ? W2(HEAD, SPINE, sstep(C0[1] - 0.09 * k, C0[1] - 0.2 * k, p[1])) : W1(HEAD)),
    { normal: (i, p) => v3.norm(v3.sub(p, [C0[0], Math.min(p[1], C0[1]), C0[2]])), part: PT.lock, gw: r, capB: 0.002 });
}
const HAIR = {};
// short crop: combed away from the crown, a little lifted and forward at the front
HAIR.short = (B, cfg, ctx, rnd, N) => {
  const W = v3.norm([0, 0.78, -0.62]);
  for (let i = 0; i < Math.round(N * 2.2); i++) {
    const d = fib(i, Math.round(N * 2.2)), th = Math.abs(Math.atan2(d[0], d[2]));
    if (d[1] < hairLine(false, th) / 0.112 + 0.12) continue;
    let dir = away(d, W);
    const front = sstep(0.35, 0.75, d[2]) * sstep(0.2, 0.6, d[1]);
    dir = tang(d, v3.add(v3.mul(dir, 1 - front), v3.mul([0, 0.45, 1], front)));
    const top = sstep(0.25, 0.7, d[1]);
    const r = rnd();
    addLock(B, ctx, growLock(ctx, d, dir, { len: lerp(0.012, 0.05, top) * (0.85 + 0.3 * r), seg: 6, grav: 0.25, lift: lerp(0.0, 0.1, top), layer: 0.002, layerGrow: lerp(0.0015, 0.005, top) }), { w: lerp(0.0055, 0.0085, top), th: 0.0022, tip: 0.3 }, r);
  }
};
// side part: the top swept across from a parting on the right, short back and sides
HAIR.side = (B, cfg, ctx, rnd, N) => {
  const partX = 0.32;
  for (let i = 0; i < Math.round(N * 2.2); i++) {
    const d = fib(i, Math.round(N * 2.2)), th = Math.abs(Math.atan2(d[0], d[2]));
    if (d[1] < hairLine(false, th) / 0.112 + 0.12) continue;
    const top = sstep(0.35, 0.75, d[1]), side = d[0] > partX ? 1 : -1;
    let dir = tang(d, v3.add(v3.mul([side * 1.0, -0.05, -0.35], top), v3.mul(downT(d), 1 - top)));
    if (d[1] < 0.5) dir = tang(d, v3.add(downT(d), [0, 0, -0.6]));
    const r = rnd();
    const len = lerp(0.03, side < 0 ? 0.1 : 0.06, top) * (0.85 + 0.3 * r);
    addLock(B, ctx, shapeLock(ctx, growLock(ctx, d, dir, { len, seg: 7, grav: 0.5, lift: lerp(0.0, 0.08, top), layer: 0.003, layerGrow: 0.005, stiff: 1.2 }), { wave: [0.002, 0.07] }, r), { w: lerp(0.0065, 0.0085, top), th: 0.0026 }, r);
  }
};
// wavy, layered, to the jaw: parted in the middle, the front falling to the sides of the face
HAIR.wavy = (B, cfg, ctx, rnd, N) => {
  const W = v3.norm([0, 0.82, -0.57]);
  for (let i = 0; i < Math.round(N * 2.2); i++) {
    const d = fib(i, Math.round(N * 2.2)), th = Math.abs(Math.atan2(d[0], d[2]));
    if (d[1] < hairLine(true, th) / 0.112 + 0.1) continue;
    const front = sstep(0.2, 0.7, d[2]), sx = d[0] >= 0 ? 1 : -1;
    let dir = away(d, W);
    dir = tang(d, v3.add(v3.mul(dir, 1 - front), v3.mul([sx * 1.1, -0.2, 0.15], front)));
    const r = rnd();
    const len = lerp(0.12, 0.15, sstep(0, 1, -d[2])) * (0.85 + 0.3 * r) * (front > 0.5 ? 0.92 : 1);
    addLock(B, ctx, shapeLock(ctx, growLock(ctx, d, dir, { len, seg: 10, grav: 1.1, lift: 0.16, layer: 0.004, layerGrow: 0.008, stiff: 0.9 }), { wave: [0.0075, 0.058] }, r), { w: 0.0105, th: 0.0032, segs: cfg.lod ? 4 : 5 }, r);
  }
};
// undercut: clipped sides and back (the shell), long on top and swept back with volume
HAIR.undercut = (B, cfg, ctx, rnd, N) => {
  for (let i = 0; i < Math.round(N * 2.6); i++) {
    const d = fib(i, Math.round(N * 2.6)), th = Math.abs(Math.atan2(d[0], d[2]));
    if (d[1] < 0.5 || th > 2.4 || d[1] < hairLine(false, th) / 0.112 + 0.12) continue;
    const dir = tang(d, [0, 0.35, -1]);
    const r = rnd();
    addLock(B, ctx, shapeLock(ctx, growLock(ctx, d, dir, { len: lerp(0.08, 0.11, sstep(0, 0.6, d[2])) * (0.85 + 0.3 * r), seg: 8, grav: 0.45, lift: 0.22, layer: 0.004, layerGrow: 0.009, stiff: 1.3 }), { wave: [0.0025, 0.08] }, r), { w: 0.009, th: 0.0028, segs: cfg.lod ? 4 : 5 }, r);
  }
};
// curly: tight spiral curls standing off the head
HAIR.curly = (B, cfg, ctx, rnd, N) => {
  for (let i = 0; i < Math.round(N * 2.2); i++) {
    const d = fib(i, Math.round(N * 2.2)), th = Math.abs(Math.atan2(d[0], d[2]));
    if (d[1] < hairLine(false, th) / 0.112 + 0.12) continue;
    const r = rnd();
    const dir = tang(d, v3.add(downT(d), [0, 0, 0]));
    addLock(B, ctx, shapeLock(ctx, growLock(ctx, d, dir, { len: 0.055 * (0.8 + 0.4 * r), seg: 9, grav: 0.1, lift: 0.75, layer: 0.012, layerGrow: 0.02 }), { curl: [0.0075, 0.022] }, r), { w: 0.0052, th: 0.0038, segs: cfg.lod ? 4 : 5 }, r);
  }
};
// long and straight, parted in the middle, falling down the back
HAIR.long = (B, cfg, ctx, rnd, N) => {
  for (let i = 0; i < Math.round(N * 2.2); i++) {
    const d = fib(i, Math.round(N * 2.2)), th = Math.abs(Math.atan2(d[0], d[2]));
    if (d[1] < hairLine(true, th) / 0.112 + 0.1) continue;
    const sx = d[0] >= 0 ? 1 : -1, top = sstep(0.4, 0.8, d[1]);
    const dir = tang(d, v3.add(v3.mul([sx * 0.9, -0.1, -0.5], top), v3.mul(downT(d), 1 - top)));
    const r = rnd();
    const front = sstep(0.3, 0.7, d[2]);
    addLock(B, ctx, shapeLock(ctx, growLock(ctx, d, dir, { len: lerp(0.38, 0.3, front) * (0.88 + 0.24 * r), seg: 16, grav: 1.7, lift: 0.07, layer: 0.004, layerGrow: 0.007, long: true, stiff: 0.8 }), { wave: [0.003, 0.09] }, r), { w: 0.012, th: 0.0032, segs: cfg.lod ? 4 : 5, long: true }, r);
  }
};
// bob: straight to the jaw with a fringe over the forehead
HAIR.bob = (B, cfg, ctx, rnd, N) => {
  const endY = ctx.HC[1] - 0.085 * ctx.k;
  for (let i = 0; i < Math.round(N * 2.2); i++) {
    const d = fib(i, Math.round(N * 2.2)), th = Math.abs(Math.atan2(d[0], d[2]));
    if (d[1] < hairLine(true, th) / 0.112 + 0.1) continue;
    const r = rnd(), fringe = d[2] > 0.3 && Math.abs(d[0]) < 0.62 && d[1] > 0.2;
    const S = ctx.fn(d[0], d[1], d[2]);
    if (fringe) {
      const dir = tang(d, [d[0] * 0.3, -0.25, 1]);
      addLock(B, ctx, growLock(ctx, d, dir, { len: Math.max(0.025, (S[1] - ctx.browY) * 1.15 + 0.012) * (0.92 + 0.16 * r), seg: 7, grav: 1.4, lift: 0.1, layer: 0.003, layerGrow: 0.006 }), { w: 0.0095, th: 0.0028, segs: cfg.lod ? 4 : 5 }, r);
    } else {
      const sx = d[0] >= 0 ? 1 : -1;
      const dir = tang(d, v3.add(downT(d), [sx * 0.3, 0, -0.2]));
      addLock(B, ctx, growLock(ctx, d, dir, { len: Math.max(0.04, (S[1] - endY) * 1.15) * (0.96 + 0.08 * r), seg: 11, grav: 1.8, lift: 0.05, layer: 0.004, layerGrow: 0.007 }), { w: 0.012, th: 0.0032, segs: cfg.lod ? 4 : 5 }, r);
    }
  }
};
// gathered: everything combed to a tie (ponytail, bun), held flat to the head
function gathered(B, cfg, ctx, rnd, N, tie) {
  for (let i = 0; i < Math.round(N * 2.2); i++) {
    const d = fib(i, Math.round(N * 2.2)), th = Math.abs(Math.atan2(d[0], d[2]));
    if (d[1] < hairLine(true, th) / 0.112 + 0.1) continue;
    const S = ctx.fn(d[0], d[1], d[2]);
    const dir = tang(d, v3.sub(tie, S));
    const r = rnd();
    addLock(B, ctx, growLock(ctx, d, dir, { len: v3.len(v3.sub(tie, S)) * 1.15, seg: 8, grav: 0, lift: 0.04, target: tie, pull: 0.4, layer: 0.003, layerGrow: 0.003 }), { w: 0.0095, th: 0.0024, segs: cfg.lod ? 4 : 5 }, r);
  }
}
HAIR.pony = (B, cfg, ctx, rnd, N) => {
  const { HC, k } = ctx, tie = [HC[0], HC[1] + 0.03 * k, HC[2] - 0.118 * k];
  gathered(B, cfg, ctx, rnd, N, tie);
  // the tail
  for (let i = 0; i < Math.round(N * 0.35); i++) {
    const r = rnd(), a = rnd() * 6.283, o = [Math.cos(a) * 0.009, Math.sin(a) * 0.009, 0];
    const pts = [v3.add(tie, o)];
    let p = pts[0], dd = v3.norm([o[0] * 20, -0.4, -1]);
    const len = 0.27 * (0.8 + 0.35 * r), seg = 12;
    for (let s = 1; s <= seg; s++) {
      dd = v3.norm(v3.add(dd, [0, -0.22 * Math.pow(s / seg, 0.7), 0]));
      let np = v3.add(p, v3.mul(dd, len / seg));
      if (np[1] < 1.63 && np[2] > -0.14) np[2] = -0.14 - (1.63 - np[1]) * 0.05;
      p = np; pts.push(p);
    }
    addLock(B, ctx, shapeLock(ctx, pts, { wave: [0.004, 0.08] }, r), { w: 0.0085, th: 0.003, segs: cfg.lod ? 4 : 5, long: true }, r);
  }
  B.tube([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => { const a = i / 8 * 6.283; return [tie[0] + Math.cos(a) * 0.012, tie[1] + Math.sin(a) * 0.012, tie[2] - 0.004]; }), () => [0.004, 0.004], 6, R.cap, W1(HEAD));
};
HAIR.bun = (B, cfg, ctx, rnd, N) => {
  const { HC, k } = ctx, tie = [HC[0], HC[1] + 0.1 * k, HC[2] - 0.088 * k];
  gathered(B, cfg, ctx, rnd, N, tie);
  // the bun: a coil of hair on the tie
  const c = v3.add(tie, [0, 0.016, -0.02]), rr = 0.04;
  B.sphere(cfg.lod ? 16 : 26, cfg.lod ? 10 : 16, (dx, dy, dz) => [c[0] + dx * rr * 1.1, c[1] + dy * rr * 0.82, c[2] + dz * rr * 0.95], R.hair, W1(HEAD), 0, (d) => [Math.atan2(d[0], d[2]) / 6.283 + 0.5, (d[1] + 1) / 2, PT.lock, 0.37]);
  for (let j = 0; j < 6; j++) {
    const pts = [], ph = j * 1.05, r = rnd();
    for (let s = 0; s <= 14; s++) { const a = ph + s / 14 * 4.2, y = Math.sin(s / 14 * 3.14) * 0.6 - 0.2; pts.push([c[0] + Math.cos(a) * rr * 1.05, c[1] + y * rr * 0.6, c[2] + Math.sin(a) * rr * 0.98]); }
    addLock(B, ctx, pts, { w: 0.011, th: 0.004, segs: 5 }, r);
  }
};
// the shell under the locks (and the whole of a buzz cut)
function hairShell(B, cfg, fn, P, style) {
  const long = ['long', 'pony', 'bun', 'bob', 'wavy'].includes(style);
  if (style === 'buzz') return shellHair(B, cfg, fn, P, { long: false, thick: 0.0016 });
  if (style === 'undercut') return shellHair(B, cfg, fn, P, { long: false, thick: 0.0018 });
  if (style === 'curly') return shellHair(B, cfg, fn, P, { long: false, thick: 0.009 });
  shellHair(B, cfg, fn, P, { long, thick: long ? 0.004 : 0.0032, curtain: style === 'long' });
  if (style === 'bob' || style === 'wavy') volumeSkirt(B, cfg, style === 'bob' ? -0.088 : -0.055);
}
// a hair-coloured surface round the back and sides of the head down to the length of the cut (under the locks)
function volumeSkirt(B, cfg, endY) {
  const HC = headCentre(cfg), k = HK(cfg), F = faceOf(cfg), w = W1(HEAD), rings = [];
  for (const y of [0.03, 0.0, -0.03, endY * 0.6, endY]) {
    const sy = Math.sqrt(Math.max(0.05, 1 - (y / 0.112) ** 2)), j = 1 - 0.18 * sstep(-0.02, -0.1, y);
    rings.push({ c: [HC[0], HC[1] + y * k, HC[2] - 0.006 * k], ax: X, ay: Z, rx: (0.0775 * F.w * sy * j + 0.012) * k, ry: (0.104 * sy + 0.012) * k, pw: 2, reg: R.hair, w, part: PT.shell });
  }
  B.loft(rings, cfg.lod ? 18 : 30, null, null, { open: [Math.PI / 2 + 0.95, Math.PI / 2 - 0.95 + Math.PI * 2] });
}
H.hair = function (B, cfg, fn, P) {
  const style = cfg.hair;
  if (cfg.cap) { shellHair(B, cfg, fn, P, { long: false }); return; }   // under a cap: just the short shell
  hairShell(B, cfg, fn, P, style);
  const grow = HAIR[style];
  if (!grow) return;
  const ctx = hairCtx(cfg, fn), rnd = rng(9173 + (cfg.seed || 0) * 31 + style.length * 7);
  const N = { short: 150, side: 150, wavy: 150, undercut: 110, curly: 210, long: 170, bob: 160, pony: 140, bun: 140 }[style] * (cfg.lod ? 0.55 : 1);
  grow(B, cfg, ctx, rnd, Math.round(N));
};

// ---------------- shoes ----------------
// a rubber sole (toe spring, slightly wider than the upper), the upper on it, a padded collar round the opening,
// laces and a tongue on sneakers, a shaft on boots, a heel block on dress shoes
const PROF = {   // half-width of the outline along the foot (heel → toe)
  round: [[-0.078, 0.031], [-0.055, 0.04], [0.0, 0.044], [0.06, 0.047], [0.12, 0.048], [0.165, 0.043], [0.2, 0.033], [0.218, 0.016]],
  sleek: [[-0.075, 0.029], [-0.05, 0.037], [0.0, 0.04], [0.06, 0.043], [0.12, 0.042], [0.17, 0.034], [0.205, 0.022], [0.224, 0.009]],
};
const TOPH = {    // height of the top of the upper along the foot
  sneaker: [0.07, 0.078, 0.086, 0.082, 0.068, 0.056, 0.046, 0.036],
  slipon: [0.062, 0.068, 0.07, 0.068, 0.06, 0.051, 0.043, 0.034],
  boot: [0.074, 0.084, 0.092, 0.088, 0.072, 0.058, 0.048, 0.038],
  dress: [0.058, 0.065, 0.07, 0.064, 0.052, 0.042, 0.033, 0.024],
};
function shoes(B, cfg) {
  const kind = cfg.shoes || 'sneaker', lod = cfg.lod || 0;
  const prof = kind === 'dress' ? PROF.sleek : PROF.round, tops = TOPH[kind] || TOPH.sneaker;
  const ts = kind === 'boot' ? 0.034 : kind === 'dress' ? 0.014 : kind === 'slipon' ? 0.028 : 0.031;
  const segs = lod > 1 ? 8 : lod ? 12 : 18;
  for (const s of [-1, 1]) {
    const KN = s < 0 ? KN_L : KN_R, AK = s < 0 ? ANK_L : ANK_R, x0 = s * dimsOf(cfg.female).hipX, f = cfg.female ? 0.93 : 1, w = W1(AK), toe = s * 0.06;
    const wUp = (y) => (y < 0.1 ? W1(AK) : W2(AK, KN, Math.min(1, (y - 0.1) / 0.07)));
    const xc = (z) => x0 + toe * Math.max(0, z) * 0.6;
    const spring = (z) => 0.012 * sstep(0.15, 0.225, z);
    const hy = kind === 'dress' ? (z) => 0.022 * sstep(-0.01, -0.03, z) : () => 0;   // dress shoes stand on a heel
    // sole
    B.loft(prof.map(([z, hw]) => ({ c: [xc(z), ts / 2 + spring(z) + hy(z) * 0.0, z], ax: X, ay: Y, rx: hw * f + 0.0045, ry: ts / 2, pw: 5, reg: R.sole, w, part: PT.sole, v: z })), segs, [0, 0, -0.006], [0, 0, 0.005]);
    if (kind === 'dress') B.loft([[-0.075, 0.026], [-0.02, 0.03]].map(([z, hw]) => ({ c: [xc(z), 0.011, z], ax: X, ay: Y, rx: hw * f, ry: 0.011, pw: 6, reg: R.sole, w, part: PT.heel, v: z })), segs, [0, 0, -0.004], [0, 0, 0.004]);
    // upper
    const lift = kind === 'dress' ? 0.022 : 0;
    B.loft(prof.map(([z, hw], i) => {
      const y0 = ts - 0.003 + spring(z) + lift * sstep(-0.01, -0.04, z) * 0, h = tops[i] + spring(z) * 0.6;
      return { c: [xc(z), (y0 + h) / 2, z], ax: X, ay: Y, rx: hw * f, ry: Math.max(0.004, (h - y0) / 2), pw: 2.6, reg: R.shoe, w, part: PT.upper, v: z, sa: 'sides' };
    }), segs, [0, 0, -0.005], [0, 0, 0.005]);
    // the opening: a padded collar round the ankle (low and long on slip-ons)
    if (kind !== 'dress') {
      const cz = kind === 'slipon' ? -0.008 : -0.026, rx = 0.043 * f, rz = kind === 'slipon' ? 0.07 : 0.054, yb = kind === 'slipon' ? 0.064 : kind === 'boot' ? 0.0 : 0.078;
      if (kind !== 'boot') {
        const pts = [];
        for (let i = 0; i <= 20; i++) { const a = i / 20 * 6.283; pts.push([xc(0) + Math.cos(a) * rx, yb + 0.012 * Math.max(0, -Math.sin(a)) - 0.008 * Math.max(0, Math.sin(a)), cz + Math.sin(a) * rz]); }
        B.tube(pts, () => [0.0065, 0.0055], lod ? 5 : 7, R.shoe, w, { part: PT.rim });
      }
    }
    if (kind === 'sneaker' && lod < 2) {
      // tongue rising out of the laces, five crossed laces over the instep
      B.loft([[0.02, 0.082], [-0.006, 0.094], [-0.02, 0.104]].map(([z, y]) => ({ c: [xc(0), y, z], ax: X, ay: [0, 0.35, 1], rx: 0.019 * f, ry: 0.0035, pw: 3, reg: R.shoe, w, part: PT.upper, v: z })), 8, null, [0, 0.004, -0.002]);
      for (let i = 0; i < 5; i++) {
        const z = 0.006 + i * 0.024, h = 0.084 - i * 0.0042 + 0.002, a = (i % 2 ? 1 : -1) * 0.006;
        B.tube([[xc(z) - 0.021 * f, h - 0.004, z - a], [xc(z), h + 0.0015, z], [xc(z) + 0.021 * f, h - 0.004, z + a]], () => [0.0022, 0.0016], 5, R.lace, w);
      }
    }
    if (kind === 'boot') {
      // the shaft round the ankle, laced up the front
      B.loft([[0.06, 0.052, 0.06], [0.1, 0.05, 0.056], [0.14, 0.048, 0.053], [0.165, 0.049, 0.054]].map(([y, rx, rz]) => ({ c: [x0, y, -0.006], ax: X, ay: Z, rx: rx * f, ry: rz * f, pw: 2.2, reg: R.shoe, w: wUp(y), part: PT.upper, v: -0.01, sa: 'sides' })), segs, null, null);
      B.tube([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => { const a = i / 12 * 6.283; return [x0 + Math.cos(a) * 0.05 * f, 0.167, -0.006 + Math.sin(a) * 0.055 * f]; }), () => [0.005, 0.005], 6, R.shoe, wUp(0.167), { part: PT.rim });
      for (let i = 0; i < 5; i++) {
        const y = 0.07 + i * 0.022;
        B.tube([[x0 - 0.016 * f, y, 0.046 * f], [x0, y + 0.006, 0.05 * f], [x0 + 0.016 * f, y + 0.012, 0.046 * f]], () => [0.0019, 0.0015], 5, R.lace, wUp(y));
      }
    }
  }
}

// ---------------- garment pieces ----------------
const neckK = (cfg) => (cfg.female ? 0.9 : 1) * (1 + (cfg.build - 0.5) * 0.1);
function crewNeck(B, cfg, low) {
  const rows = cfg.female ? H.TORSO_F : H.TORSO_M, top = TOPS[cfg.top] || TOPS.tee, pad = top.pad + (top.loose ? 0.004 : 0), pts = [];
  for (let i = 0; i <= 32; i++) {
    const a = i / 32 * 6.283, fr = Math.max(0, Math.sin(a)), y = 1.601 - fr * fr * (low ? 0.012 : 0.0045);
    const [rx, rz, cz] = H.rowAt(rows, y), gk = 1 + (cfg.build - 0.5) * 0.07;
    pts.push([Math.cos(a) * (rx * gk + pad + 0.0025), y, cz + Math.sin(a) * (rz * gk + pad + 0.0025)]);
  }
  B.tube(pts, () => [0.0055, 0.0042], cfg.lod ? 5 : 7, R.top, W1(SPINE), { part: PT.collar, normal: (i, p) => [p[0], 0.6, p[2] + 0.012] });
}
// a collar folded down over a band: polo and shirt (open at the front)
function foldedCollar(B, cfg, stand) {
  const nk = neckK(cfg), gap = stand ? 0.12 : 0.22, open = [Math.PI / 2 + gap, Math.PI / 2 - gap + Math.PI * 2], w = W1(SPINE), segs = cfg.lod ? 18 : 30;
  const ring = (y, r, z) => ({ c: [0, y, -0.012 + (z || 0)], ax: X, ay: Z, rx: r * nk, ry: r * nk * 1.06, pw: 2, reg: R.top, w, part: PT.collar, v: y });
  if (stand) B.loft([ring(1.586, 0.069), ring(1.618, 0.066), ring(1.632, 0.065)], segs, null, null, { open });
  const top = stand ? 1.628 : 1.612;
  const outer = [ring(top, 0.07), ring(top - 0.016, 0.083), ring(top - 0.036, 0.098, -0.004)];
  B.loft(outer, segs, null, null, { open });
  B.loft(outer.map((r) => Object.assign({}, r, { rx: r.rx - 0.003, ry: r.ry - 0.003, c: [r.c[0], r.c[1] - 0.003, r.c[2]] })), segs, null, null, { open, flip: true });
}
// the track jacket's stand collar, open at the front where the zip stops; the zip pull
function standCollar(B, cfg) {
  const nk = neckK(cfg), gap = 0.2, open = [Math.PI / 2 + gap, Math.PI / 2 - gap + Math.PI * 2], w = W1(SPINE), segs = cfg.lod ? 18 : 32;
  const ring = (y, r) => ({ c: [0, y, -0.01], ax: X, ay: Z, rx: r * nk, ry: r * nk * 1.07, pw: 2.1, reg: R.top, w, part: PT.collar, v: y });
  B.loft([ring(1.552, 0.096), ring(1.585, 0.084), ring(1.625, 0.077), ring(1.652, 0.074), ring(1.659, 0.071)], segs, null, null, { open });
  B.loft([ring(1.657, 0.068), ring(1.62, 0.069), ring(1.585, 0.072)], segs, null, null, { open, flip: true });
  // zip pull at the top of the zip
  const zt = 1.512, zf = frontZ(cfg, zt, 0.033);
  B.loft([{ c: [0, zt, zf], ax: X, ay: Z, rx: 0.0042, ry: 0.0016, pw: 4, reg: R.metal, w }, { c: [0, zt - 0.024, zf + 0.002], ax: X, ay: Z, rx: 0.0034, ry: 0.0014, pw: 4, reg: R.metal, w }], 6, [0, 0.002, 0], [0, -0.002, 0]);
}
// the hoodie's hood lying round the back of the neck, and its drawstrings
function hood(B, cfg) {
  const nk = neckK(cfg), w = W1(SPINE), pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI / 2 + 0.55 + i / 24 * (Math.PI * 2 - 1.1), back = Math.max(0, -Math.sin(a));
    pts.push([Math.cos(a) * (0.092 + 0.02 * back) * nk, 1.585 + 0.03 * back, -0.012 + Math.sin(a) * (0.092 + 0.04 * back) * nk]);
  }
  B.tube(pts, (i, n) => { const t = i / (n - 1), back = Math.sin(t * Math.PI); return [0.022 + 0.022 * back, 0.016 + 0.03 * back]; }, cfg.lod ? 7 : 10, R.top, w, { part: PT.hood, normal: (i, p) => [p[0], 0.4, p[2] + 0.012], capA: 0.004, capB: 0.004 });
  for (const s of [-1, 1]) {
    const x = s * 0.034, fz = (y) => frontZ(cfg, y, 0.042 + 0.008 * sstep(1.4, 1.05, y) + 0.004);
    B.tube([[x, 1.565, fz(1.565) - 0.004], [x * 1.05, 1.5, fz(1.5)], [x * 1.1, 1.43, fz(1.43)], [x * 1.1, 1.38, fz(1.38)]], () => [0.0028, 0.0028], 5, R.lace, w, { capB: 0.004 });
  }
}
// the joggers' drawstring
function waistCords(B, cfg) {
  const w = W1(HIPS), fz = (y) => frontZ(cfg, Math.max(0.9, y), 0.016);
  for (const s of [-1, 1]) B.tube([[s * 0.012, 0.975, fz(0.975)], [s * 0.016, 0.94, fz(0.94) + 0.003], [s * 0.019, 0.905, fz(0.905) + 0.002], [s * 0.02, 0.875, fz(0.9)]], () => [0.0024, 0.0024], 5, R.lace, w, { capB: 0.003 });
}
// cargo pockets on the outer thighs (with a flap)
function cargoPockets(B, cfg) {
  const bot = BOTS[cfg.bottom];
  for (const s of [-1, 1]) {
    const D = dimsOf(cfg.female), LG = s < 0 ? LEG_L : LEG_R, th = H.rowAt(H.LEG_ROWS, 0.6 - (D.hipsY + D.hipDY))[0] * (cfg.female ? 0.93 : 1) * (1 + (cfg.build - 0.5) * 0.12);
    const x = s * (D.hipX + th + bot.pad[0] + 0.004), w = W1(LG);
    B.loft([0.66, 0.6, 0.54, 0.5].map((y, i) => ({ c: [x, y, 0.01], ax: Z, ay: X, rx: 0.062, ry: 0.012 - (i === 3 ? 0.006 : 0), pw: 6, reg: R.bottom, w, part: PT.pocket, v: 0.66 - y })), 12, [0, 0.003, 0], [0, -0.003, 0]);
  }
}
// a skirt from the waist to the knee, pleated, moving with the legs
function skirt(B, cfg) {
  const f = cfg.female, rows = f ? H.TORSO_F : H.TORSO_M, segs = cfg.lod ? 28 : 48, rings = [];
  const [wx, wz] = H.rowAt(rows, 0.975), [hx, hz] = H.rowAt(rows, 0.885), gk = 1 + (cfg.build - 0.5) * 0.1;
  for (const [t, y, rx, rz] of [[0, 0.975, wx + 0.014, wz + 0.014], [0.15, 0.9, hx + 0.02, hz + 0.018], [0.4, 0.78, hx + 0.03, hz + 0.03], [0.7, 0.62, hx + 0.045, hz + 0.05], [1, 0.48, hx + 0.06, hz + 0.07]].map((r) => [r[0], r[1], r[2] * gk, r[3] * gk])) {
    rings.push({ c: [0, y, -0.006], ax: X, ay: Z, rx, ry: rz, pw: 2.2, reg: R.bottom, part: PT.skirt, v: t,
      // the waistband sits on the pelvis; lower down the cloth lies on the thighs — each side on its own thigh, the front
      // and back across both — so sitting, the skirt drapes over the lap instead of hanging through the thighs and the seat
      w: t < 0.12 ? W1(HIPS) : (th, c) => { const leg = sstep(0.08, 0.62, t), r = 0.5 + 0.5 * Math.sign(c) * Math.pow(Math.abs(c), 0.6); return [[HIPS, 1 - leg], [LEG_R, leg * r], [LEG_L, leg * (1 - r)]]; },
      fold: (th) => 0.005 * t * Math.sin(th * 18) });
  }
  B.loft(rings, segs, null, null);
  B.loft(rings.map((r) => Object.assign({}, r, { rx: r.rx - 0.003, ry: r.ry - 0.003 })), segs, null, null, { flip: true });
}
H.wear = function (B, cfg) {
  shoes(B, cfg);
  if (cfg.lod > 1) return;
  const top = TOPS[cfg.top] || TOPS.tee, bot = BOTS[cfg.bottom] || BOTS.trousers;
  if (top.neck === 'crew') crewNeck(B, cfg, false);
  else if (top.neck === 'polo') foldedCollar(B, cfg, false);
  else if (top.neck === 'shirt') foldedCollar(B, cfg, true);
  else if (top.neck === 'stand') standCollar(B, cfg);
  else if (top.neck === 'hood') { crewNeck(B, cfg, false); hood(B, cfg); }
  if (bot.id === 2 && top.hem > 0.93) waistCords(B, cfg);
  if (bot.id === 3) cargoPockets(B, cfg);
  if (bot.skirt) skirt(B, cfg);
};
})(window.G);
