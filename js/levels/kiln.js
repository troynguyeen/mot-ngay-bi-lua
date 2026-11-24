// levels/kiln.js — Map 3: abandoned brick kiln by a river. Fog, chimneys, brick stacks for cover, a warehouse
// with cells, a generator that powers every light, and a back gate where the rescue team waits.
(function (G) {
'use strict';
const T = G.T, C = G.C, MAT = G.MAT, M4 = G.M4;
const B = (w, h, d) => new T.BoxGeometry(w, h, d);
const V2 = (x, z) => ({ x, z });
const std = (hex, o) => G.std(Object.assign({ color: C(hex), roughness: 0.85 }, o || {}));
const mesh = (geo, mat, x, y, z, ry) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };

G.LEVELS.kiln = { build() {
  const L = G.LOC;
  G.slab(-300, -300, 300, 300, MAT.grass, 0.001, 8); // (y 0 meant 0.02 in G.slab, which hid the compound ground under it)
  G.slab(-54, -44, 54, 44, std(0x6a4a3a, { map: G.TX.dirt }), 0.01, 6);
  G.slab(-120, -300, -60, 300, MAT.water, 0.05, 10);   // river to the west
  // corrugated fence + barbed top; main gate north (closed), back gate south (opens for the rescue)
  const fenceSeg = (x0, z0, x1, z1) => { const w = Math.max(Math.abs(x1 - x0), 0.2), d = Math.max(Math.abs(z1 - z0), 0.2); G.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w, d, h: 4, mat: MAT.rust, S: 3 }); };
  fenceSeg(-52, -42, -4, -42); fenceSeg(4, -42, 52, -42); fenceSeg(-52, 42, -4, 42); fenceSeg(4, 42, 52, 42); fenceSeg(-52, -42, -52, 42); fenceSeg(52, -42, 52, 42);
  G.box({ x: 0, z: -42, w: 8, d: 0.25, h: 4, mat: MAT.metal, S: 3 });
  G.doors.back = G.rollDoor(0, 42, 8, 4, 'x');
  const sign = mesh(new T.PlaneGeometry(3, 0.8), std(0xffffff, { map: G.signTex(['CẤM VÀO'], { bg: '#7d1014', w: 384, h: 100 }) }), 0, 3.2, -41.8);

  // ---------------- the kiln: long brick tunnel + two tall chimneys ----------------
  const KX0 = -30, KX1 = 10, KZ0 = -10, KZ1 = 6;
  G.box({ x: (KX0 + KX1) / 2, z: KZ0, w: KX1 - KX0, d: 0.6, h: 5, mat: MAT.brick, S: 4 });
  for (let x = KX0; x < KX1; x += 8) G.box({ x: x + 2.5, z: KZ1, w: 5, d: 0.6, h: 5, mat: MAT.brick, S: 4 });   // arched openings between
  G.box({ x: KX0, z: (KZ0 + KZ1) / 2, w: 0.6, d: KZ1 - KZ0, h: 5, mat: MAT.brick, S: 4 }); G.box({ x: KX1, z: (KZ0 + KZ1) / 2, w: 0.6, d: KZ1 - KZ0, h: 5, mat: MAT.brick, S: 4 });
  const vault = mesh(G.uvScale(new T.CylinderGeometry(8.6, 8.6, KX1 - KX0, 36, 1, false, 0, Math.PI), 2.4, (KX1 - KX0) / 4), MAT.brick, (KX0 + KX1) / 2, 4.2, (KZ0 + KZ1) / 2); vault.rotation.z = Math.PI / 2; vault.scale.set(1, 1, 0.35);
  G.addCollider(KX0, KZ0, KX1, KZ1, 5, 8.5, { solid: false, los: false });
  G.slab(KX0, KZ0, KX1, KZ1, std(0x2a1a14), 0.03);
  G.buildings.push({ name: 'kiln', label: 'Lò nung', x0: KX0, z0: KZ0, x1: KX1, z1: KZ1, h: 5 });
  for (const [x, r, h] of [[-25, 1.9, 40], [5, 1.5, 34]]) { mesh(G.uvScale(new T.CylinderGeometry(r * 0.75, r, h, 28), Math.round(2 * Math.PI * r / 4 * 2) / 2, h / 4), MAT.brick, x, h / 2, -2); G.addCollider(x - r, -2 - r, x + r, -2 + r, 0, h); }
  const glowMat = G.emberGlowMaterial ? G.emberGlowMaterial(1) : new T.MeshBasicMaterial({ color: C(0xff5a1a), transparent: true, opacity: 0.5, blending: T.AdditiveBlending, fog: false });
  if (glowMat.uniforms) Object.defineProperty(glowMat, 'opacity', { get: () => glowMat.uniforms.uK.value * 0.5, set: (v) => { glowMat.uniforms.uK.value = v * 2; }, configurable: true });
  // fire mouths along the base of the front wall: arched holes in the brickwork with a bed of coals and flames
  // licking inside, a brick arch around each, soot climbing the wall above, sparks drifting out of a few
  const MW = 0.8, MH = 0.95, MR = MW / 2;
  const mouthGeo = (() => {
    const sh = new T.Shape(); sh.moveTo(-MR, 0); sh.lineTo(MR, 0); sh.lineTo(MR, MH - MR); sh.absarc(0, MH - MR, MR, 0, Math.PI, false); sh.lineTo(-MR, 0);
    const g = new T.ShapeGeometry(sh, 12), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + MR) / MW, p.getY(i) / MH);
    return g;
  })();
  const sootTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const cx = cv.getContext('2d'), im = cx.createImageData(64, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) {
      const u = x / 63 - 0.5, v = 1 - y / 127, streak = 0.75 + 0.25 * Math.sin(x * 0.9 + Math.sin(y * 0.05) * 2) * Math.sin(x * 0.37 + 1.3);
      const a = Math.pow(Math.max(0, 1 - v), 1.6) * Math.exp(-Math.pow(u / (0.18 + 0.2 * v), 2)) * streak * (0.85 + 0.15 * Math.random());
      const i = (y * 64 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.min(255, a * 255); im.data[i + 3] = 255;
    }
    cx.putImageData(im, 0, 0); const t = new T.CanvasTexture(cv); return t;
  })();
  const holeMat = new T.MeshBasicMaterial({ color: 0x050302 });
  const sootMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, alphaMap: sootTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ringGeo = new T.TorusGeometry(MR + 0.08, 0.085, 6, 14, Math.PI), jambGeo = B(0.17, MH - MR, 0.17), sootGeo = new T.PlaneGeometry(1.5, 2.2);
  const FZ = KZ1 + 0.3; let mi = 0;
  for (let x = KX0; x < KX1; x += 8) for (const dx of [1.25, 3.75]) {
    const mx = x + dx;
    const hole = new T.Mesh(mouthGeo, holeMat); hole.position.set(mx, 0.03, FZ + 0.004); G.add(hole);
    const glow = new T.Mesh(mouthGeo, glowMat); glow.position.set(mx, 0.03, FZ + 0.01); glow.renderOrder = 2; G.add(glow);
    mesh(ringGeo, MAT.brick, mx, 0.03 + MH - MR, FZ);
    for (const sx of [-1, 1]) mesh(jambGeo, MAT.brick, mx + sx * (MR + 0.08), 0.03 + (MH - MR) / 2, FZ);
    const soot = new T.Mesh(sootGeo, sootMat); soot.position.set(mx, 0.03 + MH + 0.95, FZ + 0.006); soot.castShadow = false; G.add(soot);
    if (G.fireFx && (mi++ % 3) === 0) G.fireFx(mx, 0.05, FZ + 0.2, 0.55, null, { flame: false, sparks: 10, smoke: 4 });
  }
  // the light the mouths throw on the yard in front, flickering with the fires
  const mouthL = new T.PointLight(C(0xff7a30), 0.8, 16, 1.8); mouthL.position.set(-10, 1.5, KZ1 + 1.1); G.add(mouthL);
  G.tickers.push((dt, t) => { mouthL.intensity = (G.lightsOut ? 0.35 : 0.8) * (0.85 + Math.sin(t * 9.3) * 0.08 + Math.sin(t * 23.7) * 0.05); });
  // the taller chimney still smokes
  if (G.fireFx) G.fireFx(-25, 40, -2, 3.2, null, { flame: false, sparks: 0, smoke: 16 });
  const kilnL = new T.PointLight(C(0xff6a2a), 1.1, 16, 1.6); kilnL.position.set(-10, 1.5, 3); G.add(kilnL);
  G.tickers.push((dt, t) => { kilnL.intensity = G.lightsOut ? 0.6 : 1.1 + Math.sin(t * 7) * 0.12; });

  // ---------------- drying yard: brick stacks (cover) ----------------
  // (one merged mesh, each stack with its own UVs so the bricks keep their real size whatever the stack's size)
  const stackParts = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
    if (G.rand() < 0.18) continue;
    const x = -42 + c * 10 + (r % 2) * 3, z = 14 + r * 6.5, w = G.rr(2.2, 3.4), h = G.rr(1.5, 2.2);
    stackParts.push([G.boxGeo(w, h, 1.4, 2.4), M4(x, h / 2, z, G.rr(-0.04, 0.04))]); G.addCollider(x - w / 2, z - 0.7, x + w / 2, z + 0.7, 0, h);
  }
  const sm = G.surfaceMaps ? G.surfaceMaps('brickstack') : null;
  const stackMat = sm ? G.std({ color: C(0xffffff), roughness: 1, map: sm.map, normalMap: sm.normalMap, roughnessMap: sm.roughnessMap }) : MAT.brick;
  const stacks = mesh(G.merge(stackParts), stackMat, 0, 0, 0);

  // ---------------- warehouse (prison) ----------------
  const WX0 = 20, WX1 = 44, WZ0 = -38, WZ1 = -20;
  const wseg = (x, z, w, d) => G.box({ x, z, w, d, h: 4.2, mat: MAT.rust, S: 3 });
  wseg((WX0 + WX1) / 2, WZ0, WX1 - WX0, 0.2); wseg(WX1, (WZ0 + WZ1) / 2, 0.2, WZ1 - WZ0); wseg(WX0, (WZ0 + -27) / 2, 0.2, -27 - WZ0); wseg(WX0, (-24 + WZ1) / 2, 0.2, WZ1 + 24);
  wseg((WX0 + WX1) / 2, WZ1, WX1 - WX0, 0.2);
  G.box({ x: (WX0 + WX1) / 2, z: (WZ0 + WZ1) / 2, y: 4.2, w: WX1 - WX0 + 0.6, d: WZ1 - WZ0 + 0.6, h: 0.2, mat: MAT.rust, S: 3, flags: { solid: false, los: false } });
  G.slab(WX0, WZ0, WX1, WZ1, MAT.concreteDark, 0.03);
  G.doors.wh = G.swingDoor(WX0, -25.5, 3, 2.8, 'z', MAT.rust);
  G.buildings.push({ name: 'wh', label: 'Nhà giam', x0: WX0, z0: WZ0, x1: WX1, z1: WZ1, h: 4.2, lit: true });
  const whL = new T.PointLight(C(0xffb070), 0.75, 18, 1.5); whL.position.set(32, 3.8, -29); G.add(whL);
  G.tickers.push((dt, t) => { whL.intensity = G.lightsOut ? 0 : ((Math.sin(t * 17) + Math.sin(t * 4.1)) > 1.6 ? 0.2 : 0.75); });
  L.cells = []; for (let i = 0; i < 4; i++) L.cells.push(G.cell(24 + i * 5, -35.4, 3.2, 2.6, 2.4));
  L.chainAnchor = V2(38, -22.4); L.namStart = V2(38, -23.4);
  const links = []; for (let i = 0; i < 12; i++) links.push(M4(38 + Math.sin(i) * 0.1, 0.05, -22.2 - i * 0.09, i * 1.57, Math.PI / 2));
  G.inst(new T.TorusGeometry(0.05, 0.014, 4, 8), MAT.chain, links);
  G.box({ x: 41.5, z: -24.5, w: 0.5, d: 0.5, h: 0.45, mat: MAT.wood });
  L.sleeper = V2(41.5, -24.5); L.keySpot = V2(40.6, -24.0);
  for (const [x, z, s] of [[36, -26, 1.3], [27, -30, 0.9]]) { const b = mesh(new T.PlaneGeometry(s, s), MAT.blood, x, 0.04, z); b.rotation.x = -Math.PI / 2; b.castShadow = false; }

  // ---------------- kitchen, barracks, generator ----------------
  G.box({ x: -39, z: -33, w: 10, d: 0.2, h: 3, mat: MAT.planks, S: 3 }); G.box({ x: -44, z: -30, w: 0.2, d: 6, h: 3, mat: MAT.planks, S: 3 });
  G.box({ x: -39, z: -30, y: 3, w: 11, d: 7, h: 0.15, mat: MAT.rust, S: 3, flags: { solid: false, los: false } });
  G.fire(-40, -30, 0.7);
  G.box({ x: -13, z: -33, w: 14, d: 8, h: 3.2, mat: MAT.planks, S: 3 });
  G.buildings.push({ name: 'bar', label: 'Lán gác', x0: -20, z0: -37, x1: -6, z1: -29, h: 3.2 });
  const GX = 44, GZ = 14;
  G.box({ x: GX, z: GZ - 3, w: 6, d: 0.2, h: 3, mat: MAT.metal, S: 3 }); G.box({ x: GX + 3, z: GZ, w: 0.2, d: 6, h: 3, mat: MAT.metal, S: 3 }); G.box({ x: GX, z: GZ + 3, w: 6, d: 0.2, h: 3, mat: MAT.metal, S: 3 });
  G.box({ x: GX, z: GZ, y: 3, w: 6.4, d: 6.4, h: 0.15, mat: MAT.rust, S: 3, flags: { solid: false, los: false } });
  G.box({ x: GX + 0.6, z: GZ, w: 2.4, d: 1.6, h: 1.5, mat: std(0x5f6b3a, { metalness: 0.4 }) });
  const genLed = mesh(B(0.08, 0.08, 0.02), new T.MeshBasicMaterial({ color: 0x30ff60 }), GX - 0.62, 1.2, GZ - 0.3); genLed.castShadow = false; G.genLed = genLed;
  L.generator = V2(GX - 1.6, GZ);

  // ---------------- floodlights (die with the generator) + one searchlight ----------------
  const headMat = std(0x333333, { emissive: C(0xffc070), emissiveIntensity: 8 });
  const poolMat = new T.MeshBasicMaterial({ map: G.TX.glow, color: C(0xffa64d), transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, fog: false });
  const floodLights = [], floods = [];
  for (const [x, z, r] of [[0, -36, 7], [-30, 20, 7], [20, 28, 7], [30, -12, 6], [-38, -14, 6]]) {
    mesh(new T.CylinderGeometry(0.1, 0.14, 7, 12), MAT.steel, x, 3.5, z); G.addCollider(x - 0.18, z - 0.18, x + 0.18, z + 0.18, 0, 7, { los: false });
    mesh(B(0.9, 0.25, 0.5), headMat, x, 7, z);
    const pm = poolMat.clone();
    const p = new T.Mesh(new T.PlaneGeometry(r * 2.4, r * 2.4), pm); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.06, z); G.add(p);
    G.lit.push({ x, z, r });
    // a pooled spotlight shining down when one is free near the camera; the point light and decal fill in otherwise
    const em = G.addEmitter({ kind: 'flood', pos: new T.Vector3(x, 6.85, z), target: new T.Vector3(x + 0.02, 0, z + 0.4), angle: 1.05, penumbra: 0.75, color: C(0xffb35c), intensity: 6, range: r * 3.4, decay: 1.25, prio: 1.2, shadow: true, on: () => !G.lightsOut });
    const Lt = new T.PointLight(C(0xffb35c), 1.4, r * 3, 1.4); Lt.position.set(x, 6.4, z); G.add(Lt); floodLights.push(Lt);
    floods.push({ m: pm, em, Lt });
  }
  G.tickers.push(() => { if (G.lightsOut) return; for (const f of floods) { f.m.opacity = 0.5 * (f.em.cur ? 0.12 : 1); f.Lt.intensity = f.em.cur ? 0 : 1.4; } });
  G.killPower = () => { G.lightsOut = true; G.lit.length = 0; headMat.emissiveIntensity = 0; floods.forEach((f) => { f.m.opacity = 0; }); floodLights.forEach((l) => { l.intensity = 0; }); genLed.material.color.set(0xff2020); glowMat.opacity = 0.25; };
  const lights = [];
  const tw = new T.Group(); tw.position.set(-48, 9, -38); G.add(tw);
  for (const sx of [-1.2, 1.2]) for (const sz of [-1.2, 1.2]) G.box({ x: -48 + sx, z: -38 + sz, w: 0.2, d: 0.2, h: 8, mat: MAT.steel, flags: { los: false } });
  G.box({ x: -48, z: -38, y: 8, w: 3, d: 3, h: 0.2, mat: MAT.planks, collide: false });
  const hs = new T.Mesh(new T.CylinderGeometry(0.3, 0.38, 0.6, 10), MAT.darkSteel); hs.rotation.x = Math.PI / 2; tw.add(hs);
  lights.push({ lamp: tw, cx: -20, cz: 10, rx: 26, rz: 24, fa: 0.15, fb: 0.21, r: 5 });

  // ---------------- rescue props (hidden until the raid) ----------------
  const raid = new T.Group(); raid.visible = false; G.add(raid); G.raidGroup = raid;
  const vanMat = std(0xe8eaec, { roughness: 0.3, metalness: 0.4 }), blue = std(0x1c3f8f);
  G.raidLights = [];
  for (const [x, z, ry] of [[-6, 50, 0.3], [6, 52, -0.2], [0, 60, 0]]) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry + Math.PI; raid.add(g);
    g.add(G.vanModel({ color: 0xe8eaec, stripe: 0x1c3f8f, lights: true }));
    const r = new T.Mesh(B(0.6, 0.1, 0.3), new T.MeshBasicMaterial({ color: new T.Color(0xff2020).multiplyScalar(5), fog: false })); r.position.set(-0.33, 2.22, 0.6); g.add(r);
    const bl = new T.Mesh(B(0.6, 0.1, 0.3), new T.MeshBasicMaterial({ color: new T.Color(0x2050ff).multiplyScalar(6), fog: false })); bl.position.set(0.33, 2.22, 0.6); g.add(bl);
    const pl = new T.PointLight(0xff2020, 0, 26, 1.6); pl.position.set(0, 3.6, 0.6); g.add(pl); G.raidLights.push({ r, bl, pl });
  }
  const heli = new T.Group(); heli.position.set(10, 26, 30); raid.add(heli); G.heli = heli;
  const heliM = G.heliModel({ color: 0x1a2a3a }); heli.add(heliM); const rotor = heliM.userData.rotor, tailR = heliM.userData.tail; G.heliRotor = rotor;
  const heliLamp = new T.Group(); heliLamp.position.set(0, -1, 1.5); heli.add(heliLamp); G.heliLamp = heliLamp;
  G.tickers.push((dt, t) => {
    if (!raid.visible) return; rotor.rotation.y += dt * 30; tailR.rotation.x += dt * 47;
    heli.position.x = 10 + Math.sin(t * 0.3) * 8; heli.position.z = 20 + Math.cos(t * 0.25) * 6;
    const ph = (t * 3) % 2 < 1; G.raidLights.forEach((o) => { o.r.visible = ph; o.bl.visible = !ph; o.pl.color.set(ph ? 0xff2020 : 0x2050ff); o.pl.intensity = ph ? 1.1 : 1.4; });
  });
  // bricks piled against the west fence: Chapter 3 ends climbing over here to the river
  G.box({ x: -51.4, z: 1.2, w: 0.9, d: 1.5, h: 0.9, mat: MAT.brick, S: 2 }); G.box({ x: -51.4, z: 1.2, y: 0.9, w: 0.6, d: 1.0, h: 0.45, mat: MAT.brick, S: 2, collide: false });
  L.westFence = V2(-50.4, 0);
  // the strip outside that fence where a team waits after climbing over (closed, unseen: nobody strolls round the compound)
  const pen = { los: false, cam: false };
  G.addCollider(-57.6, -9, -57, 9, 0, 3, pen); G.addCollider(-57.6, -9.6, -52.1, -9, 0, 3, pen); G.addCollider(-57.6, 9, -52.1, 9.6, 0, 3, pen);
  L.backGate = V2(0, 40.6); L.hideKiln = V2(-10, -2);
  return {
    bounds: { x0: -58, x1: 58, z0: -48, z1: 64 }, compound: { x0: -52, z0: -42, x1: 52, z1: 42 }, extra: [{ x0: GX - 3, z0: GZ - 3, x1: GX + 3, z1: GZ + 3, label: 'Máy phát' }],
    lights,
    guards: [
      { id: 'sleeper', kind: 'sleep', day: [41.5, -24.5, -Math.PI / 2] },
      { id: 'wh', day: [16, -26, 0], route: [[16, -18, 2], [16, -40, 2], [48, -40, 1], [48, -16, 2]], look: { rifle: true, shirt: 0x2a2a2a } },
      { id: 'yard1', day: [-20, 10, 0], route: [[-45, 10, 2], [40, 10, 2], [40, 38, 1], [-45, 38, 1]], look: { rifle: true, shirt: 0x3a2a2a } },
      { id: 'gen', day: [38, 18, 0], kind: 'sweep', base: -1.2, swing: 1.3, look: { shirt: 0x3a3a2a } },
      { id: 'gate', day: [0, 36, Math.PI], route: [[-10, 36, 3], [10, 36, 3]], look: { rifle: true, shirt: 0x2a2a2a } },
      { id: 'kiln', day: [-10, 9, Math.PI], route: [[-34, 9, 2], [14, 9, 2], [14, -14, 1], [-34, -14, 1]] },
      { id: 'dogK', dog: true, day: [0, 0, 0], route: [[-45, -20, 1], [-45, 40, 1], [45, 40, 1], [45, -14, 1]] },
    ],
    overcast: 0.9, rain: 0.35, lightning: false, fogMul: 0.5,
  };
} };
})(window.G);
