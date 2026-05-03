import { describe, expect, it, vi } from 'vitest';
import { Request } from './request';
import {
  TrustProxies,
  HEADER_X_FORWARDED_FOR,
  HEADER_X_FORWARDED_PROTO,
  HEADER_X_FORWARDED_HOST,
  HEADER_X_FORWARDED_PORT,
  HEADER_FORWARDED,
} from './trust-proxies';
import { Response } from './response';

function makeRequest(overrides: Partial<ConstructorParameters<typeof Request>[0]> = {}): Request {
  return new Request({ method: 'GET', path: '/test', ip: '10.0.0.1', ...overrides });
}

const noop = (): Promise<Response> => Promise.resolve(Response.json(null));

// ── Constants ─────────────────────────────────────────────────────────────────

describe('header constants', () => {
  it('are the expected lowercase strings', () => {
    expect(HEADER_X_FORWARDED_FOR).toBe('x-forwarded-for');
    expect(HEADER_X_FORWARDED_PROTO).toBe('x-forwarded-proto');
    expect(HEADER_X_FORWARDED_HOST).toBe('x-forwarded-host');
    expect(HEADER_X_FORWARDED_PORT).toBe('x-forwarded-port');
    expect(HEADER_FORWARDED).toBe('forwarded');
  });
});

// ── Untrusted proxy ───────────────────────────────────────────────────────────

