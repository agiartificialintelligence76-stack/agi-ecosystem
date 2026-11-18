import { box, label } from './notation.js';

const ink='#21152e';
function oval(c,x,y,rx,ry,color,edge,width=2) {
  c.beginPath(); c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);
  if(color){c.fillStyle=color;c.fill();}
  if(edge){c.strokeStyle=edge;c.lineWidth=width;c.stroke();}
}
function shape(c,color,draw,edge=ink,width=2.5) {
  c.beginPath();draw(c);c.closePath();c.fillStyle=color;c.fill();
  if(edge){c.lineJoin='round';c.strokeStyle=edge;c.lineWidth=width;c.stroke();}
}
function stroke(c,color,width,draw) {
  c.beginPath();draw(c);c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function star(c,x,y,r,color) {
  shape(c,color,p=>{
    for (let i=0;i<8;i++) {
      const angle=i*Math.PI/4, size=i%2?r*.26:r;
      const xx=x+Math.cos(angle)*size, yy=y+Math.sin(angle)*size;
      if(i)p.lineTo(xx,yy);else p.moveTo(xx,yy);
    }
  },null);
}
function mic(c,x,y,scale,angle,bright) {
  c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(angle);
  box(c,-3,2,7,30,3,'#9784af',ink,2);
  box(c,-8,-13,17,25,7,bright?'#ffe4ae':'#c6b2c6',ink,2.3);
  for(let j=0;j<4;j++)stroke(c,'#725d79',1.3,p=>{p.moveTo(-6,-8+j*4);p.lineTo(6,-8+j*4);});
  c.restore();
}
function performer(c,x,y,scale,{beat,call,expression,lane,moving,syllable}) {
  const bob=moving?Math.sin(beat*Math.PI*2)*1.8:0;
  c.save();c.translate(x,y+bob*scale);c.scale(scale,scale);c.rotate(call?.02:-.025);
  // The amber eyes, long wavy gold hair and lavender jacket carry her silhouette
  // through every stage costume. The mic hand, gaze and mouth follow the phrase.
  shape(c,'#df945a',p=>{p.moveTo(-34,-70);p.bezierCurveTo(-62,-64,-54,-10,-76,13);
    p.quadraticCurveTo(-64,19,-53,9);p.quadraticCurveTo(-51,26,-69,40);
    p.bezierCurveTo(-48,39,-27,39,-8,28);p.bezierCurveTo(14,42,55,45,66,28);
    p.quadraticCurveTo(47,32,51,16);p.quadraticCurveTo(69,22,74,8);
    p.bezierCurveTo(50,5,64,-67,31,-79);});
  shape(c,'#a87acc',p=>{p.moveTo(-25,13);p.quadraticCurveTo(1,3,26,14);p.lineTo(50,35);
    p.lineTo(32,51);p.lineTo(35,80);p.lineTo(-40,80);p.lineTo(-33,49);p.lineTo(-55,43);p.quadraticCurveTo(-49,23,-25,13);});
  shape(c,'#f7d8bf',p=>{p.moveTo(-12,5);p.lineTo(-12,21);p.quadraticCurveTo(0,34,14,19);p.lineTo(11,1);});
  shape(c,'#d2b0f1',p=>{p.moveTo(-30,18);p.lineTo(-13,15);p.lineTo(0,28);p.lineTo(-13,40);p.lineTo(-26,31);});
  shape(c,'#ebccfa',p=>{p.moveTo(12,15);p.lineTo(28,19);p.lineTo(23,34);p.lineTo(9,41);p.lineTo(0,28);});
  stroke(c,'#fbe8cf',3,p=>{p.moveTo(-19,47);p.quadraticCurveTo(-6,43,4,50);});star(c,18,47,6,'#ffe190');
  const handY=call?-7:17,raised=expression==='celebrate'||!call;
  for(const [color,width] of [[ink,14],['#f8cfb2',9]]) {
    stroke(c,color,width,p=>{p.moveTo(-45,36);p.quadraticCurveTo(-66,27,-62,handY);});
    stroke(c,color,width,p=>{p.moveTo(39,35);p.quadraticCurveTo(58,36,67,raised?9:27);});
  }
  mic(c,-66,handY-9,1,-.3,call);oval(c,-63,handY+9,5.5,6,'#f8cfb2',ink,1.5);
  if(raised)stroke(c,'#f8cfb2',3.7,p=>{p.moveTo(67,10);p.lineTo(70,1);});
  c.save();c.translate(call?-2:2,-1);c.rotate(call?-.035:.035);
  oval(c,0,-37,38,46,'#ffdbbd',ink,2.7);
  oval(c,-28,-25,7,3.6,'#efaa9d');oval(c,27,-25,7,3.6,'#efaa9d');
  for(const side of [-1,1]) {
    const ex=side*16,ey=-39+(call&&lane===2?-2:0);
    if(expression==='celebrate'||expression==='blink') {
      stroke(c,ink,2.8,p=>{p.moveTo(ex-7,ey+2);p.quadraticCurveTo(ex,ey-6,ex+6,ey+1);});
    }else{
      oval(c,ex,ey,7,7.6,'#fff2d5',ink,1.6);oval(c,ex+(call?-1:2),ey+.6,4.4,6,'#a26936',ink,1);
      oval(c,ex+(call?-1:2),ey-1,2.7,4.1,'#382234');oval(c,ex-.6,ey-3.3,1.7,1.7,'#fff9dd');
      stroke(c,ink,2,p=>{p.moveTo(ex-7,ey-3);p.quadraticCurveTo(ex,ey-10,ex+8,ey-4);});
    }
    stroke(c,'#ad794e',1.8,p=>{p.moveTo(ex-6,-51);p.quadraticCurveTo(ex,-54,ex+5,-51);});
  }
  if(call&&syllable)oval(c,-1,-18,lane===0?4:6,3.5+lane*1.6,'#ab5c62',ink,1.3);
  else stroke(c,'#ad5d63',2,p=>{p.moveTo(-6,-18);p.quadraticCurveTo(0,-12,7,-19);});
  shape(c,'#f8cd78',p=>{p.moveTo(-39,-36);p.bezierCurveTo(-60,-83,-10,-115,23,-88);
    p.bezierCurveTo(46,-86,51,-56,42,-37);p.quadraticCurveTo(33,-52,30,-62);
    p.quadraticCurveTo(27,-50,22,-46);p.quadraticCurveTo(19,-70,2,-74);
    p.quadraticCurveTo(-5,-61,-21,-52);p.lineTo(-13,-65);p.quadraticCurveTo(-35,-61,-39,-36);});
  stroke(c,'#ffebae',4,p=>{p.moveTo(-37,-65);p.quadraticCurveTo(-18,-95,8,-86);});
  stroke(c,'#e5a759',2.5,p=>{p.moveTo(10,-87);p.quadraticCurveTo(30,-87,37,-63);});
  for(const side of [-1,1])shape(c,'#f4bd6b',p=>{p.moveTo(side*35,-51);p.quadraticCurveTo(side*54,-35,side*42,-7);
    p.quadraticCurveTo(side*32,4,side*44,14);p.quadraticCurveTo(side*22,8,side*31,-14);p.quadraticCurveTo(side*42,-36,side*35,-51);});
  star(c,37,-61,7,'#f9edbb');c.restore();c.restore();
}
function band(c,r,time,phrase,reduced) {
  const x=r.x+r.w*.73, y=r.y+r.h*.71, s=Math.min(r.w/445,r.h/290);
  const beat=(time-phrase.start)*4/(phrase.reply-phrase.start);
  const pulse=reduced?0:Math.max(0,1-(beat%1+1)%1);
  c.save();c.translate(x,y);c.scale(s,s);
  // The little house drummer marks the same downbeat the score uses.
  oval(c,0,-35,8,9,'#c28caa',ink,1.5);
  shape(c,'#67435f',p=>{p.moveTo(-8,-29);p.lineTo(6,-29);p.lineTo(14,-8);p.lineTo(-13,-8);},ink,1.5);
  for(const sign of [-1,1]){
    stroke(c,'#dfbcaa',2,p=>{p.moveTo(3*sign,-19);p.lineTo(sign*22,-23-pulse*7);});
    stroke(c,'#917480',1.5,p=>{p.moveTo(sign*30,-17);p.lineTo(sign*30,11);});
    oval(c,sign*30,-17,13,2.7,'#c8a380',ink,1.2);
    box(c,sign*14-6,-11,12,13,2,'#77526f',ink,1.3);
  }
  oval(c,-2,0,14,14,'#84576e',ink,1.8);oval(c,-2,0,10,10,'#cf9fa1',ink,1);
  star(c,-2,0,4,'#80556f');c.restore();
  for(const side of [-1,1]){
    const cx=r.x+r.w*(side<0?.07:.93),cy=r.y+r.h*.75,sz=s*18;
    box(c,cx-sz*.6,cy-sz*1.65,sz*1.2,sz*1.9,2,'#393046',ink,1.6);
    oval(c,cx,cy-sz*.97,sz*.32,sz*.32,'#766078',ink,1);
    oval(c,cx,cy-sz*.28,sz*(.33+pulse*.04),sz*(.33+pulse*.04),'#766078',ink,1);
  }
}
function backdrop(c,r,chart,time,phrase,reply,reduced) {
  const {x,y,w,h}=r, bg=c.createLinearGradient(0,y,0,y+h);
  bg.addColorStop(0,'#24142d');bg.addColorStop(.66,'#542a52');bg.addColorStop(1,'#261733');
  c.fillStyle=bg;c.fillRect(x,y,w,h);
  const sway=reduced?0:Math.sin(time*.49)*.045;
  for(const side of [-1,1]){
    const rig=x+w*(side<0?.13:.9),target=x+w*((reply?.73:.42)+sway*side);
    shape(c,side<0?'#ff9a9e30':'#aea3ff33',p=>{p.moveTo(rig-6,y);p.lineTo(rig+6,y);p.lineTo(target+w*.19,y+h*.88);p.lineTo(target-w*.19,y+h*.88);},null);
    for(let i=0;i<5;i++){
      const wid=w*(.19-i*.029),edge=side<0?x:x+w,dir=side<0?1:-1;
      shape(c,i%2?'#92395c':'#612744',p=>{p.moveTo(edge,y);p.lineTo(edge+dir*wid,y);
        p.quadraticCurveTo(edge+dir*wid*.96,y+h*.18,edge+dir*wid*.40,y+h*.49);
        p.quadraticCurveTo(edge+dir*wid*.23,y+h*.6,edge+dir*wid*.37,y+h*.75);p.lineTo(edge,y+h*.85);},null);
    }
  }
  for(let i=0;i<8;i++)oval(c,x+w*(.14+i*.1),y+h*.105,2.3,2.3,i%2?'#fff2af':'#e898b5');
  for(let k=0;k<20;k++){
    const px=x+w*(.12+(k*37%78)/100),py=y+h*(.16+(k*19%54)/100);
    if(k%5===0)star(c,px,py,2.4,chart.ink+'99');else oval(c,px,py,1,1,'#eedba988');
  }
  const floor=c.createLinearGradient(0,y+h*.76,0,y+h);floor.addColorStop(0,'#9d6477');floor.addColorStop(1,'#34283e');
  shape(c,floor,p=>{p.moveTo(x,y+h*.79);p.quadraticCurveTo(x+w*.45,y+h*.69,x+w,y+h*.8);p.lineTo(x+w,y+h);p.lineTo(x,y+h);},ink,2);
  for(let i=-2;i<9;i++)stroke(c,'#b7898b55',1,p=>{p.moveTo(x+w*(i*.12+.13),y+h*.8);p.lineTo(x+w*(i*.18-.02),y+h);});
  oval(c,x+w*(reply?.76:.43),y+h*.80,w*.17,h*.037,'#ffe39838');
  band(c,r,time,phrase,reduced);
}
export function stage(c,r,v) {
  const {chart,time,phrase,reduced}=v,reply=time>=phrase.reply;
  const beat=(time-phrase.start)/(phrase.reply-phrase.start)*4,last=phrase.calls.findLast(e=>e.at<=time+.01);
  const syllable=!reply&&last&&time-last.at<last.duration+.10;
  const scale=Math.min(r.w/300,r.h/235,2.5),ground=r.y+r.h*.73;
  c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();
  backdrop(c,r,chart,time,phrase,reply,reduced);
  performer(c,r.x+r.w*.43,ground-scale*47,scale,{beat,call:!reply,lane:last?.lane||0,syllable,
    expression:v.cheer>0?'celebrate':Math.floor(time*3)%19===0&&!syllable?'blink':'watch',moving:!reduced});
  const px=r.x+r.w*.76,py=ground-scale*56;
  stroke(c,ink,5*scale,p=>{p.moveTo(px,ground+scale*16);p.lineTo(px,py+scale*9);});mic(c,px,py,scale,-.16,reply);
  if(reply)star(c,px+18*scale,py-15*scale,4*scale+(reduced?0:Math.sin(beat*4)*scale),'#ffdf80');
  for(let i=0;i<20;i++){
    const x=r.x+(i+.5)*r.w/20,span=r.w/20;
    const y=r.y+r.h*(.94+i%3*.015)-(reduced?0:Math.sin(beat*Math.PI+i*.4)*(v.cheer>0?5:1.4));
    oval(c,x,y,span*.31,span*.33,'#21152f');oval(c,x,y+span*.65,span*.6,span*.8,'#21152f');
    if(v.cheer>0&&i%3===0)stroke(c,'#21152f',Math.max(3,span*.16),p=>{p.moveTo(x,y+span*.42);p.lineTo(x-span*.63,y-span*.25);});
  }
  const x=r.x+Math.max(9,r.w*.035);
  label(c,chart.venue.toUpperCase(),x,r.y+Math.max(13,r.h*.06),Math.max(12,Math.min(18,r.w*.035)),'#ffdfa5','left','AK Mono',750,r.w*.76);
  label(c,chart.title,x,r.y+r.h*.868,Math.min(r.w*.065,Math.max(16,r.h*.105),37),'#fff3df','left','AK Display',850,r.w*.76);
  c.restore();
}
