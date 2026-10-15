import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Download, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ChartCard } from '@/components/ChartCard';
import { FilterToolbar, SelectFilter } from '@/components/FilterToolbar';
import { useData } from '@/context/DataContext';
import {
  calculateEmployeeUtilization,
  getUtilizationStatus,
  getSkillDistribution,
  getSkillDemand,
  getDepartmentStats,
  getProjectStaffingProgress,
  exportToCsv,
} from '@/utils';

const CHART_COLORS = ['#8B5CF6', '#22D3EE', '#22C55E', '#F59E0B', '#F87171', '#A78BFA', '#67E8F9', '#86EFAC'];

export function AnalyticsPage() {
  const { employees, projects, settings, showToast } = useData();
  const [deptFilter, setDeptFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))).sort(), [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => deptFilter === 'all' || e.department === deptFilter);
  }, [employees, deptFilter]);

  const filteredProjects = useMemo(() => {
    if (dateFilter === 'all') return projects;
    const now = new Date();
    return projects.filter((p) => {
      const start = new Date(p.startDate);
      const diffMonths = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (dateFilter === '3m') return diffMonths <= 3;
      if (dateFilter === '6m') return diffMonths <= 6;
      if (dateFilter === '1y') return diffMonths <= 12;
      return true;
    });
  }, [projects, dateFilter]);

  // Utilization by department
  const utilByDept = useMemo(() => {
    const depts = Array.from(new Set(filteredEmployees.map((e) => e.department)));
    return depts.map((dept) => {
      const deptEmps = filteredEmployees.filter((e) => e.department === dept);
      const avgUtil = deptEmps.reduce((sum, e) => sum + calculateEmployeeUtilization(e.id, projects, e.targetUtilization), 0) / (deptEmps.length || 1);
      return { department: dept, utilization: Math.round(avgUtil) };
    });
  }, [filteredEmployees, projects]);

  // Workload distribution
  const workloadDist = useMemo(() => {
    const overloaded = filteredEmployees.filter((e) => getUtilizationStatus(calculateEmployeeUtilization(e.id, projects, e.targetUtilization), settings) === 'overloaded').length;
    const balanced = filteredEmployees.filter((e) => getUtilizationStatus(calculateEmployeeUtilization(e.id, projects, e.targetUtilization), settings) === 'balanced').length;
    const underutilized = filteredEmployees.filter((e) => getUtilizationStatus(calculateEmployeeUtilization(e.id, projects, e.targetUtilization), settings) === 'underutilized').length;
    return [
      { name: 'Overloaded', value: overloaded, color: '#F87171' },
      { name: 'Balanced', value: balanced, color: '#22C55E' },
      { name: 'Underutilized', value: underutilized, color: '#22D3EE' },
    ];
  }, [filteredEmployees, projects, settings]);

  // Skill distribution
  const skillDist = useMemo(() => getSkillDistribution(filteredEmployees).slice(0, 8), [filteredEmployees]);

  // Skill demand
  const skillDemand = useMemo(() => getSkillDemand(filteredProjects).slice(0, 8), [filteredProjects]);

  // Staffing completion
  const staffingData = useMemo(() => {
    return filteredProjects
      .filter((p) => p.status !== 'completed')
      .map((p) => ({
        name: p.name.length > 18 ? p.name.slice(0, 18) + '...' : p.name,
        progress: getProjectStaffingProgress(p),
        assigned: p.assignedEmployeeIds.length,
        target: p.targetTeamSize,
      }));
  }, [filteredProjects]);

  // Department headcount
  const deptStats = useMemo(() => getDepartmentStats(filteredEmployees), [filteredEmployees]);

  function handleExportUtilization() {
    const headers = ['Employee', 'Department', 'Utilization', 'Status'];
    const rows = filteredEmployees.map((e) => {
      const util = calculateEmployeeUtilization(e.id, projects, e.targetUtilization);
      const status = getUtilizationStatus(util, settings);
      return [e.name, e.department, `${util}%`, status];
    });
    exportToCsv('utilization-report.csv', headers, rows);
    showToast('success', 'Utilization report exported');
  }

  function handleExportSkills() {
    const headers = ['Skill', 'Employees', 'Average Level'];
    const rows = skillDist.map((s) => [s.skill, s.count, s.avgLevel]);
    exportToCsv('skill-distribution.csv', headers, rows);
    showToast('success', 'Skill distribution exported');
  }

  function handleExportStaffing() {
    const headers = ['Project', 'Assigned', 'Target', 'Progress'];
    const rows = staffingData.map((s) => [s.name, s.assigned, s.target, `${s.progress}%`]);
    exportToCsv('staffing-report.csv', headers, rows);
    showToast('success', 'Staffing report exported');
  }

  const tooltipStyle = { backgroundColor: '#171D33', border: '1px solid #29324B', borderRadius: '8px', fontSize: '12px' };

  return (
    <div>
      <PageHeader
        title="Analytics & Reports"
        description="Workforce insights, trends, and exportable reports"
        breadcrumb={['Home', 'Analytics & Reports']}
      />

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
            label="Time Range"
            value={dateFilter}
            onChange={setDateFilter}
            options={[
              { value: 'all', label: 'All Time' },
              { value: '3m', label: 'Last 3 months' },
              { value: '6m', label: 'Last 6 months' },
              { value: '1y', label: 'Last year' },
            ]}
          />
        </FilterToolbar>
      </div>

      {/* Row 1: Utilization + Workload Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard
          title="Utilization by Department"
          subtitle="Average utilization per department"
          className="lg:col-span-2"
          actions={<button className="btn-ghost text-xs" onClick={handleExportUtilization}><Download size={14} /> Export</button>}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={utilByDept}>
              <CartesianGrid strokeDasharray="3 3" stroke="#29324B" />
              <XAxis dataKey="department" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="utilization" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Avg Utilization %" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Workload Distribution" subtitle="Overloaded vs balanced vs underutilized">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={workloadDist} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                {workloadDist.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 flex-wrap mt-2">
            {workloadDist.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-text-secondary">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 2: Skill Distribution + Skill Demand */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="Skill Distribution"
          subtitle="Employee count per skill"
          actions={<button className="btn-ghost text-xs" onClick={handleExportSkills}><Download size={14} /> Export</button>}
        >
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={skillDist} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#29324B" />
              <XAxis type="number" stroke="#94A3B8" fontSize={11} />
              <YAxis type="category" dataKey="skill" stroke="#94A3B8" fontSize={10} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Employees" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Skill Demand" subtitle="Skills required by active projects">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={skillDemand} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#29324B" />
              <XAxis type="number" stroke="#94A3B8" fontSize={11} />
              <YAxis type="category" dataKey="skill" stroke="#94A3B8" fontSize={10} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="demand" fill="#22D3EE" radius={[0, 4, 4, 0]} name="Projects" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3: Staffing + Department Headcount */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="Project Staffing Completion"
          subtitle="Staffing progress across active projects"
          actions={<button className="btn-ghost text-xs" onClick={handleExportStaffing}><Download size={14} /> Export</button>}
        >
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={staffingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#29324B" />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} angle={-20} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="progress" fill="#22C55E" radius={[4, 4, 0, 0]} name="Staffing %" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Department Headcount" subtitle="Employees per department">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={deptStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#29324B" />
              <XAxis dataKey="department" stroke="#94A3B8" fontSize={10} angle={-20} textAnchor="end" height={60} interval={0} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Employees" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Summary stats */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-text-primary">Summary</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-text-secondary">Total Employees</div>
            <div className="text-lg font-bold text-text-primary">{filteredEmployees.length}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Active Projects</div>
            <div className="text-lg font-bold text-text-primary">{filteredProjects.filter((p) => p.status === 'active').length}</div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Avg Utilization</div>
            <div className="text-lg font-bold text-text-primary">
              {Math.round(filteredEmployees.reduce((sum, e) => sum + calculateEmployeeUtilization(e.id, projects, e.targetUtilization), 0) / (filteredEmployees.length || 1))}%
            </div>
          </div>
          <div>
            <div className="text-xs text-text-secondary">Departments</div>
            <div className="text-lg font-bold text-text-primary">{deptStats.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
