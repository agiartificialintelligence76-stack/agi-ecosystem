// GRADIENT DESCENT's shaders (2026-11-08). Colours are authored in sRGB and drawn as they are (scene.js turns three.js's
// colour management off). Kept simple on purpose: plain maths, small fixed loops, fwidth for lines that are the same
// width in pixels everywhere (WebGL 2, which every device that runs three.js has, SwiftShader included).

const HASH = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

// the height colour map: deep indigo at the bottom, through violet and teal, to honey and hot pink at the top
const CMAP = /* glsl */ `
vec3 cmap(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.090, 0.047, 0.290);
  vec3 c1 = vec3(0.196, 0.157, 0.627);
  vec3 c2 = vec3(0.078, 0.506, 0.659);
  vec3 c3 = vec3(0.200, 0.835, 0.690);
  vec3 c4 = vec3(1.000, 0.788, 0.200);
  vec3 c5 = vec3(1.000, 0.545, 0.369);
  vec3 c6 = vec3(1.000, 0.302, 0.651);
  if (t < 0.18) return mix(c0, c1, t / 0.18);
  if (t < 0.38) return mix(c1, c2, (t - 0.18) / 0.2);
  if (t < 0.55) return mix(c2, c3, (t - 0.38) / 0.17);
  if (t < 0.72) return mix(c3, c4, (t - 0.55) / 0.17);
  if (t < 0.87) return mix(c4, c5, (t - 0.72) / 0.15);
  return mix(c5, c6, (t - 0.87) / 0.13);
}`;

// ---------- the landscape ----------
export const TERRAIN_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normal;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

