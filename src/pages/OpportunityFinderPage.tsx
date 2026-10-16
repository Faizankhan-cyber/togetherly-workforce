import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lightbulb, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Reveal';
import { MatchScore } from '@/components/MatchScore';
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
    <div className="space-y-6">
      <PageHeader
        title="Workforce Opportunity Finder"
        description="Discover capacity-safe talent matches for open project roles across your organization."
        breadcrumb={['Home', 'Opportunity Finder']}
      />

      <Reveal direction="down">
        <section className="card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-warning/10 via-base-card to-primary/10 border-warning/30 shadow-md">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning mb-1">
              <Lightbulb size={16} /> Explainable Match Intelligence
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Matching models evaluate required project competencies, available bandwidth, and seniority to identify optimal placements.
            </p>
          </div>
          <label className="flex items-center gap-2.5 text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">Filter:</span>
            <select
              className="input-field min-w-[220px] text-xs font-semibold"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">All Open Projects ({activeProjects.length})</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
        </section>
      </Reveal>

      {opportunities.length === 0 ? (
        <Reveal>
          <div className="card p-10 text-center shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-base-hover flex items-center justify-center mx-auto text-text-secondary mb-3">
              <UsersRound size={26} />
            </div>
            <h2 className="text-base font-bold text-text-primary">No Open Capacity-Safe Matches Found</h2>
            <p className="mt-1.5 text-xs text-text-secondary max-w-md mx-auto">
              All selected projects are either fully staffed or candidates currently lack open capacity allocations.
            </p>
          </div>
        </Reveal>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {opportunities.map(({ project, recommendation, employee, openSeats }, index) => (
            <Reveal key={`${project.id}-${employee.id}`} delay={index * 60} direction="up">
              <article className="card-hover p-5 flex flex-col justify-between h-full border-base-border/70 group">
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <MatchScore score={recommendation.matchScore} size="md" />
                      <div className="min-w-0">
                        <h2 className="text-sm font-bold text-text-primary truncate group-hover:text-primary transition-colors">
                          {project.name}
                        </h2>
                        <span className="inline-block mt-0.5 text-[11px] font-semibold text-cyan">
                          {openSeats} open {openSeats === 1 ? 'seat' : 'seats'} available
                        </span>
                        <p className="mt-1 text-xs text-text-secondary line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Candidate Card */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-base-border/60 bg-base-bg/60">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-text-primary">{employee.name}</div>
                        <div className="truncate text-[11px] text-text-secondary">
                          {employee.role} · <span className="font-mono text-success">{recommendation.availableCapacity}% available</span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn-primary text-xs py-1.5 px-3 flex-shrink-0"
                      onClick={() => navigate('/workforce-twin', { state: { projectId: project.id, employeeId: employee.id } })}
                    >
                      <span>Simulate</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  {/* Skills */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {recommendation.matchedSkills.length > 0 ? (
                      recommendation.matchedSkills.slice(0, 4).map((skillId) => (
                        <span key={skillId} className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          ✓ {getSkillName(skillId)}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-text-secondary italic">Transferable skills applicable</span>
                    )}
                  </div>

                  {/* Reasons list */}
                  <ul className="mt-3 space-y-1 pt-2 border-t border-base-border/30">
                    {recommendation.reasons.slice(0, 2).map((reason) => (
                      <li key={reason} className="text-[11px] text-text-secondary flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                        <span className="truncate">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
