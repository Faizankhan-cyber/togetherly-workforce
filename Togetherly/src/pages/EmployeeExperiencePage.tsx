import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FolderKanban,
  GraduationCap,
  Sparkles,
  Target,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { CapacityBar } from '@/components/CapacityBar';
import { SkillTag } from '@/components/SkillTag';
import { StatusBadge } from '@/components/StatusBadge';
import { useData } from '@/context/DataContext';
import { demoEmployeeId } from '@/data/mockData';
import {
  calculateEmployeeUtilization,
  daysUntil,
  formatDate,
  getEmployeeProjects,
  getSkillName,
  ESTIMATED_PROJECT_LOAD_PERCENT,
} from '@/utils';
import type { ProjectRequirement } from '@/types';

export function EmployeeDashboardPage() {
  const { employees, projects, settings } = useData();
  const employee = employees.find((item) => item.id === demoEmployeeId);
  const assignedProjects = useMemo(
    () => employee ? getEmployeeProjects(employee.id, projects).filter((project) => project.status !== 'completed') : [],
    [employee, projects]
  );
  const utilization = employee ? calculateEmployeeUtilization(employee.id, projects, employee.targetUtilization) : 0;
  const activeTraining = employee?.trainingAssignments.filter((training) => training.status !== 'completed') ?? [];
  const growthSkills = useMemo((): ProjectRequirement[] => {
    if (!employee) return [];
    const needs = new Map<string, ProjectRequirement>();
    for (const project of assignedProjects) {
      for (const requirement of project.requiredSkills) {
        const level = employee.skills.find((skill) => skill.skillId === requirement.skillId)?.level ?? 0;
        if (level < requirement.minLevel) needs.set(requirement.skillId, requirement);
      }
    }
    return Array.from(needs.values());
  }, [assignedProjects, employee]);

  if (!employee) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-lg font-semibold text-text-primary">Demo employee unavailable</h1>
        <p className="mt-2 text-sm text-text-secondary">Reset the demo data in Settings to restore the employee preview.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good morning, ${employee.name.split(' ')[0]}`}
        description="Your projects, capacity, and next steps — all in one place."
        breadcrumb={['Home', 'My Dashboard']}
      />

      <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/20 via-base-card to-cyan/10 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={employee.name} color={employee.avatarColor} size="lg" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan">Your workspace</div>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">{employee.role}</h2>
              <p className="mt-1 text-sm text-text-secondary">{employee.department} · {employee.yearsExperience} years experience</p>
            </div>
          </div>
          <Link to="/my-projects" className="btn-primary w-fit">
            View my projects <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center justify-between text-text-secondary"><span className="text-sm">Active projects</span><FolderKanban size={18} className="text-primary" /></div>
          <div className="mt-3 text-3xl font-semibold text-text-primary">{assignedProjects.length}</div>
          <div className="mt-1 text-xs text-text-secondary">Current assignments</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between text-text-secondary"><span className="text-sm">Estimated workload</span><Target size={18} className="text-cyan" /></div>
          <div className="mt-3 text-3xl font-semibold text-text-primary">{utilization}%</div>
          <div className="mt-2"><CapacityBar utilization={utilization} overloadedThreshold={settings.overloadedThreshold} underutilizedThreshold={settings.underutilizedThreshold} showLabel={false} /></div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between text-text-secondary"><span className="text-sm">Training in progress</span><GraduationCap size={18} className="text-success" /></div>
          <div className="mt-3 text-3xl font-semibold text-text-primary">{activeTraining.length}</div>
          <div className="mt-1 text-xs text-text-secondary">{employee.trainingAssignments.filter((training) => training.status === 'completed').length} completed</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between text-text-secondary"><span className="text-sm">Skills to grow</span><Sparkles size={18} className="text-warning" /></div>
          <div className="mt-3 text-3xl font-semibold text-text-primary">{growthSkills.length}</div>
          <div className="mt-1 text-xs text-text-secondary">Based on your project requirements</div>
        </div>
      </div>

      <p className="text-xs text-text-secondary -mt-3">
        Workload is an estimate: each active project currently counts as {ESTIMATED_PROJECT_LOAD_PERCENT}% capacity because the demo data does not include timesheets.
      </p>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-text-primary">Your current projects</h3>
              <p className="mt-1 text-xs text-text-secondary">Deadlines and status for your active assignments</p>
            </div>
            <Link to="/my-projects" className="btn-ghost">All projects <ArrowRight size={14} /></Link>
          </div>
          {assignedProjects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-base-border p-6 text-sm text-text-secondary">No active project assignments yet.</p>
          ) : (
            <div className="space-y-3">
              {assignedProjects.slice(0, 4).map((project) => {
                const left = daysUntil(project.deadline);
                return (
                  <div key={project.id} className="rounded-xl border border-base-border bg-base-bg/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-medium text-text-primary">{project.name}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{project.description}</p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                      <CalendarClock size={14} />
                      <span>Due {formatDate(project.deadline)}</span>
                      <span>·</span>
                      <span className={left <= 14 ? 'text-warning' : ''}>{left >= 0 ? `${left} days left` : `${Math.abs(left)} days overdue`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-text-primary">Development roadmap</h3>
              <p className="mt-1 text-xs text-text-secondary">Training matched to your current work</p>
            </div>
            <Link to="/roadmap" className="btn-ghost" aria-label="Open development roadmap"><ArrowRight size={16} /></Link>
          </div>
          {growthSkills.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-text-secondary">PROJECT SKILLS TO GROW</p>
              <div className="flex flex-wrap gap-2">
                {growthSkills.slice(0, 4).map((requirement) => (
                  <SkillTag key={requirement.skillId} skillId={requirement.skillId} />
                ))}
              </div>
            </div>
          )}
          {activeTraining.length === 0 ? (
            <p className="rounded-xl border border-dashed border-base-border p-4 text-sm text-text-secondary">No training in progress. Open your roadmap to see suggested learning paths.</p>
          ) : (
            <div className="space-y-3">
              {activeTraining.slice(0, 3).map((training) => (
                <div key={training.id} className="rounded-xl border border-base-border bg-base-bg/70 p-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary"><GraduationCap size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-text-primary">{training.courseName}</div>
                      <div className="mt-1 text-xs text-text-secondary">{training.provider} · {getSkillName(training.skillId)}</div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-border">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${training.progress}%` }} />
                      </div>
                      <div className="mt-1 text-right text-[11px] text-text-secondary">{training.progress}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 size={17} className="text-success" />
          <h3 className="font-semibold text-text-primary">Your skill snapshot</h3>
          <span className="ml-auto text-xs text-text-secondary">{employee.skills.length} skills recorded</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {employee.skills.slice(0, 9).map((skill) => (
            <div key={skill.skillId} className="flex items-center justify-between rounded-lg border border-base-border bg-base-bg px-3 py-2">
              <span className="text-sm text-text-primary">{getSkillName(skill.skillId)}</span>
              <span className="text-xs font-medium text-primary">Level {skill.level}/5</span>
            </div>
          ))}
        </div>
        <Link to="/roadmap" className="btn-secondary mt-4 w-fit">Open my roadmap <ArrowRight size={15} /></Link>
      </section>
    </div>
  );
}

