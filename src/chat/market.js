// Market moments, in the browser (2026-09-25): watches the live $AGI numbers (src/prices/prices.js sends 'agi:prices' every
// 30 s while the page is open) and tells the chat when AGI-1 has something to say:
//  - the market cap reached a new $200K step above the last one this browser heard about (she names the new market cap).
//    A visitor's first visit only notes where it is, silently. If it has since gone down more than a full step, the next
//    step up is celebrated again (so a market cap wobbling around one step doesn't make her repeat herself);
//  - the 24-hour change is -20% or worse: she's sad. At most once every 12 hours, and again only after it was back above -10%
//    (a first visit in the middle of such a day stays quiet about it too).
// A visitor who comes back hears what changed since their last visit (the newest step, or a bad day). Only after the 18+
// check. Remembered in this browser (agi_market); nothing is sent anywhere. The lines themselves: src/chat/market-lines.js.
import { STEP, DUMP, REARM, milestoneOf, milestoneLine, dumpLine } from './market-lines.js';

const KEY = 'agi_market';
const SAD_GAP = 12 * 3600_000;           // at most one sad moment every 12 hours
const FRESH = 2 * 60_000;                // numbers older than this are ignored

// One look at the numbers: (what this browser remembers, the numbers now) → { state, moment } where moment is null or
// { kind: 'milestone', step, mcap, h24, line } | { kind: 'dump', mcap, h24, line }. Pure, so it's easy to test.
export function marketStep(state, { mcap, h24, now = Date.now() }) {
  const s = { top: null, sadAt: 0, sadArmed: true, ...(state && typeof state === 'object' ? state : {}) };
  if (!(Number.isFinite(mcap) && mcap > 0)) return { state: s, moment: null };
  const step = milestoneOf(mcap);
  const change = Number.isFinite(h24) ? h24 : null;
  if (!Number.isFinite(s.top)) {                                 // first look: just remember where it is
    return { state: { ...s, top: step, sadArmed: change === null || change > DUMP }, moment: null };
  }
  const next = { ...s };
  if (change !== null && change > REARM) next.sadArmed = true;
  if (step > s.top && step >= STEP) {
    next.top = step;
    return { state: next, moment: { kind: 'milestone', step, mcap, h24: change, line: milestoneLine(step) } };
  }
  if (step < s.top - STEP) next.top = step;                       // a full step lower: the next step up counts again
  if (change !== null && change <= DUMP && next.sadArmed && (!s.sadAt || now - s.sadAt > SAD_GAP)) {
    return { state: { ...next, sadAt: now, sadArmed: false }, moment: { kind: 'dump', mcap, h24: change, line: dumpLine(Math.floor(now / 864e5)) } };
  }
  return { state: next, moment: null };
}

// Starts watching. ready(): whether the chat can show a moment right now (after the 18+ check); until then nothing is noted,
// so nobody misses one. onMoment(moment) is called with each moment.
export function startMarketWatch({ ready = () => true, onMoment = () => {} } = {}) {
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: this visit only */ } },
  };
  let memory = store.get();
  addEventListener('agi:prices', (e) => {
    const d = e.detail || {};
    const agi = d.tokens?.AGI;
    if (!agi || d.failures || !(Date.now() - (d.updatedAt || 0) < FRESH) || !ready()) return;
    const { state, moment } = marketStep(store.get() || memory, { mcap: agi.mcap, h24: agi.h24, now: Date.now() });
    memory = state;
    store.set(state);
    if (moment?.line) onMoment(moment);
  });
}
