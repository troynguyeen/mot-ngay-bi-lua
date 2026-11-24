// levels/prologue.js — four small sets for the intro: Nam's rented room, the 16-seat van, the fake office, the holding room
(function (G) {
'use strict';
const T = G.T, C = G.C, MAT = G.MAT;
const B = (w, h, d) => new T.BoxGeometry(w, h, d);
const std = (hex, o) => G.std(Object.assign({ color: C(hex), roughness: 0.8 }, o || {}));
const mesh = (geo, mat, x, y, z, ry) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };
// closed room: floor, 4 walls (with optional door gap on +x wall), ceiling
function room(cx, cz, w, d, h, wallMat, floorMat, door) {
  G.slab(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, floorMat, 0.02, 2.4);
  G.box({ x: cx, z: cz - d / 2, w: w + 0.3, d: 0.15, h, mat: wallMat, S: 3 });
  G.box({ x: cx, z: cz + d / 2, w: w + 0.3, d: 0.15, h, mat: wallMat, S: 3 });
  G.box({ x: cx - w / 2, z: cz, w: 0.15, d, h, mat: wallMat, S: 3 });
  if (door) {
    const a = cz - d / 2, b = cz + d / 2, d0 = door[0], d1 = door[1];
    G.box({ x: cx + w / 2, z: (a + d0) / 2, w: 0.15, d: d0 - a, h, mat: wallMat, S: 3 });
    G.box({ x: cx + w / 2, z: (d1 + b) / 2, w: 0.15, d: b - d1, h, mat: wallMat, S: 3 });
    G.box({ x: cx + w / 2, z: (d0 + d1) / 2, y: 2.15, w: 0.15, d: d1 - d0, h: h - 2.15, mat: wallMat, S: 3, flags: { solid: false } });
  } else G.box({ x: cx + w / 2, z: cz, w: 0.15, d, h, mat: wallMat, S: 3 });
  G.box({ x: cx, z: cz, y: h, w: w + 0.3, d: d + 0.3, h: 0.12, mat: std(0xd9d4c8), S: 3, flags: { solid: false, los: false } });
}
const skylineTex = G.makeTex(512, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b1020'); gr.addColorStop(1, '#2a2438'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { const bw = G.rr(18, 50), bh = G.rr(40, 200), x = G.rand() * w; g.fillStyle = '#0a0a12'; g.fillRect(x, h - bh, bw, bh); for (let y = h - bh + 6; y < h - 4; y += 9) for (let xx = x + 3; xx < x + bw - 3; xx += 7) if (G.rand() < 0.35) { g.fillStyle = G.rand() < 0.5 ? '#ffd27a' : '#bcd6ff'; g.fillRect(xx, y, 3, 4); } }
}, { repeat: false });
const roadTex = G.makeTex(128, 512, (g, w, h) => { g.fillStyle = '#2a2a2c'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) { g.fillStyle = '#d8d0b0'; g.fillRect(w / 2 - 3, y, 6, 32); } });

