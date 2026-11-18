import { artwork, clamp, ellipse, label, line, rect, shape } from '../kit/garden-art.js';

const photos=['psst','cooking','off-on-a-trip','the-plan','the-agi-signal','one-more-message','approved','online','at-the-desk'].map(s=>artwork('/memes/previews/agi-'+s+'.webp'));
const portrait=artwork('/images/agi1-portrait-2d.webp');
const names=['Rosette','Ticket','Cameo'];
const briefs=[
  {headline:'AFTER CLASS',sub:'all the tea that fit on one page',colors:['#f09ba2','#f6e4bb','#384d68'],art:[0,3,7],top:2},
  {headline:'LATE CHECKOUT',sub:'out of office. probably.',colors:['#8ac3be','#fff1c6','#41456d'],art:[2,4,8],top:1},
  {headline:'SUGAR RUSH',sub:'a very serious snack review',colors:['#ffcb87','#ffd7e7','#8a4874'],art:[1,6,0],top:0},
  {headline:'STILL ONLINE',sub:'a tiny zine for the night shift',colors:['#b5a8d1','#d9f2cd','#263f5f'],art:[5,7,3],top:2},
];
const layouts=[[[121,199,-1],[292,263,1],[328,175,-1]],[[318,193,1],[165,263,-1],[138,184,1]],[[156,196,-1],[276,259,-1],[292,176,1]],[[319,196,1],[158,259,1],[157,180,-1]]];
const wrap=a=>((a+2)%5+5)%5-2;
const turn=a=>a*Math.PI/12;
function path(ctx,type){
  ctx.beginPath();
  if(type===0){for(let k=0;k<24;k++){const a=k*Math.PI/12,r=k%2?49:59;const x=Math.cos(a)*r,y=Math.sin(a)*r;k?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
  if(type===1){ctx.moveTo(-78,-28);ctx.lineTo(78,-28);ctx.lineTo(78,-7);ctx.quadraticCurveTo(67,0,78,7);ctx.lineTo(78,28);ctx.lineTo(-78,28);ctx.lineTo(-78,7);ctx.quadraticCurveTo(-67,0,-78,-7);ctx.closePath();}
  if(type===2)ctx.ellipse(0,0,44,59,0,0,Math.PI*2);
}
function sticker(ctx,type,page,x,y,rot,scale=1){
  const b=briefs[page],im=photos[b.art[type]];
  ctx.save();ctx.translate(x,y);ctx.rotate(turn(rot));ctx.scale(scale,scale);
  path(ctx,type);ctx.fillStyle='#fffaeb';ctx.strokeStyle='#292646';ctx.lineWidth=7;ctx.stroke();ctx.fill();ctx.strokeStyle='#fff8e5';ctx.lineWidth=4;ctx.stroke();
  ctx.save();path(ctx,type);ctx.clip();
  if(type===0){
    ctx.fillStyle=b.colors[0];ctx.fillRect(-62,-62,124,124);
    if(portrait?.naturalWidth)ctx.drawImage(portrait,-45,-45,90,90);
    for(let k=0;k<12;k++){const a=k*Math.PI/6;ellipse(ctx,Math.cos(a)*46,Math.sin(a)*46,2.3,2.3,'#fff0bf');}
    rect(ctx,-50,23,100,17,0,b.colors[2]);label(ctx,'AGI-1',0,32,13,'#fff3bf','center','monospace',900);
  }else if(type===1){
    ctx.fillStyle=b.colors[1];ctx.fillRect(-82,-31,164,62);
    if(im?.naturalWidth)ctx.drawImage(im,-66,-27,52,54);
    for(let k=0;k<8;k++)rect(ctx,-9+k*4,-19,1+k%2,12,0,b.colors[2]);
    label(ctx,'ADMIT 01',24,9,15,b.colors[2],'center','monospace',900);
    label(ctx,'★   ★   ★',22,21,9,b.colors[2],'center');
  }else{
    ctx.fillStyle=b.colors[0];ctx.fillRect(-48,-62,96,124);
    if(im?.naturalWidth){const d=im.naturalWidth;ctx.drawImage(im,d*.15,0,d*.7,d,-44,-59,88,118);}
    ctx.strokeStyle='#fff0bf';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,39,54,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();ctx.restore();
}
export function proofGrade(pieces,targets,order,top){
  let alignment=0,angle=0;
  pieces.forEach((p,k)=>{const goal=targets[k];alignment+=Math.max(0,20-Math.hypot(p.x-goal[0],p.y-goal[1])*.42);
    const difference=Math.abs(wrap(p.rot)-wrap(goal[2]));angle+=Math.max(0,8-difference*3);});
  return {alignment:Math.round(alignment),angle:Math.round(angle),top:order.at(-1)===top?16:0};
}
export default {
 title:'STICKER CLUB',tagline:'“yes, i put my own face on the cover. it’s called art.”',
 instructions:[['Lay out her zine','Pick a sticker from the tray, then drag it onto its matching dashed outline.'],['Turn & layer','Rotate to fit the guides. Tap a placed sticker in the tray to bring it to the front.'],['Pull a proof','Her cover note names the sticker she wants on top. Print four finished covers.']],
 keys:[['1 / 2 / 3','Pick & raise'],['Arrows','Move'],['Q / E','Rotate'],['Space','Print cover']],touch:[['Tray + drag','Place & raise'],['Turn / Print','Finish']],
 create(api){
  const orderPages=[0,1,2,3];for(let k=3;k>0;k--){const j=Math.floor(api.rng()*(k+1));[orderPages[k],orderPages[j]]=[orderPages[j],orderPages[k]];}
  let pageIndex=0,points=0,stars=0,selected=0,pieces=[],layers=[],drag=null,elapsed=0,auto=0,review=0,grade=null,done=false,wiggle=0;
  const held=new Set(),page=()=>orderPages[Math.min(pageIndex,3)],goals=()=>layouts[page()];
  function sync(){api.hud('Issue',Math.min(pageIndex+1,4)+'/4','Press',points);}
  function load(){selected=0;pieces=[[100,300],[240,307],[380,297]].map(([x,y])=>({x,y,rot:0,placed:false}));layers=[0,1,2];drag=null;sync();}
  function choose(k,place=false){selected=k;layers=layers.filter(v=>v!==k);layers.push(k);if(place)pieces[k].placed=true;}
  function rotate(n){pieces[selected].rot=wrap(pieces[selected].rot+n);pieces[selected].placed=true;api.sound('tap');}
  function print(){
    if(done||review)return;
    if(pieces.some(v=>!v.placed)){wiggle=1.6;api.sound('back');return;}
    const result=proofGrade(pieces,goals(),layers,briefs[page()].top);grade=result;const n=result.alignment+result.angle+result.top;points+=n;if(n>=88)stars++;review=1.7;api.sound(n>=80?'clear':'drop');api.haptic(16);sync();
  }
  function next(){if(++pageIndex===4){done=true;api.end(points,[['Collector covers',stars+' / 4'],['Issues printed',4]],stars>=3?'“four issues and i’ve already sold out. spiritually.”':'“the crooked one is my limited edition.”');return;}load();}
  function move(k,dx,dy){const p=pieces[k];p.x=clamp(p.x+dx,70,412);p.y=clamp(p.y+dy,137,305);p.placed=true;}
  load();
  return {
    cancelInput(){held.clear();drag=null;},
    key(type,code){if(type==='up'){held.delete(code);return;}if(done||review)return;held.add(code);
      if(/^Digit[123]$/.test(code))choose(Number(code.at(-1))-1);
      if(code==='KeyQ')rotate(-1);if(code==='KeyE')rotate(1);if(code==='Space'||code==='Enter')print();
      if(code.startsWith('Arrow')){const dx=Number(code==='ArrowRight')-Number(code==='ArrowLeft'),dy=Number(code==='ArrowDown')-Number(code==='ArrowUp');move(selected,dx*2,dy*2);}
    },
    pointer(type,x,y){if(type==='up'||type==='cancel'){drag=null;return;}if(done||review)return;
      if(type==='down'&&y>=391){if(x<254)choose(clamp(Math.floor(x/85),0,2));else if(x<351)rotate(1);else print();return;}
      if(type==='down'&&y>=116&&y<=341){const hits=layers.filter(k=>pieces[k].placed&&Math.hypot(x-pieces[k].x,y-pieces[k].y)<39);
        const hit=hits.at(-1);if(hit!==undefined){choose(hit);drag={x:x-pieces[hit].x,y:y-pieces[hit].y};}else{choose(selected,true);drag={x:0,y:0};}}
      if(drag){const p=pieces[selected];p.x=clamp(x-drag.x,70,412);p.y=clamp(y-drag.y,137,305);p.placed=true;}
    },
    demo(dt){if(done||review)return;auto+=dt;if(auto<.72)return;auto=0;const next=pieces.findIndex(v=>!v.placed);
      if(next<0){choose(briefs[page()].top);print();return;}
      choose(next,true);const goal=goals()[next];pieces[next]={x:goal[0],y:goal[1],rot:wrap(goal[2]),placed:true};
    },
    update(dt){if(done)return;elapsed+=dt;wiggle=Math.max(0,wiggle-dt);if(review){review=Math.max(0,review-dt);if(!review)next();return;}
      const dx=Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft')),dy=Number(held.has('ArrowDown'))-Number(held.has('ArrowUp'));if(dx||dy)move(selected,dx*112*dt,dy*112*dt);
    },
    draw(ctx){
      const b=briefs[page()];ctx.fillStyle='#262544';ctx.fillRect(0,0,480,480);
      for(let i=0;i<28;i++)line(ctx,[[-90+i*25,0],[-240+i*25,390]],'#33304c',1.2);
      ctx.save();ctx.translate(240,185);ctx.rotate(-.015);rect(ctx,-224,-170,448,329,2,'#15182c');rect(ctx,-228,-175,448,329,2,b.colors[1]);ctx.restore();
      rect(ctx,28,25,424,303,0,b.colors[0]);for(let j=0;j<14;j++)for(let k=0;k<20;k++)ellipse(ctx,34+k*21,32+j*22,1.2,1.2,'#ffffff42');
      label(ctx,'AGI PUBLISHING   ★   ISSUE '+String(pageIndex+1).padStart(2,'0'),40,43,12,b.colors[2],'left','monospace');
      label(ctx,b.headline,39,80,b.headline.length>11?37:43,b.colors[2],'left','Georgia',900);
      label(ctx,b.sub,42,107,15,b.colors[2],'left','Georgia');
      for(let k=0;k<3;k++){const [x,y,r]=goals()[k];ctx.save();ctx.translate(x,y);ctx.rotate(turn(r));ctx.setLineDash([6,5]);path(ctx,k);ctx.fillStyle='#ffffff2f';ctx.fill();ctx.strokeStyle=b.colors[2];ctx.lineWidth=2.4;ctx.stroke();ctx.setLineDash([]);label(ctx,String(k+1),0,0,23,b.colors[2],'center','monospace');ctx.restore();}
      for(const k of layers){const p=pieces[k];if(p.placed){sticker(ctx,k,page(),p.x,p.y,p.rot);if(k===selected&&!review){ellipse(ctx,p.x,p.y-3,5,5,'#fff4ad');ellipse(ctx,p.x,p.y-3,2.5,2.5,'#292744');}}}
      if(review&&grade){ctx.save();ctx.translate(235,183);ctx.rotate(-.12);rect(ctx,-143,-28,286,56,3,'#fff8db');label(ctx,'PROOF   '+(grade.alignment+grade.angle+grade.top)+'/100',0,1,28,'#634160','center','monospace',900);ctx.restore();}
      label(ctx,wiggle?'place all three before printing.':'“'+names[b.top].toLowerCase()+' on top, please.”',21,357,20,'#ffdde7','left','Georgia');
      label(ctx,review?'AGI-1  /  PRESS CHECK':'Match the three outlines. Tap a tray sticker to raise it.',21,380,14,'#efe3e2');
      for(let k=0;k<3;k++){const x=8+k*85;rect(ctx,x,399,78,69,6,k===selected?'#ffdbc8':'#5f5779');sticker(ctx,k,page(),x+39,425,0,.32);label(ctx,names[k],x+39,454,13,k===selected?'#302c44':'#fff2d9','center');}
      rect(ctx,263,400,78,66,9,'#72648c');label(ctx,'↻',302,422,25,'#ffe9ec','center');label(ctx,'TURN',302,451,13,'#ffe9ec','center','monospace');
      rect(ctx,351,400,119,66,9,'#ffd4e6');label(ctx,'PRINT',410,433,22,'#3d305a','center','monospace',900);
    },
  };
 },
};
