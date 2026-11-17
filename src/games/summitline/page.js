import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('summitline', game, (options) => createShell({ game: 'summitline', ...options }));
