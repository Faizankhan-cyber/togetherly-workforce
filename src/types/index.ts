export type Role = 'manager' | 'employee' | 'admin' | 'hr';

export type SystemRole = 'employee' | 'manager' | 'hr' | 'admin';

export type RegistrationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface EmployeeRegistrationRequest {
  id: string;
  authUserId: string;
  applicantName: string;
  email: string;
  requestedDepartment: string;
  requestedJobTitle?: string | null;
  assignedRole?: SystemRole | null;
  assignedDepartment?: string | null;
  assignedJobTitle?: string | null;
  employeeId?: string | null;
  status: RegistrationRequestStatus;
  reviewerId?: string | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AvailabilityStatus = 'available' | 'busy' | 'unavailable' | 'partially-available';

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on-hold';

export interface EmployeeSkill {
  skillId: string;
  level: number; // 1 to 5
}

export type EmployeeProfileClaimType = 'skill' | 'experience' | 'certification' | 'employment' | 'education' | 'job-title';
export type EmployeeProfileClaimStatus =
  | 'pending-verification'
  | 'verified'
  | 'rejected'
  | 'needs-more-evidence';
export type EmployeeProfileClaimDecision = 'verified' | 'rejected' | 'needs-more-evidence';

export interface EmployeeProfileClaim {
  id: string;
  employee_id: string;
  submission_id: string | null;
  claim_type: EmployeeProfileClaimType;
  skill_id: string | null;
  claimed_level: number | null;
  claimed_years: number | null;
  title: string | null;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  evidence_url: string | null;
  evidence_label: string | null;
  evidence_storage_path: string | null;
  status: EmployeeProfileClaimStatus;
  reviewer_employee_id: string | null;
  reviewer_name: string | null;
  reviewer_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeProfileSubmission {
  id: string;
  employee_id: string;
  professional_summary: string | null;
  claimed_years_experience: number | null;
  resume_storage_path: string | null;
  resume_file_name: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeProfileClaimAudit {
  id: string;
  claim_id: string;
  employee_id: string;
  action: 'submitted' | 'resubmitted' | 'verified' | 'rejected' | 'needs-more-evidence';
  actor_employee_id: string | null;
  actor_name: string;
  actor_role: SystemRole;
  note: string | null;
  created_at: string;
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
  authUserId?: string | null;
  employmentStatus?: 'active' | 'offboarded';
  offboardedAt?: string | null;
  offboardedBy?: string | null;
  offboardingReason?: string | null;
  /** Database-backed employee rows must not be written into the demo cache. */
  dataSource?: 'database' | 'demo';
  name: string;
  role: string;
  systemRole?: SystemRole;
  department: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string | null;
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

// ==========================================
// Scenario Simulator Types
// ==========================================

export type ScenarioType =
  | 'reallocation'
  | 'new-hire'
  | 'project-delay'
  | 'training'
  | 'new-project'
  | 'capacity-reduction';

export interface ReallocationConfig {
  employeeId: string;
  sourceProjectId: string;
  targetProjectId: string;
}

export interface NewHireConfig {
  name: string;
  role: string;
  department: string;
  yearsExperience: number;
  skills: EmployeeSkill[];
  availability: AvailabilityStatus;
  targetUtilization: number;
  assignedProjectIds: string[];
}

export interface ProjectDelayConfig {
  projectId: string;
  delayWeeks: number;
  notes?: string;
  resourceContentionWindowWeeks: number;
}

export interface TrainingConfig {
  employeeId: string;
  skillId: string;
  currentLevel: number;
  targetLevel: number;
  durationWeeks: number;
  provider?: string;
}

export interface NewProjectConfig {
  name: string;
  description: string;
  department: string;
  targetTeamSize: number;
  durationMonths: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredSkills: ProjectRequirement[];
  selectedEmployeeIds: string[];
}

export interface CapacityReductionConfig {
  reductionPercent: number; // e.g. 15 for 15%
  department: string; // 'all' or specific department
  strategy: 'attrition' | 'budget_cut' | 'hiring_freeze';
}

export interface ScenarioModel {
  id: string;
  name: string;
  description: string;
  type: ScenarioType;
  createdAt: string;
  updatedAt: string;
  config: {
    reallocation?: ReallocationConfig;
    newHire?: NewHireConfig;
    projectDelay?: ProjectDelayConfig;
    training?: TrainingConfig;
    newProject?: NewProjectConfig;
    capacityReduction?: CapacityReductionConfig;
  };
}

export interface BaselineMetrics {
  totalHeadcount: number;
  averageUtilization: number;
  overloadedCount: number;
  underutilizedCount: number;
  balancedCount: number;
  totalActiveProjects: number;
  staffedProjectsCount: number;
  understaffedProjectsCount: number;
  totalSkillGaps: number;
}

export type SimulatedMetrics = BaselineMetrics;

export interface MetricDelta {
  key: string;
  label: string;
  baseline: number;
  simulated: number;
  delta: number;
  status: 'improvement' | 'warning' | 'risk' | 'neutral';
  explanation: string;
  unit?: string;
}

export interface ProjectImpact {
  projectId: string;
  projectName: string;
  department: string;
  status: ProjectStatus;
  baselineTeamSize: number;
  simulatedTeamSize: number;
  targetTeamSize: number;
  baselineGaps: number;
  simulatedGaps: number;
  gapDelta: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskReasons: string[];
  isSimulatedNewProject?: boolean;
  isDelayed?: boolean;
  originalDeadline?: string;
  simulatedDeadline?: string;
}

export interface EmployeeImpact {
  employeeId: string;
  name: string;
  role: string;
  department: string;
  baselineUtilization: number;
  simulatedUtilization: number;
  baselineStatus: 'underutilized' | 'balanced' | 'overloaded';
  simulatedStatus: 'underutilized' | 'balanced' | 'overloaded';
  isHypothetical?: boolean;
  notes: string;
  projectedSkillBoost?: { skillId: string; fromLevel: number; toLevel: number };
}

export interface SkillCoverageDelta {
  skillId: string;
  skillName: string;
  baselineStaffCount: number;
  simulatedStaffCount: number;
  baselineProjectGaps: number;
  simulatedProjectGaps: number;
  status: 'improved' | 'diminished' | 'unchanged';
}

export interface SimulationRecommendation {
  id: string;
  title: string;
  type: 'positive' | 'warning' | 'risk' | 'info';
  action: string;
  reasoning: string;
  affectedEntity: string;
}

export interface SimulationResult {
  scenario: ScenarioModel;
  baselineMetrics: BaselineMetrics;
  simulatedMetrics: SimulatedMetrics;
  metricDeltas: MetricDelta[];
  projectImpacts: ProjectImpact[];
  employeeImpacts: EmployeeImpact[];
  skillCoverageDeltas: SkillCoverageDelta[];
  recommendations: SimulationRecommendation[];
  warnings: { title: string; detail: string; severity: 'warning' | 'critical' }[];
  summaryNotes: string[];
}

