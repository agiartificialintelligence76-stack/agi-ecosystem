// Her pop-out window (2026-10-02, the owner: "yeah build that", the free next step of the AGI-1 app: "she will appear on my
// screen as well"). A small window with AGI-1 and her chat that stays on top of the visitor's other windows while they work:
// the browser's Document Picture-in-Picture (Chrome and Edge 116+, Firefox 151+, on computers). Where a browser doesn't
// have it (Safari, phones), the buttons stay hidden.
// The window holds this site's full-screen talk (agi1.app/talk?pip=1, src/chat/fullscreen.js) in a frame: her own page, so
// her chat, voice, calls, languages and the wallet's screen work there as on the page, and it shares this browser's chat
// history, 18+ answer and settings. A frame rather than moving this page's chat into the window: a page whose tab is hidden
// (the visitor working in another window) is slowed down by the browser, which would freeze her; the frame is a page of its
// own, and shown. That's why our own pages may frame each other (vercel.json: frame-src and frame-ancestors 'self', never
// another site).
// While she's in it, the chat on this page waits: a card says where she is, with "Bring her back". Closing the window, or
// its back-to-tab button, brings her back. Events: sends 'agi:popout' (true / false) when she goes out or comes back
// (src/chat/chat.js ends a call and keeps her market moments for the window; src/chat/fullscreen.js leaves full-screen talk).
import { barColor, currentSkin, currentTheme } from '../theme.js';

// her window's size (the browser may make it smaller or bigger, and the visitor can resize it: the page fits any size)
export const POP_SIZE = { width: 400, height: 660 };

// her window's page: full-screen talk, marked as the pop-out (/theme.js believes the mark only inside a frame). Whatever else
// this page's address carries comes along (?dev for tests)
export function popoutUrl(loc = location) {
  const keep = String(loc.search || '').replace(/^\?/, '').split('&').filter((p) => p && !/^pip(=|$)/.test(p));
  return `${loc.origin}/talk?${[...keep, 'pip=1'].join('&')}`;
}

// whether this browser can pop her out: Document Picture-in-Picture, asked by a page of its own (never by a page inside a
// frame, her window's own page included)
export function canPopOut(win = globalThis) {
  try {
    return typeof win.documentPictureInPicture?.requestWindow === 'function' && win.top === win.self;
  } catch {
    return false;
  }
}

export function startPopout(doc = document) {
  const pg = doc.querySelector('[data-playground]');
  const buttons = [...doc.querySelectorAll('[data-popout]')];
  const appRow = doc.querySelector('[data-appdlg-pop]');
  const able = Boolean(pg) && canPopOut(window);
  for (const b of buttons) b.hidden = !able;
  if (appRow) appRow.hidden = !able;
  if (!able) return null;
  const root = doc.documentElement;
  const back = doc.querySelector('[data-pg-back]');
  let win = null, frame = null, opening = false;

  // she's out (or back): the chat here waits behind its card, and the ways out hide
  function render() {
    const out = Boolean(win);
    for (const b of buttons) b.hidden = out;
    if (appRow) appRow.hidden = out;
    pg.classList.toggle('is-popped', out);
    root.classList.toggle('is-popped', out);
  }

  // her window: nothing but the frame with her page, on the color around her in full-screen talk (no white flash while it
  // loads). Styled through the CSS object model: the window keeps this page's CSP, which allows that (never inline styles)
  function build(w) {
    const d = w.document;
    d.title = 'AGI-1';
    d.documentElement.lang = 'en';
    const bg = barColor(currentSkin(), currentTheme(), false, true);
    Object.assign(d.documentElement.style, { height: '100%', background: bg, colorScheme: currentTheme() });
    Object.assign(d.body.style, { margin: '0', height: '100%', overflow: 'hidden', background: bg });
    frame = d.createElement('iframe');
    frame.src = popoutUrl();
    frame.title = 'AGI-1';
    frame.allow = 'microphone; autoplay; clipboard-write; display-capture';   // (her mic and calls, her voice, Copy, "Show her")
    Object.assign(frame.style, { display: 'block', width: '100%', height: '100%', border: '0' });
    d.body.append(frame);
  }

  // what her page in the window may ask of this one: the Relationship panel (her level chip, with a wallet connected). This
  // page comes to the front (browsers allow it from a click in her window: Chrome 123+), and src/chat/fullscreen.js shows
  // the panel (out of full-screen talk first, where it isn't shown)
  function onMessage(e) {
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
    if (e.data?.agi1 !== 'relationship') return;
    try { window.focus(); } catch { /* it stays where it is */ }
    dispatchEvent(new CustomEvent('agi:relationship-show'));
  }

  async function open() {
    if (win || opening) return;            // (one window: a double click or a held key asks once)
    opening = true;
    let w;
    try {
      // asked in the click itself: browsers only open it from one
      w = await window.documentPictureInPicture.requestWindow({ ...POP_SIZE });
    } catch (err) {
      console.warn('[popout] the browser didn\'t open her window:', err?.message || err);
      return;
    } finally {
      opening = false;
    }
    if (!w || w.closed) return;            // (gone before it was ours)
    win = w;
    // (its own buttons, back to the tab or close, end its page: listened for first, so nothing can leave her stuck out)
    w.addEventListener('pagehide', () => cameBack(w), { once: true });
    try {
      build(w);
    } catch (err) {
      console.warn('[popout] her window couldn\'t be set up:', err?.message || err);
      win = null;
      frame = null;
      try { w.close(); } catch { /* already gone */ }
      return;
    }
    w.addEventListener('message', onMessage);
    render();
    dispatchEvent(new CustomEvent('agi:popout', { detail: true }));
    // the keyboard on the way back (the button it came from is hidden now)
    if (back && (!doc.activeElement || doc.activeElement === doc.body || doc.activeElement.closest?.('[hidden]') || !doc.activeElement.getClientRects().length)) back.focus({ preventScroll: true });
  }
  // she's back (her window closed, whichever way): once
  function cameBack(w) {
    if (win !== w) return;
    win = null;
    frame = null;
    const wasBack = !doc.activeElement || doc.activeElement === doc.body || doc.activeElement === back;
    render();
    dispatchEvent(new CustomEvent('agi:popout', { detail: false }));
    // the keyboard where her chat starts again (the card it was on is hidden now): the message box, or while the 18+ check
    // is up its title (never its button: a held Enter mustn't answer it unread)
    if (wasBack) {
      const gate = doc.querySelector('[data-gate]');
      (gate && !gate.hidden ? doc.querySelector('[data-gate-title]') : doc.querySelector('[data-input]'))?.focus({ preventScroll: true });
    }
  }
  function close() {
    const w = win;
    try { w?.close(); } catch { /* already gone */ }
    if (w?.closed) cameBack(w);   // (at once, without waiting for its page to end; a window already gone, too)
  }

  for (const b of buttons) b.addEventListener('click', open);
  back?.addEventListener('click', close);
  // the app's screen offers her window too (src/chat/install.js): it closes, and her window opens from the same click
  doc.querySelector('[data-appdlg-pop] [data-popout]')?.addEventListener('click', () => doc.querySelector('[data-app-dialog]')?.close());
  return { open, close, get out() { return Boolean(win); } };
}
