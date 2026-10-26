declare const process: { env: Record<string, string | undefined> };
import { authorizeTinyFishManager } from '../../server/tinyfishAuth.js';
type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => ApiResponse; json: (body: unknown) => void };
type TinyFishResult = { title?: string; url?: string; snippet?: string; site_name?: string; siteName?: string };
function getHeader(req: ApiRequest, name: string): string { const value = req.headers[name] ?? req.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function normalizeUrl(value: string): string | null {
  try { const url = new URL(value.startsWith('http://') || value.startsWith('https://') ? value : 'https://' + value); if (url.protocol !== 'https:' && url.protocol !== 'http:') return null; return url.toString(); } catch { return null; }
}
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Authorization');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed. Use POST.' }); }
  let access: Awaited<ReturnType<typeof authorizeTinyFishManager>>;
  try {
    access = await authorizeTinyFishManager(getHeader(req, 'authorization'));
  } catch (error) {
    const err = error as { name?: string; message?: string };
    console.error('TinyFish Search authorization failed unexpectedly', { name: err?.name || 'UnknownError', detail: (err?.message || '').replace(/[\r\n]+/g, ' ').slice(0, 160) });
    return res.status(503).json({ error: 'Could not verify organization access right now. Please retry.' });
  }
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const { token } = access;
  const tinyFishKey = process.env.TINYFISH_API_KEY;
  if (!tinyFishKey) return res.status(503).json({ error: 'TINYFISH_API_KEY is missing from the server function environment.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const query = typeof body === 'object' && body !== null && 'query' in body ? (body as { query?: unknown }).query : undefined;
    if (typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 500) return res.status(400).json({ error: 'Search query must contain 3–500 characters.' });
    const url = new URL('https://api.search.tinyfish.ai/');
    url.searchParams.set('query', query.trim()); url.searchParams.set('location', 'IN'); url.searchParams.set('language', 'en');
    url.searchParams.set('purpose', 'Research current workforce skills, public hiring demand, technology trends, and credible sources for workforce planning.');
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try { response = await fetch(url, { headers: { 'X-API-Key': tinyFishKey, Accept: 'application/json' }, signal: controller.signal }); } finally { clearTimeout(timeout); }
    if (!response.ok) return res.status(502).json({ error: response.status === 401 || response.status === 403 ? 'TinyFish rejected the API key. Check TINYFISH_API_KEY in Vercel.' : 'TinyFish Search returned HTTP ' + response.status + '. Please retry.' });
    const data = await response.json() as { results?: TinyFishResult[]; total_results?: number; totalResults?: number };
    const results = Array.isArray(data.results) ? data.results.slice(0, 10).map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as TinyFishResult;
      const normalized = typeof candidate.url === 'string' ? normalizeUrl(candidate.url) : null;
      return normalized ? {
        title: typeof candidate.title === 'string' ? candidate.title.slice(0, 300) : normalized,
        url: normalized,
        snippet: typeof candidate.snippet === 'string' ? candidate.snippet.slice(0, 1500) : '',
        siteName: typeof candidate.site_name === 'string' ? candidate.site_name : typeof candidate.siteName === 'string' ? candidate.siteName : '',
      } : null;
    }).filter((item): item is { title: string; url: string; snippet: string; siteName: string } => item !== null) : [];
    return res.status(200).json({ query: query.trim(), results, totalResults: data.total_results ?? data.totalResults ?? results.length });
  } catch (error) {
    const err = error as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    const name = err?.name || 'UnknownError';
    const causeCode = err?.cause?.code;
    const detail = (err?.cause?.message || err?.message || name).replace(/[\r\n]+/g, ' ').slice(0, 180);
    console.error('TinyFish Search request failed', { name, causeCode, detail });
    if (name === 'AbortError' || name === 'TimeoutError') return res.status(504).json({ error: 'TinyFish Search timed out. Try again.' });
    return res.status(502).json({ error: 'TinyFish Search could not complete the request. Check the server logs for the request failure.' });
  }
}
