import { calculateUnitAccounting, createFundTransaction } from './accounting.js';
import { compareEntries, entryTime, taipeiDate } from './entryTime.js';

const tolerance = value => Number.EPSILON * 64 * Math.max(1, Math.abs(value));
const ordered = funds => [...funds].sort(compareEntries);

function resolve(funds, historyData) {
  return calculateUnitAccounting({ funds, historyData, totalAssets: 0,
    investors: [...new Set(funds.map(fund => fund.investor))] }).enrichedFunds;
}

function balancesAtEntries(funds) {
  const balances = {};
  return ordered(funds).map(fund => {
    const before = balances[fund.investor] || 0;
    let after = before + fund.units;
    if (Math.abs(after) <= tolerance(before)) after = 0;
    balances[fund.investor] = after;
    return { fund, before, after, fullExit: fund.amount < 0 && before > 0 && after === 0 };
  });
}

// Validate a proposed change without rewriting any later saved units or snapshots.
export function assertSafeFundChange(beforeFunds, afterFunds, historyData = [], changedId) {
  const before = balancesAtEntries(resolve(beforeFunds, historyData));
  const after = balancesAtEntries(resolve(afterFunds, historyData));
  for (const entry of after) {
    const previous = before.find(item => item.fund.id === entry.fund.id);
    if (entry.after < -tolerance(entry.before)
      && (!previous || entry.after < previous.after - tolerance(previous.after))) {
      throw new Error('這項修改會讓合夥人的單位不足，請先核對後續提領紀錄。');
    }
    if (previous?.fullExit && entry.after !== 0) {
      throw new Error('這項修改會改變已完成的全數提領，請先核對結清紀錄。');
    }
    if (previous && entry.fund.id !== changedId
      && Math.abs(entry.fund.units - previous.fund.units) > tolerance(previous.fund.units)) {
      throw new Error('這項修改會改變其他歷史紀錄的單位，請先完成歷史對帳。');
    }
  }
}

export function prepareFundNavEdit({ funds, historyData = [], fundId, newNav }) {
  if (!Number.isFinite(newNav) || newNav <= 0) throw new Error('請輸入有效的正數淨值');
  const entries = balancesAtEntries(resolve(funds, historyData));
  const entry = entries.find(item => item.fund.id === fundId);
  if (!entry) throw new Error('找不到資金紀錄，請重新整理');
  if (newNav === entry.fund.buyPrice) return null;
  const isFullRedemption = entry.fullExit || entry.fund.isFullRedemption === true;
  let units = entry.fund.amount / newNav;
  if (isFullRedemption) {
    if (!(entry.before > 0) || Math.abs(Math.abs(entry.fund.amount) - entry.before * newNav) >= 1) {
      throw new Error('此筆為全數提領；新淨值與實際結清金額不符，不能直接重算單位。');
    }
    units = -entry.before;
  }
  const update = { buyPrice: newNav, units, ...(isFullRedemption ? { isFullRedemption: true } : {}) };
  const proposed = funds.map(fund => fund.id === fundId ? { ...fund, ...update } : fund);
  assertSafeFundChange(funds, proposed, historyData, fundId);
  return update;
}

export function fundEntryContext({ funds, historyData = [], investor, date, time, now = Date.now(), id = '' }) {
  const effectiveAt = entryTime({ date, time, now });
  const marker = { id, date, effectiveAt };
  const preceding = funds.filter(fund => compareEntries(fund, marker) < 0);
  const balances = calculateUnitAccounting({ funds: preceding, historyData, investors: [investor], totalAssets: 0 });
  return {
    effectiveAt, ownedUnits: balances.investorData[investor].units,
    requiresHistoricalNav: date < taipeiDate(now) || funds.some(fund => compareEntries(fund, marker) >= 0),
  };
}

export function prepareFundEntry({ funds, historyData = [], id, investor, date, time, amount,
  isWithdrawal, historicalNav, currentNav, hasUnallocatedAssets = false, now = Date.now() }) {
  if (!investor) throw new Error('請選擇合夥人');
  const context = fundEntryContext({ funds, historyData, investor, date, time, now, id });
  const nav = context.requiresHistoricalNav ? Number(historicalNav) : currentNav;
  if (context.requiresHistoricalNav && !(Number.isFinite(nav) && nav > 0)) {
    throw new Error('補登資金必須填寫當時成交淨值，不能使用今天的淨值');
  }
  if (!context.requiresHistoricalNav && hasUnallocatedAssets) {
    throw new Error('所有單位已結清，但帳上仍有未分配資產，請先核對結清差額');
  }
  const transaction = createFundTransaction({ amount, isWithdrawal, unitPrice: nav, ownedUnits: context.ownedUnits });
  const fund = { id, date, investor, ...transaction, effectiveAt: context.effectiveAt, createdAt: now,
    unitPriceSource: context.requiresHistoricalNav ? 'historical-manual' : 'current',
    isFullRedemption: isWithdrawal && transaction.units === -context.ownedUnits };
  assertSafeFundChange(funds, [...funds, fund], historyData, id);
  return fund;
}
