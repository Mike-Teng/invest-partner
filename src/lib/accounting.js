// Keep cash flows separate from units: withdrawals can include both principal and profit.
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function summarizeCashFlows(funds) {
  let deposits = 0;
  let withdrawals = 0;
  for (const fund of funds) {
    const amount = numberOrNull(fund.amount) ?? 0;
    if (amount > 0) deposits += amount;
    else withdrawals -= amount;
  }
  return { deposits, withdrawals, netContributions: deposits - withdrawals };
}

export function calculatePerformance({ assets, deposits, withdrawals }) {
  const netContributions = deposits - withdrawals;
  const profit = assets + withdrawals - deposits;
  return {
    assets, deposits, withdrawals, netContributions, profit,
    // A simple cumulative return on all deposits, not annualized or time-weighted.
    returnOnDeposits: deposits > 0 ? profit / deposits : null,
  };
}

// Only normalize machine-precision cancellation, not economically small balances.
function addUnits(balance, change) {
  const result = balance + change;
  const tolerance = Number.EPSILON * 32 * Math.max(1, Math.abs(balance), Math.abs(change));
  return Math.abs(result) <= tolerance ? 0 : result;
}

export function calculateUnitAccounting({ funds, investors, historyData, totalAssets }) {
  const investorData = Object.fromEntries(investors.map(name => [name, {
    units: 0, deposits: 0, withdrawals: 0, netContributions: 0,
  }]));
  const sortedFunds = [...funds].sort((a, b) =>
    a.date.localeCompare(b.date)
    || (numberOrNull(a.effectiveAt ?? a.createdAt) ?? 0) - (numberOrNull(b.effectiveAt ?? b.createdAt) ?? 0)
    || String(a.id || '').localeCompare(String(b.id || '')));
  const sortedHistory = [...historyData].sort((a, b) =>
    a.date.localeCompare(b.date) || (numberOrNull(a.timestamp) ?? 0) - (numberOrNull(b.timestamp) ?? 0));
  const enrichedFunds = [];

  for (const fund of sortedFunds) {
    const amount = numberOrNull(fund.amount) ?? 0;
    let units = numberOrNull(fund.units);
    let buyPrice = numberOrNull(fund.buyPrice);
    // A negative unit count is valid for a withdrawal. Preserve it, including
    // an exact full redemption whose cash amount was rounded to whole TWD.
    const hasStoredUnits = units !== null && units !== 0 && Math.sign(units) === Math.sign(amount);
    if (!hasStoredUnits) {
      if (!(buyPrice > 0)) {
        const previousSnapshot = sortedHistory.filter(h => h.date < fund.date).at(-1);
        const unitsAtSnapshot = previousSnapshot
          ? enrichedFunds.filter(f => f.date <= previousSnapshot.date).reduce((sum, f) => addUnits(sum, f.units), 0)
          : 0;
        buyPrice = unitsAtSnapshot > 0 && previousSnapshot.total > 0
          ? previousSnapshot.total / unitsAtSnapshot : 10;
      }
      units = amount / buyPrice;
    } else if (!(buyPrice > 0)) {
      buyPrice = amount / units;
    }

    const data = investorData[fund.investor];
    if (data) {
      const nextUnits = addUnits(data.units, units);
      if (nextUnits === 0) units = -data.units;
      data.units = nextUnits;
      if (amount > 0) data.deposits += amount;
      else data.withdrawals -= amount;
      data.netContributions = data.deposits - data.withdrawals;
    }
    enrichedFunds.push({ ...fund, units, buyPrice });
  }

  // Sum each owner's balance so fully redeemed owners contribute exactly zero.
  const unknownUnits = enrichedFunds.filter(f => !investorData[f.investor]).reduce((sum, f) => addUnits(sum, f.units), 0);
  const totalUnitsIssued = Object.values(investorData).reduce((sum, data) => addUnits(sum, data.units), unknownUnits);
  const currentUnitPrice = totalUnitsIssued > 0 ? totalAssets / totalUnitsIssued : 10;
  return {
    ...summarizeCashFlows(funds), investorData, enrichedFunds,
    totalUnitsIssued, currentUnitPrice, totalAssets,
    // Do not silently give cash left after the last redemption to a new investor.
    hasUnallocatedAssets: totalUnitsIssued === 0 && Math.abs(totalAssets) >= 0.005,
  };
}

export function createFundTransaction({ amount, isWithdrawal, unitPrice, ownedUnits }) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('請輸入有效的正數金額');
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error('目前淨值無效，請先核對資產資料');
  const signedAmount = isWithdrawal ? -amount : amount;
  let units = signedAmount / unitPrice;
  if (isWithdrawal) {
    if (!Number.isFinite(ownedUnits) || ownedUnits <= 0) throw new Error('此合夥人已無可提領的單位');
    const maximum = ownedUnits * unitPrice;
    // Preserve the existing whole-TWD payout convention, with less than $1
    // tolerance. Exactly $1 over the balance must not create negative units.
    const isFullWithdrawal = Math.abs(amount - maximum) < 1;
    if (amount > maximum && !isFullWithdrawal) throw new Error('提領金額不能大於該投資人的當前資產總值！');
    if (isFullWithdrawal) units = -ownedUnits;
  }
  return { amount: signedAmount, buyPrice: unitPrice, units };
}
