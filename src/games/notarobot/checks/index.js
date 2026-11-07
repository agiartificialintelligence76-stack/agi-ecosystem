// I'M NOT A ROBOT: every check in the game, in one list (the run draws from it with a fair shuffle bag).
import { tick, cats, slide, type, turn, findbot } from './a.js';
import { hold, mash, dont, smile, odd, count } from './b.js';
import { catchit, swat, steady, order, shake, sign, now } from './c.js';

export const CHECKS = Object.freeze([tick, cats, slide, type, turn, findbot, hold, mash, dont, smile, odd, count, catchit, swat, steady, order, shake, sign, now]);
export const byId = (id) => CHECKS.find((c) => c.id === id);
export const commandOf = (def, st) => (typeof def.command === 'function' ? def.command(st) : def.command);
export const keysOf = (def, st) => (typeof def.keys === 'function' ? def.keys(st) : def.keys);
