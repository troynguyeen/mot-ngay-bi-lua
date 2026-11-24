// gfx.js — graphics settings and the render pipeline.
//  · Settings: quality preset (Tự động / Thấp / Trung bình / Cao / Rất cao, plus advanced overrides), render resolution
//    (HD 720p → 4K 2160p, or the screen's own), dynamic resolution, FPS cap and an FPS counter. Remembered per browser.
//  · Pipeline: scene → HDR target (MSAA) → SSAO (from depth, bilateral blur) → bloom (13-tap mip chain) → composite
//    (exposure, ACES, colour grade, contrast-adaptive sharpening, vignette, grain, dither) → FXAA when there is no MSAA.
//  · Global shader upgrades for every material: exponential height fog lit by the sun / moon, sky visibility under
//    roofs (no sky light indoors), anti-tiling macro variation, rain-soaked surfaces with puddles and ripples.
//  · Image-based lighting: the sky is rendered into a PMREM environment map whenever it changes.
(function (G) {
'use strict';
const T = G.T, R = G.renderer, scene = G.scene, camera = G.camera;
const gl = R.getContext(), caps = R.capabilities, GL2 = caps.isWebGL2;
const ext = (n) => { try { return gl.getExtension(n); } catch (e) { return null; } };
const HALF = GL2 ? !!(ext('EXT_color_buffer_float') || ext('EXT_color_buffer_half_float')) : !!(ext('OES_texture_half_float') && ext('EXT_color_buffer_half_float'));
if (!GL2) { ext('OES_texture_half_float_linear'); ext('OES_standard_derivatives'); }
const DEPTHTEX = GL2 || !!ext('WEBGL_depth_texture');
const PIPE = DEPTHTEX;                                   // the post pipeline needs a depth texture (SSAO); HDR needs HALF
const HDR_TYPE = HALF ? T.HalfFloatType : T.UnsignedByteType;
const MAX_RB = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096);
const GPU = (() => { const d = ext('WEBGL_debug_renderer_info'); try { return String(gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch (e) { return ''; } })();
R.info.autoReset = false;

// ---------------- GPU tier → default preset ----------------
function tierOf(name) {
  const n = name.toLowerCase();
  if (!GL2 || !HALF || /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen/.test(n)) return 'low';
  let m = n.match(/rtx\s*a?(\d{4})/);
  if (m) { const v = +m[1]; return Math.floor(v / 1000) >= 4 || v % 100 >= 70 ? 'ultra' : 'high'; }
  if (/rx\s*(6[6-9]|7[6-9]|9\d)\d\d/.test(n)) return 'ultra';
  if (/gtx\s*(16|10)\d\d|gtx\s*9[78]0|quadro|rx\s*\d{3,4}|radeon pro|vega\s*(56|64)|radeon vii|arc\s*a?\d|apple m\d (pro|max|ultra)/.test(n)) return 'high';
  if (/apple m\d|iris|radeon\(tm\)|radeon graphics|780m|680m|890m|880m/.test(n)) return 'medium';
  if (/intel|uhd|hd graphics|mali|adreno|powervr|apple|vivante/.test(n)) return 'low';
  return 'medium';
}

// ---------------- presets ----------------
// aa: MSAA samples (0 = none), fxaa: post AA when there is no MSAA, ssao 0/1(half)/2(full), shadow 0..3, refl 0..2 (reserved),
// tex: procedural texture size, autoPR: max pixel ratio for "Tự động" resolution, surf: wet / puddle shaders, macro: anti-tiling
const PRESETS = {
  low:    { aa: 0, fxaa: 1, ssao: 0, bloom: 0, shadow: 1, refl: 0, tex: 512,  aniso: 4,  sharp: 0.25, grain: 0, autoPR: 1,    surf: 1, macro: 1, rain: 0.55, ibl: 1, ca: 0, spots: 0, spotShadows: 0, points: 3, bevel: 0 },
  medium: { aa: 2, fxaa: 0, ssao: 0, bloom: 1, shadow: 2, refl: 0, tex: 1024, aniso: 8,  sharp: 0.3,  grain: 0, autoPR: 1.25, surf: 1, macro: 1, rain: 0.8,  ibl: 1, ca: 0, spots: 4, spotShadows: 0, points: 5, bevel: 1 },
  high:   { aa: 4, fxaa: 0, ssao: 1, bloom: 1, shadow: 2, refl: 1, tex: 1024, aniso: 16, sharp: 0.35, grain: 1, autoPR: 2,    surf: 1, macro: 1, rain: 1,    ibl: 1, ca: 0, spots: 6, spotShadows: 1, points: 8, bevel: 1 },
  ultra:  { aa: 4, fxaa: 0, ssao: 2, bloom: 1, shadow: 3, refl: 2, tex: 2048, aniso: 16, sharp: 0.4,  grain: 1, autoPR: 2,    surf: 1, macro: 1, rain: 1.3,  ibl: 1, ca: 1, spots: 8, spotShadows: 2, points: 12, bevel: 1 },
  // phones (iPhone 13 class at Full HD, 60 fps): drawn straight to the screen (no HDR target or full-screen passes — on a
  // phone GPU those alone cost more than a frame), Full HD by default, sun shadows redrawn 30 times a second, lighter
  // people and crowds, fewer lamps. pipe: 0 = no post pipeline; autoRes: lines of the auto resolution
  mobile: { pipe: 0, aa: 0, fxaa: 0, ssao: 0, bloom: 0, shadow: 1, refl: 0, tex: 512, aniso: 2, sharp: 0, grain: 0, autoPR: 3, autoRes: 1080, surf: 0, macro: 0, rain: 0.4, ibl: 0, ca: 0, spots: 0, spotShadows: 0, points: 2, bevel: 0, shadowHz: 30, lodNear: 5, lodFar: 13, crowd: 1, vegNear: 0.3, grass: 0.3 },
};
const ORDER = ['low', 'medium', 'high', 'ultra'];
const NAMES = { auto: 'Tự động', low: 'Thấp', medium: 'Trung bình', high: 'Cao', ultra: 'Rất cao', mobile: 'Điện thoại' };
const SHADOWS = [null, { size: 1024, range: 22, type: 'pcf' }, { size: 2048, range: 30, type: 'soft' }, { size: 4096, range: 36, type: 'soft' }];
const RES = { auto: 0, 720: 720, 900: 900, 1080: 1080, 1440: 1440, 2160: 2160 };
const KEY = 'mnbl-gfx-v1';

const Q = G.gfx = { preset: 'auto', res: 'auto', dyn: true, cap: 0, fps: false, over: {}, tierAdj: 0, tier: tierOf(GPU), gpu: GPU, gl2: GL2, half: HALF, pipe: PIPE, scale: 1, fpsNow: 0, gpuMs: 0, P: {} };
try {
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s && typeof s === 'object') for (const k of ['preset', 'res', 'dyn', 'cap', 'fps', 'over', 'tierAdj']) if (s[k] !== undefined && s[k] !== null) Q[k] = s[k];
  if (!Q.over || typeof Q.over !== 'object') Q.over = {};
  // phones: settings saved before the phone preset existed go back to Tự động once (the resolution choice is kept)
  if (G.mobile && s && typeof s === 'object' && !s.m2) { Q.preset = 'auto'; Q.over = {}; Q.tierAdj = 0; }
} catch (e) { /* storage blocked: defaults */ }
Q.save = () => { try { localStorage.setItem(KEY, JSON.stringify({ preset: Q.preset, res: Q.res, dyn: Q.dyn, cap: Q.cap, fps: Q.fps, over: Q.over, tierAdj: Q.tierAdj, m2: 1 })); } catch (e) { /* storage blocked */ } };
Q.eff = () => {
  if (Q.preset !== 'auto' && PRESETS[Q.preset]) return Q.preset;
  if (G.mobile) return 'mobile';
  const i = Math.max(0, ORDER.indexOf(Q.tier) - (Q.tierAdj | 0)); return ORDER[i];
};
Q.names = NAMES;

// ---------------- shared uniforms for the global shader upgrades ----------------
const emptyRoof = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, T.RGBAFormat);
emptyRoof.needsUpdate = true;
// small tiling noise (R: broad fbm, G: mid fbm, B: puddle blobs, A: white noise) for macro variation and puddles
const noiseTex = (() => {
  const N = 256, data = new Uint8Array(N * N * 4);
  const lat = (s, p) => { const a = new Float32Array(p * p); let x = s; for (let i = 0; i < a.length; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; a[i] = x / 0x7fffffff; } return a; };
  const vn = (L, p, x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const g = (i, j) => L[((j % p + p) % p) * p + ((i % p + p) % p)]; const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; };
  const fbm = (seed, base, oct, x, y) => { let s = 0, amp = 0.5, tot = 0; for (let o = 0; o < oct; o++) { const p = base << o; s += amp * vn(lats[seed][o], p, x * p, y * p); tot += amp; amp *= 0.5; } return s / tot; };
  const lats = [0, 1, 2].map((s) => [0, 1, 2, 3, 4, 5].map((o) => lat(7919 * (s + 1) + o * 131, 4 << o)));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = (y * N + x) * 4;
    data[i] = Math.round(255 * fbm(0, 4, 5, u, v));
    data[i + 1] = Math.round(255 * fbm(1, 8, 4, u, v));
    data[i + 2] = Math.round(255 * Math.min(1, Math.max(0, (fbm(2, 4, 4, u, v) - 0.5) * 2.2 + 0.5)));
    data[i + 3] = (Math.random() * 255) | 0;
  }
  const t = new T.DataTexture(data, N, N, T.RGBAFormat);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
})();
G.gfxNoiseTex = noiseTex;
const SU = G.gfxU = {
  gfxCam: { value: new T.Vector3() }, gfxFogP: { value: new T.Vector4(0.01, 0.025, 0, 1) },
  gfxSunDir: { value: new T.Vector3(0, 1, 0) }, gfxSunCol: { value: new T.Color(0, 0, 0) },
  gfxRoof: { value: emptyRoof }, gfxRoofB: { value: new T.Vector4(0, 0, 0, 0) }, gfxNoise: { value: noiseTex },
  gfxWet: { value: 0 }, gfxRain: { value: 0 }, gfxTime: { value: 0 }, gfxMacro: { value: 1 },
};

