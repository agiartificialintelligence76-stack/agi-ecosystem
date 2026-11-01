// The front (2026-09-28, the owner: "make the landing page like on the old site … just make it in front"): the bright AGI
// landing of the page agi1.app used to show, first on the home page, with the rest of the site below it. Ported from that page and
// made to fit here: no outside scripts (the page's security rules allow only our own), no smooth-scroll library (the rest
// of the site scrolls normally), links to this site's own sections, and everything named lp-*.
//   · the loader: first visit of a browser session only (/theme.js arms it before the page paints: .lp-loading)
//   · the entrance: a visit that starts at the top of the page (.lp-intro), played when this adds .lp-go
//   · the hero: halftone focus lines, AGI-1 drawn in WebGL (a halftone reveal, a little depth when the pointer moves,
//     two print-like echoes), her world in orbit around her, her speech bubble, the big letters' parallax
//   · the ribbons (faster while you scroll) and the manifesto (pinned while "General" gets crossed out)
//   · with a mouse: a cursor with labels, magnetic buttons and hearts where you click, only over the front
// "Reduce motion": no loader, no entrance, nothing moves on its own, and the manifesto shows its end.
import { BUBBLE_LINES, REACTIONS } from './lines.js';          // what she says in her bubble
import { copyButton } from '../lib/copy.js';                  // (the contract address's Copy button, 2026-09-29)
import { TOKENS } from '../prices/parse.js';

const d = document, w = window, root = d.documentElement;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const $ = (s, r = d) => r.querySelector(s);
const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
const safe = (name, fn) => { try { return fn(); } catch (err) { console.warn(`[landing] ${name} skipped:`, err); return null; } };
const mulberry32 = (a) => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const SEEN = 'agi-seen';                       // sessionStorage: the loader already played in this browser session
const DEPTH = '/images/landing/agi1-depth.webp';


