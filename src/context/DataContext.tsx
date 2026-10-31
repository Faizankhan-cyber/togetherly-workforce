import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  Activity,
  AppSettings,
  Employee,
  Project,
  Role,
  ToastNotification,
  TrainingAssignment,
  TrainingSubmission,
  VerificationAuditLog,
  VerificationStatus,
} from '@/types';
import {
  defaultSettings,
  initialActivities,
  initialEmployees,
  initialProjects,
  initialSubmissions,
} from '@/data/mockData';

interface DataContextType {
  role: Role;
  setRole: (role: Role) => void;
  employees: Employee[];
  projects: Project[];
  settings: AppSettings;
  activities: Activity[];
  toasts: ToastNotification[];
  submissions: TrainingSubmission[];
  addEmployee: (employee: Omit<Employee, 'id'> & { id?: string }) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  addProject: (project: Omit<Project, 'id'> & { id?: string }) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  assignEmployeeToProject: (employeeId: string, projectId: string) => void;
  unassignEmployeeFromProject: (employeeId: string, projectId: string) => void;
  addTrainingAssignment: (employeeId: string, training: Omit<TrainingAssignment, 'id'>) => void;
  updateTrainingAssignment: (
    employeeId: string,
    trainingId: string,
    updates: Partial<TrainingAssignment>
  ) => void;
  submitTrainingClaim: (
    claim: Omit<TrainingSubmission, 'id' | 'submissionDate' | 'status' | 'auditTrail'> & { id?: string }
  ) => TrainingSubmission;
  resubmitTrainingClaim: (
    submissionId: string,
    updates: Partial<TrainingSubmission>
  ) => { success: boolean; error?: string };
  reviewTrainingClaim: (
    submissionId: string,
    decision: 'approved' | 'rejected' | 'requested_more_evidence',
    notes: string,
    reviewerId?: string,
    reviewerName?: string
  ) => { success: boolean; error?: string };
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetData: () => void;
  addActivity: (messageOrObj: string | { message: string; type?: string }, maybeType?: string) => void;
  showToast: (type: ToastNotification['type'], message: string) => void;
  dismissToast: (id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ROLE: 'togetherly_role',
  EMPLOYEES: 'togetherly_employees',
  PROJECTS: 'togetherly_projects',
  SETTINGS: 'togetherly_settings',
  ACTIVITIES: 'togetherly_activities',
  SUBMISSIONS: 'togetherly_training_submissions',
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, identityStatus, mappedEmployee } = useAuth();

