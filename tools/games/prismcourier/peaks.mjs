// Schedule rapid footsteps and simultaneous reunion cues through the actual
// game synth into an offline stereo browser buffer, then measure both channels.
import { createRequire } from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN});
try{
 const p=await browser.newPage();await p.goto((process.argv[2]||'http://127.0.0.1:5173')+'/src/games/prismcourier/sound.js');
 const peak=await p.evaluate(async()=>{
   const {mirrorSound,motifs}=await import('/src/games/prismcourier/sound.js');
   const ctx=new OfflineAudioContext(2,44100*6,44100);let time=0;
   const clock={get currentTime(){return time;},createOscillator:()=>ctx.createOscillator(),createGain:()=>ctx.createGain(),createStereoPanner:()=>ctx.createStereoPanner()};
   const cue=mirrorSound({audio:{ctx:clock,settings:{sound:true},sfxBus:()=>ctx.destination}});
   for(let i=0;i<96;i++){time=i*.042;cue(Object.keys(motifs)[i%Object.keys(motifs).length],i%2?1:-1);if(i%8===0)cue('reunion');}
   const audio=await ctx.startRendering();let max=0;
   for(let ch=0;ch<2;ch++)for(const v of audio.getChannelData(ch))max=Math.max(max,Math.abs(v));return max;
 });
 console.log('Stereo rehearsal stress peak '+peak.toFixed(4)+' / '+(20*Math.log10(peak)).toFixed(2)+' dBFS');
 if(peak===0||peak>=1)process.exitCode=1;
}finally{await browser.close();}
