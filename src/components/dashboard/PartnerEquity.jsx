import { ChevronDown } from 'lucide-react';
import Card from '../Card.jsx';
import { calculatePerformance } from '../../lib/accounting.js';
import { formatMoney, formatPercent, formatUnit } from '../../lib/formatters.js';

export default function PartnerEquity({ investors, unitStats, currentInvestorName, isSpecificInvestor, isAllowed, secureMoney }) {
  const visibleInvestors = isSpecificInvestor ? investors.filter(name => name === currentInvestorName) : investors;
  return <section className="partner-section" aria-labelledby="partner-heading">
    <div className="section-heading"><h2 id="partner-heading" className="section-title">合夥人權益</h2><span className="text-xs text-slate-400">依持有單位分配</span></div>
    <div className="partner-grid">{visibleInvestors.map((name, index) => {
      const data = unitStats.investorData[name];
      const value = data.units * unitStats.currentUnitPrice;
      const performance = calculatePerformance({ assets: value, ...data });
      const share = unitStats.totalUnitsIssued > 0 ? data.units / unitStats.totalUnitsIssued : 0;
      return <Card key={name} className="partner-card">
        <div className="flex justify-between items-center mb-6"><div className="flex items-center gap-3"><span className={`partner-avatar ${index % 2 ? 'partner-avatar-teal' : ''}`}>{name[0]}</span><div><h3 className="font-semibold">{name}{name === currentInvestorName && <span className="ml-2 text-xs text-slate-400">我</span>}</h3><span className="text-xs text-slate-400">持有份額 {isAllowed ? formatPercent(share) : '****'}</span></div></div><span className="text-xs text-slate-400">TWD</span></div>
        <div className="flex flex-wrap justify-between gap-4"><div><span className="text-xs text-slate-500">目前資產</span><p className="text-2xl font-semibold mt-1.5 tabular-nums">{secureMoney(value)}</p></div><div className="text-right"><span className="text-xs text-slate-500">累計收益</span><p className={`text-lg font-semibold mt-2 tabular-nums ${isAllowed && performance.profit >= 0 ? 'text-emerald-700' : isAllowed ? 'text-red-600' : ''}`}>{isAllowed && performance.profit >= 0 ? '+' : ''}{secureMoney(performance.profit)}</p></div></div>
        <details className="partner-details"><summary>資金與單位明細 <ChevronDown size={15} /></summary><dl className="grid grid-cols-2 gap-4 pb-2 pt-4 text-sm">{[
          ['累計入金', formatMoney(data.deposits)], ['累計提領', formatMoney(data.withdrawals)],
          ['淨投入', formatMoney(performance.netContributions)], ['持有單位', formatUnit(data.units)],
        ].map(([label, amount]) => <div key={label}><dt className="text-xs text-slate-400 mb-1">{label}</dt><dd className="tabular-nums font-medium">{isAllowed ? amount : '****'}</dd></div>)}</dl></details>
      </Card>;
    })}</div>
  </section>;
}
