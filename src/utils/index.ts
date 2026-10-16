import type {
  AppSettings,
  CandidateRecommendation,
  Employee,
  MatchWeights,
  Project,
  ProjectRequirement,
} from '@/types';
import { skillsList } from '@/data/mockData';

export const MAX_CONCURRENT_PROJECTS = 4;
export const ESTIMATED_PROJECT_LOAD_PERCENT = 25;

export const statusColors: Record<string, string> = {
  available: 'text-success bg-green-50 border-green-200',
  busy: 'text-warning bg-orange-50 border-orange-200',
  unavailable: 'text-critical bg-red-50 border-red-200',
  active: 'text-success bg-green-50 border-green-200',
  planning: 'text-primary bg-primary-50 border-primary-200',
  'on-hold': 'text-warning bg-orange-50 border-orange-200',
  completed: 'text-text-secondary bg-gray-100 border-base-border',
  critical: 'text-critical bg-red-50 border-red-200',
  high: 'text-warning bg-orange-50 border-orange-200',
  medium: 'text-primary bg-primary-50 border-primary-200',
  low: 'text-text-secondary bg-gray-100 border-base-border',
};

export const statusLabels: Record<string, string> = {
  available: 'Available',
  busy: 'Partially Allocated',
  unavailable: 'Unavailable',
  active: 'Active',
  planning: 'Planning',
  'on-hold': 'On Hold',
  completed: 'Completed',
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function getSkillName(skillId: string): string {
  const found = skillsList.find((s) => s.id === skillId);
  if (found) return found.name;
  return skillId.replace('skl-', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getActiveAssignmentCount(employeeId: string, projects: Project[]): number {
  return projects.filter(
    (p) => p.status !== 'completed' && p.assignedEmployeeIds.includes(employeeId)
  ).length;
}

export function calculateEmployeeUtilization(
  employeeId: string,
  projects: Project[],
  targetUtilization: number = 100
): number {
  const activeCount = getActiveAssignmentCount(employeeId, projects);
  const raw = activeCount * ESTIMATED_PROJECT_LOAD_PERCENT;
  return targetUtilization > 0 ? Math.min(100, Math.round((raw / targetUtilization) * 100)) : raw;
}

export function getUtilizationStatus(
  utilization: number,
  settings?: AppSettings
): 'underutilized' | 'balanced' | 'overloaded' {
  const overloadedThreshold = settings?.overloadedThreshold ?? 90;
  const underutilizedThreshold = settings?.underutilizedThreshold ?? 50;

  if (utilization >= overloadedThreshold) return 'overloaded';
  if (utilization <= underutilizedThreshold) return 'underutilized';
  return 'balanced';
}

export function getProjectStaffingProgress(project: Project): number {
  if (!project.targetTeamSize || project.targetTeamSize === 0) return 100;
  return Math.min(100, Math.round((project.assignedEmployeeIds.length / project.targetTeamSize) * 100));
}

export function getEmployeeProjects(employeeId: string, projects: Project[]): Project[] {
  return projects.filter((p) => p.assignedEmployeeIds.includes(employeeId));
}

export interface SkillGapItem {
  projectId: string;
  projectName: string;
  skillId: string;
  missingCount: number;
  currentLevel: number;
  requiredLevel: number;
}

export function getAllSkillGaps(projects: Project[], employees: Employee[]): SkillGapItem[] {
  const gaps: SkillGapItem[] = [];

  for (const project of projects) {
    if (project.status === 'completed') continue;
    const team = employees.filter((e) => project.assignedEmployeeIds.includes(e.id));

    for (const req of project.requiredSkills) {
      const bestLevel = team.reduce((max, member) => {
        const s = member.skills.find((sk) => sk.skillId === req.skillId);
        return Math.max(max, s?.level ?? 0);
      }, 0);

      if (bestLevel < req.minLevel) {
        gaps.push({
          projectId: project.id,
          projectName: project.name,
          skillId: req.skillId,
          missingCount: 1,
          currentLevel: bestLevel,
          requiredLevel: req.minLevel,
        });
      }
    }
  }

  return gaps;
}

export interface TeamSkillCoverageItem {
  skillId: string;
  covered: boolean;
  minLevel: number;
  bestLevel: number;
  coveringEmployeeIds: string[];
}

export function getTeamSkillCoverage(
  teamEmployeeIds: string[],
  project: Project,
  employees: Employee[]
): TeamSkillCoverageItem[] {
  const team = employees.filter((e) => teamEmployeeIds.includes(e.id));

  return project.requiredSkills.map((req: ProjectRequirement) => {
    const covering: string[] = [];
    let bestLevel = 0;

    for (const member of team) {
      const skill = member.skills.find((s) => s.skillId === req.skillId);
      if (skill) {
        bestLevel = Math.max(bestLevel, skill.level);
        if (skill.level >= req.minLevel) {
          covering.push(member.id);
        }
      }
    }

    return {
      skillId: req.skillId,
      covered: bestLevel >= req.minLevel,
      minLevel: req.minLevel,
      bestLevel,
      coveringEmployeeIds: covering,
    };
  });
}

export function generateRecommendations(
  employees: Employee[],
  project: Project,
  weights: MatchWeights = { skills: 50, experience: 25, availability: 25 },
  allProjects: Project[] = [],
  settings?: AppSettings
): CandidateRecommendation[] {
  const totalWeight = (weights.skills + weights.experience + weights.availability) || 100;
  const wSkills = weights.skills / totalWeight;
  const wExp = weights.experience / totalWeight;
  const wAvail = weights.availability / totalWeight;

  return employees.map((employee) => {
    // 1. Skill evaluation
    let matchedSkillsCount = 0;
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const req of project.requiredSkills) {
      const empSkill = employee.skills.find((s) => s.skillId === req.skillId);
      if (empSkill && empSkill.level >= req.minLevel) {
        matchedSkillsCount++;
        matchedSkills.push(req.skillId);
      } else {
        missingSkills.push(req.skillId);
      }
    }

    const skillsScore = project.requiredSkills.length > 0
      ? Math.round((matchedSkillsCount / project.requiredSkills.length) * 100)
      : 80;

    // 2. Experience evaluation (max 8 years for full points)
    const expYears = employee.yearsExperience ?? employee.experienceYears ?? 4;
    const experienceScore = Math.min(100, Math.round((expYears / 8) * 100));

    // 3. Availability and capacity score
    const currentAssignments = getActiveAssignmentCount(employee.id, allProjects);
    const capacityFeasible =
      employee.availability !== 'unavailable' &&
      currentAssignments < MAX_CONCURRENT_PROJECTS;

    let availabilityScore = 100;
    if (employee.availability === 'unavailable') {
      availabilityScore = 0;
    } else if (currentAssignments >= MAX_CONCURRENT_PROJECTS) {
      availabilityScore = 15;
    } else if (currentAssignments === 3) {
      availabilityScore = 40;
    } else if (currentAssignments === 2) {
      availabilityScore = 70;
    } else if (currentAssignments === 1) {
      availabilityScore = 90;
    } else {
      availabilityScore = 100;
    }

    // Weighted match score
    const matchScore = Math.round(
      skillsScore * wSkills + experienceScore * wExp + availabilityScore * wAvail
    );

    // Explanations
    const reasons: string[] = [];
    if (matchedSkillsCount > 0) {
      reasons.push(`Matches ${matchedSkillsCount} of ${project.requiredSkills.length} required skills`);
    }
    if (expYears >= 5) {
      reasons.push(`Senior track record (${expYears} years in domain)`);
    }
    if (currentAssignments <= 1) {
      reasons.push('High remaining bandwidth for new commitments');
    }
    if (employee.department === project.department) {
      reasons.push(`Same department alignment (${employee.department})`);
    }
    if (reasons.length === 0) {
      reasons.push('Available general contributor with cross-functional potential');
    }

    // Risks
    const risks: string[] = [];
    const overloadedLimit = settings?.overloadedThreshold ?? 90;
    const estUtil = currentAssignments * ESTIMATED_PROJECT_LOAD_PERCENT;
    if (estUtil >= overloadedLimit) {
      risks.push(`Approaching capacity alert (${estUtil}% >= ${overloadedLimit}%)`);
    } else if (currentAssignments >= 3) {
      risks.push(`Approaching project limit (${currentAssignments}/${MAX_CONCURRENT_PROJECTS} concurrent projects)`);
    }
    if (missingSkills.length > 0) {
      risks.push(`Missing key skill: ${getSkillName(missingSkills[0])}`);
    }
    if (employee.availability === 'unavailable') {
      risks.push('Currently marked unavailable');
    }

    return {
      employeeId: employee.id,
      matchScore,
      skillsScore,
      experienceScore,
      availabilityScore,
      availableCapacity: Math.max(0, 100 - (currentAssignments * ESTIMATED_PROJECT_LOAD_PERCENT)),
      capacityFeasible,
      matchedSkills,
      missingSkills,
      reasons,
      risks,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

export function getSkillDistribution(
  employees: Employee[]
): { skill: string; skillId: string; count: number; avgLevel: number }[] {
  const counts: Record<string, { count: number; totalLevel: number }> = {};

  for (const emp of employees) {
    for (const sk of emp.skills) {
      if (sk.level > 0) {
        if (!counts[sk.skillId]) {
          counts[sk.skillId] = { count: 0, totalLevel: 0 };
        }
        counts[sk.skillId].count += 1;
        counts[sk.skillId].totalLevel += sk.level;
      }
    }
  }

  return Object.entries(counts)
    .map(([skillId, data]) => ({
      skillId,
      skill: getSkillName(skillId),
      count: data.count,
      avgLevel: Math.round((data.totalLevel / Math.max(1, data.count)) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getSkillDemand(projects: Project[]): { skill: string; skillId: string; count: number }[] {
  const counts: Record<string, number> = {};

  for (const proj of projects) {
    if (proj.status === 'completed') continue;
    for (const req of proj.requiredSkills) {
      counts[req.skillId] = (counts[req.skillId] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([skillId, count]) => ({
      skillId,
      skill: getSkillName(skillId),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getDepartmentStats(
  employees: Employee[],
  projects: Project[] = []
): { department: string; count: number; avgUtilization: number }[] {
  const depts = Array.from(new Set(employees.map((e) => e.department)));

  return depts.map((department) => {
    const deptEmployees = employees.filter((e) => e.department === department);
    const count = deptEmployees.length;
    const totalUtil = deptEmployees.reduce(
      (sum, e) => sum + calculateEmployeeUtilization(e.id, projects, e.targetUtilization),
      0
    );
    const avgUtilization = count > 0 ? Math.round(totalUtil / count) : 0;

    return {
      department,
      count,
      avgUtilization,
    };
  });
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

export function daysUntil(dateString: string): number {
  try {
    const target = new Date(dateString).getTime();
    const now = Date.now();
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const sanitize = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(sanitize).join(','),
    ...rows.map((row) => row.map(sanitize).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
