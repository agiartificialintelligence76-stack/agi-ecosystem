import { NIGHTS, ORDER, claimsFor, orderFor, CASES } from './cases.js';
import { letters, cleanStreak } from './book.js';
import { seals } from './rules.js';
import { wave } from './waves.js';
const el = (type, cls, text) => {
  const n = document.createElement(type);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
export function openDesk(send, demo = false) {
  if (typeof document === 'undefined') return null;
  const field = document.querySelector('.rm-field');
  if (!field) return null;
  const panel = el('section', 'radio-desk'),
    line = el('aside', 'radio-host'),
    mast = el('div', 'radio-mast'),
    lamps = el('span', 'radio-lights'),
    page = el('article', 'radio-page');
  const freq = el('span', '', 'LCR  /  87.9');
  mast.append(freq, lamps);
  panel.append(mast, page);
  panel.setAttribute('aria-label', 'Producer’s console');
  line.setAttribute('aria-hidden', 'true');
  field.classList.add('has-radio');
  field.append(line, panel);
  if (demo) {
    panel.inert = true;
    panel.classList.add('radio-demo');
  }
  const click = (e) => {
    const target = e.target.closest('[data-radio]');
    if (target && panel.contains(target) && !demo) send(target.dataset.radio);
  };
  panel.addEventListener('click', click);
  function btn(id, label, css = '') {
    const b = el('button', 'radio-btn ' + css, label);
    b.type = 'button';
    b.dataset.radio = id;
    return b;
  }
  function tag(s) {
    return el('p', 'radio-kicker', s);
  }
  function para(s, cls = '') {
    return el('p', 'radio-copy ' + cls, s);
  }
  let lastPage = '';
  function render(c, s, book, mode, seed, sub, host, showIndex = 0, showCount = 1) {
    const before = document.activeElement?.closest('[data-radio]')?.dataset.radio,
      priorFocus = panel.contains(document.activeElement),
      prevTop = page.scrollTop;
    const name = [NIGHTS[c.night][0], c.title].join(' / '),
      next = orderFor(c, s.stage, seed, mode === 'daily'),
      q = claimsFor(c, s.stage).find((q) => q.id === s.marked),
      item = c.evidence.find((e) => e.id === s.item);
    const key = [c.id, s.stage, sub || s.phase, s.listening, s.marked].join('/'),
      same = key === lastPage;
    lastPage = key;
    const stations = el('span', 'radio-leds');
    stations.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 4; i++) stations.append(el('i', i < s.lights ? 'on' : ''));
    lamps.replaceChildren(document.createTextNode('LISTENERS ' + s.lights + '/4 '), stations);
    line.replaceChildren(el('b', '', 'AGI-1  /  LIVE'), '“' + host + '”');
    page.replaceChildren();
    const t = (s, cls = '') => page.append(para(s, cls));
    const heading = (s) => {
      const h = el('h2', 'radio-heading', s);
      h.tabIndex = -1;
      page.append(h);
    };
    const group = () => {
      const d = el('div', 'radio-group');
      page.append(d);
      return d;
    };
    if (sub === 'book') {
      page.append(tag('STATION ARCHIVE'));
      heading('Producer’s book');
      t(
        Object.keys(book.cases).length +
          ' / 18 broadcasts filed  ·  ' +
          cleanStreak(book) +
          ' consecutive clean shows.',
        'radio-summary'
      );
      const ls = letters(book);
      if (!ls.length) t('Mail arrives when you broadcast the next related case. Filed edits stay here.');
      for (const l of ls.toReversed()) {
        page.append(tag('LETTER / ' + l.title));
        t(l.body);
      }
      for (const x of CASES.filter((x) => book.cases[x.id]).toReversed()) {
        const rec = book.cases[x.id];
        const det = el('details', 'radio-record');
        det.append(el('summary', '', x.title + ' · ' + rec.seals + '/3 seals'));
        det.append(para('Best surviving audience: ' + rec.lights + ' of 4.'));
        for (const h of rec.history) {
          det.append(para('Original: “' + h.original + '”'), para('Amended: “' + h.revised + '”'));
        }
        if (rec.hypotheses.length) {
          det.append(tag('RULED-OUT THEORIES'));
          for (const key of rec.hypotheses) {
            const [at, claimId, itemId] = key.split(':'),
              q = claimsFor(x, Number(at)).find((z) => z.id === claimId),
              e = x.evidence.find((z) => z.id === itemId);
            if (q && e) det.append(para(e.title + ' could coexist with “' + q.text + '”'));
          }
        }
        page.append(det);
      }
      if (Object.keys(book.daily).length) {
        const d = el('details', 'radio-record');
        d.append(el('summary', '', 'Daily rebroadcast log'));
        for (const [key, r] of Object.entries(book.daily).reverse()) {
          const [date, id] = key.split('/');
          d.append(para(date + ' · ' + CASES[Number(id) - 1].title + ' · ' + r.seals + '/3 seals'));
        }
        page.append(d);
      }
      if (Object.keys(book.practice).length) {
        page.append(tag('REHEARSALS'));
        t(
          Object.keys(book.practice)
            .map((id) => CASES[Number(id) - 1].title)
            .join(' · '),
          'radio-summary'
        );
      }
      for (const e of s.history) {
        page.append(
          tag('THIS REEL / ' + e.speaker),
          para('Original: “' + e.original + '”'),
          para('Amended: “' + e.revised + '”')
        );
      }
      group().append(btn('book', 'Return to broadcast', 'primary'));
    } else if (s.listening) {
      page.append(tag('TAPE TRANSPORT / LISTEN BACK'));
      heading('Which came first?');
      t('Cue the earlier moment. A correct order can restore one lost listener per case.');
      const d = group();
      for (const v of next.earlier) d.append(btn('when:' + v, ORDER[c.id - 1][v], 'choice'));
      if (s.event === 'again') t(s.feedback, 'notice');
      group().append(btn('listen', 'Return to the call'));
    } else if (s.phase === 'sealed') {
      page.append(tag('BROADCAST FILED / ' + NIGHTS[c.night][0]));
      heading(c.title);
      t('● '.repeat(seals(s)).trim() + '  /  3 seals', 'radio-seals');
      t(c.ending);
      if (c.id === 18) t(c.letter, 'radio-letter');
      else if (NIGHTS[c.night] && CASES[c.id]?.night !== c.night) t(NIGHTS[c.night][2], 'radio-letter');
      t(
        s.assisted
          ? 'Filed with a rehearsal cue. A clean Story Week replay can earn three seals.'
          : s.strikes
            ? 'Both accounts were edited on air. The book keeps the theories you tried.'
            : s.pressed.some((k) => k.endsWith(':lead'))
              ? 'You asked for detail and kept every listener.'
              : 'A relevant follow-up on a clean replay earns the third seal.',
        'radio-summary'
      );
      group().append(
        btn('file', showIndex + 1 < showCount ? 'Cue next broadcast' : 'Sign off · results', 'primary'),
        btn('book', 'Open producer’s book')
      );
    } else if (s.phase === 'amended') {
      const edit = s.history.at(-1);
      page.append(tag('TAPE EDIT ' + (s.stage + 1) + ' / ' + c.rounds.length));
      heading('Caller amends the record');
      page.append(
        tag(edit.speaker),
        para('“' + edit.original + '”', 'radio-old'),
        para('“' + edit.revised + '”', 'radio-amend')
      );
      t('Filed with ' + edit.proof + '.', 'radio-summary');
      group().append(
        btn('next', s.stage === c.rounds.length - 1 ? 'File this broadcast' : 'Take the next account', 'primary'),
        btn('replay', 'Replay tape')
      );
    } else if (s.phase === 'transcript') {
      page.append(
        tag(
          NIGHTS[c.night][0] +
            ' / CASE ' +
            String(c.id).padStart(2, '0') +
            (mode === 'daily' ? ' / REBROADCAST ' + (showIndex + 1) + ' OF 3' : '')
        )
      );
      heading(c.title);
      if (!s.stage) t(c.opening);
      else t('A second voice is on the line. Read the new account against the same exhibits.', 'radio-summary');
      page.append(tag('MARK A CLAIM  /  EDIT ' + (s.stage + 1) + ' OF ' + c.rounds.length));
      const d = group();
      next.claims.forEach((cl, i) => {
        const bt = btn('claim:' + cl.id, '', 'quote');
        bt.append(el('span', 'radio-by', i + 1 + '  /  ' + cl.speaker), el('span', '', '“' + cl.text + '”'));
        d.append(bt);
      });
      if (s.redo) group().append(btn('redo', 'Redo previous mark'));
      if (s.assisted) t('Rehearsal cue: follow the claim about ' + c.rounds[s.stage].subject + '.', 'guide');
      page.append(tag('ON THE DESK'));
      t(next.items.map((e) => e.title).join('  ·  '), 'radio-summary');
      if (!s.stage) {
        const night = el('section', 'radio-runlist');
        night.append(tag('THIS WEEK ON LANTERN RADIO'), el('strong', '', NIGHTS[c.night][1]));
        const row = el('div', 'radio-week');
        NIGHTS.forEach((n, i) => {
          const z = el('span', i === c.night ? 'today' : '', n[0].slice(0, 3));
          if (CASES.filter((k) => k.night === i).every((k) => book.cases[k.id])) z.classList.add('filed');
          row.append(z);
        });
        night.append(row);
        page.append(night);
      }
    } else {
      page.append(tag('MARKED CLAIM  /  ' + q.speaker));
      heading('Evidence drawer');
      t('“' + q.text + '”', 'radio-marked');
      const a = group();
      a.append(
        btn('back', '‹ Transcript'),
        btn('press', s.pressed.includes(s.stage + ':' + s.marked) ? 'Replay follow-up' : 'Ask for detail')
      );
      if (s.pressed.includes(s.stage + ':' + s.marked)) t('“' + q.press + '”', 'radio-detail');
      page.append(tag('CHOOSE AN EXHIBIT'));
      const list = group();
      list.classList.add('radio-items');
      next.items.forEach((ex, i) => {
        const b = btn('item:' + ex.id, ex.title, 'exhibit' + (ex.id === s.item ? ' chosen' : ''));
        b.setAttribute('aria-pressed', String(ex.id === s.item));
        list.append(b);
      });
      if (item) {
        const card = el('section', 'radio-card');
        card.append(tag(item.kind.toUpperCase() + ' / ' + item.title), para(item.front));
        const paired = item.back && s.flipped.includes(item.id);
        if (paired) card.append(para(item.back, 'back-side'));
        const strip = (!item.back || paired) && wave(item);
        if (strip) card.append(strip);
        const ac = el('div', 'radio-group');
        if (item.back) ac.append(btn('flip', paired ? 'Read reverse again' : 'Compare sides', 'turn'));
        if (item.sound !== 'paper') ac.append(btn('audio', 'Play sound'));
        card.append(ac);
        page.append(card);
        if (s.feedback && ['miss', 'guide', 'inspect'].includes(s.event)) {
          const status = para(s.feedback, 'notice');
          status.setAttribute('role', 'status');
          page.append(status);
        }
        group().append(btn('present', 'Put proof on air', 'primary'));
      }
      if (s.assisted)
        t(
          'Rehearsal cue: compare the marked sentence with the detail about ' + c.rounds[s.stage].subject + '.',
          'guide'
        );
    }
    page.scrollTop = same ? prevTop : 0;
    const active =
      before && Array.from(page.querySelectorAll('[data-radio]')).find((n) => n.dataset.radio === before);
    if (priorFocus) {
      if (active) active.focus({ preventScroll: true });
      else page.querySelector('h2')?.focus({ preventScroll: true });
    }
    if (
      s.phase === 'evidence' &&
      !sub &&
      !s.listening &&
      ['flip', 'paper', 'guide', 'miss', 'inspect'].includes(s.event)
    ) {
      const n = page.querySelector(['flip', 'paper'].includes(s.event) ? '.radio-card' : '.notice');
      if (n) {
        const rect = n.getBoundingClientRect(),
          p = page.getBoundingClientRect();
        if (rect.bottom > p.bottom || rect.top < p.top) page.scrollTop += rect.top - p.top - 10;
      }
    }
  }
  return {
    render,
    dispose() {
      panel.removeEventListener('click', click);
      panel.remove();
      line.remove();
      field.classList.remove('has-radio');
    },
  };
}
