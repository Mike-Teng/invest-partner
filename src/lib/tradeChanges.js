import { compareEntries, entryTime } from './entryTime.js';
import { activeReconciliation, assertAfterReconciliation } from './reconciliation.js';

const epsilon = 1e-8;

function balances(trades, funds, exchangeRate, reconciliation) {
  const entries = [...trades.map(trade => ({ ...trade, kind: 'trade' })),
    ...funds.map(fund => ({ ...fund, kind: 'fund' })),
    ...(reconciliation ? [{ ...reconciliation, kind: 'checkpoint' }] : [])].sort(compareEntries);
  let cash = 0;
  const holdings = {};
  const result = new Map();
  for (const entry of entries) {
    if (entry.kind === 'checkpoint') {
      cash = entry.cashBalance;
      for (const ticker of entry.closedTickers) holdings[ticker] = 0;
      continue;
    }
    if (entry.kind === 'fund') { cash += Number(entry.amount); continue; }
    const sign = entry.type === 'BUY' ? 1 : -1;
    const qty = (holdings[entry.ticker] || 0) + sign * Number(entry.qty);
    holdings[entry.ticker] = Math.abs(qty) < epsilon ? 0 : qty;
    cash -= sign * Number(entry.qty) * Number(entry.price) * (/^[A-Z]+$/.test(entry.ticker) ? exchangeRate : 1);
    result.set(entry.id, { qty: holdings[entry.ticker], cash });
  }
  return result;
}

export function assertSafeTradeChange({ beforeTrades, afterTrades, funds, exchangeRate, reconciliation = null }) {
  reconciliation = activeReconciliation(reconciliation);
  const before = balances(beforeTrades, funds, exchangeRate, reconciliation);
  const after = balances(afterTrades, funds, exchangeRate, reconciliation);
  for (const [id, balance] of after) {
    const previous = before.get(id);
    if (balance.qty < -epsilon && (!previous || balance.qty < previous.qty - epsilon)) {
      throw new Error('賣出股數超過當時持倉，或這項修改會造成後續交易超賣，請先核對買入紀錄');
    }
    if (balance.cash < -0.005 && (!previous || balance.cash < previous.cash - 0.005)) {
      throw new Error('當時帳面現金不足，或這項修改會讓後續交易現金不足，請先核對資金與交易紀錄');
    }
  }
}

export function prepareTradeEntry({ trades, funds, marketPrices, reconciliation, id, date, time, ticker, type, price, qty, now = Date.now() }) {
  ticker = String(ticker).trim().toUpperCase();
  // The existing pricing source recognizes alphabetic US tickers and numeric TW tickers.
  if (!/^([A-Z]+|\d+[A-Z]?)$/.test(ticker)) throw new Error('請填寫支援的股票代號，例如 QQQM、0050 或 00679B');
  if (!['BUY', 'SELL'].includes(type)) throw new Error('交易類別無效');
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty <= 0) {
    throw new Error('成交價與股數必須是有效正數');
  }
  if (!/^[A-Z]+$/.test(ticker) && !Number.isInteger(qty)) throw new Error('台股股數必須為整數');
  const effectiveAt = entryTime({ date, time, now });
  const exchangeRate = Number(marketPrices.USDTWD) || 32.5;
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error('匯率無效，請先核對');
  const trade = { id, date, ticker, type, price, qty, effectiveAt, createdAt: now };
  assertAfterReconciliation({ collection: 'trades', after: trade }, reconciliation);
  assertSafeTradeChange({ beforeTrades: trades, afterTrades: [...trades, trade], funds, exchangeRate, reconciliation });
  return trade;
}
