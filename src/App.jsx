import React, { useState, useEffect, useMemo, useRef } from 'react';
import { calculateUnitAccounting, calculatePerformance, summarizeCashFlows, createFundTransaction } from './lib/accounting.js';
import { calculatePortfolio } from './lib/portfolio.js';
import { prepareFundNavEdit, prepareFundEntry, fundEntryContext, assertSafeFundChange } from './lib/fundChanges.js';
import { prepareTradeEntry, assertSafeTradeChange } from './lib/tradeChanges.js';
import { saveLedgerChange, ledgerOperationsCollection, readHistoryBasis } from './lib/firestoreLedger.js';
import { stableValue } from './lib/ledgerCommit.js';
import { historicalPerformance } from './lib/history.js';
import { buildSnapshot } from './lib/snapshot.js';
import { taipeiDate } from './lib/entryTime.js';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, query, orderBy, getDocs, writeBatch } from "firebase/firestore";
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

const COLORS = ['#4f6df5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

// --- 輔助函數 ---
const safeNumber = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

// 顯示總金額 (不帶小數，保持整潔)
const formatMoney = (amount) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(safeNumber(amount));
};

// 新增：顯示單價/淨值/平均成本 (強制兩位小數)
const formatPrice = (amount) => {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNumber(amount));
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
  <div className={`shimmer rounded ${className}`}></div>
);

