import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, query, orderBy, getDocs, writeBatch } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { 
  LayoutDashboard, Wallet, TrendingUp, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, 
  Trash2, Plus, Save, Users, AlertCircle, LogIn, LogOut, Lock, ShieldAlert, Settings, X,
  LineChart as LineChartIcon, RefreshCw, DollarSign, Activity, Calendar,
  Landmark, PiggyBank, Coins, Percent, Pencil 
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
  "aa1234567aa88@gmail.com": "Ma"
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

// --- 輔助函數 ---
const safeNumber = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

const formatMoney = (amount) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(safeNumber(amount));
};

const formatOriginalMoney = (amount, isUS) => {
  return new Intl.NumberFormat(isUS ? 'en-US' : 'zh-TW', { 
    style: 'currency', 
    currency: isUS ? 'USD' : 'TWD', 
    maximumFractionDigits: isUS ? 2 : 0 
  }).format(safeNumber(amount));
};

const formatUnit = (unit) => {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(safeNumber(unit));
};

const formatPercent = (value) => {
  return `${(safeNumber(value) * 100).toFixed(2)}%`;
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

// UI 組件：載入骨架
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`}></div>
);

// UI 組件：標準卡片
const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-100 shadow-sm rounded-xl ${className}`}>
    {children}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [investors] = useState(['Yi', 'Ma']);
  
  const [user, setUser] = useState(null);
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const isAdmin = user && user.email === ADMIN_EMAIL;
  const isAllowed = user && (allowedEmails.includes(user?.email) || isAdmin);
  
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
    if (isLoading) return <Skeleton className="h-6 w-24 inline-block" />;
    if (!isAllowed) return "****";
    return formatMoney(amount);
  };

  useEffect(() => {
    setIsLoading(true);
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
      setIsLoading(false);
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
  const exchangeRate = safeNumber(marketPrices['USDTWD']) || 32.5;

  const capitalStats = useMemo(() => {
    let totalCapital = 0;
    const investorContributions = {};
    investors.forEach(inv => investorContributions[inv] = 0);

    funds.forEach(f => {
      if (investorContributions[f.investor] !== undefined) {
        totalCapital += safeNumber(f.amount);
        investorContributions[f.investor] += safeNumber(f.amount);
      }
    });

    return { totalCapital, investorContributions };
  }, [funds, investors]);

  const portfolioStats = useMemo(() => {
    let cashBalance = capitalStats.totalCapital;
    const holdings = {}; 

    // 先依照日期排序交易紀錄
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTrades.forEach(t => {
      const isUS = /^[A-Z]+$/.test(t.ticker);
      const rate = isUS ? exchangeRate : 1;
      const price = safeNumber(t.price);
      const qty = safeNumber(t.qty);
      const totalAmountTWD = price * qty * rate;
      const totalAmountOriginal = price * qty;

      if (t.type === 'BUY') {
        cashBalance -= totalAmountTWD;
        if (!holdings[t.ticker]) holdings[t.ticker] = { qty: 0, totalCostOriginal: 0, isUS };
        holdings[t.ticker].qty += qty;
        holdings[t.ticker].totalCostOriginal += totalAmountOriginal;
      } else {
        cashBalance += totalAmountTWD;
        if (holdings[t.ticker]) {
          const avgCost = holdings[t.ticker].totalCostOriginal / (holdings[t.ticker].qty || 1);
          holdings[t.ticker].qty -= qty;
          holdings[t.ticker].totalCostOriginal -= avgCost * qty;
        }
      }
    });

    let marketValue = 0;
    const holdingsList = Object.keys(holdings).map(ticker => {
      const data = holdings[ticker];
      if (data.qty <= 0) return null; 

      const isUS = data.isUS;
      const rate = isUS ? exchangeRate : 1;
      
      const currentPriceOriginal = safeNumber(marketPrices[ticker]) || (data.totalCostOriginal / (data.qty || 1));
      
      const marketValueOriginal = data.qty * currentPriceOriginal;
      const currentValueTWD = marketValueOriginal * rate;
      marketValue += currentValueTWD;
      
      const totalCostTWD = data.totalCostOriginal * rate;
      const avgCostOriginal = data.totalCostOriginal / (data.qty || 1);
      const unrealizedPL = currentValueTWD - totalCostTWD;
      const returnRate = totalCostTWD > 0 ? (unrealizedPL / totalCostTWD) : 0;

      return {
        ticker,
        isUS,
        qty: data.qty,
        avgCostOriginal,
        currentPriceOriginal,
        marketValueOriginal,
        currentValue: currentValueTWD,
        unrealizedPL,
        returnRate
      };
    }).filter(Boolean);

    return { cashBalance, marketValue, holdingsList };
  }, [trades, capitalStats.totalCapital, marketPrices, exchangeRate]);

  // --- 2. 基金單位會計系統 (含手動修正支援) ---
  const unitStats = useMemo(() => {
    let totalInvestedCash = 0;
    let totalUnitsIssued = 0;
    const investorData = {};
    investors.forEach(inv => investorData[inv] = { invested: 0, units: 0 });

    const sortedFunds = [...funds].sort((a, b) => new Date(a.date) - new Date(b.date));
    const enrichedFunds = []; 

    sortedFunds.forEach(f => {
      const amt = safeNumber(f.amount);
      const inv = f.investor;
      let units = safeNumber(f.units);
      let calculatedBuyPrice = safeNumber(f.buyPrice);

      // 如果資料庫中沒有 units 欄位，且也沒有手動記錄過 buyPrice
      if (units <= 0 && calculatedBuyPrice <= 0) {
         // 嘗試回溯歷史快照
         const prevHistory = historyData
            .filter(h => h.date < f.date) 
            .pop();

         if (prevHistory) {
             let unitsAtSnapshot = 0;
             enrichedFunds.forEach(ef => {
                 if (ef.date <= prevHistory.date) {
                     unitsAtSnapshot += ef.units;
                 }
             });

             if (unitsAtSnapshot > 0) {
                 const navAtTime = prevHistory.total / unitsAtSnapshot;
                 calculatedBuyPrice = navAtTime;
                 units = amt / navAtTime;
             } else {
                 calculatedBuyPrice = 10;
                 units = amt / 10;
             }
         } else {
             calculatedBuyPrice = 10;
             units = amt / 10;
         }
      } else {
          // 如果有記錄單位數或價格，依照紀錄計算
          if (calculatedBuyPrice > 0 && units <= 0) {
              units = amt / calculatedBuyPrice;
          } else if (units > 0 && calculatedBuyPrice <= 0) {
              calculatedBuyPrice = amt / units;
          }
      }

      if (investorData[inv]) {
        investorData[inv].invested += amt;
        investorData[inv].units += units;
      }
      totalInvestedCash += amt;
      totalUnitsIssued += units;

      enrichedFunds.push({
          ...f,
          units, 
          buyPrice: calculatedBuyPrice
      });
    });

    const cashBalance = totalInvestedCash + portfolioStats.tradeCashFlow; // 這邊變數僅供內部參考
    const totalAssets = portfolioStats.cashBalance + portfolioStats.marketValue;
    const currentUnitPrice = totalUnitsIssued > 0 ? (totalAssets / totalUnitsIssued) : 10;

    return { 
      totalInvestedCash, 
      totalUnitsIssued, 
      investorData, 
      cashBalance, 
      totalAssets,
      currentUnitPrice,
      enrichedFunds
    };
  }, [funds, investors, portfolioStats, historyData]);


  const allocationData = useMemo(() => {
    const data = [
      { name: '現金 (TWD)', value: safeNumber(unitStats.totalAssets) - safeNumber(portfolioStats.marketValue) },
      ...portfolioStats.holdingsList.map(h => ({
        name: h.ticker,
        value: h.currentValue
      }))
    ];
    return data.filter(d => d.value > 0);
  }, [unitStats, portfolioStats]);

  // --- 操作功能 ---
  const handleRecordHistory = async () => {
    if (!isAdmin) return;
    if (!window.confirm("確定要記錄當下的資產總值到歷史趨勢圖嗎？")) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const userValues = {};
      investors.forEach(inv => {
        const units = unitStats.investorData[inv]?.units || 0;
        userValues[inv] = units * unitStats.currentUnitPrice;
      });

      await addDoc(collection(db, "asset_history"), {
        date: today,
        timestamp: Date.now(),
        total: unitStats.totalAssets,
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

  // --- Sub-components ---

  const Dashboard = () => {
    const currentInvestorName = user ? INVESTOR_MAP[user.email] : null;
    const isSpecificInvestor = !isAdmin && currentInvestorName;

    let displayAssets = unitStats.totalAssets;
    let displayCapital = unitStats.totalInvestedCash;
    let titlePrefix = "總";

    if (isSpecificInvestor) {
      const myData = unitStats.investorData[currentInvestorName];
      displayAssets = (myData?.units || 0) * unitStats.currentUnitPrice;
      displayCapital = myData?.invested || 0;
      titlePrefix = "我的";
    }

    const displayPL = displayAssets - displayCapital;
    const displayROI = displayCapital > 0 ? (displayPL / displayCapital) : 0;

    return (
      <div className="space-y-6">
        {!user ? (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-xl flex items-center shadow-sm">
            <Lock className="w-5 h-5 mr-3" />
            <span className="font-medium">請登入以查看財務數據</span>
          </div>
        ) : !isAllowed ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-center shadow-sm">
            <ShieldAlert className="w-5 h-5 mr-3" />
            <span>您的帳號 ({user.email}) 未在授權名單中。請聯繫管理員 ({ADMIN_EMAIL}) 開通權限。</span>
          </div>
        ) : null}

        {isAllowed && (
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
             <div className="flex items-center">
               <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded mr-2">單位淨值法</span>
               <span>當前淨值: <span className="font-bold text-slate-800">{formatMoney(unitStats.currentUnitPrice)}</span></span>
             </div>
             <div className="flex items-center">
               <DollarSign className="w-3 h-3 mr-1" />
               <span>美金參考匯率: <span className="text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm ml-1">{exchangeRate}</span> TWD</span>
             </div>
          </div>
        )}

        {/* 1. 資產趨勢折線圖 */}
        {isAllowed && historyData.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3 text-blue-600">
                <LineChartIcon className="w-5 h-5" />
              </div>
              資產成長趨勢
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDateShort} 
                    tick={{fontSize: 12, fill: '#64748b'}}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    tickFormatter={(val) => `$${val/1000}k`}
                    tick={{fontSize: 12, fill: '#64748b'}}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [formatMoney(value), "資產"]}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={isSpecificInvestor ? currentInvestorName : "total"} 
                    name={isSpecificInvestor ? "我的資產" : "總資產"}
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* 2. 歷史趨勢圖管理 */}
        {isAdmin && (
          <Card className="p-4 bg-white text-slate-800 border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center">
                <LineChartIcon className="w-5 h-5 mr-2 text-green-600" />
                <h3 className="font-bold text-slate-800">歷史趨勢圖管理</h3>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button 
                  onClick={handleRecordHistory}
                  className="flex-1 md:flex-none bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-xl font-bold transition-all flex items-center justify-center text-sm"
                >
                  <Plus className="w-4 h-4 mr-2" /> 記錄今日快照
                </button>
                <button 
                  onClick={handleClearHistory}
                  className="flex-1 md:flex-none bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-xl font-bold transition-all flex items-center justify-center text-sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> 清除數據
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* 3. 儀表板卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Landmark className="w-24 h-24 text-blue-600 transform translate-x-4 -translate-y-4" />
            </div>
            <div className="text-slate-500 text-sm font-medium mb-1 relative z-10">{titlePrefix}資產 (NAV)</div>
            <div className="text-3xl font-bold text-slate-800 relative z-10">{secureMoney(displayAssets)}</div>
            <div className="text-xs text-slate-400 mt-2 relative z-10">
              {isSpecificInvestor ? "依份額比例計算之權益" : "現金 + 股票市值 (台幣)"}
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <PiggyBank className="w-24 h-24 text-indigo-600 transform translate-x-4 -translate-y-4" />
            </div>
            <div className="text-slate-500 text-sm font-medium mb-1 relative z-10">{titlePrefix}投入本金</div>
            <div className="text-2xl font-bold text-slate-800 relative z-10">{secureMoney(displayCapital)}</div>
          </Card>

          <Card className="p-6 relative overflow-hidden group">
            <div className={`absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${displayPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <Coins className="w-24 h-24 transform translate-x-4 -translate-y-4" />
            </div>
            <div className="text-slate-500 text-sm font-medium mb-1 relative z-10">{titlePrefix}損益</div>
            <div className={`text-2xl font-bold relative z-10 ${!isAllowed ? 'text-slate-800' : (displayPL >= 0 ? 'text-green-600' : 'text-red-600')}`}>
              {isAllowed && (displayPL >= 0 ? '+' : '')}{secureMoney(displayPL)}
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden group">
            <div className={`absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${displayROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <Percent className="w-24 h-24 transform translate-x-4 -translate-y-4" />
            </div>
            <div className="text-slate-500 text-sm font-medium mb-1 relative z-10">投資報酬率 (ROI)</div>
            <div className={`text-2xl font-bold relative z-10 ${!isAllowed ? 'text-slate-800' : (displayROI >= 0 ? 'text-green-600' : 'text-red-600')}`}>
              {isAllowed ? formatPercent(displayROI) : "****"}
            </div>
          </Card>
        </div>

        {/* 4. 合夥人權益分配表 */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
            <Users className="w-5 h-5 text-slate-500 mr-2" />
            <h3 className="font-bold text-slate-700">合夥人權益分配表</h3>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-100">
                    <th className="pb-3 font-medium whitespace-nowrap pl-2">投資人</th>
                    <th className="pb-3 font-medium whitespace-nowrap">投入本金</th>
                    {/* 新增平均成本欄位 */}
                    <th className="pb-3 font-medium whitespace-nowrap">平均成本</th>
                    <th className="pb-3 font-medium whitespace-nowrap">持有單位</th>
                    <th className="pb-3 font-medium whitespace-nowrap">當前淨值</th>
                    <th className="pb-3 font-medium whitespace-nowrap pr-2">個人損益</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {investors.map(inv => {
                    const data = unitStats.investorData[inv];
                    const units = data.units;
                    const val = units * unitStats.currentUnitPrice;
                    const pl = val - data.invested;
                    // 計算平均成本 (投入本金 / 單位數)
                    const avgCost = units > 0 ? (data.invested / units) : 0;
                    const isMe = inv === currentInvestorName;

                    return (
                      <tr key={inv} className={`border-b border-slate-50 last:border-0 transition-all ${isMe ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <td className="py-4 font-medium text-slate-800 whitespace-nowrap flex items-center pl-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 text-xs font-bold ${isMe ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {inv.charAt(0)}
                          </div>
                          {inv}
                        </td>
                        <td className="py-4 whitespace-nowrap">{secureMoney(data.invested)}</td>
                        <td className="py-4 font-mono text-slate-500 whitespace-nowrap">
                           {isAllowed ? formatMoney(avgCost) : "**"}
                        </td>
                        <td className="py-4 font-mono text-slate-500 whitespace-nowrap">
                           {isAllowed ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(units) : "**"}
                        </td>
                        <td className="py-4 font-bold text-blue-600 whitespace-nowrap">{secureMoney(val)}</td>
                        <td className={`py-4 whitespace-nowrap pr-2 font-medium ${!isAllowed ? 'text-slate-600' : (pl >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                          {isAllowed && (pl >= 0 ? '+' : '')}{secureMoney(pl)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* 5. 成員權限管理 */}
        {isAdmin && (
          <Card className="p-6 bg-white text-slate-800 border-slate-100">
            <div>
              <div className="flex items-center mb-4">
                <Settings className="w-5 h-5 mr-2 text-blue-600" />
                <h3 className="font-bold text-slate-800">成員權限管理</h3>
              </div>
              <div className="mb-4">
                <form onSubmit={handleAddEmail} className="flex gap-2">
                  <input 
                    type="email" 
                    placeholder="輸入合夥人 Email" 
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl text-slate-900 outline-none border-2 border-slate-200 focus:border-blue-500 transition-all"
                    required
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95">
                    新增
                  </button>
                </form>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-slate-400 mb-1">目前允許名單：</div>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm flex items-center border border-slate-200 text-slate-700">
                    {ADMIN_EMAIL} (管理員)
                  </span>
                  {allowedEmails.map(email => (
                    <span key={email} className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm flex items-center border border-slate-200 group text-slate-700 hover:border-red-200 hover:bg-red-50 transition-all">
                      {email}
                      <button onClick={() => handleRemoveEmail(email)} className="ml-2 text-slate-400 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const FundManager = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [investor, setInvestor] = useState(investors[0]);
    const [amount, setAmount] = useState('');

    const estPrice = unitStats.currentUnitPrice;
    const estUnits = amount ? (parseFloat(amount) / estPrice) : 0;

    const handleAddFund = async (e) => {
      e.preventDefault();
      if (!amount || parseFloat(amount) <= 0) return;
      
      const buyPrice = unitStats.currentUnitPrice;
      const unitsBought = parseFloat(amount) / buyPrice;

      try {
        await addDoc(collection(db, "funds"), {
          date,
          investor,
          amount: parseFloat(amount),
          buyPrice,      
          units: unitsBought,
          createdAt: Date.now()
        });
        setAmount('');
        alert(`入金成功！\n日期: ${date}\n成交淨值: ${formatMoney(buyPrice)}\n購入單位: ${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(unitsBought)}`);
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

    // --- 手動修正淨值功能 ---
    const handleEditNav = async (fund) => {
        if (!isAdmin) return;
        const currentBuyPrice = safeNumber(fund.buyPrice) || 10;
        const newNavStr = prompt(`修正 ${fund.date} 的成交淨值 (目前: ${currentBuyPrice.toFixed(2)})`, currentBuyPrice);
        if (newNavStr === null) return;
        
        const newNav = parseFloat(newNavStr);
        if (isNaN(newNav) || newNav <= 0) {
            alert("請輸入有效的數字");
            return;
        }

        // 重新計算單位數
        const newUnits = fund.amount / newNav;
        
        try {
            await updateDoc(doc(db, "funds", fund.id), {
                buyPrice: newNav,
                units: newUnits
            });
            alert("已更新淨值與單位數！");
        } catch (error) {
            console.error("Update failed", error);
            alert("更新失敗");
        }
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isAdmin ? (
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg mr-3"><Plus className="w-5 h-5" /></div>
                注入資金
              </h3>
              
              <div className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-bold text-slate-400">參考淨值狀態</span>
                   <span className={`text-xs px-2 py-0.5 rounded ${funds.length === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                     {funds.length === 0 ? '初始期 (固定 10)' : '營運期 (浮動)'}
                   </span>
                </div>
                <div className="flex justify-between items-end">
                   <div>
                     <div className="text-xs text-slate-500 mb-1">預估成交價</div>
                     <div className="text-xl font-bold text-slate-800">{formatMoney(estPrice)}</div>
                   </div>
                   <div className="text-right">
                     <div className="text-xs text-slate-500 mb-1">預估購入單位</div>
                     <div className="text-xl font-bold text-blue-600">{new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(estUnits)}</div>
                   </div>
                </div>
              </div>

              <form onSubmit={handleAddFund} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">日期</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">資金來源</label>
                  <select value={investor} onChange={e => setInvestor(e.target.value)} className="input-field">
                    {investors.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">金額 (TWD)</label>
                  <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="input-field" />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95">確認入金</button>
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
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-700 flex items-center">
                <Wallet className="w-4 h-4 mr-2 text-slate-400" /> 入金紀錄
              </h3>
            </div>
            
            <div className="hidden md:block overflow-x-auto p-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-100">
                    <th className="pb-3 font-medium whitespace-nowrap pl-2">日期</th>
                    <th className="pb-3 font-medium whitespace-nowrap">投資人</th>
                    <th className="pb-3 font-medium text-right whitespace-nowrap pr-4">金額</th>
                    <th className="pb-3 font-medium text-right whitespace-nowrap pr-4">成交淨值</th>
                    <th className="pb-3 font-medium text-right whitespace-nowrap pr-4">購入單位</th>
                    {isAdmin && <th className="pb-3 font-medium w-16 text-center whitespace-nowrap">操作</th>}
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {/* 使用 unitStats.enrichedFunds 確保顯示計算後的完整資料 */}
                  {[...unitStats.enrichedFunds].reverse().map(f => (
                    <tr key={f.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                      <td className="py-4 text-sm whitespace-nowrap pl-2">{f.date}</td>
                      <td className="py-4 font-medium whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">{f.investor}</span>
                      </td>
                      <td className="py-4 text-right font-mono text-slate-800 whitespace-nowrap pr-4">{secureMoney(f.amount)}</td>
                      <td className="py-4 text-right font-mono text-slate-500 whitespace-nowrap pr-4 text-sm group cursor-pointer" onClick={() => handleEditNav(f)}>
                        <div className="flex items-center justify-end">
                            {formatMoney(f.buyPrice)}
                            {isAdmin && <Pencil className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 text-blue-400" />}
                        </div>
                      </td>
                      <td className="py-4 text-right font-mono text-slate-500 whitespace-nowrap pr-4 text-sm">
                        {formatUnit(f.units)}
                      </td>
                      {isAdmin && (
                        <td className="py-4 text-center whitespace-nowrap">
                          <button onClick={() => handleDelete(f.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {unitStats.enrichedFunds.length === 0 && (
                    <tr><td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-slate-400">目前無紀錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-4 space-y-3">
              {[...unitStats.enrichedFunds].reverse().map(f => (
                <div key={f.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-700">{f.investor}</span>
                      <span className="text-xs text-slate-400">{f.date}</span>
                    </div>
                    <div className="font-mono text-slate-800 font-bold">{secureMoney(f.amount)}</div>
                    <div className="text-xs text-slate-400 mt-1 flex gap-3 items-center" onClick={() => handleEditNav(f)}>
                       <span className="flex items-center">淨值: {formatMoney(f.buyPrice)} {isAdmin && <Pencil className="w-3 h-3 ml-1 text-slate-300" />}</span>
                       <span>單位: {formatUnit(f.units)}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDelete(f.id)} className="p-2 text-slate-300 hover:text-red-500">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              {unitStats.enrichedFunds.length === 0 && <div className="text-center text-slate-400 py-8">目前無紀錄</div>}
            </div>
          </Card>
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
      } catch (error) { console.error(error); }
    };
    const handleDelete = async (id) => { if(window.confirm("刪除？")) await deleteDoc(doc(db, "trades", id)); };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isAdmin ? (
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg mr-3"><TrendingUp className="w-5 h-5"/></div>紀錄交易</h3>
              {/* 修正：使用 portfolioStats.cashBalance 顯示正確的現金餘額 */}
              <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100"><span className="text-xs font-bold text-slate-400 uppercase block mb-1">可用現金餘額</span><span className="font-mono text-xl font-bold text-slate-700">{secureMoney(portfolioStats.cashBalance)}</span></div>
              <form onSubmit={handleAddTrade} className="space-y-5">
                <div className="flex bg-slate-100 p-1 rounded-xl"><button type="button" onClick={()=>setType('BUY')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${type==='BUY'?'bg-white text-red-600 shadow-sm':'text-slate-400'}`}>買入</button><button type="button" onClick={()=>setType('SELL')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${type==='SELL'?'bg-white text-green-600 shadow-sm':'text-slate-400'}`}>賣出</button></div>
                <div><label className="block text-sm font-bold text-slate-500 mb-2">日期</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input-field"/></div>
                <div><label className="block text-sm font-bold text-slate-500 mb-2">代號</label><input type="text" value={ticker} onChange={e=>setTicker(e.target.value)} className="input-field uppercase" placeholder="如: 2330"/></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-slate-500 mb-2">價格</label><input type="number" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} className="input-field"/></div><div><label className="block text-sm font-bold text-slate-500 mb-2">股數</label><input type="number" step="1" value={qty} onChange={e=>setQty(e.target.value)} className="input-field"/></div></div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl">新增紀錄</button>
              </form>
            </Card>
          </div>
        ) : <div className="lg:col-span-1"><div className="bg-slate-50 p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400"><Lock className="w-10 h-10 mx-auto mb-3 text-slate-300"/><p>僅管理員可操作</p></div></div>}
        <div className="lg:col-span-2">
           <Card className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-700 flex items-center"><Activity className="w-4 h-4 mr-2 text-slate-400"/> 交易歷史</h3></div>
            <div className="overflow-x-auto p-6">
              <table className="w-full text-left">
                <thead><tr className="text-slate-400 text-sm border-b"><th className="pb-3 pl-2">日期</th><th className="pb-3">代號</th><th className="pb-3">類別</th><th className="pb-3 text-right">成交價</th><th className="pb-3 text-right">股數</th><th className="pb-3 text-right pr-4">總額</th>{isAdmin && <th className="pb-3 text-center">操作</th>}</tr></thead>
                <tbody className="text-slate-600">
                  {[...trades].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=>(
                    <tr key={t.id} className="hover:bg-slate-50 border-b last:border-0">
                      <td className="py-4 pl-2 text-sm">{t.date}</td><td className="py-4 font-bold">{t.ticker}</td>
                      <td className="py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${t.type==='BUY'?'bg-red-100 text-red-600':'bg-green-100 text-green-600'}`}>{t.type==='BUY'?'買':'賣'}</span></td>
                      <td className="py-4 text-right">{t.price}</td><td className="py-4 text-right">{t.qty}</td><td className="py-4 text-right font-mono text-slate-800 pr-4">{secureMoney(t.price*t.qty)}</td>
                      {isAdmin && <td className="py-4 text-center"><button onClick={()=>handleDelete(t.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></td>}
                    </tr>
                  ))}
                  {trades.length===0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">無紀錄</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const Portfolio = () => {
    const [priceInputs, setPriceInputs] = useState(marketPrices);
    const [savedMsg, setSavedMsg] = useState(false);
    const handlePriceChange = (ticker, val) => setPriceInputs(prev => ({ ...prev, [ticker]: val }));
    const savePrices = async () => {
      const newPrices = { ...marketPrices };
      Object.keys(priceInputs).forEach(k => { if(priceInputs[k]) newPrices[k] = parseFloat(priceInputs[k]); });
      try { await setDoc(doc(db, "settings", "market_prices"), newPrices); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); } catch (e) { console.error(e); }
    };

    return (
      <div className="space-y-6">
        {isAllowed && (
          <Card className="p-6">
             <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center"><div className="p-2 bg-purple-100 text-purple-600 rounded-lg mr-3"><PieChartIcon className="w-5 h-5"/></div>資產配置 (台幣)</h3>
             <div className="h-[300px] flex items-center justify-center">
                {allocationData.length > 0 ? (
                  <ResponsiveContainer><PieChart><Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={5} dataKey="value">{allocationData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip formatter={(v,n)=>{const total=allocationData.reduce((a,c)=>a+c.value,0);return [`${formatMoney(v)} (${formatPercent(total>0?v/total:0)})`,n];}} /><Legend /></PieChart></ResponsiveContainer>
                ) : <p className="text-slate-400">無資產數據</p>}
             </div>
          </Card>
        )}
        <Card className="p-6">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div><h3 className="text-xl font-bold text-slate-800">持倉損益表 (TWD)</h3><p className="text-slate-500 text-sm">金額已換算台幣</p></div>
            {isAdmin && <button onClick={savePrices} className={`flex items-center px-4 py-2 rounded-xl font-medium transition-all shadow-lg ${savedMsg?'bg-green-600 text-white':'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>{savedMsg ? '已同步!' : <><Save className="w-4 h-4 mr-2"/> 更新市價</>}</button>}
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
              <thead><tr className="text-slate-400 text-sm border-b"><th className="pb-3 pl-4">代號</th><th className="pb-3 text-right">股數</th><th className="pb-3 text-right">幣別</th><th className="pb-3 text-right w-40">現價(原幣)</th><th className="pb-3 text-right">市值(TWD)</th><th className="pb-3 text-right">損益(TWD)</th><th className="pb-3 text-right pr-4">報酬率</th></tr></thead>
              <tbody className="text-slate-600">
                {portfolioStats.holdingsList.map(item => (
                  <tr key={item.ticker} className="hover:bg-slate-50 border-b last:border-0">
                    <td className="py-4 pl-4 font-bold text-slate-800"><div className="flex items-center gap-2">{item.ticker}<span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${item.returnRate>=0?'bg-green-100 text-green-600':'bg-red-100 text-red-600'}`}>{item.returnRate>=0?'獲利':'虧損'}</span></div></td>
                    <td className="py-4 text-right">{item.qty}</td>
                    <td className="py-4 text-right text-xs text-slate-500">{item.isUS?<span className="bg-blue-100 text-blue-600 px-2 py-1 rounded">USD</span>:<span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">TWD</span>}</td>
                    <td className="py-4 text-right"><input type="number" step="0.1" disabled={!isAdmin} value={priceInputs[item.ticker]||''} onChange={e=>handlePriceChange(item.ticker,e.target.value)} placeholder={item.avgCostOriginal.toFixed(1)} className={`input-field w-24 text-right ${isAdmin?'bg-indigo-50/50 border-indigo-200':'bg-transparent border-transparent'}`}/></td>
                    <td className="py-4 text-right font-medium text-slate-800">{secureMoney(item.currentValue)}</td>
                    <td className={`py-4 text-right font-medium ${!isAllowed?'text-slate-600':(item.unrealizedPL>=0?'text-green-600':'text-red-600')}`}>{isAllowed&&(item.unrealizedPL>=0?'+':'')}{secureMoney(item.unrealizedPL)}</td>
                    <td className={`py-4 text-right pr-4 font-bold ${!isAllowed?'text-slate-600':(item.returnRate>=0?'text-green-600':'text-red-600')}`}>{isAllowed?formatPercent(item.returnRate):"****"}</td>
                  </tr>
                ))}
                {portfolioStats.holdingsList.length===0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">無持倉</td></tr>}
              </tbody>
             </table>
           </div>
        </Card>
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 md:pb-0">
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 md:w-64 md:h-full md:border-t-0 md:border-r md:left-0 z-50 flex md:flex-col justify-between md:justify-start pb-safe md:pb-0">
        <div className="hidden md:flex items-center p-8 mb-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold mr-3 text-xl shadow-lg shadow-blue-200">$</div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">InvestPartner</span>
        </div>
        <div className="flex-1 flex md:flex-col justify-around md:justify-start md:px-4 md:space-y-2 pb-2 md:pb-0">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="總覽儀表板" />
          <NavButton active={activeTab === 'funds'} onClick={() => setActiveTab('funds')} icon={<Wallet />} label="資金管理" />
          <NavButton active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} icon={<TrendingUp />} label="交易紀錄" />
          <NavButton active={activeTab === 'portfolio'} onClick={() => setActiveTab('portfolio')} icon={<PieChartIcon />} label="持倉與市價" />
        </div>
        <div className="hidden md:block p-6 border-t border-slate-100">
          {user ? (
             <div className="space-y-4">
               <div className="flex items-center text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
                 <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mr-3">{user.displayName?.[0] || 'U'}</div>
                 <div className="flex-1 min-w-0"><div className="truncate font-bold text-slate-700">{user.displayName || 'User'}</div><div className="truncate text-[10px]">{user.email}</div></div>
               </div>
               <button onClick={handleLogout} className="w-full flex items-center justify-center text-xs text-red-500 hover:text-red-600 hover:bg-red-50 py-2 rounded-lg font-medium transition-colors"><LogOut className="w-3 h-3 mr-2" /> 登出帳號</button>
             </div>
          ) : <button onClick={handleLogin} className="w-full flex items-center justify-center bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95"><LogIn className="w-3 h-3 mr-2" /> Google 登入</button>}
        </div>
      </nav>

      <div className="md:hidden flex items-center justify-between p-4 bg-white sticky top-0 z-40 border-b border-slate-200 shadow-sm">
         <div className="flex items-center"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 text-lg shadow-md">$</div><span className="text-lg font-bold text-slate-800">InvestPartner</span></div>
         <div>{user ? <button onClick={handleLogout} className="bg-slate-100 p-2 rounded-full text-slate-600"><LogOut className="w-5 h-5" /></button> : <button onClick={handleLogin} className="bg-slate-800 p-2 rounded-full text-white"><LogIn className="w-5 h-5" /></button>}</div>
      </div>

      <main className="pt-6 px-4 md:px-10 max-w-7xl mx-auto md:pl-72 transition-all duration-300">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-fade-in border border-slate-100 transform scale-100 transition-all">
                <div className="flex items-center mb-4 text-red-600 bg-red-50 p-3 rounded-xl w-fit"><AlertCircle className="w-6 h-6 mr-2" /><h3 className="font-bold text-lg">確認刪除</h3></div>
                <p className="text-slate-600 mb-6 text-sm leading-relaxed">{deleteModal.message}</p>
                <div className="flex justify-end space-x-3"><button onClick={() => setDeleteModal({ ...deleteModal, show: false })} className="px-5 py-2.5 text-slate-500 hover:bg-slate-50 font-bold rounded-xl transition-colors text-sm">取消</button><button onClick={() => { if (deleteModal.onConfirm) deleteModal.onConfirm(); setDeleteModal({ ...deleteModal, show: false }); }} className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg transition-transform active:scale-95 text-sm">確認刪除</button></div>
            </div>
        </div>
      )}
      <style>{`.input-field { width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; outline: none; transition: all 0.2s; } .input-field:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); } .pb-safe { padding-bottom: env(safe-area-inset-bottom); } @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } } .animate-fade-in { animation: fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1); }`}</style>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col md:flex-row items-center md:px-4 md:py-3.5 rounded-xl transition-all w-full mb-1 md:mb-0 ${active ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
    <div className={`p-1 md:p-0 md:mr-3 transition-transform ${active ? 'scale-110' : ''}`}>{icon}</div>
    <span className="text-[10px] md:text-sm font-medium">{label}</span>
  </button>
);