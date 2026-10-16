import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  deleteEmployee: (id: string) => void;
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
  const [role, setRoleState] = useState<Role>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ROLE);
      return stored === 'employee' || stored === 'manager' ? stored : 'manager';
    } catch {
      return 'manager';
    }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      return stored ? JSON.parse(stored) : initialEmployees;
    } catch {
      return initialEmployees;
    }
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      return stored ? JSON.parse(stored) : initialProjects;
    } catch {
      return initialProjects;
    }
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

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE, role);
    } catch (e) {
      void e;
    }
  }, [role]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
    } catch (e) {
      void e;
    }
  }, [employees]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
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
    setRoleState(newRole);
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

  const deleteEmployee = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    // Also remove from any projects
    setProjects((prev) =>
      prev.map((proj) => ({
        ...proj,
        assignedEmployeeIds: proj.assignedEmployeeIds.filter((empId) => empId !== id),
      }))
    );
    if (emp) {
      addActivity(`Removed employee: ${emp.name}`, 'system');
      showToast('info', `Removed ${emp.name} from directory.`);
    }
  };

  const addProject = (projData: Omit<Project, 'id'> & { id?: string }) => {
    const newProj: Project = {
      ...projData,
      id: projData.id || `proj-${String(projects.length + 1).padStart(3, '0')}`,
    };
    setProjects((prev) => [...prev, newProj]);
    addActivity(`Created new project: ${newProj.name}`, 'project');
    showToast('success', `Project "${newProj.name}" created successfully.`);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const deleteProject = (id: string) => {
    const proj = projects.find((p) => p.id === id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (proj) {
      addActivity(`Deleted project: ${proj.name}`, 'project');
      showToast('info', `Project "${proj.name}" removed.`);
    }
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

  const addTrainingAssignment = (
    employeeId: string,
    training: Omit<TrainingAssignment, 'id'>
  ) => {
    const newTrn: TrainingAssignment = {
      ...training,
      id: `trn-${Date.now()}`,
    };

    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === employeeId) {
          return {
            ...emp,
            trainingAssignments: [...emp.trainingAssignments, newTrn],
          };
        }
        return emp;
      })
    );

    const emp = employees.find((e) => e.id === employeeId);
    if (emp) {
      addActivity(`Assigned "${newTrn.courseName}" to ${emp.name}`, 'training');
      showToast('success', `Assigned "${newTrn.courseName}" to ${emp.name}.`);
    }
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
    setRoleState('manager');
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
