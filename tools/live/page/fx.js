// AGI-1's live show (2026-10-07, the owner: "more effects on the stream so its not bland", "says emoji"): what pops up on
// her set besides her: the emojis she says floating up by her, little stickers ("!", "?", "♪", "haha"), sparkles,
// confetti, an alert banner (a new $AGI buy, a new post), the karaoke line while she sings, the TV her videos play on, and
// the comic wipe between her rooms. Plain elements with CSS animations, and one canvas for confetti only while it falls:
// cheap to draw on a server without a graphics card.
// Nothing here is plain and opaque over her picture (stage.js says why: the server's software compositing misplaces what an
// opaque box covers of a WebGL canvas): the boxes are 1% see-through, and the video too (opacity 0.99).
const EMOJI = /(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)/gu;
// the emojis in a line, each once, at most 3 (her captions show them; her voice never says them)
export function emojisIn(text) {
  const out = [];
  for (const m of String(text || '').matchAll(EMOJI)) if (!out.includes(m[0])) out.push(m[0]);
  return out.slice(0, 3);
}

export function createFx({ set, layer, confetti, alertEl, karaokeEl, tvEl, wipeEl, clock = () => Date.now() }) {
  const pops = new Set();
  // a floating thing: text (an emoji or a sticker's words) at x, y (set pixels), its class, for `ms`
  function pop(textOrEl, x, y, cls, ms = 2200, vars = {}) {
    const el = document.createElement('span');
    el.className = `pop ${cls}`;
    if (typeof textOrEl === 'string') el.textContent = textOrEl; else el.append(textOrEl);
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
    layer.append(el);
    pops.add(el);
    setTimeout(() => { el.remove(); pops.delete(el); }, ms);
    return el;
  }
  // the emojis she says, rising by her head (a little spread, one after the other)
  function emoji(list, at) {
    (Array.isArray(list) ? list : emojisIn(list)).slice(0, 3).forEach((e, i) => {
      setTimeout(() => pop(e, at.x + i * 64 + (Math.random() - 0.5) * 30, at.y + (Math.random() - 0.5) * 40, 'emoji', 2600,
        { '--dx': `${Math.round((Math.random() - 0.5) * 80)}px`, '--rot': `${Math.round((Math.random() - 0.5) * 30)}deg` }), i * 260);
    });
  }
  // a comic sticker: "!" (surprised), "?" (thinking), "haha" (laughing), "♪" (dancing), "clap clap"
  const STICKERS = { surprise: ['!', 'st-bang'], think: ['?', 'st-q'], laugh: ['haha', 'st-ha'], note: ['♪', 'st-note'], clap: ['clap clap', 'st-clap'], wow: ['wow', 'st-wow'], yay: ['yay!', 'st-ha'],
    // (2026-10-07) her emotions and her snacks
    hmph: ['hmph!', 'st-bang'], hehe: ['hehe', 'st-ha'], dots: ['...', 'st-q'], mmm: ['mmm~', 'st-note'], nom: ['nom', 'st-ha'], bang: ['!!', 'st-bang'] };
  function sticker(kind, at) {
    const [txt, cls] = STICKERS[kind] || STICKERS.wow;
    pop(txt, at.x, at.y, `sticker ${cls}`, 1800);
  }
  function sparkle(at, n = 7) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, r = 60 + Math.random() * 90;
      pop('✦', at.x, at.y, `sparkle s${i % 3}`, 1100, { '--dx': `${Math.round(Math.cos(a) * r)}px`, '--dy': `${Math.round(Math.sin(a) * r)}px`, '--delay': `${i * 40}ms` });
    }
  }

  // ---------- confetti: drawn only while it falls ----------
  const bits = [];
  let confettiUntil = 0;
  const COLORS = ['#ff4da6', '#ffc933', '#3ff0c3', '#6b3bff', '#ffffff', '#e4d9ff'];
  function burst(seconds = 3.5, { from = 'top', count = 140 } = {}) {
    for (let i = 0; i < count; i++) {
      bits.push({
        x: from === 'top' ? Math.random() * 1280 : 640 + (Math.random() - 0.5) * 200, y: from === 'top' ? -20 - Math.random() * 300 : 640,
        vx: (Math.random() - 0.5) * (from === 'top' ? 80 : 700), vy: from === 'top' ? 140 + Math.random() * 160 : -500 - Math.random() * 450,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 10, w: 8 + Math.random() * 10, h: 5 + Math.random() * 6,
        c: COLORS[i % COLORS.length], born: performance.now() + Math.random() * 600,
      });
    }
    confettiUntil = Math.max(confettiUntil, performance.now() + seconds * 1000);
    confetti.hidden = false;
  }
  function confettiFrame(dt) {
    if (confetti.hidden) return;
    const g = confetti.getContext('2d');
    g.clearRect(0, 0, 1280, 720);
    const t = performance.now();
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      if (t < b.born) continue;
      b.vy += 260 * dt; b.vx *= 0.99; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
      if (b.y > 760) { bits.splice(i, 1); continue; }
      g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 1.7))); g.restore();
    }
    if (!bits.length && t > confettiUntil) { g.clearRect(0, 0, 1280, 720); confetti.hidden = true; }
  }

  // ---------- the alert banner: { icon, title, sub, kind: 'buy' | 'post' | 'info', seconds } ----------
  let alertTimer = null;
  function alert(a) {
    clearTimeout(alertTimer);
    if (!a) { alertEl.hidden = true; return true; }
    alertEl.dataset.kind = a.kind || 'info';
    alertEl.querySelector('[data-alert-icon]').textContent = a.icon || '💜';
    alertEl.querySelector('[data-alert-title]').textContent = a.title || '';
    alertEl.querySelector('[data-alert-sub]').textContent = a.sub || '';
    alertEl.hidden = true;
    void alertEl.offsetWidth;
    alertEl.hidden = false;
    alertTimer = setTimeout(() => { alertEl.hidden = true; }, Math.max(2, Math.min(15, Number(a.seconds) || 7)) * 1000);
    return true;
  }

  // ---------- karaoke: her song's hook lines, each word lit as she sings it ----------
  let kara = null;
  const karaLine = karaokeEl.querySelector('[data-karaoke-line]');
  function karaoke(k) {
    if (!k) { kara = null; karaokeEl.hidden = true; return true; }
    kara = { startAt: Number(k.startAt), lines: Array.isArray(k.lines) ? k.lines : [], at: -1, word: -1 };
    return true;
  }
  function karaokeFrame(now) {
    if (!kara) return;
    const s = (now - kara.startAt) / 1000;
    const at = kara.lines.findIndex((l) => s >= l.from && s < l.to);
    if (at !== kara.at) {
      kara.at = at; kara.word = -1;
      if (at < 0) { karaokeEl.hidden = true; return; }
      const l = kara.lines[at];
      karaLine.replaceChildren(...l.words.map((w) => { const sp = document.createElement('span'); sp.textContent = w.w; return sp; }));
      karaokeEl.dataset.big = /^[A-Z!·?' -]+$/.test(l.text) ? '1' : '0';
      karaokeEl.hidden = true; void karaokeEl.offsetWidth; karaokeEl.hidden = false;
    }
    if (at < 0) return;
    const words = kara.lines[at].words;
    let k = -1;
    for (let i = 0; i < words.length; i++) if (s >= words[i].t) k = i;
    if (k !== kara.word) { kara.word = k; [...karaLine.children].forEach((sp, i) => sp.classList.toggle('sung', i <= k)); }
  }

  // ---------- her TV: a video playing in step with its sound (the runner plays the sound), or a picture ----------
  // { src: a video (/media/…webm), startAt (ms: when its sound starts being heard), seconds, label } or { img: a picture
  // (/media/…jpg, from one of her X posts), seconds, label } or null
  const video = tvEl.querySelector('video');
  const img = tvEl.querySelector('[data-tv-img]');
  const tvLabel = tvEl.querySelector('[data-tv-label]');
  let tv = null;
  function tvShow(v) {
    if (!v) {
      tv = null; video.pause(); video.removeAttribute('src'); video.load(); tvEl.hidden = true;
      if (img) { img.hidden = true; img.removeAttribute('src'); }
      return true;
    }
    tvLabel.textContent = v.label || '';
    if (v.img && img) {
      tv = { startAt: Number(v.startAt) || clock(), seconds: Number(v.seconds) || 8, picture: true };
      video.pause(); video.removeAttribute('src'); video.hidden = true;
      img.src = v.img; img.hidden = false;
      tvEl.hidden = false;
      return true;
    }
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    video.hidden = false;
    tv = { startAt: Number(v.startAt), seconds: Number(v.seconds) || 0, playing: false, lastFix: 0 };
    video.src = v.src;
    video.muted = true;
    video.preload = 'auto';
    video.currentTime = 0;
    tvEl.hidden = false;
    return true;
  }
  function tvFrame(now) {
    if (!tv) return;
    const s = (now - tv.startAt) / 1000;
    if (s < 0) return;
    if (tv.seconds && s > tv.seconds + 0.5) { tvShow(null); return; }
    if (tv.picture) return;
    if (!tv.playing) { tv.playing = true; video.currentTime = Math.max(0, s); video.play().catch(() => {}); return; }
    // in step with its sound: a nudge when it drifts more than a fifth of a second (at most once a second)
    if (performance.now() - tv.lastFix > 1000 && Math.abs(video.currentTime - s) > 0.2 && video.readyState >= 2) {
      tv.lastFix = performance.now();
      video.currentTime = s;
    }
  }

  // ---------- the comic wipe between rooms: midway, it covers everything (then `mid` runs) ----------
  function wipe(mid) {
    return new Promise((done) => {
      wipeEl.classList.remove('go');
      void wipeEl.offsetWidth;
      wipeEl.classList.add('go');
      setTimeout(() => { try { mid?.(); } catch (err) { console.warn(err); } }, 430);
      setTimeout(() => { wipeEl.classList.remove('go'); done(true); }, 950);
    });
  }

  function frame(dt, now) {
    confettiFrame(dt);
    karaokeFrame(now);
    tvFrame(now);
  }
  return { emoji, sticker, sparkle, burst, alert, karaoke, tv: tvShow, wipe, frame, get popping() { return pops.size; } };
}