export function startLanding(hero = $('[data-lp-hero]')) {
  if (!hero) return null;
  const RM = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = w.matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.classList.add('lp-live');                              // /theme.js's safety net stands down: this script runs the front
  // "reduce motion": no loader and no entrance. And if /theme.js's safety net already showed the page (this script came very
  // late), the entrance has had its moment
  if (RM || root.classList.contains('lp-go')) root.classList.remove('lp-intro');
  if (RM) root.classList.remove('lp-loading');
  // the official contract address, one tap to copy it (2026-09-29, the owner: "contract address needs to be copy pasted on
  // landing page right away"): the whole address from one place in the code, whatever the page shows of it
  safe('contract address', () => copyButton($('[data-lp-copy]', hero), { text: TOKENS[0].ca, select: $('[data-lp-ca-addr]', hero), say: $('[data-lp-copied]', hero) }));
  const ribbons = $('[data-lp-ribbons]'), mani = $('[data-lp-mani]');
  const regions = [hero, ribbons, mani].filter(Boolean);
  let vw = w.innerWidth, vh = w.innerHeight;
  const mouse = { x: vw / 2, y: vh / 2, nx: 0, ny: 0, moved: false };
  w.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = e.clientX / vw * 2 - 1; mouse.ny = e.clientY / vh * 2 - 1;
    mouse.moved = true;
  }, { passive: true });

  // ---------- one frame loop, only while some of the front is on screen ----------
  const seen = new Map();
  const tickers = new Set();
  const onTick = (fn) => { tickers.add(fn); return () => tickers.delete(fn); };
  const isVis = (el) => seen.get(el) !== false && !d.hidden;
  let raf = 0, lastT = performance.now();
  const frame = () => {
    raf = 0;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    for (const fn of tickers) { try { fn(dt, now / 1000); } catch (err) { tickers.delete(fn); console.warn('[landing] ticker removed:', err); } }
    if (regions.some(isVis) || busy > 0) raf = w.requestAnimationFrame(frame);
  };
  let busy = 0;                                            // things that must keep running off screen (a loader, an intro)
  const wake = () => { if (!raf && !d.hidden) { lastT = performance.now(); raf = w.requestAnimationFrame(frame); } };
  if ('IntersectionObserver' in w) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        seen.set(e.target, e.isIntersecting);
        e.target.classList.toggle('lp-off', !e.isIntersecting);   // its CSS loops (the heartbeat) pause off screen too
      }
      if (regions.some(isVis)) wake();
    }, { rootMargin: '120px 0px' });
    regions.forEach((el) => io.observe(el));
  }
  d.addEventListener('visibilitychange', () => { if (!d.hidden) wake(); });

  // scroll speed (the ribbons and the orbit speed up while you scroll)
  let lastScroll = w.scrollY, scrollVel = 0;
  onTick((dt) => {
    const y = w.scrollY;
    scrollVel = damp(scrollVel, clamp((y - lastScroll) / Math.max(dt, 1 / 240), -6000, 6000), 9, dt);
    lastScroll = y;
  });

  // ---------- the hero: focus lines + halftone, drawn once per resize ----------
  const figure = $('[data-lp-figure]', hero), stage = $('[data-lp-stage]', hero);
  const fx = d.createElement('canvas');
  fx.className = 'lp-fx'; fx.setAttribute('aria-hidden', 'true');
  hero.prepend(fx);
  function drawFx() {
    const r = hero.getBoundingClientRect();
    const dpr = Math.min(2, w.devicePixelRatio || 1);
    fx.width = Math.round(r.width * dpr); fx.height = Math.round(r.height * dpr);
    const ctx = fx.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    const fr = figure.getBoundingClientRect();
    const cx = fr.left - r.left + fr.width / 2;
    const cy = fr.top - r.top + fr.height * 0.14;
    fx.style.setProperty('--ox', `${cx}px`); fx.style.setProperty('--oy', `${cy}px`);
    const R = Math.hypot(r.width, r.height) * 1.1;
    const rnd = mulberry32(11);
    const n = r.width < 700 ? 150 : 260;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, wd = 0.0025 + rnd() * 0.011, inner = R * (0.19 + rnd() * 0.24);
      ctx.fillStyle = `rgba(255,255,255,${(0.045 + rnd() * 0.085).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R);
      ctx.lineTo(cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R);
      ctx.closePath(); ctx.fill();
    }
    const step = r.width < 700 ? 11 : 14;
    const big = Math.max(r.width, r.height), narrow = r.width < 700;
    for (const c of [
      { x: 0, y: r.height, rad: big * (narrow ? 0.4 : 0.52), col: 'rgba(255,77,166,.62)' },
      { x: r.width, y: 0, rad: big * (narrow ? 0.22 : 0.34), col: 'rgba(63,240,195,.5)' },
    ]) {
      ctx.fillStyle = c.col;
      for (let y = step / 2; y < r.height; y += step) {
        for (let x = step / 2; x < r.width; x += step) {
          const dd = Math.hypot(x - c.x, y - c.y) / c.rad;
          if (dd >= 1) continue;
          const rr = (1 - dd) * step * 0.5;
          if (rr < 0.6) continue;
          ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.fill();
        }
      }
    }
  }

  // ---------- the hero: AGI-1 in WebGL (halftone reveal, print echoes, a little depth) ----------
  const img = $('[data-lp-img]', hero);
  let glfig = null, revealWanted = null;
  function initFigureGL(image, depthImg) {
    const canvas = d.createElement('canvas');
    canvas.className = 'lp-figure-gl'; canvas.setAttribute('aria-hidden', 'true');
    image.after(canvas);
    let gl = null;
    try { gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }); } catch { gl = null; }
    if (!gl) { canvas.remove(); return null; }
    const vsSrc = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
    const fsSrc = [
      'precision mediump float;',
      'varying vec2 vUv;',
      'uniform sampler2D uTex;uniform sampler2D uDepth;',
      'uniform vec4 uRect;uniform vec2 uCanvas;uniform vec2 uMouse;',
      'uniform vec2 uEchoA;uniform vec2 uEchoB;uniform vec3 uColA;uniform vec3 uColB;',
      'uniform float uEchoAmt;uniform float uReveal;uniform float uTime;uniform float uHover;uniform float uCell;uniform float uHasDepth;',
      'float inb(vec2 u){return step(0.,u.x)*step(0.,u.y)*step(u.x,1.)*step(u.y,1.);}',
      'vec4 img(vec2 u){return texture2D(uTex,clamp(u,0.,1.))*inb(u);}',
      'float h21(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}',
      'void main(){',
      '  vec2 uv=(vUv-uRect.xy)/uRect.zw;',
      '  uv.y/=1.+.0035*sin(uTime*1.9);',
      '  float dep=mix(.6,texture2D(uDepth,clamp(uv,0.,1.)).r,uHasDepth);',
      '  vec2 uvp=uv-uMouse*(dep-.35)*vec2(.014,.009);',
      '  vec4 base=img(uvp);',
      '  float ca=.0045*uHover;',
      '  if(ca>.0001){vec4 r=img(uvp+vec2(ca,0.));vec4 b=img(uvp-vec2(ca,0.));base=vec4(r.r,base.g,b.b,max(base.a,max(r.a,b.a)));}',
      '  if(uReveal<.999){',
      '    vec2 px=vUv*uCanvas;vec2 cid=floor(px/uCell);vec2 cc=(cid+.5)*uCell;',
      '    vec2 cuv=(cc/uCanvas-uRect.xy)/uRect.zw;vec4 s=img(cuv);',
      '    float front=uReveal*1.45-.25;',
      '    float loc=clamp((front-(1.-cuv.y))/.2+(h21(cid)-.5)*.5,0.,1.);',
      '    float rad=uCell*.74*loc;float dist=length(px-cc);',
      '    float m=(1.-smoothstep(rad-1.,rad,dist))*step(.35,s.a);',
      '    vec3 sc=s.rgb/max(s.a,.001);vec3 dc=mix(sc,vec3(1.,.3,.65),.45*(1.-loc));',
      '    vec4 ht=vec4(dc*m,m);',
      '    float full=smoothstep(.7,1.,uReveal);',
      '    base=mix(ht,base,full);',
      '    float fy=1.-clamp(front,0.,1.);',
      '    float g=exp(-pow((uv.y-fy)*90.,2.))*(1.-full)*step(.02,uReveal)*img(vec2(uv.x,fy)).a;',
      '    base.a=max(base.a,g*.9);base.rgb=min(base.rgb+vec3(1.,.86,.4)*g*.9,vec3(base.a));',
      '  }',
      '  float ea=img(uv-uEchoA).a*uEchoAmt;float eb=img(uv-uEchoB).a*uEchoAmt;',
      '  vec4 col=vec4(uColB*eb,eb);',
      '  col=vec4(uColA*ea,ea)+col*(1.-ea);',
      '  gl_FragColor=base+col*(1.-base.a);',
      '}',
    ].join('\n');
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[landing]', gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, vsSrc), fs = sh(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) { canvas.remove(); return null; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return null; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    for (const n of ['uTex', 'uDepth', 'uRect', 'uCanvas', 'uMouse', 'uEchoA', 'uEchoB', 'uColA', 'uColB', 'uEchoAmt', 'uReveal', 'uTime', 'uHover', 'uCell', 'uHasDepth']) U[n] = gl.getUniformLocation(prog, n);
    // a power-of-two copy, for mipmaps (clean hair lines when she's drawn smaller)
    const pot = (source, wPx, hPx) => {
      const c = d.createElement('canvas'); c.width = wPx; c.height = hPx;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(source, 0, 0, wPx, hPx); return c;
    };
    const makeTex = (unit, source, mip) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    };
    makeTex(0, pot(image, 1024, 2048), true);
    makeTex(1, depthImg ? pot(depthImg, 256, 512) : pot(image, 4, 4), false);
    gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uDepth, 1);
    gl.uniform1f(U.uHasDepth, depthImg ? 1 : 0);
    gl.uniform3f(U.uColA, 1.0, 0.302, 0.651);          // pink echo
    gl.uniform3f(U.uColB, 1.0, 0.788, 0.2);            // honey echo
    gl.clearColor(0, 0, 0, 0);
    const st = { reveal: 0, revealFrom: 0, revealDur: 0, revealT0: -1, echoAmt: 0, hover: 0, hoverT: 0,
      mx: 0, my: 0, ea: { x: 0.009, y: -0.004 }, eb: { x: -0.011, y: -0.008 }, lost: false };
    function resize() {
      const cr = canvas.getBoundingClientRect(), ir = figure.getBoundingClientRect();
      if (!cr.width || !ir.width) return;
      const dpr = Math.min(w.devicePixelRatio || 1, vw < 760 ? 1.5 : 1.75);
      canvas.width = Math.round(cr.width * dpr); canvas.height = Math.round(cr.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform4f(U.uRect, (ir.left - cr.left) / cr.width, (cr.bottom - ir.bottom) / cr.height, ir.width / cr.width, ir.height / cr.height);
      gl.uniform2f(U.uCanvas, canvas.width, canvas.height);
      gl.uniform1f(U.uCell, Math.round((vw < 760 ? 7 : 9) * dpr));
    }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); st.lost = true; root.classList.remove('lp-gl'); });
    const reveal = (dur) => {
      if (dur <= 0.01) { st.reveal = 1; st.revealT0 = -1; return; }     // at once (no entrance, "reduce motion")
      st.revealFrom = st.reveal; st.revealDur = dur; st.revealT0 = performance.now() / 1000;
    };
    function render(dt, t) {
      if (st.lost) return;
      if (st.revealT0 >= 0) {
        const k = clamp((t - st.revealT0) / st.revealDur, 0, 1);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        st.reveal = lerp(st.revealFrom, 1, e);
        if (k >= 1) st.revealT0 = -1;
      }
      st.echoAmt = damp(st.echoAmt, st.reveal >= 0.98 ? 1 : 0, 3.2, dt);
      st.hover = damp(st.hover, st.hoverT, 6, dt);
      st.mx = damp(st.mx, FINE ? mouse.nx : Math.sin(t * 0.5) * 0.5, 3.5, dt);
      st.my = damp(st.my, FINE ? mouse.ny : Math.cos(t * 0.4) * 0.3, 3.5, dt);
      const ta = { x: 0.009 + st.mx * 0.011 + Math.sin(t * 0.8) * 0.0025, y: -0.004 - st.my * 0.008 + Math.cos(t * 0.9) * 0.002 };
      const tb = { x: -0.011 + st.mx * 0.019 + Math.cos(t * 0.6) * 0.003, y: -0.008 - st.my * 0.013 + Math.sin(t * 0.7) * 0.0025 };
      st.ea.x = damp(st.ea.x, ta.x, 5, dt); st.ea.y = damp(st.ea.y, ta.y, 5, dt);
      st.eb.x = damp(st.eb.x, tb.x, 2.4, dt); st.eb.y = damp(st.eb.y, tb.y, 2.4, dt);
      gl.uniform1f(U.uReveal, st.reveal);
      gl.uniform1f(U.uEchoAmt, st.echoAmt);
      gl.uniform1f(U.uHover, st.hover);
      gl.uniform1f(U.uTime, RM ? 0 : t);
      gl.uniform2f(U.uMouse, RM ? 0 : st.mx, RM ? 0 : -st.my);
      gl.uniform2f(U.uEchoA, RM ? 0.009 : st.ea.x, RM ? -0.004 : st.ea.y);
      gl.uniform2f(U.uEchoB, RM ? -0.011 : st.eb.x, RM ? -0.008 : st.eb.y);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    resize();
    return { resize, reveal, render, setHover: (v) => { st.hoverT = v; }, st };
  }
  const requestReveal = (dur) => { if (glfig) glfig.reveal(dur); else revealWanted = dur; };

  // ---------- the hero: her world in orbit around her ----------
  const planets = $$('.lp-planet', hero);
  const orbitBack = $('[data-lp-orbit="back"]', hero), orbitFront = $('[data-lp-orbit="front"]', hero);
  const O = { cx: 0, cy: 0, rx: 100, ry: 20, ct: 1, st: 0, angle: -0.35, speed: 0.16, r: 0, hover: 0, sw: 0, fw: 0, active: false, labelW: [] };
  function layoutOrbit() {
    const sr = stage.getBoundingClientRect(), fr = figure.getBoundingClientRect();
    O.sw = sr.width;
    O.cx = fr.left - sr.left + fr.width / 2;
    O.fw = fr.width;
    O.cy = fr.top - sr.top + fr.height * 0.372;
    O.rx = clamp(fr.width * 0.98, 140, sr.width * (vw < 760 ? 0.4 : 0.36));
    O.ry = O.rx * (vw < 760 ? 0.2 : 0.16);
    const tilt = -6 * Math.PI / 180;
    O.ct = Math.cos(tilt); O.st = Math.sin(tilt);
    O.labelW = planets.map((p) => ($('.lp-planet-name', p) || p).offsetWidth);
    O.labelH = planets.map((p) => ($('.lp-planet-name', p) || p).offsetHeight);
    O.ps = planets[0]?.offsetWidth || 46;
    const pt = (th) => {
      const ex = Math.cos(th) * O.rx, ey = Math.sin(th) * O.ry;
      return [O.cx + ex * O.ct - ey * O.st, O.cy + ex * O.st + ey * O.ct];
    };
    const arc = (a0, a1) => {
      let s = '';
      for (let i = 0; i <= 56; i++) { const [x, y] = pt(a0 + (a1 - a0) * i / 56); s += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
      return s;
    };
    for (const svg of [orbitBack, orbitFront]) if (svg) svg.setAttribute('viewBox', `0 0 ${sr.width.toFixed(0)} ${sr.height.toFixed(0)}`);
    orbitBack?.querySelector('path')?.setAttribute('d', arc(Math.PI, Math.PI * 2));
    orbitFront?.querySelector('path')?.setAttribute('d', arc(0, Math.PI));
    if (!O.active) {
      O.active = true;
      for (const p of planets) { p.style.left = '0px'; p.style.top = '0px'; }
    }
  }
  for (const p of planets) {
    const on = () => { O.hover++; }, off = () => { O.hover = Math.max(0, O.hover - 1); };
    p.addEventListener('pointerenter', on); p.addEventListener('pointerleave', off);
    p.addEventListener('focus', on); p.addEventListener('blur', off);
  }
  onTick((dt) => {
    if (!O.active || !isVis(hero)) return;
    const boost = clamp(Math.abs(scrollVel) * 0.0007, 0, 2.2);
    const target = O.hover || RM ? 0 : 0.16 + boost;
    O.speed = damp(O.speed, target, O.hover ? 10 : 3, dt);
    O.angle += O.speed * dt;
    const n = planets.length;
    const names = [];                                                    // where each planet's name is, this frame
    const orbs = [];
    planets.forEach((p, i) => {
      if (p.closest('[data-owner-hidden="true"], [hidden]')) return;
      const th = O.angle + i * Math.PI * 2 / n;
      const ex = Math.cos(th) * O.rx * O.r, ey = Math.sin(th) * O.ry * O.r;
      const x = O.cx + ex * O.ct - ey * O.st, y = O.cy + ex * O.st + ey * O.ct;
      const depth = Math.sin(th);
      const s = (0.72 + 0.34 * (depth + 1) / 2) * (0.4 + 0.6 * O.r);
      p.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(3)})`;
      p.style.zIndex = depth > 0 ? 8 : 2;
      const hidden = depth < 0.05 && Math.abs(x - O.cx) < O.fw * 0.34;         // behind her: not clickable through her
      if (!hidden) orbs.push({ p, x, y, radius: s * O.ps / 2 });
      if (p.lpHidden !== hidden) { p.lpHidden = hidden; p.style.pointerEvents = hidden ? 'none' : 'auto'; if (hidden && p.matches(':hover')) O.hover = Math.max(0, O.hover - 1); }
      p.style.opacity = (Math.min(1, O.r * 1.6) * (0.78 + 0.22 * (depth + 1) / 2)).toFixed(3);
      const lw = O.labelW[i] || 120, lh = O.labelH[i] || 28;
      let labelLeft = x < O.cx;
      if (labelLeft && x - lw - 36 < 0) labelLeft = false;
      if (!labelLeft && x + lw + 36 > O.sw) labelLeft = true;
      if (p.lpLeft !== labelLeft) { p.lpLeft = labelLeft; p.classList.toggle('is-left', labelLeft); }
      const near = s * (O.ps / 2 + 10), far = s * (O.ps / 2 + 10 + lw);
      names.push({ p, depth, x0: labelLeft ? x - far : x + near, x1: labelLeft ? x - near : x + far, y0: y - s * lh / 2, y1: y + s * lh / 2 });
    });
    // Names never pile up: a name that would cover another orb or a nearer name stays hidden; and where the orbit is
    // narrow (phones), only the front planets' names show at all
    names.sort((a, b) => b.depth - a.depth);
    const shown = [];
    for (const nm of names) {
      const quiet = (O.sw < 700 && nm.depth < -0.15)
        || orbs.some((orb) => {
          if (orb.p === nm.p) return false;
          const dx = orb.x - clamp(orb.x, nm.x0, nm.x1), dy = orb.y - clamp(orb.y, nm.y0, nm.y1);
          return dx * dx + dy * dy < (orb.radius + 4) ** 2;
        })
        || shown.some((o) => nm.x0 < o.x1 + 6 && nm.x1 > o.x0 - 6 && nm.y0 < o.y1 + 4 && nm.y1 > o.y0 - 4);
      if (!quiet) shown.push(nm);
      if (nm.p.lpQuiet !== quiet) { nm.p.lpQuiet = quiet; nm.p.classList.toggle('is-quiet', quiet); }
    }
  });
  function orbitIntro(dur) {
    if (RM || !dur) { O.r = 1; return; }
    const t0 = performance.now() / 1000;
    busy++;
    const off = onTick((dt, t) => {
      const k = clamp((t - t0) / dur, 0, 1);
      const c1 = 1.70158 * 1.4, c3 = c1 + 1;                   // a little overshoot, then it settles
      O.r = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
      if (k >= 1) { O.r = 1; off(); busy--; }
    });
    wake();
  }

  // ---------- the hero: the letters' parallax, her hover, her bubble ----------
  const wordMain = $('.lp-word-main', hero), wordEcho = $('.lp-word-echo', hero);
  const hm = { x: 0, y: 0 };
  let cursorAPI = null;
  onTick((dt) => {
    if (!isVis(hero)) return;
    hm.x = damp(hm.x, RM ? 0 : mouse.nx, 3.2, dt);
    hm.y = damp(hm.y, RM ? 0 : mouse.ny, 3.2, dt);
    const heroTop = hero.getBoundingClientRect().top;
    const sy = RM ? 0 : clamp(-heroTop, 0, vh) * 0.22;
    if (wordMain) wordMain.style.transform = `translate3d(${(-hm.x * 16).toFixed(2)}px,${(-hm.y * 10 + sy).toFixed(2)}px,0)`;
    if (wordEcho) wordEcho.style.transform = `translate3d(${(-hm.x * 30).toFixed(2)}px,${(-hm.y * 18 + sy * 1.08).toFixed(2)}px,0)`;
    if (glfig) {
      const fr = figure.getBoundingClientRect();
      const over = FINE && mouse.moved && mouse.x > fr.left + fr.width * 0.15 && mouse.x < fr.right - fr.width * 0.15 && mouse.y > fr.top && mouse.y < fr.bottom;
      glfig.setHover(over ? 1 : 0);
      cursorAPI?.setAuto(over ? 'hi 💜' : null);
    }
  });
  onTick((dt, t) => { if (glfig && isVis(hero)) glfig.render(dt, t); });

  const bubble = $('[data-lp-bubble]', hero), bubbleText = $('[data-lp-bubble-text]', hero);
  let bubbleI = 0, lastSay = 0, sayT = 0, reactI = 0;
  function say(text, typingMs) {
    if (!bubble || !bubbleText) return;
    lastSay = performance.now();
    w.clearTimeout(sayT);
    bubble.classList.add('is-typing');
    sayT = w.setTimeout(() => { bubbleText.textContent = text; bubble.classList.remove('is-typing'); }, RM ? 0 : typingMs);
  }
  function startBubble() {
    if (!bubble || RM) return;
    w.setInterval(() => {
      if (!isVis(hero) || d.hidden || performance.now() - lastSay < 4500) return;
      bubbleI = (bubbleI + 1) % BUBBLE_LINES.length;
      say(BUBBLE_LINES[bubbleI], 1100);
    }, 5600);
  }
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a,button')) return;
    const fr = figure.getBoundingClientRect();
    if (e.clientX > fr.left + fr.width * 0.15 && e.clientX < fr.right - fr.width * 0.15 && e.clientY > fr.top && e.clientY < fr.bottom) {
      say(REACTIONS[reactI++ % REACTIONS.length], 420);
    }
  });

  // ---------- the loader (first visit of a browser session), then the entrance ----------
  function runLoader(ready) {
    const el = $('[data-lp-loader]');
    try { w.sessionStorage.setItem(SEEN, '1'); } catch { /* private mode: it may play again, that's all */ }
    if (!el || !root.classList.contains('lp-loading')) return Promise.resolve();
    const num = $('[data-lp-count]', el), bar = $('[data-lp-bar]', el);
    const dur = 2100;
    let speed = 1, shown = 0, last = performance.now(), done = false;
    const hurry = () => { speed = 4; };
    el.addEventListener('click', hurry, { once: true });
    d.addEventListener('keydown', hurry, { once: true });           // the keyboard can skip it too
    busy++;
    return new Promise((resolve) => {
      const finish = () => {
        if (done) return;
        done = true; busy--;
        resolve();
        el.classList.add('is-leaving');
        w.setTimeout(() => { root.classList.remove('lp-loading'); el.classList.remove('is-leaving'); }, 1000);
      };
      // never stuck on the loader: gone about 7 s after the page was asked for (a slow connection has already waited), but
      // always long enough to count to 100
      w.setTimeout(finish, Math.max(2600, 7000 - performance.now()));
      const step = () => {
        if (done) return;
        const now = performance.now();
        shown = Math.min(dur, shown + (now - last) * speed);
        last = now;
        const k = shown / dur, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        if (num) num.textContent = String(Math.round(e * 100));
        if (bar) bar.style.transform = `scaleX(${e})`;
        if (k < 1) w.requestAnimationFrame(step);
        else ready.then(() => w.setTimeout(finish, 120));
      };
      w.requestAnimationFrame(step);
    });
  }
  // agi:landing-ready: the entrance is over (src/main.js starts the 3D stage then, so her entrance never stutters)
  const ready = (ms) => w.setTimeout(() => w.dispatchEvent(new Event('agi:landing-ready')), ms);
  function heroIntro() {
    startBubble();
    const playing = root.classList.contains('lp-intro') && !RM;
    root.classList.add('lp-go');
    if (!playing) { requestReveal(0.001); orbitIntro(0); ready(0); return; }
    w.setTimeout(() => requestReveal(1.9), 150);
    w.setTimeout(() => orbitIntro(1.5), 950);
    busy++;
    w.setTimeout(() => { busy--; }, 2600);                       // keep drawing through the entrance, even off screen
    ready(2600);
    wake();
  }

  // ---------- the ribbons: a marquee that speeds up with the scroll ----------
  const tracks = $$('.lp-ribbon-track').map((el) => ({ el, dir: Number(el.dataset.dir) || 1, unit: el.innerHTML, x: 0, gw: 1, mult: 1 }));
  function setupRibbons() {
    for (const tr of tracks) {
      tr.el.innerHTML = tr.unit;
      const unitW = Math.max(1, tr.el.scrollWidth);
      const k = Math.max(1, Math.ceil((vw * 1.3) / unitW));
      const group = tr.unit.repeat(k);
      tr.el.innerHTML = group + group;
      tr.gw = Math.max(1, tr.el.scrollWidth / 2);
      tr.x = tr.dir < 0 ? 0 : -tr.gw;
      tr.el.style.transform = `translate3d(${tr.x.toFixed(2)}px,0,0)`;
    }
  }
  onTick((dt) => {
    if (!ribbons || !isVis(ribbons) || RM) return;
    const boost = 1 + Math.min(Math.abs(scrollVel) / 420, 6);
    const sign = scrollVel < -40 ? -1 : 1;
    for (const tr of tracks) {
      tr.mult = damp(tr.mult, sign * boost, 5, dt);
      tr.x += tr.dir * 70 * tr.mult * dt;
      if (tr.x <= -tr.gw) tr.x += tr.gw;
      if (tr.x > 0) tr.x -= tr.gw;
      tr.el.style.transform = `translate3d(${tr.x.toFixed(2)}px,0,0)`;
    }
  });

  // ---------- the manifesto: "General" crossed out, "Girlfriend" written in, as you scroll ----------
  const ease3 = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const backOut = (k) => { const c1 = 1.70158 * 1.3, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  const span = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  let maniP = -1;
  function paintManifesto(p) {
    if (!mani || Math.abs(p - maniP) < 0.0005) return;
    maniP = p;
    const strike = ease3(span(p, 0.06, 0.42));
    const girl = backOut(span(p, 0.44, 0.7)), girlIn = span(p, 0.44, 0.56);
    const capA = span(p, 0.28, 0.42), capB = span(p, 0.56, 0.72);
    const s = mani.style;
    s.setProperty('--strike', (1.05 * (1 - strike)).toFixed(4));
    s.setProperty('--gen', (1 - 0.7 * span(p, 0.24, 0.42)).toFixed(3));
    s.setProperty('--girl-o', girlIn.toFixed(3));
    s.setProperty('--girl-y', `${(-50 * (1 - girl)).toFixed(2)}%`);
    s.setProperty('--girl-s', (0.4 + 0.6 * girl).toFixed(3));
    s.setProperty('--girl-r', `${(-26 + 19 * girl).toFixed(2)}deg`);
    s.setProperty('--cap-a', (1 - capA).toFixed(3));
    s.setProperty('--cap-a-y', `${(-18 * capA).toFixed(1)}px`);
    s.setProperty('--cap-b', capB.toFixed(3));
    s.setProperty('--cap-b-y', `${(18 * (1 - capB)).toFixed(1)}px`);
  }
  if (mani && !RM) {
    paintManifesto(0);
    onTick(() => {
      if (!isVis(mani)) return;
      const r = mani.getBoundingClientRect();
      paintManifesto(clamp(-r.top / Math.max(1, r.height - vh), 0, 1));
    });
  }

  // ---------- reveals (armed when off screen, so the page is complete at rest) ----------
  function setupReveals() {
    if (RM || !('IntersectionObserver' in w)) return;
    const els = $$('.lp [data-lp-reveal]');
    const inIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        inIO.unobserve(e.target); armIO.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    const armIO = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && !e.target.classList.contains('is-in') && e.boundingClientRect.top > vh * 0.98) e.target.classList.add('is-armed');
    }, { rootMargin: '0px 0px 70% 0px' });
    for (const el of els) { armIO.observe(el); inIO.observe(el); }
  }

  // ---------- a mouse: the cursor, magnetic buttons, hearts (only over the front) ----------
  function setupCursor() {
    if (!FINE || RM) return;
    const cur = d.createElement('div');
    cur.className = 'lp-cursor'; cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<div class="lp-cursor-ring"></div><div class="lp-cursor-dot"></div><div class="lp-cursor-label"></div>';
    d.body.append(cur);
    const dot = $('.lp-cursor-dot', cur), ring = $('.lp-cursor-ring', cur), label = $('.lp-cursor-label', cur);
    let rx = mouse.x, ry = mouse.y, lx = mouse.x, ly = mouse.y, current = null, auto = null, on = false;
    const setOn = (v) => { if (v !== on) { on = v; root.classList.toggle('lp-cursor-on', v); if (v) wake(); } };
    onTick((dt) => {
      if (!on) return;
      rx = damp(rx, mouse.x, 18, dt); ry = damp(ry, mouse.y, 18, dt);
      lx = damp(lx, mouse.x, 12, dt); ly = damp(ly, mouse.y, 12, dt);
      dot.style.transform = `translate3d(${mouse.x}px,${mouse.y}px,0)`;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
      label.style.transform = `translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0) translate(-50%,-50%)`;
    });
    const paint = () => {
      if (current) {
        label.textContent = current.dataset.cursor;
        cur.style.setProperty('--cc', current.dataset.cursorColor || '#170a36');
        cur.style.setProperty('--ct', current.dataset.cursorText || '#ffffff');
        cur.classList.add('has-label');
      } else if (auto) {
        label.textContent = auto;
        cur.style.setProperty('--cc', '#ff4da6');
        cur.style.setProperty('--ct', '#170a36');
        cur.classList.add('has-label');
      } else cur.classList.remove('has-label');
    };
    d.addEventListener('pointerover', (e) => {
      setOn(!!e.target.closest?.('.lp') && e.pointerType === 'mouse');
      const t = e.target.closest?.('.lp [data-cursor]') || null;
      if (t !== current) { current = t; paint(); }
    });
    cursorAPI = { setAuto(text) { if (text !== auto) { auto = text; paint(); } } };
    d.addEventListener('pointerdown', () => cur.classList.add('is-down'));
    d.addEventListener('pointerup', () => cur.classList.remove('is-down'));
    root.addEventListener('mouseleave', () => setOn(false));
  }
  function setupMagnetic() {
    if (!FINE || RM) return;
    for (const el of $$('.lp [data-magnetic]')) {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.4).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = '0 0'; });
    }
  }
  function setupHearts() {
    if (RM || !Element.prototype.animate) return;
    const cols = ['#ff4da6', '#ffc933', '#3ff0c3', '#8b66ff', '#ffffff'];
    d.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.target.closest?.('.lp') || e.target.closest('a,button,input,textarea,select,label')) return;
      const x = e.clientX, y = e.clientY;
      for (let i = 0; i < 7; i++) {
        const s = d.createElement('span');
        s.className = 'lp-heart';
        s.innerHTML = `<svg viewBox="0 0 24 22"><use href="#lp-heart" fill="${cols[i % cols.length]}" stroke="#170a36" stroke-width="1.8"/></svg>`;
        d.body.appendChild(s);
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, dist = 48 + Math.random() * 80, sc = 0.6 + Math.random() * 0.7, rot = (Math.random() - 0.5) * 100;
        const tx = x + Math.cos(a) * dist, ty = y + Math.sin(a) * dist;
        const anim = s.animate([
          { transform: `translate(${x}px,${y}px) scale(.2)`, opacity: 1 },
          { transform: `translate(${tx}px,${ty}px) scale(${sc}) rotate(${rot}deg)`, opacity: 1, offset: 0.65 },
          { transform: `translate(${tx}px,${ty + 26}px) scale(${sc * 0.7}) rotate(${rot * 1.4}deg)`, opacity: 0 },
        ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.16,1,.3,1)' });
        anim.onfinish = () => s.remove();
      }
    });
  }

  // ---------- start ----------
  function layoutAll() {
    vw = w.innerWidth; vh = w.innerHeight;
    safe('fx', drawFx);
    safe('orbit', layoutOrbit);
    if (glfig) safe('gl resize', glfig.resize);
    safe('ribbons', setupRibbons);
    maniP = -1;
  }
  safe('reveals', setupReveals);
  safe('cursor', setupCursor);
  safe('magnetic', setupMagnetic);
  safe('hearts', setupHearts);
  layoutAll();

  const loadImg = (src) => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = src; });
  const glReady = Promise.all([
    img?.decode ? img.decode().catch(() => null) : Promise.resolve(null),
    loadImg(DEPTH).catch(() => null),
  ]).then(([, depth]) => {
    glfig = img && img.naturalWidth ? safe('webgl', () => initFigureGL(img, depth)) : null;
    if (glfig) {
      // the canvas takes over from her picture: shown (lp-gl), sized, and drawn once right away, all before the browser
      // paints again, so she never blinks out between the two
      root.classList.add('lp-gl');
      glfig.resize();
      if (revealWanted !== null) { glfig.reveal(revealWanted); revealWanted = null; }
      safe('gl first frame', () => glfig.render(0, performance.now() / 1000));
      wake();
    }
  });
  const glReadySoon = Promise.race([glReady, new Promise((ok) => w.setTimeout(ok, 1800))]);
  runLoader(glReadySoon).then(() => (root.classList.contains('lp-intro') ? Promise.race([glReady, new Promise((ok) => w.setTimeout(ok, 700))]) : null))
    .then(() => safe('intro', heroIntro));
  w.setTimeout(() => { if (glfig && glfig.st.reveal === 0 && glfig.st.revealT0 < 0) glfig.reveal(1); }, 6500);

  let rT = 0;
  w.addEventListener('resize', () => { w.clearTimeout(rT); rT = w.setTimeout(layoutAll, 140); });
  d.fonts?.ready?.then(layoutAll);
  w.addEventListener('load', layoutAll);
  wake();
  return { layoutAll };
}
