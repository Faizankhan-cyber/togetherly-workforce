import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  GitCompareArrows,
  RotateCcw,
  Save,
  Sparkles,
  Users,
  X,
  AlertCircle,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { CapacityBar } from '@/components/CapacityBar';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Reveal';
import { MatchScore } from '@/components/MatchScore';
import { ParallaxVisual } from '@/components/ParallaxVisual';
import { useData } from '@/context/DataContext';
import {
  calculateEmployeeUtilization,
  getActiveAssignmentCount,
  generateRecommendations,
  getSkillName,
  getTeamSkillCoverage,
  MAX_CONCURRENT_PROJECTS,
} from '@/utils';

interface TeamScenario {
  id: string;
  name: string;
  employeeIds: string[];
  score: number;
  coveredSkills: number;
}

export function WorkforceTwinPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    employees,
    projects,
    settings,
    assignEmployeeToProject,
    unassignEmployeeFromProject,
    addActivity,
    showToast,
  } = useData();

  const availableProjects = projects.filter((project) => project.status === 'active' || project.status === 'planning');
  const initialProject = availableProjects[0] ?? projects.find((project) => project.status !== 'completed');
  const [projectId, setProjectId] = useState(initialProject?.id ?? '');
  const project = projects.find((item) => item.id === projectId);
  const [teamIds, setTeamIds] = useState<string[]>(project?.assignedEmployeeIds ?? []);
  const [scenarios, setScenarios] = useState<TeamScenario[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const navigationState = location.state as { projectId?: string; employeeId?: string } | null;

  useEffect(() => {
    if (navigationState?.projectId) setProjectId(navigationState.projectId);
  }, [navigationState?.projectId]);

  useEffect(() => {
    const selected = projects.find((item) => item.id === projectId);
    setTeamIds(selected?.assignedEmployeeIds ?? []);
    setScenarios([]);
  }, [projectId, projects]);

  useEffect(() => {
    if (!navigationState?.employeeId || !project || project.id !== navigationState.projectId) return;
    setTeamIds([...project.assignedEmployeeIds, navigationState.employeeId].slice(0, project.targetTeamSize));
    navigate(location.pathname, { replace: true, state: null });
  }, [navigationState?.employeeId, navigationState?.projectId, project, navigate, location.pathname]);

  const recommendations = useMemo(
    () => project ? generateRecommendations(employees, project, settings.matchWeights, projects, settings) : [],
    [employees, project, projects, settings]
  );
  const scoreByEmployee = useMemo(
    () => new Map(recommendations.map((recommendation) => [recommendation.employeeId, recommendation])),
    [recommendations]
  );

  const simulatedProjects = useMemo(() => projects.map((item) => (
    item.id === projectId ? { ...item, assignedEmployeeIds: teamIds } : item
  )), [projects, projectId, teamIds]);

  const coverage = project ? getTeamSkillCoverage(teamIds, project, employees) : [];
  const missingSkills = coverage.filter((item) => !item.covered);
  const teamScore = Math.round(teamIds.reduce((sum, employeeId) =>
    sum + (scoreByEmployee.get(employeeId)?.matchScore ?? 0), 0
  ) / Math.max(teamIds.length, 1));

  const postSimulation = useMemo(() => employees.map((employee) => {
    const before = calculateEmployeeUtilization(employee.id, projects, employee.targetUtilization);
    const after = calculateEmployeeUtilization(employee.id, simulatedProjects, employee.targetUtilization);
    return { employee, before, after };
  }).filter((item) => item.before !== item.after || teamIds.includes(item.employee.id)), [
    employees, projects, simulatedProjects, teamIds,
  ]);

  const capacityViolations = useMemo(() => postSimulation.filter(({ employee }) =>
    teamIds.includes(employee.id) &&
    (getActiveAssignmentCount(employee.id, simulatedProjects) > MAX_CONCURRENT_PROJECTS || employee.availability === 'unavailable')
  ), [postSimulation, teamIds, simulatedProjects]);

  const exactTeamSize = !!project && teamIds.length === project.targetTeamSize;
  const canConfirm = !!project && exactTeamSize && missingSkills.length === 0 && capacityViolations.length === 0;
  const hasDraftChanges = !!project && (
    project.assignedEmployeeIds.length !== teamIds.length ||
    project.assignedEmployeeIds.some((employeeId) => !teamIds.includes(employeeId))
  );

  function toggleMember(employeeId: string) {
    setTeamIds((current) => current.includes(employeeId)
      ? current.filter((id) => id !== employeeId)
      : current.length < (project?.targetTeamSize ?? 0) ? [...current, employeeId] : current
    );
  }

  function buildBestFitTeam() {
    if (!project) return;
    let candidateIds: string[] = [];
    let remaining = [...recommendations];
    while (candidateIds.length < project.targetTeamSize && remaining.length) {
      const currentCoverage = getTeamSkillCoverage(candidateIds, project, employees);
      const bestIndex = remaining.reduce((best, candidate, index) => {
        const employee = employees.find((item) => item.id === candidate.employeeId);
        if (!employee || employee.availability === 'unavailable') return best;
        const trialProjects = projects.map((item) => (
          item.id === project.id ? { ...item, assignedEmployeeIds: [...candidateIds, employee.id] } : item
        ));
        if (getActiveAssignmentCount(employee.id, trialProjects) > MAX_CONCURRENT_PROJECTS) return best;
        const nextCoverage = getTeamSkillCoverage([...candidateIds, employee.id], project, employees);
        const newlyCovered = nextCoverage.filter((item, i) => item.covered && !currentCoverage[i]?.covered).length;
        const bestCandidate = best >= 0 ? remaining[best] : undefined;
        const bestEmployee = bestCandidate ? employees.find((item) => item.id === bestCandidate.employeeId) : undefined;
        const bestCoverage = bestEmployee
          ? getTeamSkillCoverage([...candidateIds, bestEmployee.id], project, employees)
          : [];
        const bestNewlyCovered = bestCoverage.filter((item, i) => item.covered && !currentCoverage[i]?.covered).length;
        if (best < 0 || newlyCovered > bestNewlyCovered ||
          (newlyCovered === bestNewlyCovered && candidate.matchScore > (bestCandidate?.matchScore ?? -1))) {
          return index;
        }
        return best;
      }, -1);
      if (bestIndex < 0) break;
      candidateIds = [...candidateIds, remaining[bestIndex].employeeId];
      remaining = remaining.filter((_, index) => index !== bestIndex);
    }
    setTeamIds(candidateIds);
    showToast('info', `Built a ${candidateIds.length}-person best-fit team. Review the simulation before confirming.`);
  }

  function saveScenario() {
    if (!project || teamIds.length === 0) return;
    if (scenarios.some((scenario) =>
      scenario.employeeIds.length === teamIds.length && scenario.employeeIds.every((id) => teamIds.includes(id))
    )) {
      showToast('info', 'This team is already saved for comparison.');
      return;
    }
    const coveredSkills = getTeamSkillCoverage(teamIds, project, employees).filter((item) => item.covered).length;
    const score = Math.round(teamIds.reduce((sum, id) => sum + (scoreByEmployee.get(id)?.matchScore ?? 0), 0) / teamIds.length);
    setScenarios((current) => [...current, {
      id: `scenario-${Date.now()}`,
      name: `Alternative ${current.length + 1}`,
      employeeIds: [...teamIds],
      score,
      coveredSkills,
    }].slice(0, 3));
    showToast('success', 'Alternative saved for comparison.');
  }

  function resetSimulation() {
    setTeamIds(project?.assignedEmployeeIds ?? []);
    setScenarios([]);
    showToast('info', 'Simulation discarded. Saved assignments are unchanged.');
  }

  function confirmAllocation() {
    if (!project || !canConfirm) return;
    const currentIds = project.assignedEmployeeIds;
    currentIds.filter((id) => !teamIds.includes(id)).forEach((id) => unassignEmployeeFromProject(id, project.id));
    teamIds.filter((id) => !currentIds.includes(id)).forEach((id) => assignEmployeeToProject(id, project.id));
    addActivity({ type: 'team', message: `Workforce Twin allocation confirmed for "${project.name}" (${teamIds.length} employees)` });
    showToast('success', `Allocation confirmed for ${project.name}`);
    setScenarios([]);
    setConfirmOpen(false);
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <PageHeader title="Workforce Twin" description="Simulate, compare, and optimize project allocations in real-time." breadcrumb={['Home', 'Workforce Twin']} />
        <div className="card p-8 text-center text-sm text-text-secondary">Create an active or planning project to start a workforce simulation.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce Digital Twin"
        description="Simulate what-if staffing scenarios, preview capacity impacts, and optimize assignments before live deployment."
        breadcrumb={['Home', 'Workforce Twin']}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={resetSimulation} disabled={!hasDraftChanges && scenarios.length === 0}>
              <RotateCcw size={15} /> Discard
            </button>
            <button className="btn-secondary" onClick={saveScenario} disabled={teamIds.length === 0}>
              <Save size={15} /> Save Alternative
            </button>
            <button className="btn-primary" onClick={() => setConfirmOpen(true)} disabled={!canConfirm || !hasDraftChanges}>
              <Check size={15} /> Confirm Allocation
            </button>
          </div>
        }
      />

      {/* Live Simulation Control Hero */}
      <Reveal direction="down">
        <section className="card p-5 sm:p-6 bg-gradient-to-r from-primary/15 via-base-card to-cyan/10 border-primary/30 shadow-xl relative overflow-hidden">
          <ParallaxVisual strength={0.12} className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-cyan/15 blur-3xl" />
          <ParallaxVisual strength={-0.08} className="absolute -left-10 -bottom-10 w-44 h-44 rounded-full bg-primary/15 blur-3xl" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan mb-2">
                <GitCompareArrows size={15} /> Active Simulation Environment
              </div>
              <label className="block">
                <span className="text-xs text-text-secondary mb-1.5 block">Select Target Project for Modeling:</span>
                <select
                  className="input-field w-full text-sm font-semibold bg-base-bg/90 border-primary/40 focus:border-primary"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                >
                  {availableProjects.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.status})</option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs text-text-secondary leading-relaxed">{project.description}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[340px]">
              <div className="p-3 rounded-xl border border-base-border/70 bg-base-bg/70 shadow-sm">
                <div className="text-xl font-extrabold text-text-primary tracking-tight">{project.targetTeamSize}</div>
                <div className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">Target Size</div>
              </div>
              <div className="p-3 rounded-xl border border-base-border/70 bg-base-bg/70 shadow-sm">
                <div className="text-xl font-extrabold text-cyan tracking-tight">{teamIds.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">Selected</div>
              </div>
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/10 shadow-sm">
                <div className="text-xl font-extrabold text-primary tracking-tight">{teamScore}%</div>
                <div className="text-[10px] uppercase tracking-wider text-primary mt-0.5">Team Match</div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.85fr]">
        {/* Left: Recommended Talent */}
        <Reveal delay={60}>
          <section className="card flex flex-col h-full shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-base-border/60 bg-base-bg/30">
              <div>
                <h2 className="text-base font-bold text-text-primary tracking-tight">Algorithmic Talent Recommendations</h2>
                <p className="text-xs text-text-secondary mt-0.5">Ranked by weighted skill alignment, seniority, and capacity safety.</p>
              </div>
              <button className="btn-secondary text-xs font-semibold" onClick={buildBestFitTeam}>
                <Sparkles size={14} className="text-primary" /> Auto-Build Best Fit Team
              </button>
            </div>

            <div className="max-h-[660px] overflow-y-auto p-4 space-y-3">
              {recommendations.map((recommendation) => {
                const employee = employees.find((item) => item.id === recommendation.employeeId);
                if (!employee) return null;
                const selected = teamIds.includes(employee.id);
                const candidateProjects = simulatedProjects.map((item) => item.id === project.id
                  ? { ...item, assignedEmployeeIds: selected ? teamIds : [...teamIds, employee.id] }
                  : item);
                const simLoad = calculateEmployeeUtilization(employee.id, candidateProjects, employee.targetUtilization);
                const canFit = selected || (
                  employee.availability !== 'unavailable' &&
                  getActiveAssignmentCount(employee.id, candidateProjects) <= MAX_CONCURRENT_PROJECTS
                );

                return (
                  <article
                    key={employee.id}
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                      selected
                        ? 'border-primary/50 bg-primary/10 shadow-[0_0_20px_rgba(139,92,246,0.12)]'
                        : 'border-base-border/70 bg-base-bg/50 hover:border-base-border hover:bg-base-hover/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-4">
                      <MatchScore score={recommendation.matchScore} size="md" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-text-primary truncate">{employee.name}</h3>
                            <p className="text-xs text-text-secondary truncate">{employee.role} · {employee.yearsExperience} yrs exp · {employee.department}</p>
                          </div>
                        </div>

                        {/* Recommendation Reasons */}
                        <div className="mt-2.5 grid gap-1 sm:grid-cols-2">
                          {recommendation.reasons.map((reason) => (
                            <p key={reason} className="flex items-start gap-1.5 text-xs text-text-secondary">
                              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-primary" />
                              <span className="truncate">{reason}</span>
                            </p>
                          ))}
                        </div>

                        {/* Skill Tags */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {recommendation.matchedSkills.map((skillId) => (
                            <span key={skillId} className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                              ✓ {getSkillName(skillId)}
                            </span>
                          ))}
                          {recommendation.missingSkills.map((skillId) => (
                            <span key={skillId} className="rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                              Gap: {getSkillName(skillId)}
                            </span>
                          ))}
                        </div>

                        {/* Capacity Load */}
                        <div className="mt-3 flex items-center gap-3 pt-2 border-t border-base-border/30">
                          <span className="text-[11px] text-text-secondary">Simulated Load:</span>
                          <div className="w-28">
                            <CapacityBar
                              utilization={simLoad}
                              overloadedThreshold={settings.overloadedThreshold}
                              underutilizedThreshold={settings.underutilizedThreshold}
                              showLabel={false}
                            />
                          </div>
                          <span className={`text-[11px] font-mono font-bold ${simLoad > 85 ? 'text-critical' : 'text-text-primary'}`}>
                            {simLoad}%
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleMember(employee.id)}
                        disabled={!selected && (!canFit || teamIds.length >= project.targetTeamSize)}
                        aria-pressed={selected}
                        className={`inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                          selected
                            ? 'bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary-600'
                            : 'border border-base-border text-text-primary hover:border-primary/50 hover:bg-primary/10'
                        }`}
                      >
                        {selected ? <><Check size={14} /> Assigned</> : <><Users size={14} /> Assign</>}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </Reveal>

        {/* Right: Simulation Summary & Impact */}
        <div className="space-y-5">
          <Reveal delay={120}>
            <section className="card p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-base-border/60">
                <div>
                  <h2 className="text-sm font-bold text-text-primary">Twin Validation Report</h2>
                  <p className="text-xs text-text-secondary">Simulation check against rules & capacity constraints.</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  canConfirm
                    ? 'bg-success/10 text-success border-success/30'
                    : 'bg-warning/10 text-warning border-warning/30'
                }`}>
                  {canConfirm ? 'Deployment Ready' : 'Incomplete Draft'}
                </span>
              </div>

              {/* Roster Size Pill */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-base-border bg-base-bg/60 mb-4">
                <span className="text-xs font-medium text-text-secondary">Target Headcount:</span>
                <span className={`text-xs font-bold ${exactTeamSize ? 'text-success' : 'text-warning'}`}>
                  {teamIds.length} of {project.targetTeamSize} filled
                </span>
              </div>

              {/* Required Skill Coverage Matrix */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Skill Coverage Matrix</div>
                {coverage.map((item) => (
                  <div key={item.skillId} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-base-border/50 bg-base-bg/40">
                    <div>
                      <span className="text-xs font-semibold text-text-primary">{getSkillName(item.skillId)}</span>
                      <span className="ml-2 text-[10px] text-text-secondary font-mono">Min L{item.minLevel}</span>
                    </div>
                    <span className={`text-xs font-semibold ${item.covered ? 'text-success' : 'text-warning'}`}>
                      {item.covered ? `✓ L${item.bestLevel}` : '⚠️ Missing'}
                    </span>
                  </div>
                ))}
              </div>

              {capacityViolations.length > 0 && (
                <div className="mt-3 p-3 rounded-xl border border-critical/30 bg-critical/10 text-xs text-critical flex items-center gap-2">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>Some assigned employees exceed maximum project concurrency.</span>
                </div>
              )}

              {missingSkills.length > 0 && (
                <div className="mt-3 p-3 rounded-xl border border-warning/30 bg-warning/10 text-xs text-warning flex items-center gap-2">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>{missingSkills.length} required skill{missingSkills.length === 1 ? '' : 's'} still uncovered.</span>
                </div>
              )}

              {/* Assigned Members Chips */}
              <div className="mt-4 pt-3 border-t border-base-border/40">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2">Selected Roster</div>
                <div className="flex flex-wrap gap-2">
                  {teamIds.length === 0 ? (
                    <span className="text-xs text-text-secondary italic">No team members assigned.</span>
                  ) : (
                    teamIds.map((id) => {
                      const employee = employees.find((item) => item.id === id);
                      if (!employee) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-base-border bg-base-bg py-1 pl-1 pr-2.5 text-xs text-text-primary shadow-sm">
                          <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                          <span className="font-medium">{employee.name.split(' ')[0]}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${employee.name}`}
                            onClick={() => toggleMember(id)}
                            className="ml-1 text-text-secondary hover:text-critical transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </Reveal>

          {/* Workload Impact Delta */}
          <Reveal delay={180}>
            <section className="card p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-base-border/60">
                <div>
                  <h2 className="text-sm font-bold text-text-primary">Workforce Utilization Delta</h2>
                  <p className="text-xs text-text-secondary">Pre vs Post simulation capacity impact.</p>
                </div>
                <GitCompareArrows size={17} className="text-cyan" />
              </div>
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
                {postSimulation.length === 0 ? (
                  <p className="text-xs text-text-secondary text-center py-4">No workload changes in draft.</p>
                ) : (
                  postSimulation.slice(0, 8).map(({ employee, before, after }) => (
                    <div key={employee.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-base-bg/40 border border-base-border/40">
                      <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">{employee.name}</span>
                      <span className="text-xs text-text-secondary font-mono">{before}%</span>
                      {after > before ? (
                        <ArrowUpRight size={13} className="text-warning" />
                      ) : after < before ? (
                        <ArrowDownRight size={13} className="text-success" />
                      ) : (
                        <span className="w-[13px] text-text-secondary text-center">-</span>
                      )}
                      <span className={`w-12 text-right text-xs font-bold font-mono ${
                        after > before ? 'text-warning' : after < before ? 'text-success' : 'text-text-secondary'
                      }`}>
                        {after}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </Reveal>
        </div>
      </div>

      {/* Saved Alternative Scenarios */}
      {scenarios.length > 0 && (
        <Reveal delay={220}>
          <section className="card overflow-hidden shadow-xl border-cyan/30">
            <div className="flex items-center justify-between p-5 border-b border-base-border/60 bg-base-bg/40">
              <div>
                <h2 className="text-sm font-bold text-text-primary">Saved Alternative Scenarios</h2>
                <p className="text-xs text-text-secondary mt-0.5">Side-by-side comparison of modeled candidate allocations.</p>
              </div>
              <button className="btn-ghost text-xs" onClick={() => setScenarios([])}>
                <X size={14} /> Clear All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-xs">
                <thead>
                  <tr className="border-b border-base-border text-left text-text-secondary bg-base-bg/60">
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Scenario Name</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Match Score</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Skill Coverage</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Team Members</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-border/40">
                  {scenarios.map((scenario) => (
                    <tr key={scenario.id} className="hover:bg-base-hover/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-text-primary">{scenario.name}</td>
                      <td className="px-4 py-3 font-bold text-primary">{scenario.score}%</td>
                      <td className="px-4 py-3 text-text-primary">{scenario.coveredSkills} of {project.requiredSkills.length} covered</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {scenario.employeeIds.map((id) => employees.find((item) => item.id === id)?.name.split(' ')[0]).filter(Boolean).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="btn-secondary text-xs py-1 px-3" onClick={() => setTeamIds(scenario.employeeIds)}>
                          Load Alternative
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </Reveal>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAllocation}
        title="Deploy Workforce Twin Allocation"
        message={`Replace the live team for "${project.name}" with the ${teamIds.length} simulated employees? This will update the primary project roster across all modules.`}
        confirmLabel="Confirm Allocation"
      />
    </div>
  );
}
