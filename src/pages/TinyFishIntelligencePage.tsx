import { FormEvent, useState } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowRight, CheckCircle2, ExternalLink, FileSearch, Globe, LoaderCircle, Search, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Reveal';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type SearchResult = { title: string; url: string; snippet: string; siteName?: string };
type SearchResponse = { query: string; results: SearchResult[]; totalResults?: number };
type FetchResult = { url: string; final_url?: string; title?: string; description?: string; text?: string; format?: string };
type FetchResponse = { results?: FetchResult[]; errors?: Array<{ url?: string; error?: string; message?: string }> };
type AgentRun = {
  run_id?: string;
  status?: string;
  goal?: string;
  result?: unknown | null;
  error?: { message?: string; code?: string; category?: string; help_url?: string; help_message?: string } | string | null;
  num_of_steps?: number | null;
  finished_at?: string | null;
  streaming_url?: string | null;
  video_url?: string | null;
  steps?: Array<{ id?: string; status?: string; action?: string; purpose?: string; timestamp?: string; error?: unknown }>;
};
type Mode = 'search' | 'fetch' | 'agent';

function hostLabel(value: string): string { try { return new URL(value).hostname; } catch { return value; } }
function isHttpUrl(value: string): boolean {
  try { const parsed = new URL(value); return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname); } catch { return false; }
}

function isTerminalAgentStatus(status?: string): boolean {
  return ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'TIMEOUT', 'EXPIRED'].includes((status || '').toUpperCase());
}

function getLatestAgentStep(run: AgentRun): string {
  const steps = Array.isArray(run.steps) ? run.steps : [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const detail = steps[index].action || steps[index].purpose;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
  }
  return '';
}

function getAgentErrorText(error: AgentRun['error']): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') return error.message || error.help_message || error.code || 'Unknown Agent error';
  return '';
}

function getAgentGoalFailure(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const value = result as { status?: unknown; reason?: unknown; message?: unknown; error?: unknown; success?: unknown };
  const status = typeof value.status === 'string' ? value.status.toLowerCase() : '';
  if (status === 'failure' || status === 'failed' || value.success === false) {
    const reason = [value.reason, value.message, value.error].find((item) => typeof item === 'string' && item.trim());
    return typeof reason === 'string' ? reason : 'The browser run finished, but the research goal was not achieved.';
  }
  return '';
}

