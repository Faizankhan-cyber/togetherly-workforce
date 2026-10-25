type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type ApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => ApiResponse; json: (body: unknown) => void };
function getHeader(req: ApiRequest, name: string): string { const value = req.headers[name] ?? req.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function getSupabaseProjectUrl(): string {
  const raw = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/^['\"]+|['\"]+$/g, '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    // Supabase-hosted project URLs must always use the project origin, never /rest/v1 or /auth/v1.
    if (parsed.hostname.toLowerCase().endsWith('.supabase.co')) return parsed.origin;
    // Match the frontend sanitizer for self-hosted/custom Supabase URLs.
    const cleanedPath = parsed.pathname
      .replace(/\/(rest|auth|graphql|storage)\/v1\/?$/i, '')
      .replace(/\\/+$/, '');
    return `${parsed.origin}${cleanedPath}`.replace(/\/+$/, '')
  } catch {
    return '';
  }
}
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Authorization');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed. Use GET.' }); }
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
    const rawRunId = req.query?.runId;
    const runId = Array.isArray(rawRunId) ? rawRunId[0] : rawRunId;
    if (!runId || !/^[a-zA-Z0-9_-]{8,128}$/.test(runId)) return res.status(400).json({ error: 'A valid Agent runId is required.' });
    const response = await fetch('https://agent.tinyfish.ai/v1/runs/' + encodeURIComponent(runId), { headers: { 'X-API-Key': tinyFishKey, Accept: 'application/json' } });
    if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ error: response.status === 404 ? 'Agent run not found. Check the run ID.' : 'Unable to read TinyFish Agent status (HTTP ' + response.status + ').' });
    return res.status(200).json(await response.json());
  } catch { return res.status(500).json({ error: 'Unable to read TinyFish Agent status.' }); }
}
