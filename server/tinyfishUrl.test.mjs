
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePublicHttpUrl, isSafePublicHttpUrl } from './tinyfishUrl.js';

test('accepts public HTTP and HTTPS URLs and strips fragments', () => {
  assert.equal(
    normalizePublicHttpUrl('https://example.com/path#section'),
    'https://example.com/path'
  );
  assert.equal(
    normalizePublicHttpUrl('http://example.com'),
    'http://example.com/'
  );
});

test('rejects malformed, non-string, empty, and oversized input', () => {
  assert.equal(normalizePublicHttpUrl(null), null);
  assert.equal(normalizePublicHttpUrl(42), null);
  assert.equal(normalizePublicHttpUrl(''), null);
  assert.equal(normalizePublicHttpUrl('x'.repeat(2049)), null);
  assert.equal(normalizePublicHttpUrl('not a URL'), null);
});

test('rejects credentials, non-HTTP protocols, and non-standard ports', () => {
  for (const value of [
    'https://user:pass@example.com/',
    'ftp://example.com/file',
    'file:///etc/passwd',
    'https://example.com:8443/',
    'http://example.com:8080/',
  ]) {
    assert.equal(normalizePublicHttpUrl(value), null, value);
  }
});

test('rejects local, reserved, and single-label hostnames', () => {
  for (const host of [
    'localhost',
    'foo.localhost',
    'printer.local',
    'service.internal',
    'site.test',
    'site.invalid',
    'site.example',
    'hidden.onion',
    'metadata',
    'metadata.google.internal',
    'intranet',
  ]) {
    assert.equal(normalizePublicHttpUrl(`https://${host}/`), null, host);
  }
});

test('rejects additional reserved and internal hostname suffixes', () => {
  for (const host of [
    'service.localdomain',
    'router.arpa',
    'server.corp',
    'device.home',
    'printer.lan',
    'service.intranet',
    'host.private',
    'device.home.arpa',
  ]) {
    assert.equal(normalizePublicHttpUrl(`https://${host}/`), null, host);
  }
});

test('rejects reserved suffixes regardless of hostname capitalization', () => {
  for (const host of [
    'SERVER.LOCALDOMAIN',
    'ROUTER.ARPA',
    'DEVICE.CORP',
    'PRINTER.LAN',
    'HOST.PRIVATE',
  ]) {
    assert.equal(normalizePublicHttpUrl(`https://${host}/`), null, host);
  }
});

test('normalizes a trailing dot before checking reserved hostnames', () => {
  for (const host of [
    'localhost.',
    'service.local.',
    'service.internal.',
    'server.corp.',
    'device.home.',
    'printer.lan.',
    'host.private.',
    'device.home.arpa.',
  ]) {
    assert.equal(normalizePublicHttpUrl(`https://${host}/`), null, host);
  }
});

test('accepts public hostnames with similar but non-reserved suffixes', () => {
  for (const host of [
    'my-localdomain.com',
    'corporate.example.com',
    'lantern.example.com',
    'private-example.com',
  ]) {
    assert.notEqual(normalizePublicHttpUrl(`https://${host}/`), null, host);
  }
});

test('rejects IP literals and alternate IPv4 representations', () => {
  for (const host of [
    '127.0.0.1',
    '10.0.0.5',
    '192.168.1.1',
    '169.254.169.254',
    '[::1]',
    '[fe80::1]',
    '2130706433',
    '0x7f000001',
    '0177.0.0.1',
  ]) {
    assert.equal(normalizePublicHttpUrl(`http://${host}/`), null, host);
  }
});

test('boolean helper agrees with normalized URL result', () => {
  assert.equal(isSafePublicHttpUrl('https://example.com'), true);
  assert.equal(isSafePublicHttpUrl('http://127.0.0.1'), false);

  for (const host of [
    'service.localdomain',
    'router.arpa',
    'server.corp',
    'device.home',
    'printer.lan',
    'service.intranet',
    'host.private',
    'device.home.arpa',
  ]) {
    assert.equal(isSafePublicHttpUrl(`https://${host}/`), false, host);
  }
});
