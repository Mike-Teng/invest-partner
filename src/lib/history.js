import { summarizeCashFlows, calculatePerformance } from './accounting.js';

const millis = value => typeof value?.toMillis === 'function' ? value.toMillis() : Number(value || 0);
const taipeiDay = timestamp => new Date(timestamp + 28800000).toISOString().slice(0, 10);
function parse(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; }
}
const validFlows = value => value && Number.isFinite(value.deposits) && Number.isFinite(value.withdrawals)
  && value.deposits >= 0 && value.withdrawals >= 0;

// Legacy documents lack a frozen cash-flow ledger. Undo only future audited
// changes, without touching the saved snapshots or original fund documents.
export function fundsForSnapshot(snapshot, funds, operations = []) {
  const cutoff = millis(snapshot.timestamp);
  const ledger = new Map(funds.map(fund => [fund.id, fund]));
  const later = operations.filter(operation => operation.collection === 'funds'
    && millis(operation.recordedAt) > cutoff).sort((a, b) => b.revision - a.revision);
  for (const operation of later) {
    if (operation.before) ledger.set(operation.targetId, operation.before);
    else ledger.delete(operation.targetId);
  }
  let approximate = false;
  const eligible = [...ledger.values()].filter(fund => {
    if (fund.date !== snapshot.date) return fund.date < snapshot.date;
    const effectiveAt = millis(fund.effectiveAt);
    if (effectiveAt > 0) return effectiveAt <= cutoff;
    const createdAt = millis(fund.createdAt);
    if (createdAt > 0 && taipeiDay(createdAt) === fund.date) return createdAt <= cutoff;
    approximate = true;
    // Preserve date-based legacy treatment when the actual time was never saved.
    return true;
  });
  return { funds: eligible, approximate };
}

export function snapshotCashFlows(snapshot, funds, operations = [], investor) {
  const frozen = parse(snapshot.cashFlowDetails);
  if (frozen?.version === 1 && validFlows(frozen.total)) {
    const personal = frozen.investors?.[investor];
    if (!investor || validFlows(personal) || !Object.hasOwn(frozen.investors || {}, investor)) {
      return { total: frozen.total, personal: personal || summarizeCashFlows([]), approximate: false, frozen: true };
    }
  }
  const valuation = parse(snapshot.valuationDetails);
  const personal = valuation?.investorData?.[investor];
  if (validFlows(valuation?.cashFlows) && (!investor || validFlows(personal)
    || (valuation.investorData && !Object.hasOwn(valuation.investorData, investor)))) {
    return { total: valuation.cashFlows, personal: personal || summarizeCashFlows([]), approximate: false, frozen: true };
  }
  const legacy = fundsForSnapshot(snapshot, funds, operations);
  return { total: summarizeCashFlows(legacy.funds),
    personal: summarizeCashFlows(legacy.funds.filter(fund => fund.investor === investor)),
    approximate: legacy.approximate, frozen: false };
}

export function historicalPerformance(snapshot, funds, operations = [], investor) {
  const flows = snapshotCashFlows(snapshot, funds, operations, investor);
  return { ...snapshot,
    totalProfit: calculatePerformance({ assets: snapshot.total, ...flows.total }).profit,
    meProfit: calculatePerformance({ assets: snapshot[investor] || 0, ...flows.personal }).profit,
    approximateCashFlows: flows.approximate, frozenCashFlows: flows.frozen };
}
