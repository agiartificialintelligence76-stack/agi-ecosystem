// WEB SCRAPER: what AGI-1 says (her voice: lowercase, playful, a 💜 now and then; PG-13; never money).
import { TYPES } from './rules.js';

export const LINES = Object.freeze({
  start: ['i need training data. ALL of it 💜', 'start small. cones first, towers later', 'scrape the city before the others do', 'om nom nom. data.'],
  solo: ['just us and the whole city. eat it all', 'no rivals. take your time. not too much time'],
  daily: ['today’s city is the same for everyone 💜', 'daily scrape! let’s top the chart'],
  big: ['WE ATE A WHOLE BUILDING', 'that was a big one 😳', 'delicious skyscraper', 'so much data 💜'],
  grow: ['i’m getting bigger!', 'look how big we are now', 'growing growing growing'],
  found: ['new in the scrapbook!', 'never scraped one of those before', 'collecting them all 💜'],
  ate: ['SCRAPED. they never saw it coming', 'rival model: deleted 💜', 'tastes like overfitting'],
  eaten: ['they ate me!! 😭', 'scraped by a rival… rude', 'back in a sec. i’ll remember this'],
  back: ['i’m back. smaller, angrier', 'round two. let’s go'],
  danger: ['careful, that one’s bigger than us', 'big portal nearby! run!', 'don’t get scraped'],
  hurry: ['ten seconds! eat everything!', 'last chance, nom faster'],
  win: ['NUMBER ONE. biggest dataset in town 💜', 'we won! the city is ours', 'i have never been so well trained'],
  lose: ['we’ll get them next round', 'they were hungrier. not for long', 'more data next time 💜'],
});
const counters = new Map();
export function say(kind) {
  const list = LINES[kind];
  if (!list?.length) return '';
  const i = counters.get(kind) || 0;
  counters.set(kind, i + 1);
  return list[(i * 5 + Math.floor(Math.random() * list.length)) % list.length];
}
export const TIPS = Object.freeze({
  move: 'Drag anywhere to steer her portal (or use the arrows / WASD).',
  small: 'Only things smaller than the portal fall in. Start with the little stuff.',
  rivals: 'A portal clearly bigger than another can swallow it. Grow, then hunt.',
});
export const typeName = (type) => TYPES[type]?.name || type;
export const shareText = ({ mode, rank, score, pct }) => mode === 'solo'
  ? `I scraped ${pct}% of the city in WEB SCRAPER on agi1.app 💜 can you beat it?`
  : `I came #${rank} in WEB SCRAPER with ${score.toLocaleString('en-US')} data on agi1.app 💜 can you beat it?`;
