import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('tetherturn', game, (options) => createShell({ game: 'tetherturn', ...options }), new URL('./rescue-horizon.webp', import.meta.url).href);
