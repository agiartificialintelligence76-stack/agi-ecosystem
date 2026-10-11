// AGI Studio: the owner's page (studio.agi1.app/owner; only the owner's wallet: STUDIO_OWNER, else the first of
// STUDIO_ONLY_FOR). Since round 4, phase 2 (2026-10-11, the owner's list: "API balances, stats, top-up links, low-balance
// Telegram alerts, roles") in four tabs:
//   • Overview: the AI services' balances our server can read (each with its top-up link, its state and the level under
//     which the owner hears about it, editable), alerts on Telegram (AGI-1's bot), the numbers, the services to look at
//     yourself. The services' names and links come from our server (server/inf-admin.js): this page's own words never name one;
//   • Team: mods and support, added by their wallet's address (kept as a scrambled code), and taken off;
//   • Content: the spotlight of the week (round 2: approve it with its prize, or skip it to the next best), the trend clips
//     (made once by the AI service from the owner's own balance, never credits; the owner keeps the good ones), the example
//     pictures for Create's choices (round 2), and the reports (hide what shouldn't be here);
//   • Testing: who can use AGI Studio while it's private (2026-10-11, the owner: "i want to give access to someone but it said
//     to them comins soon fix that please": let a wallet in by its address, or take it off), and credits for testing (round 3:
//     free, to the owner's own wallet or a tester's; a tester's wallet is let in with them).
import { h, icon, btn, linkBtn, busy, pic, put, add, say, nextId, pageTabs, segmented } from '../ui.js';
import { infVideo, infPoster, infPic, infExample, REPORT_WHYS, EXAMPLES, EXAMPLE_KINDS, INF_STYLES, OPTIONS, creditsText } from '../rules.js';
import {
  errorText, agoText, failText, num, compact, weekText, prizeText, WEEK_STATUS, shortAddress, GIFT_AMOUNTS, GIFT_MAX, GIFT_CONFIRM,
  giftPlanText, giftText, dayText, BALANCE_STATE, balanceValueText, balanceLowText, adminNumbers, MADE_KINDS, ROLE_NAMES, ROLE_NOTES,
  ACCESS_VIA, accessIntroText, accessDoneText, accessErrorText,
} from '../app-words.js';
import { makePosters } from '../media.js';
import { progressBar } from '../progress.js';

const STATUS = { none: 'Not made yet', making: 'Being made…', review: 'Made: keep it?', kept: 'Kept: people can use it', hidden: 'Hidden', failed: "Couldn't be made" };
const TX = (tx) => `https://robinhoodchain.blockscout.com/tx/${tx}`;
const MAKING = ['paid', 'making'];
// "style-anime" → "Style · Anime"; "cut-braids" → "Hair style · Braids"
export function exampleName(key) {
  const [kind, ...rest] = String(key).split('-');
  const value = rest.join('-');
  if (kind === 'style') return `Style · ${INF_STYLES[value] || value}`;
  const o = OPTIONS[kind];
  return o ? `${o.label} · ${o.choices[value] || value}` : key;
}

