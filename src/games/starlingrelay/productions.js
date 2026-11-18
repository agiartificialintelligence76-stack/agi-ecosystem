export const acts = [
  {
    name: 'First rehearsal',
    color: '#ffb6be',
    ink: '#982f55',
    lesson: 'Read the marks left to right. Each card takes one beat.',
  },
  {
    name: 'Encores',
    color: '#ffc56d',
    ink: '#9c4a22',
    lesson: 'Put a phrase between Open and ×2 or ×3. The whole phrase plays again.',
  },
  {
    name: 'Routine book',
    color: '#a5e5cb',
    ink: '#305956',
    lesson: 'Write a phrase in Dance A. Place a Call A card anywhere you want it back.',
  },
  {
    name: 'Lighting desk',
    color: '#b4c9ff',
    ink: '#43558f',
    lesson: 'A light cue chooses its first action in sun, its second in moonlight.',
  },
  {
    name: 'Second billing',
    color: '#e4b2ff',
    ink: '#753d91',
    lesson: 'Handoff directs the other performer. The cat has her own paw-print pose.',
  },
];
export const tokens = {
  S: ['Step', '↑'],
  L: ['Turn left', '↶'],
  R: ['Turn right', '↷'],
  B: ['Bow', '★'],
  W: ['Rest', '·'],
  K: ['Handoff', '⇄'],
  P: ['Paw pose', '♧'],
  '(': ['Open phrase', '['],
  2: ['Close ×2', ']₂'],
  3: ['Close ×3', ']₃'],
  '@': ['Call A', 'Ⓐ'],
};
// The blocking and lighting notation are the choreographer's handwritten scores.
// Spaces separate musical phrases. A lowercase light cue has two actual actions.
const library = [
  ['The Missing Bow', 'S B', 'Add Bow after her entrance. Then run the show.'],
  ['On Your Mark', 'SSB', 'Cross both floor marks before the bow.'],
  ['Facing Front', 'SRB', 'Pivot toward the front row at the end of the apron.'],
  ['Crossing', 'SBSLB', 'Play a bow on each of the two painted crosses.'],
  ['Beat Four', 'SSWB', 'Hold that last beat before the spot comes on.'],
  ['Downstage', 'SRS BSLB', 'Take the corner around the flat, then bow to each wing.'],
  ['Wrong Wing', 'LSSRSB', 'Enter stage left. Face the middle for the last mark.'],
  ['First Night', 'SB RSB LSSB', 'Three spots, in order. Save that final bow.'],
  ['Again', 'SBSBSB W', 'Play the two-card step and bow three times, then rest.'],
  ['Waltz', 'SRS SRS SRS B', 'Three copies of the traveling waltz bring her home.'],
  ['Four Corners', 'SSR SSR SSR SSR B', 'Follow the four sides of the little paper square.'],
  ['Held Note', 'S WWWW B', 'The light takes four beats to warm up.'],
  ['False Repeat', 'SSLB SSLB SSLB RSB', 'The last bow belongs to the coda.'],
  ['Small Stage', 'SBR SBR SBR SBR', 'Bow at every edge. The floor is smaller than it looks.'],
  ['Offbeat', 'W RSLB RSLB RSLB W', 'Rest one beat at each end of the dance.'],
  ['Standing Ovation', 'SLB SLB SLB RS RS RS B', 'The entrance and the exit have different phrases.'],
  ['My Entrance', 'SRSLB L SRSLB', 'A named entrance works from either direction.'],
  ['Opposite Wings', 'SSLRB RSW SSLRB', 'Different starting positions. The same exit steps.'],
  ['One Bow Short', 'SRSL W SRSL B SRSL W', 'Save a little room between visits to the routine.'],
  ['Three Entrances', 'SSRB WS SSRB LS SSRB', 'Play three returns with two different linking gestures.'],
  ['Dress Change', 'SLSB RBR SLSB WW SLSB', 'Change which way the same dance faces the house.'],
  ['Short Script', 'SRS SRS B L SRS SRS B', 'An encore can live inside the routine book.'],
  ['Reprise', 'SLBR SLBR W RSB RSB SLBR', 'Give the returning entrance a name, then loop the exit.'],
  ['House Routine', 'SRSB RSW SRSB SSL SRSB RSB', 'The middle belongs to the named dance.'],
  ['Warm Spotlight', 'SyB', 'Under sun: bow. Under moon: stay for one breath.'],
  ['Cold Shoulder', 'Sx SB', 'Sun moves forward. Moon turns right. Check both plots.'],
  ['Double Cast', 'ySR ySL B', 'A colored cue changes two entrances on the same strip.'],
  ['Light Change', 'SWy SxB', 'Read the lamp before you spend its beat.'],
  ['Mirror Lamp', 'xSB yLS xSB', 'The second crew reverses the first crew’s lamps.'],
  ['Mark in Shadow', 'ySLS xSLS B', 'Each branch meets the same line of steps.'],
  ['Repeat Cue', 'SxB SxB SxB yW', 'The encore carries the light check inside it.'],
  ['Dress Run', 'yRSB xSW yRSB zSB', 'Three lighting rehearsals. Keep one score for all three.'],
  ['Second Billing', 'KSP', 'Pass the cue to the cat, walk to her stool, leave a paw print.'],
  ['Your Turn', 'SK SP KSB', 'Pass to the cat for her line, then bring AGI-1 back.'],
  ['Shared Light', 'SSB KSLP KRB', 'The resting performer holds her floor mark.'],
  ['Paw Print', 'K SRP SRP SRP K B', 'Only the cat signs the sharpest chalk marks.'],
  ['Understudy', 'SRSL K SRSL P K B', 'Both performers can use the same walking routine.'],
  ['Two Spotlights', 'SxB K SxP K yB', 'The lighting plot follows the dancer who owns the cue.'],
  ['Curtain Gap', 'SSLB K RSP K SSLB K LP', 'Make room for a second entrance under the flats.'],
  ['Closing Night', 'yRSB K SxP SxP K yRSB B', 'Both performers, a traveling refrain and two lighting crews.'],
  ['After the Flowers', 'SLWB K SRP K SLWB RSL SLWB', 'One last curtain before the house lights come up.'],
  ['Midnight Revival', 'xSB K SyP K xSB WW xSB', 'Two returning stars share a final switch of scenery.'],
];
export const branches = { y: '?BW', x: '?SR', z: '?LS' };
export const productions = library.map(([name, notation, direction], index) => {
  const act = Math.min(4, Math.floor(index / 8));
  const beats = [...notation.replaceAll(' ', '')].map((x) => branches[x] || x);
  return {
    id: index + 1,
    name,
    act,
    beats,
    direction,
    plots: index === 31 ? 3 : act >= 3 ? 2 : 1,
    first: index === 0 ? ['S'] : [],
  };
});
export const atomicInk = (code) => (code[0] === '?' ? 4 : 1);
export function cueName(code) {
  if (code?.startsWith('?')) return 'Sun ' + tokens[code[1]][0] + ' / moon ' + tokens[code[2]][0];
  return tokens[code]?.[0] || '';
}
export function cueGlyph(code) {
  if (code?.startsWith('?')) return tokens[code[1]][1] + '/' + tokens[code[2]][1];
  return tokens[code]?.[1] || '';
}
export function lighting(scene, beat, plot) {
  const base = (((beat * 17 + Math.floor(beat / 3) * 5 + scene.id * 11 + (scene.lightSeed || 0)) % 7) + 7) % 7 < 4;
  return plot === 0 ? base : plot === 1 ? !base : (beat + scene.id) % 3 === 0;
}
export function playCue(code, sun) {
  return code[0] === '?' ? code[sun ? 1 : 2] : code;
}
export function deck(scene) {
  const available = new Set(scene.beats.flatMap((code) => (code[0] === '?' ? [code, code[1], code[2]] : [code])));
  if (scene.act >= 1) for (const op of ['(', '2', '3']) available.add(op);
  if (scene.act >= 2) available.add('@');
  return ['S', 'L', 'R', 'B', 'W', 'K', 'P', '(', '2', '3', '@', '?BW', '?SR', '?LS'].filter((c) =>
    available.has(c)
  );
}
