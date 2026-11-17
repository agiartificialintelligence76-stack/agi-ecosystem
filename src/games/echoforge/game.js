import { TAU } from '../kit/fx.js';

const IRON = '#ff9659', BRASS = '#f8dc78', STEEL = '#a4ece6';
const ORDERS = [
  ['Bell tongue', 82, '0.1.0.1.001.0.1.'],
  ['Lantern hook', 90, '0.1.00.1.10.0.1.'],
  ['Star compass', 98, '0.1.010.11.01.0.'],
  ['Music box', 106, '00.101.01.10.101'],
  ['Golden orrery', 112, '0.1011.001.10101'],
];
const targetX = 106, tracks = [272, 330], pxPerBeat = 76;
function polygon(ctx, points, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); ctx.fill();
}
function text(ctx, words, x, y, size, color, align = 'left') {
  ctx.font = `bold ${size}px "AK Mono", monospace`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(words, x, y);
}
function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill();
}
function mark(ctx, lane, x, y, size, fill) {
  if (lane === 0) polygon(ctx, [[x,y-size],[x+size,y],[x,y+size],[x-size,y]], fill);
  else disc(ctx, x, y, size * .9, fill);
}
export default {
  title: 'ECHO FORGE',
  tagline: 'Two hammers. Five commissions. Catch the metal on the beat.',
  instructions: [
    ['Read the score', 'Marks travel left. Strike when their centers reach the white line.'],
    ['Pick the hammer', 'Copper strikes diamonds. Brass strikes circles. Linked hits raise your multiplier.'],
    ['Finish the order', 'Hit at least half the notes to fire each piece and reach a faster commission.'],
  ],
  keys: [['A / ←', 'Copper hammer'], ['L / →', 'Brass hammer']],
  touch: [['Tap the copper or brass pad', 'Strike its lane']],
  create(api) {
    let order = 0, beat, notes, hit, score = 0, combo = 0, best = 0, perfect = 0, time = 0;
    let sparks = [], swing = [0,0], feedback, feedbackTime, finishDelay = 0, ended = false, cleared = 0;
    const sparkRng = () => Math.sin(++sparkSerial * 12.9898) ** 2;
    let sparkSerial = 0;
    function commission() {
      const pattern = ORDERS[order][2];
      notes = [...pattern].flatMap((lane, i) => lane === '.' ? [] : [{ beat: i, lane: Number(lane), done: false }]);
      beat = -3; hit = 0; feedback = 'Follow the marks'; feedbackTime = 1.6;
      api.hud('Score', score, 'Order', `${order+1}/${ORDERS.length}`);
    }
    function grade(label, lane, strength) {
      feedback = label; feedbackTime = .7; swing[lane] = 1;
      for (let i = 0; i < strength; i++) {
        sparks.push({x: 240, y: 129, vx: (sparkRng()-.5)*300, vy: -45-sparkRng()*145, life: .25+sparkRng()*.4});
      }
    }
    function strike(lane) {
      if (ended || finishDelay > 0) return;
      const note = notes.find(n => !n.done && n.lane === lane && Math.abs(n.beat-beat) <= .31);
      if (!note) {
        swing[lane] = .7; combo = 0; api.sound('click'); feedback = 'Off beat'; feedbackTime = .34; return;
      }
      note.done = true; hit++; combo++; best = Math.max(best, combo);
      const precise = Math.abs(note.beat - beat) <= .12;
      perfect += Number(precise);
      score += (precise ? 120 : 70) * (1+Math.min(3,Math.floor(combo/6)));
      grade(precise ? 'Perfect' : 'On beat', lane, precise ? 17 : 8);
      api.sound(lane === 0 ? 'bounce' : 'coin'); api.haptic(precise ? 16 : 8);
      api.hud('Score', score, 'Order', `${order+1}/${ORDERS.length}`);
    }
    function end() {
      ended = true;
      api.end(score, [['Commissions', `${cleared} / ${ORDERS.length}`], ['Perfect hits', perfect], ['Best streak', best]],
        cleared === ORDERS.length ? 'you made my whole workshop sing 💜' : 'the embers are warm for another go.');
    }
    function update(dt) {
      if (ended) return;
      time += dt; feedbackTime -= dt; swing = swing.map(s => Math.max(0, s-dt*5));
      for (const p of sparks) { p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 280*dt; }
      sparks = sparks.filter(p => p.life > 0);
      if (finishDelay > 0) {
        finishDelay -= dt;
        if (finishDelay <= 0) {
          if (hit*2 < notes.length || order === ORDERS.length-1) end();
          else { order++; commission(); }
        }
        return;
      }
      const previous = beat;
      beat += dt * ORDERS[order][1] / 60;
      if (Math.floor(beat) !== Math.floor(previous) && beat < 16) api.sound('tick');
      for (const n of notes) if (!n.done && beat > n.beat+.31) {
        n.done = true; combo = 0; feedback = 'Miss'; feedbackTime = .45;
      }
      if (beat > 16) {
        const success = hit*2 >= notes.length;
        if (success) { cleared++; score += hit*20; api.hud('Score', score, 'Order', `${order+1}/${ORDERS.length}`); }
        feedback = success ? 'Piece fired!' : 'Metal cooled'; feedbackTime = 2; finishDelay = 1.25;
        api.sound(success ? 'clear' : 'lose');
      }
    }
    function draw(ctx) {
      ctx.fillStyle = '#1e171e'; ctx.fillRect(0,0,480,480);
      const wall = ctx.createRadialGradient(240,128,7,240,128,235);
      wall.addColorStop(0,'#8c513b'); wall.addColorStop(.5,'#49303a'); wall.addColorStop(1,'#271f29');
      ctx.fillStyle = wall; ctx.fillRect(0,0,480,216);
      ctx.strokeStyle = '#211b25'; ctx.lineWidth = 3;
      for (let row=0; row<6; row++) for(let col=-1; col<9; col++) ctx.strokeRect(col*66+row%2*33,row*37,66,37);
      // Furnace bricks frame the moving fire behind the anvil.
      ctx.beginPath(); ctx.arc(240,138,86,Math.PI,TAU); ctx.lineTo(326,180); ctx.lineTo(154,180); ctx.closePath();
      ctx.fillStyle = '#271923'; ctx.fill(); ctx.lineWidth = 11; ctx.strokeStyle = '#b07058'; ctx.stroke();
      ctx.save(); ctx.clip();
      for(let i=0;i<16;i++){
        const x=154+i*12, h=15+14*Math.sin(i*1.8+time*3)+20*Math.sin(i*3.2+time*1.6)**2;
        polygon(ctx,[[x-16,184],[x+2,143-h],[x+15,184]], i%2 ? '#e47145' : '#f7aa51');
      }
      ctx.restore();
      polygon(ctx,[[121,127],[159,126],[172,119],[317,119],[313,138],[277,145],[267,164],[291,174],[290,182],[183,182],[184,175],[208,164],[200,147],[151,143]],'#252a37');
      polygon(ctx,[[121,127],[160,126],[172,119],[317,119],[311,128],[165,133]],'#95a49d');
      const progress = hit/notes.length;
      polygon(ctx,[[201,118],[208,112],[244+progress*30,110],[267+progress*26,114],[259,119]],progress>.65 ? BRASS : IRON);
      for (let lane=0;lane<2;lane++) {
        ctx.save(); ctx.translate(lane ? 346 : 134, 116); ctx.scale(lane ? -1 : 1,1);
        ctx.rotate(-.8+swing[lane]*.77+.04*Math.sin(time*2+lane)); ctx.fillStyle='#af7959'; ctx.fillRect(0,-4,96,8);
        polygon(ctx,[[77,-18],[100,-17],[110,-7],[105,8],[77,11],[72,3]], lane ? BRASS : STEEL);
        ctx.restore();
      }
      for (const p of sparks) {ctx.fillStyle = p.life>.24 ? '#fff194' : '#ff9564'; ctx.fillRect(p.x,p.y,3,5);}
      ctx.fillStyle='#211b24'; ctx.fillRect(0,0,480,38);
      text(ctx, ORDERS[order][0].toUpperCase(), 17,25,17,'#f8d9b7');
      text(ctx, ORDERS[order][1]+' BPM', 463,25,16,BRASS,'right');
      ctx.fillStyle='#28212b'; ctx.fillRect(0,192,480,37);
      text(ctx, feedbackTime>0 ? feedback : `${hit} / ${notes.length} strikes`, 19,217,19,'#ffead1');
      text(ctx, combo+' streak', 461,217,17,BRASS,'right');
      for(let lane=0;lane<2;lane++){
        const y=tracks[lane], col=lane ? BRASS : IRON;
        ctx.fillStyle=lane ? '#352d2a' : '#3a272d'; ctx.fillRect(0,y-25,480,51);
        for(let i=Math.ceil(beat-2);i<=beat+5;i++) {
          const x=targetX+(i-beat)*pxPerBeat; ctx.fillStyle=i%4===0?'#806256':'#554349';ctx.fillRect(x,y-22,2,45);
        }
        ctx.fillStyle='#fffae5';ctx.fillRect(targetX-2,y-25,4,51);
        ctx.strokeStyle=col;ctx.lineWidth=2;ctx.strokeRect(targetX-16,y-18,32,36);
        for(const n of notes) {
          const x=targetX+(n.beat-beat)*pxPerBeat;
          if(!n.done && n.lane===lane && x<508 && x>-28){ mark(ctx,lane,x,y,14,col); mark(ctx,lane,x,y,5,'#422939'); }
        }
      }
      for(let lane=0;lane<2;lane++){
        const x=12+lane*235, col=lane ? BRASS : IRON;
        ctx.fillStyle='#130f18';ctx.fillRect(x,378,220,88);
        ctx.fillStyle=col;ctx.fillRect(x,373+3*swing[lane],220,85);
        ctx.strokeStyle='#5c3f39';ctx.lineWidth=2;ctx.strokeRect(x+5,379+3*swing[lane],210,73);
        mark(ctx,lane,x+33,413,13,'#392832');
        text(ctx,lane?'BRASS':'COPPER',x+59,411,23,'#30222c');
        text(ctx,lane?'L  /  →':'A  /  ←',x+59,437,15,'#523b40');
      }
    }
    commission();
    return { update, draw,
      pointer(type,x,y) { if(type === 'down' && y >= 363) strike(Number(x>=240)); },
      key(type,code) { if(type !== 'down') return; if(['KeyA','ArrowLeft'].includes(code)) strike(0); if(['KeyL','ArrowRight'].includes(code)) strike(1); },
      demo() { const next = notes.find(n=>!n.done && beat>=n.beat && beat<n.beat+.12); if(next) strike(next.lane); },
    };
  },
};
