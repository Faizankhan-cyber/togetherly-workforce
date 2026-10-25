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
  const parts = getHeader(req, 'authorization').trim().split(' ').filter(Boolean);
  const token = parts[0]?.toLowerCase() === 'bearer' ? parts.slice(1).join(' ').trim() : '';
  if (!token) return res.status(401).json({ error: 'Sign in to use TinyFish Intelligence.' });
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const tinyFishKey = process.env.TINYFISH_API_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'Supabase server authentication is not configured in Vercel.' });
  if (!tinyFishKey) return res.status(503).json({ error: 'TINYFISH_API_KEY is missing from the Vercel function environment. Redeploy after adding it.' });
  try {
    const auth = await fetch(supabaseUrl + '/auth/v1/user', { headers: { apikey: supabaseKey, Authorization: 'Bearer ' + token } });
    if (!auth.ok) {
      const authDetail = await auth.json().catch(() => ({})) as { message?: string; msg?: string; error?: string; error_description?: string };
      const reason = [authDetail.message, authDetail.msg, authDetail.error_description, authDetail.error].find((value) => typeof value === 'string' && value.trim());
      const safeReason = reason ? String(reason).replace(/[\r\n]+/g, ' ').slice(0, 180) : '';
      return res.status(401).json({ error: 'Supabase Auth rejected the session or API key (HTTP ' + auth.status + (safeReason ? ': ' + safeReason : '') + '). Check that Vercel uses the same Supabase project URL and public key as the frontend, then sign in again.' });
    }
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
