import { useState } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartNoAxesCombined } from 'lucide-react';
import Card from '../Card.jsx';
import { formatMoney, formatDateShort } from '../../lib/formatters.js';

export default function HistoryChart({ data, isSpecificInvestor, investor }) {
  const [metric, setMetric] = useState('assets');
  const [range, setRange] = useState('all');
  const profit = metric === 'profit';
  const lastDate = data.at(-1)?.date;
  const cutoff = lastDate ? Date.parse(lastDate) - 90 * 86400000 : 0;
  const filtered = range === 'all' ? data : data.filter(point => Date.parse(point.date) >= cutoff);
  const key = profit ? (isSpecificInvestor ? 'meProfit' : 'totalProfit') : (isSpecificInvestor ? investor : 'total');
  const color = profit ? '#0d9488' : '#5268d9';
  return <Card className="chart-panel">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div><h2 className="section-title">{profit ? '累計收益趨勢' : '資產成長趨勢'}</h2><p className="text-xs text-slate-400 mt-1.5">{lastDate ? `最新紀錄 ${lastDate} · TWD` : '記錄快照後即可查看趨勢'}</p></div>
      <div className="toggle-switch" aria-label="圖表數據">
        {[['assets', '資產總值'], ['profit', '累計收益']].map(([value, label]) => <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)} className={`toggle-option ${metric === value ? 'toggle-option-active' : 'toggle-option-inactive'}`}>{label}</button>)}
      </div>
    </div>
    {filtered.length ? <div key={`${metric}-${range}`} className="trend-plot chart-enter" aria-label={`${profit ? '累計收益' : '資產總值'}歷史圖表`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={filtered} margin={{ top: 12, right: 12, bottom: 8, left: -15 }}>
          <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.16} /><stop offset="100%" stopColor={color} stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#edf0f4" strokeDasharray="4 4" />
          <XAxis dataKey="date" tickFormatter={formatDateShort} axisLine={false} tickLine={false} minTickGap={28} tick={{ fontSize: 11, fill: '#8b96a8' }} dy={8} />
          <YAxis tickFormatter={value => `${value / 1000}k`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8b96a8' }} domain={['auto', 'auto']} width={60} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} formatter={value => [formatMoney(value), profit ? '累計收益' : '資產總值']} labelFormatter={date => date} />
          {/* Animate the chart container only on deliberate switches, never on a live data update. */}
          <Area dataKey={key} type="monotone" isAnimationActive={false} stroke={color} strokeWidth={2.5} fill="url(#trendFill)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div> : <div className="trend-plot flex flex-col items-center justify-center text-slate-400 gap-3"><ChartNoAxesCombined size={32} /><p className="text-sm">尚無歷史快照</p></div>}
    <div className="chart-footer">
      <span className="text-xs text-slate-400">{profit ? '收益包含已領回的收益' : '依已儲存的歷史快照顯示'}</span>
      <div className="flex gap-1" aria-label="圖表期間">{[['all', '全部'], ['3m', '近 3 個月']].map(([value, label]) => <button type="button" key={value} aria-pressed={range === value} onClick={() => setRange(value)} className={`range-button ${range === value ? 'range-active' : ''}`}>{label}</button>)}</div>
    </div>
  </Card>;
}
