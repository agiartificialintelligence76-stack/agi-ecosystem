import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('pocketgrove', game, (options) => createShell({ game: 'pocketgrove', ...options }), new URL('./cover.webp', import.meta.url).href);
