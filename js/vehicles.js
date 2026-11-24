// vehicles.js — vehicles you can believe: bodies shaped from a side profile (rounded edges, wheel arches, a glasshouse
// with pillars, a step in at the window line), real tyres and alloy rims, lamps that glow when they are on, bumpers,
// grille, mirrors, door lines and number plates. Used for the SUVs, the moto-remork tuk-tuks, the police vans and the
// helicopter. Each vehicle is a handful of merged meshes (one per material), not dozens of boxes.
(function (G) {
'use strict';
const T = G.T, C = G.C, M4 = G.M4;
const bx = (w, h, d, x, y, z, ry, rx, rz) => [new T.BoxGeometry(w, h, d), M4(x, y, z, ry, rx, rz)];
const cy = (r0, r1, h, seg, x, y, z, ry, rx, rz) => [new T.CylinderGeometry(r0, r1, h, seg), M4(x, y, z, ry, rx, rz)];
const merge = (parts) => G.merge(parts);
const M = {};
function mats() {
  if (M.glass) return M;
  M.glass = new T.MeshPhysicalMaterial({ color: C(0x04060a), roughness: 0.03, metalness: 0, reflectivity: 0.9 });   // tinted glass: dark, with a clear reflection of the sky
  M.chrome = G.std({ color: C(0xd9dbdf), roughness: 0.12, metalness: 1 });
  M.plastic = G.std({ color: C(0x0f1011), roughness: 0.7 });
  M.tyre = G.std({ color: C(0x151515), roughness: 0.9 });
  M.rim = G.std({ color: C(0xa7abb1), roughness: 0.26, metalness: 1 });
  M.dark = G.std({ color: C(0x050505), roughness: 0.6 });
  M.lampOff = G.std({ color: C(0xc9ced6), roughness: 0.06, metalness: 0.7 });
  M.tailOff = G.std({ color: C(0x5a0606), roughness: 0.12, metalness: 0.2 });
  M.lampOn = new T.MeshStandardMaterial({ color: C(0x111111), emissive: C(0xfff1d6), emissiveIntensity: 6, roughness: 0.2 });
  M.tailOn = new T.MeshStandardMaterial({ color: C(0x220202), emissive: C(0xff1606), emissiveIntensity: 2.2, roughness: 0.3 });
  M.steel = G.MAT.steel; M.darkSteel = G.MAT.darkSteel;
  M.vinyl = G.std({ color: C(0x5a1d16), roughness: 0.45 });
  M.canvas = G.std({ color: C(0x1d2a33), roughness: 0.9 });
  M.blade = G.std({ color: C(0x16181b), roughness: 0.5, metalness: 0.3 });
  M.shadow = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, alphaMap: G.TX.glow, depthWrite: false, fog: false });
  for (const k in M) if (M[k].isMeshStandardMaterial) M[k].gfxNoMacro = true;
  return M;
}
const paintCache = {};
function paint(hex, rough) {
  const k = hex + '_' + (rough || 0.2);
  // metallic base coat under a glossy clear coat (the sharp reflections of a car body)
  if (!paintCache[k]) { paintCache[k] = new T.MeshPhysicalMaterial({ color: C(hex), roughness: Math.max(0.3, rough || 0.2) + 0.15, metalness: 0.45, clearcoat: 1, clearcoatRoughness: Math.min(0.12, (rough || 0.2) * 0.4) }); paintCache[k].gfxNoMacro = true; }
  return paintCache[k];
}
function addMesh(g, geo, mat, cast) { const m = new T.Mesh(geo, mat); m.castShadow = cast !== false; m.receiveShadow = true; g.add(m); return m; }
// a side profile (shape in z / y) pushed across the width; bev rounds every edge (the outline grows by bev)
function extrude(shape, width, bev, segs) {
  const d = Math.max(0.01, width - bev * 2);
  const e = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: segs || 3, curveSegments: 12 });
  e.rotateY(-Math.PI / 2); e.translate(d / 2, 0, 0);
  return e;
}
// tyre (lathe) + rim (lip, spokes, hub, dark barrel) for a wheel of radius R and width W, axle along x, outer face +x
const wheelCache = {};
function wheel(R, W, spokes, deep) {
  const k = [R, W, spokes, deep].join('_');
  if (wheelCache[k]) return wheelCache[k];
  const r0 = R * (deep ? 0.55 : 0.64), prof = [];
  for (const [r, y] of [[r0 * 0.98, W * 0.4], [R * 0.86, W * 0.5], [R * 0.96, W * 0.47], [R, W * 0.33], [R, -W * 0.33], [R * 0.96, -W * 0.47], [R * 0.86, -W * 0.5], [r0 * 0.98, -W * 0.4]]) prof.push(new T.Vector2(r, y));
  const tyre = new T.LatheGeometry(prof, 32); tyre.rotateZ(-Math.PI / 2);
  const rim = [], dark = [];
  const lip = new T.TorusGeometry(r0 * 0.96, R * 0.035, 6, 32); lip.rotateY(Math.PI / 2); rim.push([lip, M4(W * 0.36, 0, 0)]);
  for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2; rim.push([new T.BoxGeometry(R * 0.05, r0 * 0.78, R * 0.12), M4(W * 0.3, Math.cos(a) * r0 * 0.48, Math.sin(a) * r0 * 0.48, 0, a)]); }
  rim.push(cy(r0 * 0.22, r0 * 0.25, W * 0.14, 16, W * 0.31, 0, 0, 0, 0, Math.PI / 2));
  dark.push([new T.CylinderGeometry(r0 * 0.95, r0 * 0.95, W * 0.7, 24, 1, true), M4(0, 0, 0, 0, 0, Math.PI / 2)]);
  const disc = new T.CircleGeometry(r0 * 0.95, 24); disc.rotateY(Math.PI / 2); dark.push([disc, M4(W * 0.12, 0, 0)]);
  return (wheelCache[k] = { tyre, rim: merge(rim), dark: merge(dark) });
}
// all wheels of a vehicle merged per material; list: [x, y, z] (x < 0 → mirrored so the rim faces out)
function wheels(g, list, R, W, spokes, deep) {
  const w = wheel(R, W, spokes, deep), t = [], r = [], d = [];
  for (const [x, y, z] of list) { const m = M4(x, y, z, x < 0 ? Math.PI : 0); t.push([w.tyre, m]); r.push([w.rim, m]); d.push([w.dark, m]); }
  addMesh(g, merge(t), M.tyre); addMesh(g, merge(r), M.rim); addMesh(g, merge(d), M.dark, false);
}
function plate(text, w, h) {
  return G.std({ map: G.signTex([text], { bg: '#f1f2f0', fg: '#1b2f78', w: 256, h: Math.round(256 * h / w), grime: false }), roughness: 0.4 });
}
function groundShadow(g, w, l) {
  const s = new T.Mesh(new T.PlaneGeometry(w, l), M.shadow); s.rotation.x = -Math.PI / 2; s.position.y = 0.025; s.renderOrder = -1; g.add(s); return s;
}

