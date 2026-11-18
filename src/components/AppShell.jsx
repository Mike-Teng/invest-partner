import { LayoutDashboard, Wallet, TrendingUp, ChartPie, LogIn, LogOut, ArrowUpRight, RotateCcw } from 'lucide-react';
import PaperBackground from './PaperBackground.jsx';
const tabs = [
  { id: 'dashboard', label: '總覽儀表板', short: '總覽', icon: <LayoutDashboard size={19} />, title: '投資組合總覽' },
  { id: 'funds', label: '資金管理', short: '資金', icon: <Wallet size={19} />, title: '資金異動管理', description: '記錄合夥人的入金、提領與單位變動' },
  { id: 'trade', label: '交易紀錄', short: '交易', icon: <TrendingUp size={19} />, title: '股票交易紀錄', description: '新增買入與賣出交易' },
  { id: 'portfolio', label: '持倉與市價', short: '持倉', icon: <ChartPie size={19} />, title: '持倉損益監控', description: '更新市價以計算未實現損益' },
];

export default function AppShell({ activeTab, setActiveTab, user, handleLogin, handleLogout, children }) {
  const current = tabs.find(tab => tab.id === activeTab) || tabs[0];
  return <div className="app-shell">
    <PaperBackground />
    <a href="#main-content" className="skip-link">跳至主要內容</a>
    <header className="app-header">
      <a href="#main-content" onClick={() => setActiveTab('dashboard')} className="app-brand"><span className="brand-symbol"><ArrowUpRight size={25} strokeWidth={2.3} /></span><span>InvestPartner</span></a>
      <nav aria-label="主要導覽" className="app-nav">{tabs.map(({ id, label, short, icon }) => <button key={id} type="button" aria-label={label} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)} className={`nav-item ${activeTab === id ? 'nav-active' : ''}`}>{icon}<span>{short}</span></button>)}</nav>
      <div className="header-account">
        {user ? <><div className="account-info"><span className="account-avatar">{user.displayName?.[0] || 'U'}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.displayName || 'User'}</p><p className="truncate text-[11px] text-slate-400 mt-1">{user.email}</p></div><button aria-label="登出帳號" onClick={handleLogout} className="icon-button"><LogOut size={17} /></button></div></> : <button onClick={handleLogin} className="btn-primary w-full flex justify-center gap-2 text-sm"><LogIn size={17} />Google 登入</button>}
      </div>
    </header>
    <div className="mobile-header"><span className="font-bold flex items-center gap-2"><span className="brand-symbol"><ArrowUpRight size={20} /></span>InvestPartner</span><button aria-label={user ? '登出帳號' : 'Google 登入'} onClick={user ? handleLogout : handleLogin} className="icon-button">{user ? <LogOut size={18} /> : <LogIn size={18} />}</button></div>
    <div className="app-workspace">
      <main id="main-content" className="app-main" tabIndex={-1}>
        {import.meta.env.VITE_DEMO_MODE && <div className="demo-banner"><div><span className="demo-pill">介面試用版</span><span>使用示範資料，重新整理即可還原。</span></div><button type="button" onClick={() => window.location.reload()}><RotateCcw size={13} />重設</button></div>}
        <header className="page-heading"><div><h1>{current.title}</h1>{current.description && <p>{current.description}</p>}</div></header>
        <div key={activeTab} className="page-enter">{children}</div>
      </main>
    </div>
    <nav aria-label="手機導覽" className="mobile-nav">{tabs.map(({ id, short, icon }) => <button key={id} type="button" aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)} className={activeTab === id ? 'mobile-nav-active' : ''}>{icon}<span>{short}</span></button>)}</nav>
  </div>;
}
