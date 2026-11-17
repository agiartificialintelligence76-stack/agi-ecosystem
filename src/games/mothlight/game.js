import { TAU, clamp, ellipse, line, shape, rect, label, sky, halo } from '../kit/garden-art.js';

const lenses = [
  { name: 'Amber', symbol: '◆', color: '#ffc572', glow: 'rgba(255,181,86,.36)' },
  { name: 'Mint', symbol: '●', color: '#a1efc4', glow: 'rgba(114,244,176,.36)' },
  { name: 'Lilac', symbol: '✦', color: '#deb2ff', glow: 'rgba(201,147,255,.38)' },
];
const species = ['Tiger silk', 'Moon lace', 'Orchid veil', 'Copper eye', 'Jade comet', 'Velvet star'];
const lampX = [84, 240, 396];
const lanternY = [277, 247, 277];

function moth(ctx, x, y, kind, t, scale = 1, bank = 0) {
  const ink = lenses[kind % 3].color;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank);
  ctx.scale(scale * (.68 + .32 * Math.abs(Math.cos(t * 8))), scale);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(1, -5);
    ctx.bezierCurveTo(9, -15, 31, -25, 37, -18);
    ctx.bezierCurveTo(34, -5, 24, 1, 15, 3);
    ctx.bezierCurveTo(28, 7, 18, 18, kind > 2 ? 12 : 5, kind === 4 ? 27 : 14);
    ctx.quadraticCurveTo(1, 10, 1, -5);
    ctx.fill();
    line(ctx, [[4,-3],[16,-7],[28,-15]], '#5a4b62', 1.4);
    ellipse(ctx, 21, -8, kind % 3 === 0 ? 5 : 3, 3, '#514660', -.45);
    ellipse(ctx, 21, -9, 1.4, 1.4, '#fff7d1');
    ellipse(ctx, 11, 6, 3, 2, '#6e6669');
    line(ctx, [[0,-4],[4,-12],[8,-14]], ink, 1.4);
    ctx.restore();
  }
  ellipse(ctx, 0, 1, 2.7, 10, '#4a354b');
  ellipse(ctx, 0, -5, 3.4, 4, '#fff2c3');
  ctx.restore();
}

