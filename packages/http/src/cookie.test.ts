import { describe, expect, it } from 'vitest';
import { Cookie, runWithCookieQueue, serializeCookieHeader } from './cookie';
import { Request } from './request';

function makeRequest(cookieHeader?: string): Request {
  return new Request({
    method: 'GET',
    path: '/',
    url: '/',
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    body: {},
    query: {},
    params: {},
    ip: '127.0.0.1',
  });
}

describe('serializeCookieHeader()', () => {
  it('serialises a basic cookie with Max-Age', () => {
    const result = serializeCookieHeader('session', 'abc123', 60);
    expect(result).toContain('session=abc123');
    expect(result).toContain('Max-Age=3600');
    expect(result).toContain('Path=/');
    expect(result).toContain('HttpOnly');
  });

  it('sets Max-Age=0 and epoch Expires for expiry (minutes=0)', () => {
    const result = serializeCookieHeader('old', 'val', 0);
    expect(result).toContain('Max-Age=0');
    expect(result).toContain('1970');
  });

  it('omits Max-Age when minutes is negative', () => {
    const result = serializeCookieHeader('tmp', 'v', -1);
    expect(result).not.toContain('Max-Age');
    expect(result).not.toContain('Expires');
  });

  it('includes Secure when requested', () => {
    const result = serializeCookieHeader('s', 'v', 10, { secure: true });
    expect(result).toContain('Secure');
  });

  it('excludes HttpOnly when explicitly false', () => {
    const result = serializeCookieHeader('s', 'v', 10, { httpOnly: false });
    expect(result).not.toContain('HttpOnly');
  });

  it('includes SameSite directive', () => {
    const result = serializeCookieHeader('s', 'v', 10, { sameSite: 'Strict' });
    expect(result).toContain('SameSite=Strict');
  });

  it('URL-encodes name and value', () => {
    const result = serializeCookieHeader('my cookie', 'hello world', 10);
    expect(result).toContain('my%20cookie=hello%20world');
  });
});

describe('Cookie.make()', () => {
  it('returns a serialised cookie string', () => {
    const str = Cookie.make('token', 'xyz', 30);
    expect(str).toContain('token=xyz');
    expect(str).toContain('Max-Age=1800');
  });
});

describe('Cookie.queue() / Cookie.getQueued()', () => {
  it('queues cookies within a runWithCookieQueue context', async () => {
    await runWithCookieQueue(async () => {
      Cookie.queue('a', '1', 60);
      Cookie.queue('b', '2', 60);
      const queued = Cookie.getQueued();
      expect(queued).toHaveLength(2);
      expect(queued[0]).toContain('a=1');
      expect(queued[1]).toContain('b=2');
    });
  });

  it('does nothing outside a runWithCookieQueue context', () => {
    // Should not throw
    Cookie.queue('orphan', 'val', 10);
    expect(Cookie.getQueued()).toEqual([]);
  });

  it('isolates queues across concurrent requests', async () => {
    const results: string[][] = await Promise.all([
      runWithCookieQueue(async () => {
        Cookie.queue('req1', 'a', 10);
        await new Promise((r) => setTimeout(r, 5));
        return [...Cookie.getQueued()];
      }),
      runWithCookieQueue(async () => {
        Cookie.queue('req2', 'b', 10);
        return [...Cookie.getQueued()];
      }),
    ]);
    expect(results[0]).toHaveLength(1);
    expect(results[0][0]).toContain('req1');
    expect(results[1]).toHaveLength(1);
    expect(results[1][0]).toContain('req2');
  });
});

describe('Cookie.expire()', () => {
  it('queues an expired cookie', async () => {
    await runWithCookieQueue(async () => {
      Cookie.expire('session');
      const queued = Cookie.getQueued();
      expect(queued).toHaveLength(1);
      expect(queued[0]).toContain('Max-Age=0');
    });
  });
});

describe('Cookie.get()', () => {
  it('returns the named cookie value from the request', () => {
    const req = makeRequest('session=abc; pref=dark');
    expect(Cookie.get(req, 'session')).toBe('abc');
    expect(Cookie.get(req, 'pref')).toBe('dark');
  });

  it('returns undefined when cookie is not present', () => {
    const req = makeRequest('a=1');
    expect(Cookie.get(req, 'missing')).toBeUndefined();
  });

  it('returns undefined when no Cookie header exists', () => {
    const req = makeRequest();
    expect(Cookie.get(req, 'any')).toBeUndefined();
  });

  it('URL-decodes cookie values', () => {
    const req = makeRequest('msg=hello%20world');
    expect(Cookie.get(req, 'msg')).toBe('hello world');
  });
});
