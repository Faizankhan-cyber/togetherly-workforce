import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Users,
  FolderKanban,
  GraduationCap,
  BarChart3,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { SimulationResult } from '@/types';
import { Avatar } from '@/components/Avatar';

export function ScenarioComparisonView({ simulation }: { simulation: SimulationResult }) {
  const [chartView, setChartView] = useState<'kpi' | 'projects'>('kpi');
  const { metricDeltas, projectImpacts, employeeImpacts, skillCoverageDeltas, warnings } =
    simulation;

  // Chart data 1: KPI overview
  const kpiChartData = [
    {
      metric: 'Headcount',
      Baseline: simulation.baselineMetrics.totalHeadcount,
      Simulated: simulation.simulatedMetrics.totalHeadcount,
    },
    {
      metric: 'Avg Util %',
      Baseline: simulation.baselineMetrics.averageUtilization,
      Simulated: simulation.simulatedMetrics.averageUtilization,
    },
    {
      metric: 'Overloaded',
      Baseline: simulation.baselineMetrics.overloadedCount,
      Simulated: simulation.simulatedMetrics.overloadedCount,
    },
    {
      metric: 'Skill Gaps',
      Baseline: simulation.baselineMetrics.totalSkillGaps,
      Simulated: simulation.simulatedMetrics.totalSkillGaps,
    },
    {
      metric: 'Understaffed',
      Baseline: simulation.baselineMetrics.understaffedProjectsCount,
      Simulated: simulation.simulatedMetrics.understaffedProjectsCount,
    },
  ];

  // Chart data 2: Project staffing levels
  const projectChartData = projectImpacts.slice(0, 7).map((p) => ({
    name: p.projectName.length > 14 ? p.projectName.substring(0, 14) + '...' : p.projectName,
    Baseline: p.baselineTeamSize,
    Simulated: p.simulatedTeamSize,
    Target: p.targetTeamSize,
  }));

  return (
    <div className="space-y-6">
      {/* Risk / Warning Alerts Banner if any */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                w.severity === 'critical'
                  ? 'bg-critical/10 border-critical/30 text-critical-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {w.severity === 'critical' ? (
                <AlertCircle size={17} className="text-critical mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle size={17} className="text-amber-700 mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-bold">{w.title}</div>
                <div className="text-[11px] mt-0.5 leading-relaxed opacity-90">{w.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI Comparison Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {metricDeltas.map((m) => {
          const isImprovement = m.status === 'improvement';
          const isRisk = m.status === 'risk';
          const isWarning = m.status === 'warning';

          return (
            <div
              key={m.key}
              className="card p-4 border-base-border/70 hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="text-[11px] font-semibold text-text-secondary truncate mb-2">
                  {m.label}
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                  <div className="text-xl font-bold font-mono text-text-primary">
                    {m.simulated}
                    {m.unit}
                  </div>
                  <div className="text-xs text-text-muted line-through font-mono">
                    {m.baseline}
                    {m.unit}
                  </div>
                </div>
              </div>

              <div>
                {/* Delta Badge */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      isImprovement
                        ? 'bg-success/10 text-success border-success/30'
                        : isRisk
                          ? 'bg-critical/10 text-critical border-critical/30'
                          : isWarning
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-base-bg text-text-secondary border-base-border'
                    }`}
                  >
                    {m.delta > 0 ? (
                      <TrendingUp size={11} />
                    ) : m.delta < 0 ? (
                      <TrendingDown size={11} />
                    ) : (
                      <Minus size={11} />
                    )}
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                    {m.unit}
                    <span className="font-normal opacity-85">
                      {isImprovement
                        ? 'Improved'
                        : isRisk
                          ? 'Risk'
                          : isWarning
                            ? 'Alert'
                            : 'Stable'}
                    </span>
                  </span>
                </div>

                <p className="text-[10px] text-text-secondary leading-tight line-clamp-2">
                  {m.explanation}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Chart Section */}
      <div className="card p-5 border-base-border/70 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-base-border/60">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" />
              Before vs After Simulation Analytics
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Side-by-side comparison of baseline workforce metrics against simulated outcomes.
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-base-border bg-base-bg p-0.5 self-start sm:self-auto text-xs">
            <button
              onClick={() => setChartView('kpi')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                chartView === 'kpi'
                  ? 'bg-white text-primary font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Workforce KPIs
            </button>
            <button
              onClick={() => setChartView('projects')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                chartView === 'projects'
                  ? 'bg-white text-primary font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Project Headcount
            </button>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'kpi' ? (
              <BarChart data={kpiChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '11px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Baseline" fill="#94A3B8" radius={[4, 4, 0, 0]} barSize={22} />
                <Bar dataKey="Simulated" fill="#0078D4" radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            ) : (
              <BarChart data={projectChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '11px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Baseline" fill="#94A3B8" radius={[3, 3, 0, 0]} barSize={16} />
                <Bar dataKey="Simulated" fill="#0078D4" radius={[3, 3, 0, 0]} barSize={16} />
                <Bar dataKey="Target" fill="#10B981" radius={[3, 3, 0, 0]} barSize={16} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project Impact Table */}
      <div className="card p-5 border-base-border/70 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <FolderKanban size={16} className="text-primary" />
            Project Staffing & Skill Gap Impact ({projectImpacts.length} Projects)
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Detailed breakdown of team size, skill gaps, and delivery health across all initiatives.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-base-border bg-base-bg/50 text-[11px] font-semibold text-text-secondary">
                <th className="py-2.5 px-3">Project Initiative</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3 text-center">Team Size (Base → Sim)</th>
                <th className="py-2.5 px-3 text-center">Target Size</th>
                <th className="py-2.5 px-3 text-center">Skill Gaps</th>
                <th className="py-2.5 px-3 text-center">Risk Level</th>
                <th className="py-2.5 px-3">Impact Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-border/60">
              {projectImpacts.map((proj) => {
                const teamChanged = proj.simulatedTeamSize !== proj.baselineTeamSize;
                const gapsChanged = proj.gapDelta !== 0;

                return (
                  <tr
                    key={proj.projectId}
                    className={`hover:bg-base-hover/50 transition-colors ${
                      teamChanged || gapsChanged ? 'bg-primary-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-text-primary flex items-center gap-1.5">
                        {proj.projectName}
                        {proj.isSimulatedNewProject && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-100 text-cyan-800 font-semibold">
                            NEW
                          </span>
                        )}
                        {proj.isDelayed && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-semibold">
                            DELAYED
                          </span>
                        )}
                      </div>
                      {proj.isDelayed && proj.simulatedDeadline && (
                        <div className="text-[10px] text-amber-700 font-mono mt-0.5 flex items-center gap-1">
                          <Clock size={11} /> Deadline: {proj.simulatedDeadline}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-text-secondary">{proj.department}</td>

                    <td className="py-3 px-3 text-center font-mono font-semibold">
                      <span className="text-text-muted">{proj.baselineTeamSize}</span>
                      <span className="text-text-secondary mx-1.5">→</span>
                      <span
                        className={
                          proj.simulatedTeamSize >= proj.targetTeamSize
                            ? 'text-success font-bold'
                            : 'text-critical font-bold'
                        }
                      >
                        {proj.simulatedTeamSize}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-text-secondary">
                      {proj.targetTeamSize}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          proj.simulatedGaps === 0
                            ? 'bg-success/10 text-success'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {proj.simulatedGaps}
                        {proj.gapDelta < 0 && (
                          <span className="text-success text-[10px]">({proj.gapDelta})</span>
                        )}
                        {proj.gapDelta > 0 && (
                          <span className="text-critical text-[10px]">(+{proj.gapDelta})</span>
                        )}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          proj.riskLevel === 'low'
                            ? 'bg-success/10 text-success border border-success/30'
                            : proj.riskLevel === 'medium'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-critical/10 text-critical border border-critical/30'
                        }`}
                      >
                        {proj.riskLevel}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-text-secondary text-[11px]">
                      {proj.riskReasons.length > 0 ? (
                        <span className="text-amber-800">{proj.riskReasons.join(' · ')}</span>
                      ) : (
                        <span className="text-success flex items-center gap-1 font-medium">
                          <CheckCircle2 size={12} /> Target staffing & skills fulfilled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Affected Employees & Skill Coverage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Affected Employees */}
        <div className="card p-5 border-base-border/70 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Users size={16} className="text-primary" />
              Impacted Workforce Contributors ({employeeImpacts.length})
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Staff whose project allocations, utilization, or skill levels are shifted by this scenario.
            </p>
          </div>

          {employeeImpacts.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted bg-base-bg/30 rounded-xl">
              No specific employee records are directly shifted by the current scenario configuration.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {employeeImpacts.map((emp) => (
                <div
                  key={emp.employeeId}
                  className="p-2.5 rounded-lg border border-base-border/70 bg-base-bg/30 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={emp.name} color="#0078D4" size="sm" />
                    <div className="min-w-0">
                      <div className="font-bold text-text-primary truncate flex items-center gap-1">
                        {emp.name}
                        {emp.isHypothetical && (
                          <span className="text-[9px] bg-sky-100 text-sky-800 px-1 py-0.2 rounded font-semibold">
                            SIMULATED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-text-secondary truncate">
                        {emp.role} · {emp.department}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-xs">
                        <span className="text-text-muted">{emp.baselineUtilization}%</span>
                        <span className="text-text-secondary mx-1">→</span>
                        <span
                          className={
                            emp.simulatedStatus === 'overloaded'
                              ? 'text-critical'
                              : emp.simulatedStatus === 'underutilized'
                                ? 'text-cyan-700'
                                : 'text-success'
                          }
                        >
                          {emp.simulatedUtilization}%
                        </span>
                      </div>
                      <div className="text-[9px] text-text-muted">{emp.notes}</div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                        emp.simulatedStatus === 'overloaded'
                          ? 'bg-critical/10 text-critical border border-critical/30'
                          : emp.simulatedStatus === 'underutilized'
                            ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                            : 'bg-success/10 text-success border border-success/30'
                      }`}
                    >
                      {emp.simulatedStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skill Coverage Changes */}
        <div className="card p-5 border-base-border/70 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <GraduationCap size={16} className="text-primary" />
              Organizational Skill Coverage Delta
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Net movement in active skill capacity and project requirement fulfillment.
            </p>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {skillCoverageDeltas.slice(0, 8).map((sk) => {
              const isImproved = sk.status === 'improved';
              const isDiminished = sk.status === 'diminished';

              return (
                <div
                  key={sk.skillId}
                  className="p-2.5 rounded-lg border border-base-border/70 bg-base-bg/30 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-text-primary">{sk.skillName}</div>
                    <div className="text-[10px] text-text-secondary">
                      Staff with skill: {sk.baselineStaffCount} → {sk.simulatedStaffCount}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-text-secondary">
                      Gaps: {sk.baselineProjectGaps} → {sk.simulatedProjectGaps}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize border ${
                        isImproved
                          ? 'bg-success/10 text-success border-success/30'
                          : isDiminished
                            ? 'bg-critical/10 text-critical border-critical/30'
                            : 'bg-base-bg text-text-secondary border-base-border'
                      }`}
                    >
                      {sk.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
