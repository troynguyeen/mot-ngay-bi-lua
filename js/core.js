// core.js — renderer, textures, materials, collisions, input, sky & time of day, audio
window.G = window.G || {};
(function (G) {
'use strict';
const T = THREE;
G.T = T;
const C = (hex) => new T.Color(hex).convertSRGBToLinear();
G.C = C;
G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
G.lerp = (a, b, t) => a + (b - a) * t;
G.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
G.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// seeded random so the map is identical every run
let seed = 1337;
G.rand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
G.rr = (a, b) => a + (b - a) * G.rand();

// ---------------- renderer / scene ----------------
// anti-aliasing happens inside the render pipeline (gfx.js: MSAA on the HDR target, or FXAA), so the canvas itself
// is created without it — at 4K a multisampled default framebuffer alone would cost hundreds of MB
// phones and tablets (iPadOS reports itself as a Mac with a touch screen) get the phone graphics preset
G.mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));
const renderer = new T.WebGLRenderer({ antialias: false, stencil: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('stage').appendChild(renderer.domElement);
G.renderer = renderer;
const MAX_ANISO = Math.min(16, renderer.capabilities.getMaxAnisotropy());

const scene = new T.Scene();
scene.fog = new T.Fog(C(0x8a8378), 25, 240);
G.scene = scene;
const camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 800);
camera.position.set(0, 30, 80);
G.camera = camera;
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------- canvas textures ----------------
function makeTex(w, h, draw, opt) {
  opt = opt || {};
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new T.CanvasTexture(c);
  if (opt.repeat !== false) t.wrapS = t.wrapT = T.RepeatWrapping;
  if (opt.srgb !== false) t.encoding = T.sRGBEncoding;
  t.anisotropy = MAX_ANISO;
  return t;
}
G.makeTex = makeTex;
function blotches(g, w, h, n, colors, rMin, rMax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = G.rand() * w, y = G.rand() * h, r = G.rr(rMin, rMax);
    const col = colors[(G.rand() * colors.length) | 0];
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = alpha; g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  g.globalAlpha = 1;
}
function speckle(g, w, h, n, colors, s0, s1, alpha) {
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(G.rand() * colors.length) | 0];
    const s = G.rr(s0, s1); g.fillRect(G.rand() * w, G.rand() * h, s, s);
  }
  g.globalAlpha = 1;
}
const TX = {};
G.TX = TX;
TX.concrete = makeTex(512, 512, (g, w, h) => {
  g.fillStyle = '#8e897f'; g.fillRect(0, 0, w, h);
  blotches(g, w, h, 70, ['#6f6a60', '#a39d90', '#5c574f'], 20, 90, 0.18);
  speckle(g, w, h, 9000, ['#5f5a52', '#b3ada2', '#77726a'], 1, 2.2, 0.5);
  for (let i = 0; i < 26; i++) { // water streaks
    const x = G.rand() * w, len = G.rr(60, 300);
    const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(50,45,38,.35)'); gr.addColorStop(1, 'rgba(50,45,38,0)');
    g.fillStyle = gr; g.fillRect(x, 0, G.rr(2, 8), len);
  }
  g.strokeStyle = 'rgba(40,36,30,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
});
TX.dirt = makeTex(512, 512, (g, w, h) => {
  g.fillStyle = '#6d5a43'; g.fillRect(0, 0, w, h);
  blotches(g, w, h, 90, ['#5a4734', '#83705a', '#4a3a2b', '#6b6a4a'], 20, 80, 0.25);
  speckle(g, w, h, 12000, ['#3d3125', '#9a8a74', '#5b4b39', '#857a6a'], 1, 3, 0.55);
  for (let i = 0; i < 300; i++) { g.fillStyle = ['#8d8478', '#6e675d', '#a69c8e'][i % 3]; g.beginPath(); g.ellipse(G.rand() * w, G.rand() * h, G.rr(1.5, 4), G.rr(1, 3), G.rand() * 3, 0, 7); g.fill(); }
});
TX.grass = makeTex(512, 512, (g, w, h) => {
  g.fillStyle = '#3e4b25'; g.fillRect(0, 0, w, h);
  blotches(g, w, h, 90, ['#2e3a1b', '#56632f', '#4b4423', '#36451f'], 20, 90, 0.3);
  g.globalAlpha = .55;
  for (let i = 0; i < 9000; i++) { g.strokeStyle = ['#5d6e33', '#2b3617', '#6f7a3d', '#46552a'][i & 3]; const x = G.rand() * w, y = G.rand() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + G.rr(-2, 2), y - G.rr(3, 8)); g.stroke(); }
  g.globalAlpha = 1;
});
TX.epoxy = makeTex(512, 512, (g, w, h) => {
  g.fillStyle = '#2d6b52'; g.fillRect(0, 0, w, h);
  blotches(g, w, h, 40, ['#3b8466', '#225640', '#2f705a'], 40, 140, 0.18);
  speckle(g, w, h, 2500, ['#4f9478', '#1d4a37'], 1, 2, 0.35);
  g.globalAlpha = .25; g.strokeStyle = '#1b3f30';
  for (let i = 0; i < 40; i++) { g.lineWidth = G.rr(0.5, 2); g.beginPath(); const x = G.rand() * w, y = G.rand() * h; g.moveTo(x, y); g.quadraticCurveTo(x + G.rr(-60, 60), y + G.rr(-20, 20), x + G.rr(-90, 90), y + G.rr(-30, 30)); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = 'rgba(15,40,30,.6)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
});
TX.tile = makeTex(512, 512, (g, w, h) => {
  g.fillStyle = '#7b705f'; g.fillRect(0, 0, w, h);
  const n = 4, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = G.rr(-10, 10) | 0; g.fillStyle = `rgb(${182 + v},${170 + v},${146 + v})`; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  blotches(g, w, h, 50, ['#5d5446', '#3e352b', '#8c8170'], 20, 80, 0.22);
  speckle(g, w, h, 4000, ['#4f473c', '#c9bea8'], 1, 2, 0.35);
});
TX.roof = makeTex(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x += 16) {
    const gr = g.createLinearGradient(x, 0, x + 16, 0);
    gr.addColorStop(0, '#6f7477'); gr.addColorStop(.5, '#a6abad'); gr.addColorStop(1, '#5d6366');
    g.fillStyle = gr; g.fillRect(x, 0, 16, h);
  }
  blotches(g, w, h, 30, ['#7a4a2a', '#5b3a22'], 10, 50, 0.35);
  for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(110,60,30,.35)'; g.fillRect(G.rand() * w, G.rand() * h, 2, G.rr(20, 120)); }
});
TX.metal = makeTex(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x += 20) {
    const gr = g.createLinearGradient(x, 0, x + 20, 0);
    gr.addColorStop(0, '#3f5560'); gr.addColorStop(.5, '#6c838e'); gr.addColorStop(1, '#384b55');
    g.fillStyle = gr; g.fillRect(x, 0, 20, h);
  }
  blotches(g, w, h, 25, ['#6b4a30', '#2a2622'], 10, 40, 0.3);
});
TX.plaster = makeTex(512, 512, (g, w, h) => {
  g.fillStyle = '#b8a984'; g.fillRect(0, 0, w, h);
  blotches(g, w, h, 70, ['#9c8c68', '#cbbd99', '#7d7055'], 20, 100, 0.2);
  speckle(g, w, h, 5000, ['#857756', '#d2c6a6'], 1, 2, 0.4);
  for (let i = 0; i < 18; i++) { const x = G.rand() * w; const gr = g.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, 'rgba(70,60,40,.4)'); gr.addColorStop(1, 'rgba(70,60,40,0)'); g.fillStyle = gr; g.fillRect(x, 0, G.rr(3, 10), 240); }
});
TX.fence = makeTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = '#b9c0c2'; g.lineWidth = 3;
  for (let i = -w; i < w * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
}, {});
TX.screen = makeTex(256, 160, (g, w, h) => {
  g.fillStyle = '#dfe9f2'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#21364d'; g.fillRect(0, 0, 70, h);
  g.fillStyle = '#0a7cff'; g.fillRect(70, 0, w - 70, 16);
  for (let i = 0; i < 8; i++) { g.fillStyle = '#3b5878'; g.fillRect(8, 24 + i * 16, 54, 9); }
  for (let i = 0; i < 6; i++) { const me = i % 2; g.fillStyle = me ? '#0a7cff' : '#ffffff'; const bw = G.rr(60, 130); g.fillRect(me ? w - 10 - bw : 80, 24 + i * 21, bw, 14); }
}, { repeat: false });
TX.blood = makeTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const red = ['rgba(90,6,8,.9)', 'rgba(120,10,12,.85)', 'rgba(60,4,6,.9)'];
  g.fillStyle = red[0]; g.beginPath(); g.ellipse(128, 128, 60, 44, 0.4, 0, 7); g.fill();
  for (let i = 0; i < 70; i++) { g.fillStyle = red[i % 3]; const a = G.rand() * 6.28, d = G.rr(30, 120); g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, G.rr(1, 7), 0, 7); g.fill(); }
}, { repeat: false });
TX.glow = makeTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, { repeat: false });
TX.beam = makeTex(64, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,255,255,.03)'); gr.addColorStop(.6, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,.8)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, { repeat: false });

