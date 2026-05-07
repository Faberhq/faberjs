import { Application } from '@faber-js/core';
import { InvalidSignatureException, Request, Response, runWithRequest } from '@faber-js/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Router } from './router';
import { SignedMiddleware, URL, url } from './url';
import { clearUrlDefaults } from './helpers';

describe('URL signed routes', () => {
  let app: Application;
  let router: Router;
  const ORIGINAL_KEY = process.env['APP_KEY'];

  beforeEach(() => {
    process.env['APP_KEY'] = 'test-key-12345';
    app = new Application();
    router = new Router();
    app.instance('router', router);
    router.get('/files/:id', (_req) => Promise.resolve(Response.json({}))).name('files.show');
  });

  afterEach(() => {
    Application.clearInstance();
    clearUrlDefaults();
    if (ORIGINAL_KEY === undefined) delete process.env['APP_KEY'];
    else process.env['APP_KEY'] = ORIGINAL_KEY;
  });

  it('builds a signed URL containing the signature', () => {
    const signed = URL.signedRoute('files.show', { id: 1 }, { absolute: false });
    expect(signed).toMatch(/^\/files\/1\?_signed=1&_signature=[a-f0-9]+$/);
  });

  it('verifies a valid relative signed URL', () => {
    const signed = URL.signedRoute('files.show', { id: 1 }, { absolute: false });
    expect(URL.hasValidSignature(signed, { absolute: false })).toBe(true);
  });

  it('rejects a tampered signed URL', () => {
    const signed = URL.signedRoute('files.show', { id: 1 }, { absolute: false });
    const tampered = signed.replace('id=1', 'id=2').replace('/files/1', '/files/2');
    expect(URL.hasValidSignature(tampered, { absolute: false })).toBe(false);
  });

  it('temporarySignedRoute accepts a Date and rejects when expired', () => {
    const past = new Date(Date.now() - 60_000);
    const signed = URL.temporarySignedRoute('files.show', past, { id: 1 }, { absolute: false });
    expect(URL.hasValidSignature(signed, { absolute: false })).toBe(false);
  });

  it('temporarySignedRoute accepts a TTL in seconds', () => {
    const signed = URL.temporarySignedRoute('files.show', 60, { id: 1 }, { absolute: false });
    expect(URL.hasValidSignature(signed, { absolute: false })).toBe(true);
  });

  it('hasValidSignatureWhileIgnoring ignores listed query params', () => {
    const signed = URL.signedRoute('files.show', { id: 1 }, { absolute: false });
    const withExtra = `${signed}&page=2`;
    expect(URL.hasValidSignature(withExtra, { absolute: false })).toBe(false);
    expect(URL.hasValidSignatureWhileIgnoring(withExtra, ['page'], { absolute: false })).toBe(true);
  });

  it('SignedMiddleware throws InvalidSignatureException when signature is missing', async () => {
    const mw = new SignedMiddleware({ relative: true });
    const req = new Request({ method: 'GET', path: '/files/1', url: '/files/1' });
    await expect(mw.handle(req, async () => Response.json({}))).rejects.toBeInstanceOf(
      InvalidSignatureException,
    );
  });

  it('SignedMiddleware passes a valid relative signed URL through', async () => {
    const signed = URL.signedRoute('files.show', { id: 1 }, { absolute: false });
    const req = new Request({ method: 'GET', path: '/files/1', url: signed });
    const mw = new SignedMiddleware({ relative: true });
    const resp = await mw.handle(req, async () => Response.json({ ok: true }));
    expect(resp.getStatus()).toBe(200);
  });
});

describe('URL.current/full/previous', () => {
  beforeEach(() => {
    Application.clearInstance();
    new Application();
  });

  afterEach(() => {
    Application.clearInstance();
    clearUrlDefaults();
  });

  it('returns the current path and full URL from the active request', async () => {
    const req = new Request({
      method: 'GET',
      path: '/dashboard',
      url: '/dashboard?tab=alerts',
      headers: { host: 'example.com' },
    });

    await runWithRequest(req, async () => {
      expect(URL.current()).toBe('/dashboard');
      expect(URL.full()).toBe('http://example.com/dashboard?tab=alerts');
    });
  });

  it('returns the previous URL recorded on the session', async () => {
    const req = new Request({
      method: 'GET',
      path: '/x',
      url: '/x',
      headers: { host: 'example.com' },
    });
    req.setAttribute('session', { previousUrl: () => 'http://example.com/back' });

    await runWithRequest(req, async () => {
      expect(URL.previous()).toBe('http://example.com/back');
      expect(URL.previousPath()).toBe('/back');
    });
  });

  it('falls back when no previous URL is recorded', async () => {
    const req = new Request({
      method: 'GET',
      path: '/x',
      url: '/x',
      headers: { host: 'example.com' },
    });
    req.setAttribute('session', { previousUrl: () => undefined });

    await runWithRequest(req, async () => {
      expect(URL.previous('/home')).toBe('http://example.com/home');
    });
  });
});

describe('url() helper', () => {
  beforeEach(() => {
    Application.clearInstance();
    new Application();
  });

  afterEach(() => {
    Application.clearInstance();
    clearUrlDefaults();
  });

  it('url(path) returns an absolute URL using the request host', async () => {
    const req = new Request({
      method: 'GET',
      path: '/x',
      url: '/x',
      headers: { host: 'example.com' },
    });
    await runWithRequest(req, async () => {
      expect(url('/posts')).toBe('http://example.com/posts');
    });
  });

  it('url() returns a UrlGenerator with current/full/query', async () => {
    const req = new Request({
      method: 'GET',
      path: '/dashboard',
      url: '/dashboard?tab=alerts',
      headers: { host: 'example.com' },
    });
    await runWithRequest(req, async () => {
      expect(url().full()).toBe('http://example.com/dashboard?tab=alerts');
      expect(url().query('/posts', { search: 'rocket' })).toBe(
        'http://example.com/posts?search=rocket',
      );
    });
  });

  it('url().query() handles array values with bracketed keys', async () => {
    const req = new Request({
      method: 'GET',
      path: '/x',
      url: '/x',
      headers: { host: 'example.com' },
    });
    await runWithRequest(req, async () => {
      const built = url().query('/posts', { columns: ['title', 'body'] });
      expect(built).toContain('columns%5B0%5D=title');
      expect(built).toContain('columns%5B1%5D=body');
    });
  });

  it('url().query() overwrites pre-existing query params', async () => {
    const req = new Request({
      method: 'GET',
      path: '/x',
      url: '/x',
      headers: { host: 'example.com' },
    });
    await runWithRequest(req, async () => {
      const built = url().query('/posts?sort=latest', { sort: 'oldest' });
      expect(built).toBe('http://example.com/posts?sort=oldest');
    });
  });
});
