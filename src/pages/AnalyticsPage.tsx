import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Download, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ChartCard } from '@/components/ChartCard';
import { Reveal } from '@/components/Reveal';
import { ParallaxVisual } from '@/components/ParallaxVisual';
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
        name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
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

  const tooltipStyle = {
    backgroundColor: '#171D33',
    border: '1px solid #29324B',
    borderRadius: '12px',
    fontSize: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce Analytics & Intelligence Reports"
        description="Deep operational insights across capacity trends, skill demands, and project staffing health."
        breadcrumb={['Home', 'Analytics & Reports']}
      />

      <Reveal direction="down">
        <div className="card p-4 shadow-md relative overflow-hidden bg-gradient-to-r from-primary/5 via-base-card to-cyan/5 border-base-border/70">
          <ParallaxVisual strength={0.08} className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-cyan/10 blur-2xl" />
          <ParallaxVisual strength={-0.06} className="absolute -left-8 -bottom-8 w-36 h-36 rounded-full bg-primary/10 blur-2xl" />
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
                { value: '3m', label: 'Last 3 Months' },
                { value: '6m', label: 'Last 6 Months' },
                { value: '1y', label: 'Last 1 Year' },
              ]}
            />
          </FilterToolbar>
        </div>
      </Reveal>

      {/* Row 1: Utilization + Workload Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard
          title="Average Utilization by Department"
          subtitle="Mean estimated workload per organizational unit (%)"
          className="lg:col-span-2"
          delay={60}
          actions={
            <button className="btn-secondary text-xs py-1 px-2.5" onClick={handleExportUtilization}>
              <Download size={13} /> Export CSV
            </button>
          }
        >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilByDept} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2745" vertical={false} />
                <XAxis dataKey="department" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="utilization"
                  fill="#8B5CF6"
                  radius={[6, 6, 0, 0]}
                  name="Avg Utilization %"
                  isAnimationActive={true}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Workforce Workload Distribution"
          subtitle="Categorization across capacity bands"
          delay={120}
        >
          <div className="h-[210px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={workloadDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationEasing="ease-out"
                >
                  {workloadDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="#171D33" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-2 mt-3 pt-3 border-t border-base-border/40 text-center">
            {workloadDist.map((d) => (
              <div key={d.name} className="flex-1 p-2 rounded-xl bg-base-bg/60 border border-base-border/40">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[11px] text-text-secondary truncate">{d.name}</span>
                </div>
                <div className="text-sm font-bold text-text-primary font-mono tabular-nums">{d.value}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 2: Skill Distribution + Skill Demand */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard
          title="Skill Supply Distribution"
          subtitle="Number of employees proficient per core competency"
          delay={180}
          actions={
            <button className="btn-secondary text-xs py-1 px-2.5" onClick={handleExportSkills}>
              <Download size={13} /> Export CSV
            </button>
          }
        >
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillDist} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2745" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="skill" stroke="#94A3B8" fontSize={11} width={90} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="count"
                  fill="#8B5CF6"
                  radius={[0, 6, 6, 0]}
                  name="Employees"
                  isAnimationActive={true}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Market Skill Demand"
          subtitle="Competency frequency requested by active project pipelines"
          delay={240}
        >
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillDemand} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2745" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="skill" stroke="#94A3B8" fontSize={11} width={90} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="demand"
                  fill="#22D3EE"
                  radius={[0, 6, 6, 0]}
                  name="Projects"
                  isAnimationActive={true}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 3: Staffing + Department Headcount */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard
          title="Project Staffing Health"
          subtitle="Completion percentage across active workstreams"
          delay={280}
          actions={
            <button className="btn-secondary text-xs py-1 px-2.5" onClick={handleExportStaffing}>
              <Download size={13} /> Export CSV
            </button>
          }
        >
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffingData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2745" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" fontSize={10} angle={-15} textAnchor="end" height={60} interval={0} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="progress"
                  fill="#22C55E"
                  radius={[6, 6, 0, 0]}
                  name="Staffing %"
                  isAnimationActive={true}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Department Headcounts"
          subtitle="Staff distribution by functional domain"
          delay={320}
        >
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptStats} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2745" vertical={false} />
                <XAxis dataKey="department" stroke="#64748B" fontSize={10} angle={-15} textAnchor="end" height={60} interval={0} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="count"
                  fill="#8B5CF6"
                  radius={[6, 6, 0, 0]}
                  name="Headcount"
                  isAnimationActive={true}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Summary KPI Strip */}
      <Reveal delay={340}>
        <div className="card p-6 shadow-xl border-primary/25">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-base-border/50">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-text-primary">Executive Summary Metrics</h3>
            </div>
            <span className="text-xs text-text-secondary">Filtered Workforce Scope</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-xl bg-base-bg/60 border border-base-border/50">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Filtered Employees</div>
              <div className="text-2xl font-extrabold text-text-primary mt-1">{filteredEmployees.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-base-bg/60 border border-base-border/50">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Active Projects</div>
              <div className="text-2xl font-extrabold text-cyan mt-1">{filteredProjects.filter((p) => p.status === 'active').length}</div>
            </div>
            <div className="p-3 rounded-xl bg-base-bg/60 border border-base-border/50">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Mean Utilization</div>
              <div className="text-2xl font-extrabold text-success mt-1">
                {Math.round(filteredEmployees.reduce((sum, e) => sum + calculateEmployeeUtilization(e.id, projects, e.targetUtilization), 0) / (filteredEmployees.length || 1))}%
              </div>
            </div>
            <div className="p-3 rounded-xl bg-base-bg/60 border border-base-border/50">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Departments</div>
              <div className="text-2xl font-extrabold text-primary mt-1">{deptStats.length}</div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