// bilingual sign: big Khmer line on top, small Vietnamese translation below. Redraws once the Khmer web font arrives.
const KHMER_FONT = 'Moul, "Noto Sans Khmer", "Khmer UI", "Khmer OS", "Leelawadee UI", sans-serif';
G.signKhmer = function (khmer, viet, opt) {
  opt = opt || {}; const w = opt.w || 1024, h = opt.h || 256;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const draw = () => {
    g.fillStyle = opt.bg || '#a3191e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = opt.border || '#ffd36b'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = opt.fg || '#ffe066';
    let fs = Math.floor(h * 0.36); g.font = `${fs}px ${KHMER_FONT}`;
    while (g.measureText(khmer).width > w * 0.9 && fs > 20) { fs -= 4; g.font = `${fs}px ${KHMER_FONT}`; }
    g.fillText(khmer, w / 2, h * 0.4);
    g.fillStyle = opt.sub || '#ffffff'; g.font = `700 ${Math.floor(h * 0.15)}px "Be Vietnam Pro", Arial, sans-serif`;
    g.fillText(viet, w / 2, h * 0.79);
  };
  draw();
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = MAX_ANISO;
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('40px Moul', khmer), document.fonts.load('700 40px "Be Vietnam Pro"', viet)]).then(() => { draw(); t.needsUpdate = true; }).catch(() => {});
  return t;
};
G.signTex = function (lines, opt) {
  opt = opt || {};
  const w = opt.w || 512, h = opt.h || 128;
  return makeTex(w, h, (g) => {
    g.fillStyle = opt.bg || '#a3191e'; g.fillRect(0, 0, w, h);
    if (opt.border) { g.strokeStyle = opt.border; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); }
    g.fillStyle = opt.fg || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = opt.size || Math.floor(h / (lines.length + 0.6));
    g.font = `700 ${fs}px Oswald, "Arial Narrow", Impact, sans-serif`;
    lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.08));
    if (opt.grime !== false) { blotches(g, w, h, 12, ['#000'], 10, 60, 0.12); }
  }, { repeat: false });
};

// high-rise facade: 4 floors x 4 bays per tile (tile = 12m wide x 13.2m tall); lit windows come from a matching emissive map
function facadeTex(barred, lit) {
  return makeTex(256, 256, (g, w, h) => {
    g.fillStyle = lit ? '#000' : (barred ? '#8a8579' : '#9aa3a8'); g.fillRect(0, 0, w, h);
    if (!lit) { blotches(g, w, h, 40, ['#6a665e', '#b1aba0', '#5a5650'], 10, 50, 0.25); for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(40,36,30,.3)'; g.fillRect(G.rand() * w, 0, G.rr(2, 5), G.rr(40, 200)); } }
    for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
      const x = bx * 64 + 8, y = fy * 64 + 12, ww = 48, hh = 40;
      if (lit) { const on = G.rand() < (barred ? 0.45 : 0.3); if (on) { const c = ['#ffd38a', '#cfe6ff', '#ffb36b', '#e8f0ff'][(G.rand() * 4) | 0]; g.fillStyle = c; g.fillRect(x, y, ww, hh); } }
      else { g.fillStyle = barred ? '#1c1f22' : '#2c3e4c'; g.fillRect(x, y, ww, hh); g.fillStyle = 'rgba(160,190,210,.15)'; g.fillRect(x, y, ww, hh / 3); }
      if (barred) { g.fillStyle = lit ? '#000' : '#3a3a38'; for (let k = 0; k < 7; k++) g.fillRect(x + 3 + k * 7, y - 2, 2, hh + 4); g.fillRect(x - 2, y + hh / 2, ww + 4, 2); }
      if (!lit) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 4, y + hh + 2, ww + 8, 6); }
    }
  });
}
TX.facade = facadeTex(false, false); TX.facadeLit = facadeTex(false, true);
TX.barred = facadeTex(true, false); TX.barredLit = facadeTex(true, true);
TX.net = makeTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(30,110,60,.72)'; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out'; for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) g.fillRect(x + 2, y + 2, 4, 4);
  g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 6; i++) g.fillRect(0, G.rand() * h, w, 3);
});
TX.mud = makeTex(512, 512, (g, w, h) => {
  g.fillStyle = '#4b3a28'; g.fillRect(0, 0, w, h);
  blotches(g, w, h, 90, ['#3a2b1d', '#5e4a33', '#2c2116', '#4f4a35'], 20, 90, 0.35);
  speckle(g, w, h, 6000, ['#2a1f15', '#6b5a44'], 1, 3, 0.45);
  for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(25,18,10,.35)'; g.lineWidth = G.rr(2, 6); g.beginPath(); const y = G.rand() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + G.rr(-30, 30), 2 * w / 3, y + G.rr(-30, 30), w, y); g.stroke(); }
});
TX.bamboo = makeTex(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#6b6a2e'); gr.addColorStop(0.5, '#a6a05a'); gr.addColorStop(1, '#5a5826'); g.fillStyle = gr; g.fillRect(x, 0, 15, h); g.fillStyle = '#2a2812'; g.fillRect(x + 15, 0, 1, h); }
  for (let x = 0; x < w; x += 16) { const y = G.rr(20, 120); g.fillStyle = '#4a4720'; g.fillRect(x, y, 15, 3); g.fillRect(x, y + 128, 15, 3); }
});
TX.brick = makeTex(512, 512, (g, w, h) => {
  g.fillStyle = '#5a3a2c'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 16; r++) for (let c = -1; c < 9; c++) { const v = G.rr(-18, 18) | 0; g.fillStyle = `rgb(${150 + v},${74 + v / 2},${52 + v / 3})`; g.fillRect(c * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28); }
  blotches(g, w, h, 40, ['#2a1a12', '#7a5a46', '#3a2a20'], 20, 80, 0.22);
});
TX.planks = makeTex(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x += 32) { const v = G.rr(-15, 15) | 0; g.fillStyle = `rgb(${92 + v},${66 + v},${44 + v})`; g.fillRect(x, 0, 31, h); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + 31, 0, 1, h); }
  speckle(g, w, h, 2000, ['#3a2a1a', '#7a5a3a'], 1, 2, 0.4);
  for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(40,28,16,.4)'; g.beginPath(); const x = G.rand() * w; g.moveTo(x, 0); g.lineTo(x + G.rr(-4, 4), h); g.stroke(); }
});
TX.rust = makeTex(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#5a3c28'); gr.addColorStop(.5, '#8a6448'); gr.addColorStop(1, '#4a3020'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); }
  blotches(g, w, h, 40, ['#3a2214', '#9a5a2a', '#6a6a6a'], 10, 50, 0.35);
});

// ---------------- geometry helpers ----------------
G.boxGeo = function (w, h, d, S) {
  const g = new T.BoxGeometry(w, h, d);
  if (S) {
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let i = 0; i < uv.count; i++) { const f = (i / 4) | 0; uv.setXY(i, uv.getX(i) * dims[f][0] / S, uv.getY(i) * dims[f][1] / S); }
  }
  return g;
};
G.planeGeo = function (w, h, S) {
  const g = new T.PlaneGeometry(w, h);
  if (S) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / S, uv.getY(i) * h / S); }
  return g;
};
G.merge = function (list) {
  const pos = [], nor = [], uv = [], bh = [], bl = []; let bevel = false;
  for (const [g0, m] of list) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    if (m) g.applyMatrix4(m);
    const n = g.attributes.position.count;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array); else for (let i = 0; i < n; i++) uv.push(0, 0);
    // boxes keep their own half-size and local position, so the rounded-edge shader still works after merging
    if (g.attributes.aBxH && g.attributes.aBxL) { bevel = true; bh.push(...g.attributes.aBxH.array); bl.push(...g.attributes.aBxL.array); }
    else for (let i = 0; i < n * 3; i++) { bh.push(0); bl.push(0); }
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  if (bevel) { out.setAttribute('aBxH', new T.Float32BufferAttribute(bh, 3)); out.setAttribute('aBxL', new T.Float32BufferAttribute(bl, 3)); }
  return out;
};
// scale a geometry's UVs (cylinders, spheres… whose 0..1 UVs would stretch one texture tile over the whole object)
G.uvScale = function (geo, su, sv) {
  const uv = geo.attributes.uv; if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true; return geo;
};
G.M4 = (x, y, z, ry, rx, rz, sx, sy, sz) => {
  const m = new T.Matrix4();
  m.compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sx || 1, sy || 1, sz || 1));
  return m;
};

