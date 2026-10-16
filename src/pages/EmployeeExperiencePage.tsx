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
import { Reveal } from '@/components/Reveal';
import { useData } from '@/context/DataContext';
import { demoEmployeeId } from '@/data/mockData';
import {
  calculateEmployeeUtilization,
  daysUntil,
  formatDate,
  getEmployeeProjects,
  getSkillName,
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
        <h1 className="text-lg font-semibold text-text-primary">Demo employee profile unavailable</h1>
        <p className="mt-2 text-sm text-text-secondary">Reset the demo data in Settings to restore the employee preview.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${employee.name.split(' ')[0]}`}
        description="Your real-time project assignments, capacity load, and personalized development roadmaps."
        breadcrumb={['Home', 'My Dashboard']}
      />

      {/* Hero Welcome Card */}
      <Reveal direction="down">
        <section className="card p-6 sm:p-8 bg-gradient-to-r from-primary/20 via-base-card to-cyan/15 border-primary/30 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={employee.name} color={employee.avatarColor} size="lg" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-cyan">Personal Intelligence Portal</div>
                <h2 className="mt-1 text-2xl font-extrabold text-text-primary tracking-tight">{employee.role}</h2>
                <p className="mt-1 text-xs sm:text-sm text-text-secondary">{employee.department} · {employee.yearsExperience} Years Industry Experience</p>
              </div>
            </div>
            <Link to="/my-projects" className="btn-primary w-fit shadow-md">
              View My Projects <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </Reveal>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal delay={60}>
          <div className="card p-5 border-base-border/70 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Projects</span>
              <FolderKanban size={18} className="text-primary" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-text-primary tracking-tight">{assignedProjects.length}</div>
            <div className="mt-1 text-xs text-text-secondary">Assigned pipelines</div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="card p-5 border-base-border/70 hover:border-cyan/40 transition-colors">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan">Estimated Workload</span>
              <Target size={18} className="text-cyan" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-cyan tracking-tight">{utilization}%</div>
            <div className="mt-2">
              <CapacityBar
                utilization={utilization}
                overloadedThreshold={settings.overloadedThreshold}
                underutilizedThreshold={settings.underutilizedThreshold}
                showLabel={false}
              />
            </div>
          </div>
        </Reveal>

        <Reveal delay={180}>
          <div className="card p-5 border-base-border/70 hover:border-success/40 transition-colors">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider text-success">Active Learning</span>
              <GraduationCap size={18} className="text-success" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-success tracking-tight">{activeTraining.length}</div>
            <div className="mt-1 text-xs text-text-secondary">
              {employee.trainingAssignments.filter((training) => training.status === 'completed').length} completed courses
            </div>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <div className="card p-5 border-base-border/70 hover:border-warning/40 transition-colors">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-xs font-semibold uppercase tracking-wider text-warning">Growth Goals</span>
              <Sparkles size={18} className="text-warning" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-warning tracking-tight">{growthSkills.length}</div>
            <div className="mt-1 text-xs text-text-secondary">Based on project skill requirements</div>
          </div>
        </Reveal>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        {/* Current Projects */}
        <Reveal delay={120}>
          <section className="card p-5 flex flex-col h-full shadow-lg">
            <div className="mb-4 flex items-center justify-between pb-3 border-b border-base-border/50">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Current Assigned Projects</h3>
                <p className="text-xs text-text-secondary mt-0.5">Project deliveries and key milestones</p>
              </div>
              <Link to="/my-projects" className="btn-secondary text-xs py-1 px-3">
                All Projects <ArrowRight size={13} />
              </Link>
            </div>
            {assignedProjects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-base-border p-6 text-xs text-text-secondary text-center">
                No active project assignments.
              </p>
            ) : (
              <div className="space-y-3">
                {assignedProjects.slice(0, 4).map((project) => {
                  const left = daysUntil(project.deadline);
                  return (
                    <div key={project.id} className="p-3.5 rounded-xl border border-base-border/60 bg-base-bg/60 hover:border-primary/40 transition-colors">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-text-primary truncate">{project.name}</h4>
                          <p className="mt-1 text-xs text-text-secondary line-clamp-2 leading-relaxed">{project.description}</p>
                        </div>
                        <StatusBadge status={project.status} />
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-text-secondary font-mono pt-2 border-t border-base-border/30">
                        <CalendarClock size={13} className="text-primary" />
                        <span>Due {formatDate(project.deadline)}</span>
                        <span>·</span>
                        <span className={left <= 14 ? 'text-warning font-semibold' : ''}>
                          {left >= 0 ? `${left} days left` : `${Math.abs(left)} days overdue`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </Reveal>

        {/* Development Roadmap */}
        <Reveal delay={180}>
          <section className="card p-5 flex flex-col h-full shadow-lg">
            <div className="mb-4 flex items-center justify-between pb-3 border-b border-base-border/50">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Development Roadmap</h3>
                <p className="text-xs text-text-secondary mt-0.5">Curated coursework for current roles</p>
              </div>
              <Link to="/roadmap" className="btn-secondary text-xs py-1 px-3">
                Full Roadmap <ArrowRight size={13} />
              </Link>
            </div>
            {growthSkills.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/25">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">Project Skills to Develop</p>
                <div className="flex flex-wrap gap-1.5">
                  {growthSkills.slice(0, 4).map((requirement) => (
                    <SkillTag key={requirement.skillId} skillId={requirement.skillId} />
                  ))}
                </div>
              </div>
            )}
            {activeTraining.length === 0 ? (
              <p className="rounded-xl border border-dashed border-base-border p-6 text-xs text-text-secondary text-center">
                No courses currently in progress.
              </p>
            ) : (
              <div className="space-y-3">
                {activeTraining.slice(0, 3).map((training) => (
                  <div key={training.id} className="p-3 rounded-xl border border-base-border/60 bg-base-bg/60">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-primary/15 border border-primary/30 p-2 text-primary flex-shrink-0">
                        <GraduationCap size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-text-primary truncate">{training.courseName}</div>
                        <div className="text-[11px] text-text-secondary mt-0.5">{training.provider} · {getSkillName(training.skillId)}</div>
                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-base-border/60">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan transition-all duration-500" style={{ width: `${training.progress}%` }} />
                        </div>
                        <div className="mt-1 text-right text-[10px] text-text-secondary font-mono">{training.progress}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>
      </div>

      {/* Skill Profile Snapshot */}
      <Reveal delay={240}>
        <section className="card p-5 shadow-lg">
          <div className="mb-4 flex items-center justify-between pb-3 border-b border-base-border/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={17} className="text-success" />
              <h3 className="text-sm font-bold text-text-primary">Verified Competency Inventory</h3>
            </div>
            <span className="text-xs text-text-secondary">{employee.skills.length} skills recorded</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {employee.skills.slice(0, 9).map((skill) => (
              <div key={skill.skillId} className="flex items-center justify-between p-2.5 rounded-xl border border-base-border/60 bg-base-bg/60">
                <span className="text-xs font-semibold text-text-primary">{getSkillName(skill.skillId)}</span>
                <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  Level {skill.level}/5
                </span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>
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
    <div className="space-y-6">
      <PageHeader
        title="My Assigned Projects"
        description="Detailed project briefs, deliverables, team composition, and technical competencies."
        breadcrumb={['Home', 'My Projects']}
      />
      {!employee || assignedProjects.length === 0 ? (
        <div className="card p-8 text-center text-sm text-text-secondary">No project assignments to display.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assignedProjects.map((project, index) => {
            const active = project.status !== 'completed';
            const gaps = active ? project.requiredSkills.filter((requirement) =>
              (employee.skills.find((skill) => skill.skillId === requirement.skillId)?.level ?? 0) < requirement.minLevel
            ) : [];
            const team = project.assignedEmployeeIds.map((id) => employees.find((item) => item.id === id)).filter(Boolean);
            return (
              <Reveal key={project.id} delay={index * 60}>
                <article className={`card p-5 h-full flex flex-col justify-between border-base-border/70 ${selectedProjectId === project.id ? 'border-primary shadow-glow' : ''}`}>
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h2 className="text-sm font-bold text-text-primary">{project.name}</h2>
                        <p className="mt-1 text-xs text-text-secondary leading-relaxed">{project.description}</p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-text-secondary mb-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-base-border/70 bg-base-bg/60 px-2.5 py-1">
                        <Clock3 size={13} className="text-primary" /> Due {formatDate(project.deadline)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-base-border/70 bg-base-bg/60 px-2.5 py-1">
                        <FolderKanban size={13} className="text-cyan" /> {team.length}/{project.targetTeamSize} team members
                      </span>
                    </div>

                    <div className="mb-4">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Project Skill Needs</div>
                      <div className="flex flex-wrap gap-1.5">
                        {project.requiredSkills.map((requirement) => {
                          const level = employee.skills.find((skill) => skill.skillId === requirement.skillId)?.level ?? 0;
                          const matched = level >= requirement.minLevel;
                          return (
                            <span
                              key={requirement.skillId}
                              className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium ${
                                matched
                                  ? 'border-success/30 bg-success/10 text-success'
                                  : 'border-warning/30 bg-warning/10 text-warning'
                              }`}
                            >
                              {getSkillName(requirement.skillId)} · {matched ? `L${level}` : `L${level} → L${requirement.minLevel}`}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {gaps.length > 0 && active && (
                      <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 mb-4">
                        <div className="text-xs font-semibold text-warning mb-1.5">Growth Opportunities for this Project</div>
                        <div className="flex flex-wrap gap-1.5">{gaps.map((gap) => <SkillTag key={gap.skillId} skillId={gap.skillId} />)}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-t border-base-border/40 pt-3">
                    <div className="flex -space-x-1.5">
                      {team.slice(0, 5).map((member) => member && <Avatar key={member.id} name={member.name} color={member.avatarColor} size="sm" />)}
                    </div>
                    <span className="text-[11px] text-text-secondary ml-1">Assigned colleagues</span>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
