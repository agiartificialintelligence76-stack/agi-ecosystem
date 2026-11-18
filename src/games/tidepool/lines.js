export const LINES = {
  opening: ['i left a record spinning for you.', 'headphones on one ear, okay?', 'see the little light on deck two?', 'our first caller wants something soft.'],
  cue: ['that sleeve has a big opening.', 'line the first kick up with mine.', 'leave the fader here while you listen.', 'hold that cue. the chorus is coming.'],
  blend: ['ease her in on the one.', 'the two kicks just shook hands.', 'that fader landed like a feather.', 'let the old voice leave the room.'],
  request: ['someone on the night bus wants a lift.', 'give me a little room after that chorus.', 'a listener drew stars on their card.', 'we have enough energy. find a breath.'],
  streak: ['three blends and no loose edges.', 'that sounded like one long record.', 'both needles agree with you.', 'i wrote that pairing on my sleeve.'],
  mistake: ['you caught the beat after the door closed.', 'a good song in the wrong part of town.', 'let the outgoing snare finish.', 'we can rescue the shape of this side.'],
  unlock: ['you’ve earned the long lead-in.', 'new cut. wait until you hear the tail.', 'i saved that request for a rainy shift.', 'try the short edit on a busy floor.'],
  closing: ['side b is for the ride home.', 'i drew your initials on the label 💜', 'the last caller stayed for the silence.', 'keep the tape. i’ll find us another.'],
  audition: ['i hear the hi-hat in my left ear.', 'that’s the little room before the chorus.', 'leave one ear on the room.'],
  manual: ['you have the fader. i have the kettle.', 'both records are live. easy on the middle.', 'there. the old deck can breathe.'],
  missed: ['the outgoing record carried us. pick the next one.', 'we missed the request. the station is still here.', 'the next caller gets a fresh phrase.'],
  best: ['new best mix. i put a star on the spine.', 'that’s the take i’m keeping. 💜'],
};
export function say(event, variation) {
  const choices = LINES[event];
  return choices[Math.abs(variation) % choices.length];
}
