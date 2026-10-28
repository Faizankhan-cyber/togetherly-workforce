import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ExternalLink, Globe, Lightbulb, LoaderCircle, Search, Sparkles, UsersRound } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Reveal';
import { MatchScore } from '@/components/MatchScore';
import { MatchFactorBreakdown } from '@/components/MatchFactorBreakdown';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { generateRecommendations, getSkillName } from '@/utils';

interface MarketResult { title: string; url: string; snippet: string; siteName?: string; }
interface MarketSearchResponse { results: MarketResult[]; totalResults?: number; query: string; }

export function OpportunityFinderPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { employees, projects, settings } = useData();
  const activeProjects = projects.filter((project) => project.status === 'active' || project.status === 'planning');
  const [projectFilter, setProjectFilter] = useState('all');
  const [marketQuery, setMarketQuery] = useState('current hiring demand and emerging skills in cloud computing, cybersecurity, AI, and software engineering');
  const [marketResults, setMarketResults] = useState<MarketSearchResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState('');
  const selectedProject = activeProjects.find((project) => project.id === projectFilter);

  const opportunities = useMemo(() => activeProjects
    .filter((project) => projectFilter === 'all' || project.id === projectFilter)
    .flatMap((project) => generateRecommendations(employees, project, settings.matchWeights, projects, settings)
      .filter((recommendation) => recommendation.capacityFeasible && !project.assignedEmployeeIds.includes(recommendation.employeeId))
      .map((recommendation) => ({
        project, recommendation,
        employee: employees.find((employee) => employee.id === recommendation.employeeId)!,
        openSeats: Math.max(0, project.targetTeamSize - project.assignedEmployeeIds.length),
      })))
    .filter((item) => item.openSeats > 0 && item.recommendation.matchScore >= 25)
    .sort((a, b) => b.recommendation.matchScore - a.recommendation.matchScore || a.openSeats - b.openSeats)
    .slice(0, 12), [activeProjects, employees, projects, projectFilter, settings]);

  const opportunityDiagnostics = useMemo(() => {
    const scope = activeProjects.filter((project) => projectFilter === 'all' || project.id === projectFilter);
    let openSeats = 0;
    let capacitySafePairs = 0;
    let belowThresholdPairs = 0;
    for (const project of scope) {
      const seats = Math.max(0, project.targetTeamSize - project.assignedEmployeeIds.length);
      openSeats += seats;
      if (seats === 0) continue;
      const candidates = generateRecommendations(employees, project, settings.matchWeights, projects, settings)
        .filter((recommendation) => recommendation.capacityFeasible && !project.assignedEmployeeIds.includes(recommendation.employeeId));
      capacitySafePairs += candidates.filter((recommendation) => recommendation.matchScore >= 25).length;
      belowThresholdPairs += candidates.filter((recommendation) => recommendation.matchScore < 25).length;
    }
    return { projectCount: scope.length, openSeats, capacitySafePairs, belowThresholdPairs };
  }, [activeProjects, employees, projects, projectFilter, settings]);

  function useProjectContext() {
    setMarketQuery(selectedProject
      ? `Current hiring demand, contract opportunities, and emerging skills relevant to the project "${selectedProject.name}": ${selectedProject.description}`.slice(0, 500)
      : 'Current hiring demand, contract opportunities, and emerging skills relevant to active software and technology projects');
  }

  async function searchMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = marketQuery.trim();
    if (query.length < 3) { setMarketError('Enter at least 3 characters to search live market intelligence.'); return; }
    if (!session?.access_token) { setMarketError('Sign in with an authenticated account to use live market intelligence. Demo mode cannot call the protected API.'); return; }
    setMarketLoading(true); setMarketError(''); setMarketResults(null);
    try {
      const response = await fetch('/api/tinyfish/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ query }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'TinyFish search failed. Please try again.');
      setMarketResults(payload as MarketSearchResponse);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : 'Unable to reach live market intelligence.');
    } finally { setMarketLoading(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Workforce Opportunity Finder" description="Discover capacity-safe talent matches for open project roles and explore live market intelligence." breadcrumb={['Home', 'Opportunity Finder']} />
      <Reveal direction="down">
        <section className="card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-warning/10 via-base-card to-primary/10 border-warning/30 shadow-md">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning mb-1"><Lightbulb size={16} /> Explainable Match Intelligence</div>
            <p className="text-xs text-text-secondary leading-relaxed">Candidates must be unassigned to the project, pass capacity checks, and score at least 25/100. The score combines skills, experience, and availability; TinyFish research stays separate from internal fit scores.</p>
          </div>
          <label className="flex items-center gap-2.5 text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">Project:</span>
            <select className="input-field min-w-[220px] text-xs font-semibold" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="all">All Open Projects ({activeProjects.length})</option>
              {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
        </section>
      </Reveal>

      <Reveal direction="up">
        <section className="card overflow-hidden border-primary/20 shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-base-border/70 bg-gradient-to-r from-primary/10 via-base-card to-cyan/10 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm"><Globe size={21} /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-text-primary">Live Market Intelligence</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success"><Sparkles size={11} /> Powered by TinyFish</span>
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary">Research current job demand, contract opportunities, technology trends, and skills from live web sources. Results are external research, not verified internal vacancies.</p>
              </div>
            </div>
            <button type="button" onClick={useProjectContext} className="btn-secondary text-xs">Use project context</button>
          </div>
          <form onSubmit={searchMarket} className="space-y-3 p-5">
            <label htmlFor="market-query" className="block text-xs font-semibold text-text-primary">What should TinyFish research?</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="market-query" className="input-field min-w-0 flex-1 text-sm" value={marketQuery} onChange={(event) => setMarketQuery(event.target.value)} maxLength={500} placeholder="e.g. Cloud security skills in demand in India" />
              <button type="submit" className="btn-primary justify-center text-xs" disabled={marketLoading}>
                {marketLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}
                {marketLoading ? 'Researching…' : 'Search live web'}
              </button>
            </div>
            <p className="text-[11px] text-text-muted">Uses TinyFish Search. The API key stays on the server; searches require a signed-in Supabase session.</p>
          </form>
          {marketError && <div role="alert" className="mx-5 mb-5 flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/5 p-3 text-xs text-critical"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{marketError}</span></div>}
          {marketLoading && <div className="mx-5 mb-5 flex items-center gap-3 rounded-lg border border-base-border bg-base-bg/60 p-4 text-xs text-text-secondary"><LoaderCircle size={17} className="animate-spin text-primary" />Searching live sources. This can take a moment.</div>}
          {marketResults && (
            <div className="border-t border-base-border/70 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="text-sm font-bold text-text-primary">Search results</h3><p className="mt-1 text-[11px] text-text-secondary">{marketResults.results.length} sources returned for “{marketResults.query}”</p></div>
                <span className="rounded-full bg-base-hover px-2.5 py-1 text-[10px] font-semibold text-text-secondary">Live web research</span>
              </div>
              {marketResults.results.length === 0 ? <p className="rounded-lg border border-base-border p-4 text-xs text-text-secondary">No results were returned. Try a broader query or different keywords.</p> : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {marketResults.results.map((result, index) => (
                    <article key={result.url || `${result.title}-${index}`} className="rounded-xl border border-base-border/80 bg-base-bg/50 p-4 transition-colors hover:border-primary/40">
                      <div className="mb-2 flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold uppercase tracking-wide text-text-muted">{result.siteName || (() => { try { return new URL(result.url).hostname; } catch { return 'Web source'; } })()}</span><span className="rounded bg-base-hover px-1.5 py-0.5 text-[10px] text-text-muted">Source {index + 1}</span></div>
                      <h4 className="text-sm font-bold leading-snug text-text-primary">{result.title}</h4>
                      <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-text-secondary">{result.snippet || 'Open the source to review the available details.'}</p>
                      <a href={result.url} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">View original source <ExternalLink size={12} /></a>
                    </article>
                  ))}
                </div>
              )}
              <p className="mt-4 text-[10px] leading-relaxed text-text-muted">External search results may be incomplete or outdated. Verify details on the original site before making staffing or hiring decisions.</p>
            </div>
          )}
        </section>
      </Reveal>

      <div className="flex items-center gap-2"><UsersRound size={17} className="text-primary" /><h2 className="text-sm font-bold text-text-primary">Internal talent matches</h2><span className="rounded-full bg-base-hover px-2 py-0.5 text-[10px] font-semibold text-text-secondary">{opportunities.length}</span></div>
      {opportunities.length === 0 ? (
        <Reveal><div className="card p-8 shadow-lg"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-base-hover text-text-secondary"><UsersRound size={26} /></div><h2 className="text-center text-base font-bold text-text-primary">No internal matches meet the current rules</h2><p className="mx-auto mt-1.5 max-w-xl text-center text-xs leading-relaxed text-text-secondary">{opportunityDiagnostics.openSeats === 0 ? 'There are no unfilled team seats in the selected project scope.' : opportunityDiagnostics.capacitySafePairs === 0 && opportunityDiagnostics.belowThresholdPairs === 0 ? 'Open seats exist, but no unassigned candidate currently passes capacity checks.' : 'Capacity-safe candidates exist, but none reaches the minimum match score of 25/100. Review the project requirements or skill inventory before lowering the threshold.'}</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-base-border p-3 text-center"><div className="text-lg font-bold text-text-primary">{opportunityDiagnostics.openSeats}</div><div className="text-[10px] text-text-secondary">Open seats</div></div><div className="rounded-lg border border-base-border p-3 text-center"><div className="text-lg font-bold text-success">{opportunityDiagnostics.capacitySafePairs}</div><div className="text-[10px] text-text-secondary">Pairs scoring 25+</div></div><div className="rounded-lg border border-base-border p-3 text-center"><div className="text-lg font-bold text-warning">{opportunityDiagnostics.belowThresholdPairs}</div><div className="text-[10px] text-text-secondary">Below threshold</div></div></div></div></Reveal>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {opportunities.map(({ project, recommendation, employee, openSeats }, index) => (
            <Reveal key={`${project.id}-${employee.id}`} delay={index * 60} direction="up">
              <article className="card-hover p-5 flex flex-col justify-between h-full border-base-border/70 group">
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4"><div className="flex items-start gap-3 min-w-0"><MatchScore score={recommendation.matchScore} size="md" /><div className="min-w-0"><h2 className="text-sm font-bold text-text-primary truncate group-hover:text-primary transition-colors">{project.name}</h2><span className="inline-block mt-0.5 text-[11px] font-semibold text-cyan">{openSeats} open {openSeats === 1 ? 'seat' : 'seats'} available</span><p className="mt-1 text-xs text-text-secondary line-clamp-2 leading-relaxed">{project.description}</p></div></div></div>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-base-border/60 bg-base-bg/60"><div className="flex min-w-0 items-center gap-3"><Avatar name={employee.name} color={employee.avatarColor} size="sm" /><div className="min-w-0"><div className="truncate text-xs font-bold text-text-primary">{employee.name}</div><div className="truncate text-[11px] text-text-secondary">{employee.role} · <span className="font-mono text-success">{recommendation.availableCapacity}% available</span></div></div></div><button className="btn-primary text-xs py-1.5 px-3 flex-shrink-0" onClick={() => navigate('/workforce-twin', { state: { projectId: project.id, employeeId: employee.id } })}><span>Simulate</span><ArrowRight size={13} /></button></div>
                  <div className="mt-3 flex flex-wrap gap-1.5">{recommendation.matchedSkills.length > 0 ? recommendation.matchedSkills.slice(0, 4).map((skillId) => <span key={skillId} className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">✓ {getSkillName(skillId)}</span>) : <span className="text-[11px] text-text-secondary italic">Transferable skills applicable</span>}</div>
                  <ul className="mt-3 space-y-1 pt-2 border-t border-base-border/30">{recommendation.reasons.slice(0, 2).map((reason) => <li key={reason} className="text-[11px] text-text-secondary flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" /><span className="truncate">{reason}</span></li>)}</ul>
                  <MatchFactorBreakdown recommendation={recommendation} />
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
