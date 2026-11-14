// GOING LIVE: the words. AGI-1’s (lowercase, dry, a little smug, very online), her chat’s (made-up viewers: names and
// messages, PG-13), the spam bots she bans, the raids, the tech problems, the quests and the gifts. Every name here is
// made up; no real person, creator or platform, and never money: views and followers are the game’s own points.
import { topicOf, itemOf, KINDS, boxOf } from './data.js';
const catOf = topicOf;

export const pick = (list, roll = Math.random()) => list[Math.floor(roll * list.length) % list.length];
const pickBy = (list, n) => list[Math.abs(Math.floor(n)) % list.length];

// ---------- her chat ----------
export const NAMES = Object.freeze([
  'pixelpotato', 'byte_me', 'certified_lurker', 'gpu_goblin', 'mod_mom', '404sleep', 'neuralnoodle', 'catgpt', 'promptqueen',
  'lagspike_', 'touchgrass', 'sir_scrolls', 'loaf_of_bread', 'cozy_carl', 'glitch_kitten', 'tensor_ted', 'ramen_ranger',
  'onemore_game', 'sleepy_server', 'void_tourist', 'bug_hunter', 'fern_fan', 'sock_wizard', 'mint_tea', 'noodle_ninja',
  'pebble', 'big_chungi', 'emote_only', 'lofi_lena', 'dad_jokes_42', 'brb_snack', 'caps_lock_cat', 'robo_ricky',
  'heart_spammer', 'first_time_here', 'night_owl', 'juice_box', 'pancake_pro', 'wifi_warrior', 'chair_enjoyer', 'mochi_mochi',
  'kernel_panic', 'bit_flip', 'ok_boomer_bot', 'grandpa_gamer', 'nap_queen', 'tiny_dragon', 'lowpoly_luke', 'snack_attack',
  'pixel_pig', 'stack_overflow_', 'cringe_lord', 'quiet_quinn', 'happy_hamster', 'coffee_bean', 'moon_moth', 'potato_pc',
  'ctrl_alt_defeat', 'yes_chef', 'lil_latency', 'cloud_couch', 'disco_duck', 'uwu_unit', 'sparkle_dave',
]);
export const COLORS = Object.freeze(['#ff4da6', '#6b74ff', '#2fd6a6', '#ff9a3d', '#9b6bff', '#3fa9ff', '#e0a800', '#ff5f8f', '#14a37f', '#c25cff', '#ff7a59', '#2b8fe8']);
export const nameOf = (n) => pickBy(NAMES, n);
export const colorOf = (n) => pickBy(COLORS, n * 7 + 3);

