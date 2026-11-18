export const CUES={
 lift:[[330,480,.045,.042]],peel:[[230,590,.085,.059]],tap:[[524,285,.039,.047]],rotate:[[650,490,.037,.049]],
 slip:[[290,430,.068,.053]],foil:[[1100,1460,.094,.043],[1600,1930,.11,.030,.06]],blocked:[[205,157,.095,.056]],
 undo:[[327,494,.080,.052],[494,554,.082,.045,.063]],roller:[[172,235,.17,.051]],staple:[[827,267,.034,.062],[520,212,.030,.044,.053]],
 fold:[[440,440,.16,.045],[554,554,.18,.048,.065],[659,659,.26,.052,.13]],rule:[[440,466,.12,.045]],alarm:[[495,490,.13,.049],[370,364,.15,.045,.16]],
 stock:[[589,522,.055,.040]],title:[[392,494,.09,.049],[587,659,.15,.040,.06]],snip:[[673,378,.06,.045]],
};
export function pressSound(audio,demo=false){
 let quiet=false,last=-1,count=0,air=0;const past=new Map();
 return {play(k,time,pitch=1){if(!audio||demo||quiet||!CUES[k]||time-(past.get(k)??-6)<.07)return;if(time-last>.040||time<last){last=time;count=0;}
  if(count>=3)return;count++;past.set(k,time);
  for(const [freq,slide,dur,vol,at=0] of CUES[k])audio.tone({freq:freq*pitch,slide:slide*pitch,dur,vol,at,type:k==='staple'?'sine':'triangle',bus:'sfx',attack:.004});
  if(['peel','roller','lift','slip','fold','staple','snip'].includes(k))audio.noise({dur:k==='roller'?.24:.075,vol:k==='roller'?.051:.038,filter:k==='staple'?2800:1450,type:'bandpass',bus:'sfx'});
 },update(t,stock=0){if(audio&&!demo&&!quiet&&t>=air){air=t+1.63;audio.noise({dur:.73,vol:.013,filter:340+stock*77,type:'bandpass',bus:'music'});}},
 pause(){quiet=true;},resume(){quiet=false;},dispose(){quiet=true;}};
}
