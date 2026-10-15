import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  Employee,
  Project,
  AppSettings,
  ActivityEntry,
  ToastMessage,
  TrainingAssignment,
  UserRole,
} from '@/types';
import {
  employees as seedEmployees,
  projects as seedProjects,
  defaultSettings,
  recentActivity as seedActivity,
} from '@/data/mockData';
import { uid } from '@/utils';

interface DataContextValue {
  employees: Employee[];
  projects: Project[];
  settings: AppSettings;
  activities: ActivityEntry[];
  addEmployee: (employee: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addProject: (project: Omit<Project, 'id'>) => string;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  assignEmployeeToProject: (employeeId: string, projectId: string) => void;
  unassignEmployeeFromProject: (employeeId: string, projectId: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  resetData: () => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  addTrainingAssignment: (employeeId: string, assignment: Omit<TrainingAssignment, 'id'>) => void;
  updateTrainingAssignment: (employeeId: string, assignmentId: string, updates: Partial<TrainingAssignment>) => void;
  toasts: ToastMessage[];
  showToast: (type: ToastMessage['type'], message: string) => void;
  dismissToast: (id: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const STORAGE_KEY = 'togetherly-data-v1';
const ROLE_STORAGE_KEY = 'togetherly-demo-role';

interface StoredData {
  employees: Employee[];
  projects: Project[];
  settings: AppSettings;
  activities: ActivityEntry[];
}

function loadFromStorage(): StoredData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredData;
  } catch {
    return null;
  }
}

function saveToStorage(data: StoredData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const stored = loadFromStorage();
  const [role, setRole] = useState<UserRole>(() => {
    try {
      return localStorage.getItem(ROLE_STORAGE_KEY) === 'employee' ? 'employee' : 'manager';
    } catch {
      return 'manager';
    }
  });
  const [employees, setEmployees] = useState<Employee[]>(stored?.employees ?? seedEmployees);
  const [projects, setProjects] = useState<Project[]>(stored?.projects ?? seedProjects);
  const [settings, setSettings] = useState<AppSettings>(stored?.settings ?? defaultSettings);
  const [activities, setActivities] = useState<ActivityEntry[]>(stored?.activities ?? seedActivity);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    saveToStorage({ employees, projects, settings, activities });
  }, [employees, projects, settings, activities]);

  useEffect(() => {
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, [role]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = uid('toast');
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addActivity = useCallback((entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => {
    const newEntry: ActivityEntry = {
      ...entry,
      id: uid('act'),
      timestamp: new Date().toISOString(),
    };
    setActivities((prev) => [newEntry, ...prev].slice(0, 30));
  }, []);

  const addEmployee = useCallback((employee: Omit<Employee, 'id'>) => {
    const newEmp: Employee = { ...employee, id: uid('emp') };
    setEmployees((prev) => [...prev, newEmp]);
    addActivity({ type: 'employee', message: `New employee "${newEmp.name}" added as ${newEmp.role}` });
  }, [addActivity]);

  const updateEmployee = useCallback((id: string, updates: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        assignedEmployeeIds: p.assignedEmployeeIds.filter((eid) => eid !== id),
      }))
    );
  }, []);

  const addProject = useCallback((project: Omit<Project, 'id'>): string => {
    const id = uid('prj');
    const newProject: Project = { ...project, id };
    setProjects((prev) => [...prev, newProject]);
    addActivity({ type: 'project', message: `New project "${newProject.name}" created` });
    return id;
  }, [addActivity]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const assignEmployeeToProject = useCallback((employeeId: string, projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId && !p.assignedEmployeeIds.includes(employeeId)
          ? { ...p, assignedEmployeeIds: [...p.assignedEmployeeIds, employeeId] }
          : p
      )
    );
  }, []);

  const unassignEmployeeFromProject = useCallback((employeeId: string, projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, assignedEmployeeIds: p.assignedEmployeeIds.filter((eid) => eid !== employeeId) }
          : p
      )
    );
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const addTrainingAssignment = useCallback((
    employeeId: string,
    assignment: Omit<TrainingAssignment, 'id'>
  ) => {
    const next: TrainingAssignment = { ...assignment, id: uid('tr') };
    setEmployees((prev) => prev.map((employee) =>
      employee.id === employeeId && !employee.trainingAssignments.some((item) =>
        item.skillId === assignment.skillId && item.status !== 'completed'
      )
        ? { ...employee, trainingAssignments: [...employee.trainingAssignments, next] }
        : employee
    ));
  }, []);

  const updateTrainingAssignment = useCallback((
    employeeId: string,
    assignmentId: string,
    updates: Partial<TrainingAssignment>
  ) => {
    const employee = employees.find((item) => item.id === employeeId);
    const assignment = employee?.trainingAssignments.find((item) => item.id === assignmentId);
    const completesCourse = !!assignment && assignment.status !== 'completed' && updates.status === 'completed';

    setEmployees((prev) => prev.map((item) => {
      if (item.id !== employeeId) return item;
      return {
        ...item,
        trainingAssignments: item.trainingAssignments.map((training) =>
          training.id === assignmentId ? { ...training, ...updates } : training
        ),
        ...(completesCourse && assignment
          ? {
              skills: (() => {
                const currentLevel = item.skills.find((skill) => skill.skillId === assignment.skillId)?.level ?? 0;
                const nextLevel = Math.min(5, Math.max(1, currentLevel + 1)) as 1 | 2 | 3 | 4 | 5;
                return item.skills.some((skill) => skill.skillId === assignment.skillId)
                  ? item.skills.map((skill) => skill.skillId === assignment.skillId
                      ? { ...skill, level: nextLevel }
                      : skill)
                  : [...item.skills, { skillId: assignment.skillId, level: nextLevel }];
              })(),
            }
          : {}),
      };
    }));

    if (completesCourse && employee && assignment) {
      addActivity({ type: 'training', message: `${employee.name} completed "${assignment.courseName}"` });
    }
  }, [employees, addActivity]);

  const resetData = useCallback(() => {
    setEmployees(seedEmployees);
    setProjects(seedProjects);
    setSettings(defaultSettings);
    setActivities(seedActivity);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: DataContextValue = {
    employees,
    projects,
    settings,
    activities,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addProject,
    updateProject,
    deleteProject,
    assignEmployeeToProject,
    unassignEmployeeFromProject,
    updateSettings,
    addActivity,
    resetData,
    role,
    setRole,
    addTrainingAssignment,
    updateTrainingAssignment,
    toasts,
    showToast,
    dismissToast,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
