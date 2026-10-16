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
  GitCompareArrows,
  Lightbulb,
  FileBarChart,
  Map,
  UserRound,
  BriefcaseBusiness,
  Layers,
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
        {/* Microsoft Azure / 365 Enterprise Brand Header */}
        <div className={`flex items-center gap-2.5 h-14 px-4 border-b border-base-border flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0 text-white shadow-sm">
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

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary font-semibold border-l-2 border-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-base-hover'
                  } ${collapsed ? 'justify-center px-2' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={16}
                      className={`flex-shrink-0 ${
                        isActive ? 'text-primary' : 'text-text-secondary'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Role Switcher */}
        <div className={`p-2.5 border-t border-base-border bg-base-subtle ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
          {!collapsed && (
            <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Workspace Role
            </p>
          )}
          <div className={collapsed ? 'flex flex-col gap-1' : 'grid grid-cols-2 gap-1 rounded-md border border-base-border bg-gray-100 p-0.5'}>
            <button
              type="button"
              onClick={() => changeRole('manager')}
              aria-pressed={role === 'manager'}
              title={collapsed ? 'Manager / HR View' : undefined}
              className={`flex items-center gap-1.5 rounded py-1 px-2 text-[11px] font-semibold transition-all ${
                collapsed ? 'justify-center w-8 h-8' : 'justify-center'
              } ${
                role === 'manager'
                  ? 'bg-white text-primary shadow-sm border border-base-border'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
              }`}
            >
              <BriefcaseBusiness size={13} />
              {!collapsed && 'Manager'}
            </button>
            <button
              type="button"
              onClick={() => changeRole('employee')}
              aria-pressed={role === 'employee'}
              title={collapsed ? 'Employee View' : undefined}
              className={`flex items-center gap-1.5 rounded py-1 px-2 text-[11px] font-semibold transition-all ${
                collapsed ? 'justify-center w-8 h-8' : 'justify-center'
              } ${
                role === 'employee'
                  ? 'bg-white text-primary shadow-sm border border-base-border'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/50'
              }`}
            >
              <UserRound size={13} />
              {!collapsed && 'Employee'}
            </button>
          </div>
        </div>

        {/* User profile */}
        <div className={`p-2 border-t border-base-border flex-shrink-0 bg-white ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center gap-2.5 ${collapsed ? '' : 'p-1.5 rounded-md hover:bg-base-hover transition-colors cursor-pointer'}`}>
            <Avatar
              name={role === 'employee' && profile ? profile.name : 'Alex Morgan'}
              color={role === 'employee' && profile ? profile.avatarColor : '#0078D4'}
              size="sm"
            />
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <div className="text-xs font-bold text-text-primary truncate">
                  {role === 'employee' && profile ? profile.name : 'Alex Morgan'}
                </div>
                <div className="text-[10px] text-text-secondary truncate">
                  {role === 'employee' && profile ? profile.role : 'Workforce Admin'}
                </div>
              </div>
            )}
          </div>
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
