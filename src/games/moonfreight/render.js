import {sprite} from '../kit/field-art.js';
import {pockets,guide,wellAt,W,H,R} from './physics.js';
const agi=sprite(new URL('./agi.webp',import.meta.url));
const brass='#f2cd84',chalk='#f8f0d8',dark='#202039';
export const pocketNames=['NW diamond','North star','NE crescent','SW shell','South crown','SE ring'];
const sigils=['◆','✶','☽','◒','♛','◎'],colors=['#f8c365','#ef8f74','#88e0ce','#a0bdff','#de9af0','#dfb97f'];
function stroke(c,p,color,width=2){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineJoin=c.lineCap='round';c.stroke();}
function box(c,x,y,w,h,r,fill,border,width=2){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(border){c.strokeStyle=border;c.lineWidth=width;c.stroke();}}
function oval(c,x,y,rx,ry,fill,edge,width=2){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(edge){c.strokeStyle=edge;c.lineWidth=width;c.stroke();}}
function text(c,str,x,y,px,fill=chalk,align='left',weight=800,max=1e4){c.font=weight+' '+px+'px "AK Sans",system-ui';c.textAlign=align;c.textBaseline='middle';c.fillStyle=fill;c.fillText(str,x,y,max);}
export function layout(w,h){
 const phone=w<530,vertical=h>w*1.86,side=!vertical&&w>990?Math.min(218,w*.15):0,top=phone&&!vertical?78:vertical?64:49,bottom=phone&&!vertical?95:vertical?60:57;
 const aw=w-side-12,ah=h-top-bottom,sw=vertical?450:852,sh=vertical?852:450;
 const scale=Math.max(.16,Math.min(aw/sw,ah/sh)),cx=side+(w-side)/2,cy=top+ah/2;
 function world(x,y){return vertical?[cx+(y-H/2)*scale,cy-(x-W/2)*scale]:[cx+(x-W/2)*scale,cy+(y-H/2)*scale];}
 function felt(x,y){return vertical?[W/2-(y-cy)/scale,H/2+(x-cx)/scale]:[W/2+(x-cx)/scale,H/2+(y-cy)/scale];}
 return {vertical,phone,side,scale,cx,cy,world,felt};
}
function decor(c,w,h,t){
 const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#342438');bg.addColorStop(.55,'#1a1732');bg.addColorStop(1,'#403143');c.fillStyle=bg;c.fillRect(0,0,w,h);
 c.save();c.globalAlpha=.30;for(let x=-h;x<w+h;x+=29){stroke(c,[[x,0],[x+h,h]],'#a27773',1);stroke(c,[[x,0],[x-h,h]],'#9d7469',.6);}c.restore();
 for(const x of [w*.05,w*.96]){stroke(c,[[x,0],[x,Math.min(50,h*.08)]],brass,1.4);const y=Math.min(50,h*.08);oval(c,x,y,16,7,'#eec989','#906548');oval(c,x,y+3,10,2,'#fff2ca');}
}
function board(c,v,scale=1){const radius=Math.max(R,5.9/scale);
 const pal=[['#215c59','#123f48'],['#3f6462','#1b444e'],['#29645b','#134946'],['#503e65','#322e54'],['#344b77','#223657'],['#514767','#382b53']][v.chapter%6];
 box(c,-23,-21,846,448,27,'#0d101d',null);box(c,-23,-25,846,448,28,'#493347','#150e24',4);box(c,-18,-21,836,440,24,'#9b7462',brass,2);
 box(c,-14,-17,828,432,20,'#634752','#302234',3);box(c,-6,-8,812,416,15,pal[1],dark,2);
 const felt=c.createLinearGradient(0,0,W,H);felt.addColorStop(0,pal[0]);felt.addColorStop(1,pal[1]);box(c,8,8,784,384,14,felt,null);
 c.save();c.beginPath();c.roundRect(9,9,782,382,14);c.clip();for(let py=18;py<H;py+=14)for(let px=18+(py%3)*4;px<W;px+=17){c.fillStyle='#e4eac913';c.fillRect(px,py,2,1);}
 c.globalAlpha=.12;for(let r=22;r<110;r+=21)oval(c,400,200,r*1.6,r,null,brass,1.4);
 stroke(c,[[277,201],[400,133],[523,201],[400,269],[277,201]],brass,2);text(c,'☽',400,200,51,brass,'center');c.restore();
 for(const [a,b] of [[28,376],[424,772]])for(const y of [5,395]){stroke(c,[[a+3,y],[b-3,y]],'#0e303c',9);stroke(c,[[a+6,y-1],[b-6,y-1]],'#659887',3);}
 for(const x of [5,795]){stroke(c,[[x,35],[x,365]],'#0d3440',8);stroke(c,[[x+1,39],[x+1,360]],'#658b83',2);}
 for(const xx of [-13,813])for(let yy=49;yy<390;yy+=60){stroke(c,[[xx-2,yy-3],[xx+2,yy],[xx-2,yy+3]],'#e9be81',1.7);}
 for(const y0 of [-18,416]){stroke(c,[[20,y0],[134,y0],[155,y0+2],[348,y0+2]],'#dfae7980',1.8);stroke(c,[[449,y0],[589,y0],[625,y0+2],[774,y0+2]],'#dfae7980',1.8);}
 for(let i=1;i<=7;i++)if(i!==4)for(const y of [-10,410]){const x=i*100;stroke(c,[[x-3,y],[x,y-3],[x+3,y],[x,y+3],[x-3,y]],brass,1.6);}
 for(const [i,[x,y]] of pockets.entries()){const hot=i===v.called;oval(c,x,y,23,21,hot?'#f4c97a':'#946e5e','#442f3d',2);oval(c,x,y+1,18,17,'#111725','#a27f62',1.2);if(hot){c.setLineDash([4,5]);oval(c,x,y,28,27,null,'#ffeab3',1.6);c.setLineDash([]);}text(c,sigils[i],x,y+1,13,hot?'#ffdb88':'#95806f','center');}
 for(const [i,well] of v.wells.entries()){const p=wellAt(well,v.log?.time||0);c.save();c.translate(p.x,p.y);c.rotate(i?-.36:.35);
 for(let j=1;j<=3;j++)oval(c,0,0,13+j*9,8+j*5,null,'#dec1fa55',1.3);
 const orb=c.createRadialGradient(-4,-5,1,0,0,15);orb.addColorStop(0,'#fff0d0');orb.addColorStop(.28,'#c7a6dd');orb.addColorStop(1,'#5f497d');oval(c,0,0,13,13,orb,'#64526d',1.4);c.beginPath();c.ellipse(0,0,24,7,0,0,Math.PI);c.strokeStyle=brass;c.lineWidth=2.7;c.stroke();c.restore();}
 if(v.leave){const [x,y]=v.leave;c.setLineDash([5,6]);oval(c,x,y,29,29,null,'#b8ffe0',2);c.setLineDash([]);text(c,'LEAVE',x,y+39,12,'#b8ffe0','center');}
 if(v.historyTrail){for(let i=1;i<v.historyTrail.length;i++){const p=v.historyTrail[i-1],n=v.historyTrail[i];stroke(c,[p,n],'#fbd9a45c',1.9);}}
 if(v.phase==='aim'&&!v.hand){const cue=v.balls[0],a=v.angle,dx=Math.cos(a),dy=Math.sin(a),g=guide(v.balls,a),back=6+v.power*12;
  c.setLineDash([4,6]);stroke(c,[[cue.x,cue.y],[g.x,g.y]],'#f8f0d2b0',2);c.setLineDash([]);if(g.id!==null){oval(c,g.x,g.y,R,R,null,'#f7ebc5aa',1.4);const hit=v.balls.find(b=>b.id===g.id);const theta=Math.atan2(hit.y-g.y,hit.x-g.x);stroke(c,[[hit.x,hit.y],[hit.x+30*Math.cos(theta),hit.y+30*Math.sin(theta)]],'#fff0bba0',2);}
  stroke(c,[[cue.x-dx*(R+back),cue.y-dy*(R+back)],[cue.x-dx*103, cue.y-dy*103]],'#271c2b',9);stroke(c,[[cue.x-dx*(R+back),cue.y-dy*(R+back)],[cue.x-dx*106, cue.y-dy*106]],v.seat?'#c98bd2':'#e8c08b',5);stroke(c,[[cue.x-dx*80,cue.y-dy*80],[cue.x-dx*109,cue.y-dy*109]],v.seat?'#7751a9':'#775046',7);}
 for(const b of v.balls)if(!b.potted){
  oval(c,b.x+3,b.y+4,radius+1,radius,'#15253299');const col=b.id===0?'#fff7dc':b.suit==='moon'?'#807ba5':b.suit==='stripe'?'#8fd5dd':colors[(b.id*2+v.chapter)%colors.length];
  const grad=c.createRadialGradient(b.x-4,b.y-5,1,b.x,b.y,radius+2);grad.addColorStop(0,'#fffce2');grad.addColorStop(.32,col);grad.addColorStop(1,b.suit==='cue'?'#afb6bb':'#403a56');oval(c,b.x,b.y,radius,radius,grad,'#101b2b',1.3);
  if(b.suit==='stripe'){c.save();c.beginPath();c.arc(b.x,b.y,radius-.8,0,7);c.clip();stroke(c,[[b.x-12,b.y+4],[b.x+12,b.y-4]],'#277595',5);c.restore();}
  if(b.id)text(c,b.suit==='moon'?'☽':String(b.id),b.x,b.y+.7,9,'#202740','center',950);oval(c,b.x-3.2,b.y-4.3,2.5,1.5,'#ffffffda');
  if(v.primary===b.id){c.setLineDash([3,4]);oval(c,b.x,b.y,15,15,null,'#ffe9ab',1.6);c.setLineDash([]);}
 }
 if(v.hand){const cue=v.balls[0];oval(c,cue.x,cue.y,20,20,null,'#f9dc8a',2);text(c,'IN HAND',cue.x,cue.y-30,12,chalk,'center');}
 for(const fx of v.sparks){const age=Math.min(1,fx.t/.55);c.save();c.globalAlpha=1-age;oval(c,fx.x,fx.y,9+age*24,8+age*20,null,fx.col,2);c.restore();}
}
function host(c,x,y,w,h,v){c.save();c.translate(x+w*.51,y+h*.74);const lean=v.reduced?0:v.phase==='rolling'?Math.sin(v.time*4)*.035:v.phase==='card'?-.055:Math.sin(v.time*1.55)*.011;c.rotate(lean);agi(c,-w*.51,-h*.74,w,h);c.restore();}
export function paint(c,w,h,v){const g=layout(w,h);c.save();decor(c,w,h,v.time);
 if(g.side){const sw=g.side-14;box(c,8,62,sw,h-136,14,'#251e33d9','#aa8267',1.5);
 text(c,'HOUSE SALON',g.side/2,87,15,brass,'center');const aw=sw*.96,ah=aw*.76;
 host(c,9,h*.37+(v.reduced?0:Math.sin(v.time*2)*1.5),aw,ah,v);
 if(v.patches?.length){const yy=h*.37+ah+53;for(const [j,n] of v.patches.entries()){const xx=20+(j%3)*34;oval(c,xx,yy+19*Math.floor(j/3),8,8,colors[n],brass,1);text(c,String(n+1),xx,yy+19*Math.floor(j/3),10,dark,'center');}}text(c,v.seat?'AGI-1 AT THE TABLE':'AGI-1  /  CHALK HOST',g.side/2,h*.37+ah+23,13,chalk,'center',850,sw-9);
 text(c,v.hand?'BALL IN HAND':v.phase==='rolling'?'COMETS IN MOTION':'CUE TO THE FELT',g.side/2,h-109,12,brass,'center',850,sw-9);}
 text(c,v.head,g.side+14,20,w<500?19:25,chalk,'left',950,w-g.side-(g.vertical?63:22));text(c,v.sub,g.side+15,42,12,brass,'left',780,w-g.side-21);
 if(!g.side)host(c,w-(g.phone?76:108),0,g.phone?72:101,g.phone?64:78,v);
 c.save();c.translate(g.cx,g.cy);if(g.vertical)c.rotate(-Math.PI/2);c.scale(g.scale,g.scale);c.translate(-W/2,-H/2);board(c,v,g.scale);c.restore();
 if(g.phone&&!g.vertical){const rowY=Math.min(h-87,g.cy+226*g.scale+12);box(c,10,rowY,w-20,32,8,'#31283ce8','#9c8064',1);const type=v.hand?'BALL IN HAND':v.phase==='rolling'?'ROLLING':v.phase==='card'?'SIGNED':'CUE READY';text(c,type,19,rowY+16,12,brass);text(c,'#'+(v.primary??'—')+'   ·   '+pocketNames[v.called],w-19,rowY+16,12,chalk,'right');}
 const y=h-57;box(c,g.side+9,y,w-g.side-18,24,9,'#291f34e5','#90744f',1);
 text(c,v.notice,g.side+18,y+12,Math.max(12,Math.min(16,w*.027)),chalk,'left',800,w-g.side-36);c.restore();}
