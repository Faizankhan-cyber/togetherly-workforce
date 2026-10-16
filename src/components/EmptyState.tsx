import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-xl border border-dashed border-base-border bg-base-subtle">
      <div className="w-10 h-10 rounded-lg bg-white border border-base-border flex items-center justify-center text-text-secondary mb-2.5 shadow-sm">
        {icon ?? <Inbox size={20} />}
      </div>
      <h4 className="text-xs sm:text-sm font-bold text-text-primary">{title}</h4>
      {description && (
        <p className="mt-1 text-xs text-text-secondary max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}
