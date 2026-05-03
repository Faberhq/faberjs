import { describe, it, expect } from 'vitest';
import { Request, Response } from '@faber-js/http';
import { StartSession, session } from './start-session';
import { MemorySessionDriver } from './memory-driver';

function makeRequest(cookieHeader?: string): Request {
  return new Request({
    method: 'GET',
    path: '/test',
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe('StartSession', () => {
  it('should attach a session to the request', async () => {
    const driver = new MemorySessionDriver();
    const middleware = new StartSession(driver);
    const request = makeRequest();

    let capturedSession: unknown;
    await middleware.handle(request, async (req) => {
      capturedSession = session(req);
      return Response.json({ ok: true });
    });

    expect(capturedSession).toBeDefined();
  });

  it('should set Set-Cookie header on the response', async () => {
    const driver = new MemorySessionDriver();
    const middleware = new StartSession(driver, { name: 'app_session' });
    const request = makeRequest();

    const response = await middleware.handle(request, async () => Response.json({}));

    const cookies = response.getHeaders()['set-cookie'];
    const hasCookie = Array.isArray(cookies)
      ? cookies.some((c) => c.includes('app_session='))
      : (cookies ?? '').includes('app_session=');
    expect(hasCookie).toBe(true);
  });

  it('should restore existing session from cookie', async () => {
    const driver = new MemorySessionDriver();
    const name = 'faber_session';
    const middleware = new StartSession(driver, { name });

    const req1 = makeRequest();
    let sessionId = '';
    await middleware.handle(req1, async (req) => {
      const s = session(req);
      s.put('logged_in', true);
      sessionId = s.getId();
      return Response.json({});
    });

    const req2 = makeRequest(`${name}=${sessionId}`);
    await middleware.handle(req2, async (req) => {
      const s = session(req);
      expect(s.get('logged_in')).toBe(true);
      return Response.json({});
    });
  });

  it('should throw when accessing session without middleware', () => {
    const request = makeRequest();
    expect(() => session(request)).toThrow('No session found on request');
  });
});
