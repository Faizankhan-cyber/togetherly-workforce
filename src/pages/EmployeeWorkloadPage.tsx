import { BriefcaseBusiness, CalendarClock, Gauge, Target, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useData } from '@/context/DataContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { calculateEmployeeUtilization, formatDate, getEmployeeProjects, getUtilizationStatus, daysUntil } from '@/utils';

export function EmployeeWorkloadPage() {
  const employee = useCurrentEmployee();
  const { projects, settings } = useData();

  if (!employee) {
    return <div className="card p-8 text-center"><h2 className="font-semibold text-text-primary">Employee profile unavailable</h2><p className="mt-2 text-sm text-text-secondary">Your account must be linked to an approved employee profile before workload details can be shown.</p></div>;
  }

  const assignedProjects = getEmployeeProjects(employee.id, projects).filter((project) => project.status !== 'completed');
  const utilization = calculateEmployeeUtilization(employee.id, projects, employee.targetUtilization);
  const status = getUtilizationStatus(utilization, settings);
  const statusStyle = status === 'overloaded'
    ? 'border-critical/30 bg-critical/5 text-critical'
    : status === 'underutilized'
      ? 'border-cyan/30 bg-cyan/5 text-cyan'
      : 'border-success/30 bg-success/5 text-success';
  const statusLabel = status === 'overloaded' ? 'Capacity warning' : status === 'underutilized' ? 'Capacity available' : 'Workload balanced';

  return (
    <div className="space-y-6">
      <PageHeader title="My Workload" description="Understand your current project commitments, estimated utilization and remaining capacity." breadcrumb={['Home', 'My Workload']} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <section className="card p-5"><div className="flex items-center justify-between text-text-secondary"><span className="text-xs font-semibold uppercase tracking-wider">Estimated utilization</span><Gauge size={18} className="text-primary" /></div><div className="mt-3 text-3xl font-extrabold text-primary">{utilization}%</div><div className="mt-3 h-2 rounded-full bg-base-border overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }} /></div><p className="mt-2 text-xs text-text-secondary">Target utilization: {employee.targetUtilization}%</p></section>
        <section className="card p-5"><div className="flex items-center justify-between text-text-secondary"><span className="text-xs font-semibold uppercase tracking-wider">Active projects</span><BriefcaseBusiness size={18} className="text-cyan" /></div><div className="mt-3 text-3xl font-extrabold text-text-primary">{assignedProjects.length}</div><p className="mt-2 text-xs text-text-secondary">Projects currently assigned to you</p></section>
        <section className={`card p-5 border ${statusStyle}`}><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider">Capacity status</span><Target size={18} /></div><div className="mt-3 text-xl font-bold">{statusLabel}</div><p className="mt-2 text-xs opacity-80">Based on the workspace's configured utilization thresholds.</p>{status === 'overloaded' && <div className="mt-3 flex items-center gap-2 text-xs"><AlertTriangle size={14} />Consider discussing priorities with your manager.</div>}</section>
      </div>
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3 border-b border-base-border/60 pb-3"><div><h2 className="text-sm font-bold text-text-primary">Project commitments</h2><p className="mt-1 text-xs text-text-secondary">The active assignments contributing to your estimated workload.</p></div><CalendarClock size={18} className="text-primary" /></div>
        {assignedProjects.length === 0 ? <div className="py-10 text-center"><BriefcaseBusiness size={28} className="mx-auto text-text-muted"/><p className="mt-3 text-sm font-semibold text-text-primary">No active assignments</p><p className="mt-1 text-xs text-text-secondary">New project assignments will appear here after they are linked to your employee profile.</p></div> : <div className="mt-4 space-y-3">{assignedProjects.map((project) => { const days = daysUntil(project.deadline); return <article key={project.id} className="rounded-xl border border-base-border/70 bg-base-bg/50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-bold text-text-primary">{project.name}</h3><p className="mt-1 text-xs text-text-secondary leading-relaxed">{project.description}</p></div><StatusBadge status={project.status}/></div><div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-text-secondary"><span className="inline-flex items-center gap-1.5"><CalendarClock size={13}/>{formatDate(project.deadline)}</span><span>{days >= 0 ? `${days} days remaining` : `${Math.abs(days)} days overdue`}</span><span>Team size: {project.assignedEmployeeIds.length}/{project.targetTeamSize}</span></div></article>; })}</div>}
      </section>
      <p className="text-[11px] text-text-secondary">Utilization is a planning estimate based on active assignments and your target utilization. It is not a timesheet or a measurement of hours actually worked. For workload concerns, discuss adjustments with your manager.</p>
      <div><Link className="text-xs font-semibold text-primary hover:underline" to="/my-projects">Review my project details →</Link></div>
    </div>
  );
}
