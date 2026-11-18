import records from './pressings.json' with { type:'json' };
import { rng, clamp } from '../kit/fx.js';
export { records };
export const grooves = ['Inside','Middle','Outside'];
export const cuts = { mellow:4, club:3, dub:2 };
export const jumpDuration = .59;

// Arrange each side from measured downbeats and the recording's energy envelope.
// Consecutive stars move at most one groove, so even the dub cut is skateable.
export function press(record, cut, seed) {
  const random = rng(seed), events = [];
  let lane = 1, phrase = 0;
  for (let i = 4 + record.bar; i < record.beats.length - 2;) {
    const energy = Number(record.energy[i]) || 0;
    const scratch = events.length === 4 || (events.length > 6 && !events.at(-1).scratch && random.chance(.11 + energy * .008));
    if (!scratch && events.length && random.chance(.63)) {
      lane += lane === 0 ? 1 : lane === 2 ? -1 : random.sign();
    }
    if (scratch && events.length && record.beats[i] / 1000 - events.at(-1).time < .64) i++;
    if (i >= record.beats.length - 1) break;
    events.push({time:record.beats[i]/1000,beat:i,lane,scratch,energy,chorus:energy >= 6 && phrase < 6});
    phrase = energy;
    i += Math.max(2,cuts[cut] - (energy > 5 && cut === 'club' ? 1 : 0)) + (scratch ? 1 : 0);
  }
  return events;
}

export function setlist(seed, first, mode) {
  const chosen = records.find(r => r.id === first);
  const shuffled = rng(seed).shuffle([...records]);
  if (mode === 'daily') return shuffled.slice(0,1);
  if (mode === 'practice') return [chosen || shuffled[0]];
  return chosen ? [chosen,...shuffled.filter(r => r !== chosen)] : shuffled;
}
export function createSide(record,cut,seed,practice = false) {
  const events = press(record,cut,seed), snapshots = [];
  const fresh = () => ({ score:0,hits:0,misses:0,scrapes:0,chain:0,bestChain:0,damage:0 });
  const s = { record,events,index:0,time:0,lane:1,position:1,lift:-1,spin:2,last:null,ledger:fresh(),finished:false,failed:false };
  function travel(to) {
    const gap = s.lane - s.position;
    s.position += Math.sign(gap) * Math.min(Math.abs(gap),(to-s.time)*5);
    s.time = to;
  }
  const result = kind => { s.last = { kind,time:s.time }; return kind; };
  function shift(direction) { s.lane = clamp(s.lane + direction,0,2); }
  function jump(at = s.time) {
    if (at < s.lift + jumpDuration || s.finished) return false;
    s.lift = at; return true;
  }
  function advance(at,onEvent = () => {}) {
    if (s.finished || at < s.time) return;
    while (s.index < events.length && events[s.index].time <= at) {
      const event = events[s.index];
      snapshots[s.index] = { ...s.ledger };
      travel(event.time);
      const air = event.time - s.lift;
      const airborne = air >= .028 && air <= jumpDuration - .05;
      const hit = event.scratch ? airborne : !airborne && Math.abs(s.position-event.lane)<.31;
      const l = s.ledger;
      if (hit) {
        l.hits++; l.chain++; l.bestChain = Math.max(l.bestChain,l.chain);
        l.score += (event.scratch ? 175 : 100) * (1 + Math.min(3,Math.floor(l.chain / 12)));
        if (l.chain % 22 === 0) l.damage = Math.max(0,l.damage-1);
      } else {
        l.chain = 0; l.misses++; if (event.scratch) l.scrapes++;
        l.damage += event.time < 28 ? 0 : event.scratch ? 2 : 1;
      }
      s.index++;
      onEvent(result(hit ? (event.scratch ? 'clear' : 'star') : event.scratch ? 'scratch' : 'miss'),event);
      if (!practice && l.damage >= 10) { s.finished = s.failed = true; return; }
    }
    travel(at);
    if (at >= record.duration) s.finished = true;
  }
  function rewind() {
    if (s.spin <= 0 || !s.index || s.finished) return false;
    const crossed = events[s.index-1].beat;
    const targetBeat = Math.max(0, Math.floor((crossed - record.bar)/4)*4 + record.bar - 4);
    const from = record.beats[targetBeat]/1000;
    const index = events.findIndex(e => e.time >= from);
    if (index < 0 || index >= s.index) return false;
    s.index = index; s.ledger = {...snapshots[index]}; snapshots.length = index;
    s.time = from; s.lift = -1; s.spin--; s.lane = s.position = events[index].lane;
    result('backspin'); return true;
  }
  return { state:s,shift,jump,advance,rewind };
}
export function grade(ledger) {
  const accuracy = ledger.hits / Math.max(1,ledger.hits+ledger.misses);
  return ledger.hits && !ledger.misses ? 'FULL COMBO' : accuracy >= .95 ? 'A' : accuracy >= .85 ? 'B' : accuracy >= .7 ? 'C' : 'D';
}
