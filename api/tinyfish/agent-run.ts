import { authorizeTinyFishManager } from '../../server/tinyfishAuth';
type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type ApiResponse = { setHeader: (name: string, value: string) => void; status: (code: number) => ApiResponse; json: (body: unknown) => void };
function getHeader(req: ApiRequest, name: string): string { const value = req.headers[name] ?? req.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Authorization');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed. Use GET.' }); }
  const access = await authorizeTinyFishManager(getHeader(req, 'authorization'));
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const { token, supabaseUrl, supabaseKey, userId } = access;
  const tinyFishKey = process.env.TINYFISH_API_KEY;
  if (!tinyFishKey) return res.status(503).json({ error: 'TINYFISH_API_KEY is missing from the server function environment.' });
  try {
    const rawRunId = req.query?.runId;
    const runId = Array.isArray(rawRunId) ? rawRunId[0] : rawRunId;
    if (!runId || !/^[a-zA-Z0-9_-]{8,128}$/.test(runId)) return res.status(400).json({ error: 'A valid Agent runId is required.' });
    const ownerCheck = await fetch(`${supabaseUrl}/rest/v1/tinyfish_agent_runs?run_id=eq.${encodeURIComponent(runId)}&owner_auth_user_id=eq.${encodeURIComponent(userId)}&select=run_id&limit=1`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!ownerCheck.ok) return res.status(503).json({ error: 'Could not verify Agent run ownership. Please retry.' });
    const ownedRuns = await ownerCheck.json() as Array<{ run_id: string }>;
    if (!Array.isArray(ownedRuns) || ownedRuns.length === 0) return res.status(404).json({ error: 'Agent run not found for your account.' });
    const response = await fetch('https://agent.tinyfish.ai/v1/runs/' + encodeURIComponent(runId), { headers: { 'X-API-Key': tinyFishKey, Accept: 'application/json' } });
    const responseText = await response.text();
    if (!response.ok) {
      const detail = responseText.replace(/[\r\n]+/g, ' ').slice(0, 180);
      return res.status(response.status === 404 ? 404 : 502).json({ error: response.status === 404 ? 'Agent run not found. Check the run ID.' : 'TinyFish Agent status returned HTTP ' + response.status + (detail ? ': ' + detail : '') });
    }
    try { return res.status(200).json(JSON.parse(responseText)); }
    catch { return res.status(502).json({ error: 'TinyFish Agent status returned a non-JSON response: ' + responseText.replace(/[\r\n]+/g, ' ').slice(0, 180) }); }
  } catch (error) {
    const err = error as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    const detail = (err?.cause?.message || err?.message || err?.name || 'Unknown error').replace(/[\r\n]+/g, ' ').slice(0, 180);
    console.error('TinyFish Agent status request failed', { name: err?.name, causeCode: err?.cause?.code, detail });
    return res.status(502).json({ error: 'TinyFish Agent status network/request error: ' + detail });
  }
}
