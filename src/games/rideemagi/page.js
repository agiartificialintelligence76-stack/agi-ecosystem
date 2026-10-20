// agi1.app/games/rideemagi (2026-10-19): the owner's game, Ride 'Em, AGI!, as one of the site's pages. Its fonts
// (tools/games/game-fonts.py), its styles and its code (tools/games/import-rideemagi.mjs), in that order: the game
// draws its words on a canvas, so its fonts' rules come first. Nothing of the rest of the site is loaded here.
// The AGI GAMES intro first (2026-10-20): its overlay's styles before the game's, and its key and tap listeners
// before the game's own, so a key or a tap that skips the intro never reaches the game.
import '../intro.js';
import './fonts.css';
import './game.css';
import './game.js';
