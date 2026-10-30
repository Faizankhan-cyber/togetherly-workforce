import { normalizePublicHttpUrl } from '../../server/tinyfishUrl.js';
import { authorizeTinyFishManager } from '../../server/tinyfishAuth.js';

declare const process: {
  env: Record<string, string | undefined>;
};

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

function getHeader(req: ApiRequest, name: string): string {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method not allowed. Use POST.',
    });
  }

  const access = await authorizeTinyFishManager(
    getHeader(req, 'authorization'),
  );

  if ('status' in access) {
    return res.status(access.status).json({ error: access.error });
  }

  const tinyFishKey = process.env.TINYFISH_API_KEY;

  if (!tinyFishKey) {
    return res.status(503).json({
      error: 'TINYFISH_API_KEY is missing from the server function environment.',
    });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    const requested =
      typeof body === 'object' && body !== null && 'urls' in body
        ? (body as { urls?: unknown }).urls
        : undefined;

    if (
      !Array.isArray(requested) ||
      requested.length < 1 ||
      requested.length > 10
    ) {
      return res.status(400).json({
        error: 'Provide between 1 and 10 public HTTP(S) URLs.',
      });
    }

    const safeUrls = requested.map((value: unknown) =>
      normalizePublicHttpUrl(value),
    );

    if (safeUrls.some((url: string | null) => url === null)) {
      return res.status(400).json({
        error: 'One or more URLs are invalid or not allowed. Local, private-network, credential-bearing, and unsupported URLs are not allowed.',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let response: Response;

    try {
      response = await fetch('https://api.fetch.tinyfish.ai', {
        method: 'POST',
        headers: {
          'X-API-Key': tinyFishKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          urls: safeUrls,
          format: 'markdown',
          per_url_timeout_ms: 45000,
          purpose:
            'Extract content relevant to workforce intelligence, hiring demand, technology skills, and evidence-based workforce planning.',
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();

    if (!response.ok) {
      let detail = '';

      try {
        const parsed = JSON.parse(responseText) as {
          message?: string;
          error?: string;
          detail?: string;
        };

        detail = parsed.message || parsed.error || parsed.detail || '';
      } catch {
        detail = responseText;
      }

      const safeDetail = detail.replace(/[\r\n]+/g, ' ').slice(0, 240);

      if (response.status === 401 || response.status === 403) {
        return res.status(502).json({
          error:
            'TinyFish Fetch rejected the API key or access (HTTP ' +
            response.status +
            ')' +
            (safeDetail ? ': ' + safeDetail : '') +
            '. Check TINYFISH_API_KEY in Vercel.',
        });
      }

      if (response.status === 429) {
        return res.status(502).json({
          error: 'TinyFish Fetch rate limit reached. Wait a moment before retrying.',
        });
      }

      return res.status(502).json({
        error:
          'TinyFish Fetch returned HTTP ' +
          response.status +
          (safeDetail ? ': ' + safeDetail : '') +
          '.',
      });
    }

    let data: { results?: unknown[]; errors?: unknown[] };

    try {
      data = JSON.parse(responseText) as {
        results?: unknown[];
        errors?: unknown[];
      };
    } catch {
      return res.status(502).json({
        error:
          'TinyFish Fetch returned a non-JSON response (HTTP ' +
          response.status +
          '): ' +
          responseText.replace(/[\r\n]+/g, ' ').slice(0, 180),
      });
    }

    return res.status(200).json({
      results: Array.isArray(data.results) ? data.results.slice(0, 10) : [],
      errors: Array.isArray(data.errors) ? data.errors.slice(0, 10) : [],
    });
  } catch (error) {
    const err = error as {
      name?: string;
      message?: string;
      cause?: { code?: string; message?: string };
    };

    const name = err?.name || 'UnknownError';
    const causeCode = err?.cause?.code;
    const detail = (
      err?.cause?.message ||
      err?.message ||
      name
    ).replace(/[\r\n]+/g, ' ').slice(0, 220);

    console.error('TinyFish Fetch request failed', {
      name,
      causeCode,
      detail,
    });

    if (name === 'AbortError' || name === 'TimeoutError') {
      return res.status(504).json({
        error: 'TinyFish Fetch timed out after 55 seconds. Try one URL at a time or use a faster page.',
      });
    }

    return res.status(502).json({
      error:
        'TinyFish Fetch network/request error' +
        (causeCode ? ' (' + causeCode + ')' : ' (' + name + ')') +
        ': ' +
        detail,
    });
  }
}