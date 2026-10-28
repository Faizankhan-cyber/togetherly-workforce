import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  CirclePlay,
  GraduationCap,
  LockKeyhole,
  Sparkles,
  Award,
  Eye,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Reveal } from '@/components/Reveal';
import { TrainingSubmissionModal } from '@/components/TrainingSubmissionModal';
import { EvidenceReviewModal } from '@/components/EvidenceReviewModal';
import { useData } from '@/context/DataContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { getEmployeeProjects, getSkillName } from '@/utils';
import type { TrainingSubmission } from '@/types';

const coursesBySkill: Record<string, { course: string; provider: string }> = {
  'skl-react': { course: 'React Foundations', provider: 'Frontend Masters' },
  'skl-typescript': { course: 'Practical TypeScript', provider: 'Total TypeScript' },
  'skl-node': { course: 'Node.js API Development', provider: 'Open Source Society' },
  'skl-python': { course: 'Python for Production', provider: 'Coursera' },
  'skl-go': { course: 'Go Programming', provider: 'Pluralsight' },
  'skl-sql': { course: 'SQL for Analytics', provider: 'DataCamp' },
  'skl-postgres': { course: 'PostgreSQL Essentials', provider: 'pgExercises' },
  'skl-aws': { course: 'AWS Cloud Practitioner', provider: 'AWS Skill Builder' },
  'skl-docker': { course: 'Docker Fundamentals', provider: 'KodeKloud' },
  'skl-kubernetes': { course: 'Kubernetes for Developers', provider: 'Linux Foundation' },
  'skl-terraform': { course: 'Terraform Associate Prep', provider: 'HashiCorp' },
  'skl-uiux': { course: 'Product Design Systems', provider: 'Interaction Design Foundation' },
  'skl-ml': { course: 'Machine Learning Foundations', provider: 'Coursera' },
  'skl-qa': { course: 'Modern QA Automation', provider: 'Test Automation University' },
  'skl-security': { course: 'Application Security Basics', provider: 'OWASP' },
  'skl-graphQL': { course: 'GraphQL Fundamentals', provider: 'Apollo' },
  'skl-linux': { course: 'Linux Essentials', provider: 'Linux Foundation' },
};