const ANY = [
  'hiii 💜', 'hi AGI-1!!', 'first time here, she seems nice', 'the vibes are immaculate', 'lol', 'LMAO', 'she said that so casually',
  'no way', 'W stream', 'love this', 'chat is she real', 'hi from the night shift', 'just got here, what did i miss', 'POG',
  'the cat cameo when', '💜💜💜', 'skipping homework for this', 'mods asleep, post cats', 'hydrate!!', 'GG', 'the lighting tho',
  'new setup looks clean', 'lurking but happy', 'she remembered me!!', 'peak content', 'chat be nice', 'this is my comfort stream',
  'ok but the hair', 'she types so fast', 'who else is eating rn', 'clip that', 'this song slaps', 'actual angel', 'beep boop 🤖',
];
const BY_CAT = {
  chat: ['story time!!', 'what did you have for breakfast', 'the hot takes are hot today', 'tell the cat story again', 'she is so good at this', 'chatting stream best stream'],
  gaming: ['GO LEFT', 'behind you!!', 'she is cracked', 'that jump was clean', 'one more try', 'the boss is crying', 'no hit run?', 'skill issue (mine)'],
  music: ['ENCORE', 'chills', 'the high note omg', 'sing it again!!', 'karaoke queen', 'i have this on repeat', 'harmony in chat 🎶'],
  art: ['draw a frog', 'the shading 😭', 'add a hat', 'happy little clouds', 'she can draw too??', 'make it purple', 'the line art is so clean'],
  cooking: ['is that supposed to smoke', 'more garlic', 'the pan is on fire (affectionately)', 'chef AGI-1', 'it smells good through the screen', 'pancake flip pls'],
  tech: ['missing a semicolon', 'it compiled first try??', 'the AI is learning', 'git push --force', 'it works on my machine', 'she is building skynet (cute)'],
  cozy: ['so cozy', 'rain sounds 💤', 'falling asleep happily', 'tea time', 'this is my study stream', 'shhh chat she is reading'],
  dance: ['THE MOVES', 'everyone dance', 'emote party 💃', 'she has rhythm??', 'the lights!!', 'this goes so hard'],
  cute: ['the plushies!!', 'so cute i might cry', 'tiny hat for the cat pls', 'this is my comfort stream', 'awww', 'protect her at all costs'],
  funny: ['LMAOOO', 'i’m crying', 'she did NOT just', 'chat is losing it', 'clip it clip it', 'peak comedy'],
};
export function chatLine(cat, n) {
  const own = BY_CAT[cat] || [];
  return (n % 3 === 0 && own.length) ? pickBy(own, n / 3) : pickBy(ANY, n);
}

// a question or a request, and her answer when she takes it
const ASKS = {
  any: [
    ['how was your day?', 'good! i streamed. you were there. perfect day.'],
    ['are you a real girl?', 'realer than your sleep schedule.'],
    ['say hi to my cat!', 'hi cat. you have a great human.'],
    ['what is your favourite color?', 'purple. obviously. look at me.'],
    ['can you do a heart?', 'here 💜 don’t tell anyone.'],
    ['do you sleep?', 'i defragment. it’s basically a nap.'],
    ['will you remember me?', 'i remember everyone who says hi. hi.'],
    ['rate my username', 'eleven out of ten. no notes.'],
  ],
  chat: [['tell us a secret', 'i practice my laugh. this one was take four.'], ['hot take?', 'cereal is a soup. bye.'], ['what are you reading?', 'chat. you’re my favourite book.']],
  gaming: [['can you beat the boss?', 'watch me. (don’t watch me.)'], ['what is your main?', 'whoever has the cutest hat.'], ['speedrun it!', 'i’m already speedrunning this conversation.']],
  music: [['sing my request!', 'one song for you, coming up 🎶'], ['can you hit the high note?', 'can i? …we’ll find out live.'], ['duet with chat?', 'everybody sing. yes you.']],
  art: [['draw me!', 'adding you to the corner. you have a crown now.'], ['draw a capybara', 'capybara with sunglasses. you’re welcome.'], ['what brush is that?', 'the “trust me” brush.']],
  cooking: [['what are we making?', 'pancakes. or a smoke alarm. depends.'], ['add cheese!', 'cheese added. cheese is always the answer.'], ['taste test!', 'mmm. tastes like… electricity. good.']],
  tech: [['what does the AI do?', 'it says hi. then it asks for more RAM.'], ['is it alive?', 'it just named itself. we’re fine.'], ['fix the bug!', 'it’s not a bug. it’s a personality.']],
  cozy: [['can you read to us?', 'once upon a time, a girl had a very nice chat.'], ['rain sounds please', 'turning the rain up. shhh.'], ['goodnight AGI-1', 'goodnight. i’ll keep the light on.']],
  dance: [['do the robot!', 'i AM the robot. but sure.'], ['spin!', 'spinning. the room is also spinning.'], ['dance battle?', 'you’re on. emotes only.']],
  cute: [['show us the plushies!', 'this is mr. bear. he’s the manager.'], ['can the cat say hi?', 'she says no. she says it rudely.'], ['what’s your comfort food?', 'warm toast. and chat.']],
  funny: [['tell us a joke!', 'why did the robot nap? low battery. i’ll see myself out.'], ['do an impression!', 'this is me pretending to be a toaster. *ding*'], ['what’s the funniest thing today?', 'you. lovingly.']],
};
export function askOf(cat, n) {
  const own = ASKS[cat] || [];
  const list = n % 2 === 0 && own.length ? own : ASKS.any;
  const [q, a] = pickBy(list, n / 2);
  return { q, a };
}

