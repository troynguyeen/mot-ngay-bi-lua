// actors.js — humanoids, dogs, player + camera modes, guard/dog AI, searchlights & CCTV, story NPCs, stones
(function (G) {
'use strict';
const T = G.T, C = G.C, scene = G.scene, MAT = G.MAT;
const B = (w, h, d) => new T.BoxGeometry(w, h, d);
const V3 = T.Vector3;

// ---------------- humanoid ----------------
// The body comes from humans.js (a sculpted, skinned person on the same skeleton nodes); the old block figure below
// stays as a fallback. Props (flashlight, stun baton, rifle, baton, label) hang off the same nodes either way.
function boxBody(o, m, mesh) {
  const shirt = m(o.shirt), pants = m(o.pants), skin = m(o.skin || 0xc89c74, 0.7), hair = m(o.hair || 0x15110e, 0.95), shoe = m(o.shoe || 0x1a1a1a, 0.6);
  const sleeve = o.sleeveless ? skin : shirt, shin = o.shorts ? skin : pants;
  const g = new T.Group();
  const hips = new T.Group(); hips.position.y = 0.95; g.add(hips);
  mesh(B(0.38, 0.16, 0.22), pants, 0, -0.02, 0, hips);
  const spine = new T.Group(); hips.add(spine);
  const torso = mesh(B(0.44, 0.6, 0.24), shirt, 0, 0.32, 0, spine);
  if (o.vest) mesh(B(0.46, 0.42, 0.26), m(o.vest, 0.7), 0, 0.36, 0, spine);
  if (o.tattoo) mesh(B(0.01, 0.2, 0.1), m(0x1d2a3a, 0.8), 0.225, 0.4, 0, spine);
  const headG = new T.Group(); headG.position.y = 0.64; spine.add(headG);
  mesh(B(0.1, 0.08, 0.1), skin, 0, 0.02, 0, headG);
  mesh(B(0.22, 0.26, 0.24), skin, 0, 0.17, 0, headG);
  mesh(B(0.04, 0.05, 0.05), skin, 0, 0.15, 0.13, headG);
  if (!o.bald) { mesh(B(0.235, 0.08, 0.255), hair, 0, 0.31, -0.005, headG); mesh(B(0.235, 0.17, 0.07), hair, 0, 0.21, -0.1, headG); }
  if (o.longHair) mesh(B(0.24, 0.32, 0.08), hair, 0, 0.1, -0.11, headG);
  if (o.cap) { mesh(B(0.25, 0.08, 0.27), m(o.cap, 0.6), 0, 0.33, 0, headG); mesh(B(0.24, 0.02, 0.12), m(o.cap, 0.6), 0, 0.295, 0.17, headG); }
  if (o.helmet) mesh(B(0.27, 0.13, 0.29), m(o.helmet, 0.5), 0, 0.33, 0, headG);
  if (o.glasses) mesh(B(0.2, 0.05, 0.02), m(0x050505, 0.2), 0, 0.2, 0.125, headG);
  if (o.mask) mesh(B(0.225, 0.1, 0.02), m(o.mask, 0.9), 0, 0.1, 0.125, headG);
  const eyes = m(0x111111, 0.4); mesh(B(0.035, 0.02, 0.01), eyes, -0.05, 0.2, 0.121, headG).castShadow = false; mesh(B(0.035, 0.02, 0.01), eyes, 0.05, 0.2, 0.121, headG).castShadow = false;
  const arm = (side) => {
    const sh = new T.Group(); sh.position.set(side * 0.29, 0.56, 0); spine.add(sh);
    mesh(B(0.12, 0.32, 0.13), sleeve, 0, -0.15, 0, sh);
    const el = new T.Group(); el.position.y = -0.31; sh.add(el);
    mesh(B(0.1, 0.28, 0.11), o.longSleeve ? shirt : skin, 0, -0.14, 0, el);
    mesh(B(0.09, 0.09, 0.1), skin, 0, -0.32, 0.01, el);
    return [sh, el];
  };
  const leg = (side) => {
    const hp = new T.Group(); hp.position.set(side * 0.11, -0.04, 0); hips.add(hp);
    mesh(B(0.17, 0.45, 0.18), pants, 0, -0.22, 0, hp);
    const kn = new T.Group(); kn.position.y = -0.45; hp.add(kn);
    mesh(B(0.145, 0.44, 0.15), shin, 0, -0.22, 0, kn);
    mesh(B(0.15, 0.08, 0.27), shoe, 0, -0.46, 0.05, kn);
    return [hp, kn];
  };
  const [armL, elL] = arm(-1), [armR, elR] = arm(1), [legL, knL] = leg(-1), [legR, knR] = leg(1);
  if (o.bruises) { const br = m(0x6a1418, 0.6); mesh(B(0.12, 0.1, 0.01), br, 0.08, 0.4, 0.122, spine); mesh(B(0.08, 0.06, 0.01), br, -0.1, 0.18, -0.122, spine); mesh(B(0.06, 0.06, 0.01), br, 0.06, 0.2, 0.121, headG); }
  return { group: g, hips, spine, head: headG, armL, armR, elL, elR, legL, legR, knL, knR, torso };
}
const cyl = (r0, r1, h, n) => new T.CylinderGeometry(r0, r1, h, n || 16);
G.Humanoid = function (o) {
  const m = (hex, r, mt) => G.std({ color: C(hex), roughness: r || 0.85, metalness: mt || 0 });
  const mesh = (geo, mat, x, y, z, parent) => { const me = new T.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me; };
  const H = G.buildPerson ? G.buildPerson(o) : boxBody(o, m, mesh);
  const { hips, spine, elL, elR } = H;
  // police baton on the right hip: rubber grip, side handle
  if (o.baton) { const bt = new T.Group(); bt.position.set(0.215, -0.1, 0.06); hips.add(bt); mesh(cyl(0.016, 0.018, 0.5, 12), m(0x111111, 0.45), 0, -0.05, 0, bt); mesh(cyl(0.019, 0.019, 0.13, 12), m(0x1c1c1c, 0.9), 0, 0.16, 0, bt); const hd = mesh(cyl(0.012, 0.012, 0.09, 8), m(0x111111, 0.5), 0.03, 0.12, 0, bt); hd.rotation.z = Math.PI / 2; }
  // rifle slung across the back: stock, receiver, magazine, barrel, sling
  if (o.rifle) {
    const rf = new T.Group(); rf.position.set(0, 0.32, -0.17); rf.rotation.z = 0.7; spine.add(rf);
    const blk = m(0x161718, 0.42, 0.55), wood = m(0x4a3020, 0.6);
    mesh(B(0.045, 0.1, 0.26), wood, 0, -0.01, -0.3, rf); mesh(B(0.05, 0.085, 0.3), blk, 0, 0, -0.03, rf);
    const mag = mesh(B(0.03, 0.16, 0.06), blk, 0, -0.1, 0.03, rf); mag.rotation.x = 0.25;
    const br = mesh(cyl(0.012, 0.012, 0.42, 10), blk, 0, 0.02, 0.32, rf); br.rotation.x = Math.PI / 2;
    mesh(B(0.04, 0.05, 0.16), wood, 0, -0.005, 0.18, rf);
  }
  // flashlight in the left fist, pointing along the forearm (the beam is attached by makeGuard)
  let torch = null;
  if (o.torch) {
    torch = new T.Group(); torch.position.set(0, -((H.dims ? H.dims.fore : 0.255) + 0.105), 0.005); elL.add(torch);
    mesh(cyl(0.017, 0.016, 0.2, 16), m(0x16181b, 0.4, 0.6), 0, -0.03, 0, torch);
    mesh(cyl(0.026, 0.018, 0.06, 20), m(0x2a2d31, 0.3, 0.8), 0, -0.16, 0, torch);
    const lens = new T.Mesh(new T.CircleGeometry(0.023, 20), new T.MeshBasicMaterial({ color: new T.Color(0xfff1c8).multiplyScalar(6), fog: false })); lens.rotation.x = Math.PI / 2; lens.position.y = -0.191; torch.add(lens);
  }
  // electric stun baton in the right fist: grip, black shaft, a blue charge strip and two metal prongs that arc
  let spark = null;
  if (o.stun || o.stunBaton) {
    const bg = new T.Group(); bg.position.set(0, -((H.dims ? H.dims.fore : 0.255) + 0.105), 0.005); bg.rotation.x = 0.3; elR.add(bg);
    const g1 = mesh(cyl(0.021, 0.023, 0.2, 14), m(0x232323, 0.9), 0, 0, 0.02, bg); g1.rotation.x = Math.PI / 2;
    const g2 = mesh(cyl(0.028, 0.028, 0.03, 14), m(0x9aa0a6, 0.3, 0.9), 0, 0, 0.135, bg); g2.rotation.x = Math.PI / 2;
    const g3 = mesh(cyl(0.019, 0.02, 0.36, 14), m(0x0e0e10, 0.35), 0, 0, 0.3, bg); g3.rotation.x = Math.PI / 2;
    const strip = new T.Mesh(B(0.006, 0.014, 0.13), new T.MeshBasicMaterial({ color: 0x46a6ff, fog: false })); strip.position.set(0.019, 0, 0.27); bg.add(strip);
    for (const sx of [-0.012, 0.012]) mesh(B(0.008, 0.008, 0.05), m(0xd8dde2, 0.2, 1), sx, 0, 0.5, bg);
    // the arc itself: a sprite showing one of a few hand-drawn zig-zag bolts, re-picked and spun every flicker
    const arcMat = new T.SpriteMaterial({ map: arcTex()[0], color: new T.Color(0xffffff).multiplyScalar(3), transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    const arcS = new T.Sprite(arcMat); arcS.position.set(0, 0, 0.55); arcS.visible = false; bg.add(arcS);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: G.TX.glow, color: new T.Color(0x2f7dff).multiplyScalar(2.5), transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.set(0, 0, 0.54); glow.scale.set(0.3, 0.3, 1); glow.visible = false; bg.add(glow);
    spark = { arc: arcS, glow, t: Math.random(), on: false, strip, f: 0 };
  }
  if (o.label) { const p = new T.Mesh(new T.PlaneGeometry(0.3, 0.09), G.std({ map: G.signTex([o.label], { bg: '#0d0d0d', fg: '#f2f2f2', w: 256, h: 72, grime: false }) })); p.position.set(0, 0.43, -0.136); p.rotation.y = Math.PI; spine.add(p); }
  (o.parent || G.root || scene).add(H.group);
  H.torch = torch; H.spark = spark;
  return H;
};// stun-baton arcs: short random bursts of zig-zag sparks between the prongs (+ a faint crackle when the player is close)
let sparkSndT = 0;
G.sparkTick = function (h, dt, worldPos) {
  const s = h.spark; if (!s) return;
  const near = h.group.visible && G.camera.position.distanceToSquared(worldPos) < 30 * 30;
  s.t -= dt;
  if (s.t <= 0) {
    s.on = near && Math.random() < 0.65; s.t = s.on ? 0.08 + Math.random() * 0.24 : 0.12 + Math.random() * 0.6; // arcing about half the time
    if (s.on && G.sparkSound) { const d = Math.hypot(P.pos.x - worldPos.x, P.pos.z - worldPos.z); if (d < 7 && performance.now() > sparkSndT) { sparkSndT = performance.now() + 250; G.sparkSound(1 - d / 7); } }
  }
  s.arc.visible = s.glow.visible = s.on;
  s.strip.material.color.setHex(s.on ? 0xbfe4ff : 0x46a6ff);
  if (!s.on) return;
  // flicker: a new bolt shape / angle / size every other frame (drawn a little larger than life so it reads from the game camera)
  if ((s.f = (s.f + 1) % 2) === 0) {
    const tex = arcTex(); s.arc.material.map = tex[(Math.random() * tex.length) | 0];
    s.arc.material.rotation = Math.random() * Math.PI * 2; const as = 0.3 + Math.random() * 0.25; s.arc.scale.set(as, as, 1);
    s.arc.material.opacity = 0.75 + Math.random() * 0.25; const gs = 0.26 + Math.random() * 0.2; s.glow.scale.set(gs, gs, 1);
  }
};
// a few zig-zag electric bolts on transparent canvases, made once
let ARC_TEX = null;
function arcTex() {
  if (ARC_TEX) return ARC_TEX;
  ARC_TEX = [0, 1, 2, 3].map((v) => G.makeTex(96, 96, (g) => {
    g.clearRect(0, 0, 96, 96); g.lineCap = 'round'; g.lineJoin = 'round';
    const bolt = (x0, y0, x1, y1, n, w) => { g.beginPath(); g.moveTo(x0, y0); for (let i = 1; i < n; i++) { const f = i / n; g.lineTo(x0 + (x1 - x0) * f + (Math.random() - 0.5) * 22, y0 + (y1 - y0) * f + (Math.random() - 0.5) * 22); } g.lineTo(x1, y1); g.lineWidth = w; g.stroke(); };
    const strokes = [[40, 48, 56, 48, 3, 3.2], [48, 48, 12 + v * 9, 14 + v * 5, 6, 2.2], [48, 48, 84 - v * 7, 20 + v * 11, 5, 1.8], [48, 48, 30 + v * 10, 86 - v * 4, 5, 1.6]];
    for (const pass of [[12, 'rgba(70,150,255,0.55)', 2.2], [0, 'rgba(225,245,255,1)', 1]]) { g.shadowBlur = pass[0]; g.shadowColor = '#3c9bff'; g.strokeStyle = pass[1]; for (const st of strokes) bolt(st[0], st[1], st[2], st[3], st[4], st[5] * pass[2]); }
  }, { repeat: false }));
  return ARC_TEX;
}
G.animHuman = function (h, o) {
  const a = o.amt || 0, ph = o.phase || 0, t = o.t || 0, run = o.run;
  const sw = Math.sin(ph) * (run ? 0.8 : 0.55) * Math.min(a, 1.2);
  let hipY = 0.95 - Math.abs(Math.sin(ph)) * 0.04 * a, lean = run ? 0.22 : 0.04 * a, hipX = 0;
  let lL = -sw, lR = sw, kL = Math.max(0, Math.sin(ph - 1.3)) * (run ? 1.3 : 0.9) * Math.min(a, 1), kR = Math.max(0, Math.sin(ph + Math.PI - 1.3)) * (run ? 1.3 : 0.9) * Math.min(a, 1);
  let aL = sw * 0.8, aR = -sw * 0.8, eL = -0.2 - a * 0.25, eR = -0.2 - a * 0.25, aRz = 0, aLz = 0, headX = 0, headY = 0;
  const pose = o.pose || 'stand';
  let splay = 0;
  if (o.crouch && pose === 'stand') {
    // deep squat ("ngồi xổm"): thighs about level, knees spread, heels under the hips, forearms out over the knees.
    // Moving = short duck-walk steps: each thigh swings, and the knee angle is solved so that foot stays on the ground
    // (lifted a little while it travels forward).
    const m = Math.min(1, a / 0.45), sL = Math.sin(ph), cL = Math.cos(ph);
    hipY = 0.505 + Math.abs(sL) * 0.025 * m; lean = 0.42; headX = -0.32; splay = 0.2;
    const Hp = hipY - 0.04, T = 0.45, S = 0.6, swing = 0.34 * m;
    const knee = (th, lift) => Math.acos(G.clamp((Hp - T * Math.cos(th) - lift) / S, -1, 1)) - th;
    lL = -1.42 - sL * swing; lR = -1.42 + sL * swing;
    kL = knee(lL, Math.max(0, cL) * 0.07 * m); kR = knee(lR, Math.max(0, -cL) * 0.07 * m);
    aL = -0.55 + sL * 0.16 * m; aR = -0.55 - sL * 0.16 * m; eL = eR = -0.85; aLz = -0.14; aRz = 0.14;
  }
  if (pose === 'sit' || pose === 'type' || pose === 'tied' || pose === 'phone_sit') { hipY = 0.5; lL = lR = -1.57; kL = kR = 1.57; lean = 0.05; aL = aR = 0.05; eL = eR = -0.5; }
  if (pose === 'type') { aL = -0.95 + Math.sin(t * 18) * 0.04; aR = -0.95 + Math.cos(t * 17) * 0.04; eL = eR = -0.7; lean = 0.12; }
  if (pose === 'tied') { aL = aR = 0.55; eL = eR = -0.3; aLz = 0.18; aRz = -0.18; headX = 0.55 + Math.sin(t * 0.7) * 0.05; lean = 0.15; }
  if (pose === 'phone_sit') { aR = -0.7; eR = -1.6; aL = -0.5; eL = -1.4; headX = 0.45; lean = 0.2; }
  if (pose === 'floor') { hipY = 0.17; lL = -1.4; lR = -1.5; kL = 0.6; kR = 0.4; aL = aR = 0.6; eL = eR = -0.2; aLz = 0.2; aRz = -0.2; lean = -0.05; headX = 0.35 + Math.sin(t * 0.9) * 0.04; }
  if (pose === 'kneel') { hipY = 0.58; lL = lR = 0; kL = kR = 1.57; aL = aR = 0.6; eL = eR = -0.2; aLz = 0.2; aRz = -0.2; headX = 0.5; lean = 0.1; }
  if (pose === 'smoke') { aR = -0.35; eR = -2.2; aRz = 0.15; aL = 0.05; eL = -0.2; }
  if (pose === 'talk') { aR = -0.35 + Math.sin(t * 2.6) * 0.18; eR = -0.8; }
  if (pose === 'point') { aR = -1.5; eR = -0.1; aL = 0.05; }
  if (pose === 'raise') { aR = -2.7; eR = -0.6; aL = -0.3; eL = -0.5; lean = -0.1; }
  if (pose === 'strike') { aR = -0.9 + Math.sin(t * 14) * 0.6; eR = -0.3; lean = 0.15; }
  if (pose === 'hug') { aL = aR = -1.3; eL = eR = -0.7; aLz = -0.3; aRz = 0.3; lean = 0.1; }
  if (pose === 'hands_up') { aL = aR = -2.9; eL = eR = -0.2; }
  if (pose === 'shock') { const j = Math.sin(t * 60); lean = 0.3 + j * 0.15; aL = 0.3 + j * 0.4; aR = 0.3 - j * 0.4; headX = 0.4 + j * 0.3; headY = j * 0.2; kL = kR = 0.6; lL = lR = -0.3; hipY = 0.85; }
  if (pose === 'climb') { aL = -2.7 + Math.sin(ph) * 0.35; aR = -2.7 - Math.sin(ph) * 0.35; eL = eR = -0.3; lL = -0.7 + Math.sin(ph) * 0.5; lR = -0.7 - Math.sin(ph) * 0.5; kL = kR = 1.0; lean = 0; }
  if (pose === 'phone') { aR = -0.7; eR = -1.6; aL = -0.5; eL = -1.4; headX = 0.35; }
  if (pose === 'drink') { aR = -1.2; eR = -2.0; headX = -0.35; }
  if (pose === 'lie') { hipY = 0.16; hipX = -Math.PI / 2; lL = lR = 0.05; kL = kR = 0.1; aL = aR = 0.1; eL = eR = -0.1; lean = 0; headY = 0.4; }
  if (pose === 'stand' && a < 0.05 && !o.crouch) { lean = Math.sin(t * 1.5) * 0.015; }
  if (o.torch && pose === 'stand') { aL = -1.1 + Math.sin(ph) * 0.04 * Math.min(a, 1); eL = -0.24; aLz = 0.1; } // flashlight held out, aimed ~13° down
  h.hips.position.y = hipY; h.hips.rotation.x = hipX; h.spine.rotation.x = lean; h.head.rotation.x = headX; h.head.rotation.y = headY;
  h.legL.rotation.x = lL; h.legR.rotation.x = lR; h.knL.rotation.x = kL; h.knR.rotation.x = kR;
  h.legL.rotation.z = -splay; h.legR.rotation.z = splay; // knees apart in the squat
  h.armL.rotation.x = aL; h.armR.rotation.x = aR; h.armL.rotation.z = -0.06 + aLz; h.armR.rotation.z = 0.06 + aRz; h.elL.rotation.x = eL; h.elR.rotation.x = eR;
};

// ---------------- dog ----------------
G.Dog = function (o) {
  if (G.buildDog) { const d = G.buildDog(o); (o.parent || G.root || scene).add(d.group); return d; }
  const fur = G.std({ color: C(o.color || 0x2a2018), roughness: 0.95 });
  const g = new T.Group(), body = new T.Group(); body.position.y = 0.55; g.add(body);
  const add = (geo, x, y, z, p) => { const m = new T.Mesh(geo, fur); m.position.set(x, y, z); m.castShadow = true; (p || body).add(m); return m; };
  add(B(0.32, 0.3, 0.85), 0, 0, 0);
  const head = new T.Group(); head.position.set(0, 0.18, 0.45); body.add(head);
  add(B(0.24, 0.24, 0.28), 0, 0, 0.05, head); add(B(0.14, 0.12, 0.2), 0, -0.04, 0.26, head);
  add(B(0.06, 0.12, 0.05), -0.08, 0.16, 0, head); add(B(0.06, 0.12, 0.05), 0.08, 0.16, 0, head);
  const eye = new T.Mesh(B(0.2, 0.03, 0.01), G.std({ color: 0x000000, emissive: C(0xffc040), emissiveIntensity: 0.6 })); eye.position.set(0, 0.04, 0.2); head.add(eye);
  const legs = [];
  for (const [x, z] of [[-0.11, 0.3], [0.11, 0.3], [-0.11, -0.3], [0.11, -0.3]]) { const p = new T.Group(); p.position.set(x, -0.1, z); body.add(p); add(B(0.08, 0.48, 0.08), 0, -0.22, 0, p); legs.push(p); }
  const tail = new T.Group(); tail.position.set(0, 0.1, -0.42); body.add(tail); add(B(0.05, 0.05, 0.35), 0, 0, -0.16, tail); tail.rotation.x = -0.6;
  (o.parent || G.root || scene).add(g);
  return { group: g, body, head, legs, tail, dog: true };
};
G.animDog = function (d, o) {
  const a = Math.min(o.amt || 0, 2), ph = o.phase || 0, t = o.t || 0;
  d.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph * 1.6 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 * Math.min(a, 1); });
  d.body.position.y = 0.55 + Math.abs(Math.sin(ph * 1.6)) * 0.04 * a;
  d.tail.rotation.y = Math.sin(t * (o.alert ? 3 : 8)) * 0.4;
  d.head.rotation.x = o.sniff ? 0.45 + Math.sin(t * 9) * 0.08 : o.alert ? -0.15 : 0;
};

// ---------------- icons ----------------
const iconTex = (ch, col) => G.makeTex(64, 64, (g) => { g.font = '700 54px Oswald, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeText(ch, 32, 34); g.fillStyle = col; g.fillText(ch, 32, 34); }, { repeat: false });
const ICON = { q: new T.SpriteMaterial({ map: iconTex('?', '#f0a23a'), depthTest: false }), x: new T.SpriteMaterial({ map: iconTex('!', '#ff2a2a'), depthTest: false }) };

// ---------------- player ----------------
const P = G.player = {
  h: G.Humanoid(Object.assign({}, G.playerLook ? G.playerLook() : { shirt: 0xc9c2b2, pants: 0x2a3140, skin: 0xc79a74, hair: 0x120e0b }, { parent: scene })), // the look from the character creator
  pos: new V3(0, 0, 0), yaw: 0, speed: 0, dir: new V3(0, 0, 1), phase: 0, frozen: false, pose: null, running: false, crouch: false,
  indoor: false, vis: 1, stepAcc: 0, climb: 0, chain: null, eyeH: 1.55,
};
const cam = G.cam = { yaw: Math.PI * 0.75, pitch: 0.32, dist: 4.4, curDist: 4.4, tgt: new V3(), mode: 'tp', cine: { pos: new V3(), look: new V3(), k: 2.5 }, shake: 0, roll: 0, drug: 0 };
G.placePlayer = function (x, z, yaw) { P.pos.set(x, 0, z); P.yaw = yaw; P.speed = 0; cam.yaw = yaw + Math.PI; cam.tgt.set(x, 1.5, z); cam.curDist = G.camView ? G.camView().dist : cam.dist; };
G.inRect = (x, z, r, pad) => x > r.x0 - (pad || 0) && x < r.x1 + (pad || 0) && z > r.z0 - (pad || 0) && z < r.z1 + (pad || 0);
G.isIndoor = (x, z) => G.buildings.some((b) => !b.open && G.inRect(x, z, b));
G.lightsOut = false;
G.isLit = function (x, z) {
  if (G.night < 0.5) return true;
  if (G.lightsOut) return false;
  if (G.buildings.some((b) => b.lit && G.inRect(x, z, b))) return true;
  return G.lit.some((l) => (x - l.x) ** 2 + (z - l.z) ** 2 < l.r * l.r);
};
G.slowZones = [];
G.updatePlayer = function (dt, t) {
  const inp = G.input, k = inp.keys;
  // frozen = a cutscene moves the player; P.walkAmt / P.walkSpeed let it still take steps (e.g. up the plane's stairs)
  if (P.frozen) { G.animHuman(P.h, { pose: P.pose || 'stand', t, amt: P.walkAmt || 0, speed: P.walkSpeed || 0, phase: P.phase }); P.h.group.position.copy(P.pos); P.h.group.rotation.y = P.yaw; return; }
  let ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + inp.joyX;
  let iz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - inp.joyY;
  let len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; len = 1; }
  P.crouch = inp.crouch;
  P.running = (k.ShiftLeft || k.ShiftRight || inp.run) && len > 0.2 && !P.load; // (hands full: no running)
  if (P.running && P.crouch) { P.crouch = false; inp.crouch = false; }
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  if (len > 0.05) {
    P.dir.set(fx * iz + rx * ix, 0, fz * iz + rz * ix).normalize();
    if (cam.mode !== 'fp') P.yaw += G.angDiff(P.yaw, Math.atan2(P.dir.x, P.dir.z)) * Math.min(1, dt * 12);
  }
  let mul = 1; for (const z of G.slowZones) if (G.inRect(P.pos.x, P.pos.z, z)) mul = Math.min(mul, z.k);
  if (P.slowT > 0) { P.slowT -= dt; mul *= 0.5; } // staggered (hit by a stone)
  if (P.load) mul *= P.load; // carrying something
  const target = len * (P.running ? 6.2 : P.crouch ? 1.8 : 3.4) * mul;
  P.speed = G.damp(P.speed, target, 10, dt);
  P.pos.addScaledVector(P.dir, P.speed * dt);
  G.collide(P.pos, 0.32, P.pos.y);
  if (P.chain) { const dx = P.pos.x - P.chain.x, dz = P.pos.z - P.chain.z, d = Math.hypot(dx, dz); if (d > P.chain.r) { P.pos.x = P.chain.x + dx / d * P.chain.r; P.pos.z = P.chain.z + dz / d * P.chain.r; if (Math.random() < 0.05) G.sfx('cage'); } }
  const yawRate = Math.abs(G.angDiff(P.yaw, P.lastYaw === undefined ? P.yaw : P.lastYaw)) / Math.max(dt, 1e-3); P.lastYaw = P.yaw;
  P.turn = G.damp(P.turn || 0, yawRate, 8, dt);
  P.phase += (P.speed + (P.speed < 0.3 ? Math.max(0, P.turn - 0.8) * 0.3 : 0)) * dt * (G.gaitRate ? G.gaitRate(Math.max(P.speed, 0.6), { run: P.running, crouch: P.crouch, h: P.h }) : 2.5);
  // one footstep per half stride, in time with the legs: loud when running, normal walking, a faint shuffle when crouched
  const stepN = Math.floor((P.phase - Math.PI / 2) / Math.PI);
  if (stepN !== P.lastStep) {
    P.lastStep = stepN;
    if (P.speed > 0.35) {
      const surf = P.indoor ? 'tile' : mul < 1 ? 'mud' : G.rainK > 0.2 ? 'wet' : 'dry';
      if (G.footstep) G.footstep(P.running ? 'run' : P.crouch ? 'sneak' : 'walk', surf);
      if (P.running && G.makeNoise) G.makeNoise(P.pos.x, P.pos.z, 9 * (mul < 1 ? 1.3 : 1), 'step');
    }
  }
  P.indoor = G.isIndoor(P.pos.x, P.pos.z);
  const lit = G.isLit(P.pos.x, P.pos.z);
  P.vis = (G.night > 0.5 ? (lit ? 1 : 0.6) : 1) * (P.crouch ? 0.6 : 1) * (P.running ? 1.25 : 1);
  G.animHuman(P.h, { pose: 'stand', crouch: P.crouch, speed: P.speed, amt: P.speed / 3.4, phase: P.phase, run: P.running, turn: P.turn, t });
  P.h.group.position.copy(P.pos); P.h.group.rotation.y = P.yaw;
};
const _o = new V3(), _d = new V3(), _l = new V3();
G.camForward = () => new V3(-Math.sin(cam.yaw) * Math.cos(cam.pitch), -Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
G.shake = (a) => { cam.shake = Math.max(cam.shake, a); };
// Camera distance and field of view follow the screen shape: a tall phone screen sees very little sideways at the
// desktop framing, so it pulls back and widens (about five people fit across). Pinch / mouse wheel / the settings
// slider scale it further (cam.zoom, remembered on this browser).
cam.zoom = 1;
try { const z = parseFloat(localStorage.getItem('mnbl-zoom')); if (z) cam.zoom = G.clamp(z, 0.6, 1.8); } catch (e) { /* storage blocked */ }
G.camView = function () {
  const a = innerWidth / Math.max(1, innerHeight), k = G.clamp((1.3 - a) / 0.84, 0, 1); // 0 = wide screen … 1 = tall phone
  return { dist: (4.4 + 4.2 * k) * cam.zoom, indoor: (3.3 + 3.0 * k) * Math.min(cam.zoom, 1.25), fov: 62 + 12 * k };
};
G.setZoom = function (z, save) {
  cam.zoom = G.clamp(z, 0.6, 1.8);
  if (save) { try { localStorage.setItem('mnbl-zoom', cam.zoom.toFixed(2)); } catch (e) { /* storage blocked */ } }
  if (G.onZoom) G.onZoom(cam.zoom);
};
G.zoomBy = (f, save) => G.setZoom(cam.zoom * f, save);
const PITCH_LOW = -0.35, PITCH_SKY = -1.45; // third person: lowest camera position / furthest the view tilts up (sky)
G.updateCamera = function (dt, t) {
  const inp = G.input;
  const view = G.camView(); cam.dist = view.dist;
  if (Math.abs(G.camera.fov - view.fov) > 0.05) { G.camera.fov = view.fov; G.camera.updateProjectionMatrix(); }
  const sens = inp.touch ? 0.0042 : 0.0026;
  t = t || 0;
  if (cam.mode !== 'cine') { cam.yaw -= inp.lookX * sens; cam.pitch = G.clamp(cam.pitch + inp.lookY * sens, cam.mode === 'fp' ? -1.35 : PITCH_SKY, cam.mode === 'fp' ? 1.0 : 1.15); }
  inp.lookX = 0; inp.lookY = 0;
  if (cam.mode === 'cine') {
    const c = cam.cine, k = 1 - Math.exp(-c.k * dt);
    G.camera.position.lerp(c.pos, c.snap ? 1 : k); _l.copy(c.look); c.snap = false;
    G.camera.lookAt(_l);
    P.h.group.visible = true;
  } else if (cam.mode === 'fp') {
    _o.set(P.pos.x, P.pos.y + P.eyeH, P.pos.z);
    G.camera.position.copy(_o); _l.copy(_o).add(G.camForward()); G.camera.lookAt(_l);
    P.h.group.visible = false;
  } else {
    const headY = P.pos.y + (P.frozen && /sit|type/.test(P.pose || '') ? 1.15 : P.crouch ? 1.0 : 1.55);
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    cam.tgt.x = G.damp(cam.tgt.x, P.pos.x + rx * 0.42, 18, dt); cam.tgt.y = G.damp(cam.tgt.y, headY, 10, dt); cam.tgt.z = G.damp(cam.tgt.z, P.pos.z + rz * 0.42, 18, dt);
    const base = P.indoor ? Math.min(view.indoor, view.dist) : view.dist;
    // past PITCH_LOW the camera stops sinking (it would go under the ground) and tilts up toward the sky instead
    const low = Math.max(PITCH_LOW, -Math.asin(G.clamp((cam.tgt.y - 0.25) / base, 0, 1))); // where the camera would touch the ground
    const pp = Math.max(cam.pitch, low), up = pp - cam.pitch;
    _d.set(Math.sin(cam.yaw) * Math.cos(pp), Math.sin(pp), Math.cos(cam.yaw) * Math.cos(pp));
    const d = G.clamp(G.rayDist(cam.tgt, _d, base + 0.3) - 0.3, 0.6, base);
    cam.curDist = d < cam.curDist ? d : G.damp(cam.curDist, d, 4, dt);
    _o.copy(cam.tgt).addScaledVector(_d, cam.curDist); if (_o.y < 0.25) _o.y = 0.25;
    G.camera.position.copy(_o);
    if (up > 0.001) {
      _l.copy(cam.tgt).sub(_o); const h = Math.hypot(_l.x, _l.z) || 1, a = Math.min(Math.atan2(_l.y, h) + up, 1.38);
      _l.set(_o.x + _l.x / h * Math.cos(a), _o.y + Math.sin(a), _o.z + _l.z / h * Math.cos(a)); G.camera.lookAt(_l);
    } else G.camera.lookAt(cam.tgt);
    P.h.group.visible = cam.curDist > 0.75;
  }
  if (cam.shake > 0.001) { G.camera.position.x += G.rr(-1, 1) * cam.shake; G.camera.position.y += G.rr(-1, 1) * cam.shake; cam.shake *= Math.exp(-dt * 7); }
  if (cam.drug > 0) G.camera.rotation.z += Math.sin(t * 0.9) * 0.12 * cam.drug;
};

// ---------------- stones & noise ----------------
const stones = [];
const stoneGeo = new T.DodecahedronGeometry(0.07, 0), stoneMat = G.std({ color: C(0x8c8478), roughness: 1 });
let stoneCd = 0;
G.throwStone = function () {
  if (stoneCd > 0) return false; stoneCd = 1.0;
  const m = new T.Mesh(stoneGeo, stoneMat); m.castShadow = true; G.add(m);
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  m.position.set(P.pos.x + fx * 0.4, P.pos.y + 1.5, P.pos.z + fz * 0.4);
  stones.push({ m, v: new V3(fx * 13, 5.5 - Math.max(cam.pitch, PITCH_LOW) * 4, fz * 13), life: 4 });
  G.sfx('throw'); return true;
};
G.updateStones = function (dt) {
  stoneCd -= dt;
  for (let i = stones.length - 1; i >= 0; i--) {
    const s = stones[i]; s.v.y -= 18 * dt; const p = s.m.position; const ox = p.x, oz = p.z;
    p.addScaledVector(s.v, dt); s.m.rotation.x += dt * 9;
    let hit = p.y <= 0.07;
    if (!hit) for (const c of G.colliders) { if (c.solid && !c.off && p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1 && p.y > c.y0 && p.y < c.y1) { hit = true; p.x = ox; p.z = oz; break; } }
    s.life -= dt;
    if (hit && !s.landed) { s.landed = true; s.v.set(0, 0, 0); p.y = Math.max(p.y, 0.07); G.sfx('clack'); G.makeNoise(p.x, p.z, 17, 'stone'); }
    if (s.life <= 0) { if (s.m.parent) s.m.parent.remove(s.m); stones.splice(i, 1); }
  }
};

// ---------------- guards & dogs ----------------
// flashlight beam: a soft volumetric cone (lights.js); the floor spot is only a fallback when no real light is free
const beamMat = G.beamMaterial(0xfff2c8, 0);
const spotMat = new T.MeshBasicMaterial({ map: G.TX.glow, color: C(0xfff0c0), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false });
const _tdir = new V3();
const guards = G.guards = [];
const _bo = new V3(), _bd = new V3(); // flashlight ray (origin, direction)
// how far a dog sees compared with a guard: used by sees(), by its lamp and by the minimap cone
const DOG_SIGHT = G.DOG_SIGHT = 0.8;
G.DOG_SMELL = { sneak: 2.2, stand: 6.5 }; // closer than this it notices you in any direction
// the two lamps: beam length, beam radius at the far end, where the spot on the floor sits, the real light's reach
const LAMP_GUARD = { len: 8, rad: 1.7, spot: 5.5, size: 4.5, range: 18, y: 1.25, fwd: 0.45, dip: 0.226 };
const LAMP_DOG = { len: 8 * DOG_SIGHT, rad: 1.7 * DOG_SIGHT, spot: 5.5 * DOG_SIGHT, size: 4.5 * DOG_SIGHT, range: 18 * DOG_SIGHT, y: 0.84, fwd: 0.62, dip: 0.17 };
const LAMP_MAT = {};
// a dog's lamp sits on a harness on its back, not on the head: patrolling dogs sniff the ground, but they look where the body points
function dogLamp(h) {
  if (!LAMP_MAT.case) {
    LAMP_MAT.case = G.std({ color: C(0x15171a), roughness: 0.5 }); LAMP_MAT.strap = G.std({ color: C(0xd9692a), roughness: 0.8 });
    LAMP_MAT.on = new T.MeshBasicMaterial({ color: new T.Color(0xfff1c8).multiplyScalar(6), fog: false }); LAMP_MAT.off = G.std({ color: C(0x8f979d), roughness: 0.15 });
  }
  const at = new T.Group(); at.position.set(0, 0.245, 0.2); h.body.add(at); // the body bone is 0.55 m up
  const part = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); at.add(m); return m; };
  part(new T.BoxGeometry(0.09, 0.07, 0.12), LAMP_MAT.case, 0, 0, 0);
  part(new T.BoxGeometry(0.26, 0.025, 0.07), LAMP_MAT.strap, 0, -0.05, 0);
  for (const s of [-1, 1]) part(new T.BoxGeometry(0.02, 0.17, 0.07), LAMP_MAT.strap, s * 0.142, -0.15, 0);
  const lens = part(new T.CircleGeometry(0.032, 16), LAMP_MAT.off, 0, 0.005, 0.062);
  const aim = new T.Group(); aim.position.set(0, 0.005, 0.07); aim.rotation.x = LAMP_DOG.dip; at.add(aim);
  return { aim, lens };
}
const GUARD_LOOK = { shirt: 0xd9692a, pants: 0x1b1d22, cap: 0x1b1d22, torch: true, stunBaton: true };
// Team mode (day and night): a guard or dog catches you only after WATCH.secs inside what it sees or smells. While it
// watches, it stands still and its zone stays put, so leaving that zone always gets you away; the count then drains fast.
// A glimpse shorter than WATCH.notice does not stop it: the zone just sweeps on past you. Whoever is locked up (no way
// to run, and where prisoners belong) is not watched at all: G.teamPenned, the map's `penned`.
// Every guard keeps its own count for every player. Solo keeps the quick 'sus' meter and the chase.
const WATCH = G.WATCH = {
  secs: 5,   // seconds in view before a catch
  notice: 0.5, // seconds in view before it stops to watch (at once if it was coming over to check a noise)
  drain: 4,  // counts down this many times faster once out of view
  cool: 3,   // seconds it ignores footsteps after losing someone (or it would turn round after whoever ran away)
  bark: 1.5, // a dog calls the other guards only after watching this long
};
const teamSight = () => !!(G.state && G.state.teamPlay);
// (team mode: running is loud but does not stretch the zone, or it would grow just as you run out of it)
G.sightVis = () => (teamSight() && P.running ? P.vis / 1.25 : P.vis);
function forgetWatch(g) { g.watch.clear(); g.inView.clear(); g.wp = 0; g.cool = 0; g.barked = false; g.hold = false; }
function makeGuard(def) {
  const g = Object.assign({ pos: new V3(), yaw: 0, state: 'patrol', wi: 0, wait: 0, sus: 0, last: new V3(), phase: 0, speed: 0, pi: 0, timer: 0, seen: 0, barkT: 0 }, def);
  let spec = LAMP_GUARD, flash;
  if (def.dog) {
    g.h = G.Dog({ color: def.color }); spec = LAMP_DOG;
    const lamp = dogLamp(g.h); flash = lamp.aim; g.lens = lamp.lens;
  } else {
    g.h = G.Humanoid(Object.assign({ skin: def.skin || 0xb88760 }, GUARD_LOOK, def.look || {}));
    // the beam comes out of the flashlight lens: its +z runs along the flashlight (the forearm's -y)
    flash = new T.Group(); flash.position.set(0, -0.2, 0); flash.rotation.x = Math.PI / 2; g.h.torch.add(flash);
  }
  const beam = new T.Mesh(new T.CylinderGeometry(spec.rad, 0.05, spec.len, 24, 1, true), beamMat); beam.rotation.x = Math.PI / 2; beam.position.z = spec.len / 2; flash.add(beam);
  G.softLayer(beam);
  g.flash = flash; g.beam = beam; g.lamp = spec; flash.visible = false;
  g.pool = new T.Mesh(new T.PlaneGeometry(spec.size, spec.size), spotMat.clone()); g.pool.rotation.x = -Math.PI / 2; g.pool.visible = false; G.add(g.pool);
  // the real light of the flashlight / dog lamp (one of the pooled spotlights when it is near the camera)
  g.em = G.addEmitter({ kind: 'torch', angle: 0.3, penumbra: 0.6, color: C(0xfff0d2), intensity: 5, range: spec.range, decay: 1.25, prio: 1.5, shadow: true, on: () => g.flash.visible && g.h.group.visible });
  g.icon = new T.Sprite(ICON.q); g.icon.scale.set(0.55, 0.55, 1); g.icon.position.y = def.dog ? 1.4 : 2.35; g.icon.visible = false; g.h.group.add(g.icon);
  g.watch = new Map(); g.inView = new Set(); forgetWatch(g);
  guards.push(g); return g;
}
G.setupGuards = function (defs) { guards.length = 0; defs.forEach(makeGuard); };
G.setGuardsMode = function (mode) {
  for (const g of guards) {
    forgetWatch(g);
    g.sus = 0; g.state = 'patrol'; g.wait = 0; g.wi = 0; g.icon.visible = false; g.timer = 0; g.tid = null; g.tgt = null;
    if (mode === 'day' || !g.route) { g.pos.set(g.day[0], 0, g.day[1]); g.yaw = g.day[2]; }
    else { g.pos.set(g.route[0][0], 0, g.route[0][1]); g.yaw = 0; }
    if (g.kind === 'office') { g.state = 'sit'; g.timer = mode === 'night' ? (g.firstSit || 22) : 9999; g.pos.set(g.seat[0], 0, g.seat[1]); g.yaw = g.seat[2]; }
    if (g.kind === 'sweep') g.state = 'sweep';
    if (g.kind === 'sleep') { g.state = 'sleep'; g.pos.set(g.day[0], 0, g.day[1]); g.yaw = g.day[2]; }
    g.mode = mode;
  }
};
function walkTo(g, x, z, spd, dt) {
  const dx = x - g.pos.x, dz = z - g.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.25) { g.speed = 0; return true; }
  g.yaw += G.angDiff(g.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
  g.speed = spd; const st = Math.min(d, spd * dt);
  g.pos.x += Math.sin(g.yaw) * st; g.pos.z += Math.cos(g.yaw) * st;
  G.collide(g.pos, 0.3, 0);
  return false;
}
// how far g sees somebody of that visibility (the minimap draws team mode's cones with it, too)
G.sightRange = function (g, vis) {
  // team mode: heavy rain hides you a little (up to 22 % less sight in a storm)
  const rainK = teamSight() ? 1 - 0.22 * G.rainK : 1;
  return (G.night > 0.5 ? 13 : 18) * vis * (g.state === 'sit' ? 0.85 : 1) * (g.dog ? DOG_SIGHT : 1) * rainK;
};
// tg: { pos, crouch, vis } — the local player or a remote one (multiplayer host)
function sees(g, tg) {
  const dx = tg.pos.x - g.pos.x, dz = tg.pos.z - g.pos.z, d = Math.hypot(dx, dz);
  if (g.state === 'sleep') return d < 1.4 && !tg.crouch ? 0.6 : 0;
  if (g.dog) { // dogs smell you when you're close and not sneaking
    if (d < (tg.crouch ? G.DOG_SMELL.sneak : G.DOG_SMELL.stand)) return 1 - d / 8;
  }
  if (d < 1.3 && !tg.crouch) return 1;
  const range = G.sightRange(g, tg.vis);
  if (d > range) return 0;
  const ang = Math.abs(G.angDiff(g.yaw, Math.atan2(dx, dz)));
  if (ang > 0.7) return 0;
  if (G.losBlocked(g.pos.x, g.pos.z, tg.pos.x, tg.pos.z)) return 0;
  return 1 - (d / range) * 0.65;
}
const LOCAL = { id: 'me', pos: P.pos, crouch: false, vis: 1 };
G.localExposed = () => G.stealth && (!P.frozen || P.climb > 0 || !!G.state.panel); // (standing at a puzzle is no hiding place)
const net = () => G.net && G.net.on;
G.makeNoise = function (x, z, r, kind, remote) {
  if (net() && G.net.replica() && !remote) { if (G.stealth) G.net.send({ t: 'noise', x, z, r, k: kind }); return; }
  if (remote ? !(G.state && (G.state.stealthPhase || G.state.teamPlay)) : !G.stealth) return;
  // team mode lure: rattling the gate makes the guard-room guard walk out to the gate (his smoke-break path)
  if (kind === 'lure') for (const g of guards) if (g.kind === 'office' && g.state === 'sit') { g.state = 'toSmoke'; g.pi = 1; g.smokeTime = 15; g.icon.material = ICON.q; g.icon.visible = true; }
  for (const g of guards) {
    const d = Math.hypot(g.pos.x - x, g.pos.z - z);
    if (d > r || g.state === 'alert' || g.watch.size) continue; // (busy watching someone: it does not turn)
    if (kind === 'step' && g.cool > 0) continue;
    if (kind === 'bark' && g.dog) continue;
    if (kind === 'step' && G.losBlocked(g.pos.x, g.pos.z, x, z) && d > 4) continue;
    g.state = 'investigate'; g.last.set(x + G.rr(-0.8, 0.8), 0, z + G.rr(-0.8, 0.8)); g.timer = 3.5; g.icon.material = ICON.q; g.icon.visible = true;
    if (kind === 'stone') g.sus = Math.max(g.sus, 0.2);
    if (g.dog) G.sfx('bark'); else G.sfx('sus');
  }
};
G.alertNearest = function (x, z, remote) {
  if (net() && G.net.replica() && !remote) { if (performance.now() - G.net.lightT > 1000) { G.net.lightT = performance.now(); G.net.send({ t: 'noise', x, z, r: 0, k: 'light' }); } return; }
  let best = null, bd = 1e9;
  for (const g of guards) { if ((g.kind === 'office' && g.state === 'sit') || g.state === 'sleep' || g.watch.size || g.cool > 0) continue; const d = Math.hypot(g.pos.x - x, g.pos.z - z); if (d < bd) { bd = d; best = g; } }
  if (best && best.state !== 'alert') { best.state = 'investigate'; best.last.set(x, 0, z); best.timer = 4; best.icon.material = ICON.q; best.icon.visible = true; }
};
function replicaStep(g, dt) {
  if (!g.net) return 'stand';
  const ox = g.pos.x, oz = g.pos.z, k = 1 - Math.exp(-10 * dt);
  g.pos.x += (g.net.x - g.pos.x) * k; g.pos.z += (g.net.z - g.pos.z) * k;
  g.yaw += G.angDiff(g.yaw, g.net.yaw) * k;
  g.speed = G.damp(g.speed, Math.hypot(g.pos.x - ox, g.pos.z - oz) / Math.max(dt, 1e-3), 8, dt);
  g.state = g.net.st; g.wp = g.net.w;
  return g.state === 'sit' || g.state === 'sleep' ? 'sit' : g.state === 'smoke' ? 'smoke' : 'stand';
}
G.onBecomeHost = function () {
  for (const g of guards) {
    forgetWatch(g);
    g.sus = 0; g.tid = null; g.wait = 0;
    if (g.route) { let bi = 0, bd = 1e9; g.route.forEach((w, i) => { const d = Math.hypot(w[0] - g.pos.x, w[1] - g.pos.z); if (d < bd) { bd = d; bi = i; } }); g.wi = bi; }
    if (g.kind === 'office') { if (g.state !== 'sit' && g.state !== 'smoke') { g.state = 'toOffice'; g.pi = g.path.length - 1; } if (g.state === 'smoke') g.timer = 10; if (g.state === 'sit') g.timer = 30; }
    else if (g.kind === 'sweep') g.state = 'return';
    else if (g.kind !== 'sleep') g.state = 'patrol';
  }
};
// team mode, host: one guard's counts for this frame. True while it watches somebody (it stands still meanwhile)
function watchStep(g, dt, targets) {
  const was = g.watch.size > 0;
  g.cool = Math.max(0, g.cool - dt);
  g.inView.clear();
  for (const tg of targets) {
    if (!sees(g, tg)) continue;
    g.inView.add(tg.id);
    g.watch.set(tg.id, Math.min(WATCH.secs, (g.watch.get(tg.id) || 0) + dt));
  }
  let top = 0;
  for (const [id, secs] of g.watch) {
    const left = g.inView.has(id) ? secs : secs - dt * WATCH.drain;
    if (left <= 0) { g.watch.delete(id); continue; }
    g.watch.set(id, left); top = Math.max(top, left);
  }
  g.wp = top / WATCH.secs;
  if (!g.watch.size) {
    g.barked = false; g.barkT = 0; g.hold = false;
    if (was) { // lost them: look round where it stands instead of following
      g.cool = WATCH.cool;
      if (g.state === 'investigate') { g.last.copy(g.pos); g.timer = Math.min(g.timer, 1); }
    }
    return false;
  }
  if (g.dog && g.inView.size) {
    g.barkT -= dt;
    if (g.barkT <= 0) { g.barkT = 0.9; G.sfx('bark'); }
    if (!g.barked && top >= WATCH.bark) { g.barked = true; G.makeNoise(g.pos.x, g.pos.z, 24, 'bark'); }
  }
  if (top >= WATCH.notice || g.state === 'investigate') g.hold = true;
  return g.hold;
}
// team mode, host: who has been in view long enough. Returns true when that is the player on this machine
function watchCatches() {
  let mine = null;
  const others = new Map();
  for (const g of guards) for (const [id, secs] of g.watch) {
    if (secs < WATCH.secs - 1e-4 || !g.inView.has(id)) continue;
    if (id === 'me') mine = mine || g; else if (!others.has(id)) others.set(id, g);
    if (g.state === 'sleep') { g.state = 'investigate'; g.last.copy(g.pos); g.timer = 3; } // (that woke him up)
  }
  for (const [id, g] of others) {
    if (!net()) break;
    for (const o of guards) { o.watch.delete(id); o.inView.delete(id); }
    if (G.net.isBot(id)) { if (G.bots) G.bots.caught(G.net.peers.get(id), g.dog ? 'dog' : 'guard'); } // bots live on this (host) machine
    else G.net.send({ t: 'caught', to: id, src: 'guard' });
  }
  if (!mine || !G.stealth || !G.onCaught) return false;
  for (const o of guards) { o.watch.delete('me'); o.inView.delete('me'); }
  G.onCaught(mine.dog ? 'dog' : 'guard');
  return true;
}
G.updateGuards = function (dt, t) {
  const replica = net() && G.net.replica(), team = teamSight();
  const detBy = {}, seenBy = {}, targets = [];
  if (!replica) {
    if (G.localExposed()) { LOCAL.crouch = P.crouch; LOCAL.vis = G.sightVis(); targets.push(LOCAL); }
    if (net() && G.state && (G.state.stealthPhase || G.state.teamPlay)) targets.push(...G.net.targets());
    if (team && G.teamPenned) for (let i = targets.length - 1; i >= 0; i--) if (G.teamPenned(targets[i].pos)) targets.splice(i, 1);
  }
  for (const g of guards) {
    const night = g.mode === 'night';
    let pose = g.state === 'sleep' ? 'sit' : 'stand';
    const fast = g.dog ? 1.6 : 1;
    if (replica) { pose = replicaStep(g, dt); }
    else {
      let s = 0, tg = null, held = false;
      if (team) held = watchStep(g, dt, targets);
      else for (const cand of targets) { const v = sees(g, cand); if (v > s) { s = v; tg = cand; } }
      if (team) { /* counted in watchStep */ }
      else if (s > 0) {
        if (g.state === 'sleep') { g.state = 'suspicious'; G.sfx('sus'); }
        if (g.tid !== tg.id) { g.sus *= 0.5; g.tid = tg.id; }
        g.tgt = tg;
        g.sus = Math.min(1, g.sus + dt * (0.3 + s * 1.1) * (g.dog ? 1.25 : 1));
        g.last.copy(tg.pos); g.seen = 0.6;
        if (g.sus > 0.33 && g.state !== 'alert') g.state = g.sus > 0.72 ? 'alert' : 'suspicious';
        if (g.sus > 0.72) g.state = 'alert';
        if (g.dog && g.sus > 0.3) { g.barkT -= dt; if (g.barkT <= 0) { g.barkT = 0.9; G.sfx('bark'); G.makeNoise(g.pos.x, g.pos.z, 24, 'bark'); } }
      } else {
        g.seen -= dt;
        g.sus = Math.max(0, g.sus - dt * (g.state === 'alert' ? 0.12 : 0.2));
        if ((g.state === 'suspicious' || g.state === 'alert') && g.seen < 0) { g.state = 'investigate'; g.timer = 3.5; }
      }
      if (held) { // watching: it neither turns nor walks, so the zone cannot follow whoever runs out of it
        g.speed = 0;
        pose = g.state === 'sit' || g.state === 'sleep' ? 'sit' : g.state === 'smoke' ? 'smoke' : 'stand';
      } else if (g.state === 'suspicious') { g.yaw += G.angDiff(g.yaw, Math.atan2(g.last.x - g.pos.x, g.last.z - g.pos.z)) * Math.min(1, dt * 4); g.speed = 0; if (g.sus > 0.5) walkTo(g, g.last.x, g.last.z, 1.2 * fast, dt); }
      else if (g.state === 'alert') { walkTo(g, g.last.x, g.last.z, 3.6 * fast, dt); if (g.tgt && targets.includes(g.tgt) && Math.hypot(g.tgt.pos.x - g.pos.x, g.tgt.pos.z - g.pos.z) < 1.1) g.sus = 1; }
      else if (g.state === 'investigate') {
        if (walkTo(g, g.last.x, g.last.z, 2.4 * fast, dt)) { g.timer -= dt; g.yaw += dt * 1.6 * Math.sin(t * 1.3); if (g.timer <= 0) { g.state = g.kind === 'office' ? 'toOffice' : g.kind === 'sweep' ? 'return' : g.kind === 'sleep' ? 'return' : 'patrol'; if (g.kind === 'office') g.pi = g.path.length - 1; } }
      } else if (g.state === 'return') { if (walkTo(g, g.day[0], g.day[1], 1.6, dt)) { g.state = g.kind === 'sleep' ? 'sleep' : 'sweep'; if (g.kind === 'sleep') g.yaw = g.day[2]; } }
      else if (g.state === 'sweep') { g.speed = 0; const ty = g.base + Math.sin(t * 0.4) * g.swing; g.yaw += G.angDiff(g.yaw, ty) * Math.min(1, dt * 3); }
      else if (g.state === 'sleep') { g.speed = 0; pose = 'sit'; }
      else if (g.state === 'sit') {
        pose = 'sit'; g.speed = 0; g.pos.set(g.seat[0], 0, g.seat[1]); g.yaw = g.seat[2] + Math.sin(t * 0.3) * 0.35;
        if (night && !g.noBreak) { g.timer -= dt; if (g.timer <= 0) { g.state = 'toSmoke'; g.pi = 1; } }
      } else if (g.state === 'toSmoke') {
        const w = g.path[g.pi]; if (walkTo(g, w[0], w[1], 1.5, dt)) { g.pi++; if (g.pi >= g.path.length) { g.state = 'smoke'; g.timer = g.smokeTime || 26; } }
      } else if (g.state === 'smoke') {
        pose = 'smoke'; g.speed = 0; g.yaw += G.angDiff(g.yaw, (g.smokeYaw || 0) + Math.sin(t * 0.25) * 0.5) * Math.min(1, dt * 2);
        g.timer -= dt; if (g.timer <= 0) { g.state = 'toOffice'; g.pi = g.path.length - 2; }
      } else if (g.state === 'toOffice') {
        const w = g.path[Math.max(0, g.pi)]; if (walkTo(g, w[0], w[1], 1.5, dt)) { g.pi--; if (g.pi < 0) { g.state = 'sit'; g.timer = g.sitTime || 40; } }
      } else { // patrol
        if (!night || !g.route) {
          g.speed = 0;
          if (g.mode === 'day') { const ty = g.day[2] + Math.sin(t * 0.3 + g.day[0]) * 0.5; g.yaw += G.angDiff(g.yaw, ty) * Math.min(1, dt * 2); }
        } else if (g.wait > 0) { g.wait -= dt; g.speed = 0; g.yaw += dt * 0.5 * Math.sin(t * 0.8 + g.wi); }
        else { const w = g.route[g.wi]; if (walkTo(g, w[0], w[1], 1.55 * (g.dog ? 1.3 : 1), dt)) { g.wait = w[2]; g.wi = (g.wi + 1) % g.route.length; } }
      }
    }
    if (team && g.wp > 0) { g.icon.material = g.wp > 0.6 ? ICON.x : ICON.q; g.icon.visible = true; }
    else if (g.state === 'alert') { g.icon.material = ICON.x; g.icon.visible = true; }
    else if (g.state === 'suspicious' || g.state === 'investigate') { g.icon.material = ICON.q; g.icon.visible = true; }
    else g.icon.visible = false;
    g.phase += g.speed * dt * (G.gaitRate ? G.gaitRate(g.speed, { run: g.speed > 3, h: g.h }) : 2.5);
    const torchOn = !!g.flash && night && G.night > 0.35 && pose === 'stand'; // walking / standing guard at night holds the flashlight out (not in daylight: team rounds patrol by day too)
    if (g.dog) G.animDog(g.h, { amt: g.speed / 2.2, phase: g.phase, t, alert: g.state === 'alert' || (team && g.wp > 0), sniff: g.state === 'investigate' || g.state === 'patrol' });
    else G.animHuman(g.h, { pose, speed: g.speed, amt: g.speed / 3.4, phase: g.phase, run: g.speed > 3, t, torch: torchOn });
    g.h.group.position.copy(g.pos); g.h.group.rotation.y = g.yaw;
    g.h.group.visible = G.camera.position.distanceToSquared(g.pos) < 85 * 85;
    if (g.flash) {
      const fl = torchOn && g.h.group.visible, LP = g.lamp;
      g.flash.visible = fl; g.pool.visible = false;
      if (g.lens) g.lens.material = fl ? LAMP_MAT.on : LAMP_MAT.off;
      if (fl) {
        // walls and roofs stop the light: cut the beam where it hits, and only light the floor spot if nothing is in between
        const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
        const flat = Math.sqrt(1 - LP.dip * LP.dip);
        _bo.set(g.pos.x + fx * LP.fwd, LP.y, g.pos.z + fz * LP.fwd); _bd.set(fx * flat, -LP.dip, fz * flat);
        const L = G.rayDist(_bo, _bd, LP.len), k = Math.max(0.05, L / LP.len);
        g.beam.scale.set(k, k, k); g.beam.position.z = LP.len / 2 * k;
        const px = g.pos.x + fx * LP.spot, pz = g.pos.z + fz * LP.spot;
        g.pool.visible = L > LP.spot + 0.3 && !G.losBlocked(g.pos.x, g.pos.z, px, pz);
        g.pool.position.set(px, 0.07, pz);
        // aim the real light along the flashlight; it reaches only a little past the wall that cuts the beam
        g.flash.updateWorldMatrix(true, false);
        g.em.pos.setFromMatrixPosition(g.flash.matrixWorld);
        _tdir.set(0, 0, 1).transformDirection(g.flash.matrixWorld);
        if (g.dog) g.em.pos.addScaledVector(_tdir, 0.42); // start past the head, or the dog throws its own shadow down the whole beam
        g.em.target.copy(g.em.pos).addScaledVector(_tdir, LP.len);
        g.em.range = Math.min(LP.range, L + 2.5);
      }
      g.pool.material.opacity = (g.em.cur ? 0 : 0.32) * G.night;
    }
    if (g.h.spark) G.sparkTick(g.h, dt, g.pos);
    if (replica) continue;
    if (team) { // what each player's bar shows: their longest count, and whether anybody has them in view right now
      for (const [id, secs] of g.watch) {
        detBy[id] = Math.max(detBy[id] || 0, secs / WATCH.secs);
        if (g.inView.has(id)) seenBy[id] = true;
      }
      continue;
    }
    if (g.tid != null && g.sus > 0) detBy[g.tid] = Math.max(detBy[g.tid] || 0, g.sus);
    if (g.sus >= 1) {
      if (g.tid === 'me') { if (G.stealth && G.onCaught) { G.detBy = detBy; G.onCaught(g.dog ? 'dog' : 'guard'); return 1; } }
      else if (g.tid != null && net()) {
        if (G.net.isBot(g.tid)) { if (G.bots) G.bots.caught(G.net.peers.get(g.tid), g.dog ? 'dog' : 'guard'); } // bots live on this (host) machine
        else G.net.send({ t: 'caught', to: g.tid, src: 'guard' });
        g.sus = 0; g.tid = null; g.tgt = null; g.state = 'investigate'; g.timer = 3;
      }
    }
  }
  beamMat.uniforms.uOpacity.value = 0.26 * G.night;
  G.detBy = detBy; G.seenBy = seenBy;
  const mine = replica ? G.net.myDet : (detBy.me || 0);
  if (!team) { G.mySight = null; return mine; }
  const seen = replica ? G.net.mySeen : !!seenBy.me;
  if (seen && !(G.mySight && G.mySight.v > 0)) G.sfx('sus'); // somebody has just started watching you
  G.mySight = { v: mine, seen, left: Math.max(0, WATCH.secs * (1 - mine)) };
  if (!replica && watchCatches()) { G.mySight = null; return 1; }
  return mine;
};
G.forgetLocal = function () { for (const g of guards) { g.watch.delete('me'); g.inView.delete('me'); } for (const g of guards) if (g.tid === 'me') { g.sus = 0; g.tid = null; g.tgt = null; if (g.state === 'alert' || g.state === 'suspicious') { g.state = 'investigate'; g.timer = 2; } } };

// ---------------- searchlights & CCTV ----------------
// entry: { lamp: Object3D under G.root, cx, cz, rx, rz, fa, fb, r, cam: bool }
const SL = G.searchlights = [];
const beamTex = G.TX.beam, glowTex = G.TX.glow;
G.setupSearchlights = function (list) {
  SL.length = 0;
  list.forEach((e, i) => {
    const red = !!e.cam, col = C(red ? 0xff2a2a : 0xfff4d8);
    const bm = G.beamMaterial(col, 0);
    const pm = new T.MeshBasicMaterial({ map: glowTex, color: col, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    const r = e.r || 4.2;
    const beam = new T.Mesh(new T.CylinderGeometry(r * 0.8, red ? 0.08 : 0.3, 1, 32, 1, true), bm); beam.frustumCulled = false; G.add(beam); G.softLayer(beam);
    const pool = new T.Mesh(new T.PlaneGeometry(r * 2.4, r * 2.4), pm); pool.rotation.x = -Math.PI / 2; G.add(pool);
    // the lamp face glows (HDR, so it blooms)
    const lens = new T.Mesh(new T.CircleGeometry(red ? 0.06 : 0.3, 24), new T.MeshBasicMaterial({ color: new T.Color(red ? 0xff3030 : 0xfff6e0).multiplyScalar(red ? 4 : 12) })); lens.position.z = red ? 0.22 : 0.31; e.lamp.add(lens);
    // and lights the ground, walls and people for real (a pooled spotlight; white ones cast shadows)
    const em = G.addEmitter({ kind: 'search', angle: 0.1, penumbra: 0.32, color: red ? C(0xff3a30) : C(0xfff4e2), intensity: red ? 1.5 : 16, range: 100, decay: 1, prio: red ? 0.5 : 2.2, shadow: !red, on: () => beam.visible });
    SL.push(Object.assign({ beam, pool, lens, bm, pm, r, tgt: new V3(), ph: i * 1.7, red, em }, e));
  });
};
G.searchSus = 0;
const SL_CORE = 0.5, SL_CORE_CLIMB = 0.85, SL_HOLD = 1.5; // searchlight: centre fraction of the radius, seconds before capture
const _up = new V3(0, 1, 0), _q = new T.Quaternion(), _L = new V3(), _dir = new V3(), _E = new V3();
// the roofed building over a ground point, if any (searchlights stop on the roof instead of shining through it)
const roofOver = (x, z) => { for (const b of G.buildings) if (b.h && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return b; return null; };
G.updateSearchlights = function (dt, t) {
  const on = G.night > 0.5 && !G.lightsOut;
  let hit = false;
  for (const s of SL) {
    const active = !s.off && (s.red ? !G.lightsOut : on);
    s.bm.uniforms.uOpacity.value = s.red ? 0.12 : 0.36 * G.night;
    s.pm.opacity = (s.em.cur ? 0.18 : 1) * (s.red ? 0.55 : 0.85 * G.night); // a real light does the pool when one is free
    s.beam.visible = s.pool.visible = s.lens.visible = active;
    s.tgt.set(s.cx + Math.sin(t * s.fa + s.ph) * s.rx, 0, s.cz + Math.sin(t * s.fb + s.ph * 1.3) * s.rz);
    s.lamp.getWorldPosition(_L);
    // aimed at ground under a roof: the beam ends where it meets the roof and the light spot sits on the roof
    const roof = roofOver(s.tgt.x, s.tgt.z), ry = roof ? roof.h + 0.3 : 0;
    s.roofed = !!roof && _L.y > ry;
    if (s.roofed) { const k = (_L.y - ry) / _L.y; _E.set(_L.x + (s.tgt.x - _L.x) * k, ry, _L.z + (s.tgt.z - _L.z) * k); } else _E.copy(s.tgt);
    const onRoof = s.roofed && _E.x > roof.x0 && _E.x < roof.x1 && _E.z > roof.z0 && _E.z < roof.z1;
    s.pool.position.set(_E.x, s.roofed ? ry + 0.05 : 0.08, _E.z);
    if (s.roofed && !onRoof) s.pool.visible = false; // the beam clips the wall: no spot on the ground behind it
    s.lamp.lookAt(_E);
    _dir.subVectors(_E, _L); const len = _dir.length(); _dir.normalize();
    s.beam.scale.set(1, len, 1); s.beam.position.copy(_L).addScaledVector(_dir, len / 2);
    _q.setFromUnitVectors(_up, _dir); s.beam.quaternion.copy(_q);
    s.em.pos.copy(_L); s.em.target.copy(_E); s.em.angle = Math.atan(s.r * 0.95 / Math.max(1, len)); s.em.range = len * 1.7;
    if (active && !s.roofed && G.localExposed() && (!P.indoor || s.red)) {
      // only the bright centre of the pool counts (inner half of the radius; a bit wider up on the scaffold)
      const d = Math.hypot(P.pos.x - s.tgt.x, P.pos.z - s.tgt.z);
      if (d < s.r * (P.climb > 0 ? SL_CORE_CLIMB : SL_CORE)) hit = true;
    }
  }
  // caught only after SL_HOLD seconds in the centre; stepping out drains the meter fast, so a beam just sweeping past
  // you does not add up (the nearest guard is still sent to look once you've been lit for about half that time)
  if (hit) { G.searchSus = Math.min(1, G.searchSus + dt / SL_HOLD); if (G.searchSus > 0.5) G.alertNearest(P.pos.x, P.pos.z); }
  else G.searchSus = Math.max(0, G.searchSus - dt * 1.1);
  if (G.searchSus >= 1 && G.onCaught) { G.searchSus = 0; G.onCaught('light'); }
  return G.searchSus;
};

// ---------------- story NPCs (per level) ----------------
const NPCS = G.npcs = {};
G.addNpc = function (key, look, o) {
  o = o || {};
  const h = G.Humanoid(look);
  const n = Object.assign({ key, h, pos: new V3(o.x || 0, 0, o.z || 0), yaw: o.yaw || 0, pose: o.pose || 'stand', run: null, runSpeed: 4.5, walk: false, phase: 0, path: null, pi: 0, dirn: 1, speed: 1.3, onArrive: null }, o);
  NPCS[key] = n; return n;
};
G.npcGo = function (n, pts, opt) { n.run = pts.slice(); n.walk = !!(opt && opt.walk); n.runSpeed = (opt && opt.speed) || (n.walk ? 1.5 : 4.5); n.hideAfter = !!(opt && opt.hide); n.onArrive = (opt && opt.done) || null; };
G.updateNpcs = function (dt, t) {
  for (const k in NPCS) {
    const n = NPCS[k]; if (!n.h.group.visible) continue;
    if (n.run && n.run.length) {
      const tx = n.run[0][0], tz = n.run[0][1], dx = tx - n.pos.x, dz = tz - n.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.25) { n.run.shift(); if (!n.run.length) { n.run = null; if (n.hideAfter) n.h.group.visible = false; const cb = n.onArrive; n.onArrive = null; if (cb) cb(n); } }
      else { n.yaw += G.angDiff(n.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8); const st = Math.min(d, n.runSpeed * dt); n.pos.x += dx / d * st; n.pos.z += dz / d * st; n.phase += n.runSpeed * dt * (G.gaitRate ? G.gaitRate(n.runSpeed, { run: !n.walk, h: n.h }) : 2.4); }
      G.animHuman(n.h, { pose: 'stand', speed: n.runSpeed, amt: n.runSpeed / 3.4, run: !n.walk, phase: n.phase, t });
    } else if (n.path) {
      const p = n.path[n.pi], dx = p[0] - n.pos.x, dz = p[1] - n.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { n.pi += n.dirn; if (n.pi >= n.path.length || n.pi < 0) { n.dirn *= -1; n.pi += n.dirn * 2; } }
      else { n.yaw += G.angDiff(n.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 5); n.pos.x += Math.sin(n.yaw) * n.speed * dt; n.pos.z += Math.cos(n.yaw) * n.speed * dt; }
      n.phase += n.speed * dt * (G.gaitRate ? G.gaitRate(n.speed, { h: n.h }) : 2.5);
      G.animHuman(n.h, { pose: 'stand', speed: n.speed, amt: n.speed / 3.4, phase: n.phase, t });
    } else G.animHuman(n.h, { pose: n.pose, amt: 0, t });
    n.h.group.position.copy(n.pos); n.h.group.rotation.y = n.yaw;
    if (n.h.spark) G.sparkTick(n.h, dt, n.pos);
  }
};
G.clearActors = function () {
  guards.length = 0; SL.length = 0; for (const k in NPCS) delete NPCS[k];
  for (const s of stones) if (s.m.parent) s.m.parent.remove(s.m); stones.length = 0;
  G.slowZones = []; G.lightsOut = false; G.searchSus = 0; P.chain = null; P.load = 0;
};
})(window.G);
