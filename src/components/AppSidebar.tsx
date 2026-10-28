import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  UsersRound,
  GraduationCap,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  GitCompareArrows,
  Lightbulb,
  FileBarChart,
  Map,
  UserRound,
  BriefcaseBusiness,
  Layers,
  GitFork,
  UserCheck,
  Lock,
  ShieldCheck,
  Sparkles,
  Gauge,
  BrainCircuit,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from './Avatar';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { LogOut } from 'lucide-react';
import type { Role } from '@/types';

type SidebarNavItem = { to: string; label: string; icon: LucideIcon };
type SidebarNavGroup = { name: string; items: SidebarNavItem[] };

const managerNavGroups: SidebarNavGroup[] = [
  {
    name: 'Workspace',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/employees', label: 'Employees', icon: Users },
      { to: '/projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    name: 'Intelligence & Optimization',
    items: [
      { to: '/team-builder', label: 'Team Builder', icon: UsersRound },
      { to: '/workforce-twin', label: 'Workforce Twin', icon: GitCompareArrows },
      { to: '/scenarios', label: 'Scenario Simulator', icon: GitFork },
      { to: '/workload', label: 'Workload Planner', icon: BarChart3 },
      { to: '/opportunities', label: 'Opportunity Finder', icon: Lightbulb },
      { to: '/impact-report', label: 'Allocation Impact', icon: FileBarChart },
    ],
  },
  {
    name: 'People & Development',
    items: [
      { to: '/skills', label: 'Skills & Training', icon: GraduationCap },
      { to: '/roadmap', label: 'Development Roadmap', icon: Map },
      { to: '/my-profile', label: 'My Profile', icon: UserRound },
    ],
  },
  {
    name: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
    ],
  },
];

// TinyFish Intelligence is intentionally a standalone top-level destination.
const tinyFishNavItem: SidebarNavItem = {
  to: '/intelligence',
  label: 'TinyFish AI',
  icon: Sparkles,
};

const managerAdministrationItems: SidebarNavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/talent-verification', label: 'Talent Verification', icon: UserCheck },
];

const adminNavGroups: SidebarNavGroup[] = managerNavGroups.map((group) =>
  group.name === 'Workspace'
    ? {
        ...group,
        items: group.items.map((item) =>
          item.to === '/' ? { ...item, label: 'Admin Overview' } : item,
        ),
      }
    : group,
);

const adminExtraNavItems: SidebarNavItem[] = [
  { to: '/admin/employee-requests', label: 'Employee Approvals', icon: UserCheck },
  { to: '/admin/manage-admins', label: 'Admin Access', icon: ShieldCheck },
];

const hrNavItems: SidebarNavItem[] = [
  { to: '/', label: 'HR Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employee Directory', icon: Users },
  { to: '/talent-verification', label: 'Talent Verification', icon: UserCheck },
  { to: '/skills', label: 'Skills & Training', icon: GraduationCap },
  { to: '/roadmap', label: 'Development Roadmap', icon: Map },
  { to: '/my-profile', label: 'My Profile', icon: UserRound },
  { to: '/analytics', label: 'People Analytics', icon: BarChart3 },
  tinyFishNavItem,
];

