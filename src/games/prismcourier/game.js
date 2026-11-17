import { TAU } from '../kit/fx.js';

const N = 6, CELL = 51, ORIGIN = 112.5, X = 112.5;
const D = [[1,0],[0,1],[-1,0],[0,-1]];
const COLORS = ['#ffac69', '#62e9ed'];
// Rails are [first column, first row, step x, step y, slots, mirror face, solved slot].
// A port sits one cell outside the glass. Crossing rays pass through each other.
export const routes = [
  {name:'First class', rays:[[-1,3,0,3,6]], rails:[[1,3,1,0,4,'\\',2]]},
  {name:'Return address', rays:[[-1,4,0,-1,1]], rails:[[1,4,1,0,4,'/',1],[2,0,0,1,3,'\\',1]]},
  {name:'Twin express', rays:[[-1,1,0,-1,4],[5,-1,1,4,-1]], rails:[[1,1,1,0,3,'\\',1],[2,3,0,1,3,'/',1],[5,1,0,1,3,'/',1],[3,2,1,0,2,'\\',1]]},
  {name:'Cross-city post', rays:[[0,-1,1,4,-1],[6,1,2,6,5]], rails:[[0,2,0,1,3,'\\',2],[3,4,1,0,3,'/',1],[1,1,1,0,3,'/',1],[2,3,0,1,3,'\\',2]]},
  {name:'Sorting office', rays:[[-1,0,0,1,-1],[-1,5,0,3,-1]], rails:[[3,0,1,0,3,'\\',1],[4,2,0,1,3,'/',1],[0,3,1,0,3,'\\',1],[2,5,1,0,3,'/',1]]},
  {name:'After hours', rays:[[6,4,2,6,1],[0,-1,1,5,6]], rails:[[2,4,1,0,3,'\\',1],[3,0,0,1,3,'/',1],[0,2,0,1,3,'\\',1],[4,3,1,0,2,'\\',1]]},
  {name:'Northern lights', rays:[[-1,1,0,6,5],[4,6,3,6,4]], rails:[[0,1,1,0,3,'\\',1],[1,3,0,1,3,'\\',2],[3,2,1,0,2,'/',1],[5,0,0,1,3,'\\',2],[3,4,1,0,3,'\\',2]]},
];
const point = (rail, slot) => [rail[0]+rail[2]*slot,rail[1]+rail[3]*slot];
const inside = (x,y) => x>=0 && x<N && y>=0 && y<N;
export function trace(route, slots) {
  const panes = new Map(route.rails.map((r,i) => [point(r,slots[i]).join(), r[5]]));
  return route.rays.map(([x,y,dir,tx,ty]) => {
    const trail = [[x,y]], seen = new Set();
    for (;;) {
      x += D[dir][0]; y += D[dir][1]; trail.push([x,y]);
      if (!inside(x,y)) break;
      const state = [x,y,dir].join();
      if (seen.has(state)) break;
      seen.add(state);
      const face = panes.get([x,y].join());
      if(face) dir = face === '/' ? 3-dir : (dir ^ 1);
    }
    return {trail, delivered: x === tx && y === ty};
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
  title:'PRISM COURIER', tagline:'Slide the glass and send each parcel of light to its matching port.',
  instructions:[['Read the ports','Solid arrows send light. The open circle and diamond are mail slots. Match each beam to its own shape.'],
    ['Slide a mirror','Tap a mirror to advance it one notch, or tap a notch on its rail. Each mirror keeps its angle.'],
    ['Deliver the mail','Connect every route at the same time. Fewer shifts earn a larger dispatch bonus.']],
  keys:[['← / →','Select mirror'],['Space / Enter','Slide selected mirror']],
  touch:[['Tap glass','Slide to the next notch'],['Tap a rail notch','Slide straight there']],
  create(api) {
    let station=0, slots, selected=0, moves=0, total=0, score=0, age=0, solvedTime=0, wait=0, route, paths, ended=false;
    const occupied = (i,s) => {
      const [x,y]=point(route.rails[i],s);
      return route.rails.some((r,j)=>j!==i && point(r,slots[j])[0]===x && point(r,slots[j])[1]===y);
    };
    function open() {
      route=routes[station]; selected=0; moves=0; solvedTime=0;
      slots=route.rails.map(r=>r[6]);
      for(let i=0;i<slots.length;i++){
        const r=route.rails[i], choices=Array.from({length:r[4]},(_,s)=>s).filter(s=>s!==r[6] && !occupied(i,s));
        if(choices.length) slots[i]=choices[Math.floor(api.rng()*choices.length)];
      }
      paths=trace(route,slots);
      if(paths.every(p=>p.delivered)) {
        // A parallel beam can occasionally admit several solutions.
        outer: for(let i=0;i<slots.length;i++) for(let s=0;s<route.rails[i][4];s++) {
          if(occupied(i,s)) continue;
          slots[i]=s; paths=trace(route,slots); if(!paths.every(p=>p.delivered)) break outer;
        }
      }
      api.hud('Dispatch', `${station+1}/${routes.length}`, 'Shifts', moves);
    }
    function shift(i,s) {
      if(ended || solvedTime>0 || s===slots[i] || occupied(i,s)) return;
      selected=i; slots[i]=s; moves++; total++; paths=trace(route,slots);api.sound('select');
      if(paths.every(p=>p.delivered)){
        solvedTime=1.2; score+=Math.max(150,900-35*moves);api.sound('clear');api.haptic(18);
      }
      api.hud('Dispatch', `${station+1}/${routes.length}`, 'Shifts', moves);
    }
    function cycle(i) {
      for(let n=1;n<route.rails[i][4];n++){
        const next=(slots[i]+n)%route.rails[i][4]; if(!occupied(i,next)){shift(i,next);break;}
      }
    }
    function draw(ctx) {
      ctx.fillStyle='#102c38';ctx.fillRect(0,0,480,480);
      for(let i=-40;i<500;i+=19) line(ctx,i,0,i-83,480,'#163641',1);
      ctx.fillStyle='#f1dec0';ctx.fillRect(0,0,480,59);
      for(let x=-12;x<480;x+=25) line(ctx,x,56,x+12,56,x%50===-12?'#ad5549':'#428688',4);
      words(ctx,route.name.toUpperCase(),18,30,20,'#203d49');
      words(ctx,'OPTICAL POST',19,49,14,'#4a6a6b');
      words(ctx,`0${station+1} / 0${routes.length}`,462,37,18,'#203d49','right');
      ctx.fillStyle='#142630';ctx.fillRect(X-CELL/2-5,ORIGIN-CELL/2-5,N*CELL+10,N*CELL+10);
      for(let y=0;y<N;y++) for(let x=0;x<N;x++){
        const [sx,sy]=screen([x,y]);ctx.fillStyle=(x+y)%2 ? '#234552' : '#294b58';
        ctx.fillRect(sx-CELL/2+1,sy-CELL/2+1,CELL-2,CELL-2);
        dot(ctx,sx-20,sy-20,1.1,'#50737b');
      }
      route.rails.forEach((r,i)=>{
        const [x,y]=screen(point(r,0)), [ex,ey]=screen(point(r,r[4]-1));
        line(ctx,x,y,ex,ey,'#142c37',11);line(ctx,x,y,ex,ey,'#91b4ae',2);
        for(let s=0;s<r[4];s++){const [nx,ny]=screen(point(r,s));dot(ctx,nx,ny,5,'#476975');dot(ctx,nx,ny,2.5,'#c7d1b9');}
      });
      paths.forEach(({trail},k)=>{
        const color=COLORS[k];
        ctx.save();ctx.beginPath();ctx.rect(53,64,373,353);ctx.clip();
        ctx.beginPath();trail.forEach((p,i)=>{const [x,y]=screen(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
        ctx.lineWidth=10;ctx.strokeStyle=color+'3b';ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle=color;ctx.stroke();
        for(let i=(age*(k?2.1:2.4))%1.6;i<trail.length-1;i+=1.6){
          const a=trail[Math.floor(i)],b=trail[Math.floor(i)+1], f=i%1;
          const [x,y]=screen([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);
          if(k){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#e7ffff';ctx.fillRect(-3,-3,6,6);ctx.restore();}
          else dot(ctx,x,y,3,'#fff9dc');
        }
        ctx.restore();
      });
      route.rails.forEach((r,i)=>{
        const [x,y]=screen(point(r,slots[i])), s=r[5]==='/'?-1:1;
        ctx.save();ctx.translate(x,y);
        if(i===selected){ctx.strokeStyle='#f4dfae';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.strokeRect(-19,-19,38,38);ctx.setLineDash([]);}
        line(ctx,-12,-12*s,12,12*s,'#152d39',12);line(ctx,-12,-12*s,12,12*s,'#c3efeb',7);
        line(ctx,-10,-10*s-2,10,10*s-2,'#fff8d9',2);
        ctx.restore();
      });
      route.rays.forEach(([sx,sy,d,tx,ty],k)=>{
        const color=COLORS[k];
        const port=(x,y)=>[Math.max(65,Math.min(415,X+x*CELL)),Math.max(72,Math.min(412,ORIGIN+y*CELL))];
        let [x,y]=port(sx,sy);
        ctx.save();ctx.translate(x,y);ctx.rotate(d*Math.PI/2);ctx.fillStyle=color;
        ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-6,-11);ctx.lineTo(-6,11);ctx.closePath();ctx.fill();
        if(k){ctx.fillStyle='#133b49';ctx.fillRect(-3,-2,4,4);}else dot(ctx,-2,0,2,'#563b28');ctx.restore();
        [x,y]=port(tx,ty);ctx.save();ctx.translate(x,y);ctx.strokeStyle=color;ctx.lineWidth=4;
        if(k){ctx.rotate(Math.PI/4);ctx.strokeRect(-8,-8,16,16);}else{ctx.beginPath();ctx.arc(0,0,10,0,TAU);ctx.stroke();}
        if(paths[k].delivered)dot(ctx,0,0,4,color);ctx.restore();
      });
      ctx.fillStyle=solvedTime?'#e4d79b':'#d4e3d1';ctx.fillRect(0,427,480,53);
      words(ctx,solvedTime?'MAIL DELIVERED':'Tap glass to slide it',19,450,18,'#203f44');
      words(ctx,solvedTime?'Sorting the next dispatch…':'Follow each color to its open port',19,471,15,'#41605d');
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
    },
    demo(dt){
      wait-=dt;if(wait>0 || solvedTime || ended)return;wait=.84;
      const i=route.rails.findIndex((r,k)=>slots[k]!==r[6] && !occupied(k,r[6]));
      if(i>=0)shift(i,route.rails[i][6]);
    }};
  },
};
