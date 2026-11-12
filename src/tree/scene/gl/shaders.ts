/* GLSL for the "living botanical engraving".
   • fills: olive / sage / bark / soil tints on transparent paper (the page grain sits on top)
   • tone from the light → screen-space hatching anchored to the island (1–3 line layers, wobbly,
     anti-aliased with fwidth); at night the same lines turn light — a moonlit scratchboard
   • contours: inverted hull, constant pixel width, --bark (from uInk)
   All colours are sRGB values, written as is (no tone mapping, no colour management). */

export const COMMON = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform float uShake;
uniform float uTreeH;
uniform vec3 uLight;
uniform vec3 uLightC;
uniform float uAmb;
uniform vec3 uInk;
uniform float uInkA;
uniform float uNight;
uniform float uFill;
uniform float uHatch;
uniform vec2 uHatchO;
uniform float uDpr;
uniform vec3 uPaper;
`;

export const SWAY = /* glsl */ `
vec3 swayOffset(vec3 p, float phase, float flex) {
  float h = clamp(p.y / max(0.2, uTreeH), 0.0, 1.4);
  float bend = h * h;
  float w = uWind;
  float s1 = sin(uTime * 0.92 + phase * 0.13) * 0.6 + sin(uTime * 1.71 + 1.3) * 0.25;
  float s2 = sin(uTime * 2.35 + phase) * flex;
  vec3 off = vec3(1.0, 0.0, 0.32) * bend * ((0.012 + 0.085 * w) * s1 + uShake * 0.07);
  off += vec3(0.6, 0.12, 0.5) * bend * (0.008 + 0.04 * w) * s2;
  return off * max(0.3, uTreeH);
}
`;

export const HATCH = /* glsl */ `
float hLayer(vec2 p, float ang, float spacing, float width) {
  float c = cos(ang), s = sin(ang);
  float v = (p.x * c + p.y * s) / spacing;
  v += sin((p.x * s - p.y * c) * 0.045 + ang * 7.0) * 0.12;
  float d = abs(fract(v) - 0.5);
  float aa = fwidth(v) * 0.9;
  // fade in with the width: a zero-width line must vanish (AA alone would leave a faint net)
  return (1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d)) * smoothstep(0.0, 0.06, width);
}
/* dark 0..1 → line coverage */
float hatch(float dark) {
  vec2 p = (gl_FragCoord.xy - uHatchO) / uDpr;
  float h = hLayer(p, 0.785, 4.6, clamp((dark - 0.28) * 1.05, 0.0, 0.46));
  h = max(h, hLayer(p, -0.62, 5.4, clamp((dark - 0.5) * 1.1, 0.0, 0.4)));
  h = max(h, hLayer(p + 1.3, 0.05, 4.2, clamp((dark - 0.74) * 1.3, 0.0, 0.38)));
  return h;
}
/* engraving tone: fill × light, then ink lines (dark lines by day, light lines at night) */
vec3 engrave(vec3 fill, float lit, float extraDark) {
  float tone = clamp(uAmb + (1.0 - uAmb) * lit, 0.0, 1.0);
  vec3 col = fill * mix(0.8, 1.06, tone) * uFill * mix(vec3(1.0), uLightC, 0.25 * lit);
  // day: dark lines in the shade · night: sparse light lines where the moon touches (scratchboard)
  float dark = mix(clamp(1.0 - tone + extraDark, 0.0, 1.0), clamp((tone - 0.6) * 1.25 - extraDark * 0.5, 0.0, 1.0), uNight);
  float h = uHatch > 0.0 ? hatch(dark) * uHatch : 0.0;
  if (uHatch <= 0.0) col *= mix(1.0, 0.82, step(0.55, dark)) * mix(1.0, 0.88, step(0.8, dark));
  return mix(col, uInk, h * uInkA * mix(0.78, 0.5, uNight));
}
`;

/* ---------------------------------------------------------------- generic lit mesh (bark, wood, seed, fruit, roots) */
export const LIT_VERT = /* glsl */ `
${COMMON}
${SWAY}
attribute vec4 aSway;      // phase, flex, sway on (1/0), extra (root distance / unused)
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;
varying float vExtra;
#ifdef INSTANCED
attribute vec3 iPos;
attribute vec4 iMisc;      // scale, phase, flex, rot
attribute vec3 iColor;
varying vec3 vColor;
uniform float uSwingI;
uniform float uSwingA;
#endif
void main() {
  vec3 p = position;
  vec3 n = normal;
#ifdef INSTANCED
  float sc = iMisc.x;
  float ang = iMisc.w + (abs(float(gl_InstanceID) - uSwingI) < 0.5 ? sin(uTime * 9.0) * 0.45 * uSwingA : 0.0);
  float ca = cos(ang), sa = sin(ang);
  p = vec3(p.x * ca - p.y * sa, p.x * sa + p.y * ca, p.z) * sc;
  n = vec3(n.x * ca - n.y * sa, n.x * sa + n.y * ca, n.z);
  vec3 anchor = iPos;
  p += anchor + swayOffset(anchor, iMisc.y, iMisc.z);
  vColor = iColor;
#else
  if (aSway.z > 0.5) p += swayOffset(position, aSway.x, aSway.y);
#endif
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * n);
  vObj = p;
  vUv = uv;
  vExtra = aSway.w;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const HULL_VERT = /* glsl */ `
${COMMON}
${SWAY}
attribute vec4 aSway;
uniform float uLineW;
uniform vec2 uRes;
#ifdef INSTANCED
attribute vec3 iPos;
attribute vec4 iMisc;
uniform float uSwingI;
uniform float uSwingA;
#endif
varying vec3 vObj;
void main() {
  vec3 p = position;
  vec3 n = normal;
#ifdef INSTANCED
  float sc = iMisc.x;
  float ang = iMisc.w + (abs(float(gl_InstanceID) - uSwingI) < 0.5 ? sin(uTime * 9.0) * 0.45 * uSwingA : 0.0);
  float ca = cos(ang), sa = sin(ang);
  p = vec3(p.x * ca - p.y * sa, p.x * sa + p.y * ca, p.z) * sc;
  n = vec3(n.x * ca - n.y * sa, n.x * sa + n.y * ca, n.z);
  p += iPos + swayOffset(iPos, iMisc.y, iMisc.z);
#else
  if (aSway.z > 0.5) p += swayOffset(position, aSway.x, aSway.y);
#endif
  vObj = p;
  mat4 pvm = projectionMatrix * viewMatrix * modelMatrix;
  vec4 clip = pvm * vec4(p, 1.0);
  // exact screen direction of the normal (works with the off-axis projection)
  vec4 c1 = pvm * vec4(p + normalize(n) * 0.01, 1.0);
  vec2 d = (c1.xy / c1.w - clip.xy / clip.w) * uRes;
  float l = length(d);
  if (l > 1e-6) clip.xy += (d / l) * uLineW * uDpr * 2.0 / uRes * clip.w;
  gl_Position = clip;
}
`;
export const HULL_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform float uInkA;
uniform float uClipZ;
uniform float uClipY;   // discard below (rising plaque)
uniform float uClipYTop; // discard above
uniform float uAlpha;
varying vec3 vObj;
void main() {
  if (vObj.z > uClipZ) discard;
  if (vObj.y < uClipY || vObj.y > uClipYTop) discard;
  gl_FragColor = vec4(uInk * uInkA * uAlpha, uInkA * uAlpha);
}
`;

/* bark of the tree: fill + hatching; bark lines along the limb on the shadow side (olive spirals) */
export const BARK_FRAG = /* glsl */ `
${COMMON}
${HATCH}
uniform vec3 uColor;
uniform float uTwist;
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;
varying float vExtra;
void main() {
  vec3 N = normalize(vN);
  float ndl = dot(N, uLight);
  float lit = max(ndl, 0.0);
  // bark lines: along the limb (u = length, v = around)
  float around = vUv.y + vUv.x * uTwist;
  float ln = abs(fract(around * 9.0) - 0.5);
  float aa = fwidth(around * 9.0);
  float bark = (1.0 - smoothstep(0.06 - aa, 0.06 + aa, ln)) * smoothstep(0.55, 0.05, lit) * 0.6;
  vec3 col = engrave(uColor, lit * 0.9 + 0.1, 0.0);
  col = mix(col, uInk, bark * uInkA * (1.0 - uNight * 0.5));
  gl_FragColor = vec4(col, 1.0);
}
`;

/* roots in the cut: like bark, plus the watering glow travelling tip → trunk */
export const ROOT_FRAG = /* glsl */ `
${COMMON}
${HATCH}
uniform vec3 uColor;
uniform float uGlow;
uniform float uGlowA;
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;
varying float vExtra;
void main() {
  vec3 N = normalize(vN);
  float lit = max(dot(N, normalize(uLight + vec3(0.0, 0.0, 0.6))), 0.0);
  vec3 col = engrave(uColor, lit, 0.05);
  float front = 1.0 - uGlow;
  float g = smoothstep(front - 0.18, front, vExtra) * uGlowA;
  vec3 glowC = mix(vec3(0.97, 0.82, 0.48), vec3(0.99, 0.93, 0.74), smoothstep(front, front + 0.3, vExtra));
  col = mix(col, glowC, g * 0.9);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* plain lit fill (wood stakes, posts, prune stubs, fruits, seed) */
export const FILL_FRAG = /* glsl */ `
${COMMON}
${HATCH}
uniform vec3 uColor;
uniform float uUseInstColor;
uniform float uClipY;
uniform float uClipYTop;
uniform float uCrack;
uniform float uAlpha;
uniform float uCutCap;     // prune stubs: light cut face at the end
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;
varying float vExtra;
#ifdef INSTANCED
varying vec3 vColor;
#endif
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  if (vObj.y < uClipY || vObj.y > uClipYTop) discard;
  if (uAlpha < 0.999 && hash(floor(gl_FragCoord.xy * 0.5)) > uAlpha) discard;
  vec3 N = normalize(vN);
  float lit = max(dot(N, uLight), 0.0);
  vec3 base = uColor;
#ifdef INSTANCED
  base = vColor;
#endif
  vec3 col = engrave(base, lit, 0.0);
  if (uCutCap > 0.5 && vExtra > 0.5) col = mix(uPaper, vec3(0.96, 0.9, 0.78), 0.6) * mix(1.0, 0.5, uNight);
  // the seed's three cracks (object space, radial from the top)
  if (uCrack > 0.0) {
    vec3 q = normalize(vObj);
    float c = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      if (uCrack < fi + 0.05) continue;
      float a = (fi - 1.0) * 1.05;
      vec2 dir = vec2(sin(a), cos(a));
      float along = dot(q.xy, dir);
      float side = dot(q.xy, vec2(dir.y, -dir.x)) + sin(along * 22.0 + fi * 3.0) * 0.06;
      float reach = clamp(uCrack - fi, 0.0, 1.0);
      c = max(c, (1.0 - smoothstep(0.02, 0.06, abs(side))) * step(0.0, along) * step(along, reach * 0.95) * step(0.0, q.z));
    }
    col = mix(col, uInk * 0.7, c);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ---------------------------------------------------------------- island: earth body */
export const EARTH_FRAG = /* glsl */ `
${COMMON}
${HATCH}
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uClipZ;
uniform float uWet;
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;
varying float vExtra;
void main() {
  if (vObj.z > uClipZ + 0.002) discard;
  vec3 N = normalize(vN);
  float lit = max(dot(N, uLight), 0.0);
  // strata hint on the outer side, darker toward the bottom
  float depth = clamp(-vObj.y / 1.2, 0.0, 1.0);
  vec3 fill = mix(uColor, uColor2, smoothstep(0.25, 0.75, depth));
  fill *= mix(1.0, 0.82, uWet);
  // engraver's form lines: contour rings
  float ring = abs(fract(vObj.y * 9.0) - 0.5);
  float aa = fwidth(vObj.y * 9.0);
  float rl = (1.0 - smoothstep(0.04 - aa, 0.04 + aa, ring)) * 0.25;
  vec3 col = engrave(fill, lit * 0.95, 0.12 * depth);
  col = mix(col, uInk, rl * uInkA);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* top of the island: grass & earth, rim line, crown shadow (hatched), the watering spot */
export const CAP_FRAG = /* glsl */ `
${COMMON}
${HATCH}
uniform vec3 uColor;
uniform vec3 uWetC;
uniform vec4 uShadow;      // centre xz, radii
uniform float uShadowA;
uniform float uSpot;
uniform float uWet;
uniform float uZT;
uniform float uRimR;
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;
varying float vExtra;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 N = vec3(0.0, 1.0, 0.0);
  float lit = max(dot(N, uLight), 0.0) * 0.85 + 0.15;
  vec2 xz = vObj.xz;
  // grass stipple
  vec2 g = xz * 60.0;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5 - (vec2(hash(cell), hash(cell + 7.1)) - 0.5) * 0.6;
  float dotm = 1.0 - smoothstep(0.08, 0.16, length(f * vec2(1.0, 0.5)));
  dotm *= step(0.55, hash(cell + 3.3));
  // crown shadow
  vec2 sd = (xz - uShadow.xy) / uShadow.zw;
  float sh = (1.0 - smoothstep(0.75, 1.0, length(sd))) * uShadowA;
  // watering spot from the trunk + overall wetness
  float sr = length(xz - vec2(0.0, uZT)) / max(0.001, uSpot * 0.9);
  float spot = (1.0 - smoothstep(0.55, 1.0, sr)) * step(0.001, uSpot);
  float wet = max(uWet * 0.55, spot);
  vec3 fill = mix(uColor, uWetC, wet);
  vec3 col = engrave(fill, lit * (1.0 - sh * 0.75) * mix(1.0, 0.7, uNight), sh * 0.55);
  col = mix(col, uInk, dotm * 0.35 * uInkA);
  // rim line (the cut edge has its own line on the face)
  float rr = vExtra;
  float aa = fwidth(rr);
  col = mix(col, uInk, (1.0 - smoothstep(0.985 - aa * 1.5, 0.985, rr)) * 0.0 + smoothstep(0.975 - aa, 0.985, rr) * uInkA);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* the cut face: humus (stipple), clay (wavy lines), stones (cells with outlines), wetness, seed chamber */
export const FACE_FRAG = /* glsl */ `
${COMMON}
${HATCH}
uniform vec3 uHumus;
uniform vec3 uClay;
uniform vec3 uStones;
uniform vec3 uPebble;
uniform float uPh[6];
uniform float uSpot;
uniform float uSeep;
uniform float uWet;
uniform float uFaceBottom;
uniform float uSeed;
uniform float uSeedY;
uniform float uLineW;
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;       // x: distance to the left edge, y: distance to the right edge (model units)
varying float vExtra;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float b1(float x) { return -0.27 + 0.028 * sin(x * 2.7 + uPh[0]) + 0.014 * sin(x * 6.3 + uPh[1]) + 0.006 * sin(x * 13.1 + uPh[2]); }
float b2(float x) { return -0.64 + 0.045 * sin(x * 1.9 + uPh[3]) + 0.02 * sin(x * 5.2 + uPh[4]) + 0.009 * sin(x * 11.7 + uPh[5]); }
void main() {
  float x = vObj.x, y = vObj.y;
  float px = fwidth(y);                 // model units per pixel
  float B1 = b1(x), B2 = b2(x);
  vec3 col;
  float lineM = 0.0;
  float tone = 0.62;
  if (y > B1) {
    // humus: dark, stippled with light specks and dark grains
    vec2 g = vec2(x, y) * 70.0;
    vec2 c = floor(g);
    vec2 o = hash2(c);
    float d = length(fract(g) - o);
    float speck = (1.0 - smoothstep(0.1, 0.18, d)) * step(0.6, hash(c + 2.0));
    col = mix(uHumus, mix(uHumus, vec3(0.93, 0.9, 0.83), 0.55), speck * 0.7);
    vec2 g2 = vec2(x, y) * 34.0;
    float d2 = length(fract(g2) - hash2(floor(g2) + 9.0));
    col *= 1.0 - (1.0 - smoothstep(0.08, 0.15, d2)) * 0.35;
    tone = 0.78;
  } else if (y > B2) {
    // clay: warm, wavy horizontal lines
    col = uClay;
    float v = (y + sin(x * 9.0 + uPh[2]) * 0.008) * 48.0;
    float l = abs(fract(v) - 0.5);
    float aa = fwidth(v);
    lineM = (1.0 - smoothstep(0.07 - aa, 0.07 + aa, l)) * 0.4 * (0.6 + 0.4 * sin(x * 31.0 + floor(v)));
    tone = 0.85;
  } else {
    // stones: cells → pebbles with ink outlines
    vec2 g = vec2(x * 0.95 + sin(y * 7.0) * 0.08, y * 1.3) * 12.0;
    vec2 c = floor(g);
    vec2 fpos = fract(g);
    float f1 = 9.0, f2 = 9.0; vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 nb = vec2(float(i), float(j));
      vec2 pt = nb + 0.15 + 0.7 * hash2(c + nb);
      float dd = length(pt - fpos);
      if (dd < f1) { f2 = f1; f1 = dd; id = c + nb; } else if (dd < f2) f2 = dd;
    }
    float edge = f2 - f1;
    float h = hash(id);
    float isPeb = step(0.42, h);                      // some cells are just packed sand
    vec2 rel = fpos - ((id - c) + 0.15 + 0.7 * hash2(id));
    float pr = mix(0.18, 0.46, hash(id + 3.7)) * (1.0 + 0.13 * sin(atan(rel.y, rel.x) * 3.0 + h * 20.0)); // irregular pebble
    float inside = isPeb * (1.0 - smoothstep(pr - 0.03, pr, f1)) * smoothstep(0.02, 0.06, edge);
    vec3 peb = mix(uPebble, uStones * 0.92, hash(id + 1.3) * 0.7);
    vec2 g3 = vec2(x, y) * 90.0;
    float grit = (1.0 - smoothstep(0.08, 0.14, length(fract(g3) - hash2(floor(g3))))) * step(0.55, hash(floor(g3) + 4.0));
    col = mix(uStones * (0.9 - grit * 0.18), peb, inside);
    float fw = fwidth(f1) * 1.3;
    lineM = isPeb * (1.0 - smoothstep(fw * 0.4, fw * 1.4, abs(f1 - pr))) * smoothstep(0.02, 0.06, edge) * 0.9;
    // a shade on the lower side of each pebble
    // a shade on the lower part of each pebble
    tone = mix(0.95, 0.55, inside * smoothstep(0.0, 0.22, -rel.y) * smoothstep(pr * 0.45, pr, f1));
  }
  // strata boundaries: dashed engraved line
  float bd = min(abs(y - B1), abs(y - B2));
  float dash = step(0.35, fract(x * 14.0));
  lineM = max(lineM, (1.0 - smoothstep(px * 0.6, px * 1.4, bd)) * mix(0.35, 0.75, dash));
  // wetness: overall damp, the spot from the centre, the seep travelling down
  float spotR = uSpot * 0.85;
  float sp = (1.0 - smoothstep(spotR * 0.6, spotR, length(vec2(x * 0.9, y * 1.5)))) * step(0.001, uSpot);
  float seepY = -uSeep * (abs(uFaceBottom) + 0.15);
  float seep = step(0.001, uSeep) * smoothstep(seepY - 0.08, seepY + 0.02, y) * (1.0 - smoothstep(0.35, 0.75 + uSeep * 0.3, abs(x))) * (1.0 - smoothstep(0.85, 1.0, uSeep) * 0.4);
  float wet = clamp(max(max(uWet * 0.75, sp), seep * 0.85), 0.0, 1.0);
  col *= mix(1.0, 0.62, wet);
  col = mix(col, col * vec3(0.92, 0.95, 1.0), wet * 0.4);
  // seed chamber
  if (uSeed > 0.0) {
    float sc = length(vec2(x / 0.075, (y - uSeedY) / 0.052));
    col = mix(col, uHumus * 1.35, (1.0 - smoothstep(0.92, 1.0, sc)) * uSeed);
    lineM = max(lineM, (1.0 - smoothstep(0.0, px * 1.2 / 0.06, abs(sc - 1.0))) * 0.4 * uSeed);
  }
  vec3 outc = engrave(col, tone * mix(1.0, 0.55, uNight), 0.0);
  outc = mix(outc, uInk, lineM * uInkA * 0.85);
  // outline of the cut (left/right edges, top edge)
  float e = min(min(vUv.x, vUv.y), -y);
  float ow = px * uLineW * uDpr;
  outc = mix(outc, uInk, (1.0 - smoothstep(ow * 0.6, ow, e)) * uInkA);
  gl_FragColor = vec4(outc, 1.0);
}
`;

/* ---------------------------------------------------------------- leaves (instanced, alpha-tested drawings) */
export const LEAF_VERT = /* glsl */ `
${COMMON}
${SWAY}
attribute vec3 iPos;
attribute vec3 iDir;
attribute vec3 iNrm;
attribute vec4 iSize;      // length, width, atlas cell, glow
attribute vec4 iMisc;      // phase, flex, crown light (0..1), static (1 = no sway)
attribute vec3 iColor;
uniform float uLift;
uniform vec3 uCrownC;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vColor;
varying float vGlow;
varying float vCrown;
varying float vCell;
void main() {
  float phase = iMisc.x, flex = iMisc.y;
  float fl = iMisc.w > 0.5 ? 0.0 : sin(uTime * (2.6 + flex * 1.6) + phase * 3.7) * (0.05 + 0.3 * uWind) * flex;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 dir = normalize(iDir + iNrm * fl + up * uLift * 0.075 * (1.0 - iMisc.w));
  vec3 nrm = normalize(iNrm - iDir * fl);
  vec3 side = normalize(cross(dir, nrm));
  vec3 p = iPos + side * position.x * iSize.y + dir * position.y * iSize.x + nrm * position.z * iSize.y;
  if (iMisc.w < 0.5) p += swayOffset(iPos, phase, flex);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * nrm);
  // crown volume light: leaves on the lit side of the crown are lighter
  vec3 o = normalize((iPos - uCrownC) * vec3(1.0, 1.2, 1.0) + 1e-4);
  vCrown = iMisc.z * (0.5 + 0.5 * dot(o, uLight));
  float cell = iSize.z;
  vCell = cell;
  vUv = vec2((position.x + 0.5 + mod(cell, 2.0)) * 0.5, (position.y + floor(cell / 2.0)) * 0.5);
  vColor = iColor;
  vGlow = iSize.w;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
export const LEAF_FRAG = /* glsl */ `
${COMMON}
${HATCH}
uniform sampler2D uAtlas;
uniform vec3 uUnder;
uniform vec3 uGlowC;
uniform float uAlphaTest;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vColor;
varying float vGlow;
varying float vCrown;
varying float vCell;
void main() {
  vec4 tex = texture2D(uAtlas, vUv);
  if (tex.a < uAlphaTest) discard;
  vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  float ndl = abs(dot(N, uLight));
  float lit = clamp(ndl * 0.4 + vCrown * 0.75 - 0.05, 0.0, 1.0);
  vec3 fill = gl_FrontFacing ? vColor : mix(vColor, uUnder, 0.45);
  vec3 col = engrave(fill, lit, 0.0);
  float line = tex.r;
  col = mix(col, uInk, line * uInkA * 0.95);
  // greeting leaf: warm, glowing, no hatching
  if (vGlow > 0.5) {
    vec3 g = uGlowC * mix(1.0, 1.08, uNight);
    col = mix(g, uInk, line * 0.9);
  }
  gl_FragColor = vec4(col, tex.a < 1.0 && uAlphaTest < 0.01 ? tex.a : 1.0);
}
`;

/* grass tufts: ink strokes, billboarded around the vertical */
export const TUFT_VERT = /* glsl */ `
${COMMON}
attribute vec4 iTuft;   // x, z, size, lean
uniform vec3 uCamRight;
varying vec2 vUv;
void main() {
  vec3 base = vec3(iTuft.x, 0.0, iTuft.y);
  float s = iTuft.z;
  float sway = sin(uTime * 1.9 + iTuft.x * 7.0 + iTuft.y * 5.0) * (0.04 + 0.18 * uWind) * position.y;
  vec3 p = base + uCamRight * (position.x + iTuft.w * position.y * 0.3 + sway) * s + vec3(0.0, position.y * s, 0.0);
  vUv = vec2((position.x + 0.5) * 0.5 + 0.5, position.y * 0.5 + 0.5);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}
`;
export const TUFT_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uAtlas;
varying vec2 vUv;
void main() {
  vec4 tex = texture2D(uAtlas, vUv);
  if (tex.r < 0.35) discard;
  gl_FragColor = vec4(mix(uPaper, uInk, 0.62 * uInkA), 1.0);
}
`;

/* the plaque: wood drawing on the front, darker sides */
export const PLAQUE_FRAG = /* glsl */ `
${COMMON}
${HATCH}
uniform sampler2D uMap;
uniform vec3 uColor;
uniform vec4 uBox;       // minX, minY, width, height (object space)
uniform float uClipY;
uniform float uClipYTop;
uniform float uWorldClip; // discard world (island) y below this
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;
varying float vExtra;
void main() {
  if (vExtra < uWorldClip) discard;
  vec3 N = normalize(vN);
  float lit = max(dot(N, uLight), 0.0);
  vec3 col;
  if (vObj.z > 0.006) {
    vec2 uv = vec2((vObj.x - uBox.x) / uBox.z, (vObj.y - uBox.y) / uBox.w);
    vec4 t = texture2D(uMap, uv);
    col = mix(uColor, t.rgb, t.a) * mix(0.9, 1.04, lit) * mix(1.0, 0.62, uNight);
  } else {
    col = engrave(uColor * 0.72, lit, 0.15);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;
export const PLAQUE_VERT = /* glsl */ `
${COMMON}
uniform mat4 uIslandFromLocal;
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;
varying float vExtra;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vObj = position;
  vUv = uv;
  vExtra = (uIslandFromLocal * vec4(position, 1.0)).y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
/* the brass token: QR on the front cap */
export const TOKEN_FRAG = /* glsl */ `
${COMMON}
${HATCH}
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uR;
varying vec3 vN;
varying vec3 vObj;
varying vec2 vUv;
varying float vExtra;
void main() {
  vec3 N = normalize(vN);
  float lit = max(dot(N, uLight), 0.0);
  vec3 col;
  if (vObj.z > 0.002) {
    vec4 t = texture2D(uMap, vec2(vObj.x / (2.0 * uR) + 0.5, vObj.y / (2.0 * uR) + 0.5));
    col = t.rgb * mix(0.92, 1.04, lit) * mix(1.0, 0.6, uNight);
  } else col = engrave(uColor * 0.8, lit, 0.1);
  gl_FragColor = vec4(col, 1.0);
}
`;
