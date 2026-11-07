// REAL OR AI? (2026-11-08): the rules, with no page in sight (tests/realorai.test.js runs them in Node). Points and
// multipliers, the day's ten photos (the same for everyone on a date), Streak's deck (no repeats, easy ones first), AGI-1's
// own guesses (seeded: as sharp as the photo is easy), a run from its first photo to its last, the player's local
// stats, and the words a share opens X with.
import { rng } from '../kit/fx.js';

export const TOPICS = ['animals', 'food', 'nature', 'city', 'home', 'objects'];
// how a topic reads in a sentence ("your eye for cities: 82%")
export const TOPIC_WORDS = { animals: 'animals', food: 'food', nature: 'nature', city: 'cities', home: 'rooms', objects: 'objects' };
export const CLOCK = 10;                      // seconds for each photo (Streak's clock, and the speed bonus in both modes)
export const HEARTS = 3;                      // Streak's lives
export const DAILY_N = 10;                    // the day's photos
export const MULTS = [[15, 5], [10, 4], [6, 3], [3, 2]];    // in a row → ×
export const AGI_ACCURACY = { 1: 0.75, 2: 0.65, 3: 0.55 };   // how often AGI-1 is right, by the photo's level
export const DAILY_KEEP = 30;                 // days of daily history kept

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const truthOf = (pic) => (pic.ai ? 'ai' : 'real');
export const other = (g) => (g === 'ai' ? 'real' : 'ai');

// ---------- points ----------
export function multFor(streak) {
  for (const [n, m] of MULTS) if (streak >= n) return m;
  return 1;
}
// the next streak that raises the multiplier (null at the top)
export function nextMultAt(streak) {
  let next = null;
  for (const [n] of MULTS) if (n > streak) next = n;
  return next;
}
// the multiplier's band: [from, to) streaks, for the flame meter's ticks
export function multBand(streak) {
  const steps = [0, ...MULTS.map(([n]) => n).reverse()];
  let from = 0;
  for (const s of steps) if (streak >= s) from = s;
  const to = nextMultAt(streak);
  return { from, to, mult: multFor(streak) };
}
// 0 s → +100, the clock's end → +0, linear
export const speedBonus = (t, clock = CLOCK) => Math.round(100 * clamp(1 - t / clock, 0, 1));
// a right answer: (100 + its speed bonus) × the multiplier of the streak it makes
export const pointsFor = (t, streakAfter) => (100 + speedBonus(t)) * multFor(streakAfter);

// ---------- dice from words (the date, a run's seed and a photo's id) ----------
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // a final mix, so near words land far apart
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

// the player's own calendar day, YYYY-MM-DD
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// "Nov 8" from a date key
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDate(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : String(key || '');
}

