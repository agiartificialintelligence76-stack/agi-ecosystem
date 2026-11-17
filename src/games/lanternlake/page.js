import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('lanternlake', game, (options) => createShell({ game: 'lanternlake', ...options }), new URL('./scene.webp', import.meta.url).href);
