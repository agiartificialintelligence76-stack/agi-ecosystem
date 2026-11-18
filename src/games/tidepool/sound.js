import { equalPower } from './rules.js';
import { byId } from './catalog.js';

export const DECK_GAIN = .46;
export const CUE_GAIN = .12;
export const trackURLs = id => ['/games/heartbeat/audio/' + id + '.mp3', '/music/' + id + '.mp3'];

// Keep only the decks in use and the cued record. Decoded full-length stereo
// recordings are much larger than their MP3s. Drop superseded fetches promptly.
export function createRecordBank(context, fetcher = globalThis.fetch) {
  const entries = new Map();
  function retain(ids) {
    for (const [id, entry] of entries) {
      if (!ids.includes(id)) {
        entry.abort.abort();
        entries.delete(id);
      }
    }
  }
  function load(id) {
    if (entries.has(id)) return entries.get(id).promise;
    const abort = new AbortController();
    const entry = {abort};
    entry.promise = (async () => {
      let last;
      for (const url of trackURLs(id)) {
        try {
          const response = await fetcher(url, {signal:abort.signal});
          if (!response.ok) throw new Error('Recording ' + response.status);
          const data = await response.arrayBuffer();
          if (abort.signal.aborted) throw new Error('Superseded');
          const buffer = await context.decodeAudioData(data);
          if (abort.signal.aborted) throw new Error('Superseded');
          return buffer;
        } catch (err) {
          last=err;
          if (abort.signal.aborted) break;
        }
      }
      throw last;
    })().catch(err => {
      if(entries.get(id)===entry)entries.delete(id);
      throw err;
    });
    entries.set(id,entry);
    return entry.promise;
  }
  return { load, retain, get size(){return entries.size;} };
}

export function fadeCurve(incoming, from=0, steps=65) {
  return Float32Array.from({length:steps},(_,i) => {
    const p=from+(1-from)*i/(steps-1);
    return DECK_GAIN*equalPower(p)[incoming?1:0];
  });
}
function stopVoice(voice) {
  if (!voice) return;
  try { voice.source.stop(); } catch { /* already ended */ }
  voice.source.disconnect();
  voice.gain.disconnect();
  voice.meter?.disconnect();
}

