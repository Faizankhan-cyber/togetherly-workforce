import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Calendar,
  Sparkles,
  GitCompareArrows,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Avatar } from '@/components/Avatar';
import { Reveal } from '@/components/Reveal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { useData } from '@/context/DataContext';
import { getProjectStaffingProgress, getSkillName, formatDate, daysUntil } from '@/utils';
import { skillsList } from '@/data/mockData';
import type { Project, ProjectStatus, ProjectRequirement } from '@/types';

export function ProjectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateProjectId = (location.state as { projectId?: string } | null)?.projectId;

  const { projects, employees, addProject, updateProject, deleteProject, showToast } = useData();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(stateProjectId || null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDept, setFormDept] = useState('Engineering');
  const [formStatus, setFormStatus] = useState<ProjectStatus>('planning');
  const [formTeamSize, setFormTeamSize] = useState(3);
  const [formDeadline, setFormDeadline] = useState('2026-12-31');
  const [skillSearch, setSkillSearch] = useState('');
  const [formSkills, setFormSkills] = useState<ProjectRequirement[]>([
    { skillId: 'skl-react', minLevel: 4, importance: 'required' },
    { skillId: 'skl-typescript', minLevel: 3, importance: 'required' },
  ]);

  const departments = useMemo(
    () => Array.from(new Set(projects.map((p) => p.department))).sort(),
    [projects]
  );

  const filteredSkillOptions = useMemo(() => {
    const term = skillSearch.trim().toLocaleLowerCase();
    return skillsList.filter((skill) => `${skill.name} ${skill.category}`.toLocaleLowerCase().includes(term));
  }, [skillSearch]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        search === '' ||
        `${p.name} ${p.description} ${p.department}`.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchDept = deptFilter === 'all' || p.department === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [projects, search, statusFilter, deptFilter]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  function openCreateModal() {
    setSkillSearch('');
    setEditingProj(null);
    setFormName('');
    setFormDesc('');
    setFormDept('Engineering');
    setFormStatus('planning');
    setFormTeamSize(3);
    setFormDeadline('2026-12-31');
    setFormSkills([
      { skillId: 'skl-react', minLevel: 4, importance: 'required' },
      { skillId: 'skl-typescript', minLevel: 3, importance: 'required' },
    ]);
    setModalOpen(true);
  }

  function openEditModal(proj: Project) {
    setSkillSearch('');
    setEditingProj(proj);
    setFormName(proj.name);
    setFormDesc(proj.description);
    setFormDept(proj.department);
    setFormStatus(proj.status);
    setFormTeamSize(proj.targetTeamSize);
    setFormDeadline(proj.deadline);
    setFormSkills(proj.requiredSkills);
    setModalOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('error', 'Project title is required.');
      return;
    }

    if (editingProj) {
      updateProject(editingProj.id, {
        name: formName,
        description: formDesc,
        department: formDept,
        status: formStatus,
        targetTeamSize: formTeamSize,
        deadline: formDeadline,
        requiredSkills: formSkills,
      });
      showToast('success', `Updated project "${formName}".`);
    } else {
      addProject({
        name: formName,
        description: formDesc,
        department: formDept,
        status: formStatus,
        targetTeamSize: formTeamSize,
        deadline: formDeadline,
        startDate: new Date().toISOString().split('T')[0],
        assignedEmployeeIds: [],
        requiredSkills: formSkills,
        priority: 'high',
      });
    }
    setModalOpen(false);
  }

  function toggleSkillInForm(skillId: string) {
    const existing = formSkills.find((s) => s.skillId === skillId);
    if (existing) {
      setFormSkills(formSkills.filter((s) => s.skillId !== skillId));
    } else {
      setFormSkills([...formSkills, { skillId, minLevel: 3, importance: 'required' }]);
    }
  }

  function updateSkillLevelInForm(skillId: string, minLevel: number) {
    setFormSkills(
      formSkills.map((s) => (s.skillId === skillId ? { ...s, minLevel } : s))
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Project Staffing & Portfolio Catalog"
        description="Manage enterprise deliverables, configure technical prerequisites, and track headcount fulfillment across departments."
        breadcrumb={['Home', 'Projects']}
        actions={
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={14} />
            <span>Create Project</span>
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
              placeholder="Search projects by title, scope, department..."
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
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field py-1 px-2 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="planning">Planning</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <span className="text-xs text-text-secondary ml-auto md:ml-0 font-mono font-medium">
              {filteredProjects.length} initiatives
            </span>
          </div>
        </div>
      </Reveal>

      {/* Projects List and Detail */}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          {filteredProjects.map((project, idx) => {
            const progress = getProjectStaffingProgress(project);
            const isSelected = selectedProjectId === project.id;
            const daysLeft = daysUntil(project.deadline);
            const team = employees.filter((e) => project.assignedEmployeeIds.includes(e.id));

            return (
              <Reveal key={project.id} delay={idx * 20}>
                <div
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`card p-4 cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'border-primary bg-primary-50/50 shadow-xs ring-1 ring-primary'
                      : 'hover:border-primary/40 hover:bg-base-hover'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-bold text-text-primary truncate">{project.name}</h3>
                        <StatusBadge status={project.status} />
                      </div>
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-primary bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
                        {project.assignedEmployeeIds.length}/{project.targetTeamSize} Staffed
                      </span>
                    </div>
                  </div>

                  {/* Staffing Bar */}
                  <div className="mt-3 pt-2.5 border-t border-base-border">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-secondary font-medium">Headcount Progress</span>
                      <span className="font-mono font-bold text-text-primary">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progress >= 100
                            ? 'bg-success'
                            : progress >= 50
                              ? 'bg-primary'
                              : 'bg-warning'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Requirements & Team Row */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-base-border">
                    <div className="flex flex-wrap gap-1">
                      {project.requiredSkills.map((req) => (
                        <span
                          key={req.skillId}
                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-base-subtle border border-base-border text-text-secondary"
                        >
                          {getSkillName(req.skillId)} (L{req.minLevel})
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {team.map((m) => (
                          <Avatar key={m.id} name={m.name} color={m.avatarColor} size="sm" />
                        ))}
                      </div>
                      <span className="text-[11px] text-text-secondary font-mono flex items-center gap-1 font-medium">
                        <Calendar size={12} className="text-primary" />
                        {daysLeft >= 0 ? `${daysLeft}d left` : `${Math.abs(daysLeft)}d overdue`}
                      </span>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="card p-10 text-center text-text-secondary bg-white">
              <FolderKanban size={28} className="mx-auto mb-2 text-primary opacity-50" />
              <p className="text-xs font-semibold text-text-primary">No projects matched</p>
              <p className="text-xs mt-0.5">Try modifying filter criteria or create a new project.</p>
            </div>
          )}
        </div>

        {/* Selected Project Detailed Overview */}
        <div className="sticky top-18 self-start">
          {selectedProject ? (
            <Reveal direction="left">
              <div className="card p-5 space-y-4 shadow-sm border-base-border bg-white">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-base-border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-text-primary truncate">{selectedProject.name}</h2>
                      <StatusBadge status={selectedProject.status} />
                    </div>
                    <p className="text-xs text-text-secondary mt-1 font-mono">{selectedProject.department} · Deadline {formatDate(selectedProject.deadline)}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedProject)}
                      className="p-1.5 rounded-md border border-base-border hover:bg-base-hover text-text-secondary hover:text-text-primary transition-colors"
                      title="Edit project"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(selectedProject.id)}
                      className="p-1.5 rounded-md border border-red-200 hover:bg-red-50 text-critical transition-colors"
                      title="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed bg-base-subtle p-3 rounded-lg border border-base-border">
                  {selectedProject.description}
                </p>

                {/* Fast Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/workforce-twin', { state: { projectId: selectedProject.id } })}
                    className="btn-primary text-xs py-2"
                  >
                    <GitCompareArrows size={13} />
                    <span>Workforce Twin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/team-builder', { state: { projectId: selectedProject.id } })}
                    className="btn-secondary text-xs py-2"
                  >
                    <Sparkles size={13} className="text-primary" />
                    <span>Team Builder</span>
                  </button>
                </div>

                {/* Assigned Roster */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      Current Assigned Squad ({selectedProject.assignedEmployeeIds.length}/{selectedProject.targetTeamSize})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {selectedProject.assignedEmployeeIds.map((id) => {
                      const emp = employees.find((e) => e.id === id);
                      if (!emp) return null;
                      return (
                        <div key={id} className="p-2 rounded-lg bg-base-subtle border border-base-border flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={emp.name} color={emp.avatarColor} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-text-primary truncate">{emp.name}</div>
                              <div className="text-[10px] text-text-secondary truncate">{emp.role}</div>
                            </div>
                          </div>
                          <StatusBadge status={emp.availability} />
                        </div>
                      );
                    })}
                    {selectedProject.assignedEmployeeIds.length === 0 && (
                      <p className="text-xs text-text-secondary p-3.5 text-center border border-dashed border-base-border rounded-lg bg-base-subtle">
                        No team members currently assigned. Open Team Builder or Workforce Twin to staff this project.
                      </p>
                    )}
                  </div>
                </div>

                {/* Required Skills Matrix */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Required Competencies
                  </h4>
                  <div className="space-y-1">
                    {selectedProject.requiredSkills.map((req) => (
                      <div key={req.skillId} className="flex items-center justify-between p-2 rounded-md bg-base-subtle border border-base-border text-xs">
                        <span className="font-semibold text-text-primary">{getSkillName(req.skillId)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-semibold text-text-secondary">{req.importance}</span>
                          <span className="font-mono font-bold text-primary bg-primary-50 px-1.5 py-0.5 rounded border border-primary-200">
                            Min L{req.minLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ) : (
            <div className="card p-10 text-center text-text-secondary border-dashed border-base-border bg-base-subtle">
              <FolderKanban size={28} className="mx-auto mb-2 text-primary opacity-50" />
              <p className="text-xs font-medium">Select a project from the catalog to view details, staffing status, and launch simulations.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-xl p-5 sm:p-6 bg-white border-base-border shadow-modal max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-base-border mb-4">
              <h3 className="text-sm sm:text-base font-bold text-text-primary">
                {editingProj ? 'Edit Project Specifications' : 'Create New Project'}
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
              <div>
                <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Project Title *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Next-Gen Payments Architecture"
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Scope & Objectives</label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Summarize the core engineering mission and deliverables..."
                  className="input-field w-full"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ProjectStatus)}
                    className="input-field w-full"
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Target Team: {formTeamSize}</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formTeamSize}
                    onChange={(e) => setFormTeamSize(Math.max(1, Number(e.target.value)))}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1 block">Deadline</label>
                <input
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="input-field w-full"
                />
              </div>

              {/* Required Skills Selection */}
              <div>
                <label className="text-[11px] font-semibold text-text-secondary uppercase mb-1.5 block">
                  Required Competencies & Minimum Proficiency
                </label>
                <div className="relative mb-2">
                  <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="search"
                    value={skillSearch}
                    onChange={(event) => setSkillSearch(event.target.value)}
                    placeholder="Search skills (e.g. Azure, SIEM, Python)…"
                    aria-label="Search project skill requirements"
                    className="input-field w-full pl-8 pr-3 text-xs"
                  />
                </div>
                <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-text-secondary">
                  <span>{formSkills.length} skill requirement{formSkills.length === 1 ? '' : 's'} selected</span>
                  {skillSearch && <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setSkillSearch('')}>Clear search</button>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto p-2 rounded-lg bg-base-subtle border border-base-border">
                  {filteredSkillOptions.map((skill) => {
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
                            <span className="text-[10px] text-text-secondary">Min:</span>
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => updateSkillLevelInForm(skill.id, lvl)}
                                className={`w-4 h-4 rounded text-[9px] font-bold ${active.minLevel >= lvl ? 'bg-primary text-white' : 'bg-gray-200 text-text-secondary'}`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredSkillOptions.length === 0 && <p className="col-span-full p-4 text-center text-xs text-text-secondary">No skills match that search. Try Azure, security, a language, or a tool name.</p>}
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
                  <span>{editingProj ? 'Save Project' : 'Launch Project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteProject(deleteConfirmId);
            if (selectedProjectId === deleteConfirmId) setSelectedProjectId(null);
          }
        }}
        title="Delete Project"
        message="Are you sure you want to delete this project? Existing assigned team members will have their workload capacity freed up."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
