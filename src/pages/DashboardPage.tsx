import { useNavigate } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  UserCheck,
  AlertTriangle,
  Plus,
  Sparkles,
  ArrowRight,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { MetricCard } from '@/components/MetricCard';
import { ChartCard } from '@/components/ChartCard';
import { Reveal } from '@/components/Reveal';
import { Avatar } from '@/components/Avatar';
import {
  calculateEmployeeUtilization,
  getUtilizationStatus,
  getProjectStaffingProgress,
  getAllSkillGaps,
  formatTimestamp,
  daysUntil,
} from '@/utils';
import { useData } from '@/context/DataContext';
import { EmployeeDashboardPage } from '@/pages/EmployeeExperiencePage';

export function DashboardPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { employees, projects, settings, activities, role } = useData();

  if (!embedded && role === 'employee') return <EmployeeDashboardPage />;

  const activeProjects = projects.filter((p) => p.status === 'active');
  const availableEmployees = employees.filter((e) => e.availability === 'available');
  const skillGaps = getAllSkillGaps(projects, employees);
  const understaffedProjects = projects.filter((project) =>
    project.status !== 'completed' && project.assignedEmployeeIds.length < project.targetTeamSize
  );
  const firstUnderstaffedProject = understaffedProjects[0];
  const overdueProjects = projects.filter((project) => project.status !== 'completed' && daysUntil(project.deadline) < 0);

  const overloadedEmployees = employees
    .map((e) => ({
      employee: e,
      utilization: calculateEmployeeUtilization(e.id, projects, e.targetUtilization),
    }))
    .filter(({ utilization }) => getUtilizationStatus(utilization, settings) === 'overloaded')
    .sort((a, b) => b.utilization - a.utilization);

  const utilizationData = employees.map((e) => ({
    name: e.name.split(' ').slice(0, 2).map((n) => n[0]).join(''),
    fullName: e.name,
    utilization: calculateEmployeeUtilization(e.id, projects, e.targetUtilization),
    target: e.targetUtilization,
  }));

  const workloadDistribution = [
    {
      name: 'Overloaded',
      value: employees.filter((e) => getUtilizationStatus(calculateEmployeeUtilization(e.id, projects, e.targetUtilization), settings) === 'overloaded').length,
      color: '#D13438',
    },
    {
      name: 'Balanced',
      value: employees.filter((e) => getUtilizationStatus(calculateEmployeeUtilization(e.id, projects, e.targetUtilization), settings) === 'balanced').length,
      color: '#107C10',
    },
    {
      name: 'Underutilized',
      value: employees.filter((e) => getUtilizationStatus(calculateEmployeeUtilization(e.id, projects, e.targetUtilization), settings) === 'underutilized').length,
      color: '#0078D4',
    },
  ];

  const balancedCount = workloadDistribution.find((item) => item.name === 'Balanced')?.value ?? 0;
  const balancedRate = Math.round((balancedCount / Math.max(employees.length, 1)) * 100);

  const staffingProgress = projects
    .filter((p) => p.status !== 'completed')
    .map((p) => ({
      name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
      fullName: p.name,
      progress: getProjectStaffingProgress(p),
      target: p.targetTeamSize,
      assigned: p.assignedEmployeeIds.length,
    }));

  const recommendedActions = [
    ...(firstUnderstaffedProject ? [{
      message: `${understaffedProjects.length} project${understaffedProjects.length === 1 ? '' : 's'} need staffing attention. ${firstUnderstaffedProject.name} is short ${firstUnderstaffedProject.targetTeamSize - firstUnderstaffedProject.assignedEmployeeIds.length} member${firstUnderstaffedProject.targetTeamSize - firstUnderstaffedProject.assignedEmployeeIds.length === 1 ? '' : 's'}.`,
      action: () => navigate('/team-builder', { state: { projectId: firstUnderstaffedProject.id } }),
      badge: 'Staffing Needed',
      badgeColor: 'text-primary bg-primary-50 border-primary-200',
    }] : []),
    ...(overdueProjects.length > 0 ? [{
      message: `${overdueProjects.length} open project${overdueProjects.length === 1 ? ' has' : 's have'} passed its deadline. Review delivery commitments.`,
      action: () => navigate('/projects'),
      badge: 'Overdue Delivery',
      badgeColor: 'text-critical bg-red-50 border-red-200',
    }] : []),
    ...(overloadedEmployees.length > 0 ? [{
      message: `${overloadedEmployees.length} employee${overloadedEmployees.length === 1 ? ' is' : 's are'} above the configured workload threshold. Rebalance commitments.`,
      action: () => navigate('/workload'),
      badge: 'Workload Alert',
      badgeColor: 'text-critical bg-red-50 border-red-200',
    }] : [{
      message: 'No employees currently exceed the configured workload threshold.',
      action: () => navigate('/workload'),
      badge: 'Capacity Stable',
      badgeColor: 'text-success bg-green-50 border-green-200',
    }]),
    ...(skillGaps.length > 0 ? [{
      message: `${skillGaps.length} skill gap${skillGaps.length === 1 ? '' : 's'} are identified across project requirements. Prioritize training or targeted staffing.`,
      action: () => navigate('/skills'),
      badge: 'Skill Development',
      badgeColor: 'text-warning bg-orange-50 border-orange-200',
    }] : [{
      message: 'No skill gaps are currently identified across the project requirements.',
      action: () => navigate('/skills'),
      badge: 'Skills Covered',
      badgeColor: 'text-success bg-green-50 border-green-200',
    }]),
    ...(availableEmployees.length > 0 ? [{
      message: `${availableEmployees.length} employee${availableEmployees.length === 1 ? ' has' : 's have'} availability marked as open for upcoming work.`,
      action: () => navigate('/employees'),
      badge: 'Capacity Ready',
      badgeColor: 'text-success bg-green-50 border-green-200',
    }] : [{
      message: 'No employees are currently marked available. Review near-term assignments before accepting more work.',
      action: () => navigate('/workload'),
      badge: 'Capacity Constraint',
      badgeColor: 'text-warning bg-orange-50 border-orange-200',
    }]),
  ];

  const tooltipStyle = {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E1E6ED',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: '12px',
    color: '#172B4D',
  };

  return (
    <div className="space-y-5">
      {!embedded && (
      <PageHeader
        title="Workforce Intelligence Center"
        description="Comprehensive real-time capacity tracking, predictive team allocation, and skill intelligence across all enterprise initiatives."
        breadcrumb={['Home', 'Dashboard']}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate('/team-builder')}>
              <Sparkles size={14} className="text-primary" />
              <span>Team Builder</span>
            </button>
            <button className="btn-primary" onClick={() => navigate('/projects')}>
              <Plus size={14} />
              <span>Create Project</span>
            </button>
          </>
        }
      />
      )}

      {/* Workforce Health Index Banner */}
      <Reveal direction="down" delay={20}>
        <div className="card p-4 bg-primary-50 border-primary-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-primary">Workforce Health Index</div>
              <div className="text-xs sm:text-sm font-semibold text-text-primary mt-0.5">
                {balancedCount} of {employees.length} employees are within the configured balanced-capacity range
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-white/80 border border-primary-100">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${balancedRate}%` }} />
                </div>
                <span className="text-[11px] font-bold tabular-nums text-primary">{balancedRate}% balanced</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/workforce-twin')}
              className="btn-secondary text-xs"
            >
              Simulate Twin Scenarios
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </Reveal>

      {/* 4 Compact KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal delay={40} direction="up">
          <MetricCard
            label="Total Employees"
            value={employees.length}
            icon={<Users size={18} />}
            accent="primary"
          />
        </Reveal>
        <Reveal delay={80} direction="up">
          <MetricCard
            label="Active Projects"
            value={activeProjects.length}
            icon={<FolderKanban size={18} />}
            accent="cyan"
          />
        </Reveal>
        <Reveal delay={120} direction="up">
          <MetricCard
            label="Available Capacity"
            value={availableEmployees.length}
            icon={<UserCheck size={18} />}
            accent="success"
          />
        </Reveal>
        <Reveal delay={160} direction="up">
          <MetricCard
            label="Identified Skill Gaps"
            value={skillGaps.length}
            icon={<AlertTriangle size={18} />}
            accent="warning"
          />
        </Reveal>
      </div>

      {/* Charts Row 1: Utilization & Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard
          title="Workforce Utilization Matrix"
          subtitle="Simulated current workload vs baseline target capacity (%)"
          className="lg:col-span-2"
          delay={60}
        >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={utilizationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="utilGradLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0078D4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0078D4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E6ED" vertical={false} />
                <XAxis dataKey="name" stroke="#5E6C84" fontSize={11} tickLine={false} />
                <YAxis stroke="#5E6C84" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload;
                      return (
                        <div className="card p-3 shadow-dropdown border border-base-border text-xs bg-white">
                          <p className="font-bold text-text-primary mb-1">{data?.fullName}</p>
                          <p className="text-primary font-semibold">Utilization: {data?.utilization}%</p>
                          <p className="text-text-secondary">Target: {data?.target}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="utilization"
                  stroke="#0078D4"
                  strokeWidth={2}
                  fill="url(#utilGradLight)"
                  name="Current"
                  isAnimationActive={true}
                  animationDuration={900}
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#5E6C84"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                  name="Target"
                  isAnimationActive={true}
                  animationDuration={1100}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-end gap-5 mt-2 pt-2 border-t border-base-border text-xs">
            <div className="flex items-center gap-1.5 text-text-secondary font-medium">
              <span className="w-3 h-1 bg-primary rounded-full" /> Current Utilization
            </div>
            <div className="flex items-center gap-1.5 text-text-secondary font-medium">
              <span className="w-3 h-0.5 border-t border-dashed border-gray-400" /> Target Baseline
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Workload Balance"
          subtitle="Distribution of employee capacity statuses"
          delay={90}
        >
          <div className="h-[200px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={workloadDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={900}
                >
                  {workloadDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-base-border text-center">
            {workloadDistribution.map((d) => (
              <div key={d.name} className="p-2 rounded-lg bg-base-subtle border border-base-border">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] font-semibold text-text-secondary truncate">{d.name}</span>
                </div>
                <div className="text-sm font-bold text-text-primary">{d.value}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Charts Row 2: Staffing Progress & Overload Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard
          title="Project Staffing Health"
          subtitle="Current assigned headcounts versus target team sizes"
          className="lg:col-span-2"
          delay={110}
        >
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffingProgress} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E6ED" vertical={false} />
                <XAxis dataKey="name" stroke="#5E6C84" fontSize={11} interval={0} angle={-10} textAnchor="end" tickLine={false} />
                <YAxis stroke="#5E6C84" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload;
                      return (
                        <div className="card p-3 shadow-dropdown border border-base-border text-xs bg-white">
                          <p className="font-bold text-text-primary mb-1">{data?.fullName}</p>
                          <p className="text-primary font-semibold">Staffing Progress: {data?.progress}%</p>
                          <p className="text-text-secondary">Assigned: {data?.assigned} of {data?.target} members</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="progress"
                  fill="#0078D4"
                  radius={[4, 4, 0, 0]}
                  name="Progress %"
                  isAnimationActive={true}
                  animationDuration={900}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Overloaded Employees */}
        <Reveal delay={130} direction="left">
          <div className="card p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-base-border">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-critical" />
                <h3 className="text-sm font-bold text-text-primary">Capacity Warnings</h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-critical border border-red-200">
                {overloadedEmployees.length} Overloaded
              </span>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px]">
              {overloadedEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-6 text-text-secondary">
                  <span className="w-8 h-8 rounded-full bg-green-50 text-success flex items-center justify-center font-bold mb-2">✓</span>
                  <p className="text-xs font-medium">All personnel within safe workload limits.</p>
                </div>
              ) : (
                overloadedEmployees.slice(0, 5).map(({ employee, utilization }) => (
                  <div
                    key={employee.id}
                    onClick={() => navigate('/workload')}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-base-subtle border border-base-border hover:border-critical/50 hover:bg-red-50/50 cursor-pointer transition-all"
                  >
                    <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-text-primary truncate">{employee.name}</div>
                      <div className="text-[11px] text-text-secondary truncate">{employee.role}</div>
                    </div>
                    <span className="text-xs font-bold text-critical font-mono bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      {utilization}%
                    </span>
                  </div>
                ))
              )}
            </div>
            {overloadedEmployees.length > 0 && (
              <button
                onClick={() => navigate('/workload')}
                className="mt-3 w-full py-2 text-xs font-semibold text-primary hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md border border-primary-200 transition-all text-center flex items-center justify-center gap-1.5"
              >
                Rebalance in Workload Planner
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </Reveal>
      </div>

      {/* Activity Stream + Recommended Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Reveal delay={150}>
          <div className="card p-5 h-full">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-base-border">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-text-primary">System Audit Log</h3>
              </div>
              <span className="text-[11px] text-text-secondary font-medium">{activities.length} recorded</span>
            </div>
            <div className="space-y-2.5">
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-base-subtle border border-base-border/70 hover:border-base-border transition-colors">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary font-medium leading-snug">{act.message}</p>
                    <p className="text-[10px] text-text-secondary mt-1 font-mono">{formatTimestamp(act.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={170}>
          <div className="card p-5 h-full">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-base-border">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-text-primary">Recommended Next Actions</h3>
              </div>
              <span className="text-[11px] text-primary font-semibold">Priority Guidance</span>
            </div>
            <div className="space-y-2.5">
              {recommendedActions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.action}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-base-subtle border border-base-border hover:border-primary/50 hover:bg-primary-50/50 transition-all text-left group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-text-primary group-hover:text-primary transition-colors">
                      {action.message}
                    </div>
                    {action.badge && (
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${action.badgeColor}`}>
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <div className="w-6 h-6 rounded bg-white border border-base-border flex items-center justify-center text-text-secondary group-hover:text-primary group-hover:border-primary/40 transition-all flex-shrink-0 shadow-xs">
                    <ArrowRight size={13} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