// ---------- the day's ten ----------
// The same ten for everyone on a date: 4 to 6 AI-made, at least 4 topics (no topic more than 3 times), easy to hard.
// how many of each level a day gets: in proportion to the photos there are (so no photo comes back much more often than
// the others), with at least one easy opener when there is one
export function levelQuota(pool, n) {
  const have = { 1: 0, 2: 0, 3: 0 };
  for (const p of pool) have[[1, 2, 3].includes(p.level) ? p.level : 2]++;
  const total = have[1] + have[2] + have[3];
  const q = { 1: 0, 2: 0, 3: 0 };
  for (const l of [1, 2, 3]) q[l] = Math.min(have[l], Math.floor((n * have[l]) / total));
  if (have[1] && !q[1]) q[1] = 1;
  // the rest by the largest remainders (then the middle level first)
  let missing = n - q[1] - q[2] - q[3];
  const order = [1, 2, 3].sort((a, b) => ((n * have[b]) / total - q[b]) - ((n * have[a]) / total - q[a]) || (a === 2 ? -1 : b === 2 ? 1 : 0));
  while (missing > 0) {
    let added = false;
    for (const l of order) if (missing > 0 && q[l] < have[l]) { q[l]++; missing--; added = true; }
    if (!added) break;
  }
  while (missing < 0) { for (const l of [3, 2, 1]) if (missing < 0 && q[l] > (l === 1 && have[1] ? 1 : 0)) { q[l]--; missing++; } }
  return q;
}
function byLevel(list, r) {
  // easy to hard; the same level in a shuffled order
  const keyed = list.map((p) => ({ p, k: p.level + r.next() * 0.5 }));
  keyed.sort((a, b) => a.k - b.k);
  return keyed.map((x) => x.p);
}
export function dailyPick(pictures, key, n = DAILY_N) {
  const r = rng(hashString(`realorai:daily:${key}`));
  const pool = pictures.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));   // the manifest's order never matters
  if (pool.length <= n) return byLevel(r.shuffle(pool), r);
  const nAI = pool.filter((p) => p.ai).length, nReal = pool.length - nAI;
  const topicsInPool = new Set(pool.map((p) => p.topic)).size;
  const wantTopics = Math.min(4, topicsInPool);
  const quota = levelQuota(pool, n);
  for (let attempt = 0; attempt < 400; attempt++) {
    const relax = attempt >= 300;                 // the last tries drop the level quota (an odd pool)
    const wantAI = clamp(4 + r.int(0, 2), Math.max(0, n - nReal), Math.min(n, nAI));
    const order = r.shuffle(pool.slice());
    const picked = [];
    const lv = { 1: 0, 2: 0, 3: 0 }, topics = {};
    let ai = 0;
    for (const p of order) {
      if (picked.length === n) break;
      if (p.ai ? ai >= wantAI : picked.length - ai >= n - wantAI) continue;
      if (!relax && lv[p.level] >= quota[p.level]) continue;
      if ((topics[p.topic] || 0) >= 3 && topicsInPool >= 4) continue;
      picked.push(p);
      if (p.ai) ai++;
      lv[p.level]++;
      topics[p.topic] = (topics[p.topic] || 0) + 1;
    }
    if (picked.length === n && Object.keys(topics).length >= wantTopics) return byLevel(picked, r);
  }
  return byLevel(r.shuffle(pool).slice(0, n), r);
}

// ---------- Streak's deck ----------
// Every photo once before any comes back. The answer is picked first (about half and half, never more than 3 of the
// same in a row while both are left), then its level: easy ones first, the harder ones mixed in as the run goes on.
// Photos this player has seen the least come first; the ones just played (`avoid`) come last.
export function levelWeights(i) {
  if (i < 4) return [1, 0.12, 0];
  if (i < 10) return [0.5, 0.45, 0.12];
  if (i < 18) return [0.22, 0.45, 0.33];
  return [0.12, 0.38, 0.5];
}
export const MAX_SAME = 3;
export function streakDeck(pictures, seed, { seen = {}, avoid = [] } = {}) {
  const r = rng(seed >>> 0);
  const pools = { ai: { 1: [], 2: [], 3: [] }, real: { 1: [], 2: [], 3: [] } };
  for (const p of r.shuffle(pictures.slice())) pools[truthOf(p)][[1, 2, 3].includes(p.level) ? p.level : 2].push(p);
  const late = new Set(avoid);
  const weight = (p) => (late.has(p.id) ? 1e6 : 0) + (seen[p.id] || 0);
  for (const t of ['ai', 'real']) for (const l of [1, 2, 3]) pools[t][l].sort((a, b) => weight(a) - weight(b));
  const left = (t) => pools[t][1].length + pools[t][2].length + pools[t][3].length;
  const deck = [];
  let ai = 0;
  while (deck.length < pictures.length) {
    const i = deck.length;
    const tail = deck.slice(-MAX_SAME);
    const same = tail.length === MAX_SAME && tail.every((p) => p.ai === tail[0].ai) ? truthOf(tail[0]) : null;
    let t;
    if (!left('ai')) t = 'real';
    else if (!left('real')) t = 'ai';
    else if (same) t = other(same);
    else t = r.next() < clamp(0.5 + (i - ai - ai) * 0.12, 0.2, 0.8) ? 'ai' : 'real';   // leaning to whichever is behind
    const w = levelWeights(i);
    const open = [1, 2, 3].filter((l) => pools[t][l].length);
    // a level whose next photo was seen more often than the others' counts less (fresh photos first)
    const fresh = Math.min(...open.map((l) => weight(pools[t][l][0])));
    const lvl = r.weighted(open.map((l) => ({ l, weight: (w[l - 1] + 1e-4) * 0.25 ** Math.min(4, weight(pools[t][l][0]) - fresh) }))).l;
    deck.push(pools[t][lvl].shift());
    if (t === 'ai') ai++;
  }
  return deck;
}