export const TERRAIN_FRAG = /* glsl */ `
uniform float uHMin;
uniform float uHMax;
uniform float uStep;
uniform float uTime;
uniform vec2 uCup;
uniform float uCupR;
uniform vec3 uPits[6];
uniform int uPitN;
uniform vec4 uSticky[4];
uniform int uStickyN;
uniform vec4 uRipple;      // cup x, cup z, seconds since the drop, strength
uniform vec3 uLight;
uniform vec3 uBg;
uniform float uFogNear;
uniform float uFogFar;
uniform float uLinePx;
uniform float uFlag;       // how far the pin is pulled (0 in the cup … 1 out)
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDepth;
${HASH}
${CMAP}
float lineAt(float v, float px) {
  float fw = max(fwidth(v), 1e-5);
  float d = abs(fract(v + 0.5) - 0.5) / fw;
  return (1.0 - smoothstep(px - 0.5, px + 0.5, d)) * (1.0 - smoothstep(0.18, 0.45, fw));
}
void main() {
  float h = vWorld.y;
  float t = (h - uHMin) / max(uHMax - uHMin, 1e-3);
  vec3 col = cmap(t);
  // terraces: every other band a touch darker (the plot's filled contours)
  float band = floor(h / uStep);
  col *= 0.965 + 0.035 * mod(band, 2.0);
  // light: a soft half-lambert, so the shape reads but the colour map stays the hero
  vec3 N = normalize(vNormal);
  float diff = dot(N, normalize(uLight));
  col *= 0.68 + 0.42 * clamp(diff * 0.5 + 0.5, 0.0, 1.0) + 0.12 * max(diff, 0.0);
  vec2 p = vWorld.xz;
  // the faint grid (one unit), and the contour lines (every uStep; every fourth a stronger one)
  float gx = lineAt(p.x, 0.5), gz = lineAt(p.y, 0.5);
  col = mix(col, col * 1.18 + 0.03, max(gx, gz) * 0.32);
  float cv = h / uStep;
  float minor = lineAt(cv, uLinePx * 0.62);
  float major = lineAt(cv / 4.0, uLinePx * 0.95);
  col = mix(col, col * 0.22, minor * 0.78);
  col = mix(col, vec3(0.06, 0.03, 0.16), major * 0.82);

  // weight decay: hatching inside the patch, a dashed edge
  for (int i = 0; i < 4; i++) {
    if (i >= uStickyN) break;
    vec4 s = uSticky[i];
    vec2 q = (p - s.xy) / s.zw;
    float r = length(q);
    if (r < 1.06) {
      float hatch = step(0.62, fract((p.x + p.y) * 2.1));
      float inside = 1.0 - smoothstep(0.97, 1.0, r);
      col = mix(col, mix(col * 0.5, vec3(0.894, 0.851, 1.0), 0.55), hatch * inside * 0.7);
      float edge = smoothstep(0.93, 0.97, r) * (1.0 - smoothstep(1.0, 1.04, r));
      float dash = step(0.5, fract(atan(q.y, q.x) * 3.2));
      col = mix(col, vec3(0.894, 0.851, 1.0), edge * dash * 0.9);
    }
  }
  // NaN pits: a hole in the data (black, with glitching blocks), a pink and mint split rim
  for (int i = 0; i < 6; i++) {
    if (i >= uPitN) break;
    vec3 pt = uPits[i];
    float d = length(p - pt.xy);
    if (d < pt.z + 0.3) {
      float inside = 1.0 - smoothstep(pt.z - 0.02, pt.z + 0.02, d);
      vec2 cell = floor((p - pt.xy) * 7.0);
      float n = hash12(cell + floor(uTime * 9.0) * 7.31);
      vec3 voidc = vec3(0.012, 0.008, 0.035);
      voidc = mix(voidc, vec3(0.247, 0.941, 0.765), step(0.93, n) * 0.55);
      voidc = mix(voidc, vec3(1.0, 0.302, 0.651), step(0.965, n) * 0.6);
      col = mix(col, voidc, inside);
      float rimP = 1.0 - smoothstep(0.0, 0.05, abs(d - pt.z - 0.035));
      float rimM = 1.0 - smoothstep(0.0, 0.04, abs(d - pt.z + 0.03));
      col = mix(col, vec3(1.0, 0.302, 0.651), rimP * 0.95);
      col = mix(col, vec3(0.247, 0.941, 0.765), rimM * 0.8 * inside);
      // a soft dark halo around it
      col *= 1.0 - 0.35 * (1.0 - smoothstep(pt.z, pt.z + 0.3, d)) * (1.0 - inside);
    }
  }
  // the cup: a dark hole with a bright lip and a slow mint glow around it
  float dc = length(p - uCup);
  if (dc < uCupR + 1.4) {
    float hole = 1.0 - smoothstep(uCupR - 0.02, uCupR + 0.01, dc);
    vec3 cupc = mix(vec3(0.02, 0.01, 0.06), vec3(0.09, 0.05, 0.2), smoothstep(0.0, uCupR, dc));
    col = mix(col, cupc, hole);
    float lip = 1.0 - smoothstep(0.0, 0.045, abs(dc - uCupR - 0.02));
    col = mix(col, vec3(1.0, 0.98, 0.94), lip);
    float pulse = 0.55 + 0.45 * sin(uTime * 2.6);
    float glow = (1.0 - smoothstep(uCupR, uCupR + 1.2, dc)) * (1.0 - hole) * (0.22 + 0.18 * pulse);
    col += vec3(0.247, 0.941, 0.765) * glow * 0.55;
  }
  // the drop: rings of light run out from the cup along the contour lines
  if (uRipple.w > 0.001) {
    float d = length(p - uRipple.xy);
    float rr = uRipple.z * 8.5;
    float ring = exp(-pow((d - rr) / 0.7, 2.0)) + 0.6 * exp(-pow((d - rr * 0.62) / 0.5, 2.0));
    float fade = uRipple.w * clamp(1.0 - uRipple.z / 2.6, 0.0, 1.0);
    col += vec3(1.0, 0.93, 0.62) * ring * fade * (0.18 + 1.1 * max(minor, major));
  }
  // depth: the far side fades a little into the night
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uBg, fog * 0.55);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- the sides of the block (a 3D plot's box) ----------
export const SKIRT_VERT = /* glsl */ `
attribute float aTop;
varying vec3 vWorld;
varying float vTop;
varying float vDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vTop = aTop;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
export const SKIRT_FRAG = /* glsl */ `
uniform float uHMin;
uniform float uHMax;
uniform float uStep;
uniform float uBase;
uniform vec3 uBg;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vWorld;
varying float vTop;
varying float vDepth;
${CMAP}
void main() {
  float h = vWorld.y;
  float k = clamp((h - uBase) / max(uHMax - uBase, 1e-3), 0.0, 1.0);
  vec3 col = mix(vec3(0.035, 0.02, 0.09), vec3(0.11, 0.07, 0.25), k);
  // the colour map's edge, a thin band under the ground's lip
  float lipd = vTop - h;
  col = mix(col, cmap((vTop - uHMin) / max(uHMax - uHMin, 1e-3)) * 0.75, 1.0 - smoothstep(0.0, 0.12, lipd));
  // level lines every 4 steps (the box's grid)
  float v = h / (uStep * 4.0);
  float fw = max(fwidth(v), 1e-5);
  float l = 1.0 - smoothstep(0.3, 1.0, abs(fract(v + 0.5) - 0.5) / fw);
  col = mix(col, vec3(0.42, 0.36, 0.7), l * 0.35 * step(0.15, lipd));
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uBg, fog * 0.55);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- the ball: glossy honey, a pink seam so it reads as rolling ----------
export const BALL_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vLocal;
varying vec3 vView;
void main() {
  vLocal = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
export const BALL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSeam;
uniform vec3 uLight;
uniform float uFlash;
varying vec3 vN;
varying vec3 vLocal;
varying vec3 vView;
void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(uLight);
  float diff = max(dot(N, L), 0.0);
  vec3 col = uColor * (0.5 + 0.62 * diff);
  float seam = 1.0 - smoothstep(0.03, 0.06, abs(normalize(vLocal).y));
  col = mix(col, uSeam, seam * 0.9);
  vec3 H = normalize(L + vView);
  float spec = pow(max(dot(N, H), 0.0), 42.0);
  col += vec3(1.0) * spec * 0.85;
  float rim = pow(1.0 - max(dot(N, vView), 0.0), 3.0);
  col += vec3(1.0, 0.85, 0.55) * rim * 0.25;
  col = mix(col, vec3(1.0), uFlash);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- a soft round shadow, a trail, the aim arrow, the preview dots ----------
export const BLOB_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const BLOB_FRAG = /* glsl */ `
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * uAlpha;
  gl_FragColor = vec4(0.03, 0.01, 0.08, a);
}`;

export const TRAIL_VERT = /* glsl */ `
attribute float aAlpha;
varying float vA;
void main() { vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const TRAIL_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() { gl_FragColor = vec4(uColor, vA); }`;

export const ARROW_VERT = /* glsl */ `
attribute float aEdge;
attribute float aAlong;
varying float vEdge;
varying float vAlong;
void main() { vEdge = aEdge; vAlong = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const ARROW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vEdge;
varying float vAlong;
void main() {
  // ink outline on the edges, the colour inside, a little brighter towards the tip
  float ink = smoothstep(0.5, 0.66, vEdge);
  vec3 col = mix(uColor * (0.9 + 0.2 * vAlong), vec3(0.09, 0.04, 0.21), ink);
  gl_FragColor = vec4(col, uAlpha);
}`;

export const DOTS_VERT = /* glsl */ `
attribute float aAlpha;
uniform float uSize;
varying float vA;
void main() {
  vA = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize;
  gl_Position = projectionMatrix * mv;
}`;
export const DOTS_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  if (d > 1.0) discard;
  vec3 col = mix(uColor, vec3(0.09, 0.04, 0.21), smoothstep(0.55, 0.7, d));
  gl_FragColor = vec4(col, vA * (1.0 - smoothstep(0.9, 1.0, d)));
}`;

// ---------- a bumper post: honey with ink bands, lit simply ----------
export const POST_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
export const POST_FRAG = /* glsl */ `
uniform vec3 uLight;
uniform float uTop;
uniform float uFlash;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  float diff = max(dot(N, normalize(uLight)), 0.0);
  vec3 col = vec3(1.0, 0.788, 0.2);
  float y = uTop - vW.y;
  col = mix(col, vec3(1.0, 0.302, 0.651), step(0.5, fract(y * 2.4)) * step(0.12, y));
  if (N.y > 0.5) col = vec3(1.0, 0.98, 0.94);
  col *= 0.55 + 0.6 * diff;
  col = mix(col, vec3(1.0), uFlash * 0.7);
  gl_FragColor = vec4(col, 1.0);
}`;

export const FLAG_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += sin(uTime * 5.0 + uv.x * 4.0) * 0.06 * uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
export const FLAG_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.04) discard;
  gl_FragColor = vec4(c.rgb, c.a * uAlpha);
}`;