describe('TrustProxies — untrusted direct IP', () => {
  it('does not rewrite ip() when the direct IP is not trusted', async () => {
    const req = makeRequest({
      ip: '1.2.3.4',
      headers: { 'x-forwarded-for': '203.0.113.1' },
    });
    await new TrustProxies({ proxies: ['10.0.0.1'] }).handle(req, noop);
    expect(req.ip()).toBe('1.2.3.4');
  });

  it('does not rewrite scheme when the direct IP is not trusted', async () => {
    const req = makeRequest({
      ip: '1.2.3.4',
      scheme: 'http',
      headers: { 'x-forwarded-proto': 'https' },
    });
    await new TrustProxies({ proxies: ['10.0.0.1'] }).handle(req, noop);
    expect(req.schemeAndHttpHost()).toMatch(/^http:\/\//);
  });
});

// ── Exact IP trust ────────────────────────────────────────────────────────────

describe('TrustProxies — exact IP match', () => {
  it('resolves the real client IP from X-Forwarded-For', async () => {
    const req = makeRequest({
      ip: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.5' },
    });
    await new TrustProxies({ proxies: ['10.0.0.1'] }).handle(req, noop);
    expect(req.ip()).toBe('203.0.113.5');
  });

  it('skips trusted proxies in the chain and picks the first untrusted IP', async () => {
    // chain: real-client → proxy-a (trusted) → proxy-b (direct, trusted)
    const req = makeRequest({
      ip: '10.0.0.2',
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    await new TrustProxies({ proxies: ['10.0.0.1', '10.0.0.2'] }).handle(req, noop);
    expect(req.ip()).toBe('203.0.113.5');
  });

  it('falls back to leftmost IP when all entries in XFF are trusted', async () => {
    const req = makeRequest({
      ip: '10.0.0.2',
      headers: { 'x-forwarded-for': '10.0.0.3' },
    });
    await new TrustProxies({ proxies: ['10.0.0.2', '10.0.0.3'] }).handle(req, noop);
    expect(req.ip()).toBe('10.0.0.3');
  });

  it('does not rewrite ip() when X-Forwarded-For is absent', async () => {
    const req = makeRequest({ ip: '10.0.0.1' });
    await new TrustProxies({ proxies: ['10.0.0.1'] }).handle(req, noop);
    expect(req.ip()).toBe('10.0.0.1');
  });
});

// ── CIDR trust ────────────────────────────────────────────────────────────────

describe('TrustProxies — CIDR ranges', () => {
  it('trusts an IP inside a /24 range', async () => {
    const req = makeRequest({
      ip: '10.0.0.99',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    await new TrustProxies({ proxies: ['10.0.0.0/24'] }).handle(req, noop);
    expect(req.ip()).toBe('203.0.113.7');
  });

  it('does not trust an IP outside the CIDR range', async () => {
    const req = makeRequest({
      ip: '10.0.1.1',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    await new TrustProxies({ proxies: ['10.0.0.0/24'] }).handle(req, noop);
    expect(req.ip()).toBe('10.0.1.1');
  });

  it('handles a /8 range', async () => {
    const req = makeRequest({
      ip: '10.200.50.1',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    await new TrustProxies({ proxies: ['10.0.0.0/8'] }).handle(req, noop);
    expect(req.ip()).toBe('203.0.113.9');
  });

  it('handles /32 (single host CIDR)', async () => {
    const req = makeRequest({
      ip: '192.168.1.5',
      headers: { 'x-forwarded-for': '203.0.113.1' },
    });
    await new TrustProxies({ proxies: ['192.168.1.5/32'] }).handle(req, noop);
    expect(req.ip()).toBe('203.0.113.1');
  });
});

// ── Wildcard trust ────────────────────────────────────────────────────────────

describe('TrustProxies — wildcard (*)', () => {
  it('trusts any direct IP when proxies is "*"', async () => {
    const req = makeRequest({
      ip: '1.2.3.4',
      headers: { 'x-forwarded-for': '203.0.113.42' },
    });
    await new TrustProxies({ proxies: '*' }).handle(req, noop);
    expect(req.ip()).toBe('203.0.113.42');
  });
});

// ── Scheme rewrite ────────────────────────────────────────────────────────────

describe('TrustProxies — X-Forwarded-Proto', () => {
  it('sets scheme to https when header says https', async () => {
    const req = makeRequest({
      ip: '10.0.0.1',
      scheme: 'http',
      headers: { host: 'example.com', 'x-forwarded-proto': 'https' },
    });
    await new TrustProxies({ proxies: ['10.0.0.1'] }).handle(req, noop);
    expect(req.schemeAndHttpHost()).toBe('https://example.com');
  });

  it('keeps scheme as http when header says http', async () => {
    const req = makeRequest({
      ip: '10.0.0.1',
      scheme: 'https',
      headers: { host: 'example.com', 'x-forwarded-proto': 'http' },
    });
    await new TrustProxies({ proxies: ['10.0.0.1'] }).handle(req, noop);
    expect(req.schemeAndHttpHost()).toBe('http://example.com');
  });

  it('ignores invalid proto values', async () => {
    const req = makeRequest({
      ip: '10.0.0.1',
      scheme: 'http',
      headers: { 'x-forwarded-proto': 'ftp' },
    });
    await new TrustProxies({ proxies: ['10.0.0.1'] }).handle(req, noop);
    expect(req.schemeAndHttpHost()).toMatch(/^http:\/\//);
  });
});

// ── Header selection ──────────────────────────────────────────────────────────

describe('TrustProxies — header selection', () => {
  it('does not rewrite IP when HEADER_X_FORWARDED_FOR is excluded', async () => {
    const req = makeRequest({
      ip: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.1', 'x-forwarded-proto': 'https' },
    });
    await new TrustProxies({
      proxies: ['10.0.0.1'],
      headers: [HEADER_X_FORWARDED_PROTO],
    }).handle(req, noop);
    expect(req.ip()).toBe('10.0.0.1');
    expect(req.schemeAndHttpHost()).toMatch(/^https:/);
  });

  it('does not rewrite scheme when HEADER_X_FORWARDED_PROTO is excluded', async () => {
    const req = makeRequest({
      ip: '10.0.0.1',
      scheme: 'http',
      headers: { 'x-forwarded-for': '203.0.113.1', 'x-forwarded-proto': 'https' },
    });
    await new TrustProxies({
      proxies: ['10.0.0.1'],
      headers: [HEADER_X_FORWARDED_FOR],
    }).handle(req, noop);
    expect(req.ip()).toBe('203.0.113.1');
    expect(req.schemeAndHttpHost()).toMatch(/^http:/);
  });
});

// ── Pipeline ──────────────────────────────────────────────────────────────────

describe('TrustProxies — pipeline', () => {
  it('calls next and returns its response', async () => {
    const req = makeRequest({ ip: '10.0.0.1' });
    const expected = Response.json({ ok: true });
    const next = vi.fn().mockResolvedValue(expected);
    const result = await new TrustProxies({ proxies: ['10.0.0.1'] }).handle(req, next);
    expect(next).toHaveBeenCalledWith(req);
    expect(result).toBe(expected);
  });
});
