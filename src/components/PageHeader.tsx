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
    <Reveal direction="down" duration={500}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-base-border/40">
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-1.5 font-medium">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-base-border text-[10px]">/</span>}
                  <span className={i === breadcrumb.length - 1 ? 'text-primary font-semibold' : ''}>{crumb}</span>
                </span>
              ))}
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">{title}</h1>
          {description && <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">{actions}</div>}
      </div>
    </Reveal>
  );
}
