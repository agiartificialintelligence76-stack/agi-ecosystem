import { clip, mix, TAU, type, line, oval, polygon, gradient, panel, painting } from '../kit/illustration.js';

const scenery = painting(new URL('./scene.webp', import.meta.url));
const specimenSheet = painting(new URL('./specimens.webp', import.meta.url));
const SPECIES = [
  {name:'Ember koi', color:'#ffc284', depth:0, size:46, speed:1.9, run:.52},
  {name:'Moon carp', color:'#d3e1fc', depth:1, size:64, speed:1.55, run:.65},
  {name:'Glass perch', color:'#85e5d4', depth:0, size:36, speed:3.5, run:.44},
  {name:'Violet ray', color:'#dda9ff', depth:1, size:88, speed:2.35, run:.74},
];
export function project(x,z) {
  const zoom=1/(1+z*.92);
  return {x:240+x*zoom, y:156+192*zoom, zoom};
}
function shoal(f,t) {
  return project(f.x+Math.sin(t*.47+f.phase)*23, f.z+Math.cos(t*.31+f.phase)*.12);
}
export function landingDistance(strain, reeling, pulling, braced) {
  const tension = reeling ? (pulling ? (braced?.26:.88) : -.17) : -.73;
  const gain = reeling ? (pulling ? (braced?.22:.065) : .33) : -.045;
  return {tension, gain: gain * (strain > .85 && reeling ? .7 : 1)};
}
function fishArt(c,id,cx,cy,w,h) {
  const col=id%2, row=Math.floor(id/2);
  if (!specimenSheet(c,col*512,row*512,512,512,cx-w/2,cy-h/2,w,h)) {
    oval(c,cx,cy,w*.36,h*.22,SPECIES[id].color);
    polygon(c,[[cx+w*.22,cy],[cx+w*.5,cy-h*.19],[cx+w*.5,cy+h*.19]],SPECIES[id].color);
  }
}
export default {
  title:'LANTERN LAKE',tagline:'Read the water. Choose a fly or a sinking lure. Lean against a running fish and bring its portrait home.',
  instructions:[
    ['Read the rings','Gold rings feed near the surface. Blue rings feed deep. Change the lure at the dock before casting. A precise cast with matching tackle finds larger fish.'],
    ['Wait for the dip','Strike when the float dives. During the fight, hold to reel. Drag the rod to the opposite side of a running fish to turn it, or release to give it line.'],
    ['Fill the field guide','Each fish fights differently. You have six casts. The guide at the dock remembers your longest specimen of each species on this device.'],
  ],
  keys:[['← / →','Choose shoal or lean rod'],['Space','Cast, strike or reel'],['L / G','Change lure / field guide']],
  touch:[['Tap ring','Cast or strike'],['Hold and slide','Reel and lean rod'],['Dock buttons','Lure / field guide']],
  create(api) {
    let t=0, casts=6, score=0, caught=0, selected=0, target=0, phase='aim', timer=0, elapsed=0, bait=0;
    let progress=0, strain=0, held=false, lean=0, cycle=0, size=0, delay=0, accuracy=0, castDepth=0;
    let float={x:240,y:220}, message='', last='', landed=false, bestMark=false, guide=false, bot=0, turns=0;
    let lastPull=false, turned=false;
    const book=new Set(), best=SPECIES.map((_,i)=>api.personalBest?.('fish-'+i)||0);
    const schools=SPECIES.map((s,i)=>({x:(i-1.5)*142,z:.17+s.depth*.86+api.rng()*.36,phase:api.rng()*TAU}));
    const hud=()=>api.hud('Casts',casts,'Catch',score);
    const surge=()=>Math.sin(elapsed*SPECIES[target].speed+cycle);
    const pulling=()=>surge()>1-SPECIES[target].run*1.7;
    const direction=()=>Math.cos((elapsed*SPECIES[target].speed+cycle)*.5)>0?1:-1;
    function finish(ok,why) {
      phase='catch';timer=2.25;held=false;lean=0;landed=ok;last=why;bestMark=false;
      if(ok){
        const pts=Math.round(size*2+turns*12+(1-strain)*24);
        score+=pts;caught++;book.add(target);bestMark=size>best[target];best[target]=Math.max(best[target],size);
        api.rememberBest?.('fish-'+target,size);last=SPECIES[target].name+'   ·   '+size+' cm';api.sound('win');
      } else api.sound('back');
      hud();
    }
    function cast(x,y) {
      if(phase!=='aim')return;
      let nearest=Infinity;
      schools.forEach((f,i)=>{const p=shoal(f,t),d=Math.hypot(p.x-x,(p.y-y)*1.5);if(d<nearest){nearest=d;target=i;}});
      castDepth=SPECIES[target].depth;
      accuracy=clip(1-nearest/60,0,1);
      size=Math.round(SPECIES[target].size*(.63+api.rng()*.43+accuracy*.28+(bait===castDepth?.26:0)));
      selected=target;casts--;hud();phase='cast';timer=.48;elapsed=0;float={x:clip(x,12,468),y:clip(y,160,348)};
      delay=.8+Math.min(2,nearest/40)+(bait===castDepth?0:1.35);
      message=bait===castDepth?'A shadow rises':'A cautious nibble';
      api.sound('drop');
    }
    function press(x,y) {
      if(phase==='aim'){const p=shoal(schools[selected],t);cast(x??p.x,y??p.y);}
      else if(phase==='wait'&&elapsed>.32)finish(false,'The float had only twitched');
      else if(phase==='bite'){
        phase='fight';elapsed=0;progress=.12;strain=.22;cycle=api.rng()*TAU;held=true;lean=0;turns=0;lastPull=false;turned=false;
        api.sound('select');
      }else if(phase==='fight'){held=true;if(x!=null)lean=clip((x-240)/105,-1,1);}
    }
    function guidePage(c) {
      gradient(c,0,0,480,480,['#e8d8b6','#bda57e']);
      type(c,'The lake journal',26,38,30,'#384642','left','Georgia');
      type(c,'Longest fish landed',27,70,16,'#585c51','left');
      SPECIES.forEach((s,i)=>{
        const x=18+(i%2)*226,y=90+Math.floor(i/2)*148;
        panel(c,x,y,217,138,best[i]?'#f0e4c9':'#d4c4a5',6);
        c.save();c.globalAlpha=best[i]?1:.39;fishArt(c,i,x+110,y+49,126,89);c.restore();
        type(c,s.name,x+108,y+98,18,'#354141','center','Georgia');
        type(c,best[i]?best[i]+' cm':(s.depth?'Deep water':'Surface feeder'),x+108,y+119,14,'#535b53');
      });
      panel(c,125,403,230,52,'#30484a');type(c,'Return to the dock',240,430,18);
    }
    hud();
    return {
      update(dt) {
        if(guide||phase==='done')return;t+=dt;elapsed+=dt;
        if(phase==='cast'&&(timer-=dt)<=0){phase='wait';elapsed=0;}
        else if(phase==='wait'&&elapsed>=delay){phase='bite';timer=bait===castDepth?1.65:1.1;api.sound('tick');}
        else if(phase==='bite'&&(timer-=dt)<=0)finish(false,'The fish slipped away');
        else if(phase==='fight'){
          const pull=pulling(),braced=lean*direction()<-.38;
          if(pull&&!lastPull)turned=false;
          if(pull&&held&&braced&&!turned){turns++;turned=true;api.sound('tap');}
          lastPull=pull;
          const v=landingDistance(strain,held,pull,braced);
          strain=clip(strain+v.tension*dt*(pull?size/SPECIES[target].size:1),0,1);
          progress=clip(progress+v.gain*dt,0,1);
          if(strain>=1)finish(false,'The line snapped');else if(progress>=1)finish(true,'');else if(elapsed>23)finish(false,'It slipped the hook');
        }else if(phase==='catch'&&(timer-=dt)<=0){
          if(!casts){phase='done';api.end(score,[['Fish landed',caught+' / 6'],['Species',book.size+' / 4']],'i drew the koi in the margin of my journal.');}
          else {phase='aim';schools[target].phase+=1.6;}
        }
      },
      draw(c) {
        if(guide){guidePage(c);return;}
        gradient(c,0,0,480,480,['#c889a6','#698197','#183d4d']);
        scenery(c,0,0,480,398);
        // Fireflies and drifting bright ripples sit in front of the painted shore.
        for(let i=0;i<14;i++){const x=(i*87.3+Math.sin(t*.37+i)*9)%480,y=103+i*4%71+Math.sin(t*.75+i)*5;
          c.globalAlpha=.35+.25*Math.sin(t*1.5+i);oval(c,x,y,1.8,1.8,'#fff3b1');}c.globalAlpha=1;
        if(phase!=='fight'&&!(phase==='catch'&&landed)){
          schools.forEach((f,i)=>{
            const p=shoal(f,t),w=22+p.zoom*13,s=SPECIES[i], ring=s.depth?'#a5edff':'#ffe0a2';
            c.save();c.globalAlpha=.65;fishArt(c,i,p.x,p.y+3,w*1.32,w*.61);c.restore();
            oval(c,p.x,p.y,w,6+p.zoom*2,null,ring,1.6);
            const r=(t*.52+i*.24)%1;c.globalAlpha=.8-r*.6;oval(c,p.x,p.y,w+r*11,7+r*4,null,ring,1.2);c.globalAlpha=1;
            if(phase==='aim'&&i===selected){polygon(c,[[p.x-5,p.y-17],[p.x,p.y-11],[p.x+5,p.y-17]],ring);}
          });
        }
        if(phase==='fight'){
          gradient(c,0,135,480,249,['#13395200','#174163a6','#173847db']);
          const fx=240+Math.sin(elapsed*SPECIES[target].speed+cycle)*88,fy=239+Math.cos(elapsed*1.9)*17;
          c.save();c.translate(fx,fy);c.rotate(Math.sin(elapsed*2)*.08);fishArt(c,target,0,0,160+progress*76,103+progress*44);c.restore();
          const rod=240+lean*118;
          c.beginPath();c.moveTo(rod,374);c.quadraticCurveTo(rod-5,300,fx-46,fy);c.strokeStyle='#ffdfab';c.lineWidth=1.8;c.stroke();
          line(c,[[226,381],[rod,336],[rod+(fx-rod)*.17,306]],'#392c2d',5);
          if(pulling()){panel(c,130,95,220,30,'#192e3ace');type(c,direction()>0?'←  Brace left':'Brace right  →',240,110,17,'#fff0be');}
        }else if(['cast','wait','bite'].includes(phase)){
          const u=phase==='cast'?clip(1-timer/.48,0,1):1;
          const bx=mix(73,float.x,u),by=mix(335,float.y,u)-Math.sin(u*Math.PI)*78+(phase==='bite'?6:Math.sin(t*4)*2);
          line(c,[[33,381],[68,320],[94,295]],'#604239',5);
          c.beginPath();c.moveTo(94,295);c.quadraticCurveTo((94+bx)/2,Math.min(by,295)-22,bx,by);c.strokeStyle='#ffe8c6aa';c.lineWidth=1.2;c.stroke();
          oval(c,bx,by,5,8,'#f07454','#402d38');oval(c,bx,by-4,4,4,'#fff0c6');
          if(phase==='bite'){panel(c,bx-28,by-42,56,24,'#713449');type(c,'BITE!',bx,by-30,15);}
        }else if(phase==='catch'&&landed){
          panel(c,62,56,356,246,'#f2e3c9f0',8);
          type(c,bestMark?'FIELD GUIDE  ·  NEW RECORD':'FIELD GUIDE',240,80,14,'#79583d');
          fishArt(c,target,240,167,252,149);
          type(c,last,240,264,22,'#354b46','center','Georgia');
        }
        panel(c,0,378,480,102,'#172e3b',0);
        const headline={aim:'Choose a shoal',fight:pulling()?'Turn the fish or give it line':'Reel while the fish rests',cast:'Casting…',wait:message,bite:'Strike now!',catch:last};
        type(c,headline[phase]||'Back to shore',240,400,21,'#ffe5b6','center','Georgia');
        if(phase==='fight'){
          for(const [i,cap,v,col] of [[0,'Reeled',progress,'#70d9d4'],[1,'Tension',strain,'#ff926e']]){
            const x=22+i*222;type(c,cap,x,432,15,'#e8ddc8','left');panel(c,x,451,200,8,'#3c5561',4);if(v>.001)panel(c,x,451,200*v,8,col,4);}
        }else if(phase==='aim'){
          panel(c,15,421,221,46,bait?'#31576c':'#665338');type(c,bait?'⇄  Sinking lure':'⇄  Surface fly',125,444,17);
          panel(c,246,421,218,46,'#304653');type(c,'Field guide  '+best.filter(Boolean).length+'/4',355,444,17);
        }else type(c,phase==='catch'&&landed?'Clean turns  '+turns:phase==='catch'?'Another story for the dock':'Watch the float',240,444,16,'#b5cdd0');
      },
      pointer(a,x,y){
        if(a==='up'||a==='cancel'){held=false;return;}
        if(a==='move'&&held&&phase==='fight'){lean=clip((x-240)/105,-1,1);return;}
        if(a!=='down')return;
        if(guide){if(y>390)guide=false;return;}
        if(phase==='aim'&&y>=416){if(x<240){bait=1-bait;api.sound('select');}else guide=true;return;}
        if(phase!=='aim'||(y>145&&y<373))press(x,y);
      },
      key(a,k){
        if(a==='up'){if(['Space','Enter'].includes(k))held=false;if(['ArrowLeft','ArrowRight'].includes(k))lean=0;return;}
        if(guide){if(['KeyG','Space','Enter','Backspace'].includes(k))guide=false;return;}
        if(phase==='aim'&&k==='KeyG'){guide=true;return;}
        if(phase==='aim'&&k==='KeyL'){bait=1-bait;api.sound('select');}
        if(['ArrowLeft','ArrowRight'].includes(k)){const sign=k==='ArrowRight'?1:-1;if(phase==='aim')selected=(selected+4+sign)%4;else lean=sign;}
        if(['Space','Enter'].includes(k))press();
      },
      demo(dt){bot+=dt;if(phase==='aim'&&bot>.9){selected=(selected+1)%4;bait=SPECIES[selected].depth;press();bot=0;}
        if(phase==='bite'&&timer<1.1)press();
        if(phase==='fight'){lean=-direction();held=!pulling()||strain<.55;}}
    };
  }
};
