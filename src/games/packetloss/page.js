// PACKET LOSS on agi1.app (2026-11-09): Deliver every bit. Dodge the lag.
// The AGI GAMES intro first, like every AGI game (its styles before the game's, and its key and tap listeners before the
// game's own, so a key or a tap that skips the intro never reaches the game). Then the game, in ./game.js.
import '../intro.js';
import './game.js';
