import { statusColors, statusLabels } from '@/utils';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const colorClass = statusColors[status] ?? 'text-text-secondary bg-base-hover border-base-border';
  const displayLabel = label ?? statusLabels[status] ?? status;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span className={`inline-flex items-center rounded-md border font-medium capitalize ${colorClass} ${sizeClass}`}>
      {displayLabel}
    </span>
  );
}
