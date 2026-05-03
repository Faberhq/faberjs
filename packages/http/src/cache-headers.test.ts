import { describe, expect, it } from 'vitest';
import { CacheHeaders } from './cache-headers';
import { Response } from './response';
import { Request } from './request';

function makeRequest(): Request {
  return new Request({
    method: 'GET',
    path: '/',
    url: '/',
    headers: {},
    body: {},
    query: {},
    params: {},
    ip: '127.0.0.1',
  });
}

async function run(middleware: CacheHeaders, downstream: Response): Promise<Response> {
  return middleware.handle(makeRequest(), async () => downstream);
}

describe('CacheHeaders', () => {
  it('sets a single Cache-Control directive', async () => {
    const mw = new CacheHeaders('public');
    const res = await run(mw, Response.html('ok'));
    expect(res.getHeaders()['cache-control']).toBe('public');
  });

  it('sets multiple directives from semicolon-separated string', async () => {
    const mw = new CacheHeaders('public;max_age=3600;s_maxage=300');
    const res = await run(mw, Response.html('ok'));
    const cc = res.getHeaders()['cache-control'] as string;
    expect(cc).toContain('public');
    expect(cc).toContain('max-age=3600');
    expect(cc).toContain('s-maxage=300');
  });

  it('converts snake_case keys to kebab-case', async () => {
    const mw = new CacheHeaders('stale_while_revalidate=600');
    const res = await run(mw, Response.html('body'));
    expect(res.getHeaders()['cache-control']).toBe('stale-while-revalidate=600');
  });

  it('generates an ETag MD5 hash from string body when etag is present', async () => {
    const mw = new CacheHeaders('public;etag');
    const res = await run(mw, Response.html('hello world'));
    const etag = res.getHeaders()['etag'] as string;
    expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
  });

  it('does not add ETag when body is not a string', async () => {
    const mw = new CacheHeaders('public;etag');
    const res = await run(mw, Response.json({ ok: true }));
    // JSON body is an object — no ETag generated
    expect(res.getHeaders()['etag']).toBeUndefined();
  });

  it('omits Cache-Control when no directives are provided', async () => {
    const mw = new CacheHeaders('');
    const res = await run(mw, Response.html('ok'));
    expect(res.getHeaders()['cache-control']).toBeUndefined();
  });

  it('passes the response through unchanged when only etag is specified and body is non-string', async () => {
    const mw = new CacheHeaders('etag');
    const original = Response.noContent();
    const res = await run(mw, original);
    expect(res.getStatus()).toBe(204);
  });
});