export function EmployeeProjectsPage() {
  const { employees, projects } = useData();
  const location = useLocation();
  const selectedProjectId = (location.state as { projectId?: string } | null)?.projectId;
  const employee = employees.find((item) => item.id === demoEmployeeId);
  const assignedProjects = employee ? getEmployeeProjects(employee.id, projects) : [];

  return (
    <div>
      <PageHeader
        title="My Projects"
        description="Assignments, project requirements, and team context."
        breadcrumb={['Home', 'My Projects']}
      />
      {!employee || assignedProjects.length === 0 ? (
        <div className="card p-8 text-center text-sm text-text-secondary">No project assignments to show.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assignedProjects.map((project) => {
            const active = project.status !== 'completed';
            const gaps = active ? project.requiredSkills.filter((requirement) =>
              (employee.skills.find((skill) => skill.skillId === requirement.skillId)?.level ?? 0) < requirement.minLevel
            ) : [];
            const team = project.assignedEmployeeIds.map((id) => employees.find((item) => item.id === id)).filter(Boolean);
            return (
              <article key={project.id} className={`card p-5 ${selectedProjectId === project.id ? 'border-primary/60 shadow-glow' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-text-primary">{project.name}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{project.description}</p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-base-border px-2.5 py-1.5"><Clock3 size={13} /> Due {formatDate(project.deadline)}</span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-base-border px-2.5 py-1.5"><FolderKanban size={13} /> {team.length}/{project.targetTeamSize} team members</span>
                </div>
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Project skill needs</div>
                  <div className="flex flex-wrap gap-2">
                    {project.requiredSkills.map((requirement) => {
                      const level = employee.skills.find((skill) => skill.skillId === requirement.skillId)?.level ?? 0;
                      const matched = level >= requirement.minLevel;
                      return (
                        <span key={requirement.skillId} className={`rounded-lg border px-2.5 py-1.5 text-xs ${matched ? 'border-success/25 bg-success/5 text-success' : 'border-warning/25 bg-warning/5 text-warning'}`}>
                          {getSkillName(requirement.skillId)} · {matched ? `L${level}` : `L${level} → L${requirement.minLevel}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {gaps.length > 0 && active && (
                  <div className="mt-4 rounded-xl border border-warning/20 bg-warning/5 p-3">
                    <div className="text-xs font-medium text-warning">Growth opportunities for this project</div>
                    <div className="mt-2 flex flex-wrap gap-2">{gaps.map((gap) => <SkillTag key={gap.skillId} skillId={gap.skillId} />)}</div>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2 border-t border-base-border pt-4">
                  {team.slice(0, 5).map((member) => member && <Avatar key={member.id} name={member.name} color={member.avatarColor} size="sm" />)}
                  <span className="text-xs text-text-secondary">Your project team</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
