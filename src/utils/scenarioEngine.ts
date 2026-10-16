import type {
  AppSettings,
  Employee,
  Project,
  ScenarioModel,
  SimulationResult,
  BaselineMetrics,
  MetricDelta,
  ProjectImpact,
  EmployeeImpact,
  SkillCoverageDelta,
  SimulationRecommendation,
} from '@/types';
import {
  calculateEmployeeUtilization,
  getUtilizationStatus,
  getAllSkillGaps,
  getSkillName,
} from '@/utils';

/**
 * Storage key for persisting saved scenarios in localStorage
 */
export const SCENARIO_STORAGE_KEY = 'togetherly_scenarios_v1';

/**
 * Default sample scenarios pre-seeded for realistic exploration
 */
export function getDefaultScenarios(employees: Employee[], projects: Project[]): ScenarioModel[] {
  const emp1 = employees[0]?.id || 'emp-001';
  const proj1 = projects[0]?.id || 'proj-001';
  const proj2 = projects[1]?.id || 'proj-002';
  const proj3 = projects[2]?.id || 'proj-003';

  return [
    {
      id: 'scen-realloc-01',
      name: 'Cloud Migration Resource Reallocation',
      description: 'Simulate shifting a senior engineer to the high-priority Cloud Migration initiative to eliminate architectural bottlenecks.',
      type: 'reallocation',
      createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
      config: {
        reallocation: {
          employeeId: emp1,
          sourceProjectId: proj2,
          targetProjectId: proj1,
        },
      },
    },
    {
      id: 'scen-hire-02',
      name: 'Q3 Cloud & DevOps Specialist Hire',
      description: 'Evaluate impact of hiring a Senior Platform Engineer with Kubernetes, AWS, and Terraform proficiency.',
      type: 'new-hire',
      createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
      config: {
        newHire: {
          name: 'Jordan Vance (Simulated)',
          role: 'Senior Cloud Platform Engineer',
          department: 'Engineering',
          yearsExperience: 7,
          availability: 'available',
          targetUtilization: 100,
          skills: [
            { skillId: 'skl-aws', level: 5 },
            { skillId: 'skl-kubernetes', level: 4 },
            { skillId: 'skl-docker', level: 5 },
            { skillId: 'skl-terraform', level: 4 },
            { skillId: 'skl-linux', level: 4 },
          ],
          assignedProjectIds: [proj1],
        },
      },
    },
    {
      id: 'scen-delay-03',
      name: 'Analytics Platform 6-Week Timeline Delay',
      description: 'Model resource locking and schedule contention if the core Analytics engine deadline is postponed.',
      type: 'project-delay',
      createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 1).toISOString(),
      updatedAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      config: {
        projectDelay: {
          projectId: proj3,
          delayWeeks: 6,
          notes: 'Upstream vendor API refactoring requires extended QA verification period.',
          resourceContentionWindowWeeks: 4,
        },
      },
    },
    {
      id: 'scen-train-04',
      name: 'Security & AppSec Cross-Skilling Initiative',
      description: 'Upskill an existing engineer to Application Security Level 4 to reduce external contractor dependency.',
      type: 'training',
      createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
      updatedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      config: {
        training: {
          employeeId: employees[1]?.id || 'emp-002',
          skillId: 'skl-security',
          currentLevel: 1,
          targetLevel: 4,
          durationWeeks: 8,
          provider: 'SANS Application Security Bootcamp',
        },
      },
    },
  ];
}

/**
 * Calculates high-level workforce metrics for baseline or simulated state
 */
