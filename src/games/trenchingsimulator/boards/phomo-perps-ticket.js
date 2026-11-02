import { el, setText, keyed } from '../ui.js';
import { usd, usdFull, signed, compact } from '../format.js';
import { PAPER_PERPS } from '../paper-perps.js';

const errors = { free_only: 'Paper perpetual orders are available in free play.', stale: 'Waiting for a fresh public mark price.',
  size: 'Enter a position size between $1 and $1 billion.', leverage: 'Choose leverage within this market’s available limit.',
  limit: 'Enter a positive limit price.', protection: 'Check the take-profit and stop-loss prices for your chosen side.',
  balance: 'Not enough available play cash for margin and the opening fee.', capacity: 'Close or cancel an existing paper position first.',
  twap: 'Choose 2–60 slices over 10 seconds to 24 hours.', missing: 'This paper position or order has already closed.' };
const button = (text, action, cls = '') => el('button', { type: 'button', class: `php-ticket-button ${cls}`, on: { click: action } }, text);
const field = (label, input) => { input.setAttribute('aria-label', label); return el('label', { class: 'php-ticket-field' }, el('span', {}, label), input); };
const number = (label, value = '') => el('input', { type: 'text', inputmode: 'decimal', value, autocomplete: 'off', 'aria-label': label });

