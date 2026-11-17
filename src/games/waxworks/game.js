import { line, polygon, panel, type, gradient, oval, clip } from '../kit/illustration.js';

// The front plate sees the tallest stack in each column, the side plate each row.
// The blueprints come from actual sculptures so both views can always be satisfied.
const MODELS = [
  { name: 'Tea stair', front: [1,2,3], side: [1,2,3] },
  { name: 'Archway', front: [3,1,3], side: [2,3,1] },
  { name: 'Ribbon', front: [1,3,2,1], side: [1,2,3,2] },
  { name: 'Cathedral', front: [2,4,4,2], side: [2,4,2,1] },
  { name: 'Sea fan', front: [3,1,4,2], side: [1,3,2,4] },
  { name: 'Lantern', front: [1,4,3,2], side: [3,2,4,1] },
];
export function profiles(board) {
  return { front: board[0].map((_, x) => Math.max(...board.map(row => row[x]))), side: board.map(row => Math.max(...row)) };
}
const close = (a, b) => a.every((v,i) => v === b[i]);
export default {
  title:'WAXWORKS', tagline:'Two blueprints. One block of beeswax. Find the sculpture hiding inside.',
  instructions:[['Read the plates','The front measures the tallest stack in each column. The side measures the tallest in each row.'],['Carve or mend','Tap a stack to shave one layer. Switch to Melt + to return wax. The letters and numbers match the plates.'],['Finish the set','Match both blueprints to move on. Fewer tool strokes earn more points.']],
  keys:[['Arrows','Pick a stack'],['Space','Use tool'],['M','Change tool'],['Z','Undo']],
  touch:[['Tap stack','Use tool'],['Bottom buttons','Change tool or undo']],
  create(api) {
    let stage=0, board, model, target, sel, adding=false, undo=[], moves=0, total=0, scored=0, pulse=0, time=0, chips=[], wait=0, bot=0;
    let hits=[];
    function setup() {
      model=MODELS[stage]; const n=model.front.length;
      target=Array.from({length:n},(_,r)=>Array.from({length:n},(_,k)=>Math.min(model.front[k],model.side[r])));
      board=target.map(row=>[...row]);
      // Start with the poured piece. Several sprues protrude beyond the profiles.
      const possible=[];
      for(let r=0;r<n;r++) for(let x=0;x<n;x++) if(target[r][x]<Math.max(...model.front)) possible.push([r,x]);
      for(let i=possible.length-1;i>0;i--){const j=Math.floor(api.rng()*(i+1));[possible[i],possible[j]]=[possible[j],possible[i]];}
      for(const [r,x] of possible.slice(0,3+stage)) board[r][x]++;
      sel={r:0,x:0}; moves=0; undo=[]; adding=false; wait=0; chips=[];
      api.hud('Piece',stage+1,'Score',total);
    }
    function pos(r,x,h) {
      const n=board.length, size=n===3?45:36;
      return [240+(x-r)*size,222+(x+r-n+1)*size*.53-h*18];
    }
    function stroke(r,x) {
      if(wait>0) return;
      const old=board[r][x], next=clip(old+(adding?1:-1),0,Math.max(...model.front)+1);
      if(old===next) return;
      undo.push([r,x,old]); board[r][x]=next; moves++; pulse=1; sel={r,x};
      const [cx,cy]=pos(r,x,old);
      for(let i=0;i<5;i++) chips.push({x:cx,y:cy,vx:(i-2)*23,vy:-45-i%3*15,life:.5});
      api.sound(adding?'pop':'tap');
      const p=profiles(board);
      if(close(p.front,model.front)&&close(p.side,model.side)) {
        scored=Math.max(25,175+stage*30-moves*3); total+=scored; wait=1.45;
        api.sound('levelup');api.hud('Piece',stage+1,'Score',total);
      }
    }
    function back() { if(wait||!undo.length) return; const [r,x,v]=undo.pop();board[r][x]=v;sel={r,x};moves--; }
    function drawPlate(c,x,label,goal,seen,rows){
      panel(c,x,299,204,99,'#f3d6a6',9);
      type(c,label,x+12,312,14,'#523739','left');
      const gap=27, cw=18;
      goal.forEach((h,i)=>{
        const cx=x+66+(i-(goal.length-1)/2)*gap+28;
        for(let j=0;j<Math.max(...goal)+1;j++){
          const color=j<seen[i]?(j>=h?'#b94534':'#5b7260'):'#dfc39a';
          c.fillStyle=color;c.fillRect(cx,370-(j+1)*10,cw,8);
        }
        line(c,[[cx-3,369-h*10],[cx+cw+3,369-h*10]],'#382839',2.5);
        type(c,rows?String(i+1):String.fromCharCode(65+i),cx+cw/2,384,14,'#53393a');
      });
    }
    setup();
    return {
      update(dt){time+=dt;pulse=Math.max(0,pulse-dt*2);chips=chips.filter(p=>(p.life-=dt)>0);for(const p of chips){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=190*dt;}
        if(wait>0 && (wait-=dt)<=0){ if(++stage===MODELS.length) api.end(total,[['Sculptures',MODELS.length]],'i saved a spot for that one on my windowsill.');else setup(); }},
      draw(c){
        gradient(c,0,0,480,480,['#432c34','#7c4b43','#523431']);
        for(let i=0;i<22;i++){const y=48+i*13;line(c,[[0,y],[103,y+3],[259,y-2],[480,y+1]],'#ffffff0a',1);}
        type(c,'WAX ATELIER',24,24,16,'#ffd297','left');type(c,model.name,456,24,20,'#ffe5b8','right','Georgia');
        const n=board.length,size=n===3?45:36,edge='#683a31';
        const top=(cx,cy)=>[[cx,cy-size*.53],[cx+size,cy],[cx,cy+size*.53],[cx-size,cy]];
        const tray=pos(n/2-.5,n/2-.5,0);
        oval(c,tray[0],tray[1]+16,n*size+23,n*size*.54+11,'#2e1f2a70');
        hits=[];
        for(let r=0;r<n;r++)for(let x=0;x<n;x++){
          const h=board[r][x], [cx,cy]=pos(r,x,h), [bx,by]=pos(r,x,0);
          const t=top(cx,cy),base=top(bx,by);
          const left=[t[3],t[2],base[2],base[3]],right=[t[2],t[1],base[1],base[2]];
          polygon(c,left,'#c58048',edge,1.2);polygon(c,right,'#a65f42',edge,1.2);
          for(let k=1;k<h;k++){const [xx,yy]=pos(r,x,k);line(c,[[xx-size,yy],[xx,yy+size*.53],[xx+size,yy]],'#814a38',1);}
          const active=sel.r===r&&sel.x===x, p=profiles(board), excess=h>model.front[x]||h>model.side[r];
          polygon(c,t,h===0?'#754e42':excess?'#ffb476':'#f6cf83',active?'#fff3cc':edge,active?3:1);
          type(c,String.fromCharCode(65+x)+(r+1),cx,cy,13,h===0?'#ffdcac':'#6e442e');
          hits.push({r,x,faces:[t,left,right]});
        }
        chips.forEach(p=>polygon(c,[[p.x,p.y-3],[p.x+3,p.y+1],[p.x-2,p.y+3]],'#ffe4a4'));
        const p=profiles(board);
        drawPlate(c,29,'FRONT',model.front,p.front,false);drawPlate(c,246,'SIDE',model.side,p.side,true);
        panel(c,28,412,212,49,adding?'#ffd097':'#fff0c9');panel(c,251,412,201,49,'#56363b');
        type(c,adding?'Melt +  ⇄':'Carve −  ⇄',134,436,19,'#523235');type(c,'↶ Undo',351,436,19,undo.length?'#fff1cf':'#bc9f93');
        if(wait>0){panel(c,131,54,218,35,'#473a31');type(c,'Piece cast  +'+scored,240,72,19,'#ffdf9d');}
      },
      pointer(t,x,y){if(t!=='down'||wait) return;if(y>406){if(x<=240)adding=!adding;else back();return;}
        const inside=(poly)=>{let a=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [ax,ay]=poly[i],[bx,by]=poly[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)a=!a;}return a;};
        const pick=hits.slice().reverse().find(k=>k.faces.some(inside));if(pick)stroke(pick.r,pick.x);},
      key(t,k){if(t!=='down'||wait)return;const n=board.length;if(k==='Space'||k==='Enter')stroke(sel.r,sel.x);if(k==='KeyM')adding=!adding;if(k==='KeyZ')back();
        if(k==='ArrowRight')sel.x=clip(sel.x+1,0,n-1);if(k==='ArrowLeft')sel.x=clip(sel.x-1,0,n-1);if(k==='ArrowDown')sel.r=clip(sel.r+1,0,n-1);if(k==='ArrowUp')sel.r=clip(sel.r-1,0,n-1);},
      demo(dt){if(wait|| (bot-=dt)>0)return;bot=.8;adding=false;for(let r=0;r<board.length;r++)for(let x=0;x<board.length;x++)if(board[r][x]>target[r][x]){stroke(r,x);return;}},
    };
  }
};
