import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('returnaddress', game, (options) => createShell({ game: 'returnaddress', ...options }), new URL('./disco.webp', import.meta.url).href);