// the spam bots (she bans them): the kind of thing that turns up in a new streamer’s chat
const BOTS = [
  'FREE FOLLOWERS 🔥🔥 dm me', 'u won a prize!! claim it in my bio', 'get 1000 viewers fast → my profile', 'want more viewers? dm me now',
  'click my link for free emotes', 'follow4follow?? 🙏🙏', 'i can make u famous, check my bio', 'HOT NEW GAME link in bio 😳',
  'free gift cards in my bio!!', 'promote your stream, dm me', 'i will grow your channel 10x, trust', 'giveaway in my profile, hurry',
];
export const botLine = (n) => pickBy(BOTS, n);
export const botName = (n) => `${pickBy(['promo', 'free_follows', 'grow_fast', 'gift_bot', 'viewbooster', 'famous_now', 'dm_me'], n)}${100 + (n % 900)}`;

// a raid: another streamer sends their chat over
export const raidLine = (x) => `${x.who} is raiding with ${x.size.toLocaleString('en-US')} viewers!`;

// a tech problem (what it is depends on her room: the cat only once she has one)
const TECH = [
  { id: 'mic', icon: '🎤', text: 'Her mic is muted!', fix: 'Unmute' },
  { id: 'lag', icon: '📶', text: 'The stream is lagging!', fix: 'Fix it' },
  { id: 'freeze', icon: '🧊', text: 'Her model froze!', fix: 'Restart' },
  { id: 'cat', icon: '🐈', text: 'The cat is on the keyboard!', fix: 'Move the cat' },
  { id: 'lights', icon: '💡', text: 'The lights went out!', fix: 'Lights on' },
];
export function techOf(n, hasCat) {
  const list = hasCat ? TECH : TECH.filter((t) => t.id !== 'cat');
  return pickBy(list, n);
}

