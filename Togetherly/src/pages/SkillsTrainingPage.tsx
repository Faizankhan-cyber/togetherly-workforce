import { useState, useMemo } from 'react';
import {
  GraduationCap,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { SkillTag } from '@/components/SkillTag';
import { ChartCard } from '@/components/ChartCard';
import { EmptyState } from '@/components/EmptyState';
import { FilterToolbar, SelectFilter } from '@/components/FilterToolbar';
import { useData } from '@/context/DataContext';
import {
  getSkillDistribution,
  getSkillDemand,
  getAllSkillGaps,
  getSkillName,
  exportToCsv,
} from '@/utils';

export function SkillsTrainingPage() {
  const { employees, projects, showToast } = useData();
  const [deptFilter, setDeptFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);
  const activeProjects = projects.filter((p) => p.status !== 'completed');

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (deptFilter !== 'all' && e.department !== deptFilter) return false;
      if (skillFilter !== 'all' && !e.skills.some((s) => s.skillId === skillFilter)) return false;
      return true;
    });
  }, [employees, deptFilter, skillFilter]);

  const skillDist = useMemo(() => getSkillDistribution(filteredEmployees), [filteredEmployees]);
  const skillDemand = useMemo(() => {
    let projs = activeProjects;
    if (projectFilter !== 'all') projs = projs.filter((p) => p.id === projectFilter);
    return getSkillDemand(projs);
  }, [activeProjects, projectFilter]);

  const skillGaps = useMemo(() => getAllSkillGaps(projects, employees), [projects, employees]);
  const allSkills = useMemo(() => Array.from(new Set(employees.flatMap((e) => e.skills.map((s) => s.skillId)))).sort(), [employees]);

  // Scarce skills (low count across org)
  const scarceSkills = skillDist.filter((s) => s.count <= 2).slice(0, 5);

  // Training recommendations
  const trainingList = useMemo(() => {
    return filteredEmployees
      .filter((e) => e.trainingAssignments.length > 0)
      .flatMap((e) =>
        e.trainingAssignments.map((t) => ({
          employee: e,
          training: t,
        }))
      )
      .filter((item) => skillFilter === 'all' || item.training.skillId === skillFilter);
  }, [filteredEmployees, skillFilter]);

  // Skill matrix data
  const matrixSkills = allSkills.slice(0, 12);

  function handleExportMatrix() {
    const headers = ['Employee', 'Department', ...matrixSkills.map((sid) => getSkillName(sid))];
    const rows = filteredEmployees.map((emp) => [
      emp.name,
      emp.department,
      ...matrixSkills.map((sid) => {
        const es = emp.skills.find((s) => s.skillId === sid);
        return es ? es.level : 0;
      }),
    ]);
    exportToCsv('skill-matrix.csv', headers, rows);
    showToast('success', 'Skill matrix exported to CSV');
  }

  return (
    <div>
      <PageHeader
        title="Skills & Training"
        description="Company-wide skill inventory, gaps, and training recommendations"
        breadcrumb={['Home', 'Skills & Training']}
        actions={
          <button className="btn-secondary" onClick={handleExportMatrix}>
            <Download size={16} /> Export Matrix
          </button>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4">
        <FilterToolbar>
          <SelectFilter
            label="Department"
            value={deptFilter}
            onChange={setDeptFilter}
            options={[
              { value: 'all', label: 'All Departments' },
              ...departments.map((d) => ({ value: d, label: d })),
            ]}
          />
          <SelectFilter
            label="Skill"
            value={skillFilter}
            onChange={setSkillFilter}
            options={[
              { value: 'all', label: 'All Skills' },
              ...allSkills.map((id) => ({ value: id, label: getSkillName(id) })),
            ]}
          />
          <SelectFilter
            label="Project"
            value={projectFilter}
            onChange={setProjectFilter}
            options={[
              { value: 'all', label: 'All Projects' },
              ...activeProjects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </FilterToolbar>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Skill Distribution" subtitle="Number of employees per skill">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={skillDist.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#29324B" />
              <XAxis type="number" stroke="#94A3B8" fontSize={11} />
              <YAxis type="category" dataKey="skill" stroke="#94A3B8" fontSize={10} width={80} />
              <Tooltip contentStyle={{ backgroundColor: '#171D33', border: '1px solid #29324B', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Employees" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Skill Demand" subtitle="Required by active projects">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={skillDemand.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#29324B" />
              <XAxis type="number" stroke="#94A3B8" fontSize={11} />
              <YAxis type="category" dataKey="skill" stroke="#94A3B8" fontSize={10} width={80} />
              <Tooltip contentStyle={{ backgroundColor: '#171D33', border: '1px solid #29324B', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="demand" fill="#22D3EE" radius={[0, 4, 4, 0]} name="Projects" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Skill Gaps & Scarce Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-critical" />
            <h3 className="text-sm font-semibold text-text-primary">Skill Gaps in Active Projects</h3>
          </div>
          {skillGaps.length === 0 ? (
            <p className="text-sm text-text-secondary">No skill gaps detected. All project requirements are covered.</p>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {skillGaps.map((gap, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-base-bg border border-base-border">
                  <div className="flex items-center gap-2">
                    <SkillTag skillId={gap.skillId} />
                  </div>
                  <span className="text-xs text-text-secondary">{gap.projectName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-warning" />
            <h3 className="text-sm font-semibold text-text-primary">Scarce Skills</h3>
          </div>
          {scarceSkills.length === 0 ? (
            <p className="text-sm text-text-secondary">All skills have adequate coverage.</p>
          ) : (
            <div className="space-y-2">
              {scarceSkills.map((s) => (
                <div key={s.skill} className="flex items-center justify-between p-2 rounded-lg bg-base-bg border border-base-border">
                  <span className="text-sm text-text-primary">{s.skill}</span>
                  <span className="text-xs text-warning">{s.count} employee{s.count !== 1 ? 's' : ''} • Avg L{s.avgLevel}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Skill Matrix */}
      <div className="card p-5 mb-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Employee Skill Matrix</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-base-border">
              <th className="text-left py-2 px-3 text-xs text-text-secondary sticky left-0 bg-base-card">Employee</th>
              {matrixSkills.map((sid) => (
                <th key={sid} className="text-center py-2 px-2 text-xs text-text-secondary min-w-[60px]">{getSkillName(sid).slice(0, 6)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp.id} className="border-b border-base-border/50 hover:bg-base-hover transition-colors">
                <td className="py-2 px-3 sticky left-0 bg-base-card">
                  <div className="flex items-center gap-2">
                    <Avatar name={emp.name} color={emp.avatarColor} size="sm" />
                    <span className="text-xs text-text-primary truncate">{emp.name}</span>
                  </div>
                </td>
                {matrixSkills.map((sid) => {
                  const es = emp.skills.find((s) => s.skillId === sid);
                  const level = es?.level ?? 0;
                  return (
                    <td key={sid} className="text-center py-2 px-2">
                      {level > 0 ? (
                        <span className={`inline-flex w-6 h-6 items-center justify-center rounded text-xs font-medium ${
                          level >= 4 ? 'bg-success/10 text-success' : level >= 3 ? 'bg-primary/10 text-primary' : 'bg-base-hover text-text-secondary'
                        }`}>
                          {level}
                        </span>
                      ) : (
                        <span className="text-text-secondary text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Training Recommendations */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-text-primary">Training Recommendations</h3>
        </div>
        {trainingList.length === 0 ? (
          <EmptyState title="No training assignments" description="Employees matching these filters have no training in progress." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trainingList.map(({ employee, training }) => (
              <div key={training.id} className="p-3 rounded-lg bg-base-bg border border-base-border">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                  <div>
                    <div className="text-sm font-medium text-text-primary">{employee.name}</div>
                    <div className="text-xs text-text-secondary">{employee.role}</div>
                  </div>
                </div>
                <div className="text-sm text-text-primary">{training.courseName}</div>
                <div className="text-xs text-text-secondary mt-0.5">{training.provider} • {getSkillName(training.skillId)}</div>
                <div className="text-xs text-text-secondary mt-1">{training.reason}</div>
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">{training.status === 'completed' ? 'Completed' : 'Progress'}</span>
                    <span className="text-xs font-medium text-text-primary">{training.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-base-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${training.status === 'completed' ? 'bg-success' : 'bg-primary'}`} style={{ width: `${training.progress}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
