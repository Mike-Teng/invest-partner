import { summarizeCashFlows } from './accounting.js';
import { calculatePortfolio } from './portfolio.js';
import { taipeiDate } from './entryTime.js';
import { tradeCashTotals } from './reconciliation.js';

export function prepareReconciliation({ funds, trades, marketPrices, reconciliation,
  cashBalance, closedTickers = [], reason, now = Date.now() }) {
  if (reconciliation) throw new Error('已有對帳紀錄，不能重複套用');
  if (!Number.isFinite(cashBalance) || cashBalance < 0) throw new Error('請輸入有效的現金餘額');
  if (!reason?.trim()) throw new Error('請填寫對帳原因');
  const date = taipeiDate(now);
  if ([...funds, ...trades].some(entry => entry.date > date
    || (entry.date === date && Number(entry.effectiveAt || entry.createdAt || 0) > now))) {
    throw new Error('包含未來紀錄，請先核對日期');
  }
  const flows = summarizeCashFlows(funds);
  const portfolio = calculatePortfolio(trades, flows.netContributions, marketPrices);
  const tickers = [...new Set(closedTickers)];
  for (const ticker of tickers) {
    if (!portfolio.holdings[ticker] || portfolio.holdings[ticker].qty >= 0) {
      throw new Error('只能結清已確認沒有持倉的舊負股數差額');
    }
  }
  const totals = tradeCashTotals(trades);
  return { collection: 'settings', id: 'ledger_reconciliation', before: null,
    after: { id: 'ledger_reconciliation', version: 1, date, effectiveAt: now,
      cashBalance, netContributions: flows.netContributions,
      tradeCashTWD: totals.TWD, tradeCashUSD: totals.USD, closedTickers: tickers,
      previousCashBalance: portfolio.cashBalance,
      previousHoldings: Object.fromEntries(tickers.map(ticker => [ticker, portfolio.holdings[ticker]])),
      referenceExchangeRate: portfolio.exchangeRate, reason: reason.trim() } };
}
