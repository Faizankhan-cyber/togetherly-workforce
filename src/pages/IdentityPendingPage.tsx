import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import {
  ShieldAlert,
  LogOut,
  RefreshCw,
  Layers,
  KeyRound,
  CheckCircle2,
  Clock,
  Sparkles,
  XCircle,
  Building2,
  UserRound,
  BriefcaseBusiness,
  Save,
} from 'lucide-react';

const DEPARTMENT_OPTIONS = [
  'Engineering',
  'Product',
  'Design',
  'Data & AI',
  'Cloud & Infrastructure',
  'Security',
  'Quality Assurance',
  'Operations',
  'Human Resources',
];

export function IdentityPendingPage() {
  const {
    user,
    signOut,
    refreshSession,
    enterDemoMode,
    isLoading,
    registrationRequest,
    registrationTableMissing,
    updateMyRegistrationRequest,
    reapplyMyRegistrationRequest,
  } = useAuth();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditingRequest, setIsEditingRequest] = useState(false);
  const [applicantName, setApplicantName] = useState('');
  const [requestedDepartment, setRequestedDepartment] = useState('Engineering');
  const [requestedJobTitle, setRequestedJobTitle] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const defaultName =
      registrationRequest?.applicantName ||
      (user?.user_metadata?.full_name as string) ||
      user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ') ||
      '';
    const defaultDept =
      registrationRequest?.requestedDepartment ||
      (user?.user_metadata?.requested_department as string) ||
      'Engineering';
    const defaultTitle =
      registrationRequest?.requestedJobTitle ||
      (user?.user_metadata?.requested_job_title as string) ||
      '';

    setApplicantName(defaultName);
    setRequestedDepartment(defaultDept);
    setRequestedJobTitle(defaultTitle);
  }, [registrationRequest, user]);

  // Prefer database request state when available so a successful reapply immediately clears
  // the rejected screen even if a client token still contains a stale app-metadata claim.
  const isRejected = registrationRequest
    ? registrationRequest.status === 'rejected'
    : user?.app_metadata?.registration_status === 'rejected';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setSaveMessage(null);
    await refreshSession();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim()) {
      setSaveMessage({ type: 'error', text: 'Applicant name is required.' });
      return;
    }
    setIsSavingDetails(true);
    setSaveMessage(null);
    try {
      const res = isRejected
        ? await reapplyMyRegistrationRequest({
            applicantName: applicantName.trim(),
            requestedDepartment: requestedDepartment.trim(),
            requestedJobTitle: requestedJobTitle.trim(),
          })
        : await updateMyRegistrationRequest({
            applicantName: applicantName.trim(),
            requestedDepartment: requestedDepartment.trim(),
            requestedJobTitle: requestedJobTitle.trim() || undefined,
          });
      if (res.success) {
        setSaveMessage({
          type: 'success',
          text: isRejected
            ? 'Your application has been resubmitted and is back in the administrator approval queue.'
            : 'Your application details have been updated in the administrator verification queue.',
        });
        setIsEditingRequest(false);
      } else {
        setSaveMessage({
          type: 'error',
          text: res.error || 'Could not update application details.',
        });
      }
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleReapply = async () => {
    if (!applicantName.trim()) {
      setSaveMessage({ type: 'error', text: 'Applicant name is required.' });
      return;
    }

    setIsSavingDetails(true);
    setSaveMessage(null);
    try {
      const res = await reapplyMyRegistrationRequest({
        applicantName: applicantName.trim(),
        requestedDepartment: requestedDepartment.trim(),
        requestedJobTitle: requestedJobTitle.trim(),
      });
      if (res.success) {
        setSaveMessage({
          type: 'success',
          text: 'Your application has been resubmitted and is back in the administrator approval queue.',
        });
        setIsEditingRequest(false);
      } else {
        setSaveMessage({
          type: 'error',
          text: res.error || 'Could not resubmit your application.',
        });
      }
    } finally {
      setIsSavingDetails(false);
    }
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
              Workforce Intelligence · Employee Verification Gateway
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
          <div className="card p-6 sm:p-8 bg-white border-base-border shadow-card mb-6">
            <div className="flex items-start gap-4 mb-6">
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                  isRejected
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-amber-50 border-amber-200 text-amber-600'
                }`}
              >
                {isRejected ? <XCircle size={26} /> : <ShieldAlert size={26} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} /> Supabase Auth Verified
                  </span>
                  <StatusBadge
                    status={isRejected ? 'rejected' : 'pending'}
                    label={isRejected ? 'Application Rejected' : 'Pending Administrator Approval'}
                  />
                </div>
                <h1 className="text-xl font-bold text-text-primary tracking-tight">
                  {isRejected
                    ? 'Organization Access Request Declined'
                    : 'Account Pending Workforce Provisioning'}
                </h1>
                <p className="text-xs text-text-secondary mt-1">
                  {isRejected
                    ? 'An administrator has reviewed your registration request and declined organization access for this account.'
                    : 'Your registration is recorded in the Employee Verification queue. An authorized administrator must review your details, assign your organization role and department, and approve access.'}
                </p>
              </div>
            </div>

            {registrationTableMissing && (
              <div className="rounded-lg bg-amber-50 border border-amber-300 p-4 mb-6 text-xs text-amber-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <ShieldAlert size={15} className="text-amber-600 shrink-0" />
                  Database Migration Pending: <code>public.employee_registration_requests</code>
                </div>
                <p className="leading-relaxed">
                  Your Supabase project has the base tables installed, but the Employee Verification
                  migration (
                  <code>supabase/migrations/20261023_employee_registration_requests.sql</code>) has
                  not been executed in the Supabase SQL Editor yet. Run that migration in Supabase
                  SQL Editor to create <code>public.employee_registration_requests</code> and
                  automatically bootstrap your initial Administrator account, then click{' '}
                  <strong>Check Approval Status</strong> below.
                </p>
              </div>
            )}

            {/* Rejection reason alert if rejected */}
            {isRejected && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 mb-6 text-xs text-rose-900">
                <div className="font-bold flex items-center gap-1.5 text-rose-800 mb-1">
                  <XCircle size={14} /> Administrator Review Decision
                </div>
                <p className="leading-relaxed">
                  <span className="font-semibold">Reason: </span>
                  {registrationRequest?.rejectionReason ||
                    'Your registration could not be verified against active organization directory records.'}
                </p>
                {registrationRequest?.reviewedAt && (
                  <p className="text-[11px] text-rose-700 mt-1.5 font-mono">
                    Reviewed by {registrationRequest.reviewerName || 'Administrator'} on{' '}
                    {new Date(registrationRequest.reviewedAt).toLocaleString()}
                  </p>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-rose-800">
                  {user?.email_confirmed_at
                    ? 'Your email is already verified. Reapply using this account; a new verification email is not required.'
                    : 'Verify your email address before reapplying for organization access.'}
                </p>
              </div>
            )}

            {/* Save notification */}
            {saveMessage && (
              <div
                className={`mb-4 p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  saveMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{saveMessage.text}</span>
              </div>
            )}

            {/* Application & Session details */}
            <div className="rounded-lg bg-base-subtle border border-base-border p-4 mb-6 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-base-border">
                <span className="font-bold text-text-primary uppercase tracking-wider text-[10px]">
                  Submitted Registration Profile
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingRequest((v) => !v)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {isEditingRequest
                    ? 'Cancel Edit'
                    : isRejected
                      ? 'Edit details to reapply'
                      : 'Update Request Details'}
                </button>
              </div>

              {isEditingRequest ? (
                <form onSubmit={handleSaveDetails} className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-text-primary mb-1">
                        Applicant Name
                      </label>
                      <div className="relative">
                        <UserRound
                          size={14}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                        />
                        <input
                          type="text"
                          value={applicantName}
                          onChange={(e) => setApplicantName(e.target.value)}
                          required
                          className="input-field pl-8 w-full py-1.5 text-xs bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-text-primary mb-1">
                        Requested Department
                      </label>
                      <div className="relative">
                        <Building2
                          size={14}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                        />
                        <select
                          value={requestedDepartment}
                          onChange={(e) => setRequestedDepartment(e.target.value)}
                          className="input-field pl-8 w-full py-1.5 text-xs bg-white"
                        >
                          {DEPARTMENT_OPTIONS.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-text-primary mb-1">
                      Requested Job Title (Optional)
                    </label>
                    <div className="relative">
                      <BriefcaseBusiness
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                      />
                      <input
                        type="text"
                        value={requestedJobTitle}
                        onChange={(e) => setRequestedJobTitle(e.target.value)}
                        placeholder="e.g. Product Designer, Data Engineer"
                        className="input-field pl-8 w-full py-1.5 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSavingDetails}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <Save size={13} />
                      {isSavingDetails
                        ? isRejected ? 'Resubmitting…' : 'Saving…'
                        : isRejected ? 'Save Details & Reapply' : 'Save Application Details'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2 font-mono text-[11px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border/70">
                    <span className="text-text-secondary font-sans font-medium">Applicant Name:</span>
                    <span className="font-semibold text-text-primary font-sans">
                      {registrationRequest?.applicantName || applicantName || 'Authenticated Applicant'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border/70">
                    <span className="text-text-secondary font-sans font-medium">Email Address:</span>
                    <span className="font-semibold text-text-primary">{user?.email || '—'}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border/70">
                    <span className="text-text-secondary font-sans font-medium">Requested Department:</span>
                    <span className="font-semibold text-primary font-sans">
                      {registrationRequest?.requestedDepartment || requestedDepartment}
                      {(registrationRequest?.requestedJobTitle || requestedJobTitle) && (
                        <span className="text-text-secondary font-normal">
                          {' '}
                          · {registrationRequest?.requestedJobTitle || requestedJobTitle}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-base-border/70">
                    <span className="text-text-secondary font-sans font-medium">Registration Date:</span>
                    <span className="text-text-primary tabular-nums">
                      {registrationRequest?.createdAt
                        ? new Date(registrationRequest.createdAt).toLocaleString()
                        : user?.created_at
                          ? new Date(user.created_at).toLocaleString()
                          : 'Just now'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-text-secondary font-sans font-medium">Application Status:</span>
                    {isRejected ? (
                      <span className="text-rose-600 font-semibold flex items-center gap-1 font-sans">
                        <XCircle size={12} /> Rejected by Administrator
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold flex items-center gap-1 font-sans">
                        <Clock size={12} /> Queued in /admin/employee-requests
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Why is this restricted? */}
            <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-4 mb-6">
              <h3 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-1.5">
                <KeyRound size={14} /> How Administrator Verification Works
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Togetherly enforces strict Role-Based Access Control (RBAC). New accounts enter the{' '}
                <strong>Employee Verification</strong> queue until an authorized Administrator reviews your
                application, assigns your organization role (<em>Employee, Manager, HR, or Administrator</em>)
                and department, and approves access. Once approved, click{' '}
                <strong>Check Approval Status</strong> below to enter the workspace immediately.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {isRejected && !isEditingRequest && (
                <button
                  type="button"
                  onClick={handleReapply}
                  disabled={isSavingDetails}
                  className="btn-primary w-full sm:w-auto text-xs px-4 py-2 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  {isSavingDetails ? 'Resubmitting…' : 'Reapply for approval'}
                </button>
              )}

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="btn-primary w-full sm:w-auto text-xs px-4 py-2 flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'Checking Status…' : 'Check Approval Status'}
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
              Are you the project administrator setting up Supabase for the first time? Run the SQL migration in
              your Supabase SQL Editor to automatically bootstrap your initial Administrator account.
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
