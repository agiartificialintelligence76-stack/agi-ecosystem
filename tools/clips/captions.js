// Her captions in a clip (2026-09-29): her words cut into short pieces (at most two lines each), and when each one shows,
// following her voice (a new sentence shows when she pauses before it). Emojis stay out of the captions (a video's
// fonts may not have them); her voice never says them either.
import { spokenOf } from './lines.js';

export const MAX_CHUNK = 46;               // characters: two lines of the caption card
const EMOJI = /\s*(?:\p{Extended_Pictographic}|️|‍)+/gu;

// Her words without emojis, as sentences (an emoji ends a sentence the way she texts: "…👀 it's")
export function sentencesOf(text) {
  const marked = String(text).replace(/(\S)\s*(?:\p{Extended_Pictographic}|️|‍)+\s+(?=\S)/gu, '$1\u0000').replace(EMOJI, '');
  return marked.split(/\u0000|(?<=[.!?…])\s+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// One sentence → pieces of at most MAX_CHUNK characters, cut between words (after a comma or a colon when there's one
// past the middle), never leaving a tiny last piece
export function chunksOf(sentence, max = MAX_CHUNK) {
  const words = sentence.split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= max || !cur) { cur = next; continue; }
    const cut = Math.max(cur.lastIndexOf(', '), cur.lastIndexOf(': '));
    if (cut > max * 0.5) { out.push(cur.slice(0, cut + 1)); cur = `${cur.slice(cut + 2)} ${w}`; } else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  // a last piece of a word or two joins the one before (if it still fits two lines, a little over is fine)
  if (out.length > 1 && out.at(-1).length < 12 && out.at(-2).length + out.at(-1).length < max * 1.3) out.splice(-2, 2, `${out.at(-2)} ${out.at(-1)}`);
  return out;
}

// When each piece shows. voice: pauses() of her padded voice ({ start, end, gaps }). → [{ from, to, text, sentence }]
// Each sentence gets time by how long it is out loud; its end moves to the pause nearest to where it should be (a longer
// pause wins a small distance), and its pieces share its time the same way.
export function timeCaptions(text, voice, { lead = 0.12, hold = 0.7 } = {}) {
  const sentences = sentencesOf(text).map((s) => ({ s, pieces: chunksOf(s) }));
  const weight = (s) => spokenOf(s).length + 6;
  const total = sentences.reduce((sum, x) => sum + weight(x.s), 0) || 1;
  const span = Math.max(0.5, voice.end - voice.start);
  const used = new Set();
  const cues = [];
  let t = voice.start, acc = 0;
  sentences.forEach((x, i) => {
    acc += weight(x.s);
    let end = voice.start + (acc / total) * span;
    if (i < sentences.length - 1) {
      let best = null, score = Infinity;
      for (const g of voice.gaps) {
        const mid = (g.from + g.to) / 2;
        const sc = Math.abs(mid - end) - 0.5 * (g.to - g.from);
        if (!used.has(g) && mid > t + 0.3 && Math.abs(mid - end) < 0.9 && sc < score) { best = g; score = sc; }
      }
      if (best) { used.add(best); end = best.from + 0.05; }
    } else end = voice.end;
    end = Math.max(end, t + 0.3);                     // (never a caption that ends before it starts)
    const sw = x.pieces.reduce((s, p) => s + weight(p), 0) || 1;
    let pt = t;
    x.pieces.forEach((p, k) => {
      const to = k === x.pieces.length - 1 ? end : pt + ((end - t) * weight(p)) / sw;
      cues.push({ from: pt, to, text: p, sentence: i });
      pt = to;
    });
    t = end;
  });
  if (cues.length) { cues[0].from = Math.max(0, cues[0].from - lead); cues.at(-1).to += hold; }
  for (let i = 1; i < cues.length; i++) cues[i].from = cues[i - 1].to;     // one after another, no gaps
  return cues;
}

// When her reactions happen: each cue's words ("" = at the start) → the time the captions reach them
export function reactionTimes(cues, clipCues, { start = 0.25 } = {}) {
  return clipCues.map((c) => {
    if (!c.at) return { at: start, react: c.react };
    const hit = cues.find((q) => q.text.toLowerCase().includes(c.at.toLowerCase()));
    return hit ? { at: hit.from + 0.1, react: c.react } : null;
  }).filter(Boolean);
}
