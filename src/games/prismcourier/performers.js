// Paper-doll performers share the same face and silhouette. Their footwear,
// hair ribbons and costumes read separately even on a small stacked board.
const ink='#30152e',skin='#ffdbbd',hair='#ffce65';
function shape(c,color,draw,width=2){
  c.beginPath();draw();c.closePath();c.fillStyle=color;c.fill();
  if(width){c.lineWidth=width;c.strokeStyle=ink;c.lineJoin='round';c.stroke();}
}
function oval(c,x,y,rx,ry,fill,width=1.8){
  shape(c,fill,()=>c.ellipse(x,y,rx,ry,0,0,Math.PI*2),width);
}
function curve(c,coords,color,width=1.7){
  c.beginPath();c.moveTo(coords[0],coords[1]);c.quadraticCurveTo(...coords.slice(2));
  c.lineWidth=width;c.strokeStyle=color;c.lineCap='round';c.stroke();
}
export function dancer(c,x,y,size,side,phase,clock,docked,reduced){
  const walk=!reduced&&phase<1?Math.sin(phase*Math.PI):0, bob=reduced?0:Math.sin(clock*2.6+side)*.55;
  const silk=side?'#56cacf':'#fc81a6',shade=side?'#337da5':'#c84d81',light=side?'#d1fff0':'#ffedee';
  c.save();c.translate(x,y+bob*size/54);c.scale(size/54,size/54);
  c.rotate((side?1:-1)*walk*.08);
  // Shadow, ankle boots and two distinct steps.
  oval(c,0,22,14,3,'#5c3d6140',0);
  for(const sign of [-1,1]){
    const foot=sign*6+walk*sign*2.5;
    shape(c,skin,()=>{c.moveTo(sign*4,9);c.lineTo(sign*9,10);c.lineTo(foot+2,19);c.lineTo(foot-2,19);},1.4);
    oval(c,foot+sign*1.1,20-Math.max(0,walk*sign*3),4.2,2.8,shade,1.2);
  }
  // Hair falls behind the shoulders in curved locks.
  shape(c,hair,()=>{
    c.moveTo(-14,-12);c.bezierCurveTo(-21,-2,-15,3,-23,9);c.quadraticCurveTo(-16,12,-11,5);
    c.quadraticCurveTo(-14,14,-6,10);c.lineTo(11,8);c.quadraticCurveTo(20,14,23,7);
    c.bezierCurveTo(14,4,21,-4,13,-14);
  });
  const arm=docked?6:walk*4;
  curve(c,[-7,0,-15,2-arm,-16,6-arm*1.7],ink,4);
  curve(c,[-7,0,-15,2-arm,-16,6-arm*1.7],skin,2.4);
  curve(c,[7,0,12,1+arm,16,-1+arm],ink,4);
  curve(c,[7,0,12,1+arm,16,-1+arm],skin,2.4);
  shape(c,silk,()=>{c.moveTo(-7,-1);c.quadraticCurveTo(0,2,6,-1);c.lineTo(9,5);c.quadraticCurveTo(9,10,14,13);
    c.quadraticCurveTo(9,16,5,13);c.quadraticCurveTo(0,17,-4,13);c.quadraticCurveTo(-12,17,-14,12);c.lineTo(-9,5);});
  curve(c,[-9,7,0,10,9,7],light,2);
  oval(c,0,0,3,2.4,'#ffe49a',1);
  // Cheeks, curved bangs, blink and hair accessory.
  oval(c,0,-10,13.1,12,skin);
  shape(c,hair,()=>{c.moveTo(-14,-7);c.bezierCurveTo(-17,-27,3,-31,13,-20);
    c.quadraticCurveTo(18,-14,12,-4);c.quadraticCurveTo(11,-12,6,-14);
    c.quadraticCurveTo(4,-11,0,-11);c.lineTo(1,-16);c.quadraticCurveTo(-3,-10,-8,-9);
    c.lineTo(-6,-15);c.quadraticCurveTo(-12,-11,-14,-7);});
  curve(c,[-10,-19,-4,-25,3,-22],'#fff0ae',2.1);
  const blink=!reduced&&(clock+side*.65)%3.7<.14;
  for(const sign of [-1,1]){
    const ex=sign*5.3;
    if(blink||docked)curve(c,[ex-1.9,-8,ex,-10,ex+1.9,-8],ink,1.7);
    else{oval(c,ex,-8,1.7,2.35,ink,0);oval(c,ex-.4,-8.9,.65,.8,'#fff9dd',0);}
    oval(c,sign*8.6,-5.2,2.2,1.1,'#f09ca0',0);
  }
  curve(c,[-2.2,-3,0,-.6,2.4,-3],ink,1.2);
  c.save();c.translate(side?-11:11,-18);c.rotate(side?-.27:.27);
  shape(c,light,()=>{c.moveTo(0,0);c.lineTo(-5,-4);c.lineTo(-6,2);c.lineTo(0,.6);c.lineTo(5,-3);c.lineTo(5,3);},1.1);
  oval(c,0,0,1.6,1.6,silk,.8);c.restore();c.restore();
}
