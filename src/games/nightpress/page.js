import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('nightpress', game, (options) => createShell({ game: 'nightpress', ...options }));
