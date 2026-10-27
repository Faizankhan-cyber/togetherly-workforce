import { Link } from 'react-router-dom';
import { ArrowUpRight, Sparkles } from 'lucide-react';

type TinyFishLaunchCardProps = {
  description: string;
};

export function TinyFishLaunchCard({ description }: TinyFishLaunchCardProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-blue-50 p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-violet-200/35 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700 shadow-sm">
            <Sparkles size={19} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-800">TinyFish AI</p>
            <h2 className="mt-1 text-base font-bold text-slate-900">Research beyond your workspace</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">{description}</p>
          </div>
        </div>
        <Link to="/intelligence" className="inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800">
          Open TinyFish AI <ArrowUpRight size={15} />
        </Link>
      </div>
    </section>
  );
}
