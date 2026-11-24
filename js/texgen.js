// texgen.js — procedural PBR surfaces, baked on the GPU (no image files): for every base material an albedo map
// (with opacity), a tangent-space normal map taken from the height field, and a roughness / metalness map — at the
// size the quality setting asks for (512 → 2048, re-baked when it changes). Replaces the flat canvas textures that
// core.js made, keeps their tiling and layouts (tiles 4×4, 16 roof ridges, 4×4 windows on facades, …), and after
// each level loads, gives every material that uses one of these maps the matching normal / roughness maps too.
(function (G) {
'use strict';
const T = G.T, R = G.renderer, TX = G.TX, MAT = G.MAT;

// shared GLSL: always the head; the other functions only when a surface calls them (smaller shaders compile faster)
const LIB_HEAD = `
precision highp float;
varying vec2 vUv;
uniform float uMode;   // 0 albedo + opacity, 1 roughness/metalness + 16-bit height, 3 emissive
uniform float uEps;    // one texel in uv
uniform float uBump;
uniform float uVar;    // variant
#define PI 3.14159265
vec3 C( float r, float g, float b ) { return pow( vec3( r, g, b ) / 255.0, vec3( 2.2 ) ); }
float hash12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
vec2 hash22( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.xx + p3.yz ) * p3.zy ); }
// tileable gradient noise: lattice period per (integer)
float gnoise( vec2 p, vec2 per ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
  vec2 a = hash22( mod( i, per ) ) * 2.0 - 1.0, b = hash22( mod( i + vec2( 1.0, 0.0 ), per ) ) * 2.0 - 1.0;
  vec2 c = hash22( mod( i + vec2( 0.0, 1.0 ), per ) ) * 2.0 - 1.0, d = hash22( mod( i + vec2( 1.0, 1.0 ), per ) ) * 2.0 - 1.0;
  float va = dot( a, f ), vb = dot( b, f - vec2( 1.0, 0.0 ) ), vc = dot( c, f - vec2( 0.0, 1.0 ) ), vd = dot( d, f - vec2( 1.0, 1.0 ) );
  return clamp( 0.5 + 0.8 * mix( mix( va, vb, u.x ), mix( vc, vd, u.x ), u.y ), 0.0, 1.0 );
}
`;
const LIB_FN = {
  vnoise: `float vnoise( vec2 p, vec2 per ) {
  vec2 i = floor( p ), f = fract( p ); vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash12( mod( i, per ) ), hash12( mod( i + vec2( 1.0, 0.0 ), per ) ), u.x ), mix( hash12( mod( i + vec2( 0.0, 1.0 ), per ) ), hash12( mod( i + vec2( 1.0, 1.0 ), per ) ), u.x ), u.y );
}`,
  // tileable cellular noise: x = distance to the nearest point, y = second nearest, z = id of the nearest cell
  voro: `vec3 voro( vec2 uv, vec2 fr, float jit ) {
  vec2 p = uv * fr, i = floor( p ), f = fract( p ); float F1 = 9.0, F2 = 9.0, id = 0.0;
  for ( int y = -1; y <= 1; y ++ ) for ( int x = -1; x <= 1; x ++ ) {
    vec2 g = vec2( float( x ), float( y ) ), c = mod( i + g, fr ), r = g + 0.5 + ( hash22( c ) - 0.5 ) * jit - f; float d = dot( r, r );
    if ( d < F1 ) { F2 = F1; F1 = d; id = hash12( c * 1.37 + 0.11 ); } else if ( d < F2 ) F2 = d;
  }
  return vec3( sqrt( F1 ), sqrt( F2 ), id );
}`,
  lum: 'float lum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }',
  // thin random scratches: segments in a rotated grid
  scratches: `float scratches( vec2 uv, float n, float seed ) {
  float s = 0.0;
  for ( int k = 0; k < 3; k ++ ) {
    float fk = float( k ) + seed;
    float ang = hash12( vec2( fk, 7.1 ) ) * PI;
    vec2 d = vec2( cos( ang ), sin( ang ) );
    vec2 q = vec2( dot( uv, d ), dot( uv, vec2( - d.y, d.x ) ) ) * n;
    float row = floor( q.y ); float on = step( 0.82, hash12( vec2( row, fk ) ) );
    float seg = step( 0.55, vnoise( vec2( q.x * 0.35 + row * 3.1, fk ), vec2( 1e4 ) ) );
    s += on * seg * smoothstep( 0.06, 0.0, abs( fract( q.y ) - 0.5 ) );
  }
  return clamp( s, 0.0, 1.0 );
}`,
};
for (let n = 1; n <= 6; n++) {
  LIB_FN['fbm' + n] = `float fbm${n}( vec2 uv, vec2 fr ) { float s = 0.0, a = 0.5, t = 0.0; for ( int i = 0; i < ${n}; i ++ ) { s += a * gnoise( uv * fr, fr ); t += a; fr *= 2.0; a *= 0.5; } return s / t; }`;
  LIB_FN['ridge' + n] = `float ridge${n}( vec2 uv, vec2 fr ) { float s = 0.0, a = 0.5, t = 0.0; for ( int i = 0; i < ${n}; i ++ ) { s += a * ( 1.0 - abs( gnoise( uv * fr, fr ) * 2.0 - 1.0 ) ); t += a; fr *= 2.0; a *= 0.5; } return s / t; }`;
}
function libFor(code) {
  const uses = (n) => new RegExp('\\b' + n + '\\s*\\(').test(code);
  let s = LIB_HEAD;
  if (uses('vnoise') || uses('scratches')) s += LIB_FN.vnoise + '\n';
  for (const k in LIB_FN) if (k !== 'vnoise' && uses(k)) s += LIB_FN[k] + '\n';
  return s;
}
// each surface: void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a )  (+ optional emis)
const S = {};
S.concrete = { bump: 0.008, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float big = fbm( uv, vec2( 3.0 ), 4 ), mid = fbm( uv + 0.37, vec2( 14.0 ), 4 ), fine = fbm( uv + 0.71, vec2( 96.0 ), 3 );
  float grain = gnoise( uv * 384.0, vec2( 384.0 ) );
  vec3 vp = voro( uv, vec2( 64.0 ), 1.0 );
  float pit = smoothstep( 0.12, 0.03, vp.x ) * step( 0.93, vp.z ) * 0.7;
  vec3 vc = voro( uv + ( fbm( uv, vec2( 7.0 ), 3 ) - 0.5 ) * 0.07, vec2( 4.0 ), 1.0 );
  float crack = smoothstep( 0.016, 0.0, vc.y - vc.x ) * smoothstep( 0.6, 0.72, fbm( uv + 0.13, vec2( 5.0 ), 3 ) );
  float streak = smoothstep( 0.5, 0.85, fbm( uv + vec2( 0.2, 0.0 ), vec2( 34.0, 2.0 ), 3 ) ) * smoothstep( 0.35, 0.75, big );
  float seam = smoothstep( 0.0035, 0.001, abs( uv.y - 0.5 ) );
  vec3 col = C( 150.0, 145.0, 135.0 ) * ( 0.74 + 0.36 * big ) * ( 0.88 + 0.2 * mid ) * ( 0.93 + 0.14 * grain );
  col = mix( col, col * vec3( 0.74, 0.72, 0.69 ), streak * 0.65 );
  col = mix( col, C( 128.0, 124.0, 116.0 ), smoothstep( 0.62, 0.9, mid ) * 0.35 );
  alb = col * ( 1.0 - pit * 0.6 - crack * 0.55 - seam * 0.35 );
  h = 0.55 + ( mid - 0.5 ) * 0.14 + ( fine - 0.5 ) * 0.02 + ( grain - 0.5 ) * 0.008 - pit * 0.3 - crack * 0.35 - seam * 0.3;
  r = clamp( 0.92 + ( fine - 0.5 ) * 0.12 - streak * 0.1, 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.asphalt = { bump: 0.01, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float big = fbm( uv, vec2( 3.0 ), 4 ), mid = fbm( uv + 0.5, vec2( 18.0 ), 3 );
  vec3 st = voro( uv, vec2( 160.0 ), 1.0 );
  float stone = smoothstep( 0.42, 0.2, st.x );
  float tar = smoothstep( 0.62, 0.7, fbm( uv + 0.21, vec2( 4.0 ), 4 ) );
  vec3 vc = voro( uv + ( fbm( uv, vec2( 6.0 ), 3 ) - 0.5 ) * 0.08, vec2( 3.0 ), 1.0 );
  float crack = smoothstep( 0.012, 0.0, vc.y - vc.x ) * smoothstep( 0.55, 0.7, fbm( uv + 0.9, vec2( 4.0 ), 3 ) );
  vec3 col = C( 58.0, 58.0, 60.0 ) * ( 0.8 + 0.3 * big ) * ( 0.9 + 0.2 * mid );
  col = mix( col, C( 92.0, 90.0, 88.0 ) * ( 0.75 + 0.45 * st.z ), stone * 0.32 );
  col = mix( col, C( 30.0, 30.0, 32.0 ), tar * 0.7 );
  alb = col * ( 1.0 - crack * 0.6 );
  h = 0.5 + stone * 0.12 * st.z - crack * 0.5 + ( mid - 0.5 ) * 0.08 - tar * 0.05;
  r = clamp( 0.82 - tar * 0.25 + ( st.z - 0.5 ) * 0.1, 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.plaster = { bump: 0.014, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float big = fbm( uv, vec2( 3.0 ), 4 ), peel = fbm( uv + 0.41, vec2( 5.0 ), 5 );
  float orange = fbm( uv + 0.17, vec2( 70.0 ), 3 );
  vec3 vp = voro( uv, vec2( 3.0 ), 0.9 );
  float rep = step( 0.72, vp.z ) * smoothstep( 0.02, 0.06, vp.y - vp.x );
  float bare = smoothstep( 0.71, 0.735, peel );
  float edge = smoothstep( 0.695, 0.712, peel ) - bare;
  float streak = smoothstep( 0.45, 0.85, fbm( uv + vec2( 0.3, 0.0 ), vec2( 28.0, 2.0 ), 3 ) ) * smoothstep( 0.3, 0.8, big );
  vec3 vc = voro( uv + ( fbm( uv, vec2( 8.0 ), 3 ) - 0.5 ) * 0.06, vec2( 5.0 ), 1.0 );
  float crack = smoothstep( 0.012, 0.0, vc.y - vc.x ) * smoothstep( 0.62, 0.74, fbm( uv + 0.6, vec2( 4.0 ), 3 ) );
  vec3 paint = C( 196.0, 182.0, 150.0 ) * ( 0.84 + 0.26 * big ) * ( 0.95 + 0.1 * orange );
  paint = mix( paint, paint * vec3( 1.04, 1.0, 0.94 ), rep * 0.6 );
  vec3 render = C( 172.0, 166.0, 152.0 ) * ( 0.85 + 0.2 * fbm( uv, vec2( 40.0 ), 3 ) );
  vec3 col = mix( paint, render, bare );
  col = mix( col, col * vec3( 0.66, 0.62, 0.55 ), streak * 0.6 );
  alb = col * ( 1.0 - edge * 0.35 - crack * 0.5 );
  h = 0.6 + ( orange - 0.5 ) * 0.05 - bare * 0.08 + edge * 0.04 - crack * 0.3 + rep * 0.02;
  r = clamp( mix( 0.78 + ( orange - 0.5 ) * 0.15, 0.93, bare ) - streak * 0.08, 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.epoxy = { bump: 0.006, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float big = fbm( uv, vec2( 3.0 ), 4 ), swirl = fbm( uv + 0.3, vec2( 9.0 ), 4 );
  float wear = smoothstep( 0.71, 0.79, fbm( uv + 0.77, vec2( 4.0 ), 5 ) );
  float sc = scratches( uv, 70.0, 1.0 ) * 0.3;
  float joint = max( smoothstep( 0.003, 0.0, min( uv.x, 1.0 - uv.x ) ), smoothstep( 0.003, 0.0, min( uv.y, 1.0 - uv.y ) ) );
  vec3 paint = C( 54.0, 112.0, 88.0 ) * ( 0.85 + 0.25 * big ) * ( 0.94 + 0.12 * swirl );
  vec3 conc = C( 132.0, 128.0, 120.0 ) * ( 0.8 + 0.3 * fbm( uv, vec2( 60.0 ), 3 ) );
  vec3 col = mix( paint, conc, wear );
  col = mix( col, col * 1.2 + 0.01, sc * ( 1.0 - wear ) * 0.5 );
  alb = col * ( 1.0 - joint * 0.6 );
  h = 0.6 - wear * 0.08 - sc * 0.03 - joint * 0.4 + ( swirl - 0.5 ) * 0.02;
  r = clamp( mix( 0.22 + ( swirl - 0.5 ) * 0.1, 0.82, wear ) + sc * 0.12, 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.tile = { bump: 0.01, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  vec2 q = uv * 4.0, cell = floor( q ), f = fract( q );
  float id = hash12( cell + 3.1 );
  float e = min( min( f.x, 1.0 - f.x ), min( f.y, 1.0 - f.y ) );
  float grout = smoothstep( 0.022, 0.012, e );
  float bevel = smoothstep( 0.012, 0.05, e );
  float mott = fbm( uv + id, vec2( 24.0 ), 3 );
  vec3 vc = voro( uv + id * 0.37, vec2( 6.0 ), 1.0 );
  float crack = step( 0.85, hash12( cell + 9.7 ) ) * smoothstep( 0.012, 0.0, vc.y - vc.x );
  float dirt = smoothstep( 0.12, 0.0, e ) * 0.35 + smoothstep( 0.55, 0.8, fbm( uv, vec2( 6.0 ), 4 ) ) * 0.25;
  vec3 tile = C( 196.0, 184.0, 160.0 ) * ( 0.9 + 0.16 * id ) * ( 0.95 + 0.1 * mott );
  vec3 gr = C( 92.0, 86.0, 76.0 ) * ( 0.8 + 0.3 * fbm( uv, vec2( 80.0 ), 2 ) );
  vec3 col = mix( tile * ( 1.0 - dirt * 0.4 ), gr, grout );
  alb = col * ( 1.0 - crack * 0.5 );
  h = mix( 0.25, 0.75 + ( mott - 0.5 ) * 0.02, bevel ) - crack * 0.2;
  r = clamp( mix( 0.16 + dirt * 0.4 + ( mott - 0.5 ) * 0.08, 0.9, grout ), 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.roof = { bump: 0.02, metal: true, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float wave = 0.5 + 0.5 * sin( uv.x * 16.0 * 2.0 * PI );
  vec3 sp = voro( uv, vec2( 64.0 ), 1.0 );
  float rustN = fbm( uv + 0.33, vec2( 6.0 ), 5 );
  float runs = smoothstep( 0.45, 0.9, fbm( vec2( uv.x, uv.y ), vec2( 48.0, 3.0 ), 3 ) );
  float screwRow = smoothstep( 0.012, 0.004, abs( fract( uv.y * 4.0 ) - 0.5 ) );
  float screw = screwRow * smoothstep( 0.18, 0.08, abs( fract( uv.x * 16.0 ) - 0.25 ) );
  float rust = clamp( smoothstep( 0.52, 0.7, rustN ) + runs * smoothstep( 0.4, 0.6, rustN ) * 0.8 + screw * 0.6, 0.0, 1.0 );
  vec3 zinc = C( 168.0, 172.0, 174.0 ) * ( 0.85 + 0.2 * sp.z ) * ( 0.9 + 0.15 * fbm( uv, vec2( 3.0 ), 3 ) );
  vec3 rc = mix( C( 120.0, 62.0, 30.0 ), C( 70.0, 40.0, 24.0 ), fbm( uv + 0.6, vec2( 30.0 ), 3 ) );
  alb = mix( zinc, rc, rust ) * ( 0.85 + 0.15 * wave );
  h = wave * 0.9 + screw * 0.1 + rust * ( fbm( uv, vec2( 90.0 ), 2 ) - 0.5 ) * 0.1;
  r = mix( 0.32 + sp.z * 0.12, 0.86, rust ); m = mix( 0.85, 0.05, rust ); a = 1.0;
}` };
S.metal = { bump: 0.018, metal: true, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float x = fract( uv.x * 8.0 );
  float rib = smoothstep( 0.0, 0.08, x ) * smoothstep( 0.42, 0.34, x ) + smoothstep( 0.5, 0.58, x ) * smoothstep( 1.0, 0.92, x ) * 0.25;
  float chipN = fbm( uv + 0.21, vec2( 9.0 ), 5 );
  float chip = smoothstep( 0.66, 0.68, chipN );
  float rustE = smoothstep( 0.6, 0.66, chipN ) - chip;
  float fade = fbm( uv, vec2( 3.0 ), 4 );
  float streak = smoothstep( 0.5, 0.9, fbm( uv + 0.5, vec2( 40.0, 2.0 ), 3 ) );
  vec3 paint = C( 78.0, 106.0, 116.0 ) * ( 0.8 + 0.3 * fade ) * ( 1.0 - streak * 0.25 );
  vec3 bare = C( 150.0, 150.0, 148.0 ), rc = C( 110.0, 58.0, 28.0 );
  vec3 col = mix( paint, bare, chip ); col = mix( col, rc, rustE * 0.9 + streak * 0.12 );
  alb = col;
  h = rib * 0.8 + 0.2 - chip * 0.04 + rustE * 0.02;
  r = clamp( mix( 0.46 + ( fade - 0.5 ) * 0.12, 0.34, chip ) + rustE * 0.4, 0.0, 1.0 ); m = mix( 0.0, 0.9, chip ); a = 1.0;
}` };
S.rust = { bump: 0.02, metal: true, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float wave = 0.5 + 0.5 * sin( uv.x * 16.0 * 2.0 * PI );
  float n = fbm( uv, vec2( 5.0 ), 5 ), pit = fbm( uv + 0.4, vec2( 120.0 ), 2 );
  float paint = smoothstep( 0.6, 0.63, fbm( uv + 0.77, vec2( 4.0 ), 5 ) );
  float runs = smoothstep( 0.5, 0.9, fbm( uv + 0.3, vec2( 40.0, 3.0 ), 3 ) );
  vec3 rc = mix( C( 128.0, 66.0, 32.0 ), C( 64.0, 36.0, 22.0 ), smoothstep( 0.3, 0.75, n ) );
  rc = mix( rc, C( 160.0, 92.0, 46.0 ), smoothstep( 0.6, 0.9, pit ) * 0.5 );
  rc *= 1.0 - runs * 0.3;
  vec3 col = mix( rc, C( 90.0, 100.0, 104.0 ) * ( 0.8 + 0.3 * n ), paint );
  alb = col * ( 0.82 + 0.18 * wave );
  h = wave * 0.85 + ( pit - 0.5 ) * 0.12 * ( 1.0 - paint ) + paint * 0.03;
  r = clamp( mix( 0.86 + ( pit - 0.5 ) * 0.2, 0.5, paint ), 0.0, 1.0 ); m = mix( 0.12, 0.2, paint ); a = 1.0;
}` };
S.fence = { bump: 0.03, metal: true, alpha: true, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  vec2 q = vec2( uv.x + uv.y, uv.x - uv.y ) * 6.0;
  vec2 f = abs( fract( q ) - 0.5 );
  float w = min( f.x, f.y );
  float wire = smoothstep( 0.075, 0.035, 0.5 - max( f.x, f.y ) );
  float wire2 = smoothstep( 0.075, 0.035, w );
  float k = max( wire, wire2 );
  alb = C( 170.0, 176.0, 178.0 ) * ( 0.8 + 0.3 * fbm( uv, vec2( 12.0 ), 3 ) );
  h = k; r = 0.42; m = 0.85; a = k;
}` };
S.net = { bump: 0.02, alpha: true, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  vec2 f = abs( fract( uv * 36.0 ) - 0.5 );
  float strand = smoothstep( 0.2, 0.12, min( f.x, f.y ) );
  float knot = smoothstep( 0.3, 0.15, length( f - 0.5 ) );
  float sag = fbm( uv, vec2( 4.0 ), 3 );
  a = clamp( max( strand, knot ) * 0.95, 0.0, 1.0 ) * ( 0.75 + 0.25 * sag );
  alb = C( 34.0, 112.0, 62.0 ) * ( 0.75 + 0.4 * sag ) * ( 0.85 + 0.2 * hash12( floor( uv * 36.0 ) ) );
  h = max( strand, knot ); r = 0.82; m = 0.0;
}` };
S.mud = { bump: 0.014, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float big = fbm( uv, vec2( 3.0 ), 5 ), mid = fbm( uv + 0.4, vec2( 16.0 ), 4 );
  float pud = smoothstep( 0.6, 0.66, fbm( uv + 0.11, vec2( 4.0 ), 5 ) );
  float rut = smoothstep( 0.07, 0.0, abs( fract( uv.x * 3.0 + ( fbm( uv, vec2( 2.0 ), 3 ) - 0.5 ) * 0.6 ) - 0.5 ) - 0.05 );
  vec3 st = voro( uv, vec2( 70.0 ), 1.0 );
  float stone = smoothstep( 0.24, 0.1, st.x ) * step( 0.9, st.z );
  vec3 col = mix( C( 78.0, 58.0, 40.0 ), C( 50.0, 38.0, 28.0 ), big ) * ( 0.85 + 0.25 * mid );
  col = mix( col, C( 96.0, 88.0, 78.0 ) * ( 0.7 + 0.4 * st.z ), stone );
  col *= 1.0 - pud * 0.35 - rut * 0.15;
  alb = col;
  h = 0.5 + ( mid - 0.5 ) * 0.35 + ( big - 0.5 ) * 0.2 - pud * 0.25 + stone * 0.25 - rut * 0.15;
  h = mix( h, 0.25, pud );
  r = clamp( mix( 0.62 + ( mid - 0.5 ) * 0.3, 0.06, pud ), 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.dirt = { bump: 0.016, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float big = fbm( uv, vec2( 3.0 ), 5 ), mid = fbm( uv + 0.4, vec2( 20.0 ), 4 ), fine = gnoise( uv * 300.0, vec2( 300.0 ) );
  vec3 cr = voro( uv + ( fbm( uv, vec2( 10.0 ), 3 ) - 0.5 ) * 0.03, vec2( 14.0 ), 1.0 );
  float crack = smoothstep( 0.03, 0.0, cr.y - cr.x ) * smoothstep( 0.45, 0.65, big );
  vec3 pb = voro( uv, vec2( 90.0 ), 1.0 );
  float pebble = smoothstep( 0.32, 0.1, pb.x ) * step( 0.62, pb.z );
  vec3 col = mix( C( 126.0, 102.0, 76.0 ), C( 96.0, 80.0, 62.0 ), big ) * ( 0.86 + 0.24 * mid ) * ( 0.92 + 0.14 * fine );
  col = mix( col, C( 140.0, 132.0, 118.0 ) * ( 0.7 + 0.5 * pb.z ), pebble );
  alb = col * ( 1.0 - crack * 0.5 );
  h = 0.5 + ( mid - 0.5 ) * 0.25 + ( fine - 0.5 ) * 0.025 + pebble * 0.3 - crack * 0.35;
  r = clamp( 0.9 + ( fine - 0.5 ) * 0.1 - pebble * 0.2, 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.grass = { bump: 0.02, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float big = fbm( uv, vec2( 3.0 ), 5 ), mid = fbm( uv + 0.3, vec2( 12.0 ), 4 );
  float bare = smoothstep( 0.62, 0.72, fbm( uv + 0.55, vec2( 5.0 ), 5 ) );
  // blades: each cell of a fine grid holds a short stroke at a random angle
  float bl = 0.0, tone = 0.0;
  for ( int k = 0; k < 3; k ++ ) {
    float n = 70.0 + float( k ) * 23.0;
    vec2 q = uv * n; vec2 c = floor( q ), f = fract( q ) - 0.5;
    vec2 hh = hash22( mod( c, vec2( n ) ) + float( k ) * 7.3 );
    float ang = ( hh.x - 0.5 ) * 1.6;
    vec2 d = vec2( sin( ang ), cos( ang ) );
    float along = dot( f, d ), across = dot( f, vec2( d.y, - d.x ) );
    float s = smoothstep( 0.07, 0.0, abs( across ) ) * smoothstep( 0.42, 0.1, abs( along ) );
    bl = max( bl, s * ( 0.6 + 0.4 * hh.y ) ); tone += s * hh.y;
  }
  vec3 green = mix( C( 70.0, 92.0, 38.0 ), C( 104.0, 112.0, 50.0 ), mid ) * ( 0.75 + 0.35 * big );
  vec3 soil = C( 86.0, 70.0, 50.0 ) * ( 0.8 + 0.3 * mid );
  vec3 col = mix( green * ( 0.55 + 0.6 * bl + tone * 0.15 ), soil, bare * ( 1.0 - bl * 0.6 ) );
  alb = col;
  h = 0.4 + bl * 0.5 * ( 1.0 - bare * 0.6 ) + ( mid - 0.5 ) * 0.15;
  r = clamp( 0.82 - bl * 0.15 + bare * 0.1, 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.bamboo = { bump: 0.03, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float x = fract( uv.x * 16.0 ); float col16 = floor( uv.x * 16.0 );
  float id = hash12( vec2( col16, 1.3 ) );
  float cyl = sqrt( max( 0.0, 1.0 - pow( ( x - 0.5 ) * 2.1, 2.0 ) ) );
  float gap = smoothstep( 0.02, 0.06, x ) * smoothstep( 0.98, 0.94, x );
  float y = fract( uv.y * 2.0 + id );
  float node = smoothstep( 0.03, 0.0, abs( y - 0.5 ) ) ;
  float bulge = smoothstep( 0.06, 0.0, abs( y - 0.5 ) );
  float blot = smoothstep( 0.55, 0.8, fbm( uv + id, vec2( 16.0, 4.0 ), 4 ) );
  vec3 c = mix( C( 168.0, 160.0, 92.0 ), C( 120.0, 128.0, 60.0 ), id ) * ( 0.75 + 0.3 * fbm( uv, vec2( 64.0, 4.0 ), 3 ) );
  c = mix( c, C( 70.0, 62.0, 34.0 ), blot * 0.6 + node * 0.5 );
  alb = c * ( 0.55 + 0.45 * cyl ) * gap;
  h = cyl * 0.8 * gap + bulge * 0.12 - node * 0.05;
  r = 0.45 + blot * 0.3; m = 0.0; a = 1.0;
}` };
S.brick = { bump: 0.02, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float rows = 32.0, cols = 12.0;
  float row = floor( uv.y * rows );
  vec2 q = vec2( uv.x * cols + mod( row, 2.0 ) * 0.5, uv.y * rows );
  vec2 cell = vec2( floor( q.x ), row ), f = fract( q );
  vec2 cm = vec2( mod( cell.x, cols ), cell.y );
  float id = hash12( cm + 0.7 ), id2 = hash12( cm + 5.3 );
  // distance to the brick's edge in uv units (bricks are 1/12 wide and 1/32 tall)
  float e = min( min( f.x, 1.0 - f.x ) / cols, min( f.y, 1.0 - f.y ) / rows );
  float chip = ( fbm( uv + id, vec2( 96.0 ), 3 ) - 0.5 ) * 0.0035;
  float mortar = smoothstep( 0.0024, 0.0012, e + chip );
  float brickH = smoothstep( 0.0012, 0.0045, e + chip );
  float mott = fbm( uv + id * 3.0, vec2( 48.0 ), 3 );
  vec3 bc = mix( C( 150.0, 72.0, 48.0 ), C( 112.0, 50.0, 34.0 ), id ) * ( 0.8 + 0.3 * mott );
  bc = mix( bc, C( 70.0, 40.0, 30.0 ), step( 0.9, id2 ) * 0.6 );
  bc = mix( bc, C( 176.0, 120.0, 90.0 ), step( 0.93, id ) * 0.4 );
  float soot = smoothstep( 0.55, 0.85, fbm( uv, vec2( 3.0 ), 4 ) );
  vec3 mc = C( 150.0, 140.0, 124.0 ) * ( 0.75 + 0.3 * fbm( uv, vec2( 120.0 ), 2 ) );
  vec3 col = mix( bc, mc, mortar ) * ( 1.0 - soot * 0.45 );
  alb = col * ( 0.85 + 0.15 * brickH );
  h = mix( 0.2 + ( fbm( uv, vec2( 160.0 ), 2 ) - 0.5 ) * 0.1, 0.8 + ( mott - 0.5 ) * 0.1, brickH );
  r = clamp( mix( 0.95, 0.8 + ( mott - 0.5 ) * 0.2, brickH ), 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
// bricks stacked to dry / for sale in a kiln yard: no mortar, dark gaps between the bricks, less soot
S.brickstack = { bump: 0.028, minor: true, code: S.brick.code
  .replace('vec3 mc = C( 150.0, 140.0, 124.0 )', 'vec3 mc = C( 22.0, 15.0, 11.0 )')
  .replace('float mortar = smoothstep( 0.0024, 0.0012, e + chip );', 'float mortar = smoothstep( 0.0036, 0.0022, e + chip );')
  .replace('float brickH = smoothstep( 0.0012, 0.0045, e + chip );', 'float brickH = smoothstep( 0.0022, 0.0058, e + chip );')
  .replace('h = mix( 0.2 + ( fbm( uv, vec2( 160.0 ), 2 ) - 0.5 ) * 0.1,', 'h = mix( 0.0,')
  .replace('float soot = smoothstep( 0.55, 0.85, fbm( uv, vec2( 3.0 ), 4 ) );', 'float soot = smoothstep( 0.6, 0.9, fbm( uv, vec2( 3.0 ), 4 ) ) * 0.5;') };S.planks = { bump: 0.016, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float n = 8.0, b = floor( uv.x * n ), x = fract( uv.x * n );
  float id = hash12( vec2( b, 2.7 ) );
  float jy = fract( uv.y * 2.0 + id * 0.73 );
  float joint = smoothstep( 0.006, 0.0, abs( jy - 0.5 ) ) * step( 0.4, id );
  float gap = smoothstep( 0.0, 0.035, x ) * smoothstep( 1.0, 0.965, x );
  vec2 g = vec2( x * 3.0 + id * 7.0, uv.y * 2.0 );
  float grain = fbm( vec2( uv.x * n + id, uv.y ), vec2( 64.0, 4.0 ), 4 );
  float rings = sin( ( x * 18.0 + fbm( vec2( uv.x, uv.y * 0.5 ), vec2( 16.0, 2.0 ), 3 ) * 9.0 + id * 20.0 ) ) * 0.5 + 0.5;
  vec3 kv = voro( uv + id, vec2( 8.0, 3.0 ), 1.0 );
  float knot = smoothstep( 0.1, 0.02, kv.x ) * step( 0.8, kv.z );
  vec3 wood = mix( C( 134.0, 98.0, 64.0 ), C( 98.0, 70.0, 46.0 ), id ) * ( 0.75 + 0.35 * grain ) * ( 0.9 + 0.12 * rings );
  float weather = smoothstep( 0.4, 0.8, fbm( uv, vec2( 3.0 ), 4 ) );
  wood = mix( wood, vec3( lum( wood ) ) * vec3( 1.05, 1.0, 0.95 ) * 1.1, weather * 0.5 );
  wood = mix( wood, C( 52.0, 34.0, 22.0 ), knot * 0.8 );
  alb = wood * gap * ( 1.0 - joint * 0.7 );
  h = 0.6 * gap + ( grain - 0.5 ) * 0.12 + rings * 0.03 - joint * 0.3 - knot * 0.05;
  r = clamp( 0.72 + ( grain - 0.5 ) * 0.2 + weather * 0.12, 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.wood = { bump: 0.008, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float grain = fbm( uv, vec2( 24.0, 2.0 ), 5 );
  float rings = sin( uv.x * 90.0 + fbm( uv, vec2( 6.0, 2.0 ), 4 ) * 14.0 ) * 0.5 + 0.5;
  vec3 c = vec3( 1.0, 0.97, 0.94 ) * ( 0.78 + 0.3 * grain ) * ( 0.88 + 0.14 * rings );
  alb = c; h = grain * 0.6 + rings * 0.08; r = clamp( 0.68 + ( grain - 0.5 ) * 0.2, 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.steel = { bump: 0.004, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float brush = fbm( uv, vec2( 2.0, 256.0 ), 3 );
  float sc = scratches( uv, 40.0, 3.0 );
  float smud = fbm( uv + 0.5, vec2( 4.0 ), 4 );
  alb = vec3( 1.0 ) * ( 0.85 + 0.15 * brush ) * ( 1.0 - smoothstep( 0.6, 0.9, smud ) * 0.25 );
  h = 0.5 + ( brush - 0.5 ) * 0.2 - sc * 0.1;
  r = clamp( 0.4 + ( brush - 0.5 ) * 0.15 + smoothstep( 0.55, 0.85, smud ) * 0.25 - sc * 0.15, 0.0, 1.0 ); m = 1.0; a = 1.0;
}` };
S.plastic = { bump: 0.004, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float n = fbm( uv, vec2( 64.0 ), 3 ), sm = fbm( uv + 0.3, vec2( 3.0 ), 4 );
  alb = vec3( 1.0 ) * ( 0.94 + 0.08 * n ) * ( 1.0 - smoothstep( 0.6, 0.85, sm ) * 0.15 );
  h = n * 0.3; r = clamp( 0.5 + ( n - 0.5 ) * 0.2 + smoothstep( 0.6, 0.85, sm ) * 0.2, 0.0, 1.0 ); m = 0.0; a = 1.0;
}` };
S.fabric = { bump: 0.01, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  vec2 q = uv * 160.0;
  float wx = sin( q.x * PI ) * 0.5 + 0.5, wy = sin( q.y * PI ) * 0.5 + 0.5;
  float over = step( 0.5, fract( ( floor( q.x ) + floor( q.y ) ) * 0.5 ) );
  float weave = mix( wx, wy, over );
  float fz = fbm( uv, vec2( 32.0 ), 3 ), stain = smoothstep( 0.62, 0.8, fbm( uv + 0.4, vec2( 4.0 ), 4 ) );
  alb = vec3( 1.0 ) * ( 0.8 + 0.2 * weave ) * ( 0.9 + 0.15 * fz ) * ( 1.0 - stain * 0.25 );
  h = weave * 0.7 + fz * 0.2; r = 0.88; m = 0.0; a = 1.0;
}` };
S.bark = { bump: 0.03, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float fib = ridge( vec2( uv.x, uv.y ), vec2( 24.0, 3.0 ), 4 );
  float ring = smoothstep( 0.08, 0.0, abs( fract( uv.y * 6.0 + fbm( uv, vec2( 8.0, 1.0 ), 2 ) * 0.4 ) - 0.5 ) - 0.38 );
  float moss = smoothstep( 0.55, 0.8, fbm( uv + 0.2, vec2( 6.0, 3.0 ), 4 ) );
  vec3 c = vec3( 1.0, 0.95, 0.88 ) * ( 0.55 + 0.6 * fib );
  c = mix( c, vec3( 0.55, 0.75, 0.35 ), moss * 0.35 );
  alb = c * ( 1.0 - ring * 0.35 ); h = fib * 0.8 - ring * 0.2; r = 0.9; m = 0.0; a = 1.0;
}` };
// palm trunk: ring scars where old fronds fell, fibrous grey-brown bark between them
S.palmbark = { bump: 0.03, minor: true, code: `
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  float y = fract( uv.y * 14.0 + fbm( uv, vec2( 4.0, 2.0 ), 2 ) * 0.25 );
  float ring = smoothstep( 0.0, 0.12, y ) * smoothstep( 1.0, 0.75, y );
  float fib = ridge( uv, vec2( 40.0, 6.0 ), 3 );
  float n = fbm( uv, vec2( 6.0, 3.0 ), 4 );
  vec3 c = mix( C( 92.0, 84.0, 72.0 ), C( 128.0, 118.0, 100.0 ), n ) * ( 0.75 + 0.35 * fib );
  c *= 0.62 + 0.38 * ring;
  alb = c; h = ring * 0.7 + fib * 0.25; r = 0.88; m = 0.0; a = 1.0;
}` };
// tower facade: 4 bays × 4 floors per tile (12 m × 13.2 m). uVar 0 = office glass, 1 = barred dormitory windows
S.facade = { bump: 0.015, emis: true, code: `
float winMask( vec2 f, out float edge ) {
  vec2 lo = vec2( 0.13, 0.22 ), hi = vec2( 0.87, 0.8 );
  vec2 d = min( f - lo, hi - f ); edge = min( d.x, d.y * 1.1 );
  return step( 0.0, edge );
}
void surf( vec2 uv, out vec3 alb, out float h, out float r, out float m, out float a ) {
  vec2 q = uv * 4.0, cell = floor( q ), f = fract( q );
  float id = hash12( cell + 0.5 + uVar * 9.0 ), id2 = hash12( cell + 4.1 );
  float edge; float win = winMask( f, edge );
  float frame = win * smoothstep( 0.022, 0.016, edge );
  float mull = win * smoothstep( 0.012, 0.007, abs( f.x - 0.5 ) );
  float sill = smoothstep( 0.035, 0.0, abs( f.y - 0.2 ) ) * step( abs( f.x - 0.5 ), 0.4 );
  float band = smoothstep( 0.05, 0.035, min( f.y, 1.0 - f.y ) );
  float big = fbm( uv, vec2( 3.0, 2.0 ), 4 );
  float grime = ( 1.0 - win ) * step( abs( f.x - 0.5 ), 0.36 ) * step( f.y, 0.2 ) * smoothstep( 0.0, 0.2, f.y ) * ( 0.5 + 0.5 * fbm( uv, vec2( 64.0, 4.0 ), 3 ) );
  vec3 wall = ( uVar > 0.5 ? C( 158.0, 152.0, 140.0 ) : C( 176.0, 180.0, 180.0 ) ) * ( 0.8 + 0.3 * big ) * ( 0.94 + 0.1 * fbm( uv, vec2( 40.0 ), 3 ) );
  wall *= 1.0 - grime * 0.45;
  wall = mix( wall, wall * 0.86, band );
  // glass: dark, with curtains in some windows and a sky-coloured tint that fakes depth
  vec3 glass = mix( C( 34.0, 46.0, 58.0 ), C( 60.0, 76.0, 88.0 ), f.y );
  float curtain = step( 0.55, id2 ) * smoothstep( 0.4, 0.42, abs( f.x - 0.5 + ( id2 - 0.75 ) * 0.4 ) );
  glass = mix( glass, mix( C( 150.0, 120.0, 90.0 ), C( 90.0, 110.0, 130.0 ), id ) * 0.6, curtain * 0.7 );
  vec3 alu = C( 150.0, 152.0, 150.0 );
  vec3 col = mix( wall, glass, win );
  col = mix( col, alu * 0.8, max( frame, mull ) );
  // AC units on some windows (right of the sill)
  vec2 acp = vec2( ( f.x - 0.74 ) / 0.11, ( f.y - 0.06 ) / 0.11 );
  float ac = step( id, 0.3 ) * step( abs( acp.x ), 1.0 ) * step( abs( acp.y ), 1.0 );
  float grill = ac * ( 0.6 + 0.4 * sin( acp.x * 40.0 ) );
  col = mix( col, C( 200.0, 200.0, 194.0 ) * ( 0.85 + 0.15 * grill ), ac );
  // bars over the barred windows
  float bars = 0.0;
  if ( uVar > 0.5 ) {
    float bx = fract( ( f.x - 0.13 ) / 0.74 * 7.0 );
    bars = win * max( smoothstep( 0.18, 0.08, abs( bx - 0.5 ) - 0.32 ), smoothstep( 0.012, 0.006, abs( f.y - 0.51 ) ) );
    col = mix( col, C( 44.0, 44.0, 42.0 ), bars );
  }
  alb = col;
  h = mix( 0.75, 0.25, win ) + frame * 0.2 + mull * 0.15 + sill * 0.12 + band * 0.08 + ac * 0.6 + bars * 0.5;
  r = mix( mix( 0.86, 0.06, win * ( 1.0 - curtain ) ), 0.5, max( max( frame, mull ), max( ac, bars ) ) );
  m = win * ( 1.0 - curtain ) * 0.1 + ( frame + mull ) * 0.6; a = 1.0;
}
vec3 emis( vec2 uv ) {
  vec2 q = uv * 4.0, cell = floor( q ), f = fract( q );
  float id = hash12( cell + 0.5 + uVar * 9.0 ), on = hash12( cell + 17.3 + uVar * 3.0 ), id2 = hash12( cell + 4.1 );
  float edge; float win = winMask( f, edge ) * smoothstep( 0.0, 0.02, edge );
  if ( on > ( uVar > 0.5 ? 0.45 : 0.32 ) ) return vec3( 0.0 );
  vec3 c = id < 0.25 ? C( 220.0, 236.0, 255.0 ) : id < 0.7 ? C( 255.0, 214.0, 150.0 ) : C( 255.0, 190.0, 120.0 );
  float blind = id2 > 0.6 ? 0.75 + 0.25 * step( 0.5, fract( f.y * 22.0 ) ) : 1.0;
  float curtain = step( 0.55, id2 ) * smoothstep( 0.4, 0.42, abs( f.x - 0.5 + ( id2 - 0.75 ) * 0.4 ) );
  float grad = 0.65 + 0.35 * smoothstep( 0.2, 0.8, f.y );
  float mull = smoothstep( 0.012, 0.007, abs( f.x - 0.5 ) );
  float bars = 0.0;
  if ( uVar > 0.5 ) { float bx = fract( ( f.x - 0.13 ) / 0.74 * 7.0 ); bars = max( smoothstep( 0.18, 0.08, abs( bx - 0.5 ) - 0.32 ), smoothstep( 0.012, 0.006, abs( f.y - 0.51 ) ) ); }
  return c * win * blind * grad * ( 1.0 - curtain * 0.55 ) * ( 1.0 - mull ) * ( 1.0 - bars ) * ( 0.55 + 0.45 * hash12( cell + 2.2 ) );
}` };

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
// one surf() call per pixel. The roughness map's spare channels carry the height as 16 bits (R = low byte,
// A = high byte); a shared Sobel pass turns that into the normal map, so each surface compiles one small shader.
const MAIN = `
vec3 srgbEnc( vec3 c ) { return mix( c * 12.92, 1.055 * pow( max( c, vec3( 0.0 ) ), vec3( 0.41666 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
  vec3 alb; float h, r, m, a;
  surf( vUv, alb, h, r, m, a );
  if ( uMode < 0.5 ) gl_FragColor = vec4( srgbEnc( clamp( alb, 0.0, 1.0 ) ), clamp( a, 0.0, 1.0 ) );
  else if ( uMode < 1.5 ) {
    float h16 = floor( clamp( h, 0.0, 1.0 ) * 65535.0 + 0.5 ), hi = floor( h16 / 256.0 );
    gl_FragColor = vec4( ( h16 - hi * 256.0 ) / 255.0, clamp( r, 0.03, 1.0 ), clamp( m, 0.0, 1.0 ), hi / 255.0 );
  }
#ifdef HAS_EMIS
  else gl_FragColor = vec4( srgbEnc( clamp( emis( vUv ), 0.0, 1.0 ) ), 1.0 );
#else
  else gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
#endif
}`;
const NORMAL_FS = `
precision highp float;
#if defined( GL_EXT_shader_texture_lod ) || __VERSION__ >= 300
#define TEX0( t, uv ) texture2DLodEXT( t, uv, 0.0 )
#else
#define TEX0( t, uv ) texture2D( t, uv )
#endif
uniform sampler2D tH; uniform float uSize; uniform float uBump;
float Hs( vec2 px ) { vec4 t = TEX0( tH, ( mod( px, uSize ) + 0.5 ) / uSize ); return ( t.a * 65280.0 + t.r * 255.0 ) / 65535.0; }
void main() {
  vec2 p = floor( gl_FragCoord.xy );
  float tl = Hs( p + vec2( -1.0, 1.0 ) ), t = Hs( p + vec2( 0.0, 1.0 ) ), tr = Hs( p + vec2( 1.0, 1.0 ) );
  float l = Hs( p + vec2( -1.0, 0.0 ) ), r = Hs( p + vec2( 1.0, 0.0 ) );
  float bl = Hs( p + vec2( -1.0, -1.0 ) ), b = Hs( p + vec2( 0.0, -1.0 ) ), br = Hs( p + vec2( 1.0, -1.0 ) );
  float dx = ( tr + 2.0 * r + br ) - ( tl + 2.0 * l + bl ), dy = ( tl + 2.0 * t + tr ) - ( bl + 2.0 * b + br );
  float k = uSize / 8.0 * uBump;
  gl_FragColor = vec4( normalize( vec3( - dx * k, - dy * k, 1.0 ) ) * 0.5 + 0.5, 1.0 );
}`;
const normalMat = new T.ShaderMaterial({ vertexShader: 'void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }', fragmentShader: NORMAL_FS, depthTest: false, depthWrite: false, toneMapped: false, extensions: { shaderTextureLOD: true }, uniforms: { tH: { value: null }, uSize: { value: 1024 }, uBump: { value: 0.01 } } });

// ---------------- baking ----------------
const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const geo = new T.BufferGeometry();
geo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
geo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const quad = new T.Mesh(geo); quad.frustumCulled = false;
const bscene = new T.Scene(); bscene.add(quad);
const SETS = {};      // name -> { map, normal, orm, emis, mat (ShaderMaterial), def }
const ENTRY = {};     // texture uuid -> set (to find the set from a material's map)
function rt(size, srgb, aniso) {
  const r = new T.WebGLRenderTarget(size, size, { wrapS: T.RepeatWrapping, wrapT: T.RepeatWrapping, magFilter: T.LinearFilter, minFilter: T.LinearMipmapLinearFilter, generateMipmaps: true, format: T.RGBAFormat, type: T.UnsignedByteType, depthBuffer: false, stencilBuffer: false, anisotropy: aniso });
  r.texture.encoding = srgb ? T.sRGBEncoding : T.LinearEncoding;
  r.texture.isRenderTargetTexture = true;
  return r;
}
function renderInto(target, mat, mode, size) {
  if (mat.uniforms.uMode) { mat.uniforms.uMode.value = mode; mat.uniforms.uEps.value = 1 / size; }
  quad.material = mat;
  const tile = 1024, n = Math.ceil(size / tile);
  R.setRenderTarget(target);
  if (n > 1) {
    target.scissorTest = true;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { target.scissor.set(x * tile, y * tile, tile, tile); R.render(bscene, cam); }
    target.scissorTest = false; target.scissor.set(0, 0, size, size);
  } else R.render(bscene, cam);
}
// fbm( uv, fr, 4 ) → fbm4( uv, fr ): fixed-length loops compile far faster than loops with a break
function fixedOctaves(src) {
  let out = '', i = 0;
  const re = /\b(fbm|ridge)\(/g;
  let m;
  while ((m = re.exec(src))) {
    let j = m.index + m[0].length, depth = 1; const args = []; let cur = '';
    for (; j < src.length && depth > 0; j++) {
      const ch = src[j];
      if (ch === '(') depth++;
      if (ch === ')') { depth--; if (depth === 0) break; }
      if (ch === ',' && depth === 1) { args.push(cur); cur = ''; } else cur += ch;
    }
    args.push(cur);
    const n = args.length === 3 ? parseInt(args[2], 10) : NaN;
    if (!(n >= 1 && n <= 6)) continue;
    out += src.slice(i, m.index) + m[1] + n + '(' + fixedOctaves(args[0]) + ',' + fixedOctaves(args[1]) + ')';
    i = j + 1; re.lastIndex = i;
  }
  return out + src.slice(i);
}
function makeSet(name, def, variant) {
  const key = variant ? name + variant : name;
  const code = fixedOctaves(def.code);
  const mat = new T.ShaderMaterial({
    vertexShader: VS, fragmentShader: libFor(code) + code + MAIN, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uMode: { value: 0 }, uEps: { value: 0.001 }, uBump: { value: def.bump || 0.01 }, uVar: { value: variant || 0 } },
    defines: def.emis ? { HAS_EMIS: 1 } : {},
  });
  const set = { name: key, def, mat, size: 0, major: !def.minor };
  SETS[key] = set;
  return set;
}
// a flat placeholder (grey, flat normal, matte) shown until a surface is baked; alpha surfaces start invisible
const fillMat = new T.ShaderMaterial({ vertexShader: 'void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }', fragmentShader: 'uniform vec4 uC; void main() { gl_FragColor = uC; }', uniforms: { uC: { value: new T.Vector4() } }, depthTest: false, depthWrite: false, toneMapped: false });
function withState(fn) {
  const old = R.getRenderTarget(), oldAC = R.autoClear, oldTM = R.toneMapping;
  R.autoClear = false; R.toneMapping = T.NoToneMapping;
  try { fn(); } finally { R.setRenderTarget(old); R.autoClear = oldAC; R.toneMapping = oldTM; }
}
function allocSet(set, size, aniso) {
  if (!set.map) {
    set.map = rt(size, true, aniso); set.normal = rt(size, false, aniso); set.orm = rt(size, false, aniso);
    if (set.def.emis) set.emis = rt(size, true, aniso);
    [set.map, set.normal, set.orm, set.emis].forEach((r) => { if (r) ENTRY[r.texture.uuid] = set; });
    withState(() => {
      const fill = (r, x, y, z, w) => { fillMat.uniforms.uC.value.set(x, y, z, w); quad.material = fillMat; R.setRenderTarget(r); R.render(bscene, cam); };
      fill(set.map, 0.55, 0.55, 0.55, set.def.alpha ? 0 : 1); fill(set.normal, 0.5, 0.5, 1, 1); fill(set.orm, 0, 0.8, 0, 0.5);
      if (set.emis) fill(set.emis, 0, 0, 0, 1);
    });
  } else if (set.size !== size || set.aniso !== aniso) {
    // a new size re-creates the GL texture; a new anisotropy only applies when the texture is set up again
    [set.map, set.normal, set.orm, set.emis].forEach((r) => { if (r) { r.texture.anisotropy = aniso; if (set.size !== size) r.setSize(size, size); else r.dispose(); } });
  }
  set.size = size; set.aniso = aniso;
}
function bakeSet(set) {
  const size = set.size, t0 = performance.now();
  withState(() => {
    renderInto(set.map, set.mat, 0, size);
    renderInto(set.orm, set.mat, 1, size);
    if (set.emis) renderInto(set.emis, set.mat, 3, size);
    const nu = normalMat.uniforms; nu.tH.value = set.orm.texture; nu.uSize.value = size; nu.uBump.value = set.def.bump || 0.01;
    renderInto(set.normal, normalMat, 2, size);
  });
  set.baked = true;
  TG.times[set.name] = Math.round(performance.now() - t0);
}

// ---------------- which material gets which surface ----------------
// [MAT key, surface, options]  — rough: keep the material's roughness factor; metal: use the metalness channel
const ASSIGN = [
  ['concrete', 'concrete'], ['concreteDark', 'concrete'], ['dirt', 'dirt'], ['grass', 'grass'], ['epoxy', 'epoxy'], ['tile', 'tile'],
  ['roof', 'roof'], ['metal', 'metal'], ['plaster', 'plaster'], ['fence', 'fence'], ['mud', 'mud'], ['bamboo', 'bamboo'],
  ['brick', 'brick'], ['planks', 'planks'], ['rust', 'rust'], ['facade', 'facade'], ['barred', 'facade1'], ['net', 'net'],
  ['steel', 'steel'], ['darkSteel', 'steel'], ['wood', 'wood'], ['table', 'wood'], ['plastic', 'plastic'], ['chairSeat', 'fabric'],
  ['tarp', 'fabric'], ['trunk', 'bark'], ['rope', 'fabric'], ['chain', 'steel'],
];
const MINOR = new Set(['steel', 'wood', 'plastic', 'fabric', 'bark', 'fence', 'net']);
const TXKEY = { concrete: 'concrete', dirt: 'dirt', grass: 'grass', epoxy: 'epoxy', tile: 'tile', roof: 'roof', metal: 'metal', plaster: 'plaster', fence: 'fence', mud: 'mud', bamboo: 'bamboo', brick: 'brick', planks: 'planks', rust: 'rust', facade: 'facade', barred: 'facade1', net: 'net' };

const TG = G.texgen = { sets: SETS, size: 0, aniso: 1, times: {} };
function sizeFor(set, q) { return (MINOR.has(set.def.base || set.name.replace(/\d+$/, '')) || set.def.minor) ? Math.max(256, q / 2) : q; }
function surface(key) {
  if (SETS[key]) return SETS[key];
  const base = key.replace(/\d+$/, ''), v = +(key.match(/\d+$/) || [0])[0];
  const def = Object.assign({ base }, S[base]);
  return makeSet(base, def, v);
}
// wire a material to a surface's maps
function applyTo(m, set, own) {
  m.map = set.map.texture;
  m.normalMap = set.normal.texture;
  if (!m.normalScale) m.normalScale = new T.Vector2(1, 1);
  m.roughnessMap = set.orm.texture;
  if (own) m.roughness = 1;
  if (set.def.metal) { m.metalnessMap = set.orm.texture; if (own) m.metalness = 1; }
  if (set.emis) { m.emissiveMap = set.emis.texture; }
  if (set.def.alpha) { m.alphaTest = Math.max(m.alphaTest || 0, 0.42); m.transparent = false; }
  m.needsUpdate = true;
}
// Baking is spread over frames (G.render calls TG.step): every surface gets a flat placeholder at once, then the
// real one — each new shader compiles once, so the game starts right away instead of freezing for seconds.
// Most visible surfaces first.
const PRIORITY = ['concrete', 'asphalt', 'plaster', 'facade', 'facade1', 'epoxy', 'tile', 'mud', 'grass', 'dirt', 'brick', 'planks', 'rust', 'metal', 'roof', 'bamboo', 'steel', 'wood', 'fabric', 'plastic', 'bark', 'fence', 'net'];
let queue = [];
TG.queueAll = function (q, aniso) {
  TG.size = q; TG.aniso = aniso;
  for (const [, sk] of ASSIGN) surface(sk);
  surface('asphalt');
  const keys = Object.keys(SETS).sort((a, b) => ((PRIORITY.indexOf(a) + 1) || 99) - ((PRIORITY.indexOf(b) + 1) || 99));
  for (const k of keys) { const s = SETS[k]; const sz = sizeFor(s, q); if (s.size !== sz || s.aniso !== aniso || !s.baked) { allocSet(s, sz, aniso); s.baked = false; if (!queue.includes(s)) queue.push(s); } }
  TG.pending = queue.length;
  TG.t0 = performance.now();
};
// bake queued surfaces until the time budget is spent (always at least one)
TG.step = function (budget) {
  const t0 = performance.now();
  while (queue.length) {
    bakeSet(queue.shift());
    if (performance.now() - t0 > (budget || 10)) break;
  }
  TG.pending = queue.length;
  if (!queue.length) TG.ms = Math.round(performance.now() - TG.t0);
};
TG.finish = () => { while (queue.length) bakeSet(queue.shift()); TG.pending = 0; };
TG.setQuality = function (q, aniso) { if (q === TG.size && aniso === TG.aniso) return; TG.queueAll(q, aniso); };

// ---------------- placeholders now, bake over the next frames; hook the materials ----------------
const P = (G.gfx && G.gfx.P) || {};
TG.queueAll(P.tex || 1024, Math.min(P.aniso || 8, R.capabilities.getMaxAnisotropy()));
// the shared materials: the maps now carry roughness (and metalness for sheet metal), so the factors go to 1
for (const [mk, sk] of ASSIGN) { const m = MAT[mk]; if (m) applyTo(m, SETS[sk], true); }
MAT.darkSteel.roughness = 1.1; MAT.chain.roughness = 1.1;
MAT.facade.emissive.setRGB(1, 1, 1); MAT.barred.emissive.setRGB(1, 1, 1);
for (const k in TXKEY) TX[k] = SETS[TXKEY[k]].map.texture;
TX.facadeLit = SETS.facade.emis.texture; TX.barredLit = SETS.facade1.emis.texture;
TX.asphalt = SETS.asphalt.map.texture;
G.surfaceMaps = (key) => {
  const s = surface(key);
  if (!s.size) { allocSet(s, sizeFor(s, TG.size), TG.aniso); queue.push(s); TG.pending = queue.length; }
  return { map: s.map.texture, normalMap: s.normal.texture, roughnessMap: s.orm.texture, metalnessMap: s.def.metal ? s.orm.texture : null, emissiveMap: s.emis ? s.emis.texture : null };
};

// after a level is built: any standard material that uses one of the baked albedo maps also gets its normal and
// roughness maps (level code often makes its own tinted material with map: G.TX.concrete etc.)
TG.enhance = function (root) {
  const seen = new Set();
  (root || G.scene).traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (seen.has(m) || !m.isMeshStandardMaterial || !m.map) continue; seen.add(m);
      const set = ENTRY[m.map.uuid]; if (!set || m.normalMap) continue;
      m.normalMap = set.normal.texture; m.roughnessMap = set.orm.texture;
      if (set.def.metal && !m.metalnessMap) m.metalnessMap = set.orm.texture;
      m.needsUpdate = true;
    }
  });
};
const origLoad = G.loadLevel;
G.loadLevel = function (name) { const cfg = origLoad(name); TG.enhance(G.root); return cfg; };
})(window.G);
