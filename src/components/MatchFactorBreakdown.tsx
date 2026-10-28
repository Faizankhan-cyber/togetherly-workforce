import type { CandidateRecommendation } from '@/types';

interface MatchFactorBreakdownProps {
  recommendation: Pick<CandidateRecommendation, 'skillsScore' | 'experienceScore' | 'availabilityScore'>;
}

const factors = [
  { key: 'skillsScore', label: 'Skills', bar: 'bg-violet-500' },
  { key: 'experienceScore', label: 'Experience', bar: 'bg-blue-500' },
  { key: 'availabilityScore', label: 'Availability', bar: 'bg-emerald-500' },
] as const;

export function MatchFactorBreakdown({ recommendation }: MatchFactorBreakdownProps) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Match score breakdown">
      {factors.map((factor) => {
        const score = Math.max(0, Math.min(100, Math.round(recommendation[factor.key])));
        return (
          <div key={factor.key} className="rounded-lg border border-base-border/60 bg-base-bg/60 px-2.5 py-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-medium text-text-secondary">{factor.label}</span>
              <span className="text-[10px] font-mono font-bold text-text-primary">{score}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base-border">
              <div className={`h-full rounded-full ${factor.bar}`} style={{ width: score + '%' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