// ---------------- materials ----------------
const std = (o) => new T.MeshStandardMaterial(o);
G.std = std;
G.MAT = {
  concrete: std({ map: TX.concrete, color: C(0xffffff), roughness: 0.95 }),
  concreteDark: std({ map: TX.concrete, color: C(0x8a857c), roughness: 0.95 }),
  dirt: std({ map: TX.dirt, roughness: 1 }),
  grass: std({ map: TX.grass, roughness: 1 }),
  epoxy: std({ map: TX.epoxy, roughness: 0.62, metalness: 0.0 }),
  tile: std({ map: TX.tile, roughness: 0.7 }),
  roof: std({ map: TX.roof, roughness: 0.6, metalness: 0.4 }),
  metal: std({ map: TX.metal, roughness: 0.55, metalness: 0.45 }),
  plaster: std({ map: TX.plaster, roughness: 0.95 }),
  fence: std({ map: TX.fence, alphaTest: 0.5, side: T.DoubleSide, metalness: 0.6, roughness: 0.4 }),
  steel: std({ color: C(0x5b6064), roughness: 0.45, metalness: 0.7 }),
  darkSteel: std({ color: C(0x2a2d30), roughness: 0.5, metalness: 0.6 }),
  wood: std({ color: C(0x7a5534), roughness: 0.85 }),
  table: std({ color: C(0xc8b48c), roughness: 0.7 }),
  plastic: std({ color: C(0x1d1f22), roughness: 0.6 }),
  chairSeat: std({ color: C(0x22405a), roughness: 0.6 }),
  screen: std({ map: TX.screen, emissive: C(0xffffff), emissiveMap: TX.screen, emissiveIntensity: 0.9, roughness: 0.3 }),
  tube: std({ color: C(0xffffff), emissive: C(0xeaf6ff), emissiveIntensity: 1.6 }),
  bulb: std({ color: C(0xffe2a8), emissive: C(0xffc070), emissiveIntensity: 2 }),
  rope: std({ color: C(0xb59a6a), roughness: 1 }),
  chain: std({ color: C(0x3a3a3a), roughness: 0.4, metalness: 0.8 }),
  blood: std({ map: TX.blood, transparent: true, depthWrite: false, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }),
  water: std({ color: C(0x2c4a46), roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 }),
  leaf: std({ color: C(0x3d5a26), roughness: 0.9, side: T.DoubleSide }),
  leaf2: std({ color: C(0x2e4a1e), roughness: 0.9 }),
  trunk: std({ color: C(0x5a4a38), roughness: 1 }),
  tarp: std({ color: C(0x2a5fa0), roughness: 0.8, side: T.DoubleSide }),
  black: std({ color: C(0x111214), roughness: 0.5 }),
  facade: std({ map: TX.facade, emissive: C(0xffffff), emissiveMap: TX.facadeLit, emissiveIntensity: 0.1, roughness: 0.7 }),
  barred: std({ map: TX.barred, emissive: C(0xffffff), emissiveMap: TX.barredLit, emissiveIntensity: 0.1, roughness: 0.85 }),
  net: std({ map: TX.net, transparent: true, alphaTest: 0.25, side: T.DoubleSide, roughness: 0.9 }),
  mud: std({ map: TX.mud, roughness: 0.55, metalness: 0.05 }),
  bamboo: std({ map: TX.bamboo, roughness: 0.85 }),
  brick: std({ map: TX.brick, roughness: 0.95 }),
  planks: std({ map: TX.planks, roughness: 0.9 }),
  rust: std({ map: TX.rust, roughness: 0.7, metalness: 0.35 }),
  wet: std({ color: C(0x3a3c3e), roughness: 0.18, metalness: 0.15 }),
};
// window lights follow the time of day
G.windowGlow = (n) => { G.MAT.facade.emissiveIntensity = 0.05 + n * 1.2; G.MAT.barred.emissiveIntensity = 0.05 + n * 0.9; };

// ---------------- colliders ----------------
// Each collider: axis-aligned box. solid = blocks movement, cam = blocks camera, los = blocks guards' sight
G.colliders = [];
G.addCollider = function (x0, z0, x1, z1, y0, y1, flags) {
  const c = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, solid: true, cam: true, los: (y1 - y0) > 1.3, off: false };
  if (flags) Object.assign(c, flags);
  G.colliders.push(c); return c;
};
// Add a textured box mesh (x,z = centre, y = bottom) + optional collider
G.box = function (o) {
  const geo = G.boxGeo(o.w, o.h, o.d, o.S === undefined ? 4 : o.S);
  const m = new T.Mesh(geo, o.mat);
  m.position.set(o.x, (o.y || 0) + o.h / 2, o.z);
  if (o.ry) m.rotation.y = o.ry;
  m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false;
  (o.parent || G.root || scene).add(m);
  if (o.collide !== false && !o.ry) {
    m.userData.col = G.addCollider(o.x - o.w / 2, o.z - o.d / 2, o.x + o.w / 2, o.z + o.d / 2, o.y || 0, (o.y || 0) + o.h, o.flags);
  }
  return m;
};
// push a circle out of solid boxes
G.collide = function (p, r, y) {
  y = y || 0;
  for (let it = 0; it < 2; it++) {
    for (const c of G.colliders) {
      if (!c.solid || c.off || c.y1 < y + 0.35 || c.y0 > y + 1.7) continue;
      const cx = p.x < c.x0 ? c.x0 : p.x > c.x1 ? c.x1 : p.x;
      const cz = p.z < c.z0 ? c.z0 : p.z > c.z1 ? c.z1 : p.z;
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else {
        const l = p.x - c.x0, rgt = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, mn = Math.min(l, rgt, t, b);
        if (mn === l) p.x = c.x0 - r; else if (mn === rgt) p.x = c.x1 + r; else if (mn === t) p.z = c.z0 - r; else p.z = c.z1 + r;
      }
    }
  }
};
function segBox(ax, az, bx, bz, c) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  const ax_ = [[dx, ax, c.x0, c.x1], [dz, az, c.z0, c.z1]];
  for (const [d, o, mn, mx] of ax_) {
    if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) return false; continue; }
    let ta = (mn - o) / d, tb = (mx - o) / d; if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return false;
  }
  return true;
}
G.losBlocked = function (ax, az, bx, bz) {
  for (const c of G.colliders) { if (c.los && !c.off && segBox(ax, az, bx, bz, c)) return true; }
  return false;
};
// distance along a 3D ray to the nearest camera-blocking box
G.rayDist = function (o, d, maxD) {
  let best = maxD;
  for (const c of G.colliders) {
    if (!c.cam || c.off) continue;
    let t0 = 0, t1 = best, ok = true;
    const sl = [[d.x, o.x, c.x0, c.x1], [d.y, o.y, c.y0, c.y1], [d.z, o.z, c.z0, c.z1]];
    for (const [dd, oo, mn, mx] of sl) {
      if (Math.abs(dd) < 1e-9) { if (oo < mn || oo > mx) { ok = false; break; } continue; }
      let ta = (mn - oo) / dd, tb = (mx - oo) / dd; if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 > 0.001 && t0 < best) best = t0;
  }
  return best;
};

// ---------------- input ----------------
const input = G.input = { keys: {}, lookX: 0, lookY: 0, joyX: 0, joyY: 0, run: false, crouch: false, use: false, usePressed: false, throwPressed: false, locked: false, touch: false };
const keyDown = (code) => {
  if (code === 'KeyE' || code === 'Space' || code === 'Enter') { if (!input.use) input.usePressed = true; input.use = true; }
  if (code === 'KeyF' || code === 'KeyQ') input.throwPressed = true;
  if ((code === 'KeyC' || code === 'ControlLeft') && !(G.state && G.state.tied)) { input.crouch = !input.crouch; if (input.crouch) input.run = false; }
};
addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.code === 'Escape' && G.onKey) G.onKey('Escape', e); return; }
  if (e.repeat) { if (['KeyE','Space','Enter'].includes(e.code)) e.preventDefault(); return; }
  input.keys[e.code] = true; keyDown(e.code);
  if (G.onKey) G.onKey(e.code, e);
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => {
  input.keys[e.code] = false;
  if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') input.use = false;
});
addEventListener('blur', () => { input.keys = {}; input.use = false; });
const cvs = renderer.domElement;
let dragging = false;
cvs.addEventListener('mousedown', (e) => {
  dragging = true;
  if (G.wantsPointerLock && G.wantsPointerLock() && !document.pointerLockElement && cvs.requestPointerLock) {
    try { const r = cvs.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* sandboxed: fall back to drag */ }
  }
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === cvs || dragging) { input.lookX += e.movementX || 0; input.lookY += e.movementY || 0; }
});
document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === cvs; });
G.unlockPointer = () => { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); };

