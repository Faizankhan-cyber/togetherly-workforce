import type {
  Employee,
  Project,
  MatchWeights,
  RecommendationResult,
  Skill,
  AppSettings,
} from '@/types';
import { skills as allSkills } from '@/data/mockData';

export const ESTIMATED_PROJECT_LOAD_PERCENT = 25;
export const MAX_CONCURRENT_PROJECTS = Math.floor(100 / ESTIMATED_PROJECT_LOAD_PERCENT);

export function getSkill(skillId: string): Skill | undefined {
  return allSkills.find((s) => s.id === skillId);
}

export function getSkillName(skillId: string): string {
  return getSkill(skillId)?.name ?? 'Unknown Skill';
}

export function getEmployeeSkillLevel(employee: Employee, skillId: string): number {
  const es = employee.skills.find((s) => s.skillId === skillId);
  return es ? es.level : 0;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function getEmployeeProjects(employeeId: string, projects: Project[]): Project[] {
  return projects.filter((p) => p.assignedEmployeeIds.includes(employeeId));
}

export function getActiveAssignmentCount(employeeId: string, projects: Project[]): number {
  return projects.filter(
    (project) =>
      project.assignedEmployeeIds.includes(employeeId) &&
      (project.status === 'active' || project.status === 'planning')
  ).length;
}

export function calculateEmployeeUtilization(
  employeeId: string,
  projects: Project[],
  targetUtilization: number
): number {
  // The imported data has project membership, not timesheets. Present this as
  // an explicit estimate: each active project consumes one quarter of capacity.
  void targetUtilization;
  const activeAssignments = getActiveAssignmentCount(employeeId, projects);
  return Math.min(activeAssignments * ESTIMATED_PROJECT_LOAD_PERCENT, 100);
}

export function getUtilizationStatus(utilization: number, settings: AppSettings): 'overloaded' | 'balanced' | 'underutilized' {
  if (utilization >= settings.overloadedThreshold) return 'overloaded';
  if (utilization <= settings.underutilizedThreshold) return 'underutilized';
  return 'balanced';
}

export function getAvailableCapacity(utilization: number): number {
  return Math.max(100 - utilization, 0);
}

export function scoreEmployeeForProject(
  employee: Employee,
  project: Project,
  weights: MatchWeights,
  projects: Project[],
  settings: AppSettings
): RecommendationResult {
  void settings;
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  let skillPoints = 0;
  let maxSkillPoints = 0;

  for (const req of project.requiredSkills) {
    maxSkillPoints += 5;
    const level = getEmployeeSkillLevel(employee, req.skillId);
    if (level >= req.minLevel) {
      skillPoints += level;
      matchedSkills.push(req.skillId);
    } else if (level > 0) {
      skillPoints += level * 0.5;
      missingSkills.push(req.skillId);
    } else {
      missingSkills.push(req.skillId);
    }
  }

  const skillScore = maxSkillPoints > 0 ? (skillPoints / maxSkillPoints) * 100 : 0;

  const experienceThreshold = 5;
  const experienceScore = Math.min((employee.yearsExperience / experienceThreshold) * 100, 100);

  const utilization = calculateEmployeeUtilization(
    employee.id,
    projects,
    employee.targetUtilization
  );
  const availableCapacity = getAvailableCapacity(utilization);
  const availabilityScore =
    employee.availability === 'available' ? availableCapacity : employee.availability === 'busy' ? availableCapacity * 0.4 : 0;
  const capacityFeasible = employee.availability !== 'unavailable' && availableCapacity >= ESTIMATED_PROJECT_LOAD_PERCENT;

  const w = weights;
  const totalWeight = w.skillMatch + w.experience + w.availability;
  const matchScore = Math.round(
    (skillScore * w.skillMatch + experienceScore * w.experience + availabilityScore * w.availability) /
      (totalWeight || 1)
  );

  const reasons: string[] = [];
  if (matchedSkills.length === project.requiredSkills.length) {
    reasons.push('Meets all required skills for this project');
  } else if (matchedSkills.length > 0) {
    reasons.push(`Matches ${matchedSkills.length} of ${project.requiredSkills.length} required skills`);
  }
  if (missingSkills.length > 0) {
    reasons.push(`Missing ${missingSkills.length} skill${missingSkills.length > 1 ? 's' : ''}: ${missingSkills.map(getSkillName).join(', ')}`);
  }
  if (employee.yearsExperience >= 5) {
    reasons.push(`${employee.yearsExperience} years of experience exceeds seniority threshold`);
  } else {
    reasons.push(`${employee.yearsExperience} years of experience`);
  }
  if (employee.availability === 'available') {
    reasons.push(`${availableCapacity}% available capacity; a new project is estimated at ${ESTIMATED_PROJECT_LOAD_PERCENT}%`);
  } else if (employee.availability === 'busy') {
    reasons.push('Currently busy — limited availability');
  } else {
    reasons.push('Unavailable for new assignments');
  }
  if (!capacityFeasible) {
    reasons.push('Not capacity-safe for another project assignment');
  }

  return {
    employeeId: employee.id,
    matchScore,
    capacityFeasible,
    matchedSkills,
    missingSkills,
    experienceRelevance: Math.round(experienceScore),
    currentUtilization: utilization,
    availableCapacity,
    reasons,
  };
}

export function generateRecommendations(
  employees: Employee[],
  project: Project,
  weights: MatchWeights,
  projects: Project[],
  settings: AppSettings
): RecommendationResult[] {
  return employees
    .map((emp) => scoreEmployeeForProject(emp, project, weights, projects, settings))
    .sort((a, b) => Number(b.capacityFeasible) - Number(a.capacityFeasible) || b.matchScore - a.matchScore);
}

export function getTeamSkillCoverage(
  teamEmployeeIds: string[],
  project: Project,
  employees: Employee[]
): { skillId: string; covered: boolean; minLevel: number; bestLevel: number }[] {
  return project.requiredSkills.map((req) => {
    let bestLevel = 0;
    for (const empId of teamEmployeeIds) {
      const emp = employees.find((e) => e.id === empId);
      if (emp) {
        const level = getEmployeeSkillLevel(emp, req.skillId);
        if (level > bestLevel) bestLevel = level;
      }
    }
    return {
      skillId: req.skillId,
      covered: bestLevel >= req.minLevel,
      minLevel: req.minLevel,
      bestLevel,
    };
  });
}

export function getProjectStaffingProgress(project: Project): number {
  if (project.targetTeamSize === 0) return 0;
  return Math.round((project.assignedEmployeeIds.length / project.targetTeamSize) * 100);
}

export function getAllSkillGaps(
  projects: Project[],
  employees: Employee[]
): { skillId: string; gapCount: number; projectName: string }[] {
  const gaps: { skillId: string; gapCount: number; projectName: string }[] = [];
  for (const project of projects) {
    if (project.status === 'completed' || project.status === 'on-hold') continue;
    const coverage = getTeamSkillCoverage(project.assignedEmployeeIds, project, employees);
    for (const c of coverage) {
      if (!c.covered) {
        gaps.push({ skillId: c.skillId, gapCount: 1, projectName: project.name });
      }
    }
  }
  return gaps;
}

export function getDepartmentStats(employees: Employee[]): { department: string; count: number }[] {
  const deptMap = new Map<string, number>();
  for (const emp of employees) {
    deptMap.set(emp.department, (deptMap.get(emp.department) || 0) + 1);
  }
  return Array.from(deptMap.entries())
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);
}

