// AGI GAMES intro (2026-10-20, the owner: "can you add a short loading screen for every game like an intro "AGI GAMES"
// …"): a game's page imports this first. Its overlay, <div class="gi" id="agi-intro" aria-hidden="true"> right after
// <body>, is in the page's own markup, so ./intro.css covers the game from the first paint; ./intro-run.js plays the
// intro on it, then takes it away.
import './intro.css';
import { startIntro, browserEnv } from './intro-run.js';

const root = document.getElementById('agi-intro');
if (root) startIntro(root, browserEnv());
