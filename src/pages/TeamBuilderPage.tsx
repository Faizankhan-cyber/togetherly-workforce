import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  UsersRound,
  Sparkles,
  GitCompareArrows,
  CheckCircle2,
  AlertTriangle,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { MatchScore } from '@/components/MatchScore';
import { Reveal } from '@/components/Reveal';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { useData } from '@/context/DataContext';
import {
  generateRecommendations,
  getTeamSkillCoverage,
  getSkillName,
  calculateEmployeeUtilization,
  getActiveAssignmentCount,
  MAX_CONCURRENT_PROJECTS,
} from '@/utils';

export function TeamBuilderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateProjectId = (location.state as { projectId?: string } | null)?.projectId;

  const {
    projects,
    employees,
    settings,
    updateProject,
    showToast,
    addActivity,
  } = useData();

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active' || p.status === 'planning'),
    [projects]
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    stateProjectId || activeProjects[0]?.id || projects[0]?.id || ''
  );

  useEffect(() => {
    if (stateProjectId) setSelectedProjectId(stateProjectId);
  }, [stateProjectId]);

  const project = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (project) {
      setTeamIds(project.assignedEmployeeIds);
    }
  }, [project]);

  const hasDraftChanges = useMemo(() => {
    if (!project) return false;
    if (project.assignedEmployeeIds.length !== teamIds.length) return true;
    return project.assignedEmployeeIds.some((id) => !teamIds.includes(id));
  }, [project, teamIds]);

  // Recommendations
  const recommendations = useMemo(() => {
    if (!project) return [];
    return generateRecommendations(employees, project, settings.matchWeights, projects, settings);
  }, [employees, project, projects, settings]);

  const scoreMap = useMemo(
    () => new Map(recommendations.map((r) => [r.employeeId, r])),
    [recommendations]
  );

  // Team metrics
  const coverage = useMemo(() => {
    if (!project) return [];
    return getTeamSkillCoverage(teamIds, project, employees);
  }, [teamIds, project, employees]);

  const coveredCount = coverage.filter((c) => c.covered).length;
  const coveragePercent = project?.requiredSkills.length
    ? Math.round((coveredCount / project.requiredSkills.length) * 100)
    : 100;

  const teamAverageFit = useMemo(() => {
    if (teamIds.length === 0) return 0;
    const total = teamIds.reduce((sum, id) => sum + (scoreMap.get(id)?.matchScore || 0), 0);
    return Math.round(total / teamIds.length);
  }, [teamIds, scoreMap]);

  function toggleEmployee(employeeId: string) {
    if (teamIds.includes(employeeId)) {
      setTeamIds(teamIds.filter((id) => id !== employeeId));
    } else {
      if (project && teamIds.length >= project.targetTeamSize) {
        showToast('warning', `Team is currently at target size (${project.targetTeamSize}). Remove a member to add another.`);
        return;
      }
      setTeamIds([...teamIds, employeeId]);
    }
  }

  function autoAssembleTeam() {
    if (!project) return;
    // Pick top feasible candidates up to targetTeamSize
    const eligible = recommendations
      .filter((r) => r.capacityFeasible)
      .slice(0, project.targetTeamSize)
      .map((r) => r.employeeId);

    setTeamIds(eligible);
    showToast('info', `Algorithmic best-fit team of ${eligible.length} selected.`);
  }

  function handleSaveRoster() {
    if (!project) return;
    updateProject(project.id, { assignedEmployeeIds: teamIds });
    addActivity(`Updated staffing roster for ${project.name} (${teamIds.length} members)`, 'assignment');
    showToast('success', `Roster updated for "${project.name}".`);
    setConfirmOpen(false);
  }

  function resetRoster() {
    if (project) setTeamIds(project.assignedEmployeeIds);
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Builder" description="Assemble high-performance balanced teams" breadcrumb={['Home', 'Team Builder']} />
        <div className="card p-12 text-center text-text-secondary">
          <p className="text-sm font-semibold text-text-primary">No active projects available</p>
          <p className="text-xs mt-1">Please create a project first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Predictive Team Builder"
        description="Select projects, evaluate algorithmic talent matches, and assemble balanced cross-functional squads."
        breadcrumb={['Home', 'Team Builder']}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-secondary text-xs"
              onClick={() => navigate('/workforce-twin', { state: { projectId: project.id } })}
            >
              <GitCompareArrows size={14} className="text-cyan" />
              <span>Open in Workforce Twin</span>
            </button>
            <button
              className="btn-secondary text-xs"
              onClick={resetRoster}
              disabled={!hasDraftChanges}
            >
              Discard Changes
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() => setConfirmOpen(true)}
              disabled={!hasDraftChanges}
            >
              <Check size={14} />
              <span>Save Team Roster</span>
            </button>
          </div>
        }
      />

      {/* Project Selector & Health Bar */}
      <Reveal direction="down">
        <div className="card p-5 bg-gradient-to-r from-primary/10 via-base-card to-cyan/10 border-primary/30 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="max-w-xl">
              <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">
                Target Project:
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="input-field w-full text-sm font-bold bg-base-bg/90 border-primary/40 focus:border-primary cursor-pointer"
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-base-card text-text-primary">
                    {p.name} ({p.department}) · {p.assignedEmployeeIds.length}/{p.targetTeamSize} Staffed
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-text-secondary line-clamp-2 leading-relaxed">
                {project.description}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[340px]">
              <div className="p-3 rounded-xl border border-base-border/70 bg-base-bg/70 shadow-sm">
                <div className="text-xl font-extrabold text-cyan font-mono">{teamIds.length} / {project.targetTeamSize}</div>
                <div className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">Staffing Count</div>
              </div>
              <div className="p-3 rounded-xl border border-base-border/70 bg-base-bg/70 shadow-sm">
                <div className={`text-xl font-extrabold font-mono ${coveragePercent === 100 ? 'text-success' : 'text-warning'}`}>
                  {coveragePercent}%
                </div>
                <div className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">Skill Coverage</div>
              </div>
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/10 shadow-sm">
                <div className="text-xl font-extrabold text-primary font-mono">{teamAverageFit}%</div>
                <div className="text-[10px] uppercase tracking-wider text-primary mt-0.5">Average Fit</div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Main Grid: Candidate Recommendations vs Active Squad */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.85fr]">
        {/* Candidate List */}
        <div className="space-y-4">
          <div className="card p-4 flex items-center justify-between border-base-border/70">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Algorithmic Talent Pool</h2>
              <p className="text-xs text-text-secondary">Ranked by skills fit ({settings.matchWeights.skills}%), experience ({settings.matchWeights.experience}%), and availability ({settings.matchWeights.availability}%)</p>
            </div>
            <button
              className="btn-secondary text-xs font-semibold"
              onClick={autoAssembleTeam}
            >
              <Sparkles size={14} className="text-primary" />
              <span>Auto-Assemble Squad</span>
            </button>
          </div>

          <div className="space-y-3">
            {recommendations.map((rec, idx) => {
              const emp = employees.find((e) => e.id === rec.employeeId);
              if (!emp) return null;
              const isAssigned = teamIds.includes(emp.id);
              const util = calculateEmployeeUtilization(emp.id, projects, emp.targetUtilization);
              const assignments = getActiveAssignmentCount(emp.id, projects);

              return (
                <Reveal key={emp.id} delay={idx * 25}>
                  <div
                    className={`card p-4 transition-all duration-200 ${
                      isAssigned
                        ? 'border-primary/60 bg-primary/10 shadow-[0_0_20px_rgba(139,92,246,0.12)] ring-1 ring-primary/40'
                        : 'hover:border-base-border hover:bg-base-hover/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <MatchScore score={rec.matchScore} size="md" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Avatar name={emp.name} color={emp.avatarColor} size="sm" />
                            <h3 className="text-sm font-bold text-text-primary truncate">{emp.name}</h3>
                            <StatusBadge status={emp.availability} />
                          </div>

                          <p className="text-xs text-text-secondary mt-1">
                            {emp.role} · {emp.yearsExperience || emp.experienceYears} yrs exp · {emp.department}
                          </p>

                          {/* Reasons & Risks */}
                          <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                            {rec.reasons.slice(0, 2).map((r) => (
                              <span key={r} className="inline-flex items-center gap-1 text-primary">
                                <CheckCircle2 size={12} /> {r}
                              </span>
                            ))}
                            {rec.risks.slice(0, 1).map((risk) => (
                              <span key={risk} className="inline-flex items-center gap-1 text-warning">
                                <AlertTriangle size={12} /> {risk}
                              </span>
                            ))}
                          </div>

                          {/* Skill Tags */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {rec.matchedSkills.map((sid) => (
                              <span key={sid} className="text-[11px] font-medium px-2 py-0.5 rounded border border-success/30 bg-success/10 text-success">
                                ✓ {getSkillName(sid)}
                              </span>
                            ))}
                            {rec.missingSkills.map((sid) => (
                              <span key={sid} className="text-[11px] font-medium px-2 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning">
                                Gap: {getSkillName(sid)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-base-border/40">
                        <div className="text-right">
                          <div className="text-[11px] text-text-secondary">Load: {util}%</div>
                          <div className="text-[10px] text-text-secondary font-mono">{assignments}/{MAX_CONCURRENT_PROJECTS} projects</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleEmployee(emp.id)}
                          className={`btn-primary text-xs py-1.5 px-3.5 ${
                            isAssigned
                              ? 'bg-critical/20 hover:bg-critical/30 text-critical border border-critical/40'
                              : ''
                          }`}
                        >
                          {isAssigned ? (
                            <>
                              <X size={13} />
                              <span>Remove</span>
                            </>
                          ) : (
                            <>
                              <Plus size={13} />
                              <span>Add to Squad</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Selected Squad & Skill Coverage Sidebar */}
        <div className="space-y-5 sticky top-20 self-start">
          {/* Active Squad */}
          <div className="card p-5 space-y-4 shadow-xl border-primary/30">
            <div className="flex items-center justify-between pb-3 border-b border-base-border/60">
              <div className="flex items-center gap-2">
                <UsersRound size={18} className="text-cyan" />
                <h3 className="text-sm font-bold text-text-primary">
                  Proposed Squad Roster ({teamIds.length}/{project.targetTeamSize})
                </h3>
              </div>
              <span className={`text-xs font-mono font-bold ${teamIds.length === project.targetTeamSize ? 'text-success' : 'text-warning'}`}>
                {teamIds.length === project.targetTeamSize ? 'Target Reached' : `${project.targetTeamSize - teamIds.length} Seats Open`}
              </span>
            </div>

            <div className="space-y-2.5">
              {teamIds.map((id) => {
                const member = employees.find((e) => e.id === id);
                if (!member) return null;
                const rec = scoreMap.get(id);

                return (
                  <div key={id} className="p-3 rounded-xl bg-base-bg/70 border border-base-border/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={member.name} color={member.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text-primary truncate">{member.name}</div>
                        <div className="text-[10px] text-text-secondary truncate">{member.role}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                        {rec?.matchScore ?? 0}%
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleEmployee(member.id)}
                        className="text-text-secondary hover:text-critical p-1 transition-colors"
                        title="Remove member"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {teamIds.length === 0 && (
                <p className="text-xs text-text-secondary p-6 text-center border border-dashed border-base-border rounded-xl">
                  Squad is empty. Click "+ Add to Squad" on any candidate from the talent pool.
                </p>
              )}
            </div>

            {hasDraftChanges && (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between">
                <span className="text-xs text-primary font-medium">Unsaved roster modifications</span>
                <button
                  type="button"
                  className="btn-primary text-xs py-1 px-3"
                  onClick={() => setConfirmOpen(true)}
                >
                  Save Roster
                </button>
              </div>
            )}
          </div>

          {/* Skill Coverage Analysis */}
          <div className="card p-5 space-y-4 shadow-xl border-base-border/70">
            <div className="flex items-center justify-between pb-3 border-b border-base-border/60">
              <h3 className="text-sm font-bold text-text-primary">Required Skill Fulfillment</h3>
              <span className="text-xs font-mono font-bold text-cyan">{coveredCount}/{project.requiredSkills.length}</span>
            </div>

            <div className="space-y-2">
              {coverage.map((c) => (
                <div key={c.skillId} className="p-2.5 rounded-xl bg-base-bg/60 border border-base-border/60 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-text-primary">{getSkillName(c.skillId)}</div>
                    <div className="text-[10px] text-text-secondary mt-0.5">
                      Required: L{c.minLevel} · Best in Squad: L{c.bestLevel}
                    </div>
                  </div>

                  <span
                    className={`font-semibold px-2 py-0.5 rounded-md border text-[11px] ${
                      c.covered
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-warning/30 bg-warning/10 text-warning'
                    }`}
                  >
                    {c.covered ? 'Covered' : 'Gap'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSaveRoster}
        title="Deploy Team Roster"
        message={`Update the live assigned team for "${project.name}" to the ${teamIds.length} selected employees? This will update project capacity and employee workloads.`}
        confirmLabel="Apply Team"
      />
    </div>
  );
}
