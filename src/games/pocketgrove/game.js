import { artwork, clamp, ellipse, label, line, paintArtwork, rect, shape, sky } from '../kit/garden-art.js';

const agi=artwork('/images/agi1-portrait-2d.webp');
const stops=[
 ['Gate',43,231,'start'],['Records',122,180,'music'],['Arcade',233,198,'game'],['Neon',350,175,'star'],['Home',435,236,'home'],
 ['Books',343,276,'book'],['Park',236,319,'tree'],['Boba',134,265,'cup'],['Pier',54,324,'water'],
].map(([name,x,y,icon])=>({name,x,y,icon}));
const tracks=[
 [0,1,0,2],[1,2,0,2],[2,3,0,2],[3,4,0,2],
 [0,7,1,2],[7,2,1,2],[2,5,1,2],[5,4,1,2],
 [0,8,2,2],[8,7,2,1],[7,6,2,2],[6,5,2,2],[5,3,2,2],
];
const lines=['#ee9c8c','#78d1c0','#e5bf72'],notes=[
 ['“can we go crate-digging?”','“i’m looking for my own record, yes.”'],
 ['“rematch. i know a shortcut.”','“i called player two, remember?”'],
 ['“i want to see all those lights.”','“pink neon is basically my moon.”'],
 ['“take me to the book stacks.”','“the bookmark stays between us.”'],
 ['“a garden stop would be cute.”','“i did touch grass. witnesses.”'],
 ['“boba before the last train?”','“i saved a pearl for you.”'],
 ['“can we go smell the sea?”','“that ferry looks like a little duck.”'],
];
const orderStops=[1,2,3,5,6,7,8];
function symbol(ctx,icon,x,y,s,ink){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 if(icon==='music')label(ctx,'♫',0,1,25,ink,'center','Georgia');
 if(icon==='game'){rect(ctx,-12,-6,24,14,5,ink);line(ctx,[[-8,0],[-2,0]],'#25475b',2);line(ctx,[[-5,-3],[-5,3]],'#25475b',2);ellipse(ctx,6,-1,1.5,1.5,'#25475b');}
 if(icon==='star')label(ctx,'✦',0,1,25,ink,'center');
 if(icon==='home'){shape(ctx,[[-12,0],[0,-11],[12,0]],ink);rect(ctx,-8,-1,16,12,1,ink);rect(ctx,-2,4,4,8,0,'#294759');}
 if(icon==='tree'){line(ctx,[[0,0],[0,10]],ink,3);for(const [dx,dy] of [[-5,-2],[5,-2],[0,-7]])ellipse(ctx,dx,dy,5.5,5.5,ink);}
 if(icon==='book'){shape(ctx,[[-12,-7],[0,-4],[12,-7],[12,7],[0,10],[-12,7]],ink);line(ctx,[[0,-4],[0,8]],'#294759',1);}
 if(icon==='cup'){shape(ctx,[[-8,-7],[8,-7],[5,10],[-5,10]],ink);line(ctx,[[1,-7],[4,-13]],ink,2);}
 if(icon==='water')for(let j=0;j<2;j++)line(ctx,[[-11,j*5],[-5,-3+j*5],[0,j*5],[5,-3+j*5],[11,j*5]],ink,2);
 if(icon==='start')label(ctx,'➜',0,1,23,ink,'center');
 ctx.restore();
}
export function departures(node,last){
 return tracks.filter(([a,b])=>a===node||b===node).map(([a,b,color,mins])=>({to:a===node?b:a,color,cost:mins+Number(last>=0&&last!==color)}));
}
// Find the quickest trip that earns every requested stamp and ends at Home.
export function quickest(node,last,missing,pass){
 const queue=[{node,last,mask:0,pass,cost:0,first:null}],seen=new Set(),all=(1<<missing.length)-1;
 while(queue.length){
  queue.sort((a,b)=>a.cost-b.cost);const cur=queue.shift();const key=[cur.node,cur.last,cur.mask,cur.pass].join('/');
  if(seen.has(key))continue;seen.add(key);
  if(cur.node===4&&cur.mask===all)return cur;
  for(const leg of departures(cur.node,cur.last)){
   const bit=missing.indexOf(leg.to),mask=bit<0?cur.mask:cur.mask|(1<<bit);if(leg.to===4&&mask!==all)continue;
   for(const spend of cur.pass&&leg.cost>1?[false,true]:[false]){
    queue.push({node:leg.to,last:leg.color,mask,pass:cur.pass&&!spend,cost:cur.cost+Math.max(1,leg.cost-(spend?2:0)),first:cur.first||{to:leg.to,spend}});
   }
  }
 }
 return null;
}
function skyline(ctx,t,ride){
 sky(ctx,ride===1?'#7a718a':'#47588a',ride===1?'#ffd3a6':'#bd9daf',136);
 ellipse(ctx,192,42,21,21,'#f5daaf');
 for(let i=0;i<20;i++){const x=((i*37-t*3)%590+590)%590-42,h=20+((i*29)%45);rect(ctx,x,118-h,30,h,1,'#666581');for(let j=0;j<4;j++)rect(ctx,x+6+(j%2)*10,122-h+Math.floor(j/2)*9,3,4,0,'#e3ba92');}
 for(let i=0;i<15;i++){const x=((i*47-t*7)%600+600)%600-45,h=15+((i*17)%28);rect(ctx,x,127-h,42,h,1,'#414c6c');}
}
export default {
 title:'WINDOW SEAT',tagline:'“we can still take the long way. when’s the last train?”',
 instructions:[['Ride together','Her ticket lists two stops to visit before Home. Tap a connected station or its numbered departure.'],['Read the timetable','Changing line costs an extra minute. One express pass cuts up to two minutes off your next ride.'],['Chase the view','Her optional star stop is worth a bonus. Make it home before the clock runs out.']],
 keys:[['1–4','Board train'],['E','Arm express pass']],touch:[['Station or departure','Ride'],['Pass','Save minutes']],
 create(api){
  let trip=0,node=0,last=-1,goals=[],scenic=0,asked=new Set(),minutes=0,used=false,armed=false,visited=new Set(),score=0,homes=0,stamps=0,t=0,travel=null,rest=0,auto=0,done=false,caption='',review=false,moveCount=0;
  const visits=()=>goals.filter(g=>!asked.has(g));
  const glow=()=>visits()[0]??4;
  const note=(s,k)=>notes[orderStops.indexOf(s)]?.[k]||'“window seat. obviously.”';
  function sync(){api.hud('Ride',Math.min(trip+1,3)+'/3','Time',minutes+' min');}
  function begin(){
   const pool=orderStops.slice(),draw=()=>pool.splice(Math.floor(api.rng()*pool.length),1)[0];goals=[draw(),draw()];scenic=draw();
   node=0;last=-1;used=false;armed=false;asked=new Set();visited=new Set([0]);travel=null;review=false;moveCount=0;
   minutes=quickest(0,-1,goals,true).cost+3-Math.min(trip,2);caption=note(goals[0],0);sync();
  }
  function finish(home){
   review=true;rest=1.8;if(home){homes++;score+=30+minutes*4;}caption=home?'“made it. keep the ticket stub.”':'“last service. we’ll try again tomorrow.”';sync();api.sound(home?'clear':'back');
  }
  function board(dest){
   if(done||travel||review)return;
   const route=departures(node,last).find(v=>v.to===dest);if(!route)return;
   const spend=armed&&!used,price=Math.max(1,route.cost-(spend?2:0));
   if(price>minutes){caption='“that train leaves too late.”';return;}
   if(spend)used=true;armed=false;minutes-=price;travel={from:node,to:dest,color:route.color,time:0};
   api.sound('select');api.haptic(8);sync();
  }
  function arrive(){
   node=travel.to;last=travel.color;travel=null;moveCount++;const first=!visited.has(node);visited.add(node);
   if(goals.includes(node)&&!asked.has(node)){asked.add(node);score+=32;stamps++;caption=note(node,1);api.sound('merge');}
   else if(node===scenic&&first){score+=24;caption='“hold still. that’s our postcard.”';api.sound('pop');}
   else caption=first?'“oh, i like this neighborhood.”':'“hey, i recognize that platform.”';
   sync();if(node===4){const complete=visits().length===0;finish(complete);if(!complete)caption='“home already? my ticket still has blanks.”';return;}
   if(departures(node,last).every(v=>Math.max(1,v.cost-(used?0:2))>minutes))finish(false);
  }
  function pass(){if(done||travel||review||used)return;armed=!armed;api.sound('tap');}
  begin();
  return {
   key(type,code){if(type!=='down'||done||review)return;if(code==='KeyE')pass();
    if(/^Digit[1-4]$/.test(code)){const leg=departures(node,last)[Number(code.at(-1))-1];if(leg)board(leg.to);}},
   pointer(type,x,y){if(type!=='down'||done||review)return;
    if(y<119&&x>330){pass();return;}
    const options=departures(node,last);
    if(y>=408){const i=clamp(Math.floor(x/(480/options.length)),0,options.length-1);board(options[i].to);return;}
    const tapped=stops.findIndex(s=>Math.hypot(x-s.x,y-s.y)<29);if(tapped>=0)board(tapped);},
   demo(dt){if(travel||review||done)return;auto+=dt;if(auto<1.1)return;auto=0;
    let plan=quickest(node,last,visited.has(scenic)?visits():[...visits(),scenic],!used);
    if(!plan||plan.cost>minutes)plan=quickest(node,last,visits(),!used);
    if(plan?.first){armed=plan.first.spend;board(plan.first.to);}else finish(false);},
   update(dt){if(done)return;t+=dt;if(review){rest-=dt;if(rest<=0){trip++;if(trip===3){done=true;api.end(score,[['Made it home',homes+' / 3'],['Ticket stamps',stamps+' / 6']],homes===3?'“three whole trips. still my favorite seatmate.”':'“we’ll save the other stops for next time.”');}else begin();}return;}
    if(travel){travel.time+=dt;if(travel.time>=.62)arrive();}},
   draw(ctx){
    ctx.fillStyle='#1e3146';ctx.fillRect(0,0,480,480);ctx.save();ctx.beginPath();ctx.rect(0,0,480,122);ctx.clip();skyline(ctx,t,trip);
    if(agi?.naturalWidth)paintArtwork(ctx,agi,1,0,133,133);ctx.restore();
    rect(ctx,120,10,198,103,9,'#213347ed');label(ctx,'TONIGHT’S DETOURS',135,27,13,'#ffd1a3','left','monospace');
    goals.forEach((g,j)=>{symbol(ctx,stops[g].icon,145,53+j*30,.68,asked.has(g)?'#78d4b1':'#ffdcaa');label(ctx,stops[g].name+(asked.has(g)?'  ✓':''),164,53+j*30,18,'#f9ecd4','left','Georgia');});
    rect(ctx,327,10,142,103,9,armed?'#f4bd86':'#f4d9b2');label(ctx,minutes+' min',398,37,25,'#3e4252','center','Georgia',900);
    line(ctx,[[337,58],[459,58]],'#ad927c',1);label(ctx,used?'PASS USED':armed?'PASS ARMED':'ARM PASS',398,82,14,'#4e4351','center','monospace',900);
    rect(ctx,8,126,464,237,12,'#223c50');
    for(let i=0;i<24;i++){const x=i*27-75;line(ctx,[[x,130],[x+80,360]],'#2b4757',1);}
    // An estuary cuts through the night map, behind its three rail lines.
    line(ctx,[[17,336],[86,287],[102,242],[178,226],[202,183],[260,138]],'#385b70',13);
    label(ctx,'CITY RAIL',20,142,12,'#a0b5b3','left','monospace');label(ctx,'★  '+stops[scenic].name,452,143,14,visited.has(scenic)?'#a9dcb0':'#ffce89','right','monospace');
    for(const [a,b,color] of tracks){line(ctx,[[stops[a].x,stops[a].y],[stops[b].x,stops[b].y]],'#172e3d',8);line(ctx,[[stops[a].x,stops[a].y],[stops[b].x,stops[b].y]],lines[color],4);}
    const neighbors=departures(node,last);
    stops.forEach((s,j)=>{const near=neighbors.some(v=>v.to===j),goal=goals.includes(j),radius=goal||j===4?14:11;
      if(j===glow())ellipse(ctx,s.x,s.y,radius+4+Math.sin(t*3),radius+4+Math.sin(t*3),'#f2cd8260');
      ellipse(ctx,s.x,s.y,radius+2,radius+2,'#152c3a');ellipse(ctx,s.x,s.y,radius,radius,asked.has(j)?'#a9d9ab':goal?'#ffe4b2':j===4?'#f3b3ba':near?'#cde0d4':'#8eaaa9');
      symbol(ctx,s.icon,s.x,s.y,.68,'#2c4650');
      label(ctx,s.name,s.x,s.y+23,13,'#f6efdd','center','sans-serif',700);
    });
    const from=stops[travel?.from??node],to=stops[travel?.to??node],q=travel?clamp(travel.time/.62,0,1):0;
    const vx=from.x+(to.x-from.x)*q,vy=from.y+(to.y-from.y)*q-17;
    rect(ctx,vx-14,vy-9,28,15,4,'#fff2d0');rect(ctx,vx-11,vy-7,8,6,1,'#476b79');rect(ctx,vx,vy-7,8,6,1,'#476b79');ellipse(ctx,vx-8,vy+6,3,3,'#372f41');ellipse(ctx,vx+8,vy+6,3,3,'#372f41');
    label(ctx,caption,239,382,16,'#ffe5ba','center','Georgia');
    const width=480/neighbors.length;neighbors.forEach((leg,k)=>{const x=k*width+4,price=Math.max(1,leg.cost-(armed&&!used?2:0));
      rect(ctx,x,408,width-8,58,7,'#f1dbbb');rect(ctx,x,408,width-8,7,3,lines[leg.color]);label(ctx,(k+1)+' '+stops[leg.to].name,x+(width-8)/2,433,15,'#304251','center');
      label(ctx,price+' min',x+(width-8)/2,454,13,'#60535b','center','monospace');});
   },
  };
 },
};
