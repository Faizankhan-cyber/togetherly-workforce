import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Mail,
  GraduationCap,
  FolderKanban,
  Edit2,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { CapacityBar } from '@/components/CapacityBar';
import { SkillTag } from '@/components/SkillTag';
import { Reveal } from '@/components/Reveal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { useData } from '@/context/DataContext';
import {
  calculateEmployeeUtilization,
  getEmployeeProjects,
  getSkillName,
} from '@/utils';
import { skillsList } from '@/data/mockData';
import type { Employee, AvailabilityStatus } from '@/types';

export function EmployeesPage() {
  const { employees, projects, settings, addEmployee, updateEmployee, deleteEmployee, showToast } = useData();
  const location = useLocation();
  const stateEmployeeId = (location.state as { employeeId?: string } | null)?.employeeId;

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [availFilter, setAvailFilter] = useState('all');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(stateEmployeeId || null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemovingEmployee, setIsRemovingEmployee] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDept, setFormDept] = useState('Engineering');
  const [formEmail, setFormEmail] = useState('');
  const [formAvail, setFormAvail] = useState<AvailabilityStatus>('available');
  const [formExp, setFormExp] = useState(4);
  const [formSkills, setFormSkills] = useState<{ skillId: string; level: number }[]>([]);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        search === '' ||
        `${emp.name} ${emp.role} ${emp.department}`.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'all' || emp.department === deptFilter;
      const matchAvail = availFilter === 'all' || emp.availability === availFilter;
      return matchSearch && matchDept && matchAvail;
    });
  }, [employees, search, deptFilter, availFilter]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmpId) || null,
    [employees, selectedEmpId]
  );

  function openCreateModal() {
    setEditingEmp(null);
    setFormName('');
    setFormRole('');
    setFormDept('Engineering');
    setFormEmail('');
    setFormAvail('available');
    setFormExp(4);
    setFormSkills([
      { skillId: 'skl-react', level: 3 },
      { skillId: 'skl-typescript', level: 3 },
    ]);
    setModalOpen(true);
  }

  function openEditModal(emp: Employee) {
    setEditingEmp(emp);
    setFormName(emp.name);
    setFormRole(emp.role);
    setFormDept(emp.department);
    setFormEmail(emp.email);
    setFormAvail(emp.availability);
    setFormExp(emp.yearsExperience || emp.experienceYears || 3);
    setFormSkills(emp.skills);
    setModalOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formRole.trim()) {
      showToast('error', 'Name and Role are required.');
      return;
    }

    if (editingEmp) {
      updateEmployee(editingEmp.id, {
        name: formName,
        role: formRole,
        department: formDept,
        email: formEmail,
        availability: formAvail,
        yearsExperience: formExp,
        skills: formSkills,
      });
      showToast('success', `Updated ${formName}'s profile.`);
    } else {
      const colors = ['#0078D4', '#107C10', '#5C2D91', '#008272', '#D83B01', '#004E8C'];
      const avatarColor = colors[Math.floor(Math.random() * colors.length)];
      addEmployee({
        name: formName,
        role: formRole,
        department: formDept,
        email: formEmail || `${formName.toLowerCase().replace(/\s+/g, '.')}@togetherly.io`,
        avatarColor,
        availability: formAvail,
        yearsExperience: formExp,
        experienceYears: formExp,
        targetUtilization: 100,
        skills: formSkills,
        trainingAssignments: [],
      });
    }
    setModalOpen(false);
  }

  function toggleSkillInForm(skillId: string) {
    const existing = formSkills.find((s) => s.skillId === skillId);
    if (existing) {
      setFormSkills(formSkills.filter((s) => s.skillId !== skillId));
    } else {
      setFormSkills([...formSkills, { skillId, level: 3 }]);
    }
  }

  function updateSkillLevelInForm(skillId: string, level: number) {
    setFormSkills(
      formSkills.map((s) => (s.skillId === skillId ? { ...s, level } : s))
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Talent Directory & Skills Inventory"
        description="Search employee profiles, verify technical competencies, and audit organizational capacity allocations."
        breadcrumb={['Home', 'Employees']}
        actions={
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={14} />
            <span>Add Employee</span>
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <Reveal direction="down">
        <div className="card p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative w-full md:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Search by name, role, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-8 pr-3 w-full text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-text-secondary font-medium">Dept:</label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="input-field py-1 px-2 text-xs"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-text-secondary font-medium">Status:</label>
              <select
                value={availFilter}
                onChange={(e) => setAvailFilter(e.target.value)}
                className="input-field py-1 px-2 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="available">Available</option>
                <option value="busy">Partially Allocated</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>

            <span className="text-xs text-text-secondary ml-auto md:ml-0 font-mono font-medium">
              {filteredEmployees.length} personnel
            </span>
          </div>
        </div>
      </Reveal>

      {/* Main Grid */}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Employees Cards List */}
        <div className="space-y-2.5">
          {filteredEmployees.map((emp, idx) => {
            const util = calculateEmployeeUtilization(emp.id, projects, emp.targetUtilization);
            const assignedProjects = getEmployeeProjects(emp.id, projects).filter((p) => p.status !== 'completed');
            const isSelected = selectedEmpId === emp.id;

            return (
              <Reveal key={emp.id} delay={idx * 20}>
                <div
                  onClick={() => setSelectedEmpId(emp.id)}
                  className={`card p-4 cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'border-primary bg-primary-50/50 shadow-xs ring-1 ring-primary'
                      : 'hover:border-primary/40 hover:bg-base-hover'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={emp.name} color={emp.avatarColor} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs sm:text-sm font-bold text-text-primary truncate">{emp.name}</h3>
                          <StatusBadge status={emp.availability} />
                        </div>
                        <p className="text-xs text-text-secondary truncate mt-0.5">
                          {emp.role} · <span className="text-primary font-medium">{emp.department}</span> · {emp.yearsExperience || emp.experienceYears} yrs exp
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-40 shrink-0">
                      <CapacityBar
                        utilization={util}
                        overloadedThreshold={settings.overloadedThreshold}
                        underutilizedThreshold={settings.underutilizedThreshold}
                        label="Workload"
                      />
                    </div>
                  </div>

                  {/* Skills preview */}
                  <div className="mt-3 pt-2.5 border-t border-base-border flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {emp.skills.slice(0, 4).map((s) => (
                        <SkillTag key={s.skillId} skillId={s.skillId} level={s.level} showLevel />
                      ))}
                      {emp.skills.length > 4 && (
                        <span className="text-[11px] text-text-secondary self-center px-1 font-mono">
                          +{emp.skills.length - 4} more
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                      <FolderKanban size={13} className="text-primary" />
                      <span>{assignedProjects.length} active project{assignedProjects.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}

          {filteredEmployees.length === 0 && (
            <div className="card p-10 text-center text-text-secondary bg-white">
              <Users size={28} className="mx-auto mb-2 text-primary opacity-50" />
              <p className="text-xs font-semibold text-text-primary">No employees found</p>
              <p className="text-xs mt-0.5">Try adjusting your filters or search keywords.</p>
            </div>
          )}
        </div>

        {/* Selected Employee Detail Drawer */}
        <div className="sticky top-18 self-start">
          {selectedEmployee ? (
            <Reveal direction="left">
              <div className="card p-5 space-y-4 shadow-sm border-base-border bg-white">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-base-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={selectedEmployee.name} color={selectedEmployee.avatarColor} size="lg" />
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-bold text-text-primary truncate">{selectedEmployee.name}</h2>
                      <p className="text-xs text-text-secondary">{selectedEmployee.role}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <StatusBadge status={selectedEmployee.availability} />
                        <span className="text-[11px] text-text-secondary font-mono">{selectedEmployee.department}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedEmployee)}
                      className="p-1.5 rounded-md border border-base-border hover:bg-base-hover text-text-secondary hover:text-text-primary transition-colors"
                      title="Edit employee"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeleteConfirmId(selectedEmployee.id); setRemoveReason(''); }}
                      className="p-1.5 rounded-md border border-red-200 hover:bg-red-50 text-critical transition-colors"
                      title="Remove employee"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Contact & Capacity Info */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-base-subtle border border-base-border">
                    <div className="text-text-secondary text-[10px] uppercase font-semibold">Contact</div>
                    <div className="flex items-center gap-1 mt-1 font-mono text-text-primary truncate">
                      <Mail size={12} className="text-primary shrink-0" />
                      <span className="truncate">{selectedEmployee.email}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-base-subtle border border-base-border">
                    <div className="text-text-secondary text-[10px] uppercase font-semibold">Experience</div>
                    <div className="text-text-primary font-bold mt-1">
                      {selectedEmployee.yearsExperience || selectedEmployee.experienceYears} Years
                    </div>
                  </div>
                </div>

                {/* Capacity */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Workload Allocation
                  </h4>
                  <div className="p-3 rounded-lg bg-base-subtle border border-base-border">
                    <CapacityBar
                      utilization={calculateEmployeeUtilization(selectedEmployee.id, projects, selectedEmployee.targetUtilization)}
                      overloadedThreshold={settings.overloadedThreshold}
                      underutilizedThreshold={settings.underutilizedThreshold}
                      label="Capacity Load"
                    />
                  </div>
                </div>

                {/* Assigned Projects */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      Active Projects
                    </h4>
                    <span className="text-[11px] text-text-secondary font-mono">
                      {getEmployeeProjects(selectedEmployee.id, projects).length} Total
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {getEmployeeProjects(selectedEmployee.id, projects).map((p) => (
                      <div key={p.id} className="p-2 rounded-lg bg-base-subtle border border-base-border flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-text-primary truncate">{p.name}</div>
                          <div className="text-[10px] text-text-secondary">{p.department}</div>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                    ))}
                    {getEmployeeProjects(selectedEmployee.id, projects).length === 0 && (
                      <p className="text-xs text-text-secondary p-3 text-center border border-dashed border-base-border rounded-lg bg-base-subtle">
                        Not currently assigned to any projects.
                      </p>
                    )}
                  </div>
                </div>

                {/* Competencies */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Verified Competencies ({selectedEmployee.skills.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                    {selectedEmployee.skills.map((s) => (
                      <div key={s.skillId} className="flex items-center justify-between p-2 rounded-md bg-base-subtle border border-base-border">
                        <span className="text-xs font-medium text-text-primary truncate">{getSkillName(s.skillId)}</span>
                        <span className="text-[11px] font-mono font-bold text-primary bg-primary-50 px-1.5 py-0.5 rounded border border-primary-200 shrink-0">
                          L{s.level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Training */}
                {selectedEmployee.trainingAssignments.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                      Training Enrolled
                    </h4>
                    <div className="space-y-1.5">
                      {selectedEmployee.trainingAssignments.map((t) => (
                        <div key={t.id} className="p-2.5 rounded-lg bg-base-subtle border border-base-border">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-text-primary truncate">{t.courseName}</span>
                            <span className="text-[10px] font-mono text-primary font-bold">{t.progress}%</span>
                          </div>
                          <div className="text-[10px] text-text-secondary mt-0.5">{t.provider}</div>
                          <div className="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${t.progress}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          ) : (
            <div className="card p-10 text-center text-text-secondary border-dashed border-base-border bg-base-subtle">
              <GraduationCap size={28} className="mx-auto mb-2 text-primary opacity-50" />
              <p className="text-xs font-medium">Select an employee from the directory to inspect their full profile and history.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-xl p-5 sm:p-6 bg-white border-base-border shadow-modal max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-base-border mb-4">
              <h3 className="text-sm sm:text-base font-bold text-text-primary">
                {editingEmp ? 'Edit Employee Profile' : 'Add New Employee'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Jordan Rivera"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Role / Title *</label>
                  <input
                    type="text"
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Department</label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Product">Product</option>
                    <option value="Data & AI">Data & AI</option>
                    <option value="Security">Security</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="name@togetherly.io"
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Availability</label>
                  <select
                    value={formAvail}
                    onChange={(e) => setFormAvail(e.target.value as AvailabilityStatus)}
                    className="input-field w-full"
                  >
                    <option value="available">Available</option>
                    <option value="busy">Partially Allocated</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">
                    Experience: {formExp} Years
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    value={formExp}
                    onChange={(e) => setFormExp(Number(e.target.value))}
                    className="w-full accent-primary mt-1"
                  />
                </div>
              </div>

              {/* Skills Multi-Select and Levels */}
              <div>
                <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1.5 block">
                  Select Competencies & Minimum Proficiency
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-2 rounded-lg bg-base-subtle border border-base-border">
                  {skillsList.map((skill) => {
                    const active = formSkills.find((s) => s.skillId === skill.id);
                    return (
                      <div
                        key={skill.id}
                        className={`p-2 rounded-md border text-xs transition-colors flex flex-col justify-between ${
                          active
                            ? 'border-primary bg-primary-50 text-text-primary'
                            : 'border-base-border bg-white text-text-secondary hover:border-gray-300'
                        }`}
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => toggleSkillInForm(skill.id)}
                        >
                          <span className="font-semibold truncate">{skill.name}</span>
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${active ? 'bg-primary text-white font-bold' : 'border border-gray-300'}`}>
                            {active ? '✓' : ''}
                          </span>
                        </div>
                        {active && (
                          <div className="flex items-center gap-1 mt-1 pt-1 border-t border-primary-200">
                            <span className="text-[10px] text-text-secondary">Lvl:</span>
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => updateSkillLevelInForm(skill.id, lvl)}
                                className={`w-4 h-4 rounded text-[9px] font-bold ${active.level >= lvl ? 'bg-primary text-white' : 'bg-gray-200 text-text-secondary'}`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-base-border">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  <Check size={13} />
                  <span>{editingEmp ? 'Save Changes' : 'Create Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Offboarding confirmation: reason is required and the database record is retained. */}
      <ConfirmationDialog
        open={!!deleteConfirmId}
        onClose={() => {
          if (isRemovingEmployee) return;
          setDeleteConfirmId(null);
          setRemoveReason('');
        }}
        onConfirm={async () => {
          if (!deleteConfirmId || isRemovingEmployee) return;
          if (removeReason.trim().length < 5) {
            showToast('error', 'Add an offboarding reason of at least 5 characters.');
            return;
          }
          const employeeId = deleteConfirmId;
          setIsRemovingEmployee(true);
          const result = await deleteEmployee(employeeId, removeReason.trim());
          setIsRemovingEmployee(false);
          if (!result.success) return;
          if (selectedEmpId === employeeId) setSelectedEmpId(null);
          setDeleteConfirmId(null);
          setRemoveReason('');
        }}
        title="Remove from organization"
        message="This removes the employee from active staffing and disables their organization access. It does not hard-delete their employee or verification history."
        details={
          <div className="space-y-2">
            <label htmlFor="offboarding-reason" className="block text-xs font-semibold text-text-primary">Reason for removal <span className="text-critical">*</span></label>
            <textarea
              id="offboarding-reason"
              value={removeReason}
              onChange={(event) => setRemoveReason(event.target.value)}
              className="input-field min-h-20 w-full"
              placeholder="Record the reason for offboarding…"
              maxLength={1000}
              required
              disabled={isRemovingEmployee}
            />
            <p className="text-[11px] text-text-secondary">Current project allocations will be removed. The reason and reviewer will be recorded in the offboarding audit.</p>
          </div>
        }
        closeOnConfirm={false}
        confirmDisabled={isRemovingEmployee || removeReason.trim().length < 5}
        confirmLabel={isRemovingEmployee ? 'Removing…' : 'Remove employee'}
        danger
      />
    </div>
  );
}
