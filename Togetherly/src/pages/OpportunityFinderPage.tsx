import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lightbulb, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/context/DataContext';
import { generateRecommendations, getSkillName } from '@/utils';

export function OpportunityFinderPage() {
  const navigate = useNavigate();
  const { employees, projects, settings } = useData();
  const activeProjects = projects.filter((project) => project.status === 'active' || project.status === 'planning');
  const [projectFilter, setProjectFilter] = useState('all');

  const opportunities = useMemo(() => {
    const candidates = activeProjects
      .filter((project) => projectFilter === 'all' || project.id === projectFilter)
      .flatMap((project) => generateRecommendations(
        employees,
        project,
        settings.matchWeights,
        projects,
        settings
      )
        .filter((recommendation) =>
          recommendation.capacityFeasible &&
          !project.assignedEmployeeIds.includes(recommendation.employeeId)
        )
        .map((recommendation) => ({
          project,
          recommendation,
          employee: employees.find((employee) => employee.id === recommendation.employeeId)!,
          openSeats: Math.max(0, project.targetTeamSize - project.assignedEmployeeIds.length),
        }))
      );
    return candidates
      .filter((item) => item.openSeats > 0 && item.recommendation.matchScore >= 25)
      .sort((a, b) =>
        b.recommendation.matchScore - a.recommendation.matchScore ||
        a.openSeats - b.openSeats
      )
      .slice(0, 12);
  }, [activeProjects, employees, projects, projectFilter, settings]);

  return (
    <div>
      <PageHeader
        title="Workforce Opportunity Finder"
        description="Find capacity-safe matches between available talent and open project seats."
        breadcrumb={['Home', 'Opportunity Finder']}
      />

      <section className="mb-4 flex flex-wrap items-end justify-between gap-4 card p-4">
        <div className="max-w-xl">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-text-primary"><Lightbulb size={16} className="text-warning" /> Explainable opportunities</div>
          <p className="text-xs leading-relaxed text-text-secondary">
            Matches use each project’s required skills, employee experience, availability, and the demo capacity estimate.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Project
          <select className="input-field min-w-[220px]" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">All open projects</option>
            {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
      </section>

      {opportunities.length === 0 ? (
        <div className="card p-8 text-center">
          <UsersRound size={26} className="mx-auto text-text-secondary" />
          <h2 className="mt-3 font-semibold text-text-primary">No open capacity-safe matches</h2>
          <p className="mt-1 text-sm text-text-secondary">The selected projects are fully staffed or the remaining candidates do not have enough estimated capacity.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {opportunities.map(({ project, recommendation, employee, openSeats }) => (
            <article key={`${project.id}-${employee.id}`} className="card-hover p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <span className="text-sm font-bold">{recommendation.matchScore}</span>
                  <span className="text-[9px] uppercase">match</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="font-semibold text-text-primary">{project.name}</h2>
                    <span className="text-xs text-text-secondary">{openSeats} open {openSeats === 1 ? 'seat' : 'seats'}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">{project.description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-base-border bg-base-bg/70 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text-primary">{employee.name}</div>
                    <div className="truncate text-xs text-text-secondary">{employee.role} · {recommendation.currentUtilization}% estimated workload</div>
                  </div>
                </div>
                <button
                  className="btn-primary shrink-0"
                  onClick={() => navigate('/workforce-twin', { state: { projectId: project.id, employeeId: employee.id } })}
                >
                  Simulate <ArrowRight size={15} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {recommendation.matchedSkills.length > 0
                  ? recommendation.matchedSkills.slice(0, 4).map((skillId) => <span key={skillId} className="rounded-md border border-success/20 bg-success/5 px-2 py-1 text-[11px] text-success">{getSkillName(skillId)}</span>)
                  : <span className="text-xs text-text-secondary">Transferable experience; see fit details in the simulation.</span>}
              </div>
              <ul className="mt-3 space-y-1">
                {recommendation.reasons.slice(0, 3).map((reason) => <li key={reason} className="text-xs text-text-secondary">• {reason}</li>)}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