// fog: exponential height fog with a sun / moon glow, replacing three's linear fog for every patched material
T.ShaderChunk.fog_pars_fragment = [
  '#ifdef USE_FOG',
  '  uniform vec3 fogColor;', '  varying float fogDepth;',
  '  #ifdef FOG_EXP2', '    uniform float fogDensity;', '  #else', '    uniform float fogNear;', '    uniform float fogFar;', '  #endif',
  '  #ifdef GFX_W',
  '    vec3 gfxFog( vec3 col ) {',
  '      vec3 d = vGfxW - gfxCam; float dist = length( d ); vec3 rd = d / max( dist, 1e-3 );',
  '      float k = gfxFogP.y * rd.y * dist;',
  '      float od = gfxFogP.x * exp( - gfxFogP.y * ( gfxCam.y - gfxFogP.z ) ) * dist * ( abs( k ) > 1e-3 ? ( 1.0 - exp( - k ) ) / k : 1.0 );',
  '      float f = ( 1.0 - exp( - od ) ) * smoothstep( fogNear * 0.2, fogNear, dist );',
  '      f = min( f, gfxFogP.w );',
  '      float s = pow( max( dot( rd, gfxSunDir ), 0.0 ), 6.0 );',
  '      return mix( col, fogColor + gfxSunCol * s, f );',
  '    }',
  '  #endif',
  '#endif'].join('\n');
T.ShaderChunk.fog_fragment = [
  '#ifdef USE_FOG',
  '  #ifdef GFX_W',
  '    gl_FragColor.rgb = gfxFog( gl_FragColor.rgb );',
  '  #else',
  '    #ifdef FOG_EXP2', '      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );',
  '    #else', '      float fogFactor = smoothstep( fogNear, fogFar, fogDepth );', '    #endif',
  '    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
  '  #endif',
  '#endif'].join('\n');

const WORLD_VS = [
  '#ifdef GFX_SPRITE',
  '  vGfxW = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;',
  '#else',
  '  vec4 gfxWp = vec4( transformed, 1.0 );',
  '  #ifdef USE_INSTANCING', '    gfxWp = instanceMatrix * gfxWp;', '  #endif',
  '  vGfxW = ( modelMatrix * gfxWp ).xyz;',
  '#endif'].join('\n');
const HEAD_FS = [
  'varying vec3 vGfxW;',
  'uniform vec3 gfxCam; uniform vec4 gfxFogP; uniform vec3 gfxSunDir; uniform vec3 gfxSunCol;',
  '#ifdef GFX_SURF',
  'uniform sampler2D gfxRoof; uniform vec4 gfxRoofB; uniform sampler2D gfxNoise;',
  'uniform float gfxWet; uniform float gfxRain; uniform float gfxTime; uniform float gfxMacro;',
  'vec2 gfxHash2( vec2 p ) { p = vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) ); return fract( sin( p ) * 43758.5453 ); }',
  // rain ripples: one drop per cell at a random place and phase, rings spreading out; returns the slope (world xz)
  'vec2 gfxRipple( vec2 p, float t ) {',
  '  vec2 q = p * 6.5; vec2 base = floor( q - 0.5 ); vec2 g = vec2( 0.0 );',
  '  for ( int j = 0; j < 2; j ++ ) for ( int i = 0; i < 2; i ++ ) {',
  '    vec2 cell = base + vec2( float( i ), float( j ) ); vec2 h = gfxHash2( cell );',
  '    vec2 c = cell + 0.2 + h * 0.6; float tt = fract( t * 1.4 + h.x * 7.13 + h.y * 3.7 );',
  '    vec2 dv = q - c; float d = length( dv ); float x = ( d - tt * 0.55 ) * 22.0;',
  '    float env = ( 1.0 - tt ) * ( 1.0 - tt ) * exp( - x * x * 0.06 ) * step( d, 0.95 );',
  '    g += ( dv / max( d, 1e-3 ) ) * cos( x ) * env;',
  '  }',
  '  return g * 0.3;',
  '}',
  '#endif'].join('\n');
// surface: sky visibility under roofs, anti-tiling macro variation, rain wetness / puddles / ripples
const SURF_FS = [
  '#ifdef GFX_SURF',
  'vec3 gfxNg = inverseTransformDirection( geometryNormal, viewMatrix );',
  'vec4 gfxRm = texture2D( gfxRoof, ( vGfxW.xz + gfxNg.xz * 0.35 - gfxRoofB.xy ) * gfxRoofB.zw );',
  'float gfxUnder = gfxRm.r * step( vGfxW.y, gfxRm.g * 120.0 - 0.12 );',
  'float gfxSkyVis = 1.0 - gfxUnder * 0.85;',
  'vec2 gfxMp = abs( gfxNg.y ) > 0.6 ? vGfxW.xz : ( abs( gfxNg.x ) > abs( gfxNg.z ) ? vGfxW.zy : vGfxW.xy );',
  'vec4 gfxNz = texture2D( gfxNoise, gfxMp * 0.021 );',
  '#ifndef GFX_NO_MACRO',
  '  float gfxMv = gfxNz.r * 0.65 + texture2D( gfxNoise, gfxMp * 0.093 + 0.37 ).g * 0.35;',
  '  diffuseColor.rgb *= mix( 1.0 - gfxMacro * 0.22, 1.0 + gfxMacro * 0.14, gfxMv );',
  '  roughnessFactor = clamp( roughnessFactor * mix( 0.88, 1.1, gfxNz.g ), 0.03, 1.0 );',
  '#endif',
  'if ( gfxWet > 0.001 ) {',
  '  float gfxOpen = 1.0 - gfxUnder;',
  '  float gfxUp = smoothstep( 0.35, 0.85, gfxNg.y );',
  '  float gfxW = gfxWet * gfxOpen * mix( 0.4, 1.0, gfxUp );',
  '  float gfxPud = gfxUp > 0.5 && vGfxW.y < 0.6 ? smoothstep( 0.6, 0.7, gfxNz.b + gfxWet * 0.1 ) * gfxOpen * gfxUp * gfxWet : 0.0;',
  '  diffuseColor.rgb *= mix( 1.0, 0.62, gfxW * ( 1.0 - metalnessFactor ) );',
  '  roughnessFactor = mix( roughnessFactor, mix( 0.4, 0.2, gfxUp ), gfxW * 0.8 );',
  '  normal = normalize( mix( normal, geometryNormal, gfxW * 0.45 ) );',
  '  roughnessFactor = mix( roughnessFactor, 0.03, gfxPud );',
  '  diffuseColor.rgb *= mix( 1.0, 0.8, gfxPud );',
  // (rings only in puddles and on the wet ground close by: further out they would be smaller than a pixel and glitter)
  '  vec2 gfxRp = gfxRain > 0.01 ? gfxRipple( vGfxW.xz, gfxTime ) * gfxRain * ( gfxPud + gfxW * gfxUp * 0.12 ) * ( 1.0 - smoothstep( 7.0, 18.0, distance( vGfxW, gfxCam ) ) ) : vec2( 0.0 );',
  '  normal = normalize( mix( normal, geometryNormal, gfxPud * 0.92 ) + ( viewMatrix * vec4( gfxRp.x, 0.0, gfxRp.y, 0.0 ) ).xyz );',
  '}',
  // specular anti-aliasing on the final normal: bumps and ripples that change within a pixel make the surface rougher
  // instead of glittering
  'vec3 gfxDn = fwidth( normal ); roughnessFactor = sqrt( roughnessFactor * roughnessFactor + min( dot( gfxDn, gfxDn ) * 1.6, 0.36 ) );',
  '#endif'].join('\n');
