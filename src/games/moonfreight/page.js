import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('moonfreight', game, (options) => createShell({ game: 'moonfreight', ...options }));
