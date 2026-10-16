import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  Activity,
  AppSettings,
  Employee,
  Project,
  Role,
  ToastNotification,
  TrainingAssignment,
} from '@/types';
import {
  defaultSettings,
  initialActivities,
  initialEmployees,
  initialProjects,
} from '@/data/mockData';

interface DataContextType {
  role: Role;
  setRole: (role: Role) => void;
  employees: Employee[];
  projects: Project[];
  settings: AppSettings;
  activities: Activity[];
  toasts: ToastNotification[];
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
              const merged = { ...trn, ...updates };
              return merged;
            }
            return trn;
          });

          // If training reached 100%, boost corresponding employee skill level
          let updatedSkills = emp.skills;
          const targetTrn = emp.trainingAssignments.find((t) => t.id === trainingId);
          if (targetTrn && updates.progress === 100) {
            const skillIdx = emp.skills.findIndex((s) => s.skillId === targetTrn.skillId);
            if (skillIdx >= 0) {
              updatedSkills = emp.skills.map((s, idx) =>
                idx === skillIdx ? { ...s, level: Math.min(5, s.level + 1) } : s
              );
            } else {
              updatedSkills = [...emp.skills, { skillId: targetTrn.skillId, level: 3 }];
            }
          }

          return {
            ...emp,
            skills: updatedSkills,
            trainingAssignments: updatedAssignments,
          };
        }
        return emp;
      })
    );
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const resetData = () => {
    setEmployees(initialEmployees);
    setProjects(initialProjects);
    setSettings(defaultSettings);
    setActivities(initialActivities);
    setRoleState('manager');
    try {
      localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
      localStorage.removeItem(STORAGE_KEYS.PROJECTS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
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

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