// rounded edges on boxes, done in the shader: every box geometry carries its half-size and local position; near an
// edge the normal leans outward as if the corner were rounded (≈1 cm), fading out once the bevel is under a pixel
const BEVEL_VS = 'vBxH = aBxH; vBxL = aBxL;';
const BEVEL_FS = [
  '#ifdef GFX_BEVEL',
  'if ( vBxH.x > 0.0 ) {',
  '  vec3 bq = abs( vBxL ) / max( vBxH, vec3( 1e-4 ) );',
  '  float bfx = step( bq.y, bq.x ) * step( bq.z, bq.x ), bfy = ( 1.0 - bfx ) * step( bq.z, bq.y ), bfz = 1.0 - bfx - bfy;',
  '  vec2 bpa = bfx * vBxL.yz + bfy * vBxL.xz + bfz * vBxL.xy, bha = bfx * vBxH.yz + bfy * vBxH.xz + bfz * vBxH.xy;',
  '  vec3 bdpx = dFdx( - vViewPosition ), bdpy = dFdy( - vViewPosition );',
  '  vec2 bdux = dFdx( bpa ), bduy = dFdy( bpa );',
  '  float bdet = bdux.x * bduy.y - bdux.y * bduy.x;',
  '  float br = min( 0.012, 0.3 * min( bha.x, bha.y ) );',
  '  float bpx = max( length( vec2( bdux.x, bduy.x ) ), length( vec2( bdux.y, bduy.y ) ) );',
  '  float bfade = smoothstep( 0.6, 2.0, br / max( bpx, 1e-6 ) );',
  '  vec2 bt = clamp( 1.0 - ( bha - abs( bpa ) ) / br, 0.0, 1.0 ) * bfade;',
  '  if ( abs( bdet ) > 1e-12 && bt.x + bt.y > 0.0 ) {',
  '    vec3 bT = normalize( ( bdpx * bduy.y - bdpy * bdux.y ) * sign( bdet ) ), bB = normalize( ( bdpy * bdux.x - bdpx * bduy.x ) * sign( bdet ) );',
  '    vec3 bo = bT * sign( bpa.x ) * bt.x + bB * sign( bpa.y ) * bt.y;',
  '    float ba = 0.785 * max( bt.x, bt.y );',
  '    normal = normalize( normal * cos( ba ) + normalize( bo ) * sin( ba ) );',
  '  }',
  '}',
  '#endif'].join('\n');
// every BoxGeometry carries the data for the bevel (G.merge keeps it when boxes are merged)
G.addBevel = function (g, hx, hy, hz) {
  const n = g.attributes.position.count, H = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { H[i * 3] = hx; H[i * 3 + 1] = hy; H[i * 3 + 2] = hz; }
  g.setAttribute('aBxH', new T.BufferAttribute(H, 3)); g.setAttribute('aBxL', g.attributes.position.clone());
  return g;
};
{
  const Box = T.BoxGeometry;
  T.BoxGeometry = class BoxGeometry extends Box {
    constructor(w = 1, h = 1, d = 1, ws, hs, ds) { super(w, h, d, ws, hs, ds); G.addBevel(this, w / 2, h / 2, d / 2); }
  };
}
const SKYVIS_FS = [
  '#ifdef GFX_SURF',
  '  iblIrradiance *= gfxSkyVis;',
  '  radiance *= mix( 0.3, 1.0, gfxSkyVis );',
  '#endif'].join('\n');

let surfOn = true, gfxKey = '';
G.gfxPatch = function (sh, mat) {
  if (!mat || mat.isShaderMaterial || mat.isRawShaderMaterial || mat.gfxSkip) return;
  const std = !!mat.isMeshStandardMaterial;
  if (!std && mat.fog === false) return;
  let defs = '#define GFX_W\n';
  const surf = std && surfOn && !mat.gfxNoSurf;
  if (surf) defs += '#define GFX_SURF\n';
  if (mat.gfxNoMacro || !Q.P.macro) defs += '#define GFX_NO_MACRO\n';
  if (mat.isSpriteMaterial) defs += '#define GFX_SPRITE\n';
  const bevel = surf && Q.P.bevel && !mat.gfxNoBevel;
  if (bevel) defs += '#define GFX_BEVEL\n';
  let vs = defs + 'varying vec3 vGfxW;\n' + sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n' + WORLD_VS);
  if (bevel) vs = 'attribute vec3 aBxH;\nattribute vec3 aBxL;\nvarying vec3 vBxH;\nvarying vec3 vBxL;\n' + vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + BEVEL_VS);
  sh.vertexShader = vs;
  let fs = defs + HEAD_FS + '\n' + (bevel ? 'varying vec3 vBxH;\nvarying vec3 vBxL;\n' : '') + sh.fragmentShader;
  if (surf) fs = fs.replace('#include <emissivemap_fragment>', (bevel ? BEVEL_FS + '\n' : '') + SURF_FS + '\n#include <emissivemap_fragment>').replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n' + SKYVIS_FS);
  if (std) fs = fs.replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.directSpecular = min( reflectedLight.directSpecular, vec3( 3e4 ) );');
  sh.fragmentShader = fs;
  for (const k in SU) sh.uniforms[k] = SU[k];
};
T.Material.prototype.onBeforeCompile = function (sh) { G.gfxPatch(sh, this); };
const baseKey = T.Material.prototype.customProgramCacheKey;
T.Material.prototype.customProgramCacheKey = function () { return baseKey.call(this) + '|' + gfxKey; };

// ---------------- roof mask (sky visibility + dry ground under roofs), rebuilt per level ----------------
G.gfxRoofs = [];
G.gfxBuildMask = function () {
  const roofs = [];
  for (const b of G.buildings) if (b.h) roofs.push(b);
  for (const b of G.gfxRoofs) roofs.push(b);
  if (SU.gfxRoof.value !== emptyRoof) SU.gfxRoof.value.dispose();
  SU.gfxRoof.value = emptyRoof; SU.gfxRoofB.value.set(0, 0, 0, 0);
  if (!roofs.length) return;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const b of roofs) { x0 = Math.min(x0, b.x0); z0 = Math.min(z0, b.z0); x1 = Math.max(x1, b.x1); z1 = Math.max(z1, b.z1); }
  x0 -= 4; z0 -= 4; x1 += 4; z1 += 4;
  const N = 1024, s = N / Math.max(x1 - x0, z1 - z0), W = Math.ceil((x1 - x0) * s), H = Math.ceil((z1 - z0) * s);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  roofs.slice().sort((a, b) => a.h - b.h).forEach((b) => { g.fillStyle = `rgb(255,${Math.max(1, Math.min(255, Math.round(b.h / 120 * 255)))},0)`; g.fillRect((b.x0 - x0) * s, (b.z0 - z0) * s, (b.x1 - b.x0) * s, (b.z1 - b.z0) * s); });
  const t = new T.CanvasTexture(c); t.flipY = false; t.generateMipmaps = false; t.minFilter = T.LinearFilter; t.magFilter = T.LinearFilter;
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
  SU.gfxRoof.value = t; SU.gfxRoofB.value.set(x0, z0, 1 / (W / s), 1 / (H / s));
};

// ---------------- pixel ratio / resolution ----------------
function targetPR() {
  const cw = Math.max(1, innerWidth), ch = Math.max(1, innerHeight), dpr = devicePixelRatio || 1;
  let pr = Q.res === 'auto' || !RES[Q.res] ? Math.min(dpr, Q.P.autoRes ? Q.P.autoRes / Math.min(cw, ch) : (Q.P.autoPR || 1)) : RES[Q.res] / Math.min(cw, ch);   // a fixed resolution counts on the short side (phones held upright too)
  if (direct()) pr *= Q.scale;
  pr = Math.min(pr, MAX_RB / cw, MAX_RB / ch);
  const maxPix = 3840 * 2400; if (cw * ch * pr * pr > maxPix) pr = Math.sqrt(maxPix / (cw * ch));
  return Math.max(0.3, pr);
}
function applySize() { const pr = targetPR(); if (Math.abs(R.getPixelRatio() - pr) > 1e-3 || R.domElement.clientWidth !== innerWidth || R.domElement.clientHeight !== innerHeight) { R.setPixelRatio(pr); R.setSize(innerWidth, innerHeight); } }
// straight to the screen, no post pipeline (phones; and GPUs without depth textures)
function direct() { return !PIPE || (Q.P && Q.P.pipe === 0); }
addEventListener('resize', applySize);

