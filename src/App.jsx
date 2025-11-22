import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight, 
  Trash2, 
  Plus,
  Save,
  Users,
  AlertCircle
} from 'lucide-react';

// --- 輔助函數 ---
const formatMoney = (amount) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(amount);
};

const formatPercent = (value) => {
  return `${(value * 100).toFixed(2)}%`;
};

// --- 主要 App 組件 ---
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // 1. 設定投資人 (Yi & Ma)
  const [investors, setInvestors] = useState(['Yi', 'Ma']);
  
  const [funds, setFunds] = useState([]);
  const [trades, setTrades] = useState([]);
  const [marketPrices, setMarketPrices] = useState({}); 

  const [deleteModal, setDeleteModal] = useState({ show: false, message: '', onConfirm: null });

  // --- 新增：設定瀏覽器標題 ---
  useEffect(() => {
    document.title = "InvestPartner - 投資管理";
  }, []);

  // 初始化：從 LocalStorage 讀取
  useEffect(() => {
    const savedFunds = localStorage.getItem('inv_funds');
    const savedTrades = localStorage.getItem('inv_trades');
    const savedPrices = localStorage.getItem('inv_prices');

    if (savedFunds) setFunds(JSON.parse(savedFunds));
    if (savedTrades) setTrades(JSON.parse(savedTrades));
    if (savedPrices) setMarketPrices(JSON.parse(savedPrices));
  }, []);

  // 儲存：當資料變更時寫入 LocalStorage
  useEffect(() => {
    localStorage.setItem('inv_funds', JSON.stringify(funds));
    localStorage.setItem('inv_trades', JSON.stringify(trades));
    localStorage.setItem('inv_prices', JSON.stringify(marketPrices));
  }, [funds, trades, marketPrices]);

  // --- 計算邏輯 ---

  // 1. 計算總投入本金與現金餘額
  const capitalStats = useMemo(() => {
    let totalCapital = 0;
    const investorContributions = {};

    investors.forEach(inv => investorContributions[inv] = 0);

    funds.forEach(f => {
      if (investorContributions[f.investor] !== undefined) {
        totalCapital += parseFloat(f.amount);
        investorContributions[f.investor] += parseFloat(f.amount);
      }
    });

    return { totalCapital, investorContributions };
  }, [funds, investors]);

  // 2. 計算持倉與現金流
  const portfolioStats = useMemo(() => {
    let cashBalance = capitalStats.totalCapital;
    const holdings = {}; 

    trades.forEach(t => {
      const totalAmount = parseFloat(t.price) * parseFloat(t.qty);
      if (t.type === 'BUY') {
        cashBalance -= totalAmount;
        if (!holdings[t.ticker]) holdings[t.ticker] = { qty: 0, totalCost: 0 };
        holdings[t.ticker].qty += parseFloat(t.qty);
        holdings[t.ticker].totalCost += totalAmount;
      } else {
        cashBalance += totalAmount;
        if (holdings[t.ticker]) {
          const avgCost = holdings[t.ticker].totalCost / holdings[t.ticker].qty;
          holdings[t.ticker].qty -= parseFloat(t.qty);
          holdings[t.ticker].totalCost -= avgCost * parseFloat(t.qty);
        }
      }
    });

    // 計算當前市值
    let marketValue = 0;
    const holdingsList = Object.keys(holdings).map(ticker => {
      const data = holdings[ticker];
      if (data.qty <= 0) return null; 

      const currentPrice = marketPrices[ticker] || (data.totalCost / data.qty); 
      const currentValue = data.qty * currentPrice;
      marketValue += currentValue;

      const avgCost = data.totalCost / data.qty;
      const unrealizedPL = currentValue - data.totalCost;
      const returnRate = (unrealizedPL / data.totalCost);

      return {
        ticker,
        qty: data.qty,
        avgCost,
        currentPrice,
        currentValue,
        unrealizedPL,
        returnRate
      };
    }).filter(Boolean);

    return { cashBalance, marketValue, holdingsList };
  }, [trades, capitalStats.totalCapital, marketPrices]);

  // 3. 總體績效
  const totalAssets = portfolioStats.cashBalance + portfolioStats.marketValue;
  const totalPL = totalAssets - capitalStats.totalCapital;
  const totalROI = capitalStats.totalCapital > 0 ? (totalPL / capitalStats.totalCapital) : 0;

  // --- 視圖組件 ---

  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">總資產 (NAV)</div>
          <div className="text-3xl font-bold text-slate-800">{formatMoney(totalAssets)}</div>
          <div className="text-xs text-slate-400 mt-2">現金 + 股票市值</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">總投入本金</div>
          <div className="text-2xl font-bold text-slate-800">{formatMoney(capitalStats.totalCapital)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">總損益</div>
          <div className={`text-2xl font-bold ${totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalPL >= 0 ? '+' : ''}{formatMoney(totalPL)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">投資報酬率 (ROI)</div>
          <div className={`text-2xl font-bold ${totalROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalROI >= 0 ? <ArrowUpRight className="inline w-6 h-6 mr-1" /> : <ArrowDownRight className="inline w-6 h-6 mr-1" />}
            {formatPercent(totalROI)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
          <Users className="w-5 h-5 text-slate-500 mr-2" />
          <h3 className="font-bold text-slate-700">合夥人權益分配</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-sm border-b border-slate-100">
                  <th className="pb-3 font-medium">投資人</th>
                  <th className="pb-3 font-medium">投入本金</th>
                  <th className="pb-3 font-medium">佔比</th>
                  <th className="pb-3 font-medium">當前淨值</th>
                  <th className="pb-3 font-medium">個人損益</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {investors.map(inv => {
                  const invested = capitalStats.investorContributions[inv] || 0;
                  const ratio = capitalStats.totalCapital > 0 ? (invested / capitalStats.totalCapital) : 0;
                  const currentValue = totalAssets * ratio;
                  const pl = currentValue - invested;

                  return (
                    <tr key={inv} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-medium text-slate-800">{inv}</td>
                      <td className="py-4">{formatMoney(invested)}</td>
                      <td className="py-4 text-slate-500">{formatPercent(ratio)}</td>
                      <td className="py-4 font-bold text-blue-600">{formatMoney(currentValue)}</td>
                      <td className={`py-4 ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pl >= 0 ? '+' : ''}{formatMoney(pl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const FundManager = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [investor, setInvestor] = useState(investors[0]);
    const [amount, setAmount] = useState('');

    const handleAddFund = (e) => {
      e.preventDefault();
      if (!amount || parseFloat(amount) <= 0) return;
      
      const newFund = {
        id: Date.now(),
        date,
        investor,
        amount: parseFloat(amount)
      };
      setFunds([...funds, newFund]);
      setAmount('');
    };

    const handleDelete = (id) => {
      setDeleteModal({
        show: true,
        message: '確定要刪除這筆資金紀錄嗎？',
        onConfirm: () => {
          setFunds(prev => prev.filter(f => f.id !== id));
        }
      });
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center">
              <Plus className="w-5 h-5 mr-2" /> 注入資金
            </h3>
            <form onSubmit={handleAddFund} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">日期</label>
                <input 
                  type="date" 
                  required
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">資金來源 (投資人)</label>
                <select 
                  value={investor} 
                  onChange={e => setInvestor(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {investors.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">金額 (TWD)</label>
                <input 
                  type="number" 
                  required
                  placeholder="例如: 100000"
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                確認入金
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-700">入金紀錄</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 shadow-sm">
                  <tr className="text-slate-400 text-sm">
                    <th className="p-4 font-medium">日期</th>
                    <th className="p-4 font-medium">投資人</th>
                    <th className="p-4 font-medium text-right">金額</th>
                    <th className="p-4 font-medium w-16 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 divide-y divide-slate-50">
                  {[...funds].sort((a,b) => new Date(b.date) - new Date(a.date)).map(f => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="p-4 text-sm">{f.date}</td>
                      <td className="p-4 font-medium">{f.investor}</td>
                      <td className="p-4 text-right font-mono text-slate-800">{formatMoney(f.amount)}</td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleDelete(f.id)} 
                          className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors"
                          title="刪除此紀錄"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {funds.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-slate-400">尚無資金紀錄，請由左側新增。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TradeManager = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [ticker, setTicker] = useState('');
    const [type, setType] = useState('BUY');
    const [price, setPrice] = useState('');
    const [qty, setQty] = useState('');

    const handleAddTrade = (e) => {
      e.preventDefault();
      if (!ticker || !price || !qty) return;

      const newTrade = {
        id: Date.now(),
        date,
        ticker: ticker.toUpperCase(),
        type,
        price: parseFloat(price),
        qty: parseFloat(qty)
      };
      setTrades([...trades, newTrade]);
      setTicker('');
      setPrice('');
      setQty('');
    };

    const handleDelete = (id) => {
      setDeleteModal({
        show: true,
        message: '確定要刪除這筆交易紀錄嗎？',
        onConfirm: () => {
           setTrades(prev => prev.filter(t => t.id !== id));
        }
      });
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" /> 紀錄交易
            </h3>
            <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 flex justify-between">
              <span>可用現金餘額:</span>
              <span className="font-bold text-slate-800">{formatMoney(portfolioStats.cashBalance)}</span>
            </div>
            <form onSubmit={handleAddTrade} className="space-y-4">
              <div className="flex space-x-2">
                <button 
                  type="button"
                  onClick={() => setType('BUY')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${type === 'BUY' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                  買入 (BUY)
                </button>
                <button 
                  type="button"
                  onClick={() => setType('SELL')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${type === 'SELL' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                  賣出 (SELL)
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">日期</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">股票代號 (Ticker)</label>
                <input type="text" value={ticker} onChange={e => setTicker(e.target.value)} placeholder="如: 2330, TSLA" required className="input-field uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">價格</label>
                  <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">股數</label>
                  <input type="number" step="1" value={qty} onChange={e => setQty(e.target.value)} required className="input-field" />
                </div>
              </div>
              
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                新增紀錄
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
           <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-700">交易歷史</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 shadow-sm">
                  <tr className="text-slate-400 text-sm">
                    <th className="p-4 font-medium">日期</th>
                    <th className="p-4 font-medium">代號</th>
                    <th className="p-4 font-medium">類別</th>
                    <th className="p-4 font-medium text-right">成交價</th>
                    <th className="p-4 font-medium text-right">股數</th>
                    <th className="p-4 font-medium text-right">總額</th>
                    <th className="p-4 font-medium w-16 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 divide-y divide-slate-50">
                  {[...trades].sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-4 text-sm">{t.date}</td>
                      <td className="p-4 font-bold">{t.ticker}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'BUY' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          {t.type === 'BUY' ? '買入' : '賣出'}
                        </span>
                      </td>
                      <td className="p-4 text-right">{t.price}</td>
                      <td className="p-4 text-right">{t.qty}</td>
                      <td className="p-4 text-right font-mono text-slate-800">{formatMoney(t.price * t.qty)}</td>
                      <td className="p-4 text-center">
                         <button onClick={() => handleDelete(t.id)} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {trades.length === 0 && (
                     <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400">尚無交易紀錄。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const Portfolio = () => {
    const [priceInputs, setPriceInputs] = useState(marketPrices);
    const [savedMsg, setSavedMsg] = useState(false);

    const handlePriceChange = (ticker, val) => {
      setPriceInputs(prev => ({ ...prev, [ticker]: val }));
    };

    const savePrices = () => {
      const newPrices = {};
      Object.keys(priceInputs).forEach(k => {
        if(priceInputs[k]) newPrices[k] = parseFloat(priceInputs[k]);
      });
      setMarketPrices(newPrices);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800">持倉損益表</h3>
              <p className="text-slate-500 text-sm">請手動更新「現價」欄位以獲得最新損益報告</p>
            </div>
            <button 
              onClick={savePrices}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-300 ${savedMsg ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              {savedMsg ? <span className="flex items-center">已儲存!</span> : <><Save className="w-4 h-4 mr-2" /> 更新市價計算</>}
            </button>
           </div>

           <div className="overflow-x-auto">
             <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-sm border-b border-slate-100">
                  <th className="pb-3 font-medium pl-4">代號</th>
                  <th className="pb-3 font-medium text-right">持有股數</th>
                  <th className="pb-3 font-medium text-right">平均成本</th>
                  <th className="pb-3 font-medium text-right w-40">現價 (請輸入)</th>
                  <th className="pb-3 font-medium text-right">市值</th>
                  <th className="pb-3 font-medium text-right">未實現損益</th>
                  <th className="pb-3 font-medium text-right pr-4">報酬率</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 divide-y divide-slate-50">
                {portfolioStats.holdingsList.map(item => (
                  <tr key={item.ticker} className="hover:bg-slate-50">
                    <td className="py-4 pl-4 font-bold text-slate-800">{item.ticker}</td>
                    <td className="py-4 text-right">{item.qty}</td>
                    <td className="py-4 text-right text-slate-500">{item.avgCost.toFixed(2)}</td>
                    <td className="py-4 text-right">
                       <input 
                        type="number" 
                        step="0.1"
                        value={priceInputs[item.ticker] || ''} 
                        onChange={e => handlePriceChange(item.ticker, e.target.value)}
                        placeholder={item.avgCost.toFixed(1)}
                        className="w-24 p-1 text-right border border-indigo-200 rounded focus:border-indigo-500 focus:outline-none bg-indigo-50/50"
                      />
                    </td>
                    <td className="py-4 text-right font-medium text-slate-800">{formatMoney(item.currentValue)}</td>
                    <td className={`py-4 text-right font-medium ${item.unrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.unrealizedPL >= 0 ? '+' : ''}{formatMoney(item.unrealizedPL)}
                    </td>
                    <td className={`py-4 text-right pr-4 font-bold ${item.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(item.returnRate)}
                    </td>
                  </tr>
                ))}
                {portfolioStats.holdingsList.length === 0 && (
                   <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400">目前無持倉。</td>
                    </tr>
                )}
              </tbody>
             </table>
           </div>
        </div>
      </div>
    );
  };

  // --- 主介面渲染 ---

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'funds': return <FundManager />;
      case 'trade': return <TradeManager />;
      case 'portfolio': return <Portfolio />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* 側邊欄 (Desktop) / 底部欄 (Mobile) */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 md:w-64 md:h-full md:border-t-0 md:border-r md:left-0 z-50 flex md:flex-col justify-between md:justify-start">
        <div className="hidden md:flex items-center p-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 text-lg">$</div>
          <span className="text-xl font-bold text-slate-800">InvestPartner</span>
        </div>
        
        <div className="flex-1 flex md:flex-col justify-around md:justify-start md:p-4 md:space-y-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="總覽儀表板" />
          <NavButton active={activeTab === 'funds'} onClick={() => setActiveTab('funds')} icon={<Wallet />} label="資金管理" />
          <NavButton active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} icon={<TrendingUp />} label="交易紀錄" />
          <NavButton active={activeTab === 'portfolio'} onClick={() => setActiveTab('portfolio')} icon={<PieChart />} label="持倉與市價" />
        </div>

        <div className="hidden md:block p-4 border-t border-slate-100">
          <div className="text-xs text-slate-400">
            資料儲存於本機瀏覽器。<br/>
            清除快取將遺失資料。
          </div>
        </div>
      </nav>

      {/* 主要內容區 */}
      <main className="pb-24 md:pb-8 md:pl-64 pt-6 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="md:hidden flex items-center justify-between mb-6">
           <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 text-lg">$</div>
            <span className="text-xl font-bold text-slate-800">InvestPartner</span>
          </div>
        </div>

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">
            {activeTab === 'dashboard' && '投資組合總覽'}
            {activeTab === 'funds' && '資金存入管理'}
            {activeTab === 'trade' && '股票交易紀錄'}
            {activeTab === 'portfolio' && '持倉損益監控'}
          </h1>
          <p className="text-slate-500">
            {activeTab === 'dashboard' && '查看整體績效與合夥人權益分配'}
            {activeTab === 'funds' && '記錄每位合夥人的本金投入'}
            {activeTab === 'trade' && '新增買入與賣出交易'}
            {activeTab === 'portfolio' && '更新市價以計算未實現損益'}
          </p>
        </header>

        {renderContent()}
      </main>

      {/* 2. 自定義刪除確認視窗 (Modal) */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full animate-fade-in border border-slate-100">
                <div className="flex items-center mb-4 text-red-600">
                  <div className="bg-red-100 p-2 rounded-full mr-3">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-800">確認刪除</h3>
                </div>
                <p className="text-slate-600 mb-6 ml-1">{deleteModal.message}</p>
                <div className="flex justify-end space-x-3">
                    <button 
                      onClick={() => setDeleteModal({ ...deleteModal, show: false })} 
                      className="px-4 py-2 text-slate-500 hover:bg-slate-50 font-medium rounded-lg transition-colors"
                    >
                      取消
                    </button>
                    <button 
                      onClick={() => { 
                        if (deleteModal.onConfirm) deleteModal.onConfirm(); 
                        setDeleteModal({ ...deleteModal, show: false }); 
                      }} 
                      className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                    >
                      確認刪除
                    </button>
                </div>
            </div>
        </div>
      )}

      <style>{`
        .input-field {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          outline: none;
        }
        .input-field:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`
      flex flex-col md:flex-row items-center md:px-4 md:py-3 rounded-xl transition-all w-full
      ${active ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}
    `}
  >
    <div className="p-2 md:p-0 md:mr-3">{icon}</div>
    <span className="text-[10px] md:text-sm font-medium">{label}</span>
  </button>
);