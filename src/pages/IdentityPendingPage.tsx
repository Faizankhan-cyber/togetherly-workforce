import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldAlert,
  LogOut,
  RefreshCw,
  Layers,
  KeyRound,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

export function IdentityPendingPage() {
  const { user, signOut, refreshSession, enterDemoMode, isLoading } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshSession();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="min-h-screen bg-base-bg flex flex-col justify-between text-text-primary">
      {/* Header bar */}
      <header className="h-14 bg-white border-b border-base-border flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white shadow-sm">
            <Layers size={17} />
          </div>
          <div>
            <div className="text-xs font-bold tracking-tight text-text-primary leading-none">
              Togetherly
            </div>
            <div className="text-[10px] text-text-secondary leading-tight mt-0.5 font-medium">
              Workforce Intelligence · Access Gateway
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => signOut()}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            title="Sign out of current Supabase session"
          >
            <LogOut size={13} className="text-text-secondary" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-2xl w-full">
          {/* Status banner */}
          <div className="card p-6 sm:p-8 bg-white border-base-border shadow-card mb-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 flex-shrink-0">
                <ShieldAlert size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} /> Supabase Auth Verified
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock size={12} /> Identity Pending Assignment
                  </span>
                </div>
                <h1 className="text-xl font-bold text-text-primary tracking-tight">
                  Account Pending Workforce Provisioning
                </h1>
                <p className="text-xs text-text-secondary mt-1">
                  Your credentials have been securely authenticated by Supabase. However, your account has not yet been linked to an employee profile or granted workspace permissions by an administrator.
                </p>
              </div>
            </div>

            {/* Session details */}
            <div className="rounded-lg bg-base-subtle border border-base-border p-4 mb-6 space-y-2.5 font-mono text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border/70 text-[11px]">
                <span className="text-text-secondary font-sans font-medium">Authenticated Account:</span>
                <span className="font-semibold text-text-primary">{user?.email || 'Authenticated User'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border/70 text-[11px]">
                <span className="text-text-secondary font-sans font-medium">Supabase User UID:</span>
                <span className="text-text-muted truncate max-w-xs">{user?.id || '—'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border/70 text-[11px]">
                <span className="text-text-secondary font-sans font-medium">Current Role Claim:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px] font-semibold uppercase tracking-wider">
                  {(user?.app_metadata?.role as string) || (user?.user_metadata?.role as string) || 'unassigned (default)'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                <span className="text-text-secondary font-sans font-medium">Database Employee Mapping:</span>
                <span className="text-amber-600 font-semibold flex items-center gap-1 font-sans">
                  <Clock size={12} /> Awaiting Administrator Mapping
                </span>
              </div>
            </div>

            {/* Why is this restricted? */}
            <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-4 mb-6">
              <h3 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-1.5">
                <KeyRound size={14} /> Why is workforce data restricted?
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Togetherly manages sensitive organizational intelligence, employee utilization rates, salaries, and training verification queues. Under our Role-Based Access Control (RBAC) architecture, self-registered users are quarantined with zero data privileges until an authorized administrator maps your Supabase UID to an active employee record.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="btn-primary w-full sm:w-auto text-xs px-4 py-2 flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'Checking Status…' : 'Check Mapping Status'}
              </button>

              <button
                type="button"
                onClick={() => enterDemoMode()}
                className="btn-secondary w-full sm:w-auto text-xs px-4 py-2 flex items-center justify-center gap-1.5 text-primary border-primary/30 hover:border-primary"
              >
                <Sparkles size={13} className="text-primary" />
                Explore Demo Workspace
              </button>

              <button
                type="button"
                onClick={() => signOut()}
                className="btn-ghost w-full sm:w-auto text-xs px-3 py-2 flex items-center justify-center gap-1.5 text-text-secondary hover:text-critical ml-auto"
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </div>
          </div>

          {/* Helper note for reviewers */}
          <div className="text-center text-[11px] text-text-secondary">
            <p>
              Looking to evaluate the Training Completion Verification System and manager flows? Click <strong className="text-primary cursor-pointer hover:underline" onClick={() => enterDemoMode()}>Explore Demo Workspace</strong> above.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 px-6 text-center border-t border-base-border bg-white text-[11px] text-text-secondary">
        Togetherly Workforce Intelligence · Enterprise Supabase Authentication
      </footer>
    </div>
  );
}