// ---------------- shadows ----------------
const SHADOW_TYPES = { pcf: T.PCFShadowMap, soft: T.PCFSoftShadowMap };
function applyShadows() {
  const s = SHADOWS[Q.P.shadow | 0], sun = G.sun;
  R.shadowMap.enabled = !!s;
  R.shadowMap.autoUpdate = !(Q.P.shadowHz && s); R.shadowMap.needsUpdate = true;
  if (!s) return;
  R.shadowMap.type = SHADOW_TYPES[s.type];
  if (sun.shadow.mapSize.x !== s.size) { sun.shadow.mapSize.set(s.size, s.size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  const sc = sun.shadow.camera; sc.left = -s.range; sc.right = s.range; sc.top = s.range; sc.bottom = -s.range; sc.near = 1; sc.far = 300; sc.updateProjectionMatrix();
  const texel = 2 * s.range / s.size;
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = texel * 1.1; sun.shadow.radius = 1.6;
}
// keep the sun's shadow map centred on the player, snapped to whole shadow texels so edges don't crawl
const _sd = new T.Vector3(), _sr = new T.Vector3(), _su = new T.Vector3(), _sf = new T.Vector3(), _up = new T.Vector3(0, 1, 0);
const origUpdateSky = G.updateSky;
G.updateSky = function (focus) {
  origUpdateSky(focus);
  const s = SHADOWS[Q.P.shadow | 0], sun = G.sun; if (!s) return;
  _sd.subVectors(sun.position, sun.target.position).normalize();
  _sf.copy(_sd).negate(); _sr.crossVectors(Math.abs(_sd.y) > 0.99 ? _sf.set(0, 0, 1) && _sf : _up, _sd).normalize();
  _sf.copy(_sd).negate(); _su.crossVectors(_sd, _sr).normalize();
  const fx = focus.x || 0, fy = focus.y || 0, fz = focus.z || 0, texel = 2 * s.range / s.size;
  const a = Math.round((fx * _sr.x + fy * _sr.y + fz * _sr.z) / texel) * texel;
  const b = Math.round((fx * _su.x + fy * _su.y + fz * _su.z) / texel) * texel;
  const c = fx * _sd.x + fy * _sd.y + fz * _sd.z;
  sun.target.position.set(_sr.x * a + _su.x * b + _sd.x * c, _sr.y * a + _su.y * b + _sd.y * c, _sr.z * a + _su.z * b + _sd.z * c);
  sun.position.copy(sun.target.position).addScaledVector(_sd, 140);
  sun.target.updateMatrixWorld();
};

// ---------------- image-based lighting from the sky ----------------
let pmrem = null, envRT = null, envSig = '', envCheckT = 0;
const skyScene = new T.Scene();
let envSky = null;
function updateEnv(now, force) {
  if (!Q.P.ibl || !G.skyMat) { if (scene.environment) scene.environment = null; return; }
  if (!force && now < envCheckT) return;
  envCheckT = now + 400;
  const u = G.skyMat.uniforms, q = (c) => (Math.round(c.r * 60) + ',' + Math.round(c.g * 60) + ',' + Math.round(c.b * 60));
  const sig = [q(u.top.value), q(u.bottom.value), u.sunDir ? Math.round(u.sunDir.value.x * 20) + ':' + Math.round(u.sunDir.value.y * 20) : '', Math.round(G.overcast * 20), G.levelName, Math.round(G.night * 10)].join('|');
  if (!force && sig === envSig && scene.environment) return;
  envSig = sig;
  if (!envSky) { envSky = new T.Mesh(new T.SphereGeometry(100, 48, 24), G.skyMat); envSky.frustumCulled = false; skyScene.add(envSky); }
  pmrem = pmrem || new T.PMREMGenerator(R);
  if (G.skyMat.uniforms.uEnv) G.skyMat.uniforms.uEnv.value = 1;
  const rt = pmrem.fromScene(skyScene, 0, 0.1, 400);
  if (G.skyMat.uniforms.uEnv) G.skyMat.uniforms.uEnv.value = 0;
  if (envRT) envRT.dispose();
  envRT = rt; scene.environment = rt.texture;
}
G.gfxEnvRefresh = () => { envSig = ''; envCheckT = 0; };

// ---------------- post-processing ----------------
const VS = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
// TEX0: sample mip 0 explicitly (no derivatives needed inside loops / branches)
const TEX0 = '#if defined( GL_EXT_shader_texture_lod ) || __VERSION__ >= 300\n#define TEX0( t, uv ) texture2DLodEXT( t, uv, 0.0 )\n#else\n#define TEX0( t, uv ) texture2D( t, uv )\n#endif\n';
const passMat = (fs, uniforms, defines) => new T.ShaderMaterial({ vertexShader: VS, fragmentShader: TEX0 + fs, uniforms, defines: defines || {}, depthTest: false, depthWrite: false, toneMapped: false, extensions: { shaderTextureLOD: true } });
const fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsGeo = new T.BufferGeometry();
fsGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
fsGeo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const fsMesh = new T.Mesh(fsGeo); fsMesh.frustumCulled = false;
const fsScene = new T.Scene(); fsScene.add(fsMesh);
function pass(mat, target) { fsMesh.material = mat; R.setRenderTarget(target || null); R.render(fsScene, fsCam); }

const SSAO_FS = [
  'precision highp float;',
  'uniform sampler2D tDepth; uniform vec2 uDepthTexel; uniform vec2 uAspect; uniform vec4 uProj; uniform vec4 uP;',
  'varying vec2 vUv;',
  'float linZ( float d ) { return uProj.z * uProj.w / ( uProj.w - d * ( uProj.w - uProj.z ) ); }',
  'vec3 vpos( vec2 uv ) { float z = linZ( TEX0( tDepth, uv ).x ); return vec3( ( uv * 2.0 - 1.0 ) / uProj.xy * z, - z ); }',
  'void main() {',
  '  float d0 = TEX0( tDepth, vUv ).x;',
  '  if ( d0 >= 0.99999 ) { gl_FragColor = vec4( 1.0, 1e4, 0.0, 1.0 ); return; }',
  '  vec3 P = vpos( vUv );',
  '  vec3 pr = vpos( vUv + vec2( uDepthTexel.x, 0.0 ) ), pl = vpos( vUv - vec2( uDepthTexel.x, 0.0 ) );',
  '  vec3 pu = vpos( vUv + vec2( 0.0, uDepthTexel.y ) ), pd = vpos( vUv - vec2( 0.0, uDepthTexel.y ) );',
  '  vec3 dx = abs( pr.z - P.z ) < abs( P.z - pl.z ) ? pr - P : P - pl;',
  '  vec3 dy = abs( pu.z - P.z ) < abs( P.z - pd.z ) ? pu - P : P - pd;',
  '  vec3 N = normalize( cross( dx, dy ) );',
  '  float z = - P.z;',
  '  float ssR = min( uP.x * uProj.y * 0.5 / z, uP.w );',
  '  float ang = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );',
  '  float occ = 0.0;',
  '  for ( int i = 0; i < SAMPLES; i ++ ) {',
  '    float a = ( float( i ) + 0.5 ) / float( SAMPLES );',
  '    float t = ang + a * 43.98;',
  '    vec2 off = vec2( cos( t ), sin( t ) ) * ( ssR * a ) * uAspect;',
  '    vec3 v = vpos( vUv + off ) - P; float dl = length( v );',
  '    float fall = 1.0 - smoothstep( uP.x * 0.5, uP.x * 1.5, dl );',
  '    occ += max( 0.0, dot( v, N ) / max( dl, 1e-3 ) - uP.z ) * fall;',
  '  }',
  '  float ao = clamp( 1.0 - uP.y * occ / float( SAMPLES ), 0.0, 1.0 );',
  '  gl_FragColor = vec4( ao, z, 0.0, 1.0 );',
  '}'].join('\n');
const BLUR_FS = [
  'precision highp float;',
  'uniform sampler2D tAO; uniform vec2 uDir; varying vec2 vUv;',
  'void main() {',
  '  vec2 c = TEX0( tAO, vUv ).rg;',
  '  if ( c.g > 9e3 ) { gl_FragColor = vec4( 1.0, c.g, 0.0, 1.0 ); return; }',
  '  float s = c.r, w = 1.0, tol = 0.04 * c.g + 0.08;',
  '  for ( int i = 1; i <= 4; i ++ ) {',
  '    float fi = float( i ), g = exp( - fi * fi / 9.0 );',
  '    vec2 a = TEX0( tAO, vUv + uDir * fi ).rg, b = TEX0( tAO, vUv - uDir * fi ).rg;',
  '    float wa = g * max( 0.0, 1.0 - abs( a.g - c.g ) / tol ), wb = g * max( 0.0, 1.0 - abs( b.g - c.g ) / tol );',
  '    s += a.r * wa + b.r * wb; w += wa + wb;',
  '  }',
  '  gl_FragColor = vec4( s / w, c.g, 0.0, 1.0 );',
  '}'].join('\n');
const DOWN_FS = [
  'precision highp float;',
  'uniform sampler2D tSrc; uniform vec2 uTexel; uniform vec4 uTh; varying vec2 vUv;',
  'vec3 S( float x, float y ) { return texture2D( tSrc, vUv + vec2( x, y ) * uTexel ).rgb; }',
  'float lum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }',
  'void main() {',
  '  vec3 a = S( -2.0, 2.0 ), b = S( 0.0, 2.0 ), c = S( 2.0, 2.0 ), d = S( -2.0, 0.0 ), e = S( 0.0, 0.0 ), f = S( 2.0, 0.0 );',
  '  vec3 g = S( -2.0, -2.0 ), h = S( 0.0, -2.0 ), i = S( 2.0, -2.0 ), j = S( -1.0, 1.0 ), k = S( 1.0, 1.0 ), l = S( -1.0, -1.0 ), m = S( 1.0, -1.0 );',
  '#ifdef PREFILTER',
  '  vec3 g0 = ( j + k + l + m ) * 0.25, g1 = ( a + b + d + e ) * 0.25, g2 = ( b + c + e + f ) * 0.25, g3 = ( d + e + g + h ) * 0.25, g4 = ( e + f + h + i ) * 0.25;',
  '  float w0 = 0.5 / ( 1.0 + lum( g0 ) ), w1 = 0.125 / ( 1.0 + lum( g1 ) ), w2 = 0.125 / ( 1.0 + lum( g2 ) ), w3 = 0.125 / ( 1.0 + lum( g3 ) ), w4 = 0.125 / ( 1.0 + lum( g4 ) );',
  '  vec3 o = ( g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4 ) / ( w0 + w1 + w2 + w3 + w4 );',
  '  o = vec3( o.r >= 0.0 && o.r < 6e4 ? o.r : 0.0, o.g >= 0.0 && o.g < 6e4 ? o.g : 0.0, o.b >= 0.0 && o.b < 6e4 ? o.b : 0.0 );',
  '  o = min( o, vec3( 40.0 ) );',
  '  float br = max( o.r, max( o.g, o.b ) ); float rq = clamp( br - uTh.y, 0.0, uTh.z ); rq = uTh.w * rq * rq;',
  '  o *= max( rq, br - uTh.x ) / max( br, 1e-4 );',
  '#else',
  '  vec3 o = e * 0.125 + ( a + c + g + i ) * 0.03125 + ( b + d + f + h ) * 0.0625 + ( j + k + l + m ) * 0.125;',
  '#endif',
  '  gl_FragColor = vec4( o, 1.0 );',
  '}'].join('\n');
const UP_FS = [
  'precision highp float;',
  'uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 uTexel; uniform float uK; varying vec2 vUv;',
  'vec3 S( float x, float y ) { return texture2D( tLow, vUv + vec2( x, y ) * uTexel ).rgb; }',
  'void main() {',
  '  vec3 s = S( -1.0, -1.0 ) + S( 1.0, -1.0 ) + S( -1.0, 1.0 ) + S( 1.0, 1.0 ) + 2.0 * ( S( 0.0, -1.0 ) + S( -1.0, 0.0 ) + S( 1.0, 0.0 ) + S( 0.0, 1.0 ) ) + 4.0 * S( 0.0, 0.0 );',
  '  gl_FragColor = vec4( texture2D( tHigh, vUv ).rgb + s * ( uK / 16.0 ), 1.0 );',
  '}'].join('\n');
const COMP_FS = [
  'precision highp float;',
  'uniform sampler2D tScene; uniform sampler2D tAO; uniform sampler2D tBloom;',
  'uniform vec2 uTexel; uniform float uExposure; uniform float uBloom; uniform float uAO; uniform float uSharp;',
  'uniform float uVig; uniform float uGrain; uniform float uTime; uniform float uCA;',
  'uniform vec3 uLift; uniform vec3 uGain; uniform float uGamma; uniform float uSat; uniform float uCon; uniform vec3 uTint;',
  'varying vec2 vUv;',
  'vec3 RRTAndODTFit( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }',
  'vec3 aces( vec3 c ) {',
  '  const mat3 I = mat3( 0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777 );',
  '  const mat3 O = mat3( 1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602 );',
  '  c *= uExposure / 0.6; c = I * c; c = RRTAndODTFit( c ); c = O * c; return clamp( c, 0.0, 1.0 );',
  '}',
  'vec3 srgb( vec3 c ) { return mix( c * 12.92, 1.055 * pow( max( c, vec3( 0.0 ) ), vec3( 0.41666 ) ) - 0.055, step( 0.0031308, c ) ); }',
  'float ign( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }',
  'void main() {',
  '  float ao = 1.0;',
  '#ifdef USE_AO',
  '  ao = mix( 1.0, TEX0( tAO, vUv ).r, uAO );',
  '#endif',
  '  vec3 bloom = vec3( 0.0 );',
  '#ifdef USE_BLOOM',
  '  bloom = texture2D( tBloom, vUv ).rgb * uBloom;',
  '#endif',
  '  vec3 hc = texture2D( tScene, vUv ).rgb;',
  '  hc = vec3( hc.r >= 0.0 ? min( hc.r, 6e4 ) : 0.0, hc.g >= 0.0 ? min( hc.g, 6e4 ) : 0.0, hc.b >= 0.0 ? min( hc.b, 6e4 ) : 0.0 );',
  '#ifdef USE_CA',
  '  vec2 cd = ( vUv - 0.5 ) * uCA;',
  '  hc.r = texture2D( tScene, vUv + cd ).r; hc.b = texture2D( tScene, vUv - cd ).b;',
  '#endif',
  '  vec3 c = srgb( aces( hc * ao + bloom ) );',
  '#ifdef USE_SHARP',
  '  vec3 n = srgb( aces( texture2D( tScene, vUv + vec2( 0.0, uTexel.y ) ).rgb * ao + bloom ) );',
  '  vec3 s = srgb( aces( texture2D( tScene, vUv - vec2( 0.0, uTexel.y ) ).rgb * ao + bloom ) );',
  '  vec3 e = srgb( aces( texture2D( tScene, vUv + vec2( uTexel.x, 0.0 ) ).rgb * ao + bloom ) );',
  '  vec3 w = srgb( aces( texture2D( tScene, vUv - vec2( uTexel.x, 0.0 ) ).rgb * ao + bloom ) );',
  '  vec3 mn = min( c, min( min( n, s ), min( e, w ) ) ), mx = max( c, max( max( n, s ), max( e, w ) ) );',
  '  vec3 amp = sqrt( clamp( min( mn, 2.0 - mx ) / max( mx, vec3( 1e-4 ) ), 0.0, 1.0 ) );',
  '  vec3 wt = - amp / mix( 8.0, 4.0, uSharp );',
  '  c = clamp( ( c + ( n + s + e + w ) * wt ) / ( 1.0 + 4.0 * wt ), 0.0, 1.0 );',
  '#endif',
  '  c = c * uGain + uLift * ( 1.0 - c );',
  '  c = pow( max( c, vec3( 0.0 ) ), vec3( uGamma ) );',
  '  float l = dot( c, vec3( 0.299, 0.587, 0.114 ) );',
  '  c = mix( vec3( l ), c, uSat );',
  '  c = ( c - 0.5 ) * uCon + 0.5;',
  '  c *= uTint;',
  '  vec2 q = vUv - 0.5; c *= 1.0 - uVig * smoothstep( 0.1, 0.75, dot( q, q ) * 2.0 );',
  '  float nz = ign( gl_FragCoord.xy + vec2( uTime * 37.0, uTime * 17.0 ) ) - 0.5;',
  '  c += nz * ( uGrain * 0.035 * ( 1.0 - l * 0.6 ) + 1.0 / 255.0 );',
  '  gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );',
  '}'].join('\n');
const FXAA_FS = [
  'precision highp float;',
  'uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;',
  'void main() {',
  '  vec3 rgbNW = texture2D( tSrc, vUv + vec2( -1.0, -1.0 ) * uTexel ).rgb, rgbNE = texture2D( tSrc, vUv + vec2( 1.0, -1.0 ) * uTexel ).rgb;',
  '  vec3 rgbSW = texture2D( tSrc, vUv + vec2( -1.0, 1.0 ) * uTexel ).rgb, rgbSE = texture2D( tSrc, vUv + vec2( 1.0, 1.0 ) * uTexel ).rgb;',
  '  vec3 rgbM = texture2D( tSrc, vUv ).rgb; vec3 L = vec3( 0.299, 0.587, 0.114 );',
  '  float lNW = dot( rgbNW, L ), lNE = dot( rgbNE, L ), lSW = dot( rgbSW, L ), lSE = dot( rgbSE, L ), lM = dot( rgbM, L );',
  '  float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) ), lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );',
  '  vec2 dir = vec2( - ( ( lNW + lNE ) - ( lSW + lSE ) ), ( lNW + lSW ) - ( lNE + lSE ) );',
  '  float red = max( ( lNW + lNE + lSW + lSE ) * 0.03125, 1.0 / 128.0 );',
  '  float rcpMin = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + red );',
  '  dir = clamp( dir * rcpMin, vec2( -8.0 ), vec2( 8.0 ) ) * uTexel;',
  '  vec3 A = 0.5 * ( texture2D( tSrc, vUv + dir * ( 1.0 / 3.0 - 0.5 ) ).rgb + texture2D( tSrc, vUv + dir * ( 2.0 / 3.0 - 0.5 ) ).rgb );',
  '  vec3 B = A * 0.5 + 0.25 * ( texture2D( tSrc, vUv - dir * 0.5 ).rgb + texture2D( tSrc, vUv + dir * 0.5 ).rgb );',
  '  float lB = dot( B, L );',
  '  gl_FragColor = vec4( ( lB < lMin || lB > lMax ) ? A : B, 1.0 );',
  '}'].join('\n');

const M = {};
M.ssao = passMat(SSAO_FS, { tDepth: { value: null }, uDepthTexel: { value: new T.Vector2() }, uAspect: { value: new T.Vector2() }, uProj: { value: new T.Vector4() }, uP: { value: new T.Vector4(0.7, 1.6, 0.12, 0.08) } }, { SAMPLES: 12 });
M.blur = passMat(BLUR_FS, { tAO: { value: null }, uDir: { value: new T.Vector2() } });
M.pre = passMat(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uTh: { value: new T.Vector4() } }, { PREFILTER: 1 });
M.down = passMat(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uTh: { value: new T.Vector4() } });
M.up = passMat(UP_FS, { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new T.Vector2() }, uK: { value: 1 } });
M.comp = passMat(COMP_FS, {
  tScene: { value: null }, tAO: { value: null }, tBloom: { value: null }, uTexel: { value: new T.Vector2() }, uExposure: { value: 1 }, uBloom: { value: 0.5 }, uAO: { value: 0.85 },
  uSharp: { value: 0.3 }, uVig: { value: 0.3 }, uGrain: { value: 0 }, uTime: { value: 0 }, uCA: { value: 0 },
  uLift: { value: new T.Vector3() }, uGain: { value: new T.Vector3(1, 1, 1) }, uGamma: { value: 1 }, uSat: { value: 1 }, uCon: { value: 1 }, uTint: { value: new T.Vector3(1, 1, 1) },
});
M.fxaa = passMat(FXAA_FS, { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });

const RT = { w: 0, h: 0, samples: -1, aoKey: '', bloomKey: '', ldrKey: '' };
const rtOpts = (o) => Object.assign({ minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: HDR_TYPE, depthBuffer: false, stencilBuffer: false }, o || {});
function dispose(k) { const r = RT[k]; if (!r) return; if (Array.isArray(r)) r.forEach((x) => x.dispose()); else { if (r.depthTexture) r.depthTexture.dispose(); r.dispose(); } RT[k] = null; }
function ensureTargets() {
  const P = Q.P, cw = R.domElement.width, ch = R.domElement.height;
  const w = Math.max(32, Math.round(cw * Q.scale)), h = Math.max(32, Math.round(ch * Q.scale));
  const samples = GL2 ? Math.min(P.aa | 0, caps.maxSamples || 0, w * h > 5.5e6 ? 2 : 8) : 0;
  if (w !== RT.w || h !== RT.h || samples !== RT.samples || !RT.scene) {
    dispose('scene');
    const o = rtOpts({ depthBuffer: true });
    const rt = samples > 0 ? new T.WebGLMultisampleRenderTarget(w, h, o) : new T.WebGLRenderTarget(w, h, o);
    if (samples > 0) rt.samples = samples;
    rt.depthTexture = new T.DepthTexture(w, h, T.UnsignedIntType);
    RT.scene = rt; RT.w = w; RT.h = h; RT.samples = samples;
  }
  const aoKey = (P.ssao | 0) + ':' + w + 'x' + h;
  if (aoKey !== RT.aoKey) {
    dispose('ao'); dispose('ao2'); RT.aoKey = aoKey;
    if (P.ssao) { const aw = P.ssao === 2 ? w : Math.ceil(w / 2), ah = P.ssao === 2 ? h : Math.ceil(h / 2); RT.ao = new T.WebGLRenderTarget(aw, ah, rtOpts({ type: HALF ? T.HalfFloatType : T.FloatType })); RT.ao2 = RT.ao.clone(); }
  }
  const bloomKey = (P.bloom ? 1 : 0) + ':' + w + 'x' + h;
  if (bloomKey !== RT.bloomKey) {
    dispose('down'); dispose('up'); RT.bloomKey = bloomKey;
    if (P.bloom) {
      RT.down = []; RT.up = [];
      let bw = Math.ceil(w / 2), bh = Math.ceil(h / 2);
      for (let i = 0; i < 7 && Math.min(bw, bh) >= 4; i++) { RT.down.push(new T.WebGLRenderTarget(bw, bh, rtOpts())); bw = Math.ceil(bw / 2); bh = Math.ceil(bh / 2); }
      for (let i = 0; i < RT.down.length - 1; i++) RT.up.push(new T.WebGLRenderTarget(RT.down[i].width, RT.down[i].height, rtOpts()));
    }
  }
  const fx = !samples && P.fxaa ? 1 : 0, ldrKey = fx + ':' + cw + 'x' + ch;
  if (ldrKey !== RT.ldrKey) { dispose('ldr'); RT.ldrKey = ldrKey; if (fx) RT.ldr = new T.WebGLRenderTarget(cw, ch, rtOpts({ type: T.UnsignedByteType })); }
}

