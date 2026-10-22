import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Detailed configuration inspection status for Supabase integration.
 */
export interface SupabaseConfigStatus {
  /** True only when both URL and key are present, validly formatted, and sanitized */
  isConfigured: boolean;
  /** True when configuration is valid */
  isValid: boolean;
  /** The sanitized project root URL (e.g. https://<project-ref>.supabase.co) */
  sanitizedUrl: string | null;
  /** Whether VITE_SUPABASE_URL is defined */
  hasUrl: boolean;
  /** Whether VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY is defined */
  hasKey: boolean;
  /** Descriptive error message if configuration is malformed, missing, or invalid */
  configError: string | null;
  /** Non-fatal diagnostic warning or normalization note */
  warning?: string | null;
}

/**
 * Result of active real-time connection check against Supabase Auth endpoints.
 */
export interface SupabaseConnectionVerification {
  connected: boolean;
  checkedAt: string;
  error?: string;
  httpStatus?: number;
  details?: {
    emailAuthEnabled?: boolean;
    signupEnabled?: boolean;
  };
}

/**
 * Safely reads from global process.env if available in server or test execution environments.
 */
const getProcessEnv = (): Record<string, string | undefined> | undefined => {
  try {
    return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
      ?.process?.env;
  } catch {
    return undefined;
  }
};

/**
 * Retrieves the raw URL environment variable across Vite client and node runtime.
 */
const getRawEnvUrl = (): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
      return import.meta.env.VITE_SUPABASE_URL;
    }
  } catch {
    // Ignore and fallback
  }
  const procEnv = getProcessEnv();
  if (procEnv) {
    return procEnv.VITE_SUPABASE_URL || procEnv.SUPABASE_URL;
  }
  return undefined;
};

/**
 * Retrieves the raw publishable or anon key across Vite client and node runtime.
 */
const getRawEnvKey = (): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (key) return key;
    }
  } catch {
    // Ignore and fallback
  }
  const procEnv = getProcessEnv();
  if (procEnv) {
    return (
      procEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
      procEnv.VITE_SUPABASE_ANON_KEY ||
      procEnv.SUPABASE_PUBLISHABLE_KEY ||
      procEnv.SUPABASE_ANON_KEY
    );
  }
  return undefined;
};

/**
 * Normalizes, validates, and sanitizes a Supabase project URL.
 *
 * CRITICAL FIX FOR: "Invalid path specified in request URL"
 * This error occurs when a URL like `https://<ref>.supabase.co/rest/v1/` or `https://<ref>.supabase.co/auth/v1`
 * is passed to Supabase's `createClient`. The GoTrue client appends `/auth/v1/...` resulting in invalid
 * paths like `/rest/v1/auth/v1/token`.
 *
 * This sanitizer strips all subpaths, trailing slashes, and quotes, ensuring the client receives
 * strictly the project root origin (`https://<project-ref>.supabase.co`).
 */
export function sanitizeSupabaseUrl(rawUrl?: string): {
  url: string | null;
  error: string | null;
  warning?: string | null;
} {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      url: null,
      error: 'VITE_SUPABASE_URL environment variable is missing.',
    };
  }

  // Strip leading/trailing single or double quotes and whitespace
  const trimmed = rawUrl.trim().replace(/^['"]+|['"]+$/g, '').trim();

  // Guard against unreplaced placeholders
  if (
    trimmed.includes('your-project') ||
    trimmed.includes('placeholder') ||
    trimmed.includes('example.com')
  ) {
    return {
      url: null,
      error: 'VITE_SUPABASE_URL contains an unreplaced template placeholder.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      url: null,
      error: 'VITE_SUPABASE_URL is not a valid URL format.',
    };
  }

  // Validate protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      url: null,
      error: 'VITE_SUPABASE_URL must use http: or https: protocol.',
    };
  }

  // Reject Supabase dashboard URLs
  if (
    parsed.hostname.toLowerCase() === 'supabase.com' &&
    parsed.pathname.toLowerCase().includes('/dashboard')
  ) {
    return {
      url: null,
      error:
        'VITE_SUPABASE_URL is set to a Supabase dashboard URL. Please provide your Project API URL (format: https://<project-ref>.supabase.co).',
    };
  }

  // For Supabase-hosted projects (*.supabase.co), the API gateway base URL is strictly the origin
  let cleanUrl: string;
  let warning: string | null = null;

  if (parsed.hostname.toLowerCase().endsWith('.supabase.co')) {
    if (parsed.pathname && parsed.pathname !== '/') {
      warning = `Normalized URL: removed path segment "${parsed.pathname}" to resolve base origin.`;
    }
    cleanUrl = parsed.origin;
  } else {
    // For self-hosted or custom domains, strip /rest/v1, /auth/v1, or other service subpaths
    const cleanedPath = parsed.pathname
      .replace(/\/(rest|auth|graphql|storage)\/v1\/?$/i, '')
      .replace(/\/+$/, '');
    cleanUrl = `${parsed.origin}${cleanedPath}`.replace(/\/+$/, '');
  }

  return {
    url: cleanUrl,
    error: null,
    warning,
  };
}

/**
 * Validates and sanitizes a Supabase anon or publishable API key.
 *
 * Accepts either:
 * - Public publishable keys: `sb_publishable_...`
 * - Standard JWT anon keys: `eyJ...`
 * Never exposes or accepts private service-role keys.
 */
