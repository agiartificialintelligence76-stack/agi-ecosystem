import {oval,polygon,line} from '../kit/illustration.js';
export const ink='#423249';
export function form(c,d,fill,edge=ink,width=1){
 c.beginPath();for(const [method,...points] of d)c[method](...points);
 if(fill){c.fillStyle=fill;c.fill();}if(edge){c.lineWidth=width;c.strokeStyle=edge;c.lineJoin='round';c.lineCap='round';c.stroke();}
}
const M=(x,y)=>['moveTo',x,y],B=(...a)=>['bezierCurveTo',...a],Q=(...a)=>['quadraticCurveTo',...a],L=(x,y)=>['lineTo',x,y],Z=['closePath'];
function limb(c,ax,ay,bx,by,cx,cy,color,width){
 const curve=[M(ax,ay),Q(bx,by,cx,cy)];form(c,curve,null,ink,width+1.8);form(c,curve,null,color,width);
}
function hand(c,x,y,size,turn,open){
 c.save();c.translate(x,y);c.rotate(turn);c.scale(size,size);
 const skin='#ffe0cf';oval(c,0,0,2.65,3.3,skin,ink,.63);
 if(open){for(let i=0;i<4;i++){const xx=-1.9+i*1.18,dx=(i-1.6)*.68,l=3.2+(i===1||i===2?1.1:0);limb(c,xx,-1.25,xx+dx*.6,-l,xx+dx,-l-1.3,skin,.85);}}
 limb(c,-1.2,0,-3.6,-.3,-3.6,-1.9,skin,1);c.restore();
}
function shoe(c,x,y,angle){
 c.save();c.translate(x,y);c.rotate(angle);form(c,[M(-3.1,-1),Q(.5,-3,3,-2),Q(6,-1.6,7.7,1.2),Q(8.4,3.3,4.4,3.4),L(-3.5,3.4),Q(-4.5,1.4,-3.1,-1),Z],'#fff5e4',ink,.85);
 line(c,[[-3,2.2],[6,2.2]],'#b9a4ad',.8);line(c,[[2,-.9],[4,-.5]],'#b899ac',.7);c.restore();
}
function face(c,scene,t){
 const turn=Math.sin(scene.phase-.20)*.18+(scene.a.pose==='turn'||scene.a.pose==='twirl'?scene.angle*.36:0);
 const blink=(t%4.8>4.65)||scene.a.pose==='react'&&scene.gesture>.95;
 c.save();c.translate(turn*1.4,0);c.rotate(turn*.18);
 // Face, cheek, eyes and the three layers of bangs stay on the same head joint.
 form(c,[M(-10,-7),Q(-11,-18,1,-18),Q(13,-16,12,-5),Q(11,6,1,9),Q(-7,6,-10,-7),Z],'#ffdfcc',ink,.9);
 oval(c,-10.5,-2.4,1.9,3,'#f5c4b5',ink,.7);
 for(const side of [-1,1]){
  const x=side*(4.6-turn*.7)+turn,ey=-3.6;
  if(blink){form(c,[M(x-2.9,ey+.6),Q(x,ey+2.4,x+2.8,ey+.3)],null,ink,.95);}
  else{
   form(c,[M(x-3,ey-.32),Q(x-.8,ey-3,x+2.5,ey-1.35),Q(x+3,ey+2.7,x-.2,ey+2.65),Q(x-2.8,ey+2.5,x-3,ey-.32),Z],'#fff8ee',ink,.57);
   oval(c,x+.45+turn,ey+.38,1.88,2.59,'#715169',ink,.45);
   oval(c,x+.54+turn,ey+.85,1.22,1.27,'#d5a668');oval(c,x+.40+turn,ey-.16,.81,1.52,ink);
   oval(c,x-.16+turn,ey-1.1,.74,.82,'#fff');oval(c,x+1.04+turn,ey+1.75,.39,.36,'#fff6c5');
   form(c,[M(x-3.2,ey-.05),Q(x-.5,ey-3.05,x+2.95,ey-1.15),L(x+3.7,ey-2.1)],null,ink,.93);
  }
  oval(c,x+side*.9,.75,2.15,1,'#f5aaac88');
 }
 form(c,[M(-1.45,3.15),Q(.4,4.25,2.7,2.7),Q(2.1,5.9,-.12,5.3),Z],'#c47785',ink,.45);
 form(c,[M(.08,.05),Q(-.9,1.85,.67,1.55)],null,'#d99893',.45);
 form(c,[M(-12.7,-7.2),Q(-13,-19.7,-2.5,-20),Q(9.7,-23.1,14,-9.8),L(11,-3.9),
 Q(11,-11.8,7.2,-13.4),Q(8.8,-8.5,5.8,-6.3),Q(6.1,-11.5,2.3,-13.7),Q(.1,-6.7,-4.1,-6),
 Q(-.9,-9.85,-1.4,-13.8),Q(-5.8,-10.5,-7.8,-3.1),Q(-7,-8.3,-8.9,-8.4),Q(-9.8,-1.9,-10.2,2.7),Q(-13.6,.5,-12.7,-7.2),Z],'#f3cd84',ink,.86);
 for(const [x,y,ex,ey] of [[-10,-10,-4,-17],[-8,-9,-1,-17],[1,-15,8,-15],[7,-14,10,-8]])
  form(c,[M(x,y),Q((x+ex)/2-1,ey-1,ex,ey)],null,'#fff0b9',.83);
 c.restore();
}
export function drawAgi(c,x,y,height,scene,light=1){
 const t=scene.t,g=scene.gesture,pose=scene.a.pose,walk=pose==='walk'||pose==='skip',swing=walk?Math.sin(scene.phase*2.25):Math.sin(scene.phase)*.27;
 const crouch=pose==='crouch'?g*11:0,wind=Math.sin(t*2.1+scene.plan.phase)*1.55,turn=scene.side??scene.plan.side;
 c.save();c.translate(x,y);c.scale(height/100,height/100);c.lineCap='round';
 const leg=(side,lead)=>{const hip=side*5,xx=hip+lead*5.8,knee=hip+lead*5.5,yy=-1.5-Math.max(0,lead)*3;
  limb(c,hip,-39+crouch*.34,knee,-18+crouch*.75,xx,yy,'#766779',5.2);
  limb(c,hip,-37+crouch*.34,knee,-23+crouch*.6,knee+.4,-18+crouch*.5,'#ffddca',5.1);shoe(c,xx,yy,lead*-.13);};
 leg(-1,-swing);leg(1,swing);
 c.save();c.translate(0,crouch*.56);c.rotate((pose==='lean'?-.105*g:pose==='turn'?scene.angle*.042:0));
 const hair='#e4b979',deep='#c29670',lightHair='#f6d489';
 form(c,[M(-12,-82),Q(-18,-78,-16+wind,-63),Q(-13+wind,-51,-23+wind,-44),Q(-17,-44,-12,-49),
 Q(-15,-39,-8,-38),Q(-3,-46,0,-44),Q(8,-37,22+wind,-45),Q(12,-46,15,-56),Q(19,-66,13,-83),Q(5,-94,-8,-88),Z],hair,ink,1.1);
 for(const side of [-1,1])form(c,[M(side*11,-79),B(side*22,-63,side*6+wind,-51,side*17+wind,-46)],null,deep,1);
 const coat=scene.a.place===3?'#8d81ad':scene.a.place===6?'#bcb0c4':'#ecd077',coDark=scene.a.place===3?'#706488':scene.a.place===6?'#908398':'#d8a751';
 form(c,[M(-8,-65),Q(0,-69,8,-64),L(9,-40),Q(0,-36,-9,-40),Z],'#b995c3',ink,.95);
 const flare=pose==='twirl'?g*5:0;
 form(c,[M(-8,-43),L(8,-44),Q(14+flare,-34,17+flare,-30),Q(4,-23,-14-flare,-28),Q(-12,-35,-8,-43),Z],'#a58caa',ink,1.05);
 for(let i=0;i<5;i++)line(c,[[-7+i*3.6,-40],[-11+i*5.1+(i-2)*flare*.16,-29]],'#7f698c',.65);
 for(const side of [-1,1]){
  form(c,[M(side*1.6,-66),Q(side*7,-69,side*13,-62),Q(side*14,-51,side*14,-41),L(side*10,-37),Q(side*5,-39,side*3,-42),L(side*4.5,-58),Z],coat,ink,.9);
  form(c,[M(side*3,-65),L(side*9,-61),L(side*5,-56),L(side*1.3,-62),Z],coDark,'#9c806d',.55);
 }
 line(c,[[-6,-65],[9,-39]],'#74566b',2.1);boxBag(c,8,-41);
 const peak=pose==='wave'||pose==='waveback'?Math.max(g,scene.falseWave*.70):pose==='twirl'||pose==='skip'?.75*g:pose==='react'?.55*g:.22;
 for(const side of [-1,1]){
  const waving=side===turn?peak:0,reach=pose==='twirl'?.47*g:0,foreX=side*(13+9*waving+6*reach),foreY=-45-28*waving-8*reach+side*swing*3;
  const elbowX=side*(15+7*waving+6*reach),elbowY=-50-7*waving;
  limb(c,side*9,-61,elbowX,elbowY,foreX,foreY,coat,8.5);
  line(c,[[foreX-2.7,foreY-.2],[foreX+2.7,foreY+.2]],coDark,1.6);
  hand(c,foreX,foreY+(waving>0.46?-1.2:2.65),.86,side*(waving>.46?.35:-.18),waving>.46);
 }
 c.save();const anticipation=Math.sin(scene.phase+.4)*.045;
 c.translate(0,-77);c.rotate(anticipation+(pose==='react'?-g*.09:0));
 face(c,scene,t);c.restore();
 form(c,[M(-12,-87),B(-19,-77,-9,-70,-17+wind,-59),Q(-20+wind,-57,-18+wind,-54),Q(-8,-61,-10,-70)],lightHair,ink,.7);
 form(c,[M(12,-86),B(18,-73,8+wind,-64,15+wind,-57)],null,'#fff0bf',1.15);
 if(light>.84&&scene.a.pose!=='react')oval(c,5,-80,.77,.78,'#fff7bf');
 c.restore();c.restore();
}
function boxBag(c,x,y){form(c,[M(x-4,y-1),Q(x,y-5,x+5,y-1),L(x+5,y+4),Q(x,y+7,x-5,y+4),Z],'#826c7f',ink,.8);line(c,[[x-3,y+1],[x+3,y+1]],'#d5b5ac',.65);}
export function drawCat(c,x,y,size,t,face=1){
 c.save();c.translate(x,y);c.scale(size/24*(face<0?-1:1),size/24);
 const fur='#fff0d8',stretch=Math.sin(t*2.7)*1.5;
 for(const [a,b,f] of [[-6,5,-1],[-3,6,-1],[3,5,1],[5,4,1]]){const xx=a+f*(3.1+stretch),yy=b+2.4+Math.sin(t*3+a)*.7;line(c,[[a,b-.9],[xx,yy]],ink,2.7);line(c,[[a,b-.9],[xx,yy]],fur,1.7);oval(c,xx+f*.3,yy,1.13,.8,fur,ink,.47);}
 form(c,[M(-7,3),B(-16,8,-17,-7,-11,-5+Math.sin(t*3)*2)],null,ink,3.6);
 form(c,[M(-7,3),B(-16,8,-17,-7,-11,-5+Math.sin(t*3)*2)],null,'#d49b7c',2.3);
 oval(c,-2,2,9,6,fur,ink,.85);oval(c,-5,1,3.8,3,'#dca584');
 polygon(c,[[2,-2],[2,-10],[7,-7],[13,-10],[13,-2]],fur,ink,.7);
 polygon(c,[[2.8,-8.6],[3.1,-5.6],[5.2,-6.4]],'#deaca7');polygon(c,[[12.3,-8.5],[12,-5.4],[10.3,-6.4]],'#deaca7');
 oval(c,7,-3,6.5,4.9,fur,ink,.65);oval(c,4.5,-4.3,2.0,1.2,'#dfac84');
 for(const d of [-1,1])for(let j=0;j<2;j++)line(c,[[7+d*3.6,-1+j*.8],[7+d*(6.8+j),-2.0+j*1.7]],'#846d71',.39);oval(c,4.5,-3,1,1.2,ink);oval(c,9.5,-3,1,1.2,ink);oval(c,7,-.6,.78,.46,'#c48a91');
 c.restore();
}
