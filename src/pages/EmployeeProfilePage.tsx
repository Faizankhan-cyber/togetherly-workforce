import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, BriefcaseBusiness, ExternalLink, FileCheck2, Plus, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Reveal';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { EmployeeProfileClaim, EmployeeProfileClaimType } from '@/types';

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

export function EmployeeProfilePage() {
  const employee = useCurrentEmployee();
  const { user } = useAuth();
  const { showToast } = useData();
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [claims, setClaims] = useState<EmployeeProfileClaim[]>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claimType, setClaimType] = useState<EmployeeProfileClaimType>('skill');
  const [skillId, setSkillId] = useState('');
  const [claimedLevel, setClaimedLevel] = useState(3);
  const [claimedYears, setClaimedYears] = useState('');
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceLabel, setEvidenceLabel] = useState('');
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!employee || !supabase || !isSupabaseConfigured()) {
      setLoading(false);
      setLoadError('Your employee profile or database connection is not available.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    const [claimResult, skillResult, auditResult] = await Promise.all([
      supabase.from('employee_profile_claims').select('*').eq('employee_id', employee.id).order('created_at', { ascending: false }),
      supabase.from('skills').select('id, name, category').order('name', { ascending: true }),
      supabase.from('employee_profile_claim_audit').select('*').eq('employee_id', employee.id).order('created_at', { ascending: false }),
    ]);
    if (claimResult.error) setLoadError(claimResult.error.message);
    else setClaims((claimResult.data ?? []) as EmployeeProfileClaim[]);
    if (skillResult.error) setLoadError(skillResult.error.message);
    else setSkills((skillResult.data ?? []) as SkillOption[]);
    if (auditResult.error) setLoadError(auditResult.error.message);
    else setAudit((auditResult.data ?? []) as Array<Record<string, unknown>>);
    setLoading(false);
  }, [employee]);

  useEffect(() => { void reload(); }, [reload, user?.id]);
  useEffect(() => {
    if (claimType === 'experience' && !title) setTitle('Total professional experience');
  }, [claimType, title]);

  const skillNameById = useMemo(() => new Map(skills.map((skill) => [skill.id, skill.name])), [skills]);
  const pendingCount = claims.filter((claim) => claim.status === 'pending-verification').length;
  const verifiedCount = claims.filter((claim) => claim.status === 'verified').length;

  function clearForm() {
    setClaimType('skill'); setSkillId(''); setClaimedLevel(3); setClaimedYears(''); setTitle('');
    setOrganization(''); setStartDate(''); setEndDate(''); setDescription(''); setEvidenceUrl('');
    setEvidenceLabel(''); setEditingClaimId(null);
  }

  function editClaim(claim: EmployeeProfileClaim) {
    if (!['rejected', 'needs-more-evidence'].includes(claim.status)) return;
    setClaimType(claim.claim_type);
    setSkillId(claim.skill_id ?? '');
    setClaimedLevel(claim.claimed_level ?? 3);
    setClaimedYears(claim.claimed_years == null ? '' : String(claim.claimed_years));
    setTitle(claim.title ?? ''); setOrganization(claim.organization ?? '');
    setStartDate(claim.start_date ?? ''); setEndDate(claim.end_date ?? '');
    setDescription(claim.description ?? ''); setEvidenceUrl(claim.evidence_url ?? '');
    setEvidenceLabel(claim.evidence_label ?? ''); setEditingClaimId(claim.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee || !supabase) return;
    if (claimType === 'skill' && !skillId) { showToast('error', 'Select a skill first.'); return; }
    if (claimType === 'experience' && (!claimedYears || Number(claimedYears) < 0 || Number(claimedYears) > 80)) { showToast('error', 'Enter total professional experience between 0 and 80 years.'); return; }
    if ((claimType === 'experience' || claimType === 'certification') && !title.trim()) { showToast('error', 'Enter a title or certification name.'); return; }
    if (!description.trim() && !evidenceUrl.trim()) { showToast('error', 'Add a short explanation or a link to supporting evidence so the reviewer has something to assess.'); return; }
    if (startDate && endDate && endDate < startDate) { showToast('error', 'End date cannot be earlier than start date.'); return; }

    setSubmitting(true);
    const { error } = await supabase.rpc('submit_employee_profile_claim', {
      p_claim_type: claimType,
      p_skill_id: claimType === 'skill' ? skillId : null,
      p_claimed_level: claimType === 'skill' ? claimedLevel : null,
      p_claimed_years: claimType === 'experience' ? Number(claimedYears) : null,
      p_title: title.trim() || (claimType === 'skill' ? skillNameById.get(skillId) ?? null : null),
      p_organization: organization.trim() || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_description: description.trim() || null,
      p_evidence_url: evidenceUrl.trim() || null,
      p_evidence_label: evidenceLabel.trim() || null,
      p_claim_id: editingClaimId,
    });
    setSubmitting(false);
    if (error) { showToast('error', error.message || 'Could not submit your profile claim.'); return; }
    showToast('success', editingClaimId ? 'Your claim was resubmitted for review.' : 'Your claim was submitted for review.');
    clearForm();
    await reload();
  }

  if (!employee) {
    return <div className="space-y-5"><PageHeader title="My Profile & Verification" description="Submit skills and experience for review." breadcrumb={['Home', 'My Profile']} /><div className="card p-8 text-center"><ShieldCheck size={28} className="mx-auto text-warning"/><h2 className="mt-3 font-semibold text-text-primary">Employee profile not linked</h2><p className="mt-2 text-sm text-text-secondary">Your account must be approved and linked to an employee record before submitting profile claims.</p></div></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile & Verification" description="Submit skills, professional experience and certifications. They become verified workforce qualifications only after a reviewer approves them." breadcrumb={['Home', 'My Profile']} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Profile owner</p><p className="mt-2 font-bold text-text-primary">{employee.name}</p><p className="mt-1 text-xs text-text-secondary">{employee.role} · {employee.department}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Claims awaiting review</p><p className="mt-2 text-3xl font-extrabold text-warning">{pendingCount}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Verified claims</p><p className="mt-2 text-3xl font-extrabold text-success">{verifiedCount}</p></div>
      </div>

      <Reveal>
        <section className="card p-5 border-primary/20 shadow-md">
          <div className="flex items-start gap-3 pb-4 border-b border-base-border/60"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Plus size={18}/></div><div><h2 className="text-sm font-bold text-text-primary">{editingClaimId ? 'Resubmit a profile claim' : 'Add a profile claim'}</h2><p className="mt-1 text-xs text-text-secondary">Be accurate. Reviewers can request evidence, and unsupported claims will not count toward team matching.</p></div></div>
          <form className="mt-4 space-y-4" onSubmit={(event) => void submitClaim(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">Claim type</label><select className="input-field w-full" value={claimType} onChange={(event) => { setClaimType(event.target.value as EmployeeProfileClaimType); setEditingClaimId(null); setTitle(event.target.value === 'experience' ? 'Total professional experience' : ''); }}><option value="skill">Skill and proficiency</option><option value="experience">Total professional experience</option><option value="certification">Certification / credential</option></select></div>
              {claimType === 'skill' && <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">Skill</label><select required className="input-field w-full" value={skillId} onChange={(event) => setSkillId(event.target.value)}><option value="">Select a skill</option>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}{skill.category ? ` · ${skill.category}` : ''}</option>)}</select></div>}
              {claimType === 'skill' && <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">Your claimed proficiency</label><select className="input-field w-full" value={claimedLevel} onChange={(event) => setClaimedLevel(Number(event.target.value))}><option value={1}>1 · Beginner</option><option value={2}>2 · Developing</option><option value={3}>3 · Proficient</option><option value={4}>4 · Advanced</option><option value={5}>5 · Expert</option></select><p className="mt-1 text-[11px] text-text-secondary">This is your claim, not a verified level.</p></div>}
              {claimType === 'experience' && <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">Total years of professional experience</label><input className="input-field w-full" type="number" min="0" max="80" step="0.5" required value={claimedYears} onChange={(event) => setClaimedYears(event.target.value)} placeholder="e.g. 4.5" /></div>}
              {claimType !== 'skill' && <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">{claimType === 'certification' ? 'Certification name' : 'Experience record title'}</label><input className="input-field w-full" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={claimType === 'certification' ? 'e.g. AWS Solutions Architect' : 'Total professional experience'} /></div>}
              <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">Organization / provider (optional)</label><input className="input-field w-full" value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Company, client, or certification provider" /></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">Evidence label (optional)</label><input className="input-field w-full" value={evidenceLabel} onChange={(event) => setEvidenceLabel(event.target.value)} placeholder="Portfolio, certificate, project link..." /></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">Start date (optional)</label><input className="input-field w-full" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">End date (optional)</label><input className="input-field w-full" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
            </div>
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">Explanation / supporting details</label><textarea className="input-field min-h-24 w-full" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe where you used this skill, what you delivered, or any context the reviewer should consider." /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-text-secondary">Evidence URL (optional)</label><input className="input-field w-full" type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://..." /><p className="mt-1 text-[11px] text-text-secondary">Use a portfolio, public project, certification verification page, or another appropriate link. Do not link confidential work or expose sensitive data.</p></div>
            <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Submitting…' : editingClaimId ? 'Resubmit for Review' : 'Submit for Review'} <ArrowUpRight size={14}/></button>{editingClaimId && <button type="button" className="btn-secondary" onClick={clearForm}><RotateCcw size={14}/> Cancel Resubmission</button>}</div>
          </form>
        </section>
      </Reveal>

      <section className="card p-5">
        <div className="flex items-center gap-2 border-b border-base-border/60 pb-3"><FileCheck2 size={18} className="text-primary"/><div><h2 className="text-sm font-bold text-text-primary">My submitted claims</h2><p className="mt-1 text-xs text-text-secondary">Track reviewer decisions and resubmit claims when additional information is requested.</p></div></div>
        {loading ? <p className="py-8 text-center text-xs text-text-secondary">Loading your claims…</p> : loadError && claims.length === 0 ? <div className="py-6 text-center text-xs text-critical">{loadError}</div> : claims.length === 0 ? <div className="py-9 text-center"><Sparkles size={26} className="mx-auto text-text-muted"/><p className="mt-3 text-sm font-semibold text-text-primary">No claims submitted yet</p><p className="mt-1 text-xs text-text-secondary">Your verified skills will appear on My Skills after a reviewer approves them.</p></div> : <div className="mt-4 space-y-3">{claims.map((claim) => { const events = audit.filter((item) => item.claim_id === claim.id); const claimTitle = claim.claim_type === 'skill' ? skillNameById.get(claim.skill_id ?? '') ?? claim.title ?? 'Skill claim' : claim.title ?? claim.claim_type; return <article key={claim.id} className="rounded-xl border border-base-border/70 bg-base-bg/50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-bold text-text-primary">{claimTitle}</div><div className="mt-1 text-[11px] text-text-secondary">{claim.claim_type === 'skill' ? `Claimed level ${claim.claimed_level}/5` : claim.claim_type === 'experience' ? `${claim.claimed_years} years claimed` : claim.organization || 'Certification / credential'} · Submitted {new Date(claim.submitted_at).toLocaleDateString()}</div></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyles[claim.status] ?? 'border-base-border text-text-secondary'}`}>{statusLabels[claim.status] ?? claim.status}</span></div>{claim.description && <p className="mt-3 whitespace-pre-wrap text-xs text-text-secondary">{claim.description}</p>}{claim.evidence_url && <a href={claim.evidence_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{claim.evidence_label || 'View evidence link'} <ExternalLink size={12}/></a>}{claim.reviewer_notes && <div className="mt-3 rounded-lg border border-warning/20 bg-warning/5 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-warning">Reviewer feedback{claim.reviewer_name ? ` · ${claim.reviewer_name}` : ''}</p><p className="mt-1 whitespace-pre-wrap text-xs text-text-secondary">{claim.reviewer_notes}</p></div>}{['rejected','needs-more-evidence'].includes(claim.status) && <button type="button" className="btn-secondary mt-3 text-xs" onClick={() => editClaim(claim)}><RotateCcw size={13}/> Update and resubmit</button>}{events.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-[11px] font-semibold text-text-secondary">Review history ({events.length} events)</summary><div className="mt-2 space-y-2">{events.map((event) => <div key={String(event.id)} className="border-l-2 border-base-border pl-3 py-1"><p className="text-[11px] font-semibold text-text-primary">{String(event.action).replace(/-/g,' ')} · {String(event.actor_name)}</p><p className="text-[10px] text-text-secondary">{new Date(String(event.created_at)).toLocaleString()}{event.note ? ` · ${String(event.note)}` : ''}</p></div>)}</div></details>}</article>; })}</div>}
      </section>
      <p className="text-[11px] text-text-secondary">Only verified skill claims are promoted into the canonical skills inventory used for team matching. Verified experience updates the official experience field. Certification claims remain in the verified claim record and should be checked by your reviewer.</p>
    </div>
  );
}