// ---------- credits for testing (round 3, the owner: "i cant even test it myself i dont have enough credits lol") ----------
// Drawn once (never with the page's redraws, so what's typed and the keyboard stay put): who gets them (the owner's own wallet,
// or a tester's address), how many (1 to 100,000), what that means, and the button. From GIFT_CONFIRM credits it asks for a
// second tap. (2026-10-11) A tester's wallet is let in with them while AGI Studio is private: onLetIn reads the list again.
export function giftSection(ctx, { onLetIn = null } = {}) {
  const id = nextId('sa-gift');
  const mine = () => ctx.session?.wallet || '';
  const have = h('p', { class: 'sa-gift-have' }, icon('bolt'), h('span'));
  const showHave = () => { have.lastChild.textContent = ctx.me ? `You have ${creditsText(ctx.credits)}` : ''; have.hidden = !ctx.me; };
  // who
  const toMe = h('input', { type: 'radio', class: 'sa-chip-input', name: `${id}-to`, id: `${id}-me`, value: 'me', checked: true });
  const toOther = h('input', { type: 'radio', class: 'sa-chip-input', name: `${id}-to`, id: `${id}-other`, value: 'other' });
  const meLabel = h('span', { class: 'sa-chip-text' });
  const who = h('fieldset', { class: 'sa-chips sa-gift-who' }, h('legend', { class: 'sa-label', text: 'Who gets them' }),
    h('div', { class: 'sa-chip-row' },
      h('span', { class: 'sa-chip' }, toMe, h('label', { for: `${id}-me` }, meLabel)),
      h('span', { class: 'sa-chip' }, toOther, h('label', { for: `${id}-other` }, h('span', { class: 'sa-chip-text', text: "A tester's wallet" })))));
  const showMe = () => { meLabel.textContent = mine() ? `My wallet (${shortAddress(mine())})` : 'My wallet'; };
  const address = h('input', { class: 'sa-input sa-mono', id: `${id}-addr`, type: 'text', autocomplete: 'off', spellcheck: 'false', inputmode: 'text', maxlength: '42', placeholder: '0x…', 'aria-describedby': `${id}-addr-why` });
  const addrWhy = h('p', { class: 'sa-field-why', id: `${id}-addr-why`, role: 'status', hidden: true });
  const addrBox = h('div', { class: 'sa-field', hidden: true }, h('label', { class: 'sa-label', for: `${id}-addr`, text: "Their wallet's address" }), address, addrWhy,
    h('p', { class: 'sa-hint', text: "The wallet they connect to AGI Studio. While it's private, giving it credits lets it in too (it goes on the list above)." }));
  // how many
  const amount = h('input', { class: 'sa-input sa-input-num', id: `${id}-n`, type: 'number', min: '1', max: String(GIFT_MAX), step: '1', inputmode: 'numeric', value: String(GIFT_AMOUNTS[0]) });
  const quick = h('div', { class: 'sa-gift-quick', role: 'group', 'aria-label': 'Quick amounts' }, ...GIFT_AMOUNTS.map((n) => {
    const b = btn(num(n), { kind: 'ghost', size: 'sm' });
    b.addEventListener('click', () => { amount.value = String(n); changed(); });
    return b;
  }));
  const plan = h('p', { class: 'sa-gift-plan', 'aria-live': 'polite' });
  const give = btn('', { kind: 'primary', icon: 'bolt', class: 'sa-btn sa-btn-primary sa-gift-go' });
  const note = h('p', { class: 'sa-note', role: 'status', hidden: true });
  let armed = 0, armTimer = null;
  const value = () => {
    const n = Number(amount.value);
    return Number.isInteger(n) && n >= 1 && n <= GIFT_MAX ? n : null;
  };
  const label = () => {
    const n = value();
    give.lastChild.textContent = !n ? 'Give credits' : armed === n ? `Tap again to give ${creditsText(n)}` : `Give ${creditsText(n)}`;
    give.classList.toggle('is-armed', Boolean(n) && armed === n);
  };
  function changed() {
    armed = 0;
    const n = value();
    plan.textContent = n ? giftPlanText(n) : 'A whole number of credits, from 1 to 100,000.';
    label();
  }
  give.append(h('span'));
  for (const r of [toMe, toOther]) r.addEventListener('change', () => { addrBox.hidden = !toOther.checked; say(addrWhy, ''); armed = 0; label(); if (toOther.checked) address.focus(); });
  amount.addEventListener('input', changed);
  address.addEventListener('input', () => { say(addrWhy, ''); armed = 0; label(); });
  give.addEventListener('click', () => {
    say(note, '');
    const n = value();
    if (!n) { say(note, errorText('gift_credits')); amount.focus(); return; }
    const to = toOther.checked ? address.value.trim() : 'me';
    if (to !== 'me' && !/^0x[0-9a-fA-F]{40}$/.test(to)) { say(addrWhy, errorText('gift_to')); address.focus(); return; }
    if (n >= GIFT_CONFIRM && armed !== n) {
      armed = n;
      label();
      clearTimeout(armTimer);
      armTimer = setTimeout(() => { armed = 0; label(); }, 6000);
      return;
    }
    armed = 0;
    clearTimeout(armTimer);
    busy(give, 'Adding…', async () => {
      const r = await ctx.act('inf-gift', { to, credits: n });
      const d = r.data || {};
      if (!r.ok || !d.ok) {
        if (d.error === 'gift_to') { say(addrWhy, errorText('gift_to')); address.focus(); return; }
        say(note, errorText(d.error));
        return;
      }
      const text = giftText(d);
      say(note, text);
      ctx.toast(`Added ${creditsText(d.gave)} 💜`, 'good');
      if (!d.self) address.value = '';
      ctx.refreshMe();
      if (d.letIn) onLetIn?.();
    }).finally(label);
  });
  showMe();
  changed();
  showHave();
  ctx.on('me', showHave);
  ctx.on('wallet', () => { showMe(); showHave(); });
  const section = h('section', { class: 'sa-section sa-gift', 'aria-labelledby': `${id}-h`, hidden: true },
    h('div', { class: 'sa-section-head sa-row-between' }, h('h2', { class: 'sa-h2', id: `${id}-h` }, icon('bolt'), h('span', { text: 'Credits for testing' })), have),
    h('p', { class: 'sa-muted sa-small', text: "Free credits for your own wallet or a tester's: nothing is paid to anyone. What they make is paid from your own AI balance, like everything here. Credits have no cash value." }),
    h('div', { class: 'sa-gift-form' },
      who, addrBox,
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: `${id}-n`, text: 'How many credits' }), h('div', { class: 'sa-gift-amount' }, amount, quick)),
      plan, give, note));
  return section;
}

