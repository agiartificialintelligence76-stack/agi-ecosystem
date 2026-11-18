// A fixed paper score with a conductor's cursor. The notes never fall toward the
// player. The sung bar and its answering bar keep identical horizontal spacing.
const colors=['#fa7399','#ffd46b','#83e4d0'];
export const glyphs=['●','◆','▲'];
export function label(c,txt,x,y,size,color,align='left',face='AK Sans',weight=700,maxWidth) {
  c.font=weight+' '+size+'px "'+face+'", sans-serif';
  c.textAlign=align; c.textBaseline='middle'; c.fillStyle=color;
  c.fillText(txt,x,y,maxWidth);
}
export function box(c,x,y,w,h,r,fill,stroke,lineWidth=2) {
  c.beginPath();c.roundRect(x,y,w,h,r);
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.strokeStyle=stroke;c.lineWidth=lineWidth;c.stroke();}
}
function rule(c,x,y,x2,color,width=1) {
  c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y);c.stroke();
}
function mark(c,x,y,lane,r,fill,ink) {
  c.beginPath();
  if(lane===0)c.arc(x,y,r,0,Math.PI*2);
  else {
    const pts=lane===1?[[0,-r],[r,0],[0,r],[-r,0]]:[[0,-r],[r,r],[-r,r]];
    pts.forEach(([dx,dy],i)=>i?c.lineTo(x+dx,y+dy):c.moveTo(x+dx,y+dy));c.closePath();
  }
  c.fillStyle=fill;c.fill();c.strokeStyle=ink;c.lineWidth=1.8;c.stroke();
}
export function scoreSheet(c,rect,view,compact) {
  const {chart,phrase,time,run,feedback}=view;
  const {x,y,w,h}=rect;
  const ink='#261631', paper='#fdf4df';
  const gutter=Math.min(25, Math.max(9,w*.055));
  box(c,x+3,y+4,w-3,h-5,12,'#100b21');
  box(c,x,y,w-3,h-5,12,paper,ink,3);
  const left=x+gutter,right=x+w-gutter-4;
  const height=h-5,ty=y+Math.max(18,height*.085);
  const reply=time>=phrase.reply;
  const side=reply?'YOUR MIC':'AGI-1 SINGS';
  const sz=Math.max(13,Math.min(22,w*.055));
  label(c,side,left,ty,sz,ink,'left','AK Display',850,(right-left)*.65);
  label(c,(phrase.index+1)+' / '+chart.phrases.length,right,ty,Math.max(12,sz*.65),'#5d4f63','right','AK Mono');
  const progress=(time-(reply?phrase.reply:phrase.start))/((reply?phrase.end:phrase.reply)-(reply?phrase.reply:phrase.start));
  const showReference=height>210 && w>260;
  const staffTop=y+height*(showReference?.44:compact?.35:.36),staffBottom=y+height*.64;
  const pitchY=lane=>staffBottom-(staffBottom-staffTop)*lane/2;
  const span=right-left-12,beatX=offset=>left+6+span*offset/4;
  if(showReference){
    const sy=y+height*.205, sw=right-left;
    box(c,left-3,sy-10,sw+6,Math.max(25,height*.125),5,'#e9dcc7');
    label(c,'HER CALL',left+3,sy+1,12,'#71596b','left','AK Mono');
    const sx=left+Math.min(81,sw*.29);
    for(let i=0;i<phrase.calls.length;i++){
      const call=phrase.calls[i];
      const px=sx+(right-sx-6)*phrase.notes[i].offset/4;
      const by=sy+5-call.lane*3;
      const active=time>=call.at && time<=call.at+call.duration;
      mark(c,px,by,call.lane,active?5.5:4,colors[call.lane],ink);
    }
  }
  for(let beat=0;beat<=4;beat++) {
    const xx=beatX(beat);c.fillStyle=beat%2?'#af9a8a40':'#8c768756';c.fillRect(xx,staffTop-7,1,staffBottom-staffTop+14);
    if(beat<4)label(c,String(beat+1),xx,staffTop-17,12,'#65526a','center','AK Mono');
  }
  for(let lane=0;lane<3;lane++)rule(c,left,pitchY(lane),right,'#b8a2a4',1);
  phrase.notes.forEach((note,i)=>{
    const lane=reply?note.lane:note.lead;
    const xx=beatX(note.offset),yy=pitchY(lane);
    const done=run.state[note.index]?.kind;
    const failed=reply&&['miss','wrong','short'].includes(done);
    if(note.until>note.at) {
      const ratio=(note.until-note.at)/(phrase.end-phrase.reply);
      rule(c,xx,yy,xx+ratio*span,ink,6);rule(c,xx,yy,xx+ratio*span,failed?'#ba9c9c':colors[lane],3);
    }
    mark(c,xx,yy,lane,Math.max(5,Math.min(11,w*.024)),failed?'#d4bbb2':colors[lane],ink);
    if(reply&&done&&done!=='holding'){
      const delta=run.state[note.index].delta;
      if(delta!=null&&Math.abs(delta)>.025){
        const hitX=xx+delta/(phrase.end-phrase.reply)*span;
        rule(c,Math.min(xx,hitX),yy+13,Math.max(xx,hitX),'#866681',1.5);
        ovalTrace(c,hitX,yy+13);
      }
      label(c,failed?'×':'✓',xx,yy-14,13,failed?'#9e475a':'#337a67','center');
    }
  });
  const cueX=left+6+span*Math.max(0,Math.min(1,progress));
  c.strokeStyle=reply?'#9b2775':'#4c5495';c.lineWidth=2.5;
  c.beginPath();c.moveTo(cueX,staffTop-8);c.lineTo(cueX,staffBottom+10);c.stroke();
  mark(c,cueX,staffBottom+12,1,3,ink,ink);
  const badgeY=y+height*.77, footerY=y+height*.92;
  const text=feedback?.ttl>0?feedback.text:reply?'Answer on the traveling beat':'Listen to the spaces between notes';
  label(c,text,left,badgeY,Math.max(12,Math.min(19,w*.049)),ink,'left','AK Sans',750,right-left);
  const part=chart.part==='lead'?'Echo part':chart.part==='upper'?'Upper harmony':'Lower harmony';
  if(height>220){
    const meterY=y+height*.855;
    rule(c,left,meterY,right,'#e1ccbb',4);
    const progress=Math.max(0,Math.min(1,run.judged/chart.notes.length));
    rule(c,left,meterY,left+(right-left)*progress,'#a24e7c',4);
  }
  label(c,part+'  ·  '+phrase.label,left,footerY,12,'#695064','left','AK Mono',650,(right-left)*.7);
  label(c,run.combo+'×',right,footerY,Math.max(13,sz*.8),'#88266c','right','AK Display',850);
}
function ovalTrace(c,x,y){
  c.beginPath();c.arc(x,y,2.1,0,Math.PI*2);c.fillStyle='#70455f';c.fill();
}
