import { useEffect, useRef, useState } from 'react';
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

const accentGlow: Record<string, string> = {
  primary: 'hover:shadow-glow',
  cyan: 'hover:shadow-glow-cyan',
  success: 'hover:shadow-glow',
  warning: 'hover:shadow-glow',
  critical: 'hover:shadow-glow',
};

function useCountUp(end: number, duration = 900) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setCount(end);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            const startTime = performance.now();
            function tick(now: number) {
              const progress = Math.min((now - startTime) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setCount(Math.round(end * eased));
              if (progress < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [end, duration]);

  return { count, ref };
}

export function MetricCard({ label, value, icon, trend, accent = 'primary' }: MetricCardProps) {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trend?.direction === 'up' ? 'text-success' : trend?.direction === 'down' ? 'text-critical' : 'text-text-secondary';

  const numericValue = typeof value === 'number' ? value : parseInt(String(value), 10);
  const isNumeric = !isNaN(numericValue) && typeof value === 'number';
  const { count, ref } = useCountUp(isNumeric ? numericValue : 0);
  const displayValue = isNumeric ? count : value;

  return (
    <div
      ref={ref}
      className={`card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-base-hover ${accentGlow[accent]}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${accentColors[accent]} transition-transform duration-300 hover:scale-110`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={14} />
            <span>{trend.direction === 'up' ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-text-primary mb-1">{displayValue}</div>
      <div className="text-sm text-text-secondary">{label}</div>
      {trend?.label && (
        <div className="text-xs text-text-secondary mt-1">{trend.label}</div>
      )}
    </div>
  );
}
