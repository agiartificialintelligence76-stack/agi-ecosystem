// STACKED's shaders (2026-11-08). Colours are authored in sRGB and drawn as they are (scene.js turns three.js's colour
// management off), and every face is flat-lit by hand, so the look is exactly the palette's.

const HASH = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

// ---------- a floor (and every box of the diorama) ----------
// A unit box scaled to uSize. Each face knows its own coordinates in world units, so the windows keep their size on a
// narrow floor and the ink outline is the same number of pixels on every edge (fwidth). uKind: 0 plain, 1 office
// floor, 2 the lobby, 3 a lamp (not lit by anything), 4 the island's top (plaza and park).
export const SLAB_VERT = /* glsl */ `
uniform vec3 uSize;
varying vec3 vLocal;
varying vec3 vObjN;
varying vec3 vNormalW;
varying float vWorldY;
void main() {
  vLocal = position * uSize;
  vObjN = normal;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldY = wp.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const SLAB_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSize;
uniform vec2 uPat;
uniform float uSeed;
uniform float uFlash;
uniform float uAlpha;
uniform float uKind;
uniform vec3 uLightDir;
uniform vec3 uLightCol;
uniform vec3 uAmbTop;
uniform vec3 uAmbBot;
uniform vec3 uFogCol;
uniform float uFogY;
uniform float uFogRange;
uniform float uFogMax;
uniform float uLit;
uniform float uLinePx;
uniform float uDetail;
uniform vec3 uInk;
uniform vec3 uGlass;
uniform vec3 uWinA;
uniform vec3 uWinB;
uniform vec3 uWinC;
uniform vec3 uPark;
varying vec3 vLocal;
varying vec3 vObjN;
varying vec3 vNormalW;
varying float vWorldY;
${HASH}
float band(float x, float a, float b, float aa) {
  return smoothstep(a - aa, a + aa, x) * (1.0 - smoothstep(b - aa, b + aa, x));
}
void main() {
  vec3 an = abs(vObjN);
  vec2 uv; vec2 fs; float side = 0.0; float along = 0.0;
  if (an.y > 0.5) { uv = vLocal.xz + 0.5 * uSize.xz; fs = uSize.xz; }
  else if (an.x > 0.5) { uv = vLocal.zy + 0.5 * uSize.zy; fs = uSize.zy; side = 1.0; along = vLocal.z + uPat.y; }
  else { uv = vLocal.xy + 0.5 * uSize.xy; fs = uSize.xy; side = 1.0; along = vLocal.x + uPat.x; }
  vec2 fw = max(fwidth(uv), vec2(1e-5));
  bool top = an.y > 0.5 && vObjN.y > 0.0;

  vec3 N = normalize(vNormalW);
  float diff = max(dot(N, uLightDir), 0.0);
  vec3 amb = mix(uAmbBot, uAmbTop, 0.5 + 0.5 * N.y);
  vec3 light = amb + uLightCol * diff;
  vec3 col = (uKind > 2.5 && uKind < 3.5) ? uColor : uColor * light;

  // office windows (and the lobby's tall glass)
  if (side > 0.5 && uKind > 0.5 && uKind < 2.5) {
    float lobby = step(1.5, uKind);
    float cell = mix(0.375, 0.5, lobby);
    float aw = max(fwidth(along), 1e-5);
    float cx = fract(along / cell) * cell;
    float id = floor(along / cell);
    float y = uv.y / fs.y;
    float y0 = mix(0.27, 0.1, lobby), y1 = mix(0.75, 0.84, lobby);
    float win = band(cx, cell * 0.17, cell * 0.83, aw * 0.7) * band(y, y0, y1, fw.y / fs.y * 0.7) * uDetail;
    float lit = lobby > 0.5 ? 1.0 : step(hash12(vec2(id * 1.731 + 0.5, uSeed)), uLit);
    float pick = hash12(vec2(uSeed * 0.37 + 3.1, id + 11.0));
    vec3 lc = pick < 0.62 ? uWinA : (pick < 0.84 ? uWinB : uWinC);
    float gy = clamp((y - y0) / (y1 - y0), 0.0, 1.0);
    vec3 glass = uGlass * (0.8 + 0.55 * diff) + vec3(0.05) * gy;
    vec3 warm = lc * (0.8 + 0.28 * gy);
    col = mix(col, mix(glass, warm, lit), win);
    // the lobby's doors, in the middle of its two front faces
    if (lobby > 0.5) {
      float mid = abs(along) / 0.42;
      float door = (1.0 - smoothstep(1.0 - aw * 3.0, 1.0, mid)) * band(y, 0.0, 0.62, fw.y / fs.y);
      col = mix(col, uInk * 1.6 + uWinA * 0.25, door * step(0.0, dot(vObjN, vec3(1.0, 0.0, 1.0))));
    }
  }

  // the island's top: a stone plaza around the tower, a park around it
  if (top && uKind > 3.5) {
    vec2 q = vLocal.xz;
    float m = max(abs(q.x), abs(q.y));
    float plaza = 1.0 - smoothstep(2.2 - fw.x, 2.2 + fw.x, m);
    vec2 g = abs(fract(q / 0.6) - 0.5) * 0.6 / fw;
    float grout = 1.0 - smoothstep(0.0, 1.2, min(g.x, g.y));
    vec3 stone = col * (1.0 - 0.12 * grout);
    vec3 park = uPark * light;
    float dots = step(0.86, hash12(floor(q * 3.0) + 2.0)) * (1.0 - plaza);
    park = mix(park, park * 1.25, dots);
    col = mix(park, stone, plaza);
    col = mix(col, uInk, (1.0 - smoothstep(0.0, 1.4, abs(m - 2.2) / fw.x)) * 0.55);
  }

  vec2 dd = min(uv, fs - uv) / fw;
  if (side > 0.5 && uv.y < 0.5 * fs.y) dd.y *= 1.8;       // shared with the floor below: a thinner line
  float e = min(dd.x, dd.y);
  if (top && uKind < 2.5) col = mix(col, col * 1.1 + 0.045, (1.0 - smoothstep(uLinePx + 0.6, uLinePx + 2.6, e)) * 0.8);
  col = mix(col, vec3(1.0, 0.98, 0.93), uFlash);
  col = mix(col, uInk, 1.0 - smoothstep(uLinePx - 0.7, uLinePx + 0.7, e));

  float fz = clamp((uFogY - vWorldY) / uFogRange, 0.0, 1.0);
  col = mix(col, uFogCol, fz * fz * (3.0 - 2.0 * fz) * uFogMax);
  gl_FragColor = vec4(col, uAlpha);
}`;

