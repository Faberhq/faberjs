import { Request, Response } from '@faber-js/http';
import { describe, expect, it } from 'vitest';
import { Session } from './session';
import { MemorySessionDriver } from './memory-driver';
import { TrackPreviousUrl } from './track-previous-url';

function buildRequest(method = 'GET'): { request: Request; session: Session } {
  const session = new Session(new MemorySessionDriver());
  const request = new Request({
    method,
    path: '/dashboard',
    url: '/dashboard?tab=alerts',
    headers: { host: 'example.com' },
  });
  request.setAttribute('session', session);
  return { request, session };
}

describe('TrackPreviousUrl', () => {
  const middleware = new TrackPreviousUrl();

  it('records the URL and route name on a successful GET response', async () => {
    const { request, session } = buildRequest();
    await middleware.handle(request, async () => Response.json({ ok: true }));
    expect(session.previousUrl()).toBe('http://example.com/dashboard?tab=alerts');
  });

  it('does not record non-GET requests', async () => {
    const { request, session } = buildRequest('POST');
    await middleware.handle(request, async () => Response.json({ ok: true }));
    expect(session.previousUrl()).toBeUndefined();
  });

  it('does not record when the response is a redirect', async () => {
    const { request, session } = buildRequest();
    await middleware.handle(request, async () => Response.redirect('/login'));
    expect(session.previousUrl()).toBeUndefined();
  });

  it('does not record JSON-expecting requests', async () => {
    const session = new Session(new MemorySessionDriver());
    const request = new Request({
      method: 'GET',
      path: '/api/users',
      url: '/api/users',
      headers: { host: 'example.com', accept: 'application/json' },
    });
    request.setAttribute('session', session);
    await middleware.handle(request, async () => Response.json({ ok: true }));
    expect(session.previousUrl()).toBeUndefined();
  });
});
