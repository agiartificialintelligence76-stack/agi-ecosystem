// AGI games' page (agi1.app/games, games.html, 2026-10-19): everything it says that isn't in the page, our server's answers
// (api/wallet.js: GET ?game=…, game-mine, game-review, game-review-delete) in plain words, and the small sums its numbers
// need (a row of stars, the bars, a review's place in the list, the numbers after your own review changed). Pure (no page
// needed: tests/page.test.js reads it in Node). Never "buy", never a price: a game's numbers are plays, players and stars.
import { REVIEW, STARS } from './list.js';
import { WALLET_STEPS, NO_WALLET, short } from '../live/words.js';

// connecting a wallet: the same steps and words as her live page's (src/live/words.js)
export { WALLET_STEPS, NO_WALLET, short };

// her badge's names on a review: the site's own levels (src/lib/levels.js), never the wallet or an amount
export const BADGE = { 2: 'Crush', 3: 'Soulmate' };

// what each number of stars says, on the page's star picker
export const STAR_WORDS = { 1: 'Not for me', 2: "It's okay", 3: 'Good', 4: 'Really good', 5: 'Love it' };
export const starsLabel = (n) => `${n} out of 5 stars`;
export const pickText = (n) => (STARS.includes(n) ? `${n} ${n === 1 ? 'star' : 'stars'}: ${STAR_WORDS[n]}` : 'Tap a star');

// ---------- a row of five stars ----------
// One star (viewBox 0 0 24 24), and five in a row (viewBox 0 0 120 24, each 24 further): drawn twice, the top row cut to
// how much of it is filled (--gm-fill, a width: src/styles/games.css)
const star = (x) => `M${12 + x} 2.2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L${12 + x} 17.1l-6.1 3.5 1.5-6.8L${Number((2.2 + x).toFixed(1))} 9.2l6.9-.7z`;
export const STAR_PATH = star(0);
export const starsPath = () => [0, 24, 48, 72, 96].map(star).join('');
// how much of the row is filled, in its own units (0 to 120): its whole stars, then the next one's part from its own edge
// (a star's shape goes from 2.2 to 21.8 of its 24)
export function starFill(value) {
  const v = Math.min(5, Math.max(0, Number(value) || 0));
  const whole = Math.floor(v), part = v - whole;
  return whole * 24 + (part > 1e-9 ? 2.2 + part * 19.6 : 0);
}
export const fillWidth = (value) => `${Number(((starFill(value) / 120) * 100).toFixed(2))}%`;

// ---------- numbers ----------
const ok = (n) => Number.isSafeInteger(n) && n >= 0;
export const countText = (n) => (ok(n) ? n.toLocaleString('en-US') : '—');
export const avgText = (avg) => (typeof avg === 'number' && Number.isFinite(avg) ? avg.toFixed(1) : '—');
export const ratingsText = (n) => (!ok(n) || n === 0 ? 'No ratings yet' : n === 1 ? '1 rating' : `${countText(n)} ratings`);
export const timesText = (n) => (!ok(n) ? '—' : n === 0 ? 'Not yet' : n === 1 ? 'Once' : `${countText(n)} times`);
export function playedText(plays, players) {
  if (!ok(plays)) return 'Plays and players show up here soon.';
  if (plays === 0) return 'Nobody has played it yet: be the first.';
  const times = plays === 1 ? 'once' : `${countText(plays)} times`;
  if (!ok(players) || players === 0) return `Played ${times}.`;
  return `Played ${times} by ${players === 1 ? '1 person' : `${countText(players)} people`}.`;
}
// a bar of the 5★ to 1★ chart: its share of the ratings
export const barWidth = (n, total) => `${ok(n) && ok(total) && total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0}%`;

