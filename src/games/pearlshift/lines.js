export const LINES = {
  "opening": ["headphones down into the blue.", "hear the long note to port?", "our first singer isn't shy.", "i'll keep the deck quiet for you."],
  "ping": ["one clean ripple coming back.", "move the receiver before we ask again.", "that line's too shallow. widen our baseline.", "save one ping for the way out."],
  "depth": ["a thermocline bent that echo.", "try listening under the cold layer.", "hear how the lower voice clears?", "both traces bend at the same depth."],
  "chorus": ["two singers. follow the broken trill.", "leave the booming one in the background.", "that little rising pair is our friend.", "three voices and a very patient sea."],
  "lock": ["both bearings land in the same patch.", "i heard her turn before i saw the trace.", "beautiful fix. hardly a ripple.", "put a little star by that recording."],
  "miss": ["that's the other voice in the chorus.", "we're behind her. she kept swimming.", "the surface echo fooled me too.", "give the water a second to settle."],
  "find": ["listen. that's the whole song.", "new voice for our field log.", "she sang her name in three notes.", "we found her with a ping to spare."],
  "night": ["the dark makes every voice feel close.", "the receiver is yours again tomorrow.", "i'm saving this little duet 💜", "lights out on the bridge. good listening."]
};
export function voice(event, count = 0) {
  const list = LINES[event] || LINES.opening;
  return list[Math.abs(count) % list.length];
}
