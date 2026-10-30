import { useState, useMemo } from 'react';
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
  Award,
  Plus,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  AlertCircle,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { TinyFishLaunchCard } from '@/components/TinyFishLaunchCard';
import { RoleDashboardHero } from '@/components/RoleDashboardHero';
import { Avatar } from '@/components/Avatar';
import { CapacityBar } from '@/components/CapacityBar';
import { SkillTag } from '@/components/SkillTag';
import { StatusBadge } from '@/components/StatusBadge';
import { Reveal } from '@/components/Reveal';
import { TrainingSubmissionModal } from '@/components/TrainingSubmissionModal';
import { EvidenceReviewModal } from '@/components/EvidenceReviewModal';
import { useData } from '@/context/DataContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import {
  calculateEmployeeUtilization,
  daysUntil,
  formatDate,
  getEmployeeProjects,
  getSkillName,
  getUtilizationStatus,
} from '@/utils';
import type { ProjectRequirement, TrainingSubmission } from '@/types';

export function EmployeeDashboardPage() {
  const { projects, settings, submissions } = useData();
  const employee = useCurrentEmployee();
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<TrainingSubmission | null>(null);
  const [resubmitClaim, setResubmitClaim] = useState<TrainingSubmission | undefined>(undefined);
  const [initialClaimData, setInitialClaimData] = useState<Partial<TrainingSubmission> | undefined>(undefined);

  const employeeSubmissions = useMemo(() => {
    return employee ? submissions.filter((s) => s.employeeId === employee.id) : [];
  }, [employee, submissions]);
  const assignedProjects = useMemo(
    () => employee ? getEmployeeProjects(employee.id, projects).filter((project) => project.status !== 'completed') : [],
    [employee, projects]
  );
  const utilization = employee ? calculateEmployeeUtilization(employee.id, projects, employee.targetUtilization) : 0;
  const utilizationStatus = getUtilizationStatus(utilization, settings);
  const nextDeadlineProject = [...assignedProjects].sort((a, b) => a.deadline.localeCompare(b.deadline))[0] ?? null;
  const profileChecklist = [Boolean(employee?.email?.trim()), Boolean(employee?.skills.length), Boolean(employee && employee.yearsExperience > 0)];
  const profileReadiness = Math.round((profileChecklist.filter(Boolean).length / profileChecklist.length) * 100);
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
        <h1 className="text-lg font-semibold text-text-primary">Employee profile unavailable</h1>
        <p className="mt-2 text-sm text-text-secondary">Your signed-in account has not been linked to an employee profile yet. Contact your manager or HR administrator.</p>
      </div>
    );
  }

  const missingProfileItems = [
    !employee.email?.trim() ? 'email' : null,
    employee.skills.length === 0 ? 'skills' : null,
    employee.yearsExperience <= 0 ? 'experience' : null,
  ].filter((item): item is string => Boolean(item));
  const nextDeadlineDays = nextDeadlineProject ? daysUntil(nextDeadlineProject.deadline) : null;

  const nextBestAction = nextDeadlineProject && nextDeadlineDays !== null && nextDeadlineDays < 0
    ? {
        eyebrow: 'Needs attention',
        title: 'Review an overdue delivery',
        description: `${nextDeadlineProject.name} is ${Math.abs(nextDeadlineDays)} day${Math.abs(nextDeadlineDays) === 1 ? '' : 's'} overdue. Check the current status and update the project owner.`,
        to: '/my-projects',
        action: 'Review project',
        tone: 'border-critical/30 bg-critical/5',
        accent: 'text-critical',
        icon: AlertCircle,
      }
    : utilizationStatus === 'overloaded'
      ? {
          eyebrow: 'Capacity priority',
          title: 'Review your workload',
          description: `Your estimated utilization is ${utilization}%, above the configured workload threshold. Review assignments before accepting more work.`,
          to: '/my-workload',
          action: 'Review workload',
          tone: 'border-warning/30 bg-warning/5',
          accent: 'text-warning',
          icon: Target,
        }
      : nextDeadlineProject && nextDeadlineDays !== null && nextDeadlineDays <= 7
        ? {
            eyebrow: 'Coming up soon',
            title: 'Get ahead of your next delivery',
            description: `${nextDeadlineProject.name} is due ${nextDeadlineDays === 0 ? 'today' : `in ${nextDeadlineDays} day${nextDeadlineDays === 1 ? '' : 's'}`}. Review the outstanding tasks and required skills.`,
            to: '/my-projects',
            action: 'View projects',
            tone: 'border-primary/25 bg-primary/5',
            accent: 'text-primary',
            icon: CalendarClock,
          }
        : missingProfileItems.length > 0
          ? {
              eyebrow: 'Profile improvement',
              title: 'Complete your talent profile',
              description: `Add your ${missingProfileItems.join(', ')} details so matching and development recommendations have better evidence to work with.`,
              to: '/my-profile',
              action: 'Complete profile',
              tone: 'border-cyan/30 bg-cyan/5',
              accent: 'text-cyan',
              icon: ShieldCheck,
            }
          : growthSkills.length > 0
            ? {
                eyebrow: 'Career development',
                title: 'Close a project skill gap',
                description: `${growthSkills.length} required skill${growthSkills.length === 1 ? '' : 's'} could be developed for your current assignments. Review the learning path and available courses.`,
                to: '/roadmap',
                action: 'Open roadmap',
                tone: 'border-violet-200 bg-violet-50/70',
                accent: 'text-violet-700',
                icon: GraduationCap,
              }
            : activeTraining.length > 0
              ? {
                  eyebrow: 'Keep momentum',
                  title: 'Continue your learning plan',
                  description: `${activeTraining.length} course${activeTraining.length === 1 ? '' : 's'} remain in progress. Update your course progress or submit evidence when coursework is complete.`,
                  to: '/roadmap',
                  action: 'Continue learning',
                  tone: 'border-emerald-200 bg-emerald-50/70',
                  accent: 'text-emerald-700',
                  icon: GraduationCap,
                }
              : {
                  eyebrow: 'You are up to date',
                  title: 'Keep your momentum going',
                  description: 'No overdue deadline, workload alert, or core profile gap is currently detected from the data available in Togetherly.',
                  to: '/my-projects',
                  action: 'View projects',
                  tone: 'border-success/25 bg-success/5',
                  accent: 'text-success',
                  icon: CheckCircle2,
                };
  const NextBestActionIcon = nextBestAction.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${employee.name.split(' ')[0]}`}
        description="Your real-time project assignments, capacity load, and personalized development roadmaps."
        breadcrumb={['Home', 'My Dashboard']}
      />

      <Reveal direction="down">
        <RoleDashboardHero
          variant="employee"
          eyebrow="Personal intelligence portal"
          title="Grow your skills. Own your next move."
          description={`${employee.role} · ${employee.department} · ${employee.yearsExperience} years of experience. Keep your projects, workload, and development goals moving forward.`}
          to="/my-projects"
          actionLabel="View My Projects"
          icon={Target}
          identity={{ name: employee.name, color: employee.avatarColor }}
        />
      </Reveal>

      <TinyFishLaunchCard description="Explore career paths, in-demand skills, certifications, and learning resources relevant to your professional growth." />

      {(employee.skills.length === 0 || employee.yearsExperience === 0) && (
        <section className="card border-primary/25 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary"><ShieldCheck size={18} /></div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Complete your talent profile</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary">Submit your skills, experience and certifications with supporting details. Your manager or HR reviewer will verify them before they count toward team-matching decisions.</p>
              </div>
            </div>
            <Link to="/my-profile" className="btn-primary w-fit">Complete My Profile <ArrowRight size={14}/></Link>
          </div>
        </section>
      )}

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

      <section className="card overflow-hidden border border-base-border/80">
        <div className="flex flex-col gap-1 border-b border-base-border bg-gradient-to-r from-slate-50 via-white to-blue-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Your personal focus</h3>
            <p className="mt-1 text-xs text-text-secondary">The most useful things to know before you start work.</p>
          </div>
          <span className="mt-1 w-fit rounded-full border border-primary/20 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary sm:mt-0">Personal workspace</span>
        </div>
        <div className="grid gap-px bg-base-border sm:grid-cols-3">
          <div className="bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary"><CalendarClock size={14} className="text-primary" /> Next delivery</div>
            {nextDeadlineProject ? (
              <>
                <p className="mt-3 truncate text-sm font-bold text-text-primary">{nextDeadlineProject.name}</p>
                <p className="mt-1 text-xs text-text-secondary">Due {formatDate(nextDeadlineProject.deadline)}</p>
                <p className={`mt-2 text-xs font-semibold ${daysUntil(nextDeadlineProject.deadline) < 0 ? 'text-critical' : daysUntil(nextDeadlineProject.deadline) <= 7 ? 'text-warning' : 'text-success'}`}>
                  {daysUntil(nextDeadlineProject.deadline) < 0 ? `${Math.abs(daysUntil(nextDeadlineProject.deadline))} days overdue` : daysUntil(nextDeadlineProject.deadline) === 0 ? 'Due today' : `${daysUntil(nextDeadlineProject.deadline)} days remaining`}
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-text-secondary">No upcoming project deadline is assigned to you.</p>
            )}
          </div>
          <div className="bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary"><Target size={14} className="text-cyan" /> Capacity check</div>
            <p className="mt-3 text-2xl font-extrabold tracking-tight text-text-primary">{utilization}%</p>
            <p className="mt-1 text-xs capitalize text-text-secondary">{utilizationStatus.replace('-', ' ')} workload</p>
            <div className="mt-3">
              <CapacityBar utilization={utilization} overloadedThreshold={settings.overloadedThreshold} underutilizedThreshold={settings.underutilizedThreshold} showLabel={false} />
            </div>
            <Link to="/my-workload" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Review workload <ArrowRight size={12} /></Link>
          </div>
          <div className="bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary"><ShieldCheck size={14} className="text-success" /> Profile readiness</div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <p className="text-2xl font-extrabold tracking-tight text-text-primary">{profileReadiness}%</p>
              <span className="text-[10px] text-text-secondary">{profileChecklist.filter(Boolean).length}/3 core fields</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-base-border/70">
              <div className="h-full rounded-full bg-gradient-to-r from-success to-cyan transition-all" style={{ width: `${profileReadiness}%` }} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">Email, verified skills, and experience details.</p>
            <Link to="/my-profile" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Update profile <ArrowRight size={12} /></Link>
          </div>
        </div>
      </section>

      <Reveal delay={100}>
        <section className={`card flex flex-col gap-4 border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${nextBestAction.tone}`}>
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-white ${nextBestAction.accent}`}>
              <NextBestActionIcon size={19} />
            </div>
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${nextBestAction.accent}`}>{nextBestAction.eyebrow}</p>
              <h2 className="mt-1 text-sm font-bold text-text-primary">{nextBestAction.title}</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">{nextBestAction.description}</p>
            </div>
          </div>
          <Link to={nextBestAction.to} className="btn-secondary w-fit shrink-0 justify-center text-xs">
            {nextBestAction.action} <ArrowRight size={13} />
          </Link>
        </section>
      </Reveal>

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
                {activeTraining.slice(0, 3).map((training) => {
                  const sub = submissions.find(
                    (s) =>
                      s.id === training.submissionId ||
                      (s.employeeId === employee.id &&
                        s.courseName.toLowerCase() === training.courseName.toLowerCase())
                  );

                  return (
                    <div key={training.id} className="p-3 rounded-xl border border-base-border/60 bg-base-bg/60">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary/15 border border-primary/30 p-2 text-primary flex-shrink-0">
                          <GraduationCap size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-bold text-text-primary truncate">{training.courseName}</div>
                            {sub ? (
                              <StatusBadge status={sub.status} />
                            ) : (
                              <StatusBadge status={training.verificationStatus || 'in-progress'} />
                            )}
                          </div>
                          <div className="text-[11px] text-text-secondary mt-0.5">{training.provider} · {getSkillName(training.skillId)}</div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-border/60">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan transition-all duration-500" style={{ width: `${training.progress}%` }} />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-text-secondary">
                            <span>{training.progress}% coursework progress</span>
                            {sub ? (
                              <button
                                type="button"
                                onClick={() => setSelectedSubmission(sub)}
                                className="text-primary hover:underline font-semibold flex items-center gap-1"
                              >
                                <Eye size={11} /> View Claim
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setInitialClaimData({
                                    courseName: training.courseName,
                                    provider: training.provider,
                                    skillId: training.skillId,
                                    assignmentId: training.id,
                                  });
                                  setResubmitClaim(undefined);
                                  setSubmitModalOpen(true);
                                }}
                                className="text-primary hover:underline font-semibold flex items-center gap-1"
                              >
                                <Award size={11} /> Submit for Verification
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </Reveal>
      </div>

      {/* Verified Competency Inventory */}
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

      {/* Accredited Training Claims & Verifications Section */}
      <Reveal delay={300}>
        <section className="card p-5 sm:p-6 shadow-lg border-base-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-base-border/60">
            <div>
              <div className="flex items-center gap-2">
                <Award size={18} className="text-primary" />
                <h3 className="text-sm sm:text-base font-bold text-text-primary">
                  Accredited Training Claims & Verifications
                </h3>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Official certificates and credentials submitted for HR and manager completion verification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInitialClaimData(undefined);
                setResubmitClaim(undefined);
                setSubmitModalOpen(true);
              }}
              className="btn-primary text-xs py-2 px-3 w-fit"
            >
              <Plus size={14} /> Submit Course for Verification
            </button>
          </div>

          {employeeSubmissions.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-base-border text-center bg-base-bg/40">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2.5">
                <Award size={20} />
              </div>
              <h4 className="text-xs font-bold text-text-primary">No verification claims submitted yet</h4>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                Completed an internal curriculum or external credential? Upload your certificate PDF or share a credential URL for official verification.
              </p>
              <button
                type="button"
                onClick={() => {
                  setInitialClaimData(undefined);
                  setResubmitClaim(undefined);
                  setSubmitModalOpen(true);
                }}
                className="btn-secondary text-xs mx-auto mt-3"
              >
                <Plus size={13} /> Submit Your First Claim
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {employeeSubmissions.map((sub) => {
                const isRejectedOrEvidence =
                  sub.status === 'rejected' || sub.status === 'needs-more-evidence';

                return (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl border border-base-border/70 bg-base-bg/50 hover:border-primary/40 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-text-primary truncate">{sub.courseName}</h4>
                          <p className="text-[11px] text-text-secondary">{sub.provider}</p>
                        </div>
                        <StatusBadge status={sub.status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <SkillTag skillId={sub.skillId} />
                        <span className="text-[11px] text-text-secondary font-mono">
                          Completed {formatDate(sub.completionDate)}
                        </span>
                      </div>

                      {/* Evidence indicators */}
                      <div className="flex items-center gap-2 text-[11px] text-text-secondary mb-3 pb-2 border-b border-base-border/40">
                        <span className="font-medium">Evidence:</span>
                        {sub.evidenceFileType === 'pdf' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-primary">
                            <FileText size={12} /> PDF Document
                          </span>
                        )}
                        {sub.evidenceFileType === 'image' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-cyan">
                            <ImageIcon size={12} /> Image Certificate
                          </span>
                        )}
                        {sub.verificationUrl && (
                          <span className="inline-flex items-center gap-1 text-text-secondary">
                            <LinkIcon size={12} /> Registry URL
                          </span>
                        )}
                      </div>

                      {/* Reviewer Feedback banner if rejected or needs more evidence */}
                      {isRejectedOrEvidence && (
                        <div
                          className={`p-2.5 rounded-lg text-xs mb-3 ${
                            sub.status === 'rejected'
                              ? 'bg-rose-50 border border-rose-200 text-rose-900'
                              : 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                          }`}
                        >
                          <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5">
                            <AlertCircle size={12} /> Reviewer Feedback:
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            {sub.rejectionReason || sub.reviewerNotes || 'Please provide updated documentation.'}
                          </p>
                        </div>
                      )}

                      {/* Verified Banner */}
                      {sub.status === 'verified' && sub.reviewerName && (
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 mb-3 flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                          <span className="text-[11px]">
                            Verified by {sub.reviewerName} on {formatDate(sub.reviewTimestamp || '')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-base-border/40">
                      <button
                        type="button"
                        onClick={() => setSelectedSubmission(sub)}
                        className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
                      >
                        <Eye size={12} /> View Details & Evidence
                      </button>

                      {isRejectedOrEvidence && (
                        <button
                          type="button"
                          onClick={() => {
                            setResubmitClaim(sub);
                            setInitialClaimData(undefined);
                            setSubmitModalOpen(true);
                          }}
                          className="btn-primary text-[11px] py-1 px-2.5"
                        >
                          Resubmit Evidence
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </Reveal>

      {/* Submission Modal */}
      <TrainingSubmissionModal
        isOpen={submitModalOpen}
        onClose={() => {
          setSubmitModalOpen(false);
          setResubmitClaim(undefined);
          setInitialClaimData(undefined);
        }}
        initialData={initialClaimData}
        existingSubmission={resubmitClaim}
      />

      {/* Evidence Review Modal */}
      <EvidenceReviewModal
        isOpen={Boolean(selectedSubmission)}
        onClose={() => setSelectedSubmission(null)}
        submission={selectedSubmission}
        onResubmit={(sub) => {
          setResubmitClaim(sub);
          setInitialClaimData(undefined);
          setSubmitModalOpen(true);
        }}
      />
    </div>
  );
}

export function EmployeeProjectsPage() {
  const { employees, projects } = useData();
  const location = useLocation();
  const selectedProjectId = (location.state as { projectId?: string } | null)?.projectId;
  const employee = useCurrentEmployee();
  const assignedProjects = employee ? getEmployeeProjects(employee.id, projects) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assigned Projects"
        description="Detailed project briefs, deliverables, team composition, and technical competencies."
        breadcrumb={['Home', 'My Projects']}
      />
      {!employee || assignedProjects.length === 0 ? (
        <div className="card p-8 text-center text-sm text-text-secondary">No project assignments are linked to your employee profile yet.</div>
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
