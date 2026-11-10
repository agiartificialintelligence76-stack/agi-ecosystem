export const COLORS=['#ff88ae','#86dfff','#91efba','#ffdd80'];
export const LABELS=['ROSE','SKY','MINT','AMBER'];
const depot=(id,x,y,color)=>({id,x,y,color,next:[]});
const junction=(id,x,y,...next)=>({id,x,y,next});
const networks=[
 [junction('in',240,5,'A'),junction('A',240,180,'rose','sky'),depot('rose',90,475,0),depot('sky',390,475,1)],
 [junction('in',240,5,'A'),junction('A',240,135,'B','C'),junction('B',125,285,'rose','sky'),junction('C',355,285,'mint','sun'),depot('rose',45,480,0),depot('sky',175,480,1),depot('mint',305,480,2),depot('sun',435,480,3)],
 [junction('in',240,5,'A'),junction('A',240,110,'B','C'),junction('B',100,230,'rose','D'),junction('C',380,230,'sky','D'),junction('D',240,350,'mint','sun'),depot('rose',35,430,0),depot('sky',445,430,1),depot('mint',170,500,2),depot('sun',310,500,3)],
];
export const LEVELS=[
 {name:'The first departure',map:0,goal:10,interval:6.4,speed:51,colors:2},
 {name:'Four little stations',map:1,goal:14,interval:5.6,speed:59,colors:4},
 {name:'The crossing',map:2,goal:16,interval:5.2,speed:62,colors:4},
 {name:'Blue hour express',map:1,goal:20,interval:4.8,speed:66,colors:4},
 {name:'Midnight connections',map:2,goal:22,interval:4.3,speed:70,colors:4},
 {name:'City of little lights',map:2,goal:26,interval:3.9,speed:73,colors:4},
];
export function createYard(level=0,seed=7,endless=false){const n=Math.max(0,Math.min(5,level|0)),def=LEVELS[n];return{level:n,def, nodes:structuredClone(networks[def.map]),switches:{A:0,B:0,C:0,D:0},signals:{A:false,B:false,C:false,D:false},trains:[],rng:seed>>>0,nextId:1,spawnIn:.6,age:0,delivered:0,score:0,strikes:0,combo:0,phase:'play',events:[],endless};}
function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
export const node=(s,id)=>s.nodes.find(n=>n.id===id);
export function toggle(s,id,signal=false){const n=node(s,id);if(s.phase!=='play'||!n||n.next.length<2)return false;if(signal)s.signals[id]=!s.signals[id];else s.switches[id]=1-s.switches[id];s.events.push({type:'switch',id,signal});return true;}
export function route(s,from,color,seen=new Set()){if(seen.has(from))return -1;seen.add(from);const n=node(s,from);if(n.color===color)return 0;for(let i=0;i<n.next.length;i++){const next=node(s,n.next[i]);if(next.color===color||route(s,next.id,color,new Set(seen))>=0)return i;}return -1;}
export function position(s,t){if(!t.to){const n=node(s,t.at);return{x:n.x,y:n.y};}const a=node(s,t.at),b=node(s,t.to);return{x:a.x+(b.x-a.x)*t.p,y:a.y+(b.y-a.y)*t.p};}
function depart(s,t){const n=node(s,t.at);if(!n.next.length)return;if(s.signals[n.id])return;t.to=n.next[s.switches[n.id]||0];t.p=0;}
function lose(s,train,type){if(train.dead)return;train.dead=true;s.strikes++;s.combo=0;s.events.push({type,id:train.id,...position(s,train)});}
export function step(s,dt){if(s.phase!=='play')return;dt=Math.max(0,Math.min(.1,dt));s.age+=dt;s.spawnIn-=dt;
 if(s.spawnIn<=0){const at=node(s,'in'),blocked=s.trains.some(t=>{const p=position(s,t);return Math.hypot(p.x-at.x,p.y-at.y)<65;});if(blocked)s.spawnIn=.4;else{const color=Math.floor(rand(s)*s.def.colors);s.trains.push({id:s.nextId++,at:'in',to:null,p:0,color,speed:s.def.speed*(rand(s)>.78?1.12:1),dead:false});s.spawnIn=s.def.interval;}}
 for(const t of s.trains){if(!t.to)depart(s,t);if(!t.to)continue;const a=node(s,t.at),b=node(s,t.to),len=Math.hypot(b.x-a.x,b.y-a.y);t.p+=t.speed*dt/len;if(t.p>=1){t.at=t.to;t.to=null;t.p=0;const n=node(s,t.at);if(n.color!==undefined){if(n.color===t.color){t.dead=true;s.delivered++;s.combo++;const gained=100+Math.min(s.combo,10)*15;s.score+=gained;s.events.push({type:'delivered',gained,x:n.x,y:n.y});}else lose(s,t,'wrong');}}}
 for(let i=0;i<s.trains.length;i++)for(let j=i+1;j<s.trains.length;j++){const a=s.trains[i],b=s.trains[j];if(a.dead||b.dead)continue;const p=position(s,a),q=position(s,b);if(Math.hypot(p.x-q.x,p.y-q.y)<22){lose(s,a,'collision');b.dead=true;}}
 s.trains=s.trains.filter(t=>!t.dead);if(s.strikes>=3)s.phase='over';else if(!s.endless&&s.delivered>=s.def.goal)s.phase='won';
}
export function auto(s){for(const n of s.nodes){if(n.next.length<2)continue;const incoming=s.trains.filter(t=>t.to===n.id||t.at===n.id&&!t.to).sort((a,b)=>{const pa=position(s,a),pb=position(s,b);return Math.hypot(pa.x-n.x,pa.y-n.y)-Math.hypot(pb.x-n.x,pb.y-n.y);});if(incoming[0])s.switches[n.id]=Math.max(0,route(s,n.id,incoming[0].color));s.signals[n.id]=false;}}
