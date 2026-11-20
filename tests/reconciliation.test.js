import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePortfolio } from '../src/lib/portfolio.js';
import { calculateUnitAccounting, summarizeCashFlows, calculatePerformance } from '../src/lib/accounting.js';
import { prepareTradeEntry, assertSafeTradeChange } from '../src/lib/tradeChanges.js';
import { prepareReconciliation } from '../src/lib/reconciliationChanges.js';
import { assertAfterReconciliation } from '../src/lib/reconciliation.js';
import { buildSnapshot } from '../src/lib/snapshot.js';
import { buildAppsScript } from '../apps-script/build.mjs';
import vm from 'node:vm';

const now = Date.parse('2026-11-18T12:00:00+08:00');
const funds = [{ id: 'fund', date: '2026-01-01', amount: 200000, investor: 'Sam', units: 20000, buyPrice: 10 }];
const trades = [
  { id: 'buy', date: '2026-01-02', ticker: '0050', type: 'BUY', qty: 820, price: 70 },
  { id: 'sell', date: '2026-09-30', ticker: '0050', type: 'SELL', qty: 870, price: 100 },
  { id: 'us', date: '2026-02-01', ticker: 'QQQM', type: 'BUY', qty: 2, price: 100 },
];
const marketPrices = { USDTWD: 30, '0050': 100, QQQM: 120 };
const ledger = { funds, trades, marketPrices };
const reconciliation = prepareReconciliation({ ...ledger, cashBalance: 8000, closedTickers: ['0050'], reason: 'Confirmed cash and closed position', now }).after;

test('confirmed close-out releases all new shares without inventing a missing purchase', () => {
  const original = structuredClone(ledger);
  const purchase = prepareTradeEntry({ ...ledger, reconciliation, id: 'new', date: '2026-11-18',
    ticker: '0050', type: 'BUY', qty: 10, price: 100, now: now + 1000 });
  const portfolio = calculatePortfolio([...trades, purchase], 200000, marketPrices, reconciliation);
  assert.equal(portfolio.holdings['0050'].qty, 10);
  assert.equal(portfolio.holdings['0050'].totalCostOriginal, 1000);
  assert.equal(portfolio.cashBalance, 7000);
  assert.equal(portfolio.warnings.length, 0);
  assert.deepEqual(ledger, original);
  assert.equal(calculatePortfolio(trades, 200000, marketPrices).holdings['0050'].qty, -50);
});

test('cash checkpoint is not an investor deposit and remains stable when old USD trades are repriced', () => {
  for (const rate of [30, 32.99, 35]) {
    const portfolio = calculatePortfolio(trades, 200000, { ...marketPrices, USDTWD: rate }, reconciliation);
    assert.equal(portfolio.cashBalance, 8000);
    assert.equal(portfolio.holdings['0050'].qty, 0);
    const accounting = calculateUnitAccounting({ funds, investors: ['Sam'], historyData: [], totalAssets: portfolio.totalAssets });
    assert.equal(accounting.investorData.Sam.units, 20000);
    const flows = summarizeCashFlows(funds);
    assert.equal(flows.deposits, 200000);
    assert.equal(calculatePerformance({ assets: portfolio.totalAssets, ...flows }).profit, portfolio.totalAssets - 200000);
  }
  assert.equal(calculatePortfolio(trades, 201000, marketPrices, reconciliation).cashBalance, 9000);
});

test('cash and overselling checks still protect new transactions after reconciliation', () => {
  const args = { ...ledger, reconciliation, id: 'new', date: '2026-11-18', ticker: '0050',
    type: 'BUY', qty: 80, price: 100, now: now + 1000 };
  const purchase = prepareTradeEntry(args);
  assert.equal(calculatePortfolio([...trades, purchase], 200000, marketPrices, reconciliation).cashBalance, 0);
  assert.throws(() => prepareTradeEntry({ ...args, qty: 81 }), /現金不足/);
  assert.throws(() => prepareTradeEntry({ ...args, type: 'SELL', qty: 1 }), /超賣|超過當時持倉/);
  const sale = prepareTradeEntry({ ...args, id: 'sale', trades: [...trades, purchase], type: 'SELL', qty: 80, now: now + 2000 });
  assert.throws(() => assertSafeTradeChange({ beforeTrades: [...trades, purchase, sale], afterTrades: [...trades, sale],
    funds, exchangeRate: 30, reconciliation }), /超賣|超過當時持倉/);
});

test('the checkpoint protects old records and rejects duplicate or invalid reconciliation', () => {
  assert.throws(() => assertAfterReconciliation({ collection: 'trades', before: trades[0] }, reconciliation), /早於/);
  assert.throws(() => assertAfterReconciliation({ collection: 'funds', before: funds[0] }, reconciliation), /早於/);
  assert.throws(() => prepareTradeEntry({ ...ledger, reconciliation, id: 'past', date: '2026-10-01', time: '12:00',
    ticker: '0050', type: 'BUY', qty: 10, price: 100, now }), /早於/);
  assert.throws(() => prepareReconciliation({ ...ledger, reconciliation, cashBalance: 8000, reason: 'Duplicate', now }), /重複/);
  assert.throws(() => prepareReconciliation({ ...ledger, cashBalance: -1, reason: 'Invalid', now }), /餘額/);
  assert.throws(() => prepareReconciliation({ ...ledger, cashBalance: 8000, closedTickers: ['QQQM'], reason: 'Invalid', now }), /舊負股數/);
});

test('web and daily snapshots share the checkpoint without changing snapshots before its date', () => {
  const runtime = vm.createContext({});
  vm.runInContext(buildAppsScript(), runtime);
  const web = buildSnapshot(funds, trades, marketPrices, [], '2026-11-18', now + 1000, reconciliation);
  const daily = runtime.buildDailySnapshot(funds, trades, marketPrices, [], '2026-11-18', now + 1000, reconciliation);
  assert.deepEqual(JSON.parse(JSON.stringify(daily)), web);
  assert.equal(web.calculationVersion, 4);
  assert.equal(JSON.parse(web.valuationDetails).cashBalance, 8000);
  assert.equal(web.total, 15200);
  assert.equal(JSON.parse(web.cashFlowDetails).total.deposits, 200000);
  assert.equal(JSON.parse(web.valuationDetails).holdings['0050'].qty, 0);
  const earlier = ['2026-11-17', now - 86400000];
  assert.deepEqual(buildSnapshot(funds, trades, marketPrices, [], ...earlier, reconciliation),
    buildSnapshot(funds, trades, marketPrices, [], ...earlier));
});

test('Apps Script decodes the actual reconciliation array and map field shapes', () => {
  const runtime = vm.createContext({});
  vm.runInContext(buildAppsScript(), runtime);
  const parsed = runtime.parseFields({
    closedTickers: { arrayValue: { values: [{ stringValue: '0050' }] } },
    previousHoldings: { mapValue: { fields: { '0050': { mapValue: { fields: { qty: { doubleValue: -50 } } } } } } },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), { closedTickers: ['0050'], previousHoldings: { '0050': { qty: -50 } } });
});
