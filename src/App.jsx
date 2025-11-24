import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, query, orderBy, getDocs, writeBatch } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { 
  LayoutDashboard, Wallet, TrendingUp, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, 
  Trash2, Plus, Save, Users, AlertCircle, LogIn, LogOut, Lock, ShieldAlert, Settings, X,
  LineChart as LineChartIcon, RefreshCw, DollarSign
} from 'lucide-react';

// --- Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyAXq_gDK2tr-g-Ak9H0_CBOQtO1PLhNKO8",
  authDomain: "investpartner-eec26.firebaseapp.com",
  projectId: "investpartner-eec26",
  storageBucket: "investpartner-eec26.firebasestorage.app",
  messagingSenderId: "877215963930",
  appId: "1:877215963930:web:e50cf7b8bdbf708d59eaa3",
  measurementId: "G-EWSHSTMNSD"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

// --- 【權限設定區域】 ---
const ADMIN_EMAIL = "m88215@gmail.com"; 

// 合夥人 Email 對應表
const INVESTOR_MAP = {
  "yi.990131@gmail.com": "Yi",
  "martinyu929@gmail.com": "Ma"
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

// --- 輔助函數 ---
const formatMoney = (amount) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(amount);
};

// 原幣格式化 (保留輔助函數，雖然市值改回台幣，但在其他地方可能未來會用到)
const formatOriginalMoney = (amount, isUS) => {
  return new Intl.NumberFormat(isUS ? 'en-US' : 'zh-TW', { 
    style: 'currency', 
    currency: isUS ? 'USD' : 'TWD', 
    maximumFractionDigits: isUS ? 2 : 0 
  }).format(amount);
};

const formatPercent = (value) => {
  return `${(value * 100).toFixed(2)}%`;
};

