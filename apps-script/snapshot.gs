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
  const entries = Array.isArray(raw) ? raw.map(item => [null, item]) : Object.entries(raw || {});
  return entries.map(([key, item]) => {
    const data = item.fields ? parseFields(item.fields) : item;
    const path = item.name || item.path || key;
    return { ...data, ...(path ? { id: String(path).split('/').pop() } : {}) };
  });
}

function calculateSnapshotPortfolio(trades, totalCapital, marketPrices) {
  return SnapshotPortfolio.calculatePortfolio(trades, totalCapital, marketPrices);
}

function buildDailySnapshot(funds, trades, marketPrices, historyData, date, timestamp) {
  return SnapshotBuilder.buildSnapshot(funds, trades, marketPrices, historyData, date, timestamp);
}

function readDailySnapshot_() {
  const firestore = FirestoreApp.getFirestore(
    FIREBASE_CONFIG.email, FIREBASE_CONFIG.key.replace(/\\n/g, '\n'), FIREBASE_CONFIG.projectId
  );
  const readRevision = () => {
    try {
      const value = firestore.getDocument('settings/ledger_control');
      return Number((value && value.fields ? parseFields(value.fields) : value || {}).revision || 0);
    } catch (error) {
      // The control document is created by the first website ledger mutation.
      if (/404|NOT_FOUND|not found/i.test(String(error))) return 0;
      throw error;
    }
  };
  let funds, trades, history, prices;
  let stable = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = readRevision();
    funds = normalizeSnapshotDocuments(firestore.getDocuments('funds'));
    trades = normalizeSnapshotDocuments(firestore.getDocuments('trades'));
    history = normalizeSnapshotDocuments(firestore.getDocuments('asset_history'));
    const pricesDocument = firestore.getDocument('settings/market_prices');
    prices = pricesDocument.fields ? parseFields(pricesDocument.fields) : pricesDocument;
    if (before === readRevision()) { stable = true; break; }
  }
  if (!stable) throw new Error('Ledger changed during snapshot reads; no snapshot was written');
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
