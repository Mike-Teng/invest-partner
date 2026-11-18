import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { calculatePortfolio } from '../src/lib/portfolio.js';
import { buildAppsScript } from '../apps-script/build.mjs';

test('3: website and daily snapshot agree when same-day documents arrive sell-first', () => {
  const trades = [
    { id: 'sell', date: '2026-01-01', createdAt: 2, ticker: 'NVDA', type: 'SELL', qty: 5, price: 200 },
    { id: 'buy', date: '2026-01-01', createdAt: 1, ticker: 'NVDA', type: 'BUY', qty: 5, price: 100 },
  ];
  const original = JSON.stringify(trades);
  const context = vm.createContext({});
  vm.runInContext(buildAppsScript(), context);
  const prices = { USDTWD: 30, NVDA: 300 };
  const web = calculatePortfolio(trades, 20000, prices);
  const scheduled = context.calculateSnapshotPortfolio(trades, 20000, prices);
  assert.equal(web.totalAssets, 35000);
  assert.equal(web.holdings.NVDA.qty, 0);
  assert.equal(web.holdingsList.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(scheduled)), web);
  assert.equal(JSON.stringify(trades), original);
});
test('3: explicit execution time takes priority over entry time for a backfilled trade', () => {
  const trades = [
    { date: '2026-01-01', effectiveAt: 1, createdAt: 3, ticker: 'QQQM', type: 'BUY', qty: 2, price: 100 },
    { date: '2026-01-01', effectiveAt: 2, createdAt: 2, ticker: 'QQQM', type: 'SELL', qty: 1, price: 150 },
  ];
  const result = calculatePortfolio(trades, 10000, { QQQM: 200, USDTWD: 30 });
  assert.equal(result.holdings.QQQM.qty, 1);
  assert.equal(result.holdingsList[0].unrealizedPL, 3000);
});
test('3: legacy oversold records remain visible as warnings without source changes', () => {
  const trades = [
    { date: '2026-01-01', ticker: '0050', type: 'BUY', qty: 8, price: 70 },
    { date: '2026-01-02', ticker: '0050', type: 'SELL', qty: 9, price: 100 },
  ];
  const result = calculatePortfolio(trades, 100000, { '0050': 100 });
  assert.equal(result.holdings['0050'].qty, -1);
  assert.equal(result.cashBalance, 100340);
  assert.equal(result.warnings.length, 1);
});
