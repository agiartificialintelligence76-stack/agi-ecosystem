import * as pc from 'playcanvas';

// One fullscreen pass drawn before the world: a gradient sky with a sun, a cloud
// deck, stars, aurora, a planet below the horizon in orbit, and lightning. Every
// term is a uniform, so the look can glide from one district to the next.
const SKY_GLSL = /* glsl */`
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uBand;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uCloud;
uniform vec3 uCloudColor;
uniform float uCloudLow;
uniform float uStars;
uniform float uAurora;
uniform vec3 uAuroraColor;
uniform float uPlanet;
uniform float uFlash;
uniform float uTime;
uniform mat4 uInvViewProj;
varying vec2 vUv0;

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  return 0.5 * vnoise(p) + 0.25 * vnoise(p * 2.03 + 17.0) + 0.125 * vnoise(p * 4.1 + 31.0) + 0.0625 * vnoise(p * 8.3 + 5.0);
}

void main() {
  vec2 ndc = vUv0 * 2.0 - 1.0;
  vec4 nearP = uInvViewProj * vec4(ndc, -1.0, 1.0);
  vec4 farP = uInvViewProj * vec4(ndc, 1.0, 1.0);
  vec3 dir = normalize(farP.xyz / farP.w - nearP.xyz / nearP.w);
  float y = dir.y;

  // Gradient: ground, a warm horizon band, the zenith.
  vec3 col = y >= 0.0
    ? mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.55, y), 0.75))
    : mix(uHorizon, uGround, smoothstep(0.0, 0.32, -y));
  col = mix(col, uBand, 0.55 * exp(-abs(y - 0.015) * 9.0));

  // A planet fills the lower sky once you are in orbit, with a thin atmosphere rim.
  if (uPlanet > 0.001 && y < 0.02) {
    vec2 p = dir.xz / max(-y, 0.04) * 0.35;
    float land = smoothstep(0.52, 0.6, fbm(p * 0.8 + 3.0));
    float cloudsP = smoothstep(0.55, 0.75, fbm(p * 1.7 + vec2(uTime * 0.004, 9.0)));
    vec3 ocean = vec3(0.04, 0.16, 0.42);
    vec3 earth = mix(ocean, vec3(0.16, 0.32, 0.18), land);
    earth = mix(earth, vec3(0.92), cloudsP * 0.8);
    float limb = smoothstep(0.0, -0.25, y);
    earth *= 0.55 + 0.45 * limb;
    vec3 rim = vec3(0.35, 0.65, 1.0) * exp(-abs(y + 0.004) * 60.0) * 1.4;
    col = mix(col, earth, uPlanet * smoothstep(0.02, -0.01, y)) + rim * uPlanet;
  }

  // Sun disc and glow.
  float sd = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sd, 900.0 / max(uSunSize, 0.2)) * 3.0 + pow(sd, 18.0) * 0.28 + pow(sd, 3.0) * 0.08);

  // A cloud deck: overhead by day, or a sea of cloud below when uCloudLow is set.
  if (uCloud > 0.001) {
    float above = smoothstep(0.0, 0.12, y);
    vec2 cp = dir.xz / max(abs(y), 0.035) * 0.9 + vec2(uTime * 0.006, uTime * 0.002);
    float n = fbm(cp + vec2(3.1, 7.7));
    float cloud = smoothstep(0.5 - uCloud * 0.22, 0.78, n);
    float mask = mix(above, smoothstep(0.0, -0.1, y) + above * 0.35, uCloudLow);
    vec3 lit = uCloudColor * (0.82 + 0.3 * pow(sd, 4.0));
    col = mix(col, lit, cloud * mask * min(1.0, uCloud * 1.25));
  }

  // Stars above the horizon.
  if (uStars > 0.001) {
    vec3 cell = dir * 260.0;
    float h = hash3(floor(cell));
    float disc = 1.0 - smoothstep(0.12, 0.42, length(fract(cell) - 0.5));
    float star = step(0.9925, h) * disc * smoothstep(-0.02, 0.12, y + uPlanet * 0.02);
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + h * 6.0) + h * 40.0);
    col += vec3(0.85, 0.9, 1.0) * star * (0.4 + 0.6 * fract(h * 91.7)) * twinkle * uStars * 1.6;
    // A faint galactic band.
    float band = exp(-pow(dot(dir, normalize(vec3(0.3, 0.8, 0.5))) * 3.2, 2.0));
    col += vec3(0.22, 0.2, 0.32) * band * fbm(dir.xz * 6.0 + dir.y * 3.0) * uStars * 0.5;
  }

  // Aurora ribbons.
  if (uAurora > 0.001) {
    float az = atan(dir.z, dir.x);
    float y1 = y - (0.22 + 0.06 * sin(az * 3.0 + uTime * 0.21));
    float y2 = y - (0.38 + 0.08 * sin(az * 2.0 - uTime * 0.16 + 1.7));
    float curtain = 0.6 + 0.4 * sin(az * 23.0 + uTime * 0.6) * sin(az * 7.0 - uTime * 0.3);
    float rib = (1.0 - smoothstep(0.0, 0.09, abs(y1))) * 0.8 + (1.0 - smoothstep(0.0, 0.13, abs(y2))) * 0.45;
    col += uAuroraColor * rib * curtain * uAurora * 0.75;
  }

  col += vec3(0.75, 0.8, 1.0) * uFlash;
  float dither = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
  col += (dither - 0.5) / 255.0 * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

const VECTORS = ['zenith', 'horizon', 'ground', 'band', 'sunColor', 'cloudColor', 'auroraColor'];
const SCALARS = ['sunSize', 'cloud', 'cloudLow', 'stars', 'aurora', 'planet', 'flash'];

export class ChartSky {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;
    this.values = {
      zenith: [0.2, 0.4, 0.8], horizon: [0.9, 0.8, 0.7], ground: [0.3, 0.3, 0.3], band: [0.9, 0.7, 0.5],
      sunColor: [1, 0.9, 0.7], cloudColor: [1, 1, 1], auroraColor: [0.2, 1, 0.6], sunDir: [0.4, 0.3, -0.8],
      sunSize: 1, cloud: 0, cloudLow: 0, stars: 0, aurora: 0, planet: 0, flash: 0,
    };
    const device = scene.graphicsDevice;
    const shader = pc.ShaderUtils.createShader(device, {
      uniqueName: 'skybreak-chart-sky',
      attributes: { vertex_position: pc.SEMANTIC_POSITION },
      vertexChunk: 'fullscreenQuadVS',
      fragmentGLSL: SKY_GLSL,
    });
    const quad = new pc.QuadRender(shader);
    const viewProj = new pc.Mat4(), invViewProj = new pc.Mat4(), view = new pc.Mat4();
    const uniforms = Object.fromEntries([...VECTORS, ...SCALARS, 'sunDir', 'time', 'invViewProj']
      .map((name) => [name, device.scope.resolve(`u${name[0].toUpperCase()}${name.slice(1)}`)]));
    this.onPrerender = (_camera, layer, transparent) => {
      if (!this.enabled || layer.name !== 'World' || transparent) return;
      const camera = scene.cameraEntity.camera;
      if (!camera) return;
      view.copy(scene.cameraEntity.getWorldTransform()).invert();
      viewProj.mul2(camera.projectionMatrix, view);
      invViewProj.copy(viewProj).invert();
      for (const name of VECTORS) uniforms[name].setValue(this.values[name]);
      for (const name of SCALARS) uniforms[name].setValue(this.values[name]);
      uniforms.sunDir.setValue(this.values.sunDir);
      uniforms.time.setValue(performance.now() * 1e-3 % 1000);
      uniforms.invViewProj.setValue(invViewProj.data);
      device.setDepthState(pc.DepthState.NODEPTH);
      device.setBlendState(pc.BlendState.NOBLEND);
      device.setCullMode(pc.CULLFACE_NONE);
      quad.render();
    };
    scene.app.scene.on(pc.EVENT_PRERENDER_LAYER, this.onPrerender);
  }
}
