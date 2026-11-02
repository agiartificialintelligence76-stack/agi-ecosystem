import { el, setText } from '../ui.js';

// Feed updates touch only a bounded queue. The compositor moves one fixed-width cell at a time;
// only after it has completely left the viewport do we recycle it and append a recent trade.
export function createClankTicker(host, { makeItem, keyOf, label = 'Practice trades', empty = 'Waiting for trades…',
  speed = 60, media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
  Resize = globalThis.ResizeObserver } = {}) {
  const track=el('div',{class:'tsc-tape-track'}),status=el('span',{class:'tsc-tape-status'},empty);
  const viewport=el('div',{class:'tsc-tape-window'},track,status);
  const refresh=el('button',{type:'button',class:'tsc-btn tsc-tape-refresh','aria-label':'Show latest trades',on:{click:showLatest}},'Latest');
  host.append(el('span',{class:'tsc-tape-label'},label),viewport,refresh);
  host.setAttribute('aria-live','off');
  let pending=[],snapshot=[],cells=[],animation=null,totalWidth=0,width=0,dead=false,visible=true,hover=false,focused=false;
  let reduced=Boolean(media?.matches),firstFill=true;const seen=new Map();
  const paused=()=>!visible||hover||focused||Boolean(document.hidden)||reduced;
  const key=row=>String(keyOf(row));
  const contains=(node,target)=>node===target||Boolean(target&&node.contains?.(target));
  function accessible(){
    const used=new Set();
    for(const cell of cells){const duplicate=used.has(cell.key);used.add(cell.key);
      if(duplicate)cell.node.setAttribute('aria-hidden','true');else cell.node.removeAttribute('aria-hidden');
      for(const button of cell.node.querySelectorAll('button'))button.tabIndex=duplicate?-1:0;
    }
  }
  function append(row,reuse=null){
    const cell=reuse||{key:key(row),row,node:el('div',{class:'tsc-tape-cell',data:{tradeKey:key(row)}},makeItem(row),el('span',{class:'tsc-tape-separator','aria-hidden':'true'},'·'))};
    track.append(cell.node);
    if(!cell.width){cell.width=Math.max(1,Math.ceil(cell.node.getBoundingClientRect().width));cell.node.style.setProperty('width',`${cell.width}px`);}
    cells.push(cell);totalWidth+=cell.width;return cell;
  }
  function fill(){
    if(!visible||!snapshot.length)return;
    if(!width)width=viewport.getBoundingClientRect().width;
    if(!(width>0))return;
    status.hidden=true;
    let fallback=0;
    // Cover the viewport plus the entire departing cell. Even a single source trade has a
    // continuous strip; duplicates are hidden from assistive technology and keyboard navigation.
    while(cells.length<24&&(reduced?pending.length>0:totalWidth<width+(cells[0]?.width||1))){
      const row=pending.shift()||snapshot[fallback++%snapshot.length];append(row);
    }
    accessible();firstFill=false;refresh.disabled=!pending.length;
  }
  function start(){
    if(dead||animation||paused()||!cells.length)return;
    if(typeof track.animate!=='function'){reduced=true;applyMotion();return;}
    const distance=cells[0].width;
    animation=track.animate([{transform:'translate3d(0,0,0)'},{transform:`translate3d(${-distance}px,0,0)`}],
      {duration:distance/Math.max(40,Math.min(60,speed))*1000,easing:'linear',fill:'forwards'});
    animation.onfinish=()=>{
      if(dead)return;
      // Removal and cancelling the filled transform happen together, preserving every remaining
      // cell's screen position. Incoming data never changes this animation's distance or duration.
      const finished=animation;animation=null;const departed=cells.shift();totalWidth-=departed.width;departed.node.remove();
      finished.onfinish=null;finished.cancel();
      if(pending.length)append(pending.shift());else append(departed.row,departed);
      fill();start();
    };
  }
  function syncPause(){
    if(dead)return;
    if(paused())animation?.pause();
    else{
      // Keyboard focus can scroll even an overflow:hidden viewport to an offscreen trade.
      // Restore its origin before compositor motion resumes, otherwise the strip develops a gap.
      if(viewport.scrollLeft)viewport.scrollLeft=0;
      animation?.play();fill();start();
    }
  }
  function applyMotion(){
    host.classList.toggle('is-reduced-motion',reduced);refresh.hidden=!reduced;refresh.disabled=!pending.length;
    if(reduced&&animation){animation.onfinish=null;animation.cancel();animation=null;}
    syncPause();
  }
  function showLatest(){
    if(dead)return;
    if(animation){animation.onfinish=null;animation.cancel();animation=null;}
    cells=[];totalWidth=0;track.replaceChildren();pending=[...snapshot];viewport.scrollLeft=0;fill();start();
  }
  const enter=()=>{hover=true;syncPause();},leave=()=>{hover=false;syncPause();};
  const focus=()=>{focused=true;syncPause();},blur=e=>{focused=contains(host,e.relatedTarget);syncPause();};
  const motion=e=>{reduced=e.matches;applyMotion();};
  host.addEventListener('mouseenter',enter);host.addEventListener('mouseleave',leave);
  host.addEventListener('focusin',focus);host.addEventListener('focusout',blur);
  document.addEventListener('visibilitychange',syncPause);media?.addEventListener?.('change',motion);
  const observer=Resize?new Resize(entries=>{width=entries[0]?.contentRect.width||0;if(!dead&&visible){fill();start();}}):null;
  observer?.observe(viewport);applyMotion();
  return {
    update(rows=[]){
      if(dead)return;
      const unique=new Map();for(const row of rows.slice(0,20))if(!unique.has(key(row)))unique.set(key(row),row);
      snapshot=[...unique.values()];const incoming=[];
      for(const [id,row]of unique)if(!seen.has(id)){seen.set(id,true);incoming.push(row);}
      while(seen.size>512)seen.delete(seen.keys().next().value);
      if(incoming.length){const keep=new Map([...incoming,...pending].map(row=>[key(row),row]));pending=[...keep.values()].slice(0,20);}
      if(firstFill&&snapshot.length){fill();start();}
      if(reduced)refresh.disabled=!pending.length;
      if(!snapshot.length&&!cells.length)setText(status,empty);
    },
    visible(value){if(visible===Boolean(value))return;visible=Boolean(value);syncPause();},
    get state(){return {queued:pending.length,cells:cells.length,seen:seen.size,reduced,paused:paused(),moving:Boolean(animation)};},
    destroy(){
      dead=true;if(animation){animation.onfinish=null;animation.cancel();animation=null;}observer?.disconnect();
      host.removeEventListener('mouseenter',enter);host.removeEventListener('mouseleave',leave);host.removeEventListener('focusin',focus);host.removeEventListener('focusout',blur);
      document.removeEventListener('visibilitychange',syncPause);media?.removeEventListener?.('change',motion);pending=[];snapshot=[];cells=[];seen.clear();host.replaceChildren();
    },
  };
}
