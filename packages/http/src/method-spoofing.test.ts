import { describe, expect, it } from 'vitest';
import { MethodSpoofing } from './method-spoofing';
import { Request } from './request';
import { Response } from './response';
import type { NextFunction } from './types';

describe('MethodSpoofing', () => {
  const middleware = new MethodSpoofing();

  it('overrides method when _method=PUT on a POST request', async () => {
    let seenMethod = '';
    const next: NextFunction = (req) => {
      seenMethod = req.method();
      return Promise.resolve(Response.json({ ok: true }));
    };
    const req = new Request({ method: 'POST', path: '/test', body: { _method: 'PUT' } });
    await middleware.handle(req, next);
    expect(seenMethod).toBe('PUT');
  });

  it('overrides method when _method=DELETE on a POST request', async () => {
    let seenMethod = '';
    const next: NextFunction = (req) => {
      seenMethod = req.method();
      return Promise.resolve(Response.json({ ok: true }));
    };
    const req = new Request({ method: 'POST', path: '/test', body: { _method: 'delete' } });
    await middleware.handle(req, next);
    expect(seenMethod).toBe('DELETE');
  });

  it('does not override method when request is not POST', async () => {
    let seenMethod = '';
    const next: NextFunction = (req) => {
      seenMethod = req.method();
      return Promise.resolve(Response.json({ ok: true }));
    };
    const req = new Request({ method: 'GET', path: '/test', body: { _method: 'DELETE' } });
    await middleware.handle(req, next);
    expect(seenMethod).toBe('GET');
  });

  it('does not override for unsupported method values', async () => {
    let seenMethod = '';
    const next: NextFunction = (req) => {
      seenMethod = req.method();
      return Promise.resolve(Response.json({ ok: true }));
    };
    const req = new Request({ method: 'POST', path: '/test', body: { _method: 'GET' } });
    await middleware.handle(req, next);
    expect(seenMethod).toBe('POST');
  });

  it('realMethod() returns the original method even after spoofing', async () => {
    let realMethod = '';
    let spoofedMethod = '';
    const next: NextFunction = (req) => {
      realMethod = (req as Request).realMethod();
      spoofedMethod = req.method();
      return Promise.resolve(Response.json({ ok: true }));
    };
    const req = new Request({ method: 'POST', path: '/test', body: { _method: 'PATCH' } });
    await middleware.handle(req, next);
    expect(realMethod).toBe('POST');
    expect(spoofedMethod).toBe('PATCH');
  });
});