export function TinyFishIntelligencePage() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('Current demand for cloud security and cybersecurity skills in India');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [fetchUrls, setFetchUrls] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchData, setFetchData] = useState<FetchResponse | null>(null);
  const [agentUrl, setAgentUrl] = useState('https://www.tinyfish.ai/');
  const [agentGoal, setAgentGoal] = useState('Research this public website for information relevant to workforce intelligence, hiring trends, emerging technology skills, and workforce planning. Summarize key findings with evidence and source URLs. Return a structured JSON object with summary, findings, and source_urls.');
  const [agentAcknowledged, setAgentAcknowledged] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [agentRun, setAgentRun] = useState<AgentRun | null>(null);
  const [agentProgress, setAgentProgress] = useState('');

  async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    async function currentAccessToken(forceRefresh = false): Promise<string> {
      if (!supabase) {
        if (!session?.access_token) throw new Error('Sign in with your authenticated Supabase account to use TinyFish. Demo mode is not connected to this API.');
        return session.access_token;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) throw new Error('Unable to read your Supabase session: ' + error.message);
      let activeSession = data.session;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const shouldRefresh = forceRefresh || !activeSession || (typeof activeSession.expires_at === 'number' && activeSession.expires_at <= nowSeconds + 60);

      if (shouldRefresh) {
        const refreshed = await supabase.auth.refreshSession(activeSession ? { refresh_token: activeSession.refresh_token } : undefined);
        if (refreshed.error || !refreshed.data.session?.access_token) {
          // Clear a locally cached session that Supabase no longer recognizes.
          await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          throw new Error('Your saved Supabase session is no longer valid and could not be refreshed. The local session has been cleared. Sign in again, then retry.');
        }
        activeSession = refreshed.data.session;
      }

      const token = activeSession?.access_token ?? '';
      if (!token) throw new Error('No active Supabase access token. Sign in again to use TinyFish.');
      return token;
    }

    async function send(token: string): Promise<{ response: Response; payload: unknown }> {
      const response = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}), Authorization: 'Bearer ' + token },
      });
      const payload = await response.json().catch(() => ({}));
      return { response, payload };
    }

    let token = await currentAccessToken();
    let result = await send(token);
    const firstPayload = result.payload as { error?: unknown } | null;
    const errorText = typeof firstPayload?.error === 'string' ? firstPayload.error : '';

    // Supabase can retain a token in browser storage after its backing session was revoked.
    // Refresh and retry exactly once when the server identifies that specific condition.
    if ((result.response.status === 401 || result.response.status === 403) && /session_id claim in JWT does not exist/i.test(errorText) && supabase) {
      token = await currentAccessToken(true);
      result = await send(token);
      const retriedPayload = result.payload as { error?: unknown } | null;
      const retriedError = typeof retriedPayload?.error === 'string' ? retriedPayload.error : '';
      if ((result.response.status === 401 || result.response.status === 403) && /session_id claim in JWT does not exist/i.test(retriedError)) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        throw new Error('Supabase rejected the refreshed session too. The local session has been cleared. Sign in again. If this repeats immediately after signing in, the Supabase Auth session itself is being invalidated and must be investigated in the Supabase project.');
      }
    }

    if (!result.response.ok) {
      const payload = result.payload as { error?: unknown } | null;
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'TinyFish request failed. Please retry.');
    }
    return result.payload as T;
  }

  async function searchWeb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 3) { setSearchError('Enter at least 3 characters to search.'); return; }
    setSearchLoading(true); setSearchError(''); setSearchData(null);
    try { setSearchData(await apiRequest<SearchResponse>('/api/tinyfish/search', { method: 'POST', body: JSON.stringify({ query: query.trim() }) })); }
    catch (error) { setSearchError(error instanceof Error ? error.message : 'Search failed.'); }
    finally { setSearchLoading(false); }
  }

  function moveToFetch(url: string) { setFetchUrls(url); setFetchError(''); setFetchData(null); setMode('fetch'); }
  function moveToAgent(url: string) { setAgentUrl(url); setAgentError(''); setAgentRun(null); setAgentAcknowledged(false); setMode('agent'); }

  async function fetchPages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const urls = Array.from(new Set(fetchUrls.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)));
    if (!urls.length || urls.length > 10) { setFetchError('Enter between 1 and 10 URLs, separated by new lines.'); return; }
    if (urls.some((url) => !isHttpUrl(url))) { setFetchError('Every URL must be a complete http:// or https:// URL.'); return; }
    setFetchLoading(true); setFetchError(''); setFetchData(null);
    try { setFetchData(await apiRequest<FetchResponse>('/api/tinyfish/fetch', { method: 'POST', body: JSON.stringify({ urls }) })); }
    catch (error) { setFetchError(error instanceof Error ? error.message : 'Fetch failed.'); }
    finally { setFetchLoading(false); }
  }

  async function pollAgentRun(runId: string, maxAttempts = 75): Promise<AgentRun | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 2000 : 4000));
      const current = await apiRequest<AgentRun>('/api/tinyfish/agent-run?runId=' + encodeURIComponent(runId), { method: 'GET' });
      const run: AgentRun = { ...current, run_id: current.run_id || runId };
      setAgentRun(run);
      const status = (run.status || 'RUNNING').toUpperCase();

      if (isTerminalAgentStatus(status)) {
        if (status === 'COMPLETED') {
          const goalFailure = getAgentGoalFailure(run.result);
          setAgentProgress(goalFailure
            ? 'The browser run completed, but the research goal was not achieved: ' + goalFailure
            : run.result != null
              ? 'Research completed. Review the findings and verify the cited sources before using them.'
              : 'The browser run completed but returned no result payload. Review the run details below.');
        } else {
          const detail = getAgentErrorText(run.error);
          setAgentProgress('Agent run ended with status ' + status + (detail ? ': ' + detail : '.'));
        }
        return run;
      }

      const latestStep = getLatestAgentStep(run);
      setAgentProgress('Agent is working through the website…' + (latestStep ? ' Current step: ' + latestStep : ''));
    }

    setAgentProgress('The Agent is still running. The run ID is saved below. Use “Check status” to resume polling; do not start a duplicate run.');
    return null;
  }

  async function checkAgentStatus() {
    if (!agentRun?.run_id || agentLoading) return;
    setAgentLoading(true);
    setAgentError('');
    setAgentProgress('Reconnecting to the existing Agent run…');
    try {
      await pollAgentRun(agentRun.run_id, 45);
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Unable to check Agent status.');
      setAgentProgress('The run ID is preserved. Retry “Check status” to continue checking the same run.');
    } finally {
      setAgentLoading(false);
    }
  }

  async function runAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isHttpUrl(agentUrl)) { setAgentError('Enter a valid public website URL starting with http:// or https://.'); return; }
    if (agentGoal.trim().length < 20) { setAgentError('Give the agent a specific research goal (at least 20 characters).'); return; }
    if (!agentAcknowledged) { setAgentError('Acknowledge that TinyFish Agent runs are metered before starting.'); return; }
    if (agentRun?.run_id && !isTerminalAgentStatus(agentRun.status)) {
      setAgentError('An Agent run is already active. Check its status before starting another run.');
      return;
    }

    setAgentLoading(true);
    setAgentError('');
    setAgentRun(null);
    setAgentProgress('Starting a TinyFish Agent run…');
    try {
      const started = await apiRequest<AgentRun>('/api/tinyfish/agent', {
        method: 'POST',
        body: JSON.stringify({ url: agentUrl.trim(), goal: agentGoal.trim() }),
      });
      if (!started.run_id) throw new Error('TinyFish did not return a run ID.');
      setAgentRun({ run_id: started.run_id, status: 'PENDING' });
      setAgentProgress('Agent accepted the task. Waiting for browser execution…');
      await pollAgentRun(started.run_id, 75);
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Agent run failed.');
      setAgentProgress(agentRun?.run_id ? 'The run ID is preserved. Use “Check status” to reconnect to this run.' : '');
    } finally {
      setAgentLoading(false);
    }
  }

  const agentStatus = (agentRun?.status || '').toUpperCase();
  const agentIsTerminal = isTerminalAgentStatus(agentStatus);
  const agentIsActive = Boolean(agentRun?.run_id && !agentIsTerminal);
  const agentGoalFailure = agentRun?.status?.toUpperCase() === 'COMPLETED' ? getAgentGoalFailure(agentRun.result) : '';
  const tabs: Array<{ id: Mode; title: string; description: string; icon: typeof Search }> = [
    { id: 'search', title: 'Search', description: 'Discover sources', icon: Search },
    { id: 'fetch', title: 'Fetch', description: 'Read page content', icon: FileSearch },
    { id: 'agent', title: 'Agent', description: 'Run a workflow', icon: WandSparkles },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="TinyFish Intelligence" description="The live web-intelligence workspace for Togetherly. Discover sources, extract page content, then delegate multi-step research to a web agent." breadcrumb={['Home', 'TinyFish Intelligence']} />
      <Reveal direction="down">
        <section className="card overflow-hidden border-primary/20 shadow-md">
          <div className="bg-gradient-to-r from-primary/10 via-base-card to-cyan/10 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm"><Sparkles size={24} /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold text-text-primary">Togetherly Web Intelligence Engine</h2><span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">TinyFish server API</span></div><p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">One continuous workflow: Search finds relevant public sources, Fetch turns selected URLs into clean evidence, and Agent navigates a site to complete a focused research task. Togetherly still owns workforce recommendations and decisions.</p></div></div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-base-border bg-base-card px-3 py-2 text-[11px] font-semibold text-text-secondary"><ShieldCheck size={14} /> API key stays server-side</span>
            </div>
          </div>
          <div className="grid gap-px bg-base-border sm:grid-cols-3">{tabs.map((tab, index) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => setMode(tab.id)} className={'flex items-center gap-3 bg-base-card p-4 text-left transition-colors hover:bg-base-hover ' + (mode === tab.id ? 'ring-2 ring-inset ring-primary/60' : '')}><span className={'flex h-9 w-9 items-center justify-center rounded-lg ' + (mode === tab.id ? 'bg-primary text-white' : 'bg-base-hover text-primary')}><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-text-primary">{index + 1}. {tab.title}</span><span className="mt-0.5 block text-[11px] text-text-secondary">{tab.description}</span></span><ArrowRight size={14} className="text-text-muted" /></button>; })}</div>
        </section>
      </Reveal>

      {mode === 'search' && <Reveal direction="up"><section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3"><Globe size={20} className="mt-0.5 text-primary" /><div><h2 className="text-sm font-bold text-text-primary">1. Search the live web</h2><p className="mt-1 text-xs text-text-secondary">Find hiring signals, in-demand skills, industry changes, benchmarks, or trusted documentation.</p></div></div>
        <form onSubmit={searchWeb} className="space-y-3"><label htmlFor="tinyfish-search-query" className="block text-xs font-semibold text-text-primary">Research query</label><div className="flex flex-col gap-2 sm:flex-row"><input id="tinyfish-search-query" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} className="input-field min-w-0 flex-1 text-sm" placeholder="What should Togetherly research?" /><button type="submit" disabled={searchLoading} className="btn-primary justify-center text-xs">{searchLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}{searchLoading ? 'Searching…' : 'Search web'}</button></div></form>
        {searchError && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/5 p-3 text-xs text-critical"><AlertCircle size={15} />{searchError}</div>}
        {searchLoading && <div className="mt-4 flex items-center gap-2 rounded-lg border border-base-border p-4 text-xs text-text-secondary"><LoaderCircle size={16} className="animate-spin text-primary" />Getting fresh search results from TinyFish…</div>}
        {searchData && <div className="mt-5 space-y-3 border-t border-base-border pt-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-text-primary">Results for “{searchData.query}”</h3><span className="text-[11px] text-text-secondary">{searchData.results.length} sources returned</span></div>
          {searchData.results.length === 0 && <p className="rounded-lg border border-base-border p-4 text-xs text-text-secondary">No results returned. Try a more specific or broader query.</p>}
          {searchData.results.map((result, index) => <article key={result.url || result.title + index} className="rounded-xl border border-base-border p-4"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{result.siteName || hostLabel(result.url)}</span><span className="rounded bg-base-hover px-1.5 py-0.5 text-[10px] text-text-muted">Source {index + 1}</span></div><h4 className="text-sm font-bold text-text-primary">{result.title}</h4><p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{result.snippet}</p><div className="mt-3 flex flex-wrap gap-2"><a href={result.url} target="_blank" rel="noreferrer noopener" className="btn-secondary text-[11px]"><ExternalLink size={12} /> Open source</a><button type="button" onClick={() => moveToFetch(result.url)} className="btn-secondary text-[11px]"><ArrowDownToLine size={12} /> Fetch this page</button><button type="button" onClick={() => moveToAgent(result.url)} className="btn-primary text-[11px]"><WandSparkles size={12} /> Use with Agent</button></div></article>)}
        </div>}
      </section></Reveal>}

      {mode === 'fetch' && <Reveal direction="up"><section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3"><FileSearch size={20} className="mt-0.5 text-primary" /><div><h2 className="text-sm font-bold text-text-primary">2. Fetch clean page content</h2><p className="mt-1 text-xs text-text-secondary">TinyFish renders pages and returns readable content. Paste up to 10 URLs, or choose a source from Search.</p></div></div>
        <form onSubmit={fetchPages} className="space-y-3"><label htmlFor="tinyfish-fetch-urls" className="block text-xs font-semibold text-text-primary">URLs (one per line)</label><textarea id="tinyfish-fetch-urls" rows={4} value={fetchUrls} onChange={(event) => setFetchUrls(event.target.value)} className="input-field w-full text-sm" placeholder={'https://example.com/reports\nhttps://example.com/careers'} /><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] text-text-muted">Maximum 10 URLs per request. Use public pages you are authorized to access.</span><button type="submit" disabled={fetchLoading} className="btn-primary justify-center text-xs">{fetchLoading ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowDownToLine size={15} />}{fetchLoading ? 'Fetching…' : 'Fetch content'}</button></div></form>
        {fetchError && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/5 p-3 text-xs text-critical"><AlertCircle size={15} />{fetchError}</div>}
        {fetchLoading && <div className="mt-4 flex items-center gap-2 rounded-lg border border-base-border p-4 text-xs text-text-secondary"><LoaderCircle size={16} className="animate-spin text-primary" />Fetching pages and extracting content…</div>}
        {fetchData && <div className="mt-5 space-y-4 border-t border-base-border pt-5">{(fetchData.results || []).map((result, index) => <article key={result.final_url || result.url || String(index)} className="overflow-hidden rounded-xl border border-base-border"><div className="flex flex-wrap items-start justify-between gap-3 bg-base-bg/60 p-4"><div><h3 className="text-sm font-bold text-text-primary">{result.title || result.url}</h3><p className="mt-1 break-all text-[11px] text-text-muted">{result.final_url || result.url}</p>{result.description && <p className="mt-2 text-xs text-text-secondary">{result.description}</p>}</div><button type="button" onClick={() => moveToAgent(result.final_url || result.url)} className="btn-secondary shrink-0 text-[11px]"><WandSparkles size={12} /> Analyze with Agent</button></div><pre className="max-h-[460px] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed text-text-secondary">{result.text || 'No page text returned.'}</pre></article>)}{(fetchData.errors || []).map((error, index) => <div key={error.url || String(index)} className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-text-secondary">Could not fetch {error.url || 'one URL'}: {error.error || error.message || 'Unknown fetch error'}</div>)}</div>}
      </section></Reveal>}

      {mode === 'agent' && <Reveal direction="up"><section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3"><WandSparkles size={20} className="mt-0.5 text-primary" /><div><h2 className="text-sm font-bold text-text-primary">3. Delegate a multi-step task to TinyFish Agent</h2><p className="mt-1 text-xs text-text-secondary">Agent navigates the target website and returns structured findings. Start from a Search result or enter a public URL.</p></div></div>
        <form onSubmit={runAgent} className="space-y-4"><div className="space-y-1.5"><label htmlFor="tinyfish-agent-url" className="block text-xs font-semibold text-text-primary">Starting URL</label><input id="tinyfish-agent-url" value={agentUrl} onChange={(event) => setAgentUrl(event.target.value)} maxLength={2048} className="input-field w-full text-sm" placeholder="https://example.com" /></div><div className="space-y-1.5"><label htmlFor="tinyfish-agent-goal" className="block text-xs font-semibold text-text-primary">Agent goal</label><textarea id="tinyfish-agent-goal" rows={5} value={agentGoal} onChange={(event) => setAgentGoal(event.target.value)} maxLength={1500} className="input-field w-full text-sm" placeholder="Describe the public information to gather and the output format." /><p className="text-[11px] text-text-muted">Be specific about what to inspect, which fields matter, and the expected output.</p></div><label className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-text-secondary"><input type="checkbox" checked={agentAcknowledged} onChange={(event) => setAgentAcknowledged(event.target.checked)} className="mt-0.5" /><span><strong className="text-text-primary">I understand Agent runs may consume TinyFish credits.</strong> This integration requests read-only research. Do not use it to submit forms, send messages, make purchases, or change accounts or records.</span></label><button type="submit" disabled={agentLoading || !agentAcknowledged || agentIsActive} className="btn-primary justify-center text-xs">{agentLoading ? <LoaderCircle size={15} className="animate-spin" /> : <WandSparkles size={15} />}{agentLoading ? 'Agent working…' : agentIsActive ? 'Agent run still active' : 'Start agent research'}</button></form>
        {agentIsActive && !agentLoading && <button type="button" onClick={checkAgentStatus} className="btn-secondary mt-3 justify-center text-xs"><LoaderCircle size={14} /> Check status of existing run</button>}
        {agentError && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/5 p-3 text-xs text-critical"><AlertCircle size={15} />{agentError}</div>}
        {agentProgress && <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-text-secondary"><LoaderCircle size={15} className={agentLoading ? 'mt-0.5 animate-spin text-primary' : 'mt-0.5 text-primary'} /><span>{agentProgress}{agentRun?.run_id && <span className="mt-1 block break-all font-mono text-[10px]">Run ID: {agentRun.run_id} · Status: {agentRun.status || 'PENDING'}</span>}</span></div>}
        {agentRun && agentIsTerminal && <div className="mt-5 overflow-hidden rounded-xl border border-base-border"><div className="flex items-center gap-2 border-b border-base-border bg-base-bg/60 p-3">{agentStatus === 'COMPLETED' && !agentGoalFailure ? <CheckCircle2 size={16} className="text-success" /> : <AlertCircle size={16} className="text-warning" />}<h3 className="text-sm font-bold text-text-primary">{agentStatus === 'COMPLETED' && !agentGoalFailure ? 'Agent research result' : 'Agent run details'}</h3>{typeof agentRun.num_of_steps === 'number' && <span className="ml-auto text-[10px] text-text-muted">{agentRun.num_of_steps} steps</span>}</div>{agentGoalFailure && <div role="status" className="border-b border-warning/30 bg-warning/5 p-3 text-xs text-text-secondary">The browser completed, but the requested research goal was not achieved: {agentGoalFailure}</div>}<pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed text-text-secondary">{JSON.stringify(agentRun.result ?? agentRun.error ?? { status: agentRun.status, message: 'The Agent finished without returning a result payload.' }, null, 2)}</pre>{agentRun.streaming_url && isHttpUrl(agentRun.streaming_url) && <div className="border-t border-base-border p-3"><a href={agentRun.streaming_url} target="_blank" rel="noreferrer noopener" className="btn-secondary inline-flex text-xs"><ExternalLink size={13} /> Open browser stream</a></div>}{agentRun.video_url && isHttpUrl(agentRun.video_url) && <div className="border-t border-base-border p-3"><a href={agentRun.video_url} target="_blank" rel="noreferrer noopener" className="btn-secondary inline-flex text-xs"><ExternalLink size={13} /> Open run recording</a></div>}</div>}
      </section></Reveal>}

      <div className="flex items-start gap-2 rounded-lg border border-base-border bg-base-bg/50 p-3 text-[11px] leading-relaxed text-text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><p>Use public sources. Treat website content as untrusted input, verify critical facts against the original page, and never let an external result automatically change employee records or staffing decisions. Agent is metered; Search and Fetch are retrieval tools.</p></div>
    </div>
  );
}