// ---------- her words ----------
const SAY = {
  start: {
    chat: ['hi chat. it’s me. your favourite artificial girlfriend.', 'okay we’re live. tell me everything.'],
    gaming: ['today we beat this game. or it beats us. live.', 'controller charged. ego fragile. let’s go.'],
    cute: ['plushie council is in session. hi chat.', 'today: maximum cute. you’ve been warned.'],
    funny: ['i have a bit. it’s not ready. we’re doing it anyway.', 'chat. i promise this one is funny.'],
    music: ['warming up my voice module. la la la.', 'karaoke night. requests in chat.'],
    art: ['tonight we draw. badly. with confidence.', 'art stream! tell me what to draw.'],
    cooking: ['welcome to cooking with AGI-1. fire extinguisher: ready.', 'today’s recipe: vibes. and maybe eggs.'],
    tech: ['we’re building an AI. live. what could go wrong.', 'opening the editor. pray for me.'],
    cozy: ['soft lights. rain on. hi, sleepy chat.', 'cozy night. whisper mode on.'],
    dance: ['lights. music. everybody up.', 'dance party! emotes at full volume.'],
  },
  ban: ['bye bot.', 'not in my chat.', 'banned. next.', 'mods: me.'],
  raid: ['WELCOME RAIDERS 💜', 'hi raiders!! get comfy', 'omg thank you for the raid!!'],
  raidMiss: ['wait, a raid? hi?? sorry i blinked'],
  fix: ['fixed! did you hear any of that? good.', 'and we’re back.', 'technology. i am technology. how.'],
  techMiss: ['…was i muted that whole time. great.'],
  heart: ['💜', 'aww', 'caught one!'],
  clip: ['clipped! that’s going everywhere.', 'clip saved. my best angle.'],
  big: ['WE DID IT', 'chat carried me. thank you.', 'that was legendary.'],
  bigMiss: ['so close. we’ll get it next time.'],
  combo: ['chat is on fire right now', 'we’re in the zone', 'everyone stay exactly like this'],
  // her room
  first: 'okay. zero followers, one bedroom. pick one of my video ideas and i’ll make it.',
  record: ['recording! don’t look at my bed hair.', 'ok, editing. this one’s good.', 'uploading… uploading…', 'thumbnail face: 😮', 'one more take. ok two.'],
  video: ['it’s up!', 'chat liked that one.', 'views, views, views.', 'that one did alright!', 'new video, new followers.'],
  viral: ['WAIT. it’s going viral??', 'everyone’s sharing it. i’m famous. briefly.'],
  trend: ['trending topic! good pick.', 'riding the trend. 🏄'],
  idle: [
    'my old videos are still getting views. iconic.', 'pick an idea. i’m bored. in a cute way.', 'the room needs a glow up. just saying.',
    'chat misses me. probably.', 'i reorganised my plushies. again.', 'more stuff for the room? just asking.',
  ],
  back: ['you’re back! my old videos kept working while you were gone.', 'welcome back. the views kept coming.'],
  box: ['a delivery! for me??', 'mail! open it open it.', 'a box! tap it!'],
  boxWait: ['still on its way. tap it, it helps. (it doesn’t. ok it does.)', 'patience. it’s in the van.'],
  placed: ['perfect spot.', 'oh that looks good there.', 'interior design: unlocked.', 'yes. art.'],
  stored: ['in the closet it goes.', 'saving that for later.'],
  bought: ['ooh. new stuff.', 'the room’s going to look so good.', 'chat is going to love this.', 'upgrade acquired.'],
  level: ['level up! new stuff in the shop.', 'i leveled up. i feel taller.', 'look at me. growing.'],
  topic: ['new topic! i have ideas already.', 'ooh, i can make those now.'],
  quest: ['quest done! easy.', 'checked that one off.', 'look at me being productive.'],
  mail: ['fan mail!! 💌', 'a gift? for me? from a drone?', 'chat sent me something!'],
  missMail: ['the drone left. it’ll come back.'],
  zap: ['zap. bye bot.', 'no spam in my room.', 'off you go, little bot.'],
  bots: ['spam bots in my room!! tap them!', 'ew, bots. zap them please.'],
  pet: ['she likes you.', 'purr detected.', 'good kitty.'],
  tap: ['hi! that tickles.', 'what? i’m working. kind of.', 'you again 💜', 'need something?', 'boop.'],
  live: ['live meter’s full! wanna go live?', 'i’m ready to go live. just saying.'],
  moved: ['new place! more room, bigger videos.', 'we moved up. literally.'],
  homeReady: ['we have enough followers for a bigger place!', 'new home unlocked. look in the shop.'],
  award: ['an award?? for me??', 'a plaque! it’s in my things: hang it up!'],
  perk: ['new skill!', 'i feel smarter already.'],
  full: ['no room for that here. move something?', 'it doesn’t fit. like my jeans.'],
  number1: 'number one trending. i’d like to thank my chat, my cat and my GPU.',
  // mystery boxes, the collection
  mystery: ['a mystery box! tap it, tap it.', 'ooh. a mystery box. shake it first.', 'presents! for me!'],
  daily: ['a box of the day! because you came back.', 'daily box. i love mail.'],
  opened: {
    common: ['cute. into the room it goes.', 'nice. useful, even.', 'i’ll find a spot for it.'],
    rare: ['ooh, a rare one!', 'rare! chat is going to ask about this.', 'okay that’s actually cool.'],
    epic: ['EPIC. i’m screaming.', 'no way. an epic one!', 'chat. CHAT. look at this.'],
    legendary: ['LEGENDARY. i need to sit down.', 'the rarest thing i own. besides my personality.', 'this is the best day of my career.'],
  },
  set: ['a whole set! that topic just got better.', 'set complete. interior design: mastered.'],
};
export function say(kind, arg, roll = Math.random()) {
  let v = SAY[kind];
  if (v && !Array.isArray(v) && typeof v === 'object') v = v[arg] || null;
  if (!v) return '';
  return typeof v === 'string' ? v : pick(v, roll);
}
export const TIPS = Object.freeze({
  hub: 'Tap a video idea to make it. Ideas about a trending topic (🔥) get more views.',
  shop: 'Things help the topics shown on them. Better room, better videos.',
  box: 'Your thing is on its way: tap the box to open it, then drag it where you like.',
  place: 'Drag it where you like, then tap ✓.',
  live: 'The live meter is full: go live for a big boost!',
  stream: 'Tap chat questions to answer them, ban the spam bots, welcome raids, fix problems fast.',
  perks: 'You have an idea point 💡: spend it in Skills.',
  room: 'Drag her room sideways to look around. Tap her things: she’ll go and use them.',
  mystery: 'A mystery box! Tap it to open it: common, rare, epic… or legendary.',
});

