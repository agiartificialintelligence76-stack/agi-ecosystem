export function deskLayout(width, height) {
  const w=Math.max(1,width),h=Math.max(1,height);
  const side=w/h>=1.72;
  if(side){
    const left=Math.max(160,Math.min(w*.30,370));
    const cw=w-left;
    return {w,h,side,request:{x:0,y:0,w:left,h:h*.64}, meters:{x:0,y:h*.64,w:left,h:h*.36},
      decks:[{x:left+4,y:3,w:cw*.5-6,h:h-6},{x:left+cw*.5+2,y:3,w:cw*.5-6,h:h-6}]};
  }
  const requestH=Math.max(68,Math.min(h*.27,125)),meterH=Math.max(44,Math.min(h*.19,89));
  const deckY=requestH+2,deckH=Math.max(50,h-requestH-meterH-4);
  return {w,h,side,request:{x:0,y:0,w,h:requestH},meters:{x:0,y:h-meterH,w,h:meterH},
    decks:[{x:2,y:deckY,w:w/2-4,h:deckH},{x:w/2+2,y:deckY,w:w/2-4,h:deckH}]};
}
