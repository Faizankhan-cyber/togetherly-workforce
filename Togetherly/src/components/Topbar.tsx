import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, Menu, ChevronDown } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { Avatar } from './Avatar';

const pageTitles: Record<string, { title: string; breadcrumb: string[] }> = {
  '/': { title: 'Dashboard', breadcrumb: ['Home', 'Dashboard'] },
  '/employees': { title: 'Employees', breadcrumb: ['Home', 'Employees'] },
  '/projects': { title: 'Projects', breadcrumb: ['Home', 'Projects'] },
  '/team-builder': { title: 'Team Builder', breadcrumb: ['Home', 'Team Builder'] },
  '/skills': { title: 'Skills & Training', breadcrumb: ['Home', 'Skills & Training'] },
  '/workload': { title: 'Workload Planner', breadcrumb: ['Home', 'Workload Planner'] },
  '/analytics': { title: 'Analytics & Reports', breadcrumb: ['Home', 'Analytics & Reports'] },
  '/settings': { title: 'Settings', breadcrumb: ['Home', 'Settings'] },
};

interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const location = useLocation();
  const { activities } = useData();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const pathKey = Object.keys(pageTitles).find((key) =>
    key === '/' ? location.pathname === '/' : location.pathname.startsWith(key)
  );
  const { title, breadcrumb } = pageTitles[pathKey ?? '/'] ?? pageTitles['/'];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-16 bg-base-bg/90 backdrop-blur-md border-b border-base-border flex items-center justify-between px-4 lg:px-6 gap-4">
      {/* Left: Mobile menu + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden text-text-secondary hover:text-text-primary p-2 rounded-lg hover:bg-base-hover transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-text-secondary mb-0.5">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-base-border">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'text-text-primary' : ''}>{crumb}</span>
              </span>
            ))}
          </div>
          <h2 className="text-base font-semibold text-text-primary truncate">{title}</h2>
        </div>
      </div>

      {/* Right: Search, notifications, profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search employees, projects..."
            className="input-field pl-9 w-64"
          />
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative text-text-secondary hover:text-text-primary p-2 rounded-lg hover:bg-base-hover transition-colors"
          >
            <Bell size={20} />
            {activities.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-base-bg" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 card p-0 animate-slide-up overflow-hidden">
              <div className="px-4 py-3 border-b border-base-border">
                <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {activities.slice(0, 6).map((act) => (
                  <div key={act.id} className="px-4 py-3 hover:bg-base-hover transition-colors border-b border-base-border/50 last:border-0">
                    <p className="text-sm text-text-primary">{act.message}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      {new Date(act.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-base-hover transition-colors"
          >
            <Avatar name="Alex Morgan" color="#8B5CF6" size="sm" />
            <ChevronDown size={14} className="text-text-secondary hidden sm:block" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 card p-2 animate-slide-up">
              <div className="px-3 py-2 border-b border-base-border mb-2">
                <div className="text-sm font-medium text-text-primary">Alex Morgan</div>
                <div className="text-xs text-text-secondary">Operations Lead</div>
              </div>
              <button className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-base-hover rounded-lg transition-colors">
                Profile Settings
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-base-hover rounded-lg transition-colors">
                Preferences
              </button>
              <div className="border-t border-base-border mt-2 pt-2">
                <button className="w-full text-left px-3 py-2 text-sm text-critical hover:bg-critical/10 rounded-lg transition-colors">
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
