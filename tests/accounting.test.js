import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUnitAccounting, calculatePerformance, summarizeCashFlows, createFundTransaction } from '../src/lib/accounting.js';

const fund = (amount, units, buyPrice = 10, extra = {}) => ({
  investor: 'Yi', date: '2026-01-01', amount, units, buyPrice, ...extra,
});
const ledger = (funds, totalAssets = 0, historyData = []) => calculateUnitAccounting({
  funds, totalAssets, historyData, investors: ['Yi', 'Ma'],
});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('rounded full redemption preserves saved negative units and closes the owner exactly', () => {
  for (const units of [100.04, 100.06]) {
    const transaction = createFundTransaction({ amount: Math.round(units * 10), isWithdrawal: true, unitPrice: 10, ownedUnits: units });
    const funds = [fund(units * 10, units), fund(1000, 100, 10, { investor: 'Ma' }), fund(transaction.amount, transaction.units)];
    const original = JSON.stringify(funds);
    const result = ledger(funds, 1200);
    assert.equal(result.investorData.Yi.units, 0);
    assert.equal(result.enrichedFunds.at(-1).units, -units);
    assert.equal(result.totalUnitsIssued, 100);
    assert.equal(result.currentUnitPrice, 12);
    assert.equal(JSON.stringify(funds), original, 'must not mutate source records');
  }
});

test('partial withdrawal retains the actual remaining units', () => {
  const transaction = createFundTransaction({ amount: 250, isWithdrawal: true, unitPrice: 10, ownedUnits: 100 });
  const result = ledger([fund(1000, 100), fund(transaction.amount, transaction.units)], 750);
  assert.equal(result.investorData.Yi.units, 75);
  assert.equal(result.currentUnitPrice, 10);
  assert.equal(result.netContributions, 750);
});

test('negative stored units can recover a missing price without losing full-redemption precision', () => {
  const withoutPrice = ledger([fund(1000.4, 100.04), { ...fund(-1000, -100.04), buyPrice: null }]);
  assert.equal(withoutPrice.investorData.Yi.units, 0);
  close(withoutPrice.enrichedFunds[1].buyPrice, 1000 / 100.04);
});

test('legacy missing units are derived from the saved price with the correct sign', () => {
  const result = ledger([fund(1000, null), fund(-250, '')], 750);
  assert.equal(result.enrichedFunds[1].units, -25);
  assert.equal(result.investorData.Yi.units, 75);
});

test('legacy records without price or units use earlier snapshots', () => {
  const result = ledger([
    fund(1000, 100),
    fund(120, null, null, { investor: 'Ma', date: '2026-01-03' }),
  ], 1320, [{ date: '2026-01-02', total: 1200, timestamp: 1 }]);
  assert.equal(result.investorData.Ma.units, 10);
  assert.equal(result.currentUnitPrice, 12);
});

test('floating point cancellation closes to zero but real small balances are preserved', () => {
  assert.equal(ledger([fund(0.1, 0.1, 1), fund(0.2, 0.2, 1), fund(-0.3, -0.3, 1)]).totalUnitsIssued, 0);
  close(ledger([fund(1000, 100), fund(-999.8, -99.98)]).investorData.Yi.units, 0.02);
});

test('all owners exit without NaN and rounding cash remains visible for reconciliation', () => {
  const result = ledger([fund(1000.4, 100.04), fund(-1000, -100.04)], 0.4);
  assert.equal(result.totalUnitsIssued, 0);
  assert.equal(result.currentUnitPrice, 10);
  assert.equal(result.totalAssets, 0.4);
  assert.equal(result.hasUnallocatedAssets, true);
  assert.equal(ledger([fund(1000, 100), fund(-1000, -100)], 0).hasUnallocatedAssets, false);
});

test('a redeemed owner can invest again without inheriting old unit dust', () => {
  const result = ledger([
    fund(1000.4, 100.04), fund(-1000, -100.04),
    fund(600, 50, 12, { date: '2026-02-01' }),
  ], 600);
  assert.equal(result.investorData.Yi.units, 50);
  assert.equal(result.investorData.Yi.deposits, 1600.4);
  assert.equal(result.investorData.Yi.withdrawals, 1000);
});

test('same-day cash flows follow creation order even if input documents are unordered', () => {
  const result = ledger([
    fund(-1000, -100.04, 10, { createdAt: 2 }),
    fund(600, 50, 12, { createdAt: 3 }),
    fund(1000.4, 100.04, 10, { createdAt: 1 }),
  ], 600);
  assert.equal(result.investorData.Yi.units, 50);
  assert.deepEqual(result.enrichedFunds.map(f => f.createdAt), [1, 2, 3]);
});

test('withdrawing cash does not inflate lifetime profit or return on deposits', () => {
  for (const withdrawals of [0, 600, 1200]) {
    const result = calculatePerformance({ assets: 1200 - withdrawals, deposits: 1000, withdrawals });
    assert.equal(result.profit, 200);
    assert.equal(result.returnOnDeposits, 0.2);
  }
});

test('full redemption retains realized gains even when net contributions become negative', () => {
  const result = calculatePerformance({ assets: 0, ...summarizeCashFlows([fund(1000, 100), fund(-1200, -100, 12)]) });
  assert.equal(result.netContributions, -200);
  assert.equal(result.profit, 200);
  assert.equal(result.returnOnDeposits, 0.2);
});

test('losses, missing deposits and repeat deposits have explicit return definitions', () => {
  assert.equal(calculatePerformance({ assets: 0, deposits: 1000, withdrawals: 800 }).returnOnDeposits, -0.2);
  assert.equal(calculatePerformance({ assets: 0, deposits: 0, withdrawals: 0 }).returnOnDeposits, null);
  assert.equal(calculatePerformance({ assets: 0, deposits: 2000, withdrawals: 2200 }).returnOnDeposits, 0.1);
});

test('sum of owner assets and lifetime profits matches the fund after a full redemption', () => {
  const result = ledger([fund(1000, 100), fund(1000, 100, 10, { investor: 'Ma' }), fund(-1200, -100, 12)], 1200);
  const owners = Object.values(result.investorData).map(data => calculatePerformance({ assets: data.units * result.currentUnitPrice, ...data }));
  assert.equal(owners.reduce((sum, data) => sum + data.assets, 0), result.totalAssets);
  assert.equal(owners.reduce((sum, data) => sum + data.profit, 0), calculatePerformance({ assets: result.totalAssets, ...result }).profit);
});

test('reject withdrawals with no units, invalid NAV and a full dollar over the balance', () => {
  for (const options of [
    { amount: 1001, unitPrice: 10, ownedUnits: 100 },
    { amount: 1, unitPrice: 10, ownedUnits: 0 },
    { amount: 100, unitPrice: 0, ownedUnits: 100 },
    { amount: Infinity, unitPrice: 10, ownedUnits: 100 },
    { amount: -100, unitPrice: 10, ownedUnits: 100 },
  ]) assert.throws(() => createFundTransaction({ isWithdrawal: true, ...options }));
});
