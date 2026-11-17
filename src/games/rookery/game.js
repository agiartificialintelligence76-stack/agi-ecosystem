import { folio, soil, fledgling } from './marsh.js';
import { TAU } from '../kit/fx.js';

const N=5, OX=65, OY=70, CELL=70;
const fields=[
  ['Reed meadow',[7,17], [20,24]], ['Willow bend',[1,8,16,23], [21,9]],
  ['Salt marsh',[6,12,18], [20,4]], ['Heron steps',[7,10,14,22],[1,24]],
  ['Alder hollow',[3,6,17,21],[15,9]], ['Winter roost',[5,8,11,19,22],[0,24]],
];
const ORTHO=[[1,0],[-1,0],[0,1],[0,-1]];
const JUMPS=[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[-1,2],[1,-2],[-1,-2]];
export const wetlands=[
  {pools:[],egg:-1}, {pools:[7,13,22],egg:-1}, {pools:[4,10,14],egg:7},
  {pools:[6,12,16],egg:8}, {pools:[2,11,22],egg:7}, {pools:[3,10,12,21],egg:17},
];
const pack = ([rook,owl,tide=0,egg=0]) => (rook*25+owl)*4+tide*2+egg;
function landed(state,bird,cell,wetland){
  const next=[...state];next[bird]=cell;
  if(wetland?.pools.length)next[2]=1-(state[2]||0);
  if(wetland?.egg>=0)next[3]=Number(state[3]===1 || cell===wetland.egg);
  return next;
}
const matches=(a,b,habitat)=>a[0]===b[0] && a[1]===b[1] && (habitat.egg<0 || a[3]===1);
const pos = i => [i%5,Math.floor(i/5)];
const onscreen = i => {const [x,y]=pos(i); return [OX+(x+.5)*CELL,OY+(y+.5)*CELL];};
const inside=(x,y)=>x>=0 && y>=0 && x<N && y<N;
export function legalMoves(field,state,bird,wetland) {
  const [x,y]=pos(state[bird]), occupied=state[1-bird];
  const free=(a,b)=>inside(a,b) && !field.includes(a+b*N) && a+b*N!==occupied && !(state[2]===1 && wetland?.pools.includes(a+b*N));
  if(bird===1) return JUMPS.map(([a,b])=>[a+x,b+y]).filter(([a,b])=>free(a,b)).map(([a,b])=>a+b*N);
  const moves=[];
  for(const [dx,dy] of ORTHO) {
    let a=x,b=y;while(free(a+dx,b+dy)){a+=dx;b+=dy;}
    if(a!==x || b!==y)moves.push(a+b*N);
  }
  return moves;
}
// At most 600 ordered pairs on a five-by-five board. The tree supplies both the puzzle's par and real hints.
export function flights(field,start,wetland) {
  const first={state:start,depth:0,first:null};
  const nodes=[first], visited=new Map([[pack(start),first]]);
  for(let i=0;i<nodes.length;i++) {
    const parent=nodes[i];
    for(let bird=0;bird<2;bird++)for(const cell of legalMoves(field,parent.state,bird,wetland)){
      const state=landed(parent.state,bird,cell,wetland);
      if(visited.has(pack(state)))continue;
      const node={state,depth:parent.depth+1,first:parent.first || [bird,cell]};
      visited.set(pack(state),node); nodes.push(node);
    }
  }
  return visited;
}
function label(c,s,x,y,size,color,align='left'){
  c.fillStyle=color;c.textAlign=align;c.font=`bold ${size}px "AK Mono",monospace`;c.fillText(s,x,y);
}
function poly(c,pts,col) {
  c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
}
function ellipse(c,x,y,rx,ry,col,rot=0){
  c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,rot,0,TAU);c.fill();
}
function birdIcon(c,bird,x,y,size){
  c.save();c.translate(x,y);c.scale(size,size);
  if(!bird){
    poly(c,[[-18,5],[-34,12],[-24,14],[-16,12],[-20,17],[-9,13]],'#283e3b');
    ellipse(c,-1,1,19,13,'#223936',-.4);ellipse(c,9,-10,11,12,'#233b39',.18);
    poly(c,[[14,-13],[31,-9],[16,-6]],'#bb7055');
    poly(c,[[-15,4],[-3,-6],[8,-5],[0,3],[-13,9]],'#457471');
    poly(c,[[-14,8],[-4,1],[1,1],[-8,8]],'#6a9083');
    ellipse(c,12,-12,2.2,2.2,'#fff0bd');
  }else{
    poly(c,[[-18,-9],[-19,-25],[-7,-17],[8,-16],[19,-25],[17,-7]],'#97563e');
    ellipse(c,0,0,18,22,'#a05c44');
    ellipse(c,-7,-6,8,9,'#efd3a1');ellipse(c,7,-6,8,9,'#efd3a1');
    ellipse(c,-7,-6,3,4,'#293b37');ellipse(c,7,-6,3,4,'#293b37');
    poly(c,[[-3,0],[4,0],[0,6]],'#52332d');
    for(let j=0;j<3;j++)for(let i=0;i<3;i++){
      const px=-9+i*8+(j%2)*2,py=7+j*4;poly(c,[[px,py],[px+4,py],[px+2,py+2.6]],'#edbd86');
    }
  }
  c.restore();
}
export default {
  title:'ROOKERY', tagline:'Walk the tides, lift a lost chick, and bring your two birds home.',
  instructions:[['Choose a bird','Tap the rook or owl. Dots show its possible landings. Tap a dot to fly.'],
    ['Use their moves','The rook slides straight until the edge, reeds, or the owl stops it. The owl jumps two squares then one sideways.'],
    ['Find both nests','Blue tide pools flood or drain after each move. Flooded tiles block flight. When a chick appears, land on it before nesting both birds.']],
  keys:[['Arrow keys','Move cursor'],['Space / Enter','Select bird or landing'],['B','Switch bird'],['U / H','Undo / hint']],
  touch:[['Tap bird, then dot','Make a flight'],['Tap Undo or Hint','Rewind or reveal a move']],
  create(api){
    let stage=0, state, target, par, field, selected=0, cursor, history, hints, totalMoves=0, score=0;
    let wetland, rescued=0;
    let delay=0, hop=null, age=0, auto=0, ended=false, hintCell=null, notice='', noticeTime=0;
    function open(){
      const entry=fields[stage];wetland=wetlands[stage];field=entry[1];state=[...entry[2],0,0];history=[];hints=0;hintCell=null;noticeTime=0;
      selected=0;cursor=state[0];hop=null;
      const tree=[...flights(field,state,wetland).values()];
      const unique=new Map();
      for(const node of tree){const [a,b]=node.state;if((wetland.egg>=0 && node.state[3]!==1)||a===state[0]||b===state[1])continue;
        const key=a*25+b;if(!unique.has(key))unique.set(key,node);}
      const depth=Math.min(stage+3,8), eligible=[...unique.values()], candidates=eligible.filter(n=>n.depth===depth);
      const chosen=candidates.length?candidates[Math.floor(api.rng()*candidates.length)]:eligible.at(-1);
      target=chosen.state;par=chosen.depth;
      api.hud('Habitat',`${stage+1}/${fields.length}`,'Flights',0);
    }
    function move(bird,cell){
      if(ended || delay || !legalMoves(field,state,bird,wetland).includes(cell))return;
      history.push(state.slice()); selected=bird; hop={bird,from:state[bird],to:cell,t:0};
      const carried=state[3];state=landed(state,bird,cell,wetland);cursor=cell;hintCell=null;noticeTime=0;
      if(!carried && state[3]){notice='Chick tucked in';noticeTime=1.3;api.sound('power');}api.sound(bird?'pop':'whoosh');api.haptic(8);
      api.hud('Habitat',`${stage+1}/${fields.length}`,'Flights',history.length);
      if(matches(state,target,wetland)){
        if(wetland.egg>=0)rescued++;
        delay=1.1;totalMoves+=history.length;score+=Math.max(180,1000-60*(history.length-par)-hints*40);api.sound('clear');
      }
    }
    function select(cell){
      if(delay || ended)return;
      cursor=cell;
      const which=state.slice(0,2).indexOf(cell);
      if(which!==-1){selected=which;hintCell=null;api.sound('tap');return;}
      move(selected,cell);
    }
    function undo(){
      if(!history.length || delay || ended)return;
      const old=state;state=history.pop();selected=old[0]!==state[0]?0:1;cursor=state[selected];hintCell=null;hop=null;noticeTime=0;
      api.hud('Habitat',`${stage+1}/${fields.length}`,'Flights',history.length);api.sound('back');
    }
    function hint(act){
      const solution=[...flights(field,state,wetland).values()].find(n=>matches(n.state,target,wetland));
      if(!solution?.first){
        if(act)undo();else{notice='Try undoing a flight';noticeTime=2;}return;
      }
      const [bird,cell]=solution.first;
      if(act)move(bird,cell);
      else{selected=bird;hintCell=cell;cursor=cell;hints++;api.sound('tick');}
    }
    function draw(c){
      folio(c,stage,age);
      label(c,fields[stage][0].toUpperCase(),18,25,19,'#263e36');
      label(c,`PAR ${par}`,462,25,17,'#476458','right');
      if(wetland.pools.length){c.fillStyle=state[2]?'#426c7c':'#678575';c.fillRect(346,36,117,23);label(c,state[2]?'HIGH TIDE':'LOW TIDE',405,53,15,'#fff1cf','center');}
      label(c,delay?'Both birds are home':selected===0?'Rook · slides to the last perch':'Owl · jumps in an L shape',18,52,16,'#445e50');
      c.fillStyle='#526659';c.fillRect(OX-4,OY-4,CELL*N+8,CELL*N+8);
      const legal=legalMoves(field,state,selected,wetland);
      for(let i=0;i<25;i++){
        const [x,y]=onscreen(i),[a,b]=pos(i),lo=x-CELL/2,top=y-CELL/2;
        soil(c,x,y,CELL,i,stage,age,wetland.pools.includes(i),state[2]===1);
        if(field.includes(i)){
          ellipse(c,x,y+5,26,14,'#93af9a');
          for(let k=0;k<7;k++){
            const dx=((k*19+i*7)%38)-19,dy=((k*11)%15)-7;
            c.strokeStyle=k%2?'#476e5a':'#5a805f';c.lineWidth=2;c.beginPath();c.moveTo(x+dx,y+dy+13);c.quadraticCurveTo(x+dx+2,y+dy-3,x+dx-3,y+dy-17);c.stroke();
            ellipse(c,x+dx-3,y+dy-17,2.4,5,'#956d48',-.17);
          }
        }else{
          for(let k=0;k<4;k++){c.fillStyle='#9fae8a';c.fillRect(lo+8+(i*19+k*31)%54,top+8+(i*11+k*17)%54,3,1);}
        }
        if(i===wetland.egg && !state[3])fledgling(c,x,y,age);
        const nest=target.slice(0,2).indexOf(i);
        if(nest>=0){
          const col=nest?'#ae6447':'#365f5b';
          ellipse(c,x,y+6,26,15,col);
          ellipse(c,x,y+4,19,10,nest?'#d5a97e':'#9abca7');
          for(let k=0;k<7;k++) {
            c.strokeStyle=nest?'#d89969':'#769c85';c.lineWidth=1.7;c.beginPath();
            c.ellipse(x+(k%2)*2,y+6+(k%3),23-k%4,11-k%3,k*.21-.6,k*.7,k*.7+2.3);c.stroke();
          }
          if(!state.slice(0,2).includes(i)){birdIcon(c,nest,x,y, .47);}
        }
        if(legal.includes(i) && !delay){
          const color=selected?'#a16043':'#426d62';
          c.strokeStyle=hintCell===i?'#ffd86d':color;c.lineWidth=hintCell===i?5:2.5;
          c.beginPath();c.arc(x,y,nest>=0?21:8,0,TAU);c.stroke();
          if(nest<0)ellipse(c,x,y,3,3,color);
        }
        if(cursor===i){c.strokeStyle='#f9f1c7';c.lineWidth=3;c.strokeRect(lo+3,top+3,CELL-6,CELL-6);}
      }
      state.slice(0,2).forEach((cell,i)=>{
        let [x,y]=onscreen(cell), lift=0;
        if(hop?.bird===i && hop.t<1){const [fx,fy]=onscreen(hop.from);x=fx+(x-fx)*hop.t;y=fy+(y-fy)*hop.t;lift=Math.sin(hop.t*Math.PI)*17;}
        ellipse(c,x,y+16,18,5,'#879b81');
        if(i===selected){c.strokeStyle='#f4ecc8';c.lineWidth=2;c.beginPath();c.ellipse(x,y+14,22,7,0,0,TAU);c.stroke();}
        if(hop?.bird===i && hop.t<1){const [fx,fy]=onscreen(hop.from);c.save();c.setLineDash([3,7]);c.beginPath();c.moveTo(fx,fy);c.quadraticCurveTo((fx+x)/2,(fy+y)/2-22,x,y-lift);c.strokeStyle='#e9e3b6';c.lineWidth=3;c.stroke();c.restore();}
        birdIcon(c,i,x,y-lift+.8*Math.sin(age*2+i),.94);
        if(state[3] && i===1){c.save();c.translate(x+15,y+10-lift);c.scale(.66,.66);fledgling(c,0,0,age);c.restore();}
      });
      for(const [x,txt] of [[65,'↶  Undo'],[251,'?  Hint']]){
        c.fillStyle='#34564c';c.fillRect(x,432,164,38);
        label(c,txt,x+82,457,17,'#f7eed6','center');
      }
      if(noticeTime>0){c.fillStyle='#34564c';c.fillRect(73,378,334,34);label(c,notice,240,401,16,'#fff0d0','center');}
    }
    open();
    return {draw,update(dt){
      age+=dt;if(hop)hop.t=Math.min(1,hop.t+dt*4.2);noticeTime-=dt;
      if(ended || delay<=0)return;
      delay-=dt;if(delay>0)return;
      if(++stage<fields.length){delay=0;open();}
      else{ended=true;stage=fields.length-1;api.end(score,[['Habitats',fields.length],['Flights taken',totalMoves],['Chicks rescued',rescued]],'both birds made it home. i saved you a perch. 💜');}
    },
    pointer(type,x,y){
      if(type!=='down' || delay || ended)return;
      const a=Math.floor((x-OX)/CELL),b=Math.floor((y-OY)/CELL);
      if(inside(a,b)){select(a+b*N);return;}
      if(y>=432 && y<=470){if(x>=65 && x<=229)undo();if(x>=251 && x<=415)hint(false);}
    },
    key(type,code){
      if(type!=='down' || delay || ended)return;
      if(code==='KeyU')undo();else if(code==='KeyH')hint(false);
      else if(code==='KeyB'){selected=1-selected;cursor=state[selected];hintCell=null;}
      else if(code==='Space' || code==='Enter')select(cursor);
      else {
        const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[code];
        if(d){const [x,y]=pos(cursor);if(inside(x+d[0],y+d[1]))cursor+=d[0]+N*d[1];}
      }
    },
    demo(dt){auto-=dt;if(auto<=0 && !delay && !ended){auto=.95;hint(true);}},
    };
  },
};
