import { claimsFor, refutes, ORDER } from './cases.js';
export const initial = (guided = false) => ({
  stage: 0,
  phase: 'transcript',
  marked: null,
  item: null,
  redo: null,
  flipped: [],
  pressed: [],
  history: [],
  hypotheses: [],
  lights: 4,
  strikes: 0,
  assisted: guided,
  restored: false,
  listening: false,
  feedback: '',
  event: 'pickup',
});
export const seals = (s) =>
  1 + Number(!s.assisted) + Number(!s.assisted && s.strikes === 0 && s.pressed.some((p) => p.endsWith(':lead')));
export function act(c, s, id) {
  const r = c.rounds[s.stage],
    qs = claimsFor(c, s.stage),
    claim = qs.find((q) => q.id === s.marked),
    item = c.evidence.find((e) => e.id === s.item);
  const change = (fields, event, feedback = '') => ({ ...s, ...fields, event, feedback });
  if (id === 'listen') {
    if (s.listening) return change({ listening: false }, 'back');
    return change({ listening: true }, 'listen', 'Put these two events in order. Which happened first?');
  }
  if (s.listening) {
    if (!id.startsWith('when:')) return s;
    const first = Number(id.slice(5));
    if (first !== 0)
      return change({}, 'again', 'Play that order back. ' + ORDER[c.id - 1][0] + ' That had to happen first.');
    const gain = !s.restored && s.lights < 4;
    return change(
      { listening: false, restored: s.restored || gain, lights: s.lights + Number(gain) },
      gain ? 'recover' : 'rewind',
      gain
        ? 'You put the two moments in order. One listener tuned back in.'
        : 'The two moments are in order. Your tape is cued.'
    );
  }
  if (s.phase === 'sealed') return s;
  if (s.phase === 'amended') {
    if (id !== 'next') return s;
    if (s.stage === c.rounds.length - 1)
      return change({ phase: 'sealed', item: null, marked: null }, 'sealed', c.ending);
    return change({ stage: s.stage + 1, phase: 'transcript', marked: null, item: null, redo: null }, 'caller');
  }
  if (id.startsWith('claim:')) {
    const key = id.slice(6);
    if (!qs.some((q) => q.id === key)) return s;
    return change({ phase: 'evidence', marked: key, item: null, redo: null }, 'mark');
  }
  if (id === 'redo' && s.phase === 'transcript' && s.redo)
    return change({ phase: 'evidence', marked: s.redo.marked, item: s.redo.item, redo: null }, 'mark');
  if (id === 'back' || id === 'transcript')
    return change(
      {
        redo: s.marked ? { marked: s.marked, item: s.item } : s.redo,
        marked: null,
        item: null,
        phase: 'transcript',
      },
      'back'
    );
  if (!claim || s.phase !== 'evidence') return s;
  if (id === 'press') {
    const k = s.stage + ':' + s.marked;
    return change({ pressed: s.pressed.includes(k) ? s.pressed : [...s.pressed, k] }, 'press', claim.press);
  }
  if (id.startsWith('item:')) {
    const key = id.slice(5);
    if (!c.evidence.some((e) => e.id === key)) return s;
    return change({ item: key }, 'paper');
  }
  if (!item) return s;
  if (id === 'flip' && item.back) {
    return change(
      { flipped: s.flipped.includes(item.id) ? s.flipped : [...s.flipped, item.id] },
      'flip',
      item.back
    );
  }
  if (id !== 'present') return s;
  if (item.back && !s.flipped.includes(item.id))
    return change(
      {},
      'inspect',
      'The witness has only seen the front. Turn the exhibit over before putting it on air.'
    );
  if (!refutes(claim, item)) {
    const others = c.evidence.filter((e) => !refutes(claim, e));
    const why =
      claim.id === 'lead'
        ? r.reasons[others.indexOf(item)]
        : item.subject === claim.subject
          ? 'This actually supports the caller’s detail. Both give the same account.'
          : 'The exhibit concerns ' + item.subject + '. It can coexist with this part of the caller’s account.';
    const pair = s.stage + ':' + claim.id + ':' + item.id,
      previous = s.hypotheses.includes(pair);
    const lights = previous ? s.lights : Math.max(0, s.lights - 1);
    return change(
      {
        lights,
        strikes: s.strikes + Number(!previous),
        assisted: s.assisted || lights === 0,
        hypotheses: previous ? s.hypotheses : [...s.hypotheses, pair],
      },
      lights === 0 ? 'guide' : 'miss',
      why +
        (previous
          ? ' You already logged this pairing.'
          : lights === 0
            ? ' Mic down. Look for the claim and exhibit that describe the very same thing.'
            : '')
    );
  }
  const edit = {
    stage: s.stage,
    speaker: claim.speaker,
    original: claim.text,
    detail: s.pressed.includes(s.stage + ':' + claim.id) ? claim.press : '',
    revised: r.corrected,
    proof: item.title,
  };
  return change({ phase: 'amended', history: [...s.history, edit] }, 'proof', r.corrected);
}
