# UI preview

This branch refreshes the overview layout and extracts the overview, funds,
trades, and portfolio into stable React components. Calculations and transaction
validation still use the existing modules in `src/lib`.

The overview highlights assets and lifetime profit, followed by cash flows,
history, allocation, and partner equity. Partner details and administrator tools
can be expanded. Page, chart-switch, button, and dialog transitions respect
reduced-motion preferences. Live data updates do not replay the history animation.

The light frosted-glass theme uses a floating top navigation on desktop and a
bottom navigation on mobile. Open summary figures, neutral surfaces, fine
dividers, and muted chart colors keep the data readable. Glass effects are
limited to navigation, switches, dialogs, and notifications, with solid
backgrounds when transparency is reduced or backdrop blur is unsupported.
Financial calculations, record contents, and save handlers are unchanged.

## Demo data

Run `npm run dev:demo` to try the interface with fictional Alex/Sam records.
Changes stay in the current tab's memory. Reload or select **Reset** to restore
the sample. No login is needed, and the demo cannot read or write Firebase.

`npm run build:demo` and Vercel deployments with `VERCEL_ENV=preview` replace
the Firebase SDK at build time. A build check rejects any real Firebase SDK
module in a demo bundle. Ordinary production builds keep the existing Firebase
connection. Do not merge the preview branch until the interface is accepted.

## Validation

- Existing accounting, ledger, trade, and snapshot regression tests.
- Demo balance consistency, session isolation, rollback, and unsubscribe tests.
- Production and demo builds; ESLint.
- Browser checks: desktop/mobile navigation, chart selection surviving a parent
  update, form values surviving a confirmation dialog, demo fund/trade entries,
  oversell rejection, price updates, and reset.
- Frosted-glass checks: 320/390 px mobile and 1024 px tablet layouts, desktop
  navigation, chart metric/range selection, partner details, cancelling a dialog
  without losing input, and demo deposit/trade/price-update/reset flows.

The demo is for interface trials. It does not simulate Firebase authentication,
security rules, concurrent clients, or the daily Apps Script scheduler.
