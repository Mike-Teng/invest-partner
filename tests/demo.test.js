import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocuments } from '../src/demo/fixtures.js';
import { calculatePortfolio } from '../src/lib/portfolio.js';
import { calculateUnitAccounting } from '../src/lib/accounting.js';

const freshSdk = () => import(`../src/demo/firebase.js?instance=${crypto.randomUUID()}`);

test('fictional preview balances agree with the unchanged accounting functions', () => {
  const documents = createDemoDocuments();
  const rows = prefix => Object.entries(documents).filter(([path]) => path.startsWith(prefix)).map(([path, value]) => ({ id: path.split('/').at(-1), ...value }));
  const funds = rows('funds/');
  const portfolio = calculatePortfolio(rows('trades/'), 200000, documents['settings/market_prices']);
  const accounting = calculateUnitAccounting({ funds, investors: ['Alex', 'Sam'], historyData: rows('asset_history/'), totalAssets: portfolio.totalAssets });
  assert.equal(portfolio.cashBalance, 40000);
  assert.equal(portfolio.totalAssets, 216000);
  assert.equal(accounting.investorData.Alex.units * accounting.currentUnitPrice, 108000);
});

test('demo edits are isolated to one instance and a fresh session restores the fixture', async () => {
  const a = await freshSdk();
  const b = await freshSdk();
  await a.setDoc(a.doc({}, 'settings', 'market_prices'), { USDTWD: 35 });
  assert.equal((await a.getDocFromServer(a.doc({}, 'settings', 'market_prices'))).data().USDTWD, 35);
  assert.equal((await b.getDocFromServer(b.doc({}, 'settings', 'market_prices'))).data().USDTWD, 30);
  assert.equal(createDemoDocuments()['settings/market_prices'].USDTWD, 30);
});

test('demo transaction failures cannot partially change data', async () => {
  const sdk = await freshSdk();
  const ref = sdk.doc({}, 'funds', 'sample');
  await assert.rejects(sdk.runTransaction({}, async transaction => {
    transaction.set(ref, { amount: 100 });
    throw new Error('validation failed');
  }));
  assert.equal((await sdk.getDocFromServer(ref)).exists(), false);
});

test('demo listeners stop receiving changes after the page unsubscribes', async () => {
  const sdk = await freshSdk();
  let updates = 0;
  const ref = sdk.collection({}, 'funds');
  const unsubscribe = sdk.onSnapshot(ref, () => updates++);
  await Promise.resolve();
  assert.equal(updates, 1);
  unsubscribe();
  await sdk.setDoc(sdk.doc({}, 'funds', 'sample'), { amount: 100 });
  assert.equal(updates, 1);
});