// ---------- who can use AGI Studio while it's private (2026-10-11) ----------
// The owner's list: each wallet let in (its short address, the owner's note, how it got in, since when, and Take off with a
// second tap), who else is in without it (the owner, the team, STUDIO_ONLY_FOR's in Vercel), and the box to let a wallet in
// by its address. The box is drawn once (what's typed survives the list's redraws). → { node, load }
export function accessSection(ctx) {
  const id = nextId('sa-access');
  const intro = h('p', { class: 'sa-muted sa-small sa-access-intro' });
  const listBox = h('div', { class: 'sa-access-list' });
  const address = h('input', { class: 'sa-input sa-mono', id: `${id}-a`, type: 'text', autocomplete: 'off', spellcheck: 'false', maxlength: '42', placeholder: '0x…',
    'aria-describedby': `${id}-a-hint` });
  const note = h('input', { class: 'sa-input', id: `${id}-n`, type: 'text', autocomplete: 'off', maxlength: '24', placeholder: 'Kai, my friend' });
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const done = h('p', { class: 'sa-note', role: 'status', hidden: true });
  const go = btn('Give access', { kind: 'primary', icon: 'check' });
  let data = null, loading = false, failed = null;
  const removing = new Set();
  async function load() {
    if (loading) return;
    loading = true;
    if (!data) put(listBox, h('p', { class: 'sa-muted' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), ' Loading…'));
    const r = await ctx.act('inf-access');
    loading = false;
    if (!ctx.alive()) return;
    if (!r.ok || !Array.isArray(r.data?.list)) { failed = r.data?.error || 'busy'; drawList(); return; }
    failed = null;
    data = r.data;
    drawList();
  }
  function drawList() {
    if (failed && !data) {
      const again = btn('Try again', { kind: 'ghost', size: 'sm', icon: 'refresh' });
      again.addEventListener('click', () => busy(again, 'Trying…', load));
      intro.textContent = '';
      put(listBox, h('div', { class: 'sa-banner', role: 'status' }, h('p', { text: accessErrorText(failed) }), again));
      return;
    }
    if (!data) return;
    intro.textContent = accessIntroText(data);
    const rows = data.list.map((a) => {
      const label = () => (removing.has(a.code) ? 'Tap again to take off' : 'Take off');
      const rm = btn(label(), { kind: 'quiet', size: 'sm', icon: 'trash' });
      rm.addEventListener('click', () => {
        if (!removing.has(a.code)) {
          removing.add(a.code);
          rm.lastChild.textContent = label();
          setTimeout(() => { removing.delete(a.code); if (rm.isConnected) rm.lastChild.textContent = label(); }, 5000);
          return;
        }
        removing.delete(a.code);
        busy(rm, 'Taking off…', async () => {
          const r = await ctx.act('inf-access-remove', { code: a.code });
          const d = r.data || {};
          if (!r.ok || !d.ok) { ctx.toast(accessErrorText(d.error), 'bad'); if (d.error === 'access_gone') load(); return; }
          data = d;
          ctx.toast(`${a.short} is off the list`, 'good');
          drawList();
        });
      });
      return h('li', { class: 'sa-card sa-member sa-access-row' },
        h('div', { class: 'sa-member-body' },
          h('p', { class: 'sa-h3' }, h('span', { class: 'sa-mono', text: a.short }), a.note ? h('span', { class: 'sa-access-note', text: a.note }) : null),
          h('p', { class: 'sa-muted sa-small', text: `${ACCESS_VIA[a.via] || ACCESS_VIA.owner} · ${dayText(a.added)}${a.staff ? ' · on your team too' : ''}` })),
        rm);
    });
    put(listBox, rows.length ? h('ul', { class: 'sa-members' }, ...rows) : h('p', { class: 'sa-muted', text: data.open ? 'Nobody on the list.' : 'Nobody on the list yet: give someone access below.' }));
  }
  go.addEventListener('click', () => {
    say(err, '');
    say(done, '');
    const a = address.value.trim(), n = note.value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) { say(err, accessErrorText('access_address')); address.focus(); return; }
    if ([...n].length > 24) { say(err, accessErrorText('access_note')); note.focus(); return; }
    busy(go, 'Giving access…', async () => {
      const r = await ctx.act('inf-access-set', { address: a, note: n });
      const d = r.data || {};
      if (!r.ok || !d.ok) { say(err, accessErrorText(d.error)); (d.error === 'access_note' ? note : address).focus(); return; }
      address.value = '';
      note.value = '';
      data = d;
      drawList();
      const text = accessDoneText({ short: d.entry?.short || a, added: d.added });
      say(done, text);
      ctx.toast(d.added === false ? 'Saved' : 'Access given 💜', 'good');
    });
  });
  const node = h('section', { class: 'sa-section sa-access', 'aria-labelledby': `${id}-h`, hidden: true },
    h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: `${id}-h` }, icon('invite'), h('span', { text: 'Who can use AGI Studio' }))),
    intro, listBox,
    h('div', { class: 'sa-card sa-access-form' },
      h('h3', { class: 'sa-h3', text: 'Give someone access' }),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: `${id}-a`, text: "Their wallet's address" }), address,
        h('p', { class: 'sa-hint', id: `${id}-a-hint`, text: "The wallet they'll connect to AGI Studio (they can copy it from My studio, or their wallet app)." })),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: `${id}-n`, text: 'A note, if you like (only you see it)' }), note),
      err, h('div', { class: 'sa-row' }, go), done,
      h('p', { class: 'sa-fine', text: "We keep a scrambled code of their wallet and its short form (to tell them apart), never its address. Their credits, prices and rules are everyone's: access only lets them in while AGI Studio is private." })));
  return { node, load, reset: () => { data = null; failed = null; removing.clear(); } };
}

