import { TAU, ellipse, rect, line, shape, label, clamp, artwork } from '../kit/garden-art.js';

const films=[artwork(new URL('./teal.webp',import.meta.url)),artwork(new URL('./vermilion.webp',import.meta.url))];
const orders=[
  {name:'Lunar transit',series:'ORBITAL / 01',inks:['#39a9b6','#ff6c63']},
  {name:'After the rain',series:'BOTANICA / 02',inks:['#499c93','#eb6978']},
  {name:'Open water',series:'PELAGIC / 03',inks:['#51a8ca','#ed8855']},
  {name:'Daybreak',series:'ALMANAC / 04',inks:['#e2a62c','#e85e70']},
  {name:'Night flight',series:'NOCTURNE / 05',inks:['#17657a','#ed6339']},
  {name:'Last light',series:'BEACON / 06',inks:['#17657a','#ed6339']},
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
const marks=[[-112,-90],[112,-90],[-112,91],[112,91]];
const inkColors=['#186779','#e86138'];

function impression(ctx,edition,layer,offset,opacity=1){
  ctx.save();
  ctx.translate(offset[0],offset[1]);
  ctx.globalAlpha=opacity;
  const film=films[layer];
  if(film?.naturalWidth){
    const w=film.naturalWidth/3,h=film.naturalHeight/2;
    ctx.drawImage(film,edition%3*w,Math.floor(edition/3)*h,w,h,-100,-100,200,200);
  }else plate(ctx,edition%5,layer,inkColors[layer]);
  ctx.restore();
}

export function scorePull(distance, pressure, target, fine) {
  const pressureError=Math.abs(pressure-target);
  const clean=distance< (fine?5.5:11) && pressureError<(fine?.095:.18);
  const base=Math.max(15,Math.round(160-distance*3.1-pressureError*143));
  return { clean, score:fine?(clean?base+125:Math.round(base*.55)):base, pressureError };
}

export default {
  title:'NIGHT PRESS',tagline:'Register two real ink films, then pull the squeegee by hand. Can you deliver the collector edition?',
  instructions:[
    ['Register the screen','Tap when the colored crosses overlap the fixed guides. Lock horizontal, then vertical.'],
    ['Pull the print','Hold the large press control to build pressure. Release in the brass band. Each paper stock takes a different pressure.'],
    ['Choose an edition','Switch to Fine before registering a pass for a tighter target and a larger clean-print bonus. Three proof sheets let you reset a bad alignment before printing.'],
  ],
  keys:[['Space / Enter','Lock an axis, then hold and release to print'],['F','Switch studio or fine edition'],['Z','Spend a proof to realign']],
  touch:[['Tap, then hold the press','Register and ink the plate'],['Edition or Proof','Change the edition or reset a pull']],
  create(api){
    let edition=0,layer=0,axis=0,age=0,phase=0,dx=0,dy=0,t=0,pressure=0,target=.64;
    let pressing=false,fine=false,proofs=3,used=0,points=0,cleanPasses=0,collectors=0;
    let last='',endHold=0,ended=false,locked=[],finished=[],seen=0,delay=.25;
    const sequence=[0,1,2,3,4,5];
    for(let i=5;i>1;i--){const j=1+Math.floor(api.rng()*i);[sequence[i],sequence[j]]=[sequence[j],sequence[i]];}
    function prepare(){
      axis=0;age=0;phase=(api.rng()<.5?1:-1)*(.8+api.rng()*.6);
      dx=Math.sin(phase)*22;dy=14;pressure=0;pressing=false;last='';endHold=0;
      target=.43+.37*api.rng();
      api.hud('Edition',(edition+1)+'/6','Ink',(layer+1)+'/2');
    }
    function selectFine(){
      if(ended||axis!==0||endHold>0)return;
      fine=!fine;api.sound('select');
    }
    function reset(){
      if(ended||proofs===0||axis===0||endHold>0)return;
      proofs--;used++;prepare();last='Fresh proof';api.sound('back');
    }
    function press(){
      if(ended||endHold>0)return;
      if(axis===0){
        axis=1;age=0;phase=(api.rng()<.5?1:-1)*(.9+api.rng()*.5);
        dy=Math.sin(phase)*22;api.sound('click');return;
      }
      if(axis===1){axis=2;age=0;api.sound('select');return;}
      pressing=true;
    }
    function print(){
      if(!pressing||ended||endHold>0)return;
      pressing=false;
      if(pressure<.065){pressure=0;return;}
      const result=scorePull(Math.hypot(dx,dy),pressure,target,fine);
      points+=result.score;
      if(result.clean)cleanPasses++;
      if(result.clean&&fine)collectors++;
      last=(result.clean?(fine?'Collector pull':'In register'):result.pressureError>.18?'Uneven ink':'Offset impression')+'  +'+result.score;
      locked.push([dx,dy]);endHold=layer===1?1.85:1;
      api.sound(result.clean?'clear':'drop');api.haptic(result.clean?20:8);
    }
    function update(dt){
      if(ended)return;
      t+=dt;
      if(endHold>0){
        endHold=Math.max(0,endHold-dt);
        if(endHold===0){
          layer++;
          if(layer===2){finished.push(sequence[edition]);layer=0;edition++;locked=[];fine=false;}
          if(edition===6){
            ended=true;api.end(points,[['Posters printed',6],['Clean pulls',cleanPasses+' / 12'],['Collector pulls',collectors],['Proof sheets used',used]],'your art deserves a wall of its own.');return;
          }
          prepare();
        }
        return;
      }
      age+=dt;
      if(axis<2){
        const offset=Math.sin(phase+age*(1.28+edition*.15+layer*.09+(fine?.3:0)))*(22+edition*1.75);
        if(axis===0)dx=offset;else dy=offset;
      }else if(pressing){
        pressure=clamp(pressure+dt*(.58+edition*.035),0,1);
        if(pressure===1)print();
      }
    }
    function draw(c){
      const id=sequence[Math.min(edition,5)],order=orders[id];
      rect(c,0,0,480,480,0,'#232d30');
      for(let j=0;j<14;j++){line(c,[[0,65+j*22],[480,65+j*22]],'#374144',1);}
      rect(c,12,10,456,47,7,'#dbc6a4');
      label(c,'NIGHT PRESS',25,27,19,'#2a3434','left','Georgia');
      label(c,'EDITION 0'+Math.min(6,edition+1)+' / 06',25,46,12,'#58605b','left','monospace');
      label(c,order.name,453,32,22,'#2a3434','right','Georgia');
      rect(c,68,62,345,276,10,'#141d21');rect(c,76,66,327,266,4,'#485051');
      rect(c,88,72,302,249,2,'#e6cfa8');rect(c,92,75,295,241,2,'#fff4d5');
      c.save();c.translate(240,192);c.globalCompositeOperation='multiply';
      for(let i=0;i<2;i++){
        const offset=i<locked.length?locked[i]:i===layer?[dx,dy]:[0,0];
        const opacity=i<locked.length?1:i===layer?(.74+pressure*.21):.11;
        impression(c,id,i,offset,opacity);
      }
      c.restore();
      if(endHold<=0){
        c.save();c.translate(240,192);
        for(const [x,y] of marks){
          cross(c,x,y,'#444442',.9);cross(c,x+dx,y+dy,inkColors[layer],.75);
        }
        c.restore();
      }
      for(const x of [36,432]){
        rect(c,x,78,14,241,6,'#121a20');rect(c,x+2,80,3,236,2,'#8c8c82');
        for(let i=0;i<15;i++)line(c,[[x+6,84+15*i],[x+12,84+15*i]],'#697775',1.4);
        rect(c,x-6,87+(axis<2?Math.sin(t*2)*4:pressure*197),27,16,4,'#cda264');
      }
      if(axis===2&&pressing){
        const rollerY=85+pressure*207;
        rect(c,61,rollerY,358,14,5,'#263034');rect(c,65,rollerY+2,350,5,3,'#90958b');
      }
      rect(c,0,336,480,144,0,'#ead9b8');
      label(c,layer===0?'TEAL / 01':'VERMILION / 02',16,352,14,'#273e40');
      label(c,endHold>0?last:axis===2?'Squeegee pressure':fine?'Collector stock':'Studio stock',463,353,16,'#3d413b','right');
      if(axis===2&&endHold<=0){
        rect(c,18,372,444,16,7,'#4a5654');
        const width=fine?.095:.18;
        rect(c,18+444*(target-width),372,444*width*2,16,3,'#ceb070');
        line(c,[[18+444*target,371],[18+444*target,389]],'#fff4d7',2);
        const needle=18+pressure*444;
        shape(c,[[needle-6,365],[needle+6,365],[needle,374]],'#352f2e');
      }else{
        for(let i=0;i<6;i++){
          const x=20+i*33;
          rect(c,x,366,27,28,2,finished.includes(i)?'#f9edcd':'#d4c7a9');
          if(finished.includes(i)){c.save();c.translate(x+13,380);c.scale(.12,.12);c.globalCompositeOperation='multiply';impression(c,i,0,[0,0]);impression(c,i,1,[0,0]);c.restore();}
        }
        label(c,endHold>0?'On the drying rack':'Registration ±'+(fine?'5':'11')+' px',461,380,14,'#595e55','right');
      }
      rect(c,12,406,100,59,9,fine?'#cb9e60':'#cbbda3');
      label(c,fine?'FINE ★':'STUDIO',62,429,16,'#343934','center');
      label(c,'F · Edition',62,451,13,'#535744','center');
      rect(c,120,406,245,59,9,endHold>0?'#426a57':'#234953');
      const action=endHold>0?'Drying…':axis===0?'↔ Lock horizontal':axis===1?'↕ Lock vertical':pressing?'Release on brass':'Hold to ink';
      label(c,action,242,436,20,'#fff4d8','center');
      rect(c,372,406,95,59,9,'#cbbda3');label(c,'Proof ×'+proofs,419,429,16,'#343934','center');
      label(c,'Z · Reset',419,451,13,'#535744','center');
    }
    prepare();
    return {update,draw,
      cancelInput(){pressing=false;pressure=0;},
      key(type,code){
        if(type==='down'&&code==='KeyF'){selectFine();return;}
        if(type==='down'&&code==='KeyZ'){reset();return;}
        if(code==='Space'||code==='Enter'){if(type==='down')press();else print();}
      },
      pointer(type,x,y){
        if(type==='cancel'){pressing=false;pressure=0;return;}
        if(type==='up'){print();return;}
        if(type!=='down')return;
        if(y>=402&&x<116)selectFine();else if(y>=402&&x>370)reset();else press();
      },
      demo(dt){
        if(ended||endHold>0)return;
        if(seen!==edition*2+layer){seen=edition*2+layer;if(seen%3===1&&!fine)selectFine();}
        delay=Math.max(0,delay-dt);
        if(axis<2&&delay===0&&age>.19&&Math.abs(axis===0?dx:dy)<2.8){press();delay=.19;}
        else if(axis===2&&delay===0){if(!pressing)press();else if(pressure>=target-.02)print();}
      },
    };
  },
};
