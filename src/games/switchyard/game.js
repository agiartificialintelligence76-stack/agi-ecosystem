import { scenery, sprite, clamp, mix, poly, line, oval, panel, caption, gradient } from '../kit/field-art.js';

import { crossingScene, yardSkyline, departureStrip } from './junction.js';

const stations = ['A', 'B', 'C', 'D'];
const paints = ['#ef985e','#ebce70','#63bcac','#9bb1e4'];
const lanes = [-3.3,-1.1,1.1,3.3];
const point = (u,v,h=0) => [54+u*32+v*12,285-u*11+v*21-h];
const route = (u,branch,dest) => {
  if(u<=3) return 0;
  const half = branch ? 2.2 : -2.2;
  const t = clamp((u-3)/3.6,0,1), s = t*t*(3-2*t);
  if(u<=6.6) return half*s;
  const q=clamp((u-6.6)/3,0,1);
  return mix(half,lanes[dest],q*q*(3-2*q));
};
function block(c,u,v,w,d,h,roof,side,face) {
  const a=point(u,v,h),b=point(u+w,v,h),e=point(u+w,v+d,h),f=point(u,v+d,h);
  poly(c,[f,e,point(u+w,v+d),point(u,v+d)],side);
  poly(c,[a,f,point(u,v+d),point(u,v)],face);
  poly(c,[a,b,e,f],roof);
}
const vehicle = sprite(new URL('./vehicle.webp', import.meta.url));
const paintScenery = scenery(new URL('./scenery.webp', import.meta.url));

