import { describe, expect, it } from 'vitest';
import { HandleCors } from './cors';
import { Request } from './request';
import { Response } from './response';
import type { NextFunction } from './types';

function makeRequest(method: string, origin?: string): Request {
  return new Request({
    method,
    path: '/test',
    headers: origin ? { origin } : {},
  });
}

const passthrough: NextFunction = () => Promise.resolve(Response.json({ ok: true }));

describe('HandleCors', () => {
  it('adds Access-Control-Allow-Origin: * by default', async () => {
    const cors = new HandleCors();
    const req = makeRequest('GET', 'https://example.com');
    const res = await cors.handle(req, passthrough);
    expect(res.getHeaders()['access-control-allow-origin']).toBe('*');
  });

  it('reflects specific allowed origin when configured', async () => {
    const cors = new HandleCors({ origin: 'https://example.com' });
    const req = makeRequest('GET', 'https://example.com');
    const res = await cors.handle(req, passthrough);
    expect(res.getHeaders()['access-control-allow-origin']).toBe('https://example.com');
  });

  it('does not add CORS headers when origin does not match whitelist', async () => {
    const cors = new HandleCors({ origin: ['https://allowed.com'] });
    const req = makeRequest('GET', 'https://other.com');
    const res = await cors.handle(req, passthrough);
    expect(res.getHeaders()['access-control-allow-origin']).toBeUndefined();
  });

  it('returns 204 for preflight OPTIONS request', async () => {
    const cors = new HandleCors();
    const req = makeRequest('OPTIONS', 'https://example.com');
    const res = await cors.handle(req, passthrough);
    expect(res.getStatus()).toBe(204);
    expect(res.getHeaders()['access-control-allow-origin']).toBe('*');
  });

  it('adds credentials header when credentials option is true', async () => {
    const cors = new HandleCors({ origin: 'https://example.com', credentials: true });
    const req = makeRequest('GET', 'https://example.com');
    const res = await cors.handle(req, passthrough);
    expect(res.getHeaders()['access-control-allow-credentials']).toBe('true');
  });

  it('adds Vary: Origin when a specific origin is matched', async () => {
    const cors = new HandleCors({ origin: ['https://example.com'] });
    const req = makeRequest('GET', 'https://example.com');
    const res = await cors.handle(req, passthrough);
    expect(res.getHeaders()['vary']).toBe('Origin');
  });

  it('adds max-age header when maxAge is set', async () => {
    const cors = new HandleCors({ maxAge: 3600 });
    const req = makeRequest('OPTIONS', 'https://example.com');
    const res = await cors.handle(req, passthrough);
    expect(res.getHeaders()['access-control-max-age']).toBe('3600');
  });

  it('supports function-based origin resolver', async () => {
    const cors = new HandleCors({ origin: (o) => o.endsWith('.example.com') });
    const req = makeRequest('GET', 'https://sub.example.com');
    const res = await cors.handle(req, passthrough);
    expect(res.getHeaders()['access-control-allow-origin']).toBe('https://sub.example.com');
  });

  it('adds exposed headers when configured', async () => {
    const cors = new HandleCors({ exposedHeaders: ['X-Total-Count'] });
    const req = makeRequest('GET', 'https://example.com');
    const res = await cors.handle(req, passthrough);
    expect(res.getHeaders()['access-control-expose-headers']).toBe('X-Total-Count');
  });
});
