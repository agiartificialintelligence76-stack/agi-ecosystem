export const SIDES = ['Velvet rope','Mirrorball','After hours','Last dance'];
const beatsPerSide=12;
export function pressRecord(rng){
  let time=1.7,lane=1;
  return Array.from({length:beatsPerSide*SIDES.length},(_,i)=>{
    const side=Math.floor(i/beatsPerSide),slot=i%beatsPerSide;
    if(i){time+=.96-side*.075+(slot===0?.6:0);}
    const seam=slot>2&&(slot===5||slot===9||(side>1&&slot===3));
    if(!seam)lane=Math.max(0,Math.min(2,lane+(rng()<.5?-1:1)));
    return {lane,time,seam,side};
  });
}
export const laneNames=['Inner','Middle','Outer'];
export function judge(beat,lane,airborne){
  if(beat.seam)return airborne?'clear':'scratch';
  return Math.abs(lane-beat.lane)<.48&&!airborne?'groove':'miss';
}
export function restoreTape(state,marks,index){
  if(state.rewinds<=0||!index)return null;
  const at=Math.max(0,index-2),snapshot=marks[at];
  if(!snapshot)return null;
  return {...snapshot,rewinds:state.rewinds-1,at};
}
