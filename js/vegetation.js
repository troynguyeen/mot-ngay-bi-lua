// vegetation.js — plants that read as plants: tropical trees (bent trunks with buttress roots, branches, canopies of
// leaf clusters lit like a volume), coconut palms with curved trunks and drooping fronds, ferns / bushes, grass tufts.
// Leaf textures are painted procedurally on canvases; everything is instanced, sways in the wind (stronger in a
// storm), casts alpha-cut shadows, and comes in a near (detailed) and a far (light) version.
(function (G) {
'use strict';
const T = G.T, C = G.C;
let vseed = 20251118;
const rnd = () => { vseed |= 0; vseed = (vseed + 0x6D2B79F5) | 0; let t = Math.imul(vseed ^ (vseed >>> 15), 1 | vseed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();

// ---------------- leaf textures ----------------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  draw(g, w, h);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8;
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.minFilter = T.LinearMipmapLinearFilter;
  return t;
}
const hsl = (h, s, l, a) => `hsla(${h},${s}%,${l}%,${a === undefined ? 1 : a})`;
// one leaf: a pointed oval with a lighter middle, a midrib and a few side veins
function leaf(g, x, y, len, wid, ang, hue, light) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const gr = g.createLinearGradient(-wid, 0, wid, 0);
  gr.addColorStop(0, hsl(hue, 45, light - 8)); gr.addColorStop(0.5, hsl(hue + 4, 50, light + 6)); gr.addColorStop(1, hsl(hue, 45, light - 10));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(wid * 1.1, -len * 0.25, wid * 0.9, -len * 0.75, 0, -len);
  g.bezierCurveTo(-wid * 0.9, -len * 0.75, -wid * 1.1, -len * 0.25, 0, 0); g.fill();
  g.strokeStyle = hsl(hue + 8, 35, light + 14, 0.6); g.lineWidth = Math.max(1, wid * 0.08);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len * 0.96); g.stroke();
  g.lineWidth = Math.max(0.6, wid * 0.04); g.strokeStyle = hsl(hue + 8, 30, light + 8, 0.35);
  for (let i = 1; i < 6; i++) { const t = i / 6; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -len * t); g.lineTo(s * wid * 0.75 * Math.sin(t * Math.PI), -len * (t + 0.08)); g.stroke(); } }
  g.restore();
}
const TEX = {};
function texBroad() {
  return TEX.broad || (TEX.broad = canvasTex(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // twigs first, then ~80 leaves fanned around them, darker underneath
    g.strokeStyle = '#3d3020'; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + rr(-1.1, 1.1); g.lineWidth = rr(4, 9); g.beginPath(); g.moveTo(512, 980); g.quadraticCurveTo(512 + Math.cos(a) * 180, 980 + Math.sin(a) * 260, 512 + Math.cos(a) * 380, 560 + Math.sin(a) * 380); g.stroke(); }
    for (let i = 0; i < 95; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 360;
      const x = 512 + Math.cos(a) * r, y = 520 + Math.sin(a) * r * 0.95;
      const len = rr(120, 210), ang = Math.atan2(y - 600, x - 512) + Math.PI / 2 + rr(-0.6, 0.6);
      leaf(g, x, y, len, len * rr(0.24, 0.34), ang, rr(78, 112), rr(17, 32) - (y > 650 ? 6 : 0));
    }
  }));
}
function texFrond() {
  return TEX.frond || (TEX.frond = canvasTex(512, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const mid = (t) => [256 + Math.sin(t * 2.2) * 10, 1010 - t * 990];
    // leaflets: long narrow blades both sides of the midrib, shorter at the base and tip, some dried at the end
    for (let i = 0; i < 70; i++) {
      const t = 0.04 + i / 70 * 0.94, [x, y] = mid(t), L = 230 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.7) + 30;
      for (const s of [-1, 1]) {
        const ang = s * (0.62 + t * 0.45) + rr(-0.06, 0.06), dry = rnd() < 0.12;
        g.save(); g.translate(x, y); g.rotate(ang);
        const gr = g.createLinearGradient(0, 0, 0, -L);
        gr.addColorStop(0, hsl(dry ? 45 : 90, 45, 26)); gr.addColorStop(0.7, hsl(dry ? 42 : 84, 48, 32)); gr.addColorStop(1, hsl(dry ? 36 : 62, 45, dry ? 38 : 34));
        g.fillStyle = gr; const wd = 9 + 4 * Math.sin(Math.PI * t);
        g.beginPath(); g.moveTo(-wd * 0.5, 0); g.quadraticCurveTo(-wd * 0.55, -L * 0.6, 0, -L); g.quadraticCurveTo(wd * 0.55, -L * 0.6, wd * 0.5, 0); g.fill();
        g.strokeStyle = hsl(70, 40, 42, 0.55); g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.95); g.stroke();
        g.restore();
      }
    }
    g.strokeStyle = '#6b5a33'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i <= 30; i++) { const [x, y] = mid(i / 30); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  }));
}
function texFern() {
  return TEX.fern || (TEX.fern = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let f = 0; f < 9; f++) {
      const a = -Math.PI / 2 + (f - 4) * 0.28 + rr(-0.08, 0.08), L = rr(330, 470);
      for (let i = 0; i < 26; i++) {
        const t = i / 26, x = 256 + Math.cos(a) * L * t, y = 505 + Math.sin(a) * L * t + t * t * 60;
        const ll = 70 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 8;
        for (const s of [-1, 1]) leaf(g, x, y, ll, ll * 0.28, a + Math.PI / 2 + s * 1.15, rr(88, 110), rr(18, 30));
      }
    }
  }));
}
function texGrass() {
  return TEX.grass || (TEX.grass = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 55; i++) {
      const x = rr(40, 472), L = rr(240, 480), bend = rr(-90, 90), wd = rr(7, 13);
      const gr = g.createLinearGradient(0, 512, 0, 512 - L);
      const hue = rr(62, 98), dry = rnd() < 0.15;
      gr.addColorStop(0, hsl(hue, 40, 16)); gr.addColorStop(1, dry ? hsl(48, 45, 46) : hsl(hue - 6, 48, 38));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - wd, 512); g.quadraticCurveTo(x + bend * 0.4, 512 - L * 0.6, x + bend, 512 - L); g.quadraticCurveTo(x + bend * 0.4 + 2, 512 - L * 0.6, x + wd, 512); g.fill();
    }
  }));
}