// The game's card on the shelf: "…" while its numbers load, "—" when they aren't there (the database isn't set up yet, or
// our server didn't answer). Its rating: the average and a star, or "None yet"
export function cardStats(stats, { loading = false } = {}) {
  if (loading) return { rating: { value: '…', star: false }, players: '…', plays: '…' };
  if (!stats) return { rating: { value: '—', star: false }, players: '—', plays: '—' };
  return {
    rating: stats.ratings > 0 ? { value: avgText(stats.average), star: true } : { value: 'None yet', star: false },
    players: countText(stats.players), plays: timesText(stats.plays),
  };
}

// a review's day, as people read it ("Oct 19, 2026"): the visitor's own time zone (tests pass one)
export function dateText(iso, timeZone) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(timeZone ? { timeZone } : {}) });
}

// ---------- your own review, on this page ----------
// A game's numbers after your review changed here (saved or deleted), without asking our server again (its answer is shared
// for a minute): the old one out and the new one in, each only when it counts (one the owner hid counts for nobody). Its
// average from the stars themselves, one decimal, as our server gives it.
const counts = (r) => Boolean(r) && !r.hidden && STARS.includes(r.stars);
export function adjustStats(stats, { before = null, after = null } = {}) {
  if (!stats) return stats;
  const stars = [0, 1, 2, 3, 4].map((i) => (ok(stats.stars?.[i]) ? stats.stars[i] : 0));
  if (counts(before)) stars[before.stars - 1] = Math.max(0, stars[before.stars - 1] - 1);
  if (counts(after)) stars[after.stars - 1] += 1;
  const ratings = stars.reduce((a, n) => a + n, 0);
  const sum = stars.reduce((a, n, i) => a + n * (i + 1), 0);
  return { ...stats, stars, ratings, average: ratings ? Math.round((sum / ratings) * 10) / 10 : null };
}
// A review in the page's list (the newest first, by id: an edit keeps its id): the old one out, the new one in where its id
// says, when the list shows it (it has words, and isn't hidden). One older than the list's last while there's more to load
// stays out: "Show more reviews" brings it.
const shown = (r) => Boolean(r) && !r.hidden && typeof r.text === 'string' && r.text !== '' && STARS.includes(r.stars) && Number.isSafeInteger(r.id);
export function placeReview(list, review, { remove = null, more = false } = {}) {
  const rows = Array.isArray(list) ? list : [];
  const drop = new Set([remove?.id, review?.id].filter((id) => Number.isSafeInteger(id)));
  const out = rows.filter((r) => !drop.has(r.id));
  if (!shown(review)) return out;
  const last = rows.length ? Math.min(...rows.map((r) => r.id)) : null;
  if (more && last !== null && review.id < last) return out;
  const { hidden, ...row } = review;
  const at = out.findIndex((r) => r.id < review.id);
  out.splice(at < 0 ? out.length : at, 0, row);
  return out;
}
// your own review as our server has it now, merged into a list our server shared (up to a minute old)
export const mergeMine = (list, mine, { more = false } = {}) => placeReview(list, mine, { remove: mine, more });
// "Show more reviews": the next page after the list's last, each review once, newest first
export function appendPage(list, page) {
  const seen = new Set((Array.isArray(list) ? list : []).map((r) => r.id));
  const add = (Array.isArray(page) ? page : []).filter((r) => shown(r) && !seen.has(r.id));
  return [...(Array.isArray(list) ? list : []), ...add].sort((a, b) => b.id - a.id);
}

