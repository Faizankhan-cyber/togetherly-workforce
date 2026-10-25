type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => ApiResponse; json: (body: unknown) => void };
function getHeader(req: ApiRequest, name: string): string { const value = req.headers[name] ?? req.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value); if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const host = url.hostname.toLowerCase();
    if (!host || url.username || url.password || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === '::1' || host.startsWith('fc') || host.startsWith('fd')) return false;
    return true;
  } catch { return false; }
}
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Authorization');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed. Use POST.' }); }
  const parts = getHeader(req, 'authorization').trim().split(' ').filter(Boolean);
  const token = parts[0]?.toLowerCase() === 'bearer' ? parts.slice(1).join(' ').trim() : '';
  if (!token) return res.status(401).json({ error: 'Sign in to use TinyFish Intelligence.' });
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const tinyFishKey = process.env.TINYFISH_API_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'Supabase server authentication is not configured in Vercel.' });
  if (!tinyFishKey) return res.status(503).json({ error: 'TINYFISH_API_KEY is missing from the Vercel function environment. Redeploy after adding it.' });
  try {
    const auth = await fetch(supabaseUrl + '/auth/v1/user', { headers: { apikey: supabaseKey, Authorization: 'Bearer ' + token } });
    if (!auth.ok) return res.status(401).json({ error: 'Your session is invalid or expired. Sign in again.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const requested = typeof body === 'object' && body !== null && 'urls' in body ? (body as { urls?: unknown }).urls : undefined;
    if (!Array.isArray(requested) || requested.length < 1 || requested.length > 10 || requested.some((url) => typeof url !== 'string' || !isSafePublicUrl(url))) return res.status(400).json({ error: 'Provide 1–10 valid public http(s) URLs. Local, private-network, and credential-bearing URLs are not allowed.' });
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch('https://api.fetch.tinyfish.ai', { method: 'POST', headers: { 'X-API-Key': tinyFishKey, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ urls: requested, format: 'markdown', purpose: 'Extract content relevant to workforce intelligence, hiring demand, technology skills, and evidence-based workforce planning.' }), signal: controller.signal });
    } finally { clearTimeout(timeout); }
    if (!response.ok) return res.status(502).json({ error: response.status === 401 || response.status === 403 ? 'TinyFish rejected the API key. Check TINYFISH_API_KEY in Vercel.' : 'TinyFish Fetch returned HTTP ' + response.status + '. Please retry.' });
    const data = await response.json() as { results?: unknown[]; errors?: unknown[] };
    return res.status(200).json({ results: Array.isArray(data.results) ? data.results.slice(0, 10) : [], errors: Array.isArray(data.errors) ? data.errors.slice(0, 10) : [] });
  } catch (error) { return res.status(500).json({ error: error instanceof Error && error.name === 'AbortError' ? 'TinyFish Fetch timed out. Try fewer URLs.' : 'Unable to complete TinyFish Fetch.' }); }
}
