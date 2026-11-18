// In a browser: await renderPeak(OfflineAudioContext). The normal instrument
// schedules its actual notes into a real one-channel Web Audio render. The mix
// below omits the shared master compressor, so its peak is conservative.
import {radioSound,CUES} from '../../../src/games/driftglass/sound.js';
import {configuration,createDuel} from '../../../src/games/driftglass/duel.js';
export async function renderPeak(Offline,subset=CUES){
 const rate=44100,ctx=new Offline(1,rate*4,rate),noise=ctx.createBuffer(1,rate,rate);
 const data=noise.getChannelData(0);let rnd=8391;
 for(let i=0;i<data.length;i++){rnd=(Math.imul(rnd,1664525)+1013904223)>>>0;data[i]=rnd/0x80000000-1;}
 let now=0;const sfx=ctx.createGain(),music=ctx.createGain();sfx.connect(ctx.destination);music.gain.value=.8;music.connect(ctx.destination);
 const bus=n=>n==='music'?music:sfx;
 const api={
  tone({freq,type,dur,vol,at=0,slide,attack=.004,bus:b}){
   const t=now+at,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);
   if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+attack);g.gain.setValueAtTime(vol,t+Math.max(attack,dur*.4));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
   o.connect(g);g.connect(bus(b));o.start(t);o.stop(t+dur+.02);
  },
  noise({dur,vol,filter,type,bus:b}){
   const f=ctx.createBiquadFilter(),g=ctx.createGain(),n=ctx.createBufferSource();n.buffer=noise;n.loop=true;
   f.type=type;f.frequency.value=filter;f.Q.value=.7;g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(.0001,now+dur);
   n.connect(f);f.connect(g);g.connect(bus(b));n.start(now,.17);n.stop(now+dur+.02);
  }
 };
 const mixer=radioSound(api),duel=createDuel(configuration('check',0,7));duel.owner=0;duel.cars[0].boost=.8;duel.cars[0].drafting=true;
 for(let i=0;i<24;i++){
  now=i*.135;duel.time=now;duel.owner=i%2;mixer.update(duel);
  // All gestures, traffic reactions, handoff and station stings at once.
  for(let j=0;j<subset.length;j++)mixer.play(subset[(i+j)%subset.length],now);
 }
 const result=(await ctx.startRendering()).getChannelData(0);let peak=0,power=0,peakAt=0,index=0;
 for(const sample of result){if(Math.abs(sample)>peak){peak=Math.abs(sample);peakAt=index;}index++;power+=sample*sample;}
 return {sampleRate:rate,cues:subset.length,seconds:4,peak,peakAt,dbfs:20*Math.log10(peak),rms:Math.sqrt(power/result.length)};
}
