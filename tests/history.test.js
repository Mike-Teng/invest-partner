import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { historicalPerformance } from '../src/lib/history.js';
import { buildSnapshot } from '../src/lib/snapshot.js';
import { buildAppsScript } from '../apps-script/build.mjs';
const at = time => Date.parse(`2026-11-18T${time}:00+08:00`);
const early = { id: 'early', date: '2026-11-18', investor: 'A', amount: 1000, units: 100, buyPrice: 10, createdAt: at('09:00') };
const late = { ...early, id: 'late', amount: 500, units: 50, createdAt: at('15:00') };
const snapshot = { id: 'history', date: '2026-11-18', timestamp: at('12:00'), total: 1200, A: 1200 };
test('a later same-day deposit cannot reduce an earlier snapshot profit', () => {
  const result = historicalPerformance(snapshot, [early, late], [], 'A');
  assert.equal(result.totalProfit, 200);
  assert.equal(result.meProfit, 200);
  assert.equal(result.approximateCashFlows, false);
});
test('future audited add/edit/delete leave legacy snapshot profits unchanged', () => {
  const edit = { ...early, amount: 1500 };
  const added = { ...early, id: 'backfill', date: '2026-11-17', amount: 900 };
  const operations = [
    { collection: 'funds', targetId: early.id, before: early, after: edit, recordedAt: at('13:00'), revision: 1 },
    { collection: 'funds', targetId: added.id, before: null, after: added, recordedAt: at('14:00'), revision: 2 },
    { collection: 'funds', targetId: early.id, before: edit, after: null, recordedAt: at('15:00'), revision: 3 },
  ];
  const inputs = structuredClone({ snapshot, operations, funds: [added, late] });
  assert.equal(historicalPerformance(snapshot, inputs.funds, operations, 'A').totalProfit, 200);
  assert.deepEqual({ snapshot, operations, funds: [added, late] }, inputs);
});
test('new web and scheduled snapshots freeze the same cash flows and ownership', () => {
  const original = structuredClone([early, late]);
  const saved = buildSnapshot(original, [], {}, [], snapshot.date, snapshot.timestamp);
  const context = vm.createContext({});
  vm.runInContext(buildAppsScript(), context);
  const scheduled = context.buildDailySnapshot(original, [], {}, [], snapshot.date, snapshot.timestamp);
  assert.deepEqual(JSON.parse(JSON.stringify(scheduled)), saved);
  const result = historicalPerformance(saved, [], [], 'A');
  assert.equal(result.totalProfit, 0);
  assert.equal(result.meProfit, 0);
  assert.equal(result.frozenCashFlows, true);
  assert.equal(JSON.parse(saved.cashFlowDetails).total.deposits, 1000);
  assert.deepEqual(original, [early, late]);
});
test('existing valuation evidence is preferred and legacy ambiguous dates are marked', () => {
  const saved = { ...snapshot, valuationDetails: JSON.stringify({ cashFlows: { deposits: 1000, withdrawals: 0 },
    investorData: { A: { deposits: 1000, withdrawals: 0 } } }) };
  assert.equal(historicalPerformance(saved, [], [], 'A').meProfit, 200);
  const ambiguous = { ...early }; delete ambiguous.createdAt;
  assert.equal(historicalPerformance(snapshot, [ambiguous]).approximateCashFlows, true);
});
