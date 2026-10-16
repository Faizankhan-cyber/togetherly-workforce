import { useNavigate } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  UserCheck,
  AlertTriangle,
  Plus,
  Sparkles,
  Zap,
  ArrowRight,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
import { PageHeader } from '@/components/PageHeader';
import { MetricCard } from '@/components/MetricCard';
import { ChartCard } from '@/components/ChartCard';
import { Reveal } from '@/components/Reveal';
import { Avatar } from '@/components/Avatar';
import { ParallaxVisual } from '@/components/ParallaxVisual';
import {
  calculateEmployeeUtilization,
  getUtilizationStatus,
  getProjectStaffingProgress,
  getAllSkillGaps,
  formatTimestamp,
} from '@/utils';
import { useData } from '@/context/DataContext';
import { EmployeeDashboardPage } from '@/pages/EmployeeExperiencePage';

export function DashboardPage() {
  const navigate = useNavigate();
  const { employees, projects, settings, activities, role } = useData();

  if (role === 'employee') return <EmployeeDashboardPage />;

  const activeProjects = projects.filter((p) => p.status === 'active');
  const availableEmployees = employees.filter((e) => e.availability === 'available');
  const skillGaps = getAllSkillGaps(projects, employees);
  const firstUnderstaffedProject = projects.find((project) =>
    project.status !== 'completed' && project.assignedEmployeeIds.length < project.targetTeamSize
  );

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
      color: '#F87171',
    },
    {
      name: 'Balanced',
      value: employees.filter((e) => getUtilizationStatus(calculateEmployeeUtilization(e.id, projects, e.targetUtilization), settings) === 'balanced').length,
      color: '#22C55E',
    },
    {
      name: 'Underutilized',
      value: employees.filter((e) => getUtilizationStatus(calculateEmployeeUtilization(e.id, projects, e.targetUtilization), settings) === 'underutilized').length,
      color: '#22D3EE',
    },
  ];

  const staffingProgress = projects
    .filter((p) => p.status !== 'completed')
    .map((p) => ({
      name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
      fullName: p.name,
      progress: getProjectStaffingProgress(p),
      target: p.targetTeamSize,
      assigned: p.assignedEmployeeIds.length,
    }));

  const recommendedActions = [
    ...(firstUnderstaffedProject ? [{
      message: `${firstUnderstaffedProject.name} needs ${firstUnderstaffedProject.targetTeamSize - firstUnderstaffedProject.assignedEmployeeIds.length} more ${firstUnderstaffedProject.targetTeamSize - firstUnderstaffedProject.assignedEmployeeIds.length === 1 ? 'member' : 'members'}`,
      action: () => navigate('/team-builder', { state: { projectId: firstUnderstaffedProject.id } }),
      badge: 'Staffing Needed',
      badgeColor: 'text-cyan bg-cyan/10 border-cyan/30',
    }] : []),
    {
      message: `${overloadedEmployees.length} employees are overloaded — consider reassigning work`,
      action: () => navigate('/workload'),
      badge: 'Workload Risk',
      badgeColor: 'text-critical bg-critical/10 border-critical/30',
    },
    {
      message: `${skillGaps.length} skill gaps detected across active projects`,
      action: () => navigate('/skills'),
      badge: 'Skill Development',
      badgeColor: 'text-warning bg-warning/10 border-warning/30',
    },
    {
      message: `${availableEmployees.length} employees available for immediate allocation`,
      action: () => navigate('/employees'),
      badge: 'Capacity Ready',
      badgeColor: 'text-success bg-success/10 border-success/30',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce Intelligence Command"
        description="Real-time capacity tracking, predictive team allocation, and skill intelligence."
        breadcrumb={['Home', 'Dashboard']}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate('/team-builder')}>
              <Sparkles size={15} className="text-primary" />
              <span>Team Builder</span>
            </button>
            <button className="btn-primary" onClick={() => navigate('/projects')}>
              <Plus size={15} />
              <span>Create Project</span>
            </button>
          </>
        }
      />

      {/* Intelligence Banner */}
      <Reveal direction="down" delay={40}>
        <div className="card p-4 bg-gradient-to-r from-primary/10 via-base-card to-cyan/10 border-primary/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg relative overflow-hidden">
          <ParallaxVisual strength={0.12} className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-cyan/15 blur-2xl" />
          <ParallaxVisual strength={-0.08} className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full bg-primary/15 blur-2xl" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary flex-shrink-0 shadow-[0_0_12px_rgba(139,92,246,0.25)]">
              <Zap size={18} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">Workforce Health Index</div>
              <div className="text-sm font-medium text-text-primary">
                {workloadDistribution[1]?.value} of {employees.length} employees operating at optimal balanced capacity
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/workforce-twin')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-base-bg/80 border border-base-border hover:border-primary/40 text-text-primary hover:text-white transition-all flex items-center gap-1.5"
            >
              Simulate Twin Scenarios
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </Reveal>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal delay={60} direction="up">
          <MetricCard
            label="Total Employees"
            value={employees.length}
            icon={<Users size={20} />}
            accent="primary"
            trend={{ value: 12, direction: 'up', label: 'vs last quarter' }}
          />
        </Reveal>
        <Reveal delay={120} direction="up">
          <MetricCard
            label="Active Projects"
            value={activeProjects.length}
            icon={<FolderKanban size={20} />}
            accent="cyan"
            trend={{ value: 8, direction: 'up', label: 'capacity scheduled' }}
          />
        </Reveal>
        <Reveal delay={180} direction="up">
          <MetricCard
            label="Available Capacity"
            value={availableEmployees.length}
            icon={<UserCheck size={20} />}
            accent="success"
            trend={{ value: Math.round((availableEmployees.length / Math.max(employees.length, 1)) * 100), direction: 'neutral', label: '% workforce open' }}
          />
        </Reveal>
        <Reveal delay={240} direction="up">
          <MetricCard
            label="Identified Skill Gaps"
            value={skillGaps.length}
            icon={<AlertTriangle size={20} />}
            accent="warning"
            trend={{ value: skillGaps.length, direction: skillGaps.length > 2 ? 'down' : 'neutral', label: 'across active pipelines' }}
          />
        </Reveal>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard
          title="Workforce Utilization Matrix"
          subtitle="Simulated current workload vs target baseline capacity (%)"
          className="lg:col-span-2"
          delay={100}
        >
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={utilizationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2745" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload;
                      return (
                        <div className="card p-3 shadow-2xl border border-base-border/80 text-xs">
                          <p className="font-semibold text-text-primary mb-1">{data?.fullName}</p>
                          <p className="text-primary font-medium">Utilization: {data?.utilization}%</p>
                          <p className="text-cyan font-medium">Target: {data?.target}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="utilization"
                  stroke="#8B5CF6"
                  strokeWidth={2.5}
                  fill="url(#utilGrad)"
                  name="Current"
                  isAnimationActive={true}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#22D3EE"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                  name="Target"
                  isAnimationActive={true}
                  animationDuration={1400}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-end gap-5 mt-2 pt-2 border-t border-base-border/40 text-xs">
            <div className="flex items-center gap-1.5 text-text-secondary">
              <span className="w-3 h-1 bg-primary rounded-full" /> Current Utilization
            </div>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <span className="w-3 h-0.5 border-t border-dashed border-cyan" /> Target Baseline
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Workload Balance"
          subtitle="Distribution of employee capacity statuses"
          delay={150}
        >
          <div className="h-[210px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={workloadDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={1200}
                >
                  {workloadDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="#171D33" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#171D33', borderColor: '#29324B', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-base-border/40 text-center">
            {workloadDistribution.map((d) => (
              <div key={d.name} className="p-1.5 rounded-lg bg-base-bg/60 border border-base-border/50">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[11px] text-text-secondary truncate">{d.name}</span>
                </div>
                <div className="text-base font-bold text-text-primary">{d.value}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard
          title="Project Staffing Fulfilment"
          subtitle="Current assigned headcounts versus target team sizes"
          className="lg:col-span-2"
          delay={180}
        >
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffingProgress} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2745" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} interval={0} angle={-10} textAnchor="end" tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload;
                      return (
                        <div className="card p-3 shadow-2xl border border-base-border/80 text-xs">
                          <p className="font-semibold text-text-primary mb-1">{data?.fullName}</p>
                          <p className="text-primary font-medium">Staffing Progress: {data?.progress}%</p>
                          <p className="text-text-secondary">Members: {data?.assigned} / {data?.target}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="progress"
                  fill="#8B5CF6"
                  radius={[6, 6, 0, 0]}
                  name="Progress %"
                  isAnimationActive={true}
                  animationDuration={1100}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Overloaded Employees */}
        <Reveal delay={220} direction="left">
          <div className="card p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-base-border/40">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-critical" />
                <h3 className="text-sm font-semibold text-text-primary">Overload Alerts</h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-critical/15 text-critical border border-critical/30">
                {overloadedEmployees.length} Critical
              </span>
            </div>
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[220px]">
              {overloadedEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-6 text-text-secondary">
                  <span className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success mb-2">✓</span>
                  <p className="text-xs">No employees exceeding thresholds.</p>
                </div>
              ) : (
                overloadedEmployees.slice(0, 5).map(({ employee, utilization }) => (
                  <div
                    key={employee.id}
                    onClick={() => navigate('/workload')}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-base-bg/60 border border-base-border/60 hover:border-critical/40 hover:bg-base-hover cursor-pointer transition-all duration-200"
                  >
                    <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-text-primary truncate">{employee.name}</div>
                      <div className="text-[11px] text-text-secondary truncate">{employee.role}</div>
                    </div>
                    <span className="text-xs font-bold text-critical font-mono bg-critical/10 px-2 py-0.5 rounded-md border border-critical/20">
                      {utilization}%
                    </span>
                  </div>
                ))
              )}
            </div>
            {overloadedEmployees.length > 0 && (
              <button
                onClick={() => navigate('/workload')}
                className="mt-3 w-full py-2 text-xs font-semibold text-primary hover:text-white bg-primary/10 hover:bg-primary/20 rounded-xl border border-primary/25 transition-all text-center flex items-center justify-center gap-1.5"
              >
                Rebalance Workload in Planner
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </Reveal>
      </div>

      {/* Activity + Recommended Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Reveal delay={240}>
          <div className="card p-5 h-full">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-base-border/40">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-cyan" />
                <h3 className="text-sm font-semibold text-text-primary">Real-Time Event Stream</h3>
              </div>
              <span className="text-[11px] text-text-secondary">{activities.length} logged</span>
            </div>
            <div className="space-y-3">
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} className="flex items-start gap-3 text-xs p-2.5 rounded-xl bg-base-bg/50 border border-base-border/40 hover:border-base-border transition-colors">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0 shadow-[0_0_6px_#8B5CF6]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary font-medium leading-relaxed">{act.message}</p>
                    <p className="text-[10px] text-text-secondary mt-1 font-mono">{formatTimestamp(act.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={280}>
          <div className="card p-5 h-full">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-base-border/40">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">Recommended Next Actions</h3>
              </div>
              <span className="text-[11px] text-primary font-medium">Algorithmic suggestions</span>
            </div>
            <div className="space-y-2.5">
              {recommendedActions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.action}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-base-bg/70 border border-base-border hover:border-primary/40 hover:bg-base-hover hover:shadow-md transition-all duration-200 text-left group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-text-primary group-hover:text-white transition-colors">
                      {action.message}
                    </div>
                    {action.badge && (
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${action.badgeColor}`}>
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-base-card border border-base-border flex items-center justify-center text-text-secondary group-hover:text-primary group-hover:border-primary/40 group-hover:translate-x-1 transition-all flex-shrink-0">
                    <ArrowRight size={14} />
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
