import { useState, useEffect } from 'react';
import type { Employee, EmployeeSkill, Availability, SkillLevel } from '@/types';
import { skills as allSkills } from '@/data/mockData';
import { getSkillName, getDepartmentStats } from '@/utils';
import { useData } from '@/context/DataContext';
import { Modal } from './Modal';
import { Plus, X } from 'lucide-react';

interface EmployeeFormProps {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

const avatarColors = [
  '#8B5CF6', '#22D3EE', '#22C55E', '#F59E0B', '#F87171',
  '#A78BFA', '#67E8F9', '#86EFAC', '#FCD34D', '#FCA5A5',
];

export function EmployeeForm({ open, onClose, employee }: EmployeeFormProps) {
  const { employees, addEmployee, updateEmployee, showToast } = useData();
  const isEdit = !!employee;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [yearsExperience, setYearsExperience] = useState(1);
  const [availability, setAvailability] = useState<Availability>('available');
  const [targetUtilization, setTargetUtilization] = useState(80);
  const [selectedSkills, setSelectedSkills] = useState<EmployeeSkill[]>([]);
  const [newSkillId, setNewSkillId] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState<SkillLevel>(3);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const departments = getDepartmentStats(employees).map((d) => d.department);
  const allDepartments = Array.from(new Set([...departments, 'Engineering', 'Design', 'Data', 'Infrastructure', 'Product', 'Quality', 'Business']));

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setEmail(employee.email);
      setRole(employee.role);
      setDepartment(employee.department);
      setYearsExperience(employee.yearsExperience);
      setAvailability(employee.availability);
      setTargetUtilization(employee.targetUtilization);
      setSelectedSkills(employee.skills);
    } else {
      setName('');
      setEmail('');
      setRole('');
      setDepartment('Engineering');
      setYearsExperience(1);
      setAvailability('available');
      setTargetUtilization(80);
      setSelectedSkills([]);
    }
    setErrors({});
    setNewSkillId('');
    setNewSkillLevel(3);
  }, [employee, open]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email format';
    if (!role.trim()) errs.role = 'Role is required';
    if (yearsExperience < 0) errs.yearsExperience = 'Cannot be negative';
    if (targetUtilization < 0 || targetUtilization > 100) errs.targetUtilization = 'Must be 0-100';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const data = {
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      department,
      yearsExperience: Number(yearsExperience),
      availability,
      avatarColor: employee?.avatarColor ?? avatarColors[Math.floor(Math.random() * avatarColors.length)],
      targetUtilization: Number(targetUtilization),
      skills: selectedSkills,
      trainingAssignments: employee?.trainingAssignments ?? [],
    };

    if (isEdit && employee) {
      updateEmployee(employee.id, data);
      showToast('success', `Employee "${data.name}" updated successfully`);
    } else {
      addEmployee(data);
      showToast('success', `Employee "${data.name}" added successfully`);
    }
    onClose();
  }

  function addSkill() {
    if (!newSkillId) return;
    if (selectedSkills.some((s) => s.skillId === newSkillId)) return;
    setSelectedSkills([...selectedSkills, { skillId: newSkillId, level: newSkillLevel }]);
    setNewSkillId('');
    setNewSkillLevel(3);
  }

  function removeSkill(skillId: string) {
    setSelectedSkills(selectedSkills.filter((s) => s.skillId !== skillId));
  }

  const availableSkills = allSkills.filter(
    (s) => !selectedSkills.some((es) => es.skillId === s.id)
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Employee' : 'Add Employee'}
      description={isEdit ? 'Update employee information and skills' : 'Create a new employee profile'}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Full Name</label>
            <input className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            {errors.name && <p className="text-xs text-critical mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Email</label>
            <input className="input-field w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane.doe@togetherly.io" />
            {errors.email && <p className="text-xs text-critical mt-1">{errors.email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Role</label>
            <input className="input-field w-full" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior Engineer" />
            {errors.role && <p className="text-xs text-critical mt-1">{errors.role}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Department</label>
            <select className="input-field w-full" value={department} onChange={(e) => setDepartment(e.target.value)}>
              {allDepartments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Years of Experience</label>
            <input type="number" min={0} max={50} className="input-field w-full" value={yearsExperience} onChange={(e) => setYearsExperience(Number(e.target.value))} />
            {errors.yearsExperience && <p className="text-xs text-critical mt-1">{errors.yearsExperience}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Availability</label>
            <select className="input-field w-full" value={availability} onChange={(e) => setAvailability(e.target.value as Availability)}>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Target Utilization (%)</label>
            <input type="number" min={0} max={100} className="input-field w-full" value={targetUtilization} onChange={(e) => setTargetUtilization(Number(e.target.value))} />
            {errors.targetUtilization && <p className="text-xs text-critical mt-1">{errors.targetUtilization}</p>}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">Skills</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedSkills.length === 0 && (
              <span className="text-sm text-text-secondary">No skills added yet.</span>
            )}
            {selectedSkills.map((es) => (
              <span key={es.skillId} className="inline-flex items-center gap-2 rounded-md bg-base-bg border border-base-border px-2.5 py-1 text-xs text-text-primary">
                {getSkillName(es.skillId)} <span className="text-text-secondary">L{es.level}</span>
                <button onClick={() => removeSkill(es.skillId)} className="text-text-secondary hover:text-critical">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-text-secondary mb-1 block">Add Skill</label>
              <select className="input-field w-full" value={newSkillId} onChange={(e) => setNewSkillId(e.target.value)}>
                <option value="">Select a skill...</option>
                {availableSkills.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Level</label>
              <select className="input-field" value={newSkillLevel} onChange={(e) => setNewSkillLevel(Number(e.target.value) as SkillLevel)}>
                {[1, 2, 3, 4, 5].map((l) => (
                  <option key={l} value={l}>L{l}</option>
                ))}
              </select>
            </div>
            <button className="btn-secondary" onClick={addSkill} disabled={!newSkillId}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
