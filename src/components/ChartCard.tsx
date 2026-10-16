import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function ChartCard({ title, subtitle, actions, children, className = '', delay = 0 }: ChartCardProps) {
  return (
    <Reveal className={className} delay={delay}>
      <div className="card p-5 h-full transition-colors hover:border-base-border">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-base-border">
          <div>
            <h3 className="text-sm font-bold text-text-primary tracking-tight">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        <div className="relative">
          {children}
        </div>
      </div>
    </Reveal>
  );
}
