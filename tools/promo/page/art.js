// AGI-1's launch video: the front's AGI-1 (the owner's 2D art, public/images/landing/agi1-cutout.webp) drawn the way the
// front draws her (src/landing/landing.js, initFigureGL): revealed in halftone dots with a light sweep, then two print
// echoes (pink and honey) that drift, a little depth from her depth map, and a breath. The same shader, driven by the
// video's clock instead of the visitor's mouse, so every frame is the same every time.
const VS = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const FS = [
  'precision mediump float;',
  'varying vec2 vUv;',
  'uniform sampler2D uTex;uniform sampler2D uDepth;',
  'uniform vec4 uRect;uniform vec2 uCanvas;uniform vec2 uMouse;',
  'uniform vec2 uEchoA;uniform vec2 uEchoB;uniform vec3 uColA;uniform vec3 uColB;',
  'uniform float uEchoAmt;uniform float uReveal;uniform float uTime;uniform float uHover;uniform float uCell;',
  'float inb(vec2 u){return step(0.,u.x)*step(0.,u.y)*step(u.x,1.)*step(u.y,1.);}',
  'vec4 img(vec2 u){return texture2D(uTex,clamp(u,0.,1.))*inb(u);}',
  'float h21(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}',
  'void main(){',
  '  vec2 uv=(vUv-uRect.xy)/uRect.zw;',
  '  uv.y/=1.+.0035*sin(uTime*1.9);',
  '  float dep=texture2D(uDepth,clamp(uv,0.,1.)).r;',
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

const loadImage = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error(`couldn't load ${src}`)); i.src = src; });

export async function createArt(ctx) {
  const [image, depth] = await Promise.all([loadImage('/images/landing/agi1-cutout.webp'), loadImage('/images/landing/agi1-depth.webp')]);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('no WebGL for her art');
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('her art shader did not link');
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uTex', 'uDepth', 'uRect', 'uCanvas', 'uMouse', 'uEchoA', 'uEchoB', 'uColA', 'uColB', 'uEchoAmt', 'uReveal', 'uTime', 'uHover', 'uCell']) U[n] = gl.getUniformLocation(prog, n);
  const pot = (source, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(source, 0, 0, w, h); return c; };
  const tex = (unit, source, mip) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  };
  tex(0, pot(image, 1024, 2048), true);
  tex(1, pot(depth, 256, 512), false);
  gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uDepth, 1);
  gl.uniform3f(U.uColA, 1.0, 0.302, 0.651);          // pink echo
  gl.uniform3f(U.uColB, 1.0, 0.788, 0.2);            // honey echo
  gl.clearColor(0, 0, 0, 0);

  const aspect = image.naturalWidth / image.naturalHeight;     // 796 / 1510
  // draws her in the box { x, y, h } (her full height; her width follows), with room around her for the echoes
  // o: { reveal 0..1, echo 0..1, hover 0..1, cell (dot size, px), mouse: { x, y } (-1..1), t }
  function draw(g, box, o = {}) {
    const { reveal = 1, echo = 1, hover = 0, cell = 11, t = 0 } = o;
    const w = box.h * aspect, h = box.h;
    const pad = { l: w * 0.16, r: w * 0.16, t: h * 0.04, b: h * 0.06 };
    const cw = w + pad.l + pad.r, ch = h + pad.t + pad.b;
    const sc = ctx.scale;
    const pw = Math.round(cw * sc), ph = Math.round(ch * sc);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    gl.viewport(0, 0, pw, ph);
    gl.uniform4f(U.uRect, pad.l / cw, pad.b / ch, w / cw, h / ch);
    gl.uniform2f(U.uCanvas, pw, ph);
    gl.uniform1f(U.uCell, Math.max(4, Math.round(cell * sc)));
    const mx = o.mouse?.x ?? Math.sin(t * 0.5) * 0.5, my = o.mouse?.y ?? Math.cos(t * 0.4) * 0.3;
    gl.uniform1f(U.uReveal, reveal);
    gl.uniform1f(U.uEchoAmt, echo);
    gl.uniform1f(U.uHover, hover);
    gl.uniform1f(U.uTime, t);
    gl.uniform2f(U.uMouse, mx, -my);
    gl.uniform2f(U.uEchoA, 0.009 + mx * 0.011 + Math.sin(t * 0.8) * 0.0025, -0.004 - my * 0.008 + Math.cos(t * 0.9) * 0.002);
    gl.uniform2f(U.uEchoB, -0.011 + mx * 0.019 + Math.cos(t * 0.6) * 0.003, -0.008 - my * 0.013 + Math.sin(t * 0.7) * 0.0025);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cv, box.x - pad.l, box.y - pad.t, cw, ch);
    g.restore();
    return { w, h };
  }
  return { draw, aspect, image };
}
