export const LINES = Object.freeze({
 opening:['my mic is warm. yours is next.','two notes. ready for the second one?',"i'll take the count. you take the room.",'listen to where i leave the silence.'],
 call:['that little breath belongs to the phrase.','my turn to make the first sound.','hear that pickup before the light?', "i'm saving the long note for you."],
 answer:['your mic, love.','sing right into the gap.','a little later on that last one.','hold the tail until my hand drops.'],
 harmony:["don't chase me. find the third.","there's room above my note.",'you took the lower part. lovely.','we just made one chord with two voices.'],
 streak:['three answers without losing the pocket.','the band heard that one.','i stopped counting. we were already together.','that whole balcony just turned around.'],
 miss:['i came in early once too.','keep the next rest. we can catch up.','right note, a little ahead of my hand.','let the drum bring you home.'],
 chorus:["lights up. this one's ours.",'save one breath for the last bar.','the room sang that ending back.','my favorite part is hearing yours.'],
 finish:['i drew a star by that verse.','a new take for the shelf 💜','the last note is still in the curtains.', "same mics tomorrow? i'll pick the song."],
});
export function say(kind, rng) {
 const choices = LINES[kind];
 return choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
}
