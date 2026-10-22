// Original procedural score and effects. No audio files, borrowed music, network calls or autoplay.
// start() must be called by the shell from a real pointer/key gesture. update() alone never creates audio.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi,x));
const note = (midi) => 440 * 2 ** ((midi-69)/12);
const level = (value, fallback) => typeof value==='boolean' ? Number(value) : Number.isFinite(value) ? clamp(value,0,1) : fallback;

export function createAudio(initial = {}) {
  let ctx=null, master=null, musicBus=null, sfxBus=null, rainGain=null, rainSource=null, timer=null, dead=false;
  let settings={music:.55,sfx:.8,muted:false,...initial}, nextStep=0, step=0, stage=0, tension=0, active=true;
  let lastEvent=0,lastElapsed=-1,lastState=null,noiseBuffer=null,lastMix='';
  const voices=new Set();
  function disconnectLater(node, gain, filter=null) {
    voices.add(node); node.onended=()=>{voices.delete(node);try{node.disconnect();gain?.disconnect();filter?.disconnect();}catch{/* An already closed context has nothing left to release. */}};
  }
  function oscillator(freq, at, duration, volume, type='triangle', bus=musicBus, endFreq=null, cutoff=null) {
    if(!ctx||!bus||dead)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(Math.max(20,freq),at);
    if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),at+duration);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+Math.min(.015,duration*.15));gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    let filter=null;if(cutoff){filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.55;osc.connect(filter);filter.connect(gain);}else osc.connect(gain);
    gain.connect(bus);disconnectLater(osc,gain,filter);osc.start(at);osc.stop(at+duration+.025);
  }
  function noise(at,duration,volume,cutoff=3000,bus=sfxBus,highpass=false) {
    if(!ctx||!bus||!noiseBuffer||dead)return;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=noiseBuffer;
    filter.type=highpass?'highpass':'lowpass';filter.frequency.value=cutoff;filter.Q.value=.6;
    gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(volume,at+.005);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(filter);filter.connect(gain);gain.connect(bus);disconnectLater(source,gain,filter);source.start(at,Math.random()*.5);source.stop(at+duration+.03);
  }
  function kick(at,power=1) {oscillator(100,at,.24,.42*power,'sine',musicBus,34);noise(at,.035,.10*power,700,musicBus);}
  function snare(at) {noise(at,.14,.16,2000,musicBus,true);oscillator(170,at,.08,.10,'triangle',musicBus,80);}
  function pad(notes,at) {
    if(!ctx)return;
    for(const [i,m]of notes.entries()){
      oscillator(note(m),at+i*.018,2.45,.036,'triangle',musicBus,null,1300);
      oscillator(note(m)*1.004,at+i*.018,2.4,.014,'sawtooth',musicBus,null,750);
    }
  }
  function schedule() {
    if(dead||!ctx||ctx.state!=='running')return;
    const now=ctx.currentTime;
    if(nextStep<now-.2)nextStep=now+.02;
    // Sixteen steps per bar, composed in D minor; different districts reharmonize the same motif.
    const tempo=active?(tension?108:96):72, interval=60/tempo/4;
    let guard=0;
    while(nextStep<now+.16&&guard++<8){
      const beat=step%16, bar=Math.floor(step/16)%4, root=[38,34,41,36][bar]+(stage===1?-2:stage===2?2:0);
      if(active){
        if(beat%4===0||tension&&beat===14)kick(nextStep,tension?1:.82);
        if(beat===4||beat===12)snare(nextStep);
        if(beat%2===0)noise(nextStep,.035,beat%4===0?.025:.045,6500,musicBus,true);
        if([0,3,6,8,11,14].includes(beat)){const n=root+(beat===6||beat===14?12:0);oscillator(note(n),nextStep,.20,.18,'sawtooth',musicBus,null,330+tension*200);}
        if(beat%2===1){const motif=[0,7,12,10,7,3,10,7], n=root+24+motif[(beat-1)/2];oscillator(note(n),nextStep,.29,.038,'triangle',musicBus,null,2300);oscillator(note(n),nextStep+.19,.25,.012,'sine',musicBus);}
      }
      if(beat===0)pad([root+12,root+19,root+22,root+26],nextStep);
      step++;nextStep+=interval;
    }
  }
  function volumes() {
    if(!ctx)return;const t=ctx.currentTime,muted=settings.muted||lastState?.status==='paused';
    const key=[muted,settings.music,settings.sfx,stage].join(':');if(key===lastMix)return;lastMix=key;
    master.gain.setTargetAtTime(muted?0:.5,t,.06);
    musicBus.gain.setTargetAtTime(level(settings.music,.55)*.62,t,.08);
    sfxBus.gain.setTargetAtTime(level(settings.sfx,.8)*.65,t,.04);
    rainGain.gain.setTargetAtTime(level(settings.music,.55)*(stage===1?.025:.055),t,.3);
  }
  async function start() {
    if(dead)return false;
    if(!ctx){
      const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!AC)return false;
      try{
        ctx=new AC();master=ctx.createGain();musicBus=ctx.createGain();sfxBus=ctx.createGain();
        const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-17;compressor.knee.value=20;compressor.ratio.value=5;compressor.attack.value=.005;compressor.release.value=.18;
        musicBus.connect(master);sfxBus.connect(master);master.connect(compressor);compressor.connect(ctx.destination);
        noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=noiseBuffer.getChannelData(0);
        let brown=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;brown=(brown+white*.02)/1.02;data[i]=white*.5+brown*2;}
        rainSource=ctx.createBufferSource();rainSource.buffer=noiseBuffer;rainSource.loop=true;rainGain=ctx.createGain();
        const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2300;rainSource.connect(filter);filter.connect(rainGain);rainGain.connect(master);rainSource.start();
        nextStep=ctx.currentTime+.035;lastMix='';volumes();timer=setInterval(schedule,75);
      }catch{try{await ctx?.close();}catch{/* Unsupported audio fails silently. */}ctx=null;return false;}
    }
    try{if(ctx.state==='suspended')await ctx.resume();schedule();return ctx.state==='running';}catch{return false;}
  }
  function effect(ev) {
    if(!ctx||ctx.state!=='running'||settings.muted||settings.sfx===0||dead)return;
    const t=ctx.currentTime+.005, power=clamp(Number(ev.amount)||15,5,80)/50;
    switch(ev.type){
      case 'attack':
        noise(t,.11,.13,1400);oscillator(ev.kind==='kick'?210:330,t,.10,.075,'triangle',sfxBus,70);break;
      case 'enemyAttack':
        noise(t,.10,.09,1900);oscillator(260,t,.12,.045,'triangle',sfxBus,85);break;
      case 'hit':
        noise(t,.09,.20+power*.08,1100);oscillator(150,t,.13,.26,'sine',sfxBus,38);oscillator(580,t,.045,.08,'square',sfxBus,150);break;
      case 'block':
        oscillator(580,t,.12,.11,'triangle',sfxBus,260);oscillator(1250,t,.13,.045,'sine',sfxBus);noise(t,.07,.1,4200);break;
      case 'hurt':case 'down':
        oscillator(180,t,.24,.17,'sawtooth',sfxBus,42,1200);noise(t,.13,.13,800);break;
      case 'dodge':
        noise(t,.17,.18,3800);oscillator(140,t,.16,.06,'sine',sfxBus,590);break;
      case 'jump':
        oscillator(170,t,.14,.08,'triangle',sfxBus,420);break;
      case 'special':case 'duo':{
        const duo=ev.type==='duo';noise(t,duo?.75:.4,.3,1500);oscillator(72,t,duo?.85:.55,.32,'sawtooth',sfxBus,28,900);
        for(let i=0;i<5;i++)oscillator(note(62+i*3),t+i*.035,.4,.08,'triangle',sfxBus, note(74+i*3));break;}
      case 'kill':
        oscillator(115,t,.27,.2,'sine',sfxBus,29);noise(t,.17,.18,650);break;
      case 'pickup':
        [74,81,86].forEach((n,i)=>oscillator(note(n),t+i*.055,.15,.07,'sine',sfxBus));break;
      case 'wave':case 'waveClear':case 'upgrade':case 'stage':
        [62,65,69,74].forEach((n,i)=>oscillator(note(n),t+i*.09,.32,.09,'triangle',sfxBus));break;
      case 'boss':case 'bossPhase':
        [38,39,50].forEach((n,i)=>oscillator(note(n),t+i*.16,.9,.12,'sawtooth',sfxBus,null,1100));noise(t,.8,.1,700);break;
      case 'victory':
        [62,65,69,74,77,81].forEach((n,i)=>oscillator(note(n),t+i*.13,.65,.1,'triangle',sfxBus));break;
      case 'gameover':
        [57,53,50,38].forEach((n,i)=>oscillator(note(n),t+i*.2,.65,.1,'triangle',sfxBus));break;
      case 'tag':
        oscillator(430,t,.1,.07,'sine',sfxBus,860);oscillator(860,t+.06,.12,.06,'triangle',sfxBus);break;
      default:break;
    }
  }
  return {start,
    update(state){
      if(dead)return;lastState=state;
      if(state&&state.elapsed<lastElapsed){lastEvent=0;step=0;nextStep=ctx?ctx.currentTime+.035:0;}
      if(state){lastElapsed=state.elapsed;stage=clamp(state.stage||0,0,2);tension=state.boss&&!state.boss.dead&&state.boss.hp>0?1:0;active=['playing','play','running'].includes(state.status);}
      else active=false;
      // Events remain in a bounded engine history. Consume their IDs even when muted/locked to prevent delayed repeats.
      for(const ev of state?.events||[])if(ev.id>lastEvent){lastEvent=ev.id;effect(ev);}
      volumes();
    },
    setOptions(next={}){settings={...settings,...next};volumes();},
    get started(){return !!ctx&&ctx.state==='running';},
    destroy(){if(dead)return;dead=true;clearInterval(timer);timer=null;for(const voice of voices)try{voice.stop();}catch{/* Voice already ended. */}voices.clear();try{rainSource?.stop();}catch{/* Already stopped. */}const old=ctx;ctx=null;if(old)old.close().catch(()=>{});},
  };
}
