import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('inkveil', game, (options) => createShell({ game: 'inkveil', ...options }));