// ---------------- colour grading per place / time ----------------
const GRADE = {
  base:   { lift: [0, 0, 0.004], gain: [1.03, 1.0, 0.96], gamma: 1.02, sat: 1.1, con: 1.08, tint: [1, 1, 1], vig: 0.3 },
  night:  { lift: [0.0, 0.012, 0.03], gain: [1.04, 1.0, 0.95], gamma: 1.02, sat: 0.94, con: 1.08, tint: [1, 1, 1], vig: 0.42 },
  jungle: { lift: [0.0, 0.014, 0.008], gain: [0.98, 1.02, 0.96], gamma: 1.0, sat: 0.9, con: 1.08, tint: [0.98, 1.01, 0.97], vig: 0.4 },
  kiln:   { lift: [0.0, 0.008, 0.022], gain: [0.98, 1.0, 1.03], gamma: 1.0, sat: 0.88, con: 1.08, tint: [0.98, 1.0, 1.02], vig: 0.4 },
  home:   { lift: [0.012, 0.006, 0.0], gain: [1.04, 1.0, 0.93], gamma: 1.0, sat: 1.0, con: 1.04, tint: [1.02, 1.0, 0.96], vig: 0.36 },
  horror: { lift: [0.0, 0.0, 0.01], gain: [1.0, 0.97, 0.95], gamma: 1.05, sat: 0.78, con: 1.12, tint: [1, 0.98, 0.97], vig: 0.55 },
};
const gradeNow = JSON.parse(JSON.stringify(GRADE.base));
G.gfxGrade = null; // optional override from story code: one of GRADE's keys or an object
function gradeTarget() {
  if (G.gfxGrade) return typeof G.gfxGrade === 'string' ? GRADE[G.gfxGrade] || GRADE.base : G.gfxGrade;
  const mood = G.state && G.state.mood, lv = G.levelName;
  if (mood === 'horror') return GRADE.horror;
  if (mood === 'home' || mood === 'hope') return GRADE.home;
  if (lv === 'jungle') return GRADE.jungle;
  if (lv === 'kiln') return GRADE.kiln;
  return G.night > 0.5 ? GRADE.night : GRADE.base;
}
function stepGrade(dt) {
  const t = gradeTarget(), k = 1 - Math.exp(-dt * 1.5);
  for (const key of ['lift', 'gain', 'tint']) for (let i = 0; i < 3; i++) gradeNow[key][i] += (t[key][i] - gradeNow[key][i]) * k;
  for (const key of ['gamma', 'sat', 'con', 'vig']) gradeNow[key] += (t[key] - gradeNow[key]) * k;
  const u = M.comp.uniforms;
  u.uLift.value.fromArray(gradeNow.lift); u.uGain.value.fromArray(gradeNow.gain); u.uTint.value.fromArray(gradeNow.tint);
  u.uGamma.value = gradeNow.gamma; u.uSat.value = gradeNow.sat; u.uCon.value = gradeNow.con; u.uVig.value = gradeNow.vig;
}

// ---------------- per-frame globals: camera, fog, sun glow, wetness ----------------
let lastLevel = '', wet = 0, lastNow = performance.now();
function updateGlobals(now) {
  const dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
  SU.gfxTime.value = now / 1000;
  camera.updateMatrixWorld(); SU.gfxCam.value.setFromMatrixPosition(camera.matrixWorld);
  const f = scene.fog;
  if (f) {
    const fall = G.levelCfg && G.levelCfg.fogFall || 0.022;
    const fk = (G.levelCfg && G.levelCfg.fogK) || G.lerp(0.42, 0.8, Math.min(1, G.night + G.overcast * 0.4));
    SU.gfxFogP.value.set(fk / Math.max(8, (f.near + f.far) * 0.5) / Math.exp(-fall * 1.6), fall, 0, 1);
  }
  const sun = G.sun, d = SU.gfxSunDir.value; d.subVectors(sun.position, sun.target.position).normalize();
  if (G.night > 0.5) { d.set(-0.35, 0.78, -0.5).normalize(); SU.gfxSunCol.value.setRGB(0.05, 0.06, 0.09).multiplyScalar(1 - G.overcast * 0.6); }
  else SU.gfxSunCol.value.copy(sun.color).multiplyScalar(0.45 * (1 - G.overcast * 0.75) * Math.max(0, 1 - G.night * 1.6));
  // wetness: soaks in over ~15 s of rain, dries over a minute; snaps when a level loads
  const target = G.rainK > 0 ? 0.55 + 0.45 * Math.min(1, G.rainK) : 0;
  if (G.levelName !== lastLevel) { lastLevel = G.levelName; wet = target; G.gfxBuildMask(); G.gfxEnvRefresh(); }
  wet += (target - wet) * (1 - Math.exp(-dt * (target > wet ? 0.12 : 0.03)));
  SU.gfxWet.value = Q.P.surf ? wet : 0; SU.gfxRain.value = Q.P.surf ? Math.min(1, G.rainK) : 0;
  SU.gfxMacro.value = Q.P.macro ? 1 : 0;
  stepGrade(dt);
}

