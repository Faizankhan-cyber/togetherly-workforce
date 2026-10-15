import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Plus,
  Check,
  X,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Users,
  Target,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { MatchScore } from '@/components/MatchScore';
import { SkillTag } from '@/components/SkillTag';
import { ProjectForm } from '@/components/ProjectForm';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { useData } from '@/context/DataContext';
import {
  generateRecommendations,
  getTeamSkillCoverage,
  getSkillName,
  getProjectStaffingProgress,
  formatDate,
} from '@/utils';
import type { Project, RecommendationResult, Employee } from '@/types';

type Step = 'select' | 'review' | 'generate' | 'confirm';

export function TeamBuilderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, employees, settings, assignEmployeeToProject, unassignEmployeeFromProject, showToast, addActivity } = useData();
  const [step, setStep] = useState<Step>('select');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [weights, setWeights] = useState(settings.matchWeights);

  const locationState = location.state as { projectId?: string } | null;

  useEffect(() => {
    if (locationState?.projectId) {
      setSelectedProjectId(locationState.projectId);
      setStep('review');
    }
  }, [locationState]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  function handleGenerate() {
    if (!selectedProject) return;
    const recs = generateRecommendations(employees, selectedProject, weights, projects, settings);
    setRecommendations(recs);
    setSelectedTeam(selectedProject.assignedEmployeeIds.slice());
    setStep('generate');
  }

  function toggleTeamMember(empId: string) {
    setSelectedTeam((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : prev.length < (selectedProject?.targetTeamSize ?? 0)
          ? [...prev, empId]
          : prev
    );
  }

  function handleConfirmTeam() {
    if (!selectedProject) return;
    const currentAssigned = selectedProject.assignedEmployeeIds;
    currentAssigned.forEach((id) => {
      if (!selectedTeam.includes(id)) unassignEmployeeFromProject(id, selectedProject.id);
    });
    selectedTeam.forEach((id) => {
      if (!currentAssigned.includes(id)) {
        assignEmployeeToProject(id, selectedProject.id);
      }
    });
    addActivity({ type: 'team', message: `Team confirmed for "${selectedProject.name}" (${selectedTeam.length} members)` });
    showToast('success', `Team confirmed for ${selectedProject.name}`);
    setConfirmOpen(false);
    setStep('confirm');
  }

  function reset() {
    setStep('select');
    setSelectedProjectId(null);
    setRecommendations([]);
    setSelectedTeam([]);
  }

  const stepNum = step === 'select' ? 1 : step === 'review' ? 2 : step === 'generate' ? 3 : 4;

  return (
    <div>
      <PageHeader
        title="Team Builder"
        description="Generate AI-powered team recommendations based on skills, experience, and availability"
        breadcrumb={['Home', 'Team Builder']}
        actions={selectedProjectId && (
          <button className="btn-secondary" onClick={() => navigate('/workforce-twin', { state: { projectId: selectedProjectId } })}>
            Open Workforce Twin <ArrowRight size={15} />
          </button>
        )}
      />

      {/* Stepper */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Select Project', step: 'select' as Step },
            { num: 2, label: 'Review Requirements', step: 'review' as Step },
            { num: 3, label: 'Generate Team', step: 'generate' as Step },
            { num: 4, label: 'Confirm', step: 'confirm' as Step },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  stepNum >= s.num ? 'bg-primary text-white' : 'bg-base-hover text-text-secondary'
                }`}>
                  {stepNum > s.num ? <Check size={16} /> : s.num}
                </div>
                <span className={`text-sm hidden sm:inline ${stepNum >= s.num ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {s.label}
                </span>
              </div>
              {i < 3 && <div className={`h-px flex-1 mx-2 sm:mx-4 ${stepNum > s.num ? 'bg-primary' : 'bg-base-border'}`} />}
            </div>
          ))}
        </div>
      </div>

      {step === 'select' && (
        <ProjectSelectStep
          projects={projects}
          selectedId={selectedProjectId}
          onSelect={(id) => { setSelectedProjectId(id); setStep('review'); }}
          onCreateNew={() => setFormOpen(true)}
        />
      )}

      {step === 'review' && selectedProject && (
        <ReviewStep
          project={selectedProject}
          employees={employees}
          weights={weights}
          onWeightsChange={setWeights}
          onBack={() => setStep('select')}
          onGenerate={handleGenerate}
        />
      )}

      {step === 'generate' && selectedProject && (
        <GenerateStep
          project={selectedProject}
          employees={employees}
          recommendations={recommendations}
          selectedTeam={selectedTeam}
          onToggleMember={toggleTeamMember}
          onRegenerate={handleGenerate}
          onBack={() => setStep('review')}
          onConfirm={() => setConfirmOpen(true)}
        />
      )}

      {step === 'confirm' && selectedProject && (
        <ConfirmStep project={selectedProject} employees={employees} onReset={reset} />
      )}

      <ProjectForm open={formOpen} onClose={() => setFormOpen(false)} />
      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmTeam}
        title="Confirm Team Assignment"
        message={`Assign ${selectedTeam.length} employees to "${selectedProject?.name}"? This will update the project's team roster.`}
        confirmLabel="Confirm Team"
      />
    </div>
  );
}