G.LEVELS.prologue = { build() {
  const L = G.LOC;
  // ================= 1. Nam's rented room (centre 0,0) =================
  const paint = std(0x9fb39a, { map: G.TX.plaster }), tile = MAT.tile;
  room(0, 0, 4.4, 5, 2.8, paint, tile, [0.6, 1.6]);
  // bed + mat + pillow + blanket
  mesh(B(1.5, 0.4, 2.0), MAT.wood, -1.3, 0.2, -1.4); mesh(B(1.4, 0.08, 1.9), std(0xb9c7d6), -1.3, 0.44, -1.4);
  mesh(B(0.6, 0.12, 0.35), std(0xe9e4da), -1.3, 0.54, -2.15); mesh(B(1.3, 0.1, 0.9), std(0x7a4a5a), -1.3, 0.53, -0.9);
  G.addCollider(-2.05, -2.4, -0.55, -0.4, 0, 0.6, { los: false });
  // desk, laptop, bills, stool, fan, wardrobe, calendar
  mesh(B(1.2, 0.05, 0.6), MAT.wood, 1.4, 0.75, -2.1); for (const x of [0.86, 1.94]) for (const z of [-2.35, -1.85]) mesh(B(0.04, 0.75, 0.04), MAT.darkSteel, x, 0.375, z);
  G.addCollider(0.8, -2.45, 2.0, -1.8, 0, 0.8, { los: false });
  const lapScreen = std(0x000000, { emissive: C(0x7fa8ff), emissiveIntensity: 0.9 });
  mesh(B(0.36, 0.02, 0.25), MAT.plastic, 1.3, 0.79, -2.1); const scr = mesh(B(0.36, 0.24, 0.015), lapScreen, 1.3, 0.92, -2.23); scr.rotation.x = -0.25;
  for (let i = 0; i < 5; i++) { const p = mesh(B(0.21, 0.003, 0.29), std(0xf2eee4), 1.75 + G.rr(-0.1, 0.1), 0.78 + i * 0.004, -2.0 + G.rr(-0.1, 0.1)); p.rotation.y = G.rr(-0.4, 0.4); }
  const billTex = G.signTex(['GIẤY BÁO NỢ', 'QUÁ HẠN'], { bg: '#f5f1e6', fg: '#b01818', w: 256, h: 128, grime: false });
  const bill = mesh(new T.PlaneGeometry(0.21, 0.15), G.std({ map: billTex }), 1.75, 0.8, -2.0); bill.rotation.x = -Math.PI / 2;
  mesh(new T.CylinderGeometry(0.17, 0.17, 0.45, 12), std(0x2b6cb0), 1.4, 0.225, -1.5);
  mesh(new T.CylinderGeometry(0.03, 0.03, 1.2, 6), MAT.plastic, 1.8, 0.6, 1.9); const fan = mesh(new T.CylinderGeometry(0.3, 0.3, 0.1, 16), std(0xe0e0e0), 1.8, 1.25, 1.9); fan.rotation.x = Math.PI / 2;
  mesh(B(1.0, 1.9, 0.55), MAT.wood, -1.6, 0.95, 2.1); G.addCollider(-2.1, 1.8, -1.1, 2.4, 0, 1.9);
  const cal = mesh(new T.PlaneGeometry(0.4, 0.55), G.std({ map: G.signTex(['THÁNG 11', '■ ■ ■ ■', '■ ■ ■ ■'], { bg: '#f5f1e6', fg: '#a02020', w: 128, h: 176, grime: false }) }), 0.4, 1.7, -2.42);
  // window with the city at night
  const win = mesh(new T.PlaneGeometry(1.4, 1.0), G.std({ map: skylineTex, emissive: C(0xffffff), emissiveMap: skylineTex, emissiveIntensity: 0.8 }), -2.115, 1.5, 0.5, Math.PI / 2);
  for (let i = 0; i < 6; i++) mesh(B(0.02, 1.0, 0.02), MAT.steel, -2.12, 1.5, -0.15 + i * 0.26);
  const bulb = mesh(new T.SphereGeometry(0.06, 8, 6), MAT.bulb, 0, 2.6, 0); bulb.castShadow = false;
  const homeL = new T.PointLight(C(0xffc890), 0.9, 9, 1.4); homeL.position.set(0, 2.5, 0); G.add(homeL);
  const phoneGlow = new T.PointLight(C(0x9ec4ff), 0.0, 2.5, 2); phoneGlow.position.set(-1.0, 1.0, -0.6); G.add(phoneGlow);
  L.homeSeat = { x: -0.95, z: -0.9, yaw: Math.PI / 2 }; L.homeDoor = { x: 2.6, z: 1.1 };
  G.addNpc('mom', { shirt: 0x7a5a8a, pants: 0x3a3438, skin: 0xc49a76, hair: 0x2a2420, longHair: true, longSleeve: true }, { x: 2.9, z: 1.1, yaw: -Math.PI / 2 });
  G.addNpc('dad', { shirt: 0x5a6a5a, pants: 0x2a2a2a, skin: 0xb08560, hair: 0x6a6a68 }, { x: 3.4, z: 0.6, yaw: -Math.PI / 2 });

  // ================= 2. the 16-seat van (centre 60,0), driving along +z =================
  const VX = 60;
  const vanShell = std(0x9a9c9e, { side: T.DoubleSide });
  mesh(B(2.0, 0.05, 6.2), std(0x3a3a3a), VX, 0.3, 0);                 // floor
  mesh(B(2.0, 0.05, 6.2), std(0x6a6a6a), VX, 2.2, 0);                 // ceiling
  const tint = std(0x050608, { roughness: 0.05, metalness: 0.6 });
  for (const sx of [-1, 1]) { mesh(B(0.05, 1.9, 6.2), vanShell, VX + sx * 1.0, 1.25, 0); mesh(B(0.02, 0.6, 5.0), tint, VX + sx * 0.97, 1.6, -0.3); }
  mesh(B(2.0, 1.9, 0.05), vanShell, VX, 1.25, -3.1);
  const wind = mesh(B(1.9, 0.75, 0.03), std(0x111822, { emissive: C(0x223044), emissiveIntensity: 0.5, roughness: 0.05 }), VX, 1.65, 3.08);
  mesh(B(2.0, 0.6, 0.6), std(0x2a2a2a), VX, 1.0, 2.75);              // dashboard
  for (let i = 0; i < 5; i++) { const cur = mesh(B(0.04, 0.55, 0.9), std(0x4a2a2a), VX + (i % 2 ? 0.96 : -0.96), 1.62, 1.6 - i * 1.0); }
  const seatMat = std(0x30343c);
  const SEATS = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const x = VX - 0.62 + c * 0.62, z = 1.2 - r * 1.05; mesh(B(0.5, 0.12, 0.5), seatMat, x, 0.72, z); mesh(B(0.5, 0.42, 0.1), seatMat, x, 0.97, z - 0.27); SEATS.push({ x, z }); }
  mesh(B(0.5, 0.12, 0.5), seatMat, VX - 0.55, 0.72, 2.25); mesh(B(0.5, 0.12, 0.5), seatMat, VX + 0.55, 0.72, 2.25);
  const domeL = new T.PointLight(C(0xff8a5a), 0.55, 6, 1.5); domeL.position.set(VX, 2.1, 0); G.add(domeL);
  // road outside, scrolling
  const road = new T.Mesh(new T.PlaneGeometry(10, 120), G.std({ map: roadTex, roughness: 0.9 })); road.rotation.x = -Math.PI / 2; road.position.set(VX, 0, 40); G.add(road);
  roadTex.wrapT = T.RepeatWrapping; roadTex.repeat.set(1, 6);
  const lampMat = new T.MeshBasicMaterial({ color: C(0xffd090) });
  const lamps = []; for (let i = 0; i < 8; i++) { const l = mesh(new T.SphereGeometry(0.25, 8, 6), lampMat, VX + (i % 2 ? 5 : -5), 6, 10 + i * 14); l.castShadow = false; lamps.push(l); }
  G.tickers.push((dt) => { if (!G.vanMoving) return; roadTex.offset.y -= dt * 2.2; lamps.forEach((l) => { l.position.z -= dt * 18; if (l.position.z < 4) l.position.z += 112; }); });
  L.vanSeat = { x: VX + 0.62, z: -0.9 + 0.05 };   // window seat, third row
  G.addNpc('driver', { shirt: 0x2a2a2a, pants: 0x1a1a1a, skin: 0xb5835e, cap: 0x111111 }, { x: VX - 0.55, z: 2.25, yaw: 0, pose: 'sit' });
  G.addNpc('tattoo', { shirt: 0x111111, pants: 0x2a2a2a, skin: 0xa8754f, bald: true, tattoo: true, glasses: true, sleeveless: true }, { x: VX + 0.55, z: 2.25, yaw: Math.PI, pose: 'talk' });
  const pp = new T.Group(); pp.position.set(VX + 0.35, 1.05, 1.95); G.add(pp);
  for (let i = 0; i < 6; i++) { const b = new T.Mesh(B(0.1, 0.012, 0.14), std(i % 2 ? 0x7a1a1a : 0x1a3a7a)); b.position.y = i * 0.013; b.rotation.y = G.rr(-0.2, 0.2); pp.add(b); }
  [[0, 0], [2, 1], [4, 1], [7, 2], [9, 3]].forEach(([si, k], i) => {
    const s = SEATS[si]; G.addNpc('pax' + i, { shirt: [0x6a8a9a, 0xb07a5a, 0x5a5a8a, 0x8a6a4a, 0x4a7a5a][i], pants: 0x2a2a30, skin: [0xc79a74, 0xb5835e, 0xd6a985, 0xa8754f, 0xc49a76][i], longHair: i % 2 === 1 }, { x: s.x, z: s.z, yaw: 0, pose: 'sit' });
  });
  L.vanHot = [ // things Nam can notice
    { x: VX - 0.97, y: 1.6, z: -0.3, text: 'Cửa sổ dán phim đen kín mít, kéo cả rèm. Không nhìn ra ngoài được.' },
    { x: VX + 0.35, y: 1.1, z: 1.95, text: 'Gã ngồi ghế trước giữ một xấp hộ chiếu. Hình như của những người trên xe.' },
    { x: VX - 0.62, y: 1.2, z: 1.2, text: 'Mấy người cùng xe đều trẻ, ai cũng im lặng, ôm chặt balo.' },
    { x: VX, y: 1.65, z: 3.0, text: 'Biển chỉ đường vừa lướt qua: "TÂY NINH 40km". Văn phòng ở trung tâm thành phố cơ mà?' },
  ];

  // ================= 3. the "representative office" (centre 120,0) =================
  const OX = 120;
  room(OX, 0, 9, 7, 3.0, std(0xe9e6df, { map: G.TX.plaster }), std(0xcfc8bb, { roughness: 0.3 }), [-0.8, 1.0]);
  const logo = mesh(new T.PlaneGeometry(3.6, 1.0), G.std({ map: G.signTex(['NHÂN LỰC TOÀN CẦU', 'Kết nối việc làm quốc tế'], { bg: '#123a6a', fg: '#ffffff', w: 768, h: 210, grime: false }) }), OX - 4.42, 1.9, 0, Math.PI / 2);
  mesh(B(0.8, 1.05, 2.4), std(0xf2efe8), OX - 2.6, 0.525, 0); G.addCollider(OX - 3.0, -1.2, OX - 2.2, 1.2, 0, 1.05);
  mesh(B(2.2, 0.45, 0.85), std(0x3a4a5a), OX + 1.5, 0.225, -2.8); mesh(B(2.2, 0.5, 0.2), std(0x3a4a5a), OX + 1.5, 0.6, -3.15); G.addCollider(OX + 0.4, -3.3, OX + 2.6, -2.35, 0, 0.6, { los: false });
  mesh(B(0.9, 0.42, 0.55), MAT.wood, OX + 1.5, 0.21, -1.6);
  const glass = mesh(new T.CylinderGeometry(0.035, 0.03, 0.1, 10), G.std({ color: C(0xcfe6ff), transparent: true, opacity: 0.55, roughness: 0.05 }), OX + 1.6, 0.47, -1.55); glass.castShadow = false;
  G.officeGlass = glass;
  mesh(new T.CylinderGeometry(0.2, 0.25, 0.5, 10), std(0x8a6a4a), OX + 3.9, 0.25, 3.0); mesh(new T.SphereGeometry(0.55, 10, 8), std(0x3a6a3a), OX + 3.9, 0.95, 3.0);
  mesh(B(0.35, 1.1, 0.35), std(0xeeeeee), OX - 3.9, 0.55, 3.0);
  for (const [x, z] of [[OX - 1, -1], [OX + 2, 1.5]]) { const L2 = new T.PointLight(C(0xf2f6ff), 0.75, 12, 1.3); L2.position.set(x, 2.8, z); G.add(L2); }
  L.officeDoor = { x: OX + 5.6, z: 0.1 }; L.officeSofa = { x: OX + 1.5, z: -2.75, yaw: 0 }; L.officeSofaStand = { x: OX + 1.5, z: -1.9 };
  G.addNpc('recep', { shirt: 0xf0f0f0, pants: 0x1a1a2a, skin: 0xe0b48e, hair: 0x1a1210, longHair: true, longSleeve: true }, { x: OX - 2.6, z: 0.9, yaw: Math.PI / 2 });
  G.addNpc('suit', { shirt: 0x1d2433, pants: 0x1d2433, skin: 0xc89a70, hair: 0x0e0b09, longSleeve: true, glasses: true }, { x: OX - 3.4, z: -2.2, yaw: Math.PI / 2, pose: 'phone' });

  // ================= 4. holding room in Sihanoukville (centre 180,0) =================
  const HX = 180;
  room(HX, 0, 10, 7, 3.2, MAT.concreteDark, MAT.concrete, null);
  const bars = mesh(B(0.05, 0.6, 1.2), MAT.black, HX + 4.92, 2.3, 0); const winGlow = mesh(new T.PlaneGeometry(1.2, 0.6), new T.MeshBasicMaterial({ color: C(0x1a2030) }), HX + 4.9, 2.3, 0, -Math.PI / 2);
  for (let i = 0; i < 5; i++) mesh(B(0.04, 0.62, 0.04), MAT.steel, HX + 4.9, 2.3, -0.48 + i * 0.24);
  const hb = mesh(new T.SphereGeometry(0.06, 8, 6), MAT.bulb, HX, 3.0, 0); hb.castShadow = false;
  const holdL = new T.PointLight(C(0xffb070), 0.95, 12, 1.4); holdL.position.set(HX, 2.9, 0); G.add(holdL);
  G.tickers.push((dt, t) => { if (G.levelName !== 'prologue') return; holdL.intensity = (Math.sin(t * 19) + Math.sin(t * 5.3)) > 1.5 ? 0.25 : 0.95; });
  for (const [x, z, s] of [[HX - 1, 1.5, 1.4], [HX + 2, -0.5, 0.9], [HX - 3, -1.8, 0.7]]) { const b = mesh(new T.PlaneGeometry(s, s), MAT.blood, x, 0.03, z); b.rotation.x = -Math.PI / 2; b.castShadow = false; }
  const sl = mesh(G.boxGeo(9, 0.02, 0.1, 2), std(0x3a2a2a), HX, 0.03, -3.2);
  // victims sit along the back wall; Nam is the 4th from the left
  L.holdRow = []; for (let i = 0; i < 6; i++) L.holdRow.push({ x: HX - 3.5 + i * 1.3, z: -2.6 });
  L.holdNam = L.holdRow[3];
  const looks = [[0x6a8a9a, 0xc79a74], [0xb07a5a, 0xb5835e], [0x5a5a8a, 0xd6a985], [0, 0], [0x8a6a4a, 0xa8754f], [0x4a7a5a, 0xc49a76]];
  L.holdRow.forEach((p, i) => { if (i === 3) return; G.addNpc('v' + i, { shirt: looks[i][0], pants: 0x2a2a30, skin: looks[i][1], longHair: i === 2, bruises: i === 4 }, { x: p.x, z: p.z, yaw: 0, pose: 'floor' }); });
  G.addNpc('g1', { shirt: 0x1d1f22, pants: 0x1b1d22, skin: 0xa8754f, cap: 0x111111, stun: true }, { x: HX + 1.5, z: 1.8, yaw: Math.PI });
  G.addNpc('g2', { shirt: 0x1d1f22, pants: 0x1b1d22, skin: 0xb88760, bald: true, tattoo: true, sleeveless: true }, { x: HX - 2.5, z: 2.2, yaw: Math.PI });
  // spark sprite for the stun baton
  const spark = new T.Sprite(new T.SpriteMaterial({ map: G.TX.glow, color: C(0x8fc8ff), blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  spark.scale.set(0.9, 0.9, 1); spark.visible = false; G.add(spark); G.spark = spark;
  const zapL = new T.PointLight(C(0x7ab8ff), 0, 6, 2); G.add(zapL); G.zapLight = zapL;

  return { overcast: 0, rain: 0 };
} };
})(window.G);
