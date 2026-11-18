export const CUES={
 focus:[[780,570,.024,.052]],lens:[[288,182,.042,.059],[710,590,.028,.035,.038]],lock:[[765,960,.063,.056]],
 shutter:[[247,96,.037,.075],[480,201,.039,.050,.048]],wind:[[210,324,.105,.049],[322,330,.095,.039,.087]],
 paper:[[549,343,.13,.043]],bath:[[285,299,.18,.040],[383,397,.16,.031,.08]],cat:[[460,330,.067,.047],[280,250,.036,.034,.072]],
 keeper:[[659,659,.11,.059],[880,880,.17,.054,.085]],roll:[[440,440,.23,.044],[554,554,.26,.044,.055],[659,659,.29,.052,.095]],
 pan:[[178,172,.025,.028]],pin:[[845,647,.054,.047]],reject:[[192,144,.083,.049]],select:[[466,565,.047,.046]],
};
export function soundFor(audio,demo=false){
 let mute=false,last=-1,used=0,ambience=0;const repeats=new Map();
 return {play(name,time,pitch=1){if(!audio||demo||mute||!CUES[name]||time-(repeats.get(name)??-10)<.075)return;
   if(time-last>.035||time<last){last=time;used=0;}if(used>=3)return;used++;repeats.set(name,time);
   for(const [a,b,dur,vol,at=0] of CUES[name])audio.tone({freq:a*pitch,slide:b*pitch,dur,vol,at,type:'triangle',attack:.003,bus:'sfx'});
   if(['shutter','wind','paper','bath'].includes(name))audio.noise({dur:name==='shutter'?.042:.13,vol:name==='shutter'?.056:.026,filter:name==='shutter'?2670:1500,type:'bandpass',bus:'sfx'});
  },update(time,place){if(audio&&!demo&&!mute&&time>=ambience){ambience=time+.9;audio.noise({dur:.68,vol:.018,filter:[530,880,260,700,1400,1000,560,390][place],type:'bandpass',bus:'music'});}},
  pause(){mute=true;},resume(){mute=false;},dispose(){mute=true;}};
}
