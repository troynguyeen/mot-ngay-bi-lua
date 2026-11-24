// atmos.js — rain you can see: thousands of streaks animated entirely on the GPU (no per-drop JavaScript), falling
// at a slant with the wind, lit by the lamps, floodlights and searchlights they fall through, stopped by roofs; and
// splashes that crown on open ground. The wet ground itself (darkening, puddles, ripples) is in gfx.js.
(function (G) {
'use strict';
const T = G.T, scene = G.scene, camera = G.camera;
const MAXN = 16000, SPLASH = 3200, NL = 6;

// ---------------- streaks ----------------
const quad = new T.InstancedBufferGeometry();
quad.setAttribute('position', new T.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
quad.setIndex([0, 1, 2, 2, 1, 3]);
const seed = new Float32Array(MAXN * 4);
for (let i = 0; i < MAXN; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = i / MAXN; seed[i * 4 + 3] = Math.random(); }
quad.setAttribute('aSeed', new T.InstancedBufferAttribute(seed, 4));
quad.instanceCount = 0;
const LIGHTS_GLSL = `
uniform vec4 uL[ ${NL} ]; uniform vec3 uLC[ ${NL} ];
vec3 lightAt( vec3 p ) {
  vec3 c = vec3( 0.0 );
  for ( int i = 0; i < ${NL}; i ++ ) { float d = length( p - uL[ i ].xyz ); float a = clamp( 1.0 - d / max( uL[ i ].w, 0.01 ), 0.0, 1.0 ); c += uLC[ i ] * a * a; }
  return c;
}`;
const COMMON_U = () => ({
  uTime: { value: 0 }, uCam: { value: new T.Vector3() }, uRoof: G.gfxU.gfxRoof, uRoofB: G.gfxU.gfxRoofB,
  uL: { value: Array.from({ length: NL }, () => new T.Vector4(0, -999, 0, 0)) }, uLC: { value: Array.from({ length: NL }, () => new T.Vector3()) },
  uAmb: { value: new T.Color() },
});
const rainMat = new T.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, toneMapped: false, side: T.DoubleSide,
  uniforms: Object.assign(COMMON_U(), { uBox: { value: new T.Vector3(44, 26, 44) }, uSpeed: { value: 9.5 }, uWind: { value: new T.Vector2(1.2, 0.4) }, uLen: { value: 0.85 }, uWidth: { value: 0.009 }, uPix: { value: 0.001 }, uK: { value: 0 }, uAlpha: { value: 0.5 } }),
  vertexShader: `
attribute vec4 aSeed;
uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform float uSpeed; uniform vec2 uWind; uniform float uLen; uniform float uWidth; uniform float uPix; uniform float uK;
uniform sampler2D uRoof; uniform vec4 uRoofB; uniform vec3 uAmb;
varying vec2 vUv; varying float vA; varying vec3 vC;
${LIGHTS_GLSL}
void main() {
  float fall = uSpeed * ( 0.85 + 0.3 * aSeed.w );
  vec3 vel = vec3( uWind.x, - fall, uWind.y );
  float t = uTime + aSeed.w * 13.0;
  vec3 p;
  // positions are anchored in the world and wrap around a box that follows the camera
  p.y = uCam.y - 9.0 + mod( aSeed.y * uBox.y - t * fall, uBox.y );
  float drift = ( uCam.y - 9.0 + uBox.y - p.y ) / fall;          // how long it has been falling: wind carries it sideways
  p.x = uCam.x + mod( aSeed.x * uBox.x - uCam.x + uWind.x * drift, uBox.x ) - uBox.x * 0.5;
  p.z = uCam.z + mod( fract( aSeed.x * 7.13 + aSeed.w * 3.7 ) * uBox.z - uCam.z + uWind.y * drift, uBox.z ) - uBox.z * 0.5;
  float hide = step( uK, aSeed.z ) + step( p.y, 0.02 );
  vec4 rm = texture2D( uRoof, ( p.xz - uRoofB.xy ) * uRoofB.zw );
  hide += step( 0.5, rm.r ) * step( p.y, rm.g * 120.0 + 0.2 );
  vec3 dir = normalize( vel );
  vec3 toCam = uCam - p; float dist = length( toCam );
  vec3 side = normalize( cross( dir, toCam / max( dist, 1e-3 ) ) );
  float w = max( uWidth, dist * uPix * 1.1 );
  float len = uLen * ( 0.6 + 0.8 * aSeed.w ) * clamp( dist / 4.0, 0.35, 1.0 );
  vec3 wp = p + side * position.x * w - dir * position.y * len;
  if ( hide > 0.5 ) wp = vec3( 0.0, -9999.0, 0.0 );
  vUv = vec2( position.x + 0.5, position.y );
  // thinner than a pixel → fainter instead of thinner; very close drops fade so they don't streak across the screen
  vA = ( uWidth / w ) * smoothstep( 0.4, 1.6, dist ) * ( 1.0 - smoothstep( 22.0, 30.0, dist ) );
  vC = uAmb + lightAt( p );
  gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
}`,
  fragmentShader: `
uniform float uAlpha;
varying vec2 vUv; varying float vA; varying vec3 vC;
void main() {
  float a = vA * uAlpha * ( 1.0 - abs( vUv.x - 0.5 ) * 2.0 ) * smoothstep( 0.0, 0.25, vUv.y ) * smoothstep( 1.0, 0.55, vUv.y );
  if ( a < 0.002 ) discard;
  gl_FragColor = vec4( vC, a );
}`,
});
const rain = new T.Mesh(quad, rainMat); rain.frustumCulled = false; rain.renderOrder = 5; rain.visible = false; scene.add(rain);

// ---------------- splashes ----------------
const sq = new T.InstancedBufferGeometry();
sq.setAttribute('position', new T.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5], 3));
sq.setIndex([0, 2, 1, 1, 2, 3]);
const sseed = new Float32Array(SPLASH * 4);
for (let i = 0; i < SPLASH; i++) { sseed[i * 4] = Math.random(); sseed[i * 4 + 1] = Math.random(); sseed[i * 4 + 2] = i / SPLASH; sseed[i * 4 + 3] = Math.random(); }
sq.setAttribute('aSeed', new T.InstancedBufferAttribute(sseed, 4));
sq.instanceCount = 0;
const splashMat = new T.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, toneMapped: false,
  uniforms: Object.assign(COMMON_U(), { uR: { value: 16 }, uK: { value: 0 }, uAlpha: { value: 0.5 } }),
  vertexShader: `
attribute vec4 aSeed;
uniform float uTime; uniform vec3 uCam; uniform float uR; uniform float uK; uniform sampler2D uRoof; uniform vec4 uRoofB; uniform vec3 uAmb;
varying vec2 vUv; varying float vPh; varying vec3 vC; varying float vF;
${LIGHTS_GLSL}
void main() {
  float cyc = 0.55 + aSeed.w * 0.5, t = uTime / cyc + aSeed.y * 17.0;
  float k = floor( t ); vPh = fract( t );
  // every cycle the splash jumps to a new spot near the camera
  vec2 h = fract( vec2( sin( k * 12.9898 + aSeed.x * 78.233 ), sin( k * 39.346 + aSeed.y * 11.135 ) ) * 43758.5453 );
  vec2 xz = uCam.xz + ( h - 0.5 ) * 2.0 * uR;
  vec4 rm = texture2D( uRoof, ( xz - uRoofB.xy ) * uRoofB.zw );
  float hide = step( uK, aSeed.z ) + step( 0.5, rm.r ) + step( 0.3, vPh );
  float s = 0.07 + 0.08 * aSeed.w;
  vec3 wp = vec3( xz.x, 0.035, xz.y ) + position * s;
  if ( hide > 0.5 ) wp = vec3( 0.0, -9999.0, 0.0 );
  vUv = position.xz + 0.5;
  vC = uAmb + lightAt( wp );
  // far splashes are a pixel or two: they fade out instead of sparkling
  vF = 1.0 - smoothstep( 6.0, 14.0, distance( wp, uCam ) );
  gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
}`,
  fragmentShader: `
uniform float uAlpha;
varying vec2 vUv; varying float vPh; varying vec3 vC; varying float vF;
void main() {
  float p = vPh / 0.3;
  vec2 d = vUv - 0.5; float r = length( d ) * 2.0;
  float ring = smoothstep( 0.1, 0.0, abs( r - p * 0.85 ) ) * ( 1.0 - p ) * 0.7;
  float core = smoothstep( 0.22, 0.0, r ) * ( 1.0 - smoothstep( 0.0, 0.35, p ) ) * 1.4;
  float a = ( ring + core ) * uAlpha * vF;
  if ( a < 0.003 ) discard;
  gl_FragColor = vec4( vC * 1.3, a );
}`,
});
const splash = new T.Mesh(sq, splashMat); splash.frustumCulled = false; splash.renderOrder = 4; splash.visible = false; scene.add(splash);

