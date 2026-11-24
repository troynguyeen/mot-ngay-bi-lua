// levels/myanmar.js — the long team map: "Khu Sương Đen", a made-up scam compound on the Myanmar side of the Thai
// border (no real compound, company or armed group is copied), and the forest between it and the Moei river.
//   myanmar  160 × 120 m. North (−z): detention block · the office block (Tòa A) · power house. Middle: dormitories,
//            yard, antenna. South: punishment cells · clinic · villa. The storm drain leaves through the south wall.
//   border   the forest: trail, a creek, the checkpoint fence, the bamboo grove, the river, the Thai bank.
// Every spot a mission uses is in G.LOC; what opens or appears is switched by the mission state (js/myanmar.js).
(function (G) {
'use strict';
const T = G.T, C = G.C, MAT = G.MAT, M4 = G.M4;
const B = (w, h, d) => new T.BoxGeometry(w, h, d);
const P2 = (x, z) => ({ x, z });
const std = (hex, o) => G.std(Object.assign({ color: C(hex), roughness: 0.85 }, o || {}));
const mesh = (geo, mat, x, y, z, ry) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };
const OVER = { solid: false, los: false };            // roofs: only the camera and the light beams stop on them
const LOW = { los: false };                           // low furniture, bars: you cannot walk through, guards see through
const UNSEEN = { los: false, cam: false };            // water, map edges
const OWN_LOOK = (o) => Object.assign({ rifle: true, shirt: 0x2f3a33, pants: 0x1c1f1c, cap: 0x232823 }, o || {});

// a straight wall along one axis with gaps for doors and windows: gaps are [from, to] on that axis
function wall(axis, at, a, b, gaps, h, mat, thick) {
  const cuts = (gaps || []).slice().sort((p, q) => p[0] - q[0]), t = thick || 0.3;
  let from = a;
  const piece = (p, q) => {
    if (q - p < 0.05) return;
    if (axis === 'x') G.box({ x: (p + q) / 2, z: at, w: q - p, d: t, h, mat, S: 3 });
    else G.box({ x: at, z: (p + q) / 2, w: t, d: q - p, h, mat, S: 3 });
  };
  for (const [p, q] of cuts) { piece(from, p); from = q; }
  piece(from, b);
}
function roof(x0, z0, x1, z1, y, mat) {
  G.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y, w: x1 - x0 + 0.5, d: z1 - z0 + 0.5, h: 0.2, mat, S: 4, flags: OVER });
}
// a flood light on a pole
function flood(x, z, r, floods, head) {
  mesh(new T.CylinderGeometry(0.1, 0.14, 7, 10), MAT.steel, x, 3.5, z); G.addCollider(x - 0.16, z - 0.16, x + 0.16, z + 0.16, 0, 7, LOW);
  mesh(B(0.9, 0.25, 0.5), head, x, 7, z);
  G.lit.push({ x, z, r });
  const em = G.addEmitter({ kind: 'flood', pos: new T.Vector3(x, 6.85, z), target: new T.Vector3(x + 0.02, 0, z + 0.4), angle: 1.05, penumbra: 0.75, color: C(0xffc070), intensity: 5.5, range: r * 3.4, decay: 1.25, prio: 1.2, shadow: true, on: () => !G.lightsOut && G.night > 0.35 });
  const Lt = new T.PointLight(C(0xffc070), 0, r * 3, 1.4); Lt.position.set(x, 6.4, z); G.add(Lt);
  floods.push({ em, Lt });
}
function roomLight(x, y, z, hex, k, r) {
  const K = k * 1.8, l = new T.PointLight(C(hex), K, r * 1.25, 1.4); l.position.set(x, y, z); G.add(l);
  const tube = mesh(B(1.1, 0.06, 0.14), G.std({ color: C(0xffffff), emissive: C(hex), emissiveIntensity: 2.2 }), x, y + 0.2, z); tube.castShadow = false;
  G.tickers.push(() => { l.intensity = G.lightsOut ? 0.22 : K; tube.material.emissiveIntensity = G.lightsOut ? 0.15 : 2.2; });
}
// barbed coils along a wall top
function coils(segs, y) {
  const list = [];
  for (const [x0, z0, x1, z1] of segs) {
    const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 1.1), ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) list.push(M4(x0 + (x1 - x0) * i / n, y, z0 + (z1 - z0) * i / n, ry + 0.35 * (i % 2 ? 1 : -1)));
  }
  G.inst(new T.TorusGeometry(0.28, 0.014, 3, 9), MAT.chain, list);
}
// a notice: the local language on top, Vietnamese below
function notice(top, viet, x, y, z, ry, w) {
  const m = mesh(new T.PlaneGeometry(w || 2.6, (w || 2.6) / 4), std(0xffffff, { map: G.signKhmer(top, viet, { bg: '#5c1014', w: 512, h: 128 }) }), x, y, z, ry);
  m.castShadow = false; return m;
}