export function createDeskSound(kit, {demo=false,onUnavailable=()=>{},fetcher=globalThis.fetch}={}) {
  const context=!demo && kit?.ctx;
  if(!context)return { now:s=>s, input:s=>s, sync(){}, cue(){}, sfx(){}, meter:()=>null, pause(){}, resume(){}, dispose(){} };
  const bus=kit.musicBus();
  const bank=createRecordBank(context,fetcher);
  const decks=[null,null], pending=[null,null], generation=[0,0], meterData=new Float32Array(256);
  let cueVoice=null, cueId=null, cueGen=0, suspended=false, disposed=false, base=context.currentTime, previousPhase='',warmed='';
  const warned=new Set();
  function now(fallback) { return suspended||context.state!=='running'?fallback:Math.max(0,context.currentTime-base); }
  function input(fallback, stamp) {
    if(suspended||context.state!=='running')return fallback;
    const heard=context.getOutputTimestamp?.();
    if(!heard || !Number.isFinite(stamp) || !(heard.performanceTime>0))return now(fallback);
    if(Math.abs(stamp-performance.now())>1000)return now(fallback);
    return Math.max(0,Math.min(now(fallback)+.01,heard.contextTime+(stamp-heard.performanceTime)/1000-base));
  }
  function voice(buffer, rate, volume, offset, when, short=false) {
    if(offset>=buffer.duration-.02)return null;
    const source=context.createBufferSource(),gain=context.createGain(),meter=context.createAnalyser();
    source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=volume;meter.fftSize=256;
    source.connect(gain);gain.connect(meter);meter.connect(bus);
    const safe=Math.max(0,offset);
    if(short)source.start(when,safe,Math.min(2.0,buffer.duration-safe));
    else source.start(when,safe);
    return {source,gain,meter};
  }
  function retain(s) {
    bank.retain([s.onAir.track,s.fade?.next.track,s.choices[s.selected],cueId].filter(Boolean));
  }
  function killDeck(side) {
    generation[side]++;pending[side]=null;stopVoice(decks[side]);decks[side]=null;
  }
  function cleanCue() {cueGen++;cueId=null;stopVoice(cueVoice);cueVoice=null;}
  function arm(side,deck,start) {
    const id=[deck.track,deck.edit,start].join('/');
    if(pending[side]===id)return;
    killDeck(side);
    const version=generation[side];pending[side]=id;
    bank.load(deck.track).then(buffer=>{
      if(disposed||suspended||generation[side]!==version)return;
      const when=context.currentTime+.016, elapsed=Math.max(0,when-base-start);
      const active=voice(buffer,deck.rate,0,deck.offset+elapsed*deck.rate,when);
      if(active){decks[side]=active;previousPhase='';}
    }).catch(()=>{if(!disposed&&!suspended&&generation[side]===version&&!warned.has(deck.track)){warned.add(deck.track);onUnavailable(deck.track);}});
  }
  function sync(s) {
    if(disposed||suspended)return;
    arm(s.side,s.onAir,s.started);
    const other=1-s.side;
    if(s.fade)arm(other,s.fade.next,s.fade.when);
    else if(pending[other])killDeck(other);
    retain(s);
    // Warming the next sleeve lets the incoming downbeat start on time.
    const warm=s.choices[s.selected];
    if(warm&&warm!==warmed){warmed=warm;bank.load(warm).catch(()=>{});}
    const phase=[s.turn,s.fade?.when??'-',s.fade?.manual?s.fade.position:'auto',Boolean(decks[0]),Boolean(decks[1])].join('/');
    if(phase===previousPhase)return;
    previousPhase=phase;
    const current=context.currentTime;
    decks.forEach((v,side)=>{
      if(!v)return;
      const param=v.gain.gain;
      param.cancelScheduledValues(0);
      if(!s.fade){param.setTargetAtTime(side===s.side?DECK_GAIN:0,current,.012);return;}
      const incoming=side!==s.side;
      if(s.fade.manual){param.setTargetAtTime(DECK_GAIN*equalPower(s.fade.position)[incoming?1:0],current,.014);return;}
      const start=base+s.fade.when, remaining=start+s.fade.duration-current;
      const pos=Math.min(1,Math.max(0,(current-start)/s.fade.duration));
      if(remaining>.015)param.setValueCurveAtTime(fadeCurve(incoming,pos),Math.max(current,start),remaining);
      else param.setTargetAtTime(incoming?DECK_GAIN:0,current,.008);
    });
  }
  function cue(s) {
    if(disposed||suspended||s.fade)return;
    cleanCue();
    const id=s.choices[s.selected],cut=byId[id].cuts[s.config.edits[s.edit]];
    cueId=id;const version=cueGen;
    bank.load(id).then(buffer=>{
      if(version!==cueGen||disposed||suspended)return;
      const at=context.currentTime+.012;
      cueVoice=voice(buffer,1,CUE_GAIN,cut.offset,at,true);
      if(cueVoice){
        const current=cueVoice;
        current.source.onended=()=>{
          if(cueVoice!==current)return;
          current.source.disconnect();
          current.gain.disconnect();
          current.meter.disconnect();
          cueVoice=null;
          cueId=null;
        };
        const param=cueVoice.gain.gain;param.setValueAtTime(.0001,at);param.linearRampToValueAtTime(CUE_GAIN,at+.04);param.setValueAtTime(CUE_GAIN,at+1.7);param.linearRampToValueAtTime(.0001,at+1.98);}
    }).catch(()=>{});
  }
  function sfx(name,step=0) {
    if(disposed||suspended)return;
    const note=(freq,dur,vol,type='triangle',at=0,slide)=>kit.tone({freq,dur,vol,type,at,slide,bus:'sfx'});
    if(name==='select'){note(380,.039,.045);note(660,.035,.025,'sine',.035);}
    if(name==='edit')note(585,.09,.055,'triangle',0,800);
    if(name==='window'){note(425,.075,.045);note(850,.06,.032,'sine',.11);}
    if(name==='fade')note(275,.08,.042,'triangle',0,370);
    if(name==='request'){note(587,.08,.035,'sine');note(784,.105,.03,'sine',.10);}
    if(name==='early')note(230,.07,.04,'sine',0,195);
    if(name==='miss')note(310,.16,.052,'triangle',0,152);
    if(name==='land'){const pitch=[440,494,554,659,740,880][Math.min(5,step)];note(pitch,.105,.055);note(pitch*1.5,.14,.043,'sine',.077);}
    if(name==='signoff'){[440,554,659,880].forEach((f,i)=>note(f,.16,.04,'triangle',i*.085));}
  }
  function meter(side) {
    const m=decks[side]?.meter;if(!m)return null;
    m.getFloatTimeDomainData(meterData);
    let sum=0;for(const x of meterData)sum+=x*x;
    return Math.min(1,Math.sqrt(sum/meterData.length)*5.1);
  }
  function pause() {suspended=true;warmed='';cleanCue();killDeck(0);killDeck(1);previousPhase='';}
  function resume(t) {if(disposed)return;base=context.currentTime-t;suspended=false;previousPhase='';}
  function dispose() {disposed=true;pause();bank.retain([]);}
  return {now,input,sync,cue,sfx,meter,pause,resume,dispose};
}
