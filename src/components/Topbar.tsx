import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, ChevronDown, FolderKanban, Users } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { Avatar } from './Avatar';

const pageTitles: Record<string, { title: string; breadcrumb: string[] }> = {
  '/': { title: 'Dashboard', breadcrumb: ['Home', 'Dashboard'] },
  '/employees': { title: 'Employees', breadcrumb: ['Home', 'Employees'] },
  '/projects': { title: 'Projects', breadcrumb: ['Home', 'Projects'] },
  '/team-builder': { title: 'Team Builder', breadcrumb: ['Home', 'Team Builder'] },
  '/workforce-twin': { title: 'Workforce Twin', breadcrumb: ['Home', 'Workforce Twin'] },
  '/skills': { title: 'Skills & Training', breadcrumb: ['Home', 'Skills & Training'] },
  '/roadmap': { title: 'Development Roadmap', breadcrumb: ['Home', 'Development Roadmap'] },
  '/workload': { title: 'Workload Planner', breadcrumb: ['Home', 'Workload Planner'] },
  '/opportunities': { title: 'Opportunity Finder', breadcrumb: ['Home', 'Opportunity Finder'] },
  '/impact-report': { title: 'Allocation Impact', breadcrumb: ['Home', 'Allocation Impact'] },
  '/my-projects': { title: 'My Projects', breadcrumb: ['Home', 'My Projects'] },
  '/analytics': { title: 'Analytics & Reports', breadcrumb: ['Home', 'Analytics & Reports'] },
  '/settings': { title: 'Settings', breadcrumb: ['Home', 'Settings'] },
};

interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activities, employees, projects, role } = useData();
  const profile = employees.find((employee) => employee.id === 'emp-001');
  const profileName = role === 'employee' && profile ? profile.name : 'Alex Morgan';
  const visibleActivities = role === 'manager'
    ? activities
    : activities.filter((activity) => profileName && activity.message.includes(profileName));
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const pathKey = Object.keys(pageTitles).find((key) =>
    key === '/' ? location.pathname === '/' : location.pathname.startsWith(key)
  );
  const pageInfo = pageTitles[pathKey ?? '/'] ?? pageTitles['/'];
  const title = pathKey === '/' && role === 'employee'
    ? 'My Dashboard'
    : pathKey === '/roadmap' && role === 'employee'
      ? 'My Development'
      : pageInfo.title;
  const breadcrumb = pathKey === '/' && role === 'employee'
    ? ['Home', 'My Dashboard']
    : pathKey === '/roadmap' && role === 'employee'
      ? ['Home', 'My Development']
      : pageInfo.breadcrumb;
  const employeeProjects = role === 'employee' && profile
    ? projects.filter((project) => project.assignedEmployeeIds.includes(profile.id))
    : projects;
  const searchResults = searchQuery.trim()
    ? [
        ...(role === 'manager'
          ? employees.filter((employee) =>
              `${employee.name} ${employee.role} ${employee.department}`.toLowerCase().includes(searchQuery.toLowerCase())
            ).slice(0, 4).map((employee) => ({ type: 'employee' as const, id: employee.id, label: employee.name, detail: employee.role }))
          : []),
        ...employeeProjects.filter((project) =>
          `${project.name} ${project.description}`.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 4).map((project) => ({ type: 'project' as const, id: project.id, label: project.name, detail: project.status })),
      ].slice(0, 6)
    : [];

  function openSearchResult(result: (typeof searchResults)[number]) {
    setSearchQuery('');
    setSearchOpen(false);
    if (result.type === 'employee') {
      navigate('/employees', { state: { employeeId: result.id } });
    } else if (role === 'employee') {
      navigate('/my-projects', { state: { projectId: result.id } });
    } else {
      navigate('/projects', { state: { projectId: result.id } });
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-16 glass border-b border-base-border/80 flex items-center justify-between px-4 lg:px-6 gap-4">
      {/* Left: Mobile menu + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden text-text-secondary hover:text-text-primary p-2 rounded-xl hover:bg-base-hover transition-colors"
          aria-label="Open mobile navigation"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary mb-0.5">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-base-border font-mono text-[10px]">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'text-primary font-medium' : 'hover:text-text-primary transition-colors'}>{crumb}</span>
              </span>
            ))}
          </div>
          <h2 className="text-base font-bold text-text-primary tracking-tight truncate">{title}</h2>
        </div>
      </div>

      {/* Right: Search, notifications, profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div ref={searchRef} className="relative hidden md:block">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder={role === 'manager' ? 'Quick search employees, projects…' : 'Search assigned projects…'}
            className="input-field pl-9 pr-3 py-1.5 w-64 text-xs transition-all focus:w-72"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && searchResults[0]) openSearchResult(searchResults[0]);
              if (event.key === 'Escape') setSearchOpen(false);
            }}
            aria-label="Search employees and projects"
            aria-expanded={searchOpen && !!searchQuery}
          />
          {searchOpen && searchQuery.trim() && (
            <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-2xl border border-base-border bg-base-card/95 backdrop-blur-xl shadow-2xl animate-fade-in-up">
              <div className="p-2 border-b border-base-border/50 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                Search Results
              </div>
              {searchResults.length === 0 ? (
                <p className="px-4 py-4 text-xs text-text-secondary">No matching records found.</p>
              ) : searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => openSearchResult(result)}
                  className="flex w-full items-center gap-3 border-b border-base-border/40 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-base-hover transition-colors"
                >
                  <span className="rounded-lg bg-primary/10 border border-primary/20 p-2 text-primary">{result.type === 'employee' ? <Users size={14} /> : <FolderKanban size={14} />}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-text-primary">{result.label}</span>
                    <span className="block truncate text-[11px] text-text-secondary">{result.type === 'employee' ? 'Employee' : 'Project'} · {result.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative text-text-secondary hover:text-text-primary p-2 rounded-xl hover:bg-base-hover transition-colors border border-transparent hover:border-base-border"
            aria-label="View notifications"
          >
            <Bell size={18} />
            {visibleActivities.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan rounded-full ring-2 ring-base-bg shadow-[0_0_8px_#22D3EE]" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-84 sm:w-96 card p-0 animate-fade-in-up overflow-hidden shadow-2xl z-30">
              <div className="px-4 py-3 border-b border-base-border/70 flex items-center justify-between bg-base-bg/40">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">System Activity</h3>
                <span className="text-[11px] text-text-secondary">{visibleActivities.length} updates</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-base-border/40">
                {visibleActivities.length === 0 && <p className="px-4 py-6 text-xs text-text-secondary text-center">No recent updates for your profile.</p>}
                {visibleActivities.slice(0, 8).map((act) => (
                  <div key={act.id} className="px-4 py-3 hover:bg-base-hover/70 transition-colors">
                    <p className="text-xs text-text-primary font-medium leading-relaxed">{act.message}</p>
                    <p className="text-[10px] text-text-secondary mt-1 flex items-center gap-1.5 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
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
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-base-hover transition-colors border border-transparent hover:border-base-border"
            aria-label="User profile menu"
          >
            <Avatar name={profileName} color={role === 'employee' && profile ? profile.avatarColor : '#8B5CF6'} size="sm" />
            <ChevronDown size={14} className="text-text-secondary hidden sm:block" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 card p-1.5 animate-fade-in-up shadow-2xl z-30">
              <div className="px-3 py-2 border-b border-base-border/60 mb-1">
                <div className="text-xs font-bold text-text-primary truncate">{profileName}</div>
                <div className="text-[11px] text-primary font-medium truncate mt-0.5">
                  {role === 'employee' && profile ? profile.role : 'Workforce Administrator'}
                </div>
              </div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Status</div>
              <div className="px-3 py-1 text-xs text-success flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Active Workspace
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
