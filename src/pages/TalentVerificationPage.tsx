import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, BriefcaseBusiness, ExternalLink, FileCheck2, RefreshCw, ShieldCheck, Users, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Reveal';
import { EmptyState } from '@/components/EmptyState';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { useData } from '@/context/DataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { EmployeeProfileClaim, EmployeeProfileClaimDecision } from '@/types';

type SkillOption = { id: string; name: string; category: string };
const statusStyles: Record<string, string> = {
  'pending-verification': 'bg-amber-50 text-amber-800 border-amber-200',
  verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 border-rose-200',
  'needs-more-evidence': 'bg-indigo-50 text-indigo-800 border-indigo-200',
};
const statusLabels: Record<string, string> = {
  'pending-verification': 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
  'needs-more-evidence': 'More evidence requested',
};
const decisionLabels: Record<EmployeeProfileClaimDecision, string> = {
  verified: 'Verify claim',
  rejected: 'Reject claim',
  'needs-more-evidence': 'Request evidence',
};

export function TalentVerificationPage() {
  const reviewer = useCurrentEmployee();
  const { employees, showToast, addActivity } = useData();
  const [claims, setClaims] = useState<EmployeeProfileClaim[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [filter, setFilter] = useState<'pending-verification' | 'all' | 'verified' | 'rejected' | 'needs-more-evidence'>('pending-verification');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingClaimId, setSavingClaimId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!supabase || !isSupabaseConfigured()) {
      setErrorMessage('Supabase is not configured. Verification requires a live database connection.');
      setLoading(false);
      return;
    }
    if (quiet) setRefreshing(true); else setLoading(true);
    setErrorMessage(null);
    const [claimResult, skillResult, auditResult] = await Promise.all([
      supabase.from('employee_profile_claims').select('*').order('created_at', { ascending: false }),
      supabase.from('skills').select('id, name, category').order('name', { ascending: true }),
      supabase.from('employee_profile_claim_audit').select('*').order('created_at', { ascending: false }),
    ]);
    if (claimResult.error) setErrorMessage(claimResult.error.message);
    else setClaims((claimResult.data ?? []) as EmployeeProfileClaim[]);
    if (skillResult.error) setErrorMessage(skillResult.error.message);
    else setSkills((skillResult.data ?? []) as SkillOption[]);
    if (auditResult.error) setErrorMessage(auditResult.error.message);
    else setAudit((auditResult.data ?? []) as Array<Record<string, unknown>>);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const skillById = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);
  const pendingCount = claims.filter((claim) => claim.status === 'pending-verification').length;
  const verifiedCount = claims.filter((claim) => claim.status === 'verified').length;
  const filteredClaims = useMemo(() => filter === 'all' ? claims : claims.filter((claim) => claim.status === filter), [claims, filter]);

  async function handleDecision(claim: EmployeeProfileClaim, decision: EmployeeProfileClaimDecision) {
    if (!supabase || savingClaimId) return;
    if (!reviewer || reviewer.id === claim.employee_id) {
      showToast('error', 'You cannot verify your own profile claims.');
      return;
    }
    const reviewerNote = (notes[claim.id] ?? '').trim();
    if (decision !== 'verified' && !reviewerNote) {
      showToast('error', 'Add a reviewer note explaining the rejection or evidence requested.');
      return;
    }
    if (!window.confirm(`${decisionLabels[decision]} for ${employeeById.get(claim.employee_id)?.name ?? 'this employee'}?`)) return;

    setSavingClaimId(claim.id);
    const { error } = await supabase.rpc('review_employee_profile_claim', {
      p_claim_id: claim.id,
      p_decision: decision,
      p_notes: reviewerNote || null,
    });
    setSavingClaimId(null);
    if (error) {
      showToast('error', error.message || 'Could not save the review decision.');
      return;
    }

    const employeeName = employeeById.get(claim.employee_id)?.name ?? 'Employee';
    const claimTitle = claim.claim_type === 'skill'
      ? skillById.get(claim.skill_id ?? '')?.name ?? claim.title ?? 'skill'
      : claim.title ?? claim.claim_type;
    addActivity(`${decisionLabels[decision]}: ${employeeName} · ${claimTitle}`, 'system');
    showToast('success', `${claimTitle} marked ${decisionLabels[decision].toLowerCase().replace('claim','').trim()}.`);
    window.dispatchEvent(new Event('togetherly:verified-skills-updated'));
    await load(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Talent Verification" description="Review employee-submitted skills, experience and certifications before they become trusted workforce qualifications." breadcrumb={['Home', 'Talent Verification']} actions={<button type="button" onClick={() => void load(true)} className="btn-secondary" disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/> Refresh queue</button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><div className="flex items-center gap-2 text-text-secondary"><AlertTriangle size={16} className="text-warning"/><span className="text-xs font-semibold uppercase tracking-wider">Awaiting review</span></div><div className="mt-2 text-3xl font-extrabold text-warning">{pendingCount}</div></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-text-secondary"><BadgeCheck size={16} className="text-success"/><span className="text-xs font-semibold uppercase tracking-wider">Verified claims</span></div><div className="mt-2 text-3xl font-extrabold text-success">{verifiedCount}</div></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-text-secondary"><Users size={16} className="text-primary"/><span className="text-xs font-semibold uppercase tracking-wider">Total submissions</span></div><div className="mt-2 text-3xl font-extrabold text-text-primary">{claims.length}</div></div>
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <label htmlFor="talent-claim-filter" className="text-xs font-semibold text-text-secondary">Show</label>
        <select id="talent-claim-filter" className="input-field py-1.5 text-xs" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="pending-verification">Pending review</option><option value="all">All claims</option><option value="verified">Verified</option><option value="needs-more-evidence">More evidence requested</option><option value="rejected">Rejected</option>
        </select>
        <span className="ml-auto text-xs text-text-secondary">{filteredClaims.length} claim{filteredClaims.length === 1 ? '' : 's'}</span>
      </div>

      {errorMessage && <div className="rounded-xl border border-critical/25 bg-critical/5 p-4 text-xs text-critical">{errorMessage}</div>}
      {loading ? <div className="card py-12 text-center text-xs text-text-secondary">Loading verification queue…</div> : filteredClaims.length === 0 ? <EmptyState icon={<ShieldCheck size={20} />} title="No claims in this view" description={filter === 'pending-verification' ? 'New employee profile submissions will appear here.' : 'No claims match this filter.'}/> : <div className="space-y-4">{filteredClaims.map((claim, index) => {
        const employee = employeeById.get(claim.employee_id);
        const skillName = claim.skill_id ? skillById.get(claim.skill_id)?.name : null;
        const title = claim.claim_type === 'skill' ? skillName ?? claim.title ?? 'Skill claim' : claim.title ?? claim.claim_type;
        const isSelf = reviewer?.id === claim.employee_id;
        const events = audit.filter((event) => event.claim_id === claim.id);
        return <Reveal key={claim.id} delay={index * 20}><article className="card p-5 border-base-border/70 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3"><div className="rounded-xl bg-primary/10 border border-primary/20 p-2.5 text-primary">{claim.claim_type === 'experience' ? <BriefcaseBusiness size={18}/> : claim.claim_type === 'certification' ? <FileCheck2 size={18}/> : <ShieldCheck size={18}/>}</div><div className="min-w-0"><h2 className="text-sm font-bold text-text-primary">{title}</h2><p className="mt-1 text-xs text-text-secondary">{employee?.name ?? claim.employee_id}{employee?.email ? ` · ${employee.email}` : ''}</p><p className="mt-1 text-[11px] text-text-secondary">{claim.claim_type === 'skill' ? `Claimed proficiency: ${claim.claimed_level}/5` : claim.claim_type === 'experience' ? `${claim.claimed_years} years claimed` : claim.organization || 'Certification / credential'} · Submitted {new Date(claim.submitted_at).toLocaleDateString()}</p></div></div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyles[claim.status] ?? 'border-base-border text-text-secondary'}`}>{statusLabels[claim.status] ?? claim.status}</span>
          </div>
          {claim.organization && <p className="mt-3 text-xs text-text-secondary"><span className="font-semibold text-text-primary">Organization / provider:</span> {claim.organization}</p>}
          {claim.start_date || claim.end_date ? <p className="mt-1 text-xs text-text-secondary">Dates: {claim.start_date || 'Not supplied'} – {claim.end_date || 'Present / not supplied'}</p> : null}
          {claim.description && <div className="mt-3 rounded-lg border border-base-border/60 bg-base-bg/50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Employee explanation</p><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-text-primary">{claim.description}</p></div>}
          {claim.evidence_url && <a href={claim.evidence_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">{claim.evidence_label || 'Open supporting evidence'} <ExternalLink size={13}/></a>}
          {claim.reviewer_notes && <div className="mt-3 rounded-lg border border-base-border/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Previous reviewer feedback{claim.reviewer_name ? ` · ${claim.reviewer_name}` : ''}</p><p className="mt-1 whitespace-pre-wrap text-xs text-text-secondary">{claim.reviewer_notes}</p></div>}
          {claim.status === 'pending-verification' && <div className="mt-4 border-t border-base-border/60 pt-4">
            <label className="mb-1.5 block text-xs font-semibold text-text-secondary" htmlFor={`review-note-${claim.id}`}>Reviewer note {isSelf ? '(self-review blocked)' : '(required for reject / more evidence)'}</label>
            <textarea id={`review-note-${claim.id}`} className="input-field min-h-20 w-full" value={notes[claim.id] ?? ''} onChange={(event) => setNotes((previous) => ({ ...previous, [claim.id]: event.target.value }))} placeholder="Record what evidence you checked, or explain what needs to be corrected." disabled={Boolean(savingClaimId) || isSelf}/>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-xs" disabled={Boolean(savingClaimId) || isSelf} onClick={() => void handleDecision(claim, 'verified')}><BadgeCheck size={14}/>{savingClaimId === claim.id ? 'Saving…' : 'Verify claim'}</button>
              <button type="button" className="btn-secondary text-xs" disabled={Boolean(savingClaimId) || isSelf} onClick={() => void handleDecision(claim, 'needs-more-evidence')}><FileCheck2 size={14}/>Request more evidence</button>
              <button type="button" className="btn-secondary text-xs text-critical" disabled={Boolean(savingClaimId) || isSelf} onClick={() => void handleDecision(claim, 'rejected')}><XCircle size={14}/>Reject claim</button>
            </div>
            {isSelf && <p className="mt-2 text-[11px] text-critical">You cannot verify your own claim.</p>}
          </div>}
          {events.length > 0 && <details className="mt-4 border-t border-base-border/50 pt-3"><summary className="cursor-pointer text-[11px] font-semibold text-text-secondary">Audit history ({events.length})</summary><div className="mt-3 space-y-2">{events.map((event) => <div key={String(event.id)} className="border-l-2 border-base-border pl-3 py-1"><p className="text-[11px] font-semibold text-text-primary">{String(event.action).replace(/-/g,' ')} · {String(event.actor_name)}</p><p className="text-[10px] text-text-secondary">{new Date(String(event.created_at)).toLocaleString()}{event.note ? ` · ${String(event.note)}` : ''}</p></div>)}</div></details>}
        </article></Reveal>;
      })}</div>}
      <p className="text-[11px] text-text-secondary">Verifying a skill writes it to the canonical employee skills inventory. Verifying experience updates the official experience field. Rejection or an evidence request leaves the claim out of Team Builder qualification data.</p>
    </div>
  );
}