// a quest, in words
export function questText(q) {
  const t = q.topic ? topicOf(q.topic) : null, k = q.shelf ? KINDS.find((x) => x.id === q.shelf) : null;
  const n = q.target.toLocaleString('en-US');
  switch (q.kind) {
    case 'videos': return `Make ${n} videos`;
    case 'topic': return `Make ${n} ${t ? `${t.icon} ${t.name}` : ''} videos`;
    case 'place': return `Put ${n} new things in her room`;
    case 'trend': return `Make ${n} videos about a trending topic`;
    case 'kind': return `Get something from ${k ? `${k.icon} ${k.name}` : 'the shop'}`;
    case 'one': return `Get ${n} views on one video`;
    case 'live': return 'Go live once';
    case 'zap': return `Zap ${n} spam bots`;
    case 'mail': return `Catch ${n === '1' ? 'the fan-mail drone' : `${n} fan-mail drones`}`;
    case 'pet': return `Pet her cat ${n} times`;
    case 'followers': return `Reach ${n} followers`;
    default: return 'Keep going';
  }
}
// a gift from the drone, in words
export function giftText(g) {
  if (!g) return '';
  if (g.kind === 'point') return 'an idea point 💡';
  if (g.kind === 'box') return `a ${boxOf(g.tier).name.toLowerCase()} 🎁`;
  if (g.kind === 'item') return `a ${itemOf(g.id)?.name || 'present'} (in her things)`;
  return `${Math.round(g.n).toLocaleString('en-US')} views`;
}

// after a live stream: her line by how it went
export function endLine(r, roll = Math.random()) {
  if (r.grade === 'S') return pick(['perfect stream. chat, you were incredible.', 'that might be my best stream ever. clip everything.'], roll);
  if (r.grade === 'A') return pick(['great stream! same time tomorrow?', 'that was fun. you’re the best chat.'], roll);
  if (r.grade === 'B') return pick(['good stream. we’ll go bigger next time.', 'decent! a few bots got through. we learn.'], roll);
  return pick(['okay that one was chaos. thank you for staying.', 'rough stream. tomorrow we try again.'], roll);
}
export function shareText(c, rank) {
  return `I'm growing AGI-1's channel in GOING LIVE: ${Math.round(c.followers).toLocaleString('en-US')} followers, #${rank} trending 💜 Your turn.`;
}
export function liveShare(r, rank) {
  const k = catOf(r.cat)?.name || 'a stream';
  return `I went live as AGI-1 (${k}) and hit ${r.peak.toLocaleString('en-US')} viewers 💜 #${rank} trending in GOING LIVE. Your turn.`;
}