// touch: joystick + right-side look + buttons
input.touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
(function touchSetup() {
  const joy = document.getElementById('joy'), knob = joy.querySelector('i');
  let joyId = null, lookId = null, lx = 0, ly = 0;
  const joyMove = (t) => {
    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy), m = Math.max(28, r.width * 0.36); // reach follows the stick's size
    if (d > m) { dx *= m / d; dy *= m / d; }
    input.joyX = dx / m; input.joyY = dy / m;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  joy.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; joyId = t.identifier; joyMove(t); }, { passive: false });
  // one finger on the scene looks around; two fingers on the scene pinch the camera closer / further
  const onScene = new Map(); let pinchD = 0;
  const spread = () => { const [a, b] = [...onScene.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
  cvs.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) { onScene.set(t.identifier, [t.clientX, t.clientY]); if (lookId === null && onScene.size === 1) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; } }
    if (onScene.size === 2) { lookId = null; pinchD = spread(); }
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (onScene.has(t.identifier)) onScene.set(t.identifier, [t.clientX, t.clientY]);
      if (t.identifier === joyId) joyMove(t);
      else if (t.identifier === lookId) { input.lookX += (t.clientX - lx) * 1.6; input.lookY += (t.clientY - ly) * 1.6; lx = t.clientX; ly = t.clientY; }
    }
    if (pinchD && onScene.size === 2 && G.zoomBy) { const d = spread(); G.zoomBy(pinchD / d); pinchD = d; } // fingers apart = closer
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; input.joyX = input.joyY = 0; knob.style.transform = ''; }
      if (t.identifier === lookId) lookId = null;
      onScene.delete(t.identifier);
    }
    if (pinchD && onScene.size < 2) { pinchD = 0; if (G.setZoom) G.setZoom(G.cam.zoom, true); }
  };
  cvs.addEventListener('wheel', (e) => { if (!G.zoomBy) return; e.preventDefault(); G.zoomBy(Math.exp(e.deltaY * 0.0012), true); }, { passive: false });
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  const btn = (id, down, up) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); down(el); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); if (up) up(el); }, { passive: false });
    el.addEventListener('mousedown', (e) => { e.preventDefault(); down(el); });
    el.addEventListener('mouseup', () => { if (up) up(el); });
  };
  btn('t-use', () => { input.usePressed = true; input.use = true; }, () => { input.use = false; });
  // run and crouch are one stance switch: turning one on turns the other off (else moving drops the crouch and you sprint).
  // Ignored while tied up, so nothing carries over to the moment you are freed.
  const tied = () => !!(G.state && G.state.tied);
  btn('t-run', (el) => { if (tied()) return; input.run = !input.run; el.classList.toggle('on', input.run); if (input.run) { input.crouch = false; document.getElementById('t-crouch').classList.remove('on'); } });
  btn('t-crouch', (el) => { if (tied()) return; input.crouch = !input.crouch; el.classList.toggle('on', input.crouch); if (input.crouch) { input.run = false; document.getElementById('t-run').classList.remove('on'); } });
  // after a capture: stop sprinting, back to sneaking
  G.resetStance = () => { input.run = false; input.crouch = true; };
  btn('t-throw', () => { input.throwPressed = true; });
})();

// ---------------- sky, stars, lights, time of day ----------------
// One shader draws the whole sky: gradient + horizon haze matching the fog, sun disc and glow, a moving cloud layer
// (lit by the sun, the moon and — over the city — the orange glow of street lights from below, flashing with
// lightning), stars that twinkle, and the moon with its halo. Drawn after the opaque world so hidden sky costs nothing.
const SKY_FS = [
  'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunSize;',
  'uniform vec3 uFog; uniform vec3 uCity; uniform vec3 uGround; uniform vec3 uMoonDir;',
  'uniform float uTime; uniform float uCloud; uniform float uNight; uniform float uFlash; uniform float uEnv; uniform float uStars;',
  'varying vec3 vP;',
  'float hash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }',
  'float hash3( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }',
  'float vnoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); vec2 u = f * f * ( 3.0 - 2.0 * f );',
  '  return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y ); }',
  'float fbm( vec2 p ) { float s = 0.0, a = 0.5; for ( int i = 0; i < 5; i ++ ) { s += a * vnoise( p ); p = p * 2.03 + vec2( 1.7, 9.2 ); a *= 0.5; } return s; }',
  'void main() {',
  '  vec3 d = normalize( vP );',
  '  float h = clamp( d.y * 1.6 + 0.08, 0.0, 1.0 );',
  '  vec3 c = mix( bottom, top, pow( h, 0.75 ) );',
  '  c = mix( c, uFog, ( 1.0 - smoothstep( -0.02, 0.2, d.y ) ) * 0.6 );',
  '  c += uCity * ( 1.0 - smoothstep( 0.0, 0.5, d.y ) ) * uNight;',
  '  vec3 sd = normalize( sunDir ); float s = max( dot( d, sd ), 0.0 );',
  '  vec3 col = c + sunCol * ( pow( s, 12.0 ) * 0.25 + pow( s, 80.0 ) * 0.35 );',
  '  float dens = 0.0, lit = 0.0, n = 0.0;',
  '  if ( d.y > -0.03 && uCloud > 0.01 ) {',
  '    vec2 uv = d.xz / ( max( d.y, 0.0 ) + 0.12 ) * 0.9 + uTime * vec2( 0.006, 0.0025 );',
  '    n = fbm( uv );',
  '    dens = smoothstep( 0.62 - uCloud * 0.55, 0.92 - uCloud * 0.42, n ) * smoothstep( -0.03, 0.12, d.y );',
  '    lit = clamp( 0.55 + ( n - fbm( uv + sd.xz * 0.12 ) ) * 4.0, 0.0, 1.0 );',
  '  }',
  '  vec3 sky = vec3( 0.0 );',
  '  if ( uStars > 0.001 && d.y > 0.0 ) {',
  '    vec3 q = d * 230.0; vec3 cell = floor( q ); float r = hash3( cell );',
  '    if ( r > 0.982 ) {',
  '      vec3 sp = cell + 0.5 + ( vec3( hash3( cell + 1.7 ), hash3( cell + 4.1 ), hash3( cell + 7.3 ) ) - 0.5 ) * 0.7;',
  '      float tw = 0.6 + 0.4 * sin( uTime * ( 1.5 + r * 6.0 ) + r * 80.0 );',
  '      float mag = pow( ( r - 0.982 ) / 0.018, 3.0 );',
  '      sky += mix( vec3( 0.75, 0.82, 1.0 ), vec3( 1.0, 0.88, 0.72 ), fract( r * 37.0 ) ) * smoothstep( 0.34, 0.0, length( q - sp ) ) * ( 0.35 + 3.0 * mag ) * tw;',
  '    }',
  '    sky *= uStars * smoothstep( 0.0, 0.25, d.y );',
  '  }',
  '  float m = dot( d, uMoonDir );',
  '  if ( uNight > 0.01 ) {',
  '    vec3 mx = normalize( cross( uMoonDir, vec3( 0.0, 1.0, 0.0 ) ) ), my = cross( mx, uMoonDir );',
  '    vec2 mp = vec2( dot( d, mx ), dot( d, my ) ) / 0.028;',
  '    float disc = smoothstep( 1.0, 0.95, length( mp ) ) * step( 0.0, m );',
  '    float maria = vnoise( mp * 2.3 + 3.0 ) * 0.6 + vnoise( mp * 6.0 + 1.0 ) * 0.4;',
  '    sky += vec3( 1.0, 0.97, 0.9 ) * disc * ( 2.6 - maria * 1.3 ) * uNight;',
  '    col += vec3( 0.5, 0.58, 0.78 ) * ( pow( max( m, 0.0 ), 1200.0 ) * 0.5 + pow( max( m, 0.0 ), 40.0 ) * 0.06 ) * uNight * ( 1.0 - dens * 0.5 );',
  '  }',
  '  sky += sunCol * pow( s, 900.0 / sunSize ) * 6.0;',
  '  col += sky * ( 1.0 - dens );',
  '  if ( dens > 0.0 ) {',
  '    vec3 cc = mix( bottom, top, 0.45 ) * mix( 0.95, 0.62, uCloud );',
  '    cc += sunCol * lit * 0.6 * ( 1.0 - uCloud * 0.55 );',
  '    cc += uCity * 1.8 * uNight * ( 1.0 - smoothstep( 0.0, 0.7, d.y ) ) * ( 0.6 + 0.4 * ( 1.0 - lit ) );',
  '    cc += vec3( 0.07, 0.08, 0.11 ) * pow( max( m, 0.0 ), 6.0 ) * uNight * ( 0.4 + lit );',
  '    cc += vec3( 0.75, 0.82, 1.0 ) * uFlash * ( 0.5 + n );',
  '    col = mix( col, cc, dens * 0.97 );',
  '    col += sunCol * pow( s, 5.0 ) * dens * lit * 0.35;',
  '  }',
  '  if ( d.y < 0.0 ) col = mix( col, uFog, smoothstep( 0.0, -0.05, d.y ) );',
  // environment pass (image-based lighting): below the horizon is the ground, not more sky
  '  if ( uEnv > 0.5 && d.y < 0.0 ) col = mix( uFog, uGround, smoothstep( 0.0, -0.2, d.y ) );',
  '  gl_FragColor = vec4( col, 1.0 );',
  '  #include <tonemapping_fragment>',
  '  #include <encodings_fragment>',
  '}'].join('\n');
