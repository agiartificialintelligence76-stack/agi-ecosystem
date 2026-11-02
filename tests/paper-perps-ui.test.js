import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaperPerps } from '../src/games/trenchingsimulator/paper-perps.js';
import { createPaperPerpsTicket } from '../src/games/trenchingsimulator/boards/phomo-perps-ticket.js';
import { installDom, byLabel, byText, byClass } from './helpers/phomo-dom.js';
function fixture(open = true) {
  installDom(); let cash = 1000, now = 100000, reserves = 0;
  const ledger = createPaperPerps({now:() => now,isOpen:() => open, account:{ available:() => cash,
    reserve(key,value) { if (value > cash) return false; cash -= value; reserves++; return true; }, mark() {}, settle(key,value) { cash += value; } } });
  const row = {coin:'BTC',symbol:'BTC',mark:100,leverage:40}; ledger.observeMarkets([row],{at:now});
  const ticket = createPaperPerpsTicket({ledger,market:() => row}); document.body.append(ticket.form,ticket.book);
  return {ledger,ticket,get reserves() {return reserves;},set(label,value) { const n = byLabel(document.body,label); n.value = value; n.fire(n.tagName === 'select' ? 'change' : 'input'); return n; }, stale() {now += 31000;ticket.update();},destroy() {ticket.destroy();ledger.destroy();}};
}
test('paper ticket submits once in dollars, shows shared positions, and closes half without recreating focused controls', () => {
  const f = fixture(); const amount = f.set('Position size in practice dollars','1000'); amount.focus(); f.ticket.update(); assert.equal(document.activeElement,amount);
  f.ticket.form.fire('submit'); assert.equal(f.reserves,1); assert.equal(f.ledger.snapshot().positions[0].quantity,10);
  assert.equal(amount.value,''); assert.match(f.ticket.book.textContent,/BTC · Long 20x/);
  byText(f.ticket.book,'Close 50%').click(); assert.equal(f.ledger.snapshot().positions[0].quantity,5);
  byText(f.ticket.book,'TP/SL').click(); f.set('Position take-profit price','120'); f.set('Position stop-loss price','90');
  byLabel(f.ticket.book,'Edit position protection').fire('submit'); assert.equal(f.ledger.snapshot().positions[0].tp,120);
  byText(f.ticket.book,'Close').click(); assert.equal(f.ledger.snapshot().positions.length,0); f.destroy(); assert.equal(document.body.children.length,0);
});
test('limit/TWAP fields, leverage and margin slider create functional cancellable paper orders', () => {
  const f = fixture(); f.set('Perpetual order type','limit'); f.set('Limit price','90'); f.set('Position size in practice dollars','1000');
  f.ticket.form.fire('submit'); assert.equal(f.ledger.snapshot().pending[0].kind,'limit');
  byText(f.ticket.book,'Open orders').click(); byText(f.ticket.book,'Cancel').click(); assert.equal(f.ledger.snapshot().pending.length,0);
  f.set('Leverage','10'); f.set('Percentage of available margin','50'); assert.ok(Number(byLabel(f.ticket.form,'Position size in practice dollars').value) > 4900);
  f.set('Perpetual order type','twap'); f.set('TWAP duration in minutes','1'); f.set('TWAP number of slices','6');
  f.ticket.form.fire('submit'); assert.equal(f.ledger.snapshot().pending[0].filledSlices,1); assert.equal(f.ledger.snapshot().pending[0].slices,6); f.destroy();
});
test('challenge and stale quote tickets disable submission and cannot debit play cash', () => {
  for (const open of [false,true]) { const f = fixture(open); f.set('Position size in practice dollars','100'); if (open) f.stale();
    assert.equal(byClass(f.ticket.form,'php-ticket-submit').disabled,true); f.ticket.form.fire('submit'); assert.equal(f.reserves,0); f.destroy(); }
});
