import { line, polygon, panel, type, gradient, oval, clip, painting } from '../kit/illustration.js';
import { profiles, makeMold, matches, pieceCount, toolStroke, undo } from './mold.js';
export { profiles } from './mold.js';
const workshop=painting(new URL('./scene.webp',import.meta.url));
const TOOLS=['chisel','pour','wire'];
const NAMES=['Chisel −','Pour +','Wire cut'];
const LETTERS='ABCD';
const waxColors=[
  ['#fff0ad','#e7b563','#ab7444'],['#ffecb6','#dfa16d','#b47555'],['#ffe1b7','#ebad86','#ab7157'],
  ['#f5d5c7','#cf969a','#965c70'],['#e7e9b5','#b8c88c','#7a946b'],['#ffe29a','#e6a959','#a96f40'],
];
function viewCell(r,x,n,turn) {
  for(let i=0;i<turn;i++)[r,x]=[x,n-1-r];
  return [r,x];
}
function inFace(points,x,y) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [a,b]=points[i],[d,e]=points[j];
    if((b>y)!==(e>y)&&x<(d-a)*(y-b)/(e-b)+a)inside=!inside;
  }
  return inside;
}
export default {
  title:'WAXWORKS',tagline:'Carve, reclaim and recast a single piece of beeswax. Every shaving goes back into the pot.',
  instructions:[
    ['Inspect the commission','The two brass plates show the required silhouette. The brass seals on the model show exact local heights. Turn the piece to inspect hidden faces.'],
    ['Move the wax','Chisel a stack to bank one bead. Pour a bead onto another stack. From the third commission, the wire shaves all the tallest stacks in the chosen numbered row at once. Undo any stroke.'],
    ['Fire the mold','Use all the wax, match both plates and set the seals to their engraved heights. Meet the stroke budget to earn a gold impression.'],
  ],
  keys:[['Arrows / Space','Pick stack / work'],['M / R / Z','Tool / rotate / undo']],
  touch:[['Tap a stack','Work with selected tool'],['Bottom controls','Tool, rotate or undo']],
  create(api) {
    let stage=0,m=makeMold(0,api.rng),tool=0,turn=0,r=0,x=0,score=0,golds=0,wait=0,bot=0,t=0;
    let hits=[],chips=[],notice='',noteTime=0,finished=false;
    const hud=()=>api.hud('Piece',stage+1+'/6','Strokes',m.moves);
    function position(row,col,h) {
      const [a,b]=viewCell(row,col,m.n,turn),size=m.n===3?43:35;
      return [240+(b-a)*size,218+(a+b-m.n+1)*size*.52-h*18];
    }
    function say(s){notice=s;noteTime=1.2;}
    function stroke(row,col) {
      if(wait||finished)return;
      if(!toolStroke(m,row,col,TOOLS[tool])){say(tool===1&&!m.pot?'Pot empty · chisel some wax':'The tool has no purchase');return;}
      r=row;x=col;hud();const [cx,cy]=position(r,x,m.board[r][x]);api.sound(tool===1?'drop':tool===2?'clear':'tap');
      for(let i=0;i<7;i++)chips.push({x:cx,y:cy,vx:(i-3)*18,vy:-53-i%3*22,life:.52});
      if(matches(m)){
        const gold=m.moves<=m.par;golds+=Number(gold);score+=Math.max(35,190+stage*24-4*m.moves)+(gold?80:0);
        wait=1.6;say(gold?'Gold impression':'Commission cast');api.sound('levelup');
      }
    }
    function selectTool(){tool=(tool+1)%(stage>=2?3:2);api.sound('select');}
    function plate(c,left,title,goal,current,isRow){
      panel(c,left,296,216,92,'#e8d7b6',6);type(c,title,left+10,309,13,'#594034','left');
      const width=27,base=373,start=left+112-(goal.length*width)/2;
      goal.forEach((v,i)=>{
        const px=start+i*width;
        for(let j=0;j<5;j++){
          c.fillStyle=j<current[i]?(j<v?'#6e8d77':'#b35b45'):'#cfba97';
          c.fillRect(px,base-(j+1)*9,19,7);
        }
        line(c,[[px-2,base-v*9-1],[px+21,base-v*9-1]],'#422b32',2);
        type(c,isRow?String(i+1):LETTERS[i],px+9,382,12,'#5d4337');
      });
    }
    hud();
    return {
      update(dt){if(finished)return;t+=dt;noteTime=Math.max(0,noteTime-dt);
        chips=chips.filter(p=>(p.life-=dt)>0);chips.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=200*dt;});
        if(wait>0){wait=Math.max(0,wait-dt);if(!wait){
          if(++stage===pieceCount){finished=true;api.end(score,[['Sculptures',pieceCount],['Gold impressions',golds+' / 6']],'my windowsill is officially an art gallery.');}
          else{m=makeMold(stage,api.rng);r=0;x=0;tool=0;turn=0;hud();}
        }}
      },
      draw(c){
        gradient(c,0,0,480,480,['#473336','#925d46','#422e32']);workshop(c,0,0,480,398);
        panel(c,12,11,256,46,'#302326d9',5);type(c,m.name,24,33,24,'#ffebc6','left','Georgia');
        panel(c,350,13,117,36,'#382a29e3',5);type(c,'Par  '+m.par,410,31,16,'#ffde98');
        const size=m.n===3?43:35,top=(cx,cy)=>[[cx,cy-size*.52],[cx+size,cy],[cx,cy+size*.52],[cx-size,cy]];
        const border=top(240,220).map(([xx,yy])=>[240+(xx-240)*(m.n+.22),220+(yy-220)*(m.n+.22)]);
        polygon(c,border.map(([xx,yy])=>[xx,yy+7]),'#584032','#4a3124',2);polygon(c,border,'#8a674a','#e6bf6e',2);
        const cells=m.board.flatMap((row,rr)=>row.map((h,xx)=>({r:rr,x:xx,h,view:viewCell(rr,xx,m.n,turn)})))
          .sort((a,b)=>(a.view[0]+a.view[1])-(b.view[0]+b.view[1]));
        hits=[];const [light,mid,dark]=waxColors[Math.min(stage,5)];
        for(const cell of cells){
          const {r:rr,x:xx,h}=cell,[cx,cy]=position(rr,xx,h),[bx,by]=position(rr,xx,0);
          const a=top(cx,cy),b=top(bx,by),l=[a[3],a[2],b[2],b[3]],right=[a[2],a[1],b[1],b[2]];
          const edge='#624633';polygon(c,l,mid,edge);polygon(c,right,dark,edge);
          for(let k=1;k<h;k++){const [u,v]=position(rr,xx,k);line(c,[[u-size,v],[u,v+size*.52],[u+size,v]],'#7a514485',1);}
          if(h){line(c,[[cx-size+7,cy+5],[cx-16,cy+size*.52+1],[cx-16,cy+size*.52+6]],'#fff4c188',1.8);}
          const active=rr===r&&xx===x;
          polygon(c,a,h?light:'#775741',active?'#fffdf3':'#765537',active?3:1);
          const seal=m.seals.some(q=>q.r===rr&&q.x===xx);
          if(seal){oval(c,cx,cy,size*.47,10,'#ac853f','#fbea9f',1.5);type(c,h+' / '+m.goal[rr][xx],cx,cy,13,'#fffbd2');}
          else type(c,LETTERS[xx]+(rr+1),cx,cy,13,h?'#765136':'#f1d8a1');
          hits.push({r:rr,x:xx,faces:[a,l,right]});
        }
        chips.forEach(p=>polygon(c,[[p.x,p.y-3],[p.x+3,p.y+1],[p.x-2,p.y+3]],'#ffdfa0'));
        if(noteTime||wait){panel(c,99,59,282,30,'#402f29e8');type(c,notice,240,74,16,'#fff1b6');}
        const p=profiles(m.board);plate(c,17,'FRONT',m.plates.front,p.front,false);plate(c,247,'SIDE',m.plates.side,p.side,true);
        panel(c,0,391,480,89,'#392b2d',0);type(c,'Crucible  '+m.pot+'   ·   empty the pot to cast',240,409,16,'#f6d8aa');
        [[14,183,NAMES[tool],'#f1c786','#4a342d'],[207,130,'↻ Turn','#725444','#fff1d3'],[347,119,'↶ Undo','#654943','#fff1d3']].forEach(([a,w,s,bg,fg])=>{panel(c,a,427,w,41,bg,6);type(c,s,a+w/2,448,17,fg);});
      },
      pointer(a,px,py){if(a!=='down'||wait||finished)return;if(py>=424){if(px<202)selectTool();else if(px<342){turn=(turn+1)%4;api.sound('select');}else{undo(m);hud();}return;}
        const hit=hits.slice().reverse().find(p=>p.faces.some(f=>inFace(f,px,py)));if(hit)stroke(hit.r,hit.x);},
      key(a,k){if(a!=='down'||wait||finished)return;
        if(['Space','Enter'].includes(k))stroke(r,x);
        if(k==='KeyM')selectTool();if(k==='KeyR')turn=(turn+1)%4;if(k==='KeyZ'){undo(m);hud();}
        const dirs={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};
        if(dirs[k]){let [dy,dx]=dirs[k];for(let i=0;i<turn;i++)[dy,dx]=[-dx,dy];r=clip(r+dy,0,m.n-1);x=clip(x+dx,0,m.n-1);}
      },
      demo(dt){if(wait||finished||(bot-=dt)>0)return;bot=.78;
        for(const mode of [0,1])for(let rr=0;rr<m.n;rr++)for(let xx=0;xx<m.n;xx++){
          const diff=m.board[rr][xx]-m.goal[rr][xx];if((mode===0&&diff>0)||(mode===1&&diff<0&&m.pot)){tool=mode;stroke(rr,xx);return;}
        }}
    };
  }
};
