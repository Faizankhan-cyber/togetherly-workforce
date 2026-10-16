export type Role = 'manager' | 'employee';

export type AvailabilityStatus = 'available' | 'busy' | 'unavailable' | 'partially-available';

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on-hold';

export interface EmployeeSkill {
  skillId: string;
  level: number; // 1 to 5
}

export interface TrainingAssignment {
  id: string;
  courseName: string;
  provider: string;
  skillId: string;
  status: 'not-started' | 'in-progress' | 'completed';
  progress: number; // 0 to 100
  reason?: string;
  assignedDate?: string;
  completedDate?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  avatarColor: string;
  availability: AvailabilityStatus;
  yearsExperience: number;
  experienceYears?: number; // alias
  targetUtilization: number; // percentage, e.g. 100
  skills: EmployeeSkill[];
  trainingAssignments: TrainingAssignment[];
}

export interface ProjectRequirement {
  skillId: string;
  minLevel: number;
  importance?: 'required' | 'preferred';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  status: ProjectStatus;
  targetTeamSize: number;
  assignedEmployeeIds: string[];
  requiredSkills: ProjectRequirement[];
  startDate: string;
  deadline: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface Activity {
  id: string;
  message: string;
  timestamp: string;
  type?: 'assignment' | 'training' | 'simulation' | 'project' | 'system';
}

export interface MatchWeights {
  skills: number;
  experience: number;
  availability: number;
}

export interface AppSettings {
  organizationName: string;
  emailNotifications: boolean;
  workloadAlerts: boolean;
  teamReminders: boolean;
  weeklyDigest: boolean;
  overloadedThreshold: number;
  underutilizedThreshold: number;
  matchWeights: MatchWeights;
}

export interface CandidateRecommendation {
  employeeId: string;
  matchScore: number;
  skillsScore: number;
  experienceScore: number;
  availabilityScore: number;
  availableCapacity: number;
  capacityFeasible: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  risks: string[];
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}
