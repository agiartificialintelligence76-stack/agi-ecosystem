import { act, recipe, sealPhase, cupCount, ticketBy, step, open, drain } from './counter.js';
import { keys, keyFor, panelFor } from './controls.js';
import { randomizer } from './menu.js';
const style = {
  newbie: {
    think: .88,
    offset: .65,
    work: 1
  },
  steady: {
    think: .47,
    offset: .28,
    work: 2
  },
  expert: {
    think: .245,
    offset: .105,
    work: 2
  },
  demo: {
    think: .115,
    offset: .025,
    work: 2
  }
};
export function barista(profile, seed, layout = 'keyboard') {
  const cfg = style[profile],
    rng = randomizer(seed),
    targets = new Map();
  let wait = 0;
  const timeBy = {
    valves: 0,
    toppings: 0,
    shaker: 0,
    sealer: 0,
    queue: 0
  };
  function plan(s, i) {
    const c = s.cups[i],
      r = recipe(s, i);
    if (!r) return null;
    if (!targets.has(c.target)) {
      const dx = () => cfg.offset * (rng() + rng() - 1);
      targets.set(c.target, {
        tea: r.tea + dx() - .12,
        milk: r.milk + dx() - .09
      });
    }
    return {
      c,
      r,
      aim: targets.get(c.target),
      guest: ticketBy(s, c.target),
      i
    };
  }
  let panel = 'mix';
  function command(s, id, edge = 'down') {
    if (layout === 'keyboard') {
      const key = keyFor[id];
      if (!key) throw Error('No keyboard action for ' + id);
      act(s, keys[key], edge);
      return;
    }
    const next = panelFor(id);
    if (edge === 'down' && next && next !== panel) {
      panel = next;
      wait += .09;
    }
    act(s, id, edge);
  }
  const select = (s, i) => {
    if (s.active !== i) command(s, 'switch');
  };
  function run(s, dt) {
    if (s.phase !== 'open') return;
    wait -= dt;
    if (wait > 0) return;
    const delay = cfg.think * (.73 + .57 * rng());
    wait = delay;
    const cups = Array.from({
      length: Math.min(cupCount(s), cfg.work)
    }, (_, i) => plan(s, i)).filter(Boolean);
    if (!cups.length) {
      timeBy.queue += delay;
      return;
    }
    for (const p of cups) {
      const {
        c,
        aim,
        i
      } = p;
      if (c.tea >= aim.tea && (c.latch || s.held.get('tea') === i)) {
        if (c.latch) {
          select(s, i);
          command(s, 'latch');
        }
        if (s.held.get('tea') === i) command(s, 'tea', 'up');
        timeBy.valves += delay;
        return;
      }
      if (c.milk >= aim.milk && s.held.get('milk') === i) {
        command(s, 'milk', 'up');
        timeBy.valves += delay;
        return;
      }
      if (s.held.get('shaker') === i && c.shake >= p.r.shake) {
        command(s, 'shaker', 'up');
        timeBy.shaker += delay;
        return;
      }
    }
    if (profile === 'expert' || profile === 'demo') cups.sort((a, b) => a.guest.left - b.guest.left);else cups.sort((a, b) => Number(b.i === s.active) - Number(a.i === s.active));
    if (cfg.work > 1 && s.gear.batch && cups.length === 2 && cups.every(p => !p.c.latch && p.c.base === p.r.base && p.c.tea < p.aim.tea - .4) && cups[0].r.base === cups[1].r.base) {
      command(s, 'batch');
      timeBy.valves += delay;
      return;
    }
    for (const {
      c,
      r,
      aim,
      i
    } of cups) {
      select(s, i);
      if (c.base !== r.base && c.tea < .12) {
        command(s, 'leaf');
        timeBy.valves += delay;
        return;
      }
      const teaching = s.day === 0 && s.served === 0 && r.id === 0 && (s.mode === 'week' || s.mode === 'bench');
      if (c.tea < aim.tea && !c.latch && s.held.get('tea') !== i) {
        if (cfg.work > 1) command(s, 'latch');else command(s, 'tea');
        timeBy.valves += delay;
        return;
      }
      if (!teaching && c.milk < aim.milk && !s.held.has('milk') && (cfg.work > 1 || c.tea >= aim.tea)) {
        command(s, 'milk');
        timeBy.valves += delay;
        return;
      }
      if (c.pearl < r.pearl) {
        command(s, 'pearl');
        timeBy.toppings += delay;
        return;
      }
      if (c.star < r.star) {
        command(s, 'star');
        timeBy.toppings += delay;
        return;
      }
      if (c.ice !== r.ice) {
        command(s, 'ice');
        timeBy.toppings += delay;
        return;
      }
      if (c.shake < r.shake && c.tea + c.milk > .7 && !s.held.has('shaker')) {
        command(s, 'shaker');
        timeBy.shaker += delay;
        return;
      }
      const ready = (teaching ? c.assisted : c.tea >= aim.tea && c.milk >= aim.milk) && c.shake >= r.shake && !c.latch && s.held.get('tea') !== i && s.held.get('milk') !== i;
      if (ready && sealPhase(s, c).ready) {
        if (profile === 'expert' && !sealPhase(s, c).clean && c.assisted === false && c.tea + c.milk > 0) continue;
        command(s, 'seal');
        timeBy.sealer += delay;
        return;
      }
    }
    timeBy.valves += delay;
  }
  return {
    run,
    timeBy
  };
}
export function simulate(profile, seed, mode = 'endless', day = 0, layout = 'keyboard') {
  const s = open(day, mode, seed),
    bot = barista(profile, seed * 17 + 33, layout),
    dt = 1 / 30;
  for (let f = 0; f < 60 * 30 * 18 && s.phase === 'open'; f++) {
    bot.run(s, dt);
    step(s, dt);
    drain(s);
  }
  return {
    seconds: s.time,
    served: s.served,
    lost: s.lost,
    score: s.score,
    perfect: s.perfect,
    streak: s.bestStreak,
    batches: s.batched,
    peak: s.peakQueue,
    early: s.earlySeals,
    complete: s.phase === 'closed' && s.served > 0,
    waste: Object.entries(bot.timeBy).sort((a, b) => b[1] - a[1])[0][0]
  };
}

// The attract reel is a real two-handed service. The first seal and the second cup's
// pearl land inside the gallery capture interval; every operation also exists on the dock.
export function openingRush(seed) {
  const nextGuest = barista('demo',seed);
  const moves = [
    [.20,'leaf'], [.50,'tea'], [.90,'milk'], [1.30,'switch'], [1.50,'leaf'], [1.80,'latch'],
    [2.43,'milk','up'], [2.55,'tea','up'], [2.72,'switch'], [3.05,'pearl'], [3.45,'pearl'],
    [3.95,'shaker'], [4.48,'shaker','up'], [4.52,'switch'], [4.55,'latch'], [4.68,'milk'],
    [5.46,'milk','up'], [5.58,'switch'], [6.42,'seal'], [6.64,'switch'], [6.86,'pearl'],
    [7.15,'ice'], [7.48,'shaker'], [8.30,'shaker','up'], [9.00,'seal']
  ];
  let cursor = 0;
  return {run(s,dt) {
    if(s.time>9.4){nextGuest.run(s,dt);return;}
    while(cursor<moves.length&&s.time+dt*.5>=moves[cursor][0]){
      const [,id,phase='down']=moves[cursor++];act(s,id,phase);
    }
  }};
}
