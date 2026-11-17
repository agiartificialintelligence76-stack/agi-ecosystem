import { scenery, sprite, clamp, mix, poly, line, oval, gradient, caption, panel, meter } from '../kit/field-art.js';

import { rivalCar, horizonLandmarks, saltSpray, racingSky, apexDiamond } from './mirage.js';

const vehicle = sprite(new URL('./vehicle.webp', import.meta.url));
const paintScenery = scenery(new URL('./scenery.webp', import.meta.url));

export default {
  title:'DRIFTGLASS',tagline:'Race a silver pace car from the morning salt flats into a violet night. Slide the apex and spend your charge on the exit.',
  instructions:[
    ['Read the course','Drive between each pair of flags. The ribbons on the salt link one gate to the next.'],
    ['Slide the corner','Tap Drift or hold Space as you steer. Your car rotates faster and carries its sideways momentum.'],
    ['Clip the amber apex','The inner marker above each gate charges the turbo if you pass close. Sustained sideways slides charge it too.'],
    ['Race your rival','Hit Shift or tap Boost with at least 35 charge. A burst adds speed, but a wide gate scrubs it away. Beat the silver pace car to the finish.'],
  ],
  keys:[['Left / Right or A / D','Steer'],['Hold Space','Drift'],['Shift / B','Fire boost']],
  touch:[['Drag across the salt','Steer toward your finger'],['Tap DRIFT','Switch drift on or off'],['Tap BOOST','Spend turbo charge']],
  create(api){
    const course=[{x:0,z:0}],keys=new Set(),marks=[],crystals=[];
    let next=1,z=0,x=0,vx=0,yaw=0,speed=28,wantX=0,touch=false,latched=false,drift=false;
    let score=0,chain=0,clean=0,slides=0,remaining=67,t=0,ended=false,notice='FOLLOW THE FLAGS',noticeTime=2.3,markClock=0;
    let charge=40,boost=0,bursts=0,clips=0,rivalZ=-8,finishTime=null,polish=0;
    function turbo(){if(charge<35||boost>0||ended)return;charge-=35;boost=2.15;bursts++;notice='TURBO EXIT';noticeTime=.9;api.sound('power');api.haptic(14);}
    for(let i=1;i<=19;i++){
      const prev=course.at(-1);course.push({x:clamp(prev.x+(i===1?0:(i%2?1:-1))*(24+api.rng()*49),-91,91),z:prev.z+79+api.rng()*12});
    }
    for(let i=0;i<110;i++)crystals.push({x:(api.rng()-.5)*775,z:api.rng()*850,t:api.rng()});
    function centreAt(p){
      const j=course.findIndex(g=>g.z>=p);
      if(j<=0)return course[j===0?0:course.length-1].x;
      const a=course[j-1],b=course[j],s=clamp((p-a.z)/(b.z-a.z),0,1);
      return mix(a.x,b.x,s*s*(3-2*s));
    }
    const apex=(i)=>course[i].x+Math.sign(course[i+1].x-course[i].x||1)*(24-i*.36)*.54;
    function projection(wx,wz,h=0){
      const f=81/(81+wz-z);
      return [240+(wx-x*.8)*f*2.15,165+(205-h*2.1)*f,f];
    }
    function flag(c,wx,p,side,first){
      const [xx,yy,s]=projection(wx,p);
      const hh=(first?46:36)*s,sideColor=side===1?'#ed7657':'#22697b';
      line(c,[[xx,yy],[xx,yy+hh*.49]],'#789b9a78',Math.max(1,2*s));
      line(c,[[xx,yy],[xx,yy-hh]],'#403a4c',Math.max(.8,2.6*s));
      poly(c,[[xx,yy-hh],[xx+side*17*s,yy-hh+3*s],[xx+side*13*s,yy-hh+12*s],[xx,yy-hh+11*s]],sideColor);
      poly(c,[[xx,yy-hh+1*s],[xx+side*7*s,yy-hh+2*s],[xx+side*6*s,yy-hh+7*s],[xx,yy-hh+6*s]],'#f5e5b6');
      poly(c,[[xx-5*s,yy],[xx,yy-10*s],[xx+5*s,yy]],'#e98b65');
    }
    return{
      pointer(type,px,py){
        if(type==='down'){
          if(py>=411&&px<250){turbo();return;}
          if(py>=411&&px>280){latched=!latched;api.sound('click');return;}touch=true;
        }
        if(touch&&(type==='down'||type==='move'))wantX=clamp(x*.8+(px-240)/1.8,-153,153);
        if(type==='up'||type==='cancel')touch=false;
      },
      key(type,code){if(type==='down'){if(['KeyB','ShiftLeft','ShiftRight'].includes(code)&&!keys.has(code))turbo();keys.add(code);}else keys.delete(code);},
      demo(){
        const target=course[next];if(!target)return;
        touch=true;wantX=centreAt(z+37);
        if(target.z-z<27)wantX=mix(wantX,apex(next),.32);
        if(!boost&&charge>=42&&target.z-z>27)turbo();
        latched=Math.abs(wantX-x)>11||Math.abs(vx)>12;
      },
      update(dt){
        if(ended)return;t+=dt;remaining-=dt;noticeTime-=dt;boost=Math.max(0,boost-dt);polish=Math.max(0,polish-dt);
        if(rivalZ<course[18].z){rivalZ+=dt*(39+2.5*Math.sin(t*.45)+Math.min(4,t*.085));if(rivalZ>=course[18].z)finishTime=t;}
        const arrows=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
        const steer=clamp(touch?(wantX-x)*.066-vx*.024:arrows,-1,1);
        drift=latched||keys.has('Space');yaw=mix(yaw,steer*(drift?1.1:.66),Math.min(1,dt*(drift?6.4:4.5)));
        const sideSpeed=drift?88:63;
        vx=mix(vx,Math.sin(yaw)*sideSpeed,Math.min(1,dt*(drift?2.55:4.85)));
        x=clamp(x+vx*dt,-157,157);
        if(drift&&Math.abs(vx)>13)charge=clamp(charge+dt*(3.8+Math.abs(vx)*.052),0,100);
        speed=mix(speed,(drift?29:39)+Math.min(chain,10)*.65+(boost?23:0),Math.min(1,(boost?2.2:.67)*dt));z+=speed*dt;
        markClock-=dt;
        if(markClock<=0){markClock=.085;marks.push({x,z,yaw,drift:drift&&Math.abs(vx)>8});}
        while(marks[0]?.z<z-45)marks.shift();
        const gate=course[next],half=gate?24-next*.36:20;
        if(gate&&z>=gate.z){
          const off=Math.abs(x-gate.x);
          if(off<=half){
            chain++;clean++;const style=drift&&Math.abs(vx)>10;
            if(style)slides++;
            const kissed=Math.abs(x-apex(next))<9;
            if(kissed){clips++;charge=clamp(charge+17,0,100);score+=70;polish=1;api.sound('merge');}
            score+=Math.round((style?155:95)*(1+Math.min(5,chain-1)*.18));
            notice=kissed?'APEX CLIP  +17 CHARGE':style?'SLIDE PASS  ×'+chain:'CLEAN GATE  ×'+chain;api.sound(style?'combo':'coin');
          }else{
            chain=0;boost=0;speed*=.58;remaining-=1.2;notice='WIDE  •  −1.2 SEC';api.sound('hurt');api.haptic(20);
          }
          next++;noticeTime=1.1;
        }
        api.hud('Race',score,'Time',Math.max(0,Math.ceil(remaining))+'s');
        if(next>18||remaining<=0){ended=true;const won=next>18&&finishTime===null;if(won)score+=450;api.end(score,[['Clean gates',clean+'/18'],['Apex clips',clips],['Boosts',bursts],['Finish',won?'1st of 2':next>18?'2nd of 2':'Time out']],won?'i can still see your tire marks on the moonlit salt.':'there is a faster line through those flags.');}
      },
      draw(c){
        c.fillStyle=gradient(c,0,480,[[0,'#7e73ae'],[.27,'#ffb2a8'],[.345,'#ffdfb7'],[.35,'#bfd9cb'],[.7,'#9bc8cc'],[1,'#7798b1']]);c.fillRect(0,0,480,480);
        racingSky(c,t,next,x);
        for(let j=0;j<2;j++){
          const p=[[-30,170]];for(let i=-2;i<23;i++)p.push([i*25-x*(j*.033+.027),139+j*12+Math.sin(i*.81+j)*11+Math.cos(i*1.64+j)*8]);
          p.push([510,170]);poly(c,p,j?'#8a839a':'#a69ab0');
          poly(c,p.map(([px,py])=>[px,330-py*.95]),j?'#91a3b0':'#b3b4bb');
        }
        if(paintScenery(c,-x*.075,Math.sin(z*.004)*2)){
          const dusk=Math.max(0,(next-5)/15);c.fillStyle='rgba(43,38,103,'+(dusk*.45)+')';c.fillRect(0,0,480,480);
          if(dusk>.25){for(let k=0;k<42;k++){const sx=(k*97.23)%480,sy=(k*29.61)%111;oval(c,sx,sy,1,1,'rgba(255,232,211,'+dusk*.85+')');}}
        }
        horizonLandmarks(c,z,t,x,next);
        const roadLeft=[],roadRight=[];
        for(let d=470;d>=-32;d-=6){
          const zz=z+d,mid=centreAt(zz);
          roadLeft.push(projection(mid-26,zz));roadRight.push(projection(mid+26,zz));
        }
        poly(c,[...roadLeft,...roadRight.reverse()],'#f5e7cc4f');
        line(c,roadLeft,'#dff2e255',1.5);line(c,roadRight,'#f3e7d980',1.5);
        for(const p of crystals){
          const dz=(p.z-z%850+1700)%850-41,[cx,cy,s]=projection(p.x,z+dz);
          if(cx<0||cx>480||cy>478)continue;
          const count=4+Math.floor(p.t*3);
          const kinks=Array.from({length:count},(_,i)=>[cx+(i-count/2)*s*4,cy+Math.sin(i*1.65+p.t*4)*s*2.2]);
          line(c,kinks,'#f4f5de80',Math.max(.5,s));
        }
        for(let i=Math.min(18,next+5);i>=next;i--){
          const g=course[i],half=24-i*.36;
          const [ax,ay,as]=projection(apex(i),g.z,5);apexDiamond(c,ax,ay,as,t);
          flag(c,g.x-half,g.z,-1,i===next);flag(c,g.x+half,g.z,1,i===next);
        }
        for(let i=1;i<marks.length;i++){
          const a=marks[i-1],b=marks[i];if(!b.drift)continue;
          for(const k of [-7,7])line(c,[projection(a.x+k,a.z),projection(b.x+k,b.z)],'#637b8d77',2.5);
        }
        const distance=rivalZ-z;
        if(distance>-34&&distance<520){const rx=centreAt(rivalZ)+Math.sin(t*1.13)*5,[xx,yy,s]=projection(rx,rivalZ);rivalCar(c,xx,yy,s,t);}
        const [cx,cy]=projection(x,z);oval(c,cx,cy+2,40,9,'#586e85aa');
        if(drift||boost)saltSpray(c,cx,cy,t,yaw,boost>0);
        c.save();c.translate(cx,cy);c.scale(1.13,1.13);c.transform(1,0,-yaw*.52,1,0,0);c.rotate(yaw*.055);
        if(!vehicle(c,-40,-60,80,62)){
        for(const k of [-1,1]){panel(c,k*27-5,-10,11,15,'#3e4054',3);}
        poly(c,[[-34,-8],[-29,-19],[-17,-31],[11,-34],[26,-24],[32,-7],[25,0],[-25,0]],'#85435a');
        poly(c,[[-30,-18],[-18,-32],[11,-34],[26,-24],[17,-16],[-12,-13]],'#ff9b79');
        poly(c,[[-18,-30],[10,-32],[19,-23],[-11,-21]],'#455672');
        poly(c,[[-12,-30],[-3,-31],[-10,-22],[-15,-22]],'#9bacb4');
        poly(c,[[-31,-13],[27,-17],[31,-10],[26,-4],[-25,-3]],'#c65f64');
        line(c,[[-25,-11],[-13,-11]],'#ffcec0',3);line(c,[[13,-13],[25,-14]],'#ffcec0',3);
        panel(c,-5,-9,11,4,'#ffdfaa',1);line(c,[[-28,-17],[27,-21]],'#693e58',3.3);}c.restore();
        panel(c,14,15,234,52,'#36394fea');caption(c,next<7?'01  •  SALT FLATS':next<13?'02  •  QUARTZ PASS':'03  •  NIGHT BASIN',26,31,'#ffe0c3',16,'left');caption(c,'GATE '+Math.min(next,18)+' / 18',26,52,'#ccdce0',14,'left');
        panel(c,312,14,154,53,'#383d51ed');caption(c,distance<=0?'1ST  /  2':'2ND  /  2',451,31,'#ffdf9f',18,'right');caption(c,Math.abs(Math.round(distance))+' m '+(distance<=0?'ahead':'behind'),451,53,'#d7e3dd',14,'right');
        if(noticeTime>0){panel(c,109,292,262,32,'#45485de8');caption(c,notice,240,309,'#fff0cc',16);}
        panel(c,13,412,246,53,boost?'#ffe3ad':'#404559');caption(c,boost?'BOOST ACTIVE':charge>=35?'FIRE BOOST':'CHARGING',27,431,boost?'#4c4653':'#ffe3bf',16,'left');
        caption(c,Math.round(charge)+'%',242,431,boost?'#4c4653':'#f6d59d',15,'right');meter(c,27,448,213,charge/100,'#ffba79','#737a8b');
        panel(c,273,412,193,53,drift?'#ffb997':'#e4d8ce');caption(c,drift?'DRIFT  •  ON':'DRIFT  •  OFF',369,439,'#4a4458',18);
      },
    };
  },
};