// ---------------- frame timing, dynamic resolution, FPS counter ----------------
const tq = GL2 ? ext('EXT_disjoint_timer_query_webgl2') : null;
const tqList = []; let tqOpen = null;
function timerBegin() { if (!tq || tqOpen || tqList.length > 3) return; try { const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); tqOpen = q; } catch (e) { /* unsupported */ } }
function timerEnd() { if (!tqOpen) return; gl.endQuery(tq.TIME_ELAPSED_EXT); tqList.push(tqOpen); tqOpen = null; }
function timerPoll() {
  while (tqList.length) {
    const q = tqList[0]; const ok = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE), dis = gl.getParameter(tq.GPU_DISJOINT_EXT);
    if (!ok && !dis) break;
    if (ok && !dis) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; Q.gpuMs = Q.gpuMs ? Q.gpuMs * 0.85 + ms * 0.15 : ms; Q.gpuOK = true; }
    gl.deleteQuery(q); tqList.shift();
  }
}
let fpsEl = null, fpsN = 0, fpsT = performance.now(), ftAvg = 16.7, lastFrame = performance.now(), dynT = 0, slowT = 0, probeT = 0;
function frameStats(now) {
  const ft = Math.min(250, now - lastFrame); lastFrame = now;
  ftAvg = ftAvg * 0.92 + ft * 0.08; fpsN++;
  if (now - fpsT >= 500) {
    Q.fpsNow = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now;
    if (Q.fps) {
      if (!fpsEl) { fpsEl = document.createElement('div'); fpsEl.id = 'gfx-fps-counter'; document.body.appendChild(fpsEl); }
      fpsEl.hidden = false;
      fpsEl.textContent = Q.fpsNow + ' FPS · ' + RT.w + '×' + RT.h + (Q.gpuOK ? ' · GPU ' + Q.gpuMs.toFixed(1) + ' ms' : '') + ' · ' + NAMES[Q.eff()];
    } else if (fpsEl) fpsEl.hidden = true;
  }
  if (tq) timerPoll();
  dynRes(ft / 1000);
}
function setScale(s) { s = Math.round(Math.max(direct() ? 0.6 : 0.5, Math.min(1, s)) * 20) / 20; if (s !== Q.scale) { Q.scale = s; if (direct()) applySize(); if (G.onGfxInfo) G.onGfxInfo(); } }
function dynRes(dt) {
  if (!Q.dyn) { if (Q.scale !== 1) setScale(1); return; }
  if (G.state && G.state.paused) return;
  dynT += dt;
  const fps = Q.cap || 60, frameMs = 1000 / fps;
  if (Q.gpuOK) {
    const budget = frameMs * 0.82;
    if (dynT > 0.75 && Q.gpuMs > budget * 1.06) { setScale(Q.scale * Math.max(0.8, Math.sqrt(budget / Q.gpuMs))); dynT = 0; }
    else if (dynT > 2 && Q.gpuMs < budget * 0.7 && Q.scale < 1) { setScale(Q.scale + 0.05); dynT = 0; }
  } else {
    if (dynT > 1 && ftAvg > frameMs * 1.3) { setScale(Q.scale - 0.1); dynT = 0; probeT = 0; }
    else if (dynT > 4 && ftAvg < frameMs * 1.08 && Q.scale < 1) { probeT += dt; if (probeT > 4) { setScale(Q.scale + 0.05); dynT = 0; probeT = 0; } }
  }
  // "Tự động": still slow at half resolution → step the quality down one level (remembered on this browser)
  if (Q.preset === 'auto' && Q.scale <= (direct() ? 0.6 : 0.5) && ftAvg > frameMs * 1.6 && Q.eff() !== 'low' && Q.eff() !== 'mobile') {
    slowT += dt;
    if (slowT > 6) { slowT = 0; Q.tierAdj = (Q.tierAdj | 0) + 1; Q.save(); G.applyGfx(); if (G.ui && G.ui.toast) G.ui.toast('Đã tự giảm chất lượng đồ họa xuống “' + NAMES[Q.eff()] + '” để chơi mượt hơn', 3200); }
  } else slowT = 0;
}

// ---------------- apply settings ----------------
let applied = null;
G.applyGfx = function () {
  const P = Q.P = Object.assign({}, PRESETS[Q.eff()], Q.over);
  if (!HALF) P.bloom = 0;
  surfOn = !!P.surf;
  const key = [P.shadow ? SHADOWS[P.shadow].type : 'off', P.surf, P.macro, P.bevel, direct() ? 'direct' : 'pipe'].join(',');
  applySize();
  applyShadows();
  if (key !== gfxKey) { gfxKey = key; if (applied) G.gfxRecompile(); }
  M.ssao.defines.SAMPLES = P.ssao === 2 ? 16 : 10; M.ssao.needsUpdate = true;
  const cd = M.comp.defines, want = { USE_AO: !!P.ssao, USE_BLOOM: !!P.bloom, USE_SHARP: P.sharp > 0.01, USE_CA: !!P.ca };
  let ch = false; for (const k in want) { if (!!cd[k] !== want[k]) { if (want[k]) cd[k] = 1; else delete cd[k]; ch = true; } }
  if (ch) M.comp.needsUpdate = true;
  // anisotropic filtering on canvas / data textures (render-target textures are set when they are baked)
  const A = Math.min(P.aniso || 1, caps.getMaxAnisotropy());
  const seen = new Set();
  const fix = (t) => { if (!t || seen.has(t) || t.isRenderTargetTexture) return; seen.add(t); if (t.anisotropy !== A && (t.isCanvasTexture || t.isDataTexture || t.image)) { t.anisotropy = A; t.needsUpdate = true; } };
  const mats = new Set(); scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m)); });
  if (G.MAT) Object.values(G.MAT).forEach((m) => mats.add(m));
  mats.forEach((m) => { fix(m.map); fix(m.emissiveMap); });
  Q.aniso = A;
  if (G.texgen && G.texgen.setQuality) G.texgen.setQuality(P.tex, A);
  // the sky's own light (IBL) replaces part of the flat hemisphere fill
  // (without IBL on phones the plain sky fill stands in for it by day; at night the sky gives almost no light, so the
  // fill stays where it was and the dark stays dark)
  G.hemiMul = P.ibl ? 0.5 : P.pipe === 0 ? (n) => G.lerp(0.9, 0.5, n) : 1; if (G.setTime) G.setTime(G.timeH);
  applied = JSON.stringify(P);
  if (G.onGfxInfo) G.onGfxInfo();
};
// force every material to rebuild its shader (after a change in shadow type or shader features)
G.gfxRecompile = function () {
  const mats = new Set();
  scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m)); });
  if (G.MAT) Object.values(G.MAT).forEach((m) => mats.add(m));
  mats.forEach((m) => { m.needsUpdate = true; });
};