  // This role is only a preference for the unauthenticated demo workspace.
  // Real signed-in users always use the role on their database-linked employee record.
  const [previewRole, setPreviewRoleState] = useState<Role>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ROLE);
      return stored === 'employee' || stored === 'manager' || stored === 'admin' || stored === 'hr' ? stored : 'manager';
    } catch {
      return 'manager';
    }
  });

  const hasMappedAuthIdentity = Boolean(
    user && identityStatus === 'mapped' && mappedEmployee && mappedEmployee.authUserId === user.id
  );
  const role: Role = hasMappedAuthIdentity
    ? mappedEmployee?.systemRole ?? 'employee'
    : previewRole;

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      const cached = stored ? (JSON.parse(stored) as Employee[]) : initialEmployees;
      return cached.filter((employee) => !employee.authUserId && employee.dataSource !== 'database');
    } catch {
      return initialEmployees;
    }
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    if (user && identityStatus === 'mapped') return [];
    try { const stored = localStorage.getItem(STORAGE_KEYS.PROJECTS); return stored ? JSON.parse(stored) : initialProjects; } catch { return initialProjects; }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
      return stored ? JSON.parse(stored) : initialActivities;
    } catch {
      return initialActivities;
    }
  });

  const [submissions, setSubmissions] = useState<TrainingSubmission[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
      return stored ? JSON.parse(stored) : initialSubmissions;
    } catch {
      return initialSubmissions;
    }
  });

  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const databaseEmployeeIdsRef = useRef<Set<string>>(new Set());
  const refreshProjects = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured() || !user || identityStatus !== 'mapped' || !mappedEmployee) return;
    const result = await supabase.from('projects').select('id,name,description,department,status,target_team_size,start_date,deadline,priority').order('created_at', { ascending: false });
    if (result.error || !result.data) { showToast('error', 'Could not load shared projects from the database.'); return; }
    const ids = result.data.map((p) => String(p.id));
    const [membersResult, requirementsResult] = await Promise.all([
      ids.length ? supabase.from('project_members').select('project_id,employee_id').in('project_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from('project_requirements').select('project_id,skill_id,min_level,importance').in('project_id', ids) : Promise.resolve({ data: [], error: null }),
    ]);
    if (membersResult.error || requirementsResult.error) { showToast('error', 'Projects loaded, but project assignments could not be loaded.'); return; }
    setProjects(result.data.map((p) => ({ id: String(p.id), name: String(p.name), description: String(p.description ?? ''), department: String(p.department), status: p.status as Project['status'], targetTeamSize: Number(p.target_team_size ?? 1), startDate: String(p.start_date ?? ''), deadline: String(p.deadline ?? ''), priority: (p.priority ?? 'medium') as Project['priority'], assignedEmployeeIds: (membersResult.data ?? []).filter((m) => String(m.project_id) === String(p.id)).map((m) => String(m.employee_id)), requiredSkills: (requirementsResult.data ?? []).filter((q) => String(q.project_id) === String(p.id)).map((q) => ({ skillId: String(q.skill_id), minLevel: Number(q.min_level), importance: q.importance as 'required' | 'preferred' })) })));
  }, [user, identityStatus, mappedEmployee, showToast]);
  useEffect(() => { void refreshProjects(); }, [refreshProjects]);

  const refreshVerifiedDirectory = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured() || !user || identityStatus !== 'mapped' || !mappedEmployee) return;

    // Employees only fetch their own linked profile. Manager/HR/Admin accounts can
    // load the employee directory and its canonical, database-verified skills.
    const canReview = mappedEmployee.systemRole !== 'employee';
    const employeeResult = canReview
      ? await supabase
          .from('employees')
          .select('id, auth_user_id, name, role, department, email, avatar_color, avatar_url, availability, years_experience, target_utilization, system_role, employment_status, offboarded_at, offboarded_by, offboarding_reason')
          .eq('employment_status', 'active')
      : await supabase
          .from('employees')
          .select('id, auth_user_id, name, role, department, email, avatar_color, avatar_url, availability, years_experience, target_utilization, system_role, employment_status, offboarded_at, offboarded_by, offboarding_reason')
          .eq('auth_user_id', user.id)
          .eq('employment_status', 'active');

    if (employeeResult.error || !employeeResult.data) return;
    const assignmentResult = await supabase.from('training_assignments').select('id,employee_id,course_name,provider,skill_id,status,progress,reason,assigned_date,completed_date,verification_status,submission_id');
    if (assignmentResult.error) { showToast('error', 'Could not load course assignments from the database.'); return; }
    const assignmentsByEmployee = new Map<string, TrainingAssignment[]>();
    for (const row of assignmentResult.data ?? []) { const key = String(row.employee_id); const list = assignmentsByEmployee.get(key) ?? []; list.push({ id: String(row.id), courseName: String(row.course_name), provider: String(row.provider ?? ''), skillId: String(row.skill_id ?? ''), status: row.status as TrainingAssignment['status'], progress: Number(row.progress ?? 0), reason: row.reason ? String(row.reason) : undefined, assignedDate: row.assigned_date ? String(row.assigned_date) : undefined, completedDate: row.completed_date ? String(row.completed_date) : undefined, verificationStatus: row.verification_status as TrainingAssignment['verificationStatus'], submissionId: row.submission_id ? String(row.submission_id) : undefined }); assignmentsByEmployee.set(key, list); }

    const skillResult = canReview
      ? await supabase.from('employee_skills').select('employee_id, skill_id, level')
      : await supabase
          .from('employee_skills')
          .select('employee_id, skill_id, level')
          .eq('employee_id', mappedEmployee.id);

    // Fail closed rather than treating stale local/claimed skills as verified when
    // the canonical skill query fails.
    if (skillResult.error || !skillResult.data) return;

    const skillsByEmployee = new Map<string, Employee['skills']>();
    for (const skill of skillResult.data) {
      const current = skillsByEmployee.get(skill.employee_id) ?? [];
      current.push({ skillId: skill.skill_id, level: Number(skill.level) });
      skillsByEmployee.set(skill.employee_id, current);
    }

    const fetchedEmployeeIds = new Set(employeeResult.data.map((row) => String(row.id)));
    const previouslySyncedDatabaseIds = databaseEmployeeIdsRef.current;
    setEmployees((previous) => {
      // Replace the prior database snapshot on every refresh. This removes a
      // recently offboarded account from the active roster while leaving demo data intact.
      const next = previous.filter(
        (item) => !previouslySyncedDatabaseIds.has(item.id) && item.dataSource !== 'database'
      );
      for (const row of employeeResult.data) {
        const dbEmployeeId = String(row.id);
        const authUserId = row.auth_user_id ? String(row.auth_user_id) : null;
        const existingIndex = next.findIndex(
          (item) => item.id === dbEmployeeId || (authUserId && item.authUserId === authUserId)
        );
        const existing = existingIndex >= 0
          ? next[existingIndex]
          : previous.find((item) => item.id === dbEmployeeId || (authUserId && item.authUserId === authUserId));
        const systemRole = ['employee', 'manager', 'hr', 'admin'].includes(String(row.system_role))
          ? (String(row.system_role) as Employee['systemRole'])
          : 'employee';
        const dbEmployee: Employee = {
          ...(existing ?? {} as Employee),
          id: dbEmployeeId,
          authUserId,
          employmentStatus: 'active',
          offboardedAt: row.offboarded_at ? String(row.offboarded_at) : null,
          offboardedBy: row.offboarded_by ? String(row.offboarded_by) : null,
          offboardingReason: row.offboarding_reason ? String(row.offboarding_reason) : null,
          dataSource: 'database',
          name: String(row.name ?? existing?.name ?? 'Employee'),
          role: String(row.role ?? existing?.role ?? 'Workforce Specialist'),
          systemRole,
          department: String(row.department ?? existing?.department ?? 'Engineering'),
          email: String(row.email ?? existing?.email ?? ''),
          avatarColor: String(row.avatar_color ?? existing?.avatarColor ?? '#0078D4'),
          avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
          availability: (row.availability ?? existing?.availability ?? 'available') as Employee['availability'],
          yearsExperience: Number(row.years_experience ?? 0),
          experienceYears: Number(row.years_experience ?? 0),
          targetUtilization: Number(row.target_utilization ?? 100),
          // Only records in employee_skills are imported as verified skill levels.
          skills: skillsByEmployee.get(dbEmployeeId) ?? [],
          trainingAssignments: assignmentsByEmployee.get(dbEmployeeId) ?? [],
        };
        if (existingIndex >= 0) next[existingIndex] = dbEmployee;
        else next.push(dbEmployee);
      }
      return next;
    });
    databaseEmployeeIdsRef.current = fetchedEmployeeIds;
  }, [user, identityStatus, mappedEmployee]);

  useEffect(() => {
    void refreshVerifiedDirectory();
    const handleRefresh = () => {
      if (document.visibilityState === 'visible') void refreshVerifiedDirectory();
    };
    window.addEventListener('togetherly:verified-skills-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleRefresh);
    return () => {
      window.removeEventListener('togetherly:verified-skills-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleRefresh);
    };
  }, [refreshVerifiedDirectory]);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE, previewRole);
    } catch (e) {
      void e;
    }
  }, [previewRole]);

  useEffect(() => {
    try {
      // Supabase-linked profiles and verified skills are reloaded from the database.
      // Keep only local/demo-managed profiles in browser storage.
      localStorage.setItem(
        STORAGE_KEYS.EMPLOYEES,
        JSON.stringify(employees.filter((employee) => !employee.authUserId && employee.dataSource !== 'database'))
      );
    } catch (e) {
      void e;
    }
  }, [employees]);

  useEffect(() => {
    try {
      if (!hasMappedAuthIdentity) localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch (e) {
      void e;
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      void e;
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
    } catch (e) {
      void e;
    }
  }, [activities]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    } catch (e) {
      void e;
    }
  }, [submissions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      void e;
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
    } catch (e) {
      void e;
    }
  }, [activities]);

  const setRole = (newRole: Role) => {
    // Never let a signed-in account switch to a different workspace role in the UI.
    // The authenticated role is derived from the verified linked employee record above.
    if (hasMappedAuthIdentity) return;
    setPreviewRoleState(newRole);
  };

  const showToast = useCallback((type: ToastNotification['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addActivity = useCallback((messageOrObj: string | { message: string; type?: string }, maybeType?: string) => {
    const message = typeof messageOrObj === 'string' ? messageOrObj : messageOrObj.message;
    const type = typeof messageOrObj === 'string' ? (maybeType || 'system') : (messageOrObj.type || 'system');
    const newAct: Activity = {
      id: `act-${Date.now()}`,
      message,
      timestamp: new Date().toISOString(),
      type: type as Activity['type'],
    };
    setActivities((prev) => [newAct, ...prev.slice(0, 30)]);
  }, []);

  const addEmployee = (empData: Omit<Employee, 'id'> & { id?: string }) => {
    const newEmp: Employee = {
      ...empData,
      id: empData.id || `emp-${String(employees.length + 1).padStart(3, '0')}`,
    };
    setEmployees((prev) => [...prev, newEmp]);
    addActivity(`Added new employee: ${newEmp.name}`, 'system');
    showToast('success', `Added ${newEmp.name} to the workforce.`);
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === id ? { ...emp, ...updates } : emp))
    );
  };

  const deleteEmployee = async (id: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    let authCleanupPending = false;
    const emp = employees.find((e) => e.id === id);
    if (!emp) return { success: false, error: 'Employee not found in the current roster.' };

    const isDatabaseEmployee = databaseEmployeeIdsRef.current.has(id);
    if (isDatabaseEmployee) {
      if (!hasMappedAuthIdentity || !supabase || !isSupabaseConfigured()) {
        const message = 'An authenticated manager or HR reviewer is required to remove a database employee.';
        showToast('error', message);
        return { success: false, error: message };
      }
      if (!reason || reason.trim().length < 5) {
        const message = 'Enter an offboarding reason of at least 5 characters.';
        showToast('error', message);
        return { success: false, error: message };
      }

      const { data: offboardingResult, error } = await supabase.functions.invoke('workspace-identity-lifecycle', {
        body: { action: 'offboard', employeeId: id, reason: reason.trim() },
      });
      if (error) {
        showToast('error', error.message || 'Could not remove this employee from the organization.');
        return { success: false, error: error.message };
      }
      if (!offboardingResult?.success) {
        const message = offboardingResult?.error || 'Could not complete employee offboarding.';
        showToast('error', message);
        return { success: false, error: message };
      }
      authCleanupPending = Boolean(offboardingResult.authCleanupPending);
      databaseEmployeeIdsRef.current.delete(id);
    }

    // Keep the employee and their verification/audit history in the database;
    // remove only their active roster and current project allocations from this UI.
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setProjects((prev) =>
      prev.map((proj) => ({
        ...proj,
        assignedEmployeeIds: proj.assignedEmployeeIds.filter((empId) => empId !== id),
      }))
    );
    if (emp) {
      addActivity(`Removed employee from organization: ${emp.name}${reason ? ` · Reason: ${reason.trim()}` : ''}`, 'system');
      if (isDatabaseEmployee && authCleanupPending) {
        showToast('warning', 'Removed ' + emp.name + ' from active staffing, but Supabase Auth cleanup is pending. An administrator can retry it under Admin Access.');
      } else {
        showToast('success', isDatabaseEmployee
          ? 'Removed ' + emp.name + ' from the active roster. Their history is preserved and their email has been released.'
          : 'Removed ' + emp.name + ' from the demo directory.');
      }
    }
    return { success: true };
  };

  const addProject = async (projData: Omit<Project, 'id'> & { id?: string }) => {
    const newProj: Project = { ...projData, id: projData.id || `proj-${crypto.randomUUID()}` };
    if (hasMappedAuthIdentity && supabase) {
      const { error } = await supabase.from('projects').insert({ id: newProj.id, name: newProj.name, description: newProj.description, department: newProj.department, status: newProj.status, target_team_size: newProj.targetTeamSize, start_date: newProj.startDate || null, deadline: newProj.deadline || null, priority: newProj.priority ?? 'medium' });
      if (error) { showToast('error', `Project was not saved: ${error.message}`); return; }
      if (newProj.assignedEmployeeIds.length) { const { error: memberError } = await supabase.from('project_members').insert(newProj.assignedEmployeeIds.map((employee_id) => ({ project_id: newProj.id, employee_id }))); if (memberError) showToast('error', `Project saved, but team assignment failed: ${memberError.message}`); }
      if (newProj.requiredSkills.length) { const { error: reqError } = await supabase.from('project_requirements').insert(newProj.requiredSkills.map((r) => ({ project_id: newProj.id, skill_id: r.skillId, min_level: r.minLevel, importance: r.importance ?? 'required' }))); if (reqError) showToast('error', `Project saved, but skill requirements failed: ${reqError.message}`); }
      await refreshProjects();
    } else setProjects((prev) => [...prev, newProj]);
    addActivity(`Created new project: ${newProj.name}`, 'project');
    showToast('success', `Project \"${newProj.name}\" created successfully.`);
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    if (hasMappedAuthIdentity && supabase) {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name; if (updates.description !== undefined) dbUpdates.description = updates.description; if (updates.department !== undefined) dbUpdates.department = updates.department; if (updates.status !== undefined) dbUpdates.status = updates.status; if (updates.targetTeamSize !== undefined) dbUpdates.target_team_size = updates.targetTeamSize; if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null; if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline || null; if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (Object.keys(dbUpdates).length) { const { error } = await supabase.from('projects').update(dbUpdates).eq('id', id); if (error) { showToast('error', `Project update failed: ${error.message}`); return; } }
      if (updates.assignedEmployeeIds) { await supabase.from('project_members').delete().eq('project_id', id); if (updates.assignedEmployeeIds.length) { const { error } = await supabase.from('project_members').insert(updates.assignedEmployeeIds.map((employee_id) => ({ project_id: id, employee_id }))); if (error) { showToast('error', `Team assignment failed: ${error.message}`); return; } } }
      if (updates.requiredSkills) { await supabase.from('project_requirements').delete().eq('project_id', id); if (updates.requiredSkills.length) { const { error } = await supabase.from('project_requirements').insert(updates.requiredSkills.map((r) => ({ project_id: id, skill_id: r.skillId, min_level: r.minLevel, importance: r.importance ?? 'required' }))); if (error) { showToast('error', `Skill requirement update failed: ${error.message}`); return; } } }
      await refreshProjects(); return;
    }
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const deleteProject = async (id: string) => {
    const proj = projects.find((p) => p.id === id);
    if (hasMappedAuthIdentity && supabase) { const { error } = await supabase.from('projects').delete().eq('id', id); if (error) { showToast('error', `Project deletion failed: ${error.message}`); return; } await refreshProjects(); }
    else setProjects((prev) => prev.filter((p) => p.id !== id));
    if (proj) { addActivity(`Deleted project: ${proj.name}`, 'project'); showToast('info', `Project \"${proj.name}\" removed.`); }
  };

  const assignEmployeeToProject = (employeeId: string, projectId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    const proj = projects.find((p) => p.id === projectId);

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId && !p.assignedEmployeeIds.includes(employeeId)) {
          return {
            ...p,
            assignedEmployeeIds: [...p.assignedEmployeeIds, employeeId],
          };
        }
        return p;
      })
    );

    if (emp && proj) {
      addActivity(`Assigned ${emp.name} to ${proj.name}`, 'assignment');
    }
  };

  const unassignEmployeeFromProject = (employeeId: string, projectId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    const proj = projects.find((p) => p.id === projectId);

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            assignedEmployeeIds: p.assignedEmployeeIds.filter((id) => id !== employeeId),
          };
        }
        return p;
      })
    );

    if (emp && proj) {
      addActivity(`Unassigned ${emp.name} from ${proj.name}`, 'assignment');
    }
  };

  const addTrainingAssignment = async (employeeId: string, training: Omit<TrainingAssignment, 'id'>) => {
    const newTrn: TrainingAssignment = { ...training, id: `trn-${crypto.randomUUID()}` };
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) { showToast('error', 'Select a valid employee before assigning a course.'); return; }
    if (hasMappedAuthIdentity && supabase) {
      if (!['admin', 'manager', 'hr'].includes(String(mappedEmployee?.systemRole))) { showToast('error', 'You do not have permission to assign courses.'); return; }
      const { error } = await supabase.from('training_assignments').insert({ id: newTrn.id, employee_id: employeeId, course_name: newTrn.courseName, provider: newTrn.provider, skill_id: newTrn.skillId, status: newTrn.status, progress: newTrn.progress, reason: newTrn.reason ?? null, assigned_date: newTrn.assignedDate ?? new Date().toISOString().slice(0, 10), completed_date: newTrn.completedDate ?? null, verification_status: newTrn.verificationStatus ?? 'not-started', submission_id: newTrn.submissionId ?? null });
      if (error) { showToast('error', `Course assignment failed: ${error.message}`); return; }
      await refreshVerifiedDirectory();
    } else setEmployees((prev) => prev.map((item) => item.id === employeeId ? { ...item, trainingAssignments: [...item.trainingAssignments, newTrn] } : item));
    addActivity(`Assigned \"${newTrn.courseName}\" to ${emp.name}`, 'training');
    showToast('success', `Assigned \"${newTrn.courseName}\" to ${emp.name}.`);
  };

  const updateTrainingAssignment = (
    employeeId: string,
    trainingId: string,
    updates: Partial<TrainingAssignment>
  ) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === employeeId) {
          const updatedAssignments = emp.trainingAssignments.map((trn) => {
            if (trn.id === trainingId) {
              return { ...trn, ...updates };
            }
            return trn;
          });

          return {
            ...emp,
            trainingAssignments: updatedAssignments,
          };
        }
        return emp;
      })
    );
  };

  const submitTrainingClaim = (
    claim: Omit<TrainingSubmission, 'id' | 'submissionDate' | 'status' | 'auditTrail'> & { id?: string }
  ): TrainingSubmission => {
    const newSubmission: TrainingSubmission = {
      ...claim,
      id: claim.id || `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      submissionDate: new Date().toISOString().split('T')[0],
      status: 'pending-verification',
      auditTrail: [
        {
          id: `log-${Date.now()}`,
          action: 'submitted',
          actorName: claim.employeeName,
          actorRole: 'employee',
          actorId: claim.employeeId,
          timestamp: new Date().toISOString(),
          note: claim.notes || 'Training completion claim submitted for verification.',
        },
      ],
    };

    setSubmissions((prev) => [newSubmission, ...prev]);

    // Update corresponding employee training assignment if linked or matching
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === claim.employeeId) {
          let updated = false;
          const newAssignments = emp.trainingAssignments.map((trn) => {
            if (
              (claim.assignmentId && trn.id === claim.assignmentId) ||
              trn.courseName.toLowerCase() === claim.courseName.toLowerCase()
            ) {
              updated = true;
              return {
                ...trn,
                progress: 100,
                completedDate: claim.completionDate,
                verificationStatus: 'pending-verification' as const,
                submissionId: newSubmission.id,
              };
            }
            return trn;
          });

          if (!updated && claim.skillId) {
            newAssignments.push({
              id: `trn-${Date.now()}`,
              courseName: claim.courseName,
              provider: claim.provider,
              skillId: claim.skillId,
              status: 'in-progress',
              progress: 100,
              assignedDate: new Date().toISOString().split('T')[0],
              completedDate: claim.completionDate,
              verificationStatus: 'pending-verification',
              submissionId: newSubmission.id,
              reason: 'Self-directed training completion submission',
            });
          }

          return {
            ...emp,
            trainingAssignments: newAssignments,
          };
        }
        return emp;
      })
    );

    addActivity(
      `${claim.employeeName} submitted "${claim.courseName}" for completion verification`,
      'training'
    );
    showToast('success', `Submitted "${claim.courseName}" for verification.`);
    return newSubmission;
  };

  const resubmitTrainingClaim = (
    submissionId: string,
    updates: Partial<TrainingSubmission>
  ): { success: boolean; error?: string } => {
    const existing = submissions.find((s) => s.id === submissionId);
    if (!existing) {
      showToast('error', 'Submission record not found.');
      return { success: false, error: 'Submission not found' };
    }

    const resubmitLog: VerificationAuditLog = {
      id: `log-${Date.now()}`,
      action: 'resubmitted',
      actorName: existing.employeeName,
      actorRole: 'employee',
      actorId: existing.employeeId,
      timestamp: new Date().toISOString(),
      note: updates.notes || 'Updated training evidence resubmitted for verification.',
    };

    const updatedSubmission: TrainingSubmission = {
      ...existing,
      ...updates,
      status: 'pending-verification',
      submissionDate: new Date().toISOString().split('T')[0],
      reviewerNotes: undefined,
      rejectionReason: undefined,
      auditTrail: [resubmitLog, ...existing.auditTrail],
    };

    setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? updatedSubmission : s)));

    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === existing.employeeId) {
          return {
            ...emp,
            trainingAssignments: emp.trainingAssignments.map((trn) => {
              if (trn.submissionId === submissionId || trn.id === existing.assignmentId) {
                return {
                  ...trn,
                  verificationStatus: 'pending-verification' as const,
                };
              }
              return trn;
            }),
          };
        }
        return emp;
      })
    );

    addActivity(
      `${existing.employeeName} resubmitted evidence for "${existing.courseName}"`,
      'training'
    );
    showToast('success', `Resubmitted evidence for "${existing.courseName}".`);
    return { success: true };
  };

  const reviewTrainingClaim = (
    submissionId: string,
    decision: 'approved' | 'rejected' | 'requested_more_evidence',
    notes: string,
    reviewerId: string = 'mgr-001',
    reviewerName: string = 'Alex Morgan'
  ): { success: boolean; error?: string } => {
    const submission = submissions.find((s) => s.id === submissionId);
    if (!submission) {
      showToast('error', 'Training submission not found.');
      return { success: false, error: 'Submission not found' };
    }

    // Security & record integrity: Prevent self-approval
    if (reviewerId && reviewerId === submission.employeeId) {
      showToast('error', 'Self-approval is prohibited: Employees cannot approve their own training claims.');
      return { success: false, error: 'Self-approval is prohibited.' };
    }

    if (role === 'employee') {
      showToast('error', 'Access denied: Only Managers and HR administrators can verify training completions.');
      return { success: false, error: 'Unauthorized role.' };
    }

    if (decision === 'rejected' && (!notes || !notes.trim())) {
      showToast('error', 'A rejection reason is required.');
      return { success: false, error: 'Rejection reason is required.' };
    }

    if (decision === 'requested_more_evidence' && (!notes || !notes.trim())) {
      showToast('error', 'Please specify what additional evidence is required.');
      return { success: false, error: 'Evidence note is required.' };
    }

    const newStatus: VerificationStatus =
      decision === 'approved'
        ? 'verified'
        : decision === 'rejected'
        ? 'rejected'
        : 'needs-more-evidence';

    const log: VerificationAuditLog = {
      id: `log-${Date.now()}`,
      action: decision,
      actorName: reviewerName,
      actorRole: 'manager',
      actorId: reviewerId,
      timestamp: new Date().toISOString(),
      note: notes.trim(),
    };

    const updatedSubmission: TrainingSubmission = {
      ...submission,
      status: newStatus,
      reviewerId,
      reviewerName,
      reviewTimestamp: new Date().toISOString(),
      reviewerNotes: decision === 'requested_more_evidence' ? notes.trim() : submission.reviewerNotes,
      rejectionReason: decision === 'rejected' ? notes.trim() : submission.rejectionReason,
      auditTrail: [log, ...submission.auditTrail],
    };

    setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? updatedSubmission : s)));

    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === submission.employeeId) {
          return {
            ...emp,
            trainingAssignments: emp.trainingAssignments.map((trn) => {
              if (trn.submissionId === submissionId || trn.id === submission.assignmentId) {
                return {
                  ...trn,
                  verificationStatus: newStatus,
                  completedDate: decision === 'approved' ? submission.completionDate : trn.completedDate,
                };
              }
              return trn;
            }),
          };
        }
        return emp;
      })
    );

    if (decision === 'approved') {
      addActivity(
        `Verified training achievement: ${submission.employeeName} completed "${submission.courseName}"`,
        'training'
      );
      showToast('success', `Verified "${submission.courseName}" for ${submission.employeeName}.`);
    } else if (decision === 'rejected') {
      addActivity(
        `Training claim rejected for ${submission.employeeName}: "${submission.courseName}" (${notes.trim()})`,
        'training'
      );
      showToast('warning', `Rejected claim for "${submission.courseName}".`);
    } else {
      addActivity(
        `Requested additional evidence from ${submission.employeeName} for "${submission.courseName}"`,
        'training'
      );
      showToast('info', `Requested more evidence for "${submission.courseName}".`);
    }

    return { success: true };
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const resetData = () => {
    setEmployees(initialEmployees);
    setProjects(initialProjects);
    setSettings(defaultSettings);
    setActivities(initialActivities);
    setSubmissions(initialSubmissions);
    setPreviewRoleState('manager');
    try {
      localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
      localStorage.removeItem(STORAGE_KEYS.PROJECTS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
      localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
      localStorage.removeItem(STORAGE_KEYS.ROLE);
    } catch (e) {
      void e;
    }
    addActivity('Reset all workspace data to defaults', 'system');
  };

  return (
    <DataContext.Provider
      value={{
        role,
        setRole,
        employees,
        projects,
        settings,
        activities,
        toasts,
        submissions,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addProject,
        updateProject,
        deleteProject,
        assignEmployeeToProject,
        unassignEmployeeFromProject,
        addTrainingAssignment,
        updateTrainingAssignment,
        submitTrainingClaim,
        resubmitTrainingClaim,
        reviewTrainingClaim,
        updateSettings,
        resetData,
        addActivity,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
