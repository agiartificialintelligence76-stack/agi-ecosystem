import mon from './monday.js';
import tue from './tuesday.js';
import wed from './wednesday.js';
import thu from './thursday.js';
import fri from './friday.js';
import sat from './saturday.js';
import sun from './sunday.js';
export const CASES = [...mon, ...tue, ...wed, ...thu, ...fri, ...sat, ...sun];
export const NIGHTS = [
  ['Monday', 'A bell with no tongue', 'We still have a frequency, even when we lose a reel.'],
  ['Tuesday', 'Up the back stairs', 'The paper boats are drifting toward the studio.'],
  ['Wednesday', 'Two sides of a pane', 'The same sound reaches different ears.'],
  ['Thursday', 'A key for the night desk', 'The host crosses out one of her own assumptions.'],
  ['Friday', 'The long way home', 'Everyone remembers a different handoff.'],
  ['Saturday', 'What the tape kept', 'Three notes on tape leave a space for one more.'],
  ['Sunday', 'Leave the room mic open', 'The block takes its turn at the microphone.'],
];
export const ORDER = [
  ['The keeper bagged the clapper.', 'Mina pushed the blue door.'],
  ['The shower left sediment.', 'Bea drew the chalk line.'],
  ['The lift was shut for inspection.', 'The caller reached the upper landing.'],
  ['The page came off the press.', 'Someone folded that page into a boat.'],
  ['The original stair sound was made.', 'Its second echo reached the recorder.'],
  ['The photographer took the picture.', 'The print was turned over for comparison.'],
  ['The cat deposited its paw marks.', 'The keeper lifted the marks from the pane.'],
  ['The tag was fitted across the doors.', 'The return slot delivered the spare.'],
  ['The shop rang up the second order.', 'The collector took its labeled cup.'],
  ['The original sneeze was recorded.', 'The loop played the sneeze again.'],
  ['The sheet was opened flat.', 'The writer drew across the fold.'],
  ['The lamp order was set.', 'The caller saw the illuminated patch in the glass.'],
  ['The west train departed at 23:10.', 'The east train departed at 23:12.'],
  ['The main clock stopped.', 'The backup clock kept marking the silent interval.'],
  ['The copy already carried orange join 31.', 'The dispatch envelope was sealed around that reel.'],
  ['The envelope arrived under the writing sheet.', 'Pressure from the pen left the return address in it.'],
  ['Tali hummed the opening part of her phrase.', 'Tali took a breath before she hummed again.'],
  ['The three-note booth reel played.', 'A neighbor supplied the fourth note into the open mic.'],
];
export function claimsFor(c, stage) {
  const lead = c.rounds[stage];
  return [
    {
      id: 'lead',
      speaker: c.callers[lead.speaker],
      text: lead.claim,
      press: lead.press,
      subject: lead.subject,
      value: lead.claimed,
    },
    {
      id: 'context',
      speaker: c.callers[[0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0][c.id - 1]],
      text: c.aside.claim,
      press: c.aside.press,
      subject: c.aside.subject,
      value: c.aside.value,
    },
  ];
}
export function refutes(claim, item) {
  if (!claim || !item || claim.subject !== item.subject) return false;
  const possibles = (value) => (Array.isArray(value) ? value : [value]);
  return possibles(claim.value).every((a) => !possibles(item.value).includes(a));
}
export function alternatives(c, stage) {
  return claimsFor(c, stage).flatMap((q) => c.evidence.filter((e) => refutes(q, e)).map((e) => [q.id, e.id]));
}
export function shuffled(list, seed) {
  const a = [...list];
  let x = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((x / 4294967296) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function orderFor(c, stage, seed, daily = false) {
  const s = Math.imul((seed >>> 0) ^ Math.imul(c.id, 7187) ^ Math.imul(stage + 1, 8317), 2654435761) >>> 0;
  return {
    claims: daily
      ? shuffled(claimsFor(c, stage), s)
      : (c.id + stage) % 2
        ? claimsFor(c, stage)
        : claimsFor(c, stage).reverse(),
    items: daily
      ? shuffled(c.evidence, s ^ 0x43414c4c)
      : shuffled(c.evidence, Math.imul(c.id + stage + 18, 2654435761) >>> 0),
    earlier: shuffled([0, 1], s ^ 0x70125a31),
  };
}
