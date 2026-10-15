import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  children?: ReactNode;
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  children,
}: ConfirmationDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        {variant === 'danger' && (
          <div className="p-2 rounded-lg bg-critical/10 text-critical flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
        )}
        <div>
          <p className="text-sm text-text-secondary">{message}</p>
          {children}
        </div>
      </div>
    </Modal>
  );
}
