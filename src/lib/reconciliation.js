// A confirmed balance is a new starting point, not a deposit or a stock purchase.
export function activeReconciliation(value, timestamp = Date.now()) {
  if (!value || Number(value.effectiveAt) > timestamp) return null;
  if (value.version !== 1 || !Number.isFinite(value.effectiveAt)
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.date || '')
    || !['cashBalance', 'netContributions', 'tradeCashTWD', 'tradeCashUSD'].every(key => Number.isFinite(value[key]))
    || value.cashBalance < 0 || !Array.isArray(value.closedTickers)
    || !value.closedTickers.every(ticker => /^([A-Z]+|\d+[A-Z]?)$/.test(ticker))) {
    throw new Error('對帳資料格式無效，請先核對');
  }
  return value;
}

export function tradeCashTotals(trades) {
  return trades.reduce((totals, trade) => {
    const currency = /^[A-Z]+$/.test(trade.ticker) ? 'USD' : 'TWD';
    totals[currency] += (trade.type === 'BUY' ? -1 : 1) * Number(trade.price) * Number(trade.qty);
    return totals;
  }, { TWD: 0, USD: 0 });
}

export function assertAfterReconciliation(change, reconciliation) {
  if (!reconciliation || !['funds', 'trades'].includes(change.collection)) return;
  for (const entry of [change.before, change.after].filter(Boolean)) {
    if (entry.date < reconciliation.date || (entry.date === reconciliation.date
      && Number(entry.effectiveAt || entry.createdAt || 0) <= reconciliation.effectiveAt)) {
      throw new Error('這筆紀錄早於已確認的對帳餘額，請先重新核對帳務；對帳後的新交易仍可正常新增');
    }
  }
}
