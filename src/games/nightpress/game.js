import { TAU, ellipse, rect, line, shape, label } from '../kit/garden-art.js';

const orders=[
  {name:'Lunar transit',series:'ORBITAL / 01',inks:['#39a9b6','#ff6c63']},
  {name:'After the rain',series:'BOTANICA / 02',inks:['#499c93','#eb6978']},
  {name:'Open water',series:'PELAGIC / 03',inks:['#51a8ca','#ed8855']},
  {name:'Daybreak',series:'ALMANAC / 04',inks:['#e2a62c','#e85e70']},
  {name:'Night flight',series:'NOCTURNE / 05',inks:['#7878bb','#ed738a']},
];
function cross(ctx,x,y,col,scale=1){
  line(ctx,[[x-8*scale,y],[x+8*scale,y]],col,1.5);
  line(ctx,[[x,y-8*scale],[x,y+8*scale]],col,1.5);
  ctx.strokeStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,4.3*scale,0,TAU);ctx.stroke();
}
function rays(ctx,r1,r2,col,n,tilt=0){
  for(let i=0;i<n;i++){
    const a=i*TAU/n+tilt;
    line(ctx,[[Math.cos(a)*r1,Math.sin(a)*r1],[Math.cos(a)*r2,Math.sin(a)*r2]],col,1.6);
  }
}
function plate(ctx,edition,layer,c){
  if(edition===0){
    if(layer===0){
      ellipse(ctx,0,-3,53,53,c);
      for(let j=0;j<22;j++) ellipse(ctx,Math.cos(j*2.3)*84,Math.sin(j*2.3)*53,1+j%3,1+j%3,c);
    }else{
      ctx.save();ctx.rotate(-.46);ctx.strokeStyle=c;ctx.lineWidth=12;
      ctx.beginPath();ctx.ellipse(0,0,83,23,0,0,TAU);ctx.stroke();
      line(ctx,[[-73,7],[-47,18],[-2,23],[34,20],[73,10]],c,2);ctx.restore();
      ellipse(ctx,48,-48,12,12,c);
    }
  }else if(edition===1){
    if(layer===0){
      line(ctx,[[12,59],[1,12],[-13,-18]],c,4);
      ellipse(ctx,24,23,29,11,c,-.65);
      ellipse(ctx,-17,29,30,10,c,.44);
      ellipse(ctx,37,-3,23,9,c,-.71);
      for(let i=0;i<13;i++)line(ctx,[[-70+i*11,63],[-64+i*11,59]],c,1.3);
    }else{
      for(let i=0;i<8;i++){
        const a=i*TAU/8;
        ellipse(ctx,-12+Math.cos(a)*23,-20+Math.sin(a)*23,23,10,c,a);
      }
      ellipse(ctx,-12,-20,13,13,c);
      ellipse(ctx,47,-28,10,14,c,-.5);
    }
  }else if(edition===2){
    if(layer===0){
      ellipse(ctx,0,-2,58,28,c,-.13);
      shape(ctx,[[-39,-4],[-79,-25],[-75,19]],c);
      shape(ctx,[[-14,-20],[3,-44],[24,-21]],c);
      for(let i=0;i<13;i++)line(ctx,[[-80+i*12,44],[-73+i*12,41]],c,2);
    }else{
      ctx.save();ctx.rotate(-.13);
      for(let i=0;i<5;i++){
        const x=-29+i*13;
        shape(ctx,[[x,-24],[x+12,-26],[x+1,25],[x-7,21]],c);
      }
      ellipse(ctx,39,-6,3,3,c);ctx.restore();
      for(let i=0;i<5;i++){
        ctx.strokeStyle=c;ctx.lineWidth=1.8;ctx.beginPath();
        ctx.arc(53+(i%2)*12,-21-i*7,2+(i%3),0,TAU);ctx.stroke();
      }
    }
  }else if(edition===3){
    if(layer===0){
      ellipse(ctx,6,-16,38,38,c);
      ctx.save();ctx.translate(6,-16);rays(ctx,43,56,c,28);ctx.restore();
      for(let i=0;i<6;i++)line(ctx,[[-69,34+i*4],[71,34+i*4]],c,1);
    }else{
      shape(ctx,[[-89,43],[-55,-7],[-34,18],[-10,-18],[12,9],[40,-16],[88,43]],c);
      for(let i=0;i<7;i++)line(ctx,[[-64+i*13,51],[-53+i*13,51]],c,2);
    }
  }else{
    if(layer===0){
      for(const s of [-1,1]){
        shape(ctx,[[0,6],[s*26,-32],[s*70,-44],[s*53,1],[s*11,17]],c);
        shape(ctx,[[0,6],[s*36,3],[s*35,33],[s*11,47]],c);
      }
      for(let i=0;i<13;i++) ellipse(ctx,Math.cos(i*2.3)*81,Math.sin(i*2.3)*55,1.7,1.7,c);
    }else{
      for(const s of [-1,1]){
        ellipse(ctx,s*42,-15,14,7,c,s*-.45);
        ellipse(ctx,s*22,19,6,8,c,s*.5);
        line(ctx,[[0,-4],[s*7,-16],[s*14,-21]],c,2);
      }
      ellipse(ctx,0,7,5,24,c);
    }
  }
}
const marks=[[-109,-73],[109,-73],[-109,73],[109,73]];
export default {
 title:'NIGHT PRESS',tagline:'Pull two ink passes into register on five little art prints.',
 instructions:[
   ['Watch the moving plate','Line up the colored crosses with the black targets. The active axis moves automatically.'],
   ['Lock one axis at a time','Tap once to lock the sideways motion, then again to stamp the vertical position.'],
   ['Finish the edition','Print two ink colors for each of five designs. Centered pulls earn a precision bonus.'],
 ],
 keys:[['Space / Enter','Lock the moving axis']],touch:[['Tap anywhere','Lock the moving axis']],
 create(api){
   let edition=0,layer=0,axis=0,t=0,phase=0,dx=0,dy=0,score=0,perfect=0,ended=false;
   let impression=0,quality='',latestError=0,locked=[],age=0,aiDelay=0;
   function prepare(){
     axis=0;age=0;phase=(api.rng()<.5?1:-1)*(.8+api.rng()*.6);
     dx=Math.sin(phase)*24;dy=14;impression=0;
     api.hud('Edition',(edition+1)+'/5','Ink',(layer+1)+'/2');
   }
   prepare();
   function pull(){
     if(ended||impression>0)return;
     if(axis===0){
       axis=1;age=0;
       phase=(api.rng()<.5?1:-1)*(.9+api.rng()*.5);
       dy=Math.sin(phase)*23;
       api.sound('click');api.haptic(8);
     }else{
       latestError=Math.hypot(dx,dy);
       const points=Math.max(15,Math.round(180-latestError*4.6));
       quality=latestError<5?'IN REGISTER':latestError<13?'CLEAN PULL':'OFFSET PULL';
       if(latestError<5) perfect++;
       score+=points;
       locked.push([dx,dy]);
       impression=1;
       api.sound(latestError<5?'clear':'drop');api.haptic(21);
     }
   }
   function update(dt){
     if(ended)return;t+=dt;
     if(impression>0){
       impression-=dt;
       if(impression<=0){
         layer++;
         if(layer===2){layer=0;edition++;locked=[];}
         if(edition===orders.length){
           ended=true;api.end(score,[['Editions pulled',5],['Precision passes',perfect+' / 10']], 'i’m keeping a copy of that last one.');return;
         }
         prepare();
       }return;
     }
     age+=dt;
     const offset=Math.sin(phase+age*(1.35+edition*.21+layer*.08))*(24+edition*2);
     if(axis===0)dx=offset;else dy=offset;
   }
   function draw(ctx){
     const o=orders[Math.min(edition,orders.length-1)];
     rect(ctx,0,0,480,480,0,'#263c3d');
     for(let i=0;i<16;i++){
       line(ctx,[[4,i*29+10],[476,i*29+10]],'#354d4a',1);
       line(ctx,[[i*33,2],[i*33,377]],'#354d4a',1);
     }
     rect(ctx,14,14,452,54,7,'#e8dbc0');
     label(ctx,'NIGHT PRESS',28,32,19,'#293e3d','left','Georgia');
     label(ctx,'JOB 0'+Math.min(edition+1,5)+' / 05',28,54,15,'#4b6259');
     label(ctx,o.name,451,41,22,'#293d3c','right','Georgia');
     rect(ctx,66,83,349,273,3,'#182f32');
     rect(ctx,61,78,349,273,3,'#ede7cf');
     rect(ctx,66,83,339,263,2,'#fbf4dc');
     ctx.save();ctx.translate(236,208);
     marks.forEach(([x,y])=>cross(ctx,x,y,'#4d524b',1.2));
     ctx.save();
     ctx.globalCompositeOperation='multiply';
     for(let i=0;i<2;i++){
       ctx.save();
       if(i<locked.length) ctx.translate(...locked[i]);
       else if(i===layer) ctx.translate(dx,dy);
       else {ctx.globalAlpha=.15;}
       plate(ctx,Math.min(edition,4),i,i===layer||i<locked.length?o.inks[i]:'#828279');
       if(i===layer && !ended)marks.forEach(([x,y])=>cross(ctx,x,y,o.inks[i]));
       ctx.restore();
     }
     ctx.restore();ctx.restore();
     label(ctx,o.series,81,102,15,'#4b5248','left','monospace');
     line(ctx,[[82,298],[389,298]],'#8a8b78',1);
     label(ctx,o.name.toUpperCase(),82,319,16,'#354840');
     label(ctx,'ED. 01',389,319,15,'#536153','right','monospace');
     // Leather feed rollers sit outside the sheet and make the active carriage easy to read.
     for(const x of [39,430]){
       rect(ctx,x,100,12,231,6,'#162d30');
       for(let y=108;y<328;y+=13)line(ctx,[[x+2,y],[x+9,y]],'#758177',2);
     }
     rect(ctx,0,370,480,110,0,'#f0deba');
     const ink=o.inks[Math.min(layer,1)];
     ellipse(ctx,31,393,9,9,ink);
     label(ctx,'INK '+Math.min(2,layer+1)+' / 2',48,394,16,'#35433d');
     label(ctx,impression>0?'PRESS PROOF':axis===0?'HORIZONTAL':'VERTICAL',458,394,17,'#35433d','right');
     rect(ctx,15,414,450,50,9,impression>0?'#486952':'#293f40');
     label(ctx,impression>0?quality+'   ·   '+Math.round(latestError)+' px off':axis===0?'↔   Lock horizontal':'↕   Stamp vertical',240,440,21,'#fff3d7','center');
   }
   return {update,draw,
     pointer(type){if(type==='down')pull();},
     key(type,code){if(type==='down'&&(code==='Space'||code==='Enter'))pull();},
     demo(dt){
       aiDelay=Math.max(0,aiDelay-dt);
       if(!ended&&impression<=0&&aiDelay===0&&age>.2&&Math.abs(axis===0?dx:dy)<2.8){pull();aiDelay=.3;}
     },
   };
 },
};
