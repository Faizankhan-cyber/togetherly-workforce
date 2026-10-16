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
  planning: 'bg-primary',
  'on-hold': 'bg-warning',
  completed: 'bg-text-secondary',
  critical: 'bg-critical',
  high: 'bg-warning',
  medium: 'bg-primary',
  low: 'bg-text-secondary',
  'not-started': 'bg-gray-400',
  'in-progress': 'bg-primary',
  'pending-verification': 'bg-amber-500',
  verified: 'bg-emerald-600',
  rejected: 'bg-rose-500',
  'needs-more-evidence': 'bg-indigo-500',
  'Not Started': 'bg-gray-400',
  'In Progress': 'bg-primary',
  'Pending Verification': 'bg-amber-500',
  Verified: 'bg-emerald-600',
  Rejected: 'bg-rose-500',
  'Needs More Evidence': 'bg-indigo-500',
};

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const colorClass = statusColors[status] ?? 'text-text-secondary bg-gray-100 border-base-border';
  const displayLabel = label ?? statusLabels[status] ?? status;
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  const dotColor = statusDotColors[status] ?? 'bg-primary';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border font-semibold capitalize tracking-tight ${colorClass} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {displayLabel}
    </span>
  );
}
