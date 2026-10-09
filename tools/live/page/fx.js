// AGI-1's live show (2026-10-07, the owner: "more effects on the stream so its not bland", "says emoji"): what pops up on
// her set besides her: the emojis she says floating up by her, little stickers ("!", "?", "♪", "haha"), sparkles,
// confetti, an alert banner (a new $AGI buy, a new post), her song's words while she sings, the TV her videos play on, and
// the comic wipe between her rooms. Plain elements with CSS animations, and one canvas for confetti only while it falls:
// cheap to draw on a server without a graphics card.
// (2026-10-09, the owner: "when she sings the full lyrics on the subtitle must shown with the full video on the live as
// well") her song's words are all of them now, line by line, each word lit as she sings it, the next line under it (only
// its hook before); and her song's music video, full screen behind her while she sings (songVideo), in step with the song.
// And (the owner: "can you also include on her watching the live trading chart of $AGI") $AGI's live chart on her TV
// (chart.js draws it).
// Nothing here is plain and opaque over her picture (stage.js says why: the server's software compositing misplaces what an
// opaque box covers of a WebGL canvas): the boxes are 1% see-through, and the video too (opacity 0.99).
const EMOJI = /(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)/gu;
// the emojis in a line, each once, at most 3 (her captions show them; her voice never says them)
export function emojisIn(text) {
  const out = [];
  for (const m of String(text || '').matchAll(EMOJI)) if (!out.includes(m[0])) out.push(m[0]);
  return out.slice(0, 3);
}

