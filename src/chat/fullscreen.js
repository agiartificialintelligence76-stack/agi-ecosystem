// Full-screen talk (2026-10-02, the owner: "can you put a full screen button on the chat of agi1- like talk to her on full
// screen, like agi-1 will be in full screen on the right and her chat will be on the left, you decide where to put, the top
// section is already crowded maybe in new tab? or sub domain?").
// Claude's choice: its own address on this same site, agi1.app/talk. A subdomain (talk.agi1.app) would open with an empty
// browser: no chat history, 18+ answer, wallet sign-in, voice setting or language (browsers keep those per address), and
// it would need its own domain setup and human-check settings. agi1.app/talk shares all of them, and it's the home page
// itself in another layout (src/styles/fullscreen.css): only her chat on the left and AGI-1, big, on the right (phones:
// her on top, the chat under her), so everything of the chat works there exactly as it does on the page (calls, her
// voice, the wallet, burns, her languages, market moments). Nothing goes in the crowded top bar: the way in is in the
// Playground (the "Talk full screen" button in its heading and the ⤢ on her live view: both links to /talk, so a middle
// click or Ctrl-click opens it in a new tab too). Opened from the page, it also asks the browser for real full screen (no
// browser bars, where the browser allows it); leaving full screen (Esc, or the browser's own button) brings you back to the
// page, at the chat, like a video's full screen. At agi1.app/talk itself (a shared link, a new tab, the installed app:
// src/chat/install.js) the page starts in it, decided by /theme.js before the first paint; ✕ goes to the rest of the site.
import { paintBar } from '../theme.js';

export const TALK_PATH = '/talk';
export const TALK_TITLE = 'Talk to AGI-1 · AGI';
// agi1.app/talk, and /talk/ (the same address that Vercel serves: vercel.json)
export const isTalkPath = (path) => /^\/talk\/?$/.test(String(path ?? ''));
const root = document.documentElement;
export const inTalk = () => root.classList.contains('is-talk');

// the browser's full screen (older Safaris only have the webkit names; iPhones have none: then it's the page's layout alone)
const fullElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const canFull = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function goFull() {
  try {
    const asked = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen?.();
    return Promise.resolve(asked).then(() => true, () => false);   // (refused: the page's own layout still fills the window)
  } catch { return Promise.resolve(false); }
}
function leaveFull() {
  try { Promise.resolve(document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen?.()).catch(() => {}); } catch { /* */ }
}
// (the page scrolls smoothly by default: base.css; these jumps are instant)
function jumpTo(y) {
  try { scrollTo({ top: y, behavior: 'instant' }); } catch {
    const was = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    scrollTo(0, y);
    root.style.scrollBehavior = was;
  }
}

