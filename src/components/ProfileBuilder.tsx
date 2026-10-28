import { useState, type FormEvent, type Dispatch, type SetStateAction } from 'react';
import { ArrowUpRight, BriefcaseBusiness, FileCheck2, GraduationCap, Plus, ShieldCheck, Trash2, UploadCloud, UserRoundCheck } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SearchableSkillSelect } from '@/components/SearchableSkillSelect';

type SkillOption = { id: string; name: string; category: string };
type SkillDraft = { key: string; skillId: string; level: number; details: string; evidenceUrl: string };
type ProfileEntryDraft = { key: string; title: string; organization: string; startDate: string; endDate: string; description: string; evidenceUrl: string };
type ProfileBuilderProps = { employeeId: string; skills: SkillOption[]; onSubmitted: () => Promise<void> };

const makeKey = () => crypto.randomUUID();
const emptySkill = (): SkillDraft => ({ key: makeKey(), skillId: '', level: 2, details: '', evidenceUrl: '' });
const emptyEntry = (): ProfileEntryDraft => ({ key: makeKey(), title: '', organization: '', startDate: '', endDate: '', description: '', evidenceUrl: '' });
const hasEntryData = (entry: ProfileEntryDraft) => [entry.title, entry.organization, entry.startDate, entry.endDate, entry.description, entry.evidenceUrl].some((value) => value.trim());
const levelLabels: Record<number, string> = { 1: 'Beginner', 2: 'Developing', 3: 'Proficient', 4: 'Advanced', 5: 'Expert' };

