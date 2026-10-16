import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Detailed configuration inspection status for Supabase integration.
 */
export interface SupabaseConfigStatus {
  /** True only when both URL and anon key are present, validly formatted, and sanitized */
  isConfigured: boolean;
  /** True when environment variables are supplied and not failing validation */
  isValid: boolean;
  /** The sanitized project root URL (e.g. https://<project-ref>.supabase.co) */
  sanitizedUrl: string | null;
  /** Whether VITE_SUPABASE_URL is defined */
  hasUrl: boolean;
  /** Whether VITE_SUPABASE_ANON_KEY is defined */
  hasAnonKey: boolean;
  /** Descriptive error message if configuration is malformed, missing, or invalid */
  configError: string | null;
  /** Non-fatal diagnostic warning or normalization note */
  warning?: string | null;
}

/**
 * Safely retrieves an environment variable across both Vite client (import.meta.env)
 * and server/test/Node environments (process.env) without throwing if undefined.
 */
const getEnv = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (import.meta.env as Record<string, string | undefined>)[key];
    }
  } catch {
    // Ignore and fallback to process.env
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

/**
 * Normalizes, validates, and sanitizes a Supabase project URL.
 *
 * Common misconfigurations handled:
 * 1. Accidental quotes around string: e.g. "https://..." or 'https://...'
 * 2. Extraneous path segments like /rest/v1 or /auth/v1 copied from docs or API settings
 * 3. Trailing slashes
 * 4. Supabase dashboard URLs mistakenly passed instead of API URLs
 * 5. Template placeholders (e.g. your-project.supabase.co)
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
      warning = `Stripped path segment "${parsed.pathname}" from VITE_SUPABASE_URL. Using base origin.`;
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
 * Validates and sanitizes a Supabase anon/publishable API key.
 *
 * Never exposes or logs the secret key.
 */
export function sanitizeSupabaseKey(rawKey?: string): {
  key: string | null;
  error: string | null;
} {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    return {
      key: null,
      error: 'VITE_SUPABASE_ANON_KEY environment variable is missing.',
    };
  }

  // Strip leading/trailing quotes and whitespace
  const trimmed = rawKey.trim().replace(/^['"]+|['"]+$/g, '').trim();

  // Guard against template placeholders
  if (
    trimmed.includes('your-anon-key') ||
    trimmed.includes('placeholder') ||
    trimmed === 'your-key-here'
  ) {
    return {
      key: null,
      error: 'VITE_SUPABASE_ANON_KEY contains an unreplaced template placeholder.',
    };
  }

  // Guard against service-role secret key exposure
  if (trimmed.startsWith('sb_secret_')) {
    return {
      key: null,
      error:
        'VITE_SUPABASE_ANON_KEY appears to be a private service-role secret key. Never expose service-role secrets in client applications.',
    };
  }

  // Minimum sanity length check
  if (trimmed.length < 20) {
    return {
      key: null,
      error: 'VITE_SUPABASE_ANON_KEY is too short to be a valid Supabase API key.',
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
  const rawUrl = getEnv('VITE_SUPABASE_URL');
  const rawKey = getEnv('VITE_SUPABASE_ANON_KEY');

  const hasUrl = Boolean(rawUrl && rawUrl.trim());
  const hasAnonKey = Boolean(rawKey && rawKey.trim());

  if (!hasUrl && !hasAnonKey) {
    return {
      isConfigured: false,
      isValid: false,
      sanitizedUrl: null,
      hasUrl: false,
      hasAnonKey: false,
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
    hasAnonKey,
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

/**
 * Shared Supabase client instance.
 *
 * Initialized with sanitized origin URL and clean API key.
 * If credentials are missing or invalid, value is `null`, enabling demo mode fallback.
 */
export const supabase: SupabaseClient | null =
  configStatus.isConfigured && configStatus.sanitizedUrl
    ? createClient(configStatus.sanitizedUrl, sanitizeSupabaseKey(getEnv('VITE_SUPABASE_ANON_KEY')).key!, {
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
        'Supabase is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment.'
    );
  }
  return supabase;
};
