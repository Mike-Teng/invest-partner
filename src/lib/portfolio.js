import { activeReconciliation, tradeCashTotals } from './reconciliation.js';

// Shared by the website and the daily writer.
export function calculatePortfolio(trades, totalCapital, marketPrices, reconciliation = null) {
  reconciliation = activeReconciliation(reconciliation);
  const exchangeRate = Number(marketPrices.USDTWD) || 32.5;
  if (!(exchangeRate > 0)) throw new Error('Invalid exchange rate');
  let cashBalance = totalCapital;
  const holdings = {};
  // Firestore document order is unrelated to trade order. Never replay it directly.
  const sorted = [...trades, ...(reconciliation ? [{ ...reconciliation, checkpoint: true }] : [])].sort((a, b) =>
    a.date.localeCompare(b.date) || Number(a.effectiveAt || a.createdAt || 0) - Number(b.effectiveAt || b.createdAt || 0)
    || String(a.id || '').localeCompare(String(b.id || '')));
  sorted.forEach(trade => {
    if (trade.checkpoint) {
      for (const ticker of trade.closedTickers) holdings[ticker] = { qty: 0, totalCostOriginal: 0 };
      return;
    }
    const { ticker, type } = trade;
    const price = Number(trade.price);
    const qty = Number(trade.qty);
    if (!ticker || !['BUY', 'SELL'].includes(type) || !Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty <= 0) {
      throw new Error('Invalid trade; snapshot was not written');
    }
    const rate = /^[A-Z]+$/.test(ticker) ? exchangeRate : 1;
    const amount = price * qty;
    if (!holdings[ticker]) holdings[ticker] = { qty: 0, totalCostOriginal: 0 };
    const holding = holdings[ticker];
    if (type === 'BUY') {
      cashBalance -= amount * rate;
      holding.qty += qty;
      holding.totalCostOriginal += amount;
    } else {
      cashBalance += amount * rate;
      const averageCost = holding.totalCostOriginal / (holding.qty || 1);
      holding.qty -= qty;
      holding.totalCostOriginal -= averageCost * qty;
    }
  });
  if (reconciliation) {
    const totals = tradeCashTotals(trades);
    // The supplied balance includes USD already converted to TWD. Only movements
    // after this checkpoint use the current FX rate; old purchases are not repriced.
    cashBalance = reconciliation.cashBalance + totalCapital - reconciliation.netContributions
      + totals.TWD - reconciliation.tradeCashTWD
      + (totals.USD - reconciliation.tradeCashUSD) * exchangeRate;
  }
  let marketValue = 0;
  const holdingsList = [];
  const warnings = [];
  Object.keys(holdings).forEach(ticker => {
    const holding = holdings[ticker];
    if (holding.qty < 0) warnings.push(`${ticker}：賣出比買入多 ${-holding.qty} 股，請核對缺漏的買入紀錄`);
    // Match the website's existing treatment; missing purchases require reconciliation.
    if (holding.qty <= 0) return;
    const price = Number(marketPrices[ticker]) || holding.totalCostOriginal / holding.qty;
    if (!Number.isFinite(price) || price < 0) throw new Error(`Invalid price for ${ticker}`);
    if (!Number(marketPrices[ticker])) warnings.push(`${ticker}：缺少市價，目前以平均成本估算`);
    const isUS = /^[A-Z]+$/.test(ticker);
    const rate = isUS ? exchangeRate : 1;
    const marketValueOriginal = holding.qty * price;
    const currentValue = marketValueOriginal * rate;
    const totalCost = holding.totalCostOriginal * rate;
    marketValue += currentValue;
    holdingsList.push({ ticker, isUS, qty: holding.qty,
      avgCostOriginal: holding.totalCostOriginal / holding.qty, currentPriceOriginal: price,
      marketValueOriginal, currentValue, unrealizedPL: currentValue - totalCost,
      returnRate: totalCost > 0 ? (currentValue - totalCost) / totalCost : 0 });
  });
  return { cashBalance, marketValue, totalAssets: cashBalance + marketValue, exchangeRate, holdings, holdingsList, warnings };
}
