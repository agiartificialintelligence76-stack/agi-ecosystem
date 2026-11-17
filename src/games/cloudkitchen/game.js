import { TAU, clamp, ellipse, line, shape, rect, label, sky } from '../kit/garden-art.js';

const food = ['Egg','Bao','Noodles'];
const cooks = [3.1,5.5,4.2];
const recipes = [
  {name:'Sunrise bun',needs:[0,1]}, {name:'Golden bowl',needs:[0,2]},
  {name:'Cloud lunch',needs:[1,2]}, {name:'House trio',needs:[0,1,2]},
  {name:'Double bao',needs:[1,1]}, {name:'Egg nest',needs:[2,0]},
];
function ingredient(ctx,k,x,y,s=1){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  if(k===0){
    const p=Array.from({length:30},(_,i)=>{
      const a=i*TAU/30,r=1+.12*Math.cos(a*3)+.06*Math.sin(a*5);
      return [Math.cos(a)*20*r,Math.sin(a)*13*r];
    });
    shape(ctx,p,'#fff0be');ellipse(ctx,3,-1,8,7,'#ffa438');
    ellipse(ctx,1,-4,3,1.6,'#ffda74');
  }else if(k===1){
    ctx.fillStyle='#fee2b9';ctx.beginPath();ctx.moveTo(-19,6);
    ctx.bezierCurveTo(-24,-4,-10,-11,-1,-18);ctx.bezierCurveTo(2,-12,24,-6,19,6);
    ctx.bezierCurveTo(17,16,-16,16,-19,6);ctx.fill();
    for(let i=-1;i<=1;i++){
      ctx.strokeStyle='#c89478';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,-13);
      ctx.quadraticCurveTo(i*12,-4,i*9,4);ctx.stroke();
    }
  }else{
    ellipse(ctx,0,2,21,11,'#af6337');
    for(let j=0;j<7;j++){
      ctx.strokeStyle=j%2?'#ffaa4a':'#f8c86e';ctx.lineWidth=2.4;
      ctx.beginPath();ctx.ellipse(Math.sin(j)*5,1+(j%3)-1,12+(j%3)*2,4+j%3,(j-3)*.17,0,TAU);ctx.stroke();
    }
    [[7,-5],[-7,1],[12,4],[-2,-2]].forEach(([x,y])=>line(ctx,[[x-2,y+1],[x+2,y-1]],'#448675',2.4));
  }
  ctx.restore();
}
function steam(ctx,x,y,t,heat){
  for(let i=0;i<3;i++){
    const phase=(t*.48+i/3)%1;
    ctx.save();ctx.globalAlpha=Math.sin(phase*Math.PI)*heat;
    ctx.strokeStyle='#fff1d6';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x+(i-1)*10,y-phase*31);
    ctx.bezierCurveTo(x+(i-1)*10-6,y-5-phase*31,x+(i-1)*10+6,y-8-phase*31,x+(i-1)*10,y-14-phase*31);ctx.stroke();ctx.restore();
  }
}
export default {
 title:'CLOUD KITCHEN',tagline:'Three burners, a rail full of tickets, and one very short lunch rush.',
 instructions:[
   ['Read the tickets','Each ticket shows the ingredients it still needs. Egg, bao, and noodles cook at different speeds.'],
   ['Work the burners','Tap a station to cook. Tap again in the green SERVE window to send its food to the earliest matching ticket.'],
   ['Keep the line moving','Complete tickets before their timers run out. Finish several in a row for a service bonus.'],
 ],
 keys:[['1 / 2 / 3','Start or serve egg, bao, or noodles']],touch:[['Tap a burner','Start cooking or serve']],
 create(api){
   const pans=[-1,-1,-1], orders=[], effects=[];
   let t=0,score=0,served=0,burnt=0,missed=0,chain=0,ended=false,cooldown=0,aiWait=.15,ticket=0,note='Start the ingredients on the tickets';
   function order(first=false){
     const index=first ? (ticket===0?0:2) : Math.floor(api.rng()*recipes.length);
     const r=recipes[index], total=(t<18?24:21)+(r.needs.length-2)*3;
     orders.push({name:r.name, needs:[...r.needs], done:r.needs.map(()=>false), life:total, total, id:++ticket});
   }
   order(true);order(true);
   function wanted(k){
     return [...orders].sort((a,b)=>a.life-b.life).find(o=>o.needs.some((n,i)=>n===k&&!o.done[i]));
   }
   function station(k){
     if(ended)return;
     const elapsed=pans[k];
     if(elapsed<0){pans[k]=0;api.sound('tap');return;}
     if(elapsed<cooks[k]){
       note=food[k]+' needs another moment';cooldown=1.4;return;
     }
     if(elapsed>cooks[k]+2.45) return;
     const o=wanted(k);
     if(!o){note='No ticket needs '+food[k].toLowerCase()+' yet';cooldown=1.5;return;}
     const index=o.needs.findIndex((n,i)=>n===k&&!o.done[i]);
     const dest=orders.indexOf(o);
     o.done[index]=true;pans[k]=-1;
     effects.push({k,x:82+158*k,to:orders.length===2?124+232*dest:83+158*dest,age:0});
     api.haptic(12);api.sound('pop');
     score+=20;
     if(o.done.every(Boolean)){
       chain++;served++;
       const gain=75+Math.round(o.life*2)+Math.min(chain,6)*8;
       score+=gain;note=o.name+' served  +'+gain;cooldown=2.2;
       api.sound('combo');orders.splice(dest,1);order();
     }else{note=food[k]+' plated';cooldown=1.1;}
   }
   function update(dt){
     if(ended)return;t+=dt;cooldown-=dt;
     for(let i=0;i<3;i++){
       if(pans[i]===-1)continue;
       pans[i]+=dt;
       if(pans[i]>cooks[i]+3.5){pans[i]=-1;burnt++;chain=0;api.sound('drop');note=food[i]+' scorched';cooldown=1.5;}
     }
     if(t>17&&orders.length<3) order();
     for(let i=orders.length-1;i>=0;i--){
       const o=orders[i];o.life-=dt;
       if(o.life<=0){orders.splice(i,1);missed++;chain=0;order();note='Ticket timed out';cooldown=1.5;}
     }
     for(let i=effects.length-1;i>=0;i--){
       effects[i].age+=dt;if(effects[i].age>.48)effects.splice(i,1);
     }
     api.hud('Served',served,'Shift',Math.ceil(Math.max(0,65-t))+'s');
     if(t>=65){ended=true;api.end(score,[['Tickets served',served],['Scorched pans',burnt],['Expired tickets',missed]],'last bowl’s for the cook.');}
   }
   function draw(ctx){
     sky(ctx,'#a9c8bf','#f3dfba',283);
     for(let i=0;i<15;i++){
       const x=(i*91)%535-30,y=172+(i%3)*17;
       ellipse(ctx,x,y,36,13,'rgba(250,243,213,.36)');
       ellipse(ctx,x+12,y-8,23,16,'rgba(250,243,213,.36)');
     }
     rect(ctx,0,0,480,35,0,'#395b58');
     label(ctx,'CLOUD KITCHEN',15,18,17,'#fff4d8','left','Georgia');
     label(ctx,'LUNCH SERVICE',465,18,15,'#e9f1d3','right');
     line(ctx,[[0,54],[480,54]],'#446760',5);
     const width=orders.length===2?216:145, space=orders.length===2?232:158;
     orders.forEach((o,i)=>{
       const x=10+i*space;
       rect(ctx,x+3,62,width,100,3,'rgba(59,78,67,.18)');
       rect(ctx,x,59,width,100,3,'#fff4d8');
       for(let j=0;j<Math.floor(width/12);j++)shape(ctx,[[x+j*12,158],[x+j*12+6,164],[x+j*12+12,158]],'#fff4d8');
       rect(ctx,x+width/2-5,47,10,19,3,'#bd7f64');
       label(ctx,o.name,x+width/2,82,orders.length===2?19:16,'#334746','center','Georgia');
       o.needs.forEach((k,n)=>{
         const cx=x+width/2+(n-(o.needs.length-1)/2)*35;
         ctx.save();ctx.globalAlpha=o.done[n]?.34:1;ingredient(ctx,k,cx,112,.72);ctx.restore();
         if(o.done[n])line(ctx,[[cx-6,111],[cx-2,116],[cx+7,105]],'#295b47',3);
       });
       rect(ctx,x+9,141,width-18,5,2.5,'#dbcfad');
       rect(ctx,x+9,141,Math.max(1,(width-18)*o.life/o.total),5,2.5,o.life<6?'#c45b4f':'#639f88');
     });
     // Perspective tiled counter and three individual burners.
     shape(ctx,[[0,246],[480,246],[480,385],[0,385]],'#c4a587');
     for(let i=-2;i<11;i++)line(ctx,[[60*i,246],[60*i+(i-4)*13,385]],'#b89476',1.4);
     for(const y of [273,313,371])line(ctx,[[0,y],[480,y]],'#b89476',1.4);
     rect(ctx,0,374,480,106,0,'#365752');
     pans.forEach((v,k)=>{
       const x=82+k*158,ready=v>=cooks[k]&&v<=cooks[k]+2.45,scorch=v>cooks[k]+2.45;
       const active=v!==-1;
       ellipse(ctx,x+4,321,62,20,'rgba(63,63,52,.27)');
       ellipse(ctx,x,315,62,23,'#3a5050');
       ellipse(ctx,x,310,54,17,active?'#f2a754':'#62736b');
       if(active){
         for(let j=0;j<9;j++){
           const a=j*Math.PI/8;
           ellipse(ctx,x+Math.cos(a)*49,305+Math.sin(a)*10,3,4+2*Math.sin(t*7+j),'#ffca65');
         }
       }
       if(k===1){
         ellipse(ctx,x,291,51,23,'#98674d');rect(ctx,x-51,278,102,14,1,'#b98259');
         ellipse(ctx,x,278,51,21,'#d3a270');ellipse(ctx,x,278,44,15,'#ac7958');
         for(let n=0;n<7;n++)line(ctx,[[x-30+n*9,273],[x-34+n*9,284]],'#ce9c70',2);
       }else{
         line(ctx,[[x+33,292],[x+58,274]],'#334648',8);
         ellipse(ctx,x,290,52,23,'#334648');
         ellipse(ctx,x,286,52,21,'#657576');ellipse(ctx,x,286,46,16,'#465959');
       }
       if(active){
         ctx.save();ctx.globalAlpha=scorch?.53:1;
         ingredient(ctx,k,x,279-Math.sin(t*5+k)*(ready?1:2),1.15);ctx.restore();
         steam(ctx,x,263,t+k,.45+clamp(v/cooks[k],0,1)*.45);
       }else ingredient(ctx,k,x,252,.62);
       label(ctx,food[k],x,347,21,'#413f36','center','Georgia');
       if(active){
         rect(ctx,x-47,361,94,6,3,'#8c8067');
         rect(ctx,x-47,361,Math.max(2,94*clamp(v/cooks[k],0,1)),6,3,ready?'#416d50':'#f8e4a1');
       }
       rect(ctx,x-68,415,136,48,12,ready?'#d7ecae':scorch?'#8d675b':'#f2dfb3');
       const text=scorch?'Scorched':ready?'SERVE':active?'Cooking…':'Cook';
       label(ctx,(k+1)+'  '+text,x,440,18,scorch?'#fff2db':'#385449','center');
     });
     label(ctx,cooldown>0?note:'Match the tickets before the timer runs out',240,392,16,'#f5e7c5','center');
     effects.forEach(e=>{
       const f=e.age/.48;
       ingredient(ctx,e.k,e.x+(e.to-e.x)*f,273-158*f-Math.sin(f*Math.PI)*50,.65);
     });
   }
   return {update,draw,
     key(type,code){if(type==='down'&&/^Digit[123]$/.test(code))station(Number(code.slice(-1))-1);},
     pointer(type,x,y){if(type==='down'&&y>=227&&y<=468)station(clamp(Math.floor(x/160),0,2));},
     demo(dt){
       aiWait-=dt;if(aiWait>0||ended)return;
       for(let i=0;i<3;i++){
         if(wanted(i)&&(pans[i]<0||(pans[i]>=cooks[i]+.15&&pans[i]<cooks[i]+2.4))){station(i);aiWait=.38;return;}
       }
     },
   };
 },
};
