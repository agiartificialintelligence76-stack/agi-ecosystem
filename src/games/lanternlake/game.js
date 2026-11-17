import { clip, mix, TAU, type, line, oval, polygon, gradient, panel } from '../kit/illustration.js';

const SPECIES = [
  ['Ember koi','#ff9a72',1], ['Moon carp','#d8d1b1',1.3], ['Glass perch','#76ded4',1.55], ['Violet ray','#dca7ef',1.8],
];
export function project(x,z) {
  const zoom=1/(1+z*.92);
  return { x:240+x*zoom, y:154+196*zoom, zoom };
}
function school(f,t) { return project(f.x+Math.sin(t*.47+f.phase)*29, f.z+Math.cos(t*.31+f.phase)*.13); }
export default {
  title:'LANTERN LAKE',tagline:'A quiet dock, six casts, and something glowing just below the surface.',
  instructions:[['Find a shoal','Tap a ring on the lake to cast. With a keyboard, cycle shoals with the arrows and press Space.'],['Set the hook','Strike when the float dips and BITE appears. The better the cast, the sooner the bite.'],['Play the fish','Hold to reel while the fish rests. Ease off when it pulls to cool the line. Land six casts before heading home.']],
  keys:[['← / →','Choose shoal'],['Space','Cast, hook or hold to reel']],
  touch:[['Tap a ring','Cast or hook'],['Hold / release','Reel or ease the line']],
  create(api) {
    let t=0, casts=6, score=0,caught=0, selected=0, phase='aim', timer=0, stageTime=0, held=false, progress=0, strain=0, target=0;
    let float={x:240,y:200}, takeoff, delay=0, fishPhase=0, message='', last='', bot=0;
    const stars=Array.from({length:52},()=>[api.rng()*480,api.rng()*104,api.rng()]);
    const fish=Array.from({length:4},(_,i)=>({x:(i-1.5)*137, z:.18+api.rng()*1.6, phase:api.rng()*TAU}));
    const book=new Set();
    function hud(){api.hud('Casts',casts,'Catch',score);}
    function finish(ok,why) {
      phase='catch';timer=1.8;held=false;last=why;
      if(ok){const pts=Math.round(90*SPECIES[target][2]+(1-strain)*20);score+=pts;caught++;book.add(target);last=SPECIES[target][0]+'  +'+pts;api.sound('win');}
      else api.sound('back');
      hud();
    }
    function cast(x,y) {
      if (phase!=='aim') return;
      let best=Infinity;
      fish.forEach((f,i)=>{const p=school(f,t),d=Math.hypot(p.x-x,(p.y-y)*1.5);if(d<best){best=d;target=i;}});
      casts--;hud();selected=target;float={x:clip(x,14,466),y:clip(y,162,348)};takeoff={...float};
      delay=best>67?3.8: .75+best/34;phase='cast';timer=.48;stageTime=0;api.sound('pop');
      message=best>67?'Quiet water':'A shadow is circling';
    }
    function press(x,y) {
      if(phase==='aim'){const p=school(fish[selected],t);cast(x??p.x,y??p.y);return;}
      if(phase==='bite'){phase='fight';stageTime=0;progress=.1;strain=.23;fishPhase=api.rng()*TAU;held=true;api.sound('select');return;}
      if(phase==='fight'){held=true;return;}
      if(phase==='wait'&&stageTime>.3)finish(false,'Too early · the shoal scattered');
    }
    const pulling=()=>Math.sin(stageTime*2.6*SPECIES[target][2]+fishPhase)>.25;
    hud();
    return {
      update(dt){
        t+=dt;stageTime+=dt;
        if(phase==='cast'){if((timer-=dt)<=0){phase='wait';stageTime=0;}}
        else if(phase==='wait'&&stageTime>delay){phase='bite';timer=1.45;api.sound('tick');}
        else if(phase==='bite'&&(timer-=dt)<=0)finish(false,'The float came back empty');
        else if(phase==='fight'){
          const pull=pulling();strain=clip(strain+(held?(pull?.72*SPECIES[target][2]:-.11):-.74)*dt,0,1);
          progress=clip(progress+(held?(pull?.13:.32):-.065)*dt,0,1);
          if(strain>=1)finish(false,'The line snapped');else if(progress>=1)finish(true,'');else if(stageTime>17)finish(false,'It slipped the hook');
        }else if(phase==='catch'&&(timer-=dt)<=0){
          if(casts<=0){phase='done';api.end(score,[['Fish landed',caught+' / 6'],['Species',book.size+' / 4']],'can we stay for one more sunset?');}
          else {phase='aim';fish[target].phase+=1.6;}
        }
      },
      draw(c) {
        gradient(c,0,0,480,161,['#242b50','#975f7d','#ffbf90']);
        for(const [x,y,a] of stars)oval(c,x,y,1+a,1+a,'#fff1d9a0');
        oval(c,344,69,31,31,'#ffcf98');oval(c,344,69,38,38,null,'#ffcc8b45');
        for(let j=0;j<3;j++){let peaks=[[0,160]];for(let x=-12;x<=500;x+=12){const v=Math.sin(x*.019+j*1.6)*19+Math.sin(x*.048+j)*9;peaks.push([x,110+j*14+v]);}peaks.push([500,162]);polygon(c,peaks,['#956b86','#775977','#4a455e'][j]);}
        gradient(c,0,154,480,226,['#bb818b','#715e7d','#34536b','#24495c']);
        for(let i=0;i<40;i++){
          const y=157+i*i*.12, x=344+Math.sin(t*.9+i*6.2)*i*1.65,w=4+i*.5;
          line(c,[[x-w,y],[x+w,y]],'#ffcc9260',1+i/14);
        }
        for(let i=0;i<88;i++){const z=(i*.61803)%1;const y=156+z*z*207;const x=(i*93.7+t*4) % 510-15;
          line(c,[[x,y],[x+3+10*z,y]],'#f5d5cb38',1+z);}
        fish.forEach((f,i)=>{
          const p=school(f,t),z=p.zoom, r=(t*.53+i*.3)%1;
          c.save();c.translate(p.x,p.y);c.scale(z,z);
          oval(c,0,3,21,7,'#212f4c96');polygon(c,[[-15,2],[-27,-5],[-25,7]],'#242f48b0');
          oval(c,0,0,26+r*14,7+r*4,null,'#fff0c58c',1.4);oval(c,0,0,21,5,null,'#ffe2b8a8',1);
          if(phase==='aim'&&i===selected){line(c,[[-6,-17],[0,-11],[6,-17]],'#ffe0a6',3);}
          c.restore();
        });
        // Perspective dock planks and lantern with mirrored light.
        polygon(c,[[0,331],[124,318],[208,395],[0,418]],'#926558','#4d4757',3);
        for(let i=0;i<9;i++){const x=-90+i*28;line(c,[[x,340-x*.14],[x+68,406-x*.13]],'#684d4c',2);}
        polygon(c,[[24,282],[50,282],[47,318],[29,318]],'#ffca7b','#483d4d',3);
        line(c,[[22,282],[38,269],[53,282],[22,282]],'#4f4551',4);line(c,[[28,320],[48,320]],'#453a4b',5);
        if(['cast','wait','bite','fight'].includes(phase)){
          const u=phase==='cast'?clip(1-timer/.48,0,1):1;
          const bx=mix(85,float.x,u)+(phase==='fight'?Math.sin(stageTime*3)*15:0);
          const by=mix(298,float.y,u)-Math.sin(u*Math.PI)*95+(phase==='bite'?7:Math.sin(t*3)*2);
          const tip=[108,272-(held&&phase==='fight'?16:0)];
          line(c,[[54,337],[78,291],tip],'#bb886b',5);
          c.beginPath();c.moveTo(...tip);c.quadraticCurveTo((tip[0]+bx)/2,Math.min(tip[1],by)-15,bx,by);c.strokeStyle='#f8e6c793';c.lineWidth=1.4;c.stroke();
          oval(c,bx,by,5,7,'#ff956f','#563e53');oval(c,bx,by-5,4,4,'#fff0cd');
          if(phase==='bite'){panel(c,bx-26,by-42,52,23,'#523341');type(c,'BITE!',bx,by-30,14,'#fff1b1');}
        }
        panel(c,0,371,480,109,'#1f3446',0);
        type(c,phase==='fight' ? (pulling()?'Fish pulling · ease off':'Reel now · hold') :
          phase==='catch'?last:phase==='aim'?'Cast into a ripple':phase==='bite'?'Strike now!':phase==='cast'?'Casting…':message,240,396,22,'#ffe0ae','center','Georgia');
        if(phase==='fight'){for(const [i,a,v,col] of [[0,'Reeled',progress,'#81d4ce'],[1,'Tension',strain,'#ff936c']]){
          const x=29+i*226;type(c,a,x,423,15,'#f2dfcb','left');panel(c,x,441,196,9,'#455160',4);if(v>0)panel(c,x,441,v*196,9,col,4);}}
        else {type(c,phase==='aim'?'Tap the water   /   arrows + space':phase==='catch'?'Field journal  ·  '+book.size+' of 4 species':'Watch the red float',240,440,16,'#d8cbd2');}
      },
      pointer(a,x,y){if(a==='down'){if(phase!=='aim'||(y>150&&y<355))press(x,y);}else if(a==='up'||a==='cancel')held=false;},
      key(a,k){if(a==='up'&&(k==='Space'||k==='Enter'))held=false;if(a!=='down')return;
        if(phase==='aim'&&['ArrowLeft','ArrowRight'].includes(k))selected=(selected+(k==='ArrowRight'?1:3))%4;
        if(k==='Space'||k==='Enter')press();},
      demo(dt){bot+=dt;if(phase==='aim'&&bot>.85){selected=(selected+1)%4;press();bot=0;}if(phase==='bite'&&timer<1.1)press();if(phase==='fight')held=!pulling()||strain<.21;}
    };
  }
};
