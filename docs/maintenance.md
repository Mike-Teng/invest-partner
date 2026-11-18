# Development and maintenance

[← Back to the project overview](../README.md)

This guide covers accounting rules, verification, deployment, and daily snapshots.

## Contributions and returns

- **Total deposits:** All positive cash contributions, including reinvestments.
- **Total withdrawals:** The absolute sum of negative cash flows, including both returned capital and profit.
- **Net contributions:** Deposits minus withdrawals. This can be negative and does not represent remaining cost basis.
- **Current assets:** A partner's units multiplied by the current unit price. Total portfolio assets equal cash plus the market value of holdings.
- **Cumulative profit:** Current assets plus withdrawals minus deposits. This includes gains already withdrawn.
- **Return on deposits:** Cumulative profit divided by total deposits. This is neither annualized nor time-weighted, and is not the change in unit NAV. If there are no deposits, the return is unavailable.

For example, if a TWD 1,000 deposit grows to TWD 1,200, cumulative profit remains TWD 200 and return on deposits remains 20%, whether the investor withdraws nothing, TWD 600, or the entire TWD 1,200.

Stored negative units are valid withdrawal records and must be preserved. Full redemption removes all of the owner's units, allowing a difference of less than TWD 1 for whole-dollar payout rounding. Only floating-point cancellation is normalized to zero; genuine small balances are retained.

For legacy records without units, units are derived from the saved transaction NAV. If both are missing, the previous snapshot or initial NAV supplies an estimate. If all units are closed but at least TWD 0.005 of unallocated assets remains, new current-date fund entries are blocked until reconciliation. This prevents the balance from being assigned to the next investor. Existing Firebase records and snapshots are not automatically rewritten.

## Verification and deployment

```bash
npm test
npm run lint
npm run build
```

Tests use offline fixtures and do not create, modify, or delete production Firebase records. `tests/accounting.test.js` covers partial and full withdrawals, rounding, reinvestment, legacy records, ownership totals, and consistent profit calculations before and after withdrawals.

After review and verification, commit and push to GitHub for Vercel to deploy. Include `src/lib/` and the test files. Existing data does not require migration or rewriting.

Website Firebase settings are managed in Vercel. See the [environment setup
guide](environment-setup.md) to configure a computer or refresh `.env.local`.
Production builds stop when required settings are missing; `npm run dev:demo`
and `npm run build:demo` work without Firebase settings.

### Accounting safeguards

| Area | Behavior | Focused tests |
| --- | --- | --- |
| NAV edits | Preserve exact full redemption. Reject changes that conflict with settlement amounts or invalidate later withdrawals. | `node tests/fundChanges.test.js` |
| Holdings | The website and Apps Script share `portfolio.js`. Replay records by date, effective or creation time, and document ID. | `node tests/portfolio.test.js`, `node tests/snapshot.test.js` |
| Backdated funds | Require the actual time and historical NAV. Validate against the units held then and protect later settlements. | `node tests/fundEntry.test.js` |
| Trades | Reject invalid prices or quantities, overselling, and insufficient book cash. Deletions also check later trades. | `node tests/tradeChanges.test.js` |
| Historical profit | Freeze cash-flow totals in new snapshots. For older snapshots, use saved valuation evidence or reconstruct the cash flows from fund records and later audit entries. | `node tests/history.test.js` |

A submission lock, stable operation IDs, and Firestore transaction revision checks protect against duplicate submissions and concurrent overselling. Trade tests include offline simulations of concurrency and retries after lost acknowledgements. Refresh older browser tabs after deployment; this protection applies to writes through the updated app.

Historical calculations include only cash flows before the snapshot when a same-day timestamp is available. When timing information is missing, the calculation retains a date-based estimate.

### Audit records and existing data

The first ledger mutation creates `settings/ledger_control`. Each mutation and its audit entry are written atomically.

Audit entries live at `funds/_ledger/operations/{operationId}`. No `_ledger` fund document is created, so existing `funds` queries are unaffected. This path inherits the existing `/funds/{document=**}` rules: authorized members can read, and the administrator can write. No broader permissions are required. Preserve this audit subcollection; older charts depend on it to reconstruct their cash-flow basis.

Direct edits through the Firebase console or external tools do not automatically produce audit entries. Historical USD trade cash still uses the existing exchange-rate calculation. Missing purchase records are not filled in by assumption; reconcile discrepancies before relying on the book cash balance.

## Daily snapshots

The Google Apps Script project `updateStockPrices` runs `recordDailySnapshot` on a time-based trigger. The website also has a separate manual snapshot action. `updateStockPrices` reads the `Stocks` sheet to update market prices in Firebase.

The snapshot writer replays transactions chronologically and uses the same holdings and unit accounting as the website. New snapshots save `calculationVersion: 3`, `cashFlowDetails`, and `valuationDetails`. The latter two are JSON strings containing the cash-flow basis and valuation inputs, including prices, exchange rates, cash, holdings, and ownership.

```bash
npm run build:snapshot
```

This combines the shared `accounting.js`, `portfolio.js`, and `snapshot.js` modules with `apps-script/snapshot.gs` into `dist/apps-script/snapshot.gs`.

To update the Apps Script project:

1. Keep the existing `FIREBASE_CONFIG` and `updateStockPrices` function.
2. Replace the old snapshot functions and `parseFields` with the generated file. Remove duplicate definitions.
3. Run `previewDailySnapshot` to read live data and inspect the calculation without writing a snapshot.
4. After verification, the existing trigger can continue calling `recordDailySnapshot`.

The generated file contains no credentials. Never commit service-account private keys to GitHub.

The website deploys through GitHub → Vercel. Apps Script requires a separate update; pushing to GitHub does not update it.

Historical corrections must use each snapshot's original prices and exchange rates. Back up the records and verify the proposed values before writing. Do not apply one day's discrepancy as a fixed adjustment to every historical date.

Local `*.local` audit files and tools are excluded from Git and website deployments.
