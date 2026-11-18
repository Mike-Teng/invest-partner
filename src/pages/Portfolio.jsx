import { useState } from 'react';
import Card from '../components/Card.jsx';
import { formatMoney, formatOriginalMoney, formatPercent } from '../lib/formatters.js';
import { Save, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
const COLORS = ['#4a6d62', '#899c93', '#b5aaa0', '#777f8b', '#997e83', '#9c9b69', '#655b67'];

export default function Portfolio({ marketPrices, portfolioStats, allocationData, isAdmin, isAllowed, secureMoney, saveMarketPrices }) {
    const [priceEdits, setPriceInputs] = useState({});
    const priceInputs = { ...marketPrices, ...priceEdits };
    const reducedMotion = useReducedMotion();
    const [savedMsg, setSavedMsg] = useState(false);
    const handlePriceChange = (ticker, val) => setPriceInputs(prev => ({ ...prev, [ticker]: val }));
    const savePrices = async () => {
      const newPrices = { ...marketPrices };
      Object.keys(priceInputs).forEach(k => { if (priceInputs[k]) newPrices[k] = parseFloat(priceInputs[k]); });
      try { await saveMarketPrices(newPrices); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); } catch (e) { console.error(e); }
    };

    return (
      <div className="space-y-6">
        {isAllowed && (
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center"><div className="p-2 bg-brand-100 text-brand-600 rounded-lg mr-3"><PieChartIcon className="w-5 h-5" /></div>資產配置 (台幣)</h3>
            <div className="h-[300px] flex items-center justify-center">
              {allocationData.length > 0 ? (
                <ResponsiveContainer><PieChart><Pie data={allocationData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} fill="#8884d8" paddingAngle={5} dataKey="value" isAnimationActive={!reducedMotion} animationDuration={350} animationEasing="ease-out">{allocationData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip formatter={(v, n) => { const total = allocationData.reduce((a, c) => a + c.value, 0); return [`${formatMoney(v)} (${formatPercent(total > 0 ? v / total : 0)})`, n]; }} /><Legend /></PieChart></ResponsiveContainer>
              ) : <p className="text-slate-400">無資產數據</p>}
            </div>
          </Card>
        )}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div><h3 className="text-xl font-bold text-slate-800">持倉損益表 (TWD)</h3><p className="text-slate-500 text-sm">金額已換算台幣</p></div>
            {isAdmin && <button onClick={savePrices} className={`flex items-center px-4 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg ${savedMsg ? 'bg-green-600 text-white shadow-green-500/20' : 'bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/20 hover:shadow-glow-sm'}`}>{savedMsg ? '已同步!' : <><Save className="w-4 h-4 mr-2" /> 更新市價</>}</button>}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-sm border-b">
                  <th className="pb-4 pl-4 pr-2">代號</th>
                  <th className="pb-4 px-4 text-right">股數</th>
                  <th className="pb-4 px-4 text-right">幣別</th>
                  <th className="pb-4 px-4 text-right">成本均價</th>
                  <th className="pb-4 px-4 text-right w-32">現價(原幣)</th>
                  <th className="pb-4 px-4 text-right">市值(TWD)</th>
                  <th className="pb-4 px-4 text-right">損益(TWD)</th>
                  <th className="pb-4 pl-2 pr-4 text-right">報酬率</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {portfolioStats.holdingsList.map(item => (
                  <tr key={item.ticker} className="hover-indicator border-b last:border-0">
                    <td className="py-5 pl-4 pr-2 font-bold text-slate-800"><div className="flex items-center gap-2">{item.ticker}<span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${item.returnRate >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{item.returnRate >= 0 ? '獲利' : '虧損'}</span></div></td>
                    <td className="py-5 px-4 text-right">{item.qty}</td>
                    <td className="py-5 px-4 text-right text-xs text-slate-500">{item.isUS ? <span className="bg-brand-50 text-brand-600 px-2 py-1 rounded">USD</span> : <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">TWD</span>}</td>
                    <td className="py-5 px-4 text-right font-mono text-slate-600">{formatOriginalMoney(item.avgCostOriginal, item.isUS)}</td>
                    <td className="py-5 px-4 text-right"><input aria-label={`${item.ticker} 現價`} type="number" step="0.1" disabled={!isAdmin} value={priceInputs[item.ticker] || ''} onChange={e => handlePriceChange(item.ticker, e.target.value)} placeholder={item.avgCostOriginal.toFixed(1)} className={`input-field w-24 text-right ${isAdmin ? 'bg-brand-50/50 border-brand-200' : 'bg-transparent border-transparent'}`} /></td>
                    <td className="py-5 px-4 text-right font-medium text-slate-800">{secureMoney(item.currentValue)}</td>
                    <td className={`py-5 px-4 text-right font-medium ${!isAllowed ? 'text-slate-600' : (item.unrealizedPL >= 0 ? 'text-green-600' : 'text-red-600')}`}>{isAllowed && (item.unrealizedPL >= 0 ? '+' : '')}{secureMoney(item.unrealizedPL)}</td>
                    <td className={`py-5 pl-2 pr-4 text-right font-bold ${!isAllowed ? 'text-slate-600' : (item.returnRate >= 0 ? 'text-green-600' : 'text-red-600')}`}>{isAllowed ? formatPercent(item.returnRate) : "****"}</td>
                  </tr>
                ))}
                {portfolioStats.holdingsList.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-slate-400">無持倉</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - 持倉損益 (新增：3欄佈局) */}
          <div className="md:hidden space-y-4 mt-4">
            {portfolioStats.holdingsList.map(item => (
              <div key={item.ticker} className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                {/* 頭部：代號與狀態 */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-800">{item.ticker}</span>
                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{item.isUS ? 'USD' : 'TWD'}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${item.returnRate >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isAllowed ? formatPercent(item.returnRate) : "****"}
                  </span>
                </div>

                {/* 數據 Grid (3 columns) */}
                <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                  <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col justify-center">
                    <div className="text-slate-400 text-[10px] mb-1">持有股數</div>
                    <div className="font-medium text-slate-700">{item.qty}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col justify-center">
                    <div className="text-slate-400 text-[10px] mb-1">成本均價</div>
                    <div className="font-medium text-slate-700">{formatOriginalMoney(item.avgCostOriginal, item.isUS)}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col justify-center">
                    <div className="text-slate-400 text-[10px] mb-1">現價</div>
                    <input
                      aria-label={`${item.ticker} 現價`}
                      type="number"
                      step="0.1"
                      disabled={!isAdmin}
                      value={priceInputs[item.ticker] || ''}
                      onChange={e => handlePriceChange(item.ticker, e.target.value)}
                      placeholder={item.avgCostOriginal.toFixed(1)}
                      className={`w-full outline-none font-bold text-sm ${isAdmin ? 'text-brand-600' : 'text-slate-600 bg-transparent'}`}
                    />
                  </div>
                </div>

                {/* 底部總結：市值與損益 */}
                <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-400">市值 (TWD)</div>
                    <div className="font-bold text-slate-800 text-lg">{secureMoney(item.currentValue)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">損益 (TWD)</div>
                    <div className={`font-bold text-lg ${!isAllowed ? 'text-slate-600' : (item.unrealizedPL >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                      {isAllowed && (item.unrealizedPL >= 0 ? '+' : '')}{secureMoney(item.unrealizedPL)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {portfolioStats.holdingsList.length === 0 && <div className="text-center text-slate-400 py-8">無持倉</div>}
          </div>

        </Card>
      </div>
    );
  }