// ---------- what the rate box says ----------
export const BOX = {
  loading: 'Loading its ratings…',
  soon: { title: 'Ratings and reviews open soon', text: 'You can play it now. Rating it, with stars and a few words, opens soon.' },
  closed: { title: 'Reviews open soon', text: "Writing a review isn't open yet. You can play it now, and read what people said." },
  mineLoading: 'Checking for your review…',
  hidden: 'Only you see this one: it was taken off the page.',
  empty: 'No reviews with words yet. Yours could be the first.',
  needStars: 'Pick your stars first.',
  mineFailed: "Couldn't check for your earlier review just now. Saving one changes it, if there is one.",
  // the numbers and the list while our server has none to give (not set up yet, or it didn't answer)
  statsSoon: 'Ratings show up here soon.',
  reviewsSoon: 'Reviews show up here soon.',
  // the form's title and its button, and deleting
  title: { new: 'Rate it', edit: 'Change your review' },
  send: { new: 'Post my review', edit: 'Save changes', busy: 'Posting…' },
  remove: { idle: 'Delete', armed: 'Tap again to delete', busy: 'Deleting…' },
  // "Show more reviews"
  more: { idle: 'Show more reviews', busy: 'Loading…', failed: "Couldn't load more reviews just now. Try again." },
  anon: 'A player',
};
// what "Show more reviews" brought (said to screen readers)
export const moreText = (n) => (n === 1 ? '1 more review.' : n > 1 ? `${countText(n)} more reviews.` : 'No more reviews.');
// the connected wallet: its short address, and her 💜 badge at Crush or Soulmate
export const meText = ({ wallet, level } = {}) => (wallet ? `${short(wallet)}${BADGE[level] ? ` · ${BADGE[level]} 💜` : ''}` : '');
export const savedText = ({ created = false, hidden = false } = {}) => (hidden
  ? 'Saved. It stays off the page, so only you see it.'
  : created ? 'Posted. Thanks for rating it 💜' : 'Saved your changes 💜');
export const deletedText = (removed) => (removed ? 'Your review is deleted.' : 'There was no review to delete.');

// why a review's words were refused (api/wallet.js "why": the live show's question rules, server/live.js questionTrouble,
// and only $AGI on a game's page)
const WHY = {
  care: "That sounds like a lot to carry, so it won't go on a public page. If you're going through a hard time, please reach out to someone you trust or a local support line. You matter.",
  secret: "That looks like a seed phrase or a private key, so it wasn't kept. Never send it to anyone: if it's real, move your funds to a new wallet now.",
  long: `Keep it under ${REVIEW.textMax} characters.`,
  link: 'No links in reviews, please.',
  address: 'No addresses or long codes in reviews, please.',
  contact: 'No @names, emails or phone numbers in reviews, please.',
  crude: 'Keep it PG-13, please.',
  spam: "That doesn't look like a review. Say what you thought of the game?",
  advice: 'No financial advice or price talk in reviews, please.',
  coin: 'Only $AGI here: no other coins in reviews, please.',
};
export const whyText = (why) => WHY[why] || WHY.spam;
// our server's answers to saving or deleting a review, in plain words
export function reviewError(error, { why = null } = {}) {
  switch (error) {
    case 'words': return whyText(why);
    case 'name': return `That name can't be shown: ${REVIEW.nameMax} characters at most, nothing crude, no links or addresses, and nothing that passes for AGI-1 or her team.`;
    case 'rules': return "That one can't go on the page: the check found something in it that isn't for a family-friendly page. Change it and try again.";
    case 'person_cap': return `That's ${REVIEW.perDay} saves today. You can save it again tomorrow (00:00 UTC).`;
    case 'site_cap': return 'A lot of people are rating games today. Try again tomorrow.';
    case 'too_fast': return 'Slow down a little, then try again.';
    case 'ai': return "The check didn't answer just now, so nothing was saved. Try again in a minute.";
    case 'age': return 'Reviews are 18+ only.';
    case 'human_check': return "We couldn't check that you're human. Try again.";
    case 'signed_out': return "Your wallet's session ended. Connect it again to rate the game.";
    case 'not_configured': return "Reviews aren't open yet.";
    case 'not_ready': case 'busy': return 'Something is busy on our side. Try again in a moment.';
    case 'offline_net': return "You're offline. Check your connection and try again.";
    case 'bad_request': return "Something didn't add up. Reload the page and try again.";
    default: return 'Something went wrong. Try again in a moment.';
  }
}