// ---------- AGI-1 guesses too ----------
// Seeded by the photo and the moment (the day's ten: the same guesses for everyone that day), right about 75 / 65 / 55%
// of the time on easy / medium / hard photos.
export function agiGuess(pic, salt) {
  const r = rng(hashString(`agi1:${salt}:${pic.id}`));
  r.next();
  const right = r.next() < (AGI_ACCURACY[pic.level] ?? AGI_ACCURACY[2]);
  return { right, guess: right ? truthOf(pic) : other(truthOf(pic)) };
}

// ---------- a run ----------
// mode 'streak' (3 hearts, endless) or 'daily' (ten photos, no lives). `deck` is the photos in order; `salt` seeds AGI-1.
export function createRun({ mode = 'streak', deck, salt = 'run', hearts = HEARTS } = {}) {
  return {
    mode, deck: deck.slice(), salt, i: 0, score: 0, streak: 0, bestStreak: 0,
    hearts: mode === 'streak' ? hearts : null, right: 0, wrong: 0, agiRight: 0, fastest: null, answers: [], over: false,
  };
}
export const currentPic = (run) => run.deck[run.i] || null;
// Streak never runs out: more photos are dealt when the deck ends
export function extendDeck(run, more) { run.deck.push(...more); }

// the player's answer: 'ai' | 'real', or null (the clock ran out), after `t` seconds
export function answer(run, guess, t = 0) {
  const pic = currentPic(run);
  if (!pic || run.over) return null;
  const truth = truthOf(pic);
  const timeout = guess !== 'ai' && guess !== 'real';
  const correct = !timeout && guess === truth;
  const her = agiGuess(pic, `${run.salt}:${run.i}`);
  const before = run.streak;
  let pts = 0, mult = 1, bonus = 0;
  if (correct) {
    run.streak += 1;
    mult = multFor(run.streak);
    bonus = speedBonus(t);
    pts = (100 + bonus) * mult;
    run.score += pts;
    run.right += 1;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    if (run.fastest == null || t < run.fastest) run.fastest = t;
  } else {
    run.streak = 0;
    run.wrong += 1;
    if (run.mode === 'streak') run.hearts = Math.max(0, run.hearts - 1);
  }
  if (her.right) run.agiRight += 1;
  const res = {
    pic, i: run.i, guess: timeout ? null : guess, truth, correct, timeout, pts, mult, bonus, t,
    streak: run.streak, streakBefore: before, hearts: run.hearts, her, multUp: correct && mult > multFor(before),
    score: run.score, you: run.right, agi: run.agiRight,
  };
  run.answers.push(res);
  run.i += 1;
  run.over = run.mode === 'streak' ? run.hearts <= 0 : run.i >= run.deck.length;
  res.over = run.over;
  return res;
}

export function summary(run) {
  const n = run.answers.length;
  return {
    score: run.score, right: run.right, wrong: run.wrong, n, bestStreak: run.bestStreak, fastest: run.fastest,
    you: run.right, agi: run.agiRight, accuracy: n ? Math.round((run.right / n) * 100) : 0,
    beat: run.right > run.agiRight ? 'you' : run.right < run.agiRight ? 'agi' : 'tie',
  };
}

