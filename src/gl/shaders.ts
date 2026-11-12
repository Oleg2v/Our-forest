/* GLSL for the home WebGL stage (src/gl). GLSL ES 1.0 style — three.js converts it for WebGL2.
   Colours pass through untouched (textures are NoColorSpace, no output conversion), so a GL frame with no wind
   is pixel-identical to the <img> under it — the canvas can come and go without a visible swap. */

/* 3D simplex noise — Ian McEwan / Stefan Gustavson (MIT), compact form */
const SNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/* object-fit: cover (+ object-position) in UV space */
const COVER = /* glsl */ `
vec2 coverUv(vec2 uv, vec2 res, vec2 img, vec2 pos){
  float rs=res.x/res.y, ri=img.x/img.y;
  vec2 s = rs>ri ? vec2(1., ri/rs) : vec2(rs/ri, 1.);
  return (uv-pos)*s+pos;
}`;

export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

/* ------------------------------------------------------------------ hero wind
   The mask (painted from the photo, see docs/agent-notes/hero.md) lets ONLY the foliage move:
   · sway   — coherent waves across the crown (a few sines, travelling right → left like the reading direction)
   · flutter — simplex noise sampled on a circle in noise space, so the whole thing loops with uPeriod
   · gust   — the cursor: displacement along its smoothed velocity, strongest around it, decays smoothly
   · dapple — leaves moving let a little more / less sun through (tiny brightness modulation)
   Amplitude (measured by phase correlation on 64 px patches at 1440×900): foliage drifts ≈ 2 px per 0.5 s and up to
   ≈ 8–10 px across half a sway period (p90) — a calm, visible sway; trunks, the rope limb and the ground stay put. */
export const WIND_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform sampler2D uMask;
uniform vec2 uRes;
uniform vec2 uImg;
uniform vec2 uPos;
uniform float uTime;
uniform float uPeriod;
uniform vec4 uK;
uniform float uAmp;
uniform float uQuality;
uniform vec2 uMouse;
uniform vec2 uGustDir;
uniform float uGust;
varying vec2 vUv;
#define TAU 6.28318530718
${SNOISE}
${COVER}
void main(){
  vec2 uv = coverUv(vUv, uRes, uImg, uPos);
  float m = texture2D(uMask, uv).r;
  float ph = TAU * uTime / uPeriod;
  float s = uv.x * 2.6 - uv.y * 1.1;
  float sway = sin(uK.x * ph + s * 2.2) * .55 + sin(uK.y * ph + s * 3.7 + 1.7) * .3 + sin(uK.z * ph - uv.y * 6. + .6) * .15;
  vec2 c = vec2(cos(uK.w * ph), sin(uK.w * ph)) * .85;
  float n1 = snoise(vec3(uv * vec2(10., 7.), 0.) + vec3(c, 0.));
  float n2 = 0.;
  if (uQuality > .5) n2 = snoise(vec3(uv * vec2(24., 17.), 4.) + vec3(c.y, -c.x, 0.) * 1.3);
  vec2 d = (vUv - uMouse) * vec2(uRes.x / uRes.y, 1.);
  float fall = exp(-dot(d, d) * 6.5);
  float g = uGust * (.28 + .72 * fall);
  float tip = .55 + .45 * smoothstep(.15, 1., uv.y);
  vec2 off = vec2(sway * .0052 + n1 * .0018 + n2 * .0007, n1 * .001 - abs(sway) * .0006) * uAmp;
  off += uGustDir * g * (.0105 + .006 * n1) + vec2(n2, n1) * g * .0024;
  off *= m * tip;
  vec4 col = texture2D(uTex, uv - off);
  col.rgb *= 1. + (n1 * .032 + n2 * .018) * m * (uAmp * .8 + g);
  gl_FragColor = vec4(col.rgb, 1.);
}`;

/* ------------------------------------------------------------------ seasonal particles
   Stateless: every position is a function of time and a per-particle seed (cheap, loop-free).
   Depth of field: one focal plane; particles in front/behind it grow, soften and fade (bokeh).
   mode 0 = pollen / light motes (spring, summer, winter tint), 1 = drifting leaves (autumn). */
export const PARTICLE_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uPR;
uniform float uScale;
uniform float uMode;
uniform float uAmp;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform vec2 uGustDir;
uniform float uGust;
uniform vec2 uTilt;
varying float vBlur;
varying float vAlpha;
varying float vRot;
varying float vFlip;
varying float vTint;
void main(){
  float depth = aSeed.z;
  float r = aSeed.w;
  float t = uTime;
  vec2 p;
  float size;
  if (uMode < .5) {
    float sp = mix(.005, .016, depth);
    p.x = aSeed.x - t * sp * .7 + sin(t * (.21 + r * .2) + r * 20.) * .03;
    p.y = aSeed.y + t * sp * .5 + sin(t * (.17 + r * .15) + r * 11.) * .035;
    size = mix(4.2, 13., depth * depth);
  } else {
    float sp = mix(.016, .045, depth);
    p.y = aSeed.y - t * sp;
    p.x = aSeed.x - t * sp * .6 + sin(t * (.5 + r * .6) + r * 30.) * .03 * (.4 + depth);
    size = mix(10., 30., pow(depth, 1.4));
  }
  p = fract(p) * 1.2 - .1;
  vec2 dm = (p - uMouse) * vec2(uRes.x / uRes.y, 1.);
  float fall = exp(-dot(dm, dm) * 7.);
  p += uGustDir * uGust * fall * (.03 + .09 * depth);
  p += uTilt * (depth - .35) * .035;
  float blur = clamp(abs(depth - .42) * 1.7, 0., 1.);
  vBlur = blur;
  float edge = smoothstep(-.1, .04, p.x) * smoothstep(1.1, .96, p.x) * smoothstep(-.1, .05, p.y) * smoothstep(1.1, .95, p.y);
  vAlpha = edge * mix(1., .45, blur) * uAmp * (uMode < .5 ? mix(.8, 1., depth) : 1.);
  vRot = r * 6.283 + t * (r - .5) * 1.6;
  vFlip = cos(t * (.8 + r * 1.4) + r * 9.);
  vTint = fract(r * 7.13);
  gl_Position = vec4(p * 2. - 1., 0., 1.);
  gl_PointSize = size * (1. + blur * 1.6) * uScale * uPR;
}`;

