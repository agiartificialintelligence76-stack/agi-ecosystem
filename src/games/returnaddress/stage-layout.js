export function stageLayout(w,h) {
  const wide = w/h>1.36, margin=Math.max(5,Math.min(w,h)*.026);
  const header=Math.max(39,Math.min(77,h*.14));
  const dw=(wide?w*.7:w)-margin*2,dh=h-header-margin*2;
  const rx=Math.min(dw*.44,dh*.79), ry=Math.min(dh*.344,rx*(wide?.71:.88));
  return {wide,margin,header,rx,ry,cx:margin+dw*.5,cy:header+margin+dh*.52};
}
export function ellipsePoint(l,lane,a){
  const r=.46+lane*.21;
  return [l.cx+Math.cos(a)*l.rx*r,l.cy+Math.sin(a)*l.ry*r];
}