// ---------------- materials: alpha-cut, double-sided, wind ----------------
const VU = { vegWind: { value: 0.12 } };
G.vegUniforms = VU;
const WIND_VS = `
#ifdef USE_INSTANCING
  vec4 vgW = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
#else
  vec4 vgW = modelMatrix * vec4( transformed, 1.0 );
#endif
  float vgP = gfxTime * 1.25 + vgW.x * 0.13 + vgW.z * 0.09;
  float vgG = 0.6 + 0.4 * sin( gfxTime * 0.37 + vgW.x * 0.02 );   // gusts
  transformed += vec3( sin( vgP ) + 0.35 * sin( vgP * 2.9 + 1.7 ), 0.12 * sin( vgP * 1.7 ), cos( vgP * 0.83 ) * 0.6 + 0.3 * sin( vgP * 3.3 ) ) * aSway * vegWind * vgG;
`;
function windify(sh) {
  sh.vertexShader = 'attribute float aSway;\nuniform float gfxTime;\nuniform float vegWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIND_VS);
  sh.uniforms.gfxTime = G.gfxU.gfxTime; sh.uniforms.vegWind = VU.vegWind;
}
function foliageMat(map, o) {
  const m = new T.MeshStandardMaterial(Object.assign({ map, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.72, metalness: 0, color: 0xffffff }, o || {}));
  m.gfxNoMacro = true; m.gfxNoBevel = true;
  m.onBeforeCompile = function (sh) {
    windify(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', T.ShaderChunk.normal_fragment_begin.replace('normal = normal * faceDirection;', ''));
    G.gfxPatch(sh, this);
  };
  m.userData.depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map, alphaTest: 0.5, side: T.DoubleSide });
  m.userData.depth.onBeforeCompile = windify;
  return m;
}
function barkMat(key, tint) {
  const s = G.surfaceMaps(key);
  const m = new T.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, color: C(tint), roughness: 1, metalness: 0 });
  m.gfxNoMacro = true;
  m.onBeforeCompile = function (sh) { windify(sh); G.gfxPatch(sh, this); };
  m.userData.depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  m.userData.depth.onBeforeCompile = windify;
  return m;
}
const MATS = {};
function mats() {
  if (MATS.leaf) return MATS;
  MATS.leaf = foliageMat(texBroad(), { color: C(0xd6e0c4) });
  MATS.frond = foliageMat(texFrond(), { color: C(0xe2e6cc) });
  MATS.fern = foliageMat(texFern(), { color: C(0xc8d6b8) });
  MATS.grass = foliageMat(texGrass(), { color: C(0xd0d4b4) });
  MATS.bark = barkMat('bark', 0x6a5a48);
  MATS.palm = barkMat('palmbark', 0xb8ae9c);
  return MATS;
}

