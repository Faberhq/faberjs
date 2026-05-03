import { describe, expect, it, vi } from 'vitest';
import { Request } from './request';
import { TrustHosts } from './trust-hosts';
import { Response } from './response';

function makeRequest(host: string): Request {
  return new Request({
    method: 'GET',
    path: '/',
    headers: { host },
  });
}

const ok = Response.json({ ok: true });
const noop = vi.fn().mockResolvedValue(ok);

// ── Basic host matching ────────────────────────────────────────────────────────

describe('TrustHosts — exact host', () => {
  it('passes through a request with a matching host', async () => {
    const mw = new TrustHosts({ patterns: ['^example\\.com$'], subdomains: false });
    const res = await mw.handle(makeRequest('example.com'), noop);
    expect(res.getStatus()).toBe(200);
  });

  it('rejects a request with a non-matching host', async () => {
    const mw = new TrustHosts({ patterns: ['^example\\.com$'], subdomains: false });
    const res = await mw.handle(makeRequest('evil.com'), noop);
    expect(res.getStatus()).toBe(403);
  });

  it('matching is case-insensitive', async () => {
    const mw = new TrustHosts({ patterns: ['^example\\.com$'], subdomains: false });
    const res = await mw.handle(makeRequest('EXAMPLE.COM'), noop);
    expect(res.getStatus()).toBe(200);
  });

  it('strips port from the Host header before matching', async () => {
    // request.host() strips the port already
    const mw = new TrustHosts({ patterns: ['^example\\.com$'], subdomains: false });
    const res = await mw.handle(makeRequest('example.com:8080'), noop);
    expect(res.getStatus()).toBe(200);
  });
});

// ── Multiple patterns ────────────────────────────────────────────────────────

describe('TrustHosts — multiple patterns', () => {
  it('passes if any pattern matches', async () => {
    const mw = new TrustHosts({
      patterns: ['^app\\.example\\.com$', '^api\\.example\\.com$'],
      subdomains: false,
    });
    expect((await mw.handle(makeRequest('app.example.com'), noop)).getStatus()).toBe(200);
    expect((await mw.handle(makeRequest('api.example.com'), noop)).getStatus()).toBe(200);
    expect((await mw.handle(makeRequest('evil.com'), noop)).getStatus()).toBe(403);
  });
});

// ── Subdomain auto-trust ─────────────────────────────────────────────────────

describe('TrustHosts — subdomain auto-trust (default)', () => {
  it('trusts the exact host', async () => {
    const mw = new TrustHosts({ patterns: ['^example\\.com$'] });
    expect((await mw.handle(makeRequest('example.com'), noop)).getStatus()).toBe(200);
  });

  it('trusts a direct subdomain', async () => {
    const mw = new TrustHosts({ patterns: ['^example\\.com$'] });
    expect((await mw.handle(makeRequest('api.example.com'), noop)).getStatus()).toBe(200);
  });

  it('trusts a deeper subdomain', async () => {
    const mw = new TrustHosts({ patterns: ['^example\\.com$'] });
    expect((await mw.handle(makeRequest('v2.api.example.com'), noop)).getStatus()).toBe(200);
  });

  it('rejects an unrelated host', async () => {
    const mw = new TrustHosts({ patterns: ['^example\\.com$'] });
    expect((await mw.handle(makeRequest('evil.com'), noop)).getStatus()).toBe(403);
  });

  it('rejects a host that looks like a subdomain but uses a different base', async () => {
    const mw = new TrustHosts({ patterns: ['^example\\.com$'] });
    expect((await mw.handle(makeRequest('notexample.com'), noop)).getStatus()).toBe(403);
  });
});

describe('TrustHosts — subdomains: false', () => {
  it('rejects subdomain even when base matches when subdomains is false', async () => {
    const mw = new TrustHosts({ patterns: ['^example\\.com$'], subdomains: false });
    expect((await mw.handle(makeRequest('api.example.com'), noop)).getStatus()).toBe(403);
  });
});

// ── Closure resolver ─────────────────────────────────────────────────────────

describe('TrustHosts — closure patterns', () => {
  it('calls the closure at request time', async () => {
    let callCount = 0;
    const resolver = (): string[] => {
      callCount++;
      return ['^dynamic\\.example\\.com$'];
    };
    const mw = new TrustHosts({ patterns: resolver, subdomains: false });
    await mw.handle(makeRequest('dynamic.example.com'), noop);
    expect(callCount).toBe(1);
  });

  it('uses the closure return value for matching', async () => {
    const mw = new TrustHosts({ patterns: () => ['^allowed\\.com$'], subdomains: false });
    expect((await mw.handle(makeRequest('allowed.com'), noop)).getStatus()).toBe(200);
    expect((await mw.handle(makeRequest('blocked.com'), noop)).getStatus()).toBe(403);
  });
});

// ── Pipeline ─────────────────────────────────────────────────────────────────

describe('TrustHosts — pipeline', () => {
  it('calls next for trusted hosts and returns its response', async () => {
    const expected = Response.json({ ok: true });
    const next = vi.fn().mockResolvedValue(expected);
    const mw = new TrustHosts({ patterns: ['^example\\.com$'], subdomains: false });
    const res = await mw.handle(makeRequest('example.com'), next);
    expect(next).toHaveBeenCalled();
    expect(res).toBe(expected);
  });

  it('does not call next for rejected hosts', async () => {
    const next = vi.fn().mockResolvedValue(ok);
    const mw = new TrustHosts({ patterns: ['^example\\.com$'], subdomains: false });
    await mw.handle(makeRequest('evil.com'), next);
    expect(next).not.toHaveBeenCalled();
  });
});
