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
} from 'lucide-react';
import { Avatar } from './Avatar';
import { useData } from '@/context/DataContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/team-builder', label: 'Team Builder', icon: UsersRound },
  { to: '/skills', label: 'Skills & Training', icon: GraduationCap },
  { to: '/workload', label: 'Workload Planner', icon: BarChart3 },
  { to: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: AppSidebarProps) {
  const { settings } = useData();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-base-sidebar border-r border-base-border z-40 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 h-16 px-4 border-b border-base-border flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center flex-shrink-0 shadow-glow">
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
                  `nav-link ${isActive ? 'nav-link-active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User profile */}
        <div className={`p-3 border-t border-base-border flex-shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? '' : 'p-2 rounded-lg hover:bg-base-hover transition-colors cursor-pointer'}`}>
            <Avatar name="Alex Morgan" color="#8B5CF6" size="sm" />
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <div className="text-sm font-medium text-text-primary truncate">Alex Morgan</div>
                <div className="text-xs text-text-secondary truncate">Operations Lead</div>
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
