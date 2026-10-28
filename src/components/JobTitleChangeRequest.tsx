import { useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, BriefcaseBusiness, Clock3, ShieldCheck } from 'lucide-react';
import { Reveal } from '@/components/Reveal';
import { useData } from '@/context/DataContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { EmployeeProfileClaim } from '@/types';

type JobTitleChangeRequestProps = {
  currentTitle: string;
  claims: EmployeeProfileClaim[];
  onSubmitted: () => Promise<void>;
};

export function JobTitleChangeRequest({
  currentTitle,
  claims,
  onSubmitted,
}: JobTitleChangeRequestProps) {
  const { showToast } = useData();
  const [requestedTitle, setRequestedTitle] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pendingRequest = useMemo(
    () => claims
      .filter((claim) => claim.claim_type === 'job-title' && claim.status === 'pending-verification')
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0] ?? null,
    [claims],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isSupabaseConfigured()) {
      showToast('error', 'The title-verification service is unavailable.');
      return;
    }

    const title = requestedTitle.trim();
    const explanation = reason.trim();
    if (!title || !explanation) {
      showToast('error', 'Enter the requested title and explain why it should change.');
      return;
    }
    if (title.length > 180 || explanation.length > 2000) {
      showToast('error', 'The job title must be 180 characters or fewer and the explanation 2,000 characters or fewer.');
      return;
    }
    if (title.toLocaleLowerCase() === currentTitle.trim().toLocaleLowerCase()) {
      showToast('error', 'The requested title matches your current official title.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc('submit_employee_profile_claim_with_evidence', {
      p_claim_type: 'job-title',
      p_skill_id: null,
      p_claimed_level: null,
      p_claimed_years: null,
      p_title: title,
      p_organization: null,
      p_start_date: null,
      p_end_date: null,
      p_description: explanation,
      p_evidence_url: null,
      p_evidence_label: null,
      p_claim_id: null,
      p_evidence_storage_path: null,
    });
    setSubmitting(false);

    if (error) {
      showToast('error', error.message || 'Could not submit your title for verification.');
      return;
    }

    setRequestedTitle('');
    setReason('');
    showToast('success', 'Your job-title change request is pending independent verification. Your official title has not changed.');
    await onSubmitted();
  }

  return (
    <Reveal>
      <section className="card overflow-hidden border-primary/20 shadow-sm">
        <div className="flex items-start gap-3 border-b border-base-border/60 bg-primary/5 p-4 sm:p-5">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
            <BriefcaseBusiness size={19} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-text-primary">Request a job-title change</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Your official title is read-only here. Submit a request, and an authorized reviewer
              must verify it before the employee record changes.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-lg border border-base-border/70 bg-base-bg/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Current official title</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{currentTitle || 'Not assigned'}</p>
          </div>

          {pendingRequest ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-800">
                <Clock3 size={16} />
                <h3 className="text-xs font-bold">Title change awaiting review</h3>
              </div>
              <p className="mt-2 text-sm font-semibold text-amber-950">Requested title: {pendingRequest.title}</p>
              {pendingRequest.description && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-amber-900">{pendingRequest.description}</p>}
              <p className="mt-3 text-[11px] leading-relaxed text-amber-900">
                Your current official title remains unchanged until a reviewer other than the requester verifies this claim.
              </p>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
              <label className="block text-xs font-semibold text-text-secondary">
                Requested job title *
                <input
                  className="input-field mt-1.5 w-full"
                  value={requestedTitle}
                  onChange={(event) => setRequestedTitle(event.target.value)}
                  maxLength={180}
                  required
                  placeholder="e.g. Senior Cloud Engineer"
                />
              </label>
              <label className="block text-xs font-semibold text-text-secondary">
                Reason / supporting context *
                <textarea
                  className="input-field mt-1.5 min-h-24 w-full"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={2000}
                  required
                  placeholder="Explain the role change and any supporting context for the reviewer."
                />
              </label>
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-text-secondary">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary" />
                <p>Submitting this request does not update your title immediately. A manager, HR reviewer, or administrator must review it, and you cannot verify your own request.</p>
              </div>
              <button type="submit" className="btn-primary text-xs" disabled={submitting}>
                <ArrowUpRight size={14} /> {submitting ? 'Submitting…' : 'Submit for verification'}
              </button>
            </form>
          )}
        </div>
      </section>
    </Reveal>
  );
}
