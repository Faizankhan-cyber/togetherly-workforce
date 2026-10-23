import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Layers,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info,
  Server,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  UserRound,
  Building2,
  BriefcaseBusiness,
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

export function LoginPage() {
  const navigate = useNavigate();
  const {
    signInWithEmail,
    signUpWithEmail,
    enterDemoMode,
    isConfigured,
    configError,
    connectionVerification,
    isVerifyingConnection,
    verifyConnection,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [requestedDepartment, setRequestedDepartment] = useState('Engineering');
  const [requestedJobTitle, setRequestedJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [signupSuccessMsg, setSignupSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSignupSuccessMsg(null);
    clearAuthError();

    // Check configuration first
    if (!isConfigured) {
      if (configError) {
        setLocalError(configError);
      } else {
        setLocalError(
          'Supabase environment variables are not configured. Please use Demo Mode below or configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
        );
      }
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('Please enter your work email address.');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setLocalError('Please enter your full name for employee verification.');
        return;
      }
      if (!requestedDepartment.trim()) {
        setLocalError('Please select your requested department.');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const result = await signInWithEmail(trimmedEmail, password);
        if (result.success) {
          navigate('/');
        }
      } else {
        const result = await signUpWithEmail(trimmedEmail, password, {
          fullName: fullName.trim(),
          requestedDepartment: requestedDepartment.trim(),
          requestedJobTitle: requestedJobTitle.trim() || undefined,
        });
        if (result.success) {
          if (result.requiresEmailConfirmation) {
            setSignupSuccessMsg(
              'Registration submitted! Please verify your email address via the link sent to your inbox. Your application has been queued for administrator approval.'
            );
            setMode('signin');
          } else {
            navigate('/');
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoAccess = () => {
    enterDemoMode();
    navigate('/');
  };

  const errorMessage = localError || authError;

  // Determine accurate connection badge
  const isConnectionVerified = connectionVerification?.connected === true;
  const isConnectionFailed = isConfigured && connectionVerification && !connectionVerification.connected;

  return (
    <div className="min-h-screen bg-base-bg flex flex-col justify-between selection:bg-primary/20 selection:text-primary">
      {/* Top micro-bar */}
      <div className="bg-white border-b border-base-border py-2.5 px-4 sm:px-8 flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-primary text-white flex items-center justify-center font-bold text-[10px]">
            T
          </div>
          <span className="font-semibold text-text-primary tracking-tight">Togetherly Enterprise Portal</span>
        </div>
        <div className="flex items-center gap-2">
          {configError ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-50 border-amber-200 text-amber-800">
              <AlertTriangle size={11} className="text-amber-600" />
              Config Check Required
            </span>
          ) : isVerifyingConnection ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-50 border-blue-200 text-blue-700">
              <RefreshCw size={11} className="animate-spin text-blue-600" />
              Testing Supabase Connection…
            </span>
          ) : isConnectionVerified ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-50 border-emerald-200 text-emerald-800">
              <CheckCircle2 size={11} className="text-emerald-600" />
              Supabase Auth Connected
            </span>
          ) : isConnectionFailed ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-red-50 border-red-200 text-red-700">
              <AlertCircle size={11} className="text-red-600" />
              Connection Check Failed
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-gray-50 border-gray-200 text-gray-600">
              <Server size={11} />
              Demo Mode Available
            </span>
          )}
        </div>
      </div>

      {/* Main card container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full">
          {/* Card branding */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white shadow-md shadow-primary/20 mb-3">
              <Layers size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
              Togetherly
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Workforce Intelligence & Skills Verification
            </p>
          </div>

          {/* Form Card */}
          <div className="card bg-white p-6 sm:p-8 shadow-card border-base-border">
            {/* Supabase status indicator - Only displays 'Supabase Connected' after real verification */}
            <div className="mb-5 flex items-center justify-between text-[11px] pb-3 border-b border-base-border">
              <span className="text-text-secondary font-medium">Authentication Gateway:</span>
              {configError ? (
                <span
                  className="inline-flex items-center gap-1 text-amber-700 font-semibold"
                  title={configError}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Configuration Notice
                </span>
              ) : isVerifyingConnection ? (
                <span className="inline-flex items-center gap-1 text-primary font-semibold">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  Checking Connection…
                </span>
              ) : isConnectionVerified ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Supabase Connected
                </span>
              ) : isConnectionFailed ? (
                <span
                  className="inline-flex items-center gap-1 text-red-600 font-semibold cursor-pointer"
                  onClick={() => verifyConnection()}
                  title={connectionVerification?.error || 'Connection failed. Click to recheck.'}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Connection Offline (Retry)
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-amber-600 font-semibold"
                  title="VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY not configured"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Demo Mode (Local Data)
                </span>
              )}
            </div>

            {/* Connection Check Failed Banner */}
            {isConnectionFailed && connectionVerification?.error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start justify-between gap-2 animate-fade-in">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-red-600" />
                  <div className="leading-snug">
                    <span className="font-semibold block mb-0.5">Connection Verification Failed</span>
                    {connectionVerification.error}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => verifyConnection()}
                  disabled={isVerifyingConnection}
                  className="text-red-700 underline hover:text-red-900 font-semibold text-[11px] flex-shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Config Error Banner */}
            {configError && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2 animate-fade-in">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
                <div className="leading-snug">
                  <span className="font-semibold block mb-0.5">Configuration Notice</span>
                  {configError}
                </div>
              </div>
            )}

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg mb-5 border border-base-border">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setLocalError(null);
                  clearAuthError();
                }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                  mode === 'signin'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setLocalError(null);
                  clearAuthError();
                }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                  mode === 'signup'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-fade-in">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-red-600" />
                <div className="leading-snug">{errorMessage}</div>
              </div>
            )}

            {/* Success message banner */}
            {signupSuccessMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2 animate-fade-in">
                <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5 text-emerald-600" />
                <div className="leading-snug">{signupSuccessMsg}</div>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Full Name <span className="text-critical">*</span>
                    </label>
                    <div className="relative">
                      <UserRound
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                      />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Morgan"
                        autoComplete="name"
                        required={mode === 'signup'}
                        className="input-field pl-9 w-full py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-primary mb-1">
                        Requested Department <span className="text-critical">*</span>
                      </label>
                      <div className="relative">
                        <Building2
                          size={14}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                        />
                        <select
                          value={requestedDepartment}
                          onChange={(e) => setRequestedDepartment(e.target.value)}
                          className="input-field pl-8 pr-2 w-full py-2 text-xs bg-white cursor-pointer"
                        >
                          {DEPARTMENT_OPTIONS.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-primary mb-1">
                        Job Title <span className="text-[10px] text-text-muted font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <BriefcaseBusiness
                          size={14}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                        />
                        <input
                          type="text"
                          value={requestedJobTitle}
                          onChange={(e) => setRequestedJobTitle(e.target.value)}
                          placeholder="e.g. Frontend Engineer"
                          className="input-field pl-8 w-full py-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Work Email
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex.morgan@company.com"
                    autoComplete="email"
                    required
                    className="input-field pl-9 w-full py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-text-primary">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <span className="text-[11px] text-text-muted">
                      Min. 6 characters
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    required
                    className="input-field pl-9 pr-9 w-full py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      className="input-field pl-9 w-full py-2 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* RBAC Notice for sign up */}
              {mode === 'signup' && (
                <div className="p-3 rounded-lg bg-base-subtle border border-base-border text-[11px] text-text-secondary leading-snug">
                  <div className="font-semibold text-text-primary flex items-center gap-1.5 mb-1">
                    <ShieldCheck size={13} className="text-primary" />
                    Strict Role-Based Provisioning
                  </div>
                  New self-registered accounts are created with unassigned privileges. To access confidential workforce planning and verification queues, your account must be mapped to an employee record by an authorized administrator.
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-2.5 text-xs font-semibold mt-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {mode === 'signin' ? 'Authenticating…' : 'Registering Account…'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    {mode === 'signin' ? 'Sign In to Workspace' : 'Register Secure Account'}
                    <ArrowRight size={14} />
                  </span>
                )}
              </button>
            </form>

            {/* Separator */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-base-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-semibold">
                <span className="bg-white px-3 text-text-muted tracking-wider">Or</span>
              </div>
            </div>

            {/* Demo Mode Button */}
            <div className="rounded-lg bg-primary-50/50 border border-primary/20 p-3.5">
              <div className="flex items-start gap-2.5 mb-2.5">
                <div className="p-1.5 rounded-md bg-primary text-white flex-shrink-0">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text-primary">
                    Explore Interactive Demo
                  </h3>
                  <p className="text-[11px] text-text-secondary leading-tight mt-0.5">
                    Evaluate Togetherly with simulated data, employee and manager perspectives, and the complete Training Completion Verification System.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDemoAccess}
                className="btn-secondary w-full py-2 text-xs font-semibold border-primary/30 text-primary hover:bg-primary-50 transition-colors"
              >
                Enter Demo Workspace
              </button>
            </div>
          </div>

          {/* Environmental information footer */}
          <div className="mt-4 px-2 text-center text-[11px] text-text-muted flex items-center justify-center gap-1.5">
            <Info size={12} />
            <span>
              {isConnectionVerified
                ? 'Secured by live Supabase Auth with persistent JWT sessions.'
                : isConfigured
                ? 'Connecting to configured Supabase project…'
                : 'Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable live authentication.'}
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 px-6 text-center border-t border-base-border bg-white text-[11px] text-text-secondary">
        Togetherly Workforce Intelligence · Enterprise Human Capital Management & Skills Verification
      </footer>
    </div>
  );
}
