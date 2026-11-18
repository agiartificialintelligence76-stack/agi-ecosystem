// Measure the source on the full native stereo grid. Reserve four overlapping
// action envelopes and the brief noise transient (conservative, before compression).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { records } from '../../../src/games/returnaddress/record.js';
import { SONG_GAIN } from '../../../src/games/heartbeat/music.js';
let peak=0;
for(const song of records){
  const file=fileURLToPath(new URL('../../../public/games/heartbeat/audio/'+song.id+'.mp3',import.meta.url));
  const buf=execFileSync('ffmpeg',['-v','error','-i',file,'-f','f32le','-acodec','pcm_f32le','pipe:1'],{maxBuffer:128*1024*1024});
  const pcm=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4);
  let max=0;for(const v of pcm)max=Math.max(max,Math.abs(v));
  peak=Math.max(peak,max*SONG_GAIN);console.log(song.id+' music peak '+(max*SONG_GAIN).toFixed(4));
}
const mix=peak+4*.033+.022;
console.log('Full songs at playback volume plus overlapping cues: '+mix.toFixed(4)+' ('+(20*Math.log10(mix)).toFixed(2)+' dBFS conservative bound)');
if(mix>=1)process.exitCode=1;
