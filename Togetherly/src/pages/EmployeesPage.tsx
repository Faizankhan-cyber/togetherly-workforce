import { useState, useMemo } from 'react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Mail,
  Briefcase,
  Clock,
  GraduationCap,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { SkillTag } from '@/components/SkillTag';
import { CapacityBar } from '@/components/CapacityBar';
import { EmployeeForm } from '@/components/EmployeeForm';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { EmptyState } from '@/components/EmptyState';
import { FilterToolbar, SelectFilter, SearchInput } from '@/components/FilterToolbar';
import { Reveal } from '@/components/Reveal';
import { useData } from '@/context/DataContext';
import {
  calculateEmployeeUtilization,
  getEmployeeProjects,
  getSkillName,
} from '@/utils';
import type { Employee } from '@/types';

type SortField = 'name' | 'role' | 'department' | 'experience' | 'utilization';
type SortDir = 'asc' | 'desc';

export function EmployeesPage() {
  const { employees, projects, settings, deleteEmployee, showToast } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [availFilter, setAvailFilter] = useState('all');
  const [workloadFilter, setWorkloadFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  useEffect(() => {
    const employeeId = (location.state as { employeeId?: string } | null)?.employeeId;
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    setSelectedEmployee(employee);
    navigate(location.pathname, { replace: true, state: null });
  }, [employees, location.pathname, location.state, navigate]);

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);
  const allSkillIds = useMemo(() => Array.from(new Set(employees.flatMap((e) => e.skills.map((s) => s.skillId)))).sort(), [employees]);

  const filtered = useMemo(() => {
    let result = employees.filter((e) => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.role.toLowerCase().includes(search.toLowerCase())) return false;
      if (skillFilter !== 'all' && !e.skills.some((s) => s.skillId === skillFilter)) return false;
      if (deptFilter !== 'all' && e.department !== deptFilter) return false;
      if (availFilter !== 'all' && e.availability !== availFilter) return false;
      if (workloadFilter !== 'all') {
        const util = calculateEmployeeUtilization(e.id, projects, e.targetUtilization);
        const status = util >= settings.overloadedThreshold ? 'overloaded' : util <= settings.underutilizedThreshold ? 'underutilized' : 'balanced';
        if (status !== workloadFilter) return false;
      }
      return true;
    });

    result = result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'role': cmp = a.role.localeCompare(b.role); break;
        case 'department': cmp = a.department.localeCompare(b.department); break;
        case 'experience': cmp = a.yearsExperience - b.yearsExperience; break;
        case 'utilization':
          cmp = calculateEmployeeUtilization(a.id, projects, a.targetUtilization) - calculateEmployeeUtilization(b.id, projects, b.targetUtilization);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [employees, projects, settings, search, skillFilter, deptFilter, availFilter, workloadFilter, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleAdd() {
    setEditingEmployee(null);
    setFormOpen(true);
  }

  function handleEdit(emp: Employee) {
    setEditingEmployee(emp);
    setFormOpen(true);
  }

  function handleDelete(emp: Employee) {
    setDeleteTarget(emp);
  }

  function confirmDelete() {
    if (deleteTarget) {
      deleteEmployee(deleteTarget.id);
      showToast('success', `Employee "${deleteTarget.name}" removed`);
      if (selectedEmployee?.id === deleteTarget.id) setSelectedEmployee(null);
    }
  }

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
    >
      {label}
      {sortField === field && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Employees"
        description={`${employees.length} employees across ${departments.length} departments`}
        breadcrumb={['Home', 'Employees']}
        actions={
          <button className="btn-primary" onClick={handleAdd}>
            <Plus size={16} /> Add Employee
          </button>
        }
      />

      {/* Filters */}
      <Reveal>
      <div className="card p-4 mb-4">
        <FilterToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or role..." />
          <SelectFilter
            label="Skill"
            value={skillFilter}
            onChange={setSkillFilter}
            options={[
              { value: 'all', label: 'All Skills' },
              ...allSkillIds.map((id) => ({ value: id, label: getSkillName(id) })),
            ]}
          />
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
            label="Availability"
            value={availFilter}
            onChange={setAvailFilter}
            options={[
              { value: 'all', label: 'Any' },
              { value: 'available', label: 'Available' },
              { value: 'busy', label: 'Busy' },
              { value: 'unavailable', label: 'Unavailable' },
            ]}
          />
          <SelectFilter
            label="Workload"
            value={workloadFilter}
            onChange={setWorkloadFilter}
            options={[
              { value: 'all', label: 'Any' },
              { value: 'overloaded', label: 'Overloaded' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'underutilized', label: 'Underutilized' },
            ]}
          />
          <button
            className="btn-ghost"
            onClick={() => { setSearch(''); setSkillFilter('all'); setDeptFilter('all'); setAvailFilter('all'); setWorkloadFilter('all'); }}
          >
            <X size={14} /> Clear
          </button>
        </FilterToolbar>
      </div>
      </Reveal>

      {/* Table + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Reveal delay={0} className="lg:col-span-2">
        <div className="lg:col-span-2 card overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              title="No employees found"
              description="Try adjusting your filters or add a new employee."
              action={<button className="btn-primary" onClick={handleAdd}><Plus size={16} /> Add Employee</button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-base-border">
                    <th className="text-left py-3 px-4"><SortHeader field="name" label="Name" /></th>
                    <th className="text-left py-3 px-4 hidden sm:table-cell"><SortHeader field="department" label="Department" /></th>
                    <th className="text-left py-3 px-4 hidden md:table-cell"><SortHeader field="experience" label="Exp." /></th>
                    <th className="text-left py-3 px-4"><SortHeader field="utilization" label="Utilization" /></th>
                    <th className="text-left py-3 px-4 hidden sm:table-cell">Availability</th>
                    <th className="text-right py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => {
                    const util = calculateEmployeeUtilization(emp.id, projects, emp.targetUtilization);
                    return (
                      <tr
                        key={emp.id}
                        className="border-b border-base-border/50 hover:bg-base-hover transition-colors cursor-pointer"
                        onClick={() => setSelectedEmployee(emp)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={emp.name} color={emp.avatarColor} size="sm" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-text-primary truncate">{emp.name}</div>
                              <div className="text-xs text-text-secondary truncate">{emp.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell text-sm text-text-secondary">{emp.department}</td>
                        <td className="py-3 px-4 hidden md:table-cell text-sm text-text-secondary">{emp.yearsExperience}y</td>
                        <td className="py-3 px-4 w-32">
                          <CapacityBar utilization={util} overloadedThreshold={settings.overloadedThreshold} underutilizedThreshold={settings.underutilizedThreshold} showLabel={false} />
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell"><StatusBadge status={emp.availability} /></td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(emp); }} className="p-1.5 rounded-md text-text-secondary hover:text-primary hover:bg-base-hover transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(emp); }} className="p-1.5 rounded-md text-text-secondary hover:text-critical hover:bg-base-hover transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 text-xs text-text-secondary border-t border-base-border">
            Showing {filtered.length} of {employees.length} employees
          </div>
        </div>
        </Reveal>

        {/* Detail Panel */}
        <Reveal delay={80}>
        <div className="card p-5 h-fit sticky top-20">
          {!selectedEmployee ? (
            <EmptyState
              title="Select an employee"
              description="Click any row to view detailed employee information."
            />
          ) : (
            <EmployeeDetail employee={selectedEmployee} onEdit={() => handleEdit(selectedEmployee)} />
          )}
        </div>
        </Reveal>
      </div>

      <EmployeeForm open={formOpen} onClose={() => setFormOpen(false)} employee={editingEmployee} />
      <ConfirmationDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Remove Employee"
        message={`Are you sure you want to remove ${deleteTarget?.name}? They will be unassigned from all projects. This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}

function EmployeeDetail({ employee, onEdit }: { employee: Employee; onEdit: () => void }) {
  const { projects, settings } = useData();
  const util = calculateEmployeeUtilization(employee.id, projects, employee.targetUtilization);
  const empProjects = getEmployeeProjects(employee.id, projects);
  const activeProjects = empProjects.filter((p) => p.status !== 'completed');

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar name={employee.name} color={employee.avatarColor} size="lg" />
          <div>
            <h3 className="text-base font-semibold text-text-primary">{employee.name}</h3>
            <p className="text-sm text-text-secondary">{employee.role}</p>
          </div>
        </div>
        <button onClick={onEdit} className="btn-ghost"><Pencil size={14} /> Edit</button>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-text-secondary">
          <Mail size={14} /> <span>{employee.email}</span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <Briefcase size={14} /> <span>{employee.department}</span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock size={14} /> <span>{employee.yearsExperience} years experience</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={employee.availability} />
        </div>
      </div>

      {/* Skills */}
      <div className="mt-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Skills</h4>
        <div className="flex flex-wrap gap-2">
          {employee.skills.map((es) => (
            <SkillTag key={es.skillId} skillId={es.skillId} level={es.level} showLevel />
          ))}
        </div>
      </div>

      {/* Utilization */}
      <div className="mt-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Workload</h4>
        <CapacityBar utilization={util} overloadedThreshold={settings.overloadedThreshold} underutilizedThreshold={settings.underutilizedThreshold} label="Current Utilization" />
        <div className="text-xs text-text-secondary mt-2">Available capacity: {Math.max(100 - util, 0)}%</div>
      </div>

      {/* Current Projects */}
      <div className="mt-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Current Assignments</h4>
        {activeProjects.length === 0 ? (
          <p className="text-sm text-text-secondary">No active project assignments.</p>
        ) : (
          <div className="space-y-2">
            {activeProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-base-bg border border-base-border">
                <span className="text-sm text-text-primary truncate">{p.name}</span>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Training */}
      {employee.trainingAssignments.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 flex items-center gap-1">
            <GraduationCap size={12} /> Training Recommendations
          </h4>
          <div className="space-y-2">
            {employee.trainingAssignments.map((t) => (
              <div key={t.id} className="p-3 rounded-lg bg-base-bg border border-base-border">
                <div className="text-sm font-medium text-text-primary">{t.courseName}</div>
                <div className="text-xs text-text-secondary mt-0.5">{t.provider} • {getSkillName(t.skillId)}</div>
                <div className="text-xs text-text-secondary mt-1">{t.reason}</div>
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">Progress</span>
                    <span className="text-xs font-medium text-text-primary">{t.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-base-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
