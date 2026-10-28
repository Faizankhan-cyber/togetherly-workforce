import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/Avatar';

export type DashboardHeroVariant = 'admin' | 'hr' | 'manager' | 'employee';

interface RoleDashboardHeroProps {
  variant: DashboardHeroVariant;
  eyebrow: string;
  title: string;
  description: string;
  to: string;
  actionLabel: string;
  icon: LucideIcon;
  identity?: { name: string; color: string };
}

const themes: Record<DashboardHeroVariant, {
  panel: string;
  glow: string;
  badge: string;
  iconBox: string;
  title: string;
  description: string;
  button: string;
  motif: string;
}> = {
  admin: {
    panel: 'border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950',
    glow: 'bg-blue-400/15',
    badge: 'border-white/15 bg-white/10 text-blue-100',
    iconBox: 'border-white/15 bg-white/10 text-blue-100',
    title: 'text-white',
    description: 'text-slate-300',
    button: 'bg-white text-slate-900 hover:bg-blue-50',
    motif: 'border-blue-200/10',
  },
  hr: {
    panel: 'border-violet-900 bg-gradient-to-r from-violet-950 via-purple-950 to-indigo-950',
    glow: 'bg-fuchsia-400/15',
    badge: 'border-violet-100/20 bg-white/10 text-violet-100',
    iconBox: 'border-violet-100/20 bg-white/10 text-violet-100',
    title: 'text-white',
    description: 'text-violet-100/80',
    button: 'bg-white text-violet-950 hover:bg-violet-50',
    motif: 'border-violet-100/10',
  },
  manager: {
    panel: 'border-cyan-900 bg-gradient-to-r from-blue-950 via-slate-900 to-cyan-950',
    glow: 'bg-cyan-400/15',
    badge: 'border-cyan-100/20 bg-white/10 text-cyan-100',
    iconBox: 'border-cyan-100/20 bg-white/10 text-cyan-100',
    title: 'text-white',
    description: 'text-blue-100/80',
    button: 'bg-white text-blue-950 hover:bg-cyan-50',
    motif: 'border-cyan-100/10',
  },
  employee: {
    panel: 'border-emerald-900 bg-gradient-to-r from-emerald-950 via-teal-950 to-cyan-950',
    glow: 'bg-emerald-400/15',
    badge: 'border-emerald-100/20 bg-white/10 text-emerald-100',
    iconBox: 'border-emerald-100/20 bg-white/10 text-emerald-100',
    title: 'text-white',
    description: 'text-emerald-100/80',
    button: 'bg-white text-emerald-950 hover:bg-emerald-50',
    motif: 'border-emerald-100/10',
  },
};

export function RoleDashboardHero({
  variant,
  eyebrow,
  title,
  description,
  to,
  actionLabel,
  icon: Icon,
  identity,
}: RoleDashboardHeroProps) {
  const theme = themes[variant];

  return (
    <section className={`relative isolate overflow-hidden rounded-2xl border p-5 shadow-lg sm:p-7 ${theme.panel}`}>
      <div aria-hidden="true" className={`pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full blur-3xl ${theme.glow}`} />
      <div aria-hidden="true" className={`pointer-events-none absolute right-14 top-8 hidden h-36 w-36 rotate-12 rounded-[2rem] border md:block ${theme.motif}`} />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${theme.iconBox}`}>
            {identity ? (
              <Avatar name={identity.name} color={identity.color} size="lg" />
            ) : (
              <Icon size={22} />
            )}
          </div>
          <div className="min-w-0 max-w-3xl">
            <div className={`mb-2 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${theme.badge}`}>
              {eyebrow}
            </div>
            <h2 className={`text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-[2rem] ${theme.title}`}>{title}</h2>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${theme.description}`}>{description}</p>
          </div>
        </div>
        <Link
          to={to}
          className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 ${theme.button}`}
        >
          {actionLabel} <ArrowUpRight size={16} />
        </Link>
      </div>
    </section>
  );
}