const employeeNavItems: SidebarNavItem[] = [
  { to: '/', label: 'My Dashboard', icon: LayoutDashboard },
  { to: '/my-projects', label: 'My Projects', icon: FolderKanban },
  { to: '/my-workload', label: 'My Workload', icon: Gauge },
  { to: '/my-skills', label: 'My Skills', icon: BrainCircuit },
  { to: '/roadmap', label: 'My Development', icon: GraduationCap },
  { to: '/my-settings', label: 'My Settings', icon: Settings },
  { to: '/my-profile', label: 'My Profile', icon: UserRound },
  tinyFishNavItem,
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: AppSidebarProps) {
  const { employees, role, setRole, submissions } = useData();
  const { user, isAdmin, isDemoMode, identityStatus, mappedEmployee, signOut, exitDemoMode, systemRole } = useAuth();
  const workspaceRole = !user && isDemoMode ? role : systemRole;
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Workspace: true,
    'Intelligence & Optimization': workspaceRole === 'admin',
    'People & Development': workspaceRole === 'admin',
    Insights: workspaceRole === 'admin',
    Administration: workspaceRole === 'admin',
    'My Work': true,
    'Growth & Profile': false,
  });
  const demoProfile = employees.find((employee) => employee.id === 'emp-001');
  const authenticatedProfile = user && identityStatus === 'mapped' && mappedEmployee?.authUserId === user.id
    ? (employees.find((employee) => employee.authUserId === user.id) ?? mappedEmployee)
    : null;
  const profile = user ? authenticatedProfile : demoProfile;
  const navItems = employeeNavItems;
  const pendingCount = submissions.filter((s) => s.status === 'pending-verification').length;
  // Visible to authenticated users whose verified database-backed system role is 'admin'
  // (and visible as a locked gateway link when in unauthenticated Demo Mode so users can access admin sign-in).
  // Strictly hidden for any authenticated non-admin employee (user && !isAdmin).
  const showAdminSection = isAdmin || (isDemoMode && !user);

  useEffect(() => {
    if (workspaceRole === 'employee') {
      const employeeGroup = location.pathname === '/my-projects' || location.pathname === '/my-workload'
        ? 'My Work'
        : location.pathname === '/my-skills' || location.pathname === '/roadmap' || location.pathname === '/my-profile'
          ? 'Growth & Profile'
          : null;
      if (employeeGroup) {
        setExpandedGroups((previous) => ({ ...previous, [employeeGroup]: true }));
      }
      return;
    }

    const activeGroup = managerNavGroups.find((group) => group.items.some((item) => item.to === location.pathname));
    if (activeGroup) {
      setExpandedGroups((previous) => ({ ...previous, [activeGroup.name]: true }));
      return;
    }
    if (managerAdministrationItems.some((item) => item.to === location.pathname) || location.pathname === '/admin/employee-requests' || location.pathname === '/admin/manage-admins') {
      setExpandedGroups((previous) => ({ ...previous, Administration: true }));
    }
  }, [location.pathname, workspaceRole]);

  function renderNavItem(item: SidebarNavItem, featured = false) {
    const Icon = item.icon;
    const hasPending = item.to === '/skills' && pendingCount > 0;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/'}
        onClick={onCloseMobile}
        className={({ isActive }) =>
          `relative flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
            isActive
              ? (featured ? 'bg-violet-50/70 text-violet-800 font-semibold border-l-2 border-violet-500' : 'bg-primary-50 text-primary font-semibold border-l-2 border-primary')
              : (featured ? 'text-violet-700 hover:bg-violet-50/70' : 'text-text-secondary hover:text-text-primary hover:bg-base-hover')
          } ${collapsed ? 'justify-center px-2' : ''}`
        }
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
      >
        {({ isActive }) => (
          <>
            <Icon size={16} className={`flex-shrink-0 ${isActive ? (featured ? 'text-violet-700' : 'text-primary') : (featured ? 'text-violet-600' : 'text-text-secondary')}`} />
            {!collapsed && <span className="truncate flex-1">{item.label}</span>}
            {hasPending && !collapsed && <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white">{pendingCount}</span>}
            {hasPending && collapsed && <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5 ring-2 ring-white" />}
          </>
        )}
      </NavLink>
    );
  }

  function changeRole(nextRole: Role) {
    setRole(nextRole);
    navigate('/');
    onCloseMobile();
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-sm animate-fade-in"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-base-border z-40 transition-all duration-200 flex flex-col shadow-sm ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Togetherly brand header */}
        <div className={`flex items-center gap-2.5 h-14 px-4 border-b border-base-border flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 text-white">
            <Layers size={17} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-xs font-bold tracking-tight text-text-primary leading-none">
                Togetherly
              </div>
              <div className="text-[10px] text-text-secondary leading-tight mt-0.5 font-medium">Workforce Intelligence</div>
            </div>
          )}
        </div>

        {/* Navigation: grouped for managers, focused personal menu for employees. */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {workspaceRole === 'admin' ? (
            <>
              {collapsed ? (
                <>
                  {adminNavGroups.flatMap((group) => group.items).map((item) => renderNavItem(item))}
                  <div className="my-2 border-y border-base-border/80 py-1">
                    {renderNavItem(tinyFishNavItem, true)}
                  </div>
                  {managerAdministrationItems.map((item) => renderNavItem(item))}
                  <div className="my-2 border-t border-base-border" />
                  {isAdmin && adminExtraNavItems.map((item) => renderNavItem(item))}
                </>
              ) : (
                <>
                  {adminNavGroups.slice(0, 2).map((group) => {
                    const isExpanded = expandedGroups[group.name] ?? false;
                    const hasActiveChild = group.items.some((item) => item.to === location.pathname);
                    return (
                      <section key={group.name} className="mb-1">
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${hasActiveChild ? 'text-primary' : 'text-text-muted hover:bg-base-hover hover:text-text-primary'}`}
                          onClick={() => setExpandedGroups((previous) => ({ ...previous, [group.name]: !isExpanded }))}
                          aria-expanded={isExpanded}
                        >
                          <span>{group.name}</span>
                          <ChevronDown size={13} className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </button>
                        {isExpanded && <div className="space-y-0.5">{group.items.map((item) => renderNavItem(item))}</div>}
                      </section>
                    );
                  })}
                  <div className="my-2 border-y border-base-border/80 py-1">
                    {renderNavItem(tinyFishNavItem, true)}
                  </div>
                  {adminNavGroups.slice(2).map((group) => {
                    const isExpanded = expandedGroups[group.name] ?? false;
                    const hasActiveChild = group.items.some((item) => item.to === location.pathname);
                    return (
                      <section key={group.name} className="mb-1">
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${hasActiveChild ? 'text-primary' : 'text-text-muted hover:bg-base-hover hover:text-text-primary'}`}
                          onClick={() => setExpandedGroups((previous) => ({ ...previous, [group.name]: !isExpanded }))}
                          aria-expanded={isExpanded}
                        >
                          <span>{group.name}</span>
                          <ChevronDown size={13} className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </button>
                        {isExpanded && <div className="space-y-0.5">{group.items.map((item) => renderNavItem(item))}</div>}
                      </section>
                    );
                  })}
                  <section className="mt-2 border-t border-base-border pt-2">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${managerAdministrationItems.some((item) => item.to === location.pathname) || adminExtraNavItems.some((item) => item.to === location.pathname) ? 'text-primary bg-primary-50/70' : 'text-text-muted hover:bg-base-hover hover:text-text-primary'}`}
                      onClick={() => setExpandedGroups((previous) => ({ ...previous, Administration: !previous.Administration }))}
                      aria-expanded={expandedGroups.Administration}
                    >
                      <span>Administration</span>
                      <ChevronDown size={13} className={`transition-transform ${expandedGroups.Administration ? '' : '-rotate-90'}`} />
                    </button>
                    {expandedGroups.Administration && (
                      <div className="space-y-0.5">
                        {managerAdministrationItems.map((item) => renderNavItem(item))}
                        {isAdmin && (
                          <div className="mt-2 border-t border-base-border pt-2">
                            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Admin Controls</div>
                            {adminExtraNavItems.map((item) => renderNavItem(item))}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          ) : workspaceRole === 'hr' ? (
            <>
              {hrNavItems.map((item) => renderNavItem(item))}
            </>
          ) : workspaceRole === 'manager' ? (
            <>
              {collapsed ? (
                <>
                  {managerNavGroups.flatMap((group) => group.items).map((item) => renderNavItem(item))}
                  <div className="my-2 border-t border-violet-100" />
                  {renderNavItem(tinyFishNavItem, true)}
                  {managerAdministrationItems.map((item) => renderNavItem(item))}
                  {showAdminSection && renderNavItem({ to: '/admin/employee-requests', label: 'Employee Verification', icon: UserCheck })}
                  {isAdmin && renderNavItem({ to: '/admin/manage-admins', label: 'Admin Access', icon: ShieldCheck })}
                </>
              ) : (
                <>
                  {managerNavGroups.slice(0, 2).map((group) => {
                    const isExpanded = expandedGroups[group.name] ?? false;
                    const hasActiveChild = group.items.some((item) => item.to === location.pathname);
                    return (
                      <section key={group.name} className="mb-1">
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${hasActiveChild ? 'text-primary' : 'text-text-muted hover:bg-base-hover hover:text-text-primary'}`}
                          onClick={() => setExpandedGroups((previous) => ({ ...previous, [group.name]: !isExpanded }))}
                          aria-expanded={isExpanded}
                        >
                          <span>{group.name}</span>
                          <ChevronDown size={13} className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </button>
                        {isExpanded && <div className="space-y-0.5">{group.items.map((item) => renderNavItem(item))}</div>}
                      </section>
                    );
                  })}
                  <div className="my-2 border-y border-base-border/80 py-1">
                    {renderNavItem(tinyFishNavItem, true)}
                  </div>
                  {managerNavGroups.slice(2).map((group) => {
                    const isExpanded = expandedGroups[group.name] ?? false;
                    const hasActiveChild = group.items.some((item) => item.to === location.pathname);
                    return (
                      <section key={group.name} className="mb-1">
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${hasActiveChild ? 'text-primary' : 'text-text-muted hover:bg-base-hover hover:text-text-primary'}`}
                          onClick={() => setExpandedGroups((previous) => ({ ...previous, [group.name]: !isExpanded }))}
                          aria-expanded={isExpanded}
                        >
                          <span>{group.name}</span>
                          <ChevronDown size={13} className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </button>
                        {isExpanded && <div className="space-y-0.5">{group.items.map((item) => renderNavItem(item))}</div>}
                      </section>
                    );
                  })}
                  <section className="mt-2 border-t border-base-border pt-2">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${managerAdministrationItems.some((item) => item.to === location.pathname) || location.pathname === '/admin/employee-requests' || location.pathname === '/admin/manage-admins' ? 'text-primary' : 'text-text-muted hover:bg-base-hover hover:text-text-primary'}`}
                      onClick={() => setExpandedGroups((previous) => ({ ...previous, Administration: !previous.Administration }))}
                      aria-expanded={expandedGroups.Administration}
                    >
                      <span>Administration</span>
                      <ChevronDown size={13} className={`transition-transform ${expandedGroups.Administration ? '' : '-rotate-90'}`} />
                    </button>
                    {expandedGroups.Administration && <div className="space-y-0.5">
                      {managerAdministrationItems.map((item) => renderNavItem(item))}
                      {showAdminSection && <>
                        {!collapsed && <div className="px-3 pt-2 pb-1 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Admin Portal</span>{isAdmin ? <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Admin</span> : <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200"><Lock size={9}/> Auth</span>}</div>}
                        <NavLink to="/admin/employee-requests" onClick={onCloseMobile} title={collapsed ? 'Employee Verification' : undefined} className={({isActive}) => `relative flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${isActive ? 'bg-primary-50 text-primary font-semibold border-l-2 border-primary' : 'text-text-secondary hover:text-text-primary hover:bg-base-hover'} ${collapsed ? 'justify-center px-2' : ''}`}>
                          {({isActive}) => <><UserCheck size={16} className={isActive ? 'text-primary' : 'text-text-secondary'}/>{!collapsed && <span className="truncate flex-1">Employee Verification</span>}</>}
                        </NavLink>
                        {isAdmin && renderNavItem({ to: '/admin/manage-admins', label: 'Admin Access', icon: ShieldCheck })}
                      </>}
                    </div>}
                  </section>
                </>
              )}
            </>
          ) : (
            <>
              {collapsed ? (
                <>
                  {employeeNavItems.filter((item) => item.to !== '/my-settings').map((item) => renderNavItem(item))}
                  <div className="my-2 border-t border-base-border" />
                  {renderNavItem(employeeNavItems.find((item) => item.to === '/my-settings')!)}
                </>
              ) : (
                <>
                  {/* Personal dashboard remains directly visible at the top. */}
                  {renderNavItem(employeeNavItems.find((item) => item.to === '/')!)}

                  {[{
                    name: 'My Work',
                    items: employeeNavItems.filter((item) => ['/my-projects', '/my-workload'].includes(item.to)),
                  }, {
                    name: 'Growth & Profile',
                    items: employeeNavItems.filter((item) => ['/my-skills', '/roadmap', '/my-profile'].includes(item.to)),
                  }].map((group) => {
                    const isExpanded = expandedGroups[group.name] ?? false;
                    const hasActiveChild = group.items.some((item) => item.to === location.pathname);
                    return (
                      <section key={group.name} className="mb-1">
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${hasActiveChild ? 'text-primary' : 'text-text-muted hover:bg-base-hover hover:text-text-primary'}`}
                          onClick={() => setExpandedGroups((previous) => ({ ...previous, [group.name]: !isExpanded }))}
                          aria-expanded={isExpanded}
                        >
                          <span>{group.name}</span>
                          <ChevronDown size={13} className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </button>
                        {isExpanded && <div className="space-y-0.5">{group.items.map((item) => renderNavItem(item))}</div>}
                      </section>
                    );
                  })}

                  {/* TinyFish AI and personal settings stay directly accessible. */}
                  <section className="mt-2 border-t border-base-border pt-2">
                    {renderNavItem(tinyFishNavItem, true)}
                    {renderNavItem(employeeNavItems.find((item) => item.to === '/my-settings')!)}
                  </section>
                </>
              )}
              {showAdminSection && <div className="mt-3 border-t border-base-border pt-2">
                {!collapsed && <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Administration</div>}
                {renderNavItem({to:'/admin/employee-requests',label:'Employee Verification',icon:UserCheck})}
                {isAdmin && renderNavItem({to:'/admin/manage-admins',label:'Admin Access',icon:ShieldCheck})}
              </div>}
            </>
          )}
        </nav>

        {/* Demo-only role switcher. Authenticated accounts use their verified database role. */}
        {!user && (
          <div className={`p-2.5 border-t border-base-border bg-base-subtle ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
            {!collapsed && (
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  Demo Workspace Role
                </span>
                <span className="text-[9px] text-text-muted font-normal">
                  Preview Only
                </span>
              </div>
            )}
            <div className={collapsed ? 'flex flex-col gap-1' : 'grid grid-cols-2 gap-1 rounded-md border border-base-border bg-gray-100 p-0.5'}>
              {([
                { value: 'manager', label: 'Manager', icon: BriefcaseBusiness },
                { value: 'employee', label: 'Employee', icon: UserRound },
                { value: 'admin', label: 'Admin', icon: ShieldCheck },
                { value: 'hr', label: 'HR', icon: UserCheck },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeRole(value)}
                  aria-pressed={role === value}
                  title={collapsed ? `${label} Demo View` : undefined}
                  className={`flex items-center gap-1.5 rounded py-1 px-2 text-[11px] font-semibold transition-all ${
                    collapsed ? 'justify-center w-8 h-8' : 'justify-center'
                  } ${
                    role === value
                      ? 'bg-white text-primary shadow-sm border border-base-border'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
                  }`}
                >
                  <Icon size={13} />
                  {!collapsed && label}
                </button>
              ))}
            </div>
            {!collapsed && (
              <p className="text-[9.5px] text-text-muted mt-1 text-center font-normal leading-tight">
                Demo preview only; signed-in role comes from your account.
              </p>
            )}
          </div>
        )}

        {/* User profile & Session control */}
        <div className={`p-2 border-t border-base-border flex-shrink-0 bg-white ${collapsed ? 'flex flex-col items-center gap-1.5' : ''}`}>
          <div className={`flex items-center gap-2.5 ${collapsed ? '' : 'p-1.5 rounded-md hover:bg-base-hover transition-colors'}`}>
            <Avatar
              name={user ? profile?.name || user.email || 'User' : (role === 'employee' && profile ? profile.name : 'Alex Morgan')}
              color={role === 'employee' && profile ? profile.avatarColor : '#315D70'}
              size="sm"
            />
            {!collapsed && (
              <div className="overflow-hidden flex-1 min-w-0">
                <div className="text-xs font-bold text-text-primary truncate">
                  {user ? (profile?.name || user.email) : (role === 'employee' && profile ? profile.name : 'Alex Morgan')}
                </div>
                <div className="text-[10px] text-text-secondary truncate flex items-center gap-1">
                  {user ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {profile?.role || 'Supabase User'}
                    </span>
                  ) : (
                    <span className="text-amber-600 font-medium">Demo Administrator</span>
                  )}
                </div>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={async () => {
                  if (user) {
                    await signOut();
                  } else {
                    exitDemoMode();
                  }
                  navigate('/login');
                }}
                className="p-1 rounded text-text-muted hover:text-critical hover:bg-critical/10 transition-colors ml-auto"
                title={user ? 'Sign Out of Supabase' : 'Exit Demo Mode'}
                aria-label={user ? 'Sign Out of Supabase' : 'Exit Demo Mode'}
              >
                <LogOut size={13} />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              type="button"
              onClick={async () => {
                if (user) {
                  await signOut();
                } else {
                  exitDemoMode();
                }
                navigate('/login');
              }}
              className="w-8 h-8 rounded flex items-center justify-center text-text-muted hover:text-critical hover:bg-critical/10 transition-colors"
              title={user ? 'Sign Out of Supabase' : 'Exit Demo Mode'}
              aria-label={user ? 'Sign Out of Supabase' : 'Exit Demo Mode'}
            >
              <LogOut size={13} />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center h-9 border-t border-base-border text-text-secondary hover:text-text-primary hover:bg-base-hover transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>
    </>
  );
}
