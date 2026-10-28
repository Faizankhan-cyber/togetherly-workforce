import { ArrowUpRight, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';

/** Profile editing is available to every linked, active workforce identity. */
export function ProfileUpdateSection() {
  const { user, identityStatus } = useAuth();
  const employee = useCurrentEmployee();

  if (!user || identityStatus !== 'mapped' || !employee) return null;

  return (
    <section className="mb-5 flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <UserRoundCheck size={19} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-text-primary">Update your profile</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">
            Keep your skills, experience, education and credentials up to date. Submitted changes
            are reviewed before they are used for workforce planning and talent decisions.
          </p>
        </div>
      </div>
      <Link
        to="/my-profile"
        className="btn-primary inline-flex shrink-0 items-center justify-center gap-1.5 text-xs"
      >
        Update profile <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
