// Keep the existing FIREBASE_CONFIG and updateStockPrices in the Apps Script project.
// Build with npm run build:snapshot; the generated file includes shared unit accounting.

function parseFields(fields) {
  const result = {};
  Object.keys(fields).forEach(key => {
    const value = fields[key];
    if ('stringValue' in value) result[key] = value.stringValue;
    else if ('integerValue' in value) result[key] = Number(value.integerValue);
    else if ('doubleValue' in value) result[key] = Number(value.doubleValue);
    else if ('booleanValue' in value) result[key] = value.booleanValue;
    else if ('nullValue' in value) result[key] = null;
    else result[key] = value;
  });
  return result;
}

function normalizeSnapshotDocuments(raw) {
  return (Array.isArray(raw) ? raw : Object.values(raw || {}))
    .map(item => item.fields ? parseFields(item.fields) : item);
}

function calculateSnapshotPortfolio(trades, totalCapital, marketPrices) {
  const exchangeRate = Number(marketPrices.USDTWD) || 32.5;
  if (!(exchangeRate > 0)) throw new Error('Invalid exchange rate');
  let cashBalance = totalCapital;
  const holdings = {};
  // Firestore document order is unrelated to trade order. Never replay it directly.
  const sorted = [...trades].sort((a, b) =>
    a.date.localeCompare(b.date) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
  sorted.forEach(trade => {
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
  let marketValue = 0;
  const warnings = [];
  Object.keys(holdings).forEach(ticker => {
    const holding = holdings[ticker];
    if (holding.qty < 0) warnings.push(`${ticker}: recorded sales exceed purchases by ${-holding.qty} shares`);
    // Match the website's existing treatment; missing purchases require reconciliation.
    if (holding.qty <= 0) return;
    const price = Number(marketPrices[ticker]) || holding.totalCostOriginal / holding.qty;
    if (!Number.isFinite(price) || price < 0) throw new Error(`Invalid price for ${ticker}`);
    if (!Number(marketPrices[ticker])) warnings.push(`${ticker}: using average cost because market price is missing`);
    marketValue += holding.qty * price * (/^[A-Z]+$/.test(ticker) ? exchangeRate : 1);
  });
  return { cashBalance, marketValue, totalAssets: cashBalance + marketValue, exchangeRate, holdings, warnings };
}

function buildDailySnapshot(funds, trades, marketPrices, historyData, date, timestamp) {
  const investors = [...new Set(funds.map(fund => fund.investor))];
  const cashFlows = SnapshotAccounting.summarizeCashFlows(funds);
  const portfolio = calculateSnapshotPortfolio(trades, cashFlows.netContributions, marketPrices);
  const accounting = SnapshotAccounting.calculateUnitAccounting({
    funds, investors, historyData, totalAssets: portfolio.totalAssets,
  });
  const ownership = {};
  investors.forEach(investor => {
    ownership[investor] = accounting.investorData[investor].units * accounting.currentUnitPrice;
  });
  return {
    date, timestamp, total: portfolio.totalAssets, ...ownership,
    calculationVersion: 2,
    // Preserve the inputs needed to reconcile a saved valuation without guessing prices.
    valuationDetails: JSON.stringify({
      marketPrices, exchangeRate: portfolio.exchangeRate, cashBalance: portfolio.cashBalance,
      holdings: portfolio.holdings, cashFlows, investorData: accounting.investorData,
      warnings: portfolio.warnings,
    }),
  };
}

function readDailySnapshot_() {
  const firestore = FirestoreApp.getFirestore(
    FIREBASE_CONFIG.email, FIREBASE_CONFIG.key.replace(/\\n/g, '\n'), FIREBASE_CONFIG.projectId
  );
  const funds = normalizeSnapshotDocuments(firestore.getDocuments('funds'));
  const trades = normalizeSnapshotDocuments(firestore.getDocuments('trades'));
  const history = normalizeSnapshotDocuments(firestore.getDocuments('asset_history'));
  const pricesDocument = firestore.getDocument('settings/market_prices');
  const prices = pricesDocument.fields ? parseFields(pricesDocument.fields) : pricesDocument;
  const now = new Date();
  const snapshot = buildDailySnapshot(funds, trades, prices, history,
    Utilities.formatDate(now, 'GMT+8', 'yyyy-MM-dd'), now.getTime());
  Logger.log(JSON.stringify({ funds: funds.length, trades: trades.length, snapshot }));
  return { firestore, snapshot };
}

// Read-only check: does not create, update, or delete any Firestore document.
function previewDailySnapshot() {
  return readDailySnapshot_().snapshot;
}

// Existing time-driven trigger continues to call this function.
function recordDailySnapshot() {
  const { firestore, snapshot } = readDailySnapshot_();
  firestore.createDocument('asset_history', snapshot);
  Logger.log('Snapshot saved with chronological trades and unit-based ownership.');
}