// a saved daily in progress (so leaving halfway resumes it, and a peek at the answers can't be undone)
export function snapshot(run) {
  return {
    i: run.i, score: run.score, streak: run.streak, bestStreak: run.bestStreak, right: run.right, wrong: run.wrong,
    agiRight: run.agiRight, fastest: run.fastest,
    a: run.answers.map((x) => [x.pic.id, x.guess || '', x.correct ? 1 : 0, x.pts, Math.round(x.t * 100) / 100, x.her.guess]),
  };
}
export function restore(run, snap) {
  if (!snap || !Array.isArray(snap.a) || snap.a.length !== snap.i || snap.i > run.deck.length) return false;
  for (let k = 0; k < snap.a.length; k++) if (snap.a[k][0] !== run.deck[k].id) return false;
  Object.assign(run, {
    i: snap.i, score: snap.score | 0, streak: snap.streak | 0, bestStreak: snap.bestStreak | 0, right: snap.right | 0,
    wrong: snap.wrong | 0, agiRight: snap.agiRight | 0, fastest: typeof snap.fastest === 'number' ? snap.fastest : null,
  });
  run.answers = snap.a.map(([, guess, correct, pts, t, her], k) => {
    const pic = run.deck[k];
    const truth = truthOf(pic);
    return { pic, i: k, guess: guess || null, truth, correct: Boolean(correct), timeout: !guess, pts, t, her: { guess: her, right: her === truth } };
  });
  run.over = run.i >= run.deck.length;
  return true;
}

// ---------- sharing (the player posts it themselves) ----------
export const shareGrid = (answers) => answers.map((a) => (a.correct ? '🟩' : '🟥')).join('');
// the kit adds the game's address after these words
export const dailyShare = (key, answers, n = DAILY_N) => `REAL OR AI? ${key} · ${answers.filter((a) => a.correct).length}/${n} ${shareGrid(answers)}`;
export const streakShare = (best) => `I spotted ${best} in a row in REAL OR AI? on agi1.app 💜 can you tell?`;

// ---------- the player's eye (local stats) ----------
export function emptyStats() { return { seen: 0, right: 0, bestStreak: 0, fastest: null, topics: {}, pics: {} }; }
export function cleanStats(s) {
  const e = emptyStats();
  if (!s || typeof s !== 'object') return e;
  return {
    seen: Number(s.seen) || 0, right: Number(s.right) || 0, bestStreak: Number(s.bestStreak) || 0,
    fastest: typeof s.fastest === 'number' ? s.fastest : null,
    topics: s.topics && typeof s.topics === 'object' ? s.topics : {}, pics: s.pics && typeof s.pics === 'object' ? s.pics : {},
  };
}
export function recordAnswer(stats, res) {
  const s = stats;
  s.seen += 1;
  if (res.correct) s.right += 1;
  const t = res.pic.topic;
  const row = Array.isArray(s.topics[t]) ? s.topics[t] : [0, 0];
  s.topics[t] = [row[0] + 1, row[1] + (res.correct ? 1 : 0)];
  s.pics[res.pic.id] = (s.pics[res.pic.id] || 0) + 1;
  if (res.correct && (s.fastest == null || res.t < s.fastest)) s.fastest = Math.round(res.t * 100) / 100;
  s.bestStreak = Math.max(s.bestStreak, res.streak);
  return s;
}
export const accuracy = (s) => (s.seen ? Math.round((s.right / s.seen) * 100) : null);
// the topic the player reads best (at least `min` photos of it seen)
export function sharpestTopic(s, min = 5) {
  let best = null;
  for (const [t, row] of Object.entries(s.topics || {})) {
    if (!Array.isArray(row) || row[0] < min || !TOPIC_WORDS[t]) continue;
    const pct = Math.round((row[1] / row[0]) * 100);
    if (!best || pct > best.pct || (pct === best.pct && row[0] > best.n)) best = { topic: t, word: TOPIC_WORDS[t], pct, n: row[0] };
  }
  return best;
}
// the daily history: only the last DAILY_KEEP days
export function trimDaily(daily, keep = DAILY_KEEP) {
  const out = {};
  for (const k of Object.keys(daily || {}).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-keep)) out[k] = daily[k];
  return out;
}
// days in a row with a finished daily, ending today or yesterday
export function dailyRun(daily, today) {
  const d = new Date(`${today}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  if (!daily?.[today]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (daily?.[dateKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
