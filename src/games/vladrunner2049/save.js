// Personal records stay on this device. No account, service or global ranking.
export const SAVE_KEY = 'vlad_runner_2049_v1';
export const DEFAULT_SETTINGS = Object.freeze({ music: .35, sfx: .65, shake: true, reducedMotion: false, touch: false });
const number = (v, min, max, fallback) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export const ACHIEVEMENTS = Object.freeze([
  { id: 'contact', name: 'First Contact', detail: 'Defeat your first enforcer.' },
  { id: 'combo', name: 'Main Character Energy', detail: 'Land a 20-hit combo.' },
  { id: 'clean', name: 'Untouchable', detail: 'Clear three encounters without taking a hit in one run.' },
  { id: 'duo', name: 'Better Together', detail: 'Unleash a duo attack.' },
  { id: 'city', name: 'Memories Are Forever', detail: 'Finish the three-district campaign.' },
  { id: 'legend', name: 'Street Legend', detail: 'Score 25,000 in one run.' },
  { id: 'friends', name: 'Partners in Crime', detail: 'Finish the campaign in local co-op.' },
]);
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = (value, max = 1e7) => Math.floor(number(value, 0, max, 0));
const modes = ['story', 'daily', 'endless'];
const difficulties = ['normal', 'story'];
function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}
function cleanRecord(value) {
  const r = object(value);
  if (!modes.includes(r.mode) || !Number.isSafeInteger(r.score) || r.score < 0 || r.score > 1e9
    || typeof r.seed !== 'string' || !r.seed.length || r.seed.length > 128 || /[\x00-\x1f\x7f]/.test(r.seed)
    || typeof r.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(r.at)
    || !validDay(r.at.slice(0, 10)) || !Number.isFinite(Date.parse(r.at))
    || r.difficulty !== undefined && !difficulties.includes(r.difficulty)
    || r.coop !== undefined && typeof r.coop !== 'boolean'
    || r.mode === 'daily' && (!r.seed.startsWith('daily-') || !validDay(r.seed.slice(6)))) return null;
  return { mode: r.mode, seed: r.seed, difficulty: r.difficulty || 'normal', coop: r.coop === true,
    score: r.score, combo: count(r.combo), kills: count(r.kills), seconds: count(r.seconds),
    won: r.won === true && r.mode !== 'endless', at: new Date(r.at).toISOString() };
}
function records(value) {
  return (Array.isArray(value) ? value.slice(0, 512) : []).map(cleanRecord).filter(Boolean);
}
function scope(r) { return `${r.mode}:${r.coop ? 2 : 1}:${r.difficulty}${r.mode === 'daily' ? `:${r.seed}` : ''}`; }
function collectBests(values) {
  const bests = new Map();
  for (const r of values) {
    const key = scope(r), previous = bests.get(key);
    if (!previous || r.score > previous.score || r.score === previous.score && r.at < previous.at) bests.set(key, r);
  }
  // Eight permanent campaign/endless scopes, plus four scopes for each of the latest
  // 31 played UTC daily seeds. Replaying an old daily cannot evict a newer daily.
  const days = new Set([...new Set([...bests.values()].filter(r => r.mode === 'daily').map(r => r.seed))].sort().reverse().slice(0, 31));
  return [...bests.values()].filter(r => r.mode !== 'daily' || days.has(r.seed));
}
function cleanSave(value) {
  const raw = object(value), s = object(raw.settings), recent = records(raw.records);
  return { settings: { music: number(s.music,0,1,.35), sfx: number(s.sfx,0,1,.65), shake: s.shake !== false, reducedMotion: s.reducedMotion === true, touch: s.touch === true },
    records: recent.slice(0, 24), bests: collectBests([...records(raw.bests), ...recent]),
    achievements: ACHIEVEMENTS.map(a => a.id).filter(id => Array.isArray(raw.achievements) && raw.achievements.slice(0, 128).includes(id)),
    runs: count(raw.runs) };
}
export function readSave(storage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    return cleanSave(typeof raw === 'string' && raw.length <= 300000 ? JSON.parse(raw) : {});
  } catch { return cleanSave({}); }
}
export function writeSave(storage, save) {
  try { if (typeof storage?.setItem !== 'function') return false; storage.setItem(SAVE_KEY, JSON.stringify(cleanSave(save))); return true; }
  catch { return false; }
}
export function recordRun(save, state, at = new Date().toISOString()) {
  if (!save || typeof save !== 'object' || !['victory', 'gameover'].includes(state?.status)) return { record: null, unlocked: [] };
  const stats = object(state.stats);
  const record = cleanRecord({ mode: state.mode, seed: state.seed, difficulty: state.difficulty, coop: state.coop,
    score: typeof state.score === 'number' ? Math.floor(state.score) : NaN, combo: state.maxCombo, kills: stats.kills,
    seconds: typeof state.elapsed === 'number' ? Math.round(state.elapsed) : 0, won: state.status === 'victory', at });
  if (!record) return { record: null, unlocked: [] };
  Object.assign(save, cleanSave(save));
  const unlocked = [];
  const conditions = { contact: record.kills > 0, combo: record.combo >= 20, clean: number(stats.noHitWaves, 0, 1e7, 0) >= 3,
    duo: number(stats.duos, 0, 1e7, 0) > 0, city: record.won, legend: record.score >= 25000, friends: record.won && record.coop };
  for (const [id, met] of Object.entries(conditions)) if (met && !save.achievements.includes(id)) { save.achievements.push(id); unlocked.push(id); }
  save.records = [record,...save.records].slice(0,24); save.bests = collectBests([...save.bests, record]); save.runs = Math.min(1e7, save.runs + 1);
  return { record, unlocked };
}
export function bestRecord(save, mode, { seed, coop = false, difficulty = 'normal' } = {}) {
  const key = scope({ mode, seed, coop: coop === true, difficulty });
  return collectBests([...records(save?.bests), ...records(save?.records)]).find(r => scope(r) === key) || null;
}
export function dailySeed(now = new Date()) { return `daily-${now.toISOString().slice(0,10)}`; }