const skyMat = new T.ShaderMaterial({
  side: T.BackSide, depthWrite: false, fog: false,
  uniforms: {
    top: { value: C(0x6f9ccc) }, bottom: { value: C(0xd9d2bf) }, sunDir: { value: new T.Vector3(0, 1, 0) }, sunCol: { value: C(0xfff1d0) }, sunSize: { value: 1 },
    uFog: { value: new T.Color() }, uCity: { value: new T.Color(0, 0, 0) }, uGround: { value: new T.Color(0.05, 0.05, 0.05) }, uMoonDir: { value: new T.Vector3(-0.35, 0.78, -0.5).normalize() },
    uTime: { value: 0 }, uCloud: { value: 0.3 }, uNight: { value: 0 }, uFlash: { value: 0 }, uEnv: { value: 0 }, uStars: { value: 0 },
  },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: SKY_FS,
});
const sky = new T.Mesh(new T.SphereGeometry(500, 48, 24), skyMat);
sky.renderOrder = 1000; sky.frustumCulled = false; // after the opaque world: only the visible sky is shaded
scene.add(sky);
G.skyMat = skyMat; G.skyMesh = sky;

const hemi = new T.HemisphereLight(C(0xbfd4e6), C(0x6b5a45), 0.6); scene.add(hemi);
const sun = new T.DirectionalLight(C(0xfff1d0), 2.2);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 220;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
G.sun = sun; G.hemi = hemi;

// keyframes: t (hours, 5..29 wraps night), sky top, sky bottom, fog, hemi sky, hemi ground, hemi I, sun col, sun I, exposure, night
const KF = [
  [5.0, 0x070a14, 0x1a2133, 0x0d111c, 0x41527e, 0x16161c, 0.75, 0x9fb4e0, 0.6, 1.45, 1],
  [6.2, 0x3a4a72, 0xd58a5c, 0x6d5650, 0x7d8bb0, 0x3a2e28, 0.45, 0xffb27a, 1.1, 1.05, 0.3],
  [7.5, 0x5f8fc4, 0xe6cfae, 0xb1a690, 0xb9cbe0, 0x6b5a45, 0.6, 0xffe2b8, 2.0, 1.0, 0],
  [12, 0x5e95cf, 0xdcd8c8, 0xbdb7a4, 0xc7d8ea, 0x75644d, 0.65, 0xfff4dc, 2.6, 0.95, 0],
  [17, 0x5f84b8, 0xe3c39a, 0xb79f80, 0xb8c4d6, 0x6d5844, 0.6, 0xffd9a0, 2.1, 1.0, 0],
  [18.3, 0x45547e, 0xe2925a, 0x9a6a50, 0x8e8aa6, 0x4a3a2e, 0.5, 0xff9d5c, 1.4, 1.05, 0.15],
  [19.3, 0x1b2242, 0x6b3f48, 0x2e2531, 0x4b5274, 0x1d1714, 0.42, 0xc07a70, 0.6, 1.15, 0.65],
  [20.5, 0x070a14, 0x1a2133, 0x0d111c, 0x41527e, 0x16161c, 0.75, 0x9fb4e0, 0.6, 1.45, 1],
  [28.6, 0x070a14, 0x1a2133, 0x0d111c, 0x41527e, 0x16161c, 0.75, 0x9fb4e0, 0.6, 1.45, 1],
  [29.6, 0x3a4a72, 0xd58a5c, 0x6d5650, 0x7d8bb0, 0x3a2e28, 0.45, 0xffb27a, 1.1, 1.05, 0.3],
];
const _a = new T.Color(), _b = new T.Color();
const mixHex = (h1, h2, t, out) => out.copy(C(h1)).lerp(_b.copy(C(h2)), t);
G.night = 0;
G.timeH = 7;
const sunDir = new T.Vector3();
G.setTime = function (h) {
  G.timeH = h;
  let t = h; if (t < 5) t += 24;
  let i = 0; while (i < KF.length - 2 && t > KF[i + 1][0]) i++;
  const A = KF[i], B = KF[i + 1]; const f = G.clamp((t - A[0]) / (B[0] - A[0]), 0, 1);
  mixHex(A[1], B[1], f, skyMat.uniforms.top.value);
  mixHex(A[2], B[2], f, skyMat.uniforms.bottom.value);
  mixHex(A[3], B[3], f, scene.fog.color);
  mixHex(A[4], B[4], f, hemi.color);
  mixHex(A[5], B[5], f, hemi.groundColor);
  hemi.intensity = G.lerp(A[6], B[6], f);
  mixHex(A[7], B[7], f, sun.color);
  sun.intensity = G.lerp(A[8], B[8], f);
  renderer.toneMappingExposure = G.lerp(A[9], B[9], f);
  G.night = G.lerp(A[10], B[10], f);
  const day = t >= 5.8 && t <= 19.4;
  if (day) {
    const a = (t - 6) / 12.6 * Math.PI;
    sunDir.set(Math.cos(a), Math.max(Math.sin(a), 0.06), 0.45).normalize();
    skyMat.uniforms.sunCol.value.copy(sun.color); skyMat.uniforms.sunSize.value = 1;
  } else {
    sunDir.set(-0.35, 0.78, -0.5).normalize();
    skyMat.uniforms.sunCol.value.set(0, 0, 0);
  }
  skyMat.uniforms.sunDir.value.copy(sunDir);
  const su = skyMat.uniforms;
  su.uStars.value = G.clamp((G.night - 0.4) / 0.6, 0, 1) * Math.pow(1 - G.overcast, 2);
  su.uNight.value = G.clamp((G.night - 0.3) / 0.7, 0, 1);
  su.uCloud.value = G.clamp(0.28 + G.overcast * 0.7, 0, 1);
  scene.fog.near = G.lerp(30, 12, G.night); scene.fog.far = G.lerp(260, 120, G.night);
  // overcast / rain: grey the sky, dim the sun, thicken the fog
  const o = G.overcast;
  if (o > 0) {
    const greyOut = (c, k) => { const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15; c.lerp(_a.setRGB(l, l, l * 1.04), k); };
    greyOut(skyMat.uniforms.top.value, o * 0.85); greyOut(skyMat.uniforms.bottom.value, o * 0.85); greyOut(scene.fog.color, o * 0.8);
    skyMat.uniforms.sunCol.value.multiplyScalar(1 - o * 0.9);
    sun.intensity *= 1 - o * 0.6; hemi.intensity *= 1 + o * 0.3;
    scene.fog.far *= 1 - o * 0.45; scene.fog.near *= 1 - o * 0.4;
  }
  scene.fog.far *= G.fogMul; scene.fog.near *= G.fogMul;
  hemi.intensity *= typeof G.hemiMul === 'function' ? G.hemiMul(G.night) : G.hemiMul; sun.intensity *= G.sunMul;
  const moon = G.levelCfg && G.levelCfg.moon; // a map far from any town: more moonlight, or nothing can be seen at night
  if (moon) { const k = 1 + (moon - 1) * G.night; hemi.intensity *= k; sun.intensity *= k; }
  su.uFog.value.copy(scene.fog.color);
  su.uGround.value.copy(hemi.groundColor).multiplyScalar(0.35 * hemi.intensity + 0.15 * sun.intensity * (1 - G.night));
  // the city's street lights glow on low clouds (Sihanoukville); faint everywhere else
  const city = (G.levelCfg && G.levelCfg.cityGlow !== undefined) ? G.levelCfg.cityGlow : 0.25;
  su.uCity.value.setRGB(0.09, 0.045, 0.018).multiplyScalar(city * (0.4 + o * 0.6));
};
G.overcast = 0; G.fogMul = 1; G.hemiMul = 1; G.sunMul = 1;
G.updateSky = function (focus) {
  sky.position.copy(camera.position);
  skyMat.uniforms.uTime.value = performance.now() / 1000;
  sun.target.position.set(Math.round(focus.x / 2) * 2, 0, Math.round(focus.z / 2) * 2);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 110);
};
G.setTime(7);

