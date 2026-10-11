// AGI Studio (round 4, 2026-10-11, the owner: "theres should be a percentage when they are creating the 3d model just like in
// meshy so they know how long will it take"): a bar with its percentage and the time left, for anything being made: a 3D model,
// an influencer's looks and its full body, a photo, an X banner, a trend video, a video (and the owner's trend clips). Where it
// is comes from our server: its step, when it started (our server's clock, which the page lines up with its own: a device's
// clock can be off) and, for a 3D model, its step's own percentage (the 3D service's). How long each step usually takes is
// rules.js TYPICAL: an estimate, never a promise. The bars move every second by themselves (one timer for the whole app,
// resting while the tab is hidden) and never go back.
import { h } from './ui.js';
import { progressOf } from './rules.js';
import { progressText, progressSpoken, PROGRESS_LABELS } from './app-words.js';

// our server's clock minus this device's (ms), from the answers that carry it ({ now })
let skew = 0;
export function noteServerNow(serverNow, at = Date.now()) {
  const n = Number(serverNow);
  if (Number.isFinite(n) && n > 1e12) skew = n - at;
}
export const serverNow = (at = Date.now()) => at + skew;

// what each thing's bar showed last (its id → { step, stepPct, pct, stepAt }): a bar drawn again (a new look at its page)
// carries on from there, keeps a 3D model's own percentage between the looks that bring it, and knows since when it's been at
// its step (our server's clock), so a step that came sooner than usual still moves by itself
const seen = new Map();
function remember(key, value) {
  if (!key) return;
  seen.delete(key);
  seen.set(key, value);
  while (seen.size > 200) seen.delete(seen.keys().next().value);
}
// One bar's numbers now. spec: { key, kind, plan?, step, stepPct, since } → { pct, left, slow } | null (round 4, phase 4: plan, a
// plan of its own: a video's by its model and length, a long video's by its parts, a photo's by its quality)
export function barState({ key = null, kind, plan = null, step = null, stepPct = null, since = null } = {}, at = Date.now()) {
  const was = key ? seen.get(key) : null;
  const now = serverNow(at);
  const same = !!was && was.step === step;
  const own = Number.isFinite(stepPct) && stepPct > 0 ? stepPct : same && Number.isFinite(was.stepPct) ? was.stepPct : null;
  const stepAt = same && Number.isFinite(was.stepAt) ? was.stepAt : now;
  const p = progressOf(kind, { plan, step, stepPct: own, since: Number.isFinite(since) ? since : null, stepSince: key && step ? stepAt : null, now });
  if (!p) return null;
  const pct = Math.min(99, Math.max(p.pct, was?.pct || 0));
  remember(key, { step, stepPct: own, pct, stepAt });
  return { ...p, pct };
}

// The bar: progressBar({ key (its id), kind (a TYPICAL key, and its label), plan (its own plan, else TYPICAL[kind]), step,
// stepPct, since, label, small })
const specs = new WeakMap();
export function progressBar({ key = null, kind, plan = null, step = null, stepPct = null, since = null, label = null, small = false } = {}) {
  const fill = h('span', { class: 'sa-prog-fill' });
  const bar = h('span', { class: 'sa-prog-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': label || PROGRESS_LABELS[kind] || 'Making it' }, fill);
  const text = h('span', { class: 'sa-prog-text', 'aria-hidden': 'true' });
  const node = h('span', { class: `sa-prog${small ? ' is-small' : ''}`, dataset: { saProg: kind || '' } }, bar, text);
  specs.set(node, { key, kind, plan, step, stepPct, since });
  drawBar(node);
  return node;
}
function drawBar(node, at = Date.now()) {
  const spec = specs.get(node);
  const st = spec ? barState(spec, at) : null;
  if (!st) { node.hidden = true; return; }
  node.hidden = false;
  node.querySelector('.sa-prog-fill').style.setProperty('--sa-p', `${st.pct}%`);
  const bar = node.querySelector('.sa-prog-bar');
  bar.setAttribute('aria-valuenow', String(st.pct));
  bar.setAttribute('aria-valuetext', progressSpoken(st));
  node.classList.toggle('is-slow', st.slow);
  node.querySelector('.sa-prog-text').textContent = progressText(st);
}
// every bar on the page, now
export function tickBars(at = Date.now()) {
  for (const node of document.querySelectorAll('[data-sa-prog]')) drawBar(node, at);
}
// the one timer (app.js starts it once)
let ticking = null;
export function startBars() {
  if (ticking) return;
  ticking = setInterval(() => { if (document.visibilityState === 'visible') tickBars(); }, 1000);
}
