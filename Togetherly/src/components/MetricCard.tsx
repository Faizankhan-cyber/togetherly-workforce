import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral'; label?: string };
  accent?: 'primary' | 'cyan' | 'success' | 'warning' | 'critical';
}

const accentColors: Record<string, string> = {
  primary: 'text-primary bg-primary/10',
  cyan: 'text-cyan bg-cyan/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  critical: 'text-critical bg-critical/10',
};

export function MetricCard({ label, value, icon, trend, accent = 'primary' }: MetricCardProps) {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trend?.direction === 'up' ? 'text-success' : trend?.direction === 'down' ? 'text-critical' : 'text-text-secondary';

  return (
    <div className="card p-5 transition-all duration-200 hover:border-base-hover">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${accentColors[accent]}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={14} />
            <span>{trend.direction === 'up' ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-text-primary mb-1">{value}</div>
      <div className="text-sm text-text-secondary">{label}</div>
      {trend?.label && (
        <div className="text-xs text-text-secondary mt-1">{trend.label}</div>
      )}
    </div>
  );
}
