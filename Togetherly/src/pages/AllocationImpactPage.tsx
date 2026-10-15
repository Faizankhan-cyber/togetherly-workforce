import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download, Gauge, ShieldCheck, Users } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/context/DataContext';
import {
  calculateEmployeeUtilization,
  exportToCsv,
  generateRecommendations,
  getSkillName,
  getTeamSkillCoverage,
} from '@/utils';

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
  const beforeMembers = reportProject.assignedEmployeeIds.map((id) => employees.find((item) => item.id === id)).filter(Boolean);
  const afterMembers = proposal.map((id) => employees.find((item) => item.id === id)).filter(Boolean);
  const proposedProjects = projects.map((item) => item.id === reportProject.id
    ? { ...item, assignedEmployeeIds: proposal }
    : item);
  const averageLoad = (members: typeof afterMembers, sourceProjects: typeof projects) => Math.round(
    members.reduce((sum, employee) => sum + (employee
      ? calculateEmployeeUtilization(employee.id, sourceProjects, employee.targetUtilization)
      : 0), 0) / Math.max(members.length, 1)
  );
  const beforeAvg = averageLoad(beforeMembers, projects);
  const afterAvg = averageLoad(afterMembers, proposedProjects);
  const changedNames = proposal
    .filter((id) => !reportProject.assignedEmployeeIds.includes(id))
    .map((id) => employees.find((employee) => employee.id === id)?.name)
    .filter(Boolean);

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
    <div>
      <PageHeader
        title="Allocation Impact Report"
        description="Compare the saved project allocation with a capacity-safe staffing recommendation."
        breadcrumb={['Home', 'Allocation Impact']}
        actions={<button className="btn-secondary" onClick={exportReport}><Download size={15} /> Export report</button>}
      />

      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 card p-4">
        <p className="max-w-xl text-sm text-text-secondary">This report is calculated from the current employee, project, and skill records. The suggested team is a draft; it is not applied until you confirm it in Workforce Twin.</p>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Project
          <select className="input-field min-w-[240px]" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            {projects.filter((item) => item.status !== 'completed').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </section>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5"><div className="flex items-center justify-between text-xs text-text-secondary"><span>Current staffing</span><Users size={17} className="text-primary" /></div><div className="mt-3 text-2xl font-semibold text-text-primary">{currentStaffing}<span className="text-base font-normal text-text-secondary"> / {project.targetTeamSize}</span></div></div>
        <div className="card p-5"><div className="flex items-center justify-between text-xs text-text-secondary"><span>Proposed staffing</span><Users size={17} className="text-cyan" /></div><div className="mt-3 text-2xl font-semibold text-text-primary">{proposedStaffing}<span className="text-base font-normal text-text-secondary"> / {project.targetTeamSize}</span></div></div>
        <div className="card p-5"><div className="flex items-center justify-between text-xs text-text-secondary"><span>Skill gaps</span><ShieldCheck size={17} className={proposedGaps.length < currentGaps.length ? 'text-success' : 'text-warning'} /></div><div className="mt-3 text-2xl font-semibold text-text-primary">{currentGaps.length}<span className="mx-2 text-sm text-text-secondary">→</span>{proposedGaps.length}</div><div className="mt-1 text-xs text-text-secondary">Current → proposed team</div></div>
        <div className="card p-5"><div className="flex items-center justify-between text-xs text-text-secondary"><span>Team average workload</span><Gauge size={17} className="text-warning" /></div><div className="mt-3 text-2xl font-semibold text-text-primary">{beforeAvg}%<span className="mx-2 text-sm text-text-secondary">→</span>{afterAvg}%</div><div className="mt-1 text-xs text-text-secondary">Estimated among assigned members</div></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="card p-5">
          <h2 className="font-semibold text-text-primary">Current saved team</h2>
          <div className="mt-4 space-y-2">
            {project.assignedEmployeeIds.map((id) => {
              const employee = employees.find((item) => item.id === id);
              if (!employee) return null;
              return <AllocationMember key={id} employee={employee} utilization={calculateEmployeeUtilization(id, projects, employee.targetUtilization)} />;
            })}
            {project.assignedEmployeeIds.length === 0 && <p className="text-sm text-text-secondary">No one is currently assigned.</p>}
          </div>
          <div className="mt-5 border-t border-base-border pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Current coverage</h3>
            <CoverageList items={currentCoverage} />
          </div>
        </section>

        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-semibold text-text-primary">Capacity-safe proposal</h2><p className="mt-1 text-xs text-text-secondary">Adds the strongest eligible candidates to open seats.</p></div>
            <button className="btn-primary" onClick={() => navigate('/workforce-twin', { state: { projectId } })}>Review in Workforce Twin <ArrowRight size={15} /></button>
          </div>
          <div className="mt-4 space-y-2">
            {proposal.map((id) => {
              const employee = employees.find((item) => item.id === id);
              if (!employee) return null;
              return <AllocationMember key={id} employee={employee} utilization={calculateEmployeeUtilization(id, projects, employee.targetUtilization)} added={!project.assignedEmployeeIds.includes(id)} />;
            })}
            {proposal.length === 0 && <p className="text-sm text-text-secondary">No capacity-safe team proposal could be generated.</p>}
          </div>
          {changedNames.length > 0 && <div className="mt-4 rounded-xl border border-cyan/20 bg-cyan/5 p-3 text-xs text-cyan">Suggested additions: {changedNames.join(', ')}</div>}
          <div className="mt-5 border-t border-base-border pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Proposed coverage</h3>
            <CoverageList items={proposedCoverage} />
          </div>
          <p className="mt-4 text-[11px] text-text-secondary">Workload estimate uses 25% capacity per active project assignment.</p>
        </section>
      </div>
    </div>
  );
}

function AllocationMember({ employee, utilization, added = false }: {
  employee: NonNullable<ReturnType<typeof useData>['employees'][number]>;
  utilization: number;
  added?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-base-border bg-base-bg/70 p-3">
      <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-text-primary">{employee.name}</div><div className="text-xs text-text-secondary">{employee.role}</div></div>
      {added && <span className="rounded-full bg-cyan/10 px-2 py-1 text-[10px] text-cyan">Suggested</span>}
      <span className="text-xs text-text-secondary">{utilization}% load</span>
    </div>
  );
}

function CoverageList({ items }: { items: ReturnType<typeof getTeamSkillCoverage> }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.skillId} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-text-primary">{getSkillName(item.skillId)} <span className="text-text-secondary">· min L{item.minLevel}</span></span>
          <span className={item.covered ? 'text-success' : 'text-warning'}>{item.covered ? `Covered at L${item.bestLevel}` : 'Gap'}</span>
        </div>
      ))}
    </div>
  );
}
