// levels/sihanouk.js — Map 1: compound "S-7" inside Sihanoukville. Towers with barred windows, an unfinished
// tower wrapped in scaffolding, casino neon, city street beyond the east wall. Interiors live in sihanouk_props.js.
(function (G) {
'use strict';
const T = G.T, C = G.C, MAT = G.MAT;
const V2 = (x, z) => ({ x, z });
const std = (hex, o) => G.std(Object.assign({ color: C(hex), roughness: 0.8 }, o || {}));
const mesh = (geo, mat, x, y, z, ry) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };
const neonTex = (lines, fg, glow, w, h) => G.makeTex(w || 1024, h || 200, (g, W, H) => {
  g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.floor(H / (lines.length + 0.4)); g.font = `700 ${fs}px Oswald, "Microsoft YaHei", "Noto Sans SC", sans-serif`;
  lines.forEach((ln, i) => { const y = H / 2 + (i - (lines.length - 1) / 2) * fs * 1.05; g.shadowColor = glow; g.shadowBlur = 24; g.fillStyle = fg; g.fillText(ln, W / 2, y); g.shadowBlur = 0; g.fillText(ln, W / 2, y); });
}, { repeat: false });
const neon = (lines, fg, glow, w, h, x, y, z, ry, pw, ph) => {
  const m = new T.Mesh(new T.PlaneGeometry(pw, ph), new T.MeshBasicMaterial({ map: neonTex(lines, fg, glow, w, h), transparent: true, fog: false, side: T.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry || 0; G.add(m); return m;
};
// tall tower: facade box from y0 to y1 (no interior)
function tower(x0, z0, x1, z1, y0, y1, mat, cap) {
  const w = x1 - x0, d = z1 - z0;
  mesh(G.boxGeo(w, y1 - y0, d, 12), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  G.addCollider(x0, z0, x1, z1, y0, y1, { solid: false, los: false });
  if (cap) mesh(G.boxGeo(w + 1, 1.2, d + 1, 4), MAT.concreteDark, (x0 + x1) / 2, y1 + 0.6, (z0 + z1) / 2);
}
G.SK = { tower, neon, mesh, std };

G.LEVELS.sihanouk = { build() {
  const L = G.LOC;
  // ---------------- ground: wet concrete yard inside, asphalt + sidewalks outside ----------------
  // (the rain makes these wet and glossy on its own now: gfx.js darkens and polishes open ground while it rains)
  G.slab(-300, -300, 300, 300, std(0xffffff, { map: G.TX.asphalt, roughness: 0.95 }), 0.001, 8); // (y 0 meant 0.02 in G.slab, which hid the compound ground under it)
  G.slab(-70, -55, 70, 55, std(0xa8a294, { map: G.TX.concrete, roughness: 1 }), 0.01, 6);
  G.slab(5, -12, 13, 55, MAT.concreteDark, 0.025); G.slab(-60, -13.6, 62, -5, MAT.concreteDark, 0.02);
  G.slab(13, 14, 30, 20.5, MAT.concreteDark, 0.022); G.slab(-36, 12, 5, 18, MAT.concreteDark, 0.022);
  G.slab(80, -300, 100, 300, std(0xffffff, { map: G.TX.asphalt, roughness: 0.85 }), 0.02, 6);   // street
  G.slab(70.5, -300, 80, 300, MAT.concrete, 0.04); G.slab(100, -300, 106, 300, MAT.concrete, 0.04);  // sidewalks
  for (let z = -120; z < 120; z += 8) G.slab(89.8, z, 90.2, z + 4, std(0xd8d0b0), 0.03);
  // puddles reflecting the neon
  const pm = G.std({ color: C(0x2a2e34), roughness: 0.04, metalness: 0.5, transparent: true, opacity: 0.6, depthWrite: false });
  [[18, 8, 3, 2], [-14, 22, 4, 2.4], [40, 36, 3.5, 2], [-30, -8, 2.5, 1.6], [55, -20, 3, 2.2], [-55, 34, 3, 2], [85, 6, 3, 1.4], [92, -8, 2.5, 1.5]].forEach(([x, z, w, d]) => {
    const m = new T.Mesh(new T.CircleGeometry(1, 20), pm); m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.set(x, 0.045, z); G.add(m);
  });

  // ---------------- compound walls 6m + barbed wire ----------------
  const WH = 6, WT = 0.8, coilM = [], postM = [];
  const wire = (x0, z0, x1, z1, y) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (let s = 0.2; s < len; s += 0.42) { const f = s / len; coilM.push(G.M4(G.lerp(x0, x1, f), y + 0.42, G.lerp(z0, z1, f), ax ? Math.PI / 2 : 0, G.rr(-0.25, 0.25), G.rr(-0.2, 0.2))); }
    for (let s = 0; s <= len; s += 3) { const f = s / len; postM.push(G.M4(G.lerp(x0, x1, f), y + 0.4, G.lerp(z0, z1, f), ax ? 0 : Math.PI / 2, 0, 0.35)); postM.push(G.M4(G.lerp(x0, x1, f), y + 0.4, G.lerp(z0, z1, f), ax ? 0 : Math.PI / 2, 0, -0.35)); }
  };
  const wallSeg = (x0, z0, x1, z1) => { G.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.max(Math.abs(x1 - x0), WT), d: Math.max(Math.abs(z1 - z0), WT), h: WH, mat: MAT.concrete }); wire(x0, z0, x1, z1, WH); };
  wallSeg(-70.4, -55, 70.4, -55); wallSeg(-70.4, 55, 4, 55); wallSeg(14, 55, 70.4, 55); wallSeg(-70, -55, -70, 55);
  wallSeg(70, -55, 70, -6.2); wallSeg(70, 6.2, 70, 55);
  const slogan = std(0xffffff, { map: G.signTex(['CẤM RA KHỎI KHU VỰC', '禁止外出 · NO EXIT'], { bg: '#7d1014', w: 512, h: 160 }) });
  [[30, 54.5, Math.PI], [-30, -54.5, 0], [-69.5, 20, Math.PI / 2], [69.5, 30, -Math.PI / 2]].forEach(([x, z, ry]) => mesh(new T.PlaneGeometry(6, 1.9), slogan, x, 2.8, z, ry));
  G.box({ x: 9, z: 55, w: 10.4, h: 5, d: 0.25, mat: MAT.metal, S: 3 });
  G.box({ x: 3.6, z: 55, w: 0.6, h: 6.4, d: 0.8, mat: MAT.concreteDark }); G.box({ x: 14.4, z: 55, w: 0.6, h: 6.4, d: 0.8, mat: MAT.concreteDark });
  wire(4, 55, 14, 55, 5);
  // welcome signs: big Khmer, small Vietnamese translation underneath
  G.box({ x: 9, z: 55, y: 6.3, w: 11.4, d: 0.5, h: 0.3, mat: MAT.darkSteel, collide: false });
  const gateSign = G.std({ map: G.signKhmer('សូមស្វាគមន៍មកកាន់ S-7', 'Chào mừng đến với S-7', { bg: '#1b1b1b', fg: '#e8c25a', sub: '#f2e6c8', border: '#d7b45a' }), emissive: C(0x2a2010), emissiveIntensity: 0.5 });
  mesh(new T.PlaneGeometry(11, 2.75), gateSign, 9, 7.95, 54.7, Math.PI); mesh(new T.PlaneGeometry(11, 2.75), gateSign, 9, 7.95, 55.3, 0);
  const welcome = G.std({ map: G.signKhmer('សូមស្វាគមន៍បុគ្គលិកថ្មី', 'Chào mừng nhân viên mới', { bg: '#b8141b', fg: '#ffe066', sub: '#ffffff', border: '#ffe066' }), emissive: C(0x3a0a0a), emissiveIntensity: 0.45 });
  mesh(new T.PlaneGeometry(10, 2.5), welcome, 12, 3.4, -13.8);
  mesh(new T.PlaneGeometry(6, 1.5), welcome, 33, 3.0, 30.18);
  // east chain-link section (the escape point): 3 panels, the middle one can be cut
  const fencePanel = (z0, z1) => { const m = mesh(G.planeGeo(z1 - z0, 4.6, 1.6), MAT.fence, 70, 2.3, (z0 + z1) / 2, Math.PI / 2); return { mesh: m, col: G.addCollider(69.85, z0, 70.15, z1, 0, 4.6, { cam: false, los: false }) }; };
  fencePanel(-6.2, -1.2); G.fencePanel = fencePanel(-1.2, 1.2); fencePanel(1.2, 6.2);
  [-6.2, -1.2, 1.2, 6.2].forEach((z) => G.box({ x: 70, z, w: 0.14, h: 4.8, d: 0.14, mat: MAT.steel }));
  wire(70, -6.2, 70, 6.2, 4.6);
  mesh(new T.PlaneGeometry(1.4, 0.9), std(0xffffff, { map: G.signTex(['NGUY HIỂM', '⚡ ĐIỆN'], { bg: '#e0b020', fg: '#111', w: 256, h: 160 }) }), 69.8, 1.6, 3.6, -Math.PI / 2);
  // escape alley + street bounds (invisible)
  G.addCollider(70.4, -15, 101, -14, 0, 3, { cam: false, los: false }); G.addCollider(70.4, 14, 101, 15, 0, 3, { cam: false, los: false }); G.addCollider(100, -15, 101, 15, 0, 3, { cam: false, los: false });

  // ---------------- buildings (playable ground floors) ----------------
  const building = (o) => {
    const t = 0.3, { x0, z0, x1, z1, h } = o, dh = o.doorH || 2.6;
    const sides = { n: [z0, x0 - t / 2, x1 + t / 2], s: [z1, x0 - t / 2, x1 + t / 2], w: [x0, z0, z1], e: [x1, z0, z1] };
    for (const side of ['n', 's', 'w', 'e']) {
      const [line, a0, a1] = sides[side], ds = (o.doors || []).filter((d) => d.side === side).sort((p, q) => p.a - q.a);
      let cur = a0; const segs = []; for (const d of ds) { segs.push([cur, d.a]); cur = d.b; } segs.push([cur, a1]);
      const along = side === 'n' || side === 's';
      for (const [a, b] of segs) { if (b - a < 0.05) continue; if (along) G.box({ x: (a + b) / 2, z: line, w: b - a, d: t, h, mat: o.wall }); else G.box({ x: line, z: (a + b) / 2, w: t, d: b - a, h, mat: o.wall }); }
      for (const d of ds) { const lh = h - dh; if (lh <= 0.01) continue; if (along) G.box({ x: (d.a + d.b) / 2, z: line, y: dh, w: d.b - d.a, d: t, h: lh, mat: o.wall, flags: { solid: false, los: false } }); else G.box({ x: line, z: (d.a + d.b) / 2, y: dh, w: t, d: d.b - d.a, h: lh, mat: o.wall, flags: { solid: false, los: false } }); }
    }
    if (o.floor) G.slab(x0, z0, x1, z1, o.floor, 0.03, o.floorS || 4);
    if (o.roof !== false) G.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: h, w: x1 - x0 + 1, d: z1 - z0 + 1, h: 0.25, mat: o.roofMat || MAT.concreteDark, S: 3, flags: { solid: false, los: false } });
    const b = { name: o.name, x0, z0, x1, z1, h, label: o.label, lit: !!o.lit }; G.buildings.push(b); return b;
  };
  G.HALL = building({ name: 'hall', label: 'Xưởng', x0: -35, z0: -48, x1: 25, z1: -14, h: 8, wall: MAT.plaster, floor: MAT.epoxy, lit: true, doors: [{ side: 's', a: -8, b: -3 }, { side: 'e', a: -31, b: -28 }], doorH: 3.2 });
  G.DORM = building({ name: 'dorm', label: 'Ký túc', x0: 30, z0: 8, x1: 58, z1: 30, h: 4.2, wall: MAT.plaster, floor: MAT.tile, floorS: 2.4, doors: [{ side: 'w', a: 16, b: 19 }] });
  G.CANTEEN = { name: 'canteen', label: 'Nhà ăn', x0: -60, z0: 6, x1: -36, z1: 26, h: 3.6, open: true }; G.buildings.push(G.CANTEEN);
  G.slab(-60, 6, -36, 26, MAT.concrete, 0.04);
  for (let x = -60; x <= -36; x += 6) for (const z of [6, 26]) G.box({ x, z, w: 0.3, d: 0.3, h: 3.6, mat: MAT.steel });
  G.box({ x: -48, z: 16, y: 3.6, w: 25, d: 21, h: 0.15, mat: MAT.rust, S: 3, flags: { solid: false, los: false } });
  G.OFFICE = building({ name: 'office', label: 'Bảo vệ', x0: -10, z0: 40, x1: -1, z1: 49, h: 3.4, wall: MAT.concrete, floor: MAT.tile, floorS: 2.4, lit: true, doors: [{ side: 'e', a: 43, b: 45.5 }] });
  G.KHO = building({ name: 'kho', label: 'Kho', x0: -64, z0: -42, x1: -50, z1: -30, h: 4.5, wall: MAT.metal, floor: MAT.concreteDark, roofMat: MAT.rust, doors: [{ side: 'e', a: -37.5, b: -34.5 }], doorH: 3 });
  G.PTOI = building({ name: 'ptoi', label: 'Phòng tối', x0: 30, z0: -42, x1: 38, z1: -34, h: 3.2, wall: MAT.concreteDark, floor: MAT.tile, floorS: 2.4, lit: true, doors: [{ side: 'w', a: -38.7, b: -37.3 }], doorH: 2.2 });
  G.doors.kho = G.rollDoor(-50, -36, 3, 3, 'z');
  G.doors.ptoi = G.swingDoor(30, -38, 1.4, 2.2, 'z');

  // ---------------- towers above the podiums ----------------
  tower(-32, -46, 8, -24, 8.25, 74, MAT.barred, true);       // Tower A: offices + "work floors"
  tower(32, 10, 56, 28, 4.35, 44, MAT.barred, true);         // Tower B: dorm floors
  G.nightFx.push((n) => G.windowGlow(n));
  neon(['S-7 GRAND CASINO'], '#ffd36b', '#ff9a1a', 1024, 160, -12, 79, -23.6, 0, 34, 5.3);
  neon(['娱乐城'], '#ff3b3b', '#ff0000', 512, 200, -12, 84.5, -23.6, 0, 12, 4.6);
  neon(['S-7 GRAND CASINO'], '#ffd36b', '#ff9a1a', 1024, 160, 8.6, 79, -35, Math.PI / 2, 22, 3.4);
  const led = mesh(new T.PlaneGeometry(14, 8), new T.MeshBasicMaterial({ color: C(0x2a6cff), fog: false }), 8.1, 40, -35, Math.PI / 2); led.castShadow = false;
  G.tickers.push((dt, t) => { led.material.color.setHSL((t * 0.05) % 1, 0.8, 0.35 + Math.sin(t * 2) * 0.05); });
  // Tower C: unfinished concrete frame + scaffolding + green safety nets (the signal climb)
  const CX0 = 40, CX1 = 62, CZ0 = -52, CZ1 = -38, FL = 3.6;
  for (let x = CX0; x <= CX1; x += 5.5) for (let z = CZ0; z <= CZ1; z += 7) G.box({ x, z, w: 0.6, d: 0.6, h: FL * 10, mat: MAT.concrete, S: 2 });
  for (let f = 1; f <= 10; f++) G.box({ x: (CX0 + CX1) / 2, z: (CZ0 + CZ1) / 2, y: f * FL - 0.3, w: CX1 - CX0 + 0.8, d: CZ1 - CZ0 + 0.8, h: 0.3, mat: MAT.concreteDark, S: 3, flags: { solid: false, los: false } });
  for (let f = 0; f <= 10; f++) for (let x = CX0 - 1; x <= CX1 + 1; x += 2) mesh(new T.BoxGeometry(0.05, FL, 0.05), MAT.steel, x, f * FL + FL / 2, CZ1 + 1.2).castShadow = false;
  for (let f = 0; f <= 10; f++) mesh(new T.BoxGeometry(CX1 - CX0 + 2, 0.05, 0.05), MAT.steel, (CX0 + CX1) / 2, f * FL, CZ1 + 1.2).castShadow = false;
  for (let f = 2; f < 10; f++) for (let x = CX0; x < CX1; x += 4.4) if (G.rand() < 0.75) { const n = mesh(G.planeGeo(4.3, FL, 3), MAT.net, x + 2.2, f * FL + FL / 2, CZ1 + 1.35); n.castShadow = false; }
  for (let f = 3; f < 10; f++) { const n = mesh(G.planeGeo(CZ1 - CZ0, FL, 3), MAT.net, CX0 - 1.1, f * FL + FL / 2, (CZ0 + CZ1) / 2, Math.PI / 2); n.castShadow = false; }
  const crane = new T.Group(); crane.position.set(CX1 - 3, 0, CZ0 + 2); G.add(crane);
  const cm = std(0xc8a020, { metalness: 0.4 }); const mast = new T.Mesh(new T.BoxGeometry(1.2, 52, 1.2), cm); mast.position.y = 26; crane.add(mast);
  const jib = new T.Mesh(new T.BoxGeometry(34, 1, 1), cm); jib.position.set(-10, 52, 0); crane.add(jib);
  const blink = new T.Mesh(new T.SphereGeometry(0.3, 8, 6), new T.MeshBasicMaterial({ color: 0xff2020, fog: false })); blink.position.set(-26, 53, 0); crane.add(blink);
  G.tickers.push((dt, t) => { blink.visible = (t % 1.4) < 0.4; });
  // ladder to the scaffold
  const lad = []; for (const dx of [-0.25, 0.25]) lad.push([new T.BoxGeometry(0.05, FL * 6, 0.05), G.M4(51 + dx, FL * 3, CZ1 + 1.6)]);
  for (let y = 0.4; y < FL * 6; y += 0.4) lad.push([new T.BoxGeometry(0.5, 0.04, 0.04), G.M4(51, y, CZ1 + 1.6)]);
  mesh(G.merge(lad), MAT.steel, 0, 0, 0);
  L.ladder = V2(51, CZ1 + 2.3); L.towerTop = { x: 51, y: FL * 6, z: CZ1 + 1.9 };
  G.SCAFF = { x0: CX0, z0: CZ0, x1: CX1, z1: CZ1, label: 'Tháp đang xây' };

  // ---------------- watch towers + rooftop light + CCTV ----------------
  const lights = [];
  const watchTower = (x, z) => {
    for (const sx of [-1.4, 1.4]) for (const sz of [-1.4, 1.4]) G.box({ x: x + sx, z: z + sz, w: 0.22, d: 0.22, h: 8, mat: MAT.wood, flags: { los: false } });
    G.box({ x, z, y: 8, w: 3.8, d: 3.8, h: 0.2, mat: MAT.wood, collide: false });
    for (const [dx, dz, w, d] of [[0, -1.85, 3.8, 0.1], [0, 1.85, 3.8, 0.1], [-1.85, 0, 0.1, 3.8], [1.85, 0, 0.1, 3.8]]) G.box({ x: x + dx, z: z + dz, y: 8.2, w, d, h: 1.0, mat: MAT.wood, collide: false });
    G.box({ x, z, y: 10.4, w: 4.4, d: 4.4, h: 0.18, mat: MAT.rust, S: 3, collide: false });
    for (const sx of [-1.8, 1.8]) for (const sz of [-1.8, 1.8]) G.box({ x: x + sx, z: z + sz, y: 8.2, w: 0.12, d: 0.12, h: 2.2, mat: MAT.wood, collide: false });
    const lamp = new T.Group(); lamp.position.set(x - Math.sign(x) * 1.4, 9.3, z - Math.sign(z) * 1.4); G.add(lamp);
    const housing = new T.Mesh(new T.CylinderGeometry(0.32, 0.4, 0.6, 12), MAT.darkSteel); housing.rotation.x = Math.PI / 2; lamp.add(housing);
    return lamp;
  };
  lights.push({ lamp: watchTower(-66, -51), cx: -44, cz: -24, rx: 18, rz: 13, fa: 0.21, fb: 0.29 });
  lights.push({ lamp: watchTower(66, -51), cx: 48, cz: -22, rx: 14, rz: 13, fa: 0.19, fb: 0.26 });
  lights.push({ lamp: watchTower(-66, 51), cx: -40, cz: 32, rx: 17, rz: 12, fa: 0.23, fb: 0.17 });
  lights.push({ lamp: watchTower(66, 51), cx: 48, cz: 26, rx: 15, rz: 17, fa: 0.17, fb: 0.24 });
  const roofLamp = new T.Group(); roofLamp.position.set(-12, 75.5, -24.5); G.add(roofLamp);
  const rh = new T.Mesh(new T.CylinderGeometry(0.7, 0.9, 1.2, 14), MAT.darkSteel); rh.rotation.x = Math.PI / 2; roofLamp.add(rh);
  lights.push({ lamp: roofLamp, cx: -5, cz: 12, rx: 32, rz: 22, fa: 0.11, fb: 0.15, r: 5.5 });
  const cctv = (x, y, z, cx, cz, rx, rz, f) => { const g = new T.Group(); g.position.set(x, y, z); G.add(g); const b = new T.Mesh(new T.BoxGeometry(0.2, 0.18, 0.42), std(0xd8d8d0)); g.add(b); lights.push({ lamp: g, cx, cz, rx, rz, fa: f, fb: f * 1.3, r: 2.6, cam: true }); };
  cctv(24.6, 6.5, -13.6, 18, -8, 6, 3, 0.35);
  cctv(29.6, 3.6, 8.2, 25, 14, 3, 5, 0.3);
  cctv(3.2, 5.2, 54.2, 6, 47, 5, 3, 0.4);
  cctv(69.4, 5.6, -14, 64, -2, 3, 9, 0.28);

  // ---------------- floodlights ----------------
  const headMat = std(0x333333, { emissive: C(0xffc070), emissiveIntensity: 0 });
  const poolMat = new T.MeshBasicMaterial({ map: G.TX.glow, color: C(0xffa64d), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false });
  // floodlights follow the yard power (team mode: someone holding the breaker cuts them along with the searchlights)
  // each floodlight is a real (pooled) spotlight shining down when one is free near the camera; the old glow decal
  // on the ground only fills in when it isn't
  const floods = [];
  G.nightFx.push((n) => { const k = G.lightsOut ? 0 : n; headMat.emissiveIntensity = k * 8; for (const f of floods) f.m.opacity = k * 0.55 * (f.em.cur ? 0.12 : 1); });
  const flood = (x, z, r, real) => {
    mesh(new T.CylinderGeometry(0.1, 0.14, 7, 12), MAT.steel, x, 3.5, z); G.addCollider(x - 0.18, z - 0.18, x + 0.18, z + 0.18, 0, 7, { los: false });
    mesh(new T.BoxGeometry(0.9, 0.25, 0.5), headMat, x, 7, z);
    const pm = poolMat.clone();
    const p = new T.Mesh(new T.PlaneGeometry(r * 2.4, r * 2.4), pm); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.06, z); G.add(p);
    G.lit.push({ x, z, r });
    const em = G.addEmitter({ kind: 'flood', pos: new T.Vector3(x, 6.85, z), target: new T.Vector3(x + 0.02, 0, z + 0.4), angle: 1.05, penumbra: 0.75, color: C(0xffb35c), intensity: 6, range: r * 3.4, decay: 1.25, prio: 1.2, shadow: true, on: () => !G.lightsOut && G.night > 0.5 });
    floods.push({ m: pm, em });
    if (real) { const Lt = new T.PointLight(C(0xffb35c), 0, r * 3.2, 1.4); Lt.position.set(x, 6.4, z); G.add(Lt); G.nightFx.push((n) => { Lt.intensity = (G.lightsOut || em.cur ? 0 : n) * 1.6; }); }
  };
  flood(2, 49, 7.5, true); flood(26, 15, 6.5, false); flood(-20, -2, 7, false); flood(62, -15, 6, false); flood(-43.5, -25, 6, false);

  // yard breaker box on the dorm's north wall (team mode: hold it to kill the searchlights while a teammate cuts the fence)
  G.box({ x: 44, z: 7.62, y: 0.8, w: 0.9, d: 0.4, h: 1.2, mat: MAT.metal, collide: false });
  mesh(new T.PlaneGeometry(0.8, 0.46), std(0xffffff, { map: G.signTex(['⚡ CẦU DAO', 'ĐÈN PHA'], { bg: '#e0b020', fg: '#111', w: 256, h: 150 }) }), 44, 1.62, 7.41, Math.PI);
  const lever = mesh(new T.BoxGeometry(0.08, 0.36, 0.08), std(0xc3161c), 44.25, 1.2, 7.36); lever.rotation.x = 0.5;
  L.breaker = V2(44, 6.85);
  // tie post in the open yard: caught teammates are tied here until someone frees them
  mesh(new T.CylinderGeometry(0.12, 0.14, 2.6, 8), MAT.steel, -14, 1.3, 28); G.addCollider(-14.15, 27.85, -13.85, 28.15, 0, 2.6, { los: false });
  for (let i = 0; i < 3; i++) { const ring = mesh(new T.TorusGeometry(0.2, 0.025, 4, 10), MAT.chain || MAT.steel, -14, 0.9 + i * 0.12, 28); ring.rotation.x = Math.PI / 2; }
  L.post = V2(-14, 28);

  // ---------------- the city outside ----------------
  const ext = [];
  const block = (x, z, w, d, h, mat) => { tower(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, mat || MAT.facade, true); ext.push(1); };
  for (let i = 0; i < 6; i++) block(112 + G.rr(-2, 6), -90 + i * 34, G.rr(14, 22), G.rr(14, 20), G.rr(30, 80));   // far side of the street
  block(122, -24, 26, 20, 92); neon(['OCEAN PEARL HOTEL'], '#cfe8ff', '#4aa0ff', 1024, 140, 108.9, 86, -24, -Math.PI / 2, 22, 3);
  mesh(new T.CylinderGeometry(6, 9, 6, 6), MAT.facade, 122, 95, -24);
  for (let i = 0; i < 9; i++) { const z = -60 + i * 14; mesh(G.boxGeo(6, G.rr(9, 13), 12, 6), std([0xb8a68a, 0xa0a8b0, 0xc0b090, 0x9a8a7a][i % 4], { map: G.TX.plaster }), 103.5, 5.5, z); G.addCollider(100.5, z - 6, 106.5, z + 6, 0, 12, { solid: false, los: false }); }
  neon(['LUCKY STAR CASINO', '幸运星娱乐城'], '#ffe27a', '#ff6a00', 1024, 260, 100.4, 10, 30, -Math.PI / 2, 12, 3);
  neon(['KARAOKE · MASSAGE'], '#ff63c8', '#ff00a0', 1024, 140, 100.4, 8, -20, -Math.PI / 2, 9, 1.3);
  neon(['ĐỔI TIỀN · 换钱'], '#7affb0', '#00ff60', 768, 140, 100.4, 7, 4, -Math.PI / 2, 6, 1.1);
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = G.rr(150, 240); block(Math.cos(a) * r, Math.sin(a) * r, G.rr(16, 28), G.rr(16, 28), G.rr(25, 90), G.rand() < 0.5 ? MAT.facade : MAT.barred); }
  for (const [x, z, h] of [[-90, -20, 40], [-95, 30, 55], [-30, -95, 48], [30, -100, 36], [-20, 100, 44], [40, 105, 60]]) block(x, z, 20, 18, h, MAT.barred);
  // street lamps + parked tuk-tuks
  const lampHead = new T.MeshBasicMaterial({ color: C(0xffd9a0), fog: false }), lampBase = C(0xffd9a0);
  G.nightFx.push((n) => { lampHead.color.copy(lampBase).multiplyScalar(1 + n * 7); });
  for (let z = -60; z <= 60; z += 20) {
    mesh(new T.CylinderGeometry(0.08, 0.1, 8, 10), MAT.steel, 79, 4, z); mesh(new T.BoxGeometry(1.5, 0.08, 0.1), MAT.steel, 79.7, 8, z); const hd = mesh(new T.BoxGeometry(0.5, 0.15, 0.3), lampHead, 80.4, 7.95, z); hd.castShadow = false; G.lit.push({ x: 81, z, r: 5 });
    G.addEmitter({ kind: 'lamp', pos: new T.Vector3(80.4, 7.8, z), target: new T.Vector3(81.6, 0, z), angle: 0.95, penumbra: 0.8, color: C(0xffcf8a), intensity: 5, range: 16, decay: 1.35, prio: 0.9, on: () => G.night > 0.5 });
  }
  G.tuktuk = (x, z, ry, col) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.add(g);
    g.add(G.tuktukModel({ color: col || 0xc0392b }));

    return g;
  };
  G.tuktuk(84, -30, 0.1, 0x2a6a9a); G.tuktuk(84.5, 34, Math.PI + 0.05, 0xc0392b); G.tuktuk(96, -10, Math.PI, 0xd4a017);
  L.tuk = V2(88.5, 3.5); G.tukMain = G.tuktuk(88.5, 2.2, 0.05, 0x1f7a4a);
  G.addCollider(87.6, 0.2, 89.4, 4.4, 0, 2, { los: false });
  // black SUV used in the betrayal scene (hidden until then)
  const suv = new T.Group(); suv.visible = false; G.add(suv); G.betraySuv = suv;
  { suv.add(G.suvModel({ color: 0x0d0e10, lights: true, plate: 'PHNOM PENH  2AB-0913' }));
    // the glow its headlights throw on the road ahead (a point light well in front, so it doesn't light the car
    // itself) and the two headlight cones as a pooled spotlight that follows the car
    const beam = new T.PointLight(C(0xfff4e0), 0, 30, 1.2); beam.position.set(0, 1.0, 8); suv.add(beam); G.betrayBeam = beam;
    const hl = G.addEmitter({ kind: 'car', pos: new T.Vector3(), target: new T.Vector3(), angle: 0.42, penumbra: 0.55, color: C(0xfff1d6), intensity: 9, range: 45, decay: 1.2, prio: 4, shadow: true, on: () => suv.visible && beam.intensity > 0 });
    const _a = new T.Vector3(0, 0.85, 2.45), _b = new T.Vector3(0, 0, 16);
    G.tickers.push(() => { if (!suv.visible) return; suv.updateMatrixWorld(); hl.pos.copy(_a).applyMatrix4(suv.matrixWorld); hl.target.copy(_b).applyMatrix4(suv.matrixWorld); }); }

  // barbed wire instancing
  const coil = new T.InstancedMesh(new T.TorusGeometry(0.3, 0.016, 4, 12), std(0x8d9396, { metalness: 0.8, roughness: 0.35 }), coilM.length); coilM.forEach((m, i) => coil.setMatrixAt(i, m)); G.add(coil);
  const posts = new T.InstancedMesh(new T.BoxGeometry(0.05, 0.9, 0.05), MAT.steel, postM.length); postM.forEach((m, i) => posts.setMatrixAt(i, m)); G.add(posts);

  Object.assign(L, {
    hallDoor: V2(-5.5, -11.5), dormDoor: V2(27.5, 17.5), dormSpawn: V2(33.2, 25.2),
    desk17: V2(-0.4, -27.0), seat17: V2(-0.4, -28.25), boss: V2(-5, -44.2),
    baySeat: V2(-48, 11.85), bayTalk: V2(-48, 13.4), bed3: V2(39.4, 11.9),
    card: V2(-5.2, 45.2), khoDoor: V2(-48.8, -36), cutter: V2(-61.4, -36),
    ptoiDoor: V2(28.9, -38), hung: V2(33.2, -38), fence: V2(68.9, 0), outside: V2(74, 0),
  });
  G.buildSihanoukProps();

  const OFFICE_PATH = [[-7, 45.2], [-6.8, 43.4], [-2.5, 43.6], [1, 44.2], [9, 47.6]];
  return {
    bounds: { x0: -76, x1: 102, z0: -60, z1: 60 }, compound: { x0: -70, z0: -55, x1: 70, z1: 55 },
    extra: [G.SCAFF], fence: { x: 70, z0: -6, z1: 6 }, gate: { x0: 4.3, x1: 13.7, z: 55 }, street: { x0: 80, x1: 100 },
    lights,
    guards: [
      { id: 'dorm', day: [25.5, 21.5, 3.5], kind: 'sweep', base: 3.5, swing: 1.2 },
      { id: 'yard', day: [12, 6, 2.6], route: [[-25, 22, 2], [18, 22, 1], [18, 4, 2], [-25, 4, 1]] },
      { id: 'hallE', day: [-10, -11.4, 0], route: [[27, -46, 2], [27, -9, 1], [44, -9, 2], [44, -46, 1]] },
      { id: 'kho', day: [-46, -28, -1.6], route: [[-46, -46, 3], [-46, -20, 1], [-67, -20, 2], [-67, -46, 1]] },
      { id: 'east', day: [63, -10, -1.57], route: [[63, -32, 3], [63, -14, 1], [63, 14, 1], [63, 40, 3]] },
      { id: 'hallIn', day: [-5, -20, Math.PI], route: [[-5, -44, 3], [-5, -17, 3]] },
      { id: 'office', day: [-7, 45.2, Math.PI / 2], kind: 'office', seat: [-7, 45.2, Math.PI / 2], path: OFFICE_PATH, smokeYaw: 0.15 },
      { id: 'gate', day: [8, 50, Math.PI], route: [[9, 51, 4], [9, 34, 1], [-16, 34, 2], [9, 34, 1], [30, 40, 2], [9, 34, 0]] },
      { id: 'dog1', dog: true, day: [60, 20, 0], route: [[58, -30, 2], [58, 0, 1], [64, 30, 2], [58, 0, 0]] },
      { id: 'dog2', dog: true, color: 0x4a3a28, day: [-55, -10, 0], route: [[-45, -12, 1], [-66, -8, 2], [-66, 30, 1], [-30, 30, 2], [-30, 0, 1]] },
    ],
    overcast: 0.85, rain: 0, fogMul: 1,
  };
} };
})(window.G);
