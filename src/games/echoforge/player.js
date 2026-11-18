import { rng } from '../kit/fx.js';
const profiles = Object.freeze({
 newcomer:{spread:.107, bias:.048, skip:.12, wrong:.14, holdSlip:.24},
 regular:{spread:.066, bias:.014, skip:.034, wrong:.052, holdSlip:.08},
 expert:{spread:.024, bias:.002, skip:.003, wrong:.005, holdSlip:.008},
 preview:{spread:.009, bias:0, skip:0, wrong:0, holdSlip:0},
});
export const skillNames = ['newcomer','regular','expert'];
export function player(chart, skill, seed) {
  const dice = rng(seed || 7);
  const profile = profiles[skill] || profiles.preview;
  const actions = [];
  for (const note of chart.notes) {
    if (dice.chance(profile.skip)) continue;
    const spread = profile.spread * (chart.difficulty==='headliner'?1.2:1);
    const jitter = (dice.next()+dice.next()+dice.next()-1.5) * 2 * spread;
    const at = note.at + profile.bias + jitter;
    const lane = dice.chance(profile.wrong) ? (note.lane + 1) % 3 : note.lane;
    const release = note.until > note.at ? Math.max(at+.035, note.until - (dice.chance(profile.holdSlip) ? .17 : .007)) : at+.044;
    actions.push({at,lane,down:true}, {at:release,lane,down:false});
  }
  actions.sort((a,b) => a.at-b.at || Number(a.down)-Number(b.down));
  let next = 0;
  return (time, input) => {
    while (next < actions.length && actions[next].at <= time) {
      const event = actions[next++];
      input(event.down, event.lane, event.at);
    }
  };
}
export function excerpt(chart, first, count) {
  const old = chart.phrases.slice(first, first + count);
  const notes = [], calls = [];
  const phrases = old.map((p, i) => {
    const ownNotes = p.notes.map(n => {
      const note = {...n, index:notes.length, phrase:i};
      notes.push(note);
      return note;
    });
    const ownCalls = p.calls.map(n => {
      const call = {...n,phrase:i};
      calls.push(call);
      return call;
    });
    return {...p,index:i,notes:ownNotes,calls:ownCalls};
  });
  return {...chart,phrases,notes,calls,start:phrases[0].start-.25,duration:phrases.at(-1).end+.45};
}
