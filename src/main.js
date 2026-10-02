// Entry point: Vite bundles this file (and everything it imports) for the browser.
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/hero.css';
import './styles/sections.css';
import './styles/evals.css';
import './styles/modelcard.css';
import './styles/playground.css';
import './styles/relationship.css';
import './styles/footer.css';
import './styles/notify.css';
import './styles/checker.css';
import './styles/pop.css';      // Pop mode (2026-09-27): the bold look, only while it's switched on
import './styles/landing.css';  // the front (2026-09-28): the bright AGI landing, first on the home page
import './styles/fullscreen.css';   // full-screen talk (2026-10-02): agi1.app/talk, her chat and AGI-1 filling the screen
import { startPlayground } from './chat/chat.js';   // AGI-1's chat, as the Playground section
import { startFullscreen } from './chat/fullscreen.js';
import { startInstall } from './chat/install.js';
import { startRelationship } from './chat/relationship.js';
import { startBurns } from './chat/burn.js';
import { startTheme } from './theme.js';
import { startLanding } from './landing/landing.js';
import { startMenu } from './menu.js';
import { startPrices } from './prices/prices.js';
import { startTicker } from './prices/ticker.js';
import { startEvals } from './sections/evals.js';
import { startModelCard } from './sections/modelcard.js';
import { startChecker } from './sections/checker.js';
import { startTelegramLink } from './chat/telegram-link.js';
import { startLang } from './i18n/lang.js';
import * as cards from './share/card.js';
import { STYLE_KEY, readStyle } from './stage/agi1-2d-motion.js';

startTheme();
// Full-screen talk (2026-10-02): agi1.app/talk opens straight into it (/theme.js decided before the page painted)
const talkAtStart = document.documentElement.classList.contains('is-talk');
// The front first (2026-09-28): its loader and entrance are already waiting (/theme.js). If it fails, the page shows at once.
// In full-screen talk the front isn't shown: it starts when you leave it (no loader or entrance then)
let frontStarted = false;
function startFront() {
  if (frontStarted) return;
  frontStarted = true;
  try { startLanding(); } catch (err) {
    console.error('[landing] failed to start', err);
    document.documentElement.classList.remove('lp-loading');
    document.documentElement.classList.add('lp-go');
  }
}
if (talkAtStart) addEventListener('agi:talk', (e) => { if (!e.detail) startFront(); });
else startFront();
// AGI-1 in 3D or 2D (2026-09-27; 2D first since 2026-10-01): her live views' still pictures (shown until she's there)
// match the AGI-1 this visitor picked, before they download (the stage switches them afterwards; src/stage/stage.js)
try {
  if (readStyle(localStorage.getItem(STYLE_KEY)) === '3d') {
    for (const img of document.querySelectorAll('.pg-cam-still, .chk-cam-still')) img.setAttribute('src', '/images/agi1-live.webp');
  }
} catch { /* private mode: the 2D picture */ }
startMenu();                      // the phone menu
startTicker(document.getElementById('ticker'));
startEvals(document.getElementById('evals'));
startModelCard(document.getElementById('model-card'));
startPlayground(document.querySelector('[data-playground]'));
startFullscreen(document);        // (2026-10-02) full-screen talk: the "Talk full screen" links, /talk, Back, the browser's full screen
startInstall(document);           // (2026-10-02) "Get the AGI-1 app": this site installed as an app, opening in full-screen talk
startLang();   // (2026-09-29) the language AGI-1 speaks with this visitor, if they picked one before: English until then
startRelationship(document.querySelector('[data-rel]'));   // wallet + levels (after the chat, which listens to it)
startBurns(document);            // (2026-09-30) burn $AGI for more messages, once burns are open (src/chat/burn.js)
startTelegramLink(document, import.meta.env.VITE_TELEGRAM_BOT);   // "She texts first" (2026-09-29): her Telegram bot, if set
startChecker(document.querySelector('[data-checker]'));   // ClankChecker (2026-09-26): loads its list when you get close
startPrices();                    // live $AGI numbers from DexScreener, every 30 s while the tab is open

// ?dev: test hooks. window.__agiCards draws the share cards (tools/cards/ uses it to make public/cards/).
if (new URLSearchParams(location.search).has('dev')) window.__agiCards = cards;

// "Try AGI-1" buttons open the chat.
for (const button of document.querySelectorAll('[data-open-chat]')) {
  button.addEventListener('click', () => dispatchEvent(new CustomEvent('agi:chat-open')));
}

// The 3D stage needs three.js (large), so it loads as a separate file after the text is on screen. Since the front
// (2026-09-28) it waits for the front's entrance to end (agi:landing-ready), so downloading and preparing her 3D model
// doesn't make that entrance stutter; sooner when the stage is about to scroll into view or the chat opens, and at the
// latest 6 s after the page opened.
const stageWrap = document.getElementById('stageWrap');
if (stageWrap) {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    import('./stage/stage.js')
      .then(({ startStage }) => startStage(stageWrap))
      .catch((err) => {
        console.error('[stage] failed to start', err);
        const status = stageWrap.querySelector('[data-stage-status]');
        status.textContent = "Couldn't start the 3D view. Refresh to try again.";
        status.classList.remove('busy');
      });
  };
  const front = document.querySelector('[data-lp-hero]');
  addEventListener('agi:talk', (e) => { if (e.detail) start(); });   // full-screen talk: she's needed right away
  if (!front || talkAtStart) start();
  else {
    addEventListener('agi:landing-ready', start, { once: true });
    addEventListener('agi:chat-open', start, { once: true });
    setTimeout(start, Math.max(0, 6000 - performance.now()));
    if ('IntersectionObserver' in window) {
      const near = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { near.disconnect(); start(); }
      }, { rootMargin: '100% 0px' });
      near.observe(stageWrap);
    }
  }
}
