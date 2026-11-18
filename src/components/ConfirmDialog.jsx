import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

export default function ConfirmDialog({ modal, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} onCancel={onClose} className="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-message">
    <div className="flex items-center gap-2 mb-4 text-red-600"><AlertCircle size={23} /><h2 id="confirm-title" className="font-bold text-lg">確認刪除</h2></div>
    <p id="confirm-message" className="text-slate-600 mb-6 text-sm leading-relaxed">{modal.message}</p>
    <div className="flex justify-end gap-3"><button autoFocus onClick={onClose} className="btn-ghost text-sm">取消</button><button onClick={() => { modal.onConfirm?.(); onClose(); }} className="btn-danger text-sm">確認刪除</button></div>
  </dialog>;
}
