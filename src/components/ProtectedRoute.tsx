import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { IdentityPendingPage } from '@/pages/IdentityPendingPage';
import {
  Layers,
  ShieldAlert,
  ArrowLeft,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogIn,
} from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, isDemoMode, identityStatus, signOut } = useAuth();
  const location = useLocation();

  // Show a professional loading screen while restoring Supabase Auth session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-bg flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-md animate-pulse">
            <Layers size={20} />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
            <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Verifying Supabase authentication…
          </div>
        </div>
      </div>
    );
  }

  // Offboarded employees remain linked to historical records but lose workspace access.
  if (user && identityStatus === 'offboarded' && !isDemoMode) {
    return (
      <div className="min-h-screen bg-base-bg flex items-center justify-center p-4 text-text-primary">
        <section className="card w-full max-w-lg p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-critical/20 bg-critical/10 text-critical">
            <ShieldAlert size={26} />
          </div>
          <h1 className="mt-5 text-xl font-extrabold">Organization access removed</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">Your employee account has been offboarded. Access to organization projects, employee data, and staffing tools is disabled. Your historical records remain retained by the organization.</p>
          <button type="button" className="btn-primary mx-auto mt-6" onClick={() => void signOut()}><LogIn size={14}/> Sign out</button>
        </section>
      </div>
    );
  }

  // If user is authenticated with Supabase, but their account is not mapped to an employee record
  // (e.g. self-registered signup or unmapped user) and not previewing demo mode, protect sensitive
  // workforce intelligence by displaying the IdentityPendingPage.
  if (user && identityStatus === 'pending_assignment' && !isDemoMode) {
    return <IdentityPendingPage />;
  }

  // If not authenticated and not in demo mode, redirect to the login page
  if (!user && !isDemoMode) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Otherwise, user is either mapped or in authorized demo mode
  return <>{children}</>;
}

/**
 * Route guard strictly enforcing database-verified Administrator authorization.
 * Never uses the demo role-preview switcher as an authorization mechanism.
 */
export function AdminRoute({ children }: ProtectedRouteProps) {
  const {
    user,
    isLoading,
    isAdmin,
    systemRole,
    isDemoMode,
    isConfigured,
    configError,
    registrationTableMissing,
    exitDemoMode,
    refreshSession,
  } = useAuth();
  const navigate = useNavigate();
  const [tableStatus, setTableStatus] = useState<'checking' | 'ready' | 'missing' | 'unconfigured'>(
    () => (registrationTableMissing ? 'missing' : isSupabaseConfigured() ? 'checking' : 'unconfigured')
  );
  const [isReverifying, setIsReverifying] = useState(false);

  useEffect(() => {
    if (isAdmin) return;
    if (!isSupabaseConfigured() || !supabase) {
      setTableStatus('unconfigured');
      return;
    }
    let mounted = true;
    supabase
      .from('employee_registration_requests')
      .select('id', { count: 'exact', head: true })
      .then(({ error }) => {
        if (!mounted) return;
        if (
          error &&
          (error.code === 'PGRST205' ||
            error.code === '42P01' ||
            error.message.toLowerCase().includes('employee_registration_requests'))
        ) {
          setTableStatus('missing');
        } else {
          setTableStatus('ready');
        }
      });
    return () => {
      mounted = false;
    };
  }, [isAdmin, registrationTableMissing]);

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
          <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Verifying administrator authorization…
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto my-8">
        <div className="card bg-white border border-base-border p-6 sm:p-8 shadow-card">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert size={22} />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 mb-1.5">
                <Lock size={10} /> Restricted Administrator Route
              </span>
              <h1 className="text-lg font-bold text-text-primary">
                Administrator Authorization Required
              </h1>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                The <strong>Employee Verification & Approval</strong> portal (
                <code>/admin/employee-requests</code>) is strictly restricted to authenticated
                Supabase users with a database-verified <strong>Administrator</strong> (
                <code>system_role = &apos;admin&apos;</code>) record in <code>public.employees</code>.
                Local Demo Mode and the UI workspace-role switcher cannot grant access to live
                employee verification.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-base-subtle border border-base-border p-4 mb-5 text-xs space-y-2 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border">
              <span className="font-sans text-text-secondary font-medium">Current Session Mode:</span>
              <span className="font-semibold text-text-primary">
                {user
                  ? `Authenticated (${user.email})`
                  : isDemoMode
                    ? 'Demo Mode (Local) — Unauthenticated Browser Session'
                    : 'Unauthenticated'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border">
              <span className="font-sans text-text-secondary font-medium">Verified Database Role:</span>
              <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px] font-bold uppercase w-fit">
                {systemRole}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border">
              <span className="font-sans text-text-secondary font-medium">Supabase Environment:</span>
              {isConfigured ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-sans font-semibold">
                  <CheckCircle2 size={13} /> Configured & Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-700 font-sans font-semibold">
                  <AlertTriangle size={13} /> {configError || 'Missing VITE_SUPABASE_URL / Key'}
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-sans text-text-secondary font-medium">
                Registration Queue Table (<code>employee_registration_requests</code>):
              </span>
              {tableStatus === 'ready' ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-sans font-semibold">
                  <CheckCircle2 size={13} /> Ready in Supabase
                </span>
              ) : tableStatus === 'missing' ? (
                <span className="inline-flex items-center gap-1 text-amber-700 font-sans font-semibold">
                  <AlertTriangle size={13} /> Migration Not Yet Applied
                </span>
              ) : (
                <span className="text-text-muted font-sans">Checking…</span>
              )}
            </div>
          </div>

          {tableStatus === 'missing' && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-5 text-xs text-amber-950 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                Database Migration Required in Supabase SQL Editor
              </div>
              <p className="leading-relaxed">
                The table <code>public.employee_registration_requests</code> was not found in your
                live Supabase database. Run{' '}
                <code>supabase/migrations/20261023_employee_registration_requests.sql</code> in your
                Supabase SQL Editor to create the verification queue table, approval/rejection RPCs,
                and automatically bootstrap your first Supabase user as{' '}
                <code>system_role = &apos;admin&apos;</code>.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {!user ? (
              <button
                type="button"
                onClick={() => {
                  exitDemoMode();
                  navigate('/login');
                }}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <LogIn size={14} />
                <span>Exit Demo Mode & Sign In as Administrator</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isReverifying}
                onClick={async () => {
                  setIsReverifying(true);
                  exitDemoMode();
                  await refreshSession();
                  setIsReverifying(false);
                }}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <RefreshCw size={14} className={isReverifying ? 'animate-spin' : ''} />
                <span>{isReverifying ? 'Verifying Role…' : 'Re-verify Administrator Role'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
