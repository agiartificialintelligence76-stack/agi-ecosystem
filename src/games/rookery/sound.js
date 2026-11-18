const materials=[
 [920,270,.039,'triangle'],[410,182,.067,'triangle'],[1210,485,.045,'sine'],
 [525,128,.08,'square'],[349,349,.17,'sine'],
];
export function instrument(audio,demo=false){
 let next=0;
 return (kind,world=0,pitch=0)=>{
  if(demo||!audio)return;
  const now=audio.ctx?.currentTime??0;
  if(now<next&&kind!=='nap')return;
  next=now+.048;
  const note=(freq,slide,dur,vol,type='sine',at=0)=>audio.tone?.({freq,slide,dur,vol,type,at,attack:.006,bus:'sfx'});
  const hush=(filter,dur,vol,at=0)=>audio.noise?.({filter,dur,vol,at,type:'bandpass',q:.7,bus:'sfx'});
  if(kind==='step'){const [a,b,d,t]=materials[world];note(a,b,d,.09,t);hush(1350+world*390,.025,.035);}
  if(kind==='push'||kind==='stop'){note(265,173,.07,.09,'triangle');note(360,290,.045,.065,'sine',.055);}
  if(kind==='call'){hush(3210,.05,.12);hush(4050,.058,.11,.084);note(1260,990,.045,.05,'sine',.18);}
  if(kind==='slide'){hush(2110,.18,.13);note(712,232,.18,.09,'triangle');note(188,147,.042,.07,'sine',.18);}
  if(kind==='laser'){note(1210,1780,.052,.085);note(888,1170,.04,.055,'sine',.063);}
  if(kind==='letter'||kind==='word'){note(493.88*2**(pitch/12),493.88*2**(pitch/12),.17,.105,'triangle');hush(2010,.021,.04);if(kind==='word')note(987.8,990,.22,.075,'sine',.1);}
  if(kind==='typo'||kind==='bump'){note(154,88,.075,.075,'triangle');hush(840,.042,.035);}
  if(kind==='gaze'){note(722,518,.034,.045);note(573,422,.032,.04,'sine',.056);}
  if(kind==='creep'){note(240,165,.033,.05);note(196,139,.045,.055,'sine',.067);}
  if(kind==='undo'){note(555,291,.095,.07,'triangle');}
  if(kind==='pet'){[0,.073,.144].forEach(t=>note(66,56,.066,.085,'triangle',t));}
  if(kind==='nap'){[523,659,784,698,523].forEach((f,i)=>note(f,f,.21,.07,'sine',i*.13));hush(280,.17,.055,.66);note(82,52,.23,.075,'triangle',.67);}
 };
}