export function startFullscreen(doc = document) {
  const section = doc.getElementById('playground');
  if (!section) return null;
  const $ = (sel) => doc.querySelector(sel);
  const closeBtn = $('[data-talk-close]'), fullBtn = $('[data-talk-fs]');
  const pageTitle = $('meta[property="og:title"]')?.getAttribute('content') || 'AGI';
  // fromPage: opened from the page (so leaving full screen brings you back to it); y: where the page was; backing: Back is on
  // its way (a second ✕ in the same moment mustn't go back twice); refit: where the page should be (worked out again) once
  // the browser has finished leaving its full screen (Safari can move it while the window changes size)
  const state = { on: inTalk(), fromPage: false, y: 0, opener: null, wasFull: false, leaving: false, then: null, backing: false, refit: null };

  function render() {
    const full = Boolean(fullElement());
    if (fullBtn) {
      // (opened from the page and already in full screen: ✕ and Esc both bring you back, so this button would be one too many)
      fullBtn.hidden = !state.on || !canFull() || (full && state.fromPage);
      fullBtn.classList.toggle('is-on', full);
      const word = full ? 'Exit full screen' : 'Full screen';
      fullBtn.setAttribute('aria-label', word);
      fullBtn.title = word;
    }
  }
  function apply(on) {
    state.on = on;
    root.classList.toggle('is-talk', on);
    doc.title = on ? TALK_TITLE : pageTitle;
    paintBar();                                   // (the phone's browser bar, and the installed app's title bar)
    fit();
    render();
    dispatchEvent(new CustomEvent('agi:talk', { detail: on }));
  }

  // where the keyboard goes: the 18+ button while it's up, else the message box (on phones the ✕ instead, so the keyboard
  // doesn't jump up and squeeze her)
  function focusIn() {
    if (root.classList.contains('is-popped')) { $('[data-pg-back]')?.focus({ preventScroll: true }); return; }   // (the card)
    const gate = $('[data-gate]');
    const target = gate && !gate.hidden ? $('[data-gate-ok]') : matchMedia('(pointer: fine)').matches ? $('[data-input]') : closeBtn;
    target?.focus({ preventScroll: true });
  }

  // opts.fromPage: opened on the page (a click: it may also go full screen); push: a new entry in the browser's history,
  // so Back leaves it again
  function enter({ fromPage = true, full = true, push = true } = {}) {
    if (state.on) return;
    // she's in her pop-out window (src/chat/popout.js): not from a click on the page meanwhile; Back and Forward still
    // follow the address (the card fills full-screen talk then)
    if (push && root.classList.contains('is-popped')) return;
    state.fromPage = fromPage;
    state.y = scrollY;
    state.opener = doc.activeElement instanceof HTMLElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    if (push) history.pushState({ agiTalk: 1 }, '', TALK_PATH + location.search);
    apply(true);
    if (full && canFull()) goFull();             // (in the click itself: browsers only allow full screen from one)
    focusIn();
  }

  // then: something to do once the page is back (the Relationship panel, from the level chip)
  function leave({ fromHistory = false, then = null } = {}) {
    if (!state.on) return;
    if (then) state.then = then;                  // (kept while Back finishes it)
    if (fullElement()) { state.leaving = true; leaveFull(); }
    if (!fromHistory) {
      if (state.backing) return;
      if (state.fromPage && history.state?.agiTalk) { state.backing = true; history.back(); return; }   // Back's own way out (popstate ends it)
      // started at agi1.app/talk: the rest of the site, at the chat (a new step in the history, so Back comes back here: the
      // installed app's back gesture too)
      history.pushState(null, '', `/${location.search}#playground`);
    }
    apply(false);
    // where the page goes: where it was (opened from the page), else the chat
    const fromPage = state.fromPage, y = state.y;
    const where = () => (fromPage ? y : section.getBoundingClientRect().top + scrollY);
    jumpTo(where());
    if (state.leaving) state.refit = where;
    // the keyboard back where it was (or on a way back in that's showing: her live view waits for the 18+ check on the page)
    const back = [state.opener, $('.pg-cam [data-talk-open]'), $('.pg-head-actions [data-talk-open]')].find((el) => el?.isConnected && el.getClientRects().length);
    back?.focus({ preventScroll: true });
    state.leaving = false;
    state.fromPage = false;
    const then_ = state.then;
    state.then = null;
    const there = then_?.();                     // (it can say where the page should be instead: then that's kept too)
    if (typeof there === 'function' && state.refit) state.refit = there;
  }

  // the ways in: the links to /talk (a plain click opens it right here; with Ctrl, ⌘, Shift or the middle button, the
  // browser opens /talk in a new tab or window, which starts in it)
  for (const link of doc.querySelectorAll('[data-talk-open]')) {
    link.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      enter();
    });
  }
  // (the app's install screen asks for it on Safari, which keeps the address it's on when you add it: src/chat/install.js)
  addEventListener('agi:talk-open', (e) => enter({ full: e.detail?.full !== false }));
  // she went into her pop-out window (src/chat/popout.js): opened from the page, back to it (out of the browser's full
  // screen too); at agi1.app/talk itself it stays, out of the browser's full screen, with the card saying where she is
  addEventListener('agi:popout', (e) => {
    if (e.detail !== true || !state.on) return;
    if (state.fromPage) leave();
    else if (fullElement()) leaveFull();
  });
  closeBtn?.addEventListener('click', () => leave());
  fullBtn?.addEventListener('click', () => (fullElement() ? leaveFull() : goFull()));

  // Back and Forward (a step we added comes back as opened from the page; the address someone opened, as it was)
  addEventListener('popstate', () => {
    state.backing = false;
    const want = isTalkPath(location.pathname);
    if (want && !state.on) enter({ fromPage: Boolean(history.state?.agiTalk), full: false, push: false });
    else if (!want && state.on) leave({ fromHistory: true });
  });

  // the browser left full screen (Esc, its own button, or ours): opened from the page, that's the way back to it. Not while a
  // screen or a menu is open (the Esc was for that: in full screen the browser keeps it for itself), then it stays here
  const busyElsewhere = () => Boolean(doc.querySelector('dialog[open], [data-playground] [aria-expanded="true"]'));
  const onFull = () => {
    const full = Boolean(fullElement());
    if (full) state.wasFull = true;
    else if (state.wasFull) {
      state.wasFull = false;
      if (state.on && state.fromPage && !state.leaving && !busyElsewhere()) leave();
      if (state.refit && !state.on) jumpTo(state.refit());   // (the window has its final size now)
      state.refit = null;
      state.leaving = false;                     // (a Back still on its way finishes leaving with the window's final size)
    }
    render();
  };
  doc.addEventListener('fullscreenchange', onFull);
  doc.addEventListener('webkitfullscreenchange', onFull);

  // The level chip in her chat bar links to the Relationship panel, which full-screen talk doesn't show: there it opens the
  // wallet's connect screen (no wallet yet), else it goes back to the page, to that panel. (Which wallet: the panel says so
  // each time it changes, src/chat/relationship.js)
  let wallet = null;
  addEventListener('agi:relationship', (e) => { wallet = e.detail?.wallet || null; });
  // the panel, with the keyboard on its first button, box or link that's showing → where the page should be (worked out
  // again once the browser's full screen is over)
  function showRelationship() {
    const rel = doc.getElementById('relationship');
    if (!rel) return null;
    const at = () => rel.getBoundingClientRect().top + scrollY - 80;
    jumpTo(at());
    [...rel.querySelectorAll('button, input, a[href]')].find((el) => !el.disabled && el.getClientRects().length)?.focus({ preventScroll: true });
    return at;
  }
  $('[data-rel-chip]')?.addEventListener('click', (e) => {
    if (!state.on) return;
    e.preventDefault();
    if (!wallet) dispatchEvent(new CustomEvent('agi:wallet-open'));
    // in her pop-out window: the page behind it shows the panel (src/chat/popout.js), and she stays on top
    else if (root.classList.contains('is-pip')) parent.postMessage({ agi1: 'relationship' }, location.origin);
    else leave({ then: showRelationship });
  });
  // her pop-out window's level chip (src/chat/popout.js): the panel on this page, out of full-screen talk first
  addEventListener('agi:relationship-show', () => { if (state.on) leave({ then: showRelationship }); else showRelationship(); });

  // Phones and tablets: the layout follows the part of the screen you can see, so the keyboard never covers the message box
  // (it shrinks her picture instead). Not while pinch-zoomed in.
  const vv = window.visualViewport;
  const touch = matchMedia('(pointer: coarse)');
  function fit() {
    if (!state.on || !vv || !touch.matches || Math.abs((vv.scale || 1) - 1) > 0.01) {
      root.style.removeProperty('--talk-h');
      root.style.removeProperty('--talk-top');
      return;
    }
    root.style.setProperty('--talk-h', `${Math.round(vv.height)}px`);
    root.style.setProperty('--talk-top', `${Math.round(vv.offsetTop)}px`);
  }
  vv?.addEventListener('resize', fit);
  vv?.addEventListener('scroll', fit);

  if (state.on) { fit(); paintBar(); }
  render();
  return { enter, leave, get on() { return state.on; } };
}
