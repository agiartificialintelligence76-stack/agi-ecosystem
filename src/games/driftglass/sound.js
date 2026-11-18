const P={
 drop:[[786,523,.10,.088],[660,988,.13,.075,.07]],link:[[395,790,.062,.076],[792,792,.058,.065,.072]],
 tell:[[1550,1110,.032,.084],[1550,1110,.032,.084,.21]],fake:[[1420,1000,.038,.070]],
 steal:[[620,210,.060,.083],[350,770,.095,.076,.054],[825,1100,.092,.068,.13]],
 block:[[675,180,.085,.1],[215,120,.075,.08,.085]],early:[[340,245,.062,.060]],empty:[[175,131,.06,.060]],
 charged:[[440,660,.09,.072],[880,880,.085,.071,.085]],boost:[[118,335,.19,.1],[247,555,.15,.061,.085]],
 bump:[[142,43,.088,.1]],near:[[944,336,.105,.077]],streak:[[650,900,.10,.072],[1046,1046,.14,.065,.09]],
 round:[[349,349,.13,.073],[440,440,.14,.068,.10],[523,523,.18,.070,.20]],
 overtime:[[380,390,.105,.083],[380,390,.105,.083,.16]],turnaround:[[688,975,.14,.077],[978,488,.15,.074,.13]],
 shift:[[215,112,.053,.065]],draft:[[830,690,.12,.054]],fuse:[[330,660,.14,.075]],work:[[460,392,.075,.079]],
 miss:[[166,151,.046,.054]],mile:[[349,523,.13,.070],[660,792,.13,.068,.12]],
};
export const CUES=Object.keys(P);
export function radioSound(audio,demo=false){
 let engineAt=0,musicAt=0,musicStep=0,muted=false,duck=0;
 const last=new Map();
 let batch=-1,foreground=0,background=0;
 const important=new Set(['tell','steal','block','round','overtime','turnaround']);
 function play(kind,now=0){
  if(!audio||demo||muted||!P[kind]||now-(last.get(kind)??-9)<.19)return;
  // Reserve two voices for possession changes and warnings when several
  // traffic events happen on the same physics step. Individual cues retain their shape.
  if(now-batch>.028||now<batch){batch=now;foreground=background=0;}
  if(important.has(kind)){if(foreground>=2)return;foreground++;}
  else{if(background>=2)return;background++;}
  last.set(kind,now);if(kind==='turnaround'||kind==='round')duck=now+.65;
  for(const [freq,slide,dur,vol,at=0] of P[kind])audio.tone({freq,slide,dur,vol:vol*.70,at,type:kind==='block'?'sawtooth':'triangle',attack:.003,bus:'sfx'});
  if(['miss','bump','block','steal','boost','near'].includes(kind))audio.noise({dur:kind==='boost'?.17:.064,vol:kind==='bump'?.050:.036,filter:kind==='bump'?850:2400,type:'bandpass',bus:'sfx'});
 }
 function update(s){
  if(!audio||demo||muted||s.phase!=='live')return;
  const t=s.time,c=s.cars[0];
  if(t>=engineAt){engineAt=t+.17;const f=59+Math.abs(c.vz)*17+(c.boost?38:0),vol=t<duck?.008:.027;
   audio.tone({freq:f,slide:f*1.05,dur:.18,vol,type:'triangle',attack:.026,bus:'sfx'});
   audio.tone({freq:f*2,dur:.13,vol:vol*.43,type:'sine',attack:.04,bus:'sfx'});
   if(c.drafting)audio.noise({dur:.17,vol:.023,filter:1400,type:'bandpass',bus:'sfx'});
  }
  if(t>=musicAt&&s.owner>=0){musicAt=t+.315;const loop=s.owner===0?[98,0,146.8,123.5,98,0,164.8,146.8]:[110,0,130.8,164.8,110,110,146.8,0];
   const n=loop[musicStep++%8];if(n)audio.tone({freq:n,slide:n*.996,dur:.19,vol:t<duck?.009:.045,type:'triangle',attack:.011,bus:'music'});
  }
 }
 return {play,update,pause(){muted=true;},resume(){muted=false;},dispose(){muted=true;}};
}
