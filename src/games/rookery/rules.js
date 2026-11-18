// Keyboard Catnap: the physical keys, AGI-1's sight and the cat's turn.
// Each step returns a new state. No clocks, random numbers or drawing enter the hunt.
export const N=0, E=1, S=2, W=3, CALL=4, LEFT=5, RIGHT=6, WAIT=7, DOT=8;
export const DIRECTIONS=['up','right','down','left'];
export const ARROWS=['↑','→','↓','←'];
const DX=[0,1,0,-1], DY=[-1,0,1,0];

function unobstructed(board, from, to) {
  // Supercover tracing between key centers; a ray through a filled corner is blocked.
  if(from===to)return true;
  const c=board.cols;
  let x=from%c,y=Math.floor(from/c);
  const endX=to%c,endY=Math.floor(to/c);
  const nx=Math.abs(endX-x),ny=Math.abs(endY-y),sx=Math.sign(endX-x),sy=Math.sign(endY-y);
  let ix=0,iy=0;
  while(ix<nx||iy<ny){
    const cross=(1+2*ix)*ny-(1+2*iy)*nx;
    if(cross===0){
      if(board.tiles[y*c+x+sx]==='#'&&board.tiles[(y+sy)*c+x]==='#')return false;
      x+=sx;y+=sy;ix++;iy++;
    }else if(cross<0){x+=sx;ix++;}
    else{y+=sy;iy++;}
    if(board.tiles[y*c+x]==='#')return false;
  }
  return true;
}
export function buildBoard(spec) {
  const width=spec.map[0].length;
  if(spec.map.some(s=>s.length!==width))throw Error('Rectangular keys expected: '+spec.name);
  const source=spec.map.join('');
  const locate=(ch,override)=>{
    const p=override??source.indexOf(ch);
    if(!Number.isInteger(p)||p<0||p>=source.length)throw Error('Missing '+ch+' on '+spec.name);
    return p;
  };
  const tiles=Array.from(source,ch=>'@co'.includes(ch)?'.':ch);
  const b={...spec,cols:width,rows:spec.map.length,count:tiles.length,tiles,
    home:locate('o',spec.home),agi:locate('@',spec.agi),cat:locate('c',spec.cat),word:spec.word||'',
    anchors:[],steps:[],look:[],sight:[],letters:[],shy:spec.world===4};
  for(let i=0;i<b.count;i++){
    if(tiles[i]==='*')b.anchors.push(i);
    b.letters[i]=/^[A-Z]$/.test(tiles[i])?tiles[i]:'';
    b.steps[i]=DX.map((dx,d)=>{
      const x=i%width+dx,y=Math.floor(i/width)+DY[d];
      return x<0||y<0||x>=width||y>=b.rows?-1:y*width+x;
    });
  }
  for(let a=0;a<b.count;a++){
    b.sight[a]=new Int8Array(b.count).fill(-1);
    b.look[a]=new Uint8Array(b.count);
    for(let c=0;c<b.count;c++){
      if(a===c||!unobstructed(b,a,c))continue;
      const x=c%width-a%width,y=Math.floor(c/width)-Math.floor(a/width);
      if(x===0||y===0)b.sight[a][c]=x>0?E:x<0?W:y>0?S:N;
      for(let d=0;d<4;d++){
        const f=x*DX[d]+y*DY[d],l=x*DY[d]-y*DX[d];
        if(f>0&&Math.abs(l)<=f)b.look[a][c]|=1<<d;
      }
    }
  }
  b.actions=[N,E,S,W,CALL];
  if(b.shy)b.actions.push(LEFT,RIGHT);
  if(b.shy||b.anchors.length)b.actions.push(WAIT);
  b.actions.push(...b.anchors.map((_,i)=>DOT+i));
  b.lureStates=b.anchors.length+1;
  b.facingStates=b.shy?4:1;
  b.capacity=b.count*b.count*b.facingStates*b.lureStates*(b.word.length+1);
  return b;
}
export function initial(b){return {agi:b.agi,cat:b.cat,face:b.face??E,lure:b.lure??0,typed:0};}
export function pack(b,s){
  return ((((s.agi*b.count+s.cat)*b.facingStates+(b.shy?s.face:0))*b.lureStates+s.lure)*(b.word.length+1)+s.typed);
}
export function unpack(b,key){
  const typed=key%(b.word.length+1);key=Math.floor(key/(b.word.length+1));
  const lure=key%b.lureStates;key=Math.floor(key/b.lureStates);
  const face=b.shy?key%4:E;key=Math.floor(key/b.facingStates);
  return {agi:Math.floor(key/b.count),cat:key%b.count,face,lure,typed};
}
export const finished=(b,s)=>s.cat===b.home&&s.typed===b.word.length;
export const watched=(b,s)=>Boolean(b.shy&&(b.look[s.agi][s.cat]&(1<<s.face)));
export function prefixAfter(word,prefix,letter) {
  if(!letter||prefix===word.length)return prefix;
  const input=word.slice(0,prefix)+letter;
  for(let len=Math.min(input.length,word.length);len>0;len--)if(input.endsWith(word.slice(0,len)))return len;
  return 0;
}
function freeCat(b,pos,agi){return pos>=0&&pos!==agi&&b.tiles[pos]!=='#';}
function settle(b,start,dir,agi){
  let p=b.steps[start][dir];
  if(!freeCat(b,p,agi))return start;
  while(b.tiles[p]==='~' && freeCat(b,b.steps[p][dir],agi))p=b.steps[p][dir];
  return p;
}
export function command(b,state,action,info=null) {
  if(finished(b,state))return state;
  const s={...state};
  let pushed=false,catDir=-1,why='';
  if(action<4&&action>=0){
    const to=b.steps[s.agi][action];
    if(to<0||b.tiles[to]==='#'||b.tiles[to]===':')return state;
    if(to===s.cat){
      const landing=settle(b,s.cat,action,s.agi);
      if(landing===s.cat)return state;
      s.cat=landing;catDir=action;pushed=true;why='push';
    }
    s.agi=to;s.face=action;
  }else if(action===CALL){
    if(b.sight[s.cat][s.agi]<0)return state;
  }else if((action===LEFT||action===RIGHT)&&b.shy){
    s.face=(s.face+(action===LEFT?3:1))%4;
  }else if(action>=DOT&&action<DOT+b.anchors.length){
    const next=action-DOT+1;
    s.lure=s.lure===next?0:next;
  }else if(action!==WAIT||(!s.lure&&!b.shy))return state;
  if(!pushed&&!watched(b,s)){
    let dir=-1;
    if(s.lure){dir=b.sight[s.cat][b.anchors[s.lure-1]];if(dir>=0)why='laser';}
    if(dir<0&&action===CALL){dir=b.sight[s.cat][s.agi];if(dir>=0)why='call';}
    if(dir<0&&action!==CALL&&b.shy&&!s.lure){dir=b.sight[s.cat][b.home];if(dir>=0)why='creep';}
    if(dir>=0){s.cat=settle(b,s.cat,dir,s.agi);catDir=dir;}
  }
  const moved=s.cat!==state.cat;
  const letter=moved?b.letters[s.cat]:'';
  s.typed=prefixAfter(b.word,s.typed,letter);
  if(info){
    info.moved=moved;info.kind=moved?why:'';
    info.slide=moved&&b.steps[state.cat][catDir]!==s.cat;
    info.letter=letter;info.typed=s.typed;info.watched=watched(b,s);info.lure=s.lure;
  }
  if(!moved&&s.agi===state.agi&&s.face===state.face&&s.lure===state.lure&&s.typed===state.typed)return state;
  return s;
}
export function actionName(b,n){
  if(n<4)return DIRECTIONS[n];
  if(n===CALL)return 'call';if(n===LEFT)return 'look left';if(n===RIGHT)return 'look right';if(n===WAIT)return 'wait for cat';
  const p=b.anchors[n-DOT];return 'dot '+String.fromCharCode(65+p%b.cols)+(Math.floor(p/b.cols)+1);
}
