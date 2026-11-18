import { Settings, Plus, Trash2, X, ChevronDown } from 'lucide-react';
import Card from '../Card.jsx';

export default function AdminTools({ handleRecordHistory, handleClearHistory, handleAddEmail, handleRemoveEmail, newEmail, setNewEmail, adminEmail, allowedEmails }) {
  return <Card className="admin-tools"><details>
    <summary className="flex items-center gap-2 p-5 text-sm font-medium"><Settings size={17} className="text-slate-400" />管理工具<span className="ml-auto text-xs text-slate-400 hidden sm:inline">快照與成員權限</span><ChevronDown size={16} className="ml-auto sm:ml-2" /></summary>
    <div className="p-5 pt-0 grid lg:grid-cols-2 gap-8 border-t border-slate-100">
      <div className="pt-5"><h3 className="font-medium text-sm mb-4">歷史趨勢圖管理</h3><div className="flex flex-wrap gap-2"><button onClick={handleRecordHistory} className="btn-ghost text-xs flex items-center gap-2"><Plus size={15} />記錄今日快照</button><button onClick={handleClearHistory} className="btn-ghost text-xs text-red-600 flex items-center gap-2"><Trash2 size={14} />清除數據</button></div></div>
      <div className="pt-5"><h3 className="font-medium text-sm mb-4">成員權限管理</h3><form onSubmit={handleAddEmail} className="flex gap-2 mb-3"><input aria-label="合夥人 Email" type="email" required placeholder="輸入合夥人 Email" value={newEmail} onChange={event => setNewEmail(event.target.value)} className="input-field min-w-0 text-sm" /><button type="submit" className="btn-primary text-sm shrink-0">新增</button></form><div className="flex flex-wrap gap-2 text-xs"><span className="access-email">{adminEmail}（管理員）</span>{allowedEmails.map(email => <span key={email} className="access-email">{email}<button type="button" aria-label={`移除 ${email}`} onClick={() => handleRemoveEmail(email)}><X size={14} /></button></span>)}</div></div>
    </div>
  </details></Card>;
}