export function ProfileBuilder({ employeeId, skills, onSubmitted }: ProfileBuilderProps) {
  const { showToast } = useData();
  const [summary, setSummary] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [skillEntries, setSkillEntries] = useState<SkillDraft[]>([emptySkill()]);
  const [workHistory, setWorkHistory] = useState<ProfileEntryDraft[]>([]);
  const [education, setEducation] = useState<ProfileEntryDraft[]>([]);
  const [certifications, setCertifications] = useState<ProfileEntryDraft[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateEntry(setter: Dispatch<SetStateAction<ProfileEntryDraft[]>>, key: string, field: keyof Omit<ProfileEntryDraft, 'key'>, value: string) {
    setter((current) => current.map((entry) => entry.key === key ? { ...entry, [field]: value } : entry));
  }
  function updateSkill(key: string, field: keyof Omit<SkillDraft, 'key'>, value: string | number) {
    setSkillEntries((current) => current.map((entry) => entry.key === key ? { ...entry, [field]: value } : entry));
  }
  function validateEntries(entries: ProfileEntryDraft[], label: string, requireOrganization: boolean) {
    const populated = entries.filter(hasEntryData);
    const invalid = populated.find((entry) => !entry.title.trim() || (requireOrganization && !entry.organization.trim()) ||
      (entry.startDate && entry.endDate && entry.endDate < entry.startDate) ||
      (entry.evidenceUrl.trim() && !/^https?:\/\//i.test(entry.evidenceUrl.trim())));
    if (invalid) {
      showToast('error', 'Complete the title' + (requireOrganization ? ' and organization' : '') + ' and check dates/links for each ' + label + ' entry.');
      return null;
    }
    return populated;
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isSupabaseConfigured()) {
      showToast('error', 'The profile submission service is not available.');
      return;
    }
    const populatedSkills = skillEntries.filter((entry) => entry.skillId);
    if (skillEntries.some((entry) => !entry.skillId && (entry.details.trim() || entry.evidenceUrl.trim()))) {
      showToast('error', 'Choose a skill for every skill row that contains details or evidence.');
      return;
    }
    if (new Set(populatedSkills.map((entry) => entry.skillId)).size !== populatedSkills.length) {
      showToast('error', 'Each skill can appear only once in a profile submission.');
      return;
    }
    if (yearsExperience.trim() && (!Number.isFinite(Number(yearsExperience)) || Number(yearsExperience) < 0 || Number(yearsExperience) > 80)) {
      showToast('error', 'Enter total professional experience between 0 and 80 years.');
      return;
    }
    const workEntries = validateEntries(workHistory, 'work experience', true);
    if (!workEntries) return;
    const educationEntries = validateEntries(education, 'education', true);
    if (!educationEntries) return;
    const certificationEntries = validateEntries(certifications, 'certification', false);
    if (!certificationEntries) return;
    if (populatedSkills.length === 0 && workEntries.length === 0 && educationEntries.length === 0 && certificationEntries.length === 0 && !yearsExperience.trim()) {
      showToast('error', 'Add at least one profile item or enter your total years of experience before submitting.');
      return;
    }
    if (resumeFile && (!resumeFile.name.toLowerCase().endsWith('.pdf') || (resumeFile.type && resumeFile.type !== 'application/pdf'))) {
      showToast('error', 'Upload your resume as a PDF file.');
      return;
    }
    if (resumeFile && resumeFile.size > 10 * 1024 * 1024) {
      showToast('error', 'Your resume must be 10 MB or smaller.');
      return;
    }

    const skillNames = new Map(skills.map((skill) => [skill.id, skill.name]));
    const claims: Array<Record<string, unknown>> = [
      ...populatedSkills.map((entry) => ({
        claim_type: 'skill', skill_id: entry.skillId, claimed_level: entry.level, title: skillNames.get(entry.skillId) ?? null,
        description: entry.details.trim() || null, evidence_url: entry.evidenceUrl.trim() || null,
        evidence_label: entry.evidenceUrl.trim() ? 'Skill evidence link' : null,
      })),
      ...workEntries.map((entry) => ({
        claim_type: 'employment', title: entry.title.trim(), organization: entry.organization.trim(),
        start_date: entry.startDate || null, end_date: entry.endDate || null, description: entry.description.trim() || null,
        evidence_url: entry.evidenceUrl.trim() || null, evidence_label: entry.evidenceUrl.trim() ? 'Work experience evidence' : null,
      })),
      ...educationEntries.map((entry) => ({
        claim_type: 'education', title: entry.title.trim(), organization: entry.organization.trim(),
        start_date: entry.startDate || null, end_date: entry.endDate || null, description: entry.description.trim() || null,
        evidence_url: entry.evidenceUrl.trim() || null, evidence_label: entry.evidenceUrl.trim() ? 'Education evidence' : null,
      })),
      ...certificationEntries.map((entry) => ({
        claim_type: 'certification', title: entry.title.trim(), organization: entry.organization.trim() || null,
        start_date: entry.startDate || null, end_date: entry.endDate || null, description: entry.description.trim() || null,
        evidence_url: entry.evidenceUrl.trim() || null, evidence_label: entry.evidenceUrl.trim() ? 'Certification evidence' : null,
      })),
    ];

    setSubmitting(true);
    let resumeStoragePath: string | null = null;
    if (resumeFile) {
      const safeName = resumeFile.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'resume.pdf';
      resumeStoragePath = employeeId + '/' + crypto.randomUUID() + '-' + safeName;
      const { error: uploadError } = await supabase.storage.from('employee-profile-evidence')
        .upload(resumeStoragePath, resumeFile, { contentType: 'application/pdf', upsert: false });
      if (uploadError) {
        setSubmitting(false);
        showToast('error', uploadError.message || 'Could not upload your resume.');
        return;
      }
    }

    const { error } = await supabase.rpc('submit_employee_profile_package', {
      p_professional_summary: summary.trim() || null,
      p_years_experience: yearsExperience.trim() ? Number(yearsExperience) : null,
      p_resume_storage_path: resumeStoragePath,
      p_resume_file_name: resumeStoragePath ? resumeFile?.name ?? null : null,
      p_claims: claims,
    });
    if (error && resumeStoragePath) await supabase.storage.from('employee-profile-evidence').remove([resumeStoragePath]);
    setSubmitting(false);
    if (error) {
      showToast('error', error.message || 'Could not submit your profile package.');
      return;
    }
    setSummary('');
    setYearsExperience('');
    setSkillEntries([emptySkill()]);
    setWorkHistory([]);
    setEducation([]);
    setCertifications([]);
    setResumeFile(null);
    const fileInput = document.getElementById('profile-resume-upload') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
    showToast('success', 'Your complete profile was submitted. Each item is now awaiting review.');
    await onSubmitted();
  }

  return (
    <section className="card overflow-hidden border-primary/20 shadow-md">
      <div className="flex items-start gap-3 border-b border-base-border/60 bg-primary/5 p-5">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary"><UserRoundCheck size={20} /></div>
        <div><h2 className="text-base font-bold text-text-primary">Build your professional profile</h2><p className="mt-1 text-xs leading-relaxed text-text-secondary">Submit skills, experience, education and credentials together. Authorized reviewers assess one profile package instead of disconnected forms.</p></div>
      </div>
      <form className="space-y-6 p-5" onSubmit={(event) => void submitProfile(event)}>
        <section className="space-y-3">
          <div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck size={16}/></span><div><h3 className="text-sm font-bold text-text-primary">1. Professional overview</h3><p className="text-xs text-text-secondary">Summarize your strengths and experience.</p></div></div>
          <label className="block text-xs font-semibold text-text-secondary">Professional summary (optional)<textarea className="input-field mt-1.5 min-h-24 w-full" maxLength={3000} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="A short introduction to your experience, strengths, and the work you have delivered."/></label>
          <div className="max-w-sm"><label className="block text-xs font-semibold text-text-secondary">Total professional experience (years, optional)<input className="input-field mt-1.5 w-full" type="number" min="0" max="80" step="0.5" value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} placeholder="e.g. 2.5"/></label><p className="mt-1 text-[11px] text-text-secondary">This remains a claimed value until a reviewer verifies it.</p></div>
        </section>

        <section className="space-y-3 border-t border-base-border/60 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck size={16}/></span><div><h3 className="text-sm font-bold text-text-primary">2. Skills and proficiency</h3><p className="text-xs text-text-secondary">Add multiple skills and choose a proficiency for each.</p></div></div><button type="button" className="btn-secondary text-xs" onClick={() => setSkillEntries((current) => [...current, emptySkill()])}><Plus size={14}/> Add skill</button></div>
          <div className="space-y-3">
            {skillEntries.map((entry, index) => (
              <div key={entry.key} className="rounded-xl border border-base-border/70 bg-base-bg/40 p-4">
                <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-text-secondary">Skill {index + 1}</span>{skillEntries.length > 1 && <button type="button" className="btn-secondary px-2 py-1 text-xs text-critical" aria-label={'Remove skill ' + (index + 1)} onClick={() => setSkillEntries((current) => current.filter((item) => item.key !== entry.key))}><Trash2 size={13}/> Remove</button>}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><label htmlFor={`profile-skill-${entry.key}`} className="mb-1.5 block text-xs font-semibold text-text-secondary">Skill</label><SearchableSkillSelect inputId={`profile-skill-${entry.key}`} options={skills} value={entry.skillId} onChange={(value) => updateSkill(entry.key, 'skillId', value)} placeholder="Search skills (e.g. Azure, Python)…" /></div>
                  <label className="block text-xs font-semibold text-text-secondary">Claimed proficiency<select className="input-field mt-1.5 w-full" value={entry.level} onChange={(event) => updateSkill(entry.key, 'level', Number(event.target.value))}>{[1,2,3,4,5].map((level) => <option key={level} value={level}>{level} · {levelLabels[level]}</option>)}</select></label>
                  <label className="block text-xs font-semibold text-text-secondary md:col-span-2">Project or context (optional)<input className="input-field mt-1.5 w-full" value={entry.details} onChange={(event) => updateSkill(entry.key, 'details', event.target.value)} placeholder="Where have you used this skill?"/></label>
                  <label className="block text-xs font-semibold text-text-secondary md:col-span-2">Supporting link (optional)<input className="input-field mt-1.5 w-full" type="url" value={entry.evidenceUrl} onChange={(event) => updateSkill(entry.key, 'evidenceUrl', event.target.value)} placeholder="https://..."/></label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 border-t border-base-border/60 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><BriefcaseBusiness size={16}/></span><div><h3 className="text-sm font-bold text-text-primary">3. Work experience</h3><p className="text-xs text-text-secondary">Add previous roles. Dates and supporting links are optional.</p></div></div><button type="button" className="btn-secondary text-xs" onClick={() => setWorkHistory((current) => [...current, emptyEntry()])}><Plus size={14}/> Add role</button></div>
          {workHistory.length === 0 && <p className="rounded-lg border border-dashed border-base-border p-4 text-xs text-text-secondary">No work history added. You can skip this section if you are starting your career.</p>}
          {workHistory.map((entry, index) => <div key={entry.key} className="rounded-xl border border-base-border/70 p-4 space-y-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-text-secondary">Role {index + 1}</span><button type="button" className="btn-secondary px-2 py-1 text-xs text-critical" onClick={() => setWorkHistory((current) => current.filter((item) => item.key !== entry.key))}><Trash2 size={13}/> Remove</button></div><div className="grid gap-3 md:grid-cols-2"><label className="block text-xs font-semibold text-text-secondary">Job title *<input className="input-field mt-1.5 w-full" required value={entry.title} onChange={(event) => updateEntry(setWorkHistory, entry.key, 'title', event.target.value)} placeholder="e.g. Cloud Engineer"/></label><label className="block text-xs font-semibold text-text-secondary">Company / organization *<input className="input-field mt-1.5 w-full" required value={entry.organization} onChange={(event) => updateEntry(setWorkHistory, entry.key, 'organization', event.target.value)} placeholder="Company name"/></label><label className="block text-xs font-semibold text-text-secondary">Start date<input className="input-field mt-1.5 w-full" type="date" value={entry.startDate} onChange={(event) => updateEntry(setWorkHistory, entry.key, 'startDate', event.target.value)}/></label><label className="block text-xs font-semibold text-text-secondary">End date<input className="input-field mt-1.5 w-full" type="date" value={entry.endDate} onChange={(event) => updateEntry(setWorkHistory, entry.key, 'endDate', event.target.value)}/></label><label className="block text-xs font-semibold text-text-secondary md:col-span-2">Responsibilities / achievements<input className="input-field mt-1.5 w-full" value={entry.description} onChange={(event) => updateEntry(setWorkHistory, entry.key, 'description', event.target.value)} placeholder="What did you work on or deliver?"/></label><label className="block text-xs font-semibold text-text-secondary md:col-span-2">Evidence link (optional)<input className="input-field mt-1.5 w-full" type="url" value={entry.evidenceUrl} onChange={(event) => updateEntry(setWorkHistory, entry.key, 'evidenceUrl', event.target.value)} placeholder="https://..."/></label></div></div>)}
        </section>

        <section className="space-y-3 border-t border-base-border/60 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><GraduationCap size={16}/></span><div><h3 className="text-sm font-bold text-text-primary">4. Education</h3><p className="text-xs text-text-secondary">Add degrees, diplomas, courses or other formal education.</p></div></div><button type="button" className="btn-secondary text-xs" onClick={() => setEducation((current) => [...current, emptyEntry()])}><Plus size={14}/> Add education</button></div>
          {education.map((entry, index) => <div key={entry.key} className="rounded-xl border border-base-border/70 p-4 space-y-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-text-secondary">Education {index + 1}</span><button type="button" className="btn-secondary px-2 py-1 text-xs text-critical" onClick={() => setEducation((current) => current.filter((item) => item.key !== entry.key))}><Trash2 size={13}/> Remove</button></div><div className="grid gap-3 md:grid-cols-2"><label className="block text-xs font-semibold text-text-secondary">Qualification / program *<input className="input-field mt-1.5 w-full" required value={entry.title} onChange={(event) => updateEntry(setEducation, entry.key, 'title', event.target.value)} placeholder="e.g. BCA"/></label><label className="block text-xs font-semibold text-text-secondary">Institution *<input className="input-field mt-1.5 w-full" required value={entry.organization} onChange={(event) => updateEntry(setEducation, entry.key, 'organization', event.target.value)} placeholder="College / university"/></label><label className="block text-xs font-semibold text-text-secondary">Start date<input className="input-field mt-1.5 w-full" type="date" value={entry.startDate} onChange={(event) => updateEntry(setEducation, entry.key, 'startDate', event.target.value)}/></label><label className="block text-xs font-semibold text-text-secondary">End date<input className="input-field mt-1.5 w-full" type="date" value={entry.endDate} onChange={(event) => updateEntry(setEducation, entry.key, 'endDate', event.target.value)}/></label><label className="block text-xs font-semibold text-text-secondary md:col-span-2">Details (optional)<input className="input-field mt-1.5 w-full" value={entry.description} onChange={(event) => updateEntry(setEducation, entry.key, 'description', event.target.value)} placeholder="Field of study, highlights, or additional context"/></label><label className="block text-xs font-semibold text-text-secondary md:col-span-2">Evidence link (optional)<input className="input-field mt-1.5 w-full" type="url" value={entry.evidenceUrl} onChange={(event) => updateEntry(setEducation, entry.key, 'evidenceUrl', event.target.value)} placeholder="https://..."/></label></div></div>)}
          {education.length === 0 && <p className="rounded-lg border border-dashed border-base-border p-4 text-xs text-text-secondary">No education entries added yet.</p>}
        </section>

        <section className="space-y-3 border-t border-base-border/60 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><FileCheck2 size={16}/></span><div><h3 className="text-sm font-bold text-text-primary">5. Certifications and credentials</h3><p className="text-xs text-text-secondary">Add one or more certificates with a provider and verification link.</p></div></div><button type="button" className="btn-secondary text-xs" onClick={() => setCertifications((current) => [...current, emptyEntry()])}><Plus size={14}/> Add credential</button></div>
          {certifications.map((entry, index) => <div key={entry.key} className="rounded-xl border border-base-border/70 p-4 space-y-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-text-secondary">Credential {index + 1}</span><button type="button" className="btn-secondary px-2 py-1 text-xs text-critical" onClick={() => setCertifications((current) => current.filter((item) => item.key !== entry.key))}><Trash2 size={13}/> Remove</button></div><div className="grid gap-3 md:grid-cols-2"><label className="block text-xs font-semibold text-text-secondary">Certification name *<input className="input-field mt-1.5 w-full" required value={entry.title} onChange={(event) => updateEntry(setCertifications, entry.key, 'title', event.target.value)} placeholder="e.g. AWS Certified Cloud Practitioner"/></label><label className="block text-xs font-semibold text-text-secondary">Provider (optional)<input className="input-field mt-1.5 w-full" value={entry.organization} onChange={(event) => updateEntry(setCertifications, entry.key, 'organization', event.target.value)} placeholder="e.g. AWS"/></label><label className="block text-xs font-semibold text-text-secondary">Issue date<input className="input-field mt-1.5 w-full" type="date" value={entry.startDate} onChange={(event) => updateEntry(setCertifications, entry.key, 'startDate', event.target.value)}/></label><label className="block text-xs font-semibold text-text-secondary">Expiry date (if applicable)<input className="input-field mt-1.5 w-full" type="date" value={entry.endDate} onChange={(event) => updateEntry(setCertifications, entry.key, 'endDate', event.target.value)}/></label><label className="block text-xs font-semibold text-text-secondary md:col-span-2">Verification URL (optional)<input className="input-field mt-1.5 w-full" type="url" value={entry.evidenceUrl} onChange={(event) => updateEntry(setCertifications, entry.key, 'evidenceUrl', event.target.value)} placeholder="https://..."/></label><label className="block text-xs font-semibold text-text-secondary md:col-span-2">Notes (optional)<input className="input-field mt-1.5 w-full" value={entry.description} onChange={(event) => updateEntry(setCertifications, entry.key, 'description', event.target.value)} placeholder="Credential ID or context (do not paste secrets)"/></label></div></div>)}
          {certifications.length === 0 && <p className="rounded-lg border border-dashed border-base-border p-4 text-xs text-text-secondary">No certifications added yet. You can submit them later as a new profile package.</p>}
        </section>

        <section className="space-y-3 border-t border-base-border/60 pt-5">
          <div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><UploadCloud size={16}/></span><div><h3 className="text-sm font-bold text-text-primary">6. Resume (optional)</h3><p className="text-xs text-text-secondary">One private PDF to help your reviewer assess the full profile.</p></div></div>
          <input id="profile-resume-upload" className="input-field w-full" type="file" accept="application/pdf,.pdf" onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}/>
          <p className="text-[11px] text-text-secondary">PDF only · maximum 10 MB · stored privately and shown only to you and authorized reviewers via an expiring link.</p>
          {resumeFile && <p className="text-xs font-semibold text-primary">Selected: {resumeFile.name} · {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB</p>}
        </section>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-text-secondary">You submit this package once. Managers can review each skill, work-history entry, education item and credential individually. Only approved skills and verified total experience affect workforce-matching data.</div>
        <div className="flex flex-wrap items-center gap-3 border-t border-base-border/60 pt-5"><button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Submitting complete profile…' : 'Submit complete profile for review'} <ArrowUpRight size={14}/></button><span className="text-[11px] text-text-secondary">Submit an updated package after adding new information.</span></div>
      </form>
    </section>
  );
}