// ---------------- the frame ----------------
const _p = new T.Vector4();
G.render = function () {
  const now = performance.now();
  R.info.reset();
  if (G.texgen && G.texgen.pending) G.texgen.step(12);
  frameStats(now);
  updateGlobals(now);
  updateEnv(now);
  if (!R.shadowMap.autoUpdate) { G._shF = ((G._shF | 0) + 1) % Math.max(1, Math.round(60 / Q.P.shadowHz)); if (!G._shF) R.shadowMap.needsUpdate = true; }
  if (direct()) {
    // same exposure and ACES curve as the composite pass, applied in the materials themselves
    // light added on top (searchlight and flashlight pools, lamp glows, fire) is added as it is, like it is before the
    // composite's tone curve — otherwise the pools that show the player where danger is come out dim
    if (now - (G._addT || 0) > 2000) { G._addT = now; scene.traverse((o) => { const m = o.material; if (m && !Array.isArray(m) && m.blending === T.AdditiveBlending && m.toneMapped && (m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial)) { m.toneMapped = false; m.needsUpdate = true; } }); }
    if (G.updateLightPool) G.updateLightPool(Math.min(0.1, (now - (G._lpT || now)) / 1000)); G._lpT = now;
    if (G.beamUniforms) G.beamUniforms.uSoftOn.value = 0;
    const ex = R.toneMappingExposure;
    R.toneMappingExposure = ex * (G.gfxExposure || 1) * (Q.P.ibl ? G.lerp(0.74, 1.08, G.night) : 1);
    timerBegin();
    R.toneMapping = T.ACESFilmicToneMapping; R.setRenderTarget(null); camera.layers.enable(1);
    // (phones, first frame of the Myanmar map: three.js once trips over a buffer it is still setting up; skip that
    // one frame instead of losing the rest of the game's frame)
    try { R.render(scene, camera); } catch (e) { if (!G._renderSkip) { G._renderSkip = String(e); console.warn('frame skipped:', e); } }
    camera.layers.disable(1);
    timerEnd();
    R.toneMappingExposure = ex; RT.w = R.domElement.width; RT.h = R.domElement.height;
    return;
  }
  ensureTargets();
  timerBegin();
  const P = Q.P, ac = R.autoClear;
  R.toneMapping = T.NoToneMapping;
  if (G.updateLightPool) G.updateLightPool(Math.min(0.1, (now - (G._lpT || now)) / 1000)); G._lpT = now;
  // light beams / soft particles (layer 1): with MSAA the resolved depth is a separate texture, so they get their
  // own pass after the opaque scene and fade softly into walls and floors; otherwise they join the main pass
  const softOn = RT.samples > 0, bu = G.beamUniforms;
  if (bu) { bu.uSoftOn.value = softOn ? 1 : 0; bu.tDepth.value = softOn ? RT.scene.depthTexture : null; /* without MSAA that texture is attached to the buffer being drawn: sampling it is a feedback loop and WebGL drops every beam */ bu.uRes.value.set(RT.w, RT.h); bu.uNF.value.set(camera.near, camera.far); bu.uTime.value = (now / 1000) % 3600; }
  if (!softOn) camera.layers.enable(1);
  R.autoClear = true; R.setRenderTarget(RT.scene); R.render(scene, camera);
  R.autoClear = false;
  if (softOn) { camera.layers.set(1); R.render(scene, camera); camera.layers.set(0); } else camera.layers.disable(1);
  const w = RT.w, h = RT.h;
  // SSAO from the depth buffer, blurred along the surface (depth-aware)
  if (P.ssao && RT.ao) {
    const u = M.ssao.uniforms, pm = camera.projectionMatrix.elements;
    u.tDepth.value = RT.scene.depthTexture; u.uDepthTexel.value.set(1 / w, 1 / h); u.uAspect.value.set(h / w, 1);
    u.uProj.value.set(pm[0], pm[5], camera.near, camera.far);
    pass(M.ssao, RT.ao);
    const b = M.blur.uniforms;
    b.tAO.value = RT.ao.texture; b.uDir.value.set(1 / RT.ao.width, 0); pass(M.blur, RT.ao2);
    b.tAO.value = RT.ao2.texture; b.uDir.value.set(0, 1 / RT.ao.height); pass(M.blur, RT.ao);
  }
  // bloom: thresholded 13-tap downsample chain, then tent upsampling back up
  if (P.bloom && RT.down && RT.down.length) {
    const th = HALF ? 0.96 / Math.max(0.3, R.toneMappingExposure * (G.gfxExposure || 1) / 0.6) : 0.82, knee = th * 0.5;
    let u = M.pre.uniforms; u.tSrc.value = RT.scene.texture; u.uTexel.value.set(1 / w, 1 / h); u.uTh.value.set(th, th - knee, 2 * knee, 0.25 / knee);
    pass(M.pre, RT.down[0]);
    for (let i = 1; i < RT.down.length; i++) { u = M.down.uniforms; u.tSrc.value = RT.down[i - 1].texture; u.uTexel.value.set(1 / RT.down[i - 1].width, 1 / RT.down[i - 1].height); pass(M.down, RT.down[i]); }
    for (let i = RT.down.length - 2; i >= 0; i--) {
      u = M.up.uniforms; const low = i === RT.down.length - 2 ? RT.down[i + 1] : RT.up[i + 1];
      u.tLow.value = low.texture; u.tHigh.value = RT.down[i].texture; u.uTexel.value.set(1 / low.width, 1 / low.height); u.uK.value = 0.85;
      pass(M.up, RT.up[i]);
    }
  }
  const c = M.comp.uniforms;
  c.tScene.value = RT.scene.texture; c.tAO.value = RT.ao ? RT.ao.texture : null; c.tBloom.value = RT.up && RT.up[0] ? RT.up[0].texture : null;
  c.uTexel.value.set(1 / w, 1 / h); c.uExposure.value = R.toneMappingExposure * (G.gfxExposure || 1) * (P.ibl ? G.lerp(0.74, 1.08, G.night) : 1);
  c.uBloom.value = (G.night > 0.5 ? 0.55 : 0.22) * (G.gfxBloomMul || 1); c.uAO.value = 0.9; c.uSharp.value = P.sharp || 0;
  c.uGrain.value = P.grain ? (G.night > 0.5 ? 1 : 0.55) : 0; c.uTime.value = (now / 1000) % 1000; c.uCA.value = P.ca ? 0.0009 : 0;
  if (RT.ldr) { pass(M.comp, RT.ldr); const f = M.fxaa.uniforms; f.tSrc.value = RT.ldr.texture; f.uTexel.value.set(1 / RT.ldr.width, 1 / RT.ldr.height); pass(M.fxaa, null); }
  else pass(M.comp, null);
  R.autoClear = ac;
  timerEnd();
};

// ---------------- settings UI (graphics tab) ----------------
const $ = (id) => document.getElementById(id);
function setText(id, s) { const e = $(id); if (e) e.textContent = s; }
G.onGfxInfo = function () {
  const cw = R.domElement.width, ch = R.domElement.height;
  const eff = Q.eff(), custom = Object.keys(Q.over).length > 0;
  setText('gfx-info', 'Đang vẽ ' + cw + ' × ' + ch + (Q.scale < 1 ? ' (động ' + Math.round(Q.scale * 100) + '%: ' + RT.w + ' × ' + RT.h + ')' : '') + ' · Chất lượng: ' + NAMES[eff] + (Q.preset === 'auto' ? ' (tự động)' : '') + (custom ? ', tùy chỉnh' : '') + (GPU ? ' · ' + GPU.replace(/^ANGLE \(|\)$/g, '').replace(/ Direct3D.*$/, '').replace(/\s*\(0x[0-9a-f]+\)/i, '') : ''));
};
function syncUI() {
  const P = Q.P;
  const set = (id, v) => { const e = $(id); if (!e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = String(v); };
  set('gfx-preset', Q.preset); set('gfx-res', Q.res); set('gfx-dyn', Q.dyn); set('gfx-cap', Q.cap); set('gfx-fps', Q.fps);
  set('gfx-shadow', P.shadow | 0); set('gfx-ssao', P.ssao | 0); set('gfx-bloom', !!P.bloom); set('gfx-tex', P.tex);
  set('gfx-aa', P.aa ? String(P.aa) : P.fxaa ? 'fxaa' : '0'); set('gfx-sharp', Math.round((P.sharp || 0) * 100));
  setText('gfx-sharp-val', Math.round((P.sharp || 0) * 100) + '%');
  const pre = $('gfx-preset'); if (pre) for (const o of pre.options) { const k = o.value; o.textContent = k === 'auto' ? 'Tự động (' + NAMES[Q.eff() === 'auto' ? Q.tier : (Q.preset === 'auto' ? Q.eff() : Q.tier)] + ')' : NAMES[k]; }
  setText('gfx-custom', Object.keys(Q.over).length ? 'Đang dùng tùy chỉnh riêng. Chọn lại một mức chất lượng để bỏ tùy chỉnh.' : '');
  G.onGfxInfo();
}
G.gfxSyncUI = syncUI;
function bindUI() {
  const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
  on('gfx-preset', 'change', (e) => { Q.preset = e.target.value; Q.over = {}; if (Q.preset !== 'auto') Q.tierAdj = 0; Q.save(); G.applyGfx(); syncUI(); });
  on('gfx-res', 'change', (e) => { Q.res = e.target.value; Q.save(); G.applyGfx(); syncUI(); });
  on('gfx-dyn', 'change', (e) => { Q.dyn = e.target.checked; Q.save(); if (!Q.dyn) setScale(1); syncUI(); });
  on('gfx-cap', 'change', (e) => { Q.cap = +e.target.value || 0; Q.save(); });
  on('gfx-fps', 'change', (e) => { Q.fps = e.target.checked; Q.save(); });
  const over = (k, v) => { Q.over[k] = v; if (PRESETS[Q.eff()][k] === v) delete Q.over[k]; Q.save(); G.applyGfx(); syncUI(); };
  on('gfx-shadow', 'change', (e) => over('shadow', +e.target.value));
  on('gfx-ssao', 'change', (e) => over('ssao', +e.target.value));
  on('gfx-bloom', 'change', (e) => over('bloom', e.target.checked ? 1 : 0));
  on('gfx-tex', 'change', (e) => over('tex', +e.target.value));
  on('gfx-aa', 'change', (e) => { const v = e.target.value; Q.over.aa = v === 'fxaa' || v === '0' ? 0 : +v; Q.over.fxaa = v === 'fxaa' ? 1 : 0; const p = PRESETS[Q.eff()]; if (p.aa === Q.over.aa) delete Q.over.aa; if (p.fxaa === Q.over.fxaa) delete Q.over.fxaa; Q.save(); G.applyGfx(); syncUI(); });
  on('gfx-sharp', 'input', (e) => { Q.over.sharp = (+e.target.value) / 100; Q.P.sharp = Q.over.sharp; setText('gfx-sharp-val', e.target.value + '%'); });
  on('gfx-sharp', 'change', () => { Q.save(); G.applyGfx(); syncUI(); });
  // tabs
  document.querySelectorAll('[data-set-tab]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.setTab;
    document.querySelectorAll('[data-set-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('[data-set-pane]').forEach((p) => { p.hidden = p.dataset.setPane !== k; });
  }));
}

// ---------------- start ----------------
G.applyGfx();
bindUI();
syncUI();
})(window.G);
