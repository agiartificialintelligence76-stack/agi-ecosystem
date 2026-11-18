export function layout(width, height) {
  const small = height < 335;
  const wide = width >= height * 1.12;
  const pad = Math.round(Math.max(9,Math.min(30,Math.min(width,height)*.033)));
  if (wide) {
    const stageWidth = Math.round(width * (small ? .41 : .47));
    return {small,wide,pad, stage:{x:0,y:0,w:stageWidth,h:height},
      sheet:{x:stageWidth+pad,y:pad,w:width-stageWidth-pad*2,h:height-pad*2}};
  }
  const stageHeight = Math.round(height * (height<490?.42:.48));
  return {small,wide,pad,stage:{x:0,y:0,w:width,h:stageHeight},
    sheet:{x:pad,y:stageHeight+pad*.5,w:width-pad*2,h:height-stageHeight-pad*1.5}};
}