// ---------------- SUV (forward +z, 4.7 m) ----------------
G.suvModel = function (o) {
  o = o || {}; mats();
  const g = new T.Group(), body = paint(o.color !== undefined ? o.color : 0x111316, 0.18), b = 0.05;
  const WB = 1.42, AR = 0.52;
  const s = new T.Shape();
  s.moveTo(-2.25, 0.36); s.lineTo(-WB - AR, 0.36); s.absarc(-WB, 0.36, AR, Math.PI, 0, true); s.lineTo(WB - AR, 0.36); s.absarc(WB, 0.36, AR, Math.PI, 0, true);
  s.lineTo(2.22, 0.36); s.quadraticCurveTo(2.32, 0.38, 2.32, 0.56); s.lineTo(2.29, 0.82); s.quadraticCurveTo(2.25, 0.97, 2.0, 1.0); s.lineTo(1.15, 1.08); s.lineTo(-2.16, 1.1);
  s.quadraticCurveTo(-2.3, 1.09, -2.32, 0.94); s.lineTo(-2.32, 0.52); s.quadraticCurveTo(-2.3, 0.36, -2.25, 0.36);
  const P = [[extrude(s, 1.9, b, 3), null]];
  // glasshouse (narrower: the sides step in at the window line), with the roof and pillars in body colour
  const gh = new T.Shape();
  gh.moveTo(-2.1, 1.12); gh.lineTo(1.12, 1.12); gh.lineTo(0.42, 1.73); gh.quadraticCurveTo(0.34, 1.77, 0.2, 1.77); gh.lineTo(-1.95, 1.77); gh.quadraticCurveTo(-2.08, 1.76, -2.12, 1.62); gh.lineTo(-2.1, 1.12);
  addMesh(g, extrude(gh, 1.66, 0.03, 2), M.glass);
  P.push(bx(1.62, 0.06, 2.22, 0, 1.79, -0.86));
  for (const sx of [-1, 1]) {
    const x = sx * 0.85;
    P.push(bx(0.07, 0.94, 0.09, x, 1.43, 0.77, 0, -0.83));       // A pillar along the windscreen
    P.push(bx(0.07, 0.66, 0.13, x, 1.44, -0.42));                // B
    P.push(bx(0.07, 0.66, 0.16, x, 1.44, -1.52));                // C
    P.push(bx(0.07, 0.62, 0.12, x, 1.43, -2.06, 0, 0.06));       // D
    P.push(bx(0.2, 0.12, 0.08, sx * 1.03, 1.17, 0.93));           // mirror
  }
  addMesh(g, merge(P), body);
  // black trim: bumpers, skirts, window line, grille, door lines, mirror glass
  const K = [bx(1.86, 0.22, 0.2, 0, 0.44, 2.28), bx(1.86, 0.22, 0.18, 0, 0.46, -2.29), bx(1.05, 0.26, 0.04, 0, 0.72, 2.33)];
  for (const sx of [-1, 1]) {
    K.push(bx(0.04, 0.12, 1.8, sx * 0.955, 0.42, 0), bx(0.02, 0.03, 3.2, sx * 0.956, 1.135, -0.5));
    for (const z of [1.02, -0.43, -1.56]) K.push(bx(0.006, 0.68, 0.01, sx * 0.953, 0.76, z));
    K.push(bx(0.01, 0.09, 0.06, sx * 1.135, 1.17, 0.93));
  }
  addMesh(g, merge(K), M.plastic);
  const CH = [];
  for (const y of [0.65, 0.72, 0.79]) CH.push(bx(1.0, 0.022, 0.02, 0, y, 2.35));
  for (const sx of [-1, 1]) for (const z of [0.35, -0.95]) CH.push(bx(0.02, 0.03, 0.15, sx * 0.958, 0.99, z));
  addMesh(g, merge(CH), M.chrome);
  // lamps
  const lamps = addMesh(g, merge([bx(0.36, 0.13, 0.05, -0.62, 0.84, 2.31), bx(0.36, 0.13, 0.05, 0.62, 0.84, 2.31)]), o.lights ? M.lampOn : M.lampOff, false);
  addMesh(g, merge([bx(0.3, 0.14, 0.05, -0.68, 0.98, -2.33), bx(0.3, 0.14, 0.05, 0.68, 0.98, -2.33)]), o.lights ? M.tailOn : M.tailOff, false);
  const pm = plate(o.plate || 'PREAH SIHANOUK  2A-7781', 0.52, 0.12);
  const pf = new T.Mesh(new T.PlaneGeometry(0.52, 0.12), pm); pf.position.set(0, 0.5, 2.385); g.add(pf);
  const pr = new T.Mesh(new T.PlaneGeometry(0.52, 0.12), pm); pr.position.set(0, 0.64, -2.385); pr.rotation.y = Math.PI; g.add(pr);
  wheels(g, [[-0.82, 0.42, WB], [0.82, 0.42, WB], [-0.82, 0.42, -WB], [0.82, 0.42, -WB]], 0.42, 0.26, 5);
  groundShadow(g, 2.4, 5.2);
  g.userData.lamps = lamps;
  return g;
};

