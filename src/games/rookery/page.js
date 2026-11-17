import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('rookery', game, (options) => createShell({ game: 'rookery', ...options }), new URL('./field-guide.webp', import.meta.url).href);