// ---------------- geometry helpers ----------------
function Geo() { this.p = []; this.n = []; this.uv = []; this.sw = []; this.ix = []; }
Geo.prototype.vert = function (p, n, u, v, sway) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(u, v); this.sw.push(sway); return this.p.length / 3 - 1; };
Geo.prototype.build = function () {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2)); g.setAttribute('aSway', new T.Float32BufferAttribute(this.sw, 1));
  g.setIndex(this.ix); g.computeBoundingSphere(); return g;
};
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a tube along a polyline: pts [[x,y,z]], radii [], sway per point, UV v in metres / vScale
Geo.prototype.tube = function (pts, radii, sway, segs, uScale, vScale, flare) {
  const s0 = this.p.length / 3; let vAcc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const ref = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(t, ref)), w = cross(t, u);
    if (i) vAcc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    for (let k = 0; k <= segs; k++) {
      const th = k / segs * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      let r = radii[i];
      if (flare && i === 0) r *= 1 + 0.25 * Math.max(0, Math.cos(th * flare.n + flare.ph));
      const d = [u[0] * c + w[0] * s, u[1] * c + w[1] * s, u[2] * c + w[2] * s];
      this.vert([pts[i][0] + d[0] * r, pts[i][1] + d[1] * r, pts[i][2] + d[2] * r], d, k / segs * uScale, vAcc / vScale, sway[i]);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < segs; k++) {
    const a = s0 + i * (segs + 1) + k, b = a + 1, c = a + segs + 1, d = c + 1;
    this.ix.push(a, c, b, b, c, d);
  }
};
// a card (quad) centred at c, facing a random-ish direction, normal bent outward from the canopy centre o
const _cm = new T.Matrix4(), _ce = new T.Euler(), _cx = new T.Vector3(), _cy = new T.Vector3();
Geo.prototype.card = function (c, size, o, sway, rot, uv) {
  _cm.makeRotationFromEuler(_ce.set(rot[1], rot[0], rot[2], 'YXZ'));
  _cx.set(1, 0, 0).applyMatrix4(_cm); _cy.set(0, 1, 0).applyMatrix4(_cm);
  const ax = [_cx.x, _cx.y, _cx.z], ay = [_cy.x, _cy.y, _cy.z];
  const s0 = this.p.length / 3, h = size / 2;
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [i, j] of corners) {
    const p = [c[0] + ax[0] * i * h + ay[0] * j * h, c[1] + ax[1] * i * h + ay[1] * j * h, c[2] + ax[2] * i * h + ay[2] * j * h];
    const n = norm([p[0] - o[0], (p[1] - o[1]) * 0.8 + 0.35, p[2] - o[2]]);
    this.vert(p, n, uv ? uv[0] + (i + 1) / 2 * uv[2] : (i + 1) / 2, uv ? uv[1] + (j + 1) / 2 * uv[3] : (j + 1) / 2, sway);
  }
  this.ix.push(s0, s0 + 1, s0 + 2, s0 + 2, s0 + 1, s0 + 3);
};

