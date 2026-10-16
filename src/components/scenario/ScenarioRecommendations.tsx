import {
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Info,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import type { SimulationRecommendation } from '@/types';

interface ScenarioRecommendationsProps {
  recommendations: SimulationRecommendation[];
}

export function ScenarioRecommendations({ recommendations }: ScenarioRecommendationsProps) {
  return (
    <div className="card p-5 border-base-border/70 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-base-border/60">
        <div>
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Lightbulb size={16} className="text-amber-500" />
            Scenario Advisory & Rule-Based Recommendations ({recommendations.length})
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Transparent recommendations derived from capacity rules, staffing ratios, and skill gap analysis.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-medium text-text-secondary bg-base-bg px-2.5 py-1 rounded-md border border-base-border">
          <ShieldCheck size={13} className="text-primary" />
          Rule-Based Simulation Engine
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="p-6 text-center text-xs text-text-muted bg-base-bg/30 rounded-xl">
          No critical risks or policy violations detected for this scenario. Workforce metrics remain within normal parameters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {recommendations.map((rec) => {
            const isPositive = rec.type === 'positive';
            const isWarning = rec.type === 'warning';
            const isRisk = rec.type === 'risk';

            return (
              <div
                key={rec.id}
                className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between space-y-2.5 transition-all ${
                  isPositive
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : isRisk
                      ? 'bg-rose-50/50 border-rose-200'
                      : isWarning
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-sky-50/50 border-sky-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isPositive
                          ? 'bg-emerald-100 text-emerald-800'
                          : isRisk
                            ? 'bg-rose-100 text-rose-800'
                            : isWarning
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {isPositive ? (
                        <CheckCircle2 size={11} />
                      ) : isRisk ? (
                        <AlertCircle size={11} />
                      ) : isWarning ? (
                        <AlertTriangle size={11} />
                      ) : (
                        <Info size={11} />
                      )}
                      {rec.type}
                    </span>

                    <span className="text-[10px] font-mono text-text-muted">
                      Target: {rec.affectedEntity}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs text-text-primary leading-snug">
                    {rec.title}
                  </h4>
                  <p className="text-[11px] text-text-primary mt-1 font-medium">
                    {rec.action}
                  </p>
                </div>

                <div className="pt-2 border-t border-black/5 text-[11px] text-text-secondary leading-relaxed bg-white/60 p-2 rounded-md">
                  <span className="font-semibold text-text-primary">Operational Rationale:</span>{' '}
                  {rec.reasoning}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