// ---------------- police / rescue van (forward +z, 5.3 m) ----------------
G.vanModel = function (o) {
  o = o || {}; mats();
  const g = new T.Group(), body = paint(o.color !== undefined ? o.color : 0xe9ebed, 0.25), b = 0.06, WB = 1.65, AR = 0.5;
  const s = new T.Shape();
  s.moveTo(-2.55, 0.38); s.lineTo(-WB - AR, 0.38); s.absarc(-WB, 0.38, AR, Math.PI, 0, true); s.lineTo(WB - AR, 0.38); s.absarc(WB, 0.38, AR, Math.PI, 0, true);
  s.lineTo(2.5, 0.38); s.quadraticCurveTo(2.6, 0.4, 2.6, 0.6); s.lineTo(2.56, 0.98); s.quadraticCurveTo(2.5, 1.12, 2.25, 1.18); s.lineTo(1.55, 1.95); s.quadraticCurveTo(1.42, 2.06, 1.2, 2.06);
  s.lineTo(-2.45, 2.06); s.quadraticCurveTo(-2.6, 2.05, -2.6, 1.9); s.lineTo(-2.6, 0.55); s.quadraticCurveTo(-2.58, 0.38, -2.55, 0.38);
  addMesh(g, extrude(s, 2.0, b, 3), body);
  // windows: windscreen, cab side windows, a band of side windows, rear windows (glass panels just proud of the body)
  const W = [];
  const ws = new T.PlaneGeometry(1.7, 0.9); W.push([ws, M4(0, 1.6, 1.94, 0, -0.78)]);
  for (const sx of [-1, 1]) {
    W.push([new T.PlaneGeometry(0.7, 0.62), M4(sx * 1.004, 1.62, 1.18, sx * Math.PI / 2)]);
    W.push([new T.PlaneGeometry(2.6, 0.55), M4(sx * 1.004, 1.66, -0.75, sx * Math.PI / 2)]);
  }
  W.push([new T.PlaneGeometry(1.6, 0.6), M4(0, 1.62, -2.665, Math.PI)]);
  addMesh(g, merge(W), M.glass, false);
  const K = [bx(1.95, 0.24, 0.2, 0, 0.46, 2.6), bx(1.95, 0.24, 0.18, 0, 0.47, -2.62), bx(1.2, 0.3, 0.04, 0, 0.76, 2.63)];
  for (const sx of [-1, 1]) { K.push(bx(0.2, 0.14, 0.1, sx * 1.1, 1.3, 1.55)); for (const z of [1.55, 0.6, -0.55]) K.push(bx(0.006, 1.45, 0.01, sx * 1.003, 1.15, z)); }
  addMesh(g, merge(K), M.plastic);
  if (o.stripe !== undefined) {
    const st = [];
    for (const sx of [-1, 1]) st.push(bx(0.012, 0.32, 4.9, sx * 1.004, 1.0, -0.05));
    st.push(bx(1.9, 0.32, 0.012, 0, 1.0, -2.67));
    addMesh(g, merge(st), paint(o.stripe, 0.35), false);
  }
  addMesh(g, merge([bx(0.34, 0.16, 0.05, -0.7, 0.92, 2.6), bx(0.34, 0.16, 0.05, 0.7, 0.92, 2.6)]), o.lights ? M.lampOn : M.lampOff, false);
  addMesh(g, merge([bx(0.12, 0.42, 0.05, -0.88, 1.0, -2.65), bx(0.12, 0.42, 0.05, 0.88, 1.0, -2.65)]), o.lights ? M.tailOn : M.tailOff, false);
  // roof light bar (the caller hangs the flashing red / blue lenses on it)
  addMesh(g, merge([bx(1.3, 0.1, 0.32, 0, 2.15, 0.6), bx(0.06, 0.08, 0.06, -0.5, 2.09, 0.6), bx(0.06, 0.08, 0.06, 0.5, 2.09, 0.6)]), M.plastic);
  wheels(g, [[-0.86, 0.38, WB], [0.86, 0.38, WB], [-0.86, 0.38, -WB], [0.86, 0.38, -WB]], 0.38, 0.24, 6, true);
  groundShadow(g, 2.5, 5.8);
  g.userData.barY = 2.25; g.userData.barZ = 0.6;
  return g;
};

