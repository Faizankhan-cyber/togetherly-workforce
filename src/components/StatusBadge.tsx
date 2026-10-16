import { statusColors, statusLabels } from '@/utils';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}

const statusDotColors: Record<string, string> = {
  available: 'bg-success',
  busy: 'bg-warning',
  unavailable: 'bg-critical',
  active: 'bg-success',
  planning: 'bg-cyan',
  'on-hold': 'bg-warning',
  completed: 'bg-text-secondary',
  critical: 'bg-critical',
  high: 'bg-warning',
  medium: 'bg-cyan',
  low: 'bg-text-secondary',
};

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const colorClass = statusColors[status] ?? 'text-text-secondary bg-base-hover border-base-border';
  const displayLabel = label ?? statusLabels[status] ?? status;
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  const dotColor = statusDotColors[status] ?? 'bg-primary';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium capitalize tracking-wide ${colorClass} ${sizeClass} shadow-sm`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${status === 'active' || status === 'available' ? 'animate-pulse' : ''}`} />
      {displayLabel}
    </span>
  );
}