// ---------------- tropical tree ----------------
// returns { wood, leaves } geometries for a tree about H metres tall (unit space: instances scale it)
function treeGeo(variant, detail) {
  const W = new Geo(), L = new Geo(), H = 10;
  const lean = rr(-0.25, 0.25), lean2 = rr(-0.25, 0.25), r0 = rr(0.26, 0.34);
  const spine = [];
  const NS = detail ? 9 : 4;
  for (let i = 0; i <= NS; i++) { const t = i / NS; spine.push([lean * t * t * 2.2, t * H * 0.72, lean2 * t * t * 2.2]); }
  W.tube(spine, spine.map((p, i) => r0 * (1.0 - 0.55 * i / NS) * (i === 0 ? 1.35 : 1)), spine.map((p, i) => Math.pow(i / NS, 2) * 0.12), detail ? 12 : 6, 2, 3, detail ? { n: 3 + variant, ph: variant } : null);
  // buttress roots fanning out at the base
  if (detail) for (let i = 0; i < 4 + variant % 3; i++) {
    const a = i / (4 + variant % 3) * Math.PI * 2 + rr(-0.3, 0.3), len = rr(0.9, 1.6);
    const pts = [[Math.cos(a) * 0.15, 1.1, Math.sin(a) * 0.15], [Math.cos(a) * len * 0.5, 0.45, Math.sin(a) * len * 0.5], [Math.cos(a) * len, -0.05, Math.sin(a) * len]];
    W.tube(pts, [0.14, 0.1, 0.05], [0, 0, 0], 6, 1, 2);
  }
  // branches and the leaf clusters at their ends
  const top = spine[NS], crowns = [[top[0], top[1] + 1.2, top[2], 2.6]];
  const nb = detail ? 5 + variant % 3 : 3;
  for (let i = 0; i < nb; i++) {
    const a = i / nb * Math.PI * 2 + rr(-0.4, 0.4), t0 = rr(0.55, 0.92), s = spine[Math.round(t0 * NS)];
    const len = rr(2.2, 3.6), up = rr(0.35, 0.8);
    const e = [s[0] + Math.cos(a) * len, s[1] + len * up, s[2] + Math.sin(a) * len];
    const m = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2 + 0.3, (s[2] + e[2]) / 2];
    if (detail) W.tube([s, m, e], [r0 * 0.45, r0 * 0.3, r0 * 0.15], [0.1, 0.25, 0.45], 6, 1, 2);
    crowns.push([e[0], e[1] + 0.4, e[2], rr(1.8, 2.5)]);
  }
  const o = [top[0], top[1] + 1.4, top[2]];
  for (const [x, y, z, R] of crowns) {
    const n = detail ? 30 : 9;
    for (let i = 0; i < n; i++) {
      const u = rnd() * Math.PI * 2, v = Math.acos(rr(-0.6, 1)), r = R * Math.cbrt(rr(0.25, 1));
      const c = [x + Math.cos(u) * Math.sin(v) * r, y + Math.cos(v) * r * 0.6, z + Math.sin(u) * Math.sin(v) * r];
      L.card(c, rr(1.5, 2.3) * (detail ? 1 : 1.6), o, 0.35 + 0.25 * (c[1] / H), [rnd() * Math.PI * 2, rr(-0.9, 0.9), rr(-0.6, 0.6)]);
    }
  }
  return { wood: W.build(), leaves: L.build() };
}