const formatDateShort = (dateStr) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [investors] = useState(['Yi', 'Ma']);
  
  const [user, setUser] = useState(null);
  const [allowedEmails, setAllowedEmails] = useState([]);
  
  const isAdmin = user && user.email === ADMIN_EMAIL;
  const isAllowed = user && (allowedEmails.includes(user.email) || isAdmin);
  
  const [funds, setFunds] = useState([]);
  const [trades, setTrades] = useState([]);
  const [marketPrices, setMarketPrices] = useState({});
  const [historyData, setHistoryData] = useState([]);

  const [deleteModal, setDeleteModal] = useState({ show: false, message: '', onConfirm: null });
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    document.title = "InvestPartner - 投資管理";
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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

  const secureMoney = (amount) => {
    if (!isAllowed) return "****";
    return formatMoney(amount);
  };

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
      if (doc.exists()) { setMarketPrices(doc.data()); }
    });

    const unsubAccess = onSnapshot(doc(db, "settings", "access"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAllowedEmails(data.emails || []);
      } else {
        setAllowedEmails([]);
      }
    });

    const qHistory = query(collection(db, "asset_history"), orderBy("timestamp", "asc"));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoryData(data);
    });

    return () => {
      unsubFunds();
      unsubTrades();
      unsubPrices();
      unsubAccess();
      unsubHistory();
    };
  }, []);

  // --- 權限管理 ---
  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!newEmail || !isAdmin) return;
    try {
      const docRef = doc(db, "settings", "access");
      await setDoc(docRef, { emails: arrayUnion(newEmail) }, { merge: true });
      setNewEmail('');
      alert(`已新增 ${newEmail} 到允許名單`);
    } catch (error) {
      console.error("Error updating access list:", error);
      alert("更新失敗");
    }
  };

  const handleRemoveEmail = async (emailToRemove) => {
    if (!isAdmin) return;
    if (!window.confirm(`確定要移除 ${emailToRemove} 的權限嗎？`)) return;
    try {
      const docRef = doc(db, "settings", "access");
      await updateDoc(docRef, { emails: arrayRemove(emailToRemove) });
    } catch (error) {
      console.error("Error removing email:", error);
    }
  };

  // --- 計算邏輯 ---
  
  // 1. 取得匯率
  const exchangeRate = marketPrices['USDTWD'] || 32.5;

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
      const isUS = /^[A-Z]+$/.test(t.ticker);
      const rate = isUS ? exchangeRate : 1;
      const totalAmountTWD = parseFloat(t.price) * parseFloat(t.qty) * rate;
      const totalAmountOriginal = parseFloat(t.price) * parseFloat(t.qty);

      if (t.type === 'BUY') {
        cashBalance -= totalAmountTWD;
        if (!holdings[t.ticker]) holdings[t.ticker] = { qty: 0, totalCostOriginal: 0, isUS };
        holdings[t.ticker].qty += parseFloat(t.qty);
        holdings[t.ticker].totalCostOriginal += totalAmountOriginal;
      } else {
        cashBalance += totalAmountTWD;
        if (holdings[t.ticker]) {
          const avgCost = holdings[t.ticker].totalCostOriginal / holdings[t.ticker].qty;
          holdings[t.ticker].qty -= parseFloat(t.qty);
          holdings[t.ticker].totalCostOriginal -= avgCost * parseFloat(t.qty);
        }
      }
    });

    let marketValue = 0;
    const holdingsList = Object.keys(holdings).map(ticker => {
      const data = holdings[ticker];
      if (data.qty <= 0) return null; 

      const isUS = data.isUS;
      const rate = isUS ? exchangeRate : 1;

      // 當前價格 (原幣)
      const currentPriceOriginal = marketPrices[ticker] || (data.totalCostOriginal / data.qty);
      
      // 當前市值 (原幣)
      const marketValueOriginal = data.qty * currentPriceOriginal;

      // 當前市值 (台幣)
      const currentValueTWD = marketValueOriginal * rate;
      marketValue += currentValueTWD;

      // 總成本 (台幣估算，用於計算未實現損益)
      const totalCostTWD = data.totalCostOriginal * rate;

      const avgCostOriginal = data.totalCostOriginal / data.qty;
      const unrealizedPL = currentValueTWD - totalCostTWD;
      const returnRate = (unrealizedPL / totalCostTWD);

      return {
        ticker,
        isUS,
        qty: data.qty,
        avgCostOriginal,
        currentPriceOriginal,
        marketValueOriginal, 
        currentValue: currentValueTWD, // 台幣市值
        unrealizedPL, // 台幣損益
        returnRate
      };
    }).filter(Boolean);

    return { cashBalance, marketValue, holdingsList };
  }, [trades, capitalStats.totalCapital, marketPrices, exchangeRate]);

  const totalAssets = portfolioStats.cashBalance + portfolioStats.marketValue;
  const totalPL = totalAssets - capitalStats.totalCapital;
  const totalROI = capitalStats.totalCapital > 0 ? (totalPL / capitalStats.totalCapital) : 0;

  const allocationData = useMemo(() => {
    const data = [
      { name: '現金 (TWD)', value: portfolioStats.cashBalance },
      ...portfolioStats.holdingsList.map(h => ({
        name: h.ticker,
        value: h.currentValue
      }))
    ];
    return data.filter(d => d.value > 0);
  }, [portfolioStats]);

  // --- 快照與歷史 ---
  const handleRecordHistory = async () => {
    if (!isAdmin) return;
    if (!window.confirm("確定要記錄當下的資產總值到歷史趨勢圖嗎？")) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const userValues = {};
      investors.forEach(inv => {
        const invested = capitalStats.investorContributions[inv] || 0;
        const ratio = capitalStats.totalCapital > 0 ? (invested / capitalStats.totalCapital) : 0;
        userValues[inv] = totalAssets * ratio;
      });

      await addDoc(collection(db, "asset_history"), {
        date: today,
        timestamp: Date.now(),
        total: totalAssets,
        ...userValues
      });
      alert("已成功記錄今日資產快照！");
    } catch (error) {
      console.error("Error recording history:", error);
      alert("記錄失敗");
    }
  };

  const handleClearHistory = async () => {
    if (!isAdmin) return;
    if (!window.confirm("警告：確定要清除「所有」歷史折線圖數據嗎？此操作無法復原。")) return;

    try {
      const querySnapshot = await getDocs(collection(db, "asset_history"));
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      alert("歷史數據已清空");
    } catch (error) {
      console.error("Error clearing history:", error);
      alert("清除失敗");
    }
  };

  // --- 視圖組件 ---

  const Dashboard = () => {
    const currentInvestorName = user ? INVESTOR_MAP[user.email] : null;
    const isSpecificInvestor = !isAdmin && currentInvestorName;

    let displayAssets = totalAssets;
    let displayCapital = capitalStats.totalCapital;
    let displayPL = totalPL;
    let displayROI = totalROI;
    let titlePrefix = "總";

    if (isSpecificInvestor) {
       const invested = capitalStats.investorContributions[currentInvestorName] || 0;
       const ratio = capitalStats.totalCapital > 0 ? (invested / capitalStats.totalCapital) : 0;
       
       displayAssets = totalAssets * ratio;
       displayCapital = invested;
       displayPL = displayAssets - displayCapital;
       displayROI = displayCapital > 0 ? (displayPL / displayCapital) : 0;
       titlePrefix = "我的";
    }

    return (
      <div className="space-y-6">
        {!user ? (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            <span>請登入以查看財務數據</span>
          </div>
        ) : !isAllowed ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center">
            <ShieldAlert className="w-5 h-5 mr-2" />
            <span>您的帳號 ({user.email}) 未在授權名單中。請聯繫管理員 ({ADMIN_EMAIL}) 開通權限。</span>
          </div>
        ) : null}

        {/* 顯示當前匯率提示 */}
        {isAllowed && (
          <div className="flex items-center justify-end text-xs text-slate-500">
            <DollarSign className="w-3 h-3 mr-1" />
            <span>美金參考匯率: <span className="font-bold text-slate-700">{exchangeRate}</span> TWD</span>
          </div>
        )}

        {isAdmin && (
          <div className="bg-slate-800 text-white p-4 rounded-xl shadow-lg space-y-6">
            <div>
              <div className="flex items-center mb-3">
                <Settings className="w-5 h-5 mr-2" />
                <h3 className="font-bold">成員權限管理</h3>
              </div>
              <div className="mb-4">
                <form onSubmit={handleAddEmail} className="flex gap-2">
                  <input 
                    type="email" 
                    placeholder="輸入合夥人 Email" 
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="flex-1 p-2 rounded text-slate-900 outline-none"
                    required
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold transition-colors">
                    新增
                  </button>
                </form>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-slate-400 mb-1">目前允許名單：</div>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-slate-700 px-3 py-1 rounded-full text-sm flex items-center border border-slate-600">
                    {ADMIN_EMAIL} (管理員)
                  </span>
                  {allowedEmails.map(email => (
                    <span key={email} className="bg-slate-700 px-3 py-1 rounded-full text-sm flex items-center border border-slate-600 group">
                      {email}
                      <button onClick={() => handleRemoveEmail(email)} className="ml-2 text-slate-400 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-600 my-4"></div>

            <div>
              <div className="flex items-center mb-3">
                <LineChartIcon className="w-5 h-5 mr-2" />
                <h3 className="font-bold">歷史趨勢圖管理</h3>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleRecordHistory}
                  className="flex-1 bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-bold transition-colors flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> 記錄今日快照
                </button>
                <button 
                  onClick={handleClearHistory}
                  className="flex-1 bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> 清除歷史數據
                </button>
              </div>
            </div>
          </div>
        )}
        
        {isAllowed && historyData.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center">
              <LineChartIcon className="w-5 h-5 mr-2" />
              資產成長趨勢
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDateShort} 
                    tick={{fontSize: 12, fill: '#94a3b8'}}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tickFormatter={(val) => `$${val/1000}k`}
                    tick={{fontSize: 12, fill: '#94a3b8'}}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    formatter={(value) => [formatMoney(value), "資產"]}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey={isSpecificInvestor ? currentInvestorName : "total"} 
                    name={isSpecificInvestor ? "我的資產" : "總資產"}
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="text-slate-500 text-sm font-medium mb-1">{titlePrefix}資產 (NAV)</div>
            <div className="text-3xl font-bold text-slate-800">{secureMoney(displayAssets)}</div>
            <div className="text-xs text-slate-400 mt-2">
              {isSpecificInvestor ? "依資金比例計算之權益" : "現金 + 股票市值 (台幣)"}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="text-slate-500 text-sm font-medium mb-1">{titlePrefix}投入本金</div>
            <div className="text-2xl font-bold text-slate-800">{secureMoney(displayCapital)}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="text-slate-500 text-sm font-medium mb-1">{titlePrefix}損益</div>
            <div className={`text-2xl font-bold ${!isAllowed ? 'text-slate-800' : (displayPL >= 0 ? 'text-green-600' : 'text-red-600')}`}>
              {isAllowed && (displayPL >= 0 ? '+' : '')}{secureMoney(displayPL)}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="text-slate-500 text-sm font-medium mb-1">投資報酬率 (ROI)</div>
            <div className={`text-2xl font-bold ${!isAllowed ? 'text-slate-800' : (displayROI >= 0 ? 'text-green-600' : 'text-red-600')}`}>
              {isAllowed && (displayROI >= 0 ? <ArrowUpRight className="inline w-6 h-6 mr-1" /> : <ArrowDownRight className="inline w-6 h-6 mr-1" />)}
              {isAllowed ? formatPercent(displayROI) : "****"}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
            <Users className="w-5 h-5 text-slate-500 mr-2" />
            <h3 className="font-bold text-slate-700">合夥人權益分配表</h3>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-100">
                    <th className="pb-3 font-medium whitespace-nowrap">投資人</th>
                    <th className="pb-3 font-medium whitespace-nowrap">投入本金</th>
                    <th className="pb-3 font-medium whitespace-nowrap">佔比</th>
                    <th className="pb-3 font-medium whitespace-nowrap">當前淨值</th>
                    <th className="pb-3 font-medium whitespace-nowrap">個人損益</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {investors.map(inv => {
                    const invested = capitalStats.investorContributions[inv] || 0;
                    const ratio = capitalStats.totalCapital > 0 ? (invested / capitalStats.totalCapital) : 0;
                    const currentValue = totalAssets * ratio;
                    const pl = currentValue - invested;
                    const isMe = inv === currentInvestorName;

                    return (
                      <tr key={inv} className={`border-b border-slate-50 last:border-0 transition-colors ${isMe ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                        <td className="py-4 font-medium text-slate-800 whitespace-nowrap flex items-center">
                          {inv}
                          {isMe && <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">ME</span>}
                        </td>
                        <td className="py-4 whitespace-nowrap">{secureMoney(invested)}</td>
                        <td className="py-4 text-slate-500 whitespace-nowrap">{isAllowed ? formatPercent(ratio) : "****"}</td>
                        <td className="py-4 font-bold text-blue-600 whitespace-nowrap">{secureMoney(currentValue)}</td>
                        <td className={`py-4 whitespace-nowrap ${!isAllowed ? 'text-slate-600' : (pl >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                          {isAllowed && (pl >= 0 ? '+' : '')}{secureMoney(pl)}
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
  };

  // ... 其餘 FundManager, TradeManager 維持不變 ...
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

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-700">入金紀錄</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 shadow-sm">
                  <tr className="text-slate-400 text-sm">
                    <th className="p-4 font-medium whitespace-nowrap">日期</th>
                    <th className="p-4 font-medium whitespace-nowrap">投資人</th>
                    <th className="p-4 font-medium text-right whitespace-nowrap">金額</th>
                    {isAdmin && <th className="p-4 font-medium w-16 text-center whitespace-nowrap">操作</th>}
                  </tr>
                </thead>
                <tbody className="text-slate-600 divide-y divide-slate-50">
                  {[...funds].sort((a,b) => new Date(b.date) - new Date(a.date)).map(f => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="p-4 text-sm whitespace-nowrap">{f.date}</td>
                      <td className="p-4 font-medium whitespace-nowrap">{f.investor}</td>
                      <td className="p-4 text-right font-mono text-slate-800 whitespace-nowrap">{secureMoney(f.amount)}</td>
                      {isAdmin && (
                        <td className="p-4 text-center whitespace-nowrap">
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

        <div className="lg:col-span-2">
           <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-700">交易歷史</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 shadow-sm">
                  <tr className="text-slate-400 text-sm">
                    <th className="p-4 font-medium whitespace-nowrap">日期</th>
                    <th className="p-4 font-medium whitespace-nowrap">代號</th>
                    <th className="p-4 font-medium whitespace-nowrap">類別</th>
                    <th className="p-4 font-medium text-right whitespace-nowrap">成交價</th>
                    <th className="p-4 font-medium text-right whitespace-nowrap">股數</th>
                    <th className="p-4 font-medium text-right whitespace-nowrap">總額</th>
                    {isAdmin && <th className="p-4 font-medium w-16 text-center whitespace-nowrap">操作</th>}
                  </tr>
                </thead>
                <tbody className="text-slate-600 divide-y divide-slate-50">
                  {[...trades].sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-4 text-sm whitespace-nowrap">{t.date}</td>
                      <td className="p-4 font-bold">{t.ticker}</td>
                      <td className="p-4 whitespace-nowrap"><span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'BUY' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{t.type === 'BUY' ? '買入' : '賣出'}</span></td>
                      <td className="p-4 text-right whitespace-nowrap">{t.price}</td>
                      <td className="p-4 text-right whitespace-nowrap">{t.qty}</td>
                      <td className="p-4 text-right font-mono text-slate-800 whitespace-nowrap">{secureMoney(t.price * t.qty)}</td>
                      {isAdmin && (
                        <td className="p-4 text-center whitespace-nowrap"><button onClick={() => handleDelete(t.id)} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-red-100"><Trash2 className="w-4 h-4" /></button></td>
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
        {isAllowed && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
             <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center">
               <PieChartIcon className="w-5 h-5 mr-2" />
               資產配置分析 (台幣計價)
             </h3>
             <div className="h-[300px] w-full flex items-center justify-center">
                {allocationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400">目前無資產數據</p>
                )}
             </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800">持倉損益表 (自動匯率換算)</h3>
              <p className="text-slate-500 text-sm">顯示金額皆已換算為台幣 (美股依代號自動判斷)</p>
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
                  <th className="pb-3 font-medium pl-4 whitespace-nowrap">代號</th>
                  <th className="pb-3 font-medium text-right whitespace-nowrap">持有股數</th>
                  <th className="pb-3 font-medium text-right whitespace-nowrap">幣別</th>
                  <th className="pb-3 font-medium text-right w-40 whitespace-nowrap">現價(原幣) {isAdmin ? '(可編輯)' : ''}</th>
                  <th className="pb-3 font-medium text-right whitespace-nowrap">市值(TWD)</th>
                  <th className="pb-3 font-medium text-right whitespace-nowrap">未實現損益(TWD)</th>
                  <th className="pb-3 font-medium text-right pr-4 whitespace-nowrap">報酬率</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 divide-y divide-slate-50">
                {portfolioStats.holdingsList.map(item => (
                  <tr key={item.ticker} className="hover:bg-slate-50">
                    <td className="py-4 pl-4 font-bold text-slate-800 whitespace-nowrap">{item.ticker}</td>
                    <td className="py-4 text-right whitespace-nowrap">{item.qty}</td>
                    <td className="py-4 text-right text-xs text-slate-500 whitespace-nowrap">
                      {item.isUS ? <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">USD</span> : <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">TWD</span>}
                    </td>
                    <td className="py-4 text-right whitespace-nowrap">
                       <input 
                        type="number" 
                        step="0.1"
                        disabled={!isAdmin}
                        value={priceInputs[item.ticker] || ''} 
                        onChange={e => handlePriceChange(item.ticker, e.target.value)}
                        placeholder={item.avgCostOriginal.toFixed(1)}
                        className={`input-field w-24 text-right ${isAdmin ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                      />
                    </td>
                    {/* 修改：改回顯示台幣市值 */}
                    <td className="py-4 text-right font-medium text-slate-800 whitespace-nowrap">
                      {secureMoney(item.currentValue)}
                    </td>
                    {/* 未實現損益 (TWD) */}
                    <td className={`py-4 text-right font-medium whitespace-nowrap ${!isAllowed ? 'text-slate-600' : (item.unrealizedPL >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                      {isAllowed && (item.unrealizedPL >= 0 ? '+' : '')}{secureMoney(item.unrealizedPL)}
                    </td>
                    <td className={`py-4 text-right pr-4 font-bold whitespace-nowrap ${!isAllowed ? 'text-slate-600' : (item.returnRate >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                      {isAllowed ? formatPercent(item.returnRate) : "****"}
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
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 md:w-64 md:h-full md:border-t-0 md:border-r md:left-0 z-50 flex md:flex-col justify-between md:justify-start pb-2 md:pb-0">
        <div className="hidden md:flex items-center p-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 text-lg">$</div>
          <span className="text-xl font-bold text-slate-800">InvestPartner</span>
        </div>
        
        <div className="flex-1 flex md:flex-col justify-around md:justify-start md:p-4 md:space-y-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="總覽儀表板" />
          <NavButton active={activeTab === 'funds'} onClick={() => setActiveTab('funds')} icon={<Wallet />} label="資金管理" />
          <NavButton active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} icon={<TrendingUp />} label="交易紀錄" />
          <NavButton active={activeTab === 'portfolio'} onClick={() => setActiveTab('portfolio')} icon={<PieChartIcon />} label="持倉與市價" />
        </div>

        <div className="hidden md:block p-4 border-t border-slate-100">
          {user ? (
             <div className="space-y-3">
               <div className="flex items-center text-xs text-slate-500">
                 <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mr-2">
                   {user.displayName?.[0] || 'U'}
                 </div>
                 <div className="truncate max-w-[120px]">{user.displayName || '已登入'}</div>
               </div>
               {isAdmin ? (
                 <div className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded w-fit">管理員權限</div>
               ) : !isAllowed ? (
                 <div className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded w-fit">訪客權限 (無數據)</div>
               ) : (
                 <div className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded w-fit">合夥人權限</div>
               )}
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

      {/* 手機版登入按鈕 */}
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