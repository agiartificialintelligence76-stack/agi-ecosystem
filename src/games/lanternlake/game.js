import { drawExhibit } from './exhibit.js';
import { CASES } from './cases.js';
import { painting, panel, type, line } from '../kit/illustration.js';

const booth = painting(new URL('./studio.webp',import.meta.url));
const ink='#16272a', cream='#fbefcf', mint='#a8e1bd', red='#b44838';
const numbered = n => String(n+1).padStart(2,'0');
function words(c,text,x,y,width,size,height,color,family='Georgia'){
  c.fillStyle=color;c.font=size+'px '+family;c.textAlign='left';c.textBaseline='top';
  let row='';for(const word of text.split(' ')){const next=row?row+' '+word:word;
    if(row&&c.measureText(next).width>width){c.fillText(row,x,y);row=word;y+=height;}else row=next;
  }c.fillText(row,x,y);
}
export function program(rng){
  const pool=CASES.slice();
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,4);
}
export default {
 title:'OFF THE RECORD',tagline:'Join AGI-1 in the midnight booth. Every caller has one detail their evidence cannot explain.',
 instructions:[['Read the caller','Use the arrows to browse three statements. Press for detail to hear AGI-1 ask a follow-up.'],
 ['Cross-check the file','Mark a suspicious statement, then turn over the exhibits to read their evidence. Present the item that directly contradicts it. You can go back and change your statement.'],
 ['Keep your audience','A wrong accusation costs one listener light. Solve four cases to hear the sign-off. Every new show draws from six stories.']],
 keys:[['← →','Browse a statement or exhibit'],['Space','Mark, present or continue'],['Q / B','Press for detail / back'],['F','Turn over the exhibit']],
 touch:[['Arrow keys on desk','Browse the file'],['Tap an exhibit','Turn it over'],['Desk buttons','Press, mark, present or go back']],
 create(api){
  const cases=program(api.rng);let index=0,tab='voice',pick=0,marked=0,lives=3,solved=0,score=0,clock=0,demoTime=0,wrong=0;
  let flipped=false, angle=0, inspected=new Set();
  let announced='';
  let comment='midnight line is open. let’s hear their side.',miss=-1;
  const current=()=>cases[index];
  const hud=()=>api.hud('On air',Math.min(index+1,4)+'/4','Listeners','●'.repeat(lives)||'—');
  function turn(d){if(tab==='reveal')return;pick=(pick+d+3)%3;flipped=false;angle=0;miss=-1;api.sound('tick');}
  function flip(){if(tab!=='file')return;flipped=!flipped;if(flipped)inspected.add(index+'-'+pick);api.sound('tap');}
  function detail(){if(tab==='voice'){comment=current().statements[pick][1];api.sound('select');}
    else if(tab==='file'){tab='voice';pick=marked;comment='okay. let’s check the other statements.';}}
  function finish(){tab='off';api.end(score,[['Cases closed',solved+' / 4'],['Listeners',lives],['Wrong leads',wrong]],solved===4?'we’re off the air. i saved you the good headphones.':'the line went quiet. come back for the late show.');}
  function submit(){
    if(tab==='voice'){marked=pick;pick=0;flipped=false;angle=0;tab='file';miss=-1;comment='which exhibit puts that line in doubt?';api.sound('click');}
    else if(tab==='file'){
      if(!inspected.has(index+'-'+pick)){comment='turn it over first. the proof is on the other side.';return;}
      const [s,e]=current().answer;
      if(marked!==s||pick!==e){lives--;wrong++;miss=pick;comment='that evidence can coexist with the statement. listen again.';api.sound('error');hud();
        if(!lives){finish();return;}tab='voice';pick=marked;return;}
      solved++;score+=170+lives*20;tab='reveal';comment=current().reply;api.sound('clear');api.haptic(16);hud();
    }else if(tab==='reveal'){
      if(index===3){finish();return;}index++;tab='voice';pick=0;miss=-1;comment='new voice on line two. i’m all ears.';hud();
    }
  }
  hud();return {
    update(dt){clock+=dt;
      if(api.announce&&tab!=='off'){const entry=current();
        const detail=tab==='voice'?entry.statements[pick][0]:tab==='file'?(flipped?entry.exhibits[pick][1]:entry.exhibits[pick][0]):entry.reveal;
        const speech=entry.name+'. '+detail+' '+comment;if(speech!==announced){announced=speech;api.announce(speech);}}
      const dest=flipped?Math.PI:0;angle+=Math.sign(dest-angle)*Math.min(Math.abs(dest-angle),dt*8);},
    key(t,k){if(t!=='down')return;if(k==='ArrowLeft')turn(-1);else if(k==='ArrowRight')turn(1);else if(k==='KeyF')flip();else if(k==='KeyB'||k==='KeyQ')detail();else if(k==='Space'||k==='Enter')submit();},
    pointer(t,x,y){if(t!=='down'||tab==='off')return;if(tab==='reveal'){if(y>396)submit();return;}
      if(tab==='file'&&y>=250&&y<=348){flip();return;}
      if(y>411){if(x<170)detail();else submit();}else if(y>345&&y<402)turn(x<240?-1:1);},
    demo(dt){demoTime+=dt;if(demoTime<1.05)return;demoTime=0;
      if(tab==='reveal')submit();else if(tab==='voice'){if(pick!==current().answer[0])turn(1);else submit();}
      else if(tab==='file'){if(pick!==current().answer[1])turn(1);else if(!flipped)flip();else submit();}},
    draw(c){
      c.fillStyle=ink;c.fillRect(0,0,480,480);booth(c,0,99,650,350,0,0,480,170);
      panel(c,13,12,77,22,'#a32c2c',2);type(c,'● ON AIR',51,23,12,'#fff1d1','center','monospace');
      panel(c,0,138,480,51,'#122527f4',0);type(c,'AGI-1  /  01:17 AM',13,149,10,mint,'left','monospace');
      words(c,comment,13,159,451,13,15,'#fff3da','Arial');
      c.fillStyle='#c78960';c.fillRect(0,190,480,290);panel(c,11,197,458,212,'#e4cfaa',4);panel(c,16,201,447,205,cream,3);
      const entry=current();type(c,(tab==='reveal'?'CASE CLOSED':'CALL '+numbered(index))+'    /    '+entry.name.toUpperCase(),29,218,12,red,'left','monospace');
      line(c,[[29,233],[451,233]],'#bfa887');
      if(tab==='reveal'){words(c,entry.reveal,30,254,411,22,27,ink);type(c,'FILED BY AGI-1',29,384,12,red,'left','monospace');}
      else {
        type(c,tab==='file'?'EXHIBIT '+numbered(pick)+'  /  03':entry.caller,30,250,15,ink,'left');
        if(tab==='file'){drawExhibit(c,entry,pick,angle);}
        else{words(c,'“'+entry.statements[pick][0]+'”',29,269,420,25,29,ink);words(c,entry.subject,30,328,415,15,16,'#655c50','Arial');}
        type(c,'◀  PREV',72,380,14,ink,'center','monospace');type(c,numbered(pick)+' / 03',240,380,13,red,'center','monospace');type(c,'NEXT  ▶',405,380,14,ink,'center','monospace');}
      if(tab!=='reveal'){panel(c,14,418,145,49,'#274143',5);type(c,tab==='file'?'Back to caller':'Press for detail',86,443,16,cream);}
      const x=tab==='reveal'?14:169;panel(c,x,418,466-x,49,tab==='reveal'?'#a8dcac':'#9e3932',5);
      type(c,tab==='reveal'?(index===3?'Sign off  →':'Next caller  →'):tab==='file'?'Present this exhibit':'Mark this statement',(466+x)/2,443,18,tab==='reveal'?ink:cream);
    },
  };
 }
};