// ---------------- levels: every map builds under G.root and is torn down on switch ----------------
G.root = null; G.LEVELS = {}; G.levelName = ''; G.levelCfg = {};
G.tickers = []; G.nightFx = []; G.lit = []; G.buildings = []; G.towers = []; G.LOC = {}; G.doors = {};
G.add = (o) => { (G.root || scene).add(o); return o; };
G.worldTick = function (dt, t) { for (const f of G.tickers) f(dt, t); for (const f of G.nightFx) f(G.night); };
G.loadLevel = function (name) {
  if (G.root) { scene.remove(G.root); G.root.traverse((n) => { if (n.geometry) n.geometry.dispose(); }); }
  G.root = new T.Group(); G.root.name = 'level:' + name; scene.add(G.root);
  G.colliders.length = 0; G.tickers.length = 0; G.nightFx.length = 0; G.lit.length = 0; G.buildings.length = 0; G.towers.length = 0;
  G.LOC = {}; G.doors = {};
  if (G.clearActors) G.clearActors();
  G.levelName = name;
  G.levelCfg = G.LEVELS[name].build(G.root) || {};
  // G.guardFilter (team mode): drop or add guards for the round's difficulty before they are made
  if (G.setupGuards) G.setupGuards(G.guardFilter ? G.guardFilter(G.levelCfg.guards || [], name) : (G.levelCfg.guards || []));
  if (G.setupSearchlights) G.setupSearchlights(G.levelCfg.lights || []);
  G.overcast = G.levelCfg.overcast || 0; G.fogMul = G.levelCfg.fogMul || 1;
  G.setRain(G.levelCfg.rain || 0); G.lightningOn = !!G.levelCfg.lightning;
  return G.levelCfg;
};
G.slab = function (x0, z0, x1, z1, mat, y, S) {
  const m = new T.Mesh(G.planeGeo(x1 - x0, z1 - z0, S || 4), mat);
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y || 0.02, (z0 + z1) / 2); m.receiveShadow = true; G.add(m); return m;
};
// doors that open when the story says so
G.rollDoor = function (x, z, w, h, axis) { // roll-up shutter; axis 'z' = door spans z (on an east/west wall)
  const along = axis !== 'x';
  const m = new T.Mesh(G.boxGeo(along ? 0.1 : w, h, along ? w : 0.1, 2), G.MAT.metal); m.position.set(x, h / 2, z); m.castShadow = true; G.add(m);
  const col = along ? G.addCollider(x - 0.1, z - w / 2, x + 0.1, z + w / 2, 0, h) : G.addCollider(x - w / 2, z - 0.1, x + w / 2, z + 0.1, 0, h);
  const d = { mesh: m, col, open: false, k: 0 };
  G.tickers.push((dt) => { if (d.open && d.k < 1) { d.k = Math.min(1, d.k + dt * 0.8); m.scale.y = 1 - d.k * 0.9; m.position.y = h - (h * m.scale.y) / 2; } });
  return d;
};
G.swingDoor = function (x, z, w, h, axis, mat) { // hinged steel door
  const along = axis !== 'x';
  const pivot = new T.Group(); pivot.position.set(along ? x : x - w / 2, 0, along ? z - w / 2 : z); G.add(pivot);
  const m = new T.Mesh(G.boxGeo(along ? 0.1 : w, h, along ? w : 0.1, 2), mat || G.MAT.darkSteel); m.position.set(along ? 0 : w / 2, h / 2, along ? w / 2 : 0); m.castShadow = true; pivot.add(m);
  const col = along ? G.addCollider(x - 0.1, z - w / 2, x + 0.1, z + w / 2, 0, h) : G.addCollider(x - w / 2, z - 0.1, x + w / 2, z + 0.1, 0, h);
  const d = { mesh: pivot, col, open: false, k: 0 };
  G.tickers.push((dt) => { if (d.open && d.k < 1) { d.k = Math.min(1, d.k + dt * 1.5); pivot.rotation.y = -d.k * 1.75; } });
  return d;
};
G.openDoor = (d) => { if (!d || d.open) return; d.open = true; d.col.off = true; };

// ---------------- rain + lightning ----------------
// The rain you see (GPU streaks, splashes, wet ground) is drawn by atmos.js / gfx.js; this keeps the state, the
// rain sound and the lightning (a sky-wide flash, lit clouds, a white screen flicker and thunder a moment later).
G.rainK = 0; G.lightningOn = false;
let boltT = 6, boltFlash = 0;
const boltLight = new T.HemisphereLight(0xdfe8ff, 0x445566, 0); scene.add(boltLight);
G.setRain = function (k) { G.rainK = k; if (G.rainFx) G.rainFx.set(k); if (G.audio && G.audio.rain) G.audio.rain.gain.setTargetAtTime(k * 0.05, G.audio.ctx.currentTime, 1); };
G.weatherTick = function (dt, indoor) {
  if (G.rainFx) G.rainFx.tick(dt);
  if (G.rainK > 0 && G.audio && G.audio.rain && G.audio.ctx) G.audio.rain.gain.setTargetAtTime((indoor ? 0.4 : 1) * G.rainK * 0.05, G.audio.ctx.currentTime, 0.4);
  if (G.lightningOn) {
    boltT -= dt;
    if (boltT <= 0) { boltT = G.rr(9, 22); boltFlash = 1; const d = G.rr(0.4, 2.2); setTimeout(() => G.sfx('thunder'), d * 1000); const f = document.getElementById('bolt'); if (f) { f.style.transition = 'none'; f.style.opacity = '0.45'; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = '0'; }); } }
  }
  if (boltFlash > 0) boltFlash = Math.max(0, boltFlash - dt * 2.5);
  const fl = boltFlash * (Math.sin(boltFlash * 40) > 0 ? 1 : 0.3);
  boltLight.intensity = fl * 2.4; skyMat.uniforms.uFlash.value = fl;
};