// UI 組件：標準卡片
const Card = ({ children, className = "" }) => (
  <div className={`card-base card-hover ${className}`}>
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
  const [ledgerOperations, setLedgerOperations] = useState([]);
  const [operationsReady, setOperationsReady] = useState(false);
  const [historyBasis, setHistoryBasis] = useState({ funds: [], operations: [] });

  const writeInFlight = useRef(false);
  const pendingOperation = useRef(null);
  const changeLedger = async (key, input, prepare) => {
    if (!isAdmin) throw new Error('僅管理員可操作');
    if (writeInFlight.current) throw new Error('上一筆資料仍在儲存，請稍候');
    const signature = stableValue({ key, input });
    if (pendingOperation.current?.signature !== signature) {
      pendingOperation.current = { signature, id: crypto.randomUUID() };
    }
    const operationId = pendingOperation.current.id;
    writeInFlight.current = true;
    try {
      const result = await saveLedgerChange(db, operationId, user.uid, ledger => prepare(ledger, operationId));
      pendingOperation.current = null;
      return result;
    } finally { writeInFlight.current = false; }
  };

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

  useEffect(() => {
    if (!isAllowed) return;
    return onSnapshot(ledgerOperationsCollection(db), snapshot => {
      setLedgerOperations(snapshot.docs.map(item => ({ ...item.data(), id: item.id })));
    }, () => { setOperationsReady(false); });
  }, [isAllowed]);

  useEffect(() => {
    if (!isAllowed) return;
    let cancelled = false;
    setOperationsReady(false);
    readHistoryBasis(db).then(basis => {
      if (!cancelled) { setHistoryBasis(basis); setOperationsReady(true); }
    }).catch(() => { if (!cancelled) setOperationsReady(false); });
    return () => { cancelled = true; };
  }, [isAllowed, funds, ledgerOperations]);

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

  const portfolioStats = useMemo(() => calculatePortfolio(
    trades, capitalStats.totalCapital, marketPrices,
  ), [trades, capitalStats.totalCapital, marketPrices]);

  // Stored signed units are the source of truth; cash flows remain separate.
  const unitStats = useMemo(() => calculateUnitAccounting({
    funds,
    investors,
    historyData,
    totalAssets: portfolioStats.cashBalance + portfolioStats.marketValue,
  }), [funds, investors, portfolioStats, historyData]);

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
      await changeLedger('snapshot', {}, (ledger, id) => {
        const timestamp = Date.now();
        return { collection: 'asset_history', id, before: null,
          after: { id, ...buildSnapshot(ledger.funds, ledger.trades, ledger.marketPrices,
            ledger.historyData, taipeiDate(timestamp), timestamp) } };
      });
      alert("已成功記錄今日資產快照！");
    } catch (error) {
      console.error("Error recording history:", error);
      alert(error.message || "記錄失敗");
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
    const [showProfitChart, setShowProfitChart] = useState(false);

    const myData = isSpecificInvestor ? unitStats.investorData[currentInvestorName] : null;
    const display = calculatePerformance({
      assets: myData ? myData.units * unitStats.currentUnitPrice : unitStats.totalAssets,
      deposits: myData ? myData.deposits : unitStats.deposits,
      withdrawals: myData ? myData.withdrawals : unitStats.withdrawals,
    });
    const displayAssets = display.assets;
    const displayPL = display.profit;
    const displayROI = display.returnOnDeposits;
    const titlePrefix = isSpecificInvestor ? '我的' : '總';

    const chartData = historyData.map(h => {
      const point = historicalPerformance(h, historyBasis.funds, historyBasis.operations, currentInvestorName);
      // Never show a legacy profit from an incompletely loaded audit trail.
      if (!operationsReady && !point.frozenCashFlows) return { ...point, totalProfit: null, meProfit: null };
      return point;
    });

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
              <span>當前淨值: <span className="font-bold text-slate-800">{formatPrice(unitStats.currentUnitPrice)}</span></span>
            </div>
            <div className="flex items-center">
              <DollarSign className="w-3 h-3 mr-1" />
              <span>美金參考匯率: <span className="text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm ml-1">{exchangeRate}</span> TWD</span>
            </div>
          </div>
        )}

        {/* 1. 資產/獲利趨勢折線圖 */}
        {isAllowed && !operationsReady && <p className="text-sm text-amber-700">歷史異動紀錄尚未讀取完成，舊快照收益暫不顯示。若持續出現，請確認資料讀取權限。</p>}
        {isAllowed && chartData.length > 0 && (
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h3 className="text-lg font-bold text-slate-700 flex items-center">
                <div className={`p-2 rounded-lg mr-3 transition-colors ${showProfitChart ? 'bg-green-100 text-green-600' : 'bg-brand-50 text-brand-600'}`}>
                  <LineChartIcon className="w-5 h-5" />
                </div>
                {showProfitChart ? '累計收益趨勢' : '資產成長趨勢'}
              </h3>

              {/* 切換開關 */}
              <div className="toggle-switch self-start sm:self-auto">
                <button
                  onClick={() => setShowProfitChart(false)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all toggle-option ${!showProfitChart ? 'toggle-option-active text-brand-600' : 'toggle-option-inactive'}`}
                >
                  資產總值
                </button>
                <button
                  onClick={() => setShowProfitChart(true)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all toggle-option ${showProfitChart ? 'toggle-option-active text-brand-600' : 'toggle-option-inactive'}`}
                >
                  累計收益
                </button>
              </div>
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} animationDuration={800} animationEasing="ease-out">
                  <defs>
                    <linearGradient id="colorAsset" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f6df5" stopOpacity={0.3} /><stop offset="50%" stopColor="#4f6df5" stopOpacity={0.15} />
                      <stop offset="30%" stopColor="#4f6df5" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#4f6df5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="50%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="30%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    tickFormatter={(val) => `$${val / 1000}k`}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}
                    formatter={(value) => [formatMoney(value), showProfitChart ? "累計收益" : "資產"]}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Area
                    animationDuration={800}
                    animationEasing="ease-out"
                    type="monotone"
                    dataKey={showProfitChart ? (isSpecificInvestor ? "meProfit" : "totalProfit") : (isSpecificInvestor ? currentInvestorName : "total")}
                    name={showProfitChart ? (isSpecificInvestor ? "我的獲利" : "總獲利") : (isSpecificInvestor ? "我的資產" : "總資產")}
                    stroke={showProfitChart ? "#10b981" : "#4f6df5"}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill={`url(#${showProfitChart ? 'colorProfit' : 'colorAsset'})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* 2. 歷史趨勢圖管理 */}
        {isAdmin && (
          <Card className="p-4 text-slate-800">
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card className="p-6 relative overflow-hidden group gradient-top-bar-blue">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Landmark className="w-24 h-24 text-brand-500 transform translate-x-4 -translate-y-4" />
            </div>
            <div className="text-slate-500 text-sm font-medium mb-1 relative z-10 tracking-tight">{titlePrefix}資產 (NAV)</div>
            <div className="text-3xl font-bold text-slate-800 font-mono relative z-10">{secureMoney(displayAssets)}</div>
            <div className="text-xs text-slate-400 mt-2 relative z-10">
              {isSpecificInvestor ? "依份額比例計算之權益" : "現金 + 股票市值 (台幣)"}
            </div>
          </Card>

          {[
            { label: '累計入金', value: display.deposits, description: '歷次投入金額合計，不扣除提領' },
            { label: '累計提領', value: display.withdrawals, description: '歷次領回金額合計，包含本金與收益' },
          ].map(item => (
            <Card key={item.label} className="p-6 relative overflow-hidden gradient-top-bar-indigo">
              <div className="text-slate-500 text-sm font-medium mb-1">{item.label}</div>
              <div className="text-2xl font-bold text-slate-800 font-mono">{secureMoney(item.value)}</div>
              <div className="text-xs text-slate-400 mt-2">{item.description}</div>
            </Card>
          ))}

          <Card className="p-6 relative overflow-hidden group gradient-top-bar-indigo">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <PiggyBank className="w-24 h-24 text-indigo-600 transform translate-x-4 -translate-y-4" />
            </div>
            <div className="text-slate-500 text-sm font-medium mb-1 relative z-10 tracking-tight">{titlePrefix}淨投入</div>
            <div className="text-2xl font-bold text-slate-800 font-mono relative z-10">{secureMoney(display.netContributions)}</div>
            <div className="text-xs text-slate-400 mt-2 relative z-10">累計入金 − 累計提領；可為負數</div>
          </Card>

          <Card className="p-6 relative overflow-hidden group gradient-top-bar-green">
            <div className={`absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${displayPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <Coins className="w-24 h-24 transform translate-x-4 -translate-y-4" />
            </div>
            <div className="text-slate-500 text-sm font-medium mb-1 relative z-10 tracking-tight">{titlePrefix}累計收益</div>
            <div className={`text-2xl font-bold font-mono relative z-10 ${!isAllowed ? 'text-slate-800' : (displayPL >= 0 ? 'text-green-600' : 'text-red-600')}`}>
              {isAllowed && (displayPL >= 0 ? '+' : '')}{secureMoney(displayPL)}
            </div>
            <div className="text-xs text-slate-400 mt-2 relative z-10">目前資產 + 累計提領 − 累計入金</div>
          </Card>

          <Card className="p-6 relative overflow-hidden group gradient-top-bar-purple">
            <div className={`absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${displayROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <Percent className="w-24 h-24 transform translate-x-4 -translate-y-4" />
            </div>
            <div className="text-slate-500 text-sm font-medium mb-1 relative z-10">累計投入收益率</div>
            <div className={`text-2xl font-bold font-mono relative z-10 ${!isAllowed ? 'text-slate-800' : (displayROI >= 0 ? 'text-green-600' : 'text-red-600')}`}>
              {isAllowed ? (displayROI === null ? "不適用" : formatPercent(displayROI)) : "****"}
            </div>
            <div className="text-xs text-slate-400 mt-2 relative z-10">累計收益 ÷ 累計入金</div>
          </Card>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          累計收益包含已領回的收益。累計投入收益率為非年化比例，未考慮投入時間；再次入金也會計入累計入金，並非基金淨值漲幅。
        </p>
        {isAllowed && unitStats.hasUnallocatedAssets && (
          <div role="alert" className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl text-sm">
            所有單位已結清，帳上仍有 {formatPrice(unitStats.totalAssets)} 未分配資產（可能包含四捨五入差額）。請先核對結清差額，再新增資金紀錄。
          </div>
        )}

        {/* 4. 合夥人權益分配表 */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100/60 bg-slate-50/50 flex items-center">
            <Users className="w-5 h-5 text-slate-500 mr-2" />
            <h3 className="font-bold text-slate-700">合夥人權益分配表</h3>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-100">
                    <th className="pb-3 font-medium whitespace-nowrap pl-2">投資人</th>
                    <th className="pb-3 px-3 font-medium whitespace-nowrap">累計入金</th>
                    <th className="pb-3 px-3 font-medium whitespace-nowrap">累計提領</th>
                    <th className="pb-3 px-3 font-medium whitespace-nowrap">淨投入</th>
                    <th className="pb-3 font-medium whitespace-nowrap">持有單位</th>
                    <th className="pb-3 px-3 font-medium whitespace-nowrap">目前資產</th>
                    <th className="pb-3 font-medium whitespace-nowrap pr-2">累計收益</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  {investors.map(inv => {
                    const data = unitStats.investorData[inv];
                    const units = data.units;
                    const val = units * unitStats.currentUnitPrice;
                    const pl = calculatePerformance({ assets: val, ...data }).profit;
                    const isMe = inv === currentInvestorName;

                    return (
                      <tr key={inv} className={`hover-indicator border-b border-slate-50 last:border-0 transition-all ${isMe ? 'bg-blue-50' : ''}`}>
                        <td className="py-4 font-medium text-slate-800 whitespace-nowrap flex items-center pl-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 text-xs font-bold ${isMe ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {inv.charAt(0)}
                          </div>
                          {inv}
                        </td>
                        <td className="py-4 px-3 whitespace-nowrap">{secureMoney(data.deposits)}</td>
                        <td className="py-4 px-3 whitespace-nowrap">{secureMoney(data.withdrawals)}</td>
                        <td className="py-4 px-3 whitespace-nowrap">{secureMoney(data.netContributions)}</td>
                        <td className="py-4 font-mono text-slate-500 whitespace-nowrap">
                          {isAllowed ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(units) : "**"}
                        </td>
                        <td className="py-4 px-3 font-bold text-brand-600 whitespace-nowrap">{secureMoney(val)}</td>
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
                <Settings className="w-5 h-5 mr-2 text-brand-600" />
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
                  <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all duration-200 active:scale-[0.97]">
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
        alert(`${actionName}成功！\n日期: ${date}\n成交淨值: ${formatPrice(transaction.buyPrice)}\n${actionName}單位: ${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(Math.abs(transaction.units))}`);
      } catch (error) {
        console.error("Error adding document: ", error);
        alert(error.message || "寫入失敗");
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
            alert(error.message || '刪除失敗');
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
        alert("已更新淨值與單位數！");
      } catch (error) {
        console.error("Update failed", error);
        alert(error.message || "更新失敗");
      }
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isAdmin ? (
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg">
                <div className={`p-2 rounded-lg mr-3 ${fundType === 'DEPOSIT' ? 'bg-brand-50 text-brand-600' : 'bg-orange-100 text-orange-600'}`}>
                  {fundType === 'DEPOSIT' ? <Plus className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                </div>
                資金異動
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
                  <label className="block text-sm font-bold text-slate-500 mb-2">日期</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="input-field" />
                </div>
                {date < taipeiDate() && <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">實際發生時間（台灣時間）</label>
                  <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="input-field" />
                </div>}
                {requiresHistoricalNav && <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">當時成交淨值</label>
                  <input type="number" step="any" min="0.00000001" required value={historicalNav} onChange={e => setHistoricalNav(e.target.value)} className="input-field" />
                  <p className="text-xs text-slate-500 mt-2">請依當時對帳紀錄填寫。補登不會自動重算後續提領或改寫舊快照。</p>
                </div>}
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">合夥人</label>
                  <select value={investor} onChange={e => setInvestor(e.target.value)} className="input-field">
                    {investors.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-bold text-slate-500">金額 (TWD)</label>
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
                  <input 
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
                            {isAdmin && <Pencil className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 text-blue-400" />}
                          </div>
                        </td>
                        <td className={`py-4 text-right font-mono whitespace-nowrap pr-4 text-sm ${isWithdraw ? 'text-orange-600' : 'text-slate-500'}`}>
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
                      <button onClick={() => handleDelete(f.id)} className="p-2 text-slate-300 hover:text-red-500">
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
  };

  const TradeManager = () => {
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
      } catch (error) { alert(error.message || '新增失敗'); }
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
      } catch (error) { alert(error.message || '刪除失敗'); }
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isAdmin ? (
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center text-lg"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg mr-3"><TrendingUp className="w-5 h-5" /></div>紀錄交易</h3>
              {/* 修正：使用 portfolioStats.cashBalance 顯示正確的現金餘額 */}
              <div className="mb-5 p-4 bg-slate-50/60 rounded-xl border border-slate-100/60"><span className="text-xs font-bold text-slate-400 uppercase block mb-1">帳面現金餘額</span><span className="font-mono text-xl font-bold text-slate-700">{secureMoney(portfolioStats.cashBalance)}</span></div>
              <form onSubmit={handleAddTrade} className="space-y-5">
                <div className="toggle-switch"><button type="button" onClick={() => setType('BUY')} className={`flex-1 py-2 rounded-lg font-bold text-sm toggle-option ${type === 'BUY' ? 'toggle-option-active text-red-600' : 'toggle-option-inactive'}`}>買入</button><button type="button" onClick={() => setType('SELL')} className={`flex-1 py-2 rounded-lg font-bold text-sm toggle-option ${type === 'SELL' ? 'toggle-option-active text-green-600' : 'toggle-option-inactive'}`}>賣出</button></div>
                <div><label className="block text-sm font-bold text-slate-500 mb-2">日期</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" /></div>
                {date < taipeiDate() && <div><label className="block text-sm font-bold text-slate-500 mb-2">實際成交時間（台灣時間）</label><input type="time" required value={time} onChange={e => setTime(e.target.value)} className="input-field" /></div>}
                <div><label className="block text-sm font-bold text-slate-500 mb-2">代號</label><input type="text" value={ticker} onChange={e => setTicker(e.target.value)} className="input-field uppercase" placeholder="如: 2330" /></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-slate-500 mb-2">價格</label><input type="number" required min="0.00000001" step="any" value={price} onChange={e => setPrice(e.target.value)} className="input-field" /></div><div><label className="block text-sm font-bold text-slate-500 mb-2">股數</label><input type="number" required min="0.00000001" step="any" value={qty} onChange={e => setQty(e.target.value)} className="input-field" /></div></div>
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
                      {isAdmin && <td className="py-4 text-center"><button onClick={() => handleDelete(t.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>}
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
                      <button onClick={() => handleDelete(t.id)} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded flex items-center transition-colors">
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
  };

  const Portfolio = () => {
    const [priceInputs, setPriceInputs] = useState(marketPrices);
    const [savedMsg, setSavedMsg] = useState(false);
    const handlePriceChange = (ticker, val) => setPriceInputs(prev => ({ ...prev, [ticker]: val }));
    const savePrices = async () => {
      const newPrices = { ...marketPrices };
      Object.keys(priceInputs).forEach(k => { if (priceInputs[k]) newPrices[k] = parseFloat(priceInputs[k]); });
      try { await setDoc(doc(db, "settings", "market_prices"), newPrices); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); } catch (e) { console.error(e); }
    };

    return (
      <div className="space-y-6">
        {isAllowed && (
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center"><div className="p-2 bg-purple-100 text-purple-600 rounded-lg mr-3"><PieChartIcon className="w-5 h-5" /></div>資產配置 (台幣)</h3>
            <div className="h-[300px] flex items-center justify-center">
              {allocationData.length > 0 ? (
                <ResponsiveContainer><PieChart><Pie data={allocationData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} fill="#8884d8" paddingAngle={5} dataKey="value" animationDuration={600} animationEasing="ease-out">{allocationData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip formatter={(v, n) => { const total = allocationData.reduce((a, c) => a + c.value, 0); return [`${formatMoney(v)} (${formatPercent(total > 0 ? v / total : 0)})`, n]; }} /><Legend /></PieChart></ResponsiveContainer>
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
                    <td className="py-5 px-4 text-right"><input type="number" step="0.1" disabled={!isAdmin} value={priceInputs[item.ticker] || ''} onChange={e => handlePriceChange(item.ticker, e.target.value)} placeholder={item.avgCostOriginal.toFixed(1)} className={`input-field w-24 text-right ${isAdmin ? 'bg-indigo-50/50 border-indigo-200' : 'bg-transparent border-transparent'}`} /></td>
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
                      type="number"
                      step="0.1"
                      disabled={!isAdmin}
                      value={priceInputs[item.ticker] || ''}
                      onChange={e => handlePriceChange(item.ticker, e.target.value)}
                      placeholder={item.avgCostOriginal.toFixed(1)}
                      className={`w-full outline-none font-bold text-sm ${isAdmin ? 'text-indigo-600' : 'text-slate-600 bg-transparent'}`}
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
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'funds': return <FundManager />;
      case 'trade': return <TradeManager />;
      case 'portfolio': return <Portfolio />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-transparent font-sans text-slate-900 pb-24 md:pb-0">
      <nav className="fixed bottom-0 w-full glass-strong border-t border-white/30 md:w-64 md:h-full md:border-t-0 md:border-r md:left-0 z-50 flex md:flex-col justify-between md:justify-start pb-safe md:pb-0 shadow-nav">
        <div className="hidden md:flex items-center p-8 mb-4">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white font-bold mr-3 text-xl shadow-glow">$</div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">InvestPartner</span>
        </div>
        <div className="flex-1 flex md:flex-col justify-around md:justify-start md:px-4 md:space-y-2 pb-2 md:pb-0">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="總覽儀表板" />
          <NavButton active={activeTab === 'funds'} onClick={() => setActiveTab('funds')} icon={<Wallet />} label="資金管理" />
          <NavButton active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} icon={<TrendingUp />} label="交易紀錄" />
          <NavButton active={activeTab === 'portfolio'} onClick={() => setActiveTab('portfolio')} icon={<PieChartIcon />} label="持倉與市價" />
        </div>
        <div className="hidden md:block p-6 border-t border-white/20">
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center text-xs text-slate-500 bg-white/60 p-3 rounded-xl border border-slate-100/60">
                <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold mr-3">{user.displayName?.[0] || 'U'}</div>
                <div className="flex-1 min-w-0"><div className="truncate font-bold text-slate-700">{user.displayName || 'User'}</div><div className="truncate text-[10px]">{user.email}</div></div>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center justify-center text-xs text-red-500 hover:text-red-600 hover:bg-red-50/80 py-2 rounded-lg font-medium transition-colors"><LogOut className="w-3 h-3 mr-2" /> 登出帳號</button>
            </div>
          ) : <button onClick={handleLogin} className="w-full flex items-center justify-center bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl text-xs font-bold transition-all duration-200 shadow-brand-500/20 hover:shadow-glow-sm active:scale-[0.97]"><LogIn className="w-3 h-3 mr-2" /> Google 登入</button>}
        </div>
      </nav>

      <div className="md:hidden flex items-center justify-between p-4 glass-strong sticky top-0 z-40 border-b border-white/30">
        <div className="flex items-center"><div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold mr-3 text-lg shadow-glow-sm">$</div><span className="text-lg font-bold text-slate-800 tracking-tight">InvestPartner</span></div>
        <div>{user ? <button onClick={handleLogout} className="bg-slate-100/80 p-2 rounded-full text-slate-600 transition-colors"><LogOut className="w-5 h-5" /></button> : <button onClick={handleLogin} className="bg-brand-500 p-2 rounded-full text-white shadow-glow-sm"><LogIn className="w-5 h-5" /></button>}</div>
      </div>

      <main className="pt-6 px-4 md:px-10 max-w-7xl mx-auto md:pl-72 transition-all duration-300">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
            {activeTab === 'dashboard' && '投資組合總覽'}
            {activeTab === 'funds' && '資金異動管理'}
            {activeTab === 'trade' && '股票交易紀錄'}
            {activeTab === 'portfolio' && '持倉損益監控'}
          </h1>
          <p className="text-slate-500">
            {activeTab === 'dashboard' && '查看整體績效與合夥人權益分配'}
            {activeTab === 'funds' && '記錄合夥人的入金、提領與單位變動'}
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
            <div className="flex justify-end space-x-3"><button onClick={() => setDeleteModal({ ...deleteModal, show: false })} className="btn-ghost text-sm">取消</button><button onClick={() => { if (deleteModal.onConfirm) deleteModal.onConfirm(); setDeleteModal({ ...deleteModal, show: false }); }} className="btn-danger text-sm">確認刪除</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col md:flex-row items-center md:px-4 md:py-3.5 rounded-xl transition-all duration-200 w-full mb-1 md:mb-0 ${active ? 'text-brand-600 bg-brand-50 font-bold shadow-glow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/80'}`}>
    <div className={`p-1 md:p-0 md:mr-3 transition-transform duration-200 ${active ? 'scale-110' : ''}`}>{icon}</div>
    <span className="text-[10px] md:text-sm font-medium">{label}</span>
  </button>
);
