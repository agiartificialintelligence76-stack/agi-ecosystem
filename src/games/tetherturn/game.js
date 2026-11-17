import { painting } from '../kit/illustration.js';
const paintVista=painting(new URL('./rescue-horizon.webp',import.meta.url).href);
import { clamp, TAU } from '../kit/fx.js';

const LAST=16, SPEED=293, ORBIT=37, SKY='#152a48', CYAN='#7de2ce', GOLD='#ffcc7b', PAPER='#ffecd2';
export function aimAt(player,angle,target){
  const dx=target.x-player.x,dy=target.y-player.y,ux=Math.cos(angle),uy=Math.sin(angle);
  return {along:dx*ux+dy*uy, offset:Math.abs(dx*uy-dy*ux)};
}
function dot(c,x,y,r,col){c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=col;c.fill();}
function ring(c,x,y,r,col,width){c.beginPath();c.arc(x,y,r,0,TAU);c.lineWidth=width;c.strokeStyle=col;c.stroke();}
function poly(c,p,col){c.fillStyle=col;c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function label(c,s,x,y,size,col,align='left'){c.fillStyle=col;c.font=`bold ${size}px "AK Mono", monospace`;c.textAlign=align;c.fillText(s,x,y);}
function arc(c,x,y,r,a,b,col,width){c.beginPath();c.arc(x,y,r,a,b);c.lineWidth=width;c.strokeStyle=col;c.stroke();}
export default {
  title:'TETHER TURN',tagline:'Bank through an orbital salvage run. Take the broad beacon or risk a tight catch to rescue a stranded pilot.',
  instructions:[['Watch the tangent','Your shuttle circles its tether. The dotted line shows the direction you will fly.'],
    ['Release and catch','Tap or press Space to release on the tangent. In flight, hold an arrow or either side of the screen to bend your path. Core catches refill fuel.'],
    ['Thread the core','When a violet lifeboat appears, tap Route or press R to aim for it. Its smaller ring rescues a pilot. Every second rescue repairs one hull.']],
  keys:[['Space / Enter','Release the tether'],['R','Aim for other route'],['↑ / ↓','Hold to bank in flight']],
  touch:[['Tap the field','Release the tether'],['Tap Route','Change target'],['Hold left / right half','Bank up / down in flight']],
  create(api){
    const nodes=[{x:112,y:253,amp:0,phase:0}];
    for(let i=1;i<=LAST;i++)nodes.push({
      x:nodes[i-1].x+166+api.rng()*34,
      y:clamp(nodes[i-1].y+(api.rng()-.5)*142,129,327),
      amp:i>=5 ? 7+api.rng()*13 : 0, phase:api.rng()*TAU,
    });
    let index=0, ang=-2.55, time=0, mode='orbit', lives=3, score=0, chain=0, best=0, cores=0;
    let player={x:0,y:0}, vx=0,vy=0, camera=0, launched=0, retry=0, message='', messageTime=0, particles=[], trail=[];
    let serial=0, frameTime=0, aimDelay=.35, bearing=0;
    let rescueAim=false,rescued=0,fuel=1,bank=0,thrusterTime=0;
    const saved=new Set();
    const hasPod=i=>i>0 && (i%3===2 || i===LAST);
    const center=(i,t=time,pod=saved.has(i))=>{
      const node=nodes[i];let y=node.y+node.amp*Math.sin(t*.95+node.phase);
      if(pod)y+=node.y>223?-82:82;
      return {x:node.x+(pod?16:0),y};
    };
    const target=(t=time)=>center(index+1,t,rescueAim);
    function toggleRoute(){
      if(mode!=='orbit'||!hasPod(index+1))return;
      rescueAim=!rescueAim;api.sound('select');message=rescueAim?'Lifeboat locked':'Beacon locked';messageTime=1;
    }
    const radius=()=>Math.max(23,35-index*.7);
    const spin=()=>(index%5===3 || index%5===4?-1:1)*(1.48+Math.min(index*.075,.85));
    function setPlayer(){
      const n=center(index);player={x:n.x+ORBIT*Math.cos(ang),y:n.y+ORBIT*Math.sin(ang)};bearing=ang+Math.sign(spin())*Math.PI/2;
    }
    function result(win){
      mode='end';api.end(score,[['Transfers',`${index} / ${LAST}`],['Core passes',cores],['Best core streak',best],['Pilots rescued',rescued],['Thruster seconds',Math.round(thrusterTime)]],win?'sixteen catches. the whole sky is yours. 💜':'i marked your last orbit on the star chart.');
    }
    function burst(x,y,col){
      for(let i=0;i<18;i++){const a=i*TAU/18, speed=24+((i*53+serial*17)%67);
        particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,color:col,life:.25+(i%4)*.08});}
      serial++;
    }
    function release(){
      if(mode!=='orbit')return;
      mode='flight';vx=Math.cos(bearing)*SPEED;vy=Math.sin(bearing)*SPEED;launched=0;
      burst(player.x,player.y,CYAN);api.haptic(10);api.sound('whoosh');
    }
    function catchNode(precise,pod){
      if(pod)saved.add(index+1);
      const n=center(index+1);
      index++;ang=Math.atan2(player.y-n.y,player.x-n.x);
      chain=precise?chain+1:0;best=Math.max(best,chain);cores+=Number(precise);
      score+=100+(precise?60*Math.min(chain,5):0);
      message=precise?(chain>1?`Core streak ×${chain}`:'Core pass!'):'Tether caught';
      if(precise)fuel=Math.min(1,fuel+.42);else fuel=Math.min(1,fuel+.12);
      if(pod){rescued++;score+=280;message='Pilot aboard!';if(rescued%2===0){lives=Math.min(3,lives+1);message='Rescue pair · hull repaired';}}
      rescueAim=false;bank=0;
      messageTime=1.1;api.sound(precise?'combo':'merge');api.haptic(precise?24:12);
      burst(n.x,n.y,precise?GOLD:CYAN);api.hud('Score',score,'Hulls',lives);
      if(index===LAST){result(true);return;}
      mode='orbit';aimDelay=.42;setPlayer();
    }
    function miss(){
      lives--;chain=0;bank=0;fuel=Math.max(fuel,.6);message=lives?'Lost signal · rewinding':'Signal lost';messageTime=1.2;
      api.sound('hurt');api.haptic(40);api.hud('Score',score,'Hulls',lives);burst(player.x,player.y,'#ff947c');
      if(!lives){result(false);return;}mode='retry';retry=.66;
    }
    function update(dt){
      if(mode==='end')return;time+=dt;messageTime-=dt;
      if(mode==='retry'){
        retry-=dt;if(retry<=0){mode='orbit';ang=-2.55;trail=[];aimDelay=.35;setPlayer();}
      }else if(mode==='orbit'){
        ang+=spin()*dt;setPlayer();
      }else{
        if(bank && fuel>0){
          bearing+=bank*1.48*dt;fuel=Math.max(0,fuel-dt*.5);thrusterTime+=dt;
          vx=Math.cos(bearing)*SPEED;vy=Math.sin(bearing)*SPEED;
        }
        const old={...player};player.x+=vx*dt;player.y+=vy*dt;launched+=dt;
        let caught=false;
        for(const pod of hasPod(index+1)?[false,true]:[false]){
          const beacon=center(index+1,time,pod),aim=aimAt(old,bearing,beacon),r=pod?20:radius();
          if(aim.along>=-SPEED*dt && aim.along<=SPEED*dt+r && Math.hypot(player.x-beacon.x,player.y-beacon.y)<=r){
            catchNode(aim.offset<10,pod);caught=true;break;
          }
        }
        if(!caught && (launched>1.4 || player.y<30 || player.y>430 || player.x<nodes[index].x-115))miss();
      }
      frameTime+=dt;
      if(frameTime>=.025){
        frameTime=0;trail.push({...player,life:.48,flight:mode==='flight'});
      }
      for(const p of trail)p.life-=dt;trail=trail.filter(p=>p.life>0);
      particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}
      const camTarget=mode==='orbit'?nodes[index].x-112:Math.max(nodes[index].x-112,player.x-172);
      camera+= (camTarget-camera)*(1-Math.exp(-dt*6));
    }
    function draw(c){
      const sector=Math.min(3,Math.floor(index/4)),skies=[['#10243c','#2e495e','#675574'],['#292344','#57456c','#ad757b'],['#12323d','#375f64','#768b79'],['#382d49','#865a65','#dab38e']][sector];
      const bg=c.createLinearGradient(0,0,0,480);bg.addColorStop(0,skies[0]);bg.addColorStop(.68,skies[1]);bg.addColorStop(1,skies[2]);
      c.fillStyle=bg;c.fillRect(0,0,480,480);
      const painted=paintVista(c,-14-11*Math.sin(camera*.0016),-12,517,507);
      for(let i=0;i<3;i++){const cx=150+i*155-camera*.042,cy=114+Math.sin(i*2)*36,r=80+i*18;
        const gas=c.createRadialGradient(cx,cy,3,cx,cy,r);gas.addColorStop(0,['#d3a6e935','#93e8e638','#d7ad9c3b'][i]);gas.addColorStop(1,'#c6deec00');c.fillStyle=gas;c.fillRect(cx-r,cy-r,r*2,r*2);}
      for(let i=0;i<105;i++){
        const x=((i*137.5-camera*(i%3*.08+.12))%503+503)%503-10,y=41+((i*137+Math.floor(i/8)*51)%358);
        dot(c,x,y,i%13===0?1.9:.8,i%3===0?'#b8cad0':'#78909d');
        if(i%19===0){c.fillStyle='#d5d7c9';c.fillRect(x-4,y,8,1);c.fillRect(x,y-4,1,8);}
      }
      // A ringed moon and successive paper-cut ridgelines drift at different depths.
      if(!painted){const moonX=392-camera*.064;
      c.save();c.translate(moonX,102);c.rotate(-.28);
      c.beginPath();c.ellipse(0,5,83,13,0,0,TAU);c.strokeStyle='#c0aaa9';c.lineWidth=3;c.stroke();
      dot(c,0,0,39,'#d39f83');c.save();c.beginPath();c.arc(0,0,39,0,TAU);c.clip();
      for(let i=0;i<6;i++){c.fillStyle=i%2?'#c88d7a':'#e0b397';c.fillRect(-43,i*12-38+3*Math.sin(i),86,3+i%3);}
      c.restore();c.beginPath();c.ellipse(0,5,83,13,0,0,Math.PI);c.strokeStyle='#e6c9ad';c.lineWidth=3;c.stroke();c.restore();}
      for(let i=0;i<3;i++){const xx=((170+i*205-camera*.18)%650+650)%650-70,yy=265+Math.sin(i*2)*30;
        poly(c,[[xx-5,yy+85],[xx-3,yy],[xx+3,yy],[xx+7,yy+85]],'#394358');
        c.save();c.translate(xx,yy);c.rotate(-.23);
        poly(c,[[-25,-16],[-20,-3],[-9,2],[1,3],[15,-2],[24,-15],[8,-8],[-9,-6]],'#8d838b');
        c.strokeStyle='#b9a6a1';c.lineWidth=1.5;c.beginPath();c.moveTo(-17,-10);c.lineTo(0,-27);c.lineTo(14,-9);c.stroke();dot(c,0,-26,2,'#e8c4a6');c.restore();}
      for(let layer=painted?2:0;layer<3;layer++){
        const step=42,off=camera*(.09+layer*.065),start=Math.floor(off/step);
        c.fillStyle=['#5d6173','#434f65','#303e56'][layer];c.beginPath();c.moveTo(-5,449);
        for(let j=start;j<start+15;j++){const x=j*step-off,y=341+layer*24+Math.sin(j*1.58+layer)*19+Math.sin(j*.64+layer*2)*17;c.lineTo(x,y);}
        c.lineTo(490,449);c.closePath();c.fill();
      }
      c.save();c.beginPath();c.rect(0,49,480,376);c.clip();c.translate(-camera,0);
      for(let i=Math.max(0,index-1);i<=Math.min(nodes.length-1,index+3);i++){
        const n=center(i), current=i===index, next=i===index+1, col=next?GOLD:current?CYAN:'#8ba8b3';
        c.save();c.translate(n.x,n.y);
        if(i>index+1)c.globalAlpha=.55;
        const r=next?radius():34;
        ring(c,0,0,r,col,1.4);arc(c,0,0,r+4,-1.5+time*.33,-.25+time*.33,col,2.5);
        arc(c,0,0,r+4,1.64+time*.33,2.89+time*.33,col,2.5);
        for(let k=0;k<12;k++){const a=k*TAU/12;c.save();c.rotate(a);c.fillStyle=col;c.fillRect(r-4,-.7,k%3===0?10:5,1.4);c.restore();}
        poly(c,[[0,-9],[8,-3],[5,8],[-5,8],[-8,-3]],col);dot(c,0,0,3,SKY);
        if(next){ring(c,0,0,12,GOLD,1.2);c.fillStyle='#372f3ddc';c.fillRect(-33,r+8,66,23);label(c,rescueAim?'BEACON':'NEXT',0,r+25,15,GOLD,'center');}
        c.restore();
      }
      if(index<LAST && hasPod(index+1)){
        const pod=center(index+1,time,true);c.save();c.translate(pod.x,pod.y);const violet='#e0b8ff';
        ring(c,0,0,20,violet,1.5);arc(c,0,0,24,time*1.2,time*1.2+2.2,violet,2.5);
        poly(c,[[-12,6],[-10,-6],[-6,-11],[5,-11],[11,-5],[12,6],[7,10],[-7,10]],'#936fa7');
        dot(c,0,-2,7,'#c1dae2');dot(c,0,-2,4,'#715b79');c.fillStyle=violet;c.fillRect(-12,6,24,3);
        c.fillStyle='#302842dc';c.fillRect(-48,25,96,21);label(c,rescueAim?'RESCUE LOCK':'LIFEBOAT',0,40,14,'#f1d7ff','center');c.restore();
      }
      if(mode==='orbit' && index<LAST){
        const origin=center(index),aim=aimAt(player,bearing,target()),
          aligned=aim.along>0 && aim.offset<(rescueAim?20:radius()),col=aligned?GOLD:'#d6e6d0';
        c.strokeStyle=CYAN;c.lineWidth=2.5;c.beginPath();c.moveTo(origin.x,origin.y);c.lineTo(player.x,player.y);c.stroke();
        c.strokeStyle=col;c.lineWidth=aligned?2.5:1.6;c.setLineDash([4,7]);c.beginPath();c.moveTo(player.x,player.y);
        const length=aligned?aim.along:99;c.lineTo(player.x+Math.cos(bearing)*length,player.y+Math.sin(bearing)*length);c.stroke();c.setLineDash([]);
      }
      for(const p of trail)dot(c,p.x,p.y,Math.max(.5,p.life*8),p.flight?'#ffe4ac':'#92d6cd');
      for(const p of particles){c.globalAlpha=clamp(p.life*3,0,1);dot(c,p.x,p.y,2,p.color);}c.globalAlpha=1;
      if(mode!=='retry'){
        c.save();c.translate(player.x,player.y);c.rotate(bearing);
        poly(c,[[-8,-4],[-15-(Math.sin(time*22)+1)*2,0],[-8,4]],GOLD);
        poly(c,[[15,0],[4,-4],[-5,-11],[-9,-10],[-6,-3],[-11,-3],[-11,3],[-5,3],[-8,10],[-4,10]],PAPER);
        poly(c,[[10,0],[1,2],[-7,9],[-4,2],[-9,2],[-9,-1]],'#f39b76');
        poly(c,[[8,0],[0,-3],[-3,-2],[1,0]],'#5397aa');
        if(bank && fuel>0 && mode==='flight')poly(c,[[-6,-bank*3],[-10,-bank*14],[-2,-bank*4]],CYAN);
        c.restore();
      }
      c.restore();
      c.fillStyle='#14263b';c.fillRect(0,0,480,48);label(c,`TRANSFER  ${String(index).padStart(2,'0')} / ${LAST}`,15,29,17,PAPER);
      label(c,`HULL  ${'◆'.repeat(lives)}`,465,29,17,CYAN,'right');
      c.fillStyle='#16304a';c.fillRect(0,424,480,56);
      const aim=mode==='orbit' && index<LAST?aimAt(player,bearing,target()):null;
      const ready=aim && aim.along>0 && aim.offset<=(rescueAim?20:radius());
      c.fillStyle=ready?GOLD:CYAN;c.fillRect(0,424,480,3);
      if(mode==='flight'){
        label(c,'▲ BANK UP',14,453,17,PAPER);label(c,'BANK DOWN ▼',466,453,17,PAPER,'right');
        c.fillStyle='#466074';c.fillRect(165,450,148,6);c.fillStyle=CYAN;c.fillRect(165,450,148*fuel,6);
        label(c,'THRUST',240,475,13,CYAN,'center');
      }else{
        label(c,mode==='retry'?'SIGNAL LOST':ready?'RELEASE NOW':'TAP TO RELEASE',13,452,18,ready?GOLD:PAPER);
        label(c,messageTime>0?message:`Sector ${Math.min(4,sector+1)} · ${rescued} rescued`,14,474,14,CYAN);
        if(mode==='orbit' && hasPod(index+1)){c.fillStyle=rescueAim?'#b18bc7':'#66989a';c.fillRect(331,433,137,38);label(c,rescueAim?'R · LIFEBOAT':'R · BEACON',400,457,16,'#10273a','center');}
      }
    }
    setPlayer();api.hud('Score',score,'Hulls',lives);
    return {update,draw,
      pointer(type,x,y){
        if(type==='up'||type==='cancel'){bank=0;return;}
        if(mode==='flight' && type==='down'){bank=x<240?-1:1;return;}
        if(type==='down' && mode==='orbit'){if(x>=326&&y>=425&&hasPod(index+1))toggleRoute();else release();}
      },
      key(type,code){
        if(type==='up'){if(['ArrowUp','ArrowDown','KeyW','KeyS'].includes(code))bank=0;return;}
        if(type!=='down')return;
        if(code==='KeyR')toggleRoute();
        else if(mode==='flight' && ['ArrowUp','KeyW','ArrowDown','KeyS'].includes(code))bank=['ArrowUp','KeyW'].includes(code)?-1:1;
        else if(code==='Space'||code==='Enter')release();
      },
      demo(dt){
        if(mode!=='orbit')return;aimDelay-=dt;if(aimDelay>0)return;
        rescueAim=hasPod(index+1);const aim=aimAt(player,bearing,target(time+.61));
        if(aim.along>0 && aim.offset<6)release();
      },
    };
  },
};
