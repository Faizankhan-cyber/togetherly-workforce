import { useNavigate } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  UserCheck,
  AlertTriangle,
  Plus,
  Sparkles,
  TrendingUp,
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
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { CapacityBar } from '@/components/CapacityBar';
import {
  calculateEmployeeUtilization,
  getUtilizationStatus,
  getProjectStaffingProgress,
  getEmployeeProjects,
  getAllSkillGaps,
  getSkillName,
  formatTimestamp,
  getDepartmentStats,
} from '@/utils';
import { useData } from '@/context/DataContext';

export function DashboardPage() {
  const navigate = useNavigate();
  const { employees, projects, settings, activities } = useData();

  const activeProjects = projects.filter((p) => p.status === 'active');
  const availableEmployees = employees.filter((e) => e.availability === 'available');
  const skillGaps = getAllSkillGaps(projects, employees);

  const overloadedEmployees = employees
    .map((e) => ({
      employee: e,
      utilization: calculateEmployeeUtilization(e.id, projects, e.targetUtilization),
    }))
    .filter(({ utilization }) => getUtilizationStatus(utilization, settings) === 'overloaded')
    .sort((a, b) => b.utilization - a.utilization);

  const utilizationData = employees.map((e) => ({
    name: e.name.split(' ').slice(0, 2).map((n) => n[0]).join(''),
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
      name: p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name,
      progress: getProjectStaffingProgress(p),
      target: p.targetTeamSize,
      assigned: p.assignedEmployeeIds.length,
    }));

  const recommendedActions = [
    { message: `Cloud Infrastructure Migration needs ${Math.max(0, (projects.find(p => p.id === 'prj-003')?.targetTeamSize ?? 0) - (projects.find(p => p.id === 'prj-003')?.assignedEmployeeIds.length ?? 0))} more members`, action: () => navigate('/team-builder') },
    { message: `${overloadedEmployees.length} employees are overloaded — consider reassigning work`, action: () => navigate('/workload') },
    { message: `${skillGaps.length} skill gaps detected across active projects`, action: () => navigate('/skills') },
    { message: `${availableEmployees.length} employees available for new assignments`, action: () => navigate('/employees') },
  ];

  return (
    <div>
      <PageHeader
        title="Welcome back, Alex"
        description="Here's what's happening across your workforce today."
        breadcrumb={['Home', 'Dashboard']}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate('/team-builder')}>
              <Sparkles size={16} /> Generate Team
            </button>
            <button className="btn-primary" onClick={() => navigate('/projects')}>
              <Plus size={16} /> Create Project
            </button>
          </>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total Employees"
          value={employees.length}
          icon={<Users size={20} />}
          trend={{ value: 8, direction: 'up', label: 'vs last quarter' }}
          accent="primary"
        />
        <MetricCard
          label="Active Projects"
          value={activeProjects.length}
          icon={<FolderKanban size={20} />}
          trend={{ value: 12, direction: 'up', label: '2 starting this month' }}
          accent="cyan"
        />
        <MetricCard
          label="Available Employees"
          value={availableEmployees.length}
          icon={<UserCheck size={20} />}
          trend={{ value: 5, direction: 'down', label: '3 newly assigned' }}
          accent="success"
        />
        <MetricCard
          label="Skill Gaps"
          value={skillGaps.length}
          icon={<AlertTriangle size={20} />}
          trend={{ value: 15, direction: 'down', label: 'training in progress' }}
          accent="warning"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard
          title="Workforce Utilization"
          subtitle="Current vs target utilization per employee"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={utilizationData}>
              <defs>
                <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#29324B" />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} interval={0} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#171D33', border: '1px solid #29324B', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#F8FAFC' }}
              />
              <Area type="monotone" dataKey="utilization" stroke="#8B5CF6" strokeWidth={2} fill="url(#utilGrad)" name="Utilization" />
              <Area type="monotone" dataKey="target" stroke="#22D3EE" strokeWidth={1.5} strokeDasharray="5 5" fill="none" name="Target" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Workload Distribution" subtitle="Employee workload balance">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={workloadDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {workloadDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#171D33', border: '1px solid #29324B', borderRadius: '8px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {workloadDistribution.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-text-secondary">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard
          title="Project Staffing Progress"
          subtitle="Assigned vs target team size"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={staffingProgress}>
              <CartesianGrid strokeDasharray="3 3" stroke="#29324B" />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#171D33', border: '1px solid #29324B', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#F8FAFC' }}
              />
              <Bar dataKey="progress" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Staffing %" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Overloaded Employees */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-critical" />
            <h3 className="text-sm font-semibold text-text-primary">Overloaded Employees</h3>
          </div>
          <div className="space-y-3 max-h-[240px] overflow-y-auto">
            {overloadedEmployees.length === 0 && (
              <p className="text-sm text-text-secondary">No overloaded employees. Workforce is balanced.</p>
            )}
            {overloadedEmployees.slice(0, 5).map(({ employee, utilization }) => (
              <div key={employee.id} className="flex items-center gap-3">
                <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{employee.name}</div>
                  <div className="text-xs text-text-secondary truncate">{employee.role}</div>
                </div>
                <span className="text-sm font-semibold text-critical">{utilization}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity + Recommended Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-cyan" />
            <h3 className="text-sm font-semibold text-text-primary">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {activities.slice(0, 6).map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-text-primary">{act.message}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{formatTimestamp(act.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-text-primary">Recommended Actions</h3>
          </div>
          <div className="space-y-2">
            {recommendedActions.map((action, i) => (
              <button
                key={i}
                onClick={action.action}
                className="w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-base-bg border border-base-border hover:border-primary/30 transition-all duration-200 text-left group"
              >
                <span className="text-sm text-text-primary">{action.message}</span>
                <ArrowRight size={16} className="text-text-secondary group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
