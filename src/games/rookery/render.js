import { herSprite } from '../goinglive/pixel.js';
import { hardware,caseFinish,capFinish } from './hardware.js';
import { WORLDS } from './levels.js';
import { watched, actionName, ARROWS } from './rules.js';
import { box,label,oval,polygon,line,path,cat,paw,star,moon,ink } from './art.js';
const pads=['#f5c68e','#9cd7c6','#c1b3e3','#edb69b','#ada7d3'];
const grounds=['#a87582','#71949a','#897798','#a97877','#757398'];
const legends=['ESC','1','2','3','4','5','6','TAB','Q','W','E','R','T','Y','CAPS','A','S','D','F','G','H','SHIFT','Z','X','C','V','B','N','CTRL','ALT','FN'];
const coord=(b,p)=>String.fromCharCode(65+p%b.cols)+(1+Math.floor(p/b.cols));
export function geometry(b,w,h){
 const smallH=h<315,margin=Math.max(7,Math.min(w,h)*.04),side=w>=810&&w/h>1.48;
 const areaW=(side?w*.68:w)-margin*2,areaH=h-margin*2;
 const head=smallH?40:Math.min(101,Math.max(60,h*.165)),foot=smallH?19:Math.min(49,Math.max(25,h*.088));
 const pad=Math.max(8,Math.min(23,areaW*.034)),deckTop=side?margin:margin+head;
 const availH=side?areaH-foot:areaH-head-foot;
 const bodyH=Math.min(availH,areaW*(b.rows+.92)/(b.cols*1.24));
 const cw=Math.max(10,Math.min((areaW-pad*2)/b.cols,(bodyH-pad*2)/(b.rows+.48)*1.28));
 const ch=cw/1.28,bw=cw*b.cols+2*pad,bh=ch*b.rows+2*pad+ch*.48;
 const x=margin+(areaW-bw)/2,y=deckTop+Math.max(0,((side?areaH:availH)-bh)*.48);
 return {x,y,bw,bh,gridX:x+pad,gridY:y+pad+ch*.48,cw,ch,margin,side,head,foot,h,w};
}
const point=(g,b,k)=>[g.gridX+(k%b.cols+.5)*g.cw,g.gridY+(Math.floor(k/b.cols)+.54)*g.ch];
export function picked(b,g,x,y){
 const col=Math.floor((x-g.gridX)/g.cw),row=Math.floor((y-g.gridY)/g.ch);
 return col>=0&&col<b.cols&&row>=0&&row<b.rows?row*b.cols+col:-1;
}
function fabric(c,w,h,world){
 const gr=c.createLinearGradient(0,0,w,h);gr.addColorStop(0,grounds[world]);gr.addColorStop(.62,pads[world]);gr.addColorStop(1,grounds[world]);
 c.fillStyle=gr;c.fillRect(0,0,w,h);
 const gap=Math.max(14,Math.min(w,h)*.056);
 c.strokeStyle='#fff3d326';c.lineWidth=1;
 c.beginPath();for(let n=-h;n<w;n+=gap){c.moveTo(n,0);c.lineTo(n+h*.55,h);}
 for(let n=0;n<w+h;n+=gap){c.moveTo(n,0);c.lineTo(n-h*.55,h);}c.stroke();
 const light=c.createRadialGradient(w*.17,h*.04,0,w*.17,h*.04,Math.max(w,h)*.7);
 light.addColorStop(0,'#ffecd46a');light.addColorStop(1,'#ffe2ba00');c.fillStyle=light;c.fillRect(0,0,w,h);
}
function plate(c,g,b,t){
 const {x,y,bw,bh,cw,ch,gridX,gridY}=g,W=WORLDS[b.world],r=Math.min(ch*.32,20),depth=Math.max(3,ch*.078);
 box(c,x+2,y+depth+4,bw,bh,r,'#523a5355');
 box(c,x,y+depth,bw,bh,r,'#635369',ink,2);
 box(c,x,y,bw,bh,r,W.body,ink,2);
 box(c,x+3,y+3,bw-6,bh-6,Math.max(2,r-2),null,'#fff6e36e',1.5);
 const barY=y+(gridY-y)*.45,barH=Math.min(21,(gridY-y)*.54),left=gridX+3;
 if(b.world===0){
  box(c,left,barY-barH*.37,bw*.57,barH*.75,4,'#4b5774',ink);
  const hingeW=bw*.11;
  for(const at of [.06,.38])box(c,left+bw*at,barY-barH*.39,hingeW,barH*.78,2,'#a4aec7','#51475b');
 }else if(b.world===1){
  for(let i=0;i<7;i++)box(c,left+i*cw*.25,barY-barH*.34,cw*.18,barH*.67,3,i%2?'#a8f2cf':'#53766f','#507061');
 }else if(b.world===2){
  box(c,left,barY-barH*.52,bw*.45,barH*1.05,3,'#44364e',ink);
  label(c,'0 0 '+String(b.id).padStart(2,'0'),left+bw*.43,barY,Math.min(17,barH*.88),'#ffafa9','right','AK Mono',bw*.39);
 }else if(b.world===3){
  box(c,left,barY-barH*.4,bw*.57,barH*.8,4,'#584451',ink);
  for(const f of [.04,.48]){oval(c,left+bw*f,barY,barH*.53,barH*.53,'#443a4a');oval(c,left+bw*f,barY,barH*.26,barH*.26,'#c5a68c');}
  line(c,[[left+bw*.08,barY+2],[left+bw*.46,barY+2]],'#e4a299',2);
 }else{
  for(let i=0;i<3;i++)line(c,[[left,barY-4+i*4],[left+bw*.48,barY-4+i*4]],'#493c64',1);
  for(let i=0;i<5;i++){oval(c,left+cw*(.18+i*.45),barY+Math.sin(i*7)*4,3,2,'#3c3049');}
 }
 const p=g.gridX+b.cols*cw-9;
 for(let i=0;i<3;i++)oval(c,p-i*9,barY,2.5,2.5,i===0?'#fff2a5':'#5b5968',ink,.65);
}
function keycap(c,g,b,s,k,scene){
 const [cx,cy]=point(g,b,k),cw=g.cw,ch=g.ch,space=Math.max(1.6,Math.min(5,cw*.045)),z=b.tiles[k],world=WORLDS[b.world];
 const x=cx-cw*.5+space,dy=scene.age<.35&&[s.cat,s.agi].includes(k)?Math.sin(scene.age/.35*Math.PI)*ch*.04:0;
 const y=cy-.54*ch+space+dy,width=cw-2*space,height=ch-2*space,rad=b.world===3?Math.min(20,ch*.3):b.world===4?Math.max(2,ch*.048):Math.max(3,Math.min(9,ch*.17)),dep=Math.max(2.5,height*.13);
 const locked=b.word&&s.typed<b.word.length,home=k===b.home,isGaze=b.shy&&(b.look[s.agi][k]&(1<<s.face));
 if(z==='#'){
  box(c,x,y+3,width,height-3,rad,'#413647','#392737',1.3);
  box(c,x+2,y+2,width-4,height-7,rad,'#645365','#493b4d',1);
  for(let j=0;j<4;j++)line(c,[[x+width*(.23+j*.155),y+height*.42],[x+width*(.16+j*.155),y+height*.62]],'#94848c',1.5);
  return;
 }
 const keyFill=home?locked?'#dae0c1':'#ffd46f':z==='~'?'#a9e6d0':z==='*'?'#f4afb5':b.letters[k]?'#f8c2ad':z===':'?'#bcb4bd':world.key;
 box(c,x,y+1,width,height,rad,b.world===1?'#45675c':'#826e79',ink,1.4);
 box(c,x+.6,y,width-1.2,height-dep,rad,keyFill,'#6c5364',1.05);
 line(c,[[x+rad,y+2.4],[x+width-rad,y+2.4]],'#fffbe1c9',Math.min(2,height*.055));
 capFinish(c,x,y,width,height,dep,b.world);
 if(isGaze)box(c,x+2,y+2,width-4,height-dep-4,rad,'#997bdb3d');
 if(home){moon(c,cx,cy-4,Math.min(cw,ch)*.29,locked?'#788579':'#835038');star(c,cx+cw*.24,cy-ch*.21,ch*.076,'#fff0ba');}
 else if(z==='~'){for(let j=0;j<3;j++)line(c,[[x+width*(.2+j*.23),y+height*.61],[x+width*(.38+j*.23),y+height*.29]],'#458f83',Math.max(1.3,ch*.047));}
 else if(z==='*'){
  const ix=b.anchors.indexOf(k),active=s.lure===ix+1;
  oval(c,cx,cy-3,ch*.24,ch*.24,null,'#99485c',1.4);oval(c,cx,cy-3,ch*.12,ch*.12,active?'#f63859':'#f17a83');
  label(c,String(ix+1),x+width*.14,y+height*.28,Math.max(12,Math.min(19,ch*.26)),'#713a4b','left','AK Mono');
 }else if(z===':'){paw(c,cx,cy-3,ch*.27,'#766675');}
 else if(b.letters[k])label(c,b.letters[k],cx,cy-dep*.63,Math.max(15,ch*.53),'#714c4e','center','AK Display');
 else if(b.world===4){
  if(k%b.cols!==1&&k%b.cols!==4)box(c,x+width*.66,y+1,width*.19,height*.41,2,'#5a4d64');
 }else{
  const tags=b.world===2?String((9+k)%10):legends[(k%b.cols+Math.floor(k/b.cols)*7)%legends.length];
  const xpos=x+Math.max(3,width*.11),yp=y+Math.max(9,height*.235);
  label(c,tags,xpos,yp,Math.max(11,Math.min(17,ch*.23)),'#796875','left','AK Mono',width*.78,620);
 }
 if(scene.preview===k){c.save();c.setLineDash([4,3]);box(c,x+3,y+3,width-6,height-dep-6,rad,null,'#a45554',2);c.restore();paw(c,x+width*.8,y+height*.68,ch*.19,'#a45554');}
}
function ribbon(c,g,b,s,proof,moves){
 const W=WORLDS[b.world],side=g.side,xx=side?g.w*.71:g.margin,yy=side?g.h*.17:g.margin,rw=side?g.w*.255:g.w-g.margin*2;
 const small=g.h<315,hh=side?g.h*.61:g.head-4;
 box(c,xx+2,yy+3,rw,hh,Math.min(12,hh*.12),'#714f6345');
 box(c,xx,yy,rw,hh,Math.min(12,hh*.12),'#fff1d7',ink,1.7);
 if(side){
  // A stamped field note sits beside the real keyboard on a large desk.
  const r=Math.min(rw*.28,hh*.18),cx=xx+rw*.5,cy=yy+hh*.31;
  oval(c,cx,cy,r,r,'#eed2b8','#855f6e',1);cat(c,cx,cy+r*.16,r*1.48,{time:0,pose:'knead'});
  for(let i=0;i<3;i++)line(c,[[xx+rw*.1,yy+hh*(.56+i*.115)],[xx+rw*.9,yy+hh*(.56+i*.115)]],'#e1c7b3',1);
  label(c,W.name.toUpperCase(),cx,yy+hh*.09,Math.max(14,Math.min(22,rw*.077)),'#824c5a','center','AK Mono',rw*.9);
  label(c,b.name,cx,yy+hh*.52,Math.min(30,rw*.116),ink,'center','AK Display',rw*.89);
  label(c,'NAP '+String(b.id).padStart(2,'0')+'   /   PAR '+proof.par,cx,yy+hh*.67,Math.max(14,Math.min(20,rw*.074)),ink,'center','AK Mono',rw*.85);
  label(c,b.word?('TYPE   '+b.word.slice(0,s.typed)+'·'.repeat(b.word.length-s.typed)+'  /  '+b.word):W.look,cx,yy+hh*.81,Math.min(23,rw*.095),'#825467','center','AK Sans',rw*.88);
 }else{
  const ry=yy+hh*.55,mark=Math.min(hh*.35,29);
  oval(c,xx+mark+9,ry,mark,mark,'#f6d195','#ad806f',1);cat(c,xx+mark+9,ry+2,mark*1.58,{time:0});
  const start=xx+mark*2+17,right=xx+rw-9;
  label(c,W.name.toUpperCase()+'   /   '+String(b.id).padStart(2,'0'),start,yy+hh*.27,Math.max(11,Math.min(15,hh*.22)),'#834c5a','left','AK Mono',rw*.51);
  label(c,b.name,start,yy+hh*.69,Math.max(14,Math.min(26,hh*.4)),ink,'left','AK Display',rw-(start-xx)-(b.word?69:59));
  label(c,b.word?b.word:'PAR '+proof.par,right,ry,Math.max(12,Math.min(19,hh*.28)),'#815165','right','AK Mono',small?53:68);
  if(b.word)label(c,'●'.repeat(s.typed)+'○'.repeat(b.word.length-s.typed),right,yy+hh*.8,12,'#a15870','right','AK Mono',65);
 }
}
export function drawBoard(c,b,s,prev,proof,scene,w,h){
 const g=geometry(b,w,h),a=scene.reduced?1:Math.min(1,scene.age/(scene.event.slide?.43:.24)),ease=a*(2-a);
 fabric(c,w,h,b.world);ribbon(c,g,b,s,proof,scene.moves);
 hardware(c,g,b,s,scene);plate(c,g,b,scene.time);caseFinish(c,g,b);
 for(let k=0;k<b.count;k++)keycap(c,g,b,s,k,scene);
 const lerpPos=name=>{const one=point(g,b,prev[name]),two=point(g,b,s[name]);return one.map((v,i)=>v+(two[i]-v)*ease);};
 const [hx,hy]=lerpPos('agi'),[cx,cy]=lerpPos('cat'),u=Math.min(g.cw*.87,g.ch*1.07);
 if(s.lure){const [lx,ly]=point(g,b,b.anchors[s.lure-1]);c.save();c.setLineDash([2,5]);line(c,[[hx,hy-8],[lx,ly-4]],'#e65c7c9a',1.5);c.restore();
  const beat=scene.reduced?0:(1+Math.sin(scene.time*7))*.5;oval(c,lx,ly-3,3+5*beat,3+5*beat,null,'#fa4568ab',1.6);}
 if(scene.event.action===4&&scene.age<.5){for(let i=0;i<2;i++)oval(c,hx,hy,u*(.17+i*.1+scene.age*.6),u*(.1+i*.04+scene.age*.26),null,'#a2577db0',1.3);}
 if((scene.preview>=0||b.id===1&&scene.moves===0)&&!scene.sleep){
  const target=point(g,b,scene.preview>=0?scene.preview:b.home);star(c,target[0]+g.cw*.27,target[1]-g.ch*.17,Math.max(4,u*.1),'#ad7644');}
 const lift=scene.reduced?0:Math.sin(a*Math.PI)*u*.085;
 const pose=scene.sleep?'cheer':scene.event.action===4&&scene.age<.45?'wave':a<1&&prev.agi!==s.agi?'walk'+Math.floor(scene.time*14)%4:'stand';
 oval(c,hx,hy+u*.21,u*.22,u*.07,'#52435755');
 const sprite=herSprite(pose,0);c.save();c.imageSmoothingEnabled=false;c.translate(hx,hy-lift);c.scale(scene.herFace,1);c.drawImage(sprite.canvas,-u*.31,-u*.48,u*.62,u*.77);c.restore();
 if(b.shy){const d=s.face,ax=[0,1,0,-1][d],ay=[-1,0,1,0][d];label(c,ARROWS[d],hx+ax*u*.3,hy+ay*u*.3,Math.max(13,u*.25),'#5b4289','center','AK Sans');}
 const catZoom=scene.sleep&&scene.age>.5?1.03:1;
 cat(c,cx,cy-u*.03,u*catZoom,{time:scene.reduced?0:scene.time,face:scene.catFace,pose:scene.sleep?(scene.age<.55?'knead':'bagel'):scene.event.slide&&a<1?'glide':'sit',moving:a<1?a:0,attentive:b.shy&&watched(b,s)||scene.preview>=0});
 if(scene.sleep&&!scene.reduced){const lamp=c.createRadialGradient(cx,cy,u*.45,cx,cy,Math.max(w,h)*.78);lamp.addColorStop(0,'#53325200');lamp.addColorStop(1,'rgba(62,45,81,'+Math.min(.2,scene.age*.18)+')');c.fillStyle=lamp;c.fillRect(0,0,w,h);}
 if(scene.sleep){label(c,'z Z',cx+u*.26,cy-u*.36,Math.max(12,u*.19),'#765787','center','AK Serif');}
 const footY=g.side?g.h-g.margin*.84:Math.min(g.h-8,Math.max(g.y+g.bh+11,g.h-g.foot*.44));
 const lineText=b.word?'Type '+b.word+'   ·   '+(s.typed===b.word.length?'moon unlocked':s.typed+'/'+b.word.length+' letters'):b.shy?watched(b,s)?'Eye contact · she holds still':'Eyes away · she can creep':b.anchors.length?'Tap a numbered dot · wait for a pawstep':b.world===1?'Mint caps slide · dry caps catch her':'Nudge from behind · call from a clear row';
 label(c,lineText,g.side?g.w*.35:g.w*.5,footY,Math.min(18,Math.max(12,g.h*.029)),ink,'center','AK Sans',(g.side?g.w*.66:g.w)-18,800);
}
export function drawJournal(c,w,h,book,pose,index,scene){
 fabric(c,w,h,3);
 const pad=Math.max(12,Math.min(w,h)*.055),ww=Math.min(w-pad*2,h*1.56),x=(w-ww)/2,y=pad,hh=h-2*pad;
 box(c,x+3,y+5,ww,hh,17,'#77566c');box(c,x,y,ww,hh,17,'#fff0d8',ink,2);
 for(let i=0;i<7;i++)line(c,[[x+ww*.08,y+hh*(.25+i*.096)],[x+ww*.92,y+hh*(.25+i*.096)]],'#e2cbbc',1.2);
 label(c,'CAT JOURNAL',x+ww*.5,y+hh*.13,Math.max(18,Math.min(35,ww*.086)),ink,'center','AK Display',ww*.92);
 const r=Math.min(ww*.26,hh*.24),cx=w*.5,cy=y+hh*.46;
 oval(c,cx,cy,r,r,'#edcfa8','#c49c93',1);cat(c,cx,cy+r*.25,r*1.66,{time:scene.reduced?0:scene.time,pose:pose.pose});
 if(scene.pet>0)for(let i=0;i<3;i++)star(c,cx+r*(.46+i*.27),cy-r*(.41+i*.12+(.8-scene.pet)*.3),5+i,'#b56c7d');
 label(c,pose.name,cx,y+hh*.77,Math.max(18,Math.min(30,ww*.08)),ink,'center','AK Display',ww*.88);
 label(c,Object.keys(book.runs).length+' / 45 naps   ·   pose '+(index+1)+' / 6',cx,y+hh*.9,Math.max(12,Math.min(18,ww*.04)),'#85586a','center','AK Mono',ww*.9);
}
