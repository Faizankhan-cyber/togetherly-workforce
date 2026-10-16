import {
  Info,
  Trash2,
  Save,
  RotateCcw,
} from 'lucide-react';
import type {
  Employee,
  Project,
  ScenarioModel,
} from '@/types';
import { skillsList } from '@/data/mockData';
import { getSkillName, calculateEmployeeUtilization } from '@/utils';
import { Avatar } from '@/components/Avatar';

interface ScenarioConfigFormsProps {
  scenario: ScenarioModel;
  employees: Employee[];
  projects: Project[];
  onUpdateScenario: (updated: ScenarioModel) => void;
  onSaveScenario: () => void;
  onResetScenario: () => void;
}

export function ScenarioConfigForms({
  scenario,
  employees,
  projects,
  onUpdateScenario,
  onSaveScenario,
  onResetScenario,
}: ScenarioConfigFormsProps) {
  const activeProjects = projects.filter((p) => p.status !== 'completed');
  const departments = Array.from(new Set(employees.map((e) => e.department)));

  // ----------------------------------------------------
  // Type A: Reallocation Form
  // ----------------------------------------------------
  function renderReallocationForm() {
    const config = scenario.config.reallocation || {
      employeeId: employees[0]?.id || '',
      sourceProjectId: projects[0]?.id || '',
      targetProjectId: projects[1]?.id || '',
    };

    const selectedEmp = employees.find((e) => e.id === config.employeeId);
    const empProjects = projects.filter((p) => p.assignedEmployeeIds.includes(config.employeeId));
    const currentUtil = selectedEmp ? calculateEmployeeUtilization(selectedEmp.id, projects, selectedEmp.targetUtilization) : 0;

    const updateConfig = (patch: Partial<typeof config>) => {
      onUpdateScenario({
        ...scenario,
        config: {
          ...scenario.config,
          reallocation: { ...config, ...patch },
        },
      });
    };

    return (
      <div className="space-y-4">
        <div className="bg-primary-50/50 border border-primary-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-primary-900">
          <Info size={16} className="text-primary mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed">
            Move an employee from an existing assignment to a destination project. The simulator computes resulting skill coverage changes, team staffing margins, and individual workload impacts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Select Contributor
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.employeeId}
              onChange={(e) => {
                const newEmpId = e.target.value;
                const assigned = projects.filter((p) => p.assignedEmployeeIds.includes(newEmpId));
                updateConfig({
                  employeeId: newEmpId,
                  sourceProjectId: assigned[0]?.id || config.sourceProjectId,
                });
              }}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>

            {selectedEmp && (
              <div className="mt-3 p-2.5 rounded-lg bg-base-bg/60 border border-base-border text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar name={selectedEmp.name} color={selectedEmp.avatarColor} size="sm" />
                  <div className="min-w-0">
                    <div className="font-bold text-text-primary truncate">{selectedEmp.name}</div>
                    <div className="text-[11px] text-text-secondary truncate">{selectedEmp.role}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-base-border/50">
                  <span className="text-text-secondary">Current Utilization:</span>
                  <span className="font-mono font-bold text-text-primary">{currentUtil}%</span>
                </div>
                <div className="text-[11px] text-text-secondary">
                  <span className="font-semibold text-text-primary">Top Skills:</span>{' '}
                  {selectedEmp.skills.slice(0, 3).map((s) => `${getSkillName(s.skillId)} (L${s.level})`).join(', ')}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Source Project (Releasing)
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.sourceProjectId}
              onChange={(e) => updateConfig({ sourceProjectId: e.target.value })}
            >
              <option value="">-- No Source / General Bench --</option>
              {activeProjects.map((p) => {
                const isAssigned = empProjects.some((ep) => ep.id === p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} {isAssigned ? '✓ (Currently Assigned)' : ''}
                  </option>
                );
              })}
            </select>
            <p className="text-[10px] text-text-muted mt-1">
              The project the employee will be unassigned from.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Destination Project (Receiving)
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.targetProjectId}
              onChange={(e) => updateConfig({ targetProjectId: e.target.value })}
            >
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === config.sourceProjectId}>
                  {p.name} ({p.department})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-text-muted mt-1">
              The project receiving the new team member.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Type B: New Hire Simulation Form
  // ----------------------------------------------------
  function renderNewHireForm() {
    const config = scenario.config.newHire || {
      name: 'Taylor Reed (Simulated)',
      role: 'Senior DevOps Architect',
      department: 'Engineering',
      yearsExperience: 6,
      availability: 'available',
      targetUtilization: 100,
      skills: [
        { skillId: 'skl-aws', level: 5 },
        { skillId: 'skl-kubernetes', level: 4 },
        { skillId: 'skl-docker', level: 4 },
      ],
      assignedProjectIds: [activeProjects[0]?.id || ''],
    };

    const updateConfig = (patch: Partial<typeof config>) => {
      onUpdateScenario({
        ...scenario,
        config: {
          ...scenario.config,
          newHire: { ...config, ...patch },
        },
      });
    };

    const addSkill = (skillId: string) => {
      if (config.skills.some((s) => s.skillId === skillId)) return;
      updateConfig({ skills: [...config.skills, { skillId, level: 3 }] });
    };

    const removeSkill = (skillId: string) => {
      updateConfig({ skills: config.skills.filter((s) => s.skillId !== skillId) });
    };

    const updateSkillLevel = (skillId: string, level: number) => {
      updateConfig({
        skills: config.skills.map((s) => (s.skillId === skillId ? { ...s, level } : s)),
      });
    };

    return (
      <div className="space-y-4">
        <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
          <Info size={16} className="text-emerald-700 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed">
            Test the systemic impact of adding a new headcount profile to your talent pool without modifying production employee records. Estimate skill coverage gains and project delivery readiness.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Candidate / Requisition Title
            </label>
            <input
              type="text"
              className="input-field w-full text-xs"
              value={config.name}
              onChange={(e) => updateConfig({ name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Proposed Role
            </label>
            <input
              type="text"
              className="input-field w-full text-xs"
              value={config.role}
              onChange={(e) => updateConfig({ role: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Department
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.department}
              onChange={(e) => updateConfig({ department: e.target.value })}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-text-secondary">
                Years of Experience ({config.yearsExperience} yrs)
              </label>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              value={config.yearsExperience}
              onChange={(e) => updateConfig({ yearsExperience: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Initial Simulated Project Assignment
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.assignedProjectIds[0] || ''}
              onChange={(e) => updateConfig({ assignedProjectIds: e.target.value ? [e.target.value] : [] })}
            >
              <option value="">-- Leave Unassigned (Pool Reserve) --</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Skills Section */}
        <div className="border border-base-border rounded-xl p-3.5 bg-base-bg/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary">
              Hypothetical Skill Profile ({config.skills.length})
            </span>
            <div className="flex items-center gap-1.5">
              <select
                className="input-field text-xs py-1"
                onChange={(e) => {
                  if (e.target.value) {
                    addSkill(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  + Add Skill to Profile
                </option>
                {skillsList
                  .filter((s) => !config.skills.some((cs) => cs.skillId === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {config.skills.map((s) => (
              <div
                key={s.skillId}
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-base-border text-xs shadow-sm"
              >
                <span className="font-medium text-text-primary truncate mr-2">
                  {getSkillName(s.skillId)}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    className="input-field text-[11px] py-0.5 px-1 font-mono"
                    value={s.level}
                    onChange={(e) => updateSkillLevel(s.skillId, Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        L{lvl}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeSkill(s.skillId)}
                    className="text-text-muted hover:text-critical p-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Type C: Project Delay Form
  // ----------------------------------------------------
  function renderProjectDelayForm() {
    const config = scenario.config.projectDelay || {
      projectId: activeProjects[0]?.id || '',
      delayWeeks: 6,
      notes: 'Timeline postponement due to client stakeholder review delays.',
      resourceContentionWindowWeeks: 4,
    };

    const targetProj = projects.find((p) => p.id === config.projectId);
    const assignedTeam = employees.filter((e) => targetProj?.assignedEmployeeIds.includes(e.id));

    const updateConfig = (patch: Partial<typeof config>) => {
      onUpdateScenario({
        ...scenario,
        config: {
          ...scenario.config,
          projectDelay: { ...config, ...patch },
        },
      });
    };

    return (
      <div className="space-y-4">
        <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
          <Info size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed">
            Simulate the schedule ripple of pushing out a project delivery date. Evaluate which assigned contributors remain locked and what upcoming initiatives may suffer schedule contention.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Select Delayed Project
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.projectId}
              onChange={(e) => updateConfig({ projectId: e.target.value })}
            >
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Deadline: {p.deadline})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-text-secondary">
                Proposed Delay Duration (+{config.delayWeeks} weeks)
              </label>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                +{config.delayWeeks * 7} Days
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={24}
              value={config.delayWeeks}
              onChange={(e) => updateConfig({ delayWeeks: Number(e.target.value) })}
              className="w-full accent-amber-600"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            Scenario Rationale & Delay Factors
          </label>
          <input
            type="text"
            className="input-field w-full text-xs"
            value={config.notes || ''}
            onChange={(e) => updateConfig({ notes: e.target.value })}
            placeholder="e.g. Third-party audit requirement, technical debt refactor"
          />
        </div>

        {targetProj && (
          <div className="p-3 bg-base-bg/40 border border-base-border rounded-xl text-xs space-y-2">
            <div className="font-bold text-text-primary">
              Retained Contributors on {targetProj.name} ({assignedTeam.length} members):
            </div>
            <div className="flex flex-wrap gap-2">
              {assignedTeam.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-base-border text-xs"
                >
                  <Avatar name={m.name} color={m.avatarColor} size="sm" />
                  <span className="font-medium text-text-primary">{m.name}</span>
                  <span className="text-[10px] text-text-secondary">({m.role})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // Type D: Training Investment Form
  // ----------------------------------------------------
  function renderTrainingForm() {
    const config = scenario.config.training || {
      employeeId: employees[0]?.id || '',
      skillId: 'skl-security',
      currentLevel: 1,
      targetLevel: 4,
      durationWeeks: 8,
      provider: 'Internal Mentorship & Cloud Cert Course',
    };

    const targetEmp = employees.find((e) => e.id === config.employeeId);
    const currentSkill = targetEmp?.skills.find((s) => s.skillId === config.skillId);
    const actualLevel = currentSkill?.level || 0;

    const updateConfig = (patch: Partial<typeof config>) => {
      onUpdateScenario({
        ...scenario,
        config: {
          ...scenario.config,
          training: { ...config, ...patch },
        },
      });
    };

    return (
      <div className="space-y-4">
        <div className="bg-purple-50/60 border border-purple-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-purple-900">
          <Info size={16} className="text-purple-700 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed">
            Model the outcome of investing in an employee's professional development. See how skill gap counts decrease and identify which high-stakes projects benefit.
            <strong className="block mt-1 font-semibold text-purple-950">
              Note: Projected proficiencies are marked as hypothetical estimates and do not automatically alter verified credentials.
            </strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Select Employee
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.employeeId}
              onChange={(e) => updateConfig({ employeeId: e.target.value })}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role} - {emp.department})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Target Skill to Develop
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.skillId}
              onChange={(e) => {
                const newSkillId = e.target.value;
                const empSkill = targetEmp?.skills.find((s) => s.skillId === newSkillId);
                const curLvl = empSkill?.level || 0;
                updateConfig({
                  skillId: newSkillId,
                  currentLevel: curLvl,
                  targetLevel: Math.min(5, Math.max(curLvl + 1, 3)),
                });
              }}
            >
              {skillsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-base-bg/40 border border-base-border rounded-xl">
          <div>
            <div className="text-xs font-semibold text-text-secondary mb-1">
              Current Verified Level: <span className="font-mono font-bold text-text-primary">Level {actualLevel}</span>
            </div>
            <div className="text-[11px] text-text-muted">
              {actualLevel === 0 ? 'No documented capability in this skill' : `Assessed competency level ${actualLevel} of 5`}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-purple-900">
                Projected Skill Level: <span className="font-mono font-bold">Level {config.targetLevel}</span>
              </label>
            </div>
            <input
              type="range"
              min={Math.max(1, actualLevel + 1)}
              max={5}
              value={config.targetLevel}
              onChange={(e) => updateConfig({ targetLevel: Number(e.target.value) })}
              className="w-full accent-purple-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Estimated Duration ({config.durationWeeks} Weeks)
            </label>
            <input
              type="range"
              min={2}
              max={26}
              value={config.durationWeeks}
              onChange={(e) => updateConfig({ durationWeeks: Number(e.target.value) })}
              className="w-full accent-purple-600"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Curriculum / Program Title
            </label>
            <input
              type="text"
              className="input-field w-full text-xs"
              value={config.provider || ''}
              onChange={(e) => updateConfig({ provider: e.target.value })}
              placeholder="e.g. Advanced Architecture Certification"
            />
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Type E: New Project Form
  // ----------------------------------------------------
  function renderNewProjectForm() {
    const config = scenario.config.newProject || {
      name: 'Omnichannel Client Portal',
      description: 'Customer facing web and mobile dashboard with real-time analytics.',
      department: 'Engineering',
      targetTeamSize: 4,
      durationMonths: 6,
      priority: 'high',
      requiredSkills: [
        { skillId: 'skl-react', minLevel: 4 },
        { skillId: 'skl-typescript', minLevel: 3 },
        { skillId: 'skl-node', minLevel: 3 },
      ],
      selectedEmployeeIds: [],
    };

    const updateConfig = (patch: Partial<typeof config>) => {
      onUpdateScenario({
        ...scenario,
        config: {
          ...scenario.config,
          newProject: { ...config, ...patch },
        },
      });
    };

    const addReq = (skillId: string) => {
      if (config.requiredSkills.some((r) => r.skillId === skillId)) return;
      updateConfig({
        requiredSkills: [...config.requiredSkills, { skillId, minLevel: 3, importance: 'required' }],
      });
    };

    const removeReq = (skillId: string) => {
      updateConfig({
        requiredSkills: config.requiredSkills.filter((r) => r.skillId !== skillId),
      });
    };

    const updateReqLevel = (skillId: string, minLevel: number) => {
      updateConfig({
        requiredSkills: config.requiredSkills.map((r) => (r.skillId === skillId ? { ...r, minLevel } : r)),
      });
    };

    return (
      <div className="space-y-4">
        <div className="bg-sky-50/60 border border-sky-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-sky-900">
          <Info size={16} className="text-sky-700 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed">
            Model the feasibility of launching a new project against your existing workforce. Determine whether current bench capacity and skill distribution can absorb the commitment without over-allocation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Project Name
            </label>
            <input
              type="text"
              className="input-field w-full text-xs"
              value={config.name}
              onChange={(e) => updateConfig({ name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Department Alignment
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.department}
              onChange={(e) => updateConfig({ department: e.target.value })}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Priority
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.priority}
              onChange={(e) => updateConfig({ priority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-text-secondary">
                Target Team Headcount ({config.targetTeamSize} Staff)
              </label>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={config.targetTeamSize}
              onChange={(e) => updateConfig({ targetTeamSize: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-text-secondary">
                Estimated Duration ({config.durationMonths} Months)
              </label>
            </div>
            <input
              type="range"
              min={1}
              max={24}
              value={config.durationMonths}
              onChange={(e) => updateConfig({ durationMonths: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>
        </div>

        {/* Required Skills Picker */}
        <div className="border border-base-border rounded-xl p-3.5 bg-base-bg/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary">
              Required Skill Stack ({config.requiredSkills.length})
            </span>
            <select
              className="input-field text-xs py-1"
              onChange={(e) => {
                if (e.target.value) {
                  addReq(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>
                + Add Requirement
              </option>
              {skillsList
                .filter((s) => !config.requiredSkills.some((cr) => cr.skillId === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {config.requiredSkills.map((r) => (
              <div
                key={r.skillId}
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-base-border text-xs shadow-sm"
              >
                <span className="font-medium text-text-primary truncate mr-2">
                  {getSkillName(r.skillId)}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    className="input-field text-[11px] py-0.5 px-1 font-mono"
                    value={r.minLevel}
                    onChange={(e) => updateReqLevel(r.skillId, Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Min L{lvl}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeReq(r.skillId)}
                    className="text-text-muted hover:text-critical p-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Type F: Capacity Reduction Form
  // ----------------------------------------------------
  function renderCapacityReductionForm() {
    const config = scenario.config.capacityReduction || {
      reductionPercent: 20,
      department: 'all',
      strategy: 'attrition',
    };

    const updateConfig = (patch: Partial<typeof config>) => {
      onUpdateScenario({
        ...scenario,
        config: {
          ...scenario.config,
          capacityReduction: { ...config, ...patch },
        },
      });
    };

    const targetPool = employees.filter((e) => config.department === 'all' || e.department === config.department);
    const estimatedLostHeadcount = Math.max(1, Math.round((targetPool.length * config.reductionPercent) / 100));

    return (
      <div className="space-y-4">
        <div className="bg-rose-50/60 border border-rose-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-900">
          <Info size={16} className="text-rose-700 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed">
            Simulate a workforce contraction or hiring freeze. The calculation engine stress-tests project portfolios, pinpointing single-points-of-failure and vulnerable project deliverables.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Simulated Capacity Reduction Percentage
              </label>
              <span className="text-xs font-mono font-bold text-critical bg-critical/10 px-2 py-0.5 rounded border border-critical/30">
                {config.reductionPercent}% Cut (~{estimatedLostHeadcount} FTE)
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={40}
              step={5}
              value={config.reductionPercent}
              onChange={(e) => updateConfig({ reductionPercent: Number(e.target.value) })}
              className="w-full accent-critical"
            />
            <div className="flex justify-between text-[10px] text-text-muted mt-1">
              <span>5% (Minor Attrition)</span>
              <span>20% (Department Reorg)</span>
              <span>40% (Heavy Contraction)</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Department Scope
            </label>
            <select
              className="input-field w-full text-xs"
              value={config.department}
              onChange={(e) => updateConfig({ department: e.target.value })}
            >
              <option value="all">Organization-wide (All Departments)</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d} Only
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1.5">
            Reduction Strategy Assumption
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'attrition', title: 'Unplanned Attrition', desc: 'Natural departure of senior contributors' },
              { id: 'budget_cut', title: 'Budget Realignment', desc: 'Strategic project deprioritization' },
              { id: 'hiring_freeze', title: 'Hiring Freeze', desc: 'No backfill of expiring roles' },
            ].map((strat) => (
              <button
                key={strat.id}
                type="button"
                onClick={() => updateConfig({ strategy: strat.id as 'attrition' | 'budget_cut' | 'hiring_freeze' })}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  config.strategy === strat.id
                    ? 'border-critical bg-critical/5 shadow-sm'
                    : 'border-base-border bg-base-bg/30 hover:border-base-border/80'
                }`}
              >
                <div className={`text-xs font-bold ${config.strategy === strat.id ? 'text-critical' : 'text-text-primary'}`}>
                  {strat.title}
                </div>
                <div className="text-[10px] text-text-secondary mt-0.5 leading-tight">{strat.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 border-base-border/80 shadow-md space-y-4">
      {/* Header with Title and Control Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-base-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text-primary">
              Configure Scenario: {scenario.name}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-base-bg border border-base-border font-semibold uppercase text-text-secondary">
              {scenario.type.replace('-', ' ')}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Adjust hypothetical assumptions below. Real-time calculations update immediately.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onResetScenario}
            className="btn-secondary text-xs py-1.5 px-3"
            title="Reset scenario inputs to baseline defaults"
          >
            <RotateCcw size={14} /> Reset Inputs
          </button>
          <button
            type="button"
            onClick={onSaveScenario}
            className="btn-primary text-xs py-1.5 px-3.5 shadow-sm"
          >
            <Save size={14} /> Save Scenario
          </button>
        </div>
      </div>

      {/* Dynamic Form Content */}
      {scenario.type === 'reallocation' && renderReallocationForm()}
      {scenario.type === 'new-hire' && renderNewHireForm()}
      {scenario.type === 'project-delay' && renderProjectDelayForm()}
      {scenario.type === 'training' && renderTrainingForm()}
      {scenario.type === 'new-project' && renderNewProjectForm()}
      {scenario.type === 'capacity-reduction' && renderCapacityReductionForm()}
    </div>
  );
}
