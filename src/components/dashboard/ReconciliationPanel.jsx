import { useState } from 'react';
import { formatMoney } from '../../lib/formatters.js';

export default function ReconciliationPanel({ reconciliation, portfolioStats, onBackup, onReconcile }) {
  const [cash, setCash] = useState('');
  const [reason, setReason] = useState('');
  const [closedTickers, setClosedTickers] = useState([]);
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async action => {
    setBusy(true); setError('');
    try { await action(); } catch (failure) { setError(failure.message || '對帳失敗，請稍後再試'); }
    finally { setBusy(false); }
  };
  if (reconciliation) return <div className="p-5 border-t border-slate-100 text-sm">
    <h3 className="font-medium mb-2">帳務對帳</h3>
    <p>{reconciliation.date} 已確認現金基準 {formatMoney(reconciliation.cashBalance)}；後續資金與交易繼續計入。</p>
    {reconciliation.closedTickers.length > 0 && <p className="text-slate-500 mt-2">已結清舊股數差額：{reconciliation.closedTickers.join('、')}</p>}
    <p className="text-slate-500 mt-2">{reconciliation.reason}</p>
  </div>;
  const negative = Object.entries(portfolioStats.holdings).filter(([, holding]) => holding.qty < 0);
  return <form className="p-5 border-t border-slate-100 space-y-4" onSubmit={event => {
    event.preventDefault();
    if (!backedUp || cash.trim() === '') return;
    run(() => onReconcile({ cashBalance: Number(cash), closedTickers, reason }));
  }}>
    <div><h3 className="font-medium text-sm">帳務對帳</h3><p className="text-xs text-slate-500 mt-2">以確認後的餘額繼續記帳，保留原交易與歷史快照。這不會新增入金或投資單位。</p></div>
    <button type="button" disabled={busy} className="btn-ghost text-xs" onClick={() => run(async () => { await onBackup(); setBackedUp(true); })}>{backedUp ? '重新下載帳務備份' : '下載帳務備份'}</button>
    <div><label className="block text-sm mb-2" htmlFor="reconciliation-cash">確認後的現金總額（台幣，含美元換算）</label><input id="reconciliation-cash" type="number" min="0" step="0.01" required className="input-field max-w-sm" value={cash} onChange={event => setCash(event.target.value)} /></div>
    {negative.map(([ticker, holding]) => <label key={ticker} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={closedTickers.includes(ticker)} onChange={event => setClosedTickers(previous => event.target.checked ? [...previous, ticker] : previous.filter(item => item !== ticker))} />{ticker} 已全部賣出，結清舊差額 {holding.qty} 股</label>)}
    <div><label className="block text-sm mb-2" htmlFor="reconciliation-reason">對帳原因</label><input id="reconciliation-reason" required className="input-field" value={reason} onChange={event => setReason(event.target.value)} /></div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <button type="submit" disabled={busy || !backedUp} className="btn-primary text-sm disabled:opacity-50">{busy ? '處理中…' : '確認對帳'}</button>
  </form>;
}
