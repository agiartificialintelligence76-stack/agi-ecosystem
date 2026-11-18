import { arrange, chooseTake, phraseAt, songs, voicePitch } from './setlist.js';
import { Performance } from './performance.js';
import { excerpt, player } from './player.js';
import { soundtrack } from './sound.js';
import { readBook, keepTake, takeKey } from './progress.js';
import { say } from './lines.js';
import { layout } from './layout.js';
import { scoreSheet } from './notation.js';
import { stage } from './stage.js';
import { rng } from '../kit/fx.js';

const ids=['low','middle','high'];
const keys=['KeyA','KeyS','KeyD'];
const offsets=[-100,-50,0,50,100];
const controls=[
  {id:'low',label:'●  Low',key:'A'}, {id:'middle',label:'◆  Mid',key:'S'}, {id:'high',label:'▲  High',key:'D'},
];
const pct = value => Math.round(value*100)+'%';
const capital = value => value[0].toUpperCase()+value.slice(1);
const values = names => names.map(id=>({id,label:capital(id)}));
function respond(note,kind,delta) {
  if(kind==='wrong')return 'Pitch · try '+['low','mid','high'][note.lane];
  if(kind==='short')return 'Hold the note to the tail';
  if(kind==='miss')return 'Miss · catch the next beat';
  if(kind==='perfect')return 'Perfect · in the pocket';
  return (delta<0?'Early':'Late')+' · '+Math.abs(Math.round(delta*1000))+' ms';
}
export default {
  title:'DUET AFTER DARK',
  tagline:'Her songs. Two microphones. Answer AGI-1 on the beat, then come back to sing the harmony.',
  instructions:[
    ['Listen to her bar','AGI-1 sings a short call over one of her seven recordings. The note shapes show the pitch. The spaces show when to sing.'],
    ['Answer in time','When the light passes to your microphone, play the shown pitches on the next bar. Keep a long note down until the end of its tail.'],
    ['Choose your part','Lead echoes her line. Upper and lower harmony shift the notes by one pad and combine the two voices. The score shows your own part on your turn.'],
  ],
  keys:[['A / S / D','Play or hold low / mid / high'],['← / ↓ / →','Alternate pitch keys']],
  touch:[['Low / Mid / High','Play or hold your note'],['Tap a note on her score','Audition that pitch during her call']],
  modes:[{id:'setlist',label:'Setlist'},{id:'rehearse',label:'Chorus rehearsal'},{id:'daily',label:'Daily duet'}],
  options:[
    {id:'song',label:'Recording',values:[{id:'rotate',label:'Pick a record for me'},...songs.map(s=>({id:s.id,label:s.title}))]},
    {id:'difficulty',label:'Arrangement',values:values(['soundcheck','studio','headliner'])},
    {id:'part',label:'Voice',values:[{id:'lead',label:'Echo the lead'},{id:'upper',label:'Upper harmony'},{id:'lower',label:'Lower harmony'}]},
    {id:'sync',label:'Input delay',values:[{id:'0',label:'0 ms'},...offsets.filter(ms=>ms!==0).map(ms=>({id:String(ms),label:(ms>0?'+':'')+ms+' ms'}))]},
  ],
  controls,
  scoreGroup({mode,options,seed}) {
    if (mode==='daily') return 'daily/'+seed;
    const {tune,difficulty,part}=chooseTake(seed,mode,options);
    return [mode,tune.id,difficulty,part].join('/');
  },
  progress(save) {
    const entries=Object.values(readBook({read:()=>save}).records);
    if (!entries.length) return '';
    const best=new Map();
    for (const entry of entries) {
      if (entry && Number.isFinite(entry.accuracy) && (!best.has(entry.song) || best.get(entry.song).accuracy<entry.accuracy)) best.set(entry.song,entry);
    }
    return 'Songbook · '+best.size+' of 7 recorded · '+[...best.values()].map(entry=>entry.song+' '+entry.grade).join(' / ');
  },
  create(api) {
    const seed=api.seed ?? Math.floor((api.rng?.() ?? .5)*0xffffffff);
    const mode=api.mode || 'setlist';
    const options=api.options || {};
    const selection=chooseTake(seed,mode,options);
    const full=arrange(selection);
    const rehearsal=mode==='rehearse';
    const chart=api.demo||rehearsal ? excerpt(full,Math.ceil(full.phrases.length*.30),api.demo?7:12) : full;
    const dice=rng(seed ^ 0x37b42c);
    const auto=player(chart,'preview',seed);
    const song=soundtrack(api,chart,chart.start || 0);
    const delay=offsets.includes(Number(options.sync))?Number(options.sync)/1000:0;
    let time=chart.start || 0;
    let phrase=chart.phrases[0];
    let wasReply=false, finished=false,paused=false,cheer=0,lastSpeech=-100,streakPhrases=0,showRetry=false;
    let feedback={text:'',ttl:0};
    const releaseQueue=new Map();
    const speak=(kind,force=false)=>{
      if(!force && time-lastSpeech<2.1)return;
      api.say?.(say(kind,dice.next));
      lastSpeech=time;
    };
    function setFeedback(text,ttl=1.0){feedback={text,ttl};}
    function hud(){
      api.hud?.('Applause',run.points,'Take',run.judged ? pct(run.accuracy):'—');
    }
    function onEvent(event){
      if(event.type==='judge'){
        setFeedback(respond(event.note,event.kind,event.delta));
        if(event.kind==='perfect'){
          api.haptic?.(7);
          if(run.combo>0 && run.combo%16===0)api.effect?.('streak',run.combo+'×');
        }
        if(event.kind==='short')song.feedback('short');
        if(['wrong','miss','short'].includes(event.kind)&&event.note.index%6===0)speak('miss');
        hud();
      }else if(event.type==='hold'){
        setFeedback('Hold · follow the tail');
      }else if(event.type==='phrase'){
        streakPhrases=event.accuracy>=.8?streakPhrases+1:0;
        if(event.accuracy>=.965){
          cheer=.65;
          api.effect?.('clear','Clean phrase');
        }
        if(streakPhrases>0 && streakPhrases%3===0){
          cheer=1.4; speak('streak'); song.feedback('streak');
        }
      }else if(event.type==='stray'){
        setFeedback('Rest · leave a little silence',.55);
      }
    }
    const run=new Performance(chart,onEvent);
    const old=readBook(api.store).records[takeKey(chart)];
    setFeedback(old?'Your best take · '+old.grade+' / '+Math.round(old.accuracy/10)+'%':'Listen · then sing it back',2.2);
    hud();speak(chart.part==='lead'?'opening':'harmony',true);

    function input(down,lane,when){
      if(finished||paused)return;
      if(!down){song.endVowel(lane);run.release(lane,when);return;}
      if(releaseQueue.has(lane)){
        song.endVowel(lane);run.release(lane,releaseQueue.get(lane));releaseQueue.delete(lane);
      }
      if(run.held.has(lane))return;
      const active=phraseAt(chart,when);
      const target=run.press(lane,when);
      const lead=(lane+(chart.part==='upper'?2:chart.part==='lower'?1:0))%3;
      const pitch=voicePitch(active.chord,lane,chart.part,lead);
      if(target&&lane===target.lane){
        const duration=Math.max(.13,Math.min(.75,target.until-target.at));
        if(target.until>target.at)song.beginVowel(lane,pitch,duration);
        else song.vocal(pitch,duration,0,'you');
        if(chart.part!=='lead')song.vocal(target.leadMidi,duration*.9,0,'her');
      }else{
        song.vocal(pitch,.11,0,'you');
      }
    }
    function physical(down,lane,stamp) {
      if(lane<0||lane>2||finished||paused)return;
      const when=song.eventTime(stamp)-delay;
      // The shell releases all controls before announcing a pause. Defer the
      // release for one simulation tick so that pause never cuts a held vowel.
      if(!down)releaseQueue.set(lane,when);
      else input(true,lane,when);
    }
    function finish(){
      if(finished)return;
      finished=true;
      const result=run.report();
      const saved=!api.demo&&!rehearsal ? keepTake(api.store,chart,result,mode==='daily'?String(seed):null):null;
      song.feedback('final');
      song.dispose();
      const summary=[['Grade',result.grade],['Accuracy',pct(result.accuracy)],['Perfect notes',result.counts.perfect],
        ['Best streak',result.bestCombo],['Recording',chart.title],['Voice',capital(chart.part)]];
      api.end(result.score,summary,saved?.better?'a new take for the shelf 💜':say('finish',dice.next));
    }
    return {
      action(id,type,_value,stamp){
        if(id==='retry-audio' && type==='down' && song.failed){song.retry();return;}
        const lane=ids.indexOf(id);if(lane>=0)physical(type==='down',lane,stamp);
      },
      key(type,code,stamp){
        let lane=keys.indexOf(code);
        if(lane<0)lane=['ArrowLeft','ArrowDown','ArrowRight'].indexOf(code);
        if(lane>=0)physical(type==='down',lane,stamp);
      },
      pointer(type,x,y,w,h){
        if(type!=='down'||!w||!h||time>=phrase.reply||paused||finished)return;
        const {sheet}=layout(w,h);
        if(x<sheet.x||x>sheet.x+sheet.w||y<sheet.y+sheet.h*.23||y>sheet.y+sheet.h*.74)return;
        const gutter=Math.max(9,Math.min(25,sheet.w*.055));
        const offset=(x-sheet.x-gutter-6)/(sheet.w-2*gutter-16)*4;
        const note=phrase.notes.find(n=>Math.abs(n.offset-offset)<.27);
        if(note){song.vocal(note.leadMidi,.16,0,'you');setFeedback('Audition · '+['low','mid','high'][note.lead],.7);}
      },
      pause(){paused=true;releaseQueue.clear();run.releaseInputs();song.pause();},
      resume(){if(!finished){paused=false;song.resume();}},
      cancelInput(){releaseQueue.clear();run.releaseInputs();},
      dispose(){finished=true;releaseQueue.clear();song.dispose();},
      demo(){if(!finished&&!paused)auto(time,input);},
      update(dt){
        if(finished||paused)return;
        for(const [lane,when] of releaseQueue){song.endVowel(lane);run.release(lane,when);}
        releaseQueue.clear();
        time=song.update(dt);
        if(song.failed!==showRetry) {
          showRetry=song.failed;
          api.controls?.(showRetry?[...controls,{id:'retry-audio',label:'Retry recording'}]:controls);
          if(showRetry)api.say?.('my backing track missed its cue. you can retry it while we sing.');
        }
        cheer=Math.max(0,cheer-dt);feedback.ttl=Math.max(0,feedback.ttl-dt);
        run.advance(time-delay);
        const current=phraseAt(chart,time);
        if(current.index!==phrase.index){
          if(current.section!==phrase.section){
            cheer=1.25;api.effect?.('chorus',current.label);song.feedback('chorus');speak('chorus',true);
          }else if(current.index%6===0)speak('call');
          phrase=current;
        }
        const reply=time>=phrase.reply;
        if(reply&&!wasReply&&phrase.index<2)speak('answer',true);
        wasReply=reply;
        if(time>=chart.duration)finish();
      },
      draw(ctx,w=480,h=480){
        const board=layout(w,h);
        ctx.fillStyle='#302038';ctx.fillRect(0,0,w,h);
        const v={chart,time,phrase,run,cheer,feedback,reduced:Boolean(api.reducedMotion)};
        stage(ctx,board.stage,v);scoreSheet(ctx,board.sheet,v,board.small);
      },
    };
  },
};
