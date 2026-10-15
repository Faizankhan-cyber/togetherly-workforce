import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useData } from '@/context/DataContext';
import type { ToastMessage } from '@/types';

const toastConfig: Record<ToastMessage['type'], { icon: typeof CheckCircle2; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-success' },
  error: { icon: AlertCircle, color: 'text-critical' },
  info: { icon: Info, color: 'text-cyan' },
  warning: { icon: AlertTriangle, color: 'text-warning' },
};

export function ToastContainer() {
  const { toasts, dismissToast } = useData();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm animate-slide-in-right">
      {toasts.map((toast) => {
        const { icon: Icon, color } = toastConfig[toast.type];
        return (
          <div
            key={toast.id}
            className="card px-4 py-3 flex items-start gap-3 shadow-glow-lg animate-slide-up"
          >
            <Icon size={18} className={`${color} flex-shrink-0 mt-0.5`} />
            <p className="text-sm text-text-primary flex-1">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-text-secondary hover:text-text-primary flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
