import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('waxworks', game, (options) => createShell({ game: 'waxworks', ...options }), new URL('./package.webp', import.meta.url).href);