// ---------------- moto-remork tuk-tuk (forward +z): a motorbike pulling a covered carriage ----------------
G.tuktukModel = function (o) {
  o = o || {}; mats();
  const g = new T.Group(), body = paint(o.color !== undefined ? o.color : 0xc0392b, 0.35);
  // carriage: floor, side panels, two facing benches, posts, rails, canopy with a valance
  const P = [bx(0.04, 0.3, 2.0, -0.7, 0.75, -0.4), bx(0.04, 0.3, 2.0, 0.7, 0.75, -0.4), bx(1.44, 0.3, 0.04, 0, 0.75, -1.42), bx(1.5, 0.14, 0.05, 0, 1.94, 0.73), bx(1.5, 0.14, 0.05, 0, 1.94, -1.53), bx(0.05, 0.14, 2.28, -0.75, 1.94, -0.4), bx(0.05, 0.14, 2.28, 0.75, 1.94, -0.4)];
  P.push(bx(0.24, 0.1, 0.4, 0, 0.88, 1.62), bx(0.3, 0.22, 0.36, 0, 0.98, 1.62));   // fuel tank on the bike
  addMesh(g, merge(P), body);
  const S = [bx(1.42, 0.08, 2.08, 0, 0.56, -0.4), bx(0.08, 0.08, 0.7, 0, 0.62, 0.95)];   // floor, hitch bar
  for (const sx of [-1, 1]) for (const z of [-1.38, 0.62]) S.push(cy(0.024, 0.024, 1.36, 8, sx * 0.68, 1.27, z));
  for (const sx of [-1, 1]) S.push(cy(0.018, 0.018, 2.0, 8, sx * 0.69, 1.32, -0.38, 0, Math.PI / 2));
  // motorbike: frame, engine, forks, handlebar
  S.push(bx(0.24, 0.3, 0.36, 0, 0.5, 1.5), bx(0.06, 0.06, 0.9, 0, 0.78, 1.55, 0, -0.35));
  for (const sx of [-1, 1]) S.push(cy(0.022, 0.022, 0.86, 8, sx * 0.08, 0.68, 2.08, 0, -0.32));
  S.push(cy(0.016, 0.016, 0.64, 8, 0, 1.08, 1.94, 0, 0, Math.PI / 2), cy(0.03, 0.03, 0.12, 10, 0, 0.98, 2.02, 0, Math.PI / 2));
  S.push(cy(0.03, 0.035, 0.5, 10, 0.12, 0.38, 1.05, 0, Math.PI / 2 - 0.15));         // exhaust
  addMesh(g, merge(S), M.darkSteel);
  const V = [bx(1.24, 0.12, 0.42, 0, 0.86, -1.15), bx(1.24, 0.42, 0.08, 0, 1.14, -1.38, 0, 0.08), bx(1.24, 0.12, 0.42, 0, 0.86, 0.32), bx(1.24, 0.42, 0.08, 0, 1.14, 0.56, 0, -0.08)];
  V.push(bx(0.26, 0.08, 0.55, 0, 0.94, 1.18));                                       // bike seat
  addMesh(g, merge(V), M.vinyl);
  const roof = new T.BoxGeometry(1.52, 0.05, 2.3); addMesh(g, merge([[roof, M4(0, 2.02, -0.4)]]), M.canvas);
  addMesh(g, merge([cy(0.06, 0.07, 0.06, 14, 0, 0.98, 2.09, 0, Math.PI / 2)]), M.chrome);
  addMesh(g, merge([[new T.CircleGeometry(0.055, 14), M4(0, 0.98, 2.121)]]), o.lights ? M.lampOn : M.lampOff, false);
  // two carriage wheels with mudguards, two bike wheels
  wheels(g, [[-0.8, 0.3, -0.4], [0.8, 0.3, -0.4]], 0.3, 0.14, 6);
  wheels(g, [[0.035, 0.29, 0.98], [0.035, 0.29, 2.2]], 0.29, 0.1, 8);
  const F = [];
  for (const sx of [-1, 1]) { const fg = new T.CylinderGeometry(0.37, 0.37, 0.18, 14, 1, true, 0, Math.PI); F.push([fg, M4(sx * 0.8, 0.3, -0.4, 0, 0, Math.PI / 2)]); }
  addMesh(g, merge(F), M.plastic);
  groundShadow(g, 1.9, 4.2);
  return g;
};

