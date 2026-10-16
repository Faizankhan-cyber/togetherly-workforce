import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import type { ToastNotification } from '@/types';

interface ToastProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';

        const borderColor = isSuccess
          ? 'border-green-200 bg-white'
          : isWarning
            ? 'border-orange-200 bg-white'
            : isError
              ? 'border-red-200 bg-white'
              : 'border-primary-200 bg-white';

        const iconColor = isSuccess
          ? 'text-success'
          : isWarning
            ? 'text-warning'
            : isError
              ? 'text-critical'
              : 'text-primary';

        const Icon = isSuccess
          ? CheckCircle2
          : isWarning
            ? AlertTriangle
            : isError
              ? AlertCircle
              : Info;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border ${borderColor} shadow-dropdown transition-all duration-200 animate-slide-in-right`}
          >
            <Icon size={17} className={`shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary leading-relaxed">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-text-secondary hover:text-text-primary p-0.5 rounded transition-colors shrink-0"
              aria-label="Dismiss toast"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
