import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';
mountRemaster('switchyard', game, options => createShell({
  game: 'switchyard',
  ...options
}), new URL('./marquee.webp', import.meta.url).href);
