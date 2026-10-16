export type Role = 'manager' | 'employee';

export type AvailabilityStatus = 'available' | 'busy' | 'unavailable' | 'partially-available';

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on-hold';

export interface EmployeeSkill {
  skillId: string;
  level: number; // 1 to 5
}

export type VerificationStatus =
  | 'not-started'
  | 'in-progress'
  | 'pending-verification'
  | 'verified'
  | 'rejected'
  | 'needs-more-evidence';

export interface VerificationAuditLog {
  id: string;
  action: 'submitted' | 'resubmitted' | 'approved' | 'rejected' | 'requested_more_evidence';
  actorName: string;
  actorRole: 'manager' | 'employee';
  actorId: string;
  timestamp: string;
  note?: string;
}

export interface TrainingSubmission {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeDepartment: string;
  employeeAvatarColor?: string;
  courseName: string;
  provider: string;
  skillId: string;
  completionDate: string;
  submissionDate: string;
  credentialId?: string;
  verificationUrl?: string;
  notes?: string;
  evidenceFileName?: string;
  evidenceFileType?: 'pdf' | 'image' | 'link' | 'none';
  evidenceDataUrl?: string;
  evidenceFileSize?: number;
  status: VerificationStatus;
  assignmentId?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewTimestamp?: string;
  reviewerNotes?: string;
  rejectionReason?: string;
  auditTrail: VerificationAuditLog[];
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
  verificationStatus?: VerificationStatus;
  submissionId?: string;
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
