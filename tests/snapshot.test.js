import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildAppsScript } from '../apps-script/build.mjs';

function runtime(extra = {}) {
  const context = vm.createContext(extra);
  vm.runInContext(buildAppsScript(), context);
  return context;
}
const buy = { date: '2026-01-01', createdAt: 1, ticker: 'NVDA', type: 'BUY', price: 100, qty: 5 };
const sell = { ...buy, date: '2026-09-30', createdAt: 2, type: 'SELL', price: 200 };

test('daily snapshots remove sold shares even when Firestore returns the sale before its purchase', () => {
  const { calculateSnapshotPortfolio: calculate } = runtime();
  for (const trades of [[buy, sell], [sell, buy]]) {
    const result = calculate(trades, 20000, { NVDA: 300, USDTWD: 30 });
    assert.equal(result.holdings.NVDA.qty, 0);
    assert.equal(result.marketValue, 0);
    assert.equal(result.totalAssets, 35000);
  }
});

test('same-day trade creation order determines remaining average cost', () => {
  const { calculateSnapshotPortfolio: calculate } = runtime();
  const trades = [buy, { ...sell, date: buy.date, qty: 2 }, { ...buy, createdAt: 3, qty: 2, price: 200 }];
  const result = calculate([...trades].reverse(), 20000, { NVDA: 300, USDTWD: 30 });
  assert.equal(result.holdings.NVDA.qty, 5);
  assert.equal(result.holdings.NVDA.totalCostOriginal, 700);
});

test('snapshot ownership uses units after full redemption and retains valuation evidence', () => {
  const { buildDailySnapshot } = runtime();
  const funds = [
    { investor: 'Yi', date: '2026-01-01', amount: 1000, units: 100, buyPrice: 10 },
    { investor: 'Ma', date: '2026-01-01', amount: 1000, units: 100, buyPrice: 10 },
    { investor: 'Yi', date: '2026-10-05', amount: -1200, units: -100, buyPrice: 12 },
  ];
  const result = buildDailySnapshot(funds, [], { USDTWD: 30 }, [], '2026-11-17', 123);
  assert.equal(result.Yi, 0);
  assert.equal(result.Ma, result.total);
  assert.equal(result.total, 800);
  assert.equal(result.calculationVersion, 2);
  assert.equal(JSON.parse(result.valuationDetails).investorData.Yi.units, 0);
});

test('typed Firestore zero, negative numbers and empty strings are decoded without losing their values', () => {
  const { parseFields } = runtime();
  const result = parseFields({ zero: { doubleValue: 0 }, units: { doubleValue: -10 }, amount: { integerValue: '0' }, empty: { stringValue: '' } });
  assert.equal(result.zero, 0);
  assert.equal(result.units, -10);
  assert.equal(result.amount, 0);
  assert.equal(result.empty, '');
});

test('preview cannot write data and scheduled execution writes one verifiable snapshot', () => {
  const writes = [];
  const db = {
    getDocuments: () => [], getDocument: () => ({ fields: { USDTWD: { doubleValue: 30 } } }),
    createDocument: (...args) => writes.push(args),
  };
  const context = runtime({
    FIREBASE_CONFIG: { email: 'test', key: 'test', projectId: 'test' },
    FirestoreApp: { getFirestore: () => db }, Logger: { log: () => {} },
    Utilities: { formatDate: () => '2026-11-17' },
  });
  context.previewDailySnapshot();
  assert.equal(writes.length, 0);
  context.recordDailySnapshot();
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'asset_history');
  assert.equal(writes[0][1].total, 0);
  assert.equal(writes[0][1].date, '2026-11-17');
});
