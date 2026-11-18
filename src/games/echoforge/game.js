import { painting, oval, panel, type, line } from '../kit/illustration.js';

const singer=painting(new URL('./nightclub.webp',import.meta.url).href);
export const songs=[
  {name:'Velvet Hello',bpm:86,beats:4,notes:[[0,0],[1,1],[2,2]],lyric:['Stay','with','me'],root:261.63},
  {name:'Lavender Radio',bpm:94,beats:4,notes:[[0,1],[.75,2],[1.5,1],[3,0]],lyric:['On','the','air','now'],root:246.94},
  {name:'After the Rain',bpm:94,beats:5,notes:[[0,2],[1,1],[2.5,0],[3.25,1],[4,2]],lyric:['Can','you','hear','me','now'],root:293.66},
  {name:'Borrowed Starlight',bpm:102,beats:5,notes:[[0,0],[.5,0],[1.5,2],[2,1],[3,0],[4,2]],lyric:['Take','my','hand','and','stay','close'],root:261.63},
  {name:'One More Chorus',bpm:106,beats:6,notes:[[0,2],[.75,1],[1.5,0],[2.25,1],[3,2],[4,0],[5,1]],lyric:['Meet','me','where','the','lights','go','low'],root:293.66},
];
const hues=['#ff9798','#ffdb7a','#b8a9ff'], labels=['LOW','MID','HIGH'];
const padX=[21,169,317], keyLabels=['A','S','D'];
export function answerPitch(note,harmony){return (note+Number(harmony))%3;}
const pitchRatio=[1,1.259921,1.498307];
export default {
  title:'DUET AFTER DARK',
  tagline:'Step up to AGI-1’s microphone. Listen to her phrase, sing it back, or take the harmony part.',
  instructions:[['Let her sing','AGI-1 sings a short line. Watch the three pitches and read the syllables on her score.'],['Answer on your cue','When the record turns to YOU, strike the same pads in time. The moving light follows the beat.'],['Take the harmony','Shift each note one pad right, wrapping High back to Low. On this part she sings along with you, and the reply sheet shows just the rhythm.']],
  keys:[['A / S / D','Low / Mid / High'],['Space','Echo or harmony'],['R','Hear this line again']],
  touch:[['Tap the three keys','Play your part'],['Tap Echo / Harmony or Replay','Change part or rehearse']],
  create(api){
    let song=0,s,beat,called=0,graded,part=false,hits=0,points=0,clear=0,duets=0,perfect=0,attemptPoints=0;
    let clock=0,lastTick=-1,spot=[0,0,0],word='',message='',after=0,passed=false,ended=false,portraitPulse=0,trackBest=0;
    function begin(){s=songs[song];beat=-1;called=0;graded=s.notes.map(()=>null);hits=0;attemptPoints=0;lastTick=-1;trackBest=api.personalBest?.('take-'+song)??0;
      message='Listen to my line.';word='';after=0;passed=false;api.hud('Record',String(song+1)+' / '+songs.length,'Applause',points);}
    function phase(){return beat<s.beats?'CALL':beat<s.beats+1?'CUE':'REPLY';}
    function voice(lane,source){
      const f=s.root*pitchRatio[lane],vocal=source==='her';
      if(api.tone){
        api.tone({freq:f,type:vocal?'sawtooth':'triangle',dur:vocal?.37:.31,filter:vocal?1080:2000,attack:.027,vol:vocal?.07:.15});
        api.tone({freq:f*2,type:'sine',dur:.26,vol:.045,attack:.037});
      }else api.sound('tap',{pitch:f/660,spread:0});
      spot[lane]=1;portraitPulse=1;
    }
    function toggle(){if(ended||after>0||graded.some(Boolean))return;part=!part;message=part?'Harmony is one pad to the right.':'Echo my notes exactly.';api.sound('select');}
    function strike(lane){
      if(ended||after>0)return;
      voice(lane,'you');
      if(phase()!=='REPLY'){message='My turn. Your cue comes next.';return;}
      const b=beat-(s.beats+1);
      const target=s.notes.findIndex(([time],i)=>!graded[i] && Math.abs(b-time)<(song<2?.44:.37));
      if(target<0){message='Between notes. Watch the light.';return;}
      const [time,note]=s.notes[target];
      if(lane!==answerPitch(note,part)){message='Try '+labels[answerPitch(note,part)].toLowerCase()+'.';return;}
      const exact=Math.abs(time-b)<.17;
      graded[target]=exact?'perfect':'good';hits++;attemptPoints+=(exact?105:65)+(part?45:0);
      message=exact?(part?'That chord!':'Right in tune.'):'We caught it.';word=s.lyric[target];api.haptic(exact?12:7);
      if(part)voice(note,'her');
      api.hud('Record',String(song+1)+' / 5','Applause',points+attemptPoints);
    }
    function replay(){if(ended||after>0)return;begin();api.sound('back');}
    function settle(){
      passed=hits>=Math.ceil(s.notes.length*.65);
      if(passed){clear++;points+=attemptPoints;perfect+=graded.filter(x=>x==='perfect').length;if(part)duets++;
        message=trackBest&&attemptPoints>trackBest?'New best take!':hits===s.notes.length?'That is the take.':'Keep that take.';
        api.rememberBest?.('take-'+song,attemptPoints);api.sound('clear');}
      else{message='One more take. Follow my pitches.';api.sound('back');}
      word=passed?'Thank you!':'Again?';after=1.1;
    }
    begin();
    return {
      key(t,k){if(t!=='down')return;const a=['KeyA','KeyS','KeyD'].indexOf(k),b=['ArrowLeft','ArrowDown','ArrowRight'].indexOf(k);if(a>=0||b>=0)strike(Math.max(a,b));else if(k==='Space')toggle();else if(k==='KeyR')replay();},
      pointer(t,x,y){if(t!=='down')return;if(y>=357&&y<=437){const a=padX.findIndex(left=>x>=left&&x<=left+140);if(a>=0)strike(a);}else if(y>=440){if(x<292)toggle();else replay();}},
      update(dt){
        if(ended)return;clock+=dt;portraitPulse=Math.max(0,portraitPulse-dt*2.3);spot=spot.map(s=>Math.max(0,s-dt*3));
        if(after>0){after-=dt;if(after<=0){if(passed && ++song===songs.length){ended=true;api.end(points,[['Tracks cut',clear],['Harmony takes',duets],['Perfect notes',perfect]],'Your part is on the record. So is my smile.');}else begin();}return;}
        beat+=dt*s.bpm/60;const whole=Math.floor(beat);
        if(beat>=0 && whole!==lastTick){lastTick=whole;if(api.tone)api.tone({freq:s.root*(whole%2?.75:.5),dur:.12,type:'triangle',vol:.075,attack:.01,bus:'music'});else api.sound('tick',{pitch:.62,spread:0});}
        while(called<s.notes.length&&beat>=s.notes[called][0]){voice(s.notes[called][1],'her');word=s.lyric[called++];}
        if(phase()==='CUE'){word='Your turn';message=part?'Sing one pad higher.':'Echo me.';}
        const reply=beat-s.beats-1;
        s.notes.forEach(([time],i)=>{if(!graded[i]&&reply>time+(song<2?.44:.37))graded[i]='miss';});
        if(reply>=s.beats)settle();
      },
      demo(){if(ended||after>0)return;if(beat<0 && part!==(song%2===1))toggle();if(phase()!=='REPLY')return;const b=beat-s.beats-1;s.notes.forEach(([at,note],i)=>{if(!graded[i]&&b>=at)strike(answerPitch(note,part));});},
      draw(c){
        c.fillStyle='#1e102d';c.fillRect(0,0,480,480);
        c.save();c.beginPath();c.rect(0,0,480,246);c.clip();
        const zoom=api.reducedMotion?0:portraitPulse*3;
        singer(c,0,42,512,340,-zoom,-zoom,480+zoom*2,277+zoom*2);
        c.restore();
        const grad=c.createLinearGradient(0,135,0,247);grad.addColorStop(0,'#160a2300');grad.addColorStop(1,'#21102b');c.fillStyle=grad;c.fillRect(0,135,480,112);
        panel(c,12,12,114,23,'#21102bdf',12);type(c,'●  SIDE A  /  0'+(Math.min(song,4)+1),69,24,11,'#ffc9a1','center','monospace');
        for(let i=0;i<9;i++){const h=6+18*spot[i%3]+(api.reducedMotion?0:3*Math.sin(clock*9+i));panel(c,435+i*3.5,40-h,2,h,hues[i%3],1);}
        if(word){panel(c,309,126,146,33,'#26132ad9',17);type(c,word,382,142,19,'#fff2cc','center','Georgia');}
        type(c,s.name,19,216,31,'#fff0d1','left','Georgia');
        type(c,Math.round(s.bpm)+' BPM',459,218,12,'#f5b9c9','right','monospace');
        const label=after>0?(passed?'TAKE SAVED':'REHEARSE'):phase()==='CALL'?'AGI-1 SINGS':phase()==='CUE'?'GET READY':'YOUR VOICE';
        panel(c,18,240,134,24,phase()==='REPLY'?'#ffe6a4':'#793958',12);
        type(c,label,85,252,12,phase()==='REPLY'?'#331c39':'#fff0dd','center','monospace');
        type(c,message,462,252,13,'#f8d9c4','right');
        const start=41,span=394,base=328;
        for(let i=0;i<3;i++)line(c,[[22,base-i*17],[458,base-i*17]],'#5f3b5c',1);
        const reply=phase()==='REPLY',pos=reply?beat-s.beats-1:beat;
        s.notes.forEach(([t,n],i)=>{const x=start+t*span/(s.beats-.5),lane=reply?answerPitch(n,part):n,y=base-lane*17;
          if(reply&&part&&!graded[i]){
            oval(c,x,base-17,5,5,null,'#dcc8df',1.5);type(c,s.lyric[i],x,346,11,'#edd7cc');return;
          }
          const missed=reply && graded[i]==='miss',color=missed?'#6e526c':hues[lane];
          oval(c,x,y,8,5,color);line(c,[[x+7,y],[x+7,y-13]],color,2);
          type(c,s.lyric[i],x,346,11,missed?'#9f819c':'#edd7cc');if(reply && ['good','perfect'].includes(graded[i]))type(c,'✓',x,276,12,'#a3f2c4');});
        if(phase()!=='CUE'&&after<=0){const x=start+Math.max(0,Math.min(s.beats-.5,pos))*span/(s.beats-.5);line(c,[[x,277],[x,334]],'#fffbec',2);}
        padX.forEach((x,i)=>{panel(c,x,363,140,72,'#0f0b1d',11);panel(c,x,359+spot[i]*3,140,68,spot[i]>.3?'#fff4e0':hues[i],11);
          type(c,keyLabels[i],x+22,379,12,'#51354e','left','monospace');type(c,labels[i],x+70,399,22,'#392137','center','Georgia');});
        type(c,part?'◉  HARMONY  +1':'◉  ECHO PART',118,458,13,'#ffd4aa','center','monospace');type(c,'↶  HEAR AGAIN',367,458,13,'#d7b9dc','center','monospace');
      }
    };
  }
};
