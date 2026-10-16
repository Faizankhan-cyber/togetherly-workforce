import { useState, useMemo } from 'react';
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

  function getSimulatedUtilization(empId: string): number {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return 0;
    return calculateEmployeeUtilization(empId, simulatedProjects, emp.targetUtilization);
  }

  function getCurrentUtilization(empId: string): number {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return 0;
    return calculateEmployeeUtilization(empId, projects, emp.targetUtilization);
  }

  function handleSimulate(empId: string, projectId: string, action: 'assign' | 'unassign') {
    const existing = simulations.find((s) => s.employeeId === empId && s.projectId === projectId);
    if (existing) {
      setSimulations(simulations.filter((s) => s !== existing));
    } else {
      setSimulations([...simulations, { employeeId: empId, projectId, action }]);
    }
  }

  function handleConfirm() {
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

  // Suggested reassignments: overloaded employees on active projects where underutilized employees could take over
  const suggestions = useMemo(() => {
    const sugg: { from: Employee; to: Employee; projectId: string; projectName: string }[] = [];
    for (const over of overloaded) {
      const overProjects = getEmployeeProjects(over.id, simulatedProjects).filter((p) => p.status !== 'completed');
      for (const proj of overProjects) {
        for (const under of underutilized) {
          if (!proj.assignedEmployeeIds.includes(under.id)) {
            sugg.push({ from: over, to: under, projectId: proj.id, projectName: proj.name });
            break;
          }
        }
        if (sugg.length >= 3) break;
      }
      if (sugg.length >= 3) break;
    }
    return sugg;
  }, [overloaded, underutilized, simulatedProjects]);

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
              <button className="btn-primary" onClick={() => setConfirmOpen(true)}>
                <Check size={16} /> Apply {simulations.length} Change{simulations.length > 1 ? 's' : ''}
              </button>
            )}
          </>
        }
      />

      <Reveal>
      <div className="card p-4 mb-4">
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
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Reveal delay={0}>
          <div className="text-xl font-bold text-critical">{overloaded.length}</div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="text-xl font-bold text-success">
            {filteredEmployees.length - overloaded.length - underutilized.length}
          </div>
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div className="text-xl font-bold text-cyan">{underutilized.length}</div>
          </div>
        </Reveal>
      </div>
      <p className="mb-4 -mt-2 text-xs text-text-secondary">
        Workload is an estimate: each active project assignment counts as {ESTIMATED_PROJECT_LOAD_PERCENT}% capacity because the demo data does not include timesheets.
      </p>

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
                <span className="text-xs text-text-secondary ml-auto">{s.projectName}</span>
                <button
                  className="btn-secondary text-xs"
                  onClick={() => {
                    handleSimulate(s.from.id, s.projectId, 'unassign');
                    handleSimulate(s.to.id, s.projectId, 'assign');
                    showToast('info', `Simulated: reassign ${s.from.name} → ${s.to.name} on ${s.projectName}`);
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
      />
    </div>
  );
}