export async function render(ctx, route, root) {
  document.title = 'Owner tools · AGI Studio';
  // (round 4, phase 2) four tabs: Overview (the AI services' balances and their alert levels, the alerts on Telegram, the
  // numbers), Team (mods and support), Content (the spotlight of the week, the trend clips, the example pictures, reports) and
  // Testing (credits for testing). Each panel is read when it's first shown.
  const access = accessSection(ctx);
  const gift = giftSection(ctx, { onLetIn: () => access.load() });
  const body = h('div', { class: 'sa-owner' });
  const overview = h('div', { class: 'sa-admin' });
  const team = h('div', { class: 'sa-team' });
  const gate = h('div', { class: 'sa-owner-gate' });
  const TABS = [['overview', 'Overview', 'chart'], ['team', 'Team', 'team'], ['content', 'Content', 'image'], ['testing', 'Testing', 'bolt']];
  const tabs = pageTabs({ label: 'Owner tools', items: TABS, value: route.q.get('tab') || 'overview', onchange: (k) => {
    const url = new URL(location.href);
    url.searchParams.set('tab', k);
    history.replaceState(history.state, '', url.pathname + url.search);
    show(k);
  } });
  put(tabs.panel('overview'), overview);
  put(tabs.panel('team'), team);
  put(tabs.panel('content'), body);
  const testing = tabs.panel('testing');
  put(testing, access.node, gift);
  const tabsBox = h('div', { class: 'sa-owner-tabs', hidden: true }, tabs.node, ...TABS.map(([k]) => tabs.panel(k)));
  add(root, h('header', { class: 'sa-page-head' },
    h('p', { class: 'sa-eyebrow', text: 'Only your wallet sees this' }),
    h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'Owner tools' }),
    h('p', { class: 'sa-muted', text: 'Your AI balances and alerts, the numbers, your team, what people see (the spotlight, trend clips, example pictures, reports), who can use AGI Studio while it\'s private, and credits for testing.' })), gate, tabsBox);
  let data = null, loading = false, timer = null;
  let admin = null, adminLoading = false;
  const tried = new Set();
  // the weeks' prize boxes, the alert levels and the team's form keep what the owner typed across redraws
  const typed = new Map();
  const typedLevels = new Map();

  // who may see it: an answer says (the owner's wallet, or not). Another "no" (the database busy, or influencers.sql not run
  // again yet) stays in the panels that asked (into), with Try again: the other tabs keep working.
  function allowed(r, into = null, retry = null) {
    if (!ctx.session) {
      tabsBox.hidden = true;
      put(gate, h('p', { class: 'sa-banner', text: 'Connect the owner\'s wallet to see this page.' }));
      return false;
    }
    if (!r.ok && (r.data?.error === 'not_owner' || !into)) {
      tabsBox.hidden = true;
      put(gate, h('p', { class: 'sa-banner', text: r.data?.error === 'not_owner' ? 'Only the owner\'s wallet sees this page.' : errorText(r.data?.error) }));
      return false;
    }
    put(gate);
    tabsBox.hidden = false;
    gift.hidden = false;
    access.node.hidden = false;
    if (r.ok) return true;
    for (const panel of into) {
      const again = retry ? btn('Try again', { kind: 'ghost', size: 'sm', icon: 'refresh' }) : null;
      again?.addEventListener('click', () => busy(again, 'Trying…', retry));
      put(panel, h('div', { class: 'sa-banner', role: 'status' }, h('p', { text: errorText(r.data?.error) }), again));
    }
    return false;
  }
  let accessAsked = false;
  function show(k) {
    if (k === 'content' && !data) load();
    if ((k === 'overview' || k === 'team') && !admin) loadAdmin();
    if (k === 'testing' && !accessAsked && ctx.session) { accessAsked = true; access.load(); }
  }

  async function load() {
    if (loading) return;
    if (!ctx.session) { allowed({ ok: false }); return; }
    loading = true;
    const r = await ctx.act('inf-owner');
    loading = false;
    if (!ctx.alive()) return;
    if (!allowed(r, [body], load)) return;
    data = r.data;
    draw();
    clearTimeout(timer);
    const busyNow = (data.trends || []).some((t) => t.status === 'making') || (data.examples || []).some((x) => MAKING.includes(x.status));
    if (busyNow) timer = setTimeout(() => { if (ctx.alive()) load(); }, 6000);
    const todo = Object.fromEntries(Object.entries(data.posters || {}).filter(([job]) => !tried.has(job)));
    for (const job of Object.keys(todo)) tried.add(job);
    if (Object.keys(todo).length) makePosters(todo, (job) => infVideo(job), { alive: ctx.alive, most: 12 }).then((n) => { if (n && ctx.alive()) load(); });
  }

  // ---------- (round 4, phase 2) the owner's tab: balances, alerts, the numbers, the team ----------
  async function loadAdmin({ fresh = false } = {}) {
    if (adminLoading) return;
    if (!ctx.session) { allowed({ ok: false }); return; }
    adminLoading = true;
    if (!admin) put(overview, h('p', { class: 'sa-muted' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), ' Reading your balances…'));
    const r = await ctx.act('inf-admin', fresh ? { fresh: true } : {});
    adminLoading = false;
    if (!ctx.alive()) return;
    if (!allowed(r, [overview, team], () => loadAdmin({ fresh }))) return;
    admin = r.data;
    drawAdmin();
  }
  const UNIT = { USD: 'dollars', credits: 'credits', $AGI: '$AGI', ETH: 'ETH' };
  function balanceCard(b) {
    const levelText = b.state === 'off' ? null : balanceLowText(b);
    return h('li', { class: `sa-card sa-balance is-${b.state}` },
      h('div', { class: 'sa-row-between' },
        h('p', { class: 'sa-h3', text: b.name }),
        h('span', { class: `sa-tag sa-state is-${b.state === 'ok' ? 'kept' : b.state === 'low' ? 'failed' : 'none'}`, text: BALANCE_STATE[b.state] || BALANCE_STATE.error })),
      h('p', { class: 'sa-balance-value', text: ['ok', 'low'].includes(b.state) ? balanceValueText(b) : '—' }),
      levelText ? h('p', { class: 'sa-muted sa-small', text: levelText }) : null,
      b.note ? h('p', { class: 'sa-small sa-balance-note', text: b.note }) : null,
      b.link ? h('a', { class: 'sa-link sa-small', href: b.link, target: '_blank', rel: 'noopener noreferrer', text: b.text || 'Open ↗' }) : null);
  }
  function levelsForm() {
    const levels = Array.isArray(admin.levels) ? admin.levels : [];
    const note = h('p', { class: 'sa-note', role: 'status', hidden: true });
    const inputs = new Map();
    const rows = levels.map((l) => {
      const id = nextId('lvl');
      const input = h('input', { class: 'sa-input sa-input-num', id, type: 'number', min: '0', max: String(l.max), step: String(l.step), inputmode: 'decimal',
        value: String(typedLevels.get(l.key) ?? admin.thresholds?.[l.key] ?? '') });
      input.addEventListener('input', () => typedLevels.set(l.key, input.value));
      inputs.set(l.key, input);
      // its unit after its name, unless the name says it already ("Meshy's credits", "The prize wallet's ETH")
      const unit = UNIT[l.unit] || l.unit;
      const label = String(l.name).toLowerCase().includes(String(unit).toLowerCase()) ? l.name : `${l.name} (${unit})`;
      return h('div', { class: 'sa-level' }, h('label', { class: 'sa-label', for: id, text: label }), input);
    });
    const save = btn('Save alert levels', { kind: 'primary', size: 'sm', icon: 'check' });
    save.addEventListener('click', () => {
      say(note, '');
      const thresholds = {};
      for (const [k, input] of inputs) {
        const v = Number(input.value);
        if (input.value.trim() === '' || !Number.isFinite(v) || v < 0) { say(note, errorText('levels')); input.focus(); return; }
        thresholds[k] = v;
      }
      busy(save, 'Saving…', async () => {
        const r = await ctx.act('inf-admin-set', { thresholds });
        if (!r.ok || !r.data?.ok) { say(note, errorText(r.data?.error)); return; }
        typedLevels.clear();
        ctx.toast('Alert levels saved', 'good');
        loadAdmin();
      });
    });
    return h('section', { class: 'sa-card sa-levels', 'aria-labelledby': 'sa-levels-h' },
      h('h2', { class: 'sa-h3', id: 'sa-levels-h', text: 'When to alert you' }),
      h('p', { class: 'sa-muted sa-small', text: 'A balance under its level shows as Low here, and (with alerts on) reaches your Telegram, at most every 6 hours each. 0 = never.' }),
      h('div', { class: 'sa-levels-grid' }, ...rows), h('div', { class: 'sa-row' }, save), note);
  }
  function alertsCard() {
    const a = admin.alerts || {};
    return h('section', { class: 'sa-card sa-alerts', 'aria-labelledby': 'sa-owner-alerts-h' },
      h('h2', { class: 'sa-h3 sa-alerts-title', id: 'sa-owner-alerts-h' }, icon('bell'), h('span', { text: 'Alerts on Telegram' })),
      a.link
        ? [h('p', { class: 'sa-muted sa-small', text: `In AGI-1's Telegram bot: a balance running low, and new support tickets and reports. ${a.chats ? `On in ${a.chats === 1 ? '1 chat' : `${num(a.chats)} chats`}.` : 'Not on in any chat yet.'} The link works for a day; /stop in Telegram turns them off.` }),
          h('div', { class: 'sa-row' }, h('a', { class: 'sa-btn sa-btn-ghost sa-btn-sm', href: a.link, target: '_blank', rel: 'noopener noreferrer' }, icon('bell'), h('span', { text: a.chats ? 'Add another chat ↗' : 'Turn them on in Telegram ↗' })))]
        : h('p', { class: 'sa-muted sa-small', text: "AGI-1's Telegram bot isn't set up (TELEGRAM_BOT_TOKEN), so alerts are off. Everything here works without them." }));
  }
  function numbersCard() {
    const s = admin.stats;
    const made = Object.entries(MADE_KINDS).filter(([k]) => (s?.today?.[k] || 0) + (s?.week?.[k] || 0) > 0);
    return h('section', { class: 'sa-section', 'aria-labelledby': 'sa-numbers-h' },
      h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-numbers-h' }, icon('chart'), h('span', { text: 'The numbers' })),
        h('p', { class: 'sa-muted', text: 'Days and weeks in UTC. The AI cost is an estimate from the AI services\' prices.' })),
      h('dl', { class: 'sa-numbers' }, ...adminNumbers(s).map((n) => h('div', { class: 'sa-number' }, h('dt', { text: n.label }), h('dd', { text: n.value })))),
      made.length ? h('table', { class: 'sa-made' },
        h('caption', { class: 'sa-sr', text: 'What was made, by kind' }),
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Made' }), h('th', { scope: 'col', text: 'Today' }), h('th', { scope: 'col', text: 'This week' }))),
        h('tbody', null, ...made.map(([k, label]) => h('tr', null, h('th', { scope: 'row', text: label }), h('td', { text: num(s.today?.[k]) }), h('td', { text: num(s.week?.[k]) })))))
        : h('p', { class: 'sa-muted sa-small', text: 'Nothing made this week yet.' }));
  }
  function drawAdmin() {
    if (!admin) return;
    const list = Array.isArray(admin.balances) ? admin.balances : [];
    const low = list.filter((b) => b.state === 'low').length;
    tabs.count('overview', low);
    const again = btn('Read again', { kind: 'ghost', size: 'sm', icon: 'refresh' });
    again.addEventListener('click', () => busy(again, 'Reading…', () => loadAdmin({ fresh: true })));
    const read = Number.isFinite(admin.read) ? `Read ${agoText(admin.read, admin.now)}` : '';
    put(overview,
      low ? h('p', { class: 'sa-banner sa-banner-warn', role: 'status', text: `${low === 1 ? 'A balance is' : `${low} balances are`} under your alert level: top ${low === 1 ? 'it' : 'them'} up below.` }) : null,
      h('section', { class: 'sa-section sa-section-first', 'aria-labelledby': 'sa-balances-h' },
        h('div', { class: 'sa-section-head sa-row-between' }, h('h2', { class: 'sa-h2', id: 'sa-balances-h' }, icon('bolt'), h('span', { text: 'Balances' })),
          h('div', { class: 'sa-row' }, h('span', { class: 'sa-fine', text: read }), again)),
        h('ul', { class: 'sa-balances' }, ...list.map(balanceCard))),
      h('div', { class: 'sa-admin-pair' }, alertsCard(), levelsForm()),
      numbersCard(),
      h('section', { class: 'sa-section', 'aria-labelledby': 'sa-links-h' },
        h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-links-h' }, icon('link'), h('span', { text: 'Balances to look at yourself' })),
          h('p', { class: 'sa-muted', text: 'These have no balance our server can read: their own pages show it.' })),
        h('ul', { class: 'sa-admin-links' }, ...(admin.links || []).map((l) => h('li', null, h('span', { text: l.name }), h('a', { class: 'sa-link', href: l.link, target: '_blank', rel: 'noopener noreferrer', text: l.text }))))),
      h('p', { class: 'sa-owner-link' }, linkBtn('Mod tools: tickets, reports, bans', ctx.href('/mod'), { kind: 'ghost', icon: 'shield', dataset: { saLink: '' } })));
    drawTeam();
  }

  // ---------- the team: mods and support ----------
  const teamForm = (() => {
    const id = nextId('team');
    const address = h('input', { class: 'sa-input sa-mono', id: `${id}-a`, type: 'text', autocomplete: 'off', spellcheck: 'false', maxlength: '42', placeholder: '0x…' });
    const nick = h('input', { class: 'sa-input', id: `${id}-n`, type: 'text', autocomplete: 'off', maxlength: '24', placeholder: 'Mia' });
    let role = 'support';
    const roles = segmented({ legend: 'Their role', showLegend: true, choices: [['support', 'Support'], ['mod', 'Mod']], value: role, onchange: (v) => { role = v; roleNote.textContent = ROLE_NOTES[v]; } });
    const roleNote = h('p', { class: 'sa-fine', text: ROLE_NOTES[role] });
    const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
    const add2 = btn('Add to the team', { kind: 'primary', icon: 'plus' });
    add2.addEventListener('click', () => {
      say(err, '');
      const a = address.value.trim(), n = nick.value.trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(a)) { say(err, errorText('team_address')); address.focus(); return; }
      if (!/^[A-Za-z0-9](?:[A-Za-z0-9 ._-]{0,22}[A-Za-z0-9])$/.test(n)) { say(err, errorText('team_nick')); nick.focus(); return; }
      busy(add2, 'Adding…', async () => {
        const r = await ctx.act('inf-team-set', { address: a, nick: n, role });
        const d = r.data || {};
        if (!r.ok || !d.ok) { say(err, errorText(d.error)); (d.error === 'team_nick' || d.error === 'nick_taken' ? nick : address).focus(); return; }
        address.value = '';
        nick.value = '';
        if (admin) admin.team = d.team;
        ctx.toast(`${d.member?.nick || n} is on the team as ${ROLE_NAMES[role]} 💜`, 'good');
        drawTeam();
      });
    });
    return h('section', { class: 'sa-card sa-team-form', 'aria-labelledby': `${id}-h` },
      h('h2', { class: 'sa-h3', id: `${id}-h`, text: 'Add someone (or change their role)' }),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: `${id}-a`, text: 'Their wallet\'s address' }), address),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: `${id}-n`, text: 'A nickname (the team sees it on answers)' }), nick),
      h('div', { class: 'sa-field' }, roles.node, roleNote),
      err, h('div', { class: 'sa-row' }, add2),
      h('p', { class: 'sa-fine', text: "To change someone's role or nickname, add them again with the same address. We keep a scrambled code of their wallet, never its address. They connect that wallet to AGI Studio and find Mod tools in My studio (with their own alerts link). People who write in see every answer as \"AGI Studio support\"." }));
  })();
  const removing = new Set();
  function drawTeam() {
    if (!admin) { put(team, h('p', { class: 'sa-muted' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), ' Loading…')); return; }
    const members = Array.isArray(admin.team) ? admin.team : [];
    const rows = members.map((m) => {
      const label = () => (removing.has(m.code) ? 'Tap again to remove' : 'Remove');
      const rm = btn(label(), { kind: 'quiet', size: 'sm', icon: 'trash' });
      rm.addEventListener('click', () => {
        if (!removing.has(m.code)) {
          removing.add(m.code);
          rm.lastChild.textContent = label();
          setTimeout(() => { removing.delete(m.code); if (rm.isConnected) rm.lastChild.textContent = label(); }, 5000);
          return;
        }
        removing.delete(m.code);
        busy(rm, 'Removing…', async () => {
          const r = await ctx.act('inf-team-remove', { code: m.code });
          const d = r.data || {};
          if (!r.ok || !d.ok) { ctx.toast(errorText(d.error), 'bad'); return; }
          admin.team = d.team;
          ctx.toast(`${m.nick} is off the team`, 'good');
          drawTeam();
        });
      });
      return h('li', { class: 'sa-card sa-member' },
        h('div', { class: 'sa-member-body' },
          h('p', { class: 'sa-h3' }, h('span', { text: m.nick }), h('span', { class: `sa-tag sa-role is-${m.role}`, text: ROLE_NAMES[m.role] || m.role })),
          h('p', { class: 'sa-muted sa-small' }, h('span', { class: 'sa-mono', text: m.short || '' }), h('span', { text: ` · added ${dayText(m.added)}` })),
          h('p', { class: 'sa-fine', text: `${ROLE_NOTES[m.role] || ''}${m.alerts ? ` · alerts on in ${m.alerts === 1 ? '1 chat' : `${num(m.alerts)} chats`}` : ''}` })),
        rm);
    });
    put(team,
      h('p', { class: 'sa-muted sa-small sa-team-intro', text: 'Mods look at reports, take things down, ban makers who break the rules and answer support tickets; support answers tickets. You can do all of it, and only you manage the team (20 people at most).' }),
      members.length ? h('ul', { class: 'sa-members' }, ...rows) : h('p', { class: 'sa-muted', text: 'Nobody on the team yet: it\'s just you.' }),
      teamForm);
  }

  // ---------- the trend clips ----------
  function trendsSection() {
    const trends = data.trends || [];
    const missing = trends.filter((t) => ['none', 'failed'].includes(t.status));
    const all = btn(`Make the ${missing.length} missing clip${missing.length === 1 ? '' : 's'}`, { kind: 'primary', icon: 'spark' });
    all.hidden = !missing.length;
    all.addEventListener('click', () => busy(all, 'Starting…', async () => {
      for (const t of missing) {
        const r = await ctx.act('trend-make', { trend: t.id });
        if (!r.ok && r.data?.error !== 'making') { ctx.toast(`${t.name}: ${errorText(r.data?.error)}`, 'bad'); break; }
      }
      load();
    }));
    const list = h('ul', { class: 'sa-owner-trends' }, ...trends.map((t) => {
      const actions = h('div', { class: 'sa-row' });
      const make = btn(t.status === 'none' ? 'Make it' : 'Make it again', { kind: 'ghost', size: 'sm', icon: 'refresh' });
      make.disabled = t.status === 'making';
      make.addEventListener('click', () => busy(make, 'Starting…', async () => {
        const r = await ctx.act('trend-make', { trend: t.id });
        if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
        load();
      }));
      add(actions, make);
      if (t.job && t.jobStatus === 'done') {
        for (const [status, label, kind] of [['kept', 'Keep', 'primary'], ['hidden', 'Hide', 'quiet']]) {
          if (t.status === status) continue;
          const b = btn(label, { kind, size: 'sm', icon: status === 'kept' ? 'check' : 'eyeOff' });
          b.addEventListener('click', () => busy(b, '…', async () => {
            const r = await ctx.act('trend-set', { trend: t.id, status });
            if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
            load();
          }));
          add(actions, b);
        }
      }
      const preview = t.job && t.jobStatus === 'done'
        ? h('video', { class: 'sa-owner-video', src: infVideo(t.job), controls: true, playsinline: true, muted: true, loop: true, preload: 'none', ...(t.poster ? { poster: infPoster('trends', t.job) } : {}), 'aria-label': `${t.name}: its clip` })
        : h('span', { class: 'sa-owner-video is-empty', 'aria-hidden': 'true', text: t.emoji });
      return h('li', { class: 'sa-card sa-owner-trend' }, preview, h('div', { class: 'sa-owner-trend-body' },
        h('p', { class: 'sa-h3', text: `${t.emoji} ${t.name}` }),
        h('p', { class: `sa-tag sa-state is-${t.status}`, text: STATUS[t.status] || t.status }),
        // (round 4) how far along it is (a trend clip: about 4 to 5 minutes)
        t.status === 'making' && t.job ? progressBar({ key: t.job, kind: 'clip', since: t.updated ?? null, small: true }) : null,
        t.error ? h('p', { class: 'sa-muted sa-small', text: failText(t.error) }) : null,
        t.updated ? h('p', { class: 'sa-muted sa-small', text: `Updated ${agoText(t.updated)}` }) : null,
        actions));
    }));
    return h('section', { class: 'sa-section', 'aria-labelledby': 'sa-ot-h' },
      h('div', { class: 'sa-section-head sa-row-between' }, h('h2', { class: 'sa-h2', id: 'sa-ot-h' }, icon('zap'), h('span', { text: 'Trend clips' })), all),
      h('p', { class: 'sa-muted sa-small', text: "Each is a real-looking vertical clip with a made-up young adult, its own camera move and its own sound: about $1.26 each (10 seconds with sound) from your AI balance, never anyone's credits. A trend video puts someone's influencer in its person's place. Keep the good ones: only kept clips show to people." }),
      list);
  }

  // ---------- the example pictures (round 2: Create's choices shown as pictures) ----------
  function examplesSection() {
    const examples = data.examples || [];
    const missing = examples.filter((x) => !x.done && !MAKING.includes(x.status));
    const all = btn(`Make the ${missing.length} missing picture${missing.length === 1 ? '' : 's'}`, { kind: 'primary', icon: 'spark' });
    all.hidden = !missing.length;
    all.addEventListener('click', () => busy(all, 'Starting…', async () => {
      const r = await ctx.act('inf-example-make', { keys: missing.map((x) => x.key) });
      if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
      else if (r.data?.busy?.length) ctx.toast(`${r.data.busy.length} of them were being made already.`, 'info');
      load();
    }));
    const kinds = Object.keys(EXAMPLE_KINDS);
    const grid = h('ul', { class: 'sa-ex-grid' }, ...examples
      .slice().sort((a, b) => kinds.indexOf(a.key.split('-')[0]) - kinds.indexOf(b.key.split('-')[0]) || EXAMPLES.indexOf(a.key) - EXAMPLES.indexOf(b.key))
      .map((x) => {
        const making = MAKING.includes(x.status);
        const again = btn(x.done ? 'Again' : 'Make it', { kind: 'ghost', size: 'sm', icon: 'refresh' });
        again.disabled = making;
        again.addEventListener('click', () => busy(again, '…', async () => {
          const r = await ctx.act('inf-example-make', { keys: [x.key] });
          if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
          load();
        }));
        const state = making ? 'Being made…' : x.status === 'failed' && !x.done ? failText(x.error) : x.done ? 'Shown in Create' : 'Not made yet';
        return h('li', { class: `sa-ex${x.done ? '' : ' is-empty'}${making ? ' is-making' : ''}` },
          x.done ? pic(infExample(x.done), { cls: 'sa-ex-pic', alt: '' }) : h('span', { class: 'sa-ex-pic is-missing', 'aria-hidden': 'true' }, making ? h('span', { class: 'sa-spin' }) : icon('image')),
          h('p', { class: 'sa-ex-name', text: exampleName(x.key) }),
          h('p', { class: 'sa-muted sa-small', text: state }),
          again);
      }));
    return h('section', { class: 'sa-section', 'aria-labelledby': 'sa-oe-h' },
      h('div', { class: 'sa-section-head sa-row-between' }, h('h2', { class: 'sa-h2', id: 'sa-oe-h' }, icon('image'), h('span', { text: 'Example pictures' })), all),
      h('p', { class: 'sa-muted sa-small', text: `One made-up adult showing each choice in Create (its styles, looks, ages, hair styles, outfits and vibes): about $0.08 a picture from your AI balance (about $${(examples.length * 0.08).toFixed(2)} for all ${examples.length}). Skin, hair color and eyes show as color swatches instead. A picture made again replaces the one shown.` }),
      grid);
  }

  // ---------- the spotlight of the week (round 2) ----------
  function weeksSection() {
    const weeks = data.weeks || [];
    const prizeDefault = Number(ctx.info?.weeklyPrize) || 0;
    const cards = weeks.map((w) => {
      const cover = !w.inf || !w.job ? null : w.kind === 'photo' ? infPic(w.inf, w.job, 0, true) : w.poster ? infPoster(w.inf, w.job) : w.portrait ? infPic(w.inf, w.portrait.job, w.portrait.n, true) : null;
      const media = w.inf
        ? h('a', { class: `sa-week-media is-${w.shape || 'tall'}`, href: `${ctx.href(`/i/${w.inf}`)}#v-${w.job}`, dataset: { saLink: '' }, 'aria-label': `${w.name || 'Its influencer'}: see it` },
          cover ? pic(cover, { cls: 'sa-week-pic', alt: '' }) : h('span', { class: 'sa-week-pic is-missing' }),
          w.kind && w.kind !== 'photo' ? h('span', { class: 'sa-media-play', 'aria-hidden': 'true' }, icon('play')) : null)
        : h('span', { class: 'sa-week-media is-empty', 'aria-hidden': 'true' }, icon('trophy'));
      const facts = h('p', { class: 'sa-muted sa-small', text: w.job
        ? `${compact(w.likes)} like${w.likes === 1 ? '' : 's'} · ${compact(w.holderLikes)} from holders${w.skipped ? ` · ${w.skipped} skipped before it` : ''}`
        : 'Nothing was liked by holders that week.' });
      const actions = h('div', { class: 'sa-row' });
      const note = h('p', { class: 'sa-note', role: 'status', hidden: true });
      if (w.status === 'picked') {
        const id = `sa-prize-${w.week}`;
        const input = h('input', { class: 'sa-input sa-input-num', id, type: 'number', min: '0', max: '1000000', step: '1', inputmode: 'numeric', value: String(typed.get(w.week) ?? prizeDefault) });
        input.addEventListener('input', () => typed.set(w.week, input.value));
        const approve = btn('Approve', { kind: 'primary', size: 'sm', icon: 'check' });
        approve.addEventListener('click', () => {
          const prize = Number(input.value);
          if (!Number.isInteger(prize) || prize < 0 || prize > 1_000_000) { note.hidden = false; note.textContent = 'A prize is a whole number of $AGI from 0 (for glory) to 1,000,000.'; input.focus(); return; }
          busy(approve, '…', async () => {
            const r = await ctx.act('inf-week-set', { week: w.week, week_action: 'approve', prize });
            if (!r.ok) { note.hidden = false; note.textContent = errorText(r.data?.error); return; }
            typed.delete(w.week);
            ctx.toast(`Approved: the spotlight of ${weekText(w.week)}, ${prizeText(prize)}.`, 'good');
            load();
          });
        });
        const skip = btn('Skip to the next best', { kind: 'ghost', size: 'sm', icon: 'next' });
        skip.addEventListener('click', () => busy(skip, '…', async () => {
          const r = await ctx.act('inf-week-set', { week: w.week, week_action: 'skip' });
          if (!r.ok) { note.hidden = false; note.textContent = errorText(r.data?.error); return; }
          ctx.toast(r.data?.job ? 'Skipped: the next best is up.' : 'Skipped: nothing else was liked that week.', 'info');
          load();
        }));
        add(actions, h('label', { class: 'sa-prize-input', for: id }, h('span', { class: 'sa-label', text: 'Prize ($AGI)' }), input), approve, skip);
      }
      if (w.tx) add(actions, h('a', { class: 'sa-link', href: TX(w.tx), target: '_blank', rel: 'noopener noreferrer', text: 'Its prize on the block explorer ↗' }));
      // its controls under the picture and its words (a phone's width), beside the picture from 720 px
      const tools = w.status === 'picked' || w.tx ? h('div', { class: 'sa-week-tools' }, actions, note) : null;
      return h('li', { class: `sa-card sa-week is-${w.status}` }, media, h('div', { class: 'sa-week-body' },
        h('p', { class: 'sa-h3', text: `${weekText(w.week).replace(/^the/, 'The')}${w.name ? `: ${w.name}` : ''}` }),
        h('p', { class: `sa-tag sa-state is-${w.status}`, text: WEEK_STATUS[w.status] || w.status }),
        facts,
        ['approved', 'claimed', 'sending', 'sent'].includes(w.status) ? h('p', { class: 'sa-small', text: `Prize: ${prizeText(w.prize)}` }) : null),
        tools);
    });
    return h('section', { class: 'sa-section', 'aria-labelledby': 'sa-ow-h' },
      h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-ow-h' }, icon('trophy'), h('span', { text: 'Spotlight of the week' }))),
      h('p', { class: 'sa-muted sa-small', text: `Each Monday (UTC) last week's most loved creation is picked (holders' likes first). Approve it to put it in Explore for two weeks, with its prize from the prize wallet (${prizeDefault > 0 ? `${num(prizeDefault)} $AGI by default` : 'none set'}; 0 = for glory), or skip it to the next best. Its maker claims the prize in My studio.` }),
      weeks.length ? h('ul', { class: 'sa-weeks' }, ...cards) : h('p', { class: 'sa-muted', text: 'No week picked yet: the first is picked on the Monday after the first likes.' }));
  }

  // ---------- reports ----------
  function reportsSection() {
    const reports = data.reports || [];
    const rlist = h('ul', { class: 'sa-owner-reports' }, ...reports.map((rep) => {
      const hide = btn(rep.hidden ? 'Show again' : 'Take it down', { kind: rep.hidden ? 'ghost' : 'danger', size: 'sm', icon: rep.hidden ? 'eye' : 'eyeOff' });
      hide.addEventListener('click', () => busy(hide, '…', async () => {
        const r = await ctx.act('inf-hide', { ...(rep.job ? { job: rep.job } : { inf: rep.inf }), hidden: !rep.hidden });
        if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
        load();
      }));
      const fine = btn("It's fine", { kind: 'ghost', size: 'sm', icon: 'check' });
      fine.addEventListener('click', () => busy(fine, '…', async () => {
        const r = await ctx.act('inf-report-clear', { inf: rep.inf, ...(rep.job ? { job: rep.job } : {}) });
        if (!r.ok) ctx.toast(errorText(r.data?.error), 'bad');
        load();
      }));
      return h('li', { class: 'sa-card sa-owner-report' },
        h('div', null,
          h('p', null, linkBtn(rep.name || 'An influencer', ctx.href(`/i/${rep.inf}`), { kind: 'quiet', size: 'sm', dataset: { saLink: '' } }),
            h('span', { class: 'sa-muted', text: ` · ${rep.job ? 'one of its photos or videos' : 'the influencer'}${rep.mode === 'face' ? ' · made from a face' : ''}` })),
          h('p', { text: `${rep.count} report${rep.count === 1 ? '' : 's'}: ${rep.whys.map((w) => REPORT_WHYS[w] || w).join(', ')}` }),
          h('p', { class: 'sa-muted sa-small', text: `${agoText(rep.at)}${rep.hidden ? ' · taken down' : ''}` })),
        h('div', { class: 'sa-row' }, hide, fine));
    }));
    return h('section', { class: 'sa-section', 'aria-labelledby': 'sa-or-h' },
      h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-or-h' }, icon('flag'), h('span', { text: `Reports (${reports.length})` }))),
      reports.length ? rlist : h('p', { class: 'sa-muted', text: 'No reports.' }));
  }

  function draw() {
    put(body, weeksSection(), trendsSection(), examplesSection(), reportsSection());
    tabs.count('content', (data.reports || []).filter((r) => !r.hidden).length + (data.weeks || []).filter((w) => w.status === 'picked').length);
  }
  // the tab shown first, and (for the tabs' counts, and to know it's the owner) the owner's tab
  function start() {
    if (!ctx.session) { allowed({ ok: false }); return; }
    drawTeam();
    show(tabs.value);
    if (!['overview', 'team'].includes(tabs.value)) loadAdmin();
  }
  ctx.on('wallet', () => { data = null; admin = null; accessAsked = false; access.reset(); start(); });
  ctx.on('info', () => { if (data) draw(); });
  start();
  return () => clearTimeout(timer);
}
