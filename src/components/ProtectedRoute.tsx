import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { IdentityPendingPage } from '@/pages/IdentityPendingPage';
import { Layers } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, isDemoMode, identityStatus } = useAuth();
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

  // If user is authenticated with Supabase, but their account is not mapped to an employee record
  // (e.g. self-registered signup or unmapped user), protect sensitive workforce intelligence
  // by displaying the IdentityPendingPage.
  if (user && identityStatus === 'pending_assignment') {
    return <IdentityPendingPage />;
  }

  // If not authenticated and not in demo mode, redirect to the login page
  if (!user && !isDemoMode) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Otherwise, user is either mapped or in authorized demo mode
  return <>{children}</>;
}
