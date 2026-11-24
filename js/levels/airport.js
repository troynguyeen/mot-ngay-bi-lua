// levels/airport.js — the flight home: runway, taxiway, apron, terminal, control tower, the plane and its stairs.
// The same airfield is dressed three ways: 'kh' (leaving Cambodia: both flags, a generic sign), 'th' (leaving Bangkok,
// the same with the Thai flag) and 'vn' (arriving at Tân Sơn Nhất: Vietnamese flags, the airport's name). No airline
// branding anywhere.
(function (G) {
'use strict';
const T = G.T, C = G.C, MAT = G.MAT, M4 = G.M4;
const B = (w, h, d) => new T.BoxGeometry(w, h, d);
const V2 = (x, z) => ({ x, z });
const std = (hex, o) => G.std(Object.assign({ color: C(hex), roughness: 0.85 }, o || {}));
const mesh = (geo, mat, x, y, z, ry) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };

G.LEVELS.airport = { build() {
  const L = G.LOC;
  G.slab(-900, -600, 900, 600, MAT.grass, 0.001, 10);
  const asphalt = std(0x55585c, { map: G.TX.concrete, roughness: 0.9 }), apron = std(0xb8b4aa, { map: G.TX.concrete, roughness: 0.9 });
  const white = new T.MeshBasicMaterial({ color: 0xe8e8e2 }), yellow = new T.MeshBasicMaterial({ color: 0xe0b020 });
  // runway along x (planes take off toward −x and land the same way), markings, edge lights
  G.slab(-820, -23, 820, 23, asphalt, 0.015, 16);
  const mk = [], yk = [];
  for (let x = -760; x < 760; x += 50) mk.push(M4(x, 0.03, 0, 0, 0, 0, 30, 1, 0.9));
  for (const z of [-21.5, 21.5]) for (let x = -800; x < 800; x += 100) mk.push(M4(x + 50, 0.03, z, 0, 0, 0, 100, 1, 0.5));
  for (const ex of [-790, 790]) for (let i = 0; i < 12; i++) mk.push(M4(ex, 0.03, -19 + i * 3.45, 0, 0, 0, 30, 1, 1.8));
  G.inst(new T.BoxGeometry(1, 0.01, 1), white, mk);
  const lightsM = []; for (let x = -800; x <= 800; x += 40) for (const z of [-24, 24]) lightsM.push(M4(x, 0.18, z));
  G.inst(new T.SphereGeometry(0.16, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(0xfff0c8).multiplyScalar(2.5) }), lightsM);
  // taxiway from the apron to the runway (yellow centre line), apron in front of the terminal
  G.slab(92, -96, 112, -23, asphalt, 0.016, 10);
  for (let z = -95; z < -24; z += 3) yk.push(M4(102, 0.03, z, 0, 0, 0, 0.3, 1, 2));
  for (let x = 0; x < 102; x += 3) yk.push(M4(x, 0.03, -118, 0, 0, 0, 2, 1, 0.3));
  G.inst(new T.BoxGeometry(1, 0.01, 1), yellow, yk);
  G.slab(-100, -152, 140, -96, apron, 0.017, 8);
  // terminal: glass front, columns, a deep roof; the name board on top
  const glass = new T.MeshPhysicalMaterial({ color: C(0x2a3a48), roughness: 0.06, metalness: 0.2, reflectivity: 0.8, emissive: C(0x1a2a36), emissiveIntensity: 0.25 });
  G.box({ x: 20, z: -168, w: 200, d: 18, h: 12, mat: std(0xd8d4cc, { map: G.TX.plaster }), S: 6 });
  const front = mesh(new T.PlaneGeometry(196, 9), glass, 20, 5.2, -158.9); front.castShadow = false;
  for (let x = -76; x <= 116; x += 8) G.box({ x, z: -158.4, w: 0.5, d: 0.5, h: 12, mat: MAT.steel, collide: false });
  G.box({ x: 20, z: -166, y: 12, w: 210, d: 26, h: 0.8, mat: std(0xeeeeea), S: 6, collide: false });
  G.buildings.push({ name: 'term', label: 'Nhà ga', x0: -80, z0: -177, x1: 120, z1: -159, h: 12 });
  const sign = mesh(new T.PlaneGeometry(44, 4.2), std(0xffffff), 20, 15.4, -153.6); sign.castShadow = false; L.sign = sign;
  G.box({ x: 20, z: -153.9, y: 13.1, w: 45, d: 0.4, h: 4.8, mat: MAT.darkSteel, collide: false });
  // control tower
  mesh(new T.CylinderGeometry(2.2, 2.8, 30, 20), std(0xd0ccc4, { map: G.TX.plaster }), 160, 15, -168);
  mesh(new T.CylinderGeometry(4.4, 3.6, 4.2, 20), glass, 160, 32, -168); mesh(new T.CylinderGeometry(4.8, 4.8, 0.6, 20), MAT.darkSteel, 160, 34.4, -168);
  G.addCollider(157.2, -170.8, 162.8, -165.2, 0, 30);
  // flags in front of the terminal
  L.flags = [-6, 6].map((dx) => { const f = G.flagPole('kh', 11); f.position.set(20 + dx, 0, -152.5); G.add(f); return f; });
  G.tickers.push((dt, t) => { for (const f of L.flags) f.userData.wave(t + f.position.x); });
  // ground equipment and the police vans that brought them
  for (const [x, z, ry] of [[-34, -132, 0.2], [-28, -138, 0.15]]) { const v = new T.Group(); v.position.set(x, 0, z); v.rotation.y = Math.PI / 2 + ry; v.add(G.vanModel({ color: 0xe8eaec, stripe: 0x1c3f8f, lights: true })); G.add(v); G.addCollider(x - 2.6, z - 1.2, x + 2.6, z + 1.2, 0, 2.2); }
  for (let i = 0; i < 4; i++) G.box({ x: -60 + i * 3.4, z: -110, w: 2.6, d: 1.6, h: 1.1, mat: std(0x3a4a5a, { metalness: 0.4 }), S: 1 });
  // the plane on the apron (nose +x), boarding stairs at the front left door
  const plane = G.planeModel({}); plane.position.set(10, 0, -118); G.add(plane); L.plane = plane;
  L.planeHome = { x: 10, z: -118 };
  const door = { x: 24.2, z: -120, y: 2.1 };   // the door's sill (plane x + 14.2, z − 2)
  const stairs = new T.Group(); stairs.position.set(door.x, 0, door.z - 0.3); G.add(stairs); L.stairs = stairs;
  const stepMat = std(0xd8dade, { metalness: 0.5, roughness: 0.4 }), SP = [];
  const n = 11, run = 5.2, rise = door.y;
  for (let i = 0; i < n; i++) SP.push([B(1.4, 0.06, run / n + 0.05), M4(0, rise * (n - i) / n - 0.03, -(i + 0.5) * run / n)]);
  SP.push([B(1.6, 0.08, 1.2), M4(0, rise, 0.25)]);
  for (const sx of [-0.75, 0.75]) { const rail = B(0.05, 0.05, Math.hypot(run, rise) + 0.4); SP.push([rail, M4(sx, rise / 2 + 1.0, -run / 2, 0, -Math.atan2(rise, run))]); for (let i = 0; i <= 4; i++) SP.push([B(0.04, 1, 0.04), M4(sx, rise * (1 - i / 4) + 0.5, -run * i / 4)]); }
  const st = new T.Mesh(G.merge(SP), stepMat); st.castShadow = true; stairs.add(st);
  const truck = new T.Mesh(B(2.2, 0.34, run + 0.6), std(0x2a5fa0, { metalness: 0.3 })); truck.position.set(0, 0.17, -run / 2 + 0.2); truck.castShadow = true; stairs.add(truck);
  G.addCollider(door.x - 1.2, door.z - 6.2, door.x + 1.2, door.z - 2.4, 0, 1.2);
  L.door = V2(door.x, door.z); L.doorY = door.y;
  L.stairsBottom = V2(door.x, door.z - 6.6); L.stairsRun = { z0: door.z - 5.9, z1: door.z - 0.6, y1: door.y };
  // the plane's body blocks walking (fuselage and engines)
  G.addCollider(-9, -120.2, 30, -115.8, 0, 5); G.addCollider(9, -125.5, 12.6, -110.5, 0, 2.2);
  L.start = V2(-24, -127.5);
  G.airportDress = function (kind) {
    const vn = kind === 'vn';
    sign.material.map = G.signTex(vn ? ['SÂN BAY QUỐC TẾ TÂN SƠN NHẤT'] : ['SÂN BAY QUỐC TẾ', 'INTERNATIONAL AIRPORT'], { bg: '#0f2f5c', fg: '#ffffff', w: 1024, h: 98, grime: false });
    sign.material.needsUpdate = true;
    L.flags[0].userData.setKind(vn ? 'vn' : kind === 'th' ? 'th' : 'kh'); L.flags[1].userData.setKind('vn');
  };
  G.airportDress('kh');
  return {
    bounds: { x0: -110, x1: 170, z0: -185, z1: 30 }, compound: { x0: -100, z0: -152, x1: 140, z1: -96 },
    extra: [{ x0: -120, z0: -23, x1: 170, z1: 23, label: 'Đường băng' }],
    guards: [], lights: [], overcast: 0.15, rain: 0, lightning: false, fogMul: 1.6, cityGlow: 0.1,
  };
} };
})(window.G);
