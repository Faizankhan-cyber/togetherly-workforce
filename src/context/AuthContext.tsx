import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  verifySupabaseConnection,
  type SupabaseConfigStatus,
  type SupabaseConnectionVerification,
} from '@/lib/supabase';
import type {
  Employee,
  EmployeeRegistrationRequest,
  RegistrationRequestStatus,
  SystemRole,
} from '@/types';

export type IdentityStatus = 'unauthenticated' | 'demo' | 'pending_assignment' | 'mapped';

export interface SignUpProfileOptions {
  fullName?: string;
  requestedDepartment?: string;
  requestedJobTitle?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  configStatus: SupabaseConfigStatus;
  configError: string | null;
  configWarning?: string | null;
  connectionVerification: SupabaseConnectionVerification | null;
  isVerifyingConnection: boolean;
  verifyConnection: () => Promise<SupabaseConnectionVerification>;
  isDemoMode: boolean;
  identityStatus: IdentityStatus;
  mappedEmployee: Employee | null;
  systemRole: SystemRole | 'unassigned';
  isAdmin: boolean;
  registrationRequest: EmployeeRegistrationRequest | null;
  registrationTableMissing: boolean;
  authError: string | null;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    profileOptions?: SignUpProfileOptions
  ) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  updateMyRegistrationRequest: (updates: {
    applicantName: string;
    requestedDepartment: string;
    requestedJobTitle?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  clearAuthError: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_MODE_STORAGE_KEY = 'togetherly_demo_session_active';

const VALID_SYSTEM_ROLES: SystemRole[] = ['employee', 'manager', 'hr', 'admin'];

function isValidSystemRole(val: unknown): val is SystemRole {
  return typeof val === 'string' && VALID_SYSTEM_ROLES.includes(val as SystemRole);
}

function mapRegistrationRow(row: Record<string, unknown>): EmployeeRegistrationRequest {
  return {
    id: String(row.id || ''),
    authUserId: String(row.auth_user_id || ''),
    applicantName: String(row.applicant_name || 'Applicant'),
    email: String(row.email || ''),
    requestedDepartment: String(row.requested_department || 'Engineering'),
    requestedJobTitle: (row.requested_job_title as string | null) ?? null,
    assignedRole: isValidSystemRole(row.assigned_role) ? row.assigned_role : null,
    assignedDepartment: (row.assigned_department as string | null) ?? null,
    assignedJobTitle: (row.assigned_job_title as string | null) ?? null,
    employeeId: (row.employee_id as string | null) ?? null,
    status: (['pending', 'approved', 'rejected'].includes(String(row.status))
      ? row.status
      : 'pending') as RegistrationRequestStatus,
    reviewerId: (row.reviewer_id as string | null) ?? null,
    reviewerName: (row.reviewer_name as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Database-verified employee record and registration request for the current user
  const [dbEmployee, setDbEmployee] = useState<Employee | null>(null);
  const [registrationRequest, setRegistrationRequest] = useState<EmployeeRegistrationRequest | null>(null);
  const [registrationTableMissing, setRegistrationTableMissing] = useState<boolean>(false);

  // Active connection verification state
  const [connectionVerification, setConnectionVerification] = useState<SupabaseConnectionVerification | null>(null);
  const [isVerifyingConnection, setIsVerifyingConnection] = useState<boolean>(false);

  const configStatus = getSupabaseConfigStatus();
  const configured = configStatus.isConfigured;

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (!isSupabaseConfigured()) {
      return true;
    }
    return sessionStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true';
  });

  // Verify connection against live Supabase Auth endpoint
  const verifyConnection = useCallback(async (): Promise<SupabaseConnectionVerification> => {
    if (!isSupabaseConfigured()) {
      const unconfiguredResult: SupabaseConnectionVerification = {
        connected: false,
        checkedAt: new Date().toISOString(),
        error: configStatus.configError || 'Supabase credentials are not configured.',
      };
      setConnectionVerification(unconfiguredResult);
      return unconfiguredResult;
    }

    setIsVerifyingConnection(true);
    try {
      const result = await verifySupabaseConnection();
      setConnectionVerification(result);
      return result;
    } finally {
      setIsVerifyingConnection(false);
    }
  }, [configStatus.configError]);

  // Initial connection check on mount
  useEffect(() => {
    if (configured) {
      verifyConnection();
    }
  }, [configured, verifyConnection]);

  // Synchronize authoritative employee profile & registration request from Supabase database
  const syncUserDatabaseIdentity = useCallback(async (activeUser: User | null) => {
    if (!activeUser || !supabase || !isSupabaseConfigured()) {
      setDbEmployee(null);
      setRegistrationRequest(null);
      return;
    }

    try {
      // 1. Check if the user has a linked employee record in public.employees
      const empRes = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', activeUser.id)
        .maybeSingle();
      let empRow = empRes.data;
      const empErr = empRes.error;

      // If no linked employee row yet, attempt safe pre-provisioned profile claim
      if (!empRow && !empErr) {
        try {
          const { data: claimResult } = await supabase.rpc('claim_preprovisioned_employee_profile');
          if (claimResult && typeof claimResult === 'object' && (claimResult as { linked?: boolean }).linked) {
            const retryRes = await supabase
              .from('employees')
              .select('*')
              .eq('auth_user_id', activeUser.id)
              .maybeSingle();
            empRow = retryRes.data;
          }
        } catch {
          // Ignore if RPC is not yet created on remote DB
        }
      }

      // Fallback lookup by verified email if pre-seeded row exists in public.employees
      if (!empRow && !empErr && activeUser.email) {
        const byEmailRes = await supabase
          .from('employees')
          .select('*')
          .ilike('email', activeUser.email.trim())
          .maybeSingle();
        if (byEmailRes.data && (!byEmailRes.data.auth_user_id || byEmailRes.data.auth_user_id === activeUser.id)) {
          empRow = byEmailRes.data;
        }
      }

      if (empRow) {
        const resolvedSysRole: SystemRole = isValidSystemRole(empRow.system_role)
          ? empRow.system_role
          : 'employee';

        setDbEmployee({
          id: String(empRow.id),
          authUserId: String(empRow.auth_user_id || activeUser.id),
          name: String(empRow.name || activeUser.email?.split('@')[0] || 'Authenticated User'),
          email: String(empRow.email || activeUser.email || ''),
          role: String(empRow.role || 'Workforce Specialist'),
          systemRole: resolvedSysRole,
          department: String(empRow.department || 'Engineering'),
          avatarColor: String(empRow.avatar_color || '#0078D4'),
          availability: (empRow.availability as Employee['availability']) || 'available',
          yearsExperience: Number(empRow.years_experience ?? 3),
          targetUtilization: Number(empRow.target_utilization ?? 100),
          skills: [],
          trainingAssignments: [],
        });
      } else {
        setDbEmployee(null);
      }

      // 2. Fetch or ensure the user's registration request in public.employee_registration_requests
      const { data: reqRow, error: reqErr } = await supabase
        .from('employee_registration_requests')
        .select('*')
        .eq('auth_user_id', activeUser.id)
        .maybeSingle();

      if (reqErr) {
        const lowerErr = reqErr.message.toLowerCase();
        if (
          reqErr.code === 'PGRST205' ||
          reqErr.code === '42P01' ||
          lowerErr.includes('employee_registration_requests')
        ) {
          setRegistrationTableMissing(true);
        }
      } else {
        setRegistrationTableMissing(false);
      }

      if (reqRow) {
        setRegistrationRequest(mapRegistrationRow(reqRow as Record<string, unknown>));
      } else if (!reqErr) {
        // Ensure a pending registration request row exists via RPC
        try {
          const { data: ensuredRow } = await supabase.rpc('ensure_my_registration_request');
          if (ensuredRow && typeof ensuredRow === 'object') {
            setRegistrationRequest(mapRegistrationRow(ensuredRow as Record<string, unknown>));
          }
        } catch {
          // Ignore if migration has not been applied yet
        }
      }
    } catch (err) {
      console.warn('Database identity sync warning:', err);
    }
  }, []);

  // Listen for Supabase Auth state changes and restore existing sessions
  useEffect(() => {
    if (!configured || !supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Initial session retrieval
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('Supabase getSession warning:', error.message);
        }

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          setIsDemoMode(false);
          sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
          await syncUserDatabaseIdentity(initialSession.user);
        }
        if (isMounted) {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Session retrieval exception:', err);
        setIsLoading(false);
      });

    // 2. Real-time auth subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' && newSession) {
        setIsDemoMode(false);
        sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
        setAuthError(null);
        void syncUserDatabaseIdentity(newSession.user);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setDbEmployee(null);
        setRegistrationRequest(null);
      } else if (event === 'TOKEN_REFRESHED' && newSession) {
        setSession(newSession);
        setUser(newSession.user);
        void syncUserDatabaseIdentity(newSession.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configured, syncUserDatabaseIdentity]);

  // Sign In with email and password
  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);

      const currentConfig = getSupabaseConfigStatus();
      if (!currentConfig.isConfigured || !supabase) {
        const err =
          currentConfig.configError ||
          'Supabase is not configured. Please use Demo Workspace or configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.';
        setAuthError(err);
        return { success: false, error: err };
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          let friendlyMessage = error.message;
          const lower = error.message.toLowerCase();
          if (lower.includes('invalid login credentials')) {
            friendlyMessage =
              'Invalid email or password. Please verify your credentials or create a new account.';
          } else if (lower.includes('email not confirmed')) {
            friendlyMessage =
              'Your email address has not been confirmed yet. Please check your inbox for the verification link.';
          } else if (lower.includes('invalid path') || error.status === 404) {
            friendlyMessage =
              'Supabase API configuration error: Invalid URL path. Ensure VITE_SUPABASE_URL is strictly the origin root (e.g. https://<project-ref>.supabase.co).';
          } else if (lower.includes('rate limit')) {
            friendlyMessage =
              'Too many authentication attempts. Please wait a few moments before trying again.';
          } else if (lower.includes('fetch') || lower.includes('network')) {
            friendlyMessage =
              'Network error connecting to Supabase. Please verify your internet connection or project status.';
          }

          setAuthError(friendlyMessage);
          return { success: false, error: friendlyMessage };
        }

        setUser(data.user);
        setSession(data.session);
        setIsDemoMode(false);
        sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
        await syncUserDatabaseIdentity(data.user);
        return { success: true };
      } catch (err: unknown) {
        const rawMsg = (err as Error)?.message || '';
        let msg = 'An unexpected error occurred during sign in. Please try again.';
        if (rawMsg.toLowerCase().includes('fetch') || rawMsg.toLowerCase().includes('network')) {
          msg = 'Network error connecting to Supabase. Please verify your internet connection.';
        } else if (rawMsg) {
          msg = rawMsg;
        }
        setAuthError(msg);
        return { success: false, error: msg };
      }
    },
    [syncUserDatabaseIdentity]
  );

  // Sign Up with email, password, and applicant metadata
  // SECURITY REQUIREMENT: Public signups are strictly registered with no elevated permissions.
  // They enter public.employee_registration_requests with status = 'pending' until approved by an admin.
  const signUpWithEmail = useCallback(
    async (email: string, password: string, profileOptions?: SignUpProfileOptions) => {
      setAuthError(null);

      const currentConfig = getSupabaseConfigStatus();
      if (!currentConfig.isConfigured || !supabase) {
        const err =
          currentConfig.configError ||
          'Supabase is not configured. Please use Demo Workspace or check environment variables.';
        setAuthError(err);
        return { success: false, error: err };
      }

      const cleanEmail = email.trim();
      const defaultName = cleanEmail
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const cleanName = profileOptions?.fullName?.trim() || defaultName;
      const cleanDept = profileOptions?.requestedDepartment?.trim() || 'Engineering';
      const cleanTitle = profileOptions?.requestedJobTitle?.trim() || undefined;

      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              requested_department: cleanDept,
              ...(cleanTitle ? { requested_job_title: cleanTitle } : {}),
              // Unmapped by default. An admin must explicitly review and approve in Employee Verification.
              role: 'unassigned',
              requires_admin_mapping: true,
              signup_timestamp: new Date().toISOString(),
            },
          },
        });

        if (error) {
          let friendlyMessage = error.message;
          const lower = error.message.toLowerCase();
          if (lower.includes('user already registered')) {
            friendlyMessage =
              'An account with this email address already exists. Please sign in instead.';
          } else if (lower.includes('invalid path') || error.status === 404) {
            friendlyMessage =
              'Supabase API configuration error: Invalid URL path. Ensure VITE_SUPABASE_URL points to the project root (https://<project-ref>.supabase.co).';
          } else if (lower.includes('rate limit')) {
            friendlyMessage =
              'Registration rate limit exceeded. Please wait a few moments before trying again.';
          } else if (lower.includes('fetch') || lower.includes('network')) {
            friendlyMessage = 'Network connection failed while registering account.';
          }
          setAuthError(friendlyMessage);
          return { success: false, error: friendlyMessage };
        }

        const requiresEmailConfirmation = !data.session && !!data.user;

        if (data.session && data.user) {
          setUser(data.user);
          setSession(data.session);
          setIsDemoMode(false);
          sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
          await syncUserDatabaseIdentity(data.user);
        }

        return {
          success: true,
          requiresEmailConfirmation,
        };
      } catch (err: unknown) {
        const msg =
          (err as Error)?.message || 'Sign up failed due to a network or configuration issue.';
        setAuthError(msg);
        return { success: false, error: msg };
      }
    },
    [syncUserDatabaseIdentity]
  );

  // Update the current applicant's pending registration request details
  const updateMyRegistrationRequest = useCallback(
    async (updates: {
      applicantName: string;
      requestedDepartment: string;
      requestedJobTitle?: string;
    }) => {
      if (!supabase || !user) {
        return { success: false, error: 'You must be signed in to update your registration request.' };
      }
      try {
        const { data, error } = await supabase.rpc('ensure_my_registration_request', {
          p_applicant_name: updates.applicantName.trim(),
          p_requested_department: updates.requestedDepartment.trim(),
          p_requested_job_title: updates.requestedJobTitle?.trim() || null,
        });
        if (error) {
          return { success: false, error: error.message };
        }
        if (data && typeof data === 'object') {
          setRegistrationRequest(mapRegistrationRow(data as Record<string, unknown>));
        }
        return { success: true };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as Error)?.message || 'Failed to update registration request.',
        };
      }
    },
    [user]
  );

  // Sign out cleanly
  const signOut = useCallback(async () => {
    try {
      if (supabase && isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Error during Supabase signOut:', err);
    } finally {
      setUser(null);
      setSession(null);
      setDbEmployee(null);
      setRegistrationRequest(null);
      setAuthError(null);
      sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
      setIsDemoMode(!isSupabaseConfigured());
    }
  }, []);

  // Enter demo mode explicitly
  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
    setAuthError(null);
  }, []);

  // Exit demo mode (returns user to login or active Supabase session)
  const exitDemoMode = useCallback(() => {
    setIsDemoMode(false);
    sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    setAuthError(null);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    setIsLoading(true);
    try {
      const { data } = await supabase.auth.refreshSession();
      const activeUser = data.session?.user ?? user;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      if (activeUser) {
        await syncUserDatabaseIdentity(activeUser);
      }
    } catch (err) {
      console.warn('Session refresh warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, syncUserDatabaseIdentity]);

  // Determine authoritative identity mapping status and systemRole.
  // SECURITY: Never trust user_metadata for role or employee_id.
  // Trust only the database-verified public.employees row or server-controlled app_metadata claims.
  let identityStatus: IdentityStatus = 'unauthenticated';
  let mappedEmployee: Employee | null = null;
  let systemRole: SystemRole | 'unassigned' = 'unassigned';

  if (user) {
    const appSysRole =
      (user.app_metadata?.system_role as string) || (user.app_metadata?.role as string);
    const appEmployeeId = user.app_metadata?.employee_id as string | undefined;
    const isRejectedInAppMeta = user.app_metadata?.registration_status === 'rejected';

    if (dbEmployee) {
      identityStatus = 'mapped';
      mappedEmployee = dbEmployee;
      systemRole = dbEmployee.systemRole || 'employee';
    } else if (
      !isRejectedInAppMeta &&
      registrationRequest?.status !== 'rejected' &&
      appEmployeeId &&
      isValidSystemRole(appSysRole)
    ) {
      identityStatus = 'mapped';
      systemRole = appSysRole;
      mappedEmployee = {
        id: appEmployeeId,
        authUserId: user.id,
        name:
          (user.user_metadata?.full_name as string) ||
          user.email?.split('@')[0] ||
          'Authenticated User',
        email: user.email || '',
        role: (user.app_metadata?.job_title as string) || appSysRole,
        systemRole: appSysRole,
        department: (user.app_metadata?.department as string) || 'Engineering',
        avatarColor: '#0078D4',
        availability: 'available',
        yearsExperience: 3,
        targetUtilization: 100,
        skills: [],
        trainingAssignments: [],
      };
    } else {
      identityStatus = 'pending_assignment';
      systemRole = 'unassigned';
    }
  } else if (isDemoMode) {
    identityStatus = 'demo';
    systemRole = 'unassigned';
  }

  // Strictly require an authenticated, mapped administrator identity (never the demo role switcher)
  const isAdmin = Boolean(user && identityStatus === 'mapped' && systemRole === 'admin');

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isConfigured: configured,
    configStatus,
    configError: configStatus.configError,
    configWarning: configStatus.warning,
    connectionVerification,
    isVerifyingConnection,
    verifyConnection,
    isDemoMode,
    identityStatus,
    mappedEmployee,
    systemRole,
    isAdmin,
    registrationRequest,
    registrationTableMissing,
    authError,
    signInWithEmail,
    signUpWithEmail,
    updateMyRegistrationRequest,
    signOut,
    enterDemoMode,
    exitDemoMode,
    clearAuthError,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
