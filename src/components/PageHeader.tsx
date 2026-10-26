import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: string[];
}

export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <Reveal direction="down" duration={350}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-base-border/80">
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-text-muted mb-2 font-medium">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-gray-300 text-[10px]">/</span>}
                  <span className={i === breadcrumb.length - 1 ? 'text-primary font-semibold' : ''}>{crumb}</span>
                </span>
              ))}
            </div>
          )}
          <h1 className="text-2xl sm:text-[26px] font-semibold text-text-primary tracking-tight leading-tight">{title}</h1>
          {description && <p className="text-[13px] text-text-secondary mt-1.5 max-w-2xl leading-relaxed">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </Reveal>
  );
}
