import { useState, useEffect, useMemo } from 'react';
import {
  GitFork,
  Download,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Reveal } from '@/components/Reveal';
import { useData } from '@/context/DataContext';
import type { ScenarioModel, ScenarioType } from '@/types';
import {
  SCENARIO_STORAGE_KEY,
  getDefaultScenarios,
  runScenarioSimulation,
} from '@/utils/scenarioEngine';
import { ScenarioSelector } from '@/components/scenario/ScenarioSelector';
import { ScenarioConfigForms } from '@/components/scenario/ScenarioConfigForms';
import { ScenarioComparisonView } from '@/components/scenario/ScenarioComparisonView';
import { ScenarioRecommendations } from '@/components/scenario/ScenarioRecommendations';
import { exportToCsv } from '@/utils';

export function ScenarioSimulatorPage() {
  const { employees, projects, settings, showToast } = useData();

  // Load scenarios from localStorage or default seed
  const [scenarios, setScenarios] = useState<ScenarioModel[]>(() => {
    try {
      const stored = localStorage.getItem(SCENARIO_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return getDefaultScenarios(employees, projects);
  });

  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => {
    return scenarios[0]?.id || 'scen-realloc-01';
  });

  // Dialog state for deletion confirmation
  const [scenarioToDelete, setScenarioToDelete] = useState<string | null>(null);

  // Sync scenarios to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenarios));
    } catch (e) {
      console.warn('Failed to save scenarios to localStorage:', e);
    }
  }, [scenarios]);

  // Current active scenario object
  const activeScenario = useMemo(() => {
    const found = scenarios.find((s) => s.id === activeScenarioId);
    return found || scenarios[0];
  }, [scenarios, activeScenarioId]);

  // Run simulation engine calculations
  const simulationResult = useMemo(() => {
    if (!activeScenario) {
      return runScenarioSimulation(
        getDefaultScenarios(employees, projects)[0],
        employees,
        projects,
        settings
      );
    }
    return runScenarioSimulation(activeScenario, employees, projects, settings);
  }, [activeScenario, employees, projects, settings]);

  // Handler: Select Scenario
  function handleSelectScenario(id: string) {
    setActiveScenarioId(id);
  }

  // Handler: Create Scenario
  function handleCreateScenario(type: ScenarioType, name: string) {
    const newId = `scen-${type}-${Date.now()}`;
    let config: ScenarioModel['config'] = {};

    switch (type) {
      case 'reallocation':
        config = {
          reallocation: {
            employeeId: employees[0]?.id || '',
            sourceProjectId: projects[0]?.id || '',
            targetProjectId: projects[1]?.id || '',
          },
        };
        break;
      case 'new-hire':
        config = {
          newHire: {
            name: 'New Engineer (Simulated)',
            role: 'Senior Software Engineer',
            department: 'Engineering',
            yearsExperience: 5,
            availability: 'available',
            targetUtilization: 100,
            skills: [
              { skillId: 'skl-react', level: 4 },
              { skillId: 'skl-typescript', level: 4 },
            ],
            assignedProjectIds: [projects[0]?.id || ''],
          },
        };
        break;
      case 'project-delay':
        config = {
          projectDelay: {
            projectId: projects[0]?.id || '',
            delayWeeks: 4,
            notes: 'Scope expansion and technical debt refactoring.',
            resourceContentionWindowWeeks: 4,
          },
        };
        break;
      case 'training':
        config = {
          training: {
            employeeId: employees[0]?.id || '',
            skillId: 'skl-aws',
            currentLevel: 1,
            targetLevel: 4,
            durationWeeks: 6,
            provider: 'Cloud Native Practitioner Program',
          },
        };
        break;
      case 'new-project':
        config = {
          newProject: {
            name: 'Hypothetical Initiative',
            description: 'New product line discovery and prototype development.',
            department: 'Engineering',
            targetTeamSize: 3,
            durationMonths: 6,
            priority: 'high',
            requiredSkills: [
              { skillId: 'skl-react', minLevel: 3 },
              { skillId: 'skl-node', minLevel: 3 },
            ],
            selectedEmployeeIds: [],
          },
        };
        break;
      case 'capacity-reduction':
        config = {
          capacityReduction: {
            reductionPercent: 15,
            department: 'all',
            strategy: 'attrition',
          },
        };
        break;
    }

    const newScenario: ScenarioModel = {
      id: newId,
      name,
      description: `Custom ${type.replace('-', ' ')} simulation scenario.`,
      type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config,
    };

    setScenarios((prev) => [newScenario, ...prev]);
    setActiveScenarioId(newId);
    showToast('success', `Created scenario "${name}".`);
  }

  // Handler: Update scenario config
  function handleUpdateScenario(updated: ScenarioModel) {
    const withTimestamp = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    setScenarios((prev) => prev.map((s) => (s.id === updated.id ? withTimestamp : s)));
  }

  // Handler: Save Scenario
  function handleSaveScenario() {
    showToast('success', `Saved scenario "${activeScenario?.name}".`);
  }

  // Handler: Duplicate Scenario
  function handleDuplicateScenario(id: string) {
    const target = scenarios.find((s) => s.id === id);
    if (!target) return;

    const dupId = `scen-${target.type}-${Date.now()}`;
    const duplicate: ScenarioModel = {
      ...JSON.parse(JSON.stringify(target)),
      id: dupId,
      name: `${target.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setScenarios((prev) => [duplicate, ...prev]);
    setActiveScenarioId(dupId);
    showToast('success', `Duplicated scenario as "${duplicate.name}".`);
  }

  // Handler: Reset Scenario to defaults
  function handleResetScenario(id?: string) {
    const targetId = id || activeScenarioId;
    const defaults = getDefaultScenarios(employees, projects);
    const defaultMatch = defaults.find((d) => d.id === targetId) || defaults[0];

    setScenarios((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? {
              ...s,
              config: JSON.parse(JSON.stringify(defaultMatch.config)),
              updatedAt: new Date().toISOString(),
            }
          : s
      )
    );
    showToast('info', 'Scenario parameters reset to initial baseline values.');
  }

  // Handler: Confirm delete
  function confirmDeleteScenario() {
    if (!scenarioToDelete) return;
    const toDelete = scenarios.find((s) => s.id === scenarioToDelete);
    const remaining = scenarios.filter((s) => s.id !== scenarioToDelete);

    setScenarios(remaining);
    if (activeScenarioId === scenarioToDelete && remaining[0]) {
      setActiveScenarioId(remaining[0].id);
    }
    setScenarioToDelete(null);
    showToast('info', `Scenario "${toDelete?.name || ''}" removed.`);
  }

  // Handler: Export CSV Report
  function handleExportCsv() {
    if (!simulationResult) return;

    const headers = [
      'Project Name',
      'Department',
      'Status',
      'Baseline Team',
      'Simulated Team',
      'Target Team',
      'Baseline Gaps',
      'Simulated Gaps',
      'Risk Level',
    ];

    const rows = simulationResult.projectImpacts.map((p) => [
      p.projectName,
      p.department,
      p.status,
      p.baselineTeamSize,
      p.simulatedTeamSize,
      p.targetTeamSize,
      p.baselineGaps,
      p.simulatedGaps,
      p.riskLevel,
    ]);

    exportToCsv(`Togetherly_Scenario_${activeScenario?.name.replace(/\s+/g, '_')}.csv`, headers, rows);
    showToast('success', 'Scenario impact report exported as CSV.');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="What-If Workforce Scenario Simulator"
        description="Hypothetically simulate staffing reallocations, new hires, project delays, training, and capacity restrictions with instant before-and-after impact analytics."
        breadcrumb={['Home', 'Scenario Simulator']}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={handleExportCsv} className="btn-secondary text-xs">
              <Download size={14} /> Export Report (CSV)
            </button>

            {/* Safety Disabled Apply Button */}
            <div className="relative group">
              <button
                disabled
                className="btn-primary text-xs opacity-50 cursor-not-allowed bg-base-border text-text-secondary border-base-border"
                title="Simulation Sandbox Protection"
              >
                Apply Plan (Coming later)
              </button>
              <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-64 p-2 bg-text-primary text-white text-[10px] rounded-lg shadow-lg z-50 leading-relaxed pointer-events-none">
                <strong>Sandbox Mode:</strong> Real workforce and project records are strictly protected. Production execution of simulation plans will be enabled in a future release.
              </div>
            </div>
          </div>
        }
      />

      {/* Safety Sandbox Notice Banner */}
      <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-3.5 flex items-start sm:items-center justify-between gap-3 text-xs text-sky-950">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <GitFork size={15} />
          </div>
          <div>
            <span className="font-bold">Isolated Simulation Environment</span>
            <span className="hidden sm:inline text-sky-800 ml-1.5">
              All scenarios execute in-memory against a transient digital twin. Original staff directories and project commitments remain untouched.
            </span>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-white text-sky-700 font-mono font-bold text-[10px] border border-sky-300 flex-shrink-0">
          Zero Data Mutation
        </span>
      </div>

      {/* 1. Saved Scenarios List / Selector */}
      <Reveal delay={0}>
        <ScenarioSelector
          scenarios={scenarios}
          activeScenarioId={activeScenario?.id || ''}
          onSelectScenario={handleSelectScenario}
          onCreateScenario={handleCreateScenario}
          onDuplicateScenario={handleDuplicateScenario}
          onDeleteScenario={(id) => setScenarioToDelete(id)}
          onResetScenario={(id) => handleResetScenario(id)}
        />
      </Reveal>

      {/* 2. Interactive Scenario Configuration Form */}
      {activeScenario && (
        <Reveal delay={60}>
          <ScenarioConfigForms
            scenario={activeScenario}
            employees={employees}
            projects={projects}
            onUpdateScenario={handleUpdateScenario}
            onSaveScenario={handleSaveScenario}
            onResetScenario={() => handleResetScenario(activeScenario.id)}
          />
        </Reveal>
      )}

      {/* 3. Before vs After Side-by-Side Comparison & Charts */}
      {simulationResult && (
        <Reveal delay={120}>
          <ScenarioComparisonView simulation={simulationResult} />
        </Reveal>
      )}

      {/* 4. Rule-based Recommendations */}
      {simulationResult && (
        <Reveal delay={180}>
          <ScenarioRecommendations recommendations={simulationResult.recommendations} />
        </Reveal>
      )}

      {/* Confirmation Dialog for Deleting Scenario */}
      <ConfirmationDialog
        open={Boolean(scenarioToDelete)}
        onClose={() => setScenarioToDelete(null)}
        onConfirm={confirmDeleteScenario}
        title="Delete Scenario"
        message="Are you sure you want to delete this scenario? This will remove its saved hypotheses. Your baseline workforce records will not be affected."
        confirmLabel="Delete Scenario"
        variant="danger"
      />
    </div>
  );
}