// ---------- the perfect ring: a rounded-rectangle line on the floor's top, growing and fading ----------
export const RING_VERT = /* glsl */ `
uniform vec3 uCenter;
varying vec2 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xz - uCenter.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const RING_FRAG = /* glsl */ `
uniform vec2 uHalf;
uniform float uWidth;
uniform float uAlpha;
uniform vec3 uCol;
varying vec2 vP;
void main() {
  vec2 d = abs(vP) - uHalf;
  float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  float aa = max(fwidth(dist), 1e-5);
  float a = 1.0 - smoothstep(uWidth * 0.5 - aa, uWidth * 0.5 + aa, abs(dist));
  gl_FragColor = vec4(uCol, a * uAlpha);
}`;

// ---------- the sky: a full-screen triangle pair behind everything ----------
export const SKY_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}`;

export const SKY_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform float uAlt;
uniform float uZoneAlt;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBot;
uniform float uMidAt;
uniform float uStars;
uniform float uSkyline;
uniform float uMoon;
uniform float uRain;
uniform float uClouds;
uniform vec3 uCloudA;
uniform vec3 uCloudB;
uniform float uSun;
uniform vec3 uSunCol;
uniform float uSea;
uniform vec3 uSeaA;
uniform vec3 uSeaB;
uniform float uEarth;
uniform float uEarthR;
uniform float uEarthY;
uniform vec3 uEarthCol;
uniform vec3 uLimb;
uniform float uFlashL;
uniform vec3 uInk;
uniform vec3 uWin;
uniform float uJourney;
uniform float uJBot;
uniform float uJTop;
uniform vec3 uJ0;
uniform vec3 uJ1;
uniform vec3 uJ2;
uniform vec3 uJ3;
uniform vec3 uJ4;
uniform vec3 uJ5;
varying vec2 vUv;
${HASH}
vec3 journey(float a) {
  // the whole climb as one sky: city haze → night → rain → sunrise → stratosphere → space
  if (a < 0.12) return mix(uJ0, uJ1, smoothstep(0.0, 0.12, a));
  if (a < 0.3) return mix(uJ1, uJ2, smoothstep(0.12, 0.3, a));
  if (a < 0.52) return mix(uJ2, uJ3, smoothstep(0.3, 0.52, a));
  if (a < 0.76) return mix(uJ3, uJ4, smoothstep(0.52, 0.76, a));
  return mix(uJ4, uJ5, smoothstep(0.76, 1.0, a));
}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float px = 1.0 / uRes.y * uDpr;
  vec3 sky = vUv.y < uMidAt ? mix(uBot, uMid, smoothstep(0.0, uMidAt, vUv.y)) : mix(uMid, uTop, smoothstep(uMidAt, 1.0, vUv.y));

  // stars, a few of them four-pointed
  if (uStars > 0.002) {
    vec2 sp = gl_FragCoord.xy / uDpr + vec2(0.0, uAlt * 2.5);
    float cs = 36.0;
    vec2 ci = floor(sp / cs);
    vec2 cf = sp - ci * cs;
    float h = hash12(ci);
    vec2 c = (vec2(hash12(ci + 17.3), hash12(ci + 41.9)) * 0.8 + 0.1) * cs;
    vec2 dc = abs(cf - c);
    float tw = 0.6 + 0.4 * sin(uTime * (0.7 + 2.2 * h) + h * 60.0);
    float small = step(h, 0.3) * (1.0 - smoothstep(0.35, 1.25, length(cf - c))) * (0.45 + 0.55 * hash12(ci + 5.0));
    float big = step(h, 0.035) * (max(0.0, 1.0 - dc.x) * max(0.0, 1.0 - dc.y / 6.0) + max(0.0, 1.0 - dc.y) * max(0.0, 1.0 - dc.x / 6.0));
    float s = clamp((small + big) * tw, 0.0, 1.0) * uStars * smoothstep(0.05, 0.6, vUv.y + 0.4 * uStars);
    sky = mix(sky, vec3(1.0, 0.97, 0.9), s);
  }

  // the moon
  if (uMoon > 0.002) {
    vec2 mp = vec2(min(0.3, aspect * 0.5 - 0.11), 0.3 - uAlt * 0.004);
    float r = 0.052;
    float md = length(p - mp);
    sky += vec3(0.32, 0.26, 0.55) * exp(-max(md - r, 0.0) * 16.0) * 0.22 * uMoon;
    float disc = 1.0 - smoothstep(r - px, r + px, md);
    float shade = 1.0 - smoothstep(r * 0.92 - px, r * 0.92 + px, length(p - mp - vec2(r * 0.42, r * 0.25)));
    vec3 mc = mix(vec3(0.98, 0.95, 1.0), vec3(0.8, 0.76, 0.96), shade * 0.55);
    sky = mix(sky, mc, disc * uMoon);
  }

  // the city's skyline far away, two layers, sinking as the tower climbs past it
  if (uSkyline > 0.002) {
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      float w = mix(0.06, 0.085, fl);
      float xx = p.x / w + fl * 7.31 + 0.5;
      float id = floor(xx);
      float gx = fract(xx);
      float hh = mix(0.04, 0.17, hash12(vec2(id, 3.0 + fl * 9.0))) * mix(1.0, 1.3, fl);
      float base = -0.5 + mix(0.2, 0.09, fl) - uAlt * mix(0.006, 0.012, fl);
      float tp = base + hh;
      float inB = (1.0 - smoothstep(tp - px, tp + px, p.y)) * step(0.04, gx) * step(gx, 0.96);
      vec3 bc = mix(uBot, uInk, mix(0.5, 0.74, fl));
      vec2 wq = vec2(gx * 5.0, (p.y - base) / (w * 0.24));
      vec2 wi = floor(wq);
      vec2 wf = fract(wq);
      float isW = step(0.3, wf.x) * step(wf.x, 0.7) * step(0.32, wf.y) * step(wf.y, 0.72) * step(1.0, wi.x) * step(wi.x, 3.0) * step(wq.y, hh / (w * 0.24) - 0.5);
      float on = step(hash12(wi + vec2(id * 13.0, fl * 5.0)), 0.26);
      bc = mix(bc, uWin * mix(0.7, 0.9, fl), on * isW * 0.8);
      sky = mix(sky, bc, inB * uSkyline);
    }
  }

  // rain clouds: flat scalloped layers passing by as the tower climbs through them
  if (uClouds > 0.002) {
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float yb = fract(0.12 + fi * 0.29 + uZoneAlt * (0.006 + 0.0035 * fi)) * 1.55 - 0.78;
      float fx = p.x * (5.0 + fi * 1.9) + fi * 4.1 + uTime * 0.035 * (1.0 + fi * 0.5);
      float te = yb + 0.034 * abs(sin(fx)) + 0.02 * abs(sin(fx * 2.3 + 1.7));
      float th = 0.09 + 0.05 * fi;
      float inC = (1.0 - smoothstep(te - px, te + px, p.y)) * smoothstep(te - th, te - th * 0.35, p.y);
      vec3 cc = mix(uCloudB, uCloudA, fi / 3.0) + 0.05 * smoothstep(te - 0.025, te, p.y) + uFlashL * 0.22;
      sky = mix(sky, cc, inC * uClouds * 0.92);
    }
  }

  // rain
  if (uRain > 0.002) {
    vec2 rp = gl_FragCoord.xy / uDpr;
    rp.x += rp.y * 0.24;
    float ci = floor(rp.x / 7.0);
    float rh = hash12(vec2(ci, 7.0));
    float yy = fract(rp.y / 140.0 + uTime * (2.0 + 1.4 * rh) + rh * 13.0);
    float streak = step(fract(rp.x / 7.0), 1.1 / 7.0) * smoothstep(0.0, 0.05, yy) * (1.0 - smoothstep(0.05, 0.22, yy)) * step(rh, 0.5);
    sky = mix(sky, vec3(0.82, 0.86, 1.0), streak * 0.32 * uRain);
    sky += vec3(0.5, 0.52, 0.66) * uFlashL * 0.3 * uRain;
  }

  // the sunrise: the sun low on the left, a sea of clouds below the tower
  if (uSun > 0.002) {
    vec2 sc = vec2(-min(0.2, aspect * 0.5 - 0.12), -0.07 - uZoneAlt * 0.0015);
    float sd = length(p - sc);
    float sr = 0.08;
    sky += uSunCol * exp(-sd * 5.5) * 0.2 * uSun;
    sky = mix(sky, uSunCol, (1.0 - smoothstep(sr - px, sr + px, sd)) * uSun);
  }
  if (uSea > 0.002) {
    float seaTop = -0.2 - uZoneAlt * 0.004;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float fx = p.x * (5.0 + fi * 3.1) + fi * 2.3 + uTime * 0.02 * (1.0 + fi);
      float te = seaTop - fi * 0.07 + 0.032 * abs(sin(fx)) + 0.016 * abs(sin(fx * 2.1 + 0.6));
      float m = 1.0 - smoothstep(te - px, te + px, p.y);
      vec3 cc = mix(uSeaA, uSeaB, clamp(fi * 0.35 + (te - p.y) * 2.5, 0.0, 1.0));
      sky = mix(sky, cc, m * uSea);
    }
  }

  // the Earth's curve: a wide horizon in the stratosphere, a planet's edge in orbit
  if (uEarth > 0.002) {
    vec2 ec = vec2(0.0, uEarthY - uEarthR);
    float ed = length(p - ec) - uEarthR;
    float inE = 1.0 - smoothstep(-px, px, ed);
    vec3 body = uEarthCol * (0.5 + 0.5 * smoothstep(-0.3, 0.0, ed));
    float sw = sin(p.x * 21.0 + sin(p.y * 15.0) * 2.0 + uTime * 0.015) * sin(p.y * 29.0 + p.x * 6.0);
    body = mix(body, vec3(0.93, 0.97, 1.0), smoothstep(0.5, 0.9, sw) * 0.3 * smoothstep(-0.25, -0.02, ed));
    vec3 we = mix(sky, body, inE);
    float limb = exp(-abs(ed) * 150.0);
    float atmo = exp(-max(ed, 0.0) * 24.0) * step(0.0, ed);
    we = mix(we, uLimb, clamp(limb * 0.85 + atmo * 0.4, 0.0, 1.0));
    sky = mix(sky, we, uEarth);
  }

  // the end of a run: the whole climb behind the whole tower
  if (uJourney > 0.002) {
    float a = clamp((mix(uJBot, uJTop, vUv.y)), 0.0, 1.0);
    vec3 j = journey(a);
    vec2 sp = gl_FragCoord.xy / uDpr;
    float h = hash12(floor(sp / 30.0));
    float st = step(h, 0.22) * (1.0 - smoothstep(0.3, 1.2, length(fract(sp / 30.0) * 30.0 - 15.0 - (vec2(hash12(floor(sp / 30.0) + 3.0), hash12(floor(sp / 30.0) + 9.0)) - 0.5) * 24.0)));
    j = mix(j, vec3(1.0, 0.97, 0.9), st * smoothstep(0.7, 0.95, a) * 0.9);
    sky = mix(sky, j, uJourney);
  }

  sky += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(sky, 1.0);
}`;
