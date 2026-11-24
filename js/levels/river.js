// levels/river.js — Chapter 4: from the kiln's west fence along a riverside trail to a jetty where a boat waits.
// The trail runs north (+z) for about 200 m: scrub, a fallen tree, a creek with a plank bridge, stilt huts,
// mud, beached boats, then the jetty. The river runs along the west side and on downstream for the boat ride.
(function (G) {
'use strict';
const T = G.T, C = G.C, MAT = G.MAT, M4 = G.M4;
const B = (w, h, d) => new T.BoxGeometry(w, h, d);
const V2 = (x, z) => ({ x, z });
const std = (hex, o) => G.std(Object.assign({ color: C(hex), roughness: 0.85 }, o || {}));
const mesh = (geo, mat, x, y, z, ry) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };

// the trail (also what the chasers and the freed prisoners follow); it bends round the fallen tree at z 30
const PATH = [[0, 2], [3, 14], [6.4, 26], [6.6, 34], [0, 44], [-8, 56], [-10, 69], [-8, 82], [-2, 96], [2, 110], [-6, 128], [-17, 145], [-26, 161], [-33, 175], [-37.5, 186], [-41.5, 192.2], [-54.5, 192.2]];
const BANK = -41.5;
G.LEVELS.river = { build() {
  const L = G.LOC;
  L.path = PATH; L.bank = BANK;
  G.slab(-300, -300, 300, 300, MAT.grass, 0.001, 8);
  // river: west of the bank, and far downstream for the boat ride; a muddy strip along the edge
  G.slab(-330, -120, BANK, 760, MAT.water, 0.05, 12);
  G.slab(BANK - 2.5, -120, BANK + 3.5, 760, MAT.mud, 0.03, 6);
  G.slab(-420, -120, -330, 760, MAT.grass, 0.02, 8); // far bank
  const water = { los: false, cam: false };
  G.addCollider(-330, -120, BANK, 190.8, 0, 2.5, water); G.addCollider(-330, 193.6, BANK, 760, 0, 2.5, water); G.addCollider(-330, 190.8, -56.3, 193.6, 0, 2.5, water);

  // ---------------- the kiln's west fence (z = 0) and a glimpse of the yard behind it ----------------
  const fence = (x0, x1) => G.box({ x: (x0 + x1) / 2, z: 0, w: x1 - x0, d: 0.16, h: 3.2, mat: MAT.rust, S: 3 });
  fence(BANK, 14); fence(20, 46); G.addCollider(45.8, -40, 46.2, 0, 0, 3.2);
  const wire = []; for (let x = BANK; x < 46; x += 0.5) wire.push(M4(x, 3.35, 0, 0, 0, Math.PI / 2));
  G.inst(new T.TorusGeometry(0.2, 0.012, 4, 8), MAT.chain, wire);
  for (const [x, ry] of [[14, -1.2], [20, 1.2]]) { const leaf = new T.Group(); leaf.position.set(x, 0, 0); leaf.rotation.y = ry; G.add(leaf); const m = new T.Mesh(G.boxGeo(3, 3, 0.1, 3), MAT.metal); m.position.set(x < 17 ? 1.5 : -1.5, 1.5, 0); m.castShadow = true; leaf.add(m); }
  L.gate = V2(17, 0);
  // brick pile Nam climbed on (inside), and the yard: chimney, stacks, a dead floodlight, a burning oil drum at the gate
  G.box({ x: 0, z: -1.0, w: 1.4, d: 1.0, h: 1.0, mat: MAT.brick, S: 2 });
  mesh(G.uvScale(new T.CylinderGeometry(1.4, 1.9, 34, 24), 6, 8), MAT.brick, -8, 17, -46);
  for (let i = 0; i < 7; i++) G.box({ x: -30 + i * 9, z: -14 - (i % 2) * 7, w: 3, d: 1.4, h: 2, mat: MAT.brick, S: 2 });
  mesh(new T.CylinderGeometry(0.1, 0.14, 7, 10), MAT.steel, 8, 3.5, -10); mesh(B(0.9, 0.25, 0.5), MAT.darkSteel, 8, 7, -10);
  mesh(new T.CylinderGeometry(0.32, 0.3, 0.9, 14), MAT.rust, 22.5, 0.45, -1.5);
  G.fire(22.5, -1.5, 0.5, 0.9);

  // the edges of the playable strip (unseen, stones and sight pass through)
  const edge = { los: false, cam: false };
  G.addCollider(45.8, 0, 46.4, 206, 0, 3, edge); G.addCollider(BANK, 205.4, 46.4, 206, 0, 3, edge); G.addCollider(BANK, -24.6, 46.4, -24, 0, 3, edge);

  // ---------------- the trail ----------------
  const dirt = std(0xffffff, { map: G.TX.dirt, roughness: 1 });
  { // one smooth ribbon through the way-points
    const curve = new T.CatmullRomCurve3([[0, 0.3]].concat(PATH.slice(0, -1)).map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
    const N = 220, pos = [], uv = [], idx = [], len = curve.getLength();
    for (let i = 0; i <= N; i++) {
      const p = curve.getPointAt(i / N), d = curve.getTangentAt(i / N), w = 1.65 + Math.sin(i * 0.43) * 0.2, n = Math.hypot(d.x, d.z) || 1, lx = d.z / n * w, lz = -d.x / n * w;
      pos.push(p.x + lx, 0.014, p.z + lz, p.x - lx, 0.014, p.z - lz); uv.push(0, len * i / N / 4, 0.85, len * i / N / 4);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, dirt); m.receiveShadow = true; G.add(m);
  }
  // fallen tree across the old way (the trail bends round it)
  const log = mesh(G.uvScale(new T.CylinderGeometry(0.42, 0.5, 11, 14), 3, 1), MAT.trunk, -1.6, 0.42, 30); log.rotation.z = Math.PI / 2; log.rotation.y = 0.06;
  G.addCollider(-7.2, 29.4, 3.9, 30.6, 0, 0.9);
  // mud on the trail (slow): go through or round
  for (const [x, z, w, d] of [[1.5, 45, 7, 6], [-5, 124, 8, 7]]) { G.slab(x - w / 2, z - d / 2, x + w / 2, z + d / 2, MAT.mud, 0.02, 3); G.slowZones.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, k: 0.62 }); }
  // creek from the east into the river; a plank bridge where the trail crosses, wading anywhere else is slow
  G.slab(BANK, 67, 70, 71, MAT.water, 0.04, 6);
  G.slowZones.push({ x0: BANK, z0: 67, x1: -12.6, z1: 71, k: 0.42 }, { x0: -7.4, z0: 67, x1: 70, z1: 71, k: 0.42 });
  G.box({ x: -10, z: 69, w: 5, d: 5.4, h: 0.1, y: 0.02, mat: MAT.planks, S: 2, collide: false });
  for (const sx of [-2.4, 2.4]) { G.box({ x: -10 + sx, z: 69, w: 0.08, d: 5.4, h: 0.06, y: 0.9, mat: MAT.wood, collide: false }); for (const sz of [-2.5, 0, 2.5]) G.box({ x: -10 + sx, z: 69 + sz, w: 0.1, d: 0.1, h: 0.95, mat: MAT.wood, collide: false }); }

  // ---------------- stilt huts, a woodpile, nets, boats pulled up on the bank ----------------
  const thatch = std(0x7a6a3a, { map: G.TX.bamboo });
  const hut = (x0, z0, x1, z1, label) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    for (const x of [x0 + 0.2, x1 - 0.2]) for (const z of [z0 + 0.2, z1 - 0.2]) G.box({ x, z, w: 0.2, d: 0.2, h: 1.2, mat: MAT.wood, collide: false });
    G.box({ x: cx, z: cz, y: 1.2, w, d, h: 0.15, mat: MAT.planks, S: 2, collide: false });
    G.box({ x: cx, z: cz, y: 1.35, w: w - 0.2, d: d - 0.2, h: 2.1, mat: MAT.planks, S: 2, collide: false });
    const roof = mesh(G.boxGeo(w + 1.4, 0.18, d * 0.62, 3), thatch, cx, 3.9, cz - d * 0.27); roof.rotation.x = 0.55;
    const roof2 = mesh(G.boxGeo(w + 1.4, 0.18, d * 0.62, 3), thatch, cx, 3.9, cz + d * 0.27); roof2.rotation.x = -0.55;
    G.addCollider(x0, z0, x1, z1, 0, 4.2);
    G.buildings.push({ name: label, label, x0, z0, x1, z1, h: 4.2 });
  };
  hut(9, 86, 15, 93, 'Nhà sàn'); hut(-27, 105, -20, 112, 'Nhà sàn'); hut(14, 140, 20, 147, 'Nhà sàn');
  const lamp = new T.PointLight(C(0xffb060), 0.9, 12, 1.6); lamp.position.set(8.4, 2.2, 89.5); G.add(lamp);
  mesh(new T.SphereGeometry(0.12, 10, 8), new T.MeshBasicMaterial({ color: new T.Color(0xffc070).multiplyScalar(3) }), 8.6, 2.2, 89.5);
  G.box({ x: 6, z: 101, w: 3.4, d: 1.3, h: 1.1, mat: MAT.wood, S: 1 });
  const net = mesh(new T.PlaneGeometry(5, 1.8), MAT.net, -31, 1.3, 138, Math.PI / 2.2); net.castShadow = false;
  for (const z of [135.6, 140.4]) mesh(new T.CylinderGeometry(0.05, 0.06, 2.3, 6), MAT.wood, -31 + (z - 138) * 0.22, 1.15, z);
  for (const [x, z, ry] of [[-38.5, 152, 0.4], [-39, 168, -0.3]]) {
    const b = G.boatModel({ len: 7, beam: 1.6, cabin: false, color: 0x4a3a2a, stripe: 0x6a2a20 }); b.position.set(x, -0.35, z); b.rotation.set(0, Math.PI / 2 + ry, 0.12); G.add(b);
    G.addCollider(x - 1.6, z - 3.2, x + 1.6, z + 3.2, 0, 1.0);
  }
  // ---------------- jetty + the boat that waits ----------------
  G.box({ x: (BANK - 56.3) / 2, z: 192.2, w: BANK + 56.3, d: 2.8, h: 0.08, y: 0.04, mat: MAT.planks, S: 2, collide: false });
  for (let x = BANK - 1; x > -56.5; x -= 2.4) for (const z of [190.9, 193.5]) mesh(new T.CylinderGeometry(0.1, 0.1, 1.2, 8), MAT.wood, x, 0.1, z);
  const post = mesh(new T.CylinderGeometry(0.06, 0.08, 3.2, 8), MAT.wood, BANK - 0.5, 1.6, 194); post.castShadow = true;
  mesh(new T.SphereGeometry(0.16, 10, 8), new T.MeshBasicMaterial({ color: new T.Color(0xffd28a).multiplyScalar(3) }), BANK - 0.5, 3.25, 194);
  const jl = new T.PointLight(C(0xffc070), 1.0, 16, 1.5); jl.position.set(BANK - 0.5, 3.1, 194); G.add(jl);
  L.dockEnd = V2(-54.5, 192.2); L.dockStart = V2(BANK + 0.5, 192.2);
  const boat = G.boatModel({ len: 13, beam: 2.8, color: 0x5e4630, stripe: 0x2e6fa0, awning: true, flag: null });
  boat.position.set(-57.9, -0.55, 188.6); boat.rotation.y = -Math.PI / 2; G.add(boat); L.boat = boat;
  // the police boats (come up the river at the end)
  L.police = [0, 1].map((i) => { const pb = G.boatModel({ len: 11, beam: 2.6, police: true, label: i ? 'CẢNH SÁT' : 'POLICE', flag: i ? 'vn' : 'kh' }); pb.position.set(-110 + i * 16, -0.5, 700); pb.rotation.y = Math.PI / 2; pb.visible = false; G.add(pb); return pb; });
  G.tickers.push((dt, t) => {
    for (const pb of L.police) { if (!pb.visible) continue; const b = pb.userData.bar, on = (t * 3) % 2 < 1; b.red.visible = on; b.blue.visible = !on; b.pl.color.set(on ? 0xff2020 : 0x2050ff); b.pl.intensity = 1.6; if (pb.userData.flag) pb.userData.flag.userData.wave(t); }
  });

  // ---------------- vegetation: jungle on both sides of the trail, palms and bananas near the huts ----------------
  const trees = [], bushes = []; let s = 4242; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const trailX = (z) => { for (let i = 0; i < PATH.length - 2; i++) { const a = PATH[i], b = PATH[i + 1]; if (z >= a[1] && z <= b[1]) return a[0] + (b[0] - a[0]) * (z - a[1]) / Math.max(0.01, b[1] - a[1]); } return 0; };
  L.trailX = trailX;
  for (let i = 0; i < 1100; i++) {
    const x = BANK + 4 + r() * 200, z = -20 + r() * 260;
    if (z > -6 && z < 4) continue; if (z < 0 && x > BANK && x < 46) continue; // the fence line and the yard
    if (Math.abs(x - trailX(G.clamp(z, 2, 186))) < 9 + r() * 6) continue;
    if (z > 66 && z < 72) continue;
    if (z < 20 && x > 4 && x < 30) continue; // open ground outside the gate (the alarm shot looks through it)
    const sc = 0.8 + r() * 0.8; trees.push([x, z, sc, (6 + r() * 7) * sc]);
    if (r() < 0.55) bushes.push([x + (r() - 0.5) * 5, z + (r() - 0.5) * 5, 1 + r() * 0.8]);
  }
  for (let i = 0; i < 260; i++) { const x = -430 + r() * 90, z = -100 + r() * 840; trees.push([x, z, 1 + r() * 0.6, 9 + r() * 6]); }
  if (G.forest) G.forest(trees, bushes, { nearR: 70 });
  if (G.grassField) {
    let gs = 777; const gr = () => { gs = (gs * 16807) % 2147483647; return gs / 2147483647; };
    G.grassField(2600, () => { const z = 4 + gr() * 182, x = trailX(z) + (gr() < 0.5 ? -1 : 1) * (2 + gr() * 9); return x < BANK + 1 || (z > 66 && z < 72) ? null : [x, z, 0.6 + gr() * 0.8]; });
  }
  if (G.palmTree) for (const [x, z, h] of [[5, 84, 9], [17, 95, 10], [-30, 103, 8.5], [-18, 115, 9.5], [22, 138, 10], [-35, 182, 9]]) G.palmTree(x, z, h);
  const bananaLeaf = std(0x4a7a2a, { side: T.DoubleSide, roughness: 0.8 });
  for (const [x, z] of [[12, 78], [-14, 98], [9, 118], [-28, 134], [-22, 170], [12, 60], [-15, 40]]) for (let k = 0; k < 3; k++) {
    const bx = x + k * 1.3, bz = z + (k % 2) * 1.1, h = 2.2 + k * 0.4; mesh(new T.CylinderGeometry(0.12, 0.16, h, 8), std(0x6a7a3a), bx, h / 2, bz);
    for (let j = 0; j < 6; j++) { const lf = new T.Mesh(new T.PlaneGeometry(0.5, 1.9), bananaLeaf); lf.position.set(bx + Math.cos(j) * 0.7, h + 0.1, bz + Math.sin(j) * 0.7); lf.rotation.set(-0.9, j * 1.05, 0); lf.castShadow = true; G.add(lf); }
  }
  return {
    bounds: { x0: -64, x1: 48, z0: -24, z1: 206 }, compound: { x0: BANK, z0: -24, x1: 46, z1: 0 },
    extra: [{ x0: -56.3, z0: 190.8, x1: BANK, z1: 193.6, label: 'Bến' }, { x0: BANK, z0: 67, x1: 48, z1: 71, label: 'Suối' }],
    guards: [], lights: [], overcast: 0.25, rain: 0, lightning: false, fogMul: 0.85, cityGlow: 0.05,
  };
} };
})(window.G);
