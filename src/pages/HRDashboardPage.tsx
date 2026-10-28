import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { TinyFishLaunchCard } from '@/components/TinyFishLaunchCard';
import { RoleDashboardHero } from '@/components/RoleDashboardHero';
import { useData } from '@/context/DataContext';

type MetricTileProps = {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: 'blue' | 'violet' | 'amber' | 'teal';
};

const metricTone: Record<MetricTileProps['tone'], { icon: string; glow: string }> = {
  blue: { icon: 'bg-blue-50 text-blue-700', glow: 'border-blue-100' },
  violet: { icon: 'bg-violet-50 text-violet-700', glow: 'border-violet-100' },
  amber: { icon: 'bg-amber-50 text-amber-700', glow: 'border-amber-100' },
  teal: { icon: 'bg-teal-50 text-teal-700', glow: 'border-teal-100' },
};

function MetricTile({ label, value, detail, icon: Icon, tone }: MetricTileProps) {
  const palette = metricTone[tone];
  return (
    <section className={`card p-5 border ${palette.glow} transition-colors hover:border-primary/30`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-text-primary">{value.toLocaleString()}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${palette.icon}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-secondary">{detail}</p>
    </section>
  );
}

const hrActions = [
  {
    to: '/employees',
    label: 'Employee directory',
    description: 'Review employee records, departments, experience, and skills.',
    icon: Users,
    tone: 'text-blue-700 bg-blue-50',
  },
  {
    to: '/talent-verification',
    label: 'Talent verification',
    description: 'Review submitted skill, experience, and certification evidence.',
    icon: BadgeCheck,
    tone: 'text-violet-700 bg-violet-50',
  },
  {
    to: '/skills',
    label: 'Skills & training',
    description: 'Track learning plans and review training completion claims.',
    icon: GraduationCap,
    tone: 'text-teal-700 bg-teal-50',
  },
  {
    to: '/analytics',
    label: 'People analytics',
    description: 'Explore workforce capability, development, and people insights.',
    icon: Activity,
    tone: 'text-amber-700 bg-amber-50',
  },
];

export function HRDashboardPage() {
  const { employees, submissions, projects, activities } = useData();
  const activeEmployees = employees.filter((employee) => employee.employmentStatus !== 'offboarded');
  const pendingTraining = submissions.filter((submission) => submission.status === 'pending-verification');
  const profileAttention = activeEmployees.filter((employee) => employee.skills.length === 0 || employee.yearsExperience <= 0);
  const departments = activeEmployees.reduce<Record<string, number>>((counts, employee) => {
    const department = employee.department?.trim() || 'Unassigned';
    counts[department] = (counts[department] ?? 0) + 1;
    return counts;
  }, {});
  const departmentRows = Object.entries(departments).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const profilesReady = activeEmployees.filter((employee) => employee.skills.length > 0 && employee.yearsExperience > 0).length;
  const profileReadiness = Math.round((profilesReady / Math.max(activeEmployees.length, 1)) * 100);
  const roleDistribution = [
    { key: 'employee', label: 'Employees', color: 'bg-blue-500' },
    { key: 'manager', label: 'Managers', color: 'bg-violet-500' },
    { key: 'hr', label: 'HR', color: 'bg-teal-500' },
    { key: 'admin', label: 'Admins', color: 'bg-amber-500' },
  ].map((role) => ({ ...role, count: activeEmployees.filter((employee) => (employee.systemRole ?? 'employee') === role.key).length }));
  const activeLearningPlans = activeEmployees.reduce(
    (total, employee) => total + employee.trainingAssignments.filter((training) => training.status !== 'completed').length,
    0,
  );
  const activeProjects = projects.filter((project) => project.status === 'active').length;
  const recentActivities = [...activities].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Dashboard"
        description="People operations at a glance. Review workforce records, support employee development, and keep talent information up to date."
        breadcrumb={['People Operations', 'HR Dashboard']}
      />

      <RoleDashboardHero
        variant="hr"
        eyebrow="People operations"
        title="People first. Clear priorities."
        description={`Support ${activeEmployees.length} colleagues, keep talent profiles current, and move learning reviews forward from one people-operations workspace.`}
        to="/employees"
        actionLabel="Open employee directory"
        icon={Building2}
      />

      <TinyFishLaunchCard description="Explore skill trends, learning resources, hiring demand, and credible workforce research to support people operations." />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Active workforce" value={activeEmployees.length} detail="Employees currently on the workforce roster." icon={Users} tone="blue" />
        <MetricTile label="Departments" value={Object.keys(departments).filter((name) => name !== 'Unassigned').length} detail="Departments represented in active employee records." icon={Building2} tone="violet" />
        <MetricTile label="Claims awaiting review" value={pendingTraining.length} detail="Training completion claims waiting for verification." icon={ClipboardCheck} tone="amber" />
        <MetricTile label="Profiles to check" value={profileAttention.length} detail="Employee profiles missing skills or experience details." icon={AlertCircle} tone="teal" />
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text-primary">HR workbench</h2>
            <p className="mt-1 text-xs text-text-secondary">Jump straight into the main people workflows.</p>
          </div>
          <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-text-muted sm:inline">Quick access</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {hrActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.to} to={action.to} className="card group flex min-h-40 flex-col p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.tone}`}><Icon size={19} /></div>
                  <ArrowUpRight size={16} className="text-text-muted transition group-hover:text-primary" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-text-primary">{action.label}</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-text-secondary">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_1.35fr]">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Department snapshot</h2>
              <p className="mt-1 text-xs text-text-secondary">Headcount across the largest departments.</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><Building2 size={17} /></div>
          </div>
          {departmentRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-secondary">No active employee records yet.</div>
          ) : (
            <div className="mt-5 space-y-4">
              {departmentRows.map(([name, count]) => (
                <div key={name}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-semibold text-text-primary">{name}</span>
                    <span className="text-xs tabular-nums text-text-secondary">{count} <span className="text-text-muted">({Math.round((count / Math.max(activeEmployees.length, 1)) * 100)}%)</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-500" style={{ width: `${Math.round((count / Math.max(activeEmployees.length, 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-base-border pt-4">
            <span className="text-xs text-text-secondary">Active learning assignments</span>
            <span className="text-sm font-bold text-text-primary">{activeLearningPlans}</span>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-start justify-between gap-3 p-5 pb-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Employee profiles to review</h2>
              <p className="mt-1 text-xs text-text-secondary">People who may need support completing their talent profile.</p>
            </div>
            <Link to="/employees" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Directory <ArrowRight size={13} /></Link>
          </div>
          {profileAttention.length === 0 ? (
            <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 size={17} /> No profile gaps detected</div>
              <p className="mt-1 text-xs text-emerald-700">Active employee records include skills and experience information.</p>
            </div>
          ) : (
            <div className="divide-y divide-base-border">
              {profileAttention.slice(0, 5).map((employee) => (
                <div key={employee.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={employee.name} color={employee.avatarColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-text-primary">{employee.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-text-secondary">{employee.department} · {employee.role}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                    {employee.skills.length === 0 ? 'Add skills' : 'Add experience'}
                  </span>
                </div>
              ))}
              {profileAttention.length > 5 && <div className="px-5 py-3 text-center text-[11px] text-text-secondary">+{profileAttention.length - 5} more profiles need attention</div>}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Core profile readiness</h2>
              <p className="mt-1 text-xs text-text-secondary">Employee records with both skills and experience captured.</p>
            </div>
            <div className="rounded-lg bg-teal-50 p-2 text-teal-700"><CheckCircle2 size={17} /></div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-text-primary">{profileReadiness}%</p>
              <p className="mt-1 text-xs text-text-secondary">{profilesReady} of {activeEmployees.length} active profiles ready</p>
            </div>
            <Link to="/employees" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Review records <ArrowRight size={13} /></Link>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-blue-600 transition-all" style={{ width: `${profileReadiness}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-base-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Missing skills</p>
              <p className="mt-1.5 text-xl font-bold text-text-primary">{activeEmployees.filter((employee) => employee.skills.length === 0).length}</p>
            </div>
            <div className="rounded-lg border border-base-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Missing experience</p>
              <p className="mt-1.5 text-xl font-bold text-text-primary">{activeEmployees.filter((employee) => employee.yearsExperience <= 0).length}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Workforce composition</h2>
              <p className="mt-1 text-xs text-text-secondary">Current active roster by system role.</p>
            </div>
            <div className="rounded-lg bg-violet-50 p-2 text-violet-700"><Users size={17} /></div>
          </div>
          <div className="mt-5 space-y-4">
            {roleDistribution.map((role) => (
              <div key={role.key}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-text-primary">{role.label}</span>
                  <span className="text-xs tabular-nums text-text-secondary">{role.count} <span className="text-text-muted">({Math.round((role.count / Math.max(activeEmployees.length, 1)) * 100)}%)</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${role.color} transition-all`} style={{ width: `${Math.round((role.count / Math.max(activeEmployees.length, 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-base-border pt-3 text-[11px] leading-relaxed text-text-secondary">Role counts are based on the current roster records available to this workspace.</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Learning verification queue</h2>
              <p className="mt-1 text-xs text-text-secondary">Training claims that need a reviewer.</p>
            </div>
            <Link to="/skills" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open training <ArrowRight size={13} /></Link>
          </div>
          {pendingTraining.length === 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800"><CheckCircle2 size={15} className="mr-1.5 inline" /> No training claims are waiting for review.</div>
          ) : (
            <div className="mt-4 divide-y divide-base-border">
              {pendingTraining.slice(0, 4).map((submission) => (
                <div key={submission.id} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-700"><BookOpenCheck size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-text-primary">{submission.courseName}</p>
                    <p className="mt-1 truncate text-[11px] text-text-secondary">{submission.employeeName} · {submission.employeeDepartment}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">Pending</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Workforce pulse</h2>
              <p className="mt-1 text-xs text-text-secondary">A quick view of current operations.</p>
            </div>
            <div className="rounded-lg bg-violet-50 p-2 text-violet-700"><Activity size={17} /></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-base-border p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Active projects</p>
              <p className="mt-2 text-2xl font-extrabold text-text-primary">{activeProjects}</p>
              <p className="mt-1 text-[11px] text-text-secondary">Projects currently in progress</p>
            </div>
            <div className="rounded-xl border border-base-border p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Learning plans</p>
              <p className="mt-2 text-2xl font-extrabold text-text-primary">{activeLearningPlans}</p>
              <p className="mt-1 text-[11px] text-text-secondary">Assignments not yet completed</p>
            </div>
          </div>
          <div className="mt-4 border-t border-base-border pt-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-primary"><Activity size={14} className="text-violet-600" /> Recent workspace activity</div>
            {recentActivities.length === 0 ? (
              <p className="text-xs text-text-secondary">No recent activity recorded.</p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-text-secondary">{activity.message}</p>
                      <p className="mt-0.5 text-[10px] text-text-muted">{new Date(activity.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