export function getSkillDistribution(employees: Employee[]): { skill: string; count: number; avgLevel: number }[] {
  const skillMap = new Map<string, { count: number; totalLevel: number }>();
  for (const emp of employees) {
    for (const es of emp.skills) {
      const existing = skillMap.get(es.skillId) || { count: 0, totalLevel: 0 };
      existing.count += 1;
      existing.totalLevel += es.level;
      skillMap.set(es.skillId, existing);
    }
  }
  return Array.from(skillMap.entries())
    .map(([skillId, data]) => ({
      skill: getSkillName(skillId),
      count: data.count,
      avgLevel: Math.round((data.totalLevel / data.count) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getSkillDemand(projects: Project[]): { skill: string; demand: number }[] {
  const demandMap = new Map<string, number>();
  for (const project of projects) {
    if (project.status === 'completed') continue;
    for (const req of project.requiredSkills) {
      demandMap.set(req.skillId, (demandMap.get(req.skillId) || 0) + 1);
    }
  }
  return Array.from(demandMap.entries())
    .map(([skillId, demand]) => ({ skill: getSkillName(skillId), demand }))
    .sort((a, b) => b.demand - a.demand);
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => {
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function uid(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const statusColors: Record<string, string> = {
  available: 'text-success bg-success/10 border-success/30',
  busy: 'text-warning bg-warning/10 border-warning/30',
  unavailable: 'text-critical bg-critical/10 border-critical/30',
  planning: 'text-cyan bg-cyan/10 border-cyan/30',
  active: 'text-success bg-success/10 border-success/30',
  'on-hold': 'text-warning bg-warning/10 border-warning/30',
  completed: 'text-text-secondary bg-base-hover border-base-border',
  low: 'text-text-secondary bg-base-hover border-base-border',
  medium: 'text-cyan bg-cyan/10 border-cyan/30',
  high: 'text-warning bg-warning/10 border-warning/30',
  critical: 'text-critical bg-critical/10 border-critical/30',
};

export const statusLabels: Record<string, string> = {
  available: 'Available',
  busy: 'Busy',
  unavailable: 'Unavailable',
  planning: 'Planning',
  active: 'Active',
  'on-hold': 'On Hold',
  completed: 'Completed',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const skillLevelLabels: Record<number, string> = {
  0: 'None',
  1: 'Beginner',
  2: 'Junior',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};
