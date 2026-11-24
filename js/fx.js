// fx.js — fire that moves: each fire is a few camera-facing flame sheets with rising turbulence (HDR, so it blooms),
// sparks that drift up and die, and smoke that rises, spreads and thins out — plus the flickering light it gives.
// Also an animated glow for the kiln mouths. All drawn in the soft pass (fades into floors and walls).
(function (G) {
'use strict';
const T = G.T, C = G.C;
const NOISE = `
float fxH( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
float fxN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( fxH( i ), fxH( i + vec2( 1.0, 0.0 ) ), f.x ), mix( fxH( i + vec2( 0.0, 1.0 ) ), fxH( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
float fxF( vec2 p ) { float s = 0.0, a = 0.5; for ( int i = 0; i < 4; i ++ ) { s += a * fxN( p ); p = p * 2.07 + 1.3; a *= 0.5; } return s; }
`;
const SOFT = `
uniform sampler2D tDepth; uniform vec2 uRes; uniform vec2 uNF; uniform float uSoftOn;
float fxSoft( float k ) {
  if ( uSoftOn < 0.5 ) return 1.0;
  float d = texture2D( tDepth, gl_FragCoord.xy / uRes ).x;
  float sz = uNF.x * uNF.y / ( uNF.y - d * ( uNF.y - uNF.x ) ), fz = uNF.x * uNF.y / ( uNF.y - gl_FragCoord.z * ( uNF.y - uNF.x ) );
  return clamp( ( sz - fz ) / k, 0.0, 1.0 );
}`;
const BU = () => G.beamUniforms; // depth texture etc. for the soft pass (lights.js / gfx.js)
const shared = () => ({ tDepth: BU().tDepth, uRes: BU().uRes, uNF: BU().uNF, uSoftOn: BU().uSoftOn, uTime: BU().uTime });

// flame sheets: 3 vertical quads, turned to the camera around the vertical axis
function flameGeo() {
  const g = new T.BufferGeometry(), p = [], uv = [], sd = [], ix = [];
  for (let i = 0; i < 3; i++) {
    const s0 = p.length / 3, w = [1, 0.8, 0.65][i], h = [1, 1.25, 0.85][i], ox = [0, 0.12, -0.14][i], oz = [0, -0.08, 0.1][i];
    [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]].forEach(([x, y]) => { p.push(x * w, y * h, 0); uv.push(x + 0.5, y); sd.push(i * 0.37 + 0.11, ox, oz); });
    ix.push(s0, s0 + 1, s0 + 2, s0 + 2, s0 + 1, s0 + 3);
  }
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('aSeed', new T.Float32BufferAttribute(sd, 3));
  g.setIndex(ix); g.boundingSphere = new T.Sphere(new T.Vector3(0, 0.5, 0), 2); return g;
}
let FLAME_MAT = null;
function flameMat() {
  if (FLAME_MAT) return FLAME_MAT;
  FLAME_MAT = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false, fog: false,
    uniforms: Object.assign(shared(), { uI: { value: 5.0 } }),
    vertexShader: `
attribute vec3 aSeed; varying vec2 vUv; varying float vS; varying float vNear;
void main() {
  vec3 c = ( modelMatrix * vec4( aSeed.y, 0.0, aSeed.z, 1.0 ) ).xyz;
  float sc = length( modelMatrix[ 0 ].xyz );
  vec3 tc = cameraPosition - c; tc.y = 0.0; vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), normalize( tc + vec3( 1e-4 ) ) ) );
  vec3 wp = c + right * position.x * sc + vec3( 0.0, position.y * sc, 0.0 );
  vUv = uv; vS = aSeed.x; vNear = smoothstep( 0.35, 1.4, length( cameraPosition - wp ) );
  gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
}`,
    fragmentShader: NOISE + SOFT + `
uniform float uTime; uniform float uI; varying vec2 vUv; varying float vS; varying float vNear;
void main() {
  float t = uTime * 1.0 + vS * 17.0;
  vec2 q = vec2( ( vUv.x - 0.5 ), vUv.y );
  float n = fxF( vec2( q.x * 4.0 + vS * 9.0, q.y * 3.0 - t * 2.4 ) );
  float n2 = fxF( vec2( q.x * 9.0 - vS * 5.0, q.y * 6.0 - t * 4.1 ) );
  q.x += ( n - 0.5 ) * 0.28 * q.y;
  float w = mix( 0.42, 0.06, pow( q.y, 0.8 ) );
  float body = smoothstep( w, w * 0.25, abs( q.x ) ) * smoothstep( 0.0, 0.08, q.y );
  float f = body * ( 0.55 + 0.75 * n ) * ( 0.75 + 0.5 * n2 ) - q.y * 0.65;
  f = clamp( f * 1.9, 0.0, 1.0 );
  vec3 col = mix( vec3( 0.9, 0.12, 0.02 ), vec3( 1.0, 0.55, 0.12 ), smoothstep( 0.2, 0.6, f ) );
  col = mix( col, vec3( 1.0, 0.92, 0.7 ), smoothstep( 0.72, 1.0, f ) );
  gl_FragColor = vec4( col * f * uI * vNear * fxSoft( 0.25 ), 1.0 );
}`,
  });
  return FLAME_MAT;
}
// particles (sparks / smoke): instanced quads, all motion in the vertex shader from (time + seed)
function particleGeo(n) {
  const g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0], 3));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  const s = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) s[i] = Math.random();
  g.setAttribute('aSeed', new T.InstancedBufferAttribute(s, 4)); g.instanceCount = n;
  return g;
}
const PART_VS = (smoke) => `
attribute vec4 aSeed; uniform float uTime; varying vec2 vUv; varying float vLife; varying float vSeed; varying float vNear;
void main() {
  float life = ${smoke ? '3.2' : '1.4'} * ( 0.7 + 0.6 * aSeed.w );
  float t = mod( uTime + aSeed.x * life * 3.0, life ) / life; vLife = t; vSeed = aSeed.y;
  float sc = length( modelMatrix[ 0 ].xyz );
  vec3 o = ( modelMatrix * vec4( 0.0, ${smoke ? '0.9' : '0.3'}, 0.0, 1.0 ) ).xyz;
  float a = aSeed.y * 6.2831;
  vec3 drift = vec3( cos( a ), 0.0, sin( a ) ) * ( ${smoke ? '0.55' : '0.35'} * t + 0.08 * sin( t * 9.0 + aSeed.z * 20.0 ) );
  vec3 c = o + ( drift + vec3( 0.25, ${smoke ? '2.6' : '2.2'} * t * ( 0.7 + 0.6 * aSeed.z ), 0.12 ) * vec3( t, 1.0, t ) ) * sc;
  float size = ${smoke ? '( 0.35 + 1.4 * t )' : '0.035'} * sc;
  vec3 right = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] ), up = vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] );
  vec3 wp = c + ( right * position.x + up * position.y ) * size;
  vUv = position.xy + 0.5;
  // anything drifting right past the lens fades out instead of filling the screen
  vNear = smoothstep( 0.4, 1.6, length( cameraPosition - c ) );
  gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
}`;
let SPARK_MAT = null, SMOKE_MAT = null;
function sparkMat() {
  return SPARK_MAT || (SPARK_MAT = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false, uniforms: shared(),
    vertexShader: PART_VS(false),
    fragmentShader: `varying vec2 vUv; varying float vLife; varying float vSeed; varying float vNear;
void main() { float d = length( vUv - 0.5 ) * 2.0; float a = vNear * smoothstep( 1.0, 0.0, d ) * ( 1.0 - vLife ) * step( 0.35, vSeed ) * ( 0.6 + 0.4 * sin( vLife * 40.0 + vSeed * 30.0 ) );
  gl_FragColor = vec4( vec3( 1.0, 0.55, 0.15 ) * a * 7.0, 1.0 ); }`,
  }));
}
function smokeMat() {
  return SMOKE_MAT || (SMOKE_MAT = new T.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, fog: false, uniforms: Object.assign(shared(), { uC: { value: new T.Color(0.05, 0.05, 0.05) } }),
    vertexShader: PART_VS(true),
    fragmentShader: NOISE + SOFT + `uniform float uTime; uniform vec3 uC; varying vec2 vUv; varying float vLife; varying float vSeed; varying float vNear;
void main() {
  vec2 q = vUv - 0.5; float d = length( q ) * 2.0;
  float n = fxF( q * 3.0 + vec2( vSeed * 7.0, - uTime * 0.3 ) );
  float a = smoothstep( 1.0, 0.2, d + ( n - 0.5 ) * 0.6 ) * smoothstep( 0.0, 0.15, vLife ) * ( 1.0 - vLife ) * 0.35;
  vec3 c = uC * ( 0.7 + 0.6 * n ) + vec3( 0.35, 0.12, 0.03 ) * ( 1.0 - smoothstep( 0.0, 0.35, vLife ) ) * 0.6;
  gl_FragColor = vec4( c, a * vNear * fxSoft( 0.6 ) );
}`,
  }));
}
// a fire at (x, y, z), size s: flames, sparks, smoke on the soft layer; returns the group
// o: { flame: false } for just sparks and smoke (e.g. out of a kiln mouth), sparks / smoke: particle counts
G.fireFx = function (x, y, z, s, parent, o) {
  o = o || {};
  const g = new T.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  if (o.flame !== false) { const fl = new T.Mesh(flameGeo(), flameMat()); fl.frustumCulled = false; fl.scale.set(0.9, 1.15, 0.9); g.add(fl); }
  const ns = o.sparks !== undefined ? o.sparks : 26, nm = o.smoke !== undefined ? o.smoke : 14;
  if (ns) { const sp = new T.Mesh(particleGeo(ns), sparkMat()); sp.frustumCulled = false; g.add(sp); }
  if (nm) { const sm = new T.Mesh(particleGeo(nm), smokeMat()); sm.frustumCulled = false; sm.renderOrder = -1; g.add(sm); }
  G.softLayer(g);
  (parent || G.root || G.scene).add(g);
  return g;
};
// the glowing mouth of a kiln: an animated ember / flame glow on a plane (w × h)
G.emberGlowMaterial = function (k) {
  const m = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false, side: T.DoubleSide,
    uniforms: { uTime: BU().uTime, uK: { value: k || 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
    fragmentShader: NOISE + `uniform float uTime; uniform float uK; varying vec2 vUv;
void main() {
  vec2 q = vUv;
  float n = fxF( vec2( q.x * 5.0, q.y * 3.0 - uTime * 0.8 ) ), n2 = fxF( vec2( q.x * 11.0 + 3.0, q.y * 7.0 - uTime * 1.7 ) );
  float bed = smoothstep( 0.55, 0.0, q.y ) * ( 0.55 + 0.6 * n2 );
  float flame = smoothstep( 0.95, 0.15, q.y ) * smoothstep( 0.45, 0.75, n + ( 0.5 - q.y ) * 0.4 );
  float edge = smoothstep( 0.0, 0.12, q.x ) * smoothstep( 1.0, 0.88, q.x ) * smoothstep( 1.0, 0.85, q.y );
  float f = clamp( ( bed + flame * 0.8 ) * edge, 0.0, 1.5 );
  vec3 c = mix( vec3( 0.6, 0.06, 0.01 ), vec3( 1.0, 0.45, 0.08 ), clamp( f, 0.0, 1.0 ) );
  c = mix( c, vec3( 1.0, 0.85, 0.5 ), smoothstep( 1.0, 1.4, f ) );
  gl_FragColor = vec4( c * f * 2.6 * uK, 1.0 );
}`,
  });
  return m;
};
})(window.G);