// ---------------- state ----------------
const _c = new T.Vector3();
let k = 0, t0 = performance.now();
G.rainFx = {
  set(v) { k = Math.max(0, v || 0); rain.visible = splash.visible = k > 0; },
  tick() {
    if (!rain.visible) return;
    const P = (G.gfx && G.gfx.P) || {}, q = P.rain !== undefined ? P.rain : 1;
    const n = Math.min(MAXN, Math.round(12000 * k * q));
    quad.instanceCount = MAXN; splash.geometry.instanceCount = SPLASH;
    rainMat.uniforms.uK.value = n / MAXN; splashMat.uniforms.uK.value = Math.min(1, k * q * 0.9);
    const t = (performance.now() - t0) / 1000;
    camera.getWorldPosition(_c);
    for (const m of [rainMat, splashMat]) { m.uniforms.uTime.value = t; m.uniforms.uCam.value.copy(_c); }
    // wind per place (a jungle storm blows harder)
    const lv = G.levelName;
    rainMat.uniforms.uWind.value.set(lv === 'jungle' ? 2.4 : 1.2, lv === 'jungle' ? 0.9 : 0.4);
    // pixel size at 1 m (keeps far streaks a pixel wide but fainter)
    const h = (G.renderer.domElement.height || 1080) * (G.gfx ? G.gfx.scale : 1);
    rainMat.uniforms.uPix.value = 2 * Math.tan(camera.fov * Math.PI / 360) / h;
    // ambient brightness of the drops follows the sky / fog; lights they fall through make them shine
    const amb = rainMat.uniforms.uAmb.value.copy(scene.fog ? scene.fog.color : new T.Color(0.2, 0.2, 0.2)).multiplyScalar(1.6).addScalar(0.045);
    splashMat.uniforms.uAmb.value.copy(amb);
    rainMat.uniforms.uAlpha.value = 0.32 + 0.25 * k; splashMat.uniforms.uAlpha.value = 0.25 + 0.25 * k;
    const lit = (G.emitters || []).filter((e) => e.cur && e.on()).slice(0, NL);
    for (let i = 0; i < NL; i++) {
      const e = lit[i];
      for (const m of [rainMat, splashMat]) {
        if (e) { m.uniforms.uL.value[i].set(e.target.x * 0.35 + e.pos.x * 0.65, e.pos.y * 0.5, e.target.z * 0.35 + e.pos.z * 0.65, Math.max(6, e.range * 0.55)); m.uniforms.uLC.value[i].set(e.color.r, e.color.g, e.color.b).multiplyScalar(Math.min(4, e.intensity * 0.3)); }
        else { m.uniforms.uL.value[i].set(0, -999, 0, 0); m.uniforms.uLC.value[i].set(0, 0, 0); }
      }
    }
  },
};
if (G.rainK) G.rainFx.set(G.rainK);
})(window.G);
