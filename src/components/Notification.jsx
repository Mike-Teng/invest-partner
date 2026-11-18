import { X } from 'lucide-react';

export default function Notification({ message, onClose }) {
  return <div className="app-notification" role="status"><p className="whitespace-pre-line text-sm leading-relaxed">{message}</p><button aria-label="關閉提示" className="icon-button shrink-0" onClick={onClose}><X size={17} /></button></div>;
}
