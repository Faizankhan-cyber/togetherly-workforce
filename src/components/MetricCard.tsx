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

const accentColors: Record<string, { icon: string; border: string; glow: string; topGrad: string }> = {
  primary: {
    icon: 'text-primary bg-primary/10 border-primary/20',
    border: 'hover:border-primary/40',
    glow: 'hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6),0_0_24px_-4px_rgba(139,92,246,0.18)]',
    topGrad: 'from-primary/70 via-primary/30 to-transparent',
  },
  cyan: {
    icon: 'text-cyan bg-cyan/10 border-cyan/20',
    border: 'hover:border-cyan/40',
    glow: 'hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6),0_0_24px_-4px_rgba(34,211,238,0.18)]',
    topGrad: 'from-cyan/70 via-cyan/30 to-transparent',
  },
  success: {
    icon: 'text-success bg-success/10 border-success/20',
    border: 'hover:border-success/40',
    glow: 'hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6),0_0_24px_-4px_rgba(34,197,94,0.18)]',
    topGrad: 'from-success/70 via-success/30 to-transparent',
  },
  warning: {
    icon: 'text-warning bg-warning/10 border-warning/20',
    border: 'hover:border-warning/40',
    glow: 'hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6),0_0_24px_-4px_rgba(245,158,11,0.18)]',
    topGrad: 'from-warning/70 via-warning/30 to-transparent',
  },
  critical: {
    icon: 'text-critical bg-critical/10 border-critical/20',
    border: 'hover:border-critical/40',
    glow: 'hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6),0_0_24px_-4px_rgba(248,113,113,0.18)]',
    topGrad: 'from-critical/70 via-critical/30 to-transparent',
  },
};

function useCountUp(end: number, duration = 850) {
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

    // Check if already in view on mount
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
      ? 'text-success bg-success/10 border-success/20'
      : trend?.direction === 'down'
        ? 'text-critical bg-critical/10 border-critical/20'
        : 'text-text-secondary bg-base-hover border-base-border';

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
      className={`card p-5 transition-all duration-300 hover:-translate-y-1 ${styleConfig.border} ${styleConfig.glow} group`}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${styleConfig.topGrad} opacity-80 group-hover:opacity-100 transition-opacity`} />

      <div className="flex items-start justify-between mb-3.5">
        <div className={`p-2.5 rounded-xl border ${styleConfig.icon} transition-all duration-300 group-hover:scale-110 shadow-sm`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${trendBg}`}>
            <TrendIcon size={12} />
            <span className="font-mono tabular-nums">{trend.direction === 'up' ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>

      <div className="text-3xl font-extrabold text-text-primary tracking-tight mb-1 font-mono tabular-nums group-hover:text-white transition-colors">
        {displayValue}
      </div>
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</div>
      {trend?.label && (
        <div className="text-[11px] text-text-secondary/80 mt-1.5 flex items-center gap-1">{trend.label}</div>
      )}
    </div>
  );
}
