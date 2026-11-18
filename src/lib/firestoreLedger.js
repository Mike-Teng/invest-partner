import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { commitLedgerChange, stableValue } from './ledgerCommit.js';

const dataOf = snapshot => snapshot.exists() ? snapshot.data() : null;
const documents = snapshot => snapshot.docs.map(item => ({ ...item.data(), id: item.id }));

// The existing /funds/{document=**} rules already restrict this audit trail to
// the same authorized readers/admin writer. No parent fund document is created.
export const ledgerOperationsCollection = db => collection(db, 'funds', '_ledger', 'operations');

export async function readHistoryBasis(db) {
  const control = doc(db, 'settings', 'ledger_control');
  for (let attempt = 0; attempt < 5; attempt++) {
    const revision = dataOf(await getDocFromServer(control))?.revision || 0;
    const [funds, operations] = await Promise.all([
      getDocsFromServer(collection(db, 'funds')), getDocsFromServer(ledgerOperationsCollection(db)),
    ]);
    if ((dataOf(await getDocFromServer(control))?.revision || 0) === revision) {
      return { funds: documents(funds), operations: documents(operations) };
    }
  }
  throw new Error('讀取歷史依據時資料持續變動，請稍後重新整理');
}

export function saveLedgerChange(db, operationId, actor, prepare) {
  const control = doc(db, 'settings', 'ledger_control');
  const receiptRef = doc(ledgerOperationsCollection(db), operationId);
  return commitLedgerChange({
    receipt: async () => dataOf(await getDocFromServer(receiptRef)),
    revision: async () => (dataOf(await getDocFromServer(control))?.revision || 0),
    load: async () => {
      const [funds, trades, historyData, prices] = await Promise.all([
        getDocsFromServer(collection(db, 'funds')), getDocsFromServer(collection(db, 'trades')),
        getDocsFromServer(collection(db, 'asset_history')), getDocFromServer(doc(db, 'settings', 'market_prices')),
      ]);
      return { funds: documents(funds), trades: documents(trades), historyData: documents(historyData), marketPrices: dataOf(prices) || {} };
    },
    commit: async (id, revision, ledger, change) => runTransaction(db, async transaction => {
      const receipt = await transaction.get(receiptRef);
      if (receipt.exists()) return receipt.data();
      const latest = await transaction.get(control);
      if ((dataOf(latest)?.revision || 0) !== revision) return null;
      const prices = await transaction.get(doc(db, 'settings', 'market_prices'));
      if (stableValue(dataOf(prices) || {}) !== stableValue(ledger.marketPrices)) return null;
      const target = doc(db, change.collection, change.id);
      const current = await transaction.get(target);
      const currentData = current.exists() ? { ...current.data(), id: current.id } : null;
      if (stableValue(currentData) !== stableValue(change.before)) {
        throw new Error('這筆資料已被其他視窗修改，請重新整理後再操作');
      }
      const record = { collection: change.collection, targetId: change.id, before: change.before,
        after: change.after, actor, revision: revision + 1, recordedAt: serverTimestamp() };
      if (change.after) {
        const data = { ...change.after };
        delete data.id;
        transaction.set(target, data);
      } else transaction.delete(target);
      transaction.set(receiptRef, record);
      transaction.set(control, { revision: revision + 1 });
      return record;
    }),
  }, operationId, prepare);
}
