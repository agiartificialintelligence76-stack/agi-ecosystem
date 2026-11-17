import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('tidepool', game, (options) => createShell({ game: 'tidepool', ...options }));
