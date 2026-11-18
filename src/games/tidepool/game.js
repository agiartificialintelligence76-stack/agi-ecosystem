import { artwork, clamp, ellipse, label, line, paintArtwork, rect, sky } from '../kit/garden-art.js';
import { settings } from '../kit/store.js';
import { DEMO } from '../kit/env.js';

const catalog = [
  ['Feel the AGI','feel-the-agi',128,3,'#dc75b2'], ['SI (It’s Better)','si-its-better',123,2,'#dbab71'],
  ['Send It','send-it',130,4,'#f4abc9'], ['MAINRUNNER','mainrunner',134,5,'#b8a5f7'],
  ['Save Slot 2','save-slot-2',129,1,'#80d6df'], ['AGI.','agi',150,5,'#bf9de3'], ['After AGI','after-agi',142,2,'#96c3aa'],
].map(([title,id,bpm,heat,color])=>({title,id,bpm,heat,color,cover:artwork('/games/heartbeat/covers/'+id+'.webp')}));
const edits=['Intro','Hook','Encore'];
const moods=['','sleepy','soft','glowing','bold','electric'];
const lines=['keep me company on the night shift.','give me a sunset with the windows down.','i need a walk-home anthem.','i want to feel like the main character.','okay. final boss music, please.'];
function energy(track, edit){return clamp(track.heat+edit-1,1,5);}
export function gradeTrack(track,edit,target,previous,repeated){
  const mood=Math.max(0,48-15*Math.abs(energy(track,edit)-target));
  const mix=previous?Math.max(0,26-Math.max(0,Math.abs(track.bpm-previous.bpm)-2)*2):24;
  return {mood,mix,points:mood+mix+(repeated?0:16)};
}
function reel(ctx,x,y,r,phase){
  ellipse(ctx,x,y,r,r,'#1a292e');ellipse(ctx,x,y,r*.80,r*.80,'#e3d6b9');ellipse(ctx,x,y,r*.53,r*.53,'#525354');
  for(let k=0;k<6;k++){const a=phase+k*Math.PI/3;ellipse(ctx,x+Math.cos(a)*r*.41,y+Math.sin(a)*r*.41,r*.13,r*.13,'#18272b');}
  ellipse(ctx,x,y,4,4,'#e0cdc3');
}
export default {
  title:'SIDE B', tagline:'Two sides of a tape. Seven songs she actually recorded.',
  instructions:[['Make her a tape','Pick a sleeve for the energy AGI-1 requests. Each side holds six blocks.'],['Cut the record','Intro softens a track, Encore lifts it. They take one, two or three blocks.'],['Blend the set','Nearby tempos blend. Use a fresh song, and fill the last block for a bonus.']],
  keys:[['1 / 2 / 3','Audition sleeve'],['Q / E','Cut length'],['Space','Dub track']],touch:[['Sleeve','Audition'],['Cut / Dub','Arrange tape']],
  create(api){
    let turn=0,blocks=6,score=0,selected=0,edit=1,history=[],choices=[],previous=null,targets=[],t=0,demoTime=0,feedback='pick a sleeve. i wrote all seven.',ended=false,player=null,checkMusic=0,bestBlend=0,filled=0;
    const roll=n=>Math.floor(api.rng()*n);
    function deal(){
      const pool=catalog.slice();choices=[];
      for(let i=0;i<3;i++)choices.push(pool.splice(roll(pool.length),1)[0]);
      selected=0;edit=Math.min(1,maxEdit());sync();
    }
    function maxEdit(){return Math.min(2,blocks-(2-turn%3)-1);}
    function sync(){api.hud('Tape',turn<3?'Side A':'Side B','Mix',score);}
    for(let i=0;i<6;i++)targets.push(1+roll(5));
    function stop(){if(player){player.pause();player=null;}}
    function audition(index,play=true){
      if(ended)return;selected=index;stop();
      if(play&&!DEMO&&typeof Audio!=='undefined'&&settings.get().music){
        player=new Audio('/games/heartbeat/preview/'+choices[index].id+'.m4a');player.volume=.35;player.play().catch(()=>{});
      }
    }
    function record(){
      if(ended)return;
      const track=choices[selected],repeat=history.slice(turn<3?0:3).some(h=>h.track.id===track.id);
      const g=gradeTrack(track,edit,targets[turn],previous,repeat);
      score+=g.points;blocks-=edit+1;history.push({track,edit});previous=track;turn++;
      if(g.mix>=22&&turn%3!==1)bestBlend++;
      feedback=g.mood===48?'“yes. that’s exactly my mood.”':g.mix>=22?'“that handoff was butter.”':'“interesting cut. keep going.”';
      api.sound(g.mood===48?'merge':'drop');api.haptic(10);
      if(turn%3===0){if(blocks===0){score+=35;filled++;feedback='“a perfect fit. flip the tape!”';}blocks=6;previous=null;}
      if(turn===6){ended=true;stop();sync();api.end(score,[['Seamless blends',bestBlend],['Full sides',filled+' / 2']],filled===2?'“this one lives in my headphones.”':'“i wrote the songs. you made the mixtape.”');return;}
      deal();
    }
    deal();
    return {
      cancelInput:stop,
      key(type,code){if(type!=='down'||ended)return;if(/^Digit[123]$/.test(code))audition(Number(code.at(-1))-1);
        if(code==='ArrowLeft')audition((selected+2)%3);if(code==='ArrowRight')audition((selected+1)%3);
        if(code==='KeyQ'||code==='KeyE')edit=(edit+(code==='KeyQ'?maxEdit():1)+maxEdit()+1)%(maxEdit()+1);
        if(code==='Space'||code==='Enter')record();},
      pointer(type,x,y){if(type!=='down'||ended)return;if(y>=260&&y<391)audition(clamp(Math.floor(x/160),0,2));
        if(y>=403&&y<=467){if(x>=312)record();else{const cut=clamp(Math.floor((x-8)/99),0,2);if(cut<=maxEdit())edit=cut;}} },
      demo(dt){if(ended)return;demoTime+=dt;if(demoTime<2.2)return;demoTime=0;let top=-1;
        choices.forEach((track,i)=>{for(let j=0;j<=maxEdit();j++){const repeated=history.slice(turn<3?0:3).some(h=>h.track.id===track.id);const g=gradeTrack(track,j,targets[turn],previous,repeated);
          const fit=turn%3===2&&blocks===j+1?35:0;if(g.points+fit>top){top=g.points+fit;selected=i;edit=j;}}});record();},
      update(dt){t+=dt;if(player){checkMusic+=dt;if(checkMusic>.2){checkMusic=0;if(!settings.get().music)stop();}}},
      draw(ctx){
        const q=Math.min(turn,5),target=targets[q],track=choices[selected];sky(ctx,'#663d4b','#3b3039');
        rect(ctx,10,10,460,234,15,'#26282c');rect(ctx,15,14,450,220,11,'#df725d');
        for(let i=0;i<5;i++)rect(ctx,20,78+i*9,440,3,0,i%2?'#eaac79':'#e38869');
        rect(ctx,27,24,426,107,7,'#f5e7c9');label(ctx,'SIDE '+(turn<3?'A':'B'),39,52,33,'#403d42','left','Georgia',900);
        label(ctx,'AGI-1   /   HOME DUB',436,47,14,'#6c4d50','right','monospace');
        label(ctx,lines[target-1],39,82,17,'#493444','left','Georgia',700);
        label(ctx,'CUT '+(q%3+1)+' OF 3   •   ENERGY '+target+'/5  '+moods[target].toUpperCase(),39,111,14,'#a0444e','left','monospace');
        rect(ctx,65,142,350,64,28,'#2b3338');rect(ctx,103,159,274,27,12,'#6c5951');
        reel(ctx,131,174,26,t*1.3);reel(ctx,350,174,26,-t*1.3);
        for(let j=0;j<6;j++)rect(ctx,178+j*20,167,15,15,2,j<6-blocks?'#ffc585':'#8a7c6d');
        label(ctx,(previous?previous.bpm+' → ':'')+track.bpm+' BPM',240,197,12,'#fff0cb','center','monospace');
        for(const [x,y] of [[25,25],[454,25],[25,219],[454,219]]){ellipse(ctx,x,y,3.5,3.5,'#70474a');line(ctx,[[x-1.5,y+1.5],[x+1.5,y-1.5]],'#f1baa0',1);}
        label(ctx,feedback,240,251,15,'#fff0d7','center','Georgia');
        choices.forEach((tr,j)=>{
          const x=10+j*157,sel=j===selected;rect(ctx,x,267,146,122,5,sel?'#f9dd99':'#af8e88');
          rect(ctx,x+4,271,138,114,2,'#302f38');
          if(tr.cover?.naturalWidth)ctx.drawImage(tr.cover,x+5,272,84,83);
          rect(ctx,x+87,272,54,83,1,tr.color);label(ctx,String(tr.bpm),x+114,295,18,'#342937','center','monospace');
          label(ctx,'BPM',x+114,312,11,'#342937','center','monospace');label(ctx,'E '+tr.heat,x+114,339,16,'#342937','center','monospace');
          label(ctx,tr.title,x+73,370,15,'#fff3dd','center','Georgia');
        });
        const max=maxEdit();
        for(let j=0;j<3;j++){const x=10+j*98,ink=j>max?'#a4959c':j===edit?'#362e38':'#f2dfc7';
          rect(ctx,x,406,92,55,7,j>max?'#554752':j===edit?'#f1c477':'#705464');
          label(ctx,edits[j],x+46,423,16,ink,'center');label(ctx,(j+1)+' block'+(j?'s':''),x+46,445,12,ink,'center','monospace');}
        rect(ctx,310,404,159,58,8,'#f4e4c3');ellipse(ctx,331,432,7,7,'#c85358');label(ctx,'DUB  E'+energy(track,edit),394,433,19,'#352e39','center','monospace',900);
      },
    };
  },
};
