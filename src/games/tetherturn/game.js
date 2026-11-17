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
  title:'TETHER TURN',tagline:'Swing around a beacon, release on the tangent, and thread the next orbit.',
  instructions:[['Watch the tangent','Your shuttle circles its tether. The dotted line shows the direction you will fly.'],
    ['Release and catch','Tap anywhere or press Space as the line points through the next ring. The new tether catches you automatically.'],
    ['Thread the core','A pass through the small gold center builds a bonus streak. Reach the sixteenth transfer before your three hulls run out.']],
  keys:[['Space / Enter','Release the tether']],
  touch:[['Tap anywhere','Release the tether']],
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
    const center=(i,t=time)=>({x:nodes[i].x,y:nodes[i].y+nodes[i].amp*Math.sin(t*.95+nodes[i].phase)});
    const radius=()=>Math.max(23,35-index*.7);
    const spin=()=>(index%5===3 || index%5===4?-1:1)*(1.48+Math.min(index*.075,.85));
    function setPlayer(){
      const n=center(index);player={x:n.x+ORBIT*Math.cos(ang),y:n.y+ORBIT*Math.sin(ang)};bearing=ang+Math.sign(spin())*Math.PI/2;
    }
    function result(win){
      mode='end';api.end(score,[['Transfers',`${index} / ${LAST}`],['Core passes',cores],['Best core streak',best]],win?'sixteen catches. the whole sky is yours. 💜':'i marked your last orbit on the star chart.');
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
    function catchNode(precise){
      const n=center(index+1);
      index++;ang=Math.atan2(player.y-n.y,player.x-n.x);
      chain=precise?chain+1:0;best=Math.max(best,chain);cores+=Number(precise);
      score+=100+(precise?60*Math.min(chain,5):0);
      message=precise?(chain>1?`Core streak ×${chain}`:'Core pass!'):'Tether caught';
      messageTime=1.1;api.sound(precise?'combo':'merge');api.haptic(precise?24:12);
      burst(n.x,n.y,precise?GOLD:CYAN);api.hud('Score',score,'Hulls',lives);
      if(index===LAST){result(true);return;}
      mode='orbit';aimDelay=.42;setPlayer();
    }
    function miss(){
      lives--;chain=0;message=lives?'Lost signal · rewinding':'Signal lost';messageTime=1.2;
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
        const next=center(index+1), ux=vx/SPEED,uy=vy/SPEED,dx=next.x-player.x,dy=next.y-player.y;
        const along=dx*ux+dy*uy, side=Math.abs(dx*uy-dy*ux);
        player.x+=vx*dt;player.y+=vy*dt;launched+=dt;
        if(along>=-SPEED*dt && along<=SPEED*dt+radius() && Math.hypot(player.x-next.x,player.y-next.y)<=radius())catchNode(side<12);
        else if(launched>1.18 || (player.y<30 || player.y>433) || player.x<nodes[index].x-115)miss();
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
      const bg=c.createLinearGradient(0,0,0,480);bg.addColorStop(0,'#11233a');bg.addColorStop(.68,'#273d53');bg.addColorStop(1,'#635268');
      c.fillStyle=bg;c.fillRect(0,0,480,480);
      for(let i=0;i<105;i++){
        const x=((i*137.5-camera*(i%3*.08+.12))%503+503)%503-10,y=41+((i*137+Math.floor(i/8)*51)%358);
        dot(c,x,y,i%13===0?1.9:.8,i%3===0?'#b8cad0':'#78909d');
        if(i%19===0){c.fillStyle='#d5d7c9';c.fillRect(x-4,y,8,1);c.fillRect(x,y-4,1,8);}
      }
      // A ringed moon and successive paper-cut ridgelines drift at different depths.
      const moonX=392-camera*.064;
      c.save();c.translate(moonX,102);c.rotate(-.28);
      c.beginPath();c.ellipse(0,5,83,13,0,0,TAU);c.strokeStyle='#c0aaa9';c.lineWidth=3;c.stroke();
      dot(c,0,0,39,'#d39f83');c.save();c.beginPath();c.arc(0,0,39,0,TAU);c.clip();
      for(let i=0;i<6;i++){c.fillStyle=i%2?'#c88d7a':'#e0b397';c.fillRect(-43,i*12-38+3*Math.sin(i),86,3+i%3);}
      c.restore();c.beginPath();c.ellipse(0,5,83,13,0,0,Math.PI);c.strokeStyle='#e6c9ad';c.lineWidth=3;c.stroke();c.restore();
      for(let layer=0;layer<3;layer++){
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
        if(next){ring(c,0,0,12,GOLD,1.2);label(c,'NEXT',0,r+25,15,GOLD,'center');}
        c.restore();
      }
      if(mode==='orbit' && index<LAST){
        const origin=center(index),target=center(index+1), aim=aimAt(player,bearing,target),
          aligned=aim.along>0 && aim.offset<radius(),col=aligned?GOLD:'#d6e6d0';
        c.strokeStyle=CYAN;c.lineWidth=2.5;c.beginPath();c.moveTo(origin.x,origin.y);c.lineTo(player.x,player.y);c.stroke();
        c.strokeStyle=col;c.lineWidth=aligned?2.5:1.6;c.setLineDash([4,7]);c.beginPath();c.moveTo(player.x,player.y);
        const length=aligned?aim.along:99;c.lineTo(player.x+Math.cos(bearing)*length,player.y+Math.sin(bearing)*length);c.stroke();c.setLineDash([]);
      }
      for(const p of trail)dot(c,p.x,p.y,Math.max(.5,p.life*8),p.flight?'#ffe4ac':'#92d6cd');
      for(const p of particles){c.globalAlpha=clamp(p.life*3,0,1);dot(c,p.x,p.y,2,p.color);}c.globalAlpha=1;
      if(mode!=='retry'){
        c.save();c.translate(player.x,player.y);c.rotate(bearing);
        poly(c,[[-8,-4],[-15-(Math.sin(time*22)+1)*2,0],[-8,4]],GOLD);
        poly(c,[[13,0],[-8,-8],[-4,-1],[-8,8]],PAPER);poly(c,[[8,0],[-5,1],[-8,8]],'#f59369');c.restore();
      }
      c.restore();
      c.fillStyle='#14263b';c.fillRect(0,0,480,48);label(c,`TRANSFER  ${String(index).padStart(2,'0')} / ${LAST}`,15,29,17,PAPER);
      label(c,`HULL  ${'◆'.repeat(lives)}`,465,29,17,CYAN,'right');
      c.fillStyle='#16304a';c.fillRect(0,424,480,56);
      const aim=mode==='orbit' && index<LAST?aimAt(player,bearing,center(index+1)):null;
      const ready=aim && aim.along>0 && aim.offset<=radius();
      c.fillStyle=ready?GOLD:CYAN;c.fillRect(0,424,480,3);
      label(c,mode==='flight'?'IN FLIGHT':mode==='retry'?'SIGNAL LOST':ready?'RELEASE NOW':'TAP TO RELEASE',16,459,19,ready?GOLD:PAPER);
      label(c,messageTime>0?message:'Aim at the next ring',463,458,15,ready?GOLD:CYAN,'right');
    }
    setPlayer();api.hud('Score',score,'Hulls',lives);
    return {update,draw,pointer(type){if(type==='down')release();},key(type,code){if(type==='down' && (code==='Space' || code==='Enter'))release();},
      demo(dt){
        if(mode!=='orbit')return;aimDelay-=dt;if(aimDelay>0)return;
        const target=center(index+1,time+.57), aim=aimAt(player,bearing,target);
        if(aim.along>0 && aim.offset<6)release();
      },
    };
  },
};
