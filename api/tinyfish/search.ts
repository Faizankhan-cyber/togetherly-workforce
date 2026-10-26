import { authorizeTinyFishManager } from '../../server/tinyfishAuth';
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
  const access = await authorizeTinyFishManager(getHeader(req, 'authorization'));
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
      const normalized = typeof item.url === 'string' ? normalizeUrl(item.url) : null;
      return normalized ? { title: typeof item.title === 'string' ? item.title.slice(0, 300) : normalized, url: normalized, snippet: typeof item.snippet === 'string' ? item.snippet.slice(0, 1500) : '', siteName: typeof item.site_name === 'string' ? item.site_name : typeof item.siteName === 'string' ? item.siteName : '' } : null;
    }).filter((item): item is { title: string; url: string; snippet: string; siteName: string } => item !== null) : [];
    return res.status(200).json({ query: query.trim(), results, totalResults: data.total_results ?? data.totalResults ?? results.length });
  } catch (error) { return res.status(500).json({ error: error instanceof Error && error.name === 'AbortError' ? 'TinyFish Search timed out. Try again.' : 'Unable to complete TinyFish Search.' }); }
}
