import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareFundNavEdit } from '../src/lib/fundChanges.js';
import { calculateUnitAccounting } from '../src/lib/accounting.js';

const funds = [
  { id: 'deposit', investor: 'A', date: '2026-01-01', amount: 1000.4, units: 100.04, buyPrice: 10 },
  { id: 'exit', investor: 'A', date: '2026-01-02', amount: -1000, units: -100.04, buyPrice: 10 },
];
test('2: saving the same redemption NAV does not rewrite rounded signed units', () => {
  const original = JSON.stringify(funds);
  assert.equal(prepareFundNavEdit({ funds, fundId: 'exit', newNav: 10 }), null);
  assert.equal(JSON.stringify(funds), original);
});
test('2: permissible rounding correction retains an exact full exit', () => {
  const update = prepareFundNavEdit({ funds, fundId: 'exit', newNav: 9.999 });
  const result = calculateUnitAccounting({ funds: funds.map(f => f.id === 'exit' ? { ...f, ...update } : f),
    investors: ['A'], historyData: [], totalAssets: 0.4 });
  assert.equal(result.investorData.A.units, 0);
  assert.equal(update.isFullRedemption, true);
});
test('2: incompatible settlement NAV and upstream edits cannot invalidate a completed exit', () => {
  assert.throws(() => prepareFundNavEdit({ funds, fundId: 'exit', newNav: 12 }), /結清金額/);
  assert.throws(() => prepareFundNavEdit({ funds, fundId: 'deposit', newNav: 20 }), /單位不足/);
  assert.throws(() => prepareFundNavEdit({ funds, fundId: 'deposit', newNav: 5 }), /全數提領/);
  assert.throws(() => prepareFundNavEdit({ funds, fundId: 'deposit', newNav: Infinity }), /正數淨值/);
});
test('2: partial redemption edits retain normal signed-unit calculation', () => {
  const partial = [funds[0], { ...funds[1], amount: -200, units: -20 }];
  assert.deepEqual(prepareFundNavEdit({ funds: partial, fundId: 'exit', newNav: 20 }), { buyPrice: 20, units: -10 });
});
