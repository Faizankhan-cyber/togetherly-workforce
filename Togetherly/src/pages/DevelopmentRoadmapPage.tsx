import { useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, CirclePlay, GraduationCap, LockKeyhole, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/context/DataContext';
import { demoEmployeeId } from '@/data/mockData';
import { getEmployeeProjects, getSkillName } from '@/utils';

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
  const { employees, projects, role, addTrainingAssignment, updateTrainingAssignment, showToast } = useData();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(demoEmployeeId);
  const employeeId = role === 'employee' ? demoEmployeeId : selectedEmployeeId;
  const employee = employees.find((item) => item.id === employeeId);
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
        <p className="mt-2 text-sm text-text-secondary">Reset the demo data to restore the selected employee.</p>
      </div>
    );
  }

  const selectedEmployee = employee;
  const completedCount = employee.trainingAssignments.filter((training) => training.status === 'completed').length;
  const totalCount = employee.trainingAssignments.length;

  function advanceTraining(trainingId: string, progress: number, status: 'not-started' | 'in-progress' | 'completed') {
    const nextProgress = status === 'not-started' ? Math.max(10, progress) : Math.min(100, progress + 25);
    const nextStatus = nextProgress >= 100 ? 'completed' : 'in-progress';
    updateTrainingAssignment(selectedEmployee.id, trainingId, { progress: nextProgress, status: nextStatus });
    showToast('success', nextStatus === 'completed' ? 'Course completed. Your skill profile has been updated.' : `Course progress updated to ${nextProgress}%`);
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
        description="Turn project skill needs into trackable learning goals."
        breadcrumb={['Home', role === 'employee' ? 'My Development' : 'Development Roadmap']}
      />

      {role === 'manager' && (
        <label className="mb-4 flex max-w-xl items-center gap-3 card p-3">
          <span className="text-sm text-text-secondary">Employee</span>
          <select className="input-field min-w-0 flex-1" value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}>
            {employees.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.department}</option>)}
          </select>
        </label>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4"><BookOpenCheck className="text-primary" size={20} /><div><div className="text-xs text-text-secondary">Courses assigned</div><div className="mt-1 font-semibold text-text-primary">{totalCount}</div></div></div>
        <div className="card flex items-center gap-3 p-4"><CheckCircle2 className="text-success" size={20} /><div><div className="text-xs text-text-secondary">Completed</div><div className="mt-1 font-semibold text-text-primary">{completedCount}</div></div></div>
        <div className="card flex items-center gap-3 p-4"><Sparkles className="text-cyan" size={20} /><div><div className="text-xs text-text-secondary">Project skills to develop</div><div className="mt-1 font-semibold text-text-primary">{growthNeeds.length}</div></div></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
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
              {employee.trainingAssignments.map((training) => (
                <article key={training.id} className="rounded-xl border border-base-border bg-base-bg/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {training.status === 'completed' ? <CheckCircle2 size={16} className="text-success" /> : <GraduationCap size={16} className="text-primary" />}
                        <h3 className="text-sm font-medium text-text-primary">{training.courseName}</h3>
                      </div>
                      <p className="ml-6 mt-1 text-xs text-text-secondary">{training.provider} · {getSkillName(training.skillId)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${training.status === 'completed' ? 'bg-success/10 text-success' : training.status === 'in-progress' ? 'bg-primary/10 text-primary' : 'bg-base-hover text-text-secondary'}`}>
                      {training.status === 'completed' ? 'Completed' : training.status === 'in-progress' ? 'In progress' : 'Not started'}
                    </span>
                  </div>
                  <p className="ml-6 mt-2 text-xs text-text-secondary">{training.reason}</p>
                  <div className="ml-6 mt-3">
                    <div className="mb-1 flex justify-between text-xs"><span className="text-text-secondary">Course progress</span><span className="text-text-primary">{training.progress}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-base-border"><div className={`h-full rounded-full ${training.status === 'completed' ? 'bg-success' : 'bg-primary'}`} style={{ width: `${training.progress}%` }} /></div>
                  </div>
                  {training.status !== 'completed' && (
                    <button className="btn-secondary ml-6 mt-3" onClick={() => advanceTraining(training.id, training.progress, training.status)}>
                      {training.status === 'not-started' ? <><CirclePlay size={15} /> Start course</> : <><CheckCircle2 size={15} /> Add 25% progress</>}
                    </button>
                  )}
                  {training.status === 'completed' && <p className="ml-6 mt-3 text-xs text-success">Skill profile updated to reflect this completed learning.</p>}
                </article>
              ))}
            </div>
          )}
        </section>

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
            Finishing a course marks it complete and increases the corresponding skill by one level (up to level 5).
          </div>
        </section>
      </div>
    </div>
  );
}

function TargetIcon() {
  return <GraduationCap size={17} className="text-cyan" />;
}