export function createPaperPerpsTicket({ ledger, market, onTransfer } = {}) {
  let active = true;
  const state = { side: 'long', kind: 'market', leverage: 20, coin: null, tab: 'positions', editing: null };
  const message = el('p', { class: 'php-ticket-message', role: 'status', 'aria-live': 'polite' });
  const long = button('Long', () => side('long'), 'php-side'), short = button('Short', () => side('short'), 'php-side');
  const kind = el('select', { class: 'php-order-kind', 'aria-label': 'Perpetual order type', on: { change() { state.kind = kind.value; update(); } } },
    ...[['market', 'Market'], ['limit', 'Limit'], ['twap', 'TWAP']].map(([value, label]) => el('option', { value }, label)));
  kind.value = 'market';
  const amount = number('Position size in practice dollars', ''); amount.placeholder = '0';
  const quantity = el('span', { class: 'php-quantity' });
  const size = el('label', { class: 'php-position-size' }, el('span', {}, '$', amount), el('span', {}, quantity, el('small', {}, 'Position size')));
  const limit = number('Limit price'); const limitRow = field('Limit price', limit);
  const duration = number('TWAP duration in minutes', '1'), slices = number('TWAP number of slices', '6');
  const twap = el('div', { class: 'php-protection-fields' }, field('TWAP duration in minutes', duration), field('TWAP number of slices', slices));
  const marginSlider = el('input', { type: 'range', min: 0, max: 100, step: 1, value: 0, 'aria-label': 'Percentage of available margin', on: { input() {
    const cash = ledger.snapshot().available, fraction = Number(marginSlider.value) / 100;
    amount.value = String(Math.floor(cash * fraction / (1 / state.leverage + PAPER_PERPS.feeRate) * 100) / 100); update();
  } } });
  const margin = el('span'), available = el('span');
  const leverageRange = el('input', { type: 'range', min: 1, max: 40, value: 20, step: 1, 'aria-label': 'Leverage', on: { input() {
    state.leverage = Number(leverageRange.value); update();
  } } });
  const leverageValue = el('summary'), leverageLimits = el('small');
  const leverage = el('details', { class: 'php-leverage' }, leverageValue,
    el('div', { class: 'php-leverage-popover' }, el('b', {}, 'Adjust leverage'), leverageRange, leverageLimits,
      button('Apply', () => { leverage.open = false; })));
  const protection = el('input', { type: 'checkbox', 'aria-label': 'Enable take profit and stop loss', on: { change: () => update() } });
  const tp = number('Take-profit price'), sl = number('Stop-loss price');
  const protectionFields = el('div', { class: 'php-protection-fields' }, field('Take-profit price', tp), field('Stop-loss price', sl));
  const liquidation = el('dd'), fee = el('dd');
  const submit = el('button', { type: 'submit', class: 'php-ticket-submit' }, 'Enter position size');
  const form = el('form', { class: 'php-paper-ticket', 'aria-label': 'Paper perpetual order', on: { submit(event) {
    event.preventDefault(); const result = ledger.submit(orderInput());
    setText(message, result.ok ? `Paper ${state.side} ${state.kind} order ${result.id} ${state.kind === 'market' ? 'filled' : 'accepted'}.` : errors[result.error] || 'Check the order fields.');
    if (result.ok) { amount.value = ''; marginSlider.value = '0'; } update();
  } } },
    el('div', { class: 'php-ticket-sides', role: 'group', 'aria-label': 'Position side' }, long, short),
    el('div', { class: 'php-ticket-type' }, kind, el('span', {}, '⟳ Isolated')),
    limitRow, size, marginSlider,
    el('div', { class: 'php-margin-line' }, margin, available),
    el('div', { class: 'php-ticket-options' }, leverage, el('label', {}, 'TP/SL ', protection)),
    protectionFields, twap,
    el('dl', { class: 'php-ticket-estimates' }, el('div', {}, el('dt', {}, 'Est. liquidation price'), liquidation), el('div', {}, el('dt', {}, 'Opening fee'), fee)),
    submit, message,
    el('p', { class: 'php-paper-note' }, 'Paper trading · shared play cash. 0.05% per fill; 0.5% maintenance. Observed mark fills; no funding.'));
  if (onTransfer) form.insertBefore(button('Move play cash', onTransfer, 'php-transfer'), form.lastChild);
  for (const input of [amount, limit, duration, slices, tp, sl]) input.addEventListener('input', update);
  function side(value) { state.side = value; setText(message, ''); update(); }
  function orderInput() { return { coin: market()?.coin, side: state.side, kind: state.kind,
    notional: Number(amount.value), leverage: state.leverage, limitPrice: Number(limit.value),
    tp: protection.checked ? tp.value : null, sl: protection.checked ? sl.value : null,
    slices: Number(slices.value), durationMs: Number(duration.value) * 60000 }; }
  function update() {
    if (!active) return;
    const row = market(), snapshot = ledger.snapshot(), max = Math.max(1, Math.floor(row?.leverage || 1));
    if (state.coin !== row?.coin) { state.coin = row?.coin; state.leverage = Math.min(20, max); limit.value = row?.mark || row?.price || ''; }
    state.leverage = Math.min(state.leverage, max, PAPER_PERPS.maxLeverage); leverageRange.max = Math.min(max, PAPER_PERPS.maxLeverage); leverageRange.value = state.leverage;
    setText(leverageValue, `${state.leverage}x leverage`); setText(leverageLimits, `1x — ${leverageRange.max}x · isolated paper margin`);
    for (const [b, value] of [[long, 'long'], [short, 'short']]) b.setAttribute('aria-pressed', String(state.side === value));
    form.dataset.side = state.side; limitRow.hidden = state.kind !== 'limit'; twap.hidden = state.kind !== 'twap'; protectionFields.hidden = !protection.checked;
    const sizeUsd = Number(amount.value) || 0, price = row?.mark || row?.price;
    setText(quantity, price > 0 ? `${compact(sizeUsd / price, 5)} ${row.symbol || row.coin}` : '—');
    setText(margin, `${usd(sizeUsd / state.leverage)} (${Math.min(100, Math.round(sizeUsd / state.leverage / (snapshot.available || 1) * 100))}%) margin`);
    setText(available, `${usd(snapshot.available)} available`);
    const check = ledger.preview(orderInput());
    setText(liquidation, check.ok ? usdFull(check.liquidationPrice) : '—'); setText(fee, check.ok ? usd(check.fee) : '—');
    submit.disabled = !check.ok; setText(submit, check.ok ? `Paper ${state.side === 'long' ? 'Long' : 'Short'} ${row.symbol || row.coin}`
      : check.error === 'free_only' ? 'Free play required' : check.error === 'stale' ? 'Waiting for fresh quote' : sizeUsd > 0 ? errors[check.error] || 'Check order' : 'Enter position size');
    updateBook(snapshot);
  }
  const bookBody = el('div', { class: 'php-paper-rows' }), empty = el('p', { class: 'php-empty' });
  const tabs = ['positions', 'orders', 'history'].map(tab => button(tab === 'positions' ? 'Paper positions' : tab === 'orders' ? 'Open orders' : 'History', () => { state.tab = tab; update(); }));
  const book = el('section', { class: 'php-paper-book', 'aria-label': 'Paper perpetual positions and orders' }, el('div', { class: 'php-book-tabs' }, tabs), bookBody, empty);
  let bookKey = '';
  function updateBook(snapshot) {
    const key = `${snapshot.revision}:${state.tab}:${snapshot.positions.some(p => p.stale)}`;
    if (key === bookKey) return; bookKey = key;
    tabs.forEach((b, i) => b.setAttribute('aria-pressed', String(state.tab === ['positions', 'orders', 'history'][i])));
    const rows = state.tab === 'positions' ? snapshot.positions : state.tab === 'orders' ? snapshot.pending : [...snapshot.fills].reverse();
    keyed(bookBody, rows, row => `${state.tab}-${row.id}`, row => {
      const title = el('b'), detail = el('span'), value = el('strong'), actions = el('div', { class: 'php-position-actions' });
      if (state.tab === 'positions') {
        actions.append(button('Close 50%', () => report(ledger.close(row.id, .5))), button('Close', () => report(ledger.close(row.id))),
          button('TP/SL', () => edit(row.id)));
      } else if (state.tab === 'orders') actions.append(button('Cancel', () => report(ledger.cancel(row.id))));
      const node = el('article', { class: 'php-paper-row' }, el('div', {}, title, detail), value, actions); node.$ = { title, detail, value }; return node;
    }, (node, row) => {
      setText(node.$.title, `${row.coin} · ${row.side === 'long' ? 'Long' : 'Short'}${row.leverage ? ` ${row.leverage}x` : ''}`);
      const text = state.tab === 'positions' ? `${compact(row.quantity, 5)} · Entry ${usdFull(row.entry)} · Mark ${usdFull(row.mark)} · Margin ${usd(row.margin)} · Liq. ${usdFull(row.liquidationPrice)}${row.stale ? ' · quote stale' : ''}`
        : state.tab === 'orders' ? `${row.kind.toUpperCase()} · ${usd(row.remainingNotional)} remaining${row.kind === 'limit' ? ` at ${usdFull(row.limitPrice)}` : ` · ${row.filledSlices}/${row.slices} slices`}`
          : `${row.type.replaceAll('_', ' ')} · ${usd(row.notional)} at ${usdFull(row.price)} · Fee ${usd(row.fee)}`;
      setText(node.$.detail, text); const pnl = state.tab === 'positions' ? row.unrealized : row.realized;
      setText(node.$.value, Number.isFinite(pnl) ? signed(pnl, 'usd') : ''); node.$.value.dataset.tone = pnl < 0 ? 'down' : 'up';
    });
    empty.hidden = rows.length > 0; setText(empty, state.tab === 'positions' ? 'No open paper perpetual positions.' : state.tab === 'orders' ? 'No pending paper orders.' : 'Paper fills appear here.');
  }
  function report(result) { setText(message, result.ok ? 'Paper account updated.' : errors[result.error] || 'This action is unavailable.'); update(); }
  function edit(id) {
    state.editing?.remove(); const p = ledger.snapshot().positions.find(row => row.id === id); if (!p) return;
    const take = number('Position take-profit price', p.tp ?? ''), stop = number('Position stop-loss price', p.sl ?? '');
    const editor = el('form', { class: 'php-position-editor', 'aria-label': 'Edit position protection', on: { submit(event) {
      event.preventDefault(); const r = ledger.updateProtection(id, { tp: take.value, sl: stop.value }); report(r); if (r.ok) { editor.remove(); state.editing = null; }
    } } }, field('Position take-profit price', take), field('Position stop-loss price', stop), el('button', { type: 'submit', class: 'php-ticket-button' }, 'Save TP/SL'), button('Cancel', () => { editor.remove(); state.editing = null; }));
    state.editing = editor; book.append(editor); take.focus();
  }
  const off = ledger.on(update); update();
  return { form, book, update, setActive(value) { active = Boolean(value); if (active) update(); }, destroy() { off(); state.editing?.remove(); form.remove(); book.remove(); } };
}
