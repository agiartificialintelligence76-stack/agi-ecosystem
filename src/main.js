// Entry point: Vite bundles this file (and everything it imports) for the browser.
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/hero.css';
import './styles/sections.css';
import './styles/evals.css';
import './styles/modelcard.css';
import './styles/playground.css';
import './styles/arena.css';
import './styles/relationship.css';
import './styles/footer.css';
import './styles/notify.css';
import './styles/checker.css';
import './styles/pop.css';      // Pop mode (2026-09-27): the ecosystem look, only while it's switched on
import { startPlayground } from './chat/chat.js';   // AGI-1's chat, as the Playground section
import { startRelationship } from './chat/relationship.js';
import { startTheme } from './theme.js';
import { startMenu } from './menu.js';
import { startPrices } from './prices/prices.js';
import { startTicker } from './prices/ticker.js';
import { startEvals } from './sections/evals.js';
import { startModelCard } from './sections/modelcard.js';
import { startArena } from './sections/arena.js';
import { startChecker } from './sections/checker.js';
import * as cards from './share/card.js';
import { STYLE_KEY, readStyle } from './stage/agi1-2d-motion.js';

startTheme();
// AGI-1 in 2D (2026-09-27): her live views' still pictures (shown until she's there) match the AGI-1 this visitor picked,
// before they download (the stage switches them afterwards; src/stage/stage.js)
try {
  if (readStyle(localStorage.getItem(STYLE_KEY)) === '2d') {
    for (const img of document.querySelectorAll('.pg-cam-still, .chk-cam-still')) img.setAttribute('src', '/images/agi1-live-2d.webp');
  }
} catch { /* private mode: the 3D picture */ }
startMenu();                      // the phone menu
startTicker(document.getElementById('ticker'));
startEvals(document.getElementById('evals'));
startModelCard(document.getElementById('model-card'));
startPlayground(document.querySelector('[data-playground]'));
startRelationship(document.querySelector('[data-rel]'));   // wallet + levels (after the chat, which listens to it)
startArena(document.querySelector('[data-arena]'));
startChecker(document.querySelector('[data-checker]'));   // ClankChecker (2026-09-26): loads its list when you get close
startPrices();                    // live $AGI numbers from DexScreener, every 30 s while the tab is open

// ?dev: test hooks. window.__agiCards draws the share cards (tools/cards/ uses it to make public/cards/).
if (new URLSearchParams(location.search).has('dev')) window.__agiCards = cards;

// "Try AGI-1" buttons open the chat.
for (const button of document.querySelectorAll('[data-open-chat]')) {
  button.addEventListener('click', () => dispatchEvent(new CustomEvent('agi:chat-open')));
}

// The 3D stage needs three.js (large), so it loads as a separate file after the text is on screen.
const stageWrap = document.getElementById('stageWrap');
if (stageWrap) {
  import('./stage/stage.js')
    .then(({ startStage }) => startStage(stageWrap))
    .catch((err) => {
      console.error('[stage] failed to start', err);
      const status = stageWrap.querySelector('[data-stage-status]');
      status.textContent = "Couldn't start the 3D view. Refresh to try again.";
      status.classList.remove('busy');
    });
}
