import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('cloudkitchen', game, (options) => createShell({ game: 'cloudkitchen', ...options }), new URL('./scene.webp', import.meta.url).href);
