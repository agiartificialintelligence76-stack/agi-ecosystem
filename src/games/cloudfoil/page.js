import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('cloudfoil', game, (options) => createShell({ game: 'cloudfoil', ...options }), new URL('./marquee.webp', import.meta.url).href);
