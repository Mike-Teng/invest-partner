import Notification from './components/Notification.jsx';
import AppShell from './components/AppShell.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import Skeleton from './components/Skeleton.jsx';
import Dashboard from './pages/Dashboard.jsx';
import FundManager from './pages/FundManager.jsx';
import TradeManager from './pages/TradeManager.jsx';
import Portfolio from './pages/Portfolio.jsx';
import { safeNumber, formatMoney } from './lib/formatters.js';
import { useState, useEffect, useMemo, useRef } from 'react';
import { calculateUnitAccounting } from './lib/accounting.js';
import { calculatePortfolio } from './lib/portfolio.js';
import { saveLedgerChange, ledgerOperationsCollection, readHistoryBasis, exportLedgerBackup } from './lib/firestoreLedger.js';
import { prepareReconciliation } from './lib/reconciliationChanges.js';
import { stableValue } from './lib/ledgerCommit.js';
import { buildSnapshot } from './lib/snapshot.js';
import { taipeiDate } from './lib/entryTime.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, query, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

// --- Firebase 設定 ---
const firebaseConfig = import.meta.env.VITE_FIREBASE_CONFIG;

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- 【權限設定區域】 ---
const ADMIN_EMAIL = import.meta.env.VITE_DEMO_MODE ? 'demo@example.com' : 'm88215@gmail.com';

// 合夥人 Email 對應表
const INVESTOR_MAP = import.meta.env.VITE_DEMO_MODE ? { 'alex@example.com': 'Alex', 'sam@example.com': 'Sam' } : {
  "yi.990131@gmail.com": "Yi",
  "aa1234567aa88@gmail.com": "Ma"
};


export default function App() {
  const [notification, setNotification] = useState('');
  const notify = message => setNotification(message);
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigateTo = tab => { setActiveTab(tab); window.scrollTo({ top: 0, behavior: 'auto' }); };
  const [investors] = useState(import.meta.env.VITE_DEMO_MODE ? ['Alex', 'Sam'] : ['Yi', 'Ma']);

  const [user, setUser] = useState(null);
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = user && user.email === ADMIN_EMAIL;
  const isAllowed = user && (allowedEmails.includes(user?.email) || isAdmin);

  const [funds, setFunds] = useState([]);
  const [trades, setTrades] = useState([]);
  const [marketPrices, setMarketPrices] = useState({});
  const [historyData, setHistoryData] = useState([]);
  const [reconciliation, setReconciliation] = useState(null);
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
      notify("登入失敗");
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
    if (!user) return;
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
    const unsubReconciliation = onSnapshot(doc(db, 'settings', 'ledger_reconciliation'), snapshot => {
      setReconciliation(snapshot.exists() ? snapshot.data() : null);
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
      unsubReconciliation();
      unsubAccess();
      unsubHistory();
    };
  }, [user]);

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
      notify(`已新增 ${newEmail} 到允許名單`);
    } catch (error) {
      console.error("Error updating access list:", error);
      notify("更新失敗");
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
    trades, capitalStats.totalCapital, marketPrices, reconciliation,
  ), [trades, capitalStats.totalCapital, marketPrices, reconciliation]);

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
            ledger.historyData, taipeiDate(timestamp), timestamp, ledger.reconciliation) } };
      });
      notify("已成功記錄今日資產快照！");
    } catch (error) {
      console.error("Error recording history:", error);
      notify(error.message || "記錄失敗");
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
      notify("歷史數據已清空");
    } catch (error) {
      console.error("Error clearing history:", error);
      notify("清除失敗");
    }
  };

  const saveMarketPrices = prices => setDoc(doc(db, 'settings', 'market_prices'), prices);
  const onBackup = async () => {
    if (!isAdmin) throw new Error('僅管理員可操作');
    const backup = await exportLedgerBackup(db);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `investpartner-backup-${taipeiDate()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const onReconcile = async input => {
    await changeLedger('reconcile-balances', input, ledger => prepareReconciliation({ ...ledger, ...input }));
    notify('對帳完成，後續交易將使用確認後的餘額');
  };
  const dashboardProps = { user, isAdmin, isAllowed, isLoading, investors, unitStats, portfolioStats, historyData,
    historyBasis, operationsReady, exchangeRate, secureMoney, allowedEmails, newEmail, setNewEmail,
    handleAddEmail, handleRemoveEmail, handleRecordHistory, handleClearHistory, reconciliation, onBackup, onReconcile,
    adminEmail: ADMIN_EMAIL, investorMap: INVESTOR_MAP, onNavigate: navigateTo };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard {...dashboardProps} />;
      case 'funds': return <FundManager notify={notify} investors={investors} funds={funds} historyData={historyData} unitStats={unitStats} isAdmin={isAdmin} isAllowed={isAllowed} changeLedger={changeLedger} setDeleteModal={setDeleteModal} secureMoney={secureMoney} />;
      case 'trade': return <TradeManager notify={notify} trades={trades} portfolioStats={portfolioStats} isAdmin={isAdmin} isAllowed={isAllowed} changeLedger={changeLedger} secureMoney={secureMoney} />;
      case 'portfolio': return <Portfolio marketPrices={marketPrices} portfolioStats={portfolioStats} allocationData={allocationData} isAdmin={isAdmin} isAllowed={isAllowed} secureMoney={secureMoney} saveMarketPrices={saveMarketPrices} />;
      default: return <Dashboard {...dashboardProps} />;
    }
  };

  return <AppShell {...{ activeTab, user, handleLogin, handleLogout }} setActiveTab={navigateTo}>
    {renderContent()}
    {notification && <Notification message={notification} onClose={() => setNotification('')} />}
    {deleteModal.show && <ConfirmDialog modal={deleteModal} onClose={() => setDeleteModal(previous => ({ ...previous, show: false }))} />}
  </AppShell>;
}
