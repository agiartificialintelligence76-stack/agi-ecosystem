const motifs={
  move:[376,495], scuff:[151,119], mirror:[493,659], rotate:[440,587], queue:[315,473], rest:[310,232],
  slide:[790,442], plate:[795,610], exchange:[659,330,660], half:[523,659], undo:[341,228], hint:[596,795],
  reunion:[523,659,784], gallery:[523,659,784,1047], closing:[784,659,523], tape:[390,585],
};
// Each shoe sits at its own stereo position. Short envelopes give a stopped
// shoe a dry scuff and a gliding shoe a longer, descending whistle.
export function mirrorSound(api){
  let last=-1;
  return (id,side=0)=>{
    if(api.demo || !api.audio?.ctx)return;
    const c=api.audio.ctx,t=c.currentTime,kit=api.audio;
    if(kit.settings?.sound===false || (t-last<.035 && !['gallery','reunion'].includes(id)))return;
    last=t;
    const bus=kit.sfxBus?.(); if(!bus)return;
    const notes=motifs[id]||motifs.move;
    notes.forEach((f,i)=>{
      const when=t+i*(id==='reunion'||id==='gallery'?.078:.035),osc=c.createOscillator(),amp=c.createGain();
      const pan=c.createStereoPanner?.();
      osc.type=id==='scuff'?'triangle':'sine';osc.frequency.value=f;
      if(id==='slide')osc.frequency.exponentialRampToValueAtTime(f*.61,when+.18);
      amp.gain.setValueAtTime(.0002,when);amp.gain.exponentialRampToValueAtTime(.065,when+.012);
      amp.gain.exponentialRampToValueAtTime(.0002,when+(id==='slide'?.24:.13));
      osc.connect(amp);if(pan){pan.pan.value=side*.5;amp.connect(pan);pan.connect(bus);}else amp.connect(bus);
      osc.start(when);osc.stop(when+.25);osc.onended=()=>{osc.disconnect();amp.disconnect();pan?.disconnect();};
    });
  };
}
export { motifs };