// ---------------- helicopter (forward +z) ----------------
G.heliModel = function (o) {
  o = o || {}; mats();
  const g = new T.Group(), body = paint(o.color !== undefined ? o.color : 0x1a2a3a, 0.3);
  // fuselage: a lathe along z (nose rounded, tapering into the boom)
  const prof = [[0.02, -2.2], [0.45, -2.0], [0.75, -1.5], [0.95, -0.6], [1.0, 0.4], [0.95, 1.2], [0.8, 1.8], [0.5, 2.3], [0.05, 2.5]].map(([r, z]) => new T.Vector2(r, z));
  const fus = new T.LatheGeometry(prof, 24); fus.rotateX(Math.PI / 2); fus.scale(1, 0.9, 1);
  const P = [[fus, M4(0, 0, 0.2)], cy(0.3, 0.12, 4.6, 12, 0, 0.25, -4.1, 0, Math.PI / 2), bx(0.08, 1.1, 0.7, 0, 0.8, -6.2, 0, -0.35), bx(1.4, 0.05, 0.45, 0, 0.3, -5.6)];
  P.push(cy(0.3, 0.4, 0.4, 14, 0, 0.98, 0.1));                                      // engine cowling / mast
  addMesh(g, merge(P), body);
  // cockpit glass on the nose
  const cp = new T.SphereGeometry(0.86, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42); cp.rotateX(Math.PI / 2 - 0.3); cp.scale(1, 0.9, 1.15);
  addMesh(g, merge([[cp, M4(0, 0.12, 1.25)]]), M.glass);
  // skids
  const S = [];
  for (const sx of [-1, 1]) { S.push(cy(0.05, 0.05, 3.6, 8, sx * 0.95, -1.15, 0.1, 0, Math.PI / 2)); for (const z of [-0.7, 0.9]) S.push(cy(0.04, 0.04, 0.75, 8, sx * 0.82, -0.8, z, 0, 0, sx * 0.35)); }
  addMesh(g, merge(S), M.darkSteel);
  // main rotor: hub, four blades, and a faint disc for the blur of the spinning blades
  const rotor = new T.Group(); rotor.position.y = 1.25; g.add(rotor);
  const R = [cy(0.16, 0.16, 0.22, 12, 0, 0, 0)];
  for (let i = 0; i < 4; i++) R.push(bx(0.32, 0.04, 5.4, Math.sin(i * Math.PI / 2) * 2.75, 0.05, Math.cos(i * Math.PI / 2) * 2.75, i * Math.PI / 2));
  addMesh(rotor, merge(R), M.blade);
  const blur = new T.Mesh(new T.CircleGeometry(5.5, 40), new T.MeshBasicMaterial({ color: 0x0c0d0f, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide }));
  blur.rotation.x = -Math.PI / 2; blur.position.y = 1.31; g.add(blur);
  const tail = new T.Group(); tail.position.set(0.12, 0.85, -6.35); g.add(tail);
  addMesh(tail, merge([bx(0.03, 1.2, 0.12, 0, 0, 0), bx(0.03, 0.12, 1.2, 0, 0, 0)]), M.blade);
  // nav lights
  const red = new T.MeshBasicMaterial({ color: new T.Color(0xff2020).multiplyScalar(4), fog: false }), grn = new T.MeshBasicMaterial({ color: new T.Color(0x20ff60).multiplyScalar(4), fog: false });
  const l1 = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), red); l1.position.set(-0.7, 0.3, -5.6); g.add(l1);
  const l2 = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), grn); l2.position.set(0.7, 0.3, -5.6); g.add(l2);
  g.userData.rotor = rotor; g.userData.tail = tail;
  return g;
};

