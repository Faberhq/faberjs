import { describe, expect, it, vi, afterEach } from 'vitest';
import { redirect, back, RedirectBuilder } from './redirect';
import type { Response } from './response';
import { runWithRequest } from './request-context';
import { Request } from './request';

function makeRequest(overrides: Partial<ConstructorParameters<typeof Request>[0]> = {}): Request {
  return new Request({
    method: 'GET',
    path: '/',
    url: '/',
    headers: {},
    body: {},
    query: {},
    params: {},
    ip: '127.0.0.1',
    ...overrides,
  });
}

describe('redirect()', () => {
  it('returns a RedirectBuilder', () => {
    expect(redirect()).toBeInstanceOf(RedirectBuilder);
  });
});

describe('RedirectBuilder.to()', () => {
  it('creates a 302 redirect by default', () => {
    const res = redirect().to('/dashboard');
    expect(res.getStatus()).toBe(302);
    expect(res.getHeaders()['location']).toBe('/dashboard');
  });

  it('accepts a custom status code', () => {
    const res = redirect().to('/old-page', 301);
    expect(res.getStatus()).toBe(301);
  });
});

describe('RedirectBuilder.back()', () => {
  it('redirects to the Referer header when present', async () => {
    const req = makeRequest({ headers: { referer: '/previous' } });
    let res!: Response;
    await runWithRequest(req, async () => {
      res = redirect().back();
    });
    expect(res.getHeaders()['location']).toBe('/previous');
  });

  it('falls back to "/" when no Referer header', () => {
    const res = redirect().back();
    expect(res.getHeaders()['location']).toBe('/');
  });

  it('accepts a custom fallback URL', async () => {
    const res = redirect().back('/home');
    expect(res.getHeaders()['location']).toBe('/home');
  });
});

describe('RedirectBuilder.away()', () => {
  it('redirects to an external URL', () => {
    const res = redirect().away('https://example.com');
    expect(res.getHeaders()['location']).toBe('https://example.com');
    expect(res.getStatus()).toBe(302);
  });
});

describe('RedirectBuilder.route()', () => {
  it('resolves a named route and builds the URL', () => {
    const router = {
      findByName: (name: string) =>
        name === 'profile'
          ? { path: '/users/{id}', method: 'GET', handler: [] as unknown, middleware: [] }
          : undefined,
      getRoutes: () => [] as unknown[],
    };
    const app = {
      bound: (key: string) => key === 'router',
      make: <T>(_key: string) => router as T,
    };
    const res = redirect(app).route('profile', { id: 42 });
    expect(res.getHeaders()['location']).toBe('/users/42');
  });

  it('throws when the named route does not exist', () => {
    const router = { findByName: () => undefined, getRoutes: () => [] };
    const app = {
      bound: () => true,
      make: <T>() => router as T,
    };
    expect(() => redirect(app).route('missing')).toThrow('[missing]');
  });

  it('throws when router is not bound', () => {
    const app = { bound: () => false, make: <T>() => ({}) as T };
    expect(() => redirect(app).route('home')).toThrow('router is not bound');
  });

  it('appends unmatched params as query string', () => {
    const router = {
      findByName: (_name: string) => ({
        path: '/search',
        method: 'GET',
        handler: [] as unknown,
        middleware: [],
      }),
      getRoutes: () => [] as unknown[],
    };
    const app = { bound: () => true, make: <T>() => router as T };
    const res = redirect(app).route('search', { q: 'hello', page: 2 });
    const location = res.getHeaders()['location'] as string;
    expect(location).toContain('q=hello');
    expect(location).toContain('page=2');
  });
});

describe('RedirectBuilder.with()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flashes a key/value pair to the session', async () => {
    const flashSpy = vi.fn();
    const session = { flash: flashSpy };
    const req = makeRequest();
    req.setAttribute('session', session);

    let res!: Response;
    await runWithRequest(req, async () => {
      res = redirect().with('status', 'Saved!').to('/dashboard');
    });

    expect(flashSpy).toHaveBeenCalledWith('status', 'Saved!');
    expect(res.getHeaders()['location']).toBe('/dashboard');
  });

  it('is a no-op when no session is active', () => {
    expect(() => redirect().with('k', 'v').to('/home')).not.toThrow();
  });
});

describe('RedirectBuilder.withInput()', () => {
  it('flashes request input under _old_input', async () => {
    const flashSpy = vi.fn();
    const session = { flash: flashSpy };
    const req = makeRequest({ body: { email: 'a@b.com' } });
    req.setAttribute('session', session);

    await runWithRequest(req, async () => {
      redirect().withInput().to('/form');
    });

    expect(flashSpy).toHaveBeenCalledWith(
      '_old_input',
      expect.objectContaining({ email: 'a@b.com' }),
    );
  });
});

describe('back()', () => {
  it('is a shorthand for redirect().back()', async () => {
    const req = makeRequest({ headers: { referer: '/go-back' } });
    let res!: Response;
    await runWithRequest(req, async () => {
      res = back();
    });
    expect(res.getHeaders()['location']).toBe('/go-back');
  });
});
