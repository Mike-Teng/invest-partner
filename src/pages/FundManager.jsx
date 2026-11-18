import { useState } from 'react';
import Card from '../components/Card.jsx';
import { safeNumber, formatMoney, formatPrice, formatUnit } from '../lib/formatters.js';
import { Plus, ArrowDownRight, Trash2, Pencil, Lock, Wallet } from 'lucide-react';
import { taipeiDate } from '../lib/entryTime.js';
import { calculateUnitAccounting, summarizeCashFlows, createFundTransaction } from '../lib/accounting.js';
import { calculatePortfolio } from '../lib/portfolio.js';
import { prepareFundNavEdit, prepareFundEntry, fundEntryContext, assertSafeFundChange } from '../lib/fundChanges.js';

export default function FundManager({ notify, investors, funds, historyData, unitStats, isAdmin, changeLedger, setDeleteModal, secureMoney }) {
    const [date, setDate] = useState(taipeiDate());
    const [investor, setInvestor] = useState(investors[0]);
    const [amount, setAmount] = useState('');
    const [time, setTime] = useState('');
    const [historicalNav, setHistoricalNav] = useState('');
    // 新增狀態：判斷是入金還是提領
    const [fundType, setFundType] = useState('DEPOSIT');

    // 計算當下預估能買到/賣出的單位數 (顯示用)
    let context = null;
    try { context = fundEntryContext({ funds, historyData, investor, date, time: date < taipeiDate() ? time : undefined }); } catch { /* Input is incomplete. */ }
    const requiresHistoricalNav = date < taipeiDate() || context?.requiresHistoricalNav;
    const estPrice = requiresHistoricalNav ? Number(historicalNav) : unitStats.currentUnitPrice;
    // 取得當前選定投資人的最大可提領狀態
    const currentInvestorData = { units: context?.ownedUnits || 0 };
    const maxWithdrawValue = currentInvestorData.units * estPrice;
    // Preview the same signed units that will be saved, including full redemption.
    let estUnits = 0;
    if (amount) {
      try {
        estUnits = createFundTransaction({
          amount: Number(amount), isWithdrawal: fundType === 'WITHDRAW',
          unitPrice: estPrice, ownedUnits: currentInvestorData.units,
        }).units;
      } catch {
        // Invalid inputs are explained on submission rather than showing NaN.
      }
    }

    // 一鍵全數提領
    const handleMaxWithdraw = () => {
      setAmount(maxWithdrawValue.toFixed(0)); // 帶入總價值 (四捨五入到整數)
    };

    const handleAddFund = async (e) => {
      e.preventDefault();
      if (!isAdmin) return;
      const isWithdraw = fundType === 'WITHDRAW';
      const button = e.currentTarget.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      try {
        const result = await changeLedger('add-fund', { investor, date, time, amount, fundType, historicalNav }, (ledger, id) => {
          const totals = summarizeCashFlows(ledger.funds);
          const portfolio = calculatePortfolio(ledger.trades, totals.netContributions, ledger.marketPrices);
          const accounting = calculateUnitAccounting({ ...ledger, investors, totalAssets: portfolio.totalAssets });
          const after = prepareFundEntry({ ...ledger, id, investor, date,
            time: date < taipeiDate() ? time : undefined,
            amount: Number(amount), isWithdrawal: isWithdraw, historicalNav,
            currentNav: accounting.currentUnitPrice, hasUnallocatedAssets: accounting.hasUnallocatedAssets });
          return { collection: 'funds', id, before: null, after };
        });
        const transaction = result.after;
        setAmount('');
        const actionName = isWithdraw ? '提領' : '入金';
        notify(`${actionName}成功！\n日期: ${date}\n成交淨值: ${formatPrice(transaction.buyPrice)}\n${actionName}單位: ${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(Math.abs(transaction.units))}`);
      } catch (error) {
        console.error("Error adding document: ", error);
        notify(error.message || "寫入失敗");
      } finally { if (button) button.disabled = false; }
    };

    const handleDelete = (id) => {
      setDeleteModal({
        show: true,
        message: '確定要刪除這筆資金紀錄嗎？',
        onConfirm: async () => {
          try {
            await changeLedger('delete-fund', { id }, ledger => {
              const before = ledger.funds.find(fund => fund.id === id);
              if (!before) throw new Error('找不到這筆紀錄，請重新整理');
              assertSafeFundChange(ledger.funds, ledger.funds.filter(fund => fund.id !== id), ledger.historyData, id);
              return { collection: 'funds', id, before, after: null };
            });
          } catch (error) {
            console.error("Error deleting document: ", error);
            notify(error.message || '刪除失敗');
          }
        }
      });
    };

    // --- 手動修正淨值功能 ---
    const handleEditNav = async (fund) => {
      if (!isAdmin) return;
      const currentBuyPrice = safeNumber(fund.buyPrice) || 10;
      const newNavStr = prompt(`修正 ${fund.date} 的成交淨值 (目前: ${currentBuyPrice.toFixed(2)})`, currentBuyPrice);
      if (newNavStr === null) return;

      try {
        const result = await changeLedger('edit-fund-nav', { id: fund.id, newNav: Number(newNavStr) }, ledger => {
          const update = prepareFundNavEdit({ ...ledger, fundId: fund.id, newNav: Number(newNavStr) });
          if (!update) return null;
          const before = ledger.funds.find(item => item.id === fund.id);
          return { collection: 'funds', id: fund.id, before, after: { ...before, ...update } };
        });
        if (!result) return;
        notify("已更新淨值與單位數！");
      } catch (error) {
        console.error("Update failed", error);
        notify(error.message || "更新失敗");
      }
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isAdmin ? (
          <div className="lg:col-span-1">
            <Card className="p-6 entry-form-panel">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg">
                <div className={`p-2 rounded-lg mr-3 ${fundType === 'DEPOSIT' ? 'bg-brand-50 text-brand-600' : 'bg-orange-100 text-orange-600'}`}>
                  {fundType === 'DEPOSIT' ? <Plus className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                </div>
                資金異動
              </h3>

              <div className="bg-brand-50 p-4 rounded-xl mb-6 border border-brand-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-400">參考淨值狀態</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${funds.length === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {funds.length === 0 ? '初始期 (固定 10)' : '營運期 (浮動)'}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">預估成交價</div>
                    <div className="text-xl font-bold text-slate-800">{estPrice > 0 ? formatPrice(estPrice) : '待填當時淨值'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">{fundType === 'DEPOSIT' ? '預估購入單位' : '預估註銷單位'}</div>
                    <div className={`text-xl font-bold ${fundType === 'DEPOSIT' ? 'text-brand-600' : 'text-orange-600'}`}>
                      {new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(estUnits)}
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddFund} className="space-y-5">
                {/* 新增：入金/提領 切換按鈕 */}
                <div className="toggle-switch">
                  <button type="button" onClick={() => { setFundType('DEPOSIT'); setAmount(''); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all toggle-option ${fundType === 'DEPOSIT' ? 'toggle-option-active' : 'toggle-option-inactive'}`}>
                    入金 (Deposit)
                  </button>
                  <button type="button" onClick={() => { setFundType('WITHDRAW'); setAmount(''); }} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all toggle-option ${fundType === 'WITHDRAW' ? 'toggle-option-active' : 'toggle-option-inactive'}`}>
                    提領 (Withdraw)
                  </button>
                </div>

                <div>
                  <label htmlFor="fundmanager-date" className="block text-sm font-bold text-slate-500 mb-2">日期</label>
                  <input id="fundmanager-date" type="date" required value={date} onChange={e => setDate(e.target.value)} className="input-field" />
                </div>
                {date < taipeiDate() && <div>
                  <label htmlFor="fundmanager-time" className="block text-sm font-bold text-slate-500 mb-2">實際發生時間（台灣時間）</label>
                  <input id="fundmanager-time" type="time" required value={time} onChange={e => setTime(e.target.value)} className="input-field" />
                </div>}
                {requiresHistoricalNav && <div>
                  <label htmlFor="fundmanager-historicalNav" className="block text-sm font-bold text-slate-500 mb-2">當時成交淨值</label>
                  <input id="fundmanager-historicalNav" type="number" step="any" min="0.00000001" required value={historicalNav} onChange={e => setHistoricalNav(e.target.value)} className="input-field" />
                  <p className="text-xs text-slate-500 mt-2">請依當時對帳紀錄填寫。補登不會自動重算後續提領或改寫舊快照。</p>
                </div>}
                <div>
                  <label htmlFor="fundmanager-investor" className="block text-sm font-bold text-slate-500 mb-2">合夥人</label>
                  <select id="fundmanager-investor" value={investor} onChange={e => setInvestor(e.target.value)} className="input-field">
                    {investors.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="fundmanager-amount" className="block text-sm font-bold text-slate-500">金額 (TWD)</label>
                    {fundType === 'WITHDRAW' && (
                      <button 
                        type="button" 
                        onClick={handleMaxWithdraw}
                        className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded hover:bg-orange-200 font-bold transition-colors animate-fade-in"
                      >
                        全數提領
                      </button>
                    )}
                  </div>
                  <input id="fundmanager-amount" 
                    type="number" 
                    required 
                    min="1"
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    placeholder={fundType === 'WITHDRAW' ? `最多可提領 ${formatMoney(maxWithdrawValue)}` : "輸入正數金額"}
                    className="input-field animate-fade-in" 
                  />
                  {fundType === 'WITHDRAW' && (
                    <div className="text-[10px] text-slate-400 mt-1 text-right animate-fade-in">
                      可提領餘額: {formatMoney(maxWithdrawValue)}
                    </div>
                  )}
                </div>
                <button type="submit" className={`w-full text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all duration-200 active:scale-[0.97] ${fundType === 'DEPOSIT' ? 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/20 hover:shadow-glow-sm' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'}`}>
                  {fundType === 'DEPOSIT' ? '確認入金' : '確認提領出金'}
                </button>
              </form>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-1">
            <div className="bg-slate-50 p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400">
              <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>僅管理員可新增資金</p>
            </div>
          </div>
        )}

        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-slate-100/60 bg-slate-50/30">
              <h3 className="font-bold text-slate-700 flex items-center">
                <Wallet className="w-4 h-4 mr-2 text-slate-400" /> 資金異動紀錄
              </h3>
            </div>

            <div className="hidden md:block overflow-x-auto p-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-100">
                    <th className="pb-3 font-medium whitespace-nowrap pl-2">日期</th>
                    <th className="pb-3 font-medium whitespace-nowrap">投資人</th>
                    <th className="pb-3 font-medium whitespace-nowrap">類別</th>
                    <th className="pb-3 font-medium text-right whitespace-nowrap pr-4">金額</th>
                    <th className="pb-3 font-medium text-right whitespace-nowrap pr-4">成交淨值</th>
                    <th className="pb-3 font-medium text-right whitespace-nowrap pr-4">單位數</th>
                    {isAdmin && <th className="pb-3 font-medium w-16 text-center whitespace-nowrap">操作</th>}
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {[...unitStats.enrichedFunds].reverse().map(f => {
                    const isWithdraw = f.amount < 0;
                    return (
                      <tr key={f.id} className={`hover-indicator transition-colors border-b border-slate-50 last:border-0 ${isWithdraw ? 'bg-orange-50/30' : ''}`}>
                        <td className="py-4 text-sm whitespace-nowrap pl-2">{f.date}</td>
                        <td className="py-4 font-medium whitespace-nowrap">
                          <span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">{f.investor}</span>
                        </td>
                        <td className="py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${isWithdraw ? 'bg-orange-100 text-orange-600' : 'bg-brand-50 text-brand-600'}`}>
                            {isWithdraw ? '提領' : '入金'}
                          </span>
                        </td>
                        <td className={`py-4 text-right font-mono whitespace-nowrap pr-4 ${isWithdraw ? 'text-orange-600' : 'text-slate-800'}`}>
                          {secureMoney(f.amount)}
                        </td>
                        <td className="py-4 text-right font-mono text-slate-500 whitespace-nowrap pr-4 text-sm group cursor-pointer" onClick={() => handleEditNav(f)}>
                          <div className="flex items-center justify-end">
                            {formatPrice(f.buyPrice)}
                            {isAdmin && <Pencil className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 text-brand-400" />}
                          </div>
                        </td>
                        <td className={`py-4 text-right font-mono whitespace-nowrap pr-4 text-sm ${isWithdraw ? 'text-orange-600' : 'text-slate-500'}`}>
                          {formatUnit(f.units)}
                        </td>
                        {isAdmin && (
                          <td className="py-4 text-center whitespace-nowrap">
                            <button aria-label={`刪除 ${f.investor} ${f.date} 資金紀錄`} onClick={() => handleDelete(f.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {unitStats.enrichedFunds.length === 0 && (
                    <tr><td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-slate-400">目前無紀錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-4 space-y-3">
              {[...unitStats.enrichedFunds].reverse().map(f => {
                const isWithdraw = f.amount < 0;
                return (
                  <div key={f.id} className={`bg-slate-50 p-4 rounded-xl border flex justify-between items-center ${isWithdraw ? 'border-orange-200 bg-orange-50/50' : 'border-slate-100'}`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isWithdraw ? 'bg-orange-100 text-orange-600' : 'bg-brand-50 text-brand-600'}`}>
                          {isWithdraw ? '提領' : '入金'}
                        </span>
                        <span className="font-bold text-slate-700">{f.investor}</span>
                        <span className="text-xs text-slate-400">{f.date}</span>
                      </div>
                      <div className={`font-mono font-bold ${isWithdraw ? 'text-orange-600' : 'text-slate-800'}`}>
                        {secureMoney(f.amount)}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex gap-3 items-center" onClick={() => handleEditNav(f)}>
                        <span className="flex items-center">淨值: {formatPrice(f.buyPrice)} {isAdmin && <Pencil className="w-3 h-3 ml-1 text-slate-300" />}</span>
                        <span>單位: {formatUnit(f.units)}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <button aria-label={`刪除 ${f.investor} ${f.date} 資金紀錄`} onClick={() => handleDelete(f.id)} className="p-2 text-slate-300 hover:text-red-500">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )
              })}
              {unitStats.enrichedFunds.length === 0 && <div className="text-center text-slate-400 py-8">目前無紀錄</div>}
            </div>
          </Card>
        </div>
      </div>
    );
  }