function ProjectSelectStep({ projects, selectedId, onSelect, onCreateNew }: {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}) {
  const activeProjects = projects.filter((p) => p.status !== 'completed');
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Select a Project</h3>
        <button className="btn-secondary" onClick={onCreateNew}><Plus size={16} /> New Project</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {activeProjects.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`text-left p-4 rounded-xl border transition-all duration-200 ${
              selectedId === p.id ? 'border-primary bg-primary/5' : 'border-base-border bg-base-bg hover:border-primary/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">{p.name}</span>
              <StatusBadge status={p.status} />
            </div>
            <p className="text-xs text-text-secondary line-clamp-2 mb-2">{p.description}</p>
            <div className="flex items-center gap-3 text-xs text-text-secondary">
              <span>{p.assignedEmployeeIds.length}/{p.targetTeamSize} assigned</span>
              <span>•</span>
              <span>{p.requiredSkills.length} skills required</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewStep({ project, employees, weights, onWeightsChange, onBack, onGenerate }: {
  project: Project;
  employees: Employee[];
  weights: { skillMatch: number; experience: number; availability: number };
  onWeightsChange: (w: { skillMatch: number; experience: number; availability: number }) => void;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const coverage = getTeamSkillCoverage(project.assignedEmployeeIds, project, employees);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-1">{project.name}</h3>
        <p className="text-sm text-text-secondary mb-4">{project.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="text-xs text-text-secondary uppercase">Priority</label>
            <div className="mt-1"><StatusBadge status={project.priority} /></div>
          </div>
          <div>
            <label className="text-xs text-text-secondary uppercase">Team Size</label>
            <div className="mt-1 text-sm text-text-primary">{project.targetTeamSize} members</div>
          </div>
          <div>
            <label className="text-xs text-text-secondary uppercase">Start</label>
            <div className="mt-1 text-sm text-text-primary">{formatDate(project.startDate)}</div>
          </div>
          <div>
            <label className="text-xs text-text-secondary uppercase">Deadline</label>
            <div className="mt-1 text-sm text-text-primary">{formatDate(project.deadline)}</div>
          </div>
        </div>

        <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Required Skills</h4>
        <div className="space-y-2 mb-5">
          {coverage.map((c) => (
            <div key={c.skillId} className="flex items-center justify-between p-2 rounded-lg bg-base-bg border border-base-border">
              <div className="flex items-center gap-2">
                <SkillTag skillId={c.skillId} />
                <span className="text-xs text-text-secondary">Min Level {c.minLevel}</span>
              </div>
              {c.covered ? (
                <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 size={14} /> Covered</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-critical"><AlertCircle size={14} /> Gap</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button className="btn-secondary" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          <button className="btn-primary" onClick={onGenerate}><Sparkles size={16} /> Generate Team</button>
        </div>
      </div>

      {/* Scoring weights */}
      <div className="card p-5 h-fit">
        <h4 className="text-sm font-semibold text-text-primary mb-1">Scoring Weights</h4>
        <p className="text-xs text-text-secondary mb-4">Adjust how the algorithm weights each factor.</p>
        <div className="space-y-4">
          {([
            { key: 'skillMatch', label: 'Skill Match' },
            { key: 'experience', label: 'Experience' },
            { key: 'availability', label: 'Availability' },
          ] as const).map((w) => (
            <div key={w.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-primary">{w.label}</span>
                <span className="text-sm font-medium text-primary">{weights[w.key]}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={weights[w.key]}
                onChange={(e) => {
                  const newWeights = { ...weights, [w.key]: Number(e.target.value) };
                  const total = newWeights.skillMatch + newWeights.experience + newWeights.availability;
                  if (total > 0) {
                    onWeightsChange({
                      skillMatch: Math.round((newWeights.skillMatch / total) * 100),
                      experience: Math.round((newWeights.experience / total) * 100),
                      availability: 100 - Math.round((newWeights.skillMatch / total) * 100) - Math.round((newWeights.experience / total) * 100),
                    });
                  }
                }}
                className="w-full accent-primary"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-base-bg border border-base-border flex gap-2">
          <Info size={14} className="text-cyan flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary">This is a deterministic scoring algorithm, not an AI model. Weights are initial design choices.</p>
        </div>
      </div>
    </div>
  );
}

function GenerateStep({ project, employees, recommendations, selectedTeam, onToggleMember, onRegenerate, onBack, onConfirm }: {
  project: Project;
  employees: Employee[];
  recommendations: RecommendationResult[];
  selectedTeam: string[];
  onToggleMember: (id: string) => void;
  onRegenerate: () => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const coverage = getTeamSkillCoverage(selectedTeam, project, employees);
  const missingCount = coverage.filter((c) => !c.covered).length;

  function toggleCompare(id: string) {
    setCompareIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Recommendations list */}
      <div className="lg:col-span-2 card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Candidate Recommendations</h3>
          <button className="btn-ghost" onClick={onRegenerate}><RefreshCw size={14} /> Regenerate</button>
        </div>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {recommendations.map((rec) => {
            const emp = employees.find((e) => e.id === rec.employeeId);
            if (!emp) return null;
            const inTeam = selectedTeam.includes(emp.id);
            const inCompare = compareIds.includes(emp.id);
            return (
              <div
                key={rec.employeeId}
                className={`p-3 rounded-xl border transition-all ${inTeam ? 'border-primary/40 bg-primary/5' : 'border-base-border bg-base-bg'}`}
              >
                <div className="flex items-start gap-3">
                  <MatchScore score={rec.matchScore} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Avatar name={emp.name} color={emp.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">{emp.name}</div>
                        <div className="text-xs text-text-secondary truncate">{emp.role} • {emp.yearsExperience}y exp</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {rec.matchedSkills.map((sid) => (
                        <span key={sid} className="text-xs px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">{getSkillName(sid)}</span>
                      ))}
                      {rec.missingSkills.map((sid) => (
                        <span key={sid} className="text-xs px-1.5 py-0.5 rounded bg-critical/10 text-critical border border-critical/20">{getSkillName(sid)}</span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-text-secondary">
                      Util: {rec.currentUtilization}% • Available: {rec.availableCapacity}%
                    </div>
                    <details className="mt-2">
                      <summary className="text-xs text-primary cursor-pointer hover:underline">Reasons ({rec.reasons.length})</summary>
                      <ul className="mt-1 space-y-0.5">
                        {rec.reasons.map((r, i) => (
                          <li key={i} className="text-xs text-text-secondary flex items-start gap-1">
                            <span className="text-primary mt-0.5">•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => onToggleMember(emp.id)}
                      disabled={!inTeam && (!rec.capacityFeasible || selectedTeam.length >= project.targetTeamSize)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        inTeam ? 'bg-primary text-white' : 'bg-base-hover text-text-primary hover:bg-base-border'
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {inTeam ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                    <button
                      onClick={() => toggleCompare(emp.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        inCompare ? 'bg-cyan/20 text-cyan' : 'bg-base-hover text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Compare
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team summary */}
      <div className="card p-5 h-fit sticky top-20">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Users size={16} /> Proposed Team ({selectedTeam.length}/{project.targetTeamSize})
        </h3>

        {/* Skill coverage */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Skill Coverage</h4>
          <div className="space-y-1.5">
            {coverage.map((c) => (
              <div key={c.skillId} className="flex items-center justify-between text-xs">
                <span className="text-text-primary">{getSkillName(c.skillId)}</span>
                {c.covered ? (
                  <span className="text-success flex items-center gap-1"><CheckCircle2 size={12} /> L{c.bestLevel}</span>
                ) : (
                  <span className="text-critical flex items-center gap-1"><AlertCircle size={12} /> Gap</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Team members */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Members</h4>
          <div className="space-y-2">
            {selectedTeam.length === 0 && <p className="text-sm text-text-secondary">No members selected.</p>}
            {selectedTeam.map((id) => {
              const emp = employees.find((e) => e.id === id);
              if (!emp) return null;
              return (
                <div key={id} className="flex items-center gap-2">
                  <Avatar name={emp.name} color={emp.avatarColor} size="sm" />
                  <span className="text-sm text-text-primary flex-1 truncate">{emp.name}</span>
                  <button onClick={() => onToggleMember(id)} className="text-text-secondary hover:text-critical">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {missingCount > 0 && (
          <div className="p-3 rounded-lg bg-critical/5 border border-critical/20 mb-4 flex gap-2">
            <AlertCircle size={16} className="text-critical flex-shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary">{missingCount} skill gap{missingCount > 1 ? 's' : ''} still need coverage.</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button className="btn-secondary flex-1" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          <button className="btn-primary flex-1" onClick={onConfirm} disabled={selectedTeam.length !== project.targetTeamSize}>
            Confirm <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Compare panel */}
      {compareIds.length >= 2 && (
        <div className="lg:col-span-3 card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-border">
                  <th className="text-left py-2 px-3 text-xs text-text-secondary">Metric</th>
                  {compareIds.map((id) => {
                    const emp = employees.find((e) => e.id === id);
                    return <th key={id} className="text-left py-2 px-3 text-xs text-text-primary">{emp?.name}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-base-border/50">
                  <td className="py-2 px-3 text-text-secondary">Match Score</td>
                  {compareIds.map((id) => {
                    const rec = recommendations.find((r) => r.employeeId === id);
                    return <td key={id} className="py-2 px-3 text-text-primary font-medium">{rec?.matchScore}</td>;
                  })}
                </tr>
                <tr className="border-b border-base-border/50">
                  <td className="py-2 px-3 text-text-secondary">Experience</td>
                  {compareIds.map((id) => {
                    const emp = employees.find((e) => e.id === id);
                    return <td key={id} className="py-2 px-3 text-text-primary">{emp?.yearsExperience}y</td>;
                  })}
                </tr>
                <tr className="border-b border-base-border/50">
                  <td className="py-2 px-3 text-text-secondary">Utilization</td>
                  {compareIds.map((id) => {
                    const rec = recommendations.find((r) => r.employeeId === id);
                    return <td key={id} className="py-2 px-3 text-text-primary">{rec?.currentUtilization}%</td>;
                  })}
                </tr>
                <tr className="border-b border-base-border/50">
                  <td className="py-2 px-3 text-text-secondary">Available</td>
                  {compareIds.map((id) => {
                    const rec = recommendations.find((r) => r.employeeId === id);
                    return <td key={id} className="py-2 px-3 text-text-primary">{rec?.availableCapacity}%</td>;
                  })}
                </tr>
                <tr className="border-b border-base-border/50">
                  <td className="py-2 px-3 text-text-secondary">Matched Skills</td>
                  {compareIds.map((id) => {
                    const rec = recommendations.find((r) => r.employeeId === id);
                    return <td key={id} className="py-2 px-3 text-text-primary">{rec?.matchedSkills.length}</td>;
                  })}
                </tr>
                <tr>
                  <td className="py-2 px-3 text-text-secondary">Missing Skills</td>
                  {compareIds.map((id) => {
                    const rec = recommendations.find((r) => r.employeeId === id);
                    return <td key={id} className="py-2 px-3 text-critical">{rec?.missingSkills.length}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <button className="btn-ghost mt-3" onClick={() => setCompareIds([])}>Clear comparison</button>
        </div>
      )}
    </div>
  );
}

function ConfirmStep({ project, employees, onReset }: {
  project: Project;
  employees: Employee[];
  onReset: () => void;
}) {
  const coverage = getTeamSkillCoverage(project.assignedEmployeeIds, project, employees);
  const progress = getProjectStaffingProgress(project);
  const team = project.assignedEmployeeIds.map((id) => employees.find((e) => e.id === id)).filter(Boolean);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">Team Confirmed!</h3>
        <p className="text-sm text-text-secondary mb-5">{project.assignedEmployeeIds.length} members assigned to "{project.name}"</p>

        <div className="text-left space-y-3 mb-5">
          <div className="flex items-center justify-between p-3 rounded-lg bg-base-bg border border-base-border">
            <span className="text-sm text-text-secondary">Staffing Progress</span>
            <span className="text-sm font-medium text-text-primary">{progress}%</span>
          </div>
          <div className="p-3 rounded-lg bg-base-bg border border-base-border">
            <div className="text-sm text-text-secondary mb-2">Team Members</div>
            <div className="space-y-2">
              {team.map((emp) => (
                <div key={emp!.id} className="flex items-center gap-2">
                  <Avatar name={emp!.name} color={emp!.avatarColor} size="sm" />
                  <span className="text-sm text-text-primary">{emp!.name}</span>
                  <span className="text-xs text-text-secondary">{emp!.role}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-base-bg border border-base-border">
            <div className="text-sm text-text-secondary mb-2">Skill Coverage</div>
            <div className="space-y-1">
              {coverage.map((c) => (
                <div key={c.skillId} className="flex items-center justify-between text-xs">
                  <span className="text-text-primary">{getSkillName(c.skillId)}</span>
                  {c.covered ? <span className="text-success">Covered (L{c.bestLevel})</span> : <span className="text-critical">Gap</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button className="btn-primary w-full" onClick={onReset}>
          <Target size={16} /> Build Another Team
        </button>
      </div>
    </div>
  );
}
