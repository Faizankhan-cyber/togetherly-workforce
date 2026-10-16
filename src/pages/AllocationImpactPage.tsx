import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download, Gauge, ShieldCheck, Users, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Reveal';
import { useData } from '@/context/DataContext';
import {
  calculateEmployeeUtilization,
  exportToCsv,
  generateRecommendations,
  getSkillName,
  getTeamSkillCoverage,
} from '@/utils';
import type { Employee } from '@/types';

function AllocationMember({ employee, utilization }: { employee: Employee; utilization: number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-base-border/60 bg-base-bg/60 hover:border-base-border transition-colors">
      <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-text-primary truncate">{employee.name}</div>
        <div className="text-[11px] text-text-secondary truncate">{employee.role} · {employee.department}</div>
      </div>
      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
        utilization > 85
          ? 'bg-critical/10 text-critical border-critical/30'
          : utilization < 50
            ? 'bg-cyan/10 text-cyan border-cyan/30'
            : 'bg-success/10 text-success border-success/30'
      }`}>
        {utilization}%
      </span>
    </div>
  );
}

function CoverageList({ items }: { items: { skillId: string; covered: boolean; minLevel: number; bestLevel: number }[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.skillId} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-base-bg/40 border border-base-border/40 text-xs">
          <div className="flex items-center gap-2">
            {item.covered ? (
              <CheckCircle2 size={13} className="text-success flex-shrink-0" />
            ) : (
              <AlertTriangle size={13} className="text-warning flex-shrink-0" />
            )}
            <span className="text-text-primary font-medium">{getSkillName(item.skillId)}</span>
            <span className="text-[10px] text-text-secondary font-mono">Min L{item.minLevel}</span>
          </div>
          <span className={`text-xs font-semibold ${item.covered ? 'text-success' : 'text-warning'}`}>
            {item.covered ? `L${item.bestLevel}` : 'Gap'}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AllocationImpactPage() {
  const navigate = useNavigate();
  const { employees, projects, settings, showToast } = useData();
  const [projectId, setProjectId] = useState(projects.find((project) => project.status !== 'completed')?.id ?? '');
  const project = projects.find((item) => item.id === projectId);

  const proposal = useMemo(() => {
    if (!project) return [];
    let ids = [...project.assignedEmployeeIds];
    const candidates = generateRecommendations(employees, project, settings.matchWeights, projects, settings)
      .filter((candidate) => candidate.capacityFeasible && !ids.includes(candidate.employeeId));
    while (ids.length < project.targetTeamSize && candidates.length > 0) {
      const candidateIndex = candidates.findIndex((candidate) => {
        const employee = employees.find((item) => item.id === candidate.employeeId);
        if (!employee) return false;
        const after = [...projects.filter((item) => item.id !== project.id), {
          ...project,
          assignedEmployeeIds: [...ids, employee.id],
        }];
        return calculateEmployeeUtilization(employee.id, after, employee.targetUtilization) <= 100;
      });
      if (candidateIndex < 0) break;
      ids = [...ids, candidates[candidateIndex].employeeId];
      candidates.splice(candidateIndex, 1);
    }
    return ids;
  }, [employees, project, projects, settings]);

  if (!project) {
    return <div className="card p-8 text-center text-sm text-text-secondary">No project allocation is available to report.</div>;
  }

  const reportProject = project;
  const currentCoverage = getTeamSkillCoverage(reportProject.assignedEmployeeIds, reportProject, employees);
  const proposedCoverage = getTeamSkillCoverage(proposal, reportProject, employees);
  const currentGaps = currentCoverage.filter((item) => !item.covered);
  const proposedGaps = proposedCoverage.filter((item) => !item.covered);
  const currentStaffing = Math.min(reportProject.assignedEmployeeIds.length, reportProject.targetTeamSize);
  const proposedStaffing = Math.min(proposal.length, reportProject.targetTeamSize);
  const beforeMembers = reportProject.assignedEmployeeIds.map((id) => employees.find((item) => item.id === id)).filter(Boolean) as Employee[];
  const afterMembers = proposal.map((id) => employees.find((item) => item.id === id)).filter(Boolean) as Employee[];
  const proposedProjects = projects.map((item) => item.id === reportProject.id
    ? { ...item, assignedEmployeeIds: proposal }
    : item);
  const averageLoad = (members: Employee[], sourceProjects: typeof projects) => Math.round(
    members.reduce((sum, employee) => sum + (employee
      ? calculateEmployeeUtilization(employee.id, sourceProjects, employee.targetUtilization)
      : 0), 0) / Math.max(members.length, 1)
  );
  const beforeAvg = averageLoad(beforeMembers, projects);
  const afterAvg = averageLoad(afterMembers, proposedProjects);


  function exportReport() {
    const rows = reportProject.requiredSkills.map((requirement) => {
      const before = currentCoverage.find((item) => item.skillId === requirement.skillId);
      const after = proposedCoverage.find((item) => item.skillId === requirement.skillId);
      return [
        getSkillName(requirement.skillId),
        requirement.minLevel,
        before?.bestLevel ?? 0,
        before?.covered ? 'Covered' : 'Gap',
        after?.bestLevel ?? 0,
        after?.covered ? 'Covered' : 'Gap',
      ];
    });
    exportToCsv('allocation-impact-report.csv', [
      'Skill',
      'Required Level',
      'Current Best Level',
      'Current Coverage',
      'Proposed Best Level',
      'Proposed Coverage',
    ], rows);
    showToast('success', 'Allocation impact report exported');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocation Impact Report"
        description="Side-by-side analysis comparing the active team allocation against capacity-safe algorithmic recommendations."
        breadcrumb={['Home', 'Allocation Impact']}
        actions={
          <button className="btn-secondary" onClick={exportReport}>
            <Download size={15} /> Export CSV Report
          </button>
        }
      />

      <Reveal direction="down">
        <section className="card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-base-card to-cyan/10 border-primary/30">
          <p className="max-w-2xl text-xs sm:text-sm text-text-secondary leading-relaxed">
            This impact analysis models talent availability, current project commitments, and skill levels. Simulations can be previewed or modified directly in Workforce Twin.
          </p>
          <label className="flex items-center gap-2.5 text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">Target Project:</span>
            <select
              className="input-field min-w-[240px] text-xs font-semibold"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.filter((item) => item.status !== 'completed').map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        </section>
      </Reveal>

      {/* KPI Cards Row with staggered reveals */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal delay={60}>
          <div className="card p-5 border-base-border/70">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold uppercase tracking-wider">Current Staffing</span>
              <Users size={17} className="text-primary" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-text-primary tracking-tight">
              {currentStaffing}<span className="text-base font-medium text-text-secondary"> / {project.targetTeamSize}</span>
            </div>
            <div className="mt-1 text-xs text-text-secondary">Saved assigned headcounts</div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="card p-5 border-cyan/30">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold uppercase tracking-wider text-cyan">Proposed Staffing</span>
              <Users size={17} className="text-cyan" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-cyan tracking-tight">
              {proposedStaffing}<span className="text-base font-medium text-text-secondary"> / {project.targetTeamSize}</span>
            </div>
            <div className="mt-1 text-xs text-text-secondary">Optimal capacity-safe fill</div>
          </div>
        </Reveal>

        <Reveal delay={180}>
          <div className="card p-5 border-base-border/70">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold uppercase tracking-wider">Skill Gap Delta</span>
              <ShieldCheck size={17} className={proposedGaps.length < currentGaps.length ? 'text-success' : 'text-warning'} />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-text-primary tracking-tight flex items-center gap-2">
              <span className={currentGaps.length > 0 ? 'text-warning' : 'text-success'}>{currentGaps.length}</span>
              <span className="text-base font-normal text-text-secondary">→</span>
              <span className={proposedGaps.length === 0 ? 'text-success' : 'text-cyan'}>{proposedGaps.length}</span>
            </div>
            <div className="mt-1 text-xs text-text-secondary">Active gaps → proposed gaps</div>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <div className="card p-5 border-base-border/70">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold uppercase tracking-wider">Avg Team Workload</span>
              <Gauge size={17} className="text-warning" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-text-primary tracking-tight flex items-center gap-2">
              <span>{beforeAvg}%</span>
              <span className="text-base font-normal text-text-secondary">→</span>
              <span className={afterAvg > 85 ? 'text-critical' : 'text-success'}>{afterAvg}%</span>
            </div>
            <div className="mt-1 text-xs text-text-secondary">Estimated member utilization</div>
          </div>
        </Reveal>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Reveal delay={160}>
          <section className="card p-5 flex flex-col h-full shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-base-border/60">
              <div>
                <h2 className="text-base font-bold text-text-primary tracking-tight">Current Saved Team</h2>
                <p className="text-xs text-text-secondary mt-0.5">Live roster as recorded in the shared database.</p>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-base-hover border border-base-border text-text-secondary font-medium">
                Live State
              </span>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[320px]">
              {project.assignedEmployeeIds.map((id) => {
                const employee = employees.find((item) => item.id === id);
                if (!employee) return null;
                return (
                  <AllocationMember
                    key={id}
                    employee={employee}
                    utilization={calculateEmployeeUtilization(id, projects, employee.targetUtilization)}
                  />
                );
              })}
              {project.assignedEmployeeIds.length === 0 && (
                <p className="text-xs text-text-secondary text-center py-6">No team members currently assigned.</p>
              )}
            </div>

            <div className="mt-5 border-t border-base-border/50 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Skill Coverage</h3>
              <CoverageList items={currentCoverage} />
            </div>
          </section>
        </Reveal>

        <Reveal delay={220}>
          <section className="card p-5 flex flex-col h-full shadow-lg border-primary/30">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-base-border/60">
              <div>
                <h2 className="text-base font-bold text-text-primary tracking-tight">Capacity-Safe AI Proposal</h2>
                <p className="text-xs text-text-secondary mt-0.5">Automated recommendation filling open seats without overloading.</p>
              </div>
              <button
                className="btn-primary text-xs"
                onClick={() => navigate('/workforce-twin', { state: { projectId: project.id } })}
              >
                Model in Twin <ArrowRight size={13} />
              </button>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[320px]">
              {proposal.map((id) => {
                const employee = employees.find((item) => item.id === id);
                if (!employee) return null;
                const isNew = !project.assignedEmployeeIds.includes(id);
                return (
                  <div key={id} className="relative">
                    <AllocationMember
                      employee={employee}
                      utilization={calculateEmployeeUtilization(id, proposedProjects, employee.targetUtilization)}
                    />
                    {isNew && (
                      <span className="absolute -top-1 -right-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-cyan text-base-bg uppercase tracking-wide shadow-sm">
                        + Proposed
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 border-t border-base-border/50 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan">Proposed Skill Coverage</h3>
              <CoverageList items={proposedCoverage} />
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
