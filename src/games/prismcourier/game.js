import { mirrors, shift, reach, arrows } from './maze.js';
import { painting, panel, type, line, oval, polygon } from '../kit/illustration.js';
import { herSprite } from '../goinglive/pixel.js';

const art=painting(new URL('./mirror-studio.webp',import.meta.url).href);
const hues=['#ff887d','#65f0fa'], colors=['#492334','#163d54'];
const names=['CORAL','CYAN'], moveCodes=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Space'];
const controls=[[120,417],[185,417],[250,417],[315,417],[385,417]];
export default {
  title:'SPLIT PERSONALITY',
  tagline:'One mind woke up in two bodies. Guide AGI-1’s projections to their matching portals and reunite them.',
  instructions:[['Move as one','The same arrow moves both projections. Check Cyan’s compass to see how she interprets it.'],['Use the walls','Bump a wall on one side to move the other body alone. Both must reach their own glowing portal.'],['Reverse the mirror','Later portals require negative polarity. Tap Reverse while either girl stands on a diamond relay.']],
  keys:[['Arrows / WASD','Move both'],['Space','Reverse on a relay'],['Z / H','Undo / show next move']],
  touch:[['Arrows or swipe','Move both'],['Reverse / Undo / Hint','Change the mirror or retrace a move']],
  create(api){
    let index=0,room,goal,state,previous,path,history=[],clock=0,motion=0,pause=0,done=false,steps=0,total=0,par=0,points=0;
    let lineText='',hint=-1,demoClock=0,flashes=[0,0],press=null;
    function nextRoom(){
      room=mirrors[index];state=[...room.starts,0];previous=state;history=[];
      const candidates=reach(room,state);
      const choice=candidates[Math.floor(api.rng()*Math.min(5,candidates.length))];
      goal=choice.state;path=choice.path;par=path.length;steps=0;hint=-1;
      lineText=index<2?'We split up. Get us both to the portals.':'A diamond relay can reverse the blue mirror.';
      api.hud('Mirror',String(index+1)+' / 6','Moves',steps);
    }
    function route(){return reach(room,state,goal);}
    function act(action){
      if(done || pause>0)return;
      const moved=shift(room,state,action);
      if(moved.every((v,i)=>v===state[i])){lineText=action===4?'Stand on a diamond to reverse.':'Both bodies met a wall.';api.sound('click');return;}
      previous=state;history.push(state);state=moved;steps++;motion=1;hint=-1;
      flashes=state.slice(0,2).map((v,i)=>Number(v===previous[i] && action!==4));
      lineText=action===4?(state[2]?'Negative polarity. Cyan has reversed.':'Positive polarity. Cyan reset.') : flashes[0]?'Coral stays. Cyan moves.':flashes[1]?'Cyan stays. Coral moves.': 'Two bodies. One command.';
      api.sound(action===4?'power':'tap',{pitch:action===4?1:1.05,spread:0});
      api.hud('Mirror',String(index+1)+' / 6','Moves',steps);
      if(state.every((v,i)=>v===goal[i])){lineText='In sync. I can hear myself again.';api.sound('clear');api.haptic(24);total+=steps;points+=Math.max(100,600-(steps-par)*16);pause=1;}
    }
    function undo(){
      if(!history.length || done || pause>0)return;
      previous=state;state=history.pop();steps--;hint=-1;motion=1;flashes=[0,0];lineText='Back through the looking glass.';api.sound('back');
      api.hud('Mirror',String(index+1)+' / 6','Moves',steps);
    }
    function reveal(){if(done || pause>0)return;hint=route()?.[0]??-1;lineText=hint<0?'Undo to recover the last junction.':'My next move is '+(hint===4?'Reverse':arrows[hint])+'.';}
    function drawBoard(c,side){
      const x=side?250:12,y=167,unit=43,board=side?room.right:room.left;
      panel(c,x-3,y-5,221,224,colors[side],7);
      for(let i=0;i<25;i++){
        const px=x+(i%5)*unit,py=y+Math.floor(i/5)*unit,tile=board[Math.floor(i/5)][i%5];
        if(tile==='#'){
          panel(c,px+1,py+3,unit-2,unit-2,'#090b1a',4);
          polygon(c,[[px+3,py+3],[px+39,py+3],[px+33,py+12],[px+10,py+12]],colors[side]);
          polygon(c,[[px+3,py+4],[px+10,py+12],[px+10,py+29],[px+4,py+38]],side?'#2d5064':'#583143');
          line(c,[[px+4,py+4],[px+39,py+4]],hues[side],1.4);
          line(c,[[px+30,py+14],[px+22,py+19],[px+24,py+25],[px+15,py+32]],colors[side],1.2);continue;
        }
        panel(c,px+1,py+2,unit-2,unit-3,(i+side)%2?'#202133':'#25273c',4);
        const seam=side?'#385160':'#4f394a';
        line(c,[[px+4,py+13],[px+4,py+6],[px+11,py+6]],seam,1);
        if((i+side)%3===0){
          line(c,[[px+25,py+37],[px+36,py+26]],seam,1);
          line(c,[[px+31,py+38],[px+37,py+32]],seam,1);
        }
        if(tile==='*'){polygon(c,[[px+21,py+7],[px+35,py+21],[px+21,py+35],[px+7,py+21]],colors[side],hues[side],2);type(c,'±',px+21,py+21,13,'#fff');}
        if(i===goal[side]){
          const radius=14+Math.sin(clock*4)*2;oval(c,px+21,py+24,radius,radius*.74,colors[side],hues[side],3);
          oval(c,px+21,py+24,radius*.52,radius*.4,null,hues[side],1);
        }
      }
      const u=api.reducedMotion?1:1-motion,from=previous[side],to=state[side];
      const cx=x+21+unit*((from%5)*(1-u)+(to%5)*u),cy=y+22+unit*(Math.floor(from/5)*(1-u)+Math.floor(to/5)*u);
      oval(c,cx,cy+15,15,5,colors[side],hues[side],1);
      const pose=pause?'cheer':motion>.15 && from!==to?'run'+Math.floor(clock*12)%4:'stand';
      const sprite=herSprite(pose,side?3:1);c.save();c.imageSmoothingEnabled=false;
      if(flashes[side] && motion>.25)c.globalAlpha=.62;
      c.drawImage(sprite.canvas,cx-15,cy-22,30,40);c.restore();
    }
    nextRoom();
    return {
      key(t,k){if(t!=='down')return;const a=moveCodes.indexOf(k),b=['KeyW','KeyD','KeyS','KeyA'].indexOf(k);
        if(a>=0||b>=0)act(Math.max(a,b));else if(k==='KeyZ'||k==='Backspace')undo();else if(k==='KeyH')reveal();},
      pointer(t,x,y){
        if(t==='down'){press=[x,y];if(y>=396){press=null;if(y>445){if(x<240)undo();else reveal();}else{const a=controls.findIndex(([cx])=>Math.abs(cx-x)<31);if(a>=0)act(a);}}}
        if(t==='cancel'){press=null;return;}
        if(t==='up'&&press){const dx=x-press[0],dy=y-press[1];press=null;if(Math.max(Math.abs(dx),Math.abs(dy))>16)act(Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0);}
      },cancelInput(){press=null;},
      update(dt){clock+=dt;motion=Math.max(0,motion-dt*6);if(pause>0 && (pause-=dt)<=0){if(++index===mirrors.length){done=true;api.end(points,[['Mirrors reunited',6],['Commands',total]],'Turns out both versions of me wanted the same thing.');}else nextRoom();}},
      demo(dt){if(done||pause>0)return;demoClock+=dt;if(demoClock>.37){demoClock=0;const p=route();if(p?.length)act(p[0]);else undo();}},
      draw(c){
        c.fillStyle='#121220';c.fillRect(0,0,480,480);art(c,0,127,512,184,0,0,480,141);
        panel(c,8,7,139,23,'#151322d9',4);type(c,'MIRROR LAB  /  0'+(Math.min(index,5)+1),77,19,11,'#fff5dc','center','monospace');
        panel(c,0,108,480,34,'#121220dd',0);type(c,room.name,12,125,20,'#fff5de','left','Georgia');
        type(c,(state[2]?'−':' +')+'  '+(index<2?'LINKED':state[2]?'NEGATIVE':'POSITIVE'),465,125,12,hues[state[2]],'right','monospace');
        for(let s=0;s<2;s++){type(c,names[s],s?253:15,153,13,hues[s],'left','monospace');const steer=s?room.axes.map(a=>arrows[(a+state[2]*2)%4]):arrows.slice(0,4);type(c,steer.join('  '),s?462:225,153,13,'#efeaff','right');drawBoard(c,s);}
        type(c,hint<0?lineText:'Hint  ·  '+(hint===4?'Use the relay':arrows[hint]),240,393,12,'#ffedc6');
        type(c,'MOVE',47,418,12,'#ddd9e9','center','monospace');
        controls.forEach(([x,y],a)=>{panel(c,x-28,y-18,56,36,hint===a?'#ead4a8':a===4?'#623c70':'#363950',6);type(c,a===4?'±':arrows[a],x,y,22,hint===a?'#242436':'#fff4dd');});
        line(c,[[12,443],[468,443]],'#454158',1);type(c,'↶  UNDO',110,461,13,'#ccc5de');type(c,'◇  HINT',355,461,13,'#ccc5de');
      }
    };
  }
};