// ==================================== the compound ====================================
G.LEVELS.myanmar = { build() {
  const L = G.LOC;
  G.slab(-340, -340, 340, 340, MAT.grass, 0.001, 9);
  G.slab(-80, -60, 80, 60, std(0x8d8478, { map: G.TX.dirt, roughness: 1 }), 0.012, 7);
  const tar = std(0x4a4b4c, { map: G.TX.concrete, roughness: 0.92 });
  G.slab(-42, -22.5, 80, -18.5, tar, 0.018, 6); G.slab(25.4, -60, 31.5, 26, tar, 0.019, 6);

  // ---------------- perimeter ----------------
  const pm = std(0x8a887f, { map: G.TX.concrete, roughness: 0.95 });
  wall('x', -60, -80, 80, [[30, 38]], 5, pm, 0.5);
  wall('x', 60, -80, 80, [[22.6, 25.4]], 5, pm, 0.5);
  wall('z', -80, -60, 60, null, 5, pm, 0.5);
  wall('z', 80, -60, 60, null, 5, pm, 0.5);
  G.box({ x: 34, z: -60, w: 8, d: 0.2, h: 4.2, mat: MAT.metal, S: 3 }); // the main gate, never opens
  coils([[-80, -60, 80, -60], [-80, 60, 80, 60], [-80, -60, -80, 60], [80, -60, 80, 60]], 5.15);
  const gateSign = mesh(new T.PlaneGeometry(8, 1.6), std(0xffffff, { map: G.signTex(['KHU SƯƠNG ĐEN'], { bg: '#101214', fg: '#d8342c', w: 640, h: 128 }) }), 34, 5.2, -59.6);
  gateSign.castShadow = false;
  notice('ဝင်ခွင့်မရှိ', 'CẤM VÀO', 30.5, 2.6, -59.72, 0);

  // ---------------- A: detention block (the team wakes up here) ----------------
  const dm = std(0x9b958a, { map: G.TX.plaster }), H = 3.6;
  wall('x', -54, -74, -44, null, H, dm); wall('x', -30, -74, -44, null, H, dm);
  wall('z', -74, -54, -30, null, H, dm); wall('z', -44, -54, -30, [[-42.5, -39.5]], H, dm);
  wall('x', -45, -62, -44, [[-59.6, -57.4], [-53.4, -51.2], [-47.6, -45.5]], H, dm);          // front of the empty cells
  for (const x of [-62, -55.5, -49]) wall('z', x, -54, -45, null, H, dm);
  wall('x', -38, -74, -44, [[-70.6, -68.4], [-63.2, -61], [-56.4, -54.2], [-49.4, -47]], H, dm); // south side of the corridor
  for (const x of [-66, -58, -52]) wall('z', x, -38, -30, null, H, dm);
  roof(-74, -54, -44, -30, H, MAT.concreteDark);
  G.slab(-74, -54, -44, -30, MAT.concreteDark, 0.03);
  G.buildings.push({ name: 'det', label: 'Khu giam', x0: -74, z0: -54, x1: -44, z1: -30, h: H, lit: true });
  // the team's cell: bars along the corridor, two bent aside by mission 2
  const bars = [];
  for (let x = -73.8; x < -62.1; x += 0.22) if (Math.abs(x + 67) > 1.1) bars.push(M4(x, 1.5, -45));
  G.inst(new T.CylinderGeometry(0.035, 0.035, 3, 6), MAT.darkSteel, bars);
  for (const y of [0.08, 1.5, 2.95]) for (const [x0, x1] of [[-74, -68.1], [-65.9, -62]]) mesh(B(x1 - x0, 0.07, 0.07), MAT.darkSteel, (x0 + x1) / 2, y, -45);
  G.addCollider(-74, -45.08, -68.1, -44.92, 0, 3, LOW); G.addCollider(-65.9, -45.08, -62, -44.92, 0, 3, LOW);
  const bg = new T.Group(); bg.position.set(-67, 0, -45); G.add(bg);
  for (let x = -0.99; x < 1.05; x += 0.22) { const b = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 3, 6), MAT.darkSteel); b.position.set(x, 1.5, 0); b.castShadow = true; bg.add(b); }
  L.bars = { group: bg, col: G.addCollider(-68.1, -45.08, -65.9, -44.92, 0, 3, LOW) };
  L.cell = { x0: -74, z0: -54, x1: -62, z1: -45 };
  for (const [x, z] of [[-72.4, -51.5], [-64, -51.5]]) G.box({ x, z, w: 1.5, d: 2.2, h: 0.28, mat: std(0x5a5648), S: 2, flags: LOW });
  L.detDoor = G.swingDoor(-44, -41, 3, 2.9, 'z', MAT.darkSteel);
  mesh(B(0.1, 0.36, 0.28), MAT.black, -44.3, 1.4, -39.1);
  mesh(B(0.03, 0.07, 0.12), new T.MeshBasicMaterial({ color: 0xff3020 }), -44.36, 1.5, -39.1);
  notice('သတိ', 'CHÚ Ý: CÓ LÍNH GÁC', -60, 3.0, -38.17, Math.PI, 2.2);
  // the guard's room
  G.box({ x: -46.4, z: -35.4, w: 1.9, d: 0.8, h: 0.78, mat: MAT.wood, S: 1, flags: LOW });
  mesh(B(0.16, 0.03, 0.1), std(0xd0b040, { metalness: 0.6 }), -46.7, 0.81, -35.2);
  G.box({ x: -48.4, z: -31.9, w: 0.55, d: 0.5, h: 0.45, mat: MAT.plastic, collide: false });
  mesh(new T.CylinderGeometry(0.07, 0.07, 3.4, 8), MAT.rust, -73.6, 1.7, -42.6); // the water pipe
  roomLight(-67, 3.2, -49.5, 0xcfe0c8, 0.55, 12); roomLight(-58, 3.2, -41.5, 0xffd8a0, 0.7, 14); roomLight(-48, 3.2, -34, 0xffd8a0, 0.5, 9);
  L.start = P2(-68.5, -48.6); L.nhan = P2(-64.2, -49.6);
  L.barsSpot = P2(-67, -45.9);
  L.deskKey = P2(-47.4, -34.6); L.pipe = P2(-72.7, -42.6);
  L.scratches = [P2(-58.6, -52.8), P2(-52.2, -52.8), P2(-46.6, -52.8), P2(-70.5, -31.2), P2(-62, -31.2), P2(-55, -31.2)];
  L.keypad = P2(-45.4, -40.2);

  // ---------------- B: Tòa A, the fraud office ----------------
  const om = std(0xc9c4b8, { map: G.TX.plaster }), OH = 4.2;
  wall('x', -54, -22, 24, null, OH, om); wall('x', -26, -22, 24, [[-9.3, -6.7]], OH, om);
  wall('z', -22, -54, -26, null, OH, om); wall('z', 24, -54, -26, [[-36.2, -33.8]], OH, om);
  wall('z', 6, -54, -26, [[-49.2, -46.6], [-33.4, -30.8]], OH, om);
  wall('x', -41, 6, 24, null, OH, om);
  roof(-22, -54, 24, -26, OH, MAT.concreteDark);
  G.slab(-22, -54, 24, -26, MAT.tile, 0.03);
  G.box({ x: 1, z: -40, y: OH + 0.2, w: 46, d: 28, h: 13.2, mat: MAT.barred, S: 12, collide: false });
  G.buildings.push({ name: 'toaA', label: 'Tòa A', x0: -22, z0: -54, x1: 24, z1: -26, h: OH, lit: true });
  const banner = mesh(new T.PlaneGeometry(19, 3.2), std(0xffffff, { map: G.signTex(['CHỈ TIÊU HÔM NAY: 8.000$', 'KHÔNG ĐẠT = KHÔNG ĂN'], { bg: '#7d1014', fg: '#ffe066', w: 768, h: 140 }) }), 8, 8.4, -25.65);
  banner.castShadow = false;
  L.towerDoor = G.swingDoor(-8, -26, 2.6, 2.9, 'x', MAT.darkSteel);
  L.towerSide = G.rollDoor(24, -35, 2.4, 2.9, 'z');
  // rows of desks with screens; the partitions are high enough to hide behind when crouched or standing close
  const desk = G.std({ color: C(0xb8ab92), roughness: 0.7 }), part = std(0x3d4a50), scr = [];
  for (const z of [-50.4, -46, -37.2]) for (const x of [-15.4, -5.4]) {
    G.box({ x, z, w: 6.4, d: 0.8, h: 0.75, mat: desk, S: 2, flags: LOW });
    G.box({ x, z: z - 0.48, w: 6.4, d: 0.1, h: 1.5, mat: part, S: 2 });
    for (let k = -2; k <= 2; k++) scr.push(M4(x + k * 1.2, 1.02, z - 0.28));
  }
  G.inst(B(0.6, 0.38, 0.04), MAT.screen, scr);
  // manager's room, server room
  G.box({ x: 14, z: -48.2, w: 2.2, d: 0.9, h: 0.78, mat: MAT.wood, S: 1, flags: LOW });
  mesh(B(0.8, 0.5, 0.05), MAT.screen, 14, 1.06, -48.4);
  for (const x of [10.5, 12.5, 17.5, 19.5]) G.box({ x, z: -36.2, w: 0.9, d: 1.6, h: 2.1, mat: MAT.black, S: 1 });
  G.box({ x: 14.6, z: -28.3, w: 2.4, d: 0.8, h: 0.78, mat: MAT.darkSteel, S: 1, flags: LOW });
  for (const x of [13.9, 15.2]) mesh(B(0.9, 0.5, 0.05), MAT.screen, x, 1.08, -28.1, Math.PI);
  mesh(B(0.7, 0.9, 0.2), MAT.rust, 22.6, 1.4, -26.3);                                        // the breaker
  G.box({ x: -14, z: -30.4, w: 2.4, d: 0.8, h: 0.75, mat: desk, S: 1, flags: LOW });
  mesh(B(0.7, 0.45, 0.05), MAT.screen, -14, 1.02, -30.2, Math.PI);
  L.drawers = [P2(-20.5, -52.4), P2(0.5, -52.4), P2(4.4, -42.6), P2(22.2, -52.4), P2(8.3, -52.4), P2(22.2, -39.4)];
  for (const [x, z, w, d] of [[-20.5, -53.4, 1.2, 0.8], [0.5, -53.4, 1.2, 0.8], [5.4, -42.6, 0.8, 1.2], [22.2, -53.4, 1.2, 0.8], [8.3, -53.4, 1.2, 0.8], [23.2, -39.4, 0.8, 1.2]]) G.box({ x, z, w, d, h: 1.2, mat: MAT.metal, S: 1, flags: LOW });
  roomLight(-12, 3.8, -44, 0xe8f4ff, 0.8, 20); roomLight(0, 3.8, -32, 0xe8f4ff, 0.6, 16); roomLight(15, 3.8, -48, 0xffe0b0, 0.6, 13); roomLight(15, 3.8, -32, 0x9fd0ff, 0.6, 13);
  L.entry = P2(-7.5, -24.9); L.entryHelp = P2(-9.9, -25);
  L.console = P2(14.6, -29.4); L.pc = P2(14, -47); L.breaker = P2(22.4, -27.2); L.warnPc = P2(-14, -31.5);

  // ---------------- C: dormitories, the alley, the canteen ----------------
  for (const [z0, z1] of [[-20, -8], [0, 12]]) {
    G.box({ x: -64, z: (z0 + z1) / 2, w: 20, d: z1 - z0, h: 7, mat: MAT.barred, S: 12 });
    G.box({ x: -52.4, z: (z0 + z1) / 2, y: 2.9, w: 3.4, d: z1 - z0, h: 0.14, mat: MAT.rust, collide: false });
    for (const z of [z0 + 0.4, z1 - 0.4]) G.box({ x: -50.9, z, w: 0.22, d: 0.22, h: 2.9, mat: MAT.steel, flags: LOW });
    G.buildings.push({ name: 'dorm' + z0, label: 'Nhà ngủ', x0: -74, z0, x1: -54, z1, h: 7 });
  }
  L.witness = [P2(-52.6, -14), P2(-72.2, -4), P2(-52.6, 7)];
  L.alley = P2(-61.5, -4);
  const cmat = std(0x6a6258);
  G.box({ x: -66, z: 21, y: 3, w: 14, d: 8, h: 0.16, mat: MAT.rust, collide: false });
  for (const x of [-72.6, -59.4]) for (const z of [17.4, 24.6]) G.box({ x, z, w: 0.22, d: 0.22, h: 3, mat: MAT.steel, flags: LOW });
  for (const x of [-69, -63]) G.box({ x, z: 21.4, w: 3.4, d: 0.8, h: 0.76, mat: cmat, S: 1, flags: LOW });
  L.suspects = [P2(-70.2, 20.4), P2(-67.8, 20.4), P2(-64.2, 20.4), P2(-61.8, 20.4)];

  // ---------------- D: power house + the antenna ----------------
  const pw = std(0x77746b, { map: G.TX.concrete }), PH = 3.8;
  wall('x', -56, 48, 74, null, PH, pw); wall('x', -36, 48, 74, [[59, 63]], PH, pw);
  wall('z', 48, -56, -36, null, PH, pw); wall('z', 74, -56, -36, null, PH, pw);
  roof(48, -56, 74, -36, PH, MAT.rust);
  G.slab(48, -56, 74, -36, MAT.concreteDark, 0.03);
  G.buildings.push({ name: 'power', label: 'Trạm điện', x0: 48, z0: -56, x1: 74, z1: -36, h: PH, lit: true });
  G.box({ x: 64, z: -50.4, w: 6, d: 2.8, h: 1.7, mat: std(0x5f6b3a, { metalness: 0.4 }), S: 2 });
  L.genLed = mesh(B(0.1, 0.1, 0.04), new T.MeshBasicMaterial({ color: 0xff2020 }), 62, 1.4, -48.97);
  const plan = mesh(new T.PlaneGeometry(2.2, 1.4), std(0xffffff, { map: G.signTex(['SƠ ĐỒ', 'CẦU DAO'], { bg: '#dcd4be', fg: '#20262a', w: 320, h: 200 }) }), 48.18, 1.8, -45.5, Math.PI / 2);
  plan.castShadow = false;
  L.generator = P2(64, -48.2); L.diagram = P2(49.3, -45.5);
  roomLight(61, 3.4, -44, 0xffd090, 0.7, 18);
  L.levers = [P2(46.9, -52), P2(46.9, -38.5), P2(54, -34.9), P2(70, -34.9), P2(75.2, -48)];
  for (const [x, z] of [[47.7, -52], [47.7, -38.5], [54, -35.7], [70, -35.7], [74.4, -48]]) mesh(B(0.45, 0.75, 0.45), MAT.rust, x, 1.35, z);
  L.switches = [P2(43, -29.2), P2(72.2, -24.4)];
  for (const p of L.switches) { G.box({ x: p.x, z: p.z - 0.9, w: 1, d: 0.6, h: 1.5, mat: MAT.darkSteel, S: 1 }); }
  // mast
  const MX = 61, MZ = 1.5, mp = [];
  for (const sx of [-1.3, 1.3]) for (const sz of [-1.3, 1.3]) {
    mp.push([B(0.18, 24, 0.18), M4(MX + sx, 12, MZ + sz)]);
    G.addCollider(MX + sx - 0.14, MZ + sz - 0.14, MX + sx + 0.14, MZ + sz + 0.14, 0, 12, LOW);
  }
  for (let y = 1.5; y < 24; y += 2.2) for (const s of [-1.3, 1.3]) { mp.push([B(2.6, 0.09, 0.09), M4(MX, y, MZ + s)]); mp.push([B(0.09, 0.09, 2.6), M4(MX + s, y, MZ)]); }
  for (let y = 0.5; y < 22; y += 0.5) mp.push([B(0.7, 0.05, 0.05), M4(MX, y, MZ + 1.5)]);
  mesh(G.merge(mp), MAT.steel, 0, 0, 0);
  mesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(0xff2020).multiplyScalar(4) }), MX, 24.4, MZ);
  const dish = mesh(new T.SphereGeometry(1.5, 18, 10, 0, Math.PI * 2, 0, 0.8), std(0xd0d4d6, { side: T.DoubleSide, metalness: 0.4 }), 54, 2.5, 12);
  dish.rotation.x = 2.2; L.dishMesh = dish;
  G.box({ x: 54, z: 12, w: 0.5, d: 0.5, h: 1.6, mat: MAT.steel, flags: LOW });
  L.ladder = P2(61, 4.2); L.ladderHelp = P2(58.6, 4.6); L.ladderTop = { x: 61, y: 9, z: 3.2 }; L.dish = P2(54, 13.2);
  const hm = std(0x6b6257, { map: G.TX.rust });
  wall('x', 7, 65, 75, null, 3.1, hm); wall('x', 15, 65, 75, null, 3.1, hm);
  wall('z', 65, 7, 15, [[9.6, 12.4]], 3.1, hm); wall('z', 75, 7, 15, null, 3.1, hm);
  roof(65, 7, 75, 15, 3.1, MAT.rust);
  G.slab(65, 7, 75, 15, MAT.planks, 0.03, 2);
  G.buildings.push({ name: 'hut', label: 'Buồng phát sóng', x0: 65, z0: 7, x1: 75, z1: 15, h: 3.1, lit: true });
  G.box({ x: 73.3, z: 11, w: 1.2, d: 2.6, h: 0.8, mat: MAT.wood, S: 1, flags: LOW });
  mesh(B(0.4, 0.45, 0.7), MAT.black, 73.3, 1.04, 11);
  mesh(B(0.03, 0.12, 0.3), new T.MeshBasicMaterial({ color: 0x60ff90 }), 73.08, 1.1, 11);
  roomLight(70, 2.8, 11, 0x9fffc0, 0.5, 10);
  L.radio = P2(72, 11);

  // ---------------- E: villa ----------------
  const vm = std(0xd8cfbe, { map: G.TX.plaster }), VH = 4.2;
  wall('x', 34, 42, 62, [[50, 54]], VH, vm); wall('x', 52, 42, 62, null, VH, vm);
  wall('z', 42, 34, 52, [[42, 44.6]], VH, vm); wall('z', 62, 34, 52, null, VH, vm);
  G.box({ x: 52, z: 34, w: 4, d: 0.3, h: 1.0, mat: vm, S: 2, flags: LOW }); // the open window
  G.box({ x: 52, z: 34, y: 2.7, w: 4, d: 0.3, h: VH - 2.7, mat: vm, S: 2, flags: OVER });
  roof(42, 34, 62, 52, VH, MAT.roof);
  G.slab(42, 34, 62, 52, MAT.planks, 0.03, 3);
  G.box({ x: 52, z: 43, y: VH + 0.2, w: 20, d: 18, h: 3.6, mat: MAT.facade, S: 12, collide: false });
  G.buildings.push({ name: 'villa', label: 'Biệt thự', x0: 42, z0: 34, x1: 62, z1: 52, h: VH, lit: true });
  L.villaDoor = G.swingDoor(42, 43.3, 2.6, 2.8, 'z', MAT.wood);
  G.box({ x: 52.5, z: 40.6, w: 3, d: 1.3, h: 0.78, mat: MAT.table, S: 1, flags: LOW });
  G.box({ x: 60.7, z: 50.4, w: 1.2, d: 1.2, h: 1.1, mat: MAT.darkSteel, S: 1, flags: LOW });
  L.hedge = G.box({ x: 52, z: 30.2, w: 11, d: 0.9, h: 1.7, mat: MAT.leaf2, S: 1 });
  roomLight(52, 3.7, 42, 0xffd49a, 0.8, 15);
  L.spy = P2(52, 32.6); L.boatmanSeat = P2(50.4, 40.6); L.bossSeat = P2(54.6, 40.6); L.safe = P2(59.3, 50.2);

  // ---------------- F: clinic + punishment cells ----------------
  const km = std(0xbfc6bf, { map: G.TX.plaster });
  wall('x', 32, -14, 10, [[-3.3, -0.7]], 3.4, km); wall('x', 46, -14, 10, null, 3.4, km);
  wall('z', -14, 32, 46, null, 3.4, km); wall('z', 10, 32, 46, null, 3.4, km);
  roof(-14, 32, 10, 46, 3.4, MAT.roof);
  G.slab(-14, 32, 10, 46, MAT.tile, 0.03);
  G.buildings.push({ name: 'clinic', label: 'Phòng y tế', x0: -14, z0: 32, x1: 10, z1: 46, h: 3.4, lit: true });
  for (const x of [-9, 4]) G.box({ x, z: 36, w: 1.1, d: 2.2, h: 0.55, mat: std(0xd8d4cc), S: 1, flags: LOW });
  for (const x of [-11, 7]) G.box({ x, z: 45.1, w: 1.6, d: 0.9, h: 1.2, mat: MAT.metal, S: 1, flags: LOW });
  L.meds = [P2(-11, 44), P2(7, 44)];
  roomLight(-2, 3, 39, 0xe8fff0, 0.6, 14);

  const pu = std(0x7d7a70, { map: G.TX.concrete });
  wall('x', 27.6, -75, -42, null, 3, pu); wall('x', 54, -75, -42, null, 3, pu);
  wall('z', -75, 27.6, 54, null, 3, pu); wall('z', -42, 27.6, 54, [[35.4, 41.4]], 3, pu);
  G.buildings.push({ name: 'punish', label: 'Khu phạt', x0: -75, z0: 27.6, x1: -42, z1: 54, h: 3, open: true });
  L.cells = [];
  for (const x of [-70, -63, -56]) L.cells.push(G.cell(x, 30.2, 3.2, 3, 2.4));
  for (const x of [-70, -63, -56]) L.cells.push(G.cell(x, 45, 3.2, 3, 2.4));
  L.cellSpots = L.cells.map((c) => P2(c.x + 0.8, c.z + c.d / 2 + 0.7));
  G.box({ x: -45, z: 30.4, w: 0.55, d: 0.55, h: 0.45, mat: MAT.wood, collide: false });
  L.sleeper = P2(-45, 30.4); L.keys = P2(-46.5, 30.9); L.keysHelp = P2(-46.2, 34.8);
  L.injured = P2(-67, 38.6); L.injuredHelp = P2(-65.6, 38.6);
  G.box({ x: -67, z: 38.6, w: 1.2, d: 2.1, h: 0.06, mat: std(0x7a6a4a), collide: false });
  G.fire(-49.5, 51.2, 0.5, 0.9);

  // ---------------- G: the storm drain through the south wall ----------------
  const dg = new T.Group(); dg.position.set(24, 0, 60); G.add(dg);
  for (let x = -1.3; x <= 1.31; x += 0.26) { const b = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.2, 6), MAT.rust); b.position.set(x, 1.1, 0); b.castShadow = true; dg.add(b); }
  L.grate = { group: dg, col: G.addCollider(22.6, 59.75, 25.4, 60.25, 0, 5, LOW) };
  G.box({ x: 24, z: 60, y: 2.2, w: 2.8, d: 0.6, h: 2.8, mat: pm, S: 3, collide: false });
  G.box({ x: 24, z: 62.4, w: 2.8, d: 0.2, h: 2.2, mat: MAT.black });   // the dark of the pipe
  G.box({ x: 22.5, z: 61.2, w: 0.2, d: 2.4, h: 2.2, mat: MAT.black }); G.box({ x: 25.5, z: 61.2, w: 0.2, d: 2.4, h: 2.2, mat: MAT.black });
  L.drain = P2(24, 58.7); L.drainHelp = P2(22.4, 58.7); L.hideout = P2(18.2, 56.6);
  L.valves = [P2(-28, 58.2), P2(8.6, 50.6), P2(39.2, 56.6)];
  L.valveMesh = [[-28, 59.4], [8.6, 49.5], [39.2, 58]].map(([x, z]) => {
    const w = mesh(new T.TorusGeometry(0.36, 0.06, 6, 14), std(0xb03a20, { metalness: 0.5 }), x, 1.1, z);
    G.box({ x, z: z + 0.1, w: 0.3, d: 0.3, h: 1.0, mat: MAT.rust, flags: LOW });
    return w;
  });

  // ---------------- cover: containers, trucks, crates, tanks ----------------
  const paint = [0x35566e, 0x7a3a2c, 0x56603c, 0x6b6760].map((c) => std(c, { map: G.TX.metal, metalness: 0.35 }));
  const boxes = [[-34, -47, 2.6, 7], [-35.2, -33, 2.6, 5], [-33, -13.6, 6, 2.6], [-37, 2, 2.6, 6], [-35, 20.6, 6, 2.6], [-20, 22, 2.6, 5], [0, -14.2, 6, 2.6], [5, 3, 2.6, 6],
    [19.6, -14.6, 6, 2.6], [17, 12, 2.6, 6], [38, -10.6, 2.6, 6], [44, 20.4, 6, 2.6], [17.6, 37.4, 2.6, 7], [-28.6, 38.6, 2.6, 6], [-38.6, 51, 2.6, 6], [19.4, 52.6, 5, 2.4],
    [34.6, -42, 2.6, 7], [57, -15, 6, 2.6], [70.6, -8.6, 2.6, 5], [69, 24.6, 6, 2.6]];
  boxes.forEach(([x, z, w, d], i) => G.box({ x, z, w, d, h: 2.6, mat: paint[i % paint.length], S: 3 }));
  const crate = [[-41.4, -51.6], [-34.4, -55.4], [-27.6, -27.4], [-12.6, 17.4], [9.6, -5.4], [27, -3.2], [47.6, -20], [46.2, 8.4], [-22.6, 46.6], [33.4, 46.4], [66, 31.6], [-44, -4], [-47.6, 23.4], [9.4, 24.2]];
  for (const [x, z] of crate) { G.box({ x, z, w: 1.7, d: 1.7, h: 1.6, mat: MAT.planks, S: 2 }); }
  for (const [x, z] of [[-74.6, 15], [77, -14]]) { mesh(new T.CylinderGeometry(1.4, 1.4, 3, 14), std(0x2d4f6a, { metalness: 0.3 }), x, 1.5, z); G.addCollider(x - 1.25, z - 1.25, x + 1.25, z + 1.25, 0, 3); }
  for (const [x, z, col] of [[-9.6, 4, 0xe8eaec], [34.6, 8, 0x1c1c1e]]) {
    const v = new T.Group(); v.position.set(x, 0, z); v.rotation.y = Math.PI / 2; v.add(G.vanModel({ color: col })); G.add(v);
    G.addCollider(x - 2.6, z - 1.15, x + 2.6, z + 1.15, 0, 2.2);
  }
  L.fuseBoxes = [P2(28.4, -51.6), P2(36.8, -20.6), P2(50.4, -18), P2(77.2, -20.4), P2(32.6, -2.4), P2(44, 1), P2(76.8, 20), P2(47.4, 12.6)];
  for (const p of L.fuseBoxes) mesh(B(0.5, 0.6, 0.3), MAT.metal, p.x, 0.9, p.z - 0.7);
  L.fuel = [P2(-6, -16.6), P2(22.4, 8.4)];

  // ---------------- post, spawn spots of each act ----------------
  L.post = P2(-14, 8); L.detPost = P2(-53.6, -42.8);
  for (const p of [L.post, L.detPost]) {
    mesh(new T.CylinderGeometry(0.11, 0.15, 2.4, 8), MAT.wood, p.x, 1.2, p.z);
    for (let i = 0; i < 3; i++) { const r = mesh(new T.TorusGeometry(0.19, 0.025, 4, 10), MAT.chain, p.x, 0.9 + i * 0.12, p.z); r.rotation.x = Math.PI / 2; }
    G.addCollider(p.x - 0.15, p.z - 0.15, p.x + 0.15, p.z + 0.15, 0, 2.4, LOW);
  }
  L.spawns = { 1: P2(-68.5, -48.6), 2: P2(-38.2, -55.2), 3: P2(28.4, -56.4), 4: P2(77, 4) };

  // ---------------- flood lights, searchlights, cameras ----------------
  const head = std(0x333333, { emissive: C(0xffc070), emissiveIntensity: 7 }), floods = [];
  for (const [x, z, r] of [[-30.6, -38, 6.5], [-45, -23.5, 6], [-13, -20.8, 6.5], [13, -20.6, 6], [38.6, -33, 6.5], [66, -30, 6], [-20, 8.6, 6.5], [25, -10, 6], [47, 3.6, 5.5], [-47, 39, 6], [-6, 28.4, 6], [36.4, 30, 6]]) flood(x, z, r, floods, head);
  G.tickers.push(() => {
    const on = !G.lightsOut && G.night > 0.35;
    head.emissiveIntensity = on ? 7 : 0;
    for (const f of floods) f.Lt.intensity = on && !f.em.cur ? 1.3 : 0;
  });
  const lights = [];
  for (const [x, z, cx, cz, rx, rz] of [[-76.4, -56.4, -28, -8, 12, 12], [76.4, -56.4, 38, -14, 12, 9], [-76.4, 56.4, -22, 28, 14, 8], [76.4, 26.8, 26, 22, 10, 14]]) {
    for (const sx of [-1.1, 1.1]) for (const sz of [-1.1, 1.1]) G.box({ x: x + sx, z: z + sz, w: 0.2, d: 0.2, h: 9, mat: MAT.steel, flags: LOW });
    G.box({ x, z, y: 9, w: 3, d: 3, h: 0.2, mat: MAT.planks, collide: false });
    const g = new T.Group(); g.position.set(x, 10, z); G.add(g);
    const hs = new T.Mesh(new T.CylinderGeometry(0.3, 0.38, 0.6, 10), MAT.darkSteel); hs.rotation.x = Math.PI / 2; g.add(hs);
    lights.push({ lamp: g, cx, cz, rx, rz, fa: 0.16 + Math.abs(cx) * 0.0011, fb: 0.22, r: 5 });
  }
  for (const [x, y, z, cx, cz, rx, rz] of [[-22.2, 4.6, -26.4, -18, -22.6, 5, 0.8], [24.2, 4.6, -30, 28, -35, 0.8, 5], [-43.7, 4, -31, -39.4, -36.5, 0.8, 4], [41.7, 4.6, 40, 37.6, 40, 0.8, 4]]) {
    const g = new T.Group(); g.position.set(x, y, z); G.add(g);
    const body = new T.Mesh(B(0.2, 0.18, 0.4), MAT.black); g.add(body);
    lights.push({ lamp: g, cam: true, cx, cz, rx, rz, fa: 0.5, fb: 0.5, r: 2.4 });
  }

  // ---------------- the hills round it ----------------
  const trees = [];
  let s = 9091; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2, d = 1.1 + r() * 0.9, x = Math.cos(a) * 105 * d, z = Math.sin(a) * 88 * d;
    if (Math.abs(x) < 86 && Math.abs(z) < 66) continue;
    const k = 0.9 + r() * 0.7; trees.push([x, z, k, (7 + r() * 7) * k]);
  }
  if (G.forest) G.forest(trees, null, { nearR: 1 }); // all seen over the wall: the light model is enough

  return {
    bounds: { x0: -82, x1: 82, z0: -62, z1: 64 }, compound: { x0: -80, z0: -60, x1: 80, z1: 60 },
    extra: [{ x0: 57, z0: -2, x1: 65, z1: 6, label: 'Ăng-ten' }, { x0: 20, z0: 60, x1: 28, z1: 63, label: 'Cống' }],
    lights,
    guards: [
      { id: 'station', kind: 'office', day: [-48.4, -32.6, Math.PI], seat: [-48.4, -32.6, Math.PI], path: [[-48.4, -32.6], [-48.2, -36.8], [-48.2, -41], [-69.6, -41.2]], smokeYaw: -Math.PI / 2, sitTime: 34, firstSit: 30, look: OWN_LOOK({ rifle: false }) },
      { id: 'detC', day: [-58, -41, Math.PI / 2], route: [[-51.4, -41.2, 5], [-63, -41.2, 5]], look: OWN_LOOK({ rifle: false }) },
      { id: 'detOut', day: [-39, -40, 0], route: [[-39.6, -44, 3], [-39.6, -27, 2], [-76.6, -27, 3], [-39.6, -27, 1]], look: OWN_LOOK() },
      { id: 'hall', day: [-10, -42, 0], route: [[-19.6, -42, 3], [1.6, -42, 2], [2.4, -30.6, 2], [-19.6, -32.8, 3]], look: OWN_LOOK({ rifle: false }) },
      { id: 'outA', day: [-8, -21, 0], route: [[-25.6, -57, 3], [26, -57, 2], [26.6, -19.2, 1], [-25.6, -19.2, 3]], look: OWN_LOOK() },
      { id: 'boss', day: [12, -47.6, 0], route: [[2.6, -47.9, 7], [10, -47.8, 1], [19, -44.4, 4], [10, -47.8, 1]], look: OWN_LOOK({ rifle: false, shirt: 0x2a2a38 }) },
      { id: 'dorm', day: [-47, 0, 0], route: [[-47.4, -23, 3], [-47.4, 14, 4]], look: OWN_LOOK() },
      { id: 'yardN', day: [-10, -9, 0], route: [[-26, -9.6, 3], [14, -9.6, 2], [14, -18, 2], [-26, -17, 2]], look: OWN_LOOK() },
      { id: 'yardS', day: [0, 14, 0], route: [[-24, 27, 2], [13, 27, 3], [12, 14.6, 1], [-24, 14.6, 2]], look: OWN_LOOK() },
      { id: 'power', day: [60, -31.6, 0], route: [[44.6, -31.6, 4], [76.6, -31.6, 2], [76.8, -54, 3], [76.6, -31.6, 1]], look: OWN_LOOK() },
      { id: 'mast', day: [56, -3, 0], route: [[48, -3.6, 4], [76.6, -3.6, 2], [76.8, 18, 3], [52, 18, 4]], look: OWN_LOOK() },
      { id: 'villa', day: [52, 26.6, 0], route: [[38.4, 26.8, 5], [66, 27.4, 4]], look: OWN_LOOK({ shirt: 0x2a2a38 }) },
      { id: 'villaW', day: [33, 40, 0], route: [[32, 31, 3], [31.6, 55, 3], [27, 55, 2], [31.6, 45, 2]], look: OWN_LOOK() },
      { id: 'clinic', day: [0, 29.6, 0], route: [[-17.6, 29.6, 3], [12.4, 29.6, 4], [13, 47.6, 2], [-17.6, 48.6, 2]], look: OWN_LOOK() },
      { id: 'keys', kind: 'sleep', day: [-45, 30.4, -Math.PI / 2], look: { shirt: 0x4a3a2a } },
      { id: 'cells', day: [-56, 36, 0], route: [[-44.6, 36.4, 6], [-71, 36.2, 4]], look: OWN_LOOK() },
      { id: 'south', day: [-16, 54, 0], route: [[-37, 56.6, 4], [5, 55, 4]], look: OWN_LOOK() },
      { id: 'dogY', dog: true, day: [-20, 0, 0], route: [[-30, -1.4, 3], [0, -4, 2], [22.6, 0, 3], [21.6, 19.4, 0], [12, 20.6, 1], [-16, 18.6, 2]] },
      { id: 'dogE', dog: true, color: 0x4a3a28, day: [40, 0, 0], route: [[31, 4, 4], [42, -6.4, 2], [42.6, -25.6, 4], [32, -27, 3]] },
      { id: 'dogS', dog: true, color: 0x6a5a40, day: [0, 52, 0], route: [[-24, 52.6, 5], [12, 53.6, 4]] },
    ],
    overcast: 0.9, rain: 0.4, lightning: false, fogMul: 0.8, cityGlow: 0.04, moon: 1.9,
  };
} };

