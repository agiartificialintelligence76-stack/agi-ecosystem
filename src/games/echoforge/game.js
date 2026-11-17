import { workshop } from './workshop.js';
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
  tagline: 'Two hammers. Five commissions. Draw out the glowing notes, then quench the metal at its tempering point.',
  instructions: [
    ['Read the score', 'Marks travel left. Strike when their centers reach the white line.'],
    ['Pick the hammer', 'Copper strikes diamonds. Brass strikes circles. Hold a long bar until its tail reaches the line, then release.'],
    ['Finish the order', 'Each hit heats the work. Quench in the gold band for a tempered piece. At full heat, dunk the hammers to keep striking.'],
  ],
  keys: [['A / ←', 'Copper hammer'], ['L / →', 'Brass hammer'], ['Space / Q', 'Quench']],
  touch: [['Tap or hold a metal pad', 'Strike or draw a long note'], ['Tap Quench', 'Temper and cool']],
  create(api) {
    let order = 0, beat, notes, hit, score = 0, combo = 0, best = 0, perfect = 0, time = 0;
    let sparks = [], swing = [0,0], feedback, feedbackTime, finishDelay = 0, ended = false, cleared = 0;
    let heat=24, tempered=0, longHits=0, steam=0, locked=false, holding=null, pointerLane=null;
    function quench() {
      if (ended || finishDelay>0 || steam>.6) return;
      if (heat>=62 && heat<=86) {
        tempered++; score+=95+combo*6; feedback='Tempered!'; api.sound('clear');api.haptic(20);
      } else {feedback=locked?'Hammers cooled':'Cold quench'; combo=0;api.sound('drop');}
      feedbackTime=.85;steam=1;heat=18;locked=false;
      api.hud('Score',score,'Order',`${order+1}/${ORDERS.length}`);
    }
    function lift(lane) {
      if(!holding || holding.lane!==lane)return;
      const timing=Math.abs(beat-holding.beat-holding.duration);
      if(timing<=.28) {longHits++;score+=115;heat=Math.min(100,heat+5);grade('Drawn true!',lane,21);api.sound('combo');}
      else {combo=0;feedback='Short draw';feedbackTime=.65;}
      holding=null;api.hud('Score',score,'Order',`${order+1}/${ORDERS.length}`);
    }
    const sparkRng = () => Math.sin(++sparkSerial * 12.9898) ** 2;
    let sparkSerial = 0;
    function commission() {
      const pattern = ORDERS[order][2];
      const invert=order>0 && api.rng()<.5;
      notes = [...pattern].flatMap((lane, i) => lane === '.' ? [] : [{ beat:i, lane:Number(lane) ^ Number(invert), duration:order>0 && pattern[i+1]==='.' && i%4===2 ? .85 : 0, done:false }]);
      beat = -3; hit = 0; heat=24; locked=false; holding=null; feedback = 'Follow the marks'; feedbackTime = 1.6;
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
      if (holding?.lane===lane) return;
      if(locked){feedback='Quench the hammers';feedbackTime=.55;api.sound('error');return;}
      const note = notes.find(n => !n.done && n.lane === lane && Math.abs(n.beat-beat) <= .31);
      if (!note) {
        swing[lane] = .7; combo = 0; api.sound('click'); feedback = 'Off beat'; feedbackTime = .34; return;
      }
      note.done = true; if(note.duration) holding=note; hit++; combo++; best = Math.max(best, combo);
      const precise = Math.abs(note.beat - beat) <= .12;
      perfect += Number(precise);
      score += (precise ? 120 : 70) * (1+Math.min(3,Math.floor(combo/6)));
      grade(precise ? 'Perfect' : 'On beat', lane, precise ? 17 : 8);
      heat=Math.min(100,heat+(precise?9:11));
      if(heat>=100){locked=true;feedback='Hammers hot · quench';feedbackTime=1;}
      if(note.duration){feedback='Hold … release at tail';feedbackTime=.7;}
      api.sound(lane === 0 ? 'bounce' : 'coin'); api.haptic(precise ? 16 : 8);
      api.hud('Score', score, 'Order', `${order+1}/${ORDERS.length}`);
    }
    function end() {
      ended = true;
      api.end(score, [['Commissions', `${cleared} / ${ORDERS.length}`], ['Perfect hits', perfect], ['Best streak', best], ['True tempers', tempered], ['Drawn notes', longHits]],
        cleared === ORDERS.length ? 'you made my whole workshop sing 💜' : 'the embers are warm for another go.');
    }
    function update(dt) {
      if (ended) return;
      time += dt; steam=Math.max(0,steam-dt); feedbackTime -= dt; swing = swing.map(s => Math.max(0, s-dt*5));
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
      if(holding && beat>holding.beat+holding.duration+.29)lift(holding.lane);
      if (beat > 16) {
        const success = hit*2 >= notes.length;
        if (success) { cleared++; score += hit*20; api.hud('Score', score, 'Order', `${order+1}/${ORDERS.length}`); }
        feedback = success ? 'Piece fired!' : 'Metal cooled'; feedbackTime = 2; finishDelay = 1.25;
        api.sound(success ? 'clear' : 'lose');
      }
    }
    function draw(ctx) {
      ctx.fillStyle = '#1e171e'; ctx.fillRect(0,0,480,480);
      workshop(ctx,{time,order,hit,notes,heat,swings:swing,steam,sparks});
      ctx.fillStyle='#211b24'; ctx.fillRect(0,0,480,38);
      text(ctx, ORDERS[order][0].toUpperCase(), 17,25,17,'#f8d9b7');
      text(ctx, ORDERS[order][1]+' BPM', 463,25,16,BRASS,'right');
      ctx.fillStyle='#28212b'; ctx.fillRect(0,192,480,51);
      text(ctx, feedbackTime>0 ? feedback : `${hit} / ${notes.length} strikes`, 19,217,19,'#ffead1');
      text(ctx, combo+' streak', 461,217,17,BRASS,'right');
      ctx.fillStyle='#503844';ctx.fillRect(20,225,440,10);
      ctx.fillStyle='#a5854f';ctx.fillRect(20+440*.62,225,440*.24,10);
      ctx.fillStyle=locked?'#ff6b58':'#ffba71';ctx.fillRect(20,228,heat*4.4,4);
      ctx.fillStyle='#fff6c8';ctx.fillRect(19+heat*4.4,223,3,14);
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
          if(n.lane===lane && n.duration && (!n.done || holding===n) && x<508 && x>-120){
            const end=x+n.duration*pxPerBeat;
            ctx.fillStyle=holding===n?'#fff2b6':col;ctx.fillRect(x,y-5,end-x,10);mark(ctx,lane,end,y,9,col);
          }
          if(!n.done && n.lane===lane && x<508 && x>-28){ mark(ctx,lane,x,y,14,col); mark(ctx,lane,x,y,5,'#422939'); }
        }
      }
      for(let lane=0;lane<2;lane++){
        const x=10+lane*168,col=lane?BRASS:IRON;
        ctx.fillStyle='#110f16';ctx.fillRect(x,377,161,85);ctx.fillStyle=col;ctx.fillRect(x,372+4*swing[lane],161,82);
        ctx.strokeStyle='#704e46';ctx.lineWidth=2;ctx.strokeRect(x+4,377+4*swing[lane],153,70);
        mark(ctx,lane,x+23,405,12,'#47303a');text(ctx,lane?'BRASS':'COPPER',x+42,412,20,'#30222c');text(ctx,lane?'L / →':'A / ←',x+42,436,15,'#523b40');
      }
      const hot=heat>=62 && heat<=86;ctx.fillStyle=hot?'#ffe5a4':locked?'#ffc090':'#99c5c2';ctx.fillRect(347,373,124,82);
      text(ctx,'QUENCH',409,410,19,'#20373f','center');text(ctx,hot?'TEMPER':locked?'HOT!':'SPACE',409,434,15,'#365059','center');
    }
    commission();
    return { update, draw,
      cancelInput(){pointerLane=null;},
      pointer(type,x,y){
        if(type==='down' && y>=363){if(x>=345){quench();return;}pointerLane=Number(x>=176);strike(pointerLane);}
        if((type==='up'||type==='cancel')&&pointerLane!==null){lift(pointerLane);pointerLane=null;}
      },
      key(type,code){
        const lane=['KeyA','ArrowLeft'].includes(code)?0:['KeyL','ArrowRight'].includes(code)?1:null;
        if(lane!==null){if(type==='down')strike(lane);else if(type==='up')lift(lane);}
        if(type==='down'&&['Space','KeyQ'].includes(code))quench();
      },
      demo() {
        if(holding && beat>=holding.beat+holding.duration)lift(holding.lane);
        if(!holding && heat>=72)quench();
        const next=notes.find(n=>!n.done && beat>=n.beat && beat<n.beat+.12);if(next)strike(next.lane);
      },
    };
  },
};