export function DevelopmentRoadmapPage() {
  const { employees, projects, submissions, role, addTrainingAssignment, updateTrainingAssignment, showToast } = useData();
  const currentEmployee = useCurrentEmployee();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<TrainingSubmission | null>(null);
  const [resubmitClaim, setResubmitClaim] = useState<TrainingSubmission | undefined>(undefined);
  const [initialClaimData, setInitialClaimData] = useState<Partial<TrainingSubmission> | undefined>(undefined);

  useEffect(() => {
    if (role === 'employee' || employees.length === 0) return;
    setSelectedEmployeeId((current) => {
      if (employees.some((item) => item.id === current)) return current;
      if (currentEmployee && employees.some((item) => item.id === currentEmployee.id)) return currentEmployee.id;
      return employees[0].id;
    });
  }, [role, employees, currentEmployee]);

  const employeeId = role === 'employee' ? (currentEmployee?.id ?? '') : selectedEmployeeId;
  const employee = role === 'employee' ? currentEmployee : employees.find((item) => item.id === employeeId);
  const employeeProjects = useMemo(
    () => employee ? getEmployeeProjects(employee.id, projects).filter((project) => project.status !== 'completed') : [],
    [employee, projects]
  );

  const growthNeeds = useMemo(() => {
    if (!employee) return [];
    const needs = new Map<string, { skillId: string; requiredLevel: number; projects: string[] }>();
    for (const project of employeeProjects) {
      for (const requirement of project.requiredSkills) {
        const currentLevel = employee.skills.find((skill) => skill.skillId === requirement.skillId)?.level ?? 0;
        if (currentLevel >= requirement.minLevel) continue;
        const item = needs.get(requirement.skillId) ?? {
          skillId: requirement.skillId,
          requiredLevel: requirement.minLevel,
          projects: [],
        };
        item.requiredLevel = Math.max(item.requiredLevel, requirement.minLevel);
        item.projects.push(project.name);
        needs.set(requirement.skillId, item);
      }
    }
    return Array.from(needs.values());
  }, [employee, employeeProjects]);

  if (!employee) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-semibold text-text-primary">Employee not found</h1>
        <p className="mt-2 text-sm text-text-secondary">The signed-in account is not linked to an employee profile. Contact your manager or HR administrator.</p>
      </div>
    );
  }

  const selectedEmployee = employee;
  const completedCount = employee.trainingAssignments.filter((training) => training.status === 'completed').length;
  const totalCount = employee.trainingAssignments.length;

  const verifiedClaimCount = submissions.filter((submission) =>
    submission.employeeId === employee.id && submission.status === 'verified'
  ).length;
  const pendingReviewCount = submissions.filter((submission) =>
    submission.employeeId === employee.id && submission.status === 'pending-verification'
  ).length;

  function advanceTraining(trainingId: string, progress: number, status: 'not-started' | 'in-progress' | 'completed') {
    const nextProgress = status === 'not-started' ? Math.max(10, progress) : Math.min(100, progress + 25);
    const nextStatus = nextProgress >= 100 ? 'completed' : 'in-progress';
    updateTrainingAssignment(selectedEmployee.id, trainingId, { progress: nextProgress, status: nextStatus });
    showToast('success', nextStatus === 'completed' ? 'Coursework completed (100%). Ready for completion verification.' : `Course progress updated to ${nextProgress}%`);
  }

  function assignCourse(skillId: string, requiredLevel: number, projectNames: string[]) {
    const course = coursesBySkill[skillId] ?? { course: `${getSkillName(skillId)} Learning Path`, provider: 'Togetherly Academy' };
    addTrainingAssignment(selectedEmployee.id, {
      skillId,
      courseName: course.course,
      provider: course.provider,
      progress: 0,
      status: 'not-started',
      reason: `Build toward level ${requiredLevel} for ${projectNames.slice(0, 2).join(' and ')}`,
    });
    showToast('success', `${course.course} assigned to ${selectedEmployee.name}`);
  }

  return (
    <div>
      <PageHeader
        title={role === 'employee' ? 'My Development Roadmap' : 'Skill Development Roadmap'}
        description="Turn project skill needs into trackable learning goals and verified achievements."
        breadcrumb={['Home', role === 'employee' ? 'My Development' : 'Development Roadmap']}
        actions={
          role === 'employee' ? (
            <button
              type="button"
              onClick={() => {
                setInitialClaimData(undefined);
                setResubmitClaim(undefined);
                setSubmitModalOpen(true);
              }}
              className="btn-primary"
            >
              <Plus size={15} /> Submit External Course Claim
            </button>
          ) : undefined
        }
      />

      {role === 'manager' && (
        <Reveal>
        <label className="mb-4 flex max-w-xl items-center gap-3 card p-3">
          <span className="text-sm text-text-secondary">Employee</span>
          <select className="input-field min-w-0 flex-1" value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}>
            {employees.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.department}</option>)}
          </select>
        </label>
        </Reveal>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Reveal delay={0}>
          <div className="card flex items-center gap-3 p-4 border-base-border/70 hover:border-primary/30 transition-colors">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <BookOpenCheck size={20} />
            </div>
            <div>
              <div className="text-xs text-text-secondary">Courses Assigned</div>
              <div className="mt-0.5 text-2xl font-bold text-text-primary tracking-tight">{totalCount}</div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="card flex items-center gap-3 p-4 border-base-border/70 hover:border-success/30 transition-colors">
            <div className="p-2.5 rounded-xl bg-success/10 border border-success/20 text-success">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="text-xs text-text-secondary">Completed</div>
              <div className="mt-0.5 text-2xl font-bold text-text-primary tracking-tight">{completedCount}</div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div className="card flex items-center gap-3 p-4 border-base-border/70 hover:border-cyan/30 transition-colors">
            <div className="p-2.5 rounded-xl bg-cyan/10 border border-cyan/20 text-cyan">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-xs text-text-secondary">Project Skills to Develop</div>
              <div className="mt-0.5 text-2xl font-bold text-text-primary tracking-tight">{growthNeeds.length}</div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={220}>
          <div className="card flex items-center gap-3 p-4 border-base-border/70 hover:border-success/30 transition-colors">
            <div className="p-2.5 rounded-xl bg-success/10 border border-success/20 text-success">
              <Award size={20} />
            </div>
            <div>
              <div className="text-xs text-text-secondary">Verified Claims</div>
              <div className="mt-0.5 text-2xl font-bold text-text-primary tracking-tight">{verifiedClaimCount}</div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={280}>
          <div className="card flex items-center gap-3 p-4 border-base-border/70 hover:border-warning/30 transition-colors">
            <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/20 text-warning">
              <AlertCircle size={20} />
            </div>
            <div>
              <div className="text-xs text-text-secondary">Claims Awaiting Review</div>
              <div className="mt-0.5 text-2xl font-bold text-text-primary tracking-tight">{pendingReviewCount}</div>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Reveal delay={0}>
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
            <div><h2 className="font-semibold text-text-primary">{employee.name}&apos;s learning path</h2><p className="text-xs text-text-secondary">{employee.role} · {employee.department}</p></div>
          </div>
          {employee.trainingAssignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-base-border p-6 text-center">
              <GraduationCap className="mx-auto text-text-secondary" size={24} />
              <p className="mt-2 text-sm text-text-secondary">No courses assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employee.trainingAssignments.map((training) => {
                const sub = submissions.find(
                  (s) =>
                    s.id === training.submissionId ||
                    (s.employeeId === selectedEmployee.id &&
                      s.courseName.toLowerCase() === training.courseName.toLowerCase())
                );
                const isRejectedOrEvidence =
                  sub && (sub.status === 'rejected' || sub.status === 'needs-more-evidence');

                return (
                  <article key={training.id} className="rounded-xl border border-base-border bg-base-bg/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {training.status === 'completed' ? (
                            <CheckCircle2 size={16} className="text-success" />
                          ) : (
                            <GraduationCap size={16} className="text-primary" />
                          )}
                          <h3 className="text-sm font-medium text-text-primary">{training.courseName}</h3>
                        </div>
                        <p className="ml-6 mt-1 text-xs text-text-secondary">
                          {training.provider} · {getSkillName(training.skillId)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub ? (
                          <StatusBadge status={sub.status} />
                        ) : (
                          <StatusBadge status={training.verificationStatus || 'not-started'} />
                        )}
                      </div>
                    </div>
                    <p className="ml-6 mt-2 text-xs text-text-secondary">{training.reason}</p>
                    <div className="ml-6 mt-3">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-text-secondary">Course progress</span>
                        <span className="text-text-primary font-medium">{training.progress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-base-border">
                        <div
                          className={`h-full rounded-full ${
                            training.status === 'completed' ? 'bg-success' : 'bg-primary'
                          }`}
                          style={{ width: `${training.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Reviewer feedback if rejected or needs more evidence */}
                    {isRejectedOrEvidence && (
                      <div
                        className={`ml-6 mt-3 p-2.5 rounded-lg text-xs ${
                          sub.status === 'rejected'
                            ? 'bg-rose-50 border border-rose-200 text-rose-900'
                            : 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5">
                          <AlertCircle size={12} /> Reviewer Note:
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          {sub.rejectionReason || sub.reviewerNotes}
                        </p>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="ml-6 mt-3 pt-2.5 border-t border-base-border/50 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {training.status !== 'completed' && (
                          <button
                            className="btn-secondary text-xs py-1 px-2.5"
                            onClick={() => advanceTraining(training.id, training.progress, training.status)}
                          >
                            {training.status === 'not-started' ? (
                              <>
                                <CirclePlay size={14} /> Start course
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={14} /> Add 25% progress
                              </>
                            )}
                          </button>
                        )}

                        {training.status === 'completed' && (
                          <span className="text-xs text-text-secondary font-medium">
                            Coursework completed (100%)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {role === 'employee' ? (
                          sub ? (
                            isRejectedOrEvidence ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setResubmitClaim(sub);
                                  setInitialClaimData(undefined);
                                  setSubmitModalOpen(true);
                                }}
                                className="btn-primary text-xs py-1 px-2.5"
                              >
                                Resubmit Evidence
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedSubmission(sub)}
                                className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                              >
                                <Eye size={12} /> View Claim Evidence
                              </button>
                            )
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
                              className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                            >
                              <Award size={13} /> Submit for Verification
                            </button>
                          )
                        ) : (
                          sub && (
                            <button
                              type="button"
                              onClick={() => setSelectedSubmission(sub)}
                              className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                            >
                              <Eye size={12} /> Inspect Evidence
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        </Reveal>

        <Reveal delay={80}>
        <section className="card p-5">
          <div className="mb-1 flex items-center gap-2"><TargetIcon /><h2 className="font-semibold text-text-primary">Project skill gaps</h2></div>
          <p className="mb-4 text-xs text-text-secondary">Suggested courses are based on assigned project requirements and your current skill levels.</p>
          {growthNeeds.length === 0 ? (
            <div className="rounded-xl border border-success/20 bg-success/5 p-5 text-sm text-success">Your current skills meet the requirements of your active projects.</div>
          ) : (
            <div className="space-y-3">
              {growthNeeds.map((need) => {
                const alreadyAssigned = employee.trainingAssignments.some((training) => training.skillId === need.skillId && training.status !== 'completed');
                const course = coursesBySkill[need.skillId] ?? { course: `${getSkillName(need.skillId)} Learning Path`, provider: 'Togetherly Academy' };
                return (
                  <div key={need.skillId} className="rounded-xl border border-base-border bg-base-bg/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-text-primary">{getSkillName(need.skillId)}</h3>
                        <p className="mt-1 text-xs text-text-secondary">
                          Level {employee.skills.find((skill) => skill.skillId === need.skillId)?.level ?? 0} → {need.requiredLevel} · {need.projects.join(', ')}
                        </p>
                      </div>
                      {alreadyAssigned && <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">In roadmap</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary"><LockKeyhole size={13} /> {course.course} · {course.provider}</div>
                    {role === 'manager' && !alreadyAssigned && (
                      <button className="btn-primary mt-3" onClick={() => assignCourse(need.skillId, need.requiredLevel, need.projects)}>
                        <GraduationCap size={15} /> Assign training
                      </button>
                    )}
                    {role === 'employee' && !alreadyAssigned && <p className="mt-3 text-xs text-text-secondary">Ask your manager to add this course to your learning plan.</p>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 rounded-xl border border-cyan/15 bg-cyan/5 p-3 text-xs leading-relaxed text-text-secondary">
            Coursework tracks learning progress. Formal completion verification requires submitting accredited certificate evidence for Manager/HR approval.
          </div>
        </section>
        </Reveal>
      </div>

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

function TargetIcon() {
  return <GraduationCap size={17} className="text-cyan" />;
}
