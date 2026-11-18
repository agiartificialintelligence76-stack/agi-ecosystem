import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('echoforge', game, (options) => createShell({ game: 'echoforge', ...options }), new URL('./nightclub.webp', import.meta.url).href);
