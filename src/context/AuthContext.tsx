import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus, type SupabaseConfigStatus } from '@/lib/supabase';
import type { Employee } from '@/types';

export type IdentityStatus = 'unauthenticated' | 'demo' | 'pending_assignment' | 'mapped';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  configStatus: SupabaseConfigStatus;
  configError: string | null;
  configWarning?: string | null;
  isDemoMode: boolean;
  identityStatus: IdentityStatus;
  mappedEmployee: Employee | null;
  authError: string | null;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  clearAuthError: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_MODE_STORAGE_KEY = 'togetherly_demo_session_active';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const configStatus = getSupabaseConfigStatus();
  const configured = configStatus.isConfigured;

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    // If Supabase is not configured, default to demo mode so the app is immediately reviewable
    if (!isSupabaseConfigured()) {
      return true;
    }
    return sessionStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true';
  });

  // Listen for Supabase Auth state changes and restore existing sessions
  useEffect(() => {
    if (!configured || !supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Initial session retrieval
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('Supabase getSession warning:', error.message);
        // Do not block app on initial session check failure
      }

      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
        // An active Supabase session takes precedence over demo mode
        setIsDemoMode(false);
        sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
      }
      setIsLoading(false);
    }).catch((err) => {
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
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED' && newSession) {
        setSession(newSession);
        setUser(newSession.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  // Sign In with email and password
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);

    const currentConfig = getSupabaseConfigStatus();
    if (!currentConfig.isConfigured || !supabase) {
      const err = currentConfig.configError ||
        'Supabase is not configured. Please use Demo Workspace or check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
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
          friendlyMessage = 'Invalid email or password. Please verify your credentials or create a new account.';
        } else if (lower.includes('email not confirmed')) {
          friendlyMessage = 'Your email address has not been confirmed yet. Please check your inbox for the verification link.';
        } else if (lower.includes('invalid path') || error.status === 404) {
          friendlyMessage = 'Supabase API configuration error: Invalid URL path. Please verify that VITE_SUPABASE_URL points to the project root (https://<project-ref>.supabase.co).';
        } else if (lower.includes('rate limit')) {
          friendlyMessage = 'Too many authentication attempts. Please wait a few moments before trying again.';
        } else if (lower.includes('fetch') || lower.includes('network')) {
          friendlyMessage = 'Network error connecting to Supabase. Please verify your internet connection or project status.';
        }

        setAuthError(friendlyMessage);
        return { success: false, error: friendlyMessage };
      }

      setUser(data.user);
      setSession(data.session);
      setIsDemoMode(false);
      sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
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
  }, []);

  // Sign Up with email and password
  // SECURITY REQUIREMENT: Public signups are strictly registered with no elevated permissions.
  // We do NOT allow user-selected Manager, HR, or Admin roles during registration.
  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);

    const currentConfig = getSupabaseConfigStatus();
    if (!currentConfig.isConfigured || !supabase) {
      const err = currentConfig.configError ||
        'Supabase is not configured. Please use Demo Workspace or check environment variables.';
      setAuthError(err);
      return { success: false, error: err };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            // Unmapped by default. An admin must explicitly assign employee_id & role in the database.
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
          friendlyMessage = 'An account with this email address already exists. Please sign in instead.';
        } else if (lower.includes('invalid path') || error.status === 404) {
          friendlyMessage = 'Supabase API configuration error: Invalid URL path. Please verify that VITE_SUPABASE_URL points to the project root (https://<project-ref>.supabase.co).';
        } else if (lower.includes('rate limit')) {
          friendlyMessage = 'Registration rate limit exceeded. Please wait a few moments before trying again.';
        } else if (lower.includes('fetch') || lower.includes('network')) {
          friendlyMessage = 'Network connection failed while registering account.';
        }
        setAuthError(friendlyMessage);
        return { success: false, error: friendlyMessage };
      }

      // Supabase may require email confirmation depending on project configuration
      const requiresEmailConfirmation = !data.session && !!data.user;

      if (data.session) {
        setUser(data.user);
        setSession(data.session);
        setIsDemoMode(false);
        sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
      }

      return {
        success: true,
        requiresEmailConfirmation,
      };
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Sign up failed due to a network or configuration issue.';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  }, []);

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
      setAuthError(null);
      sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
      // If Supabase is unconfigured, remain in demo mode; otherwise require authentication
      setIsDemoMode(!isSupabaseConfigured());
    }
  }, []);

  // Enter demo mode explicitly
  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
    setAuthError(null);
  }, []);

  // Exit demo mode (returns user to login)
  const exitDemoMode = useCallback(() => {
    setIsDemoMode(false);
    sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    setUser(null);
    setSession(null);
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
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
    } catch (err) {
      console.warn('Session refresh warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Determine identity mapping status
  // In the current phase, database migrations have NOT been applied to the remote database.
  // Therefore, any newly authenticated Supabase user who does not have an admin-provisioned
  // app_metadata claim (e.g. employee_id) is marked as 'pending_assignment'.
  // This prevents unauthorized access to workforce intelligence until real authorization exists.
  let identityStatus: IdentityStatus = 'unauthenticated';
  let mappedEmployee: Employee | null = null;

  if (user) {
    // Check if the user has verified app_metadata or custom claims provisioned by an administrator
    const appRole = (user.app_metadata?.role as string) || (user.user_metadata?.role as string);
    const employeeId = (user.app_metadata?.employee_id as string) || (user.user_metadata?.employee_id as string);

    if (employeeId && appRole && appRole !== 'unassigned') {
      identityStatus = 'mapped';
      mappedEmployee = {
        id: employeeId,
        name: (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'Authenticated User',
        email: user.email || '',
        role: appRole,
        department: (user.user_metadata?.department as string) || 'Workforce',
        avatarColor: '#0078D4',
        availability: 'available',
        yearsExperience: 3,
        targetUtilization: 100,
        skills: [],
        trainingAssignments: [],
      };
    } else {
      // Authenticated with Supabase, but identity is unmapped/pending provisioning
      identityStatus = 'pending_assignment';
    }
  } else if (isDemoMode) {
    identityStatus = 'demo';
  }

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isConfigured: configured,
    configStatus,
    configError: configStatus.configError,
    configWarning: configStatus.warning,
    isDemoMode,
    identityStatus,
    mappedEmployee,
    authError,
    signInWithEmail,
    signUpWithEmail,
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
