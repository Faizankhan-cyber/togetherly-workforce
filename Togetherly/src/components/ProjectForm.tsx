import { useState, useEffect } from 'react';
import type { Project, ProjectRequirement, ProjectStatus, ProjectPriority, SkillLevel } from '@/types';
import { skills as allSkills } from '@/data/mockData';
import { getSkillName } from '@/utils';
import { useData } from '@/context/DataContext';
import { Modal } from './Modal';
import { Plus, X } from 'lucide-react';

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
}

export function ProjectForm({ open, onClose, project }: ProjectFormProps) {
  const { addProject, updateProject, showToast } = useData();
  const isEdit = !!project;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [targetTeamSize, setTargetTeamSize] = useState(3);
  const [requiredSkills, setRequiredSkills] = useState<ProjectRequirement[]>([]);
  const [newSkillId, setNewSkillId] = useState('');
  const [newMinLevel, setNewMinLevel] = useState<SkillLevel>(3);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description);
      setStatus(project.status);
      setPriority(project.priority);
      setStartDate(project.startDate);
      setDeadline(project.deadline);
      setTargetTeamSize(project.targetTeamSize);
      setRequiredSkills(project.requiredSkills);
    } else {
      setName('');
      setDescription('');
      setStatus('planning');
      setPriority('medium');
      setStartDate(new Date().toISOString().slice(0, 10));
      setDeadline('');
      setTargetTeamSize(3);
      setRequiredSkills([]);
    }
    setErrors({});
    setNewSkillId('');
    setNewMinLevel(3);
  }, [project, open]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Project name is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (!startDate) errs.startDate = 'Start date is required';
    if (!deadline) errs.deadline = 'Deadline is required';
    else if (deadline <= startDate) errs.deadline = 'Deadline must be after start date';
    if (targetTeamSize < 1) errs.targetTeamSize = 'Must be at least 1';
    if (requiredSkills.length === 0) errs.requiredSkills = 'Add at least one required skill';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const data = {
      name: name.trim(),
      description: description.trim(),
      status,
      priority,
      startDate,
      deadline,
      requiredSkills,
      targetTeamSize: Number(targetTeamSize),
      assignedEmployeeIds: project?.assignedEmployeeIds ?? [],
    };

    if (isEdit && project) {
      updateProject(project.id, data);
      showToast('success', `Project "${data.name}" updated successfully`);
    } else {
      addProject(data);
      showToast('success', `Project "${data.name}" created successfully`);
    }
    onClose();
  }

  function addSkill() {
    if (!newSkillId) return;
    if (requiredSkills.some((s) => s.skillId === newSkillId)) return;
    setRequiredSkills([...requiredSkills, { skillId: newSkillId, minLevel: newMinLevel }]);
    setNewSkillId('');
    setNewMinLevel(3);
  }

  function removeSkill(skillId: string) {
    setRequiredSkills(requiredSkills.filter((s) => s.skillId !== skillId));
  }

  const availableSkills = allSkills.filter(
    (s) => !requiredSkills.some((rs) => rs.skillId === s.id)
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Project' : 'Create Project'}
      description={isEdit ? 'Update project details and requirements' : 'Define a new project with skill requirements'}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>
            {isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-text-primary mb-1.5 block">Project Name</label>
          <input className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer Portal Redesign" />
          {errors.name && <p className="text-xs text-critical mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary mb-1.5 block">Description</label>
          <textarea className="input-field w-full min-h-[80px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief project description..." />
          {errors.description && <p className="text-xs text-critical mt-1">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Status</label>
            <select className="input-field w-full" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Priority</label>
            <select className="input-field w-full" value={priority} onChange={(e) => setPriority(e.target.value as ProjectPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Start Date</label>
            <input type="date" className="input-field w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            {errors.startDate && <p className="text-xs text-critical mt-1">{errors.startDate}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Deadline</label>
            <input type="date" className="input-field w-full" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            {errors.deadline && <p className="text-xs text-critical mt-1">{errors.deadline}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Target Team Size</label>
            <input type="number" min={1} max={20} className="input-field w-full" value={targetTeamSize} onChange={(e) => setTargetTeamSize(Number(e.target.value))} />
            {errors.targetTeamSize && <p className="text-xs text-critical mt-1">{errors.targetTeamSize}</p>}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">Required Skills</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {requiredSkills.length === 0 && (
              <span className="text-sm text-text-secondary">No required skills added yet.</span>
            )}
            {requiredSkills.map((rs) => (
              <span key={rs.skillId} className="inline-flex items-center gap-2 rounded-md bg-base-bg border border-base-border px-2.5 py-1 text-xs text-text-primary">
                {getSkillName(rs.skillId)} <span className="text-text-secondary">Min L{rs.minLevel}</span>
                <button onClick={() => removeSkill(rs.skillId)} className="text-text-secondary hover:text-critical">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-text-secondary mb-1 block">Add Required Skill</label>
              <select className="input-field w-full" value={newSkillId} onChange={(e) => setNewSkillId(e.target.value)}>
                <option value="">Select a skill...</option>
                {availableSkills.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Min Level</label>
              <select className="input-field" value={newMinLevel} onChange={(e) => setNewMinLevel(Number(e.target.value) as SkillLevel)}>
                {[1, 2, 3, 4, 5].map((l) => (
                  <option key={l} value={l}>L{l}</option>
                ))}
              </select>
            </div>
            <button className="btn-secondary" onClick={addSkill} disabled={!newSkillId}>
              <Plus size={16} /> Add
            </button>
          </div>
          {errors.requiredSkills && <p className="text-xs text-critical mt-1">{errors.requiredSkills}</p>}
        </div>
      </div>
    </Modal>
  );
}