export function sanitizeSupabaseKey(rawKey?: string): {
  key: string | null;
  error: string | null;
} {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    return {
      key: null,
      error: 'VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY is missing.',
    };
  }

  // Strip leading/trailing quotes and whitespace
  const trimmed = rawKey.trim().replace(/^['"]+|['"]+$/g, '').trim();

  // Guard against template placeholders
  if (
    trimmed.includes('your-anon-key') ||
    trimmed.includes('your-publishable-key') ||
    trimmed.includes('placeholder') ||
    trimmed === 'your-key-here'
  ) {
    return {
      key: null,
      error: 'Supabase API key contains an unreplaced template placeholder.',
    };
  }

  // Guard against service-role secret key exposure
  if (trimmed.startsWith('sb_secret_')) {
    return {
      key: null,
      error:
        'Detected a private service-role secret key. Never expose service-role secrets in client applications. Use your public publishable or anon key.',
    };
  }

  // Minimum sanity length check
  if (trimmed.length < 20) {
    return {
      key: null,
      error: 'Supabase key is too short to be a valid API key.',
    };
  }

  return {
    key: trimmed,
    error: null,
  };
}

/**
 * Evaluates the current environment variables and returns a complete diagnostic report.
 */
export const getSupabaseConfigStatus = (): SupabaseConfigStatus => {
  const rawUrl = getRawEnvUrl();
  const rawKey = getRawEnvKey();

  const hasUrl = Boolean(rawUrl && rawUrl.trim());
  const hasKey = Boolean(rawKey && rawKey.trim());

  if (!hasUrl && !hasKey) {
    return {
      isConfigured: false,
      isValid: false,
      sanitizedUrl: null,
      hasUrl: false,
      hasKey: false,
      configError: null, // Graceful demo mode fallback when neither is configured
    };
  }

  const urlResult = sanitizeSupabaseUrl(rawUrl);
  const keyResult = sanitizeSupabaseKey(rawKey);

  const error = urlResult.error || keyResult.error || null;
  const isConfigured = Boolean(urlResult.url && keyResult.key && !error);

  return {
    isConfigured,
    isValid: isConfigured,
    sanitizedUrl: urlResult.url,
    hasUrl,
    hasKey,
    configError: error,
    warning: urlResult.warning,
  };
};

/**
 * Checks whether valid, sanitized Supabase environment variables are configured.
 */
export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfigStatus().isConfigured;
};

// Evaluate configuration
const configStatus = getSupabaseConfigStatus();
const sanitizedKeyResult = sanitizeSupabaseKey(getRawEnvKey());

/**
 * Shared Supabase client instance.
 *
 * Initialized with sanitized origin URL and clean public API key.
 * If credentials are missing or invalid, value is `null`, enabling demo mode fallback.
 */
export const supabase: SupabaseClient | null =
  configStatus.isConfigured && configStatus.sanitizedUrl && sanitizedKeyResult.key
    ? createClient(configStatus.sanitizedUrl, sanitizedKeyResult.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

/**
 * Accessor helper that retrieves the active Supabase client
 * or throws an informative error if invoked when Supabase is unconfigured.
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (!supabase) {
    const status = getSupabaseConfigStatus();
    throw new Error(
      status.configError ||
        'Supabase is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in your environment.'
    );
  }
  return supabase;
};

/**
 * Performs a genuine, live network verification check against the Supabase project
 * using the configured credentials.
 *
 * Calls `${sanitizedUrl}/auth/v1/settings` with the public API key.
 * This guarantees that:
 * 1. The URL is valid and reachable
 * 2. The API key is accepted by the Supabase project
 * 3. The Auth service is active and responsive
 *
 * Does not display "Connected" unless this check succeeds with HTTP 200.
 */
export async function verifySupabaseConnection(timeoutMs = 7000): Promise<SupabaseConnectionVerification> {
  const status = getSupabaseConfigStatus();
  const timestamp = new Date().toISOString();

  if (!status.isConfigured || !status.sanitizedUrl || !sanitizedKeyResult.key) {
    return {
      connected: false,
      checkedAt: timestamp,
      error: status.configError || 'Supabase credentials are not configured.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${status.sanitizedUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: sanitizedKeyResult.key,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        connected: true,
        checkedAt: timestamp,
        httpStatus: response.status,
        details: {
          emailAuthEnabled: Boolean(data?.external?.email),
          signupEnabled: !data?.disable_signup,
        },
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        connected: false,
        checkedAt: timestamp,
        httpStatus: response.status,
        error: 'Invalid API key or unauthorized access. Please verify your publishable or anon key.',
      };
    }

    if (response.status === 404) {
      return {
        connected: false,
        checkedAt: timestamp,
        httpStatus: response.status,
        error: 'Supabase Auth endpoint not found (HTTP 404). Check project URL.',
      };
    }

    const errorBody = await response.text().catch(() => '');
    return {
      connected: false,
      checkedAt: timestamp,
      httpStatus: response.status,
      error: `Supabase returned HTTP ${response.status}: ${errorBody || response.statusText}`,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isAbort = (err as Error)?.name === 'AbortError';
    return {
      connected: false,
      checkedAt: timestamp,
      error: isAbort
        ? 'Connection timed out while reaching Supabase. Please verify project status.'
        : 'Network connection failed. Unable to reach Supabase project.',
    };
  }
}