// ---------------- national flags (canvas): 'vn' red with a yellow star · 'kh' blue-red-blue with the white temple ----------------
const flagCache = {};
G.flagTex = function (kind) {
  if (flagCache[kind]) return flagCache[kind];
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; const g = cv.getContext('2d');
  if (kind === 'vn') {
    g.fillStyle = '#da251d'; g.fillRect(0, 0, 300, 200);
    g.fillStyle = '#ffde00'; g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 26 : 64, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(150 + Math.cos(a) * r, 104 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  } else if (kind === 'th') { // Thailand: red, white, a double blue band, white, red
    for (const [y, h, col] of [[0, 33.4, '#a51931'], [33.3, 33.4, '#f4f5f8'], [66.6, 66.8, '#2d2a4a'], [133.3, 33.4, '#f4f5f8'], [166.6, 33.4, '#a51931']]) { g.fillStyle = col; g.fillRect(0, y, 300, h); }
  } else {
    g.fillStyle = '#032ea1'; g.fillRect(0, 0, 300, 200); g.fillStyle = '#e00025'; g.fillRect(0, 50, 300, 100);
    // the temple: a three-tier base and five towers (the middle one tallest), outlined in black
    g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    const tower = (cx, w, top) => { g.beginPath(); g.moveTo(cx - w / 2, 128); g.lineTo(cx - w / 2, 112); for (let k = 1; k <= 4; k++) { const ww = w / 2 * (1 - k * 0.2), y = 112 - (112 - top) * k / 5; g.lineTo(cx - ww, y); } g.lineTo(cx, top); for (let k = 4; k >= 1; k--) { const ww = w / 2 * (1 - k * 0.2), y = 112 - (112 - top) * k / 5; g.lineTo(cx + ww, y); } g.lineTo(cx + w / 2, 112); g.lineTo(cx + w / 2, 128); g.closePath(); g.fill(); g.stroke(); };
    tower(98, 18, 88); tower(202, 18, 88); tower(122, 20, 80); tower(178, 20, 80); tower(150, 26, 64);
    for (const [x0, x1, y0, y1] of [[84, 216, 128, 134], [78, 222, 134, 140], [72, 228, 140, 146]]) { g.fillRect(x0, y0, x1 - x0, y1 - y0); g.strokeRect(x0, y0, x1 - x0, y1 - y0); }
  }
  const t = new T.CanvasTexture(cv); t.anisotropy = 4; flagCache[kind] = t; return t;
};
// a flag on a pole; the cloth sways a little (wave(t) from a ticker)
G.flagPole = function (kind, h) {
  const g = new T.Group(); h = h || 9;
  const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, h, 10), G.MAT.steel); pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
  const geo = new T.PlaneGeometry(2.4, 1.6, 12, 4); geo.translate(1.2, 0, 0);
  const cloth = new T.Mesh(geo, new T.MeshStandardMaterial({ map: G.flagTex(kind), side: T.DoubleSide, roughness: 0.8 }));
  cloth.position.y = h - 0.9; cloth.castShadow = true; g.add(cloth);
  const base = geo.attributes.position.array.slice();
  g.userData.cloth = cloth;
  g.userData.setKind = (k) => { cloth.material.map = G.flagTex(k); cloth.material.needsUpdate = true; };
  g.userData.wave = (t) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(x * 2.2 - t * 5 + base[i * 3 + 1]) * 0.08 * x); } p.needsUpdate = true; geo.computeVertexNormals(); };
  return g;
};

// ---------------- river boat (forward +x): wooden hull, deck, cabin aft, awning; police: white hull, light bar ----------------
G.boatModel = function (o) {
  o = o || {}; mats();
  const g = new T.Group(), L0 = o.len || 12, B0 = (o.beam || 2.8) / 2, H0 = 1.1, st = -L0 / 2, bw = L0 / 2;
  // hull: the top-view outline (pointed bow, square stern) pushed down from the deck line
  const outline = (s) => { const sh = new T.Shape(); sh.moveTo(st * s, -B0 * s); sh.lineTo((bw - 2.6) * s, -B0 * s); sh.quadraticCurveTo((bw - 0.5) * s, -B0 * 0.8 * s, bw * s, 0); sh.quadraticCurveTo((bw - 0.5) * s, B0 * 0.8 * s, (bw - 2.6) * s, B0 * s); sh.lineTo(st * s, B0 * s); sh.lineTo(st * s, -B0 * s); return sh; };
  const slab = (s, depth, y) => { const e = new T.ExtrudeGeometry(outline(s), { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 2, curveSegments: 10 }); e.rotateX(Math.PI / 2); e.translate(0, y + depth, 0); return e; };
  const hullMat = o.police ? paint(0xeef0f2, 0.3) : G.std({ color: C(o.color || 0x5e4630), roughness: 0.75, map: G.TX.planks }), stripe = o.police ? paint(0x1c3f8f, 0.3) : G.std({ color: C(o.stripe || 0x2e6fa0), roughness: 0.6 });
  addMesh(g, slab(1, H0, 0), hullMat);
  addMesh(g, slab(1.012, 0.22, H0 - 0.42), stripe);
  const deck = new T.Mesh(slab(0.9, 0.02, H0 + 0.01), G.std({ color: C(0x8a6a48), roughness: 0.85, map: G.TX.planks })); deck.receiveShadow = true; g.add(deck);
  // cabin aft with windows, roof; an engine stack
  const cw = B0 * 1.5, cx0 = st + 0.9, cx1 = st + (o.police ? 5.2 : 4.4), ch = o.police ? 1.9 : 1.7;
  const cabMat = o.police ? paint(0xf4f5f6, 0.3) : G.std({ color: C(0xd9d2bf), roughness: 0.8 });
  if (o.cabin === false) { g.userData.deckY = H0 + 0.03; g.userData.len = L0; g.userData.beam = B0 * 2; return g; } // an open skiff
  addMesh(g, merge([bx(cx1 - cx0, ch, cw, (cx0 + cx1) / 2, H0 + ch / 2, 0)]), cabMat);
  addMesh(g, merge([bx(cx1 - cx0 - 0.4, 0.55, cw + 0.02, (cx0 + cx1) / 2 + 0.1, H0 + ch - 0.55, 0), bx(0.04, 0.55, cw - 0.4, cx1 + 0.01, H0 + ch - 0.55, 0)]), M.glass);
  addMesh(g, merge([bx(cx1 - cx0 + 0.5, 0.1, cw + 0.4, (cx0 + cx1) / 2, H0 + ch + 0.05, 0)]), o.police ? paint(0x1c3f8f, 0.3) : G.std({ color: C(0x3a5f7a), roughness: 0.7 }));
  addMesh(g, merge([cy(0.08, 0.08, 1.2, 10, cx0 + 0.4, H0 + ch + 0.6, cw * 0.3)]), M.darkSteel);
  if (o.awning) { // canvas sun roof over the front deck on four posts
    const P = []; for (const x of [cx1 + 0.6, bw - 3.2]) for (const z of [-B0 * 0.8, B0 * 0.8]) P.push(cy(0.04, 0.04, 1.8, 6, x, H0 + 0.9, z));
    addMesh(g, merge(P), M.darkSteel);
    const aw = new T.Mesh(new T.BoxGeometry(bw - 3.2 - cx1, 0.05, B0 * 1.9), G.MAT.tarp); aw.position.set((cx1 + 0.6 + bw - 3.2) / 2, H0 + 1.82, 0); aw.castShadow = true; g.add(aw);
  }
  if (o.police) { // light bar + name boards
    const red = new T.Mesh(new T.BoxGeometry(0.3, 0.14, 0.5), new T.MeshBasicMaterial({ color: new T.Color(0xff2020).multiplyScalar(5), fog: false }));
    const blue = new T.Mesh(new T.BoxGeometry(0.3, 0.14, 0.5), new T.MeshBasicMaterial({ color: new T.Color(0x2050ff).multiplyScalar(6), fog: false }));
    red.position.set((cx0 + cx1) / 2, H0 + ch + 0.18, -0.35); blue.position.set((cx0 + cx1) / 2, H0 + ch + 0.18, 0.35); g.add(red, blue);
    const name = G.std({ map: G.signTex([o.label || 'POLICE'], { bg: '#1c3f8f', fg: '#ffffff', w: 512, h: 96, grime: false }), roughness: 0.5 });
    for (const sz of [-1, 1]) { const n = new T.Mesh(new T.PlaneGeometry(3.2, 0.6), name); n.position.set(bw - 4.6, H0 - 0.55, sz * (B0 + 0.03)); n.rotation.y = sz > 0 ? 0 : Math.PI; g.add(n); }
    const pl = new T.PointLight(0xff2020, 0, 22, 1.6); pl.position.set((cx0 + cx1) / 2, H0 + ch + 0.8, 0); g.add(pl);
    g.userData.bar = { red, blue, pl };
  }
  if (o.flag) { const f = G.flagPole(o.flag, 2.6); f.position.set(st + 0.25, H0, 0); g.add(f); g.userData.flag = f; }
  g.userData.deckY = H0 + 0.03; g.userData.len = L0; g.userData.beam = B0 * 2;
  return g;
};

