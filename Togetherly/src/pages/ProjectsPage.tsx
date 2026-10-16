import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Calendar,
  Users,
  Target,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { SkillTag } from '@/components/SkillTag';
import { Avatar } from '@/components/Avatar';
import { ProjectForm } from '@/components/ProjectForm';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/Modal';
import { FilterToolbar, SelectFilter, SearchInput } from '@/components/FilterToolbar';
import { Reveal } from '@/components/Reveal';
import { useData } from '@/context/DataContext';
import {
  getProjectStaffingProgress,
  getTeamSkillCoverage,
  getSkillName,
  formatDate,
  daysUntil,
  getEmployeeProjects,
} from '@/utils';
import type { Project } from '@/types';

export function ProjectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, employees, deleteProject, showToast } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  useEffect(() => {
    const projectId = (location.state as { projectId?: string } | null)?.projectId;
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    setDetailProject(project);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
      return true;
    });
  }, [projects, search, statusFilter, priorityFilter]);

  function handleAdd() {
    setEditingProject(null);
    setFormOpen(true);
  }

  function handleEdit(project: Project) {
    setEditingProject(project);
    setFormOpen(true);
    setDetailProject(null);
  }

  function confirmDelete() {
    if (deleteTarget) {
      deleteProject(deleteTarget.id);
      showToast('success', `Project "${deleteTarget.name}" deleted`);
    }
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description={`${projects.length} projects across the organization`}
        breadcrumb={['Home', 'Projects']}
        actions={
          <button className="btn-primary" onClick={handleAdd}>
            <Plus size={16} /> Create Project
          </button>
        }
      />

      <Reveal>
      <div className="card p-4 mb-4">
        <FilterToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search projects..." />
          <SelectFilter
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'planning', label: 'Planning' },
              { value: 'active', label: 'Active' },
              { value: 'on-hold', label: 'On Hold' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
          <SelectFilter
            label="Priority"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: 'all', label: 'All Priorities' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
          <button
            className="btn-ghost"
            onClick={() => { setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); }}
          >
            <X size={14} /> Clear
          </button>
        </FilterToolbar>
      </div>
      </Reveal>

      {filtered.length === 0 ? (
        <Reveal>
        <div className="card">
          <EmptyState
            title="No projects found"
            description="Try adjusting filters or create a new project."
            action={<button className="btn-primary" onClick={handleAdd}><Plus size={16} /> Create Project</button>}
          />
        </div>
        </Reveal>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project, index) => {
            const progress = getProjectStaffingProgress(project);
            const coverage = getTeamSkillCoverage(project.assignedEmployeeIds, project, employees);
            const missingCount = coverage.filter((c) => !c.covered).length;
            const daysLeft = daysUntil(project.deadline);
            const assignedEmployees = project.assignedEmployeeIds
              .map((id) => employees.find((e) => e.id === id))
              .filter(Boolean);

            return (
              <Reveal key={project.id} delay={index * 80}>
              <div
                className="card-hover p-5 cursor-pointer flex flex-col"
                onClick={() => setDetailProject(project)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{project.name}</h3>
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">{project.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <StatusBadge status={project.status} />
                  <StatusBadge status={project.priority} />
                </div>

                {/* Staffing progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-text-secondary flex items-center gap-1">
                      <Users size={12} /> Staffing
                    </span>
                    <span className="text-xs font-medium text-text-primary">{project.assignedEmployeeIds.length}/{project.targetTeamSize}</span>
                  </div>
                  <div className="h-2 bg-base-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-success' : progress >= 50 ? 'bg-primary' : 'bg-warning'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {project.requiredSkills.slice(0, 4).map((req) => {
                    const cov = coverage.find((c) => c.skillId === req.skillId);
                    return (
                      <span
                        key={req.skillId}
                        className={`text-xs px-2 py-0.5 rounded-md border ${cov?.covered ? 'border-success/30 text-success bg-success/5' : 'border-critical/30 text-critical bg-critical/5'}`}
                      >
                        {getSkillName(req.skillId)}
                      </span>
                    );
                  })}
                  {project.requiredSkills.length > 4 && (
                    <span className="text-xs text-text-secondary px-2 py-0.5">+{project.requiredSkills.length - 4} more</span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-base-border">
                  <div className="flex items-center gap-1 text-xs text-text-secondary">
                    <Calendar size={12} />
                    <span>{formatDate(project.deadline)}</span>
                    {daysLeft > 0 && project.status !== 'completed' && (
                      <span className={`ml-1 ${daysLeft < 30 ? 'text-warning' : ''}`}>({daysLeft}d left)</span>
                    )}
                  </div>
                  {missingCount > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-critical">
                      <AlertCircle size={12} /> {missingCount} gap{missingCount > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 size={12} /> Covered
                    </span>
                  )}
                </div>

                {/* Assigned avatars */}
                {assignedEmployees.length > 0 && (
                  <div className="flex items-center gap-1 mt-3">
                    {assignedEmployees.slice(0, 5).map((emp) => (
                      <Avatar key={emp!.id} name={emp!.name} color={emp!.avatarColor} size="sm" />
                    ))}
                    {assignedEmployees.length > 5 && (
                      <span className="text-xs text-text-secondary ml-1">+{assignedEmployees.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* Project Detail Modal */}
      <ProjectDetailModal
        project={detailProject}
        onClose={() => setDetailProject(null)}
        onEdit={(p) => handleEdit(p)}
        onOpenTeamBuilder={(p) => { setDetailProject(null); navigate('/team-builder', { state: { projectId: p.id } }); }}
      />

      <ProjectForm open={formOpen} onClose={() => setFormOpen(false)} project={editingProject} />
      <ConfirmationDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All team assignments will be removed.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function ProjectDetailModal({
  project,
  onClose,
  onEdit,
  onOpenTeamBuilder,
}: {
  project: Project | null;
  onClose: () => void;
  onEdit: (p: Project) => void;
  onOpenTeamBuilder: (p: Project) => void;
}) {
  const { employees, projects, unassignEmployeeFromProject, showToast } = useData();

  if (!project) return null;

  const progress = getProjectStaffingProgress(project);
  const coverage = getTeamSkillCoverage(project.assignedEmployeeIds, project, employees);
  const assignedEmployees = project.assignedEmployeeIds
    .map((id) => employees.find((e) => e.id === id))
    .filter(Boolean) as typeof employees;

  return (
    <Modal
      open={!!project}
      onClose={onClose}
      title={project.name}
      description={project.description}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={() => onEdit(project)}>
            <Pencil size={16} /> Edit Project
          </button>
          <button className="btn-primary" onClick={() => onOpenTeamBuilder(project)}>
            <Sparkles size={16} /> Open in Team Builder
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Status + Priority + Dates */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wide">Status</label>
            <div className="mt-1"><StatusBadge status={project.status} size="md" /></div>
          </div>
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wide">Priority</label>
            <div className="mt-1"><StatusBadge status={project.priority} size="md" /></div>
          </div>
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wide">Start Date</label>
            <div className="mt-1 text-sm text-text-primary">{formatDate(project.startDate)}</div>
          </div>
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wide">Deadline</label>
            <div className="mt-1 text-sm text-text-primary">{formatDate(project.deadline)}</div>
          </div>
        </div>

        {/* Staffing */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Target size={16} /> Staffing ({assignedEmployees.length}/{project.targetTeamSize})
            </h4>
            <span className="text-sm font-medium text-text-primary">{progress}%</span>
          </div>
          <div className="h-2 bg-base-bg rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="space-y-2">
            {assignedEmployees.length === 0 && (
              <p className="text-sm text-text-secondary">No team members assigned yet.</p>
            )}
            {assignedEmployees.map((emp) => {
              const empProjCount = getEmployeeProjects(emp.id, projects).length;
              return (
                <div key={emp.id} className="flex items-center gap-3 p-2 rounded-lg bg-base-bg border border-base-border">
                  <Avatar name={emp.name} color={emp.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{emp.name}</div>
                    <div className="text-xs text-text-secondary truncate">{emp.role} • {empProjCount} project{empProjCount !== 1 ? 's' : ''}</div>
                  </div>
                  <button
                    onClick={() => { unassignEmployeeFromProject(emp.id, project.id); showToast('info', `Unassigned ${emp.name} from ${project.name}`); }}
                    className="p-1.5 rounded-md text-text-secondary hover:text-critical hover:bg-base-hover transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skill Coverage */}
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-2">Required Skills & Coverage</h4>
          <div className="space-y-2">
            {coverage.map((c) => (
              <div key={c.skillId} className="flex items-center justify-between p-2 rounded-lg bg-base-bg border border-base-border">
                <div className="flex items-center gap-2">
                  <SkillTag skillId={c.skillId} />
                  <span className="text-xs text-text-secondary">Min Level {c.minLevel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">Best: L{c.bestLevel}</span>
                  {c.covered ? (
                    <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 size={14} /> Covered</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-critical"><AlertCircle size={14} /> Gap</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
