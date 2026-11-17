import { TAU, ellipse, line, shape, rect, label, sky } from '../kit/garden-art.js';

const types = [
  {name:'Kelp', color:'#bfd96b', need:'Likes open space', benefit:'space'},
  {name:'Urchin', color:'#e5a5dd', need:'Grazes beside kelp', benefit:'kelp'},
  {name:'Star', color:'#ffae78', need:'Feeds beside urchins', benefit:'urchins'},
];
const cells = [
  [0,1,94,160],[0,2,169,148],[0,3,244,136],[0,4,319,124],
  [1,0,69,224],[1,1,144,212],[1,2,219,200],[1,3,294,188],[1,4,369,176],
  [2,0,119,276],[2,1,194,264],[2,2,269,252],[2,3,344,240],
  [3,0,169,328],[3,1,244,316],[3,2,319,304],
];
const homes = cells.map(([r,c])=>cells.map(([rr,cc],i)=>[rr-r,cc-c,i]).filter(([dr,dc])=>
  (dr===0&&Math.abs(dc)===1)||(Math.abs(dr)===1&&(dc===0||dc===-dr))).map(([, ,i])=>i));

export function thriving(board, i, highTide) {
  const kind=board[i];
  if (kind===null) return false;
  const neighbors=homes[i];
  if(kind===0) return neighbors.filter(n=>board[n]===null).length >= (highTide?1:2);
  return neighbors.some(n=>board[n]===kind-1);
}
function organism(ctx,x,y,kind,t,s=1) {
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ellipse(ctx,2,12,17,6,'rgba(6,64,67,.28)');
  if(kind===0) {
    for(let k=-2;k<=2;k++) {
      const tip=k*8+Math.sin(t*1.4+k)*3;
      ctx.beginPath(); ctx.moveTo(k*2,13);
      ctx.bezierCurveTo(k*7,-1,tip-7,-12,tip,-17-Math.cos(k)*6);
      ctx.bezierCurveTo(tip+8,-10,k*3,6,k*3+1,14);
      ctx.fillStyle=k%2?'#719c51':'#c0d778';ctx.fill();
    }
  } else if(kind===1) {
    for(let i=0;i<27;i++){
      const a=i*TAU/27;
      line(ctx,[[Math.cos(a)*8,Math.sin(a)*6],[Math.cos(a)*(16+i%4),Math.sin(a)*(15+i%3)]],i%2?'#65456e':'#9664a4',2.3);
    }
    ellipse(ctx,0,0,11,10,'#ad7bb7');
    for(let i=0;i<7;i++) ellipse(ctx,Math.sin(i*2.4)*7,Math.cos(i*2.2)*6,1.4,1.3,'#efd7e7');
  } else {
    const p=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-1.35, r=i%2?7:21;return [Math.cos(a)*r,Math.sin(a)*r*.85]});
    shape(ctx,p,'#ed946a');
    for(let i=0;i<5;i++){
      const a=i*TAU/5-1.35;
      for(let j=1;j<=3;j++) ellipse(ctx,Math.cos(a)*j*4,Math.sin(a)*j*3.4,1.4,1.1,'#ffe0ad');
    }
  }
  ctx.restore();
}
function shore(ctx,t) {
  sky(ctx,'#e8d39e','#cead79',369);
  for(let i=0;i<96;i++){
    const x=(i*137)%481,y=66+(i*67)%301;
    ellipse(ctx,x,y,1+(i%3),1,i%4?'#bf9e76':'#f8e5b8',-.4);
  }
  const outline=[[13,240],[29,185],[66,131],[131,107],[195,100],[260,66],[346,65],[401,99],[445,147],[463,197],[445,248],[414,274],[366,286],[331,329],[275,351],[182,359],[112,344],[77,306],[32,282]];
  const inner=(sx,sy)=>outline.map(([x,y])=>[240+(x-240)*sx,215+(y-215)*sy]);
  shape(ctx,outline,'#7e8575');
  shape(ctx,inner(.982,.965),'#edf1d1');
  shape(ctx,inner(.957,.92),'#8bd6bb');
  shape(ctx,inner(.883,.82),'#69bda8');
  shape(ctx,inner(.77,.72),'#54a99f');
  for(let i=0;i<36;i++){
    const x=77+(i*93)%309,y=128+(i*57)%144;
    const a=Math.sin(t+i);
    line(ctx,[[x+a*3,y],[x+6+a*3,y-1],[x+11+a*4,y]],'rgba(215,249,213,.48)',1.1);
  }
  [[25,168,14],[436,249,19],[401,300,11],[319,70,16],[55,306,8],[146,99,7]].forEach(([x,y,r])=>{
    ellipse(ctx,x+1,y+2,r,r*.52,'#9c8c70',-.2);
    ellipse(ctx,x,y,r,r*.43,'#cac1a2',-.2);
    ellipse(ctx,x-3,y-2,r*.55,r*.18,'#ded4b5',-.2);
  });
}
export default {
 title:'TIDEPOOL',tagline:'Build a little food web between the tides.',
 instructions:[
   ['Pick a settler','Choose one of two arrivals, then tap a vacant ripple to plant it. You get one placement per tide.'],
   ['Build a food web','Urchins need adjacent kelp. Stars need adjacent urchins. Keep a gap beside kelp, or two at low tide.'],
   ['Keep the pool thriving','Each thriving settler earns 10 points every tide. The dotted links show which neighbors touch.'],
 ],
 keys:[['1 / 2','Select an arriving species'],['Arrow keys','Choose a pool pocket'],['Space / Enter','Settle in the selected pocket']],
 touch:[['Tap a species, then a ripple','Settle one arrival']],
 create(api){
   const board=Array(cells.length).fill(null);
   let offers=[0,1], selected=0,cursor=5,turn=0,score=0,ended=false,t=0,wash=0,aiWait=.8,keyboardFocus=false;
   let gain=0, latest=-1;
   const high=()=>turn%4<2;
   function nextOffers(){
     const a=Math.floor(api.rng()*3);
     return [a,(a+1+Math.floor(api.rng()*2))%3];
   }
   function value(i,k){
     if(board[i]!==null) return -1;
     board[i]=k;
     const n=board.reduce((a,_,j)=>a+Number(thriving(board,j,high())),0);
     board[i]=null;
     return n;
   }
   function settle(i){
     if(ended||i<0||board[i]!==null) return;
     board[i]=offers[selected]; latest=i;
     const active=board.filter((_,j)=>thriving(board,j,high())).length;
     gain=active*10;
     score+=gain;turn++;wash=1;
     api.sound(active>2?'merge':'drop');api.haptic(12);
     if(turn===12){
       ended=true;
       const diversity=new Set(board.filter(k=>k!==null)).size;
       const bonus=diversity===3?90:0;
       api.end(score+bonus,[['Thriving on last tide',active],['Species',diversity+' / 3'],['Biodiversity bonus',bonus]],'look at the tiny world you made.');
     }else {
       offers=nextOffers(); selected=0;
       cursor=board.findIndex(v=>v===null);
     }
     hud();
   }
   function hud(){api.hud('Tide',Math.min(turn+1,12)+'/12','Ecosystem',score);}
   hud();
   function getCell(x,y) {
     return cells.findIndex(([, ,cx,cy])=>Math.hypot((x-cx)/32,(y-cy)/25)<=1);
   }
   function draw(ctx){
     shore(ctx,t);
     rect(ctx,0,0,480,55,0,'#273f40');
     label(ctx,high()?'HIGH TIDE':'LOW TIDE',16,19,17,'#f7edcf');
     label(ctx,high()?'Kelp needs 1 open neighbor':'Kelp needs 2 open neighbors',16,41,15,'#d1e7cc');
     label(ctx,'TIDE '+Math.min(12,turn+1)+'/12',463,29,17,'#f7edcf','right');
     homes.forEach((n,i)=>n.filter(j=>j>i).forEach(j=>{
       const occupied=board[i]!==null&&board[j]!==null;
       line(ctx,[[cells[i][2],cells[i][3]],[cells[j][2],cells[j][3]]],occupied?'rgba(236,254,199,.55)':'rgba(43,115,108,.23)',occupied?2.6:1.4);
     }));
     cells.forEach(([, ,x,y],i)=>{
       const empty=board[i]===null;
       const chosen=keyboardFocus&&cursor===i;
       ctx.strokeStyle=chosen?'#253e40':empty?'#d2ecce':'rgba(230,248,197,.7)';
       ctx.lineWidth=chosen?3.5:1.5;
       ctx.setLineDash(empty&&!chosen?[4,5]:[]);
       ctx.beginPath();ctx.ellipse(x,y+2,26,16,-.14,0,TAU);ctx.stroke();
       ctx.setLineDash([]);
       if(empty) {
         line(ctx,[[x-3,y+1],[x+3,y+1]],'#d8ecce',1.4);
         line(ctx,[[x,y-2],[x,y+4]],'#d8ecce',1.4);
       } else {
         organism(ctx,x,y-4,board[i],t+i,1);
         if(thriving(board,i,high())) ellipse(ctx,x+18,y-16,3,3,'#fff0aa');
       }
       if(latest===i&&wash>0){
         ctx.globalAlpha=wash;ctx.strokeStyle='#fff7b2';ctx.lineWidth=2;
         ctx.beginPath();ctx.ellipse(x,y,29+(1-wash)*10,18+(1-wash)*6,0,0,TAU);ctx.stroke();ctx.globalAlpha=1;
       }
     });
     rect(ctx,0,368,480,112,0,'#203f42');
     label(ctx,wash>.3?'Tide harvest  +'+gain:'Pick an arrival, then an open ripple',240,387,17,'#fbefd1','center','Georgia');
     offers.forEach((k,i)=>{
       const x=12+i*232;
       rect(ctx,x,404,224,62,12,i===selected?'#e7ebcc':'#375c58');
       organism(ctx,x+28,435,k,t, .85);
       label(ctx,(i+1)+'  '+types[k].name,x+54,424,18,i===selected?'#264746':'#fcf1cd');
       label(ctx,types[k].need,x+54,448,15,i===selected?'#345751':'#d8e7d0');
     });
   }
   return {draw,update(dt){t+=dt;wash=Math.max(0,wash-dt*.7);},
     pointer(type,x,y){
       if(type!=='down'||ended) return;
       keyboardFocus=false;
       if(y>=401&&y<=469){selected=x<240?0:1;api.sound('select');}
       else settle(getCell(x,y));
     },
     key(type,code){
       if(type!=='down'||ended)return;
       if(code==='Digit1'||code==='Digit2'){selected=Number(code.slice(-1))-1;api.sound('select');return;}
       if(code==='Space'||code==='Enter'){settle(cursor);return;}
       const dir={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[code];
       if(!dir)return;
       keyboardFocus=true;
       const [, ,x,y]=cells[cursor];
       const nearest=cells.map((cell,i)=>{
         const dx=cell[2]-x,dy=cell[3]-y,forward=dx*dir[0]+dy*dir[1],cross=dx*dir[1]-dy*dir[0];
         return {i,cost:forward>18?forward+Math.abs(cross)*2:Infinity};
       }).sort((a,b)=>a.cost-b.cost)[0];
       if(Number.isFinite(nearest.cost)) cursor=nearest.i;
     },
     demo(dt){
       aiWait-=dt;if(aiWait>0||ended)return;
       let best=-1,slot=0,cell=-1;
       offers.forEach((k,j)=>board.forEach((v,i)=>{
         if(v!==null)return;
         const estimate=value(i,k)+api.rng()*.25;
         if(estimate>best){best=estimate;slot=j;cell=i;}
       }));
       selected=slot;settle(cell);aiWait=2;
     },
   };
 },
};
