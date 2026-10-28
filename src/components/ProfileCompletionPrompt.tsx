import { useEffect, useState } from 'react';
import { ArrowUpRight, UserRoundCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type PromptState = 'hidden' | 'loading' | 'incomplete' | 'submitted';

/**
 * A profile is personal information, not an employee-role privilege. Show the
 * setup prompt on each real user's dashboard until they submit a profile package.
 */
export function ProfileCompletionPrompt() {
  const location = useLocation();
  const { user, identityStatus } = useAuth();
  const employee = useCurrentEmployee();
  const userId = user?.id;
  const employeeId = employee?.id;
  const [state, setState] = useState<PromptState>('hidden');

  useEffect(() => {
    if (
      location.pathname !== '/' ||
      !userId ||
      identityStatus !== 'mapped' ||
      !employeeId ||
      !supabase ||
      !isSupabaseConfigured()
    ) {
      setState('hidden');
      return;
    }

    let cancelled = false;
    setState('loading');

    void supabase
      .from('employee_profile_submissions')
      .select('id')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Don't block the dashboard if an optional onboarding query fails.
          console.warn('Profile completion status could not be loaded:', error.message);
          setState('hidden');
          return;
        }
        setState(data && data.length > 0 ? 'submitted' : 'incomplete');
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, userId, identityStatus, employeeId]);

  if (state !== 'incomplete') return null;

  return (
    <section className="mb-5 flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <UserRoundCheck size={19} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-text-primary">Complete your profile</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">
            Add your skills, experience, education and credentials so your profile is useful to
            workforce planning and talent reviews. This is available to employees, managers, HR and
            administrators alike; it does not change your access role.
          </p>
        </div>
      </div>
      <Link
        to="/my-profile"
        className="btn-primary inline-flex shrink-0 items-center justify-center gap-1.5 text-xs"
      >
        Complete profile <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
