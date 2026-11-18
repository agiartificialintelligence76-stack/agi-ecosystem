export function layout(w,h){
  const pad=Math.max(6,Math.min(w,h)*.025), head=Math.min(82,Math.max(37,h*.115));
  const stacked=w<570 && h>w*1.02, floor=32, available=h-head-floor;
  const size=stacked ? Math.min(w*.63,(available-pad*3)/2) : Math.min(w*.44,(available-pad*3)*.88);
  const rowHeight=(available-pad*2)/2;
  const boxes=stacked ? [
    {x:pad*1.8,y:head+pad+(rowHeight-size)/2,size},
    {x:w-pad*1.8-size,y:head+rowHeight+pad*2+(rowHeight-size)/2,size},
  ]:[0,1].map(i=>({x:w*(i?.735:.265)-size/2,y:head+(available-size)/2,size}));
  return {w,h,pad,head,boxes,floor,stacked};
}
export function cellPoint(box,n){
  return [box.x+(n%5+.5)*box.size/5,box.y+(Math.floor(n/5)+.5)*box.size/5];
}
