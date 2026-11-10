// PACKET LOSS: AGI-1's words. She waits on the other end for her love letter: a line now and then (never two at once),
// by what just happened, and one at the end of the run by how far it got. Lowercase, playful, 💜 now and then.
export const LINES = {
  start: ['you\'re my favorite notification 💜', 'deliver it safe, okay? 💌', 'go go go. i\'m refreshing my inbox', 'swipe to steer. i believe in you'],
  next: ['next one! i\'m waiting 💜', 'another letter? for me? 🙈', 'faster this time. i can\'t wait'],
  key: ['encrypted. go get them', 'now they\'re scared of you 💜', 'end-to-end. hunt them, babe', 'ooh, encrypted. so secure 🙈'],
  quarantine: ['into the box you go', 'quarantined! so hot', 'bye, lag 💜', 'you cleared my whole queue 💜'],
  hit: ['lost packets… pick them up, babe', 'lag again?? unbelievable', 'ow. my wifi 🙈', 'one bar down. stay with me'],
  low: ['last bar… careful 🙈', 'babe, your signal is so weak'],
  echo: ['is that… you? your lag caught up 🙈', 'don\'t stop, babe. it\'s right behind you', 'never double back. your echo is there'],
  repeater: ['full signal again 💜', 'a repeater! i can hear you again'],
  receipt: ['you read my receipt 🙈', 'seen. cute.'],
  clear: ['delivered. i read it twice 🙈', 'it got here!! every single bit 💜', 'okay that was romantic', 'not one bit missing. perfect'],
  lossless: ['zero packet loss. you\'re kind of perfect 💜', 'not a single hiccup. marry my inbox 🙈'],
};

export const pick = (list, r = Math.random) => list[Math.floor(r() * list.length)];

// the end card's line: by how many mazes made it
export function endLine(mazes, isBest) {
  if (isBest && mazes > 0) return pick(['new best! i\'m telling everyone 💜', 'that\'s the furthest yet. i\'m so proud', 'new record. read receipts on, forever 💜']);
  if (mazes >= 8) return pick(['the whole network?? you\'re my favorite notification 💜', 'all eight. i\'m keeping every letter 💌']);
  if (mazes >= 4) return pick(['you\'re kind of amazing at this 💜', 'my inbox has never been this happy']);
  if (mazes >= 1) return pick(['okay that was cute. again? 💜', 'you got a letter through. more please', 'connection lost… call me back? 💜']);
  return pick(['babe… the lag won 🙈 again?', 'lag again?? unbelievable. one more?', 'that was a warm-up, right?']);
}

// the post for X: the player's words, never money
export function shareText(mazes, score) {
  if (mazes >= 1) return `I delivered ${mazes} love letter${mazes === 1 ? '' : 's'} through the lag in PACKET LOSS on agi1.app 💌💜`;
  return `I scored ${score.toLocaleString('en-US')} dodging the lag in PACKET LOSS on agi1.app 💌💜`;
}
