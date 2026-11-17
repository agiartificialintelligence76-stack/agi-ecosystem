import { clamp, mix, TAU, poly, line, oval, gradient, caption, panel, meter } from '../kit/field-art.js';

const ground=(x,z,h=0)=>[240+1.03*x+.44*z,305-.17*x+.58*z-h];
const labels=['KEPLER','RIMA','SILVA','HALO','MARE'];
export default {
  title:'MOON FREIGHT',tagline:'Five fragile deliveries. One lunar engine. Bring each crate down softly.',
  instructions:[
    ['Line up the shadow','Trim across the ground with the arrows, or tap the landing pad to steer toward it.'],
    ['Feather the engine','Hold Space or the amber burn button to slow your fall. The speed gauge turns green below 12 m/s.'],
    ['Land inside the ring','Keep lateral speed below 20 m/s on touchdown. Five outposts await your cargo and three hulls are available.'],
  ],
  keys:[['Arrows / WASD','Trim across the ground'],['Space','Hold for thrust']],touch:[['Tap the ground','Aim horizontal thrusters'],['Hold BURN','Fire main engine']],
  create(api){
    let x,z,h,vx,vz,vy,px,pz,tx,tz,touchAim=false,touchBurn=false,burn=false,assist=false;
    let fuel=100,hulls=3,delivered=0,score=0,t=0,delay=0,feedback='',done=false,touchdown=false;
    const keys=new Set(),craters=[],stars=[];
    for(let i=0;i<55;i++)stars.push([api.rng()*480,api.rng()*141,.6+api.rng()*1.05]);
    for(let i=0;i<43;i++)craters.push([api.rng()*565-45,151+api.rng()*330,2+api.rng()*17]);
    function launch(){
      px=(api.rng()-.5)*160;pz=(api.rng()-.5)*105;
      x=clamp(px+(api.rng()<.5?-1:1)*(35+delivered*5),-126,126);z=clamp(pz+(api.rng()-.5)*61,-110,110);
      h=97+delivered*5;vx=0;vz=0;vy=-3;fuel=100;touchBurn=false;touchAim=false;assist=false;touchdown=false;burn=false;
    }
    launch();
    function end(){
      done=true;api.end(score,[['Freight delivered',delivered+'/5'],['Hulls left',hulls]],delivered===5?'soft landing. the moon barely noticed.':'i put a little foam around the next crate.');
    }
    return {
      key(type,code){if(type==='down'){keys.add(code);if(code!=='Space')touchAim=false;}else keys.delete(code);},
      pointer(type,sx,sy){
        if(type==='up'||type==='cancel'){touchBurn=false;return;}
        if(type!=='down')return;
        if(sy>=400&&sx>=275){touchBurn=true;return;}
        if(sy>=400)return;
        const gx=sx-240,gy=sy-305,det=1.03*.58+.17*.44;
        tx=clamp((.58*gx-.44*gy)/det,-151,151);tz=clamp((.17*gx+1.03*gy)/det,-126,126);touchAim=true;
      },
      demo(){touchAim=true;tx=px;tz=pz;assist=vy<-(h>30?17:6.5);},
      update(dt){
        if(done)return;t+=dt;
        if(touchdown){
          delay-=dt;
          if(delay<=0){if(delivered===5||hulls===0)end();else launch();}return;
        }
        const has=(a,b)=>Number(keys.has(a)||keys.has(b));
        const steerX=touchAim?clamp((tx-x)*.08-vx*.068,-1,1):has('ArrowRight','KeyD')-has('ArrowLeft','KeyA');
        const steerZ=touchAim?clamp((tz-z)*.08-vz*.068,-1,1):has('ArrowDown','KeyS')-has('ArrowUp','KeyW');
        vx+=(steerX*36-vx*.89)*dt;vz+=(steerZ*36-vz*.89)*dt;
        x=clamp(x+vx*dt,-151,151);z=clamp(z+vz*dt,-126,126);
        burn=fuel>0&&(touchBurn||keys.has('Space')||assist);fuel=clamp(fuel-(burn?8.3:0)*dt,0,100);
        vy=clamp(vy+(burn?21:-10)*dt,-42,38);h=clamp(h+vy*dt,0,139);
        if(h>=139)vy=Math.min(0,vy);
        if(h===0){
          const dist=Math.hypot(x-px,z-pz),speed=Math.hypot(vx,vz);
          if(dist<=27&&Math.abs(vy)<=12&&speed<=20){
            delivered++;score+=200+Math.round(fuel*2+Math.max(0,14-dist)*7);
            feedback=dist<10?'BULLSEYE DELIVERY':'CARGO DELIVERED';api.sound('clear');
          }else{
            hulls--;feedback=dist>27?'OUTSIDE THE PAD':Math.abs(vy)>12?'HARD LANDING':'TOO MUCH SIDEWAYS DRIFT';api.sound('hurt');api.haptic(35);
          }
          touchdown=true;delay=1.5;burn=false;
        }
        api.hud('Freight',score,'Hulls',hulls);
      },
      draw(c){
        c.fillStyle=gradient(c,0,480,[[0,'#11162e'],[.31,'#3b3c58'],[.32,'#a095ae'],[1,'#6e708a']]);c.fillRect(0,0,480,480);
        for(const [sx,sy,s] of stars)oval(c,sx,sy,s,s,'#dae1ed');
        oval(c,384,64,24,24,'#80b1c4');poly(c,[[368,53],[379,45],[390,47],[385,54],[394,58],[388,64],[373,61]],'#d1decb');
        c.save();c.beginPath();c.arc(384,64,24,0,TAU);c.clip();oval(c,395,67,21,25,'#344964');c.restore();
        for(let j=0;j<3;j++){
          const points=[[-5,193]];for(let i=-1;i<=19;i++)points.push([i*28,140+j*10+Math.cos(i*1.7+j)*11+8*Math.sin(i*2.2)]);
          points.push([485,206]);poly(c,points,['#59596d','#79758a','#9991a4'][j]);
        }
        for(const [gx,gy,r] of craters){
          oval(c,gx,gy,r,r*.27,'#aaa1b2');oval(c,gx+1,gy-1.8,r*.93,r*.22,'#686c83');oval(c,gx-2,gy+.5,r*.64,r*.13,'#85869a');
        }
        // The dashed surface grid and the craft's shadow triangulate the full X/Z approach.
        for(let i=-3;i<=3;i++){
          line(c,[ground(i*45,-150),ground(i*45,150)],'#d9ced838',1);
          line(c,[ground(-160,i*45),ground(160,i*45)],'#d9ced838',1);
        }
        const [padX,padY]=ground(px,pz);
        oval(c,padX,padY,33,15,'#454c60','#e5b76e',2.5);
        oval(c,padX,padY,24,10,null,'#eacc86',1.2);
        line(c,[[padX-12,padY],[padX+12,padY]],'#f7d68b',1.7);line(c,[[padX,padY-5],[padX,padY+5]],'#f7d68b',1.7);
        for(const off of [-31,31]){
          line(c,[[padX+off,padY],[padX+off,padY-12]],'#5b5362',2);
          oval(c,padX+off,padY-13,2.7,2.7,Math.sin(t*5)>-.2?'#ffe7ac':'#ad8e77');
        }
        const [shadowX,shadowY]=ground(x,z),[bx,by]=ground(x,z,h);
        oval(c,shadowX,shadowY,16+h*.028,6+h*.02,'#323c4e77');
        if(h>8)line(c,[[shadowX,shadowY-1],[bx,by+7]],'#fff1d343',1);
        const safe=Math.abs(vy)<=12;
        c.save();c.translate(bx,by);c.rotate(clamp(vx*.004,-.16,.16));
        if(burn){
          const length=15+4*Math.sin(t*48);
          poly(c,[[-6,6],[0,6+length],[6,6]],'#f7a866');poly(c,[[-3.5,6],[0,14+length*.3],[3.5,6]],'#fff3b1');
        }
        for(const n of [-1,1]){
          line(c,[[n*7,-1],[n*13,2],[n*18,11],[n*22,11]],'#dcd5cb',2.8);
          line(c,[[n*7,4],[n*16,7]],'#928792',1.5);
        }
        poly(c,[[-7,5],[-4,-2],[4,-2],[7,5]],'#383b48');
        poly(c,[[-12,-4],[-10,-17],[-2,-23],[8,-19],[13,-9],[9,3],[-9,3]],'#e6c592');
        poly(c,[[-10,-17],[-2,-23],[2,-19],[-5,-12]],'#fff0bb');
        poly(c,[[3,-17],[8,-15],[11,-8],[3,-10]],'#58667b');
        poly(c,[[-10,-5],[11,-6],[9,2],[-9,3]],'#bd8a63');
        line(c,[[6,-18],[10,-29]],'#eee1b9',1.4);oval(c,10,-29,2,2,'#f4ba75');c.restore();
        panel(c,13,14,208,50,'#21263ee8');caption(c,'CARGO  '+(Math.min(5,delivered+1))+' / 5',26,30,'#ffd68e',16,'left');
        caption(c,labels[Math.min(4,delivered)]+' OUTPOST',26,50,'#ebebea',15,'left');
        panel(c,13,408,246,58,'#23293c');caption(c,'FUEL',24,427,'#d6d6db',15,'left');meter(c,76,424,68,fuel/100,'#edb86f','#535971');
        caption(c,Math.round(h)+' m',25,451,'#f0edeb',17,'left');caption(c,(vy>0?'↑ ':'↓ ')+Math.round(Math.abs(vy))+' m/s',151,451,safe?'#98e8ba':'#ffc191',17,'right');
        caption(c,h<39?(safe?'SOFT':'FAST'):'ALT',237,450,safe?'#98e8ba':'#efc997',15,'right');
        panel(c,272,408,194,58,burn?'#fff0b6':'#ecc384');caption(c,burn?'▲  BURNING':'▲  HOLD BURN',369,437,'#393643',18);
        if(touchdown){panel(c,88,355,304,35,'#292b43ed');caption(c,feedback,240,373,'#ffe1a1',16);}
      },
    };
  },
};