export default {
  title:'SWITCHYARD', tagline:'Run the harbor junction at rush hour. Keep the express on time while freight lorries share the crossing.',
  instructions:[
    ['Read the train', 'Each locomotive carries its platform letter. Route fifteen trains before three reach the wrong platform.'],
    ['Set both points', 'Switch 1 selects the A/B or C/D line. Switch 2 or 3 picks the exact platform.'],
    ['Ring the crossing bell', 'Press Space or tap the amber crossing signal. Road traffic stops for five seconds so waiting trains can cross. Afterward lorries get a short road turn.'],
    ['Keep time', 'Expresses carry a lightning mark and a tight deadline. Look at the approaching trains and time one bell for a convoy. A timely arrival earns a timetable bonus.'],
  ],
  keys:[['1 / 2 / 3','Flip the matching turnout'],['Space','Ring crossing bell']],touch:[['Tap a lever or signal','Flip that turnout'],['Tap crossing bell','Give trains a crossing window']],
  create(api){
    const switches=[0,0,0], trains=[], trees=[];
    for(let i=0;i<48;i++){
      const u=api.rng()*12-1, v=(api.rng()<.5?-1:1)*(3.8+api.rng()*2.5);
      trees.push({u,v,h:7+api.rng()*12});
    }
    let time=0, spawned=0, next=0, served=0, errors=0, streak=0, score=0, ended=false;
    let notice='RING FOR RAIL PRIORITY', noticeTime=2.4, lastDest=-1;
    let clearance=0,roadTurn=0,roadClock=0,arm=0,requestRail=false,onTime=0,convoys=0,through=0;
    function ring(){if(clearance>0||roadTurn>0||requestRail)return;requestRail=true;through=0;api.sound('power');api.haptic(12);}
    function flip(i){switches[i]=1-switches[i]; api.sound('click'); api.haptic(8);}
    function add(){
      const want=spawned===0 ? 0 : (lastDest+1+Math.floor(api.rng()*3))%4;
      const express=spawned%4===2||spawned%5===4;
      lastDest=want; trains.push({u:Math.min(-.8,(trains.at(-1)?.u??1)-1.18),want,branch:null,actual:null,express,age:0,deadline:express?12.8:15.6,crossed:false}); spawned++;
      next=Math.max(1.9,4.2-spawned*.16);
    }
    function position(t,u=t.u){const b=t.branch??switches[0];return route(u,b,t.actual??(b*2+switches[b+1]));}
    function track(c,from,to,branch,dest,active){
      const path=[];
      for(let n=0;n<=24;n++){
        const u=mix(from,to,n/24), v=route(u,branch,dest); path.push(point(u,v));
        if(n%3===0) line(c,[point(u,v-.28),point(u,v+.28)],'#78594b',3);
      }
      for(const offset of [-.14,.14]){
        const rail=path.map(([px,py])=>[px+12*offset,py+21*offset]);
        line(c,rail,active?'#ecddac':'#727874',2.6);
        line(c,rail.map(([px,py])=>[px,py-1]),active?'#fff5d5':'#c0bc9f',1);
      }
    }
    const signs=[[3,0],[6.6,-2.2],[6.6,2.2]];
    function train(c,t){
      const v=position(t), [px,py]=point(t.u,v);
      const behind=point(t.u-.3,position(t,t.u-.3));
      const angle=Math.atan2(py-behind[1],px-behind[0]);
      c.save();c.translate(px,py);c.rotate(angle);
      for(let j=1;j<=(t.express?1:2);j++){
        const xx=-j*16-7;
        poly(c,[[xx-5,0],[xx+6,0],[xx+6,-8],[xx-6,-8]],'#795546');
        poly(c,[[xx-6,-8],[xx-2,-12],[xx+8,-12],[xx+6,-8]],paints[t.want]);
        oval(c,xx-3,0,2.5,2.5,'#23322d');oval(c,xx+5,0,2.5,2.5,'#23322d');
      }
      if(!vehicle(c,-27,-26,36,27)){
      panel(c,-19,-11,23,11,'#263e36',3); panel(c,-20,-20,11,15,paints[t.want],2);
      c.fillStyle='#eff4dd';c.fillRect(-17,-17,5,6); c.fillStyle='#574f40';c.fillRect(-1,-17,4,7);
      for (const wheel of [-15,-7,1]) oval(c,wheel,0,3.5,3.5,'#453b36','#c3b994',1.3);
      }
      const smoke=(time*1.1+t.want*.22)%1;
      for(let k=0;k<4;k++){const q=(smoke+k*.25)%1;oval(c,-2-q*9,-17-q*18,1.4+q*4,1.7+q*3,'#e9e1c488');}
      c.restore();
      if(t.express){panel(c,px+12,py-50,17,18,'#f9c65f',3);caption(c,'↯',px+20,py-41,'#473c31',15);}
      panel(c,px-14,py-51,28,24,'#233831');caption(c,stations[t.want],px,py-39,paints[t.want],18);
    }
    return {
      key(type,code){if(type!=='down')return;if(code==='Space')ring();else if(/^Digit[123]$/.test(code))flip(Number(code.slice(-1))-1);},
      pointer(type,x,y){
        if(type!=='down')return;
        if(y>=320&&y<375&&x>=254){ring();return;}
        if(y>=375){flip(clamp(Math.floor(x/160),0,2));return;}
        const i=signs.findIndex(([u,v])=>{const [sx,sy]=point(u,v+1);return Math.hypot(x-sx,y-sy+13)<25;});
        if(i>=0)flip(i);
      },
      demo(){
        if(!clearance&&!roadTurn&&trains.some(t=>!t.crossed&&t.u>.5))ring();
        for(let i=0;i<3;i++){
          const t=trains.filter(tr=>i===0?tr.branch===null:tr.branch===i-1&&tr.actual===null).sort((a,b)=>b.u-a.u)[0];
          if(t)switches[i]=i===0?Math.floor(t.want/2):t.want%2;
        }
      },
      update(dt){
        if(ended)return;
        time+=dt;noticeTime-=dt;next-=dt;
        if(clearance>0){clearance=Math.max(0,clearance-dt);if(!clearance)roadTurn=2.6;}else roadTurn=Math.max(0,roadTurn-dt);
        arm=mix(arm,clearance>.3?1:0,Math.min(1,dt*5));
        if(arm<.3)roadClock+=dt;
        const occupied=[0,1,2].some(i=>Math.abs(((roadClock*.9+i*3.4)%10.6)-5.3)<.79);
        if(requestRail&&!occupied){requestRail=false;clearance=5.1;}
        if(next<=0&&spawned<15)add();
        let leader=Infinity;
        for(const t of trains){
          t.age+=dt;
          let proposed=t.u+(.93+spawned*.014+(t.express?.19:0))*dt;
          if(!t.crossed&&clearance<.35)proposed=Math.min(proposed,1.34);
          proposed=Math.min(proposed,leader-1.18);
          if(!t.crossed&&proposed>=1.49){t.crossed=true;through++;if(through===2){convoys++;notice='DOUBLE DISPATCH';noticeTime=1.25;api.sound('combo');}}
          t.u=proposed;leader=t.u;
          if(t.u>=3&&t.branch===null)t.branch=switches[0];
          if(t.u>=6.6&&t.actual===null)t.actual=t.branch*2+switches[t.branch+1];
          if(t.u>=10.8&&!t.done){
            t.done=true;served++;
            if(t.actual===t.want){streak++;const punctual=t.age<=t.deadline;if(punctual)onTime++;score+=100+Math.min(6,streak-1)*20+(punctual?(t.express?140:50):0);notice=punctual?'ON TIME  •  PLATFORM '+stations[t.want]:'ARRIVAL  •  PLATFORM '+stations[t.want];api.sound('clear');}
            else{errors++;streak=0;notice='WRONG PLATFORM  •  '+errors+'/3';api.sound('error');}
            noticeTime=1.5;
          }
        }
        while(trains[0]?.done)trains.shift();
        api.hud('Dispatch',score,'Arrivals',served+'/15');
        if(served===15||errors===3||time>=96){ended=true;api.end(score,[['Correct platforms',served-errors],['On time',onTime+'/15'],['Double dispatches',convoys],['Wrong platforms',errors]],errors===0?'every little train made it home.':'shift change. i saved you a window seat.');}
      },
      draw(c){
        c.fillStyle=gradient(c,0,480,[[0,'#edf0c9'],[.6,'#c7d8a6'],[1,'#9eae87']]);c.fillRect(0,0,480,480);
        yardSkyline(c,time);
        poly(c,[point(-1.5,-5.3),point(12,-5.3),point(12,5),point(-1.5,5)],'#b7ce92');
        poly(c,[point(-1.5,5),point(12,5),point(12,5,-11),point(-1.5,5,-11)],'#91785b');
        paintScenery(c);
        for(const t of trees){
          const [px,py]=point(t.u,t.v);oval(c,px+3,py,7,3,'#91a777');
          line(c,[[px,py],[px,py-t.h]],'#735e48',2.3);poly(c,[[px,py-t.h-6],[px-6,py-5],[px+6,py-6]],'#648569');
        }
        for(let i=0;i<4;i++){
          const v=lanes[i];
          block(c,9.6,v+.23,1.6,.48,4,'#e5cd98','#af956e','#876f54');
          block(c,10.45,v-.92,.72,.62,15,'#e9e0c2','#f3deaf','#cfba90');
          block(c,10.36,v-1,.89,.76,19,paints[i],'#736657','#97846a');
        }
        crossingScene(c,point,arm,roadClock,time);
        track(c,-1,3,0,0,true);
        for(let b=0;b<2;b++){
          track(c,3,6.6,b,b*2,b===switches[0]);
          for(let j=0;j<2;j++)track(c,6.6,11.1,b,b*2+j,j===switches[b+1]);
        }
        for(let i=0;i<4;i++){
          const [px,py]=point(11.29,lanes[i]);
          line(c,[[px,py],[px,py-26]],'#685d4d',3);
          panel(c,px-12,py-39,24,23,'#31433a',4);caption(c,stations[i],px,py-27,paints[i],16);
        }
        signs.forEach(([u,v],i)=>{
          const [px,py]=point(u,v+1);
          line(c,[[px,py],[px,py-16]],'#564d44',3);
          oval(c,px,py-20,9,9,'#f7e9c8','#685d49',1.5);caption(c,i+1,px,py-20,'#384b3a',15);
        });
        for(const t of trains)train(c,t);
        panel(c,14,15,195,38,'#283c34');caption(c,'NORTH VALLEY RAIL',27,34,'#f6e9c2',17,'left');departureStrip(c,trains,stations);
        panel(c,10,328,234,37,'#30443be8');caption(c,noticeTime>0?notice:'ON TIME  '+onTime+' / '+served,127,347,'#fcf0cb',14);
        panel(c,253,321,217,48,clearance>0?'#adcfaa':roadTurn>0?'#c4bbb1':'#f5c681');caption(c,clearance>0?'RAIL OPEN  '+clearance.toFixed(1):roadTurn>0?'ROAD TURN  '+roadTurn.toFixed(1):requestRail?'CLEARING ROAD…':'♢  RING CROSSING',361,346,'#304238',16);
        for(let i=0;i<3;i++){
          const bx=5+i*158;
          panel(c,bx,380,153,83,'#35483e',10);
          caption(c,'POINT '+(i+1),bx+14,398,'#d1d8b5',15,'left');
          const label=i===0?['A / B','C / D'][switches[i]]:stations[(i-1)*2+switches[i]];
          caption(c,label,bx+14,435,'#ffedc3',23,'left');
          const ex=bx+114+switches[i]*17;line(c,[[bx+122,443],[ex,419]],'#e1dab8',5);
          oval(c,ex,418,7,7,i===0?'#edab75':paints[(i-1)*2+switches[i]]);
        }
      },
    };
  },
};
