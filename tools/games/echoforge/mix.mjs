// Measure all real source samples. Report a deliberately conservative maximum
// mix as well: assume full song-bus gain and aligned oscillator peaks rather
// than relying on a kit compressor to hide a hot vocal overdub.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {songs,arrange} from '../../../src/games/echoforge/setlist.js';
import {MIX} from '../../../src/games/echoforge/sound.js';
const ffmpeg=process.env.FFMPEG_BIN || createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
const db=peak=>(20*Math.log10(Math.max(.000001,peak))).toFixed(2)+' dBFS';
for(const tune of songs){
  const audio=fileURLToPath(new URL('../../../public/games/heartbeat/audio/'+tune.id+'.mp3',import.meta.url));
  const decoded=spawnSync(ffmpeg,['-v','error','-i',audio,'-f','f32le','-ac','2','-ar','44100','pipe:1'],{maxBuffer:96*1024*1024});
  if(decoded.status!==0)throw Error(String(decoded.error||decoded.stderr));
  const samples=new Float32Array(decoded.stdout.buffer,decoded.stdout.byteOffset,decoded.stdout.length/4);
  let peak=0;
  for(const value of samples)peak=Math.max(peak,Math.abs(value));
  const chart=arrange({tune,difficulty:'headliner',part:'upper',seed:7});
  const changes=[];
  function voice(t,duration,level){changes.push([t,level],[t+duration+.03,-level]);}
  for(const call of chart.calls)voice(call.at,Math.max(.105,call.duration),MIX.voice+MIX.breath);
  for(const n of chart.notes){
    const duration=Math.max(.13,Math.min(.75,n.until-n.at));
    voice(n.at,duration,MIX.player+MIX.breath);
    voice(n.at,duration*.9,MIX.voice+MIX.breath);
  }
  changes.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let active=0,maxVoices=0;
  for(const [,v] of changes){active+=v;maxVoices=Math.max(maxVoices,active);}
  const ceiling=peak*MIX.song*.8+maxVoices+3*.031+MIX.crowd+.056;
  console.log(tune.title+': decoded '+db(peak)+' / clean backing '+db(peak*MIX.song*.8)+' / aligned vocal + cue ceiling '+db(ceiling));
  if(ceiling>=1)process.exitCode=1;
}
