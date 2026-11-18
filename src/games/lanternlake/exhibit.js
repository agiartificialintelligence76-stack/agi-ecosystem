import { polygon, panel, type, line, oval } from '../kit/illustration.js';

// A thin archive mount rotates about its vertical spindle. Perspective narrows the far edge.
export function mountCorners(angle){
 const cos=Math.cos(angle),sin=Math.sin(angle);
 return [[-181,-45],[181,-45],[181,45],[-181,45]].map(([x,y])=>{
   const depth=615/(615+x*sin);return [240+x*cos*depth,300+y*depth];
 });
}
const wrapping=(c,text,x,y,width)=>{
  c.font='17px Georgia';c.fillStyle='#263536';c.textBaseline='top';c.textAlign='left';
  let row='';for(const word of text.split(' ')){const s=row?row+' '+word:word;if(row&&c.measureText(s).width>width){c.fillText(row,x,y);y+=20;row=word;}else row=s;}
  c.fillText(row,x,y);
};
export function drawExhibit(c,entry,idx,angle){
 const label=entry.exhibits[idx][0],note=entry.exhibits[idx][1];const p=mountCorners(angle);
 const front=Math.cos(angle)>=0,order=front?p:[p[1],p[0],p[3],p[2]],a=order[0],b=order[1],d=order[3];
 polygon(c,p,'#f5dfac','#9d7657',2);
 if(Math.abs(Math.cos(angle))<.1)return;
 c.save();c.transform((b[0]-a[0])/362,(b[1]-a[1])/362,(d[0]-a[0])/90,(d[1]-a[1])/90,...a);
 if(front){
   panel(c,12,11,64,67,'#466462',2);oval(c,44,45,23,23,'#efc67d');
   const symbol=/tape|snare|music|score|meter|reader/i.test(label)?'♫':/photo|frame|glass|screen/i.test(label)?'▣':'✉';
   type(c,symbol,44,44,28,'#445957');type(c,'ARCHIVE OBJECT  '+String(idx+1).padStart(2,'0'),88,20,11,'#8c4d3b','left','monospace');
   type(c,label,88,43,22,'#253738','left','Georgia');type(c,'Tap the object to turn it over',88,67,13,'#6f5c4d','left');
 }else{
   type(c,label.toUpperCase()+'    /    EXAMINED',12,13,10,'#9a4738','left','monospace');
   wrapping(c,note,13,26,334);line(c,[[12,81],[352,81]],'#beaa82');
 }
 c.restore();
}