export function calculateWorkforceMetrics(
  employees: Employee[],
  projects: Project[],
  settings?: AppSettings
): BaselineMetrics {
  const activeProjects = projects.filter((p) => p.status !== 'completed');
  const totalHeadcount = employees.length;

  let totalUtil = 0;
  let overloadedCount = 0;
  let underutilizedCount = 0;
  let balancedCount = 0;

  for (const emp of employees) {
    const util = calculateEmployeeUtilization(emp.id, projects, emp.targetUtilization);
    totalUtil += util;
    const status = getUtilizationStatus(util, settings);
    if (status === 'overloaded') overloadedCount++;
    else if (status === 'underutilized') underutilizedCount++;
    else balancedCount++;
  }

  const averageUtilization = totalHeadcount > 0 ? Math.round(totalUtil / totalHeadcount) : 0;

  let staffedProjectsCount = 0;
  let understaffedProjectsCount = 0;

  for (const p of activeProjects) {
    if (p.assignedEmployeeIds.length >= p.targetTeamSize) {
      staffedProjectsCount++;
    } else {
      understaffedProjectsCount++;
    }
  }

  const skillGaps = getAllSkillGaps(projects, employees);
  const totalSkillGaps = skillGaps.length;

  return {
    totalHeadcount,
    averageUtilization,
    overloadedCount,
    underutilizedCount,
    balancedCount,
    totalActiveProjects: activeProjects.length,
    staffedProjectsCount,
    understaffedProjectsCount,
    totalSkillGaps,
  };
}

/**
 * Main calculation engine comparing baseline vs simulated state
 */
