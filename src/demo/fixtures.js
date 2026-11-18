// Entirely fictional records. Nothing here is copied from a Firebase account.
export const demoEmail = 'demo@example.com';
export function createDemoDocuments() {
  const people = ['Alex', 'Sam'];
  const documents = {};
  for (const [index, investor] of people.entries()) {
    documents[`funds/demo-fund-${index}`] = { investor, date: '2026-04-01', amount: 100000,
      units: 10000, buyPrice: 10, effectiveAt: Date.parse('2026-04-01T09:00:00+08:00'), createdAt: Date.parse('2026-04-01T09:00:00+08:00') };
  }
  documents['trades/demo-buy-1'] = { date: '2026-04-02', ticker: '0050', type: 'BUY', price: 100, qty: 1000, createdAt: Date.parse('2026-04-02T10:00:00+08:00') };
  documents['trades/demo-buy-2'] = { date: '2026-04-02', ticker: 'QQQM', type: 'BUY', price: 200, qty: 10, createdAt: Date.parse('2026-04-02T23:00:00+08:00') };
  documents['settings/market_prices'] = { USDTWD: 30, '0050': 110, QQQM: 220 };
  documents['settings/access'] = { emails: ['alex@example.com', 'sam@example.com'] };
  const totalFlows = { deposits: 200000, withdrawals: 0, netContributions: 200000 };
  const investorFlows = Object.fromEntries(people.map(name => [name, { deposits: 100000, withdrawals: 0, netContributions: 100000 }]));
  const values = [200000, 201400, 198000, 199600, 203000, 202200, 201000, 205000, 209000, 208300, 213500, 212000, 211000, 214800, 216000];
  values.forEach((total, index) => {
    const timestamp = Date.parse('2026-04-18T16:00:00+08:00') + index * 15 * 86400000;
    const date = new Date(timestamp).toISOString().slice(0, 10);
    documents[`asset_history/demo-history-${index}`] = { date, timestamp, total, Alex: total / 2, Sam: total / 2,
      cashFlowDetails: JSON.stringify({ version: 1, cutoff: timestamp, total: totalFlows, investors: investorFlows }) };
  });
  return documents;
}
