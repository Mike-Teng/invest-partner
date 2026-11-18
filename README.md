<h1 align="center">
  <img src="public/icons/partner-glass-v1/icon-180.png" alt="" width="56" height="56" align="middle" />
  InvestPartner
</h1>

<p align="center"><strong>Invest together. Keep the numbers clear.</strong></p>

InvestPartner is a shared investment tracker for partners. Keep deposits, withdrawals, and stock trades in one place, so everyone can see the portfolio's value, cumulative profit, and their share of the investment.

![InvestPartner's frosted-glass dashboard with total assets, cumulative profit, portfolio growth, and partner equity](docs/images/dashboard.jpg)

*English preview with fictional names and sample data. The live app currently uses Traditional Chinese.*

## Your shared investments at a glance

- **The big picture:** See total assets and cumulative profit.
- **Each partner's share:** Track contributions, withdrawals, and current ownership.
- **The history:** Review portfolio growth, holdings, and past trades.

An administrator maintains the records. Authorized partners can sign in to view them.

For calculation details, tests, and daily snapshot setup, see the [maintenance guide](docs/maintenance.md).
For Vercel configuration and setup on another computer, see the [environment setup guide](docs/environment-setup.md).

## Run locally

Install Node.js 20.19+ or 22.12+, then run these commands in the project folder:

```bash
npm ci
npm run dev:demo
```

Open [http://localhost:5173](http://localhost:5173).

This starts an isolated demo with fictional data. To use the existing Firebase project, follow the [environment setup guide](docs/environment-setup.md) to download Vercel's Development settings into `.env.local`, then run `npm run dev`. Changes in that mode affect live data.

Website updates follow **GitHub → Vercel automatic deployment**. The Google Apps Script price updater and daily snapshot writer must be updated separately; see the maintenance guide.
