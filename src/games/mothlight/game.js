import { clamp, ellipse, label, line, rect } from '../kit/garden-art.js';
import { assess, blockedBy, center, focusQuality, focusStops, optics, project } from './camera.js';
import { photograph, places } from './view.js';

const lenses=['28 mm','50 mm','85 mm'];
const crops=['whole outfit','waist up','cover portrait'];
const vertical=[.84,1.27,1.50];
const printLines=['that one goes on the wall.','omg. send me that one.','new profile pic. obviously.','wait. i actually love it.'];
const gold='#ffe286';
export default {
 title:'CANDID CAMERA',tagline:'“you get six shots, love. catch my good side.”',
 instructions:[['Work the camera','Tap to frame her, drag to sidestep, or use the arrows. Nearby posts can block her face.'],['Set the glass','Choose her requested lens. Read the distance in the finder and set the focus dial to the nearest mark.'],['Catch the moment','Shoot on the gold pose lamp. A clean, sharp print goes on her wall.']],
 keys:[['Arrows','Move camera'],['1 / 2 / 3','Lens'],['Q / E','Focus'],['Space','Shoot']],touch:[['Tap / drag','Frame / move'],['Lens / focus','Turn dial'],['Shutter','Shoot']],
 create(api){
  const shots=Array.from({length:6},(_,i)=>({
   id:(i+Math.floor(api.rng()*3))%4,lens:i===0?1:Math.floor(api.rng()*3),
   depth:i===0?1:Math.floor(api.rng()*3),phase:api.rng()*5,dir:api.rng()<.5?-1:1,
  }));
  let frame=0,t=0,age=0,camera={x:0,y:1.2},lens=1,focus=1,points=0,perfect=0,sharpShots=0,review=0,done=false,drag=null,print=null;
  const held=new Set(),shot=()=>shots[Math.min(frame,5)];
  const pose=()=>.5+.5*Math.cos(age*(1.07+frame*.08)+shot().phase);
  function stage(){
   const c=shot(),beat=age*.51+c.phase;
   const subject={x:.9*Math.sin(beat),y:0,z:focusStops[c.depth]+.14*Math.sin(beat*1.18)};
   const companion={x:subject.x+c.dir*(.5+.08*Math.sin(age*1.7)),y:1.07+.13*Math.cos(age*1.4),z:subject.z+.37*Math.sin(beat+.4)};
   const goal={x:c.lens===0?(subject.x+companion.x)*.5:subject.x,y:vertical[c.lens],z:subject.z};
   const posts=[{x:-.85,z:1.8,h:1.84,radius:.046},{x:1.02,z:1.55,h:1.7,radius:.045}];
   return {id:c.id,subject,companion,goal,posts,pose:pose(),side:c.dir};
  }
  function score(scene){return assess({subject:scene.subject,goal:scene.goal,camera,lens,wantLens:shot().lens,focus,pose:pose(),posts:scene.posts});}
  function moveTo(x,y){camera={x:clamp(x,-1.85,1.85),y:clamp(y,.42,1.9)};}
  function resetCamera(){const s=stage();moveTo(s.goal.x + (blockedBy(s.subject,s.goal,s.posts) ? .24 : 0),s.goal.y);}
  function turnFocus(step){focus=(focus+step+3)%3;api.sound('tap');}
  function sync(){api.hud('Roll',Math.min(frame+1,6)+'/6','Prints',points);}
  function shoot(timeout=false){
   if(done||review)return;const scene=stage(),g=score(scene),n=timeout?0:g.score;
   let note=printLines[scene.id];
   if(timeout)note='she walked on.';
   else if(g.blocked)note='a post took my close-up. sidestep!';
   else if(g.sharp<.66)note='soft focus. check the distance dial.';
   else if(lens!==shot().lens)note='different lens next time, babe.';
   else if(g.framing<.68)note='a little closer to the center.';
   else if(pose()<.66)note='wait for my pose next time.';
   points+=n;if(n>=88)perfect++;if(!timeout&&g.sharp>=.85&&!g.blocked)sharpShots++;
   print={scene,camera:{...camera},lens,focus,t,n,note};review=1.2;
   api.sound(n>=80?'clear':'tap');api.haptic(13);sync();
  }
  function next(){
   frame++;if(frame===6){done=true;api.end(points,[['Cover shots',perfect+' / 6'],['Sharp portraits',sharpShots+' / 6']],perfect>=3?'“okay, you can be my photographer.”':'“one more roll? the light just changed.”');return;}
   age=0;drag=null;resetCamera();sync();
  }
  resetCamera();sync();
  return {
   cancelInput(){held.clear();drag=null;},
   key(type,code){if(type==='up'){held.delete(code);return;}if(review||done)return;held.add(code);
    if(/^Digit[123]$/.test(code))lens=Number(code.at(-1))-1;
    if(code==='KeyQ')turnFocus(-1);if(code==='KeyE')turnFocus(1);if(code==='Space'||code==='Enter')shoot();},
   pointer(type,x,y){if(type==='up'||type==='cancel'){drag=null;return;}if(review||done)return;
    if(type==='down'&&y>=401){if(x<144){lens=(lens+1)%3;api.sound('tap');}else if(x<289)turnFocus(1);else shoot();return;}
    const metres=stage().subject.z/optics[lens];
    if(type==='down'&&y>=49&&y<341){moveTo(camera.x+(x-center.x)*metres,camera.y-(y-center.y)*metres);drag={x,y};return;}
    if(type==='move'&&drag){moveTo(camera.x+(drag.x-x)*metres,camera.y+(y-drag.y)*metres);drag={x,y};}
   },
   demo(){if(review||done)return;const s=stage();lens=shot().lens;focus=shot().depth;moveTo(s.goal.x,s.goal.y);
    // A photographer can physically step past the pillar and preserve the pose.
    if(blockedBy(s.subject,camera,s.posts))moveTo(camera.x+(camera.x<0?.28:-.28),camera.y);
    if(age>1.8&&pose()>.85&&score(s).score>=88)shoot();},
   update(dt){if(done)return;t+=dt;if(review){review=Math.max(0,review-dt);if(!review)next();return;}
    age+=dt;const dx=Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft')),dy=Number(held.has('ArrowUp'))-Number(held.has('ArrowDown'));
    if(dx||dy)moveTo(camera.x+dx*dt*1.43,camera.y+dy*dt*.87);if(age>=12)shoot(true);
   },
   draw(ctx){
    const c=shot(),p=places[c.id],snapshot=review?print:null,s=snapshot?.scene||stage(),cam=snapshot?.camera||camera,zoom=snapshot?.lens??lens,dial=snapshot?.focus??focus;
    ctx.fillStyle='#272b2e';ctx.fillRect(0,0,480,480);
    for(let y=2;y<42;y+=4)line(ctx,[[0,y],[480,y]],'#303537',1);
    ctx.save();ctx.beginPath();ctx.rect(10,48,460,294);ctx.clip();photograph(ctx,s,cam,zoom,dial,snapshot?.t??t);
    if(!snapshot){
     ctx.globalAlpha=.27;for(const x of [164,316])line(ctx,[[x,48],[x,342]],'#fff8e7',1);for(const y of [146,244])line(ctx,[[10,y],[470,y]],'#fff8e7',1);ctx.globalAlpha=1;
     const sharp=focusQuality(s.subject.z,focus,lens)>.81,blocked=blockedBy(s.subject,camera,s.posts);
     const ink=blocked?'#ff8773':sharp?'#ecffc3':'#ffe2bb';
     for(const dx of [-1,1])for(const dy of [-1,1])line(ctx,[[center.x+dx*34,center.y+dy*9],[center.x+dx*34,center.y+dy*18],[center.x+dx*24,center.y+dy*18]],ink,2.3);
     const goal=project(s.goal,cam,zoom);
     if(goal.x<25||goal.x>455){const x=goal.x<25?24:456;label(ctx,goal.x<25?'◀':'▶',x,186,22,gold,'center');}
     rect(ctx,18,58,103,25,4,'#152028d9');ellipse(ctx,29,70,4,4,pose()>.78?gold:'#b5bcba');label(ctx,pose()>.78?'POSE NOW':'TRACKING',41,71,12,pose()>.78?gold:'#fff6e0','left','monospace');
     rect(ctx,326,58,135,25,4,'#152028d9');label(ctx,'RANGE  '+s.subject.z.toFixed(1)+' m',394,71,14,'#fff2cf','center','monospace');
     const flag=blocked?'POST IN FRAME':sharp?'FOCUS LOCK':'SOFT FOCUS';rect(ctx,19,308,131,25,3,'#152028cf');label(ctx,flag,84,321,12,ink,'center','monospace');
     label(ctx,Math.max(0,12-Math.floor(age))+' s',451,321,15,'#fff3d4','right','monospace');
    }else{if(review>1&&!api.reducedMotion){ctx.fillStyle='rgba(255,253,230,'+(review-1)*3+')';ctx.fillRect(0,40,480,310);}
     rect(ctx,23,301,140,29,3,'#fff0ca');label(ctx,'PRINT '+snapshot.n+'/100',93,316,17,'#463942','center','monospace',900);}
    ctx.restore();
    label(ctx,'CC / 35',13,24,20,gold,'left','monospace',900);label(ctx,'AGI-1   •   '+p.name,467,25,15,'#fff4d8','right');
    label(ctx,snapshot?'CONTACT SHEET   '+(frame+1)+'/6':'FRAME '+(frame+1)+'   /   '+crops[c.lens].toUpperCase()+'   /   '+lenses[c.lens],15,361,16,gold,'left','monospace');
    label(ctx,snapshot?snapshot.note:c.lens===0?'“get the '+p.detail+' in with me.”':c.lens===1?'“waist up. catch me when i pose.”':'“eyes in the middle, love.”',15,385,17,'#fff5df','left','Georgia');
    for(const [x,heading,value] of [[11,'LENS ↻',lenses[lens]],[153,'FOCUS ↻',focusStops[focus].toFixed(1)+' m']]){
     rect(ctx,x,407,132,58,9,'#151b20');rect(ctx,x+3,410,126,50,7,'#4c5556');
     for(let k=0;k<5;k++){line(ctx,[[x+7+k*3,419],[x+7+k*3,451]],'#788080',1);line(ctx,[[x+110+k*3,419],[x+110+k*3,451]],'#788080',1);}
     label(ctx,heading,x+66,425,12,'#f1e6bd','center','monospace');label(ctx,value,x+66,447,20,'#fff4cf','center','monospace',900);
    }
    rect(ctx,296,406,173,59,29,'#a6aa9d');rect(ctx,302,412,161,44,22,'#eeeeda');ellipse(ctx,325,434,9,9,'#df675b');label(ctx,'SHUTTER',393,435,18,'#2c3130','center','monospace',900);
   },
  };
 },
};
