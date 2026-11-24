// levels/jungle.js — Map 2: a trafficking camp deep in the jungle. Cages, a stilt-less work hut, the boss's house,
// bamboo watchtowers, a fire pit, torches, and a swamp leading to a stream.
(function (G) {
'use strict';
const T = G.T, C = G.C, MAT = G.MAT, M4 = G.M4;
const B = (w, h, d) => new T.BoxGeometry(w, h, d);
const V2 = (x, z) => ({ x, z });
const std = (hex, o) => G.std(Object.assign({ color: C(hex), roughness: 0.85 }, o || {}));
const mesh = (geo, mat, x, y, z, ry) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };

// cell with an opening door on its +z side (hinged at the -x corner). Inside stays walkable.
G.cell = function (x, z, w, d, h, mat) {
  mat = mat || MAT.rust; const parts = [], n = (len) => Math.max(2, Math.round(len / 0.17));
  for (let i = 0; i <= n(w); i++) parts.push([B(0.03, h, 0.03), M4(x - w / 2 + i * w / n(w), h / 2, z - d / 2)]);
  for (let i = 0; i <= n(d); i++) { const pz = z - d / 2 + i * d / n(d); parts.push([B(0.03, h, 0.03), M4(x - w / 2, h / 2, pz)]); parts.push([B(0.03, h, 0.03), M4(x + w / 2, h / 2, pz)]); }
  for (const y of [0.05, h]) { parts.push([B(w, 0.05, 0.05), M4(x, y, z - d / 2)]); parts.push([B(0.05, 0.05, d), M4(x - w / 2, y, z)]); parts.push([B(0.05, 0.05, d), M4(x + w / 2, y, z)]); }
  parts.push([B(w, 0.03, d), M4(x, h, z)]);
  mesh(G.merge(parts), mat, 0, 0, 0);
  G.addCollider(x - w / 2, z - d / 2 - 0.05, x + w / 2, z - d / 2 + 0.05, 0, h, { los: false });
  G.addCollider(x - w / 2 - 0.05, z - d / 2, x - w / 2 + 0.05, z + d / 2, 0, h, { los: false });
  G.addCollider(x + w / 2 - 0.05, z - d / 2, x + w / 2 + 0.05, z + d / 2, 0, h, { los: false });
  const pivot = new T.Group(); pivot.position.set(x - w / 2, 0, z + d / 2); G.add(pivot);
  const dp = []; for (let i = 0; i <= n(w); i++) dp.push([B(0.03, h, 0.03), M4(i * w / n(w), h / 2, 0)]);
  dp.push([B(w, 0.05, 0.05), M4(w / 2, 0.05, 0)]); dp.push([B(w, 0.05, 0.05), M4(w / 2, h, 0)]); dp.push([B(0.12, 0.18, 0.08), M4(w - 0.1, h * 0.55, 0.05)]);
  const dm = new T.Mesh(G.merge(dp), mat); dm.castShadow = true; pivot.add(dm);
  const col = G.addCollider(x - w / 2, z + d / 2 - 0.05, x + w / 2, z + d / 2 + 0.05, 0, h, { los: false });
  const door = { mesh: pivot, col, open: false, k: 0 };
  G.tickers.push((dt) => { if (door.open && door.k < 1) { door.k = Math.min(1, door.k + dt * 1.2); pivot.rotation.y = door.k * 1.7; } });
  return { door, x, z, w, d };
};
G.fire = function (x, z, s, y) { // flickering fire + light (y: raised, for torches on poles)
  y = y || 0;
  let flame = null;
  if (G.fireFx) G.fireFx(x, y, z, s * 0.95);
  else { flame = new T.Mesh(new T.ConeGeometry(0.35 * s, 0.9 * s, 8), new T.MeshBasicMaterial({ color: C(0xff8a2a), transparent: true, opacity: 0.85, blending: T.AdditiveBlending, fog: false })); flame.position.set(x, y + 0.45 * s, z); G.add(flame); }
  const L = new T.PointLight(C(0xff9a40), 1.4, 12 * s, 1.5); L.position.set(x, y + 1.2 * s, z); G.add(L);
  G.tickers.push((dt, t) => { const f = 0.8 + Math.sin(t * 13 + x) * 0.12 + Math.sin(t * 29 + z) * 0.08 + Math.sin(t * 47 + x * 3) * 0.05; L.intensity = 1.6 * f; if (flame) flame.scale.set(1, f * 1.1, 1); });
  G.lit.push({ x, z, r: 5 * s });
};

G.LEVELS.jungle = { build() {
  const L = G.LOC;
  G.slab(-300, -300, 300, 300, MAT.grass, 0.001, 8); // (y 0 meant 0.02 in G.slab, which hid the compound ground under it)
  G.slab(-58, -48, 58, 48, MAT.mud, 0.01, 6);
  // dense jungle wall all around + palisade of bamboo stakes
  const trunkM = [], crownM = [], bushM = [], stakeM = [], trees = [], bushes = [];
  for (let i = 0; i < 2200; i++) {
    const x = G.rr(-200, 200), z = G.rr(-200, 200);
    if (x > -62 && x < 62 && z > -52 && z < 52) continue;
    if (x > 58 && x < 90 && z > -40 && z < -20) continue;   // the stream clearing
    const s = G.rr(0.8, 1.7), h = G.rr(6, 13) * s;
    trunkM.push(M4(x, h / 2, z, 0, 0, 0, s, h / 6, s)); crownM.push(M4(x, h + 1, z, G.rand() * 3, 0, 0, G.rr(2.5, 4.2) * s, G.rr(2, 3.4) * s, G.rr(2.5, 4.2) * s));
    trees.push([x, z, s, h]);
    if (G.rand() < 0.6) { const bx = x + G.rr(-3, 3), bz = z + G.rr(-3, 3); bushM.push(M4(bx, 0.6, bz, G.rand() * 3, 0, 0, G.rr(1, 2.4), G.rr(0.8, 1.6), G.rr(1, 2.4))); bushes.push([bx, bz, 1 + (i % 7) * 0.12]); }
  }
  const ring = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); for (let s = 0; s < len; s += 0.32) { const f = s / len; stakeM.push(M4(G.lerp(x0, x1, f), 1.6, G.lerp(z0, z1, f), 0, G.rr(-0.06, 0.06), G.rr(-0.06, 0.06), 1, G.rr(0.9, 1.15), 1)); } };
  ring(-56, -46, 56, -46); ring(-56, 46, 56, 46); ring(-56, -46, -56, 46); ring(56, -46, 56, -36); ring(56, -22, 56, 46);
  G.addCollider(-56.3, -46.3, 56.3, -45.7, 0, 3.2); G.addCollider(-56.3, 45.7, 56.3, 46.3, 0, 3.2); G.addCollider(-56.3, -46, -55.7, 46, 0, 3.2);
  G.addCollider(55.7, -46, 56.3, -36, 0, 3.2); G.addCollider(55.7, -22, 56.3, 46, 0, 3.2);
  if (G.forest) {
    // real trees (buttress roots, branches, leaf canopies), ferns, grass round the camp and along the palisade
    G.forest(trees, bushes, { nearR: 105 });
    let gs = 9157; const gr = () => { gs = (gs * 16807) % 2147483647; return gs / 2147483647; };
    G.grassField(5200, () => { const a = gr() * Math.PI * 2, r = 60 + gr() * 42; const x = Math.cos(a) * r * 1.15, z = Math.sin(a) * r; return (x > 58 && x < 90 && z > -40 && z < -20) ? null : [x, z, 0.7 + gr() * 0.9]; });
    G.grassField(900, () => { const side = Math.floor(gr() * 4), t = gr(), d = 0.6 + gr() * 4.5; const p = side === 0 ? [-55 + t * 110, -45 + d] : side === 1 ? [-55 + t * 110, 45 - d] : side === 2 ? [-55 + d, -45 + t * 90] : [55 - d, -45 + t * 90]; return [p[0], p[1], 0.5 + gr() * 0.6]; });
  } else {
    G.inst(G.uvScale(new T.CylinderGeometry(0.22, 0.3, 6, 8), 1, 3), MAT.trunk, trunkM);
    G.inst(new T.IcosahedronGeometry(1, 0), std(0x22381a, { flatShading: true }), crownM, { cast: true });
    G.inst(new T.IcosahedronGeometry(1, 0), std(0x2e4a20, { flatShading: true }), bushM);
  }
  G.inst(new T.CylinderGeometry(0.07, 0.09, 3.2, 6), MAT.bamboo, stakeM, { cast: true });
  // beyond the gap in the palisade: swampy stream
  G.slab(56, -36, 120, -22, MAT.mud, 0.02);
  const stream = G.slab(70, -60, 82, 40, MAT.water, 0.06, 10);
  G.addCollider(56.3, -36.3, 100, -36, 0, 3, { cam: false, los: false }); G.addCollider(56.3, -22, 100, -21.7, 0, 3, { cam: false, los: false });

  // ---------------- swamp (south-east, slows you down) ----------------
  const swampMat = G.std({ color: C(0x1f2a1e), roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });
  for (const [x, z, w, d] of [[38, -30, 30, 18], [50, -40, 12, 10], [26, -38, 10, 8]]) { G.slab(x - w / 2, z - d / 2, x + w / 2, z + d / 2, swampMat, 0.04 + G.rand() * 0.01, 8); G.slowZones.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, k: 0.55 }); }
  for (let i = 0; i < 14; i++) { const x = G.rr(25, 55), z = G.rr(-44, -20); const t = mesh(new T.CylinderGeometry(0.08, 0.2, G.rr(3, 6), 5), MAT.trunk, x, 1.5, z); t.rotation.z = G.rr(-0.3, 0.3); }
  const fogTex = G.TX.glow, fogMat = new T.MeshBasicMaterial({ map: fogTex, color: C(0x9aa69a), transparent: true, opacity: 0.18, depthWrite: false });
  for (let i = 0; i < 18; i++) { const f = new T.Mesh(new T.PlaneGeometry(12, 12), fogMat); f.rotation.x = -Math.PI / 2; f.position.set(G.rr(20, 60), 0.6 + G.rand() * 0.6, G.rr(-46, -16)); G.add(f); }

  // ---------------- cages (north row) ----------------
  L.cages = [];
  for (let i = 0; i < 5; i++) L.cages.push(G.cell(-40 + i * 6, -36, 2.6, 2.4, 1.9));
  L.namCage = L.cages[2];
  L.wire = V2(L.namCage.x + 0.9, L.namCage.z - 0.8); L.cageLock = V2(L.namCage.x + 0.8, L.namCage.z + 0.75);
  G.box({ x: -28, z: -36, y: 2.2, w: 34, d: 4, h: 0.12, mat: MAT.rust, S: 3, flags: { solid: false, los: false } });
  for (const x of [-44, -12]) for (const z of [-38, -34]) mesh(new T.CylinderGeometry(0.1, 0.1, 2.3, 6), MAT.wood, x, 1.15, z);

  // ---------------- work hut (open-sided, thatched) ----------------
  const thatch = std(0x7a6a3a, { map: G.TX.bamboo });
  G.box({ x: 0, z: -4, y: 3.2, w: 24, d: 14, h: 0.3, mat: thatch, S: 3, flags: { solid: false, los: false } });
  for (let x = -12; x <= 12; x += 6) for (const z of [-11, 3]) G.box({ x, z, w: 0.25, d: 0.25, h: 3.2, mat: MAT.wood });
  G.slab(-12, -11, 12, 3, MAT.planks, 0.05, 3);
  for (const z of [-7, -1]) { G.box({ x: 0, z, y: 0.72, w: 18, d: 0.9, h: 0.06, mat: MAT.planks, collide: false, S: 2 }); G.addCollider(-9, z - 0.45, 9, z + 0.45, 0, 0.78, { los: false }); for (let i = 0; i < 7; i++) { const x = -7.5 + i * 2.5; mesh(B(0.34, 0.02, 0.24), MAT.plastic, x, 0.76, z - 0.1); const s = mesh(B(0.34, 0.22, 0.015), G.std({ color: 0x000000, emissive: C(0x8fb8ff), emissiveIntensity: 0.8 }), x, 0.88, z - 0.22); s.rotation.x = -0.25; } }
  G.buildings.push({ name: 'hut', label: 'Lán làm việc', x0: -12, z0: -11, x1: 12, z1: 3, h: 3.2, lit: true });
  const hutL = new T.PointLight(C(0xffe0a0), 0.9, 18, 1.4); hutL.position.set(0, 2.8, -4); G.add(hutL);
  L.workSeat = { x: -0.0, z: -6.25, yaw: Math.PI }; L.workSpot = V2(0, -5.4);
  // generator
  G.box({ x: -15, z: 6, w: 2, d: 1.4, h: 1.3, mat: std(0x5f6b3a, { metalness: 0.4 }) });

  // ---------------- boss house (wood, door on the south side) ----------------
  const HX0 = 22, HX1 = 36, HZ0 = 14, HZ1 = 26;
  const wall = (x, z, w, d) => G.box({ x, z, w, d, h: 3, mat: MAT.planks, S: 3 });
  wall((HX0 + HX1) / 2, HZ1, HX1 - HX0, 0.2); wall(HX0, (HZ0 + HZ1) / 2, 0.2, HZ1 - HZ0); wall(HX1, (HZ0 + HZ1) / 2, 0.2, HZ1 - HZ0);
  wall((HX0 + 27.5) / 2, HZ0, 27.5 - HX0, 0.2); wall((29.5 + HX1) / 2, HZ0, HX1 - 29.5, 0.2);
  G.box({ x: 28.5, z: HZ0, y: 2.2, w: 2, d: 0.2, h: 0.8, mat: MAT.planks, flags: { solid: false } });
  G.box({ x: 29, z: 20, y: 3, w: 15, d: 13, h: 0.25, mat: MAT.rust, S: 3, flags: { solid: false, los: false } });
  G.slab(HX0, HZ0, HX1, HZ1, MAT.planks, 0.04, 3);
  G.buildings.push({ name: 'boss', label: 'Nhà trùm', x0: HX0, z0: HZ0, x1: HX1, z1: HZ1, h: 3, lit: true });
  G.box({ x: 32, z: 23, w: 2.2, d: 1.1, h: 0.78, mat: MAT.wood });
  const sat = new T.Group(); sat.position.set(31.6, 0.8, 23.1); G.add(sat);
  sat.add(new T.Mesh(B(0.1, 0.04, 0.24), std(0x2a2a2a))); const ant = new T.Mesh(B(0.025, 0.2, 0.025), std(0x111111)); ant.position.set(0.03, 0.1, -0.08); sat.add(ant); G.satMesh = sat;
  G.box({ x: 25, z: 24, w: 1.0, d: 2.0, h: 0.5, mat: std(0x5a4a3a) });
  for (let i = 0; i < 4; i++) { const r = mesh(B(0.06, 1.0, 0.08), std(0x1a1a1a), 35.6, 1.2, 16 + i * 0.4); r.rotation.z = 0.15; }
  const lamp = new T.PointLight(C(0xffb060), 0.8, 10, 1.6); lamp.position.set(30, 2.6, 21); G.add(lamp);
  G.box({ x: 31.3, z: 12.6, w: 0.5, d: 0.5, h: 0.45, mat: MAT.wood });
  L.houseDoor = V2(28.5, 13.2); L.satphone = V2(31.0, 21.8);

  // ---------------- fire pit, torches, antenna clearing ----------------
  G.fire(0, 18, 1.2); mesh(new T.TorusGeometry(0.9, 0.18, 6, 14), std(0x4a4440), 0, 0.15, 18).rotation.x = Math.PI / 2;
  for (const [x, z] of [[-8, 18], [8, 18]]) mesh(B(2, 0.4, 0.4), MAT.wood, x, 0.2, z);
  for (const [x, z] of [[-30, -28], [-18, -28], [-15, 10], [18, 10], [40, 6], [-40, 10], [10, 34]]) { mesh(new T.CylinderGeometry(0.05, 0.06, 2.2, 10), MAT.wood, x, 1.1, z); mesh(new T.CylinderGeometry(0.09, 0.06, 0.22, 10), MAT.rust, x, 2.25, z); G.fire(x, z, 0.45, 2.3); }
  const mast = mesh(new T.CylinderGeometry(0.08, 0.14, 18, 6), MAT.steel, 40, 9, 36); for (let i = 0; i < 3; i++) { const a = i * 2.1; const g = mesh(new T.CylinderGeometry(0.01, 0.01, 19, 3), MAT.black, 40 + Math.cos(a) * 3, 9, 36 + Math.sin(a) * 3); g.rotation.set(Math.sin(a) * 0.17, 0, -Math.cos(a) * 0.17); g.castShadow = false; }
  const red = mesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshBasicMaterial({ color: 0xff2020, fog: false }), 40, 18.2, 36); G.tickers.push((dt, t) => { red.visible = (t % 1.6) < 0.5; });
  L.antenna = V2(38.5, 33.5);

  // ---------------- bamboo watchtowers ----------------
  const lights = [];
  const btower = (x, z) => {
    for (const sx of [-1.2, 1.2]) for (const sz of [-1.2, 1.2]) G.box({ x: x + sx, z: z + sz, w: 0.18, d: 0.18, h: 7, mat: MAT.bamboo, flags: { los: false } });
    G.box({ x, z, y: 7, w: 3.2, d: 3.2, h: 0.2, mat: MAT.planks, collide: false }); G.box({ x, z, y: 9, w: 3.8, d: 3.8, h: 0.25, mat: thatch, collide: false });
    const lamp = new T.Group(); lamp.position.set(x, 8.2, z); G.add(lamp); const hs = new T.Mesh(new T.CylinderGeometry(0.28, 0.36, 0.55, 10), MAT.darkSteel); hs.rotation.x = Math.PI / 2; lamp.add(hs);
    return lamp;
  };
  lights.push({ lamp: btower(-48, 34), cx: -26, cz: 18, rx: 18, rz: 14, fa: 0.2, fb: 0.27 });
  lights.push({ lamp: btower(48, 4), cx: 34, cz: 10, rx: 14, rz: 22, fa: 0.17, fb: 0.23 });
  lights.push({ lamp: btower(-48, -40), cx: -26, cz: -28, rx: 16, rz: 6, fa: 0.25, fb: 0.31 });

  // ---------------- other prisoners ----------------
  L.cages.forEach((c, i) => { if (i === 2) return; G.addNpc('pr' + i, { shirt: [0x6a5a4a, 0x4a5a6a, 0, 0x7a4a4a, 0x5a6a4a][i], pants: 0x2a2a2a, skin: [0xc79a74, 0xb5835e, 0, 0xa8754f, 0xd6a985][i], bruises: true, longHair: i === 3 }, { x: c.x - 0.3, z: c.z - 0.3, yaw: 0.2, pose: 'floor' }); });
  L.swampExit = V2(62, -29);
  return {
    bounds: { x0: -62, x1: 86, z0: -52, z1: 52 }, compound: { x0: -56, z0: -46, x1: 56, z1: 46 }, extra: [{ x0: 20, z0: -39, x1: 56, z1: -21, label: 'Đầm lầy' }],
    lights,
    guards: [
      { id: 'cage', day: [-28, -30, Math.PI], route: [[-44, -30, 3], [-12, -30, 3]] },
      { id: 'fire1', day: [-3, 15.5, 0.4], kind: 'sweep', base: 0.4, swing: 1.4 },
      { id: 'porch', day: [31.3, 12.6, Math.PI], kind: 'office', seat: [31.3, 12.6, Math.PI], path: [[31.3, 12.6], [33, 10], [44, 4], [47, -2]], smokeYaw: 2.6, smokeTime: 24, sitTime: 34, firstSit: 30, look: { rifle: true, shirt: 0x3a3a2a, cap: 0x2a2a1a } },
      { id: 'pat1', day: [-20, 0, 0], route: [[-30, 2, 2], [-20, 30, 1], [15, 30, 2], [16, 6, 1]], look: { rifle: true, shirt: 0x3a3a2a } },
      { id: 'swamp', day: [30, -16, Math.PI], route: [[18, -16, 3], [52, -16, 3]], look: { rifle: true, shirt: 0x2a3a2a } },
      { id: 'dogH', dog: true, day: [24, 10, 0], route: [[20, 9, 3], [38, 9, 3]] },
      { id: 'dogP', dog: true, color: 0x6a5a40, day: [-40, 20, 0], route: [[-50, 0, 2], [-50, 40, 1], [-20, 40, 2], [-30, -20, 1]] },
    ],
    overcast: 1, rain: 0.75, lightning: true, fogMul: 0.65,
  };
} };
})(window.G);
