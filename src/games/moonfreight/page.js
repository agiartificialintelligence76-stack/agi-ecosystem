import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';
mountRemaster('moonfreight', game, options => createShell({
  game: 'moonfreight',
  ...options
}), new URL('./marquee.webp', import.meta.url).href);