// ---------------- palm ----------------
function palmGeo(h, detail) {
  const W = new Geo(), L = new Geo();
  const bend = rr(0.06, 0.16), dir = rnd() * Math.PI * 2, dx = Math.cos(dir), dz = Math.sin(dir);
  const N = detail ? 12 : 5, pts = [], radii = [], sway = [];
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push([dx * bend * h * t * t, t * h, dz * bend * h * t * t]); radii.push(0.2 - 0.06 * t + (i === 0 ? 0.06 : 0)); sway.push(t * t * 0.18); }
  W.tube(pts, radii, sway, detail ? 12 : 6, 1, 1.2);
  const top = pts[N];
  // the crown's base swelling and coconuts
  W.tube([[top[0], top[1] - 0.35, top[2]], [top[0], top[1] + 0.1, top[2]], [top[0], top[1] + 0.35, top[2]]], [0.17, 0.25, 0.1], [0.18, 0.2, 0.22], 10, 1, 1);
  const NF = detail ? 13 : 8;
  for (let f = 0; f < NF; f++) {
    const a = f / NF * Math.PI * 2 + rr(-0.15, 0.15), up = f % 3 === 0 ? rr(0.5, 0.9) : rr(-0.1, 0.45), len = rr(2.6, 3.6);
    const ca = Math.cos(a), sa = Math.sin(a), SEG = detail ? 9 : 4, s0 = L.p.length / 3;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG, d = len * t;
      // the midrib rises, then droops under its own weight
      const y = top[1] + 0.25 + Math.sin(up + 0.3) * d - 0.55 * d * d / len;
      const c = [top[0] + ca * d * Math.cos(up * 0.6), y, top[2] + sa * d * Math.cos(up * 0.6)];
      const wdt = 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) + 0.15;
      const side = [-sa, 0.18, ca];
      for (const s of [-1, 1]) {
        const p = [c[0] + side[0] * wdt * s, c[1] + side[1] * wdt * s - wdt * 0.25, c[2] + side[2] * wdt * s];
        L.vert(p, norm([ca * 0.3, 1, sa * 0.3]), s < 0 ? 0 : 1, t, 0.2 + 0.8 * t);
      }
    }
    for (let i = 0; i < SEG; i++) { const a0 = s0 + i * 2; L.ix.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
  }
  return { wood: W.build(), leaves: L.build(), top };
}

// ---------------- fern bush and grass tuft ----------------
function bushGeo() {
  const L = new Geo();
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + rr(-0.3, 0.3), s = rr(0.8, 1.3);
    const s0 = L.p.length / 3, ca = Math.cos(a), sa = Math.sin(a), tilt = rr(0.35, 0.8);
    const base = [[-0.5 * -sa * s, 0, -0.5 * ca * s], [0.5 * -sa * s, 0, 0.5 * ca * s]];
    const top = [ca * Math.sin(tilt) * s * 1.2, Math.cos(tilt) * s * 1.2, sa * Math.sin(tilt) * s * 1.2];
    const pts = [base[0], base[1], [top[0] + base[0][0], top[1], top[2] + base[0][2]], [top[0] + base[1][0], top[1], top[2] + base[1][2]]];
    pts.forEach((p, j) => L.vert(p, norm([ca * 0.4, 1, sa * 0.4]), j % 2, j < 2 ? 0 : 1, j < 2 ? 0 : 0.5));
    L.ix.push(s0, s0 + 1, s0 + 2, s0 + 2, s0 + 1, s0 + 3);
  }
  return L.build();
}
function tuftGeo() {
  const L = new Geo();
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI, ca = Math.cos(a) * 0.35, sa = Math.sin(a) * 0.35, s0 = L.p.length / 3;
    [[-ca, 0, -sa, 0, 0], [ca, 0, sa, 1, 0], [-ca, 0.55, -sa, 0, 1], [ca, 0.55, sa, 1, 1]].forEach(([x, y, z, u, v]) => L.vert([x, y, z], [0, 1, 0], u, v, v * 0.35));
    L.ix.push(s0, s0 + 1, s0 + 2, s0 + 2, s0 + 1, s0 + 3);
  }
  return L.build();
}

