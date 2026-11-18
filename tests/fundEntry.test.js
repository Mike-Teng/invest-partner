import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareFundEntry } from '../src/lib/fundChanges.js';
const now = Date.parse('2026-11-18T12:00:00+08:00');
const base = { funds: [], id: 'new', investor: 'A', date: '2026-11-17', time: '12:00',
  amount: 1000, isWithdrawal: false, currentNav: 20, now };
test('backdated deposit uses explicit historical NAV, never current NAV', () => {
  assert.throws(() => prepareFundEntry(base), /當時成交淨值/);
  const result = prepareFundEntry({ ...base, historicalNav: 10 });
  assert.equal(result.units, 100);
  assert.equal(result.unitPriceSource, 'historical-manual');
  assert.equal(result.effectiveAt, now - 86400000);
  assert.deepEqual(base.funds, []);
});
test('backdated withdrawal uses units available then and rejects damage to a later exit', () => {
  const funds = [ { id: 'first', date: '2026-11-16', investor: 'A', amount: 1000, units: 100, buyPrice: 10 },
    { id: 'exit', date: '2026-11-18', investor: 'A', amount: -2000, units: -100, buyPrice: 20 } ];
  const copy = structuredClone(funds);
  assert.throws(() => prepareFundEntry({ ...base, funds, isWithdrawal: true, amount: 100, historicalNav: 10 }), /單位不足/);
  assert.throws(() => prepareFundEntry({ ...base, funds, historicalNav: 10 }), /全數提領/);
  assert.deepEqual(funds, copy);
});
test('new entries require an actual date/time and today can use current NAV', () => {
  assert.throws(() => prepareFundEntry({ ...base, date: '2026-11-19' }), /未來/);
  assert.throws(() => prepareFundEntry({ ...base, time: '' }), /實際發生時間/);
  assert.equal(prepareFundEntry({ ...base, date: '2026-11-18', time: '', currentNav: 20 }).units, 50);
});
