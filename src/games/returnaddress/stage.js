import { ellipsePoint, stageLayout } from './stage-layout.js';
import { star, roundRect } from '../kit/fx.js';
import { painting, oval, line, polygon } from '../kit/illustration.js';
import { grooves } from './record.js';

const ink = '#251033', paper = '#fff5d6', mint = '#70ecc6', rose = '#ff73ae', gold = '#ffd354';
const skater = painting(new URL('./skater.webp',import.meta.url));
const TAU = 2*Math.PI;
const font = (size,display) => (display ? '900 ' : '730 ') + size + "px 'AK " + (display ? 'Display' : 'Sans') + "', system-ui";
function text(ctx,str,x,y,size,color=ink,align='left',display=false,max) {
  ctx.font=font(size,display); ctx.fillStyle=color; ctx.textAlign=align; ctx.textBaseline='middle';
  if (max) ctx.fillText(str,x,y,max); else ctx.fillText(str,x,y);
}
function panel(ctx,x,y,w,h,color,r=8) {
  roundRect(ctx,x,y,w,h,r); ctx.fillStyle=color; ctx.fill(); ctx.strokeStyle=ink; ctx.lineWidth=3; ctx.stroke();
}
function sticker(ctx,x,y,r,color) {
  star(ctx,x,y,r,r*.46,5); ctx.fillStyle=color; ctx.fill(); ctx.lineWidth=Math.max(1.3,r*.14); ctx.strokeStyle=ink; ctx.stroke();
}
function time(t) { return Math.floor(t/60) + ':' + String(Math.floor(t%60)).padStart(2,'0'); }
export function drawStage(ctx,w,h,s,run) {
  const l=stageLayout(w,h), {cx,cy,rx,ry,header,wide}=l;
  const p=(lane,a) => ellipsePoint(l,lane,a);
  ctx.fillStyle='#e995b1'; ctx.fillRect(0,0,w,h);
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,w,h); ctx.clip();
  const step=Math.max(34,Math.min(w,h)*.095);
  for(let x=-h;x<w;x+=step){polygon(ctx,[[x,0],[x+step*.45,0],[x+h+step*.45,h],[x+h,h]],'#f4adc2');}
  ctx.restore();
  const margin=l.margin, deckY=header+margin, deckW=wide ? w*.7-margin*2 : w-margin*2;
  panel(ctx,margin+3,deckY+5,deckW,h-deckY-margin-7,ink,16);
  panel(ctx,margin,deckY,deckW,h-deckY-margin-7,'#e0c2ff',16);
  for(const x of [margin+10,margin+deckW-10]) for(const y of [deckY+10,h-margin-18]){
    oval(ctx,x,y,3.2,3.2,'#896fb1',ink,1);line(ctx,[[x-2,y+1],[x+2,y-1]],paper,1);
  }
  // Thick platter, stamped timing notches, three colored raised grooves and a rotating paper label.
  oval(ctx,cx,cy+6,rx,ry,'#734771',ink,4); oval(ctx,cx,cy,rx,ry,'#2d203c',ink,4);
  for(let i=0;i<17;i++) oval(ctx,cx,cy,rx*(.31+i*.04),ry*(.31+i*.04),null,i%3===0?'#675071':'#45334f',1);
  for(let i=0;i<42;i++){
    const a=i/42*TAU + (run.reduced ? 0 : s.time*.26);
    line(ctx,[[cx+Math.cos(a)*rx*.965,cy+Math.sin(a)*ry*.965],[cx+Math.cos(a)*rx*.984,cy+Math.sin(a)*ry*.984]], i%3 ? '#876d94' : paper,2);
  }
  for(let lane=0;lane<3;lane++){
    const f=.46+lane*.21;
    oval(ctx,cx,cy,rx*f,ry*f,null,[mint,gold,rose][lane],lane===s.lane?3.5:1.7);
  }
  oval(ctx,cx,cy,rx*.32,ry*.32,'#fe90ab',ink,3);
  ctx.save();ctx.translate(cx,cy);ctx.scale(1,ry/rx);ctx.rotate(run.reduced ? -.2 : s.time*.28);
  for(let i=0;i<6;i++) {ctx.rotate(TAU/6);sticker(ctx,0,-rx*.24,rx*.035,gold);}
  text(ctx,'AGI-1',0,-rx*.07,rx*.126,ink,'center',true);text(ctx,'RECORD CLUB',0,rx*.105,rx*.059,ink,'center',true);
  ctx.restore(); oval(ctx,cx,cy,4,4,paper,ink,1.5);
  // Future objects move counter-clockwise into the fixed skating line. Distance indicates time to arrival.
  const gate=1.98, look=3.65, speed=1.27;
  line(ctx,[p(-.3,gate),p(2.38,gate)],paper,4);
  for(let i=s.index;i<s.events.length && s.events[i].time-s.time<=look;i++){
    const e=s.events[i],a=gate-(e.time-s.time)*speed;
    if(e.scratch){
      const points=Array.from({length:9},(_,k)=>p(-.25+k*.33,a+(k%2?.028:-.028)));
      line(ctx,points,ink,8);line(ctx,points,'#ff6b68',4);
    }else{
      const [x,y]=p(e.lane,a);sticker(ctx,x,y,Math.max(8,rx*.047),[mint,gold,rose][e.lane]);
    }
  }
  const [sx,sy]=p(s.position,gate), air=(s.time-s.lift)/.59;
  const hop=air>0&&air<1?Math.sin(Math.PI*air)*Math.min(ry*.38,47):0;
  oval(ctx,sx,sy+2,rx*.078,ry*.025,'#160e27');
  const body=Math.min(Math.max(42,rx*.35),125);
  ctx.save();ctx.translate(sx,sy-hop);ctx.rotate((s.lane-s.position)*.17);
  const frame=run.reduced ? 1 : hop>0 ? 2 : Math.floor(s.time*5.5)%4;
  if(!skater(ctx,frame*112,0,112,136,-body*.4,-body*.97,body*.8,body)) {oval(ctx,0,-body*.38,body*.22,body*.3,rose,ink,3);}
  ctx.restore();
  // An articulated tonearm and cartridge sit on the far side of the deck.
  const ax=margin+deckW*.91,ay=deckY+(h-deckY)*.16;
  oval(ctx,ax,ay,rx*.067,rx*.064,'#8772ab',ink,3);
  const arm=[[ax,ay],[ax+rx*.02,ay+ry*.55],[ax-rx*.12,ay+ry*.68]];
  line(ctx,arm,ink,9);line(ctx,arm,'#f4dfa3',4);
  const [nx,ny]=arm[2];panel(ctx,nx-rx*.04,ny-2,Math.max(11,rx*.068),Math.max(9,rx*.04),rose,3);
  // Track information and the cue monitor have separate layouts in portrait and landscape.
  panel(ctx,margin,margin,w-margin*2,header-margin,ink,9);
  const title=s.record.title, next=s.events[s.index], cue=next?.scratch?'JUMP':next ? grooves[next.lane].toUpperCase() : 'RIDE OUT';
  text(ctx,title,margin+12,margin+(header-margin)*.38,Math.min(29,(header-margin)*.42),paper,'left',true,w*.61);
  text(ctx,run.cut.toUpperCase()+' CUT   /   '+time(s.time)+'  –  '+time(s.record.duration),margin+13,margin+(header-margin)*.78,Math.max(10,Math.min(14,header*.21)),mint);
  text(ctx,String(s.ledger.chain)+'×',w-margin-12,margin+(header-margin)*.5,Math.min(34,header*.53),gold,'right',true);
  if(wide){
    const x=w*.7+margin/2,pw=w-x-margin,top=deckY;
    panel(ctx,x,top,pw,h-top-margin-7,'#fff2d9',13);
    const pad=Math.min(20,pw*.09), fh=Math.min(28,pw*.14);
    text(ctx,'NEXT MARK',x+pad,top+24,12,ink);
    text(ctx,cue,x+pad,top+52,fh,ink,'left',true,pw-2*pad);
    const barY=top+79;
    text(ctx,'NEEDLE',x+pad,barY,12,ink);
    for(let k=0;k<10;k++){const seg=(pw-2*pad)/10;ctx.fillStyle=k<10-s.ledger.damage?mint:'#8a7588';ctx.fillRect(x+pad+k*seg,barY+11,seg-2,9);}
    if(h-top>205){
      text(ctx,'BACKSPINS',x+pad,barY+55,12,ink);
      for(let k=0;k<2;k++) oval(ctx,x+pad+12+k*30,barY+83,11,11,k<s.spin?rose:'#c6b9c9',ink,2);
      if(h-top>345){
        const stripY=barY+122, stripW=pw-2*pad, stripH=Math.min(95,(h-top)*.14);
        text(ctx,'ON THE RECORD',x+pad,stripY,12,ink);
        panel(ctx,x+pad,stripY+17,stripW,stripH,ink,7);
        const bandCount=Math.min(54,Math.floor(stripW/4)),beat=s.events[s.index]?.beat || 0;
        for(let i=0;i<bandCount;i++){
          const energy=Number(s.record.energy[(beat+i*2)%s.record.energy.length])||0;
          const bar=Math.max(3,(.11+energy*.086)*stripH);
          ctx.fillStyle=i<3 ? gold : i<15 ? mint : '#7f709d';
          ctx.fillRect(x+pad+4+i*(stripW-8)/bandCount,stripY+17+(stripH-bar)/2,Math.max(1,(stripW-8)/bandCount-2),bar);
        }
        if(h-top>470) {
          const row=stripY+stripH+49;
          text(ctx,'COMING AROUND',x+pad,row,12,ink);
          for(const [i,e] of s.events.slice(s.index,s.index+4).entries()){
            const slot=stripW/4,px=x+pad+slot*(i+.5),py=row+31;
            if(e.scratch)line(ctx,[[px-7,py+5],[px-2,py-5],[px+1,py+4],[px+7,py-5]],'#b42c54',3);
            else sticker(ctx,px,py,10,[mint,gold,rose][e.lane]);
            text(ctx,e.scratch?'Jump':grooves[e.lane],px,py+23,12,ink,'center',false,slot-4);
          }
        }
      }
      text(ctx,'SIDE '+run.side+' / '+run.total,x+pad,h-margin-38,Math.min(17,pw*.09),ink,'left',true);
    }
  }else{
    const y=deckY+18;
    text(ctx,'NEXT  '+cue,margin+16,y,Math.min(17,deckW*.046),ink,'left',true);
    text(ctx,'↶ '+s.spin+'     '+(10-Math.min(10,s.ledger.damage))+'/10',margin+deckW-15,y,14,ink,'right');
  }
  if(s.last && s.time-s.last.time<.48){
    const label={star:'★',clear:'CLEAN JUMP',scratch:'SCRAPE',miss:'MISSED',backspin:'BACKSPIN'}[s.last.kind];
    text(ctx,label,sx,Math.max(deckY+38,sy-body-hop-7),Math.max(15,Math.min(26,rx*.09)),paper,'center',true);
  }
}
