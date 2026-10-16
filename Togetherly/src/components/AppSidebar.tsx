import { NavLink } from 'react-router-dom';
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
  Sparkles,
  GitCompareArrows,
  Lightbulb,
  FileBarChart,
  Map,
  UserRound,
  BriefcaseBusiness,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { useData } from '@/context/DataContext';
import { useNavigate } from 'react-router-dom';

const managerNavItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/team-builder', label: 'Team Builder', icon: UsersRound },
  { to: '/workforce-twin', label: 'Workforce Twin', icon: GitCompareArrows },
  { to: '/skills', label: 'Skills & Training', icon: GraduationCap },
  { to: '/roadmap', label: 'Development Roadmap', icon: Map },
  { to: '/workload', label: 'Workload Planner', icon: BarChart3 },
  { to: '/opportunities', label: 'Opportunity Finder', icon: Lightbulb },
  { to: '/impact-report', label: 'Allocation Impact', icon: FileBarChart },
  { to: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const employeeNavItems = [
  { to: '/', label: 'My Dashboard', icon: LayoutDashboard },
  { to: '/my-projects', label: 'My Projects', icon: FolderKanban },
  { to: '/roadmap', label: 'My Development', icon: GraduationCap },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: AppSidebarProps) {
  const { employees, role, setRole } = useData();
  const navigate = useNavigate();
  const profile = employees.find((employee) => employee.id === 'emp-001');
  const navItems = role === 'manager' ? managerNavItems : employeeNavItems;

  function changeRole(nextRole: 'manager' | 'employee') {
    setRole(nextRole);
    navigate('/');
    onCloseMobile();
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm animate-fade-in" onClick={onCloseMobile} />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-base-sidebar/95 backdrop-blur-md border-r border-base-border z-40 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 h-16 px-4 border-b border-base-border flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center flex-shrink-0 shadow-glow animate-pulse-glow">
            <Sparkles size={20} className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-text-primary leading-tight">Togetherly</div>
              <div className="text-[10px] text-text-secondary leading-tight">Workforce Intelligence</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `nav-link group ${isActive ? 'nav-link-active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className={`px-3 pb-3 ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
          {!collapsed && (
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
              Demo role
            </p>
          )}
          <div className={collapsed ? 'flex flex-col gap-1' : 'grid grid-cols-2 gap-1 rounded-xl border border-base-border bg-base-bg p-1'}>
            <button
              type="button"
              onClick={() => changeRole('manager')}
              aria-pressed={role === 'manager'}
              title={collapsed ? 'Switch to Manager / HR' : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                collapsed ? 'justify-center w-10 h-10' : 'justify-center'
              } ${role === 'manager' ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-base-hover'}`}
            >
              <BriefcaseBusiness size={15} />
              {!collapsed && 'Manager / HR'}
            </button>
            <button
              type="button"
              onClick={() => changeRole('employee')}
              aria-pressed={role === 'employee'}
              title={collapsed ? 'Switch to Employee' : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                collapsed ? 'justify-center w-10 h-10' : 'justify-center'
              } ${role === 'employee' ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-base-hover'}`}
            >
              <UserRound size={15} />
              {!collapsed && 'Employee'}
            </button>
          </div>
        </div>

        {/* User profile */}
        <div className={`p-3 border-t border-base-border flex-shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? '' : 'p-2 rounded-lg hover:bg-base-hover transition-colors cursor-pointer'}`}>
            <Avatar
              name={role === 'employee' && profile ? profile.name : 'Alex Morgan'}
              color={role === 'employee' && profile ? profile.avatarColor : '#8B5CF6'}
              size="sm"
            />
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <div className="text-sm font-medium text-text-primary truncate">
                  {role === 'employee' && profile ? profile.name : 'Alex Morgan'}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  {role === 'employee' && profile ? profile.role : 'Operations Lead'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center h-10 border-t border-base-border text-text-secondary hover:text-text-primary hover:bg-base-hover transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>
    </>
  );
}
