import { clamp, mix, TAU, poly, line, oval, gradient, caption, panel, meter } from '../kit/field-art.js';

// A tilted orthographic view into the reef. A bell's shadow stays on its true seabed position as it rises.
const seabed = (x,z,h=0) => [240+x*1.16+z*.44,285-x*.17+z*.61-h];
function reefCoordinates(px,py){
  const xx=px-240,yy=py-285,det=1.16*.61+.17*.44;
  return [(xx*.61-yy*.44)/det,(yy*1.16+xx*.17)/det];
}
export default {
  title:'PEARL SHIFT',tagline:'Pilot a brass diving bell through a midnight reef. Bring the pearls back up.',
  instructions:[
    ['Steer over a shell','Tap a shell or use the arrows to steer the bell’s shadow.'],
    ['Dive and gather','Tap Dive or press Space. Open shells yield a pearl when the bell reaches the bottom. Carry up to three.'],
    ['Bank your catch','Surface before your air runs out. Gold pearls score double. Bring up ten before the shift ends.'],
  ],
  keys:[['Arrows / WASD','Move across the reef'],['Space','Dive or surface']],touch:[['Tap or drag on reef','Steer to a shell'],['Dive / Surface','Change depth']],
  create(api){
    let x=0,z=0,tx=0,tz=0,height=109,submerged=false,air=100,cargo=[],banked=0,score=0,time=0,remaining=100,done=false;
    let loss=0,notice='PICK A SHELL, THEN DIVE',noticeTime=3,held=false,rock=0,returning=false;
    const keys=new Set(),beds=[],corals=[];
    for(let i=0;i<8;i++){
      const angle=i*TAU/8;
      beds.push({x:Math.cos(angle)*(99+api.rng()*13),z:Math.sin(angle)*(103+api.rng()*18),cool:0,gold:i===2||i===6});
    }
    for(let i=0;i<34;i++)corals.push({x:(api.rng()-.5)*370,z:(api.rng()-.5)*310,h:7+api.rng()*18,k:api.rng()});
    function toggle(){
      submerged=!submerged;api.sound(submerged?'drop':'whoosh');
    }
    function shell(c,b){
      const [px,py]=seabed(b.x,b.z);const q=b.gold?'#ffda78':'#b7fff0';
      oval(c,px,py+4,17,6,'#123d4b');
      if(b.cool<=0){
        const flare=1+.1*Math.sin(time*3+b.x);
        oval(c,px,py+2,20*flare,8*flare,null,b.gold?'#dfc66181':'#64d2c77a',1.5);
        const fan=[];
        for(let k=0;k<=8;k++){const a=Math.PI+k*Math.PI/8;fan.push([px+Math.cos(a)*13,py-2+Math.sin(a)*12]);}
        poly(c,[[px,py+2],...fan],b.gold?'#9b7872':'#8c80ad');
        for(let k=1;k<8;k+=2)line(c,[[px,py+2],fan[k]],'#d7bed2',1.3);
        oval(c,px,py,5.8,5.8,q);oval(c,px-1.7,py-2.1,1.7,1.6,'#fffbea');
        poly(c,[[px-14,py+1],[px-5,py+6],[px+6,py+6],[px+14,py],[px+3,py+3]],'#eb9fa5');
      }else{oval(c,px,py,11,4,'#697c88');line(c,[[px-9,py],[px+8,py-1]],'#435b70',1.3);}
    }
    function coral(c,p){
      const [px,py]=seabed(p.x,p.z), col=p.k>.53?'#e38486':'#4bafa5';
      line(c,[[px,py],[px-1,py-p.h*.55],[px+3,py-p.h]],col,2.8);
      line(c,[[px-1,py-p.h*.4],[px-5,py-p.h*.55],[px-7,py-p.h*.79]],col,2);
      line(c,[[px-1,py-p.h*.58],[px+5,py-p.h*.68],[px+7,py-p.h*.91]],col,2);
    }
    return {
      pointer(type,px,py){
        if(type==='down'){
          if(py>=411){if(px>=267)toggle();return;}
          held=true;
        }
        if(held&&(type==='down'||type==='move')){
          const [a,b]=reefCoordinates(px,py);tx=clamp(a,-161,161);tz=clamp(b,-145,145);
        }
        if(type==='up'||type==='cancel')held=false;
      },
      key(type,code){
        if(type==='down'){
          if(code==='Space'&&!keys.has(code))toggle();
          keys.add(code);
        }else{
          keys.delete(code);
          if(code.startsWith('Arrow')||['KeyW','KeyA','KeyS','KeyD'].includes(code)){tx=x;tz=z;}
        }
      },
      demo(){
        const b=beds.filter(v=>v.cool<=0).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
        if(cargo.length===3||air<32)returning=true;
        if(returning){
          submerged=false;
          if(height>=108&&air>=91)returning=false;
          return;
        }
        if(b){tx=b.x;tz=b.z;submerged=true;}
      },
      update(dt){
        if(done)return;
        time+=dt;remaining-=dt;noticeTime-=dt;
        for(const b of beds)b.cool=Math.max(0,b.cool-dt);
        const has=(a,b)=>Number(keys.has(a)||keys.has(b));
        const dx=has('ArrowRight','KeyD')-has('ArrowLeft','KeyA'),dz=has('ArrowDown','KeyS')-has('ArrowUp','KeyW');
        if(dx||dz){tx=clamp(x+dx*30,-161,161);tz=clamp(z+dz*30,-145,145);}
        const gap=Math.hypot(tx-x,tz-z),step=Math.min(1,dt*(67-cargo.length*5)/Math.max(.01,gap));
        rock=mix(rock,(tx-x)*step*.4,Math.min(1,5*dt));
        x=mix(x,tx,step);z=mix(z,tz,step);
        height=clamp(height+(submerged?-39:49)*dt,4,109);
        air=clamp(air+(height>=106?26:-(4.1+cargo.length*.74))*dt,0,100);
        if(air===0&&height<106){
          loss+=cargo.length;cargo=[];height=109;submerged=false;air=95;remaining-=7;
          notice='AIR RESCUE  •  −7 SEC';noticeTime=2;api.sound('hurt');
        }
        if(height<=10&&submerged&&cargo.length<3){
          const b=beds.find(p=>p.cool===0&&Math.hypot(x-p.x,z-p.z)<19);
          if(b){cargo.push(b.gold?2:1);b.cool=17;notice=b.gold?'GOLD PEARL':'PEARL COLLECTED';noticeTime=1.2;api.sound('coin');api.haptic(12);}
        }
        if(height>=106&&!submerged&&cargo.length){
          const count=cargo.length;banked+=count;score+=cargo.reduce((sum,n)=>sum+n*100,0)+(count===3?100:0);
          cargo=[];notice=count===3?'FULL HAUL  +100 BONUS':'CATCH BANKED';noticeTime=1.65;api.sound('clear');
        }
        api.hud('Catch',score,'Shift',Math.max(0,Math.ceil(remaining))+'s');
        if(banked>=10||remaining<=0){done=true;api.end(score,[['Pearls landed',banked],['Lost at sea',loss]],banked>=10?'a whole little moon collection.':'the reef will be here tomorrow.');}
      },
      draw(c){
        c.fillStyle=gradient(c,0,480,[[0,'#173e59'],[.22,'#185166'],[.65,'#226c74'],[1,'#123e4c']]);c.fillRect(0,0,480,480);
        for(let i=0;i<7;i++){
          const s=i*103-83+Math.sin(time*.32+i)*8;poly(c,[[s,0],[s+15,0],[s-65,340],[s-135,340]],'#b7f9d509');
        }
        poly(c,[seabed(-173,-154),seabed(173,-154),seabed(173,154),seabed(-173,154)],'#286269');
        for(let i=0;i<22;i++){
          const p=[];for(let j=0;j<30;j++)p.push(seabed(-181+j*12,-150+i*14+Math.sin(j*.7+i*1.9+time*.25)*4));
          line(c,p,'#85cbb32b',1.4);
        }
        const [sx,sy]=seabed(x,z);
        oval(c,sx,sy,13,5,'#0d3b51');oval(c,sx,sy,21,7,null,'#a2ead275',1.3);
        for(const b of beds)shell(c,b);
        for(const p of corals)coral(c,p);
        const [bx,by]=seabed(x,z,height);line(c,[[bx,0],[bx+Math.sin(time+z*.03)*5,by*.55],[bx,by-12]],'#b9d9c274',1.5);
        for(let i=0;i<9;i++){
          const u=(time*.38+i/9)%1;
          oval(c,bx+15+Math.sin(time*1.2+i)*5+u*5,by-4-u*49,1+u*2,1+u*2,null,'#b5efdec2',.9);
        }
        c.save();c.translate(bx,by);c.rotate(clamp(rock,-.12,.12));
        if(height<90)poly(c,[[-9,5],[12,5],[25,height],[-24,height]],'#f6e6a021');
        oval(c,0,-3,15,17,'#db9b50','#304d51',2.2);
        poly(c,[[-14,-6],[-10,-15],[0,-20],[9,-15],[12,-8],[1,-10]],'#f9cb76');
        oval(c,1,-5,7.4,7.4,'#315e6c','#f7cb70',2.6);oval(c,-1,-7,2,2,'#a4ecdb');
        panel(c,-17,6,34,6,'#e7b565',2);line(c,[[-9,12],[-11,17],[-15,17]],'#a5bdb0',2.4);
        line(c,[[9,12],[11,17],[15,17]],'#a5bdb0',2.4);c.restore();
        panel(c,13,15,173,45,'#102f42e8');caption(c,'BELL AIR',25,29,'#c5efde',15,'left');meter(c,25,42,147,air/100,air<27?'#ff9f8b':'#81e0c7','#3d6871');
        if(noticeTime>0){panel(c,107,365,266,33,'#113d48ed');caption(c,notice,240,382,'#fff2c5',15);}
        panel(c,13,412,241,54,'#102e3f');caption(c,'HOLD',28,439,'#bad9cc',15,'left');
        for(let i=0;i<3;i++)oval(c,102+i*26,439,9,9,cargo[i]===2?'#ffe088':cargo[i]?'#b7ffec':'#355a65','#688b8d',1.4);
        caption(c,banked+'/10',225,439,'#ecedce',16);
        panel(c,267,412,199,54,submerged?'#f4c37b':'#8edcc5');caption(c,submerged?'↑  SURFACE':'↓  DIVE',366,439,'#193d48',20);
      },
    };
  },
};
