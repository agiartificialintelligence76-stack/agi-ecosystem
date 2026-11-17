import { clip, mix, type, line, oval, polygon, gradient, panel, painting, TAU } from '../kit/illustration.js';
import { laneAt, shotPower, stampPoints } from './sort.js';

const hall=painting(new URL('./scene.webp',import.meta.url));
const STAMPS=[['DAWN','#fbd180'],['BLOOM','#ffa49e'],['LUNA','#b3cfff'],['LEAF','#b9e3a1']];
const depth=(x,y,z)=>{const scale=1/(1+z*.97);return [240+x*scale,214+y*scale];};
const clampAim=(v,axis)=>clip(v,axis==='x'?-146:-99,axis==='x'?146:99);
function seal(c,x,y,s,kind,color){
  c.save();c.translate(x,y);c.scale(s,s);
  if(kind===0){
    for(let i=0;i<10;i++){c.rotate(Math.PI/5);line(c,[[0,-.65],[0,-.98]],color,.1);}
    oval(c,0,0,.45,.45,color);
  }else if(kind===1){
    for(let i=0;i<6;i++){c.rotate(Math.PI/3);oval(c,0,-.39,.25,.47,color);}oval(c,0,0,.24,.24,'#e5be73');
  }else if(kind===2){oval(c,0,0,.77,.77,color);oval(c,.34,-.25,.61,.61,'#284745');}
  else {polygon(c,[[-.75,.65],[-.5,-.1],[-.1,-.69],[.76,-.78],[.59,.14],[.1,.62]],color);line(c,[[-.75,.7],[.45,-.41]],'#42564b',.09);}
  c.restore();
}
function stamp(c,target,kind,express){
  const [sx,sy]=depth(target.x,target.y,1),[name,tint]=STAMPS[kind];
  const w=express?18:23,h=express?21:25;
  panel(c,sx-w,sy-h,w*2,h*2,tint,1.5);panel(c,sx-w+3,sy-h+3,w*2-6,h*2-6,'#284745',1);
  for(let i=-w+3;i<w;i+=5){oval(c,sx+i,sy-h,1.4,1.4,'#344741');oval(c,sx+i,sy+h,1.4,1.4,'#344741');}
  seal(c,sx,sy-3,express?10:13,kind,tint);type(c,express?'AIR':name,sx,sy+h-7,9,tint,'center','Georgia');
  if(express)line(c,[[sx-w-2,sy-h+9],[sx-w-9,sy-h+9],[sx-w-14,sy-h+4]],tint,1.7);
}
export default {
  title:'RETURN ADDRESS',tagline:'One parcel, two destinations. Play the safe stamp or bank an express delivery past the mailbags.',
  instructions:[
    ['Sort the outgoing mail','At the dock, aim at a stamp on the back wall. Tap and release to send, or hold until the meter turns gold for a power shot. Keyboard uses arrows and Space.'],
    ['Choose your route','Switch between Direct and Bank. From the third delivery the winged AIR stamp counts twice if you bank it. From the fifth, crossing mailbags deflect ordinary shots. A gold power shot passes through.'],
    ['Catch the return','Move the paddle to the dotted landing mark before the parcel reaches you. After a catch the next dispatch leaves automatically when its timer runs out. Send twelve letters with three parcels.'],
  ],
  keys:[['Arrows / WASD','Aim or move paddle'],['Space','Hold and release shot'],['B','Direct or bank']],
  touch:[['Touch the back wall','Aim, hold and release'],['Direct / Bank','Select route'],['Drag in flight','Catch the parcel']],
  create(api){
    let phase='ready',bank=false,held=false,charged=0,clock=0,window=Infinity,flash=0,tip='',tipTime=0;
    let px=0,py=12,moveX=0,moveY=12,aim={x:0,y:0},target={x:0,y:0},express={x:100,y:15},kind=0;
    let x=0,y=12,z=0,dx=0,dy=0,pace=.8,origin={x:0,y:12},dest={x:0,y:0},banked=false,strong=false,bagged=false;
    let score=0,lives=3,printed=0,streak=0,high=0,airmail=0,rally=0,autoTime=0,paper=[],trail=[],sample=0;
    const keys=new Set();
    const hud=()=>api.hud('Delivered',printed+'/12','Parcels',lives);
    const expressOpen=()=>printed>=2;
    function rack(){
      kind=(kind+1)%4;const sign=api.rng()>.5?1:-1;
      target={x:sign*(24+api.rng()*78),y:(api.rng()-.5)*148};
      express={x:-sign*(75+api.rng()*57),y:(api.rng()-.5)*155};
    }
    function bag(){return {x:Math.sin(clock*1.6)*135,y:Math.cos(clock*.85)*44};}
    function announce(msg){tip=msg;tipTime=1.18;}
    function end(){phase='done';api.end(score,[['Letters delivered',printed+' / 12'],['Express routes',airmail],['Longest streak',high]],
      printed===12?'last collection made it. the post office cat approves.':'i kept your best stamp on the noticeboard.');}
    function dispatch(){
      if(phase!=='ready')return;
      origin={x:px,y:py};dest={...aim};banked=bank;strong=held&&shotPower(charged)>=.73;
      held=false;phase='out';z=0;bagged=false;trail=[];pace=Math.min(1.22,.69+.032*rally+(strong?.11:0));
      if(strong)announce('Gold dispatch');api.sound(strong?'power':'pop');
    }
    function delivery(){
      let hit='';
      if(!bagged){
        if(Math.hypot(x-target.x,y-target.y)<44)hit='standard';
        else if(expressOpen()&&Math.hypot(x-express.x,y-express.y)<34)hit=banked?'air':'unsealed';
      }
      if(hit==='standard'||hit==='air'){
        const expressHit=hit==='air';streak++;high=Math.max(high,streak);airmail+=Number(expressHit);
        const points=stampPoints(expressHit,banked,streak,strong);score+=points;
        printed=Math.min(12,printed+(expressHit?2:1));hud();flash=.8;announce((expressHit?'AIR MAIL':'Postmarked')+'   +'+points);
        const [sx,sy]=depth(x,y,1);
        for(let i=0;i<12;i++){const a=i*TAU/12;paper.push({x:sx,y:sy,vx:Math.cos(a)*50,vy:Math.sin(a)*47-30,t:.65});}
        api.sound(expressHit?'combo':'merge');api.haptic(10);if(printed===12){end();return;}rack();
      }else{streak=0;announce(hit==='unsealed'?'AIR needs a bank shot':bagged?'Sorting bag intercepted':'Missed the stamp');api.sound('tick');}
      phase='in';z=1;
      // A return comes off its destination with a new, visible landing point.
      const spread=70+Math.min(rally,12)*7;
      const dropX=clip(x+(api.rng()-.5)*spread*2,-171,171),dropY=clip(y+(api.rng()-.5)*spread*1.8,-123,123);
      dx=dropX-x;dy=dropY-y;
    }
    function catchParcel(){
      if(Math.abs(x-px)>54||Math.abs(y-py)>43){
        lives--;streak=0;rally=0;hud();api.sound('hurt');if(!lives){end();return;}announce('Parcel lost');window=Infinity;
      }else{rally++;score+=6;api.sound('bounce');window=clip(4-rally*.12,2.5,4);}
      phase='ready';z=0;held=false;charged=0;aim={x:clip(aim.x,-145,145),y:clip(aim.y,-95,95)};trail=[];autoTime=0;
    }
    function steer(k){
      const sx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
      const sy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
      if(phase==='ready'){aim.x=clampAim(aim.x+sx*k*174,'x');aim.y=clampAim(aim.y+sy*k*174,'y');}
      else{moveX=clip(moveX+sx*k*346,-185,185);moveY=clip(moveY+sy*k*318,-140,140);}
    }
    function setAim(u,v){aim={x:clampAim((u-240)*1.97,'x'),y:clampAim((v-214)*1.97,'y')};}
    function paddle(u,v){moveX=clip(u-240,-185,185);moveY=clip(v-214,-140,140);}
    hud();
    return {
      cancelInput(){held=false;charged=0;keys.clear();},
      update(dt){
        if(phase==='done')return;clock+=dt;flash=Math.max(0,flash-dt*2);tipTime=Math.max(0,tipTime-dt);
        steer(dt);px=mix(px,moveX,1-Math.exp(-24*dt));py=mix(py,moveY,1-Math.exp(-24*dt));
        paper=paper.filter(p=>(p.t-=dt)>0);paper.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=96*dt;});
        if(phase==='ready'){x=px;y=py;if(held)charged+=dt;if(Number.isFinite(window)&&(window-=dt)<=0)dispatch();return;}
        if(phase==='out'){
          const before=z;z=Math.min(1,z+dt*pace);const p=laneAt(origin,dest,banked,z);x=p.x;y=p.y;
          if(printed>=4&&before<.55&&z>=.55){
            const obstacle=bag();if(!strong&&Math.abs(x-obstacle.x)<35&&Math.abs(y-obstacle.y)<30){bagged=true;api.sound('hit');}
          }
          if(bagged)y+=32*Math.max(0,z-.55)/.45;
          if(z===1)delivery();
        }else if(phase==='in'){
          const d=Math.min(z,dt*pace);x+=dx*d;y+=dy*d;z-=d;if(z<=0)catchParcel();
        }
        if((sample+=dt)>.035){sample=0;trail.push(depth(x,y,z));if(trail.length>9)trail.shift();}
      },
      draw(c){
        gradient(c,0,0,480,480,['#223a3b','#43625c','#242c30']);hall(c,0,0,480,400);
        const corners=[[-200,-149],[200,-149],[200,149],[-200,149]];
        const far=corners.map(([u,v])=>depth(u,v,1)),near=corners.map(([u,v])=>depth(u,v,0));
        polygon(c,far,'#1e3b3adb','#e9c38d',2);
        if(flash>0){c.save();c.globalAlpha=flash*.32;line(c,[...far,far[0]],'#ffe2a2',5);c.restore();}
        for(let i=0;i<4;i++){line(c,[near[i],far[i]],'#e9dbb783',1.8);}
        for(let k=0;k<5;k++){const a=k/5;line(c,[depth(-200,149,a),depth(200,149,a)],'#f8e0b25e');}
        panel(c,13,10,220,35,'#1b3534dd');type(c,'The night sorting office',25,28,18,'#f9e3bc','left','Georgia');
        panel(c,328,10,140,35,'#1b3534dd');type(c,'BAG  '+String(printed+1).padStart(2,'0')+' / 12',398,28,15,'#f9dfab');
        stamp(c,target,kind,false);if(expressOpen())stamp(c,express,(kind+2)%4,true);
        if(printed>=4){
          const b=bag(),[sx,sy]=depth(b.x,b.y,.55);
          line(c,[[sx,82],[sx,sy-15]],'#a48d72',1.5);polygon(c,[[sx-12,sy-14],[sx+11,sy-14],[sx+16,sy+8],[sx+11,sy+16],[sx-13,sy+16],[sx-17,sy+7]],'#a96c4d','#654935',1.5);
          line(c,[[sx-9,sy-11],[sx+10,sy-11]],'#edd09a',2);
        }
        if(phase==='ready'){
          const points=[];for(let i=0;i<=32;i++){const d=i/32,p=laneAt({x:px,y:py},aim,bank,d);points.push(depth(p.x,p.y,d));}
          c.setLineDash([4,5]);line(c,points,bank?'#ffcf84':'#b5f3df',2);c.setLineDash([]);
          const [u,v]=points.at(-1);oval(c,u,v,9,9,null,'#fff3c3',2);
        }else if(phase==='in'){
          const [ex,ey]=depth(x+dx*z,y+dy*z,0);c.setLineDash([3,6]);line(c,[depth(x,y,z),[ex,ey]],'#ffefafc7',2);c.setLineDash([]);
          oval(c,ex,ey,16,9,null,'#ffdf92',2.5);
        }
        trail.forEach(([u,v],i)=>oval(c,u,v,2+i*.52,2+i*.52,strong?'#ffd987a8':'#e4ead381'));
        const [cx,cy]=depth(px,py,0);
        panel(c,cx-46,cy-30,92,60,'#9af0cd35',10);c.strokeStyle='#fff0c7';c.lineWidth=2.2;c.stroke();
        for(let j=-32;j<43;j+=14)line(c,[[cx+j,cy-26],[cx+j,cy+26]],'#b1dfce6b');
        const [u,v]=depth(x,y,z),s=14/(1+z);
        c.save();c.translate(u,v);c.rotate(phase==='ready'?-.12:clock*2);polygon(c,[[-s,-s*.7],[s,-s*.7],[s,s*.7],[-s,s*.7]],'#fff0cd','#834b3b',1.6);
        line(c,[[-s,-s*.7],[0,s*.16],[s,-s*.7]],'#a76e57',1.2);oval(c,0,s*.14,2,2,'#b4483f');c.restore();
        paper.forEach(p=>polygon(c,[[p.x,p.y-3],[p.x+3,p.y],[p.x,p.y+3],[p.x-2,p.y]],'#ffcf87'));
        panel(c,0,387,480,93,'#19332f',0);
        type(c,tipTime>0?tip:phase==='ready'?'Aim at a stamp, release to send':phase==='in'?'Catch the dotted mark':'Out for delivery',16,409,20,'#fce4b8','left','Georgia');
        if(phase==='ready'){
          panel(c,13,431,144,38,bank?'#d5a46d':'#bdd9bd');type(c,bank?'↳ Bank route':'→ Direct route',85,450,16,'#263d34');
          type(c,held?'Power':'Hold for power',173,439,13,'#e7d9bf','left');panel(c,173,451,161,8,'#526556',3);panel(c,173+161*.73,451,161*.27,8,'#b99551',3);
          if(held){const w=shotPower(charged)*161;if(w>.1)panel(c,173,451,w,8,'#ffe5a6',3);}
          type(c,Number.isFinite(window)?window.toFixed(1)+'s':'Ready',459,450,17,'#d2e5cf','right');
        }else{
          type(c,expressOpen()?'AIR counts twice on a bank':'Two letters unlock air mail',17,451,16,'#bed9c7','left');
          type(c,'×'+streak,458,451,20,'#f8cc87','right');
        }
      },
      pointer(a,u,v){
        if(phase==='ready'){
          if(a==='down'&&v>=426&&u<161){bank=!bank;api.sound('select');return;}
          if(a==='down'&&v<387){setAim(u,v);held=true;charged=0;}
          if(a==='move'&&held)setAim(u,v);
          if(a==='up'&&held){setAim(u,v);dispatch();}
          if(a==='cancel')held=false;
        }else if(a==='move'||a==='down')paddle(u,v);
      },
      key(a,k){
        if(a==='up'){keys.delete(k);if((k==='Space'||k==='Enter')&&held&&phase==='ready')dispatch();return;}
        keys.add(k);if(phase==='ready'&&k==='KeyB'){bank=!bank;api.sound('select');}
        if(phase==='ready'&&(k==='Space'||k==='Enter')){held=true;charged=0;}
      },
      demo(dt){
        if(phase==='ready'){
          autoTime+=dt;bank=expressOpen();aim={...(bank?express:target)};held=true;
          if(autoTime>1.03){dispatch();autoTime=0;}
        }else if(phase==='in'){moveX=clip(x+dx*z,-185,185);moveY=clip(y+dy*z,-140,140);}
      }
    };
  }
};
