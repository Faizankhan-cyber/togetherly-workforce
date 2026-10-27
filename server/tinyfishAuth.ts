declare const process: { env: Record<string, string | undefined> };
type TinyFishRole = 'employee' | 'manager' | 'hr' | 'admin';
export type TinyFishAccess =
  | { ok: true; token: string; supabaseUrl: string; supabaseKey: string; userId: string; employeeId: string; role: TinyFishRole }
  | { ok: false; status: number; error: string };

function projectOrigin(): string {
  const raw = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    if (parsed.hostname.toLowerCase().endsWith('.supabase.co')) return parsed.origin;
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = (segments[segments.length - 1] || '').toLowerCase();
    const previous = (segments[segments.length - 2] || '').toLowerCase();
    if (last === 'v1' && ['rest', 'auth', 'graphql', 'storage'].includes(previous)) segments.splice(-2, 2);
    return parsed.origin + (segments.length ? '/' + segments.join('/') : '');
  } catch { return ''; }
}

/** TinyFish is available to active, linked employee, manager, HR, and admin accounts. */
export async function authorizeTinyFishManager(authorizationHeader: string): Promise<TinyFishAccess> {
  const parts = authorizationHeader.trim().split(/\s+/).filter(Boolean);
  const token = parts[0]?.toLowerCase() === 'bearer' ? parts.slice(1).join(' ').trim() : '';
  if (!token) return { ok: false, status: 401, error: 'Sign in to use TinyFish Intelligence.' };

  const supabaseUrl = projectOrigin();
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseKey) return { ok: false, status: 503, error: 'Supabase server authentication is not configured.' };

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
    });
    if (!authResponse.ok) return { ok: false, status: 401, error: 'Your session is invalid or expired. Sign in again.' };
    const authUser = await authResponse.json() as { id?: string };
    if (!authUser.id) return { ok: false, status: 401, error: 'Supabase did not return an authenticated user.' };

    const profileUrl = new URL(`${supabaseUrl}/rest/v1/employees`);
    profileUrl.searchParams.set('auth_user_id', `eq.${authUser.id}`);
    profileUrl.searchParams.set('employment_status', 'eq.active');
    profileUrl.searchParams.set('select', 'id,system_role');
    profileUrl.searchParams.set('limit', '1');
    const profileResponse = await fetch(profileUrl, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!profileResponse.ok) return { ok: false, status: 503, error: 'Could not verify active organization membership. Please retry.' };
    const profiles = await profileResponse.json() as Array<{ id?: string; system_role?: string }>;
    const profile = Array.isArray(profiles) ? profiles[0] : undefined;
    if (!profile?.id || !profile.system_role) return { ok: false, status: 403, error: 'TinyFish is available only to active, linked workspace accounts.' };
    if (!['employee', 'manager', 'hr', 'admin'].includes(profile.system_role)) return { ok: false, status: 403, error: 'Your role is not authorized to use TinyFish AI.' };
    return { ok: true, token, supabaseUrl, supabaseKey, userId: authUser.id, employeeId: profile.id, role: profile.system_role as TinyFishRole };
  } catch {
    return { ok: false, status: 503, error: 'Could not verify organization access right now. Please retry.' };
  }
}
