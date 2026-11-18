const TAU = Math.PI*2;
export const ink='#24142d';
export function box(c,x,y,w,h,r,fill,stroke=null,lw=2) {
  if(w<=0||h<=0)return;
  c.beginPath();c.roundRect(x,y,w,h,Math.min(Math.abs(r),w/2,h/2));c.fillStyle=fill;c.fill();
  if(stroke){c.lineWidth=lw;c.strokeStyle=stroke;c.stroke();}
}
export function oval(c,x,y,rx,ry,color,rot=0) {
  if(rx<=0||ry<=0)return;c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,rot,0,TAU);c.fill();
}
export function line(c,pts,color,width=1) {
  c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';
  c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
export function txt(c,text,x,y,size,color,align='left',face='AK Sans',weight=700,maxWidth) {
  c.font=weight+' '+Math.max(12,size)+'px "'+face+'", sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;
  if(maxWidth)c.fillText(text,x,y,maxWidth);else c.fillText(text,x,y);
}
export function polygon(c,points,fill,stroke=null) {
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=1.6;c.stroke();}
}
export function agiDJ(c,x,y,size,t,mood='ready',reduce=false) {
  c.save();c.translate(x,y+(reduce?0:Math.sin(t*2)*size*.017));c.scale(size/72,size/72);
  if(!reduce)c.rotate(.032*Math.sin(t*1.6));
  const gold='#f6c16e',shade='#d89455',skin='#ffdec1';
  oval(c,0,-7,26,30,ink);oval(c,0,-8,24,29,gold);
  for(const side of [-1,1]){
    polygon(c,[[side*14,-25],[side*29,-20],[side*27,4],[side*34,23],[side*20,19],[side*15,28]],gold,ink);
    line(c,[[side*23,-15],[side*21,3],[side*26,17]],shade,1.3);
  }
  polygon(c,[[-18,13],[18,13],[27,36],[-28,36]],'#b78bdf',ink);
  oval(c,0,-8,18,21,skin);
  polygon(c,[[-19,-11],[-15,-27],[0,-32],[16,-24],[18,-13],[7,-19],[0,-13],[-1,-21],[-9,-14],[-9,-20]],gold);
  const blink=!reduce&&Math.cos(t*1.32)>.996;
  for(const side of [-1,1]){const xx=side*8;
    if(blink||mood==='land')line(c,[[xx-3,-5],[xx,-7],[xx+3,-5]],ink,1.7);
    else{oval(c,xx,-6,3,4,'#7e523b');oval(c,xx+.7,-7,1,1,'#fff5de');}
    oval(c,side*12,0,3,1.3,'#f2abb0');
  }
  line(c,[[-3,4],[0,mood==='miss'?3:5.8],[4,3.5]],'#ae656a',1.2);
  c.strokeStyle=ink;c.lineWidth=5;c.beginPath();c.arc(0,-7,23,Math.PI,TAU);c.stroke();
  for(const side of [-1,1]){oval(c,side*23,-6,5,10,ink);oval(c,side*23,-6,3,7,'#b19fe5');}
  const lift=mood==='land'?9:0;
  line(c,[[-15,19],[-25,25-lift],[-32,19-lift]],skin,6);line(c,[[15,19],[24,24],[32,21]],skin,6);
  txt(c,'agi',0,22,12,'#fff2e3','center','AK Display',800);
  c.restore();
}
const covers = new Map();
export function sleeve(id) {
  if(typeof Image==='undefined')return null;
  if(!covers.has(id)){const img=new Image();img.decoding='async';img.src='/games/heartbeat/covers/'+id+'.webp';covers.set(id,img);}
  return covers.get(id);
}
export function record(c,x,y,r,song,t,live,reduce) {
  oval(c,x+2,y+3,r,r,'#44293c');oval(c,x,y,r,r,ink);
  for(let k=0;k<10;k++){
    c.beginPath();c.arc(x,y,r*(.38+k*.061),0,TAU);c.strokeStyle=k%2?'#4a354c':'#594653';c.lineWidth=k%3?1:1.6;c.stroke();
  }
  c.save();c.translate(x,y);c.rotate(reduce?0:t*(live?1.45:.57));
  for(let i=0;i<3;i++){c.beginPath();c.arc(0,0,r*.78,i*TAU/3+.25,i*TAU/3+.68);c.strokeStyle='#baa3bc6f';c.lineWidth=Math.max(1.4,r*.045);c.stroke();}
  oval(c,0,0,r*.37,r*.37,song.color);
  const im=sleeve(song.id);
  if(im?.naturalWidth){c.save();c.beginPath();c.arc(0,0,r*.33,0,TAU);c.clip();c.drawImage(im,-r*.34,-r*.34,r*.68,r*.68);c.restore();}
  oval(c,0,0,Math.max(2,r*.038),Math.max(2,r*.038),'#fff2d7');
  c.restore();
}
