import { ArrowUpRight } from 'lucide-react';
import Card from '../Card.jsx';
import { formatMoney, formatPercent } from '../../lib/formatters.js';
const colors = ['#4a6d62', '#899c93', '#b5aaa0', '#777f8b'];

export default function AllocationSummary({ portfolioStats, totalAssets, onNavigate }) {
  const items = [
    ...portfolioStats.holdingsList.map(item => ({ name: item.ticker, value: item.currentValue })),
    { name: '現金', value: portfolioStats.cashBalance },
  ].sort((a, b) => b.value - a.value);
  return <Card className="allocation-panel flex flex-col min-w-0">
    <div className="flex items-center justify-between gap-2"><h2 className="section-title">資產配置</h2><span className="text-xs text-slate-400">TWD</span></div>
    <p className="text-xs text-slate-400 mt-1.5 mb-7">持倉與現金的分布</p>
    <div className="allocation-bar" aria-hidden="true">{items.filter(item => item.value > 0).map((item, i) => <span key={item.name} style={{ flex: item.value, background: colors[i % colors.length] }} />)}</div>
    <div className="space-y-5 mt-7 mb-6">{items.map((item, i) => <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2.5 min-w-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} /><span className="font-medium truncate">{item.name}</span></div>
      <div className="text-right"><div className="font-semibold tabular-nums">{formatMoney(item.value)}</div><div className="text-xs text-slate-400 mt-0.5">{totalAssets > 0 ? formatPercent(item.value / totalAssets) : '—'}</div></div>
    </div>)}</div>
    <button type="button" onClick={() => onNavigate('portfolio')} className="text-link mt-auto pt-4 border-t border-slate-100">查看持倉明細 <ArrowUpRight size={15} /></button>
  </Card>;
}
