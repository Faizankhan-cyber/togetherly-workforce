import { authorizeTinyFishManager } from '../../server/tinyfishAuth';
type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => ApiResponse; json: (body: unknown) => void };
function getHeader(req: ApiRequest, name: string): string { const value = req.headers[name] ?? req.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test')) return false;

    // Block private, loopback, link-local, carrier-grade NAT, documentation, and reserved IP ranges.
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const octets = ipv4.slice(1).map(Number);
      if (octets.some((part) => part < 0 || part > 255)) return false;
      const [a, b, c] = octets;
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
          (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) || (a === 192 && b === 0 && c === 0) ||
          (a === 192 && b === 0 && c === 2) || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
          (a === 203 && b === 0 && c === 113)) return false;
    }
    if (host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return false;
    return true;
  } catch {
    return false;
  }
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
