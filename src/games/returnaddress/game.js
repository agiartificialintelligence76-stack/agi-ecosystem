import { records, setlist, createSide, grade } from './record.js';
import { drawStage } from './stage.js';
import { lines } from './lines.js';
import { recordPlayer, playCue } from './sound.js';

export const modes = [{id:'tour',label:'Seven-side tour'},{id:'practice',label:'Practice a side'},{id:'daily',label:'Daily pressing'}];
const controls = [{id:'in',label:'Inside',key:'↑'},{id:'out',label:'Outside',key:'↓'},{id:'jump',label:'Jump',key:'Space'},{id:'backspin',label:'Backspin',key:'R'}];
const buttons = { ArrowUp:'in',ArrowLeft:'in',ArrowDown:'out',ArrowRight:'out',Space:'jump',KeyR:'backspin' };

export default {
  title:'NEEDLE DROP',tagline:'Skate her seven singles. Catch stars, ollie the scratches and spin back the actual record for a second take.',
  modes, controls,
  options:[{id:'cut',label:'Pressing',values:[{id:'club',label:'Club cut'},{id:'mellow',label:'Mellow cut'},{id:'dub',label:'Dub cut'}]},
    {id:'song',label:'Opening side',values:[{id:'shuffle',label:'Surprise me'},...records.map(r => ({id:r.id,label:r.title}))]}],
  instructions:[['Catch a groove','Stars travel toward AGI-1’s wheels. Change to the matching colored ring before they reach her.'],
    ['Clear the crack','A red scratch crosses all three rings. Jump just before it hits. The first 28 seconds are soundcheck. After that, 22 clean marks repair one point of needle wear.'],
    ['Save a side','Backspin to the previous bar twice per side. Practice lets you finish with any wear. Each completed pressing gets its own sleeve grade.']],
  keys:[['↑ / ↓ or ← / →','Change groove'],['Space','Jump'],['R','Backspin one bar']],
  touch:[['Inside / Outside','Move one groove'],['Jump / Backspin','Clear a scratch or rewind the record']],
  progress(save) {
    const count=Object.keys(save.vinylSleeves || {}).length;
    if (!count) return '';
    const perfect=Object.values(save.vinylSleeves).filter(v=>v.grade==='FULL COMBO').length;
    return count+' / 21 sleeves stamped · '+perfect+' full combos';
  },
  create(api) {
    const mode=api.mode || 'tour', cut=api.options?.cut || 'club', seed=api.seed ?? Math.floor(api.rng()*4294967296);
    const playlist=setlist(seed,api.options?.song,mode);
    let index=0, board, total=0, ended=false, paused=false, sideHits=0, hudKey='', lastVoice=-100, learnedLane=false;
    let pointerX, pointerY;
    const sound=recordPlayer(api,()=>api.say?.('record is offline. the groove lights still keep time.'));
    const voice=(tag,force=false)=>{
      if (!force && board.state.time-lastVoice < 3) return;
      const options=lines[tag], line=options[(Math.floor(api.rng()*options.length))];
      lastVoice=board.state.time;
      api.say?.(line);
      return line;
    };
    function hud(){
      const s=board.state, next=total+s.ledger.score, health=Math.max(0,10-s.ledger.damage);
      if (hudKey===next+'/'+health) return;
      hudKey=next+'/'+health; api.hud('Groove',next,'Needle',health+'/10');
    }
    function open(){
      board=createSide(playlist[index],cut,seed + index*104729,mode==='practice');
      lastVoice=-100; learnedLane=false; hudKey=''; hud(); voice('opening',true);
      sound.load(playlist[index].id,()=>board.state.time);
    }
    function finish(){
      const s=board.state,l=s.ledger, stamp=grade(l);
      total+=l.score; sideHits+=l.hits;
      if(!s.failed && !api.demo) api.store?.update(save=>{
        save.vinylSleeves ||= {};
        const key=s.record.id+'/'+cut, before=save.vinylSleeves[key];
        const ranks=['D','C','B','A','FULL COMBO'];
        save.vinylSleeves[key]={
          score:Math.max(l.score,before?.score||0),
          grade:ranks.indexOf(before?.grade)>ranks.indexOf(stamp)?before.grade:stamp,
        };
      });
      if(!s.failed && index+1<playlist.length){ api.effect?.('clear','SIDE STAMPED'); index++; open();return; }
      ended=true;sound.dispose();playCue(api,'close');
      api.end(total,[['Stars & clean jumps',sideHits],['Pressing',s.record.title],['Side grade',s.failed?'Needle lifted':stamp],['Longest chain',l.bestChain],['Sides cleared',s.failed?index:index+1]],voice('closing',true));
    }
    function event(kind,e){
      const s=board.state;
      if(kind==='scratch'||kind==='miss'){
        playCue(api,kind); api.effect?.('fault',kind==='scratch'?'SCRAPE':''); api.haptic?.(kind==='scratch'?28:10); voice('mistake');
      } else if(s.ledger.chain%12===0){
        playCue(api,'chorus');api.effect?.('combo',s.ledger.chain+' IN A ROW');voice('streak');
      } else if(e.chorus){
        playCue(api,'chorus');api.effect?.('chorus','CHORUS');voice('chorus');
      } else if(kind==='clear'){
        playCue(api,'landing'); api.effect?.('jump');voice('jump');
      } else { playCue(api,'star',1+Math.min(12,s.ledger.chain)*.018); }
    }
    function update(dt,stamp){
      if(ended || paused)return;
      const s=board.state, heard=sound.clock(stamp);
      board.advance(heard==null ? s.time+dt : Math.max(s.time,heard),event);
      hud(); if(s.finished) finish();
    }
    function action(id,phase,value,stamp){
      if(ended||paused||phase!=='down') return;
      // Judge the elapsed music up to the hardware input timestamp, then apply the input.
      if(stamp!=null) update(0,stamp);
      if(ended) return;
      const s=board.state;
      if(id==='in'||id==='out'){
        board.shift(id==='in'?-1:1);playCue(api,'wheels');
        if(!learnedLane){voice('change');learnedLane=true;}
      }else if(id==='jump'){
        if(board.jump()){playCue(api,'jump'); api.haptic?.(8);}
      }else if(id==='backspin'&&board.rewind()){
        sound.cue(s.time);playCue(api,'backspin');api.effect?.('backspin','↶  BACKSPIN');api.haptic?.(18);voice('backspin',true);hud();
      }
    }
    open();
    return {
      update,action,
      key(type,code,stamp){const id=buttons[code];if(id)action(id,type,undefined,stamp);},
      pointer(type,x,y,w,h,stamp){
        if(type==='down'){pointerX=x;pointerY=y;}
        if(type==='up'&&pointerX!=null){
          const delta=y-pointerY;
          action(Math.abs(delta)>24?(delta<0?'in':'out'):'jump','down',undefined,stamp);pointerX=undefined;
        } else if(type==='cancel')pointerX=undefined;
      },
      cancelInput(){pointerX=undefined;},
      pause(){paused=true;sound.pause();}, resume(){paused=false;sound.resume(board.state.time);}, dispose(){ended=true;sound.dispose();},
      demo(){
        const s=board.state, e=s.events[s.index]; if(!e)return;
        const lead=e.time-s.time;
        if(!e.scratch && lead<.77 && s.lane!==e.lane) action(s.lane>e.lane?'in':'out','down');
        if(e.scratch && lead<.19 && lead>.16 && s.time-s.lift>.6)action('jump','down');
      },
      draw(ctx,w,h){drawStage(ctx,w,h,board.state,{cut,side:index+1,total:playlist.length,reduced:api.reducedMotion});},
    };
  },
};