export function createFx({ set, layer, confetti, alertEl, lyricsEl, tvEl, wipeEl, songVideoEl, drawChart = null, clock = () => Date.now() }) {
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

  // ---------- her song's words: the line she's singing, each word lit as she sings it, and the next line under it ----------
  // { startAt (ms: when the part starts being heard), lines: [{ text, from, to, words: [{ w, t }] }] (seconds from its start) }
  let lyr = null;
  const lyrNow = lyricsEl.querySelector('[data-lyrics-now]'), lyrNext = lyricsEl.querySelector('[data-lyrics-next]');
  function lyrics(k) {
    if (!k) { lyr = null; lyricsEl.hidden = true; return true; }
    lyr = { startAt: Number(k.startAt), lines: Array.isArray(k.lines) ? k.lines : [], at: -2, word: -1 };
    return true;
  }
  function lyricsFrame(now) {
    if (!lyr) return;
    const s = (now - lyr.startAt) / 1000;
    const at = lyr.lines.findIndex((l) => s >= l.from && s < l.to);
    if (at !== lyr.at) {
      lyr.at = at; lyr.word = -1;
      if (at < 0) {
        // between lines: the next one waits there (when it's sung soon), else nothing
        const next = lyr.lines.find((l) => l.from > s && l.from - s < 4);
        if (!next) { lyricsEl.hidden = true; return; }
        lyrNow.replaceChildren();
        lyrNext.textContent = next.text;
        lyricsEl.hidden = false;
        return;
      }
      const l = lyr.lines[at];
      lyrNow.replaceChildren(...l.words.map((w) => { const sp = document.createElement('span'); sp.textContent = w.w; return sp; }));
      const next = lyr.lines[at + 1];
      lyrNext.textContent = next && next.from - l.to < 4 ? next.text : '';
      if (lyricsEl.hidden) { lyricsEl.hidden = false; }
      lyrNow.classList.remove('in'); void lyrNow.offsetWidth; lyrNow.classList.add('in');
    }
    if (at < 0) return;
    const words = lyr.lines[at].words;
    let k = -1;
    for (let i = 0; i < words.length; i++) if (s >= words[i].t) k = i;
    if (k !== lyr.word) { lyr.word = k; [...lyrNow.children].forEach((sp, i) => sp.classList.toggle('sung', i <= k)); }
  }

  // ---------- her song's music video: full screen behind her while she sings, in step with the song ----------
  // load({ src, from }): ready at that moment of it (resolves true when it can play, false after 6 s); play({ startAt (ms:
  // when the song's part starts being heard), from (seconds in the song), offset (the video's picture against the song),
  // seconds }); stop()
  const sv = songVideoEl?.querySelector('video');
  let mv = null;
  function mvLoad({ src, from = 0 } = {}) {
    if (!sv || typeof src !== 'string') return Promise.resolve(false);
    return new Promise((done) => {
      let over = false;
      const end = (ok) => { if (over) return; over = true; sv.removeEventListener('seeked', onSeek); sv.removeEventListener('error', onErr); clearTimeout(timer); done(ok); };
      const onSeek = () => end(true), onErr = () => end(false);
      const timer = setTimeout(() => end(sv.readyState >= 2), 6000);
      sv.addEventListener('seeked', onSeek);
      sv.addEventListener('error', onErr);
      sv.muted = true;
      sv.preload = 'auto';
      if (sv.getAttribute('src') !== src) sv.src = src;
      const go = () => { try { sv.currentTime = Math.max(0, Number(from) || 0); } catch { end(false); } };
      if (sv.readyState >= 1) go(); else sv.addEventListener('loadedmetadata', go, { once: true });
    });
  }
  function mvPlay(v) {
    if (!sv || !v) return false;
    mv = { startAt: Number(v.startAt), from: Number(v.from) || 0, offset: Number(v.offset) || 0, seconds: Number(v.seconds) || 0, playing: false, lastFix: 0 };
    songVideoEl.hidden = false;
    return true;
  }
  function mvStop() {
    mv = null;
    if (!sv) return true;
    sv.pause();
    songVideoEl.hidden = true;
    return true;
  }
  function mvFrame(now) {
    if (!mv) return;
    const s = (now - mv.startAt) / 1000;
    if (s < 0) return;
    if (mv.seconds && s > mv.seconds + 0.5) { sv.pause(); return; }
    const want = mv.from + mv.offset + s;
    if (!mv.playing) { mv.playing = true; if (Math.abs(sv.currentTime - want) > 0.08) sv.currentTime = want; sv.play().catch(() => {}); return; }
    // in step with the song: a nudge when it drifts more than a fifth of a second (at most once a second)
    if (performance.now() - mv.lastFix > 1000 && Math.abs(sv.currentTime - want) > 0.2 && sv.readyState >= 2) {
      mv.lastFix = performance.now();
      sv.currentTime = want;
    }
  }

  // ---------- her TV: a video playing in step with its sound (the runner plays the sound), or a picture ----------
  // { src: a video (/media/…webm), startAt (ms: when its sound starts being heard), seconds, label } or { img: a picture
  // (/media/…jpg, from one of her X posts), seconds, label } or (2026-10-09) { chart: $AGI's trades (chart.js), label } or null
  const video = tvEl.querySelector('video');
  const img = tvEl.querySelector('[data-tv-img]');
  const chartEl = tvEl.querySelector('[data-tv-chart]');
  const tvLabel = tvEl.querySelector('[data-tv-label]');
  let tv = null;
  function tvShow(v) {
    if (!v) {
      tv = null; video.pause(); video.removeAttribute('src'); video.load(); tvEl.hidden = true;
      if (img) { img.hidden = true; img.removeAttribute('src'); }
      if (chartEl) chartEl.hidden = true;
      return true;
    }
    tvLabel.textContent = v.label || '';
    if (chartEl) chartEl.hidden = !v.chart;
    if (v.chart && chartEl && drawChart) {
      // (its numbers drawn on its canvas: redrawn with each update, nothing moving in between but a dot)
      tv = { startAt: clock(), seconds: 0, picture: true };
      video.pause(); video.removeAttribute('src'); video.hidden = true;
      if (img) { img.hidden = true; img.removeAttribute('src'); }
      drawChart(chartEl, v.chart, { now: Date.now() });
      tvEl.hidden = false;
      return true;
    }
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
    lyricsFrame(now);
    mvFrame(now);
    tvFrame(now);
  }
  return { emoji, sticker, sparkle, burst, alert, lyrics, tv: tvShow, wipe, frame, songVideo: { load: mvLoad, play: mvPlay, stop: mvStop, get on() { return Boolean(mv); } },
    get popping() { return pops.size; } };
}
