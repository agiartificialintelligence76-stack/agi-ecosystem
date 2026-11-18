import { line, oval, polygon, panel, gradient } from '../kit/illustration.js';
const palettes=[
 ['#3c2139','#b17c68','#f7c47f'],['#18243f','#6a6783','#edba7d'],
 ['#512b46','#cc745e','#ffce7b'],['#162d43','#537283','#bce5e2'],
 ['#382440','#80616d','#e6a7b8'],['#1c1d39','#565478','#f9d994'],
];
export function backdrop(c,stage){
 const [upper,lower,trim]=palettes[stage];
 gradient(c,0,0,480,272,[upper,lower,'#37283c']);
 if(stage===1||stage===5){
   oval(c,344,97,26,26,trim);for(let i=0;i<20;i++){const x=i*27+6,h=(i*29)%49+12;
     panel(c,x,190-h,23,h,'#353048',0);for(let k=0;k<3;k++)panel(c,x+4+k*6,194-h,2,4,'#cfb786',0);}
 }else if(stage===3){
   for(let i=0;i<7;i++){const x=49+i*57;polygon(c,[[x,94],[x+25,71],[x+47,96],[x+47,163],[x,163]],'#7b9d9e87',trim,1);line(c,[[x+6,134],[x+36,96]],'#f5efbb80',1);}
 }else if(stage===4){
   for(let i=0;i<14;i++){const x=i*39;line(c,[[x,169],[x+4,117],[x+14,98]],'#4e4652',3);
     for(let n=0;n<5;n++)oval(c,x+6+Math.sin(i*9+n)*13,107+Math.cos(n*2+i)*12,10,6,n%2?'#ac7386':'#cf969a');}
 }else if(stage===2){
   for(let i=0;i<10;i++)polygon(c,[[240,48],[i*60-30,180],[i*60,180]],i%2?'#f0a97750':'#7a335c62');
 }else{
   for(let i=0;i<7;i++){const x=32+i*63;line(c,[[x,174],[x,102],[x+18,86],[x+37,100],[x+37,174]],'#d9ad8266',2);}
 }
 for(const side of [0,1]){c.save();if(side){c.translate(480,0);c.scale(-1,1);}
   polygon(c,[[0,0],[129,0],[112,59],[78,93],[31,122],[45,266],[0,266]],'#582638');
   for(let i=0;i<4;i++){line(c,[[21+i*23,0],[17+i*17,61],[12+i*8,123]],i%2?'#873c4c':'#a34f59',5);}
   line(c,[[8,120],[35,130]],trim,3);c.restore();}
}