// ---------------- audio (synthesised, no files) ----------------
const AU = G.audio = { ctx: null, master: null, music: null, amb: null };
// user settings (per-browser convenience; the game works without storage)
G.settings = { music: 55, sfx: 80 };
try { const s = JSON.parse(localStorage.getItem('mnbl-settings') || '{}'); if (s && typeof s === 'object') { if (isFinite(s.music)) G.settings.music = s.music; if (isFinite(s.sfx)) G.settings.sfx = s.sfx; } } catch (e) { /* storage blocked */ }
const curve = (v) => Math.pow(G.clamp(v, 0, 100) / 100, 2);
G.applyVolumes = function () {
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  AU.master.gain.setTargetAtTime(0.75 * curve(G.settings.sfx), t, 0.05);
  AU.music.gain.setTargetAtTime(0.9 * curve(G.settings.music), t, 0.05);
};
G.setVolume = function (kind, v) {
  G.settings[kind] = Math.round(G.clamp(Number(v) || 0, 0, 100));
  try { localStorage.setItem('mnbl-settings', JSON.stringify(G.settings)); } catch (e) { /* storage blocked */ }
  G.applyVolumes();
};
G.audioInit = function () {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ctx = AU.ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  AU.master = ctx.createGain(); AU.master.connect(comp);   // sound effects + ambience bus
  AU.music = ctx.createGain(); AU.music.connect(comp);     // music bus
  G.applyVolumes();
  // background music is switched off on purpose (startMusic() still exists if it is wanted back)
  loadVoices();
  // noise buffer
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = nb;
  // ambience: low hum + insects (band-passed noise with tremolo)
  const n = ctx.createBufferSource(); n.buffer = nb; n.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 6;
  const trem = ctx.createGain(); trem.gain.value = 0;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 13; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(trem.gain);
  const insects = ctx.createGain(); insects.gain.value = 0;
  n.connect(bp); bp.connect(trem); trem.connect(insects); insects.connect(AU.master); n.start(); lfo.start();
  const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50;
  const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 160;
  const hg = ctx.createGain(); hg.gain.value = 0; hum.connect(hf); hf.connect(hg); hg.connect(AU.master); hum.start();
  AU.insects = insects; AU.hum = hg;
  // rain loop (high-passed noise) and a low engine drone for vehicles
  const rn = ctx.createBufferSource(); rn.buffer = nb; rn.loop = true;
  const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 900;
  const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 7000;
  AU.rain = ctx.createGain(); AU.rain.gain.value = G.rainK * 0.05; rn.connect(rhp); rhp.connect(rlp); rlp.connect(AU.rain); AU.rain.connect(AU.master); rn.start();
  const eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 38;
  const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 120;
  AU.engine = ctx.createGain(); AU.engine.gain.value = 0; eng.connect(ef); ef.connect(AU.engine); AU.engine.connect(AU.master); eng.start();
};
G.engineSound = (on) => { if (AU.ctx) AU.engine.gain.setTargetAtTime(on ? 0.09 : 0, AU.ctx.currentTime, 0.6); };
// jet engines (k = 0 off … 1 take-off power): low roar of filtered noise + the fan whine, built on first use
G.jetSound = function (k) {
  const ctx = AU.ctx; if (!ctx) return;
  if (!AU.jet) {
    const n = ctx.createBufferSource(); n.buffer = AU.noise; n.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const g = ctx.createGain(); g.gain.value = 0;
    n.connect(lp); lp.connect(g); g.connect(AU.master); n.start();
    const w = ctx.createOscillator(); w.type = 'triangle'; w.frequency.value = 1800; const wg = ctx.createGain(); wg.gain.value = 0; w.connect(wg); wg.connect(AU.master); w.start();
    AU.jet = { g, lp, w, wg };
  }
  const t = ctx.currentTime, J = AU.jet;
  J.g.gain.setTargetAtTime(0.22 * k, t, 0.5); J.lp.frequency.setTargetAtTime(400 + 1400 * k, t, 0.6);
  J.wg.gain.setTargetAtTime(0.012 * Math.min(1, k * 1.5), t, 0.5); J.w.frequency.setTargetAtTime(1500 + 1600 * k, t, 0.8);
};
let ringTimer = null;
G.ring = function (on) { // phone ringtone loop
  clearInterval(ringTimer); ringTimer = null;
  if (on) { const r = () => { G.sfx('ring'); }; r(); ringTimer = setInterval(r, 1700); }
};
// ---------------- generative music: D-minor pad, sub drone, plucked arpeggio, pulse when tense ----------------
const MUSIC = G.musicState = { mood: 'title', tension: 0, step: 0, next: 0, timer: null };
const CHORD_SETS = {
  dark: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],     // Dm Bb Gm A
  home: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],     // Am F C G — sad, everyday
  horror: [[50, 51, 57], [49, 50, 56], [48, 51, 54], [47, 50, 53]],   // clusters
  hope: [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]],     // C G Am F
};
let CHORDS = CHORD_SETS.dark;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function startMusic() {
  const ctx = AU.ctx, bus = AU.music;
  // echo for the plucks
  const dly = ctx.createDelay(1.5); dly.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.32; const wet = ctx.createGain(); wet.gain.value = 0.35;
  dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(bus); MUSIC.echo = dly;
  const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 480; padF.Q.value = 0.8;
  const padG = ctx.createGain(); padG.gain.value = 0; padF.connect(padG); padG.connect(bus);
  const voices = [];
  for (let i = 0; i < 3; i++) for (const det of [-7, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det; o.frequency.value = mtof(CHORDS[0][i]); o.connect(padF); o.start(); voices.push({ o, i }); }
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06; const lg = ctx.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(padF.frequency); lfo.start();
  padG.gain.setTargetAtTime(0.05, ctx.currentTime, 3);
  const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = mtof(CHORDS[0][0] - 24); const sg = ctx.createGain(); sg.gain.value = 0.08; sub.connect(sg); sg.connect(bus); sub.start();
  MUSIC.voices = voices; MUSIC.padF = padF; MUSIC.sub = sub;
  MUSIC.next = ctx.currentTime + 0.3;
  MUSIC.timer = setInterval(scheduleMusic, 100);
}
function pluck(f, when, len, vol) {
  const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 2400;
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + len);
  o.connect(lp); lp.connect(g); g.connect(AU.music); g.connect(MUSIC.echo); o.start(when); o.stop(when + len + 0.05);
}
function kick(when, vol) {
  const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(120, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.22);
  g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
  o.connect(g); g.connect(AU.music); o.start(when); o.stop(when + 0.35);
}
function scheduleMusic() {
  const ctx = AU.ctx; if (!ctx || ctx.state !== 'running') return;
  const ten = MUSIC.tension, horror = MUSIC.mood === 'horror', night = MUSIC.mood === 'night' || horror;
  const eighth = 60 / (62 + ten * 46) / 2;
  while (MUSIC.next < ctx.currentTime + 0.35) {
    const s = MUSIC.step, when = MUSIC.next, ci = Math.floor(s / 16) % 4, ch = CHORDS[ci];
    if (s % 16 === 0) {
      MUSIC.voices.forEach((v) => v.o.frequency.setTargetAtTime(mtof(ch[v.i] + (night ? -12 : 0)), when, 0.7));
      MUSIC.sub.frequency.setTargetAtTime(mtof(ch[0] - 24), when, 0.9);
    }
    const dens = horror ? 0.1 + ten * 0.5 : 0.3 + ten * 0.55 + (night ? 0.08 : 0);
    if ((s % 2 === 0 || ten > 0.5) && Math.random() < dens) pluck(mtof(ch[(s >> 1) % 3] + 12 + (Math.random() < 0.2 ? 12 : 0)), when, 0.5 + (1 - ten) * 0.9, 0.05 + ten * 0.03);
    if (s % 4 === 0 && (ten > 0.3 || (night && s % 8 === 0))) kick(when, 0.12 + ten * 0.22);
    MUSIC.step++; MUSIC.next += eighth;
  }
  MUSIC.padF.frequency.setTargetAtTime(380 + ten * 1100 + (MUSIC.mood === 'day' ? 260 : 0), ctx.currentTime, 0.6);
}
G.musicMood = function (mood, tension) {
  MUSIC.mood = mood; MUSIC.tension = G.clamp(tension || 0, 0, 1);
  CHORDS = CHORD_SETS[mood === 'home' ? 'home' : mood === 'horror' ? 'horror' : mood === 'hope' ? 'hope' : 'dark'];
};
G.ambience = function (night, indoor) {
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  AU.insects.gain.setTargetAtTime(indoor ? 0.004 : 0.004 + night * 0.02, t, 0.5);
  AU.hum.gain.setTargetAtTime(indoor ? 0.05 : 0.008, t, 0.5);
};
function tone(f0, f1, dur, type, vol, delay) {
  const ctx = AU.ctx; if (!ctx) return; const t = ctx.currentTime + (delay || 0);
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, freq, vol, q, delay) {
  const ctx = AU.ctx; if (!ctx) return; const t = ctx.currentTime + (delay || 0);
  const s = ctx.createBufferSource(); s.buffer = AU.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, G.rand() * 1.5); s.stop(t + dur + 0.05);
}
// ---- recorded clips in sfx/, played on the effects bus ----
// plea: Vietnamese TTS ("Microsoft An") rendered offline · zap: two cuts from the electricity recording the player supplied
const VOICES = { plea: ['sfx/tha-em-1.wav', 'sfx/tha-em-2.wav', 'sfx/tha-em-3.wav'], zap: ['sfx/zap-a.wav', 'sfx/zap-b.wav'] };
const vbuf = {}; let voiceN = 0;
function loadVoices() {
  for (const [k, list] of Object.entries(VOICES)) list.forEach((url, i) => {
    fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((ab) => new Promise((res, rej) => AU.ctx.decodeAudioData(ab, res, rej))) // callback form: older Safari
      .then((buf) => { (vbuf[k] = vbuf[k] || [])[i] = buf; }).catch(() => { /* no file (e.g. offline copy): synth only */ });
  });
}
// a terrified delivery: a bit higher and faster, shaking (fast tremolo), strained upper mids. Returns false if not loaded.
G.voice = function (kind, delay) {
  const ctx = AU.ctx, list = (vbuf[kind] || []).filter(Boolean); if (!ctx || !list.length) return false;
  const buf = list[voiceN++ % list.length], t = ctx.currentTime + (delay || 0);
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = 1.05 + Math.random() * 0.07;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 170;
  const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2300; pk.Q.value = 1.2; pk.gain.value = 5;
  const g = ctx.createGain(); g.gain.value = 1.25;
  const trem = ctx.createOscillator(), td = ctx.createGain(); trem.frequency.value = 8.5; td.gain.value = 0.38; trem.connect(td); td.connect(g.gain);
  s.connect(hp); hp.connect(pk); pk.connect(g); g.connect(AU.master);
  const end = t + (buf.duration - 0.08) / s.playbackRate.value + 0.05;
  s.start(t, 0.08); trem.start(t); s.stop(end); trem.stop(end);
  return true;
};
// stun baton: the recorded electric crackle (a random cut, slightly varied); synthesized arcs + hum until it has loaded
let zapN = 0;
function zap(delay, vol) {
  const d0 = delay || 0, v = vol || 1, ctx = AU.ctx, clips = (vbuf.zap || []).filter(Boolean);
  if (ctx && clips.length) {
    const buf = clips[zapN++ % clips.length], t = ctx.currentTime + d0; // alternate the two cuts
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = 0.96 + Math.random() * 0.08;
    const g = ctx.createGain(); g.gain.value = 0.75 * v; s.connect(g); g.connect(AU.master); s.start(t);
    return;
  }
  for (let i = 0; i < 18; i++) noise(0.045, 2600 + Math.random() * 4200, 0.32 * v, 9, d0 + i * 0.055 + Math.random() * 0.02);
  tone(100, 100, 1.05, 'sawtooth', 0.07 * v, d0); tone(200, 210, 1.05, 'square', 0.025 * v, d0); noise(0.05, 6000, 0.4 * v, 3, d0);
}
let DIST = null;
// a scream on the vowel "a" ("Áaa!"): buzzy source through the a-formants, pitch leaps up then cracks down, vibrato, breath
function scream(delay, vol, len) {
  const ctx = AU.ctx; if (!ctx) return; const t0 = ctx.currentTime + (delay || 0), L = len || 1.1, v = vol || 0.5;
  if (!DIST) { DIST = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; DIST[i] = Math.tanh(x * 2.6); } }
  const base = 300 + Math.random() * 50, o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(base * 0.75, t0); o.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + 0.12);
  o.frequency.exponentialRampToValueAtTime(base * 1.3, t0 + L * 0.65); o.frequency.exponentialRampToValueAtTime(base * 0.62, t0 + L);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 7 + Math.random() * 2; vg.gain.value = base * 0.06; vib.connect(vg); vg.connect(o.frequency);
  const mix = ctx.createGain();
  for (const [f, q, a] of [[850, 6, 1], [1250, 8, 0.75], [2800, 10, 0.4]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const ga = ctx.createGain(); ga.gain.value = a; o.connect(bp); bp.connect(ga); ga.connect(mix); }
  const ws = ctx.createWaveShaper(); ws.curve = DIST;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.04); g.gain.setValueAtTime(v, t0 + L * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + L);
  mix.connect(ws); ws.connect(g); g.connect(AU.master);
  noise(L * 0.9, 2200, v * 0.1, 0.8, delay); // breath
  o.start(t0); vib.start(t0); o.stop(t0 + L + 0.05); vib.stop(t0 + L + 0.05);
}
// footsteps: heel thump + shoe scuff, then the ground: a splash on wet concrete in the rain, a sharper click with a
// little room echo on indoor tiles, a sucking squelch in the swamp. kind: 'run' | 'walk' | 'sneak' (crouched: faint)
let stepSide = 0;
G.footstep = function (kind, surf) {
  if (!AU.ctx) return;
  const k = kind === 'run' ? 1.35 : kind === 'walk' ? 0.5 : 0.12, r = () => 0.85 + Math.random() * 0.3; // running has to cut through the rain
  stepSide ^= 1; const p = stepSide ? 1 : 0.9; // left / right feet sound a touch different
  noise(0.06, 170 * p * r(), 0.5 * k * r(), 0.9);              // heel
  tone(105 * p, 52, 0.07, 'sine', 0.26 * k * r());             // body weight
  if (kind === 'sneak') { noise(0.09, 850 * r(), 0.045 * r(), 0.7, 0.025); return; } // a soft shuffle, nothing else
  const tile = surf === 'tile';
  noise(0.035, (tile ? 3200 : 1900) * r(), (tile ? 0.24 : 0.16) * k * r(), tile ? 3 : 1.6, 0.035 + Math.random() * 0.015); // toe / scuff
  if (tile) noise(0.03, 2800 * r(), 0.07 * k, 3, 0.11);
  if (surf === 'wet') { noise(0.12, 4200 * r(), 0.2 * k * r(), 1.2, 0.01); noise(0.08, 2400 * r(), 0.1 * k, 2, 0.05); }
  if (surf === 'mud') { noise(0.16, 700 * r(), 0.26 * k, 1.5, 0.01); tone(240, 120, 0.12, 'sine', 0.07 * k, 0.02); }
};
// a guard's baton arcing nearby: two or three tiny snaps, quieter the further away (v = 0..1)
G.sparkSound = function (v) { if (!AU.ctx || v <= 0) return; const n = 2 + (Math.random() < 0.5 ? 1 : 0); for (let i = 0; i < n; i++) noise(0.022, 3800 + Math.random() * 3600, 0.16 * v, 7, i * 0.04 + Math.random() * 0.02); };
// body blow: low thump + slap
function thud(delay, vol) { noise(0.14, 220, vol, 0.8, delay); tone(95, 42, 0.22, 'sine', vol * 0.9, delay); noise(0.05, 1800, vol * 0.35, 2, delay); }
// pained voice: buzzy source through two vowel formants, pitch falling ("ugh!")
function grunt(delay, pitch, vol) {
  const ctx = AU.ctx; if (!ctx) return; const t0 = ctx.currentTime + (delay || 0), p = pitch || 1;
  const o = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime((140 + Math.random() * 30) * p, t0); o.frequency.exponentialRampToValueAtTime(88 * p, t0 + 0.34);
  f1.type = 'bandpass'; f1.frequency.value = 620 * Math.sqrt(p); f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 1150 * Math.sqrt(p); f2.Q.value = 7;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.4, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
  o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(AU.master); o.start(t0); o.stop(t0 + 0.42);
}
G.sfx = function (name) {
  if (!AU.ctx) return;
  switch (name) {
    case 'step': noise(0.07, 380, 0.07, 1.2); break;
    case 'run': noise(0.09, 300, 0.12, 1); break;
    case 'pickup': tone(660, 990, 0.12, 'triangle', 0.18); tone(990, 1320, 0.14, 'triangle', 0.14, 0.09); break;
    case 'type': noise(0.025, 3000, 0.05, 2); break;
    case 'msg': tone(880, 880, 0.08, 'sine', 0.12); tone(1175, 1175, 0.1, 'sine', 0.1, 0.08); break;
    case 'alert': tone(520, 1040, 0.18, 'square', 0.08); tone(780, 1560, 0.2, 'square', 0.07, 0.12); break;
    case 'sus': tone(300, 420, 0.25, 'triangle', 0.08); break;
    case 'caught': tone(140, 70, 1.2, 'sawtooth', 0.18); tone(147, 73, 1.2, 'sawtooth', 0.12); noise(0.4, 200, 0.4, 0.7); break;
    case 'throw': noise(0.25, 1200, 0.08, 0.6); break;
    case 'clack': tone(300, 120, 0.08, 'square', 0.12); noise(0.1, 2000, 0.12, 3); break;
    case 'door': tone(180, 90, 0.4, 'sawtooth', 0.06); noise(0.4, 600, 0.06, 1); break;
    case 'cut': noise(0.06, 5000, 0.2, 4); tone(2000, 600, 0.08, 'square', 0.05); break;
    case 'beep': tone(1200, 1200, 0.07, 'square', 0.06); break;
    case 'heart': tone(70, 50, 0.16, 'sine', 0.35); tone(70, 50, 0.14, 'sine', 0.25, 0.22); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.5, 'triangle', 0.12, i * 0.14)); break;
    case 'ring': [0, 0.18, 0.36, 0.54].forEach((d, i) => tone(i % 2 ? 1320 : 990, i % 2 ? 1320 : 990, 0.15, 'sine', 0.13, d)); break;
    case 'buzz': noise(0.35, 160, 0.25, 2); tone(150, 150, 0.35, 'square', 0.03); break;
    case 'zap': for (let i = 0; i < 6; i++) { noise(0.08, 2500 + i * 300, 0.25, 6, i * 0.06); tone(60 + i * 30, 900, 0.07, 'sawtooth', 0.06, i * 0.06); } break;
    case 'bark': tone(420, 260, 0.12, 'sawtooth', 0.14); noise(0.12, 900, 0.2, 2); tone(400, 240, 0.12, 'sawtooth', 0.12, 0.2); noise(0.12, 900, 0.18, 2, 0.2); break;
    case 'growl': tone(90, 70, 0.8, 'sawtooth', 0.08); noise(0.8, 300, 0.08, 3); break;
    case 'thunder': noise(2.6, 120, 0.7, 0.5); noise(1.2, 60, 0.6, 0.6, 0.3); tone(45, 30, 2.2, 'sine', 0.25); break;
    case 'cage': tone(220, 180, 0.4, 'square', 0.06); noise(0.35, 3000, 0.25, 8); tone(330, 300, 0.5, 'triangle', 0.05, 0.05); break;
    case 'hit': noise(0.12, 300, 0.6, 1); tone(110, 50, 0.18, 'sine', 0.4); break;
    case 'siren': for (let i = 0; i < 4; i++) { tone(700, 1100, 0.45, 'sawtooth', 0.05, i * 0.9); tone(1100, 700, 0.45, 'sawtooth', 0.05, i * 0.9 + 0.45); } break;
    case 'drug': tone(220, 55, 2.5, 'sine', 0.2); tone(233, 58, 2.5, 'sine', 0.12); break;
    case 'door2': tone(90, 60, 0.6, 'sawtooth', 0.08); noise(0.5, 400, 0.1, 1); break;
    case 'grunt': grunt(0, 1); break;
    case 'shock': // stun baton on someone: the electric crackle + a cry that cuts off
      zap(0, 1); grunt(0.08, 1.6, 0.5); grunt(0.62, 1.3, 0.35); break;
    case 'beating': { // a burst of blows: baton whoosh, body thud, pained grunt
      for (let i = 0; i < 6; i++) { const d = i * 0.27 + Math.random() * 0.08, v = 0.45 + Math.random() * 0.3; noise(0.08, 900, 0.07, 1.2, Math.max(0, d - 0.08)); thud(d, v); if (i % 2 === 0) grunt(d + 0.04, 0.9 + Math.random() * 0.3, 0.6); }
      break;
    }
    case 'punch': thud(0, 0.7); grunt(0.05, 1, 0.5); break;
    case 'stoneHit': thud(0, 0.8); noise(0.06, 2400, 0.25, 3); grunt(0.04, 1, 0.55); break;        // a stone hits Nam
    case 'woodThud': tone(160, 70, 0.18, 'sine', 0.3); noise(0.12, 700, 0.3, 1.5); noise(0.05, 2600, 0.12, 3); break; // on the boat's hull
    case 'splash': noise(0.35, 900, 0.22, 0.8); noise(0.18, 3200, 0.1, 1.5, 0.03); tone(380, 160, 0.12, 'sine', 0.06); break;
    case 'whoosh': noise(0.18, 1600, 0.12, 1.2); break;                                               // a stone flies past
    case 'mob': for (let i = 0; i < 4; i++) grunt(i * 0.13 + Math.random() * 0.05, 0.75 + Math.random() * 0.35, 0.3); break; // men shouting
    case 'arrest': { // getting caught: baton crackle + "Áaa!", then "Tha em với đại ca!" over the first blows
      zap(0, 1); scream(0.05, 0.55, 1.05);
      const spoke = G.voice('plea', 1.0);
      for (let i = 0; i < 5; i++) { const d = 1.15 + i * 0.32 + Math.random() * 0.08; thud(d, (spoke ? 0.32 : 0.45) + Math.random() * 0.2); if (!spoke && i % 2 === 0) grunt(d + 0.05, 1.15, 0.45); }
      break;
    }
    case 'arrestFar': zap(0, 0.35); scream(0.05, 0.2, 0.8); break; // a teammate (bot) caught somewhere else
  }
};
})(window.G);
