import { useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Download,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { CapacityBar } from '@/components/CapacityBar';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { FilterToolbar, SelectFilter } from '@/components/FilterToolbar';
import { Reveal } from '@/components/Reveal';
import { useData } from '@/context/DataContext';
import {
  calculateEmployeeUtilization,
  getActiveAssignmentCount,
  MAX_CONCURRENT_PROJECTS,
  ESTIMATED_PROJECT_LOAD_PERCENT,
  getUtilizationStatus,
  getEmployeeProjects,
  exportToCsv,
} from '@/utils';
import type { Employee } from '@/types';

interface Simulation {
  employeeId: string;
  projectId: string;
  action: 'assign' | 'unassign';
}

export function WorkloadPlannerPage() {
  const { employees, projects, settings, assignEmployeeToProject, unassignEmployeeFromProject, showToast, addActivity } = useData();
  const [deptFilter, setDeptFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);
  const activeProjects = projects.filter((p) => p.status !== 'completed');

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (deptFilter !== 'all' && e.department !== deptFilter) return false;
      if (projectFilter !== 'all') {
        const empProjects = getEmployeeProjects(e.id, projects);
        if (!empProjects.some((p) => p.id === projectFilter)) return false;
      }
      return true;
    });
  }, [employees, deptFilter, projectFilter, projects]);

  // Simulated project assignments
  const simulatedProjects = useMemo(() => {
    let sim = projects.map((p) => ({ ...p, assignedEmployeeIds: [...p.assignedEmployeeIds] }));
    for (const s of simulations) {
      sim = sim.map((p) => {
        if (p.id !== s.projectId) return p;
        if (s.action === 'assign' && !p.assignedEmployeeIds.includes(s.employeeId)) {
          return { ...p, assignedEmployeeIds: [...p.assignedEmployeeIds, s.employeeId] };
        }
        if (s.action === 'unassign') {
          return { ...p, assignedEmployeeIds: p.assignedEmployeeIds.filter((id) => id !== s.employeeId) };
        }
        return p;
      });
    }
    return sim;
  }, [projects, simulations]);

  const getSimulatedUtilization = useCallback((empId: string): number => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return 0;
    return calculateEmployeeUtilization(empId, simulatedProjects, emp.targetUtilization);
  }, [employees, simulatedProjects]);

  function getCurrentUtilization(empId: string): number {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return 0;
    return calculateEmployeeUtilization(empId, projects, emp.targetUtilization);
  }

  function handleSimulate(empId: string, projectId: string, action: 'assign' | 'unassign') {
    setSimulations((current) => {
      const existing = current.find((item) => item.employeeId === empId && item.projectId === projectId);
      if (existing) return current.filter((item) => item !== existing);
      return [...current.filter((item) => !(item.employeeId === empId && item.projectId === projectId)), { employeeId: empId, projectId, action }];
    });
  }

  function handleSimulateReassignment(from: Employee, to: Employee, projectId: string) {
    const savedProject = projects.find((project) => project.id === projectId);
    if (!savedProject) return;
    setSimulations((current) => {
      const next = current.filter((item) =>
        item.projectId !== projectId || (item.employeeId !== from.id && item.employeeId !== to.id)
      );
      // Store only the delta from the saved roster so apply remains idempotent.
      if (savedProject.assignedEmployeeIds.includes(from.id)) next.push({ employeeId: from.id, projectId, action: 'unassign' });
      if (!savedProject.assignedEmployeeIds.includes(to.id)) next.push({ employeeId: to.id, projectId, action: 'assign' });
      return next;
    });
  }

  function handleConfirm() {
    if (assignmentRisks.length > 0) {
      showToast('error', 'Resolve the capacity warnings before applying these changes.');
      return;
    }
    for (const s of simulations) {
      if (s.action === 'assign') {
        assignEmployeeToProject(s.employeeId, s.projectId);
      } else {
        unassignEmployeeFromProject(s.employeeId, s.projectId);
      }
    }
    addActivity({ type: 'workload', message: `${simulations.length} workload change${simulations.length > 1 ? 's' : ''} applied` });
    showToast('success', `${simulations.length} workload change${simulations.length > 1 ? 's' : ''} applied successfully`);
    setSimulations([]);
    setConfirmOpen(false);
  }

  function handleExport() {
    const headers = ['Employee', 'Department', 'Current Utilization', 'Simulated Utilization', 'Status'];
    const rows = filteredEmployees.map((emp) => {
      const curr = getCurrentUtilization(emp.id);
      const sim = getSimulatedUtilization(emp.id);
      const status = getUtilizationStatus(sim, settings);
      return [emp.name, emp.department, `${curr}%`, `${sim}%`, status];
    });
    exportToCsv('workload-report.csv', headers, rows);
    showToast('success', 'Workload report exported');
  }

  const overloaded = filteredEmployees.filter((e) => getUtilizationStatus(getSimulatedUtilization(e.id), settings) === 'overloaded');
  const underutilized = filteredEmployees.filter((e) => getUtilizationStatus(getSimulatedUtilization(e.id), settings) === 'underutilized');

  // Suggest only handoffs that preserve the project's recorded skill requirements and
  // do not move an employee who is unavailable or already at the project-concurrency limit.
  const suggestions = useMemo(() => {
    const sugg: {
      from: Employee;
      to: Employee;
      projectId: string;
      projectName: string;
      fromLoad: number;
      toLoadAfter: number;
      matchedSkills: number;
    }[] = [];
    for (const over of overloaded) {
      const overProjects = getEmployeeProjects(over.id, simulatedProjects).filter((project) => project.status !== 'completed');
      for (const project of overProjects) {
        for (const under of underutilized) {
          if (under.availability === 'unavailable' || project.assignedEmployeeIds.includes(under.id)) continue;
          if (getActiveAssignmentCount(under.id, simulatedProjects) >= MAX_CONCURRENT_PROJECTS) continue;

          const missingRequiredSkills = project.requiredSkills.filter((requirement) => {
            const skill = under.skills.find((item) => item.skillId === requirement.skillId);
            return !skill || skill.level < requirement.minLevel;
          });
          if (missingRequiredSkills.length > 0) continue;

          const projectedProjects = simulatedProjects.map((item) => item.id === project.id
            ? { ...item, assignedEmployeeIds: [...item.assignedEmployeeIds.filter((id) => id !== over.id), under.id] }
            : item);
          const toLoadAfter = calculateEmployeeUtilization(under.id, projectedProjects, under.targetUtilization);
          if (toLoadAfter > 100) continue;

          sugg.push({
            from: over,
            to: under,
            projectId: project.id,
            projectName: project.name,
            fromLoad: getSimulatedUtilization(over.id),
            toLoadAfter,
            matchedSkills: project.requiredSkills.length,
          });
          break;
        }
        if (sugg.length >= 3) break;
      }
      if (sugg.length >= 3) break;
    }
    return sugg;
  }, [overloaded, underutilized, simulatedProjects, projects, employees, getSimulatedUtilization]);

  const assignmentRisks = useMemo(() => {
    const risks = new Set<string>();
    for (const change of simulations) {
      if (change.action !== 'assign') continue;
      const employee = employees.find((item) => item.id === change.employeeId);
      if (!employee) {
        risks.add('A selected employee is no longer in the active workforce list.');
        continue;
      }
      if (employee.availability === 'unavailable') {
        risks.add(`${employee.name} is marked unavailable.`);
      }
      if (getActiveAssignmentCount(employee.id, simulatedProjects) > MAX_CONCURRENT_PROJECTS) {
        risks.add(`${employee.name} would exceed the ${MAX_CONCURRENT_PROJECTS}-project concurrency limit.`);
      }
    }
    return Array.from(risks);
  }, [simulations, employees, simulatedProjects]);

  return (
    <div>
      <PageHeader
        title="Workload Planner"
        description="Monitor capacity, simulate assignments, and balance your workforce"
        breadcrumb={['Home', 'Workload Planner']}
        actions={
          <>
            <button className="btn-secondary" onClick={handleExport}><Download size={16} /> Export</button>
            {simulations.length > 0 && (
              <button className="btn-secondary" onClick={() => setSimulations([])}>
                <RotateCcw size={16} /> Reset Sim
              </button>
            )}
            {simulations.length > 0 && (
              <button className="btn-primary" onClick={() => setConfirmOpen(true)} disabled={assignmentRisks.length > 0}>
                <Check size={16} /> Apply {simulations.length} Change{simulations.length > 1 ? 's' : ''}
              </button>
            )}
          </>
        }
      />

      <Reveal>
        <div className="card p-4 mb-4">
          <FilterToolbar>
            <SelectFilter
              label="Department"
              value={deptFilter}
              onChange={setDeptFilter}
              options={[
                { value: 'all', label: 'All Departments' },
                ...departments.map((d) => ({ value: d, label: d })),
              ]}
            />
            <SelectFilter
              label="Project"
              value={projectFilter}
              onChange={setProjectFilter}
              options={[
                { value: 'all', label: 'All Projects' },
                ...activeProjects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </FilterToolbar>
        </div>
      </Reveal>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4 xl:grid-cols-4">
        <Reveal delay={0}>
          <div className="card p-4 text-center">
            <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Overloaded</div>
            <div className="text-xl font-bold text-critical">{overloaded.length}</div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="card p-4 text-center">
            <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Balanced</div>
            <div className="text-xl font-bold text-success">
              {filteredEmployees.length - overloaded.length - underutilized.length}
            </div>
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div className="card p-4 text-center">
            <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Underutilized</div>
            <div className="text-xl font-bold text-cyan">{underutilized.length}</div>
          </div>
        </Reveal>
        <Reveal delay={220}>
          <div className="card p-4 text-center">
            <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Draft Changes</div>
            <div className="text-xl font-bold text-primary">{simulations.length}</div>
            <div className="mt-1 text-[10px] text-text-muted">{new Set(simulations.map((change) => change.projectId)).size} projects affected</div>
          </div>
        </Reveal>
      </div>
      <p className="mb-4 -mt-2 text-xs text-text-secondary">
        Workload is an estimate: each active project assignment counts as {ESTIMATED_PROJECT_LOAD_PERCENT}% capacity because the demo data does not include timesheets.
      </p>

      {assignmentRisks.length > 0 && (
        <div role="alert" className="mb-4 rounded-xl border border-critical/30 bg-critical/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-critical"><AlertTriangle size={16} /> Review assignment risks before applying</div>
          <ul className="mt-2 space-y-1">
            {assignmentRisks.map((risk) => <li key={risk} className="text-xs leading-relaxed text-critical">• {risk}</li>)}
          </ul>
          <p className="mt-2 text-[11px] text-text-secondary">Remove or adjust the risky draft assignments. Togetherly will not apply a draft that assigns an unavailable employee or exceeds the concurrency limit.</p>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Reveal>
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-warning" />
            <h3 className="text-sm font-semibold text-text-primary">Suggested Reassignments</h3>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-base-bg border border-base-border">
                <Avatar name={s.from.name} color={s.from.avatarColor} size="sm" />
                <span className="text-sm text-text-primary">{s.from.name}</span>
                <ArrowRight size={16} className="text-text-secondary" />
                <Avatar name={s.to.name} color={s.to.avatarColor} size="sm" />
                <span className="text-sm text-text-primary">{s.to.name}</span>
                <span className="ml-auto text-right text-[10px] leading-relaxed text-text-secondary">{s.projectName}<br />Load {s.fromLoad}% → {s.toLoadAfter}% · {s.matchedSkills} required skills covered</span>
                <button
                  className="btn-secondary text-xs"
                  onClick={() => {
                    handleSimulateReassignment(s.from, s.to, s.projectId);
                    showToast('info', `Drafted a skill-matched handoff: ${s.from.name} → ${s.to.name} on ${s.projectName}`);
                  }}
                >
                  Simulate
                </button>
              </div>
            ))}
          </div>
        </div>
        </Reveal>
      )}

      {/* Workload Table */}
      <Reveal>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-base-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">Employee</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary hidden sm:table-cell">Current</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">Simulated</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary hidden md:table-cell">Projects</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">Quick Assign</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const curr = getCurrentUtilization(emp.id);
                const sim = getSimulatedUtilization(emp.id);
                const changed = curr !== sim;
                const empSimProjects = getEmployeeProjects(emp.id, simulatedProjects).filter((p) => p.status !== 'completed');
                return (
                  <tr key={emp.id} className="border-b border-base-border/50 hover:bg-base-hover transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} color={emp.avatarColor} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">{emp.name}</div>
                          <div className="text-xs text-text-secondary truncate">{emp.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell w-32">
                      <CapacityBar utilization={curr} overloadedThreshold={settings.overloadedThreshold} underutilizedThreshold={settings.underutilizedThreshold} showLabel={false} />
                    </td>
                    <td className="py-3 px-4 w-32">
                      <div className={`text-sm font-medium ${changed ? 'text-primary' : 'text-text-primary'}`}>
                        {sim}%{changed && <span className="text-xs ml-1">({sim > curr ? '+' : ''}{sim - curr})</span>}
                      </div>
                      <CapacityBar utilization={sim} overloadedThreshold={settings.overloadedThreshold} underutilizedThreshold={settings.underutilizedThreshold} showLabel={false} />
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {empSimProjects.length === 0 && <span className="text-xs text-text-secondary">None</span>}
                        {empSimProjects.map((p) => (
                          <span key={p.id} className="text-xs px-2 py-0.5 rounded bg-base-bg border border-base-border text-text-primary">
                            {p.name.slice(0, 15)}{p.name.length > 15 ? '...' : ''}
                            <button
                              onClick={() => handleSimulate(emp.id, p.id, 'unassign')}
                              className="ml-1 text-text-secondary hover:text-critical"
                            >
                              <X size={10} className="inline" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        className="input-field text-xs min-w-[140px]"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleSimulate(emp.id, e.target.value, 'assign');
                        }}
                      >
                        <option value="">+ Assign to...</option>
                        {activeProjects
                           .filter((p) => p.assignedEmployeeIds.length < p.targetTeamSize && !empSimProjects.some((ep) => ep.id === p.id))
                           .filter(() => emp.availability !== 'unavailable')
                           .filter(() => getActiveAssignmentCount(emp.id, simulatedProjects) < MAX_CONCURRENT_PROJECTS)
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name.slice(0, 25)}{p.name.length > 25 ? '...' : ''}</option>
                          ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {simulations.length > 0 && (
          <div className="px-4 py-3 bg-primary/5 border-t border-base-border flex items-center justify-between">
            <span className="text-sm text-text-secondary">{simulations.length} simulated change{simulations.length > 1 ? 's' : ''} pending. Click "Apply" to confirm.</span>
          </div>
        )}
      </div>
      </Reveal>

      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Apply Workload Changes"
        message={`Apply ${simulations.length} workload change${simulations.length > 1 ? 's' : ''}? This will update project assignments permanently.`}
        confirmLabel="Apply Changes"
        confirmDisabled={assignmentRisks.length > 0}
      />
    </div>
  );
}
