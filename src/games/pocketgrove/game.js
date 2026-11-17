import { TAU, clamp, ellipse, line, shape, rect, label, sky } from '../kit/garden-art.js';

const fruitNames=['Plum','Pear','Citrus'];
const fruitColors=['#945d91','#cfd96c','#f5a34f'];
const seasons=[
  {name:'SPRING',top:'#afd5c9',bottom:'#e6e9bf',leaves:['#719a72','#86ac72','#a3be83'],grass:'#b1cb85'},
  {name:'SUMMER',top:'#a6cecb',bottom:'#efe1b6',leaves:['#487d60','#689658','#86ad64'],grass:'#a8bc71'},
  {name:'AUTUMN',top:'#d3c3b5',bottom:'#f1ddac',leaves:['#bb7552','#d39459','#dda361'],grass:'#c9ad71'},
  {name:'WINTER',top:'#afc6cc',bottom:'#e5dfca',leaves:['#6f8d82','#8fa99b','#b0c2aa'],grass:'#c8d1b4'},
];
const sites=[[153,226],[322,205],[98,306],[283,298]];
const tools=['Water','Graft','Pick'];
const totalDays=20;

function fruit(ctx,x,y,k,s=1){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 if(k===1){
   ellipse(ctx,0,3,5.8,6.5,fruitColors[k]);ellipse(ctx,1,-1.4,3.7,5.4,fruitColors[k],.1);
 }else ellipse(ctx,0,2,k===0?5.7:6.1,k===0?6.8:5.8,fruitColors[k],-.15);
 line(ctx,[[0,-3],[1,-7]],'#625140',1.4);
 ellipse(ctx,3,-5.7,2.5,1.3,'#5f895b',-.4);
 ellipse(ctx,-2.2,-.5,1.2,2.1,'#f6e5b7',.35);
 ctx.restore();
}
function tree(ctx,tree,i,t,season,selected){
 const [x,ground]=sites[i],y=ground-7;
 const crown=[[0,-62,23],[-22,-50,21],[23,-50,21],[-11,-74,17],[13,-70,19]];
 ellipse(ctx,x+4,ground+3,39,10,'rgba(79,85,49,.20)',-.1);
 if(selected){
   ctx.strokeStyle='#f9edba';ctx.lineWidth=2.2;ctx.beginPath();ctx.ellipse(x,ground,41,13,-.06,0,TAU);ctx.stroke();
 }
 shape(ctx,[[x-6,y+2],[x-3,y-35],[x-13,y-56],[x-8,y-61],[x+2,y-42],[x+15,y-62],[x+19,y-59],[x+5,y-31],[x+7,y+2]],'#795c46');
 line(ctx,[[x-1,y-3],[x+1,y-29],[x-6,y-43]],'#a57c60',1.6);
 const sway=Math.sin(t*.86+i)*1.1;
 crown.forEach(([bx,by,r],j)=>{
   ellipse(ctx,x+bx+sway,y+by,r,r*.86,season.leaves[j%3]);
   for(let n=0;n<7;n++){
     const a=n*TAU/7+i,dx=bx+Math.cos(a)*r*.74,dy=by+Math.sin(a)*r*.56;
     ellipse(ctx,x+dx+sway,y+dy,4,2.1,season.leaves[(j+n+1)%3],a*.5);
   }
 });
 if(tree.scion!==null){
   line(ctx,[[x+8,y-39],[x+18,y-48],[x+28,y-51]],'#846647',2.7);
   line(ctx,[[x+13,y-42],[x+16,y-38]],'#edc697',3.6);
 }
 const slots=[[-21,-53],[15,-60],[1,-80],[27,-43],[-9,-62]];
 tree.ripe.forEach((k,n)=>fruit(ctx,x+slots[n][0]+sway,y+slots[n][1],k,1.12));
 if(!tree.ripe.length){
   for(let j=0;j<3;j++){
     const [bx,by]=slots[j];for(let n=0;n<5;n++){
       const a=n*TAU/5;ellipse(ctx,x+bx+Math.cos(a)*2.4+sway,y+by+Math.sin(a)*2.4,2.4,2,'#efdbc8');
     }
   }
 }
}
export default {
 title:'POCKET GROVE',tagline:'Tend four little trees and fill fruit baskets before the year ends.',
 instructions:[
   ['One day, one action','Choose Water, Graft, or Pick, then choose a tree. You have five days in each of four seasons.'],
   ['Keep branches growing','Water restores one tree and splashes nearby roots. Rain waters the whole orchard. Dry trees stop growing.'],
   ['Fill the fruit baskets','Picking takes all ripe fruit. Graft the nursery variety onto a tree to grow mixed pairs. Complete the basket above for a bonus.'],
 ],
 keys:[['Q / W / E','Choose Water, Graft, or Pick'],['1 / 2 / 3 / 4','Use the tool on that tree']],
 touch:[['Tap a tool, then a tree','Spend a day in the orchard']],
 create(api){
   const trees=[0,1,2,0].map((base,i)=>({base,scion:null,water:2,growth:i%2,ripe:i<3?[base]:[]}));
   const stock=[0,0,0];let demand=[1,1,1];
   let day=0,harvest=0,points=0,boxes=0,ended=false,tool=2,last=-1,t=0,aiWait=1.4;
   let weather='Rain',scion=2,report='Pick ripe fruit for the market basket',reportAt=-1;
   const seasonIndex=()=>Math.min(3,Math.floor(day/5));
   function tally(){
     if(demand.every((n,k)=>stock[k]>=n)){
       demand.forEach((v,i)=>stock[i]-=v);
       boxes++;points+=120;report='Basket packed  +120';
       demand=[1,1,1];demand[Math.floor(api.rng()*3)]+=1;
       if(boxes%2===0){demand[(boxes+1)%3]++;demand[boxes%3]--;}
       return true;
     }
     return false;
   }
   function grow(){
     const s=seasonIndex();
     trees.forEach(a=>{
       if(weather==='Rain') a.water=Math.min(3,a.water+1);
       if(a.water<=0)return;
       a.growth+=s===2?1.6:s===3?.72:1.12;
       if(a.growth>=2){
         a.growth-=2;
         if(a.ripe.length<5)a.ripe.push(a.base);
         if(a.scion!==null&&a.ripe.length<5)a.ripe.push(a.scion);
       }
       if(weather==='Dry'||(day%2===1&&weather!=='Rain'))a.water=Math.max(0,a.water-1);
     });
   }
   function act(i){
     if(ended||i<0||i>=4)return;
     const a=trees[i];last=i;reportAt=t;
     if(tool===2){
       if(a.ripe.length===0){report='Still flowering · pick another tree';api.sound('back');return;}
       const plucked=a.ripe.length;
       a.ripe.forEach(k=>stock[k]++);a.ripe=[];points+=plucked*14;harvest+=plucked;
       report='Picked '+plucked+(plucked===1?' fruit':' fruits')+'  +'+plucked*14;
       api.sound(tally()?'combo':'pop');
     }else if(tool===1){
       if(scion===a.base||scion===a.scion){report='Choose a tree of a different variety';api.sound('back');return;}
       a.scion=scion;
       report='Grafted '+fruitNames[scion].toLowerCase()+' onto tree '+(i+1);
       api.sound('merge');
     }else{
       a.water=3;
       for(let j=0;j<trees.length;j++){
         if(j!==i && Math.hypot(sites[j][0]-sites[i][0],sites[j][1]-sites[i][1])<190) trees[j].water=Math.min(3,trees[j].water+1);
       }
       report='Watered tree '+(i+1)+' and nearby roots';api.sound('drop');
     }
     api.haptic(10);
     grow();day++;
     if(day>=totalDays){
       ended=true;api.end(points,[['Baskets filled',boxes],['Fruit picked',harvest],['Mixed trees',trees.filter(a=>a.scion!==null).length]],'a whole year in the palm of your hand.');
     }else{
       const s=seasonIndex();
       weather=api.rng()<(s===0?.5:s===1?.13:.34)?'Rain':s===1||api.rng()<.33?'Dry':'Mild';
       scion=Math.floor(api.rng()*3);
     }
     hud();
   }
   function hud(){api.hud('Baskets',boxes,'Day',Math.min(totalDays,day+1)+'/'+totalDays);}
   hud();
   function draw(ctx){
     const s=seasons[seasonIndex()];
     sky(ctx,s.top,s.bottom,356);
     // Small distant hills and an isometric cutaway of the orchard soil.
     for(let i=0;i<8;i++)ellipse(ctx,i*82-30,157+Math.sin(i)*14,92,50,'rgba(131,163,137,.40)');
     shape(ctx,[[8,255],[285,127],[469,211],[468,249],[168,368],[10,296]],'#906d54');
     shape(ctx,[[8,255],[169,329],[169,368],[10,296]],'#ab805b');
     for(let j=0;j<43;j++){
       const x=22+(j*57)%138,y=264+(x-22)*.43+(j%3)*6;
       line(ctx,[[x,y+8],[x+3,y+10]],'#c0966a',1.6);
     }
     shape(ctx,[[8,252],[282,126],[470,211],[168,336]],s.grass);
     shape(ctx,[[8,252],[168,329],[470,211],[470,217],[168,341],[8,261]],'#859762');
     for(let i=0;i<63;i++){
       const a=(i*47%101)/100,b=(i*57%103)/102;
       const x=14+a*263+b*163,y=253-a*119+b*74;
       line(ctx,[[x-2,y],[x,y+2],[x+2,y-1]],'#92a973',1.2);
     }
     [1,0,3,2].forEach(i=>tree(ctx,trees[i],i,t,s,last===i));
     // Paint the number plates last so a foreground crown never hides a key or water level.
     sites.forEach(([x,y],i)=>{
       rect(ctx,x-33,y+7,66,23,11,'#354e40');
       label(ctx,String(i+1),x-20,y+19,15,'#fff1d2','center');
       for(let j=0;j<3;j++)ellipse(ctx,x-5+j*11,y+19,3.6,4.7,trees[i].water>j?'#97d1c6':'#637766');
     });
     if(weather==='Rain'){
       for(let i=0;i<22;i++){
         const x=(i*57-t*10)%490,y=74+((i*89+t*79)%255);
         line(ctx,[[x,y],[x-2,y+5]],'rgba(244,251,225,.5)',1.2);
       }
     }
     rect(ctx,0,0,480,74,0,'#354f43');
     label(ctx,s.name+'   '+(day%5+1)+'/5',16,22,17,'#fff1d0');
     label(ctx,weather==='Rain'?'Rain waters all trees':weather==='Dry'?'Dry · roots lose water':'Mild weather',16,50,16,'#d7dfba');
     label(ctx,'MARKET BASKET',304,18,15,'#eee4c4');
     demand.forEach((n,k)=>{
       const x=295+k*59;fruit(ctx,x,46,k,.94);
       label(ctx,Math.min(n,stock[k])+'/'+n,x+9,48,15,stock[k]>=n?'#cde99e':'#f7e7cc');
     });
     rect(ctx,0,367,480,113,0,'#f4e5bf');
     label(ctx,report,240,386,16,'#3c5141','center','Georgia');
     for(let i=0;i<3;i++){
       const x=12+i*155,active=tool===i;
       rect(ctx,x,407,147,55,11,active?'#3e5c47':'#ded4af');
       label(ctx,['Q','W','E'][i]+'  '+tools[i],x+73,426,18,active?'#fff1d1':'#3d5142','center');
       label(ctx,['Restore roots',fruitNames[scion]+' scion','Gather fruit'][i],x+73,448,15,active?'#d6e8b9':'#536149','center');
     }
   }
   return {draw,update(dt){t+=dt;if(reportAt>=0&&t-reportAt>3.3){report=['Choose a tree to water','Add '+fruitNames[scion].toLowerCase()+' to a different tree','Choose a tree with ripe fruit'][tool];reportAt=-1;}},
     pointer(type,x,y){
       if(type!=='down'||ended)return;
       if(y>=406&&y<=465){tool=clamp(Math.floor(x/158),0,2);reportAt=t-3.2;api.sound('select');return;}
       if(y<82||y>353)return;
       const nearest=sites.map(([px,py],i)=>({i,d:Math.hypot((px-x)/48,(py-39-y)/65)})).sort((a,b)=>a.d-b.d)[0];
       if(nearest.d<1.15)act(nearest.i);
     },
     key(type,code){
       if(type!=='down'||ended)return;
       if(['KeyQ','KeyW','KeyE'].includes(code)){tool=['KeyQ','KeyW','KeyE'].indexOf(code);reportAt=t-3.2;api.sound('select');}
       if(/^Digit[1234]$/.test(code))act(Number(code.slice(-1))-1);
     },
     demo(dt){
       aiWait-=dt;if(aiWait>0||ended)return;
       let choice=0,move=2,best=-1;
       trees.forEach((a,i)=>{
         const pick=a.ripe.reduce((n,k)=>n+(stock[k]<demand[k]?1.55:1),0);
         const graft=a.scion===null&&scion!==a.base&&day<11?3.6:0;
         const water=(a.water===0?3.1:a.water===1?1.2:0)+(weather==='Dry'?.35:0);
         for(const [mode,val] of [[2,pick],[1,graft],[0,water]]){
           if(val>best){best=val;choice=i;move=mode;}
         }
       });
       if(move===2 && !trees[choice].ripe.length)move=0;
       tool=move;act(choice);aiWait=1.45;
     },
   };
 },
};
