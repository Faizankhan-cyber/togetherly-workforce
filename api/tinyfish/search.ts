type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => ApiResponse; json: (body: unknown) => void };
type TinyFishResult = { title?: string; url?: string; snippet?: string; site_name?: string; siteName?: string };

function getHeader(req: ApiRequest, name: string): string {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const authParts = getHeader(req, 'authorization').trim().split(/\\s+/);
  const token = authParts[0]?.toLowerCase() === 'bearer' ? authParts.slice(1).join(' ').trim() : '';
  if (!token) return res.status(401).json({ error: 'Sign in to use live market intelligence.' });

  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  while (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const tinyFishKey = process.env.TINYFISH_API_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'Server authentication is not configured. Set Supabase environment variables in Vercel.' });
  if (!tinyFishKey) return res.status(503).json({ error: 'TinyFish is not configured yet. Add TINYFISH_API_KEY to Vercel Environment Variables and redeploy.' });

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } });
    if (!authResponse.ok) return res.status(401).json({ error: 'Your session is invalid or expired. Sign in again.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const query = typeof body === 'object' && body !== null && 'query' in body ? (body as { query?: unknown }).query : undefined;
    if (typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 500) {
      return res.status(400).json({ error: 'Search query must contain between 3 and 500 characters.' });
    }

    const searchUrl = new URL('https://api.search.tinyfish.ai/');
    searchUrl.searchParams.set('query', query.trim());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(searchUrl, { headers: { 'X-API-Key': tinyFishKey, Accept: 'application/json' }, signal: controller.signal });
    } finally { clearTimeout(timeout); }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) return res.status(502).json({ error: 'TinyFish rejected the server API key. Check TINYFISH_API_KEY in Vercel.' });
      return res.status(502).json({ error: `TinyFish search failed (HTTP ${response.status}). Try again shortly.` });
    }
    const data = await response.json() as { results?: TinyFishResult[]; total_results?: number; totalResults?: number };
    const results = Array.isArray(data.results) ? data.results.slice(0, 10)
      .filter((item) => typeof item.url === 'string' && (item.url.startsWith('https://') || item.url.startsWith('http://')))
      .map((item) => ({
        title: typeof item.title === 'string' ? item.title.slice(0, 300) : item.url!,
        url: item.url!,
        snippet: typeof item.snippet === 'string' ? item.snippet.slice(0, 1500) : '',
        siteName: typeof item.site_name === 'string' ? item.site_name : typeof item.siteName === 'string' ? item.siteName : '',
      })) : [];
    return res.status(200).json({ query: query.trim(), results, totalResults: data.total_results ?? data.totalResults ?? results.length });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return res.status(500).json({ error: timedOut ? 'TinyFish search timed out. Try a shorter query.' : 'Unable to complete TinyFish search. Please try again.' });
  }
}