// ==================================== the border forest ====================================
G.LEVELS.border = { build() {
  const L = G.LOC;
  G.slab(-300, -120, 300, 400, MAT.grass, 0.001, 9);
  const dirt = std(0x8a7a64, { map: G.TX.dirt, roughness: 1 });
  // the trail
  const TR = [[0, 3], [-5, 24], [6, 48], [-4, 72], [4, 96], [0, 114], [0, 130], [-2, 146], [5, 170], [-3, 194], [0, 212]];
  for (let i = 0; i < TR.length - 1; i++) {
    const [x0, z0] = TR[i], [x1, z1] = TR[i + 1], len = Math.hypot(x1 - x0, z1 - z0);
    const m = new T.Mesh(G.planeGeo(2.6, len + 1.2, 3), dirt);
    m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2; m.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    m.position.set((x0 + x1) / 2, 0.014 + i * 0.0006, (z0 + z1) / 2); m.receiveShadow = true; G.add(m);
  }
  // the drain's mouth
  G.box({ x: 0, z: -1.4, w: 14, d: 1, h: 4, mat: MAT.concreteDark, S: 4 });
  mesh(new T.CircleGeometry(1.2, 18), MAT.black, 0, 1.2, -0.88);
  L.start = P2(0, 4); L.spawns = { 5: P2(0, 4) };
  // map edges
  G.addCollider(-34.5, -3, -34, 262, 0, 3, UNSEEN); G.addCollider(34, -3, 34.5, 262, 0, 3, UNSEEN); G.addCollider(-34, -3, 34, -2, 0, 3, UNSEEN);

  // ribbons chị Thiri tied along a safe way
  L.ribbons = [P2(-17.6, 22), P2(15.6, 38.6), P2(-21.4, 57.6), P2(19.4, 74.4), P2(-14.6, 89.4), P2(9.6, 101.6)];
  L.ribbonMesh = L.ribbons.map((p) => {
    mesh(new T.CylinderGeometry(0.05, 0.07, 1.6, 6), MAT.trunk, p.x + 0.5, 0.8, p.z);
    const r = mesh(B(0.1, 0.5, 0.04), new T.MeshBasicMaterial({ color: 0xff5a8a }), p.x + 0.44, 1.35, p.z);
    r.castShadow = false; return r;
  });

  // creek + the bridge the team builds
  G.slab(-60, 113, 60, 118, MAT.water, 0.05, 6);
  G.addCollider(-34, 113.2, -2, 117.8, 0, 2, UNSEEN); G.addCollider(2, 113.2, 34, 117.8, 0, 2, UNSEEN);
  const bridge = new T.Group(); G.add(bridge);
  for (let i = 0; i < 7; i++) { const p = new T.Mesh(G.boxGeo(0.5, 0.1, 6.4, 2), MAT.planks); p.position.set(-1.6 + i * 0.53, 0.14, 115.5); p.castShadow = true; bridge.add(p); }
  bridge.visible = false;
  L.bridge = { group: bridge, col: G.addCollider(-2, 113.2, 2, 117.8, 0, 2, UNSEEN) };
  L.planks = [P2(-25.6, 99), P2(22.6, 93.4), P2(25.4, 108.4)];
  L.bridgeSpot = P2(0, 111.8);

  // the checkpoint: wire fence across the strip, a chained gate, a hut
  for (const [x0, x1] of [[-34, -1.8], [1.8, 34]]) {
    const f = mesh(G.planeGeo(x1 - x0, 3, 2), MAT.fence, (x0 + x1) / 2, 1.5, 145); f.castShadow = false;
    G.addCollider(x0, 144.9, x1, 145.1, 0, 3, LOW);
  }
  coils([[-34, 145, -1.8, 145], [1.8, 145, 34, 145]], 3.05);
  const gate = new T.Group(); gate.position.set(-1.8, 0, 145); G.add(gate);
  const gm = new T.Mesh(G.planeGeo(3.6, 2.8, 2), MAT.fence); gm.position.set(1.8, 1.4, 0); gate.add(gm);
  L.gate = { group: gate, col: G.addCollider(-1.8, 144.9, 1.8, 145.1, 0, 3, LOW) };
  G.box({ x: 12, z: 139.6, w: 5, d: 4.4, h: 2.8, mat: MAT.planks, S: 3 });
  G.box({ x: 12, z: 139.6, y: 2.8, w: 6, d: 5.4, h: 0.16, mat: MAT.rust, collide: false });
  G.buildings.push({ name: 'post', label: 'Chốt gác', x0: 9.5, z0: 137.4, x1: 14.5, z1: 141.8, h: 2.8 });
  notice('ဝင်ခွင့်မရှိ', 'CẤM QUA', 3.4, 2.2, 144.8, Math.PI, 2);
  L.chain = P2(0.5, 144); L.chainHelp = P2(-1.6, 143.9);
  const pl = new T.PointLight(C(0xffc070), 1.0, 14, 1.5); pl.position.set(9, 3, 141); G.add(pl);
  G.lit.push({ x: 8.6, z: 141, r: 4.5 });

  // bamboo + the raft
  L.poles = [P2(-25.4, 157.4), P2(22.4, 163.4), P2(-19.6, 186.6), P2(24.6, 193.4)];
  const clumps = [];
  for (const p of L.poles) for (let i = 0; i < 14; i++) clumps.push(M4(p.x + Math.cos(i * 2.4) * (1.2 + (i % 3) * 0.3), 2.6, p.z + Math.sin(i * 2.4) * (1.2 + (i % 3) * 0.3) - 1.4, i, 0.06, 0.04));
  G.inst(new T.CylinderGeometry(0.06, 0.08, 5.2, 6), MAT.bamboo, clumps);
  L.raftSpot = P2(0, 209.6); L.lash = [P2(-3.1, 211.4), P2(3.1, 211.4)]; L.board = P2(0, 210.4);
  const raft = new T.Group(); raft.position.set(0, 0.05, 213.3); G.add(raft);
  const logs = [];
  for (let i = 0; i < 4; i++) {
    const g = new T.Group(); raft.add(g); g.visible = false; logs.push(g);
    for (let k = 0; k < 4; k++) { const c = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 4.2, 8), MAT.bamboo); c.rotation.x = Math.PI / 2; c.position.set(-1.85 + (i * 4 + k) * 0.247, 0.12, 0); c.castShadow = true; g.add(c); }
  }
  const ropes = new T.Group(); raft.add(ropes); ropes.visible = false;
  for (const z of [-1.5, 1.5]) { const r = new T.Mesh(B(4.1, 0.07, 0.16), MAT.rope); r.position.set(0, 0.27, z); ropes.add(r); }
  L.raft = raft; L.raftLogs = logs; L.raftRopes = ropes; L.raftFrom = 213.3; L.raftTo = 242.2;

  // the river and the Thai bank
  G.slab(-320, 214, 320, 244, MAT.water, 0.06, 12);
  G.slab(-60, 210.5, 60, 214.4, MAT.mud, 0.03, 5); G.slab(-60, 243.6, 60, 247, MAT.mud, 0.065, 5);
  G.addCollider(-34, 214, 34, 244, 0, 2, UNSEEN);
  G.addCollider(-34, 261.6, 34, 262, 0, 3, UNSEEN);
  L.farBank = P2(0, 247.4);
  const sign = mesh(new T.PlaneGeometry(6, 1.3), std(0xffffff, { map: G.signTex(['THÁI LAN', 'THAILAND'], { bg: '#163a6a', w: 420, h: 100, grime: false }) }), 0, 3.4, 252.4, Math.PI);
  sign.castShadow = false;
  for (const x of [-2.6, 2.6]) mesh(new T.CylinderGeometry(0.06, 0.07, 3.4, 8), MAT.steel, x, 1.7, 252.6);
  L.vans = [];
  for (const [x, z, ry] of [[-8, 254, 0.5], [8.4, 254.6, -0.4]]) {
    const v = new T.Group(); v.position.set(x, 0, z); v.rotation.y = Math.PI + ry; v.add(G.vanModel({ color: 0xe8eaec, stripe: 0x6a1f2a, lights: true })); G.add(v);
    G.addCollider(x - 1.4, z - 2.7, x + 1.4, z + 2.7, 0, 2.2);
    const bar = mesh(B(0.9, 0.1, 0.3), new T.MeshBasicMaterial({ color: new T.Color(0xff2020).multiplyScalar(5), fog: false }), x, 2.3, z);
    L.vans.push(bar);
  }
  G.tickers.push((dt, t) => { L.vans.forEach((b, i) => { b.visible = ((t * 3 + i) % 2) < 1; }); });

  // cover: rocks, trunks, thickets (guards cannot see through these)
  const rock = std(0x5c5a52, { map: G.TX.concrete }), RK = new T.DodecahedronGeometry(1, 0);
  const cover = [[-8, 14], [9, 18], [-24, 30], [3, 33.6], [21, 46], [-11, 45], [-3, 60], [12, 62], [-26, 69], [5, 79], [25, 84], [-21, 82], [-7, 100], [17, 103], [-16, 107.6],
    [-9, 122], [8, 124], [-22, 128], [20, 133], [-7, 137.6], [5.6, 136.4], [-12, 151], [10, 154], [-4, 163], [15, 172], [-11, 177], [5, 186], [-27, 196], [12, 200], [-9, 204.6], [19, 207]];
  cover.forEach(([x, z], i) => {
    const w = 2 + (i % 3) * 0.6, d = 1.8 + (i % 2) * 0.7;
    const m = mesh(RK, i % 4 === 1 ? MAT.leaf2 : rock, x, 0.7, z, i * 0.8); m.scale.set(w * 0.62, 1.5, d * 0.62);
    G.addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, 1.9);
  });
  const trees = [], bushes = [];
  let s = 3313; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 620; i++) {
    const side = r() < 0.5 ? -1 : 1, x = side * (30 + r() * 55), z = -8 + r() * 266;
    if (z > 209 && z < 249) continue;
    const k = 0.8 + r() * 0.8; trees.push([x, z, k, (7 + r() * 6) * k]);
    if (r() < 0.4) bushes.push([x + r() * 3, z + r() * 3, 1 + r()]);
  }
  cover.forEach(([x, z], i) => { if (i % 2) trees.push([x + 0.3, z + 0.3, 0.9, 8 + (i % 4)]); });
  if (G.forest) G.forest(trees, bushes, { nearR: 48, cx: 0, cz: 110 });
  if (G.grassField) {
    let gs = 515; const gr = () => { gs = (gs * 16807) % 2147483647; return gs / 2147483647; };
    G.grassField(1700, () => { const x = -30 + gr() * 60, z = 3 + gr() * 206; return (z > 112 && z < 119) || Math.abs(x) < 3 ? null : [x, z, 0.6 + gr() * 0.8]; });
  }
  L.post = P2(-5.6, 106.4); L.post2 = P2(-5.4, 150.4);
  for (const p of [L.post, L.post2]) { mesh(new T.CylinderGeometry(0.16, 0.2, 2.6, 8), MAT.trunk, p.x, 1.3, p.z); G.addCollider(p.x - 0.16, p.z - 0.16, p.x + 0.16, p.z + 0.16, 0, 2.6, LOW); }

  return {
    bounds: { x0: -36, x1: 36, z0: -6, z1: 262 },
    extra: [{ x0: -34, z0: 113, x1: 34, z1: 118, label: 'Suối' }, { x0: -34, z0: 214, x1: 34, z1: 244, label: 'Sông Moei' }, { x0: -20, z0: 249, x1: 20, z1: 260, label: 'Thái Lan' }],
    lights: [],
    guards: [
      { id: 'w1', day: [0, 42, 0], route: [[-23, 40.6, 3], [20, 44.6, 4]], look: OWN_LOOK() },
      { id: 'w2', day: [0, 76, 0], route: [[17.6, 68.6, 3], [-18, 73, 3], [-17.4, 84, 0], [-23, 94, 2], [14.6, 89.6, 3]], look: OWN_LOOK() },
      { id: 'creek', day: [0, 108, 0], route: [[-28, 110.4, 5], [28, 106, 5]], look: OWN_LOOK() },
      { id: 'cp', day: [0, 141, 0], route: [[-16, 141.4, 7], [6.8, 141, 5]], look: OWN_LOOK() },
      { id: 'cp2', day: [10, 130, 0], route: [[19, 128.6, 3], [-17, 126, 4]], look: OWN_LOOK() },
      { id: 'grove', day: [0, 170, 0], route: [[-22, 165.6, 4], [20, 170, 3], [18, 197, 3], [-21, 197.6, 4]], look: OWN_LOOK() },
      { id: 'bank', day: [0, 207, 0], route: [[-21, 206.6, 5], [22, 205.6, 5]], look: OWN_LOOK() },
      { id: 'dogW', dog: true, day: [8, 58, 0], route: [[8.6, 57, 3], [-12, 84, 4], [13, 98, 2]] },
      { id: 'dogG', dog: true, color: 0x4a3a28, day: [0, 180, 0], route: [[-14, 159, 3], [-1, 170, 0], [12, 181.4, 4], [0.6, 181.6, 0], [-8, 192.4, 3], [-15, 176, 0]] },
    ],
    overcast: 0.7, rain: 0.4, lightning: false, fogMul: 1.15, cityGlow: 0.02, moon: 2.8,
  };
} };
})(window.G);
