// BEAT THE AGI: AGI's tiny opening book (src/games/beattheagi/levels.js: BOOK_FIRST, BOOK_REPLY), found with long
// searches: her first stone on an empty board, and her reply to each first stone of yours.
//   node tools/games/beattheagi/book.mjs [ms per position = 4000]
import { createSearcher } from '../../../src/games/beattheagi/engine.js';
import { emptyBoard, PINK, MINT, at } from '../../../src/games/beattheagi/rules.js';

const MS = Number(process.argv[2] || 4000);
const s = createSearcher({ bits: 22 });
const think = (cells, color) => {
  s.clear();
  const r = s.think(cells, color, { budget: MS, now: () => performance.now() });
  return r;
};
const first = think(emptyBoard(), MINT);
console.log(`first: column ${first.move} (depth ${first.depth}, scores ${first.scores.join(' ')})`);
const reply = [];
for (let c = 0; c < 7; c++) {
  const cells = emptyBoard();
  cells[at(c, 0)] = PINK;
  const r = think(cells, MINT);
  reply.push(r.move);
  console.log(`after your ${c}: column ${r.move} (depth ${r.depth}, scores ${r.scores.join(' ')})`);
}
console.log(`BOOK_FIRST = ${first.move}; BOOK_REPLY = [${reply.join(', ')}]`);