// ---------------- placing ----------------
function instanced(geo, mat, mats4, shadow) {
  const im = new T.InstancedMesh(geo, mat, mats4.length);
  mats4.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = !!shadow; im.receiveShadow = true;
  if (mat.userData.depth) im.customDepthMaterial = mat.userData.depth;
  G.add(im); return im;
}
const M = (x, y, z, ry, s, sy) => G.M4(x, y, z, ry, 0, 0, s, sy || s, s);
// forest: [[x, z, scale, height]] — near trees get the detailed model, far ones the light one
G.forest = function (trees, bushes, opt) {
  opt = opt || {}; const ms = mats();
  // (Thấp: fewer trees get the detailed model — the light one is a fraction of the triangles)
  const lowQ = !!(G.gfx && G.gfx.P && G.gfx.P.tex <= 512);
  const GP = (G.gfx && G.gfx.P) || {};
  const nearR = (opt.nearR || 95) * (GP.vegNear !== undefined ? GP.vegNear : lowQ ? 0.45 : 1), cx = opt.cx || 0, cz = opt.cz || 0;
  const NV = 4, near = Array.from({ length: NV }, () => []), far = Array.from({ length: 2 }, () => []);
  trees.forEach(([x, z, s, h], i) => {
    const d = Math.hypot(x - cx, z - cz), k = h / 10;
    const m = M(x, -0.05, z, (i * 2.399) % 6.283, s * 0.95, k);
    if (d < nearR) near[i % NV].push(m); else far[i % 2].push(m);
  });
  const P = (G.gfx && G.gfx.P) || {};
  near.forEach((list, v) => { if (!list.length) return; const g = treeGeo(v, true); instanced(g.wood, ms.bark, list, true); instanced(g.leaves, ms.leaf, list, P.shadow >= 2); });
  far.forEach((list, v) => { if (!list.length) return; const g = treeGeo(v + 7, false); instanced(g.wood, ms.bark, list, false); instanced(g.leaves, ms.leaf, list, false); });
  if (bushes && bushes.length) instanced(bushGeo(), ms.fern, bushes.map(([x, z, s], i) => M(x, 0, z, i * 1.7, s)), false);
};
G.grassField = function (count, fn) {
  const ms = mats(), list = [];
  const GP = (G.gfx && G.gfx.P) || {};
  if (GP.grass !== undefined) count = Math.round(count * GP.grass); else if (GP.tex <= 512) count = Math.round(count * 0.5);
  for (let i = 0; i < count; i++) { const p = fn(i); if (p) list.push(M(p[0], 0, p[1], rnd() * 6.28, p[2] || rr(0.7, 1.3))); }
  if (list.length) instanced(tuftGeo(), ms.grass, list, false);
};
// a single coconut palm at (x, z), height h (Sihanoukville yard, the jungle)
const PALMS = [];
G.palmTree = function (x, z, h, parent) {
  const ms = mats();
  const v = PALMS.length < 4 ? (PALMS.push(palmGeo(8, true)), PALMS[PALMS.length - 1]) : PALMS[Math.floor(rnd() * PALMS.length)];
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rnd() * Math.PI * 2; g.scale.set(1, h / 8, 1);
  const w = new T.Mesh(v.wood, ms.palm); w.castShadow = true; w.receiveShadow = true; w.customDepthMaterial = ms.palm.userData.depth; g.add(w);
  const l = new T.Mesh(v.leaves, ms.frond); l.castShadow = true; l.receiveShadow = true; l.customDepthMaterial = ms.frond.userData.depth; g.add(l);
  for (let i = 0; i < 4; i++) { const n = new T.Mesh(new T.SphereGeometry(0.11, 10, 8), MATS.nut || (MATS.nut = G.std({ color: C(0x5a4a26), roughness: 0.6 }))); n.position.set(v.top[0] + Math.cos(i * 1.6) * 0.18, v.top[1] - 0.05 - (i % 2) * 0.1, v.top[2] + Math.sin(i * 1.6) * 0.18); n.castShadow = true; g.add(n); }
  (parent || G.root || G.scene).add(g);
  return g;
};
// alpha-cut materials (fences, nets) cast cut-out shadows instead of solid quads
G.alphaShadows = function (root) {
  root.traverse((o) => {
    if (!o.isMesh || o.customDepthMaterial) return; const m = o.material;
    if (m && !Array.isArray(m) && m.alphaTest > 0 && m.map) o.customDepthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: m.map, alphaTest: m.alphaTest, side: T.DoubleSide });
  });
};
const origLoad = G.loadLevel;
G.loadLevel = function (name) {
  const cfg = origLoad(name);
  G.alphaShadows(G.root);
  VU.vegWind.value = name === 'jungle' ? 0.22 : 0.1;
  return cfg;
};
})(window.G);
