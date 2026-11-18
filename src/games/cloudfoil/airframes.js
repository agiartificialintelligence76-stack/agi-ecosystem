import {polygon as poly,oval,line} from '../kit/illustration.js';

const ink='#293446',cream='#ffebbe',gold='#e6a34d';
export function airframe(c,x,y,unit,p,d,accent,dip,t){
 c.save();c.translate(x,y);c.scale(unit,unit);
 c.rotate(-d.slope*.82);
 const span=d.half*100, variant=p.body;
 // Aircraft are built from two distinct wings, an enclosed fuselage, rear
 // stabilizer and a propeller. Deck ends match the physical collision width.
 const tail=-(span+30),nose=span+24;
 poly(c,[[tail+9,28],[tail-13,7],[tail-7,3],[tail+16,11],[tail+29,25]],accent,ink,2.5);
 poly(c,[[tail-15,24],[tail+21,21],[tail+32,26],[tail+9,31],[tail-18,29]],cream,ink,2);
 const body=new Path2D();
 body.moveTo(tail,24);body.bezierCurveTo(-25,28,-16,16,18,17);
 body.bezierCurveTo(nose+1,9,nose+9,24,nose-1,33);
 body.bezierCurveTo(19,53,-16,39,tail,29);body.closePath();
 c.fillStyle=accent;c.fill(body);c.lineWidth=2.5;c.strokeStyle=ink;c.stroke(body);
 line(c,[[tail+7,26],[-12,33],[20,32],[nose-3,23]],cream,2);
 oval(c,3,18,12,4,ink);
 // Tiny seated pilot, windscreen and goggles.
 oval(c,0,13,5,6,gold,ink,1.4);line(c,[[-4,12],[4,11]],ink,2);
 poly(c,[[8,18],[10,8],[16,13],[18,18]],'#a4e1e0',ink,1.6);
 if(variant===0||variant===2){
  poly(c,[[-span*.79,40],[span*.61,40],[span*.75,45],[-span*.84,46]],accent,ink,2.5);
  for(const side of [-1,1]){
   line(c,[[side*span*.76,1],[side*span*.48,41],[side*span*.20,2]],ink,2.7);
   line(c,[[side*span*.75,2],[side*span*.24,41]],'#795b4d',1);
  }
 }else{
  for(const side of [-1,1])line(c,[[side*span*.72,2],[side*12,34]],ink,2.4);
 }
 line(c,[[-6,37],[-15,48],[9,48],[16,35]],ink,2.5);
 if(variant===3){poly(c,[[-28,49],[24,46],[32,42],[23,52],[-24,54]],cream,ink,2);}
 else{oval(c,-10,49,5,6,ink);oval(c,-10,48,2,2,gold);}
 const bend=dip*3;
 poly(c,[[-span,0],[-span+6,-3],[span-9,-3],[span+1,0],[span-4,4],[0,5+bend],[-span+5,5]],cream,ink,2.5);
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const px=side*(span*.62+i*4);line(c,[[px,-2],[px-2,3]],accent,2);
 }
 line(c,[[-span*.29,0],[span*.29,0]],'#3e9d87',2.6);
 const spin=Math.sin(t*45);
 oval(c,nose+5,25,3,Math.abs(spin)*18+2,'#fef0c399');
 line(c,[[nose+3,25-spin*16],[nose+6,25+spin*16]],'#765742',2);
 oval(c,nose+4,24,4,4,gold,ink,1.4);
 // A postage seal identifies the service even when its registration is tiny.
 oval(c,22,28,7,7,cream,ink,1.4);
 line(c,[[19,28],[24,25],[22,31]],accent,1.8);
 c.restore();
}
export function postwoman(c,x,y,size,phase,power,time,falling,quiet=false){
 c.save();c.translate(x,y);c.scale(size,size);
 const air=phase==='air', h=phase==='deck'?power*6:0, flap=quiet?1:Math.sin(time*9);
 if(phase==='chute'){
   for(const end of [-24,-9,10,25])line(c,[[end,-65],[-1,-21]],'#594452',1.2);
   c.beginPath();c.moveTo(-27,-64);c.bezierCurveTo(-25,-98,21,-99,28,-65);
   c.quadraticCurveTo(21,-72,14,-64);c.quadraticCurveTo(6,-72,0,-65);c.quadraticCurveTo(-8,-74,-15,-65);c.quadraticCurveTo(-24,-71,-27,-64);
   c.fillStyle='#fc7869';c.fill();c.strokeStyle=ink;c.lineWidth=2;c.stroke();
   line(c,[[-1,-89],[-8,-79],[-13,-68]],cream,1.7);
 }
 const k=air?(falling?3:-3):0;
 // Bent knee, flying back leg, two lace-up boots.
 for(const side of [-1,1]){
   const px=side*4, foot=air?side*8:side*5;
   line(c,[[px,-12+h],[px+power*3,-6+k],[foot,air?side*2:0]],ink,5);
   line(c,[[foot-1,air?side*2:0],[foot+3,air?side*2:0]],'#955537',3.4);
 }
 c.translate(0,h);
 poly(c,[[-7,-25],[5,-25],[8,-12],[-8,-11]],'#6b51a1',ink,1.8);
 poly(c,[[-7,-23],[-13,-20+flap],[-22,-22+flap*2],[-26,-19+flap],[-17,-17],[-8,-18]],'#f86959',ink,1.5);
 // Long blonde hair floats separately from her hat and scarf.
 poly(c,[[-8,-33],[-11,-24],[-15,-22],[-12,-19],[-17,-18],[-7,-17],[0,-24]],'#efba66',ink,1.6);
 oval(c,0,-30,8.8,9.2,'#ffd7b0',ink,1.6);
 poly(c,[[-8,-32],[-6,-38],[5,-38],[9,-33],[4,-34],[2,-31],[1,-34],[-3,-31],[-5,-28]],gold,ink,1.2);
 line(c,[[2,-29],[3,-29]],ink,1.6);line(c,[[6,-29],[7,-29]],ink,1.6);
 line(c,[[4,-26],[6,-25.5],[7,-26.5]],'#a65e60',1.2);
 poly(c,[[-10,-33],[-9,-39],[-5,-42],[6,-42],[11,-38],[8,-34],[-2,-35]],'#715388',ink,1.8);
 poly(c,[[0,-36],[9,-37],[14,-35],[5,-33]],'#ac6d53',ink,1.5);oval(c,4,-38,2,2,'#f8cf76');
 line(c,[[-5,-23],[air?-10:-5,air?-30:-19],[air?-14:-1,air?-31:-17]],'#ffcfa3',3.5);
 line(c,[[5,-23],[air?11:9,-21],[air?15:10,air?-24:-19]],'#ffcfab',3.5);
 line(c,[[-5,-24],[5,-15]],'#a45d3c',2);
 poly(c,[[2,-18],[10,-19],[11,-13],[3,-11]],'#ca8246',ink,1.5);
 c.restore();
}
