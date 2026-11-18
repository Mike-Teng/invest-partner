# Interface and preview workflow

The interface refresh updates the overview layout and extracts the overview, funds,
trades, and portfolio into stable React components. Calculations and transaction
validation still use the existing modules in `src/lib`.

The overview highlights assets and lifetime profit, followed by cash flows,
history, allocation, and partner equity. Partner details and administrator tools
can be expanded. Page, chart-switch, button, and dialog transitions respect
reduced-motion preferences. Live data updates do not replay the history animation.

The light frosted-glass theme uses a floating top navigation on desktop and a
bottom navigation on mobile. A lightly textured matte asset panel, a translucent
profit panel, and a solid light chart panel distinguish the key figures. Clear
glass navigation and switches reveal the background; a blurred header keeps
scrolling content from competing with account and navigation text. Solid
backgrounds are used when transparency is reduced or backdrop blur is unsupported.
Funds and trades use glass entry panels, matte NAV/cash summaries, and light
record surfaces. The portfolio uses the same materials for allocation, holdings,
and price inputs, including mobile record cards. Financial calculations, record
contents, and save handlers are unchanged.

Material refinement uses a local, static monochrome grain texture in place of
repeating stripes. Subtle edge highlights replace diagonal glare; glass controls
float over a softly tinted background. Matte summaries, translucent entry panels,
and quiet near-white records have distinct depth, with fewer nested borders.
The card grain is a local SVG texture.

The page background uses the official [Paper Texture](https://shaders.paper.design/paper-texture)
shader, with fine, low-contrast grain and fibers on off-white paper. Grain and
fiber strength are reduced a further 20%, including the fallback texture. Dark
speckles are disabled. Navigation and switches use clearer surfaces with bright
edges and a translucent selected state to preserve their glass depth. The isolated
paper component loads separately, uses no remote images, and runs at speed
zero with a maximum of about 2 million pixels. A local CSS texture remains if the
shader cannot load or WebGL is unavailable. Cards, charts, and inputs retain their
existing surfaces. The dependency is pinned to avoid unreviewed visual changes.
Its license and notice are included in `public/licenses/paper-shaders/`.

## Demo data

Run `npm run dev:demo` to try the interface with fictional Alex/Sam records.
Changes stay in the current tab's memory. Reload or select **Reset** to restore
the sample. No login is needed, and the demo cannot read or write Firebase.

`npm run build:demo` and Vercel deployments with `VERCEL_ENV=preview` replace
the Firebase SDK at build time. A build check rejects any real Firebase SDK
module in a demo bundle. Production deployments from `main` keep the existing
Firebase connection, Google sign-in, access rules, and Yi/Ma partner mapping.
The approved interface is shared by production and preview; only previews use
fictional data. Future UI trials should stay on a preview branch until accepted.
Promoting this interface does not migrate, seed, or rewrite Firestore records,
and does not deploy the separate Apps Script price/snapshot jobs.

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
- Entry-page materials: matching desktop form/history alignment, narrow-screen
  record cards and price inputs, full-withdrawal amount filling, partial
  withdrawal, and unchanged page behavior after ignoring style attributes.
- Material refinement: 1280 px desktop and 320/390 px mobile layouts, chart
  metric/range controls, cancellation preserving input, demo deposit/trade/price
  saves and reset.
- Paper background: desktop and 320/390 px mobile layouts across all four pages,
  chart controls, a demo deposit, one canvas retained across page switches, and
  simulated initialization failure leaving navigation and inputs usable.
- Clear glass controls: chart metric/range selection, deposit/withdrawal and
  buy/sell switches, keyboard activation, and mobile navigation selection.
- Production release: confirm real Firebase Auth/Firestore modules and the
  existing project are present, with no demo SDK, fixtures, account, or banner;
  preview builds retain their isolation. Accounting modules, ledger access, and
  snapshot jobs match the previous production revision.

The demo is for interface trials. It does not simulate Firebase authentication,
security rules, concurrent clients, or the daily Apps Script scheduler.