// ---------------- airliner (nose +x, wheels on y = 0): generic white livery, no airline branding ----------------
G.planeModel = function (o) {
  o = o || {}; mats();
  const g = new T.Group(), Y = 3.0, R = 2.0;
  const white = paint(0xf3f5f7, 0.28), blue = paint(o.color || 0x1d4f91, 0.3), grey = G.std({ color: C(0x9aa1a8), roughness: 0.4, metalness: 0.6 });
  // fuselage: a lathe profile (tail cone → barrel → nose), the tail swept up
  const prof = [[0.02, -19.6], [0.35, -19.4], [0.9, -17.8], [1.5, -15.5], [1.9, -12.5], [R, -10], [R, 13], [1.96, 14.6], [1.8, 16.2], [1.45, 17.6], [0.95, 18.6], [0.45, 19.25], [0.02, 19.45]].map(([r, y]) => new T.Vector2(r, y));
  const fus = new T.LatheGeometry(prof, 32); fus.rotateZ(-Math.PI / 2);
  const p = fus.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x < -10) p.setY(i, p.getY(i) + (-10 - x) * 0.085); }
  fus.computeVertexNormals(); fus.translate(0, Y, 0);
  addMesh(g, fus, white);
  // blue belly + a thin cheat line under the windows
  const band = (t0, tl, r, x0, x1) => { const c = new T.CylinderGeometry(r, r, x1 - x0, 32, 1, true, t0, tl); c.rotateZ(-Math.PI / 2); c.translate((x0 + x1) / 2, Y, 0); return c; };
  // (after the turn onto x, angle θ sits at height −R·sin θ and side R·cos θ: π/2 is the belly)
  const belly = new T.Mesh(merge([[band(Math.PI * 0.12, Math.PI * 0.76, R + 0.012, -10, 13), null]]), blue); belly.castShadow = true; g.add(belly);
  const cheat = new T.Mesh(merge([[band(-0.105, 0.06, R + 0.014, -10, 13), null], [band(Math.PI + 0.045, 0.06, R + 0.014, -10, 13), null]]), blue); g.add(cheat);
  // windows: a row on each side, cockpit glass on the nose
  const W = []; for (let i = 0; i < 30; i++) { const x = -8.6 + i * 0.72; if (Math.abs(x - 14.2) < 0.7 || Math.abs(x + 7.5) < 0.6) continue; for (const s of [-1, 1]) W.push(bx(0.24, 0.32, 0.05, x, Y + 0.55, s * 1.92)); }
  addMesh(g, merge(W), M.dark, false);
  const ck = []; for (const s of [-1, 1]) for (let i = 0; i < 2; i++) ck.push(bx(0.55, 0.32, 0.05, 17.15 + i * 0.5, Y + 0.95 - i * 0.12, s * (1.25 - i * 0.3), s * (0.55 + i * 0.25), 0, -0.25));
  addMesh(g, merge(ck), M.glass, false);
  // front left door (the stairs meet it) and an outline for the rear one
  const doorMat = G.std({ color: C(0xd8dde2), roughness: 0.4 });
  const door = new T.Mesh(new T.BoxGeometry(0.95, 1.9, 0.06), doorMat); door.position.set(14.2, Y + 0.05, -1.97); g.add(door);
  addMesh(g, merge([bx(1.05, 0.04, 0.07, 14.2, Y + 1.02, -1.97), bx(1.05, 0.04, 0.07, 14.2, Y - 0.92, -1.97), bx(0.04, 1.95, 0.07, 13.68, Y + 0.05, -1.97), bx(0.04, 1.95, 0.07, 14.72, Y + 0.05, -1.97)]), M.dark, false);
  // wings (swept, low, a little dihedral), winglets, engines on pylons
  const wing = (s) => {
    const sh = new T.Shape(); sh.moveTo(3.2, 1.6 * s); sh.lineTo(-5.4, 16.6 * s); sh.lineTo(-7.6, 16.6 * s); sh.lineTo(-4.4, 1.6 * s); sh.lineTo(3.2, 1.6 * s);
    const e = new T.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 }); e.rotateX(Math.PI / 2); e.translate(0, 0.16, 0);
    e.rotateX(-0.07 * s); e.translate(0, Y - 0.95, 0); return e;
  };
  addMesh(g, merge([[wing(1), null], [wing(-1), null]]), white);
  addMesh(g, merge([bx(1.6, 1.8, 0.12, -6.9, Y - 0.95 + 0.07 * 16.6 + 0.9, 16.7, 0, 0, 0.12), bx(1.6, 1.8, 0.12, -6.9, Y - 0.95 + 0.07 * 16.6 + 0.9, -16.7, 0, 0, -0.12)]), blue);
  const ENG = [], INL = [];
  for (const s of [-1, 1]) {
    ENG.push(cy(0.95, 0.8, 3.8, 24, 0.9, Y - 1.95, s * 6.0, 0, 0, Math.PI / 2), bx(2.4, 0.9, 0.3, -0.1, Y - 1.25, s * 6.0));
    const inl = new T.CircleGeometry(0.82, 20); inl.rotateY(Math.PI / 2); INL.push([inl, M4(2.82, Y - 1.95, s * 6.0)]);
  }
  addMesh(g, merge(ENG), grey); addMesh(g, merge(INL), M.dark, false);
  // tail: stabilisers + fin (in the livery colour)
  const stab = (s) => { const sh = new T.Shape(); sh.moveTo(-13.6, 0.9 * s); sh.lineTo(-17.4, 6.4 * s); sh.lineTo(-18.9, 6.4 * s); sh.lineTo(-17.2, 0.9 * s); sh.lineTo(-13.6, 0.9 * s); const e = new T.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }); e.rotateX(Math.PI / 2); e.translate(0, Y + 0.95, 0); return e; };
  addMesh(g, merge([[stab(1), null], [stab(-1), null]]), white);
  const fs = new T.Shape(); fs.moveTo(-12.6, 1.4); fs.lineTo(-17.6, 8.6); fs.lineTo(-19.6, 8.6); fs.lineTo(-18.8, 1.4); fs.lineTo(-12.6, 1.4);
  const fin = new T.ExtrudeGeometry(fs, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 }); fin.translate(0, Y, -0.15);
  addMesh(g, fin, blue);
  // landing gear (a group, so it can fold away after take-off)
  const gear = new T.Group(); g.add(gear); g.userData.gear = gear;
  const GS = [], GT = [];
  for (const [x, z] of [[14.6, 0], [-1.2, 2.9], [-1.2, -2.9]]) { GS.push(cy(0.11, 0.11, Y - 0.5, 8, x, (Y - 0.5) / 2 + 0.5, z)); for (const dz of x > 0 ? [-0.22, 0.22] : [-0.35, 0.35]) GT.push(cy(0.5, 0.5, 0.3, 16, x, 0.5, z + dz, 0, Math.PI / 2)); }
  addMesh(gear, merge(GS), M.darkSteel); addMesh(gear, merge(GT), M.tyre);
  // lights: red / green wingtips, white strobe on the tail, landing lights at the wing roots
  const lamp = (hex, k, x, y, z) => { const m = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(hex).multiplyScalar(k), fog: false })); m.position.set(x, y, z); g.add(m); return m; };
  lamp(0xff2020, 4, -6.4, Y - 0.95 + 1.2, -16.7); lamp(0x20ff60, 4, -6.4, Y - 0.95 + 1.2, 16.7);
  g.userData.strobe = lamp(0xffffff, 8, -19.6, Y + 8.4, 0);
  g.userData.landing = [lamp(0xfff2d8, 6, 2.6, Y - 0.9, 2.4), lamp(0xfff2d8, 6, 2.6, Y - 0.9, -2.4)];
  g.userData.door = door;
  return g;
};
})(window.G);
