// TRENCHING SIMULATOR's page (2026-10-20, agi1.app/games/trenchingsimulator): the AGI GAMES intro first (over the game
// while it loads, like every game's), then the game's styles and its screens (shell.js).
import '../intro.js';
import './trench.css';
import './menu.css';
import './boards/pomp.css';
import './live-kols-panel.css';
import { startShell } from './shell.js';

const root = document.getElementById('ts-root');
if (root) startShell(root);
