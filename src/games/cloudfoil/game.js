import { scenery, sprite, clamp, mix, TAU, poly, line, oval, gradient, caption, panel, meter } from '../kit/field-art.js';

import { drawSkyport, drawAurora, drawTail } from './skyport.js';

const vehicle = sprite(new URL('./vehicle.webp', import.meta.url));
const paintScenery = scenery(new URL('./scenery.webp', import.meta.url));

export default {
  title: 'CLOUDFOIL',
  tagline: 'Race the airmail line above a drifting cloud city. Risk the needle gates or ride the warmer, slower route.',
  instructions: [
    ['Fly', 'Tap the next hoop to aim, drag to trim, or use the arrow keys. Gold hoops refill more lift.'],
    ['Choose a line', 'Wide sea-green and gold hoops restore lift. The violet needle beside them is a shortcut. It gives a much larger score and a slipstream.'],
    ['Fold the wings','Switch wing shape with Space or the Fold button. Folded wings fly faster and fit the needles, while open wings give stronger steering and preserve lift.'],
    ['Thread the centre', 'A centred pass earns a precision bonus. Consecutive passes multiply your score.'],
  ],
  keys: [['Arrows / WASD', 'Steer and climb'], ['Space', 'Fold or open wings']], touch: [['Drag', 'Steer and climb'], ['Wing button', 'Fold or open wings']],
  create(api) {
    let x = 0, altitude = 0, goalX = 0, goalY = 0, lean = 0, progress = 0, time = 0;
    let lift = 82, score = 0, streak = 0, cleared = 0, passed = 0, ended = false;
    let feedback = 'THREAD THE SKY HOOPS', feedbackTime = 2, pointerHeld = false;
    let dragX=0,dragY=0,startX=0,startY=0;
    let folded = false, needles = 0, slip = 0, feather = 0;
    const trails = [];
    const keys = new Set(), gates = [], clouds = [];
    for (let i = 0; i < 12; i++) {
      gates.push({ x: i ? (api.rng() - .5) * 260 : 0, h: i ? (api.rng() - .5) * 128 : 0,
        z: 235 + i * 250, thermal: i % 3 === 1 });
    }
    for (let i = 0; i < 52; i++) clouds.push({
      x: (api.rng() - .5) * 1500, h: -90 - api.rng() * 130, z: api.rng() * 1550, r: 24 + api.rng() * 58,
    });
    for (let i=0;i<gates.length;i++) {
      const g=gates[i];
      if(i%3!==0) g.needle={x:g.x+(g.x>0?-1:1)*85,h:g.h*.68+14,z:g.z};
    }
    function changeWing(){folded=!folded;api.sound(folded?'power':'select');}
    const camera = (wx, h, z) => {
      const scale = 165 / (165 + z);
      return [240 + (wx - x * .55) * scale, 156 + (130 - h + altitude * .38) * scale, scale];
    };
    function finish() {
      ended = true;
      api.end(score, [['Hoops', cleared + ' / 12'], ['Needle shortcuts', needles], ['Flight time', Math.floor(time) + 's']], passed === 12 ? 'you folded the sky in your pocket.' : 'one more little thermal?');
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
      if(g.needle){
        const [nx,ny,ns]=camera(g.needle.x,g.needle.h,g.z-progress);
        const points=Array.from({length:7},(_,i)=>[nx+Math.cos(i*TAU/6)*23*ns,ny+Math.sin(i*TAU/6)*23*ns]);
        line(c,points,'#642b68',7*ns);line(c,points,'#ffc7fc',3.5*ns);
        for(const [cx,cy] of points.slice(0,6))oval(c,cx,cy,2.3*ns,2.3*ns,'#fff0dc');
        if(g.z-progress<170)caption(c,'NEEDLE',nx,ny-32*ns,'#483747',Math.max(10,13*ns));
      }
      if (g.thermal) {
        for (let i = 0; i < 3; i++) {
          const off = ((i / 3 + time * .42) % 1) * 33;
          line(c, [[gx - 8*s, gy + (15-off)*s], [gx, gy + (7-off)*s], [gx + 8*s, gy + (15-off)*s]], '#fff3a0', Math.max(1, 3*s));
        }
      }
    }
    return {
      key(type, code) { if (type === 'down') {if(code==='Space'&&!keys.has(code))changeWing();keys.add(code);} else keys.delete(code); },
      pointer(type, px, py) {
        if (type === 'down' && py>405 && px>=308){changeWing();return;}
        if(type==='down'){
          pointerHeld=true;dragX=px;dragY=py;
          const nextGate=gates[passed];
          if(nextGate){
            const targets=nextGate.needle?[nextGate.needle,nextGate]:[nextGate];
            const aim=targets.find(t=>{const [sx,sy,s]=camera(t.x,t.h,t.z-progress);return Math.hypot(px-sx,py-sy)<(t===nextGate?51:23)*s+5;});
            if(aim){goalX=aim.x;goalY=aim.h;}
          }
          startX=goalX;startY=goalY;
        }
        if(pointerHeld&&type==='move'){
          goalX=clamp(startX+(px-dragX)*1.05,-165,165);
          goalY=clamp(startY+(dragY-py)*.85,-90,90);
        }
        if (type === 'up' || type === 'cancel') pointerHeld = false;
      },
      demo() { const g = gates[passed]; if (g) {folded=Boolean(g.needle)&&lift>38;const target=folded?g.needle:g;goalX=target.x;goalY=target.h;} },
      update(dt) {
        if (ended) return;
        time += dt; feedbackTime -= dt;
        const has = (a,b) => Number(keys.has(a) || keys.has(b));
        goalX = clamp(goalX + 205*dt*(has('ArrowRight','KeyD')-has('ArrowLeft','KeyA')), -165,165);
        goalY = clamp(goalY + 146*dt*(has('ArrowUp','KeyW')-has('ArrowDown','KeyS')), -90,90);
        lean = mix(lean, clamp((goalX-x)/54,-.85,.85), Math.min(1,5*dt));
        x = mix(x,goalX,Math.min(1,(folded?3.4:4.8)*dt)); altitude = mix(altitude,goalY,Math.min(1,4*dt));
        slip=Math.max(0,slip-dt);feather=mix(feather,folded?1:0,Math.min(1,6*dt));
        progress += (74+passed*1.9+(folded?19:0)+(slip?27:0))*dt; lift -= dt*((folded?4.3:3.15)+Math.max(0, goalY-altitude)*.045);
        if(!trails.length||progress-trails.at(-1).p>3){trails.push({p:progress,x,h:altitude,wing:feather});if(trails.length>24)trails.shift();}
        const g = gates[passed];
        if (g && progress >= g.z) {
          const dist = Math.hypot((x-g.x)/1.08,altitude-g.h);
          const needle=g.needle&&folded&&Math.hypot(x-g.needle.x,altitude-g.needle.h)<24;
          if (needle) {
            needles++;cleared++;streak++;slip=2.4;score+=300+streak*25;lift=Math.min(100,lift+13);
            feedback='NEEDLE RUN  +'+(300+streak*25);api.sound('combo');api.haptic(18);
          } else if (dist < 52) {
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
        drawAurora(c,time,progress,passed);
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
        if(paintScenery(c,-x*.075,altitude*.082)){
          for(let k=0;k<11;k++){const off=(time*57+k*51)%508,side=k%2?1:-1;
            if(slip>0||k<3)line(c,[[240+side*(127+k%4*13),off],[240+side*(133+k%4*13),off+9+k%3*4]],'#fff5d270',1.2);}
        }
        drawSkyport(c,camera,progress,time);
        for(let i=Math.min(passed+4,11); i>=passed; i--) hoop(c,gates[i]);
        const [px,py]=camera(x,altitude,0);
        drawTail(c,trails,camera,progress,slip>0);
        c.save(); c.translate(px,py); c.rotate(lean*.48);c.scale(1-feather*.5,1+feather*.20);
        line(c,[[-53,13],[-56,29],[-69+Math.sin(time*3)*3,48]],'#fff4df99',1.6);
        line(c,[[53,13],[56,29],[69+Math.sin(time*3)*3,48]],'#fff4df99',1.6);
        if(!vehicle(c,-71,-41,142,86)){
        poly(c,[[-67,19],[0,-18],[68,19],[16,13],[3,30],[-13,12]],'#304859');
        poly(c,[[-67,15],[0,-20],[-6,9]],'#f27159'); poly(c,[[0,-20],[67,15],[7,8]],'#ffae67');
        poly(c,[[-50,10],[-39,5],[-12,4],[-8,6]],'#fff1c6'); poly(c,[[38,3],[50,9],[13,6],[8,3]],'#fff1c6');
        poly(c,[[0,-20],[7,10],[2,25],[-6,9]],'#fff3c9');oval(c,0,-4,4,8,'#4c5f6b','#ffdeb1',1);}c.restore();
        panel(c,15,16,122,42,'#213f51e8'); caption(c,'WING LIFT',27,30,'#fff1d2',15,'left');
        meter(c,27,41,98,lift/100,lift<24?'#ff8976':'#fcd277','#536e72');
        panel(c,315,411,149,53,folded?'#fee3a2':'#23384bec');caption(c,folded?'OPEN WINGS':'FOLD WINGS',389,436,folded?'#393943':'#ffe6bf',16);
        if(feedbackTime>0) { panel(c,11,421,295,36,'#203e4be8'); caption(c,feedback,158,439,'#fff2d7',16); }
      },
    };
  },
};