function scene(ctx, t, stars) {
  sky(ctx, '#13263c', '#46546c');
  halo(ctx, 350, 76, 113, 'rgba(232,239,207,.19)', 'rgba(230,240,210,0)');
  ellipse(ctx, 350, 76, 25, 25, '#f8ebc3');
  ellipse(ctx, 343, 70, 3, 2, '#e7d9b3');
  ellipse(ctx, 357, 85, 5, 3, '#e7d9b3');
  stars.forEach(([x,y,s], i) => ellipse(ctx, x, y, s, s, i % 3 ? '#c0cbd4' : '#fff7ce'));
  for (let layer = 0; layer < 2; layer++) {
    const points = [[0,404]];
    for (let x = 0; x <= 480; x += 8) {
      points.push([x, 253 + layer * 38 + Math.sin(x / 57 + layer) * 18 + Math.cos(x / 17) * 6]);
    }
    shape(ctx, [...points, [480,404]], layer ? '#254549' : '#3b5460');
  }
  for (let i = 0; i < 47; i++) {
    const x = (i * 67) % 501 - 10, y = 379 + (i % 5) * 4;
    const h = 17 + (i * 19) % 70, sway = Math.sin(t * .7 + i) * 3;
    const col = i % 3 ? '#203c40' : '#476b61';
    line(ctx, [[x,y], [x + sway + 2,y-h/2], [x+sway-5,y-h]], col, 2);
    for (let j = 1; j <= 4; j++) {
      const side = j % 2 ? -1 : 1;
      ellipse(ctx, x + side * 5 + sway, y - h*j/5, 7, 2.5, col, side * -.7);
    }
    if (i % 5 === 0) ellipse(ctx, x+sway-5, y-h, 3, 4, '#d5b6c6');
  }
}
export default {
  title: 'MOTHLIGHT',
  tagline: 'Change the lantern glass. See who visits after dark.',
  instructions: [
    ['Watch the visitors', 'Each moth follows a dotted path to a lantern. Its symbol tells you which glass it loves.'],
    ['Turn the glass', 'Tap a lantern to cycle ◆ amber, ● mint, and ✦ lilac. Give the new glass a moment to warm up.'],
    ['Fill the field journal', 'Attract six species before dawn. Unbroken visits and first sightings earn bonuses.'],
  ],
  keys: [['1 / 2 / 3', 'Cycle the left, middle, or right lantern']],
  touch: [['Tap a lantern', 'Cycle its colored glass']],
  create(api) {
    const lights = [0,1,2], warm = [0,0,0], flashes = [0,0,0], visitors = [], journal = new Set();
    const stars = Array.from({length: 43}, () => [api.rng()*480, 43+api.rng()*133, .6+api.rng()]);
    let t = 0, spawnAt = 0, count = 0, points = 0, landed = 0, streak = 0, high = 0, ended = false;
    let note = 'Follow each moth’s symbol to its lamp', noteTime = 3, aiWait = 0;
    function spawn() {
      const lane = count === 0 ? 0 : Math.floor(api.rng()*3);
      const kind = count < 6 ? (count * 5) % 6 : Math.floor(api.rng()*6);
      const travel = 5.4 - Math.min(t / 35, 1.5);
      visitors.push({lane, kind, life:0, travel, startX:clamp(lampX[lane]+(api.rng()-.5)*133,42,438), phase:api.rng()*TAU, landed:false, depart:0});
      count++;
      spawnAt = t + 2.95 - Math.min(t / 52, 1);
    }
    function cycle(lane) {
      if (ended) return;
      lights[lane] = (lights[lane]+1)%3;
      warm[lane] = .38;
      api.sound('tap');
    }
    function position(v) {
      if (v.landed) return [lampX[v.lane]+Math.sin(v.phase)*22,lanternY[v.lane]-22+Math.sin(v.depart*2)*2];
      const p = Math.min(1,v.life/v.travel);
      return [v.startX+(lampX[v.lane]-v.startX)*p+Math.sin(v.phase+v.life*2.2)*14*(1-p), 91 + (lanternY[v.lane]-112)*p + Math.sin(v.phase+v.life*2)*5];
    }
    function update(dt) {
      if (ended) return;
      t += dt;
      warm.forEach((v,i) => warm[i]=Math.max(0,v-dt));
      flashes.forEach((v,i) => flashes[i]=Math.max(0,v-dt));
      noteTime -= dt;
      if (t >= spawnAt && t < 51) spawn();
      for (let i=visitors.length-1;i>=0;i--) {
        const v = visitors[i];
        if (v.landed) {
          v.depart += dt;
          if (v.depart > 1.55) visitors.splice(i,1);
          continue;
        }
        v.life += dt;
        if (v.life < v.travel) continue;
        noteTime = 2;
        if (lights[v.lane] === v.kind%3 && warm[v.lane] <= 0) {
          const fresh = !journal.has(v.kind);
          journal.add(v.kind);
          landed++; streak++; high=Math.max(high,streak);
          const gain = 90+Math.min(5,streak)*10+(fresh?85:0);
          points += gain;
          note = species[v.kind] + (fresh ? ' · first sighting!' : '  +' + gain);
          v.landed = true;
          flashes[v.lane] = .8;
          api.sound(fresh?'merge':'pop');
          api.haptic(10);
        } else {
          streak = 0;
          note = species[v.kind]+' flew on';
          visitors.splice(i,1);
        }
      }
      api.hud('Journal',journal.size+'/6','Dawn',Math.ceil(Math.max(0,56-t))+'s');
      if (t>=56) {
        ended=true;
        api.end(points,[['Species',journal.size+' / 6'],['Visitors',landed],['Best streak',high]],'the night shift has such pretty regulars.');
      }
    }
    function draw(ctx) {
      scene(ctx,t,stars);
      label(ctx,'NIGHT GARDEN',18,25,17,'#dfedd6');
      label(ctx,'FIELD JOURNAL  '+journal.size+'/6',462,25,15,'#dfedd6','right');
      visitors.filter(v=>!v.landed).forEach(v=>{
        const [x,y]=position(v);
        ctx.save();
        ctx.setLineDash([2,7]);
        line(ctx,[[x,y+15],[lampX[v.lane],lanternY[v.lane]-19]],'#94adab',1.6);
        ctx.restore();
      });
      lights.forEach((n,i)=>{
        const x=lampX[i], y=lanternY[i], lens=lenses[n];
        halo(ctx,x,y,77+(flashes[i]*24),lens.glow,'rgba(170,210,170,0)');
        line(ctx,[[x+30,381],[x+30,y-59],[x+25,y-66],[x+3,y-66],[x,y-61],[x,y-43]],'#182e37',5);
        shape(ctx,[[x-24,y-23],[x-19,y+22],[x+19,y+22],[x+24,y-23]],warm[i] ? '#b5b2a7' : lens.color);
        shape(ctx,[[x-30,y-23],[x-17,y-32],[x-9,y-41],[x+9,y-41],[x+17,y-32],[x+30,y-23]],'#182f39');
        line(ctx,[[x-16,y+23],[x+16,y+23]],'#172f38',7);
        line(ctx,[[x-16,y-21],[x-13,y+17]],'#ffffe9',2);
        label(ctx,lens.symbol,x,y,23,'#2b3d48','center');
      });
      visitors.forEach(v=>{
        const [x,y]=position(v), lens=lenses[v.kind%3];
        moth(ctx,x,y,v.kind,v.landed ? t*.22 : t+v.phase,v.landed?.52:.67,Math.sin(v.phase+t)*.13);
        if (!v.landed) {
          ellipse(ctx,x,y-25,13,13,'#203746');
          label(ctx,lens.symbol,x,y-25,17,lens.color,'center');
        }
      });
      rect(ctx,0,384,480,96,0,'#182e36');
      label(ctx, noteTime>0?note:'Watch the symbols above the moths',240,402,17,'#f3ead9','center','Georgia');
      lights.forEach((n,i)=>{
        const x=lampX[i], l=lenses[n];
        rect(ctx,x-68,421,136,46,13,'#304851');
        label(ctx,(i+1)+'  '+l.symbol+' '+l.name,x,444,17,l.color,'center');
      });
    }
    return {update,draw,
      pointer(type,x,y) { if(type==='down' && y>=197 && y<=470) cycle(clamp(Math.floor(x/160),0,2)); },
      key(type,code) { if(type==='down' && /^Digit[123]$/.test(code)) cycle(Number(code.slice(-1))-1); },
      demo(dt) {
        aiWait-=dt;
        if (aiWait>0) return;
        const v=visitors.filter(m=>!m.landed).sort((a,b)=>(a.travel-a.life)-(b.travel-b.life)).find(m=>m.travel-m.life<2.7);
        if(v && lights[v.lane]!==v.kind%3) { cycle(v.lane); aiWait=.22; }
      },
    };
  },
};
