type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => ApiResponse; json: (body: unknown) => void };
function getHeader(req: ApiRequest, name: string): string { const value = req.headers[name] ?? req.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function getSupabaseProjectUrl(): string {
  const configuredUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const raw = configuredUrl.trim();
  const wrappedInDoubleQuotes = raw.startsWith('"') && raw.endsWith('"');
  const wrappedInSingleQuotes = raw.startsWith("'") && raw.endsWith("'");
  const projectUrl = wrappedInDoubleQuotes || wrappedInSingleQuotes ? raw.slice(1, -1).trim() : raw;
  if (!projectUrl) return '';
  try {
    const parsed = new URL(projectUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    // Hosted Supabase must use the project origin, not an API service path.
    if (parsed.hostname.toLowerCase().endsWith('.supabase.co')) return parsed.origin;
    // Match the frontend sanitizer for custom/self-hosted URLs ending in a service path.
    const segments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = (segments[segments.length - 1] || '').toLowerCase();
    const serviceSegment = (segments[segments.length - 2] || '').toLowerCase();
    if (lastSegment === 'v1' && ['rest', 'auth', 'graphql', 'storage'].includes(serviceSegment)) {
      segments.splice(-2, 2);
    }
    return parsed.origin + (segments.length ? '/' + segments.join('/') : '');
  } catch {
    return '';
  }
}
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Authorization');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed. Use POST.' }); }
  const parts = getHeader(req, 'authorization').trim().split(' ').filter(Boolean);
  const token = parts[0]?.toLowerCase() === 'bearer' ? parts.slice(1).join(' ').trim() : '';
  if (!token) return res.status(401).json({ error: 'Sign in to use TinyFish Intelligence.' });
  const supabaseUrl = getSupabaseProjectUrl();
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
    const requested = typeof body === 'object' && body !== null && 'urls' in body ? (body as { urls?: unknown }).urls : undefined;
    if (!Array.isArray(requested) || requested.length < 1 || requested.length > 10 || requested.some((url) => typeof url !== 'string' || !isSafePublicUrl(url))) return res.status(400).json({ error: 'Provide 1–10 valid public http(s) URLs. Local, private-network, and credential-bearing URLs are not allowed.' });
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 55000);
    let response: Response;
    try {
      response = await fetch('https://api.fetch.tinyfish.ai', { method: 'POST', headers: { 'X-API-Key': tinyFishKey, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ urls: requested, format: 'markdown', per_url_timeout_ms: 45000, purpose: 'Extract content relevant to workforce intelligence, hiring demand, technology skills, and evidence-based workforce planning.' }), signal: controller.signal });
    } finally { clearTimeout(timeout); }
    const responseText = await response.text();
    if (!response.ok) {
      let detail = '';
      try {
        const parsed = JSON.parse(responseText) as { message?: string; error?: string; detail?: string };
        detail = parsed.message || parsed.error || parsed.detail || '';
      } catch { detail = responseText; }
      const safeDetail = detail.replace(/[\r\n]+/g, ' ').slice(0, 240);
      if (response.status === 401 || response.status === 403) return res.status(502).json({ error: 'TinyFish Fetch rejected the API key or access (HTTP ' + response.status + ')' + (safeDetail ? ': ' + safeDetail : '') + '. Check TINYFISH_API_KEY in Vercel.' });
      if (response.status === 429) return res.status(502).json({ error: 'TinyFish Fetch rate limit reached. Wait a moment before retrying.' });
      return res.status(502).json({ error: 'TinyFish Fetch returned HTTP ' + response.status + (safeDetail ? ': ' + safeDetail : '') + '.' });
    }
    let data: { results?: unknown[]; errors?: unknown[] };
    try { data = JSON.parse(responseText) as { results?: unknown[]; errors?: unknown[] }; }
    catch { return res.status(502).json({ error: 'TinyFish Fetch returned a non-JSON response (HTTP ' + response.status + '): ' + responseText.replace(/[\r\n]+/g, ' ').slice(0, 180) }); }
    return res.status(200).json({ results: Array.isArray(data.results) ? data.results.slice(0, 10) : [], errors: Array.isArray(data.errors) ? data.errors.slice(0, 10) : [] });
  } catch (error) {
    const err = error as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    const name = err?.name || 'UnknownError';
    const causeCode = err?.cause?.code;
    const detail = (err?.cause?.message || err?.message || name).replace(/[\r\n]+/g, ' ').slice(0, 220);
    console.error('TinyFish Fetch request failed', { name, causeCode, detail });
    if (name === 'AbortError' || name === 'TimeoutError') return res.status(504).json({ error: 'TinyFish Fetch timed out after 55 seconds. Try one URL at a time or use a faster page.' });
    return res.status(502).json({ error: 'TinyFish Fetch network/request error' + (causeCode ? ' (' + causeCode + ')' : ' (' + name + ')') + ': ' + detail });
  }
}
