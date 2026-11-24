// levels/sihanouk_props.js — interiors + yard props for Map 1 (called from sihanouk.js build)
(function (G) {
'use strict';
const T = G.T, C = G.C, MAT = G.MAT, M4 = G.M4;
const B = (w, h, d) => new T.BoxGeometry(w, h, d);
function inst(geo, mat, mats, opt) {
  const im = new T.InstancedMesh(geo, mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = !!(opt && opt.cast); im.receiveShadow = true; G.add(im); return im;
}
G.inst = inst;
const white = (o) => G.std(Object.assign({ color: 0xffffff, roughness: 0.85 }, o || {}));
const add = (m) => { G.add(m); return m; };

G.buildSihanoukProps = function () {
  // ====================== WORK HALL ======================
  const ROWS = [-41, -35, -29, -23], SEGS = [[-31, -9], [-1, 21]];
  const legParts = [], chairFrame = [], chairPad = [], monBlack = [], screens = [], seats = [];
  for (const tz of ROWS) for (const [x0, x1] of SEGS) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    G.box({ x: cx, z: tz, y: 0.72, w, d: 0.85, h: 0.05, mat: MAT.table, collide: false, S: 2 });
    for (const lx of [x0 + 0.1, cx, x1 - 0.1]) for (const lz of [-0.36, 0.36]) legParts.push([B(0.05, 0.72, 0.05), M4(lx, 0.36, tz + lz)]);
    G.addCollider(x0, tz - 0.45, x1, tz + 0.45, 0, 0.78, { los: false });
    G.addCollider(x0 === -1 && tz === -29 ? 0.25 : x0, tz + 0.42, x1, tz + 1.12, 0, 1.3, { los: false, cam: false });
    for (let i = 0; i < 17; i++) { const x = x0 + 0.6 + i * 1.25, sz = tz + 0.75; seats.push({ x, z: sz, tz }); chairFrame.push(M4(x, 0, sz)); chairPad.push(M4(x, 0, sz)); monBlack.push(M4(x, 0, tz)); screens.push(M4(x, 1.12, tz - 0.155 + 0.022)); }
  }
  add(new T.Mesh(G.merge(legParts), MAT.darkSteel));
  inst(G.merge([[B(0.03, 0.46, 0.03), M4(-0.2, 0.23, -0.19)], [B(0.03, 0.46, 0.03), M4(0.2, 0.23, -0.19)], [B(0.03, 0.46, 0.03), M4(-0.2, 0.23, 0.19)], [B(0.03, 0.46, 0.03), M4(0.2, 0.23, 0.19)], [B(0.03, 0.55, 0.03), M4(-0.2, 0.72, 0.21)], [B(0.03, 0.55, 0.03), M4(0.2, 0.72, 0.21)]]), MAT.steel, chairFrame);
  inst(G.merge([[B(0.44, 0.05, 0.42), M4(0, 0.47, 0)], [B(0.42, 0.26, 0.04), M4(0, 0.82, 0.21, 0, -0.1)]]), MAT.chairSeat, chairPad, { cast: true });
  inst(G.merge([[B(0.24, 0.02, 0.17), M4(0, 0.755, -0.18)], [B(0.04, 0.22, 0.04), M4(0, 0.87, -0.19)], [B(0.56, 0.36, 0.04), M4(0, 1.12, -0.175)], [B(0.42, 0.02, 0.14), M4(0, 0.755, 0.17)], [B(0.06, 0.02, 0.1), M4(0.3, 0.755, 0.18)], [B(0.2, 0.42, 0.42), M4(0.42, 0.21, -0.05)]]), MAT.plastic, monBlack, { cast: true });
  const scr = inst(new T.PlaneGeometry(0.52, 0.32), MAT.screen, screens);
  screens.forEach((m, i) => scr.setColorAt(i, C([0xffffff, 0xcfe3ff, 0xd8ffe6, 0xfff2d0][(G.rand() * 4) | 0])));
  const plate = add(new T.Mesh(new T.PlaneGeometry(0.34, 0.2), G.std({ map: G.signTex(['17'], { bg: '#f2e9d2', fg: '#a3191e', w: 128, h: 80, grime: false }) }))); plate.position.set(-0.4, 0.86, -28.57);
  const d17 = G.desk17Marker = new T.Group(); G.add(d17);
  const d17Sign = new T.Mesh(new T.PlaneGeometry(1.5, 0.55), G.std({ map: G.signTex(['BÀN 17'], { bg: '#f0a23a', fg: '#151515', w: 256, h: 96, grime: false }), emissive: C(0x6a4010), emissiveIntensity: 0.6, side: T.DoubleSide })); d17Sign.position.set(-0.4, 2.5, -28.6); d17.add(d17Sign);
  const d17Ring = new T.Mesh(new T.RingGeometry(0.5, 0.68, 40), new T.MeshBasicMaterial({ color: C(0xf0a23a), transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, fog: false })); d17Ring.rotation.x = -Math.PI / 2; d17Ring.position.set(-0.4, 0.06, -28.0); d17.add(d17Ring);
  G.tickers.push((dt, t) => { d17Ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.3; d17Sign.rotation.y = Math.sin(t * 0.8) * 0.15; });
  // seated workers: the same sculpted people as everyone else, posed at their keyboards and drawn as one instanced
  // crowd (typing and small head movements in the shader); seat 17 stays empty
  const seated = seats.filter((s) => !(Math.abs(s.x + 0.4) < 0.1 && s.tz === -29));
  const SHIRTS = [0x2f7d6f, 0x3b8a78, 0x2c6e62, 0x467a3a, 0x6b6f72, 0xd8d4c8, 0x34506e, 0x2f7d6f];
  const SKINS = [0xc79a74, 0xb5835e, 0xd6a985, 0xa8754f], PANTS = [0x22252b, 0x3a3f4a, 0x7d6f52, 0x2b2f38];
  const pick = (a) => a[(G.rand() * a.length) | 0];
  const typing = (p) => G.animHuman(p, { pose: 'type', t: 0.3, seatY: 0.495, size: p.cfg.female ? 0.91 : 0.95 });
  const crowd = G.crowd(seated.map((s) => ({ x: s.x, z: s.z, ry: Math.PI, female: G.rand() < 0.3, skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS) })), typing, { cast: !!(G.gfx && G.gfx.P && G.gfx.P.shadow >= 2) });
  // the hall has no windows: from outside the crowd can only be seen through the two doors. Don't draw it otherwise
  // (it is most of the triangles in this level)
  {
    let cx0 = 1e9, cx1 = -1e9, cz0 = 1e9, cz1 = -1e9;
    for (const s of seated) { cx0 = Math.min(cx0, s.x - 0.5); cx1 = Math.max(cx1, s.x + 0.5); cz0 = Math.min(cz0, s.z - 0.6); cz1 = Math.max(cz1, s.z + 0.6); }
    const HX0 = -35, HX1 = 25, HZ0 = -48, HZ1 = -14;
    // the rays from the camera through a door's two edges, carried to the near and far side of the seats
    const spans = (c0, c1, e0, e1, wall, d0, d1) => { let lo = 1e9, hi = -1e9; for (const e of [e0, e1]) for (const d of [d0, d1]) { const v = c1 + (e - c1) * (d - c0) / (wall - c0); lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
    const seen = (c) => {
      if (c.x > HX0 - 0.3 && c.x < HX1 + 0.3 && c.z > HZ0 - 0.3 && c.z < HZ1 + 0.3) return true;
      // through a door, from up to 20 m away (further off a 5 m doorway is a sliver of the screen)
      if (c.z > HZ1 && (c.x + 5.5) ** 2 + (c.z - HZ1) ** 2 < 400) { const [a, b] = spans(c.z, c.x, -8, -3, HZ1, cz1, cz0); if (b > cx0 && a < cx1) return true; }   // south door
      if (c.x > HX1 && (c.x - HX1) ** 2 + (c.z + 29.5) ** 2 < 400) { const [a, b] = spans(c.x, c.z, -31, -28, HX1, cx1, cx0); if (b > cz0 && a < cz1) return true; } // east door
      return false;
    };
    G.tickers.push(() => { const v = seen(G.camera.position); for (const g of crowd || []) { g.far.visible = v; if (g.near) g.near.visible = v; } });
  }  for (const x of [-20, 10]) for (const z of [-37.6, -25.6]) G.box({ x, z, w: 0.5, d: 0.5, h: 8, mat: MAT.concrete, S: 2 });
  const tubes = [], housings = [], wires = [];
  for (const tz of ROWS) for (let x = -30; x <= 20; x += 2.6) { if (x > -9 && x < -1) continue; tubes.push(M4(x, 4.6, tz + 0.3)); housings.push(M4(x, 4.66, tz + 0.3)); wires.push(M4(x - 0.5, 6.3, tz + 0.3)); wires.push(M4(x + 0.5, 6.3, tz + 0.3)); }
  inst(B(1.2, 0.04, 0.06), MAT.tube, tubes); inst(B(1.3, 0.04, 0.16), MAT.plastic, housings); inst(B(0.012, 3.3, 0.012), MAT.black, wires);
  for (const [x, z] of [[-19, -32], [9, -32], [-5, -42]]) { const Lt = new T.PointLight(C(0xe6f2ff), 0.85, 36, 1.2); Lt.position.set(x, 6.8, z); G.add(Lt); }
  G.box({ x: -5, z: -46.2, w: 2.6, d: 1, h: 0.8, mat: MAT.wood });
  const boardTex = G.makeTex(1024, 512, (g) => {
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 1024, 512); g.fillStyle = '#a3191e'; g.font = '700 54px Oswald, Impact, sans-serif'; g.fillText('BẢNG CHỈ TIÊU HÔM NAY', 30, 70);
    g.font = '500 30px "Be Vietnam Pro", Arial, sans-serif';
    [['Tổ 1 · Giả danh công an', '38.200$', 1], ['Tổ 2 · Đầu tư chứng khoán', '51.900$', 1], ['Tổ 3 · Lừa tình', '12.400$', 0], ['Tổ 4 · Giả danh người thân', '27.000$', 0], ['NHÂN VIÊN MỚI', '0$', 0]].forEach((r, i) => {
      const y = 140 + i * 66; g.fillStyle = '#222'; g.fillText(r[0], 40, y); g.fillText(r[1], 640, y); g.fillStyle = r[2] ? '#2b8a3e' : '#c21c22'; g.fillRect(820, y - 30, 150, 34); g.fillStyle = '#fff'; g.fillText(r[2] ? 'ĐẠT' : 'PHẠT', 850, y - 3);
    });
  }, { repeat: false });
  add(new T.Mesh(new T.PlaneGeometry(6, 3), G.std({ map: boardTex, roughness: 0.6 }))).position.set(-5, 3.2, -47.82);
  add(new T.Mesh(new T.PlaneGeometry(14, 1.4), G.std({ map: G.signTex(['KHÔNG LÀM = CHÍCH ĐIỆN ⚡'], { bg: '#b0161c', fg: '#ffe066', w: 1024, h: 104 }) }))).position.set(-5, 5.6, -47.82);
  const q2 = add(new T.Mesh(new T.PlaneGeometry(10, 1.2), G.std({ map: G.signTex(['MỖI CUỘC GỌI LÀ MỘT CƠ HỘI'], { bg: '#b0161c', fg: '#fff', w: 1024, h: 120 }) }))); q2.position.set(-34.82, 4.6, -31); q2.rotation.y = Math.PI / 2;
  const ledMat = G.std({ color: 0x000000, emissive: C(0xff2020), emissiveIntensity: 2 });
  G.tickers.push((dt, t) => { ledMat.emissiveIntensity = (t % 1.2) < 0.6 ? 2.5 : 0.2; });
  for (const [x, y, z, ry] of [[-34.5, 6.5, -47.5, 0.7], [24.5, 6.5, -47.5, -0.7], [-34.5, 6.5, -14.5, 2.4], [24.5, 6.5, -14.5, -2.4]]) { const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; G.add(g); const b = new T.Mesh(B(0.18, 0.16, 0.42), white({ color: C(0xd8d8d0) })); b.rotation.x = 0.35; g.add(b); const l = new T.Mesh(B(0.04, 0.04, 0.02), ledMat); l.position.set(0.05, 0.02, -0.22); g.add(l); }
  add(new T.Mesh(new T.PlaneGeometry(12, 1.6), G.std({ map: G.signTex(['S-7 GROUP · TRUNG TÂM CHĂM SÓC KHÁCH HÀNG'], { bg: '#8f1217', fg: '#fff3d6', w: 1024, h: 136 }), emissive: C(0x401010), emissiveIntensity: 0.4 }))).position.set(-5.5, 4.4, -13.82);

  // ====================== DORM ======================
  const bunkParts = [], mattress = [], bunks = [];
  const bunkGeo = G.merge([[B(0.05, 2.0, 0.05), M4(-0.43, 1, -0.98)], [B(0.05, 2.0, 0.05), M4(0.43, 1, -0.98)], [B(0.05, 2.0, 0.05), M4(-0.43, 1, 0.98)], [B(0.05, 2.0, 0.05), M4(0.43, 1, 0.98)], [B(0.9, 0.06, 2.0), M4(0, 0.42, 0)], [B(0.9, 0.06, 2.0), M4(0, 1.5, 0)]]);
  for (let i = 0; i < 8; i++) for (const zc of [9.3, 28.7]) { const x = 33 + i * 3.2; bunks.push({ x, z: zc }); bunkParts.push(M4(x, 0, zc)); mattress.push(M4(x, 0.5, zc)); mattress.push(M4(x, 1.58, zc)); G.addCollider(x - 0.47, zc - 1.0, x + 0.47, zc + 1.0, 0, 2.0, { los: false }); }
  inst(bunkGeo, MAT.steel, bunkParts, { cast: true });
  const mt = inst(B(0.82, 0.1, 1.9), white(), mattress); mattress.forEach((m, i) => mt.setColorAt(i, C([0x2d5a8a, 0x8a3b3b, 0x6f7d4a, 0x9c9a8a, 0x3e3e5a][(G.rand() * 5) | 0])));
  const n3 = add(new T.Mesh(new T.PlaneGeometry(0.3, 0.3), G.std({ map: G.signTex(['3'], { bg: '#e8e0c8', fg: '#222', w: 64, h: 64, grime: false }) }))); n3.position.set(39.4, 1.2, 10.33);
  add(new T.Mesh(new T.SphereGeometry(0.08, 8, 6), MAT.bulb)).position.set(44, 3.8, 19);
  const dl = new T.PointLight(C(0xffc27a), 0.9, 24, 1.3); dl.position.set(44, 3.6, 19); G.add(dl);
  add(new T.Mesh(new T.PlaneGeometry(4, 0.8), G.std({ map: G.signTex(['KÝ TÚC XÁ B'], { bg: '#24384a', w: 512, h: 100 }) }))).position.set(29.8, 3.3, 17.5);
  G.root.children[G.root.children.length - 1].rotation.y = -Math.PI / 2;

  // ====================== CANTEEN ======================
  for (const tz of [11, 21]) {
    G.box({ x: -48, z: tz, y: 0.72, w: 18, d: 1.0, h: 0.06, mat: MAT.table, collide: false, S: 2 });
    G.box({ x: -48, z: tz - 0.8, w: 18, d: 0.32, h: 0.45, mat: MAT.wood, collide: false }); G.box({ x: -48, z: tz + 0.8, w: 18, d: 0.32, h: 0.45, mat: MAT.wood, collide: false });
    G.addCollider(-57, tz - 1.0, -39, tz + 1.0, 0, 0.8, { los: false });
  }
  G.box({ x: -58.8, z: 16, w: 1.4, d: 16, h: 0.9, mat: MAT.concrete });
  for (let i = 0; i < 5; i++) add(new T.Mesh(new T.CylinderGeometry(0.3, 0.26, 0.4, 14), MAT.steel)).position.set(-58.8, 1.1, 10 + i * 3);

  // ====================== GUARD OFFICE ======================
  G.box({ x: -5.2, z: 45.2, w: 0.8, d: 1.7, h: 0.76, mat: MAT.wood });
  const cctvTex = G.makeTex(256, 192, (g) => { for (let i = 0; i < 4; i++) { const x = (i % 2) * 128, y = ((i / 2) | 0) * 96; g.fillStyle = '#1b2421'; g.fillRect(x + 2, y + 2, 124, 92); for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(160,190,170,${G.rand() * 0.3})`; g.fillRect(x + 2 + G.rand() * 124, y + 2 + G.rand() * 92, 2, 1); } g.fillStyle = '#9fd0a8'; g.font = '12px monospace'; g.fillText('CAM 0' + (i + 1), x + 6, y + 14); } }, { repeat: false });
  const cm = G.std({ map: cctvTex, emissive: C(0xffffff), emissiveMap: cctvTex, emissiveIntensity: 0.9 });
  for (const dz of [-0.4, 0.4]) { const s = add(new T.Mesh(new T.PlaneGeometry(0.5, 0.36), cm)); s.position.set(-4.98, 1.0, 45.2 + dz); s.rotation.y = -Math.PI / 2; }
  const wb = add(new T.Mesh(new T.PlaneGeometry(2.4, 1.2), cm)); wb.position.set(-5.5, 2.2, 48.83); wb.rotation.y = Math.PI;
  const card = new T.Group(); card.position.set(-5.05, 0.775, 45.65); G.add(card);
  card.add(new T.Mesh(B(0.09, 0.008, 0.06), G.std({ color: C(0x1f6fd1), emissive: C(0x0a3a80), emissiveIntensity: 0.6 }))); G.cardMesh = card;
  add(new T.Mesh(G.merge([[B(0.44, 0.05, 0.44), M4(0, 0.46, 0)], [B(0.04, 0.4, 0.44), M4(-0.22, 0.72, 0)], [B(0.06, 0.46, 0.06), M4(0, 0.23, 0)]]), MAT.plastic)).position.set(-7.05, 0, 45.2);
  const ol = new T.PointLight(C(0xdfe8ff), 0.7, 12, 1.5); ol.position.set(-5.5, 3.0, 44.5); G.add(ol);

  // ====================== STORAGE ======================
  const crateMats = [0xa07a4a, 0x8c6a3e, 0x6e7a5a].map((c) => G.std({ color: C(c), roughness: 0.9 }));
  for (const zc of [-41.2, -30.8]) for (let x = -62.5; x <= -52; x += 2.6) {
    for (const y of [0.1, 0.95, 1.8]) { G.box({ x, z: zc, y, w: 2.4, d: 1.0, h: 0.05, mat: MAT.darkSteel, collide: false }); for (let k = 0; k < 3; k++) if (G.rand() < 0.75) G.box({ x: x - 0.8 + k * 0.8, z: zc, y: y + 0.05, w: 0.7, d: 0.8, h: G.rr(0.35, 0.7), mat: crateMats[k], collide: false }); }
    G.addCollider(x - 1.2, zc - 0.5, x + 1.2, zc + 0.5, 0, 2.7, { los: false });
  }
  G.box({ x: -63.0, z: -36, w: 1.1, d: 2.6, h: 0.9, mat: MAT.wood });
  const cutter = new T.Group(); cutter.position.set(-62.8, 0.93, -36); G.add(cutter);
  const hand = G.std({ color: C(0xd12a20), roughness: 0.5 });
  for (const s of [-1, 1]) { const h = new T.Mesh(B(0.04, 0.03, 0.42), hand); h.position.set(s * 0.04, 0, 0.1); h.rotation.y = -s * 0.12; cutter.add(h); }
  const jaw = new T.Mesh(B(0.07, 0.04, 0.16), MAT.steel); jaw.position.set(0, 0, -0.17); cutter.add(jaw); G.cutterMesh = cutter;
  const kl = new T.PointLight(C(0xffd8a0), 0.55, 14, 1.4); kl.position.set(-57, 4, -36); G.add(kl);

  // ====================== DARK ROOM: chair + iron cages ======================
  add(new T.Mesh(G.merge([[B(0.46, 0.05, 0.44), M4(0, 0.46, 0)], [B(0.44, 0.4, 0.04), M4(0.22, 0.75, 0, Math.PI / 2)], [B(0.03, 0.46, 0.03), M4(-0.2, 0.23, -0.2)], [B(0.03, 0.46, 0.03), M4(0.2, 0.23, -0.2)], [B(0.03, 0.46, 0.03), M4(-0.2, 0.23, 0.2)], [B(0.03, 0.46, 0.03), M4(0.2, 0.23, 0.2)]]), MAT.steel)).position.set(34.2, 0, -38);
  G.cage = function (x, z, w, d, h) { // reusable iron cage (bars + top), returns its group
    const parts = [];
    for (let i = 0; i <= Math.round(w / 0.18); i++) { const px = x - w / 2 + i * (w / Math.round(w / 0.18)); parts.push([B(0.025, h, 0.025), M4(px, h / 2, z - d / 2)]); parts.push([B(0.025, h, 0.025), M4(px, h / 2, z + d / 2)]); }
    for (let i = 0; i <= Math.round(d / 0.18); i++) { const pz = z - d / 2 + i * (d / Math.round(d / 0.18)); parts.push([B(0.025, h, 0.025), M4(x - w / 2, h / 2, pz)]); parts.push([B(0.025, h, 0.025), M4(x + w / 2, h / 2, pz)]); }
    for (const y of [0.05, h]) { parts.push([B(w, 0.04, 0.04), M4(x, y, z - d / 2)]); parts.push([B(w, 0.04, 0.04), M4(x, y, z + d / 2)]); parts.push([B(0.04, 0.04, d), M4(x - w / 2, y, z)]); parts.push([B(0.04, 0.04, d), M4(x + w / 2, y, z)]); }
    parts.push([B(w, 0.02, d), M4(x, h, z)]);
    const m = new T.Mesh(G.merge(parts), MAT.rust); m.castShadow = true; G.add(m);
    G.addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, { los: false });
    return m;
  };
  G.cage(36.6, -40.6, 1.6, 1.4, 1.3); G.cage(36.6, -35.6, 1.6, 1.4, 1.3);
  const links = []; for (let i = 0; i < 26; i++) { const f = i / 25; links.push(M4(G.lerp(34.4, 37.8, f), 0.04, -38 + Math.sin(f * 3) * 0.5, f * 6 + (i % 2) * 1.57, Math.PI / 2)); }
  inst(new T.TorusGeometry(0.05, 0.014, 4, 8), MAT.chain, links);
  for (const [x, z, s, r] of [[34.4, -37.6, 1.6, 0], [32.6, -39.2, 1.1, 1], [35.6, -36.4, 0.8, 2], [31.4, -38.1, 0.6, 3]]) { const b = add(new T.Mesh(new T.PlaneGeometry(s, s), MAT.blood)); b.rotation.x = -Math.PI / 2; b.rotation.z = r; b.position.set(x, 0.045, z); }
  add(new T.Mesh(new T.SphereGeometry(0.07, 8, 6), MAT.bulb)).position.set(34, 2.75, -38);
  const pL = new T.PointLight(C(0xffb070), 0.9, 10, 1.6); pL.position.set(34, 2.6, -38); G.add(pL);
  G.tickers.push((dt, t) => { const f = (Math.sin(t * 23) + Math.sin(t * 7.3)) > 1.4 ? 0.15 : 0.9; pL.intensity = f; MAT.bulb.emissiveIntensity = f * 2.2; });

  // ====================== YARD PROPS ======================
  const suv = (x, z, ry) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.add(g);
    const car = G.suvModel({ color: 0x111316 }); car.rotation.y = Math.PI / 2; g.add(car); // (the model points along +z; this one along +x)

    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hw = 2.3 * c + 0.95 * s, hd = 2.3 * s + 0.95 * c;
    G.addCollider(x - hw, z - hd, x + hw, z + hd, 0, 2, { los: false });
  };
  suv(22, 46, 0.15); suv(49, -6, Math.PI / 2 + 0.05);
  G.box({ x: 28.5, z: -20, w: 1.6, d: 3.2, h: 1.8, mat: G.std({ color: C(0x5f6b3a), roughness: 0.6, metalness: 0.4 }) });
  for (let i = 0; i < 5; i++) { const d = add(new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.9, 14), G.std({ color: C(i % 2 ? 0x2c5ea8 : 0x9c2a1e), roughness: 0.5 }))); d.position.set(28.4 + (i % 3) * 0.66, 0.45, -24.5 - ((i / 3) | 0) * 0.66); d.castShadow = true; }
  G.addCollider(28.0, -25.6, 30.1, -24, 0, 0.9, { los: false });
  const trash = []; for (let i = 0; i < 9; i++) trash.push(M4(-33 + G.rr(-1.6, 1.6), 0.25, 28 + G.rr(-1, 1), G.rand() * 3, 0, 0, G.rr(0.4, 0.6), G.rr(0.35, 0.5), G.rr(0.4, 0.6)));
  inst(new T.SphereGeometry(1, 8, 6), G.std({ color: C(0x151515), roughness: 0.3 }), trash, { cast: true });
  const palm = (x, z, hgt) => {
    if (G.palmTree) { G.palmTree(x, z, hgt); G.addCollider(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0, hgt, { los: false }); return; }
    const parts = [], leaves = []; let px = 0, pz = 0; const lean = G.rr(0, 6.28), lx = Math.cos(lean), lz = Math.sin(lean);
    for (let i = 0; i < 6; i++) { parts.push([new T.CylinderGeometry(0.16, 0.2, hgt / 6 + 0.05, 7), M4(x + px, i * hgt / 6 + hgt / 12, z + pz)]); px += lx * i * 0.03; pz += lz * i * 0.03; }
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + G.rr(-0.2, 0.2), droop = G.rr(0.3, 0.7); leaves.push([B(2.9, 0.04, 0.5), M4(x + px + Math.cos(a) * 1.3, hgt - Math.sin(droop) * 1.3, z + pz - Math.sin(a) * 1.3, a, 0, -droop)]); }
    add(new T.Mesh(G.merge(parts), MAT.trunk)).castShadow = true; add(new T.Mesh(G.merge(leaves), MAT.leaf)).castShadow = true;
    G.addCollider(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0, hgt, { los: false });
  };
  [[-25, 30, 7], [20, 30, 8], [-62, 46, 7.5], [50, 46, 6.5], [-12, -8, 7], [-63, -6, 6.5], [-28, 50, 6], [75, -40, 8], [75, 40, 7]].forEach(([x, z, h]) => palm(x, z, h));
};
})(window.G);
