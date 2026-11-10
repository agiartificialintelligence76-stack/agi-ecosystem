// ACCEPT ALL COOKIES: AGI-1's words (lowercase, playful, a 💜 now and then; 🙈 when flustered).
export const DONE = {
  3: ['three pixels! are you tracking me now? 💜', 'all the pixels. you’re dangerously good at this', 'cookie consent: granted 💜', 'perfect. he’s purring so loud', 'okay that was cute. again? 💜'],
  2: ['so close to all three. he still loved it', 'two pixels and a happy cat. not bad, babe', 'he ate it in one bite 🙈'],
  1: ['one pixel, one full cat. i’ll take it', 'fed! the pixels can wait… or can they?'],
  0: ['he doesn’t care about pixels. he’s just happy', 'cookie delivered. pixels: optional. cat: thrilled'],
};
export const LOST = {
  fell: ['oops. crumbs everywhere', 'he watched it fall. he’s judging us', 'the floor ate it 🙈', 'so close. again?'],
  away: ['bye bye cookie… pop-ups are sneaky', 'it floated off. close the pop-up sooner, babe'],
  bug: ['ew, a bug got it 🙈', 'malware ate the cookie. rude', 'that bug is so getting reported'],
};
export const SITE_DONE = {
  1: 'recipe blog: cleared. he read the whole life story for those',
  2: 'the news site is ours now. breaking: cat is full 💜',
  3: 'the whole feed! you fed him thirty cookies. i’m telling everyone',
};
export const PIXEL = ['a pixel! he’s so proud of you', 'tracked 💜', 'ooh shiny'];
export const START = {
  '1-1': 'swipe across the rope, babe. he’s starving',
  '1-2': 'let it swing… then snip 💜',
  '1-4': 'see the dashed circle? it ties on a new rope',
  '2-1': 'pop-ups float your cookie away. tap the ✕ to drop it',
  '2-3': 'cookie banners are solid. their buttons are bouncy',
  '2-4': 'tap the fan to puff',
  '3-1': 'bugs crumble cookies. go around them',
  '3-3': 'drag the yellow knob along its track',
  '3-5': 'in one tab, out of the other. it keeps its speed',
};
export const IDLE = ['he’s so dramatic about cookies 🙈', 'he’s tapping his paw at you', 'no rush. he says rush'];
export const NEW_SITE = { 2: 'new site unlocked: the news. pop-ups everywhere 🙈', 3: 'the social feed is open. watch out for bugs' };
export const pick = (list, r = Math.random) => list[Math.floor(r() * list.length)];
export const doneLine = (stars, r) => pick(DONE[Math.max(0, Math.min(3, stars))], r);
export const lostLine = (why, r) => pick(LOST[why] || LOST.fell, r);
export const share = (fedN, stars) => `I fed AGI-1's cat ${fedN} cookie${fedN === 1 ? '' : 's'} and found ${stars}/90 pixels in ACCEPT ALL COOKIES on agi1.app 🍪💜`;