export const PARTICLE_FRAG = /* glsl */ `
precision highp float;
uniform float uMode;
uniform vec3 uColA;
uniform vec3 uColB;
varying float vBlur;
varying float vAlpha;
varying float vRot;
varying float vFlip;
varying float vTint;
void main(){
  vec2 q = gl_PointCoord - .5;
  float soft = .06 + vBlur * .5;
  if (uMode < .5) {
    float r = length(q) * 2.;
    float a = 1. - smoothstep(1. - soft * 1.4, 1., r);
    float core = 1. - smoothstep(0., .55, r);
    vec3 col = mix(uColA, uColB, core * (1. - vBlur));
    gl_FragColor = vec4(col, min(1., a * vAlpha * (.75 + .5 * core)));
  } else {
    float c = cos(vRot), s = sin(vRot);
    q = mat2(c, -s, s, c) * q;
    q.x /= max(.22, abs(vFlip));
    /* the brand leaf: a lens (two circles), tips at y = ±.46 */
    const float k = .4618; const float R = .6518;
    float dl = max(length(q - vec2(k, 0.)), length(q + vec2(k, 0.))) - R;
    float a = 1. - smoothstep(-soft * .35, soft * .35, dl);
    float rib = 1. - smoothstep(.0, .03 + soft * .2, abs(q.x)) * step(abs(q.y), .4);
    vec3 col = mix(uColA, uColB, vTint);
    col *= mix(1., .82, rib * (1. - vBlur));
    col *= .9 + .35 * (1. - abs(vFlip));
    gl_FragColor = vec4(col, a * vAlpha * .95);
  }
}`;

/* ------------------------------------------------------------------ image ripple (hover)
   Water rings from where the cursor enters/moves ("watering" the picture) + a soft lens around the cursor. */
export const RIPPLE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uImg;
uniform vec2 uPos;
uniform vec2 uMouse;
uniform float uHover;
uniform float uTime;
uniform vec3 uDrops[4];
varying vec2 vUv;
${COVER}
void main(){
  float aspect = uRes.x / uRes.y;
  vec2 st = vUv;
  vec2 acc = vec2(0.);
  for (int i = 0; i < 4; i++) {
    vec3 dr = uDrops[i];
    float age = uTime - dr.z;
    if (dr.z < 0. || age < 0. || age > 2.2) continue;
    vec2 d = (st - dr.xy) * vec2(aspect, 1.);
    float L = length(d);
    float front = age * .42;
    float w = sin((L - front) * 46.) * exp(-abs(L - front) * 14.) * exp(-age * 1.6);
    acc += (d / max(L, 1e-4)) * w;
  }
  vec2 dm = (st - uMouse) * vec2(aspect, 1.);
  float lens = exp(-dot(dm, dm) * 18.) * uHover;
  vec2 off = acc * .0095 / vec2(aspect, 1.) - dm * lens * .04 / vec2(aspect, 1.);
  vec2 uv = coverUv(st + off, uRes, uImg, uPos);
  uv = (uv - .5) / (1. + .035 * uHover) + .5;
  vec4 col = texture2D(uTex, uv);
  col.rgb *= 1. + length(acc) * .05;
  gl_FragColor = vec4(col.rgb, 1.);
}`;
