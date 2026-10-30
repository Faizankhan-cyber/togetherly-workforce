import { isIP } from 'node:net';

const MAX_URL_LENGTH = 2048;

const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.test',
  '.invalid',
  '.example',
  '.onion',
  '.localdomain',
  '.arpa',
  '.corp',
  '.home',
  '.lan',
  '.intranet',
  '.private',
  '.home.arpa',
];

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
]);

/**
 * Validates and normalizes a URL for use with TinyFish.
 * Returns the normalized URL when accepted, otherwise null.
 *
 * This is defense-in-depth, not a complete SSRF prevention mechanism.
 */
export function normalizePublicHttpUrl(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_URL_LENGTH
  ) {
    return null;
  }

  try {
    const url = new URL(value);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    if (url.username || url.password || url.port) {
      return null;
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

    if (
      !hostname ||
      BLOCKED_HOSTS.has(hostname) ||
      BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
      return null;
    }

    // Reject IP literals, including loopback and private IP addresses.
    if (isIP(hostname) !== 0 || !hostname.includes('.')) {
      return null;
    }

    url.hostname = hostname;
    url.hash = '';

    return url.toString();
  } catch {
    return null;
  }
}

export function isSafePublicHttpUrl(value) {
  return normalizePublicHttpUrl(value) !== null;
}