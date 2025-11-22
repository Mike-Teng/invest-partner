import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
// 新增 Authentication 相關模組
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
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
  AlertCircle,
  LogIn,
  LogOut,
  Lock
} from 'lucide-react';

// --- Firebase 設定 ---
const firebaseConfig = {
  apiKey: "請替換您的apiKey",
  authDomain: "請替換您的authDomain",
  projectId: "請替換您的projectId",
  storageBucket: "請替換您的storageBucket",
  messagingSenderId: "請替換您的messagingSenderId",
  appId: "請替換您的appId"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // 初始化 Auth

// --- 【重要設定】請在此輸入您的管理員 Email ---
// 只有這個 Email 登入後，才能看到「新增」與「刪除」按鈕
const ADMIN_EMAIL = "m88215@gmail.com"; 

// --- 輔助函數 ---
const formatMoney = (amount) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(amount);
};

const formatPercent = (value) => {
  return `${(value * 100).toFixed(2)}%`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [investors] = useState(['Yi', 'Ma']);
  
  // 使用者狀態
  const [user, setUser] = useState(null);
  // 是否為管理員 (只有您能寫入)
  const isAdmin = user && user.email === ADMIN_EMAIL;
  
  const [funds, setFunds] = useState([]);
  const [trades, setTrades] = useState([]);
  const [marketPrices, setMarketPrices] = useState({}); 

  const [deleteModal, setDeleteModal] = useState({ show: false, message: '', onConfirm: null });

  useEffect(() => {
    document.title = "InvestPartner - 投資管理";
  }, []);

  // --- 監聽登入狀態 ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // --- 登入與登出函式 ---
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("登入失敗");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // --- 安全顯示金額輔助函式 ---
  // 如果未登入，顯示隱藏符號
  const secureMoney = (amount) => {
    if (!user) return "****";
    return formatMoney(amount);
  };

  // --- Firebase 監聽資料 ---
  useEffect(() => {
    const unsubFunds = onSnapshot(collection(db, "funds"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFunds(data);
    });

    const unsubTrades = onSnapshot(collection(db, "trades"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrades(data);
    });

    const unsubPrices = onSnapshot(doc(db, "settings", "market_prices"), (doc) => {
      if (doc.exists()) {
        setMarketPrices(doc.data());
      }
    });

    return () => {
      unsubFunds();
      unsubTrades();
      unsubPrices();
    };
  }, []);

  // --- 計算邏輯 ---
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

  const totalAssets = portfolioStats.cashBalance + portfolioStats.marketValue;
  const totalPL = totalAssets - capitalStats.totalCapital;
  const totalROI = capitalStats.totalCapital > 0 ? (totalPL / capitalStats.totalCapital) : 0;

  // --- 視圖組件 ---

  const Dashboard = () => (
    <div className="space-y-6">
      {!user && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl flex items-center">
          <Lock className="w-5 h-5 mr-2" />
          <span>請登入以查看財務數據</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">總資產 (NAV)</div>
          <div className="text-3xl font-bold text-slate-800">{secureMoney(totalAssets)}</div>
          <div className="text-xs text-slate-400 mt-2">現金 + 股票市值</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">總投入本金</div>
          <div className="text-2xl font-bold text-slate-800">{secureMoney(capitalStats.totalCapital)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">總損益</div>
          <div className={`text-2xl font-bold ${!user ? 'text-slate-800' : (totalPL >= 0 ? 'text-green-600' : 'text-red-600')}`}>
            {user && (totalPL >= 0 ? '+' : '')}{secureMoney(totalPL)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-sm font-medium mb-1">投資報酬率 (ROI)</div>
          <div className={`text-2xl font-bold ${!user ? 'text-slate-800' : (totalROI >= 0 ? 'text-green-600' : 'text-red-600')}`}>
            {user && (totalROI >= 0 ? <ArrowUpRight className="inline w-6 h-6 mr-1" /> : <ArrowDownRight className="inline w-6 h-6 mr-1" />)}
            {user ? formatPercent(totalROI) : "****"}
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
                      <td className="py-4">{secureMoney(invested)}</td>
                      <td className="py-4 text-slate-500">{user ? formatPercent(ratio) : "****"}</td>
                      <td className="py-4 font-bold text-blue-600">{secureMoney(currentValue)}</td>
                      <td className={`py-4 ${!user ? 'text-slate-600' : (pl >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                        {user && (pl >= 0 ? '+' : '')}{secureMoney(pl)}
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

    const handleAddFund = async (e) => {
      e.preventDefault();
      if (!amount || parseFloat(amount) <= 0) return;
      try {
        await addDoc(collection(db, "funds"), {
          date,
          investor,
          amount: parseFloat(amount),
          createdAt: Date.now()
        });
        setAmount('');
      } catch (error) {
        console.error("Error adding document: ", error);
        alert("寫入失敗");
      }
    };

    const handleDelete = (id) => {
      setDeleteModal({
        show: true,
        message: '確定要刪除這筆資金紀錄嗎？',
        onConfirm: async () => {
          try {
            await deleteDoc(doc(db, "funds", id));
          } catch (error) {
            console.error("Error deleting document: ", error);
          }
        }
      });
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 新增資金表單 - 只有管理員看得到 */}
        {isAdmin ? (
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                <Plus className="w-5 h-5 mr-2" /> 注入資金
              </h3>
              <form onSubmit={handleAddFund} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">日期</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">資金來源</label>
                  <select value={investor} onChange={e => setInvestor(e.target.value)} className="input-field">
                    {investors.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">金額 (TWD)</label>
                  <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="input-field" />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">確認入金</button>
              </form>
            </div>
          </div>
        ) : (
           <div className="lg:col-span-1">
             <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-slate-500">
               <Lock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
               <p>僅管理員可新增資金</p>
             </div>
           </div>
        )}

        {/* 資金列表 */}
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
                    {isAdmin && <th className="p-4 font-medium w-16 text-center">操作</th>}
                  </tr>
                </thead>
                <tbody className="text-slate-600 divide-y divide-slate-50">
                  {[...funds].sort((a,b) => new Date(b.date) - new Date(a.date)).map(f => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="p-4 text-sm">{f.date}</td>
                      <td className="p-4 font-medium">{f.investor}</td>
                      <td className="p-4 text-right font-mono text-slate-800">{secureMoney(f.amount)}</td>
                      {isAdmin && (
                        <td className="p-4 text-center">
                          <button onClick={() => handleDelete(f.id)} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {funds.length === 0 && (
                    <tr><td colSpan={isAdmin ? 4 : 3} className="p-8 text-center text-slate-400">目前無紀錄</td></tr>
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

    const handleAddTrade = async (e) => {
      e.preventDefault();
      if (!ticker || !price || !qty) return;
      try {
        await addDoc(collection(db, "trades"), {
          date,
          ticker: ticker.toUpperCase(),
          type,
          price: parseFloat(price),
          qty: parseFloat(qty),
          createdAt: Date.now()
        });
        setTicker(''); setPrice(''); setQty('');
      } catch (error) {
        console.error("Error adding trade: ", error);
      }
    };

    const handleDelete = (id) => {
       setDeleteModal({
        show: true,
        message: '確定要刪除這筆交易紀錄嗎？',
        onConfirm: async () => {
          try {
            await deleteDoc(doc(db, "trades", id));
          } catch (error) {
            console.error("Error deleting trade: ", error);
          }
        }
      });
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 新增交易表單 - 只有管理員看得到 */}
        {isAdmin ? (
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" /> 紀錄交易
              </h3>
              <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 flex justify-between">
                <span>可用現金餘額:</span>
                <span className="font-bold text-slate-800">{secureMoney(portfolioStats.cashBalance)}</span>
              </div>
              <form onSubmit={handleAddTrade} className="space-y-4">
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setType('BUY')} className={`flex-1 py-2 rounded-lg font-bold ${type === 'BUY' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>買入</button>
                  <button type="button" onClick={() => setType('SELL')} className={`flex-1 py-2 rounded-lg font-bold ${type === 'SELL' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'}`}>賣出</button>
                </div>
                <div><label className="block text-sm text-slate-600 mb-1">日期</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" /></div>
                <div><label className="block text-sm text-slate-600 mb-1">代號</label><input type="text" value={ticker} onChange={e => setTicker(e.target.value)} className="input-field uppercase" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-sm text-slate-600 mb-1">價格</label><input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="input-field" /></div>
                  <div><label className="block text-sm text-slate-600 mb-1">股數</label><input type="number" step="1" value={qty} onChange={e => setQty(e.target.value)} className="input-field" /></div>
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg">新增紀錄</button>
              </form>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-1">
             <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-slate-500">
               <Lock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
               <p>僅管理員可新增交易</p>
             </div>
           </div>
        )}

        {/* 交易列表 */}
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
                    {isAdmin && <th className="p-4 font-medium w-16 text-center">操作</th>}
                  </tr>
                </thead>
                <tbody className="text-slate-600 divide-y divide-slate-50">
                  {[...trades].sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-4 text-sm">{t.date}</td>
                      <td className="p-4 font-bold">{t.ticker}</td>
                      <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'BUY' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{t.type === 'BUY' ? '買入' : '賣出'}</span></td>
                      <td className="p-4 text-right">{t.price}</td>
                      <td className="p-4 text-right">{t.qty}</td>
                      <td className="p-4 text-right font-mono text-slate-800">{secureMoney(t.price * t.qty)}</td>
                      {isAdmin && (
                        <td className="p-4 text-center"><button onClick={() => handleDelete(t.id)} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-red-100"><Trash2 className="w-4 h-4" /></button></td>
                      )}
                    </tr>
                  ))}
                  {trades.length === 0 && (
                     <tr><td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-slate-400">目前無紀錄</td></tr>
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

    const savePrices = async () => {
      const newPrices = { ...marketPrices };
      Object.keys(priceInputs).forEach(k => {
        if(priceInputs[k]) newPrices[k] = parseFloat(priceInputs[k]);
      });
      
      try {
        await setDoc(doc(db, "settings", "market_prices"), newPrices);
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 2000);
      } catch (error) {
        console.error("Error saving prices: ", error);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800">持倉損益表</h3>
              <p className="text-slate-500 text-sm">請手動更新「現價」欄位以獲得最新損益報告</p>
            </div>
            {isAdmin && (
              <button 
                onClick={savePrices}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-300 ${savedMsg ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
              >
                {savedMsg ? <span className="flex items-center">已同步!</span> : <><Save className="w-4 h-4 mr-2" /> 更新並同步市價</>}
              </button>
            )}
           </div>

           <div className="overflow-x-auto">
             <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-sm border-b border-slate-100">
                  <th className="pb-3 font-medium pl-4">代號</th>
                  <th className="pb-3 font-medium text-right">持有股數</th>
                  <th className="pb-3 font-medium text-right">平均成本</th>
                  <th className="pb-3 font-medium text-right w-40">現價 {isAdmin ? '(可編輯)' : ''}</th>
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
                        disabled={!isAdmin}
                        value={priceInputs[item.ticker] || ''} 
                        onChange={e => handlePriceChange(item.ticker, e.target.value)}
                        placeholder={item.avgCost.toFixed(1)}
                        className={`input-field w-24 text-right ${isAdmin ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                      />
                    </td>
                    <td className="py-4 text-right font-medium text-slate-800">{secureMoney(item.currentValue)}</td>
                    <td className={`py-4 text-right font-medium ${!user ? 'text-slate-600' : (item.unrealizedPL >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                      {user && (item.unrealizedPL >= 0 ? '+' : '')}{secureMoney(item.unrealizedPL)}
                    </td>
                    <td className={`py-4 text-right pr-4 font-bold ${!user ? 'text-slate-600' : (item.returnRate >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                      {user ? formatPercent(item.returnRate) : "****"}
                    </td>
                  </tr>
                ))}
                {portfolioStats.holdingsList.length === 0 && (
                   <tr><td colSpan="7" className="p-8 text-center text-slate-400">目前無持倉</td></tr>
                )}
              </tbody>
             </table>
           </div>
        </div>
      </div>
    );
  };

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

        {/* 1. 移除了「本地儲存」文字，改為登入區塊 */}
        <div className="hidden md:block p-4 border-t border-slate-100">
          {user ? (
             <div className="space-y-3">
               <div className="flex items-center text-xs text-slate-500">
                 <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mr-2">
                   {user.displayName?.[0] || 'U'}
                 </div>
                 <div className="truncate max-w-[120px]">{user.displayName || '已登入'}</div>
               </div>
               {isAdmin && <div className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded w-fit">管理員權限</div>}
               <button onClick={handleLogout} className="flex items-center text-xs text-red-500 hover:text-red-700 font-medium">
                 <LogOut className="w-3 h-3 mr-1" /> 登出
               </button>
             </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-bold transition-colors"
            >
              <LogIn className="w-3 h-3 mr-2" /> Google 登入
            </button>
          )}
        </div>
      </nav>

      {/* 手機版登入按鈕 (顯示在右上角) */}
      <div className="md:hidden fixed top-4 right-4 z-[60]">
         {user ? (
            <button onClick={handleLogout} className="bg-white p-2 rounded-full shadow-md text-slate-600"><LogOut className="w-5 h-5" /></button>
         ) : (
            <button onClick={handleLogin} className="bg-slate-800 p-2 rounded-full shadow-md text-white"><LogIn className="w-5 h-5" /></button>
         )}
      </div>

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
                    <button onClick={() => setDeleteModal({ ...deleteModal, show: false })} className="px-4 py-2 text-slate-500 hover:bg-slate-50 font-medium rounded-lg">取消</button>
                    <button onClick={() => { if (deleteModal.onConfirm) deleteModal.onConfirm(); setDeleteModal({ ...deleteModal, show: false }); }} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-lg shadow-red-200">確認刪除</button>
                </div>
            </div>
        </div>
      )}
      <style>{`
        .input-field { width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; outline: none; }
        .input-field:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
        @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col md:flex-row items-center md:px-4 md:py-3 rounded-xl transition-all w-full ${active ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
    <div className="p-2 md:p-0 md:mr-3">{icon}</div>
    <span className="text-[10px] md:text-sm font-medium">{label}</span>
  </button>
);