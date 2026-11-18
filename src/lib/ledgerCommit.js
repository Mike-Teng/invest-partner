// Read and validate a fresh ledger, then atomically commit only that version.
// An operation ID survives a failed acknowledgement, so retries cannot duplicate it.
export async function commitLedgerChange(store, operationId, prepare) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await store.receipt(operationId);
    if (existing) return existing;
    const revision = await store.revision();
    const ledger = await store.load();
    let change;
    try { change = prepare(ledger); }
    catch (error) {
      // Another request with this ID may have committed while load() was running.
      const completed = await store.receipt(operationId);
      if (completed) return completed;
      throw error;
    }
    if (!change) return null;
    const result = await store.commit(operationId, revision, ledger, change);
    if (result) return result;
  }
  throw new Error('資料正在被其他視窗更新，請稍後重試');
}

export function stableValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(item => JSON.parse(stableValue(item))));
  if (value && typeof value === 'object') return JSON.stringify(Object.fromEntries(
    Object.keys(value).sort().map(key => [key, JSON.parse(stableValue(value[key]))])));
  return JSON.stringify(value ?? null);
}
