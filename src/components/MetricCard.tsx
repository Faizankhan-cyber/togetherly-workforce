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

const accentColors: Record<string, { icon: string; border: string; topGrad: string }> = {
  primary: {
    icon: 'text-primary bg-primary-50 border-primary-200',
    border: 'hover:border-primary/50',
    topGrad: 'bg-primary',
  },
  cyan: {
    icon: 'text-primary bg-primary-50 border-primary-200',
    border: 'hover:border-primary/50',
    topGrad: 'bg-primary',
  },
  success: {
    icon: 'text-success bg-green-50 border-green-200',
    border: 'hover:border-success/50',
    topGrad: 'bg-success',
  },
  warning: {
    icon: 'text-warning bg-orange-50 border-orange-200',
    border: 'hover:border-warning/50',
    topGrad: 'bg-warning',
  },
  critical: {
    icon: 'text-critical bg-red-50 border-red-200',
    border: 'hover:border-critical/50',
    topGrad: 'bg-critical',
  },
};

function useCountUp(end: number, duration = 650) {
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

    const startAnimation = () => {
      if (started.current) return;
      started.current = true;
      const startTime = performance.now();
      function tick(now: number) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(end * eased));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      startAnimation();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            startAnimation();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [end, duration]);

  return { count, ref };
}

export function MetricCard({ label, value, icon, trend, accent = 'primary' }: MetricCardProps) {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;
  const trendBg =
    trend?.direction === 'up'
      ? 'text-success bg-green-50 border-green-200'
      : trend?.direction === 'down'
        ? 'text-critical bg-red-50 border-red-200'
        : 'text-text-secondary bg-gray-100 border-base-border';

  const isPercent = typeof value === 'string' && value.endsWith('%');
  const numericValue = typeof value === 'number'
    ? value
    : isPercent
      ? parseInt(value.slice(0, -1), 10)
      : parseInt(String(value), 10);
  const isNumeric = !isNaN(numericValue) && (typeof value === 'number' || isPercent);
  const { count, ref } = useCountUp(isNumeric ? numericValue : 0);
  const displayValue = isNumeric ? (isPercent ? `${count}%` : count) : value;

  const styleConfig = accentColors[accent] ?? accentColors.primary;

  return (
    <div
      ref={ref}
      className={`card p-4 sm:p-5 transition-colors duration-150 ${styleConfig.border} group`}
    >
      {/* Top accent indicator */}
      <div className={`absolute top-0 left-0 right-0 h-[2.5px] ${styleConfig.topGrad}`} />

      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg border ${styleConfig.icon} transition-transform duration-200 group-hover:scale-105 shadow-sm`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${trendBg}`}>
            <TrendIcon size={12} />
            <span className="font-mono tabular-nums">{trend.direction === 'up' ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>

      <div className="text-2xl font-semibold text-text-primary tracking-tight mb-1 tabular-nums">
        {displayValue}
      </div>
      <div className="text-xs font-medium text-text-secondary tracking-normal">{label}</div>
      {trend?.label && (
        <div className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1">{trend.label}</div>
      )}
    </div>
  );
}
