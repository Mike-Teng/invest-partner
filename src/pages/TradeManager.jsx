import { useState } from 'react';
import Card from '../components/Card.jsx';

import { TrendingUp, Lock, Activity, Trash2 } from 'lucide-react';
import { taipeiDate } from '../lib/entryTime.js';
import { prepareTradeEntry, assertSafeTradeChange } from '../lib/tradeChanges.js';

export default function TradeManager({ notify, trades, portfolioStats, isAdmin, changeLedger, secureMoney }) {
    const [date, setDate] = useState(taipeiDate());
    const [time, setTime] = useState('');
    const [ticker, setTicker] = useState('');
    const [type, setType] = useState('BUY');
    const [price, setPrice] = useState('');
    const [qty, setQty] = useState('');

    const handleAddTrade = async (e) => {
      e.preventDefault();
      const button = e.currentTarget.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      try {
        await changeLedger('add-trade', { date, time, ticker, type, price, qty }, (ledger, id) => ({
          collection: 'trades', id, before: null,
          after: prepareTradeEntry({ ...ledger, id, date, time: date < taipeiDate() ? time : undefined,
            ticker, type, price: Number(price), qty: Number(qty) }),
        }));
        setTicker(''); setPrice(''); setQty('');
      } catch (error) { notify(error.message || '新增失敗'); }
      finally { if (button) button.disabled = false; }
    };
    const handleDelete = async (id) => {
      if (!window.confirm('刪除這筆交易？')) return;
      try {
        await changeLedger('delete-trade', { id }, ledger => {
          const before = ledger.trades.find(trade => trade.id === id);
          if (!before) throw new Error('找不到這筆紀錄，請重新整理');
          assertSafeTradeChange({ beforeTrades: ledger.trades, afterTrades: ledger.trades.filter(trade => trade.id !== id),
            funds: ledger.funds, exchangeRate: Number(ledger.marketPrices.USDTWD) || 32.5 });
          return { collection: 'trades', id, before, after: null };
        });
      } catch (error) { notify(error.message || '刪除失敗'); }
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isAdmin ? (
          <div className="lg:col-span-1">
            <Card className="p-6 entry-form-panel">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg"><div className="p-2 bg-brand-100 text-brand-600 rounded-lg mr-3"><TrendingUp className="w-5 h-5" /></div>紀錄交易</h3>
              {/* 修正：使用 portfolioStats.cashBalance 顯示正確的現金餘額 */}
              <div className="mb-5 p-4 bg-slate-50/60 rounded-xl border border-slate-100/60"><span className="text-xs font-bold text-slate-400 uppercase block mb-1">帳面現金餘額</span><span className="font-mono text-xl font-bold text-slate-700">{secureMoney(portfolioStats.cashBalance)}</span></div>
              <form onSubmit={handleAddTrade} className="space-y-5">
                <div className="toggle-switch"><button type="button" onClick={() => setType('BUY')} className={`flex-1 py-2 rounded-lg font-bold text-sm toggle-option ${type === 'BUY' ? 'toggle-option-active text-red-600' : 'toggle-option-inactive'}`}>買入</button><button type="button" onClick={() => setType('SELL')} className={`flex-1 py-2 rounded-lg font-bold text-sm toggle-option ${type === 'SELL' ? 'toggle-option-active text-green-600' : 'toggle-option-inactive'}`}>賣出</button></div>
                <div><label htmlFor="trademanager-date" className="block text-sm font-bold text-slate-500 mb-2">日期</label><input id="trademanager-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" /></div>
                {date < taipeiDate() && <div><label htmlFor="trademanager-time" className="block text-sm font-bold text-slate-500 mb-2">實際成交時間（台灣時間）</label><input id="trademanager-time" type="time" required value={time} onChange={e => setTime(e.target.value)} className="input-field" /></div>}
                <div><label htmlFor="trademanager-ticker" className="block text-sm font-bold text-slate-500 mb-2">代號</label><input id="trademanager-ticker" type="text" value={ticker} onChange={e => setTicker(e.target.value)} className="input-field uppercase" placeholder="如: 2330" /></div>
                <div className="grid grid-cols-2 gap-4"><div><label htmlFor="trademanager-price" className="block text-sm font-bold text-slate-500 mb-2">價格</label><input id="trademanager-price" type="number" required min="0.00000001" step="any" value={price} onChange={e => setPrice(e.target.value)} className="input-field" /></div><div><label htmlFor="trademanager-qty" className="block text-sm font-bold text-slate-500 mb-2">股數</label><input id="trademanager-qty" type="number" required min="0.00000001" step="any" value={qty} onChange={e => setQty(e.target.value)} className="input-field" /></div></div>
                <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-4 rounded-xl shadow-brand-500/20 hover:shadow-glow-sm transition-all duration-200 active:scale-[0.97]">新增紀錄</button>
              </form>
            </Card>
          </div>
        ) : <div className="lg:col-span-1"><div className="bg-slate-50 p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400"><Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" /><p>僅管理員可操作</p></div></div>}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-slate-100/60 bg-slate-50/30"><h3 className="font-bold text-slate-700 flex items-center"><Activity className="w-4 h-4 mr-2 text-slate-400" /> 交易歷史</h3></div>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto p-6">
              <table className="w-full text-left">
                <thead><tr className="text-slate-400 text-sm border-b"><th className="pb-3 pl-2">日期</th><th className="pb-3">代號</th><th className="pb-3">類別</th><th className="pb-3 text-right">成交價</th><th className="pb-3 text-right">股數</th><th className="pb-3 text-right pr-4">總額</th>{isAdmin && <th className="pb-3 text-center">操作</th>}</tr></thead>
                <tbody className="text-slate-600">
                  {[...trades].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => (
                    <tr key={t.id} className="hover-indicator border-b last:border-0">
                      <td className="py-4 pl-2 text-sm">{t.date}</td><td className="py-4 font-bold">{t.ticker}</td>
                      <td className="py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'BUY' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{t.type === 'BUY' ? '買' : '賣'}</span></td>
                      <td className="py-4 text-right">{t.price}</td><td className="py-4 text-right">{t.qty}</td><td className="py-4 text-right font-mono text-slate-800 pr-4">{secureMoney(t.price * t.qty)}</td>
                      {isAdmin && <td className="py-4 text-center"><button aria-label={`刪除 ${t.ticker} ${t.date} 交易紀錄`} onClick={() => handleDelete(t.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>}
                    </tr>
                  ))}
                  {trades.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">無紀錄</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - 交易紀錄 (優化版) */}
            <div className="md:hidden p-4 space-y-3">
              {[...trades].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => (
                <div key={t.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {/* 第一行: 股票代號與日期 */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'BUY' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {t.type === 'BUY' ? '買入' : '賣出'}
                      </span>
                      <span className="font-bold text-lg text-slate-800">{t.ticker}</span>
                    </div>
                    <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-100">{t.date}</span>
                  </div>

                  {/* 第二行: 詳細數據 grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-200 pt-2 mt-2">
                    <div className="text-slate-500">成交價: <span className="text-slate-700">{t.price}</span></div>
                    <div className="text-slate-500 text-right">股數: <span className="text-slate-700">{t.qty}</span></div>
                    <div className="col-span-2 flex justify-between items-center bg-white p-2 rounded-lg mt-1">
                      <span className="text-slate-500">總金額</span>
                      <span className="font-mono font-bold text-slate-800 text-base">{secureMoney(t.price * t.qty)}</span>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="mt-3 flex justify-end">
                      <button aria-label={`刪除 ${t.ticker} ${t.date} 交易紀錄`} onClick={() => handleDelete(t.id)} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded flex items-center transition-colors">
                        <Trash2 className="w-3 h-3 mr-1" /> 刪除紀錄
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {trades.length === 0 && <div className="text-center text-slate-400 py-8">目前無紀錄</div>}
            </div>
          </Card>
        </div>
      </div>
    );
  }
