import { TAU } from '../kit/fx.js';
import { painting } from '../kit/illustration.js';
const paintHall=painting(new URL('./optical-hall.webp',import.meta.url).href);

const N = 6, CELL = 51, ORIGIN = 112.5, X = 112.5;
const D = [[1,0],[0,1],[-1,0],[0,-1]];
const COLORS = ['#ffac69', '#62e9ed'];
// Rails are [first column, first row, step x, step y, slots, mirror face, solved slot].
// A port sits one cell outside the glass. Crossing rays pass through each other.
export const routes = [
  {name:'First class', rays:[[-1,3,0,3,6]], rails:[[1,3,1,0,4,'\\',2]]},
  {name:'Return address', rays:[[-1,4,0,-1,1]], rails:[[1,4,1,0,4,'/',1],[2,0,0,1,3,'\\',1]]},
  {name:'Glasshouse fork',rays:[[-1,2,0,4,6]],branches:[[[6,0]]],forks:[[2,2,'/']],rails:[[2,0,1,0,2,'/',0,true],[4,1,0,1,3,'\\',1]]},
  {name:'Twin express', rays:[[-1,1,0,-1,4],[5,-1,1,4,-1]], rails:[[1,1,1,0,3,'\\',1],[2,3,0,1,3,'/',1],[5,1,0,1,3,'/',1],[3,2,1,0,2,'\\',1]]},
  {name:'Cross-city post', rays:[[0,-1,1,4,-1],[6,1,2,6,5]], rails:[[0,2,0,1,3,'\\',2],[3,4,1,0,3,'/',1],[1,1,1,0,3,'/',1],[2,3,0,1,3,'\\',2]]},
  {name:'Lens district',rays:[[-1,4,0,4,-1]],branches:[[[6,5]]],forks:[[2,4,'\\']],rails:[[2,5,0,-1,2,'\\',0,true],[4,4,1,0,2,'/',0,true]]},
  {name:'Sorting office', rays:[[-1,0,0,1,-1],[-1,5,0,3,-1]], rails:[[3,0,1,0,3,'\\',1],[4,2,0,1,3,'/',1],[0,3,1,0,3,'\\',1],[2,5,1,0,3,'/',1]]},
  {name:'After hours', rays:[[6,4,2,6,1],[0,-1,1,5,6]], rails:[[2,4,1,0,3,'\\',1],[3,0,0,1,3,'/',1],[0,2,0,1,3,'\\',1],[4,3,1,0,2,'\\',1]]},
  {name:'Two suns',rays:[[1,6,3,6,2],[6,5,2,-1,5]],branches:[[[-1,0]],[]],forks:[[1,2,'/']],rails:[[1,0,1,0,3,'\\',0,true],[3,2,0,1,3,'\\',1]]},
  {name:'Northern lights', rays:[[-1,1,0,6,5],[4,6,3,6,4]], rails:[[0,1,1,0,3,'\\',1],[1,3,0,1,3,'\\',2],[3,2,1,0,2,'/',1],[5,0,0,1,3,'\\',2],[3,4,1,0,3,'\\',2]]},
];
const point = (rail, slot) => [rail[0]+rail[2]*slot,rail[1]+rail[3]*slot];
const inside = (x,y) => x>=0 && x<N && y>=0 && y<N;
const flip=face=>face==='/'?'\\':'/';
export function variant(route, reversed) {
  if(!reversed)return route;
  return {...route,
    rays:route.rays.map(([x,y,d,tx,ty])=>[5-x,y,[2,1,0,3][d],5-tx,ty]),
    rails:route.rails.map(([x,y,dx,dy,n,face,slot,rot])=>[5-x,y,-dx,dy,n,flip(face),slot,rot]),
    forks:route.forks?.map(([x,y,face])=>[5-x,y,flip(face)]),
    branches:route.branches?.map(group=>group.map(([x,y])=>[5-x,y])),
  };
}
export function trace(route, slots, turns=[]) {
  const panes = new Map(route.rails.map((r,i) => [point(r,slots[i]).join(), turns[i]?flip(r[5]):r[5]]));
  const forks=new Map((route.forks||[]).map(([x,y,face])=>[[x,y].join(),face]));
  const reflect=(dir,face)=>face==='/'?3-dir:(dir^1);
  return route.rays.map(([startX,startY,d,tx,ty],k)=>{
    const goals=[[tx,ty],...(route.branches?.[k]||[])], ends=[], strands=[], seen=new Set();
    const queue=[[startX,startY,d]];
    while(queue.length){
      let [x,y,dir]=queue.shift(); const trail=[[x,y]];
      for(;;){
        x+=D[dir][0];y+=D[dir][1];trail.push([x,y]);
        if(!inside(x,y)){ends.push([x,y]);break;}
        const key=[x,y,dir].join();if(seen.has(key))break;seen.add(key);
        const face=panes.get([x,y].join()),fork=forks.get([x,y].join());
        if(fork)queue.push([x,y,reflect(dir,fork)]);
        else if(face)dir=reflect(dir,face);
      }
      strands.push(trail);
    }
    return {trail:strands[0],strands,ends,delivered:goals.every(([gx,gy])=>ends.some(([x,y])=>gx===x&&gy===y))};
  });
}
function line(ctx,x1,y1,x2,y2,color,width=1) {
  ctx.strokeStyle=color; ctx.lineWidth=width; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
}
function words(ctx,s,x,y,size,color,align='left'){
  ctx.fillStyle=color;ctx.font=`bold ${size}px "AK Mono", monospace`;ctx.textAlign=align;ctx.fillText(s,x,y);
}
const screen = ([x,y]) => [X+x*CELL, ORIGIN+y*CELL];
function dot(ctx,x,y,r,color) {ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
export default {
  title:'PRISM COURIER', tagline:'Turn, slide and split light through the stained-glass postal exchange.',
  instructions:[['Read the ports','Solid arrows send light. The open circle and diamond are mail slots. Match each beam to its own shape.'],
    ['Slide a mirror','Tap a mirror to advance it one notch, or tap a notch on its rail. Gold frames can also turn. Select one and press Turn or R.'],
    ['Deliver the mail','Violet prisms split a beam in two. Light every matching receiver at the same time. Fewer shifts earn a larger dispatch bonus.']],
  keys:[['← / →','Select mirror'],['Space / Enter','Slide selected mirror'],['R','Turn a gold mirror']],
  touch:[['Tap glass','Slide to the next notch'],['Tap a rail notch','Slide straight there'],['Tap Turn','Rotate selected gold mirror']],
  create(api) {
    let station=0, slots, turns, selected=0, moves=0, total=0, score=0, age=0, solvedTime=0, wait=0, route, paths, ended=false;
    const occupied = (i,s) => {
      const [x,y]=point(route.rails[i],s);
      return route.rails.some((r,j)=>j!==i && point(r,slots[j])[0]===x && point(r,slots[j])[1]===y);
    };
    function open() {
      route=variant(routes[station],station>0 && api.rng()<.5);turns=route.rails.map(r=>Boolean(r[7])); selected=0; moves=0; solvedTime=0;
      slots=route.rails.map(r=>r[6]);
      for(let i=0;i<slots.length;i++){
        const r=route.rails[i], choices=Array.from({length:r[4]},(_,s)=>s).filter(s=>s!==r[6] && !occupied(i,s));
        if(choices.length) slots[i]=choices[Math.floor(api.rng()*choices.length)];
      }
      paths=trace(route,slots,turns);
      if(paths.every(p=>p.delivered)) {
        // A parallel beam can occasionally admit several solutions.
        outer: for(let i=0;i<slots.length;i++) for(let s=0;s<route.rails[i][4];s++) {
          if(occupied(i,s)) continue;
          slots[i]=s; paths=trace(route,slots,turns); if(!paths.every(p=>p.delivered)) break outer;
        }
      }
      api.hud('Dispatch', `${station+1}/${routes.length}`, 'Shifts', moves);
    }
    function updateOptics(sound) {
      moves++;total++;paths=trace(route,slots,turns);api.sound(sound);
      if(paths.every(p=>p.delivered)){
        solvedTime=1.2;score+=Math.max(150,900-35*moves);api.sound('clear');api.haptic(18);
      }
      api.hud('Dispatch',`${station+1}/${routes.length}`,'Shifts',moves);
    }
    function shift(i,s) {
      if(ended || solvedTime>0 || s===slots[i] || occupied(i,s))return;
      selected=i;slots[i]=s;updateOptics('select');
    }
    function rotate(){
      if(ended || solvedTime>0 || !route.rails[selected][7])return;
      turns[selected]=!turns[selected];updateOptics('power');
    }
    function cycle(i) {
      for(let n=1;n<route.rails[i][4];n++){
        const next=(slots[i]+n)%route.rails[i][4]; if(!occupied(i,next)){shift(i,next);break;}
      }
    }
    function draw(ctx) {
      const sky=ctx.createLinearGradient(0,38,400,480);sky.addColorStop(0,'#51415a');sky.addColorStop(.45,'#273e54');sky.addColorStop(1,'#141f3b');
      ctx.fillStyle=sky;ctx.fillRect(0,0,480,480);
      for(let col=0;col<9;col++){const x=col*62-12,h=col%2?70:54;
        ctx.strokeStyle='#d3aa7675';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-25,410);ctx.lineTo(x-25,h+99);ctx.quadraticCurveTo(x-23,h+73,x,h+59);ctx.quadraticCurveTo(x+23,h+73,x+25,h+99);ctx.lineTo(x+25,410);ctx.stroke();
        for(let i=0;i<6;i++){const y=h+101+i*42;ctx.beginPath();ctx.moveTo(x,y-21);ctx.lineTo(x+21,y);ctx.lineTo(x,y+21);ctx.lineTo(x-21,y);ctx.closePath();ctx.fillStyle=['#d39d8037','#a59cd526','#58a1bb35'][(i+col)%3];ctx.fill();}}

      for(let i=-40;i<500;i+=19) line(ctx,i,0,i-83,480,'#163641',1);
      const painted=paintHall(ctx,0,0,480,480);
      ctx.fillStyle='#f1dec0';ctx.fillRect(0,0,480,59);
      for(let x=-12;x<480;x+=25) line(ctx,x,56,x+12,56,x%50===-12?'#ad5549':'#428688',4);
      words(ctx,route.name.toUpperCase(),18,30,20,'#203d49');
      words(ctx,'OPTICAL POST',19,49,14,'#4a6a6b');
      words(ctx,`${String(station+1).padStart(2,'0')} / ${routes.length}`,462,37,18,'#203d49','right');
      ctx.fillStyle=painted?'#101c2c94':'#142630';ctx.fillRect(X-CELL/2-5,ORIGIN-CELL/2-5,N*CELL+10,N*CELL+10);
      for(let y=0;y<N;y++) for(let x=0;x<N;x++){
        const [sx,sy]=screen([x,y]);ctx.fillStyle=painted?((x+y)%2?'#26536688':'#3a69777a'):((x+y)%2?'#234552':'#294b58');
        ctx.fillRect(sx-CELL/2+1,sy-CELL/2+1,CELL-2,CELL-2);
        ctx.beginPath();ctx.moveTo(sx-24,sy-24);ctx.lineTo(sx+24,sy-24);ctx.lineTo(sx-24,sy+24);ctx.fillStyle=(x+y+station)%3?'#96bfc010':'#d6abcf15';ctx.fill();
        line(ctx,sx-24,sy+23,sx+24,sy-24,'#c4cad81b',1);
        dot(ctx,sx-20,sy-20,1.1,'#95aeb1');dot(ctx,sx+20,sy+20,1.1,'#697c86');
      }
      route.rails.forEach((r,i)=>{
        const [x,y]=screen(point(r,0)), [ex,ey]=screen(point(r,r[4]-1));
        line(ctx,x,y,ex,ey,'#142c37',11);line(ctx,x,y,ex,ey,'#91b4ae',2);
        for(let s=0;s<r[4];s++){const [nx,ny]=screen(point(r,s));dot(ctx,nx,ny,5,'#476975');dot(ctx,nx,ny,2.5,'#c7d1b9');}
      });
      paths.forEach(({strands},k)=>strands.forEach(trail=>{
        const color=COLORS[k];
        ctx.save();ctx.beginPath();ctx.rect(53,64,373,353);ctx.clip();
        ctx.beginPath();trail.forEach((p,i)=>{const [x,y]=screen(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
        ctx.lineWidth=17;ctx.strokeStyle=color+'21';ctx.stroke();ctx.lineWidth=9;ctx.strokeStyle=color+'50';ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle=color;ctx.stroke();
        for(let i=(age*(k?2.1:2.4))%1.6;i<trail.length-1;i+=1.6){
          const a=trail[Math.floor(i)],b=trail[Math.floor(i)+1], f=i%1;
          const [x,y]=screen([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);
          if(k){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#e7ffff';ctx.fillRect(-3,-3,6,6);ctx.restore();}
          else dot(ctx,x,y,3,'#fff9dc');
        }
        ctx.restore();
      }));
      route.rails.forEach((r,i)=>{
        const [x,y]=screen(point(r,slots[i])), s=(turns[i]?flip(r[5]):r[5])==='/'?-1:1;
        ctx.save();ctx.translate(x,y);
        if(r[7]){ctx.strokeStyle='#ffca70';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,18,0,TAU);ctx.stroke();}
        if(i===selected){ctx.strokeStyle='#f4dfae';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.strokeRect(-19,-19,38,38);ctx.setLineDash([]);}
        line(ctx,-12,-12*s,12,12*s,'#152d39',12);line(ctx,-12,-12*s,12,12*s,'#c3efeb',7);
        line(ctx,-10,-10*s-2,10,10*s-2,'#fff8d9',2);
        ctx.restore();
      });
      for(const [fx,fy] of route.forks||[]){const [x,y]=screen([fx,fy]);ctx.save();ctx.translate(x,y);
        ctx.fillStyle='#cdb0ff';ctx.beginPath();ctx.moveTo(0,-19);ctx.lineTo(17,12);ctx.lineTo(-17,12);ctx.closePath();ctx.fill();
        ctx.fillStyle='#9a72bd';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(5,7);ctx.lineTo(-11,7);ctx.fill();
        ctx.fillStyle='#ffdaaa';ctx.fillRect(-13,13,26,2);ctx.restore();}
      route.rays.forEach(([sx,sy,d,tx,ty],k)=>{
        const color=COLORS[k];
        const port=(x,y)=>[Math.max(65,Math.min(415,X+x*CELL)),Math.max(72,Math.min(412,ORIGIN+y*CELL))];
        let [x,y]=port(sx,sy);
        ctx.save();ctx.translate(x,y);ctx.rotate(d*Math.PI/2);ctx.fillStyle=color;
        ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-6,-11);ctx.lineTo(-6,11);ctx.closePath();ctx.fill();
        if(k){ctx.fillStyle='#133b49';ctx.fillRect(-3,-2,4,4);}else dot(ctx,-2,0,2,'#563b28');ctx.restore();
        for(const [gx,gy] of [[tx,ty],...(route.branches?.[k]||[])]){
        [x,y]=port(gx,gy);ctx.save();ctx.translate(x,y);ctx.strokeStyle=color;ctx.lineWidth=4;
        if(k){ctx.rotate(Math.PI/4);ctx.strokeRect(-8,-8,16,16);}else{ctx.beginPath();ctx.arc(0,0,10,0,TAU);ctx.stroke();}
        if(paths[k].ends.some(([ex,ey])=>gx===ex&&gy===ey))dot(ctx,0,0,4,color);ctx.restore();}
      });
      ctx.fillStyle=solvedTime?'#e4d79b':'#d4e3d1';ctx.fillRect(0,427,480,53);
      words(ctx,solvedTime?'MAIL DELIVERED':'Tap glass to slide it',19,450,18,'#203f44');
      words(ctx,solvedTime?'Sorting the next dispatch…':route.forks?'Split light to reach every port':'Follow each color to its open port',19,471,15,'#41605d');
      if(route.rails.some(r=>r[7])){ctx.fillStyle=route.rails[selected][7]?'#b98249':'#8d9182';ctx.fillRect(357,434,112,37);words(ctx,'↻ TURN',413,458,18,'#fff9e9','center');}
    }
    open();
    return {draw, update(dt) {
      age+=dt;if(ended || solvedTime<=0)return;
      solvedTime-=dt;if(solvedTime>0)return;
      if(++station<routes.length)open();
      else{ended=true;station=routes.length-1;api.end(score,[['Dispatches',routes.length],['Mirror shifts',total]],'express delivery, by actual light. 💜');}
    },
    pointer(type,x,y) {
      if(type!=='down' || solvedTime>0 || ended)return;
      if(y>=432&&x>=350){rotate();return;}
      const grid=[Math.round((x-X)/CELL),Math.round((y-ORIGIN)/CELL)];
      const i=route.rails.findIndex((r,j)=>point(r,slots[j]).join()===grid.join());
      if(i>=0){selected=i;cycle(i);return;}
      for(let j=0;j<route.rails.length;j++) for(let s=0;s<route.rails[j][4];s++)
        if(point(route.rails[j],s).join()===grid.join()){shift(j,s);return;}
    },
    key(type,code) {
      if(type!=='down' || ended || solvedTime)return;
      if(code==='ArrowRight' || code==='ArrowLeft') selected=(selected+(code==='ArrowRight'?1:-1)+slots.length)%slots.length;
      if(code==='Space' || code==='Enter')cycle(selected);
      if(code==='KeyR')rotate();
    },
    demo(dt){
      wait-=dt;if(wait>0 || solvedTime || ended)return;wait=.84;
      const face=turns.findIndex(Boolean);if(face>=0){selected=face;rotate();return;}
      const i=route.rails.findIndex((r,k)=>slots[k]!==r[6] && !occupied(k,r[6]));
      if(i>=0)shift(i,route.rails[i][6]);
    }};
  },
};
