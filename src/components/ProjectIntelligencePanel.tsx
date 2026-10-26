import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, ExternalLink, Globe, LoaderCircle, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getSkillName } from '@/utils';
import type { Project } from '@/types';

type ResearchSource = { title: string; url: string; snippet: string; siteName?: string };
type SearchResponse = { query: string; results: ResearchSource[]; totalResults?: number };
type ProjectResearchBrief = {
  projectId: string;
  userId: string;
  projectName: string;
  query: string;
  researchedAt: string;
  skillIds: string[];
  skillNames: string[];
  results: ResearchSource[];
  totalResults: number;
};

function readBrief(key: string): ProjectResearchBrief | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as ProjectResearchBrief;
    if (!value || !Array.isArray(value.results) || typeof value.projectId !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

function formatAge(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Previously researched' : `Researched ${date.toLocaleString()}`;
}

export function ProjectIntelligencePanel({ project, nextRoute }: { project: Project; nextRoute?: string }) {
  const { user, identityStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const skillRequirements = useMemo(() => project.requiredSkills.map((item) => ({
    id: item.skillId,
    name: getSkillName(item.skillId),
  })), [project.requiredSkills]);
  const skillIds = useMemo(() => skillRequirements.map((item) => item.id).sort(), [skillRequirements]);
  const skillSignature = skillIds.join('|');
  const storageKey = `togetherly:project-intelligence:v1:${user?.id ?? 'demo'}:${project.id}`;
  const [brief, setBrief] = useState<ProjectResearchBrief | null>(() => readBrief(storageKey));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setBrief(readBrief(storageKey));
    setError('');
  }, [storageKey]);

  const requirementsChanged = Boolean(brief && brief.skillIds.slice().sort().join('|') !== skillSignature);
  const mentionedSkills = useMemo(() => {
    if (!brief) return [];
    const allSourceText = brief.results.map((source) => `${source.title} ${source.snippet}`).join(' ').toLowerCase();
    return skillRequirements.filter((skill) => allSourceText.includes(skill.name.toLowerCase()));
  }, [brief, skillRequirements]);

  async function researchProject() {
    if (!user || identityStatus !== 'mapped') {
      setError('Sign in with an approved manager, HR, or admin account to run project research.');
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured for authenticated TinyFish research.');
      return;
    }
    const requestedSkills = skillRequirements.map((item) => item.name).filter(Boolean).slice(0, 6);
    const context = project.description.trim().slice(0, 130);
    const query = `Current India market demand, technical best practices, and credible learning resources for ${requestedSkills.join(', ') || project.name}. Project: ${project.name}. Context: ${context}. Prefer official documentation, recognized certification providers, and reputable engineering sources.`.slice(0, 490);
    setLoading(true);
    setError('');
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error(sessionError.message);
      let session = data.session;
      if (!session || (typeof session.expires_at === 'number' && session.expires_at <= Math.floor(Date.now() / 1000) + 60)) {
        const refreshed = await supabase.auth.refreshSession(session ? { refresh_token: session.refresh_token } : undefined);
        if (refreshed.error || !refreshed.data.session) throw new Error('Your login session expired. Sign in again and retry research.');
        session = refreshed.data.session;
      }
      if (!session?.access_token || session.user.id !== user.id) throw new Error('Your authenticated session could not be verified. Sign in again.');
      const response = await fetch('/api/tinyfish/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ query }),
      });
      const payload = await response.json().catch(() => ({})) as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || `TinyFish research failed (HTTP ${response.status}).`);
      const sources = Array.isArray(payload.results)
        ? payload.results.filter((item) => item && typeof item.url === 'string' && /^https?:\/\//i.test(item.url)).slice(0, 8)
        : [];
      const nextBrief: ProjectResearchBrief = {
        projectId: project.id,
        userId: user.id,
        projectName: project.name,
        query: payload.query || query,
        researchedAt: new Date().toISOString(),
        skillIds,
        skillNames: requestedSkills,
        results: sources,
        totalResults: Number(payload.totalResults ?? sources.length),
      };
      try { sessionStorage.setItem(storageKey, JSON.stringify(nextBrief)); } catch { /* research can still be viewed for this page session */ }
      setBrief(nextBrief);
      window.dispatchEvent(new CustomEvent('togetherly:project-intelligence-updated', { detail: { projectId: project.id } }));
      if (sources.length === 0) setError('TinyFish returned no usable sources. Try again with a more specific project or skill description.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to research this project right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card overflow-hidden border-base-border">
      <div className="flex flex-col gap-3 border-b border-base-border bg-base-subtle p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-base-border bg-white p-2.5 text-primary"><Sparkles size={19}/></div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-extrabold text-text-primary">TinyFish Project Intelligence</h2><span className="rounded-full border border-primary/20 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Live sources</span></div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">Research real-world skill demand, official technical guidance and learning resources for {project.name}. Sources are carried into Workforce Twin for decision context.</p>
          </div>
        </div>
        <button type="button" onClick={() => void researchProject()} disabled={loading} className="btn-primary shrink-0">
          {loading ? <LoaderCircle size={15} className="animate-spin"/> : <Search size={15}/>} {loading ? 'Researching…' : brief ? 'Refresh Research' : 'Research This Project'}
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5">
          {skillRequirements.length ? skillRequirements.map((skill) => <span key={skill.id} className="rounded-full border border-base-border bg-base-bg px-2.5 py-1 text-[11px] font-medium text-text-secondary">{skill.name}</span>) : <span className="text-xs text-text-secondary">No project skills defined yet. Add requirements to make the research more specific.</span>}
        </div>
        {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-critical/20 bg-critical/5 p-3 text-xs text-critical"><AlertCircle size={15} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
        {!brief && !loading && !error && <div className="rounded-lg border border-dashed border-base-border bg-base-subtle p-4 text-xs leading-relaxed text-text-secondary">No external research has been attached to this project yet. Run TinyFish research to discover relevant sources before comparing team options.</div>}
        {brief && <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-secondary">
            <span className="inline-flex items-center gap-1.5"><Globe size={13}/> {brief.totalResults} results found · {brief.results.length} sources shown</span>
            <span>{formatAge(brief.researchedAt)}</span>
          </div>
          {requirementsChanged && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Project skill requirements changed since this research was collected. Refresh the research to align it with the current requirements.</div>}
          {mentionedSkills.length > 0 && !requirementsChanged && <div className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-900"><ShieldCheck size={14}/> Project skills mentioned in source snippets</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{mentionedSkills.map((skill) => <span key={skill.id} className="rounded-full border border-cyan-200 bg-white px-2 py-1 text-[11px] font-semibold text-cyan-900">{skill.name}</span>)}</div>
            <p className="mt-2 text-[10px] leading-relaxed text-cyan-900/80">This is a simple mention signal, not a verified market-demand score or a certification of employee proficiency.</p>
          </div>}
          <div className="space-y-2.5">
            {brief.results.slice(0, 5).map((source, index) => {
              let host = source.siteName || source.url;
              try { host = new URL(source.url).hostname.replace(/^www\./, ''); } catch { /* keep provider label */ }
              return <article key={`${source.url}-${index}`} className="rounded-lg border border-base-border bg-white p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="min-w-0 flex-1"><a href={source.url} target="_blank" rel="noreferrer" className="text-xs font-bold leading-relaxed text-text-primary hover:text-primary hover:underline">{source.title || host}</a><div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">{host}</div><p className="mt-2 text-xs leading-relaxed text-text-secondary">{source.snippet || 'No snippet provided. Open the source to review its contents.'}</p></div>
                  <a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open source ${source.title || host}`} className="rounded-md border border-base-border bg-white p-1.5 text-text-secondary hover:text-primary"><ExternalLink size={13}/></a>
                </div>
              </article>;
            })}
          </div>
          <div className="rounded-lg border border-base-border bg-base-bg/40 p-3 text-[11px] leading-relaxed text-text-secondary">Decision guardrail: TinyFish sources inform the manager's review, but they do not certify an employee's skills or change the deterministic match score. Team Builder uses the project's requirements and the skills recorded in the verified workforce inventory.</div>
          {nextRoute && location.pathname !== nextRoute && <div className="flex justify-end"><button type="button" className="btn-secondary text-xs" onClick={() => navigate(nextRoute, { state: { projectId: project.id } })}>Compare this project in Workforce Twin <ArrowRight size={14}/></button></div>}
        </>}
      </div>
    </section>
  );
}