export function runScenarioSimulation(
  scenario: ScenarioModel,
  baseEmployees: Employee[],
  baseProjects: Project[],
  settings?: AppSettings
): SimulationResult {
  // 1. Compute baseline state
  const baselineMetrics = calculateWorkforceMetrics(baseEmployees, baseProjects, settings);
  const baselineGaps = getAllSkillGaps(baseProjects, baseEmployees);

  // 2. Deep clone state for simulation
  const simulatedEmployees: Employee[] = JSON.parse(JSON.stringify(baseEmployees));
  const simulatedProjects: Project[] = JSON.parse(JSON.stringify(baseProjects));

  const warnings: { title: string; detail: string; severity: 'warning' | 'critical' }[] = [];
  const recommendations: SimulationRecommendation[] = [];
  const summaryNotes: string[] = [];
  const affectedEmployeeIds = new Set<string>();
  const affectedProjectIds = new Set<string>();

  // 3. Apply scenario modifications
  switch (scenario.type) {
    case 'reallocation': {
      const config = scenario.config.reallocation;
      if (config && config.employeeId) {
        affectedEmployeeIds.add(config.employeeId);
        if (config.sourceProjectId) affectedProjectIds.add(config.sourceProjectId);
        if (config.targetProjectId) affectedProjectIds.add(config.targetProjectId);

        const emp = simulatedEmployees.find((e) => e.id === config.employeeId);
        const srcProj = simulatedProjects.find((p) => p.id === config.sourceProjectId);
        const tgtProj = simulatedProjects.find((p) => p.id === config.targetProjectId);

        // Remove from source if assigned
        if (srcProj && config.sourceProjectId !== config.targetProjectId) {
          srcProj.assignedEmployeeIds = srcProj.assignedEmployeeIds.filter((id) => id !== config.employeeId);
        }

        // Add to target if not already assigned
        if (tgtProj && !tgtProj.assignedEmployeeIds.includes(config.employeeId)) {
          tgtProj.assignedEmployeeIds.push(config.employeeId);
        }

        summaryNotes.push(
          `Simulated moving ${emp?.name || 'employee'} from "${srcProj?.name || 'unassigned'}" to "${tgtProj?.name || 'target project'}".`
        );

        // Rule-based validations
        if (srcProj && srcProj.assignedEmployeeIds.length < srcProj.targetTeamSize) {
          warnings.push({
            title: `Source Project Understaffed: ${srcProj.name}`,
            detail: `Team drops to ${srcProj.assignedEmployeeIds.length}/${srcProj.targetTeamSize} members (${Math.round((srcProj.assignedEmployeeIds.length / srcProj.targetTeamSize) * 100)}% staffed).`,
            severity: 'warning',
          });
          recommendations.push({
            id: 'rec-realloc-src-backfill',
            title: `Backfill ${srcProj.name}`,
            type: 'warning',
            action: `Identify an available contributor to replace ${emp?.name || 'reallocated engineer'} in ${srcProj.name}.`,
            reasoning: 'Preventing delivery slowdown on existing commitments requires maintaining minimum staffing headcount.',
            affectedEntity: srcProj.name,
          });
        }

        if (emp) {
          const newUtil = calculateEmployeeUtilization(emp.id, simulatedProjects, emp.targetUtilization);
          if (newUtil >= (settings?.overloadedThreshold ?? 90)) {
            warnings.push({
              title: `Employee Over-allocation Alert: ${emp.name}`,
              detail: `Simulated utilization reaches ${newUtil}%, exceeding the ${settings?.overloadedThreshold ?? 90}% threshold.`,
              severity: 'critical',
            });
            recommendations.push({
              id: 'rec-realloc-overload',
              title: `Rebalance ${emp.name}'s Assignments`,
              type: 'risk',
              action: `Review concurrent project load before finalizing the move.`,
              reasoning: `Employee is committed to multiple parallel deliverables, presenting burnout and delivery risk.`,
              affectedEntity: emp.name,
            });
          }
        }
      }
      break;
    }

    case 'new-hire': {
      const config = scenario.config.newHire;
      if (config) {
        const simulatedId = `sim-hire-${Date.now()}`;
        const newHireEmployee: Employee = {
          id: simulatedId,
          name: `${config.name} (Simulated)`,
          role: config.role,
          department: config.department,
          email: `${config.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@simulated.togetherly.io`,
          avatarColor: '#0078D4',
          availability: config.availability,
          yearsExperience: config.yearsExperience,
          targetUtilization: config.targetUtilization || 100,
          skills: config.skills,
          trainingAssignments: [],
        };

        simulatedEmployees.push(newHireEmployee);
        affectedEmployeeIds.add(simulatedId);

        // Assign to specified projects
        if (config.assignedProjectIds && config.assignedProjectIds.length > 0) {
          for (const pid of config.assignedProjectIds) {
            affectedProjectIds.add(pid);
            const proj = simulatedProjects.find((p) => p.id === pid);
            if (proj && !proj.assignedEmployeeIds.includes(simulatedId)) {
              proj.assignedEmployeeIds.push(simulatedId);
            }
          }
        }

        summaryNotes.push(
          `Simulated hypothetical hire: "${config.name}" (${config.role}, ${config.department}) with ${config.skills.length} skills.`
        );

        // Check which projects benefit from this hire's skills
        const candidateGaps = baseProjects.flatMap((p) => {
          return p.requiredSkills.filter((req) => {
            const hasSkill = config.skills.some((s) => s.skillId === req.skillId && s.level >= req.minLevel);
            return hasSkill;
          }).map((req) => ({ projectId: p.id, projectName: p.name, skillId: req.skillId }));
        });

        if (candidateGaps.length > 0) {
          recommendations.push({
            id: 'rec-hire-match',
            title: `High Skill Alignment with Active Projects`,
            type: 'positive',
            action: `Assign new hire to projects with matching requirements.`,
            reasoning: `Hypothetical hire directly possesses capabilities required by ${Array.from(new Set(candidateGaps.map((g) => g.projectName))).join(', ')}.`,
            affectedEntity: config.name,
          });
        }
      }
      break;
    }

    case 'project-delay': {
      const config = scenario.config.projectDelay;
      if (config && config.projectId) {
        affectedProjectIds.add(config.projectId);
        const targetProj = simulatedProjects.find((p) => p.id === config.projectId);

        if (targetProj) {
          // Push deadline
          const origDate = new Date(targetProj.deadline);
          const newDate = new Date(origDate.getTime() + config.delayWeeks * 7 * 24 * 3600 * 1000);
          targetProj.deadline = newDate.toISOString().split('T')[0];

          summaryNotes.push(
            `Extended project "${targetProj.name}" by ${config.delayWeeks} weeks (New simulated deadline: ${targetProj.deadline}).`
          );

          // Identify overlapping commitments for assigned employees
          for (const empId of targetProj.assignedEmployeeIds) {
            affectedEmployeeIds.add(empId);
            const otherActive = simulatedProjects.filter(
              (p) => p.id !== targetProj.id && p.status !== 'completed' && p.assignedEmployeeIds.includes(empId)
            );

            if (otherActive.length > 0) {
              const emp = simulatedEmployees.find((e) => e.id === empId);
              warnings.push({
                title: `Staffing Contention: ${emp?.name || 'Team member'}`,
                detail: `Employee remains locked in "${targetProj.name}" for +${config.delayWeeks} weeks while also committed to ${otherActive.map((p) => p.name).join(', ')}.`,
                severity: 'warning',
              });
            }
          }

          recommendations.push({
            id: 'rec-delay-stagger',
            title: `Re-evaluate Downstream Milestone Dependencies`,
            type: 'info',
            action: `Stagger subsequent project kick-offs or adjust sprint allocations.`,
            reasoning: `Delayed completion retains key talent longer than originally planned, constraining upcoming initiative throughput.`,
            affectedEntity: targetProj.name,
          });
        }
      }
      break;
    }

    case 'training': {
      const config = scenario.config.training;
      if (config && config.employeeId) {
        affectedEmployeeIds.add(config.employeeId);
        const emp = simulatedEmployees.find((e) => e.id === config.employeeId);

        if (emp) {
          const existingSkill = emp.skills.find((s) => s.skillId === config.skillId);
          if (existingSkill) {
            existingSkill.level = config.targetLevel;
          } else {
            emp.skills.push({ skillId: config.skillId, level: config.targetLevel });
          }

          summaryNotes.push(
            `Simulated skill elevation for ${emp.name}: ${getSkillName(config.skillId)} boosted to Level ${config.targetLevel} (Est. ${config.durationWeeks} weeks).`
          );

          // Check if this closes gaps in any assigned or active projects
          const activeWithGaps = simulatedProjects.filter(
            (p) => p.status !== 'completed' && p.requiredSkills.some((r) => r.skillId === config.skillId)
          );

          for (const p of activeWithGaps) {
            affectedProjectIds.add(p.id);
          }

          recommendations.push({
            id: 'rec-train-close-gap',
            title: `Strategic Skill Readiness`,
            type: 'positive',
            action: `Verify course syllabus aligns with project requirements.`,
            reasoning: `Completing training will increase internal capability in ${getSkillName(config.skillId)}, reducing reliance on external contracting.`,
            affectedEntity: emp.name,
          });
        }
      }
      break;
    }

    case 'new-project': {
      const config = scenario.config.newProject;
      if (config) {
        const simulatedProjectId = `sim-proj-${Date.now()}`;
        const newProj: Project = {
          id: simulatedProjectId,
          name: `${config.name} (Simulated)`,
          description: config.description || 'Hypothetical project scenario',
          department: config.department,
          status: 'planning',
          targetTeamSize: config.targetTeamSize,
          assignedEmployeeIds: config.selectedEmployeeIds || [],
          requiredSkills: config.requiredSkills,
          startDate: new Date().toISOString().split('T')[0],
          deadline: new Date(Date.now() + config.durationMonths * 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
          priority: config.priority,
        };

        simulatedProjects.push(newProj);
        affectedProjectIds.add(simulatedProjectId);

        for (const empId of newProj.assignedEmployeeIds) {
          affectedEmployeeIds.add(empId);
        }

        summaryNotes.push(
          `Simulated hypothetical project: "${config.name}" (Target size: ${config.targetTeamSize}, Duration: ${config.durationMonths} months).`
        );

        if (newProj.assignedEmployeeIds.length < newProj.targetTeamSize) {
          warnings.push({
            title: `Project Understaffed at Inception`,
            detail: `Requires ${newProj.targetTeamSize} contributors, but only ${newProj.assignedEmployeeIds.length} currently assigned.`,
            severity: 'warning',
          });
          recommendations.push({
            id: 'rec-new-proj-staffing',
            title: `Review Candidate Matches for ${newProj.name}`,
            type: 'warning',
            action: `Review recommended team members with available capacity in Team Builder.`,
            reasoning: `Project has unfilled positions that will delay milestone kick-off.`,
            affectedEntity: newProj.name,
          });
        }
      }
      break;
    }

    case 'capacity-reduction': {
      const config = scenario.config.capacityReduction;
      if (config) {
        const pct = Math.min(60, Math.max(5, config.reductionPercent));
        const dept = config.department || 'all';

        summaryNotes.push(
          `Simulated ${pct}% capacity reduction (${config.strategy.replace('_', ' ')}) across ${dept === 'all' ? 'all departments' : dept + ' department'}.`
        );

        // Identify candidates for simulated capacity loss
        const eligibleEmployees = simulatedEmployees.filter((e) => dept === 'all' || e.department === dept);
        const countToRemove = Math.max(1, Math.round((eligibleEmployees.length * pct) / 100));

        // Sort by employee utilization & active assignments to model realistic attrition/cut impact
        const targetVictims = [...eligibleEmployees]
          .sort((a, b) => b.yearsExperience - a.yearsExperience)
          .slice(0, countToRemove);

        for (const victim of targetVictims) {
          affectedEmployeeIds.add(victim.id);
          victim.availability = 'unavailable';

          // Remove from projects
          for (const proj of simulatedProjects) {
            if (proj.assignedEmployeeIds.includes(victim.id)) {
              affectedProjectIds.add(proj.id);
              proj.assignedEmployeeIds = proj.assignedEmployeeIds.filter((id) => id !== victim.id);
            }
          }
        }

        warnings.push({
          title: `Severe Workforce Contraction Impact`,
          detail: `Simulated loss of ${countToRemove} staff members leaves ${affectedProjectIds.size} projects with reduced staffing and potential skill voids.`,
          severity: 'critical',
        });

        recommendations.push({
          id: 'rec-capacity-vuln',
          title: `Prioritize High-Value Core Projects`,
          type: 'risk',
          action: `Consolidate remaining talent into critical initiatives and pause low-priority work streams.`,
          reasoning: `Under a ${pct}% capacity restriction, attempting to staff all active projects results in systemic under-delivery.`,
          affectedEntity: 'Workforce Strategy',
        });
      }
      break;
    }
  }

  // 4. Compute simulated metrics
  const simulatedMetrics = calculateWorkforceMetrics(simulatedEmployees, simulatedProjects, settings);
  const simulatedGaps = getAllSkillGaps(simulatedProjects, simulatedEmployees);

  // 5. Compute metric deltas
  const metricDeltas: MetricDelta[] = [
    {
      key: 'totalHeadcount',
      label: 'Workforce Headcount',
      baseline: baselineMetrics.totalHeadcount,
      simulated: simulatedMetrics.totalHeadcount,
      delta: simulatedMetrics.totalHeadcount - baselineMetrics.totalHeadcount,
      status:
        simulatedMetrics.totalHeadcount > baselineMetrics.totalHeadcount
          ? 'improvement'
          : simulatedMetrics.totalHeadcount < baselineMetrics.totalHeadcount
            ? 'risk'
            : 'neutral',
      explanation:
        simulatedMetrics.totalHeadcount > baselineMetrics.totalHeadcount
          ? 'Headcount increased via simulated hire.'
          : simulatedMetrics.totalHeadcount < baselineMetrics.totalHeadcount
            ? 'Headcount decreased under capacity restriction.'
            : 'Total headcount remains unchanged.',
    },
    {
      key: 'averageUtilization',
      label: 'Avg. Workforce Utilization',
      baseline: baselineMetrics.averageUtilization,
      simulated: simulatedMetrics.averageUtilization,
      delta: simulatedMetrics.averageUtilization - baselineMetrics.averageUtilization,
      unit: '%',
      status:
        simulatedMetrics.averageUtilization > 85
          ? 'warning'
          : simulatedMetrics.averageUtilization < 50
            ? 'warning'
            : 'neutral',
      explanation: `Workforce operates at ${simulatedMetrics.averageUtilization}% average capacity in simulated state.`,
    },
    {
      key: 'overloadedCount',
      label: 'Overloaded Employees',
      baseline: baselineMetrics.overloadedCount,
      simulated: simulatedMetrics.overloadedCount,
      delta: simulatedMetrics.overloadedCount - baselineMetrics.overloadedCount,
      status:
        simulatedMetrics.overloadedCount < baselineMetrics.overloadedCount
          ? 'improvement'
          : simulatedMetrics.overloadedCount > baselineMetrics.overloadedCount
            ? 'risk'
            : 'neutral',
      explanation:
        simulatedMetrics.overloadedCount > baselineMetrics.overloadedCount
          ? `+${simulatedMetrics.overloadedCount - baselineMetrics.overloadedCount} employee(s) push into the overloaded zone.`
          : simulatedMetrics.overloadedCount < baselineMetrics.overloadedCount
            ? `Reduced over-allocation by ${baselineMetrics.overloadedCount - simulatedMetrics.overloadedCount} person(s).`
            : 'No change in overloaded headcount.',
    },
    {
      key: 'totalSkillGaps',
      label: 'Unresolved Skill Gaps',
      baseline: baselineMetrics.totalSkillGaps,
      simulated: simulatedMetrics.totalSkillGaps,
      delta: simulatedMetrics.totalSkillGaps - baselineMetrics.totalSkillGaps,
      status:
        simulatedMetrics.totalSkillGaps < baselineMetrics.totalSkillGaps
          ? 'improvement'
          : simulatedMetrics.totalSkillGaps > baselineMetrics.totalSkillGaps
            ? 'risk'
            : 'neutral',
      explanation:
        simulatedMetrics.totalSkillGaps < baselineMetrics.totalSkillGaps
          ? `Closed ${baselineMetrics.totalSkillGaps - simulatedMetrics.totalSkillGaps} project skill deficiency(ies).`
          : simulatedMetrics.totalSkillGaps > baselineMetrics.totalSkillGaps
            ? `Created ${simulatedMetrics.totalSkillGaps - baselineMetrics.totalSkillGaps} new skill gap(s).`
            : 'Skill gap profile unchanged.',
    },
    {
      key: 'understaffedProjectsCount',
      label: 'Understaffed Projects',
      baseline: baselineMetrics.understaffedProjectsCount,
      simulated: simulatedMetrics.understaffedProjectsCount,
      delta: simulatedMetrics.understaffedProjectsCount - baselineMetrics.understaffedProjectsCount,
      status:
        simulatedMetrics.understaffedProjectsCount < baselineMetrics.understaffedProjectsCount
          ? 'improvement'
          : simulatedMetrics.understaffedProjectsCount > baselineMetrics.understaffedProjectsCount
            ? 'risk'
            : 'neutral',
      explanation:
        simulatedMetrics.understaffedProjectsCount < baselineMetrics.understaffedProjectsCount
          ? `Fulfilled minimum headcount for ${baselineMetrics.understaffedProjectsCount - simulatedMetrics.understaffedProjectsCount} project(s).`
          : simulatedMetrics.understaffedProjectsCount > baselineMetrics.understaffedProjectsCount
            ? `${simulatedMetrics.understaffedProjectsCount - baselineMetrics.understaffedProjectsCount} additional project(s) fallen below target staffing.`
            : 'Project staffing levels unchanged.',
    },
  ];

  // 6. Compute Project Impacts
  const projectImpacts: ProjectImpact[] = simulatedProjects.map((simProj) => {
    const baseProj = baseProjects.find((p) => p.id === simProj.id);
    const baselineTeamSize = baseProj ? baseProj.assignedEmployeeIds.length : 0;
    const simulatedTeamSize = simProj.assignedEmployeeIds.length;

    const baseGapsForProj = baselineGaps.filter((g) => g.projectId === simProj.id).length;
    const simGapsForProj = simulatedGaps.filter((g) => g.projectId === simProj.id).length;
    const gapDelta = simGapsForProj - baseGapsForProj;

    const riskReasons: string[] = [];
    if (simulatedTeamSize < simProj.targetTeamSize) {
      riskReasons.push(`Understaffed: ${simulatedTeamSize}/${simProj.targetTeamSize} members`);
    }
    if (simGapsForProj > 0) {
      riskReasons.push(`${simGapsForProj} missing or under-leveled skill requirement(s)`);
    }

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (simulatedTeamSize === 0 || simGapsForProj >= 2) {
      riskLevel = 'high';
    } else if (simulatedTeamSize < simProj.targetTeamSize || simGapsForProj === 1) {
      riskLevel = 'medium';
    }

    return {
      projectId: simProj.id,
      projectName: simProj.name,
      department: simProj.department,
      status: simProj.status,
      baselineTeamSize,
      simulatedTeamSize,
      targetTeamSize: simProj.targetTeamSize,
      baselineGaps: baseGapsForProj,
      simulatedGaps: simGapsForProj,
      gapDelta,
      riskLevel,
      riskReasons,
      isSimulatedNewProject: !baseProj,
      isDelayed: scenario.type === 'project-delay' && scenario.config.projectDelay?.projectId === simProj.id,
      originalDeadline: baseProj?.deadline,
      simulatedDeadline: simProj.deadline,
    };
  });

  // 7. Compute Employee Impacts
  const employeeImpacts: EmployeeImpact[] = simulatedEmployees
    .filter((simEmp) => {
      // Include if explicitly affected or if utilization changed
      if (affectedEmployeeIds.has(simEmp.id)) return true;
      const baseEmp = baseEmployees.find((e) => e.id === simEmp.id);
      if (!baseEmp) return true;
      const baseU = calculateEmployeeUtilization(baseEmp.id, baseProjects, baseEmp.targetUtilization);
      const simU = calculateEmployeeUtilization(simEmp.id, simulatedProjects, simEmp.targetUtilization);
      return baseU !== simU;
    })
    .map((simEmp) => {
      const baseEmp = baseEmployees.find((e) => e.id === simEmp.id);
      const baselineUtilization = baseEmp
        ? calculateEmployeeUtilization(baseEmp.id, baseProjects, baseEmp.targetUtilization)
        : 0;
      const simulatedUtilization = calculateEmployeeUtilization(
        simEmp.id,
        simulatedProjects,
        simEmp.targetUtilization
      );

      const baselineStatus = getUtilizationStatus(baselineUtilization, settings);
      const simulatedStatus = getUtilizationStatus(simulatedUtilization, settings);

      let notes = 'Unchanged';
      if (!baseEmp) {
        notes = 'Hypothetical new hire record';
      } else if (simulatedUtilization > baselineUtilization) {
        notes = `Increased commitment (+${simulatedUtilization - baselineUtilization}%)`;
      } else if (simulatedUtilization < baselineUtilization) {
        notes = `Reduced commitment (${simulatedUtilization - baselineUtilization}%)`;
      }

      let projectedSkillBoost: { skillId: string; fromLevel: number; toLevel: number } | undefined;
      if (scenario.type === 'training' && scenario.config.training?.employeeId === simEmp.id) {
        const trainConf = scenario.config.training;
        const oldL = baseEmp?.skills.find((s) => s.skillId === trainConf.skillId)?.level ?? 0;
        projectedSkillBoost = {
          skillId: trainConf.skillId,
          fromLevel: oldL,
          toLevel: trainConf.targetLevel,
        };
      }

      return {
        employeeId: simEmp.id,
        name: simEmp.name,
        role: simEmp.role,
        department: simEmp.department,
        baselineUtilization,
        simulatedUtilization,
        baselineStatus,
        simulatedStatus,
        isHypothetical: !baseEmp,
        notes,
        projectedSkillBoost,
      };
    });

  // 8. Compute Skill Coverage Deltas
  const uniqueSkillIds = Array.from(
    new Set([
      ...baseProjects.flatMap((p) => p.requiredSkills.map((r) => r.skillId)),
      ...simulatedProjects.flatMap((p) => p.requiredSkills.map((r) => r.skillId)),
    ])
  );

  const skillCoverageDeltas: SkillCoverageDelta[] = uniqueSkillIds
    .map((skillId) => {
      const baselineStaffCount = baseEmployees.filter((e) =>
        e.skills.some((s) => s.skillId === skillId && s.level >= 2)
      ).length;
      const simulatedStaffCount = simulatedEmployees.filter((e) =>
        e.skills.some((s) => s.skillId === skillId && s.level >= 2)
      ).length;

      const baselineProjectGaps = baselineGaps.filter((g) => g.skillId === skillId).length;
      const simulatedProjectGaps = simulatedGaps.filter((g) => g.skillId === skillId).length;

      let status: 'improved' | 'diminished' | 'unchanged' = 'unchanged';
      if (simulatedProjectGaps < baselineProjectGaps || simulatedStaffCount > baselineStaffCount) {
        status = 'improved';
      } else if (simulatedProjectGaps > baselineProjectGaps || simulatedStaffCount < baselineStaffCount) {
        status = 'diminished';
      }

      return {
        skillId,
        skillName: getSkillName(skillId),
        baselineStaffCount,
        simulatedStaffCount,
        baselineProjectGaps,
        simulatedProjectGaps,
        status,
      };
    })
    .sort((a, b) => {
      if (a.status === 'diminished') return -1;
      if (b.status === 'diminished') return 1;
      if (a.status === 'improved') return -1;
      if (b.status === 'improved') return 1;
      return 0;
    });

  return {
    scenario,
    baselineMetrics,
    simulatedMetrics,
    metricDeltas,
    projectImpacts,
    employeeImpacts,
    skillCoverageDeltas,
    recommendations,
    warnings,
    summaryNotes,
  };
}
