export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export interface Skill {
  id: string;
  name: string;
  category: string;
}

export interface EmployeeSkill {
  skillId: string;
  level: SkillLevel;
}

export type Availability = 'available' | 'busy' | 'unavailable';

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  yearsExperience: number;
  skills: EmployeeSkill[];
  availability: Availability;
  avatarColor: string;
  targetUtilization: number;
  trainingAssignments: TrainingAssignment[];
}

export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ProjectRequirement {
  skillId: string;
  minLevel: SkillLevel;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string;
  deadline: string;
  requiredSkills: ProjectRequirement[];
  targetTeamSize: number;
  assignedEmployeeIds: string[];
}

export interface TrainingAssignment {
  id: string;
  skillId: string;
  courseName: string;
  provider: string;
  progress: number;
  status: 'not-started' | 'in-progress' | 'completed';
  reason: string;
}

export interface MatchWeights {
  skillMatch: number;
  experience: number;
  availability: number;
}

export interface RecommendationResult {
  employeeId: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  experienceRelevance: number;
  currentUtilization: number;
  availableCapacity: number;
  reasons: string[];
}

export interface ActivityEntry {
  id: string;
  type: 'project' | 'team' | 'employee' | 'training' | 'workload';
  message: string;
  timestamp: string;
}

export interface AppSettings {
  organizationName: string;
  overloadedThreshold: number;
  underutilizedThreshold: number;
  matchWeights: MatchWeights;
  emailNotifications: boolean;
  workloadAlerts: boolean;
  teamReminders: boolean;
  weeklyDigest: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
