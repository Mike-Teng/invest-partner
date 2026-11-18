import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTradeEntry, assertSafeTradeChange } from '../src/lib/tradeChanges.js';
import { commitLedgerChange } from '../src/lib/ledgerCommit.js';
const now = Date.parse('2026-11-18T12:00:00+08:00');
const funds = [{ id: 'deposit', date: '2026-11-01', amount: 10000 }];
const buy = { id: 'buy', date: '2026-11-02', ticker: '0050', type: 'BUY', price: 100, qty: 10 };
const args = { trades: [buy], funds, marketPrices: { USDTWD: 30 }, id: 'new', date: '2026-11-18', ticker: '0050', type: 'SELL', price: 110, qty: 10, now };
test('positive input, exact sell-out, oversell and insufficient cash checks', () => {
  assert.equal(prepareTradeEntry(args).qty, 10);
  assert.throws(() => prepareTradeEntry({ ...args, qty: 11 }), /超過當時持倉/);
  for (const value of [0, -1, NaN, Infinity]) {
    assert.throws(() => prepareTradeEntry({ ...args, price: value }), /正數/);
    assert.throws(() => prepareTradeEntry({ ...args, qty: value }), /正數/);
  }
  assert.throws(() => prepareTradeEntry({ ...args, type: 'BUY', qty: 100 }), /現金不足/);
  assert.equal(prepareTradeEntry({ ...args, type: 'BUY', ticker: ' qqqm ', qty: 0.25 }).ticker, 'QQQM');
  assert.throws(() => prepareTradeEntry({ ...args, qty: 0.5 }), /整數/);
});
test('backfill and deletion cannot invalidate later sales; old shortages stay unchanged', () => {
  const sell = { ...buy, id: 'sold', type: 'SELL', qty: 10, date: '2026-11-10' };
  assert.throws(() => prepareTradeEntry({ ...args, trades: [buy, sell], date: '2026-11-05', time: '10:00', qty: 1 }), /超賣/);
  assert.throws(() => assertSafeTradeChange({ beforeTrades: [buy, sell], afterTrades: [sell], funds, exchangeRate: 30 }), /超賣/);
  const legacy = [buy, { ...sell, qty: 11 }];
  const original = structuredClone(legacy);
  prepareTradeEntry({ ...args, trades: legacy, type: 'BUY', ticker: 'QQQM', qty: 0.25 });
  assert.deepEqual(legacy, original);
});
function memoryStore() {
  let revision = 0;
  const receipts = new Map();
  const state = { trades: [buy], funds, marketPrices: { USDTWD: 30 } };
  return {
    state, receipts,
    receipt: async id => receipts.get(id), revision: async () => revision,
    load: async () => structuredClone(state),
    commit: async (id, expected, ledger, change) => {
      if (receipts.has(id)) return receipts.get(id);
      if (expected !== revision) return null;
      revision++;
      state.trades.push(change.after);
      receipts.set(id, change);
      return change;
    },
  };
}
const sale = id => ledger => ({ collection: 'trades', id, before: null,
  after: prepareTradeEntry({ ...args, ...ledger, id, qty: 7 }) });
test('two concurrent sells serialize and only one can consume the holdings', async () => {
  const store = memoryStore();
  const results = await Promise.allSettled([
    commitLedgerChange(store, 'one', sale('one')), commitLedgerChange(store, 'two', sale('two')),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(store.state.trades.length, 2);
  assert.equal(store.receipts.size, 1);
});
test('same operation ID and lost acknowledgement retry commit only once', async () => {
  const store = memoryStore();
  const commit = store.commit;
  let loseAcknowledgement = true;
  store.commit = async (...args) => {
    const result = await commit(...args);
    if (loseAcknowledgement) { loseAcknowledgement = false; throw new Error('network lost'); }
    return result;
  };
  await assert.rejects(commitLedgerChange(store, 'retry', sale('retry')), /network/);
  await commitLedgerChange(store, 'retry', sale('retry'));
  assert.equal(store.state.trades.length, 2);
  assert.equal(store.receipts.size, 1);
});
test('a repeated operation that completes during a fresh read still reports success', async () => {
  const store = memoryStore();
  const load = store.load;
  let first = true;
  store.load = async () => {
    if (first) {
      first = false;
      await store.commit('same', 0, store.state, sale('same')(store.state));
    }
    return load();
  };
  const result = await commitLedgerChange(store, 'same', sale('same'));
  assert.equal(result.id, 'same');
  assert.equal(store.state.trades.length, 2);
});
