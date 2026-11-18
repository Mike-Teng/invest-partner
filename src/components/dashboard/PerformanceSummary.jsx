import { ArrowUpRight, ArrowDownRight, Wallet, Coins } from 'lucide-react';
import Card from '../Card.jsx';
import { formatPercent, formatPrice } from '../../lib/formatters.js';

export default function PerformanceSummary({ display, unitStats, isSpecificInvestor, isAllowed, secureMoney }) {
  const positive = display.profit >= 0;
  const Direction = positive ? ArrowUpRight : ArrowDownRight;
  return <>
    <div className="summary-grid">
      <section className="asset-hero">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-300">{isSpecificInvestor ? '我的資產' : '總資產'}</span>
          <span className="currency-badge">TWD</span>
        </div>
        <div className="asset-value tabular-nums">{secureMoney(display.assets)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <span className="flex items-center gap-2"><Wallet size={14} />{isSpecificInvestor ? '依持有份額計算' : '現金與持倉市值合計'}</span>
          {isAllowed && <span>當前淨值 <strong className="text-white ml-1">{formatPrice(unitStats.currentUnitPrice)}</strong></span>}
        </div>
      </section>
      <Card className="profit-summary">
        <div className="flex justify-between items-center"><span className="text-sm text-slate-500">{isSpecificInvestor ? '我的' : ''}累計收益</span><Coins size={19} className="text-slate-400" /></div>
        <div className={`profit-value tabular-nums ${isAllowed ? positive ? 'text-emerald-700' : 'text-red-600' : 'text-slate-800'}`}>
          {isAllowed && positive ? '+' : ''}{secureMoney(display.profit)}
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className={`return-badge ${positive ? 'return-positive' : 'return-negative'}`}><Direction size={14} />{isAllowed ? display.returnOnDeposits === null ? '不適用' : formatPercent(display.returnOnDeposits) : '****'}</span>
          <span className="text-slate-500">累計投入收益率 · 非年化</span>
        </div>
      </Card>
    </div>
    <Card className="cash-flow-strip">
      {[
        { label: '累計入金', value: display.deposits, description: '歷次投入金額合計' },
        { label: '累計提領', value: display.withdrawals, description: '包含領回的本金與收益' },
        { label: '淨投入', value: display.netContributions, description: '累計入金 − 累計提領' },
      ].map(item => <div className="cash-flow-item" key={item.label}>
        <span className="text-xs text-slate-500">{item.label}</span>
        <strong className="block text-xl sm:text-2xl mt-2 mb-1 tabular-nums tracking-tight">{secureMoney(item.value)}</strong>
        <span className="text-xs text-slate-400">{item.description}</span>
      </div>)}
    </Card>
  </>;
}
