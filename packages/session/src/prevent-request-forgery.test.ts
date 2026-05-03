import { describe, it, expect } from 'vitest';
import { Request, Response } from '@faber-js/http';
import { PreventRequestForgery } from './prevent-request-forgery';
import { StartSession, session } from './start-session';
import { MemorySessionDriver } from './memory-driver';

function makeRequest(overrides: {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  cookie?: string;
}): Request {
  const { method = 'GET', path = '/', headers = {}, body = {}, cookie } = overrides;
  return new Request({
    method,
    path,
    headers: cookie ? { ...headers, cookie } : headers,
    body,
  });
}

describe('PreventRequestForgery', () => {
  describe('safe methods', () => {
    it('should allow GET requests without any token', async () => {
      const csrf = new PreventRequestForgery();
      const request = makeRequest({ method: 'GET' });
      const driver = new MemorySessionDriver();
      const sm = new StartSession(driver);

      let called = false;
      await sm.handle(request, async (req) => {
        await csrf.handle(req, async () => {
          called = true;
          return Response.json({});
        });
        return Response.json({});
      });

      expect(called).toBe(true);
    });

    it('should allow HEAD requests without token', async () => {
      const csrf = new PreventRequestForgery();
      const driver = new MemorySessionDriver();
      const sm = new StartSession(driver);
      const request = makeRequest({ method: 'HEAD' });

      let called = false;
      await sm.handle(request, async (req) => {
        await csrf.handle(req, async () => {
          called = true;
          return Response.json({});
        });
        return Response.json({});
      });

      expect(called).toBe(true);
    });
  });

  describe('POST without token', () => {
    it('should return 419 when no token is present', async () => {
      const csrf = new PreventRequestForgery();
      const driver = new MemorySessionDriver();
      const sm = new StartSession(driver);
      const request = makeRequest({ method: 'POST' });

      let status = 0;
      await sm.handle(request, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(419);
    });
  });

  describe('POST with valid _token body field', () => {
    it('should allow the request', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery();
      const sm = new StartSession(driver);

      // First: get a session token
      const req1 = makeRequest({ method: 'GET' });
      let sessionId = '';
      let csrfToken = '';
      await sm.handle(req1, async (req) => {
        sessionId = session(req).getId();
        csrfToken = session(req).token();
        return Response.json({});
      });

      // Second: POST with _token
      const req2 = makeRequest({
        method: 'POST',
        body: { _token: csrfToken },
        cookie: `faber_session=${sessionId}`,
      });

      let status = 0;
      await sm.handle(req2, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(200);
    });
  });

  describe('POST with X-CSRF-TOKEN header', () => {
    it('should allow the request', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery();
      const sm = new StartSession(driver);

      const req1 = makeRequest({ method: 'GET' });
      let sessionId = '';
      let csrfToken = '';
      await sm.handle(req1, async (req) => {
        sessionId = session(req).getId();
        csrfToken = session(req).token();
        return Response.json({});
      });

      const req2 = makeRequest({
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        cookie: `faber_session=${sessionId}`,
      });

      let status = 0;
      await sm.handle(req2, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(200);
    });
  });

  describe('Sec-Fetch-Site: same-origin', () => {
    it('should allow without token check', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery();
      const sm = new StartSession(driver);

      const request = makeRequest({
        method: 'POST',
        headers: { 'sec-fetch-site': 'same-origin' },
      });

      let status = 0;
      await sm.handle(request, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(200);
    });
  });

  describe('same-site allowance', () => {
    it('should block same-site without allowSameSite option', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery({ allowSameSite: false });
      const sm = new StartSession(driver);

      const request = makeRequest({
        method: 'POST',
        headers: { 'sec-fetch-site': 'same-site' },
      });

      let status = 0;
      await sm.handle(request, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(419);
    });

    it('should allow same-site when allowSameSite: true', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery({ allowSameSite: true });
      const sm = new StartSession(driver);

      const request = makeRequest({
        method: 'POST',
        headers: { 'sec-fetch-site': 'same-site' },
      });

      let status = 0;
      await sm.handle(request, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(200);
    });
  });

  describe('excluding URIs', () => {
    it('should skip CSRF check for excluded paths', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery({ except: ['/webhook/*'] });
      const sm = new StartSession(driver);

      const request = makeRequest({ method: 'POST', path: '/webhook/stripe' });

      let called = false;
      await sm.handle(request, async (req) => {
        await csrf.handle(req, async () => {
          called = true;
          return Response.json({});
        });
        return Response.json({});
      });

      expect(called).toBe(true);
    });

    it('should still enforce CSRF on non-excluded paths', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery({ except: ['/webhook/*'] });
      const sm = new StartSession(driver);

      const request = makeRequest({ method: 'POST', path: '/users' });

      let status = 0;
      await sm.handle(request, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(419);
    });
  });

  describe('originOnly mode', () => {
    it('should return 403 instead of 419 when originOnly is true', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery({ originOnly: true });
      const sm = new StartSession(driver);

      const request = makeRequest({ method: 'POST' });

      let status = 0;
      await sm.handle(request, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(403);
    });
  });

  describe('XSRF-TOKEN cookie', () => {
    it('should set XSRF-TOKEN cookie on GET response', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery();
      const sm = new StartSession(driver);

      const request = makeRequest({ method: 'GET' });
      let responseCookies: string | string[] | undefined;

      await sm.handle(request, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({}));
        responseCookies = res.getHeaders()['set-cookie'];
        return res;
      });

      const cookies = Array.isArray(responseCookies)
        ? responseCookies
        : responseCookies
          ? [responseCookies]
          : [];

      expect(cookies.some((c) => c.includes('XSRF-TOKEN='))).toBe(true);
      expect(cookies.some((c) => !c.includes('HttpOnly'))).toBe(true);
    });
  });

  describe('PUT/PATCH/DELETE', () => {
    it('should block PUT without token', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery();
      const sm = new StartSession(driver);
      const request = makeRequest({ method: 'PUT' });

      let status = 0;
      await sm.handle(request, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(419);
    });
  });

  describe('invalid token value', () => {
    it('should reject a mismatched token', async () => {
      const driver = new MemorySessionDriver();
      const csrf = new PreventRequestForgery();
      const sm = new StartSession(driver);

      const req1 = makeRequest({ method: 'GET' });
      let sessionId = '';
      await sm.handle(req1, async (req) => {
        sessionId = session(req).getId();
        session(req).token();
        return Response.json({});
      });

      const req2 = makeRequest({
        method: 'POST',
        body: { _token: 'totally-wrong-token' },
        cookie: `faber_session=${sessionId}`,
      });

      let status = 0;
      await sm.handle(req2, async (req) => {
        const res = await csrf.handle(req, async () => Response.json({ ok: true }));
        status = res.getStatus();
        return res;
      });

      expect(status).toBe(419);
    });
  });
});
