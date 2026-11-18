import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('pearlshift', game, (options) => createShell({ game: 'pearlshift', ...options }), new URL('./marquee.webp', import.meta.url).href);
