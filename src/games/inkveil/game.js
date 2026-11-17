import { painting } from '../kit/illustration.js';
const paintPlanks=painting(new URL('./pier-planks.webp',import.meta.url).href);
import { harborSea, harborPennants, butterfly } from './harbor-art.js';
import { TAU, clamp } from '../kit/fx.js';

const N=7, CELL=55, LEFT=47.5, TOP=66;
export const wharves=[
  {name:'Postern quay',map:['E..#..*','.#...#.','.#.#.O.','..O#...','#...#.#','*#.O..*','S..#...'], lights:[[3,2,.64,.3],[4,4,-.7,2.2]]},
  {name:'Pilgrim pier',map:['*..O..E','.##.#..','...#.*#','.#.O...','.#.#.#.','*..#..O','S#.....'],lights:[[3,2,-.72,1],[5,4,.86,3]]},
  {name:'Carbon strait',map:['E#..O.*','...##..','.#...#.','*#O#...','...#.O.','.#...#.','S..#..*'],lights:[[1,2,.82,.3],[5,2,-.82,2.7],[3,4,.6,4]]},
  {name:'Lantern basin',map:['*..#.OE','.#...#.','..O#...','#..*#..','..#..O.','.#..#.*','S..#...'],lights:[[3,2,-.76,0],[4,3,.83,3],[1,5,.85,.2]]},
  {name:'The final berth',map:['*#.O..E','...#.#.','.#..O..','..#..#*','O...#..','.#.O..#','S..#..*'],lights:[[3,1,.9,1],[2,3,-.94,2],[4,4,.78,3]]},
];
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const pos=n=>[n%N,Math.floor(n/N)];
const pixel=([x,y])=>[LEFT+(x+.5)*CELL,TOP+(y+.5)*CELL];
const cellAt=(m,x,y)=>m[y]?.[x];
const safe=ch=>'SOE'.includes(ch);
function water(map,x,y){return !cellAt(map,x,y) || map[y][x]==='#';}
export function pathTo(map,from,goal,penalty=()=>0) {
  const open=[[0,from]], parent=new Map([[from,null]]), cost=new Map([[from,0]]);
  while(open.length){
    open.sort((a,b)=>b[0]-a[0]);const [dist,n]=open.pop();
    if(n===goal){
      const path=[];for(let cur=n;parent.get(cur)!==null;cur=parent.get(cur))path.push(cur);return path.reverse();
    }
    if(dist!==cost.get(n))continue;
    const [x,y]=pos(n);
    for(const [a,b] of dirs){
      const nx=x+a,ny=y+b,next=nx+N*ny;if(water(map,nx,ny))continue;
      const nd=dist+1+penalty(nx,ny);
      if(nd>=(cost.get(next)??Infinity))continue;
      cost.set(next,nd);parent.set(next,n);open.push([nd,next]);
    }
  }
  return [];
}
function ellipse(c,x,y,rx,ry,col,rot=0){
  c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,rot,0,TAU);c.fill();
}
function poly(c,p,col){
  c.fillStyle=col;c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
}
function label(c,s,x,y,size,color,align='left'){
  c.fillStyle=color;c.font=`bold ${size}px "AK Mono",monospace`;c.textAlign=align;c.fillText(s,x,y);
}
export default {
  title:'INK VEIL',tagline:'Send a clockwork moth into the lamplight and smuggle the blue folio home.',
  instructions:[['Plan your crossing','Tap a dock tile to walk there. Tap your current square or press Space to stop after your next step.'],
    ['Hide in the ink','Striped awnings give shelter. Release a clockwork moth to draw the nearest lantern away for four seconds.'],
    ['Collect and escape','Collect three stamps for the exit. The optional blue folio pays extra, but glows in the light. Fresh striped roofs refill your moth.']],
  keys:[['Arrow keys / WASD','Walk the docks'],['Space','Stop your route'],['M / Q','Release a decoy moth']],
  touch:[['Tap a dock tile','Walk a route'],['Tap your courier','Stop at the next tile'],['Tap Moth','Decoy the nearest light']],
  create(api){
    let stage=0, map, lights, stamps, exit, current, checkpoint, route=[], step=null, seals=3, score=0, deliveries=0, count=0;
    let t=0, stageTime=0, exposure=0, shield=0, delay=0, auto=0, ended=false, message='', msgTime=0, held=[];
    let moth=null, charged=true, roofs=new Set(), folio=-1, carrying=false, deliveriesBlue=0, diversions=0;
    const codeDir={ArrowLeft:0,KeyA:0,ArrowRight:1,KeyD:1,ArrowUp:2,KeyW:2,ArrowDown:3,KeyS:3};
    const keyDir=[[-1,0],[1,0],[0,-1],[0,1]];
    const refresh=()=>api.hud('Stamps',`${3-stamps.size}/3`,'Seals',seals);
    function open(){
      map=wharves[stage].map;lights=wharves[stage].lights;stamps=new Set();step=null;route=[];held=[];stageTime=0;shield=.75;exposure=0;
      map.forEach((row,y)=>[...row].forEach((ch,x)=>{
        const n=x+N*y;if(ch==='S')checkpoint=current=n;if(ch==='E')exit=n;if(ch==='*')stamps.add(n);
      }));
      charged=true;moth=null;roofs=new Set([checkpoint]);carrying=false;
      const dots=[];map.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='.' && !lights.some(l=>l[0]===x && l[1]===y))dots.push(x+y*N);}));
      const distance=n=>{const [x,y]=pos(n);return Math.min(...[...stamps,current,exit].map(k=>{const [a,b]=pos(k);return Math.abs(a-x)+Math.abs(b-y);}));};
      dots.sort((a,b)=>distance(b)-distance(a));folio=dots[Math.floor(api.rng()*Math.min(4,dots.length))];
      refresh();message='Collect the brass stamps';msgTime=1.8;
    }
    function player(){
      if(!step)return pos(current);
      const [x,y]=pos(current),[ex,ey]=pos(step.to);
      return [x+(ex-x)*step.f,y+(ey-y)*step.f];
    }
    function angle(l,at){
      const normal=l[3]+at*l[2]+.15*Math.sin(at*.8+l[3]);
      if(!moth || moth.light!==l)return normal;
      const a=Math.atan2(moth.y-l[1],moth.x-l[0]);
      const life=at-moth.at;
      const blend=clamp(Math.min(life*4,(4.3-life)*2.2),0,1);
      return normal+Math.atan2(Math.sin(a-normal),Math.cos(a-normal))*blend;
    }
    function releaseMoth(){
      if(ended||delay>0)return;
      if(!charged){message='Refill at a fresh striped roof';msgTime=1.2;return;}
      const [x,y]=player();
      const light=[...lights].sort((a,b)=>Math.hypot(x-a[0],y-a[1])-Math.hypot(x-b[0],y-b[1]))[0];
      // The flying decoy circles on the far side of its tower, opening a crossing near the courier.
      const angle=Math.atan2(light[1]-y,light[0]-x);
      moth={light,x:light[0]+Math.cos(angle)*1.45,y:light[1]+Math.sin(angle)*1.45,from:[x,y],at:t};
      charged=false;diversions++;api.sound('whoosh');api.haptic(9);message='Lantern distracted';msgTime=1.4;
    }
    function watched(x,y,at){
      if(safe(cellAt(map,Math.round(x),Math.round(y)) || '#'))return false;
      return lights.some(l=>{
        const dx=x-l[0],dy=y-l[1], delta=Math.atan2(dy,dx)-angle(l,at);
        return Math.hypot(dx,dy)<3.15 && Math.cos(delta)>Math.cos(.30+.012*stage);
      });
    }
    function finish(line){
      ended=true;api.end(score,[['Mail bags delivered',deliveries],['Stamps collected',count],['Seals left',seals],['Blue folios',deliveriesBlue],['Moths released',diversions]],line);
    }
    function arrive(){
      const [x,y]=pos(current);
      if(safe(map[y][x])){
        checkpoint=current;
        if(map[y][x]==='O' && !charged && !roofs.has(current)){
          charged=true;roofs.add(current);api.sound('power');message='Moth wound up';msgTime=1;
        }
      }
      if(current===folio){folio=-1;carrying=true;api.sound('power');message='Blue folio · guard its glow';msgTime=1.4;}
      if(stamps.delete(current)){
        count++;score+=110;api.sound('coin');api.haptic(12);refresh();
        message=stamps.size ? `${3-stamps.size} of 3 stamps` : 'Bag sealed. Find the envelope!';msgTime=1.5;
      }
      if(!stamps.size && current===exit){
        deliveries++;if(carrying){deliveriesBlue++;score+=400;}score+=Math.max(180,550-Math.floor(stageTime*5));delay=1.3;
        message='Mail bag delivered';msgTime=1.4;api.sound('clear');route=[];held=[];
      }
    }
    function walk(code){
      const [x,y]=pos(step?step.to:current),[dx,dy]=keyDir[codeDir[code]];
      route=water(map,x+dx,y+dy)?[]:[x+dx+(y+dy)*N];
    }
    function update(dt){
      if(ended)return;t+=dt;msgTime-=dt;shield-=dt;if(moth && t-moth.at>4.3)moth=null;
      if(delay>0){delay-=dt;if(delay<=0){if(stage+1<wharves.length){stage++;open();}else finish('five bags before sunrise. our little secret. 💜');}return;}
      stageTime+=dt;
      if(!step){
        if(!route.length && held.length)walk(held.at(-1));
        if(route.length)step={to:route.shift(),f:0};
      }
      if(step){
        step.f=Math.min(1,step.f+dt*4.9);
        if(step.f>=1){current=step.to;step=null;arrive();}
      }
      if(delay)return;
      const [x,y]=player();
      exposure=clamp(exposure+(watched(x,y,t) && shield<=0 ? (carrying?2.5:1.72) : -1.3)*dt,0,1);
      if(exposure>=1){
        seals--;refresh();api.sound('hurt');api.haptic(45);
        if(!seals){finish('the lantern found my satchel. one more crossing?');return;}
        if(carrying){carrying=false;folio=current;}
        current=checkpoint;route=[];held=[];step=null;exposure=0;shield=1.15;message='Spotted! Back under cover';msgTime=1.1;
      }
    }
    function draw(c){
      harborSea(c,t,stage,map,pixel);
      c.fillStyle='#142435';c.fillRect(0,0,480,52);
      label(c,wharves[stage].name.toUpperCase(),15,31,19,'#f2d9a8');label(c,`BAG 0${stage+1}`,465,31,17,'#95c4c2','right');
      map.forEach((row,b)=>[...row].forEach((tile,a)=>{
        if(tile==='#')return;const [x,y]=pixel([a,b]),left=x-CELL/2,top=y-CELL/2;
        c.fillStyle='#15232a';c.fillRect(left,top+5,CELL,CELL);
        const vertical=(a+b)%3!==0;
        for(let i=0;i<5;i++){
          c.fillStyle=['#716c70','#796f70','#807675'][(a*3+b+i)%3];
          c.fillRect(left+(vertical?i*11:0),top+(vertical?0:i*11),vertical?10.3:CELL,vertical?CELL:10.3);
          c.fillStyle='#484f58';c.fillRect(left+(vertical?i*11+4:4),top+(vertical?4:i*11+4),2,2);
        }
        c.save();c.translate(x,y);if(!vertical)c.rotate(Math.PI/2);c.globalAlpha=.66;
        paintPlanks(c,(a*61+b*19)%356,(b*41+a*17)%356,156,156,-CELL/2+.5,-CELL/2+.5,CELL-1,CELL-1);c.restore();
        if(water(map,a,b+1)){c.fillStyle='#b6a38a';c.fillRect(left,top+CELL-4,CELL,3);}
      }));
      for(const n of route){
        const [x,y]=pixel(pos(n));ellipse(c,x,y,2.5,2.5,'#d7e4cf');
      }
      for(const l of lights){
        const [x,y]=pixel(l),a=angle(l,t),r=CELL*3.15;
        const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#fff5aa88');g.addColorStop(1,'#ffdf8320');
        c.fillStyle=g;c.beginPath();c.moveTo(x,y);c.arc(x,y,r,a-.30-.012*stage,a+.30+.012*stage);c.closePath();c.fill();
        ellipse(c,x,y+7,15,8,'#112535');poly(c,[[x-11,y+5],[x-7,y-15],[x+7,y-15],[x+11,y+5]],'#c7b3a1');
        c.fillStyle='#efcf84';c.fillRect(x-7,y-17,14,6);poly(c,[[x-10,y-17],[x,y-24],[x+10,y-17]],'#3b444f');
      }
      map.forEach((row,b)=>[...row].forEach((tile,a)=>{
        const [x,y]=pixel([a,b]);
        if(tile==='O' || tile==='S'){
          c.fillStyle='#483f49';c.fillRect(x-19,y-12,3,28);c.fillRect(x+15,y-12,3,28);
          for(let i=0;i<6;i++)poly(c,[[x-16+5.5*i,y-17],[x-10+5.5*i,y-17],[x-8+5.5*i,y-3],[x-15+5.5*i,y-3]],i%2?'#629091':'#385965');
        }
        if(tile==='E'){
          c.fillStyle=stamps.size?'#a9b7ae':'#e8e6b1';c.fillRect(x-17,y-11,34,22);
          poly(c,[[x-17,y-11],[x,y+3],[x+17,y-11]],'#567669');ellipse(c,x,y,3,3,stamps.size?'#8e9e99':'#f6c657');
          if(!stamps.size){c.strokeStyle='#f5e29f';c.lineWidth=2;c.strokeRect(x-22,y-16,44,32);}
        }
      }));
      for(const n of stamps){
        const [x,y]=pixel(pos(n));c.save();c.translate(x,y+Math.sin(t*2+n)*1.5);c.rotate(-.1);
        c.strokeStyle='#71513e';c.fillStyle='#eed295';c.lineWidth=4;c.setLineDash([3.5,2]);c.fillRect(-12,-14,24,28);c.strokeRect(-12,-14,24,28);c.setLineDash([]);
        c.strokeStyle='#a36e49';c.lineWidth=1.2;c.strokeRect(-8,-10,16,20);poly(c,[[0,-8],[6,1],[0,6],[-6,1]],'#af744c');c.restore();
      }
      if(folio>=0){
        const [x,y]=pixel(pos(folio));const bob=Math.sin(t*2)*2;
        c.save();c.translate(x,y+bob);c.rotate(-.14);ellipse(c,0,4,18,10,'#b6ede826');
        poly(c,[[-13,-9],[12,-9],[13,8],[-12,9]],'#8bd3dc');
        poly(c,[[-12,-9],[0,2],[12,-9]],'#497e99');ellipse(c,0,1,3,3,'#ffdb97');c.restore();
      }
      if(moth){const age=t-moth.at,u=Math.min(1,age*2.5),at=pixel([moth.from[0]+(moth.x-moth.from[0])*u,moth.from[1]+(moth.y-moth.from[1])*u]);
        const xx=at[0]+Math.sin(age*4)*10,yy=at[1]+Math.cos(age*3)*6;
        ellipse(c,xx,yy,21,18,'#b4eee51b');butterfly(c,xx,yy,t,1);
      }
      const [px,py]=pixel(player());
      ellipse(c,px,py+9,17,8,'#173c49');c.beginPath();c.ellipse(px,py+9,17,8,0,0,TAU);c.strokeStyle='#d7e7bf';c.lineWidth=1.5;c.stroke();poly(c,[[px-9,py+6],[px-5,py-9],[px+4,py-9],[px+12,py+8],[px,py+11]],'#193346');
      ellipse(c,px,py-8,8,8,'#e2bd9d');
      poly(c,[[px-13,py-10],[px-7,py-14],[px-6,py-20],[px+4,py-19],[px+8,py-13],[px+13,py-12],[px+10,py-9]],'#233c4b');
      c.fillStyle='#d87965';c.fillRect(px-8,py-2,14,3);poly(c,[[px-6,py-1],[px-16,py+2],[px-12,py+6]],'#e78c73');
      c.fillStyle='#c08b59';c.fillRect(px+4,py+1,9,8);
      if(carrying){c.fillStyle='#98ecea';c.fillRect(px+6,py,7,5);}
      harborPennants(c,t,stage);
      if(exposure>.1){c.fillStyle='#263a43';c.fillRect(px-15,py-29,30,4);c.fillStyle='#ff9b69';c.fillRect(px-15,py-29,30*exposure,4);}
      c.fillStyle='#132631';c.fillRect(0,452,480,28);
      const caption=msgTime>0?message:exposure>.15?'In the light — keep moving!':!stamps.size?'Reach the envelope':'Tap a dock · striped roofs give cover';
      label(c,caption,12,473,14,'#f2ddab');
      c.fillStyle=charged?'#9ed3c3':'#486169';c.fillRect(361,446,113,33);butterfly(c,379,463,t,.65);
      label(c,charged?'MOTH  M':'REFILL',397,469,15,charged?'#173e43':'#e0d5bf');
    }
    open();
    return {update,draw,
      pointer(type,x,y){
        if(type!=='down' || ended || delay>0)return;if(y>=442 && x>=356){releaseMoth();return;}held=[];
        const a=Math.floor((x-LEFT)/CELL),b=Math.floor((y-TOP)/CELL);
        if(water(map,a,b))return;const n=a+b*N;
        route=(n===current || n===step?.to)?[]:pathTo(map,step?step.to:current,n);
      },
      key(type,code){
        if(type==='up'){held=held.filter(k=>k!==code);return;}
        if(type!=='down' || ended || delay>0)return;
        if(code==='KeyM'||code==='KeyQ'){releaseMoth();return;}if(code==='Space'){route=[];held=[];return;}
        if(codeDir[code]===undefined)return;
        held=held.filter(k=>k!==code);held.push(code);walk(code);
      },
      demo(dt){
        if(ended || delay>0 || step || route.length)return;
        auto-=dt;if(auto>0)return;
        auto=.075;
        if(charged && (exposure>.12 || (stageTime>1.4 && !diversions)))releaseMoth();
        const goals=stamps.size?[...stamps]:[exit];
        const paths=goals.map(g=>pathTo(map,current,g,(x,y)=>watched(x,y,t+.25)?4:0)).filter(p=>p.length).sort((a,b)=>a.length-b.length);
        const next=paths[0]?.[0];
        if(next===undefined)return;
        const [x,y]=pos(next),[cx,cy]=pos(current);
        if(!watched(x,y,t+.18) || watched(cx,cy,t) || exposure<.12)route=[next];
      },
    };
  },
};
