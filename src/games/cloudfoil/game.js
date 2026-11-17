import { clamp, mix, TAU, poly, line, oval, gradient, caption, panel, meter } from '../kit/field-art.js';

export default {
  title: 'CLOUDFOIL',
  tagline: 'Fold into the wind. Thread twelve sky hoops before the lift runs out.',
  instructions: [
    ['Fly', 'Drag the glider or use the arrow keys to line up with a hoop.'],
    ['Find lift', 'Gold hoops hold thermals. Fly through one to refill lift. Other hoops restore a little.'],
    ['Thread the centre', 'A centred pass earns a precision bonus. Consecutive passes multiply your score.'],
  ],
  keys: [['Arrows / WASD', 'Steer and climb']], touch: [['Drag', 'Steer and climb']],
  create(api) {
    let x = 0, altitude = 0, goalX = 0, goalY = 0, lean = 0, progress = 0, time = 0;
    let lift = 82, score = 0, streak = 0, cleared = 0, passed = 0, ended = false;
    let feedback = 'THREAD THE SKY HOOPS', feedbackTime = 2, pointerHeld = false;
    const keys = new Set(), gates = [], clouds = [];
    for (let i = 0; i < 12; i++) {
      gates.push({ x: i ? (api.rng() - .5) * 260 : 0, h: i ? (api.rng() - .5) * 128 : 0,
        z: 235 + i * 250, thermal: i % 3 === 1 });
    }
    for (let i = 0; i < 52; i++) clouds.push({
      x: (api.rng() - .5) * 1500, h: -90 - api.rng() * 130, z: api.rng() * 1550, r: 24 + api.rng() * 58,
    });
    const camera = (wx, h, z) => {
      const scale = 165 / (165 + z);
      return [240 + (wx - x * .55) * scale, 156 + (130 - h + altitude * .38) * scale, scale];
    };
    function finish() {
      ended = true;
      api.end(score, [['Hoops', cleared + ' / 12'], ['Flight time', Math.floor(time) + 's']], passed === 12 ? 'you folded the sky in your pocket.' : 'one more little thermal?');
    }
    function hoop(c, g) {
      const [gx, gy, s] = camera(g.x, g.h, g.z - progress), r = 51 * s;
      const main = g.thermal ? '#ffdd69' : '#c6fff0', shadow = g.thermal ? '#97532d' : '#177e89';
      oval(c, gx, gy + 1.5 * s, r * 1.08, r, null, shadow, 9 * s);
      oval(c, gx, gy, r * 1.08, r, null, main, 5 * s);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        oval(c, gx + Math.cos(a) * r * 1.08, gy + Math.sin(a) * r, 2.8 * s, 2.8 * s, '#fff7d6');
      }
      if (g.thermal) {
        for (let i = 0; i < 3; i++) {
          const off = ((i / 3 + time * .42) % 1) * 33;
          line(c, [[gx - 8*s, gy + (15-off)*s], [gx, gy + (7-off)*s], [gx + 8*s, gy + (15-off)*s]], '#fff3a0', Math.max(1, 3*s));
        }
      }
    }
    return {
      key(type, code) { if (type === 'down') keys.add(code); else keys.delete(code); },
      pointer(type, px, py) {
        if (type === 'down') pointerHeld = true;
        if (pointerHeld && (type === 'down' || type === 'move')) {
          goalX = clamp((px - 240) * .83, -165, 165); goalY = clamp((250 - py) * .59, -90, 90);
        }
        if (type === 'up' || type === 'cancel') pointerHeld = false;
      },
      demo() { const g = gates[passed]; if (g) { goalX = g.x + 6 * Math.sin(time); goalY = g.h; } },
      update(dt) {
        if (ended) return;
        time += dt; feedbackTime -= dt;
        const has = (a,b) => Number(keys.has(a) || keys.has(b));
        goalX = clamp(goalX + 205*dt*(has('ArrowRight','KeyD')-has('ArrowLeft','KeyA')), -165,165);
        goalY = clamp(goalY + 146*dt*(has('ArrowUp','KeyW')-has('ArrowDown','KeyS')), -90,90);
        lean = mix(lean, clamp((goalX-x)/54,-.85,.85), Math.min(1,5*dt));
        x = mix(x,goalX,Math.min(1,4.3*dt)); altitude = mix(altitude,goalY,Math.min(1,4*dt));
        progress += (74+passed*1.9)*dt; lift -= dt*(3.15+Math.max(0, goalY-altitude)*.045);
        const g = gates[passed];
        if (g && progress >= g.z) {
          const dist = Math.hypot((x-g.x)/1.08,altitude-g.h);
          if (dist < 52) {
            cleared++; streak++; score += Math.round((dist < 19 ? 180 : 100) * (1 + Math.min(5,streak-1)*.2));
            lift = Math.min(100, lift + (g.thermal ? 31 : 7)); api.sound(g.thermal ? 'power' : 'clear');
            feedback = g.thermal ? 'THERMAL  +31 LIFT' : dist < 19 ? 'CENTRE LINE  ×' + streak : 'THREADED  ×' + streak;
          } else { streak = 0; lift -= 12; feedback = 'MISSED THE HOOP'; api.sound('back'); }
          feedbackTime = 1.45; passed++;
        }
        api.hud('Flight',score,'Hoops',cleared + '/12');
        if (lift <= 0 || passed === gates.length) finish();
      },
      draw(c) {
        c.fillStyle = gradient(c,0,480,[[0,'#315f96'],[.39,'#a5d9d8'],[.53,'#ffdab1'],[1,'#6da9b8']]); c.fillRect(0,0,480,480);
        oval(c,360-x*.045,91+altitude*.025,34,34,'#fff0b1');
        for (let j=0;j<3;j++) {
          const ridge = [[0,235]];
          for (let k=-2;k<=18;k++) ridge.push([k*31-x*(.025+j*.018),170+j*13+18*Math.sin(k*1.24+j)+11*Math.cos(k*2.2+j)]);
          ridge.push([480,248]); poly(c,ridge,['#aac6c6','#8fb5bd','#77a1ad'][j]);
        }
        const visible = clouds.map(p => ({...p, d: (p.z-progress%1550+3100)%1550-80})).sort((a,b)=>b.d-a.d);
        for(const p of visible) {
          const [cx,cy,s] = camera(p.x,p.h,p.d), r = p.r*s;
          if(cx < -r*2 || cx>480+r*2 || cy>480+r) continue;
          oval(c,cx,cy,r*1.85,r*.42,'#bed1d0'); oval(c,cx-r*.7,cy-r*.18,r,r*.54,'#eee2ce');
          oval(c,cx+r*.24,cy-r*.3,r*1.13,r*.65,'#fff0d6'); oval(c,cx+r,cy,r,r*.33,'#f9e9d2');
        }
        for(let i=Math.min(passed+4,11); i>=passed; i--) hoop(c,gates[i]);
        const [px,py]=camera(x,altitude,0);
        c.save(); c.translate(px,py); c.rotate(lean*.48);
        line(c,[[-53,13],[-56,29],[-69+Math.sin(time*3)*3,48]],'#fff4df99',1.6);
        line(c,[[53,13],[56,29],[69+Math.sin(time*3)*3,48]],'#fff4df99',1.6);
        poly(c,[[-67,19],[0,-18],[68,19],[16,13],[3,30],[-13,12]],'#304859');
        poly(c,[[-67,15],[0,-20],[-6,9]],'#f27159'); poly(c,[[0,-20],[67,15],[7,8]],'#ffae67');
        poly(c,[[-50,10],[-39,5],[-12,4],[-8,6]],'#fff1c6'); poly(c,[[38,3],[50,9],[13,6],[8,3]],'#fff1c6');
        poly(c,[[0,-20],[7,10],[2,25],[-6,9]],'#fff3c9'); c.restore();
        panel(c,15,16,122,42,'#213f51e8'); caption(c,'WING LIFT',27,30,'#fff1d2',15,'left');
        meter(c,27,41,98,lift/100,lift<24?'#ff8976':'#fcd277','#536e72');
        if(feedbackTime>0) { panel(c,115,421,250,36,'#203e4be8'); caption(c,feedback,240,439,'#fff2d7',16); }
      },
    };
  },
};
