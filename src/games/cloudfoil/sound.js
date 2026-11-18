// The postal horn and felt thumps use short stereo oscillators. The live engine
// idles independently so raising charge and pitching into descent are audible.
export const cues={
 charge:['triangle',151,112,.12], launch:['sine',275,710,.19], trim:['sine',340,292,.061],
 far:['sine',680,470,.12], middle:['triangle',430,535,.09],near:['sine',443,700,.12],
 center:['triangle',160,61,.16],edge:['sawtooth',255,91,.12],parcel:['sine',740,1200,.09],
 chute:['triangle',410,72,.29],reboard:['triangle',392,522,.18],relay:['triangle',523,784,.23],
 firstclass:['sine',523,1046,.24],home:['sine',659,880,.23],complete:['triangle',784,1046,.32],
 finish:['triangle',349,196,.32],creak:['triangle',113,70,.08],gust:['sine',455,333,.22],
};
export function airSound(api){
 let motor=null,amp=null,previous=-1,last=-2;
 const nodes=new Set();
 function ready(){return !api.demo&&api.audio?.ctx&&api.audio.settings?.sound!==false;}
 function cue(id,streak=0){
  if(!ready()||!cues[id])return;
  const ctx=api.audio.ctx,t=ctx.currentTime,bus=api.audio.sfxBus();
  if(t-last<.035&&id===previous)return;
  previous=id;last=t;
  const [wave,start,end,length]=cues[id];
  const motif=id==='firstclass'?[1,1.25,1.5,2]:id==='complete'||id==='relay'?[1,1.25,1.5]:[1];
  for(const [i,ratio] of motif.entries()){
   const osc=ctx.createOscillator(),g=ctx.createGain(),p=ctx.createStereoPanner?.(),when=t+i*.09;
   const rise=id==='center'?1+Math.min(8,streak)*.052:1;
   osc.type=wave;osc.frequency.setValueAtTime(start*ratio*rise,when);
   osc.frequency.exponentialRampToValueAtTime(end*ratio*rise,when+length);
   g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(wave==='sawtooth'?.034:.072,when+.009);
   g.gain.exponentialRampToValueAtTime(.0001,when+length);osc.connect(g);
   if(p){p.pan.value=id==='far'?-.45:id==='near'?.45:i*.1;g.connect(p);p.connect(bus);}else g.connect(bus);
   nodes.add(osc);osc.start(when);osc.stop(when+length+.02);
   osc.onended=()=>{nodes.delete(osc);osc.disconnect();g.disconnect();p?.disconnect();};
  }
 }
 function hush(){
  if(motor){motor.stop();motor.disconnect();amp.disconnect();motor=amp=null;}
 }
 function engine(power,air){
  if(!ready()){hush();return;}
  const c=api.audio.ctx;
  if(!motor){
   motor=c.createOscillator();amp=c.createGain();motor.type='triangle';amp.gain.value=.018;
   motor.connect(amp);amp.connect(api.audio.sfxBus());motor.start();
  }
  motor.frequency.setTargetAtTime(47+power*22+(air?9:0),c.currentTime,.08);
 }
 function stop(){hush();for(const node of nodes){try{node.stop();}catch{}}}
 return {cue,engine,stop};
}
