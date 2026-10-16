import { useState } from 'react';
import {
  GitFork,
  Plus,
  Copy,
  Trash2,
  RotateCcw,
  UserCheck,
  UserPlus,
  Clock,
  GraduationCap,
  FolderPlus,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import type { ScenarioModel, ScenarioType } from '@/types';

interface ScenarioSelectorProps {
  scenarios: ScenarioModel[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onCreateScenario: (type: ScenarioType, name: string) => void;
  onDuplicateScenario: (id: string) => void;
  onDeleteScenario: (id: string) => void;
  onResetScenario: (id: string) => void;
}

const scenarioTypeMeta: Record<
  ScenarioType,
  { label: string; icon: typeof GitFork; color: string; desc: string }
> = {
  reallocation: {
    label: 'Reallocation',
    icon: UserCheck,
    color: 'text-primary bg-primary-50 border-primary-200',
    desc: 'Shift talent between projects',
  },
  'new-hire': {
    label: 'New Hire',
    icon: UserPlus,
    color: 'text-success bg-green-50 border-green-200',
    desc: 'Simulate adding a new skill profile',
  },
  'project-delay': {
    label: 'Project Delay',
    icon: Clock,
    color: 'text-warning bg-orange-50 border-orange-200',
    desc: 'Model timeline push & resource lock',
  },
  training: {
    label: 'Training',
    icon: GraduationCap,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    desc: 'Skill elevation & gap reduction',
  },
  'new-project': {
    label: 'New Project',
    icon: FolderPlus,
    color: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    desc: 'Evaluate capacity for a new initiative',
  },
  'capacity-reduction': {
    label: 'Capacity Cut',
    icon: TrendingDown,
    color: 'text-critical bg-red-50 border-red-200',
    desc: 'Simulate attrition or budget cuts',
  },
};

export function ScenarioSelector({
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onCreateScenario,
  onDuplicateScenario,
  onDeleteScenario,
  onResetScenario,
}: ScenarioSelectorProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ScenarioType>('reallocation');
  const [newScenarioName, setNewScenarioName] = useState('');

  function handleCreate() {
    if (!newScenarioName.trim()) return;
    onCreateScenario(selectedType, newScenarioName.trim());
    setNewScenarioName('');
    setModalOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <GitFork size={16} className="text-primary" />
            Saved Scenarios ({scenarios.length})
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Select a what-if scenario to run calculations or configure hypotheses.
          </p>
        </div>
        <button
          onClick={() => {
            setNewScenarioName(`Scenario ${scenarios.length + 1} - ${scenarioTypeMeta[selectedType].label}`);
            setModalOpen(true);
          }}
          className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap shadow-sm self-start sm:self-auto"
        >
          <Plus size={15} /> Create Scenario
        </button>
      </div>

      {/* Grid of Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {scenarios.map((scen) => {
          const meta = scenarioTypeMeta[scen.type];
          const Icon = meta.icon;
          const isActive = scen.id === activeScenarioId;

          return (
            <div
              key={scen.id}
              onClick={() => onSelectScenario(scen.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative group ${
                isActive
                  ? 'bg-primary-50/40 border-primary shadow-sm ring-1 ring-primary/20'
                  : 'bg-white border-base-border hover:border-primary/40 hover:shadow-card'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${meta.color}`}
                >
                  <Icon size={12} />
                  {meta.label}
                </span>

                {/* Card Actions */}
                <div
                  className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onDuplicateScenario(scen.id)}
                    title="Duplicate scenario"
                    className="p-1 rounded hover:bg-base-hover text-text-secondary hover:text-text-primary"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={() => onResetScenario(scen.id)}
                    title="Reset to scenario defaults"
                    className="p-1 rounded hover:bg-base-hover text-text-secondary hover:text-text-primary"
                  >
                    <RotateCcw size={13} />
                  </button>
                  {scenarios.length > 1 && (
                    <button
                      onClick={() => onDeleteScenario(scen.id)}
                      title="Delete scenario"
                      className="p-1 rounded hover:bg-critical/10 text-text-secondary hover:text-critical"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="font-bold text-xs text-text-primary line-clamp-1 group-hover:text-primary transition-colors">
                {scen.name}
              </div>
              <p className="text-[11px] text-text-secondary line-clamp-2 mt-1 leading-relaxed">
                {scen.description || meta.desc}
              </p>

              <div className="mt-2.5 pt-2 border-t border-base-border/50 flex items-center justify-between text-[10px] text-text-muted">
                <span>Updated {new Date(scen.updatedAt).toLocaleDateString()}</span>
                {isActive && (
                  <span className="font-semibold text-primary flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Active
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for Creating New Scenario */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white border border-base-border rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-base-border">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="text-primary" />
                <h3 className="text-sm font-bold text-text-primary">Create New Scenario</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1">
                Scenario Name
              </label>
              <input
                type="text"
                className="input-field w-full text-xs"
                placeholder="e.g. Q4 Migration Team Rebalancing"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                Scenario Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(scenarioTypeMeta) as ScenarioType[]).map((type) => {
                  const m = scenarioTypeMeta[type];
                  const Icon = m.icon;
                  const isChecked = selectedType === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setSelectedType(type);
                        setNewScenarioName(`Scenario ${scenarios.length + 1} - ${m.label}`);
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-all flex items-start gap-2 ${
                        isChecked
                          ? 'border-primary bg-primary-50/50 shadow-sm'
                          : 'border-base-border hover:border-base-border/80 bg-base-bg/30'
                      }`}
                    >
                      <Icon size={16} className={isChecked ? 'text-primary' : 'text-text-secondary'} />
                      <div className="min-w-0">
                        <div className={`text-xs font-bold ${isChecked ? 'text-primary' : 'text-text-primary'}`}>
                          {m.label}
                        </div>
                        <div className="text-[10px] text-text-secondary leading-tight mt-0.5">
                          {m.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-base-border">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newScenarioName.trim()}
                className="btn-primary text-xs py-1.5 px-4"
              >
                Create Scenario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
