// lights.js — real light for the things that only looked lit before.
//  · Emitters: searchlights, guards' flashlights, yard floodlights and street lamps register here (G.addEmitter).
//  · A fixed pool of SpotLights (0 on Thấp … 8 on Rất cao; the first one or two cast shadows) is handed every frame to
//    the emitters that matter most near the camera, so beams light the ground, walls and people — and throw shadows —
//    without changing the number of lights (which would force every shader to recompile).
//  · Volumetric beam material: soft cone edges, brightest at the lamp, drifting dust and rain, and (with MSAA) a soft
//    fade where the beam meets walls and floors, drawn in a second pass after the opaque scene (layer 1).
(function (G) {
'use strict';
const T = G.T, scene = G.scene, camera = G.camera;
const SOFT = 1; // layer for the soft-particle pass (gfx.js draws it after the opaque scene)
G.SOFT_LAYER = SOFT;

// ---------------- emitters ----------------
G.emitters = [];
G.addEmitter = function (e) {
  e = Object.assign({ kind: 'lamp', pos: new T.Vector3(), target: new T.Vector3(), angle: 0.6, penumbra: 0.6, color: new T.Color(1, 0.85, 0.6), intensity: 3, range: 25, decay: 1.4, prio: 1, shadow: false, on: () => true, w: 0 }, e);
  G.emitters.push(e); return e;
};
const origLoad = G.loadLevel;
G.loadLevel = function (name) { G.emitters.length = 0; const cfg = origLoad(name); collectPoints(); return cfg; };

// ---------------- the pool ----------------
const pool = [];
let poolN = -1, shadowN = -1;
function buildPool(n, ns) {
  if (n === poolN && ns === shadowN) return;
  for (const p of pool) { scene.remove(p.light); scene.remove(p.light.target); if (p.light.shadow && p.light.shadow.map) p.light.shadow.map.dispose(); }
  pool.length = 0;
  for (let i = 0; i < n; i++) {
    const L = new T.SpotLight(0xffffff, 0, 30, 0.5, 0.5, 1.4);
    L.castShadow = i < ns;
    if (L.castShadow) {
      const hi = G.gfx && G.gfx.P.shadow >= 3;
      L.shadow.mapSize.set(hi ? 1024 : 512, hi ? 1024 : 512); L.shadow.bias = -0.0006; L.shadow.normalBias = 0.025; L.shadow.camera.near = 0.5;
    }
    scene.add(L); scene.add(L.target);
    pool.push({ light: L, em: null, k: 0 });
  }
  poolN = n; shadowN = ns;
  if (G.gfxRecompile) G.gfxRecompile();
}
G.lightPoolSize = () => poolN;
const _v = new T.Vector3();
function score(e) {
  if (!e.on()) return 0;
  const c = camera.position, d2 = (e.target.x - c.x) ** 2 + (e.target.z - c.z) ** 2 + 0.3 * ((e.pos.x - c.x) ** 2 + (e.pos.z - c.z) ** 2);
  return e.prio * (1 + e.intensity * 0.1) / (1 + d2 / (e.range * e.range * 0.6)) * (e.cur ? 1.35 : 1);
}
// ---------------- point lights: a fixed pool as well ----------------
// Levels add plain PointLights wherever they like (fires, rooms, lamps, police lights) and keep animating them.
// Those become virtual: hidden from the renderer (a layer no camera sees), and every frame the ones that matter most
// for the view are copied into a small fixed set of real PointLights (3 on Thấp … 12 on Rất cao, never more than the
// level has) — so every lit shader loops over a few lights instead of all of them, and the count never changes
// mid-game (no recompiles).
const HIDDEN = 31;
const virt = [], ppool = []; let ppN = -1;
function collectPoints() {
  virt.length = 0;
  (G.root || scene).traverse((o) => { if (o.isPointLight && !o.userData.poolSlot) { o.layers.set(HIDDEN); virt.push({ L: o, cur: false }); } });
  ppN = -1; // resize the pool for this level on the next frame
}
G.collectPointLights = collectPoints;
function buildPPool(n) {
  if (n === ppN) return;
  for (const p of ppool) scene.remove(p.L);
  ppool.length = 0;
  for (let i = 0; i < n; i++) { const L = new T.PointLight(0xffffff, 0, 10, 1.5); L.userData.poolSlot = true; scene.add(L); ppool.push({ L, v: null, k: 0 }); }
  ppN = n;
}
const _fr = new T.Frustum(), _pm = new T.Matrix4(), _sph = new T.Sphere(), _wp = new T.Vector3();
function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
function updatePoints(dt) {
  const P = (G.gfx && G.gfx.P) || {};
  const max = P.points !== undefined ? P.points : 12;
  buildPPool(Math.min(max, virt.length));
  if (!ppN) return;
  camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
  const c = camera.position, cand = [];
  for (const v of virt) {
    const L = v.L; v.s = 0;
    if (L.intensity <= 0.001 || !shown(L)) continue;
    L.getWorldPosition(_wp); const R = L.distance > 0 ? L.distance : 60;
    _sph.set(_wp, R); if (!_fr.intersectsSphere(_sph)) continue;
    const d = _wp.distanceTo(c), q = R / Math.max(d, R * 0.35);
    v.s = L.intensity * q * q * (v.cur ? 1.3 : 1); v.p = v.p || new T.Vector3(); v.p.copy(_wp);
    cand.push(v);
  }
  cand.sort((a, b) => b.s - a.s);
  const want = cand.slice(0, ppN);
  for (const v of virt) v.cur = false;
  // keep a light on the slot it already had (no flicker when the order changes)
  const assigned = new Array(ppN).fill(null);
  for (const v of want) { const i = ppool.findIndex((p) => p.v === v); if (i >= 0) assigned[i] = v; }
  for (const v of want) { if (assigned.includes(v)) continue; const i = assigned.indexOf(null); if (i >= 0) assigned[i] = v; }
  for (let i = 0; i < ppN; i++) {
    const p = ppool[i], v = assigned[i], L = p.L;
    if (v !== p.v) { p.v = v; p.k = v && virt.length <= ppN ? 1 : 0; }
    if (!v) { L.intensity = 0; continue; }
    v.cur = true; p.k = Math.min(1, p.k + dt * 4);
    const S = v.L; L.position.copy(v.p); L.color.copy(S.color); L.distance = S.distance; L.decay = S.decay; L.intensity = S.intensity * p.k;
  }
}
G.updateLightPool = function (dt) {
  updatePoints(dt);
  const P = (G.gfx && G.gfx.P) || {};
  const n = P.spots !== undefined ? P.spots : 0, ns = Math.min(n, P.spotShadows || 0);
  buildPool(n, ns);
  if (!n) { for (const e of G.emitters) e.cur = false; return; }
  const list = G.emitters.map((e) => { e.s = score(e); return e; }).filter((e) => e.s > 0.002).sort((a, b) => b.s - a.s);
  const want = list.slice(0, n);
  // shadow slots go to the best emitters that cast shadows, the rest fill the plain slots
  const shadowFirst = want.filter((e) => e.shadow).slice(0, ns), rest = want.filter((e) => !shadowFirst.includes(e));
  const order = shadowFirst.concat(rest);
  for (const e of G.emitters) e.cur = false;
  // keep an emitter on the slot it already had when possible (less popping)
  const slots = pool.map((p) => p.em);
  const assigned = new Array(n).fill(null);
  order.forEach((e) => { const i = slots.indexOf(e); if (i >= 0 && (i < ns) === (shadowFirst.includes(e)) && !assigned[i]) assigned[i] = e; });
  for (const e of order) {
    if (assigned.includes(e)) continue;
    const isS = shadowFirst.includes(e);
    let i = -1;
    for (let j = 0; j < n; j++) if (!assigned[j] && (isS ? j < ns : j >= ns)) { i = j; break; }
    if (i < 0) for (let j = 0; j < n; j++) if (!assigned[j]) { i = j; break; }
    if (i >= 0) assigned[i] = e;
  }
  for (let i = 0; i < n; i++) {
    const p = pool[i], e = assigned[i], L = p.light;
    if (e !== p.em) { p.em = e; p.k = 0; }
    if (!e) { L.intensity = 0; if (L.castShadow) L.shadow.autoUpdate = false; continue; }
    e.cur = true;
    p.k = Math.min(1, p.k + dt * 5);
    L.position.copy(e.pos); L.target.position.copy(e.target);
    L.angle = e.angle; L.penumbra = e.penumbra; L.distance = e.range; L.decay = e.decay;
    L.color.copy(e.color); L.intensity = e.intensity * p.k * (e.flicker ? e.flicker() : 1);
    if (L.castShadow) L.shadow.autoUpdate = true;
    L.target.updateMatrixWorld();
  }
};

// ---------------- volumetric beam material ----------------
const BEAM_VS = `
varying vec3 vN; varying vec3 vV; varying float vAlong; varying vec3 vW;
void main() {
  vAlong = uv.y;                             // the cone's narrow end (uv.y = 0) sits at the lamp … 1 at the far end
  vec4 wp = modelMatrix * vec4( position, 1.0 ); vW = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vN = normalize( normalMatrix * normal ); vV = - mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FS = `
uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uSoftOn;
uniform sampler2D tDepth; uniform vec2 uRes; uniform vec2 uNF;
varying vec3 vN; varying vec3 vV; varying float vAlong; varying vec3 vW;
float hash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float noise( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( hash( i ), hash( i + vec3( 1, 0, 0 ) ), f.x ), mix( hash( i + vec3( 0, 1, 0 ) ), hash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( hash( i + vec3( 0, 0, 1 ) ), hash( i + vec3( 1, 0, 1 ) ), f.x ), mix( hash( i + vec3( 0, 1, 1 ) ), hash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
float linZ( float d ) { return uNF.x * uNF.y / ( uNF.y - d * ( uNF.y - uNF.x ) ); }
void main() {
  float facing = abs( dot( normalize( vN ), normalize( vV ) ) );
  float edge = pow( clamp( facing, 0.0, 1.0 ), 1.6 );                          // fades out toward the cone's silhouette
  float al = clamp( vAlong, 0.0, 1.0 );
  float along = smoothstep( 0.0, 0.06, al ) * pow( 1.0 - al, 1.4 ) + 0.08 * ( 1.0 - al );
  float dust = 0.65 + 0.35 * noise( vW * 1.7 + vec3( 0.0, - uTime * 0.6, uTime * 0.2 ) ) + 0.25 * noise( vW * 6.0 + vec3( uTime * 0.3, - uTime * 2.5, 0.0 ) );
  float soft = 1.0;
  if ( uSoftOn > 0.5 ) {
    float sz = linZ( texture2D( tDepth, gl_FragCoord.xy / uRes ).x );
    float fz = linZ( gl_FragCoord.z );
    soft = clamp( ( sz - fz ) / 0.9, 0.0, 1.0 );
  }
  float a = uOpacity * edge * along * dust * soft;
  gl_FragColor = vec4( uColor * max( a, 0.0 ), 1.0 );
}`;
const beamU = { tDepth: { value: null }, uRes: { value: new T.Vector2(1, 1) }, uNF: { value: new T.Vector2(0.1, 800) }, uTime: { value: 0 }, uSoftOn: { value: 0 } };
G.beamUniforms = beamU;
G.beamMaterial = function (color, opacity) {
  const m = new T.ShaderMaterial({
    vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false, fog: false,
    uniforms: { uColor: { value: new T.Color(color) }, uOpacity: { value: opacity || 0 }, tDepth: beamU.tDepth, uRes: beamU.uRes, uNF: beamU.uNF, uTime: beamU.uTime, uSoftOn: beamU.uSoftOn },
  });
  m.isBeam = true;
  return m;
};
// put an object on the soft (second) pass
G.softLayer = (o) => { o.layers.set(SOFT); o.traverse((c) => c.layers.set(SOFT)); return o; };

// ---------------- glowing bulbs: an HDR sprite that blooms ----------------
const glowTex = G.TX.glow;
G.glow = function (color, size, intensity, parent) {
  const m = new T.SpriteMaterial({ map: glowTex, color: new T.Color(color).multiplyScalar(intensity || 3), blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const s = new T.Sprite(m); s.scale.set(size, size, 1); (parent || G.root || scene).add(s); return s;
};
})(window.G);
