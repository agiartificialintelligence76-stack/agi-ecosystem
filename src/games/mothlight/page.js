import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('mothlight', game, (options) => createShell({ game: 'mothlight', ...options }), new URL('./scene.webp', import.meta.url).href);
