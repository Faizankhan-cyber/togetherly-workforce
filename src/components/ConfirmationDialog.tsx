import type { ReactNode } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  variant?: 'danger' | 'default';
  details?: ReactNode;
  closeOnConfirm?: boolean;
  confirmDisabled?: boolean;
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  variant,
  details,
  closeOnConfirm = true,
  confirmDisabled = false,
}: ConfirmationDialogProps) {
  if (!open) return null;

  const isDanger = danger || variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-md card p-5 sm:p-6 bg-white border border-base-border shadow-modal rounded-xl animate-fade-in-scale"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-lg shrink-0 ${
              isDanger
                ? 'bg-red-50 text-critical border border-red-200'
                : 'bg-primary-50 text-primary border border-primary-200'
            }`}
          >
            {isDanger ? <AlertTriangle size={20} /> : <Check size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="dialog-title" className="text-sm sm:text-base font-bold text-text-primary leading-snug">
              {title}
            </h3>
            <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {details && <div className="mt-4">{details}</div>}

        <div className="mt-5 flex items-center justify-end gap-2.5 pt-3.5 border-t border-base-border">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={onClose}
          >
            <X size={13} />
            <span>{cancelLabel}</span>
          </button>
          <button
            type="button"
            className={isDanger ? 'btn-danger text-xs' : 'btn-primary text-xs'}
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm();
              if (closeOnConfirm) onClose();
            }}
          >
            <Check size={13} />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
