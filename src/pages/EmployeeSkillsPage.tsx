import { ArrowRight, BookOpen, BrainCircuit, CheckCircle2, GraduationCap, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { SkillTag } from '@/components/SkillTag';
import { useData } from '@/context/DataContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { getEmployeeProjects, getSkillName } from '@/utils';

const levelLabels: Record<number, string> = { 1: 'Beginner', 2: 'Developing', 3: 'Proficient', 4: 'Advanced', 5: 'Expert' };

export function EmployeeSkillsPage() {
  const employee = useCurrentEmployee();
  const { projects } = useData();

  if (!employee) {
    return <div className="card p-8 text-center"><h2 className="font-semibold text-text-primary">Employee profile unavailable</h2><p className="mt-2 text-sm text-text-secondary">Your account must be linked to an approved employee profile before skills can be shown.</p></div>;
  }

  const employeeProjects = getEmployeeProjects(employee.id, projects).filter((project) => project.status !== 'completed');
  const gaps = new Map<string, { currentLevel: number; requiredLevel: number; projects: string[] }>();
  for (const project of employeeProjects) {
    for (const req of project.requiredSkills) {
      const currentLevel = employee.skills.find((skill) => skill.skillId === req.skillId)?.level ?? 0;
      if (currentLevel >= req.minLevel) continue;
      const existing = gaps.get(req.skillId) ?? { currentLevel, requiredLevel: req.minLevel, projects: [] };
      existing.currentLevel = Math.min(existing.currentLevel, currentLevel);
      existing.requiredLevel = Math.max(existing.requiredLevel, req.minLevel);
      if (!existing.projects.includes(project.name)) existing.projects.push(project.name);
      gaps.set(req.skillId, existing);
    }
  }
  const skillCount = employee.skills.filter((skill) => skill.level > 0).length;
  const averageLevel = skillCount ? (employee.skills.filter((skill) => skill.level > 0).reduce((sum, skill) => sum + skill.level, 0) / skillCount).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <PageHeader title="My Skills" description="Review your recorded skills and see which capabilities would help with your active projects." breadcrumb={['Home', 'My Skills']} actions={<Link to="/roadmap" className="btn-primary">Open My Development <ArrowRight size={14}/></Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><div className="flex items-center gap-2 text-text-secondary"><BrainCircuit size={17} className="text-primary"/><span className="text-xs font-semibold uppercase tracking-wider">Recorded skills</span></div><div className="mt-3 text-3xl font-extrabold text-text-primary">{skillCount}</div></div>
        <div className="card p-5"><div className="flex items-center gap-2 text-text-secondary"><GraduationCap size={17} className="text-cyan"/><span className="text-xs font-semibold uppercase tracking-wider">Average proficiency</span></div><div className="mt-3 text-3xl font-extrabold text-text-primary">{averageLevel}<span className="text-sm font-medium text-text-secondary"> / 5</span></div></div>
        <div className="card p-5"><div className="flex items-center gap-2 text-text-secondary"><Target size={17} className="text-warning"/><span className="text-xs font-semibold uppercase tracking-wider">Project skill gaps</span></div><div className="mt-3 text-3xl font-extrabold text-text-primary">{gaps.size}</div></div>
      </div>
      <section className="card p-5">
        <div className="flex items-center gap-2 border-b border-base-border/60 pb-3"><BrainCircuit size={18} className="text-primary"/><div><h2 className="text-sm font-bold text-text-primary">My recorded skills</h2><p className="mt-1 text-xs text-text-secondary">Skill levels recorded in your employee profile.</p></div></div>
        {skillCount === 0 ? <div className="py-10 text-center"><BookOpen size={28} className="mx-auto text-text-muted"/><h3 className="mt-3 text-sm font-semibold text-text-primary">No skills recorded yet</h3><p className="mt-1 text-xs text-text-secondary">Ask your manager or HR administrator to update the skills on your employee profile.</p></div> : <div className="mt-4 grid gap-3 md:grid-cols-2">{employee.skills.filter((skill) => skill.level > 0).sort((a,b) => b.level-a.level).map((skill) => <article key={skill.skillId} className="rounded-xl border border-base-border/70 bg-base-bg/50 p-4"><div className="flex items-center justify-between gap-2"><SkillTag skillId={skill.skillId}/><span className="text-[11px] font-semibold text-text-secondary">{levelLabels[skill.level] ?? `Level ${skill.level}`}</span></div><div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-base-border"> <div className="h-full rounded-full bg-primary" style={{width:`${Math.max(0,Math.min(100,skill.level*20))}%`}}/></div><span className="text-xs font-bold text-text-primary">{skill.level}/5</span></div></article>)}</div>}
      </section>
      <section className="card p-5">
        <div className="flex items-center gap-2 border-b border-base-border/60 pb-3"><Target size={18} className="text-warning"/><div><h2 className="text-sm font-bold text-text-primary">Skills to strengthen for your projects</h2><p className="mt-1 text-xs text-text-secondary">Gaps are calculated from your active project requirements and recorded skill levels.</p></div></div>
        {gaps.size === 0 ? <div className="flex items-start gap-3 py-6"><CheckCircle2 size={19} className="text-success mt-0.5"/><div><p className="text-sm font-semibold text-text-primary">No project skill gaps identified</p><p className="mt-1 text-xs text-text-secondary">This means your recorded skills meet the requirements currently assigned to you, or no active project requirements are available.</p></div></div> : <div className="mt-4 space-y-3">{Array.from(gaps.entries()).map(([skillId, gap]) => <article key={skillId} className="rounded-xl border border-warning/25 bg-warning/5 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-semibold text-text-primary"><SkillTag skillId={skillId}/></div><p className="mt-2 text-xs text-text-secondary">Current level: {gap.currentLevel}/5 · Project requirement: {gap.requiredLevel}/5</p></div><span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">Gap identified</span></div><p className="mt-2 text-[11px] text-text-secondary">Relevant project{gap.projects.length > 1 ? 's' : ''}: {gap.projects.join(', ')}</p></article>)}</div>}
        <Link to="/roadmap" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">View recommended development <ArrowRight size={13}/></Link>
      </section>
      <p className="text-[11px] text-text-secondary">Skill assessments are based on the skills currently recorded in your profile. This page does not independently certify skill level or update HR records.</p>
    </div>
  );
}
