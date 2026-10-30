import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  GitCompareArrows,
  GitFork,
  GraduationCap,
  Lightbulb,
  FileBarChart,
  Map,
  UsersRound,
  LockKeyhole,
  Settings,
  ShieldCheck,
  Users,
  UserCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { TinyFishLaunchCard } from '@/components/TinyFishLaunchCard';
import { RoleDashboardHero } from '@/components/RoleDashboardHero';
import { useData } from '@/context/DataContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AdminMetricProps = {
  label: string;
  value: number | string;
  caption: string;
  icon: LucideIcon;
  tone: 'blue' | 'violet' | 'teal' | 'amber';
};

const metricTones: Record<AdminMetricProps['tone'], { icon: string; border: string }> = {
  blue: { icon: 'bg-blue-50 text-blue-700', border: 'border-blue-100' },
  violet: { icon: 'bg-violet-50 text-violet-700', border: 'border-violet-100' },
  teal: { icon: 'bg-teal-50 text-teal-700', border: 'border-teal-100' },
  amber: { icon: 'bg-amber-50 text-amber-700', border: 'border-amber-100' },
};

function AdminMetric({ label, value, caption, icon: Icon, tone }: AdminMetricProps) {
  const palette = metricTones[tone];
  return (
    <section className={`card border ${palette.border} p-5 transition-colors hover:border-primary/30`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-text-primary">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${palette.icon}`}><Icon size={19} /></div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-secondary">{caption}</p>
    </section>
  );
}

const adminActions = [
  { to: '/admin/employee-requests', label: 'Employee approvals', description: 'Review and decide on requests to join the organization.', icon: UserCheck, tone: 'text-blue-700 bg-blue-50' },
  { to: '/admin/manage-admins', label: 'Admin access', description: 'Review administrators and safely revoke elevated access.', icon: ShieldCheck, tone: 'text-violet-700 bg-violet-50' },
  { to: '/employees', label: 'Workforce directory', description: 'Open employee records and review the active roster.', icon: Users, tone: 'text-teal-700 bg-teal-50' },
  { to: '/analytics', label: 'Organization analytics', description: 'Inspect workforce insights and organizational reporting.', icon: BarChart3, tone: 'text-amber-700 bg-amber-50' },
  { to: '/settings', label: 'Workspace settings', description: 'Review organization-wide workspace configuration.', icon: Settings, tone: 'text-slate-700 bg-slate-100' },
];

const adminOperationalTools = [
  { to: '/team-builder', label: 'Team Builder', description: 'Build balanced teams based on skills, experience, availability, and workload.', icon: UsersRound, tone: 'text-blue-700 bg-blue-50' },
  { to: '/workforce-twin', label: 'Workforce Twin', description: 'Explore workforce structure and evaluate alternative team configurations.', icon: GitCompareArrows, tone: 'text-violet-700 bg-violet-50' },
  { to: '/scenarios', label: 'Scenario Simulator', description: 'Compare staffing scenarios before making organization-wide changes.', icon: GitFork, tone: 'text-indigo-700 bg-indigo-50' },
  { to: '/workload', label: 'Workload Planner', description: 'Review capacity, utilization, and workload balance across the workforce.', icon: BarChart3, tone: 'text-teal-700 bg-teal-50' },
  { to: '/opportunities', label: 'Opportunity Finder', description: 'Spot opportunities to match employee strengths with project needs.', icon: Lightbulb, tone: 'text-amber-700 bg-amber-50' },
  { to: '/impact-report', label: 'Allocation Impact', description: 'Review the projected impact of workforce allocation decisions.', icon: FileBarChart, tone: 'text-rose-700 bg-rose-50' },
  { to: '/skills', label: 'Skills & Training', description: 'Review skill coverage, development needs, and training opportunities.', icon: GraduationCap, tone: 'text-cyan-700 bg-cyan-50' },
  { to: '/roadmap', label: 'Development Roadmap', description: 'Explore structured employee development and growth plans.', icon: Map, tone: 'text-emerald-700 bg-emerald-50' },
  { to: '/talent-verification', label: 'Talent Verification', description: 'Review and verify employee talent and profile information.', icon: BadgeCheck, tone: 'text-slate-700 bg-slate-100' },
];

const systemRoles = [
  { key: 'employee', label: 'Employees', color: 'bg-blue-500' },
  { key: 'manager', label: 'Managers', color: 'bg-violet-500' },
  { key: 'hr', label: 'HR', color: 'bg-teal-500' },
  { key: 'admin', label: 'Administrators', color: 'bg-amber-500' },
] as const;

const projectStatuses = [
  { key: 'active', label: 'Active', dot: 'bg-emerald-500' },
  { key: 'planning', label: 'Planning', dot: 'bg-blue-500' },
  { key: 'on-hold', label: 'On hold', dot: 'bg-amber-500' },
  { key: 'completed', label: 'Completed', dot: 'bg-slate-400' },
] as const;

export function AdminDashboardPage() {
  const { employees, projects, activities } = useData();
  const [pendingRequests, setPendingRequests] = useState<number | null>(null);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured()) {
      setPendingRequests(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from('employee_registration_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count, error }) => {
        if (!cancelled) setPendingRequests(error ? null : (count ?? 0));
      });
    return () => { cancelled = true; };
  }, []);

  // Admin overview metrics use only the verified database-backed roster, not demo fixtures.
  const roster = useMemo(
    () => employees.filter((employee) => employee.dataSource === 'database' && employee.employmentStatus !== 'offboarded'),
    [employees],
  );
  const linkedAccounts = roster.filter((employee) => Boolean(employee.authUserId)).length;
  const administrators = roster.filter((employee) => employee.systemRole === 'admin');
  const departments = new Set(roster.map((employee) => employee.department.trim()).filter(Boolean));
  const activeProjects = projects.filter((project) => project.status === 'active');
  const projectCounts = projectStatuses.map((status) => ({ ...status, count: projects.filter((project) => project.status === status.key).length }));
  const roleCounts = systemRoles.map((role) => ({ ...role, count: roster.filter((employee) => (employee.systemRole ?? 'employee') === role.key).length }));
  const recentActivities = [...activities].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
  const unlinkedRecords = roster.filter((employee) => !employee.authUserId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Control Center"
        description="A clearer view of workforce records, organization activity, and access governance."
        breadcrumb={['Administration', 'Overview']}
      />

      <RoleDashboardHero
        variant="admin"
        eyebrow="Administrator workspace"
        title="Govern the workspace with confidence."
        description="Keep employee onboarding, administrator access, and organization-wide visibility in one focused control center."
        to="/admin/manage-admins"
        actionLabel="Manage admin access"
        icon={LockKeyhole}
      />

      <TinyFishLaunchCard description="Research organization-wide technology trends, workforce benchmarks, public sources, and strategic questions that support better decisions." />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Active workforce" value={roster.length} caption="Active database-backed employee records." icon={Users} tone="blue" />
        <AdminMetric label="Linked accounts" value={linkedAccounts} caption="Active employee records connected to a sign-in identity." icon={UserCheck} tone="teal" />
        <AdminMetric label="Join requests" value={pendingRequests === null ? '—' : pendingRequests} caption={pendingRequests === null ? 'Registration queue could not be read.' : 'New employee requests awaiting an administrator decision.'} icon={ClipboardCheck} tone="amber" />
        <AdminMetric label="Administrator accounts" value={administrators.length} caption="Administrators in the active database-backed roster." icon={ShieldCheck} tone="violet" />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-text-primary">Administration workbench</h2>
          <p className="mt-1 text-xs text-text-secondary">Key organization and access workflows, grouped in one place.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {adminActions.map((action) => {
            const Icon = action.icon;
            const isApprovals = action.to === '/admin/employee-requests';
            const isAccess = action.to === '/admin/manage-admins';
            const meta = isApprovals && pendingRequests !== null
              ? `${pendingRequests} pending`
              : isAccess
                ? `${administrators.length} active admin${administrators.length === 1 ? '' : 's'}`
                : null;
            return (
              <Link key={action.to} to={action.to} className="card group flex min-h-44 flex-col p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.tone}`}><Icon size={19} /></div>
                  <ArrowUpRight size={16} className="text-text-muted transition group-hover:text-primary" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-text-primary">{action.label}</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-text-secondary">{action.description}</p>
                {meta && <span className="mt-3 w-fit rounded-full border border-base-border bg-base-subtle px-2 py-1 text-[10px] font-semibold text-text-secondary">{meta}</span>}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">Workforce intelligence & optimization</h2>
            <p className="mt-1 text-xs text-text-secondary">The full operational toolkit is available to administrators alongside organization controls.</p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">9 tools</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {adminOperationalTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.to} to={tool.to} className="card group flex min-h-28 items-start gap-3 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tool.tone}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-text-primary">{tool.label}</h3>
                    <ArrowUpRight size={15} className="shrink-0 text-text-muted transition group-hover:text-primary" />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">{tool.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {pendingRequests !== null && pendingRequests > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2 text-amber-700"><UserCheck size={18} /></div>
            <div>
              <h2 className="text-sm font-bold text-amber-950">Employee requests need review</h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-900">There {pendingRequests === 1 ? 'is' : 'are'} {pendingRequests} pending join request{pendingRequests === 1 ? '' : 's'} in the approval queue.</p>
            </div>
          </div>
          <Link to="/admin/employee-requests" className="inline-flex w-fit items-center gap-1 text-xs font-bold text-amber-900 hover:underline">Review requests <ArrowRight size={13} /></Link>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Workforce access composition</h2>
              <p className="mt-1 text-xs text-text-secondary">Active role counts from linked database records.</p>
            </div>
            <div className="rounded-lg bg-violet-50 p-2 text-violet-700"><Building2 size={17} /></div>
          </div>
          <div className="mt-5 space-y-4">
            {roleCounts.map((role) => (
              <div key={role.key}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-text-primary">{role.label}</span>
                  <span className="text-xs tabular-nums text-text-secondary">{role.count} <span className="text-text-muted">({Math.round((role.count / Math.max(roster.length, 1)) * 100)}%)</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${role.color} transition-all`} style={{ width: `${Math.round((role.count / Math.max(roster.length, 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-base-border pt-4">
            <div className="rounded-lg border border-base-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Departments</p>
              <p className="mt-1.5 text-xl font-extrabold text-text-primary">{departments.size}</p>
            </div>
            <div className="rounded-lg border border-base-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Unlinked records</p>
              <p className="mt-1.5 text-xl font-extrabold text-text-primary">{unlinkedRecords}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Workspace project portfolio</h2>
              <p className="mt-1 text-xs text-text-secondary">Project records grouped by their current status.</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><FolderKanban size={17} /></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            {projectCounts.map((status) => (
              <div key={status.key} className="rounded-xl border border-base-border p-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                  <span className="text-[11px] font-semibold text-text-secondary">{status.label}</span>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-text-primary">{status.count}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-base-subtle p-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-white p-2 text-emerald-700"><CheckCircle2 size={15} /></div>
              <div>
                <p className="text-xs font-semibold text-text-primary">{activeProjects.length} active project{activeProjects.length === 1 ? '' : 's'}</p>
                <p className="mt-0.5 text-[10px] text-text-secondary">Currently marked in progress</p>
              </div>
            </div>
            <Link to="/projects" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">View portfolio <ArrowRight size={12} /></Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Access governance</h2>
              <p className="mt-1 text-xs text-text-secondary">Keep elevated access intentional and reviewable.</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><LockKeyhole size={17} /></div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-base-border p-3.5">
              <div className="rounded-lg bg-violet-50 p-2 text-violet-700"><ShieldCheck size={16} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-text-primary">Administrator membership</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">Review current administrators and demote access when responsibilities change. The last active administrator and self-removal are protected by the access-management workflow.</p>
                <Link to="/admin/manage-admins" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Review administrators <ArrowRight size={12} /></Link>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-base-border p-3.5">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><BadgeCheck size={16} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-text-primary">Employee identity review</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">Use approval records to ensure incoming users are linked to the correct workforce identity before they get workspace access.</p>
                <Link to="/admin/employee-requests" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open approval queue <ArrowRight size={12} /></Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 border-b border-base-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Recent workspace activity</h2>
              <p className="mt-1 text-xs text-text-secondary">Latest recorded workspace events.</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-700"><Activity size={17} /></div>
          </div>
          {recentActivities.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-secondary">No activity has been recorded yet.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed text-text-primary">{activity.message}</p>
                    <p className="mt-1 text-[10px] text-text-muted">{new Date(activity.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
