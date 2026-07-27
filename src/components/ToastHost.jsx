import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from '../lib/toast';

const ICON = {
  success: <CheckCircle size={18} color="var(--success)" />,
  error: <AlertCircle size={18} color="var(--danger)" />,
  default: <Info size={18} color="var(--text-secondary)" />,
};

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;
  return (
    <div className="toast-host">
      <div className="stack gap-sm" style={{ width: '100%', maxWidth: 480 }}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} onClick={() => dismiss(t.id)}>
            {ICON[t.type] || ICON.default}
            <span className="grow">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
