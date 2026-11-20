import { summarizeCashFlows, calculateUnitAccounting } from './accounting.js';
import { calculatePortfolio } from './portfolio.js';
import { activeReconciliation } from './reconciliation.js';

// Both manual and scheduled snapshots save the valuation and its cash-flow basis.
export function buildSnapshot(funds, trades, marketPrices, historyData, date, timestamp, reconciliation = null) {
  reconciliation = activeReconciliation(reconciliation, timestamp);
  const eligible = entries => entries.filter(entry => entry.date < date || (entry.date === date
    && Number(entry.effectiveAt || entry.createdAt || 0) <= timestamp));
  funds = eligible(funds);
  trades = eligible(trades);
  const investors = [...new Set(funds.map(fund => fund.investor))];
  const cashFlows = summarizeCashFlows(funds);
  const portfolio = calculatePortfolio(trades, cashFlows.netContributions, marketPrices, reconciliation);
  const accounting = calculateUnitAccounting({ funds, investors, historyData, totalAssets: portfolio.totalAssets });
  const ownership = {};
  const investorFlows = {};
  investors.forEach(investor => {
    ownership[investor] = accounting.investorData[investor].units * accounting.currentUnitPrice;
    investorFlows[investor] = summarizeCashFlows(funds.filter(fund => fund.investor === investor));
  });
  return {
    date, timestamp, total: portfolio.totalAssets, ...ownership, calculationVersion: reconciliation ? 4 : 3,
    cashFlowDetails: JSON.stringify({ version: 1, cutoff: timestamp, total: cashFlows, investors: investorFlows }),
    valuationDetails: JSON.stringify({ marketPrices, exchangeRate: portfolio.exchangeRate,
      cashBalance: portfolio.cashBalance, holdings: portfolio.holdings, cashFlows,
      investorData: accounting.investorData, warnings: portfolio.warnings, ...(reconciliation ? { reconciliation } : {}) }),
  };
}
