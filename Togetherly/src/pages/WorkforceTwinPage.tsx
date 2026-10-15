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
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { CapacityBar } from '@/components/CapacityBar';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/context/DataContext';
import {
  calculateEmployeeUtilization,
  getActiveAssignmentCount,
  generateRecommendations,
  getSkillName,
  getTeamSkillCoverage,
  ESTIMATED_PROJECT_LOAD_PERCENT,
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
      <div>
        <PageHeader title="Workforce Twin" description="Simulate, compare, and optimize a project allocation." breadcrumb={['Home', 'Workforce Twin']} />
        <div className="card p-8 text-center text-sm text-text-secondary">Create an active or planning project to start a workforce simulation.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workforce Twin"
        description="Simulate. Compare. Optimize. Test a staffing decision before it changes the live roster."
        breadcrumb={['Home', 'Workforce Twin']}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={resetSimulation} disabled={!hasDraftChanges && scenarios.length === 0}><RotateCcw size={15} /> Discard</button>
            <button className="btn-secondary" onClick={saveScenario} disabled={teamIds.length === 0}><Save size={15} /> Save alternative</button>
            <button className="btn-primary" onClick={() => setConfirmOpen(true)} disabled={!canConfirm || !hasDraftChanges}><Check size={15} /> Confirm allocation</button>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/15 via-base-card to-cyan/10 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-cyan/10 blur-3xl" />
        <div className="relative grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan"><GitCompareArrows size={15} /> Live simulation</div>
            <label className="block max-w-2xl">
              <span className="mb-2 block text-sm text-text-secondary">Select a project</span>
              <select className="input-field w-full bg-base-bg/80 text-base font-medium" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                {availableProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">{project.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-base-border bg-base-bg/60 px-4 py-3"><div className="text-xl font-semibold text-text-primary">{project.targetTeamSize}</div><div className="text-[11px] text-text-secondary">target members</div></div>
            <div className="rounded-xl border border-base-border bg-base-bg/60 px-4 py-3"><div className="text-xl font-semibold text-text-primary">{teamScore}</div><div className="text-[11px] text-text-secondary">team match</div></div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-border p-5">
            <div>
              <h2 className="font-semibold text-text-primary">Recommended talent</h2>
              <p className="mt-1 text-xs text-text-secondary">Scores explain skill fit, experience, availability, and estimated capacity.</p>
            </div>
            <button className="btn-secondary" onClick={buildBestFitTeam}><Sparkles size={15} /> Build best-fit team</button>
          </div>
          <div className="max-h-[650px] space-y-2 overflow-y-auto p-4">
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
                <article key={employee.id} className={`rounded-xl border p-4 transition-colors ${selected ? 'border-primary/40 bg-primary/5' : 'border-base-border bg-base-bg/60'}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${recommendation.matchScore >= 75 ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                      <span className="text-sm font-bold leading-none">{recommendation.matchScore}</span><span className="mt-1 text-[9px] uppercase">match</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium text-text-primary">{employee.name}</h3>
                          <p className="truncate text-xs text-text-secondary">{employee.role} · {employee.yearsExperience} years · {employee.department}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-1 sm:grid-cols-2">
                        {recommendation.reasons.map((reason) => (
                          <p key={reason} className="flex items-start gap-1.5 text-xs text-text-secondary">
                            <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-primary" />{reason}
                          </p>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {recommendation.matchedSkills.map((skillId) => <span key={skillId} className="rounded-md border border-success/20 bg-success/5 px-2 py-1 text-[11px] text-success">{getSkillName(skillId)}</span>)}
                        {recommendation.missingSkills.map((skillId) => <span key={skillId} className="rounded-md border border-warning/20 bg-warning/5 px-2 py-1 text-[11px] text-warning">Grow: {getSkillName(skillId)}</span>)}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[11px] text-text-secondary">Simulated utilization</span>
                        <div className="w-28"><CapacityBar utilization={simLoad} overloadedThreshold={settings.overloadedThreshold} underutilizedThreshold={settings.underutilizedThreshold} showLabel={false} /></div>
                        <span className="text-[11px] text-text-secondary">{simLoad}%</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMember(employee.id)}
                      disabled={!selected && (!canFit || teamIds.length >= project.targetTeamSize)}
                      aria-pressed={selected}
                      className={`inline-flex min-w-24 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${selected ? 'bg-primary text-white' : 'border border-base-border text-text-primary hover:border-primary/40 hover:bg-primary/5'}`}
                    >
                      {selected ? <><Check size={14} /> Selected</> : <><Users size={14} /> Add</>}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="font-semibold text-text-primary">Simulation summary</h2><p className="mt-1 text-xs text-text-secondary">Draft assignments do not change the saved roster.</p></div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] ${canConfirm ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{canConfirm ? 'Ready to confirm' : 'Needs attention'}</span>
            </div>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-base-border bg-base-bg p-3">
              <span className="text-sm text-text-secondary">Team size</span>
              <span className={`text-sm font-semibold ${exactTeamSize ? 'text-success' : 'text-warning'}`}>{teamIds.length} / {project.targetTeamSize}</span>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Required skill coverage</div>
              {coverage.map((item) => (
                <div key={item.skillId} className="flex items-center justify-between gap-3 rounded-lg border border-base-border/70 px-3 py-2">
                  <div><span className="text-xs text-text-primary">{getSkillName(item.skillId)}</span><span className="ml-2 text-[10px] text-text-secondary">min L{item.minLevel}</span></div>
                  <span className={`text-xs ${item.covered ? 'text-success' : 'text-warning'}`}>{item.covered ? `Covered · L${item.bestLevel}` : 'Gap'}</span>
                </div>
              ))}
            </div>
            {capacityViolations.length > 0 && <p className="mt-3 rounded-lg border border-critical/20 bg-critical/5 p-3 text-xs text-critical">Resolve unavailable or over-capacity assignments before confirming.</p>}
            {missingSkills.length > 0 && <p className="mt-3 rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs text-warning">{missingSkills.length} required skill gap{missingSkills.length === 1 ? '' : 's'} remain.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {teamIds.map((id) => {
                const employee = employees.find((item) => item.id === id);
                if (!employee) return null;
                return <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-base-border bg-base-bg py-1 pl-1 pr-2 text-xs text-text-primary"><Avatar name={employee.name} color={employee.avatarColor} size="sm" />{employee.name.split(' ')[0]}<button type="button" aria-label={`Remove ${employee.name}`} onClick={() => toggleMember(id)} className="ml-1 text-text-secondary hover:text-critical"><X size={12} /></button></span>;
              })}
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="font-semibold text-text-primary">Workload impact</h2><p className="mt-1 text-xs text-text-secondary">Before and after this draft allocation</p></div><GitCompareArrows size={17} className="text-cyan" /></div>
            <div className="space-y-3">
              {postSimulation.length === 0 && <p className="text-sm text-text-secondary">No project assignments are currently selected.</p>}
              {postSimulation.slice(0, 7).map(({ employee, before, after }) => (
                <div key={employee.id} className="flex items-center gap-2">
                  <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-xs text-text-primary">{employee.name}</span>
                  <span className="text-xs text-text-secondary">{before}%</span>
                  {after > before ? <ArrowUpRight size={13} className="text-warning" /> : after < before ? <ArrowDownRight size={13} className="text-success" /> : <span className="w-[13px]" />}
                  <span className={`w-10 text-right text-xs font-medium ${after > before ? 'text-warning' : after < before ? 'text-success' : 'text-text-secondary'}`}>{after}%</span>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-base-border pt-3 text-[11px] text-text-secondary">Estimate: {ESTIMATED_PROJECT_LOAD_PERCENT}% capacity per active project assignment. Replace this demo rule with timesheet data for a production workload model.</p>
          </section>
        </div>
      </div>

      {scenarios.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-base-border p-5">
            <div><h2 className="font-semibold text-text-primary">Compare saved alternatives</h2><p className="mt-1 text-xs text-text-secondary">Compare team match, skill coverage, and members before choosing a direction.</p></div>
            <button className="btn-ghost" onClick={() => setScenarios([])}><X size={14} /> Clear</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead><tr className="border-b border-base-border text-left text-xs text-text-secondary"><th className="px-4 py-3">Alternative</th><th className="px-4 py-3">Match score</th><th className="px-4 py-3">Skills covered</th><th className="px-4 py-3">Team members</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>
                {scenarios.map((scenario) => (
                  <tr key={scenario.id} className="border-b border-base-border/50">
                    <td className="px-4 py-3 font-medium text-text-primary">{scenario.name}</td>
                    <td className="px-4 py-3 text-primary">{scenario.score}/100</td>
                    <td className="px-4 py-3 text-text-primary">{scenario.coveredSkills}/{project.requiredSkills.length}</td>
                    <td className="px-4 py-3 text-text-secondary">{scenario.employeeIds.map((id) => employees.find((item) => item.id === id)?.name.split(' ')[0]).filter(Boolean).join(', ')}</td>
                    <td className="px-4 py-3"><button className="btn-ghost text-xs" onClick={() => setTeamIds(scenario.employeeIds)}>Load this alternative</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAllocation}
        title="Confirm workforce allocation"
        message={`Replace the saved team for "${project.name}" with ${teamIds.length} selected employees? This will update the shared project roster.`}
        confirmLabel="Confirm allocation"
      />
    </div>
  );
}
