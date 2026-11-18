// Measure actual PCM in all two-second cut entrances, all pairings and simultaneous
// cue bleed. Run with ffmpeg on PATH. No new audio files are written.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SONGS } from '../../../src/games/tidepool/catalog.js';
import { DECK_GAIN, CUE_GAIN } from '../../../src/games/tidepool/sound.js';
import { equalPower } from '../../../src/games/tidepool/rules.js';

const rate=12000;
const samples=[];
for (const song of SONGS) {
 const file=fileURLToPath(new URL('../../../public/games/heartbeat/audio/'+song.id+'.mp3',import.meta.url));
 for(const cut of Object.values(song.cuts)){
  const buffer=execFileSync('ffmpeg',['-loglevel','error','-ss',String(cut.offset),'-i',file,'-t','2','-f','f32le','-ac','2','-ar',String(rate),'pipe:1'],{maxBuffer:2*rate*2*8});
  samples.push({id:song.id,edit:cut.edit,pcm:new Float32Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/4)});
 }
}
const curve=[];for(let i=0;i<rate*2;i++)curve.push(equalPower(i/(rate*2-1)));
let peak=0,example,comparisons=0;
const cuePeak=Math.max(...samples.map(row=>row.pcm.reduce((m,value)=>Math.max(m,Math.abs(value)),0)))*CUE_GAIN;
for(const a of samples)for(const b of samples){
 if(a.id===b.id)continue;
 comparisons++;
 for(let i=0;i<Math.min(a.pcm.length,b.pcm.length);i++){
  const [l,r]=curve[i>>1];const value=Math.abs((a.pcm[i]*l+b.pcm[i]*r)*DECK_GAIN);
  if(value>peak){peak=value;example=a.id+'/'+a.edit+' → '+b.id+'/'+b.edit;}
 }
}
const worst=peak+cuePeak+.15;
console.log(comparisons+' recorded cut pairs; 2 s, stereo, '+rate+' Hz. Maximum two-deck peak '+peak.toFixed(4)+' ('+example+').');
console.log('Worst measured cue peak '+cuePeak.toFixed(4)+'; allowing a conservative 0.1500 for effects gives '+worst.toFixed(4)+' ('+(20*Math.log10(worst)).toFixed(2)+' dBFS) before the arcade master.');
if(worst>=1)process.exitCode=1;
