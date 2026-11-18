import { agiDJ, box, ink, line, oval, txt } from './art.js';
import { MOODS, CURVES } from './shifts.js';

let portrait;
function boothPortrait(c,x,y,w,h,s,reduce) {
  const glow=c.createLinearGradient(x,y,x+w,y+h);
  glow.addColorStop(0,'#3f3c7a');glow.addColorStop(.6,'#6d527d');glow.addColorStop(1,'#d78d8b');
  box(c,x,y,w,h,7,glow,ink);
  c.save();c.beginPath();c.roundRect(x,y,w,h,6);c.clip();
  const scale=Math.min(w/170,h/90);
  for(let i=0;i<16;i++){
    const towerH=h*(.16+.22*(.5+.5*Math.sin(i*6.39))),xx=x+i*w/15;
    box(c,xx,y+h-towerH,w*.074,towerH,0,i%3===0?'#483855':'#443a61');
    for(let j=0;j<3;j++)box(c,xx+3,y+h-towerH+3+j*6,2,2,0,'#efba90');
  }
  line(c,[[x,y+h*.52],[x+w,y+h*.52]],'#d5c0cb70',1);
  if(!portrait&&typeof Image!=='undefined'){portrait=new Image();portrait.decoding='async';portrait.src='/pfp/v1/character-34.png';}
  const bob=reduce?0:Math.sin(s.time*2.3)*2*scale;
  if(portrait?.naturalWidth){
    const size=Math.min(w*.78,h*1.45);
    c.save();c.translate(x+w*.48,y+h*.83+bob);if(!reduce)c.rotate(.035*Math.sin(s.time*1.8));c.drawImage(portrait,-size*.5,-size*.77,size,size);c.restore();
  }else agiDJ(c,x+w*.5,y+h*.58,Math.min(w*.66,h),s.time,'ready',reduce);
  const micX=x+w*.82;line(c,[[x+w+2,y+h*.84],[micX+w*.035,y+h*.52],[micX-w*.11,y+h*.61]],ink,3*scale);
  oval(c,micX-w*.13,y+h*.62,Math.max(2,w*.043),Math.max(2,h*.049),'#241b34',-.6);
  box(c,x+w*.08,y+h*.80,w*.31,Math.max(12,h*.115),2,'#3c263a');
  txt(c,'● ON AIR',x+w*.235,y+h*.863,Math.max(12,Math.min(17,h*.10)),'#ffaf93','center','AK Mono',800,w*.28);
  c.restore();
}
export function operatorPanel(c,s,a,reduce) {
 const pad=Math.max(5,Math.min(11,a.h*.07)),x=a.x+pad,y=a.y+pad,w=a.w-pad*2,h=a.h-pad*2;
 const tall=h>170&&w/h<1.68;
 box(c,x+2,y+3,w-2,h-2,8,ink);box(c,x,y,w-2,h-4,8,'#ffefd5',ink,2);
 if(tall){
  const bh=Math.min(h*.51,w*.77);boothPortrait(c,x+6,y+6,w-14,bh,s,reduce);
  const top=y+bh+13,available=h-bh-22;
  txt(c,'✉ '+s.request.speaker,x+13,top+available*.14,Math.min(18,w*.054),'#985066','left','AK Mono',800,w-28);
  txt(c,MOODS[s.request.heat],x+13,top+available*.39,Math.min(43,Math.max(20,w*.115)),ink,'left','AK Display',900,w-28);
  const rr=Math.max(3,Math.min(7,w*.02));for(let i=0;i<5;i++)oval(c,x+14+rr+i*(rr*2.7),top+available*.60,rr,rr,i<s.request.heat?'#c7556b':'#dfc5b5');
  txt(c,s.request.askCurve?CURVES[s.request.curve]:s.request.heat+'/5',x+19+rr*14,top+available*.60,15,'#734957','left','AK Mono',700,w*.47);
  txt(c,s.request.hint||s.request.caption,x+14,top+available*.83,Math.min(19,w*.055),'#644352','left','AK Serif',700,w-30);
 }else{
  const pw=Math.min(w*.30,h*1.13);
  boothPortrait(c,x+4,y+4,pw,h-11,s,reduce);
  const left=x+pw+12,usable=w-pw-23;
  txt(c,'✉ '+s.request.speaker,left,y+h*.20,Math.min(15,h*.16),'#85465e','left','AK Mono',800,usable);
  txt(c,MOODS[s.request.heat]+' '+s.request.heat+'/5',left,y+h*.51,Math.min(31,Math.max(15,h*.28)),ink,'left','AK Display',850,usable);
  txt(c,(s.request.askCurve?CURVES[s.request.curve]+' · ':'')+(s.request.hint||s.request.caption),left,y+h*.81,Math.min(16,h*.18),'#634154','left','AK Serif',680,usable);
 }
}
export function signal(c,song,at,x,y,w,h,accent,reduce=false){
 if(h<8||w<16)return;
 box(c,x,y,w,h,4,'#332d43',ink,1);
 const bars=Math.max(13,Math.floor(w/5)),gap=w/bars;
 for(let i=1;i<bars-1;i++){
  const j=Math.max(0,Math.min(song.energy.length-1,Math.floor(at)+i-Math.floor(bars*.30)));
  const coarse=Number(song.energy[j])/9;
  // Harmonic ridges are local visual texture. Their envelopes are the measured chart energies.
  const ridge=(.45+.55*Math.abs(Math.sin(j*14.871)))*coarse;
  const length=Math.max(2,(h-4)*ridge);
  line(c,[[x+i*gap,y+(h-length)*.5],[x+i*gap,y+(h+length)*.5]],i>bars*.30?accent:'#82738e',Math.max(1,gap*.54));
 }
 const marker=x+w*.30;line(c,[[marker,y],[marker,y+h]],'#fff0b8',reduce?1:1.6);
}
