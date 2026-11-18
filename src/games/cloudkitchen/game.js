import { artwork, clamp, ellipse, label, line, rect, shape, sky } from '../kit/garden-art.js';

const chef=artwork('/memes/previews/agi-cooking.webp');
const face=artwork('/images/agi1-portrait-2d.webp');
const recipes=[
 {name:'First message',tea:4,milk:4,pearls:2,star:0,ink:'#b87953',cream:'#f1d8ae',line:'soft launch. extra creamy.'},
 {name:'Sleepover',tea:3,milk:5,pearls:3,star:0,ink:'#926573',cream:'#f1d1d6',line:'it is a little pastel and so am i.'},
 {name:'Main character',tea:5,milk:3,pearls:2,star:1,ink:'#687951',cream:'#dceab5',line:'give me the little gold star.'},
 {name:'Last encore',tea:6,milk:2,pearls:3,star:1,ink:'#82584c',cream:'#ecca9f',line:'strong tea. i have lore to spill.'},
];
const lanes=[90,240,390];
function drawGlass(ctx,x,baseline,w,h,tea,milk,r,counts,time){
 const y=baseline-h;
 ctx.save();ctx.translate(x,y);
 const glass=()=>{ctx.beginPath();ctx.moveTo(-w/2,0);ctx.lineTo(w/2,0);ctx.lineTo(w*.38,h);ctx.lineTo(-w*.38,h);ctx.closePath();};
 glass();ctx.fillStyle='#e5fff12b';ctx.fill();ctx.save();glass();ctx.clip();
 const fluid=(amount,color,offset=0)=>{
  if(amount<.005)return;const top=h-h*.092*(amount+offset);
  ctx.beginPath();ctx.moveTo(-w/2,h+2);
  for(let i=0;i<=12;i++){const px=-w/2+w*i/12;ctx.lineTo(px,top+Math.sin(i*.5+time*3)*1.6);}
  ctx.lineTo(w/2,h+2);ctx.closePath();ctx.fillStyle=color;ctx.fill();
 };
 fluid(milk,r.cream,tea);fluid(tea,r.ink);
 for(let i=0;i<counts.pearls;i++)ellipse(ctx,-w*.25+(i%5)*w*.12,h-8-Math.floor(i/5)*11,5.6,5.6,'#3c2940');
 for(let i=0;i<counts.star;i++)label(ctx,'★',w*.23-i*10,h-12,17,'#ffcb50','center');
 for(let i=0;i<counts.ice;i++)rect(ctx,2+i*8,h-22-i*8,12,12,3,'#d1ffffbf');
 ctx.restore();glass();ctx.strokeStyle='#e4f7da';ctx.lineWidth=3;ctx.stroke();line(ctx,[[-w*.38,8],[-w*.31,h*.77]],'#ffffff96',2);
 for(let i=1;i<=9;i++)line(ctx,[[w*.35,h-h*.092*i],[w*.44,h-h*.092*i]],'#fff8dbb3',1.4);
 ellipse(ctx,0,1,w*.5,4,'#d1efe480');
 if(h>110&&face?.naturalWidth){ctx.save();ctx.beginPath();ctx.arc(0,h*.50,21,0,Math.PI*2);ctx.clip();ctx.fillStyle='#ffdfaa';ctx.fillRect(-23,h*.5-23,46,46);ctx.drawImage(face,-20,h*.5-20,40,40);ctx.restore();}
 ctx.restore();
}
function ingredient(ctx,v){
 if(v.type==='pearl'){ellipse(ctx,v.x,v.y,9,9,'#3d293d');ellipse(ctx,v.x-3,v.y-3,2.5,2.5,'#b98e92');}
 if(v.type==='star')label(ctx,'★',v.x,v.y,25,'#ffcf53','center');
 if(v.type==='ice'){ctx.save();ctx.translate(v.x,v.y);ctx.rotate(.22);rect(ctx,-9,-9,18,18,4,'#bfe8ef');line(ctx,[[-6,4],[-6,-6],[4,-6]],'#fff5d8',2);ctx.restore();}
}
export function taste(tea,milk,caught,r){
 if(tea+milk<.25)return 0;
 const blend=Math.max(0,52-12*(Math.abs(tea-r.tea)+Math.abs(milk-r.milk)));
 const chew=Math.max(0,30-9*Math.abs(caught.pearls-r.pearls));
 const garnish=Math.max(0,18-12*Math.abs(caught.star-r.star)-6*caught.ice);
 return Math.round(blend+chew+garnish);
}
export default {
 title:'BOBA BREAK',tagline:'“the recipe is personal. so is my pearl-to-tea ratio.”',
 instructions:[['Open the taps','Hold tea or milk to add the number of measures on her receipt. Release a little early.'],['Catch the toppings','Hit Shake. Slide the cup under brown pearls and requested gold stars. Dodge the blue ice.'],['Cap the drink','Serve when the receipt is filled. Four drinks earn her verdict.']],
 keys:[['Hold A / D','Tea / milk'],['← / →','Shift cup'],['Space','Shake / serve']],touch:[['Hold tap','Pour'],['Slide or tap lane','Catch'],['Shake / cap','Finish']],
 create(api){
  let course=0,t=0,phase='pour',tea=0,milk=0,flow=[0,0],held=new Set(),targetX=240,cupX=240,items=[],drop=0,dropNo=0,age=0,score=0,good=0,review=0,note='',touchValve=-1,auto=0,done=false,flash=0;
  let caught={pearls:0,star:0,ice:0};
  const order=[0,...(api.rng()<.5?[1,2]:[2,1]),3],offset=Math.floor(api.rng()*3);
  const recipe=()=>recipes[order[Math.min(course,3)]];
  function sync(){api.hud('Ticket',Math.min(course+1,4)+'/4','Tips',score);}
  function serving(){
   if(done||review)return;const r=recipe();
   if(phase==='pour'){phase='catch';age=0;drop=0;dropNo=0;flow=[0,0];touchValve=-1;api.sound('drop');return;}
   const n=taste(tea,milk,caught,r);score+=n;if(n>=84)good++;
   note=n>=84?'“i would cross town for this.”':Math.abs(tea-r.tea)+Math.abs(milk-r.milk)>2?'“a little heavy on the pour, babe.”':caught.ice?'“cold! that was an ice cube.”':'“love the effort. count the toppings.”';
   phase='review';review=1.5;api.sound(n>=84?'clear':'pop');api.haptic(14);sync();
  }
  function advance(){if(++course===4){done=true;api.end(score,[['House specials',good+' / 4'],['Drinks served',4]],good>=3?'“i’m keeping your name on the menu.”':'“same time tomorrow? i’ll bring the pearls.”');return;}
   phase='pour';tea=0;milk=0;flow=[0,0];touchValve=-1;held.clear();cupX=240;targetX=240;items=[];caught={pearls:0,star:0,ice:0};age=0;sync();}
  function spawn(){const pattern=['pearl','ice','pearl','star','pearl','ice','pearl','star'];const lane=(offset+dropNo*2+Math.floor(dropNo/3)+course)%3;
   items.push({type:pattern[dropNo%8],x:lanes[lane],y:121,v:132+course*9});dropNo++;}
  function setLane(dir){const near=lanes.reduce((best,x,i)=>Math.abs(x-targetX)<Math.abs(lanes[best]-targetX)?i:best,0);targetX=lanes[clamp(near+dir,0,2)];}
  sync();
  return {
   cancelInput(){held.clear();touchValve=-1;},
   key(type,code){if(type==='up'){held.delete(code);return;}if(done||review)return;held.add(code);
    if(code==='Space'||code==='Enter')serving();if(phase==='catch'&&code==='ArrowLeft')setLane(-1);if(phase==='catch'&&code==='ArrowRight')setLane(1);},
   pointer(type,x,y){if(type==='up'||type==='cancel'){touchValve=-1;return;}if(done||review)return;
    if(type==='down'&&y>=408&&x>=316){serving();return;}
    if(phase==='pour'&&type==='down'&&y>=408)touchValve=x<158?0:1;
    if(phase==='catch'&&y>=110&&y<403)targetX=clamp(x,62,418);
    if(phase==='catch'&&type==='down'&&y>=408&&x<316)setLane(x<158?-1:1);},
   demo(dt){if(done||review)return;const r=recipe();
    if(phase==='pour'){if(tea<r.tea-.35)touchValve=0;else if(milk<r.milk-.35)touchValve=1;else{touchValve=-1;auto+=dt;if(auto>.55){auto=0;serving();}}}
    else{const next=items.find(v=>v.y<339);if(next){const want=next.type==='pearl'?caught.pearls<r.pearls:next.type==='star'?caught.star<r.star:false;targetX=want?next.x:lanes.find(x=>Math.abs(x-next.x)>150)||90;}
      if(caught.pearls>=r.pearls&&caught.star>=r.star)serving();}},
   update(dt){if(done)return;t+=dt;flash=Math.max(0,flash-dt);if(review>0){review=Math.max(0,review-dt);if(!review)advance();return;}age+=dt;
    if(phase==='pour'){for(let j=0;j<2;j++){const pouring=touchValve===j||held.has(j?'KeyD':'KeyA');flow[j]+=(Number(pouring)*2.35-flow[j])*(1-Math.exp(-dt*(pouring?7:8)));
      const added=Math.min(flow[j]*dt,Math.max(0,10-tea-milk));if(j)milk+=added;else tea+=added;}
      if(age>=24)serving();return;}
    cupX+=(targetX-cupX)*(1-Math.exp(-dt*15));drop-=dt;if(drop<=0){spawn();drop=.96-course*.055;}
    for(const item of items){item.y+=item.v*dt;item.v+=18*dt;if(item.y>=322&&item.y<352&&!item.used&&Math.abs(item.x-cupX)<43){item.used=true;caught[item.type==='pearl'?'pearls':item.type==='star'?'star':'ice']++;flash=.28;api.sound(item.type==='ice'?'hit':'pop');}}
    items=items.filter(v=>!v.used&&v.y<394);if(age>=13)serving();
   },
   draw(ctx){
    const r=recipe();sky(ctx,'#3c756a','#153d3a');
    for(let j=0;j<15;j++)rect(ctx,j*36,-1,18,31,0,j%2?'#ffd5ad':'#87b8a0');
    rect(ctx,0,29,480,7,0,'#173d37');rect(ctx,12,43,456,62,10,'#f8e8c6');label(ctx,r.name,26,65,24,'#344d40','left','Georgia',900);
    label(ctx,'AGI-1  /  '+String(course+1).padStart(2,'0'),452,62,13,'#736444','right','monospace');label(ctx,'Tea '+r.tea+'   Milk '+r.milk+'     ● '+r.pearls+' pearls    ★ '+r.star,26,90,16,'#514f40','left','monospace');
    if(phase==='pour'){
      rect(ctx,14,120,206,218,9,'#f1d6ac');if(chef?.naturalWidth){ctx.save();ctx.beginPath();ctx.roundRect(20,126,194,206,6);ctx.clip();ctx.drawImage(chef,75,0,595,680,20,126,194,206);ctx.restore();}
      rect(ctx,22,304,190,27,3,'#345448ed');label(ctx,'AGI-1  /  TEA BAR',117,319,14,'#fff4cd','center','monospace');
      for(let j=0;j<2;j++){const x=310+j*62;rect(ctx,x-15,120,30,31,5,j?r.cream:r.ink);rect(ctx,x-5,145,10,15,2,'#d7cfb4');if(flow[j]>.08)line(ctx,[[x,157],[x+Math.sin(t*9)*1.2,292]],j?r.cream:r.ink,2+flow[j]*1.5);}
      drawGlass(ctx,341,335,118,153,tea,milk,r,caught,t);
      label(ctx,'“'+r.line+'”',240,361,16,'#fff4cd','center','Georgia');
      label(ctx,'TEA  '+tea.toFixed(1)+' / '+r.tea+'     MILK  '+milk.toFixed(1)+' / '+r.milk,240,389,17,'#ffdda5','center','monospace');
    }else{
      rect(ctx,16,118,448,246,12,'#23574f');for(let lane=0;lane<3;lane++){const x=lanes[lane];line(ctx,[[x,144],[x,355]],'#438576',2);rect(ctx,x-26,116,52,16,5,'#c0cbb0');ellipse(ctx,x,131,15,4,'#173e3a');}
      for(const v of items)ingredient(ctx,v);
      if(flash)ellipse(ctx,cupX,325,49,7,'#ffe4a08c');
      drawGlass(ctx,cupX,373,100,50,tea,milk,r,caught,t);
      label(ctx,phase==='review'?note:'●  '+caught.pearls+'/'+r.pearls+'      ★  '+caught.star+'/'+r.star+'      ICE  '+caught.ice,240,391,phase==='review'?16:18,'#fff0cb','center',phase==='review'?'Georgia':'monospace');
    }
    for(let j=0;j<3;j++){const x=10+j*156;rect(ctx,x,412,147,55,12,j===2?'#f4d79e':j===0?'#985f4b':'#e9d5ad');label(ctx,phase==='pour'?['HOLD TEA','HOLD MILK','SHAKE →'][j]:['←  LEFT','RIGHT  →','CAP  ✓'][j],x+74,440,18,j===0?'#fff4d6':'#344a40','center','monospace',900);}
   },
  };
 },
};
