import { Application } from '@faber-js/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Router } from './router';
import { RouteNotFoundException, route, setUrlDefaults, clearUrlDefaults } from './helpers';
import { Response } from '@faber-js/http';

describe('route()', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application();
    const router = new Router();
    app.instance('router', router);
  });

  afterEach(() => {
    Application.clearInstance();
    clearUrlDefaults();
  });

  it('generates a URL for a simple named route', () => {
    const router = app.make<Router>('router');
    router.get('/users', (_req) => Promise.resolve(Response.json({}))).name('users.index');
    expect(route('users.index')).toBe('/users');
  });

  it('replaces route parameters with provided values', () => {
    const router = app.make<Router>('router');
    router.get('/users/:id', (_req) => Promise.resolve(Response.json({}))).name('users.show');
    expect(route('users.show', { id: 42 })).toBe('/users/42');
  });

  it('replaces multiple route parameters', () => {
    const router = app.make<Router>('router');
    router
      .get('/posts/:postId/comments/:commentId', (_req) => Promise.resolve(Response.json({})))
      .name('posts.comments.show');
    expect(route('posts.comments.show', { postId: 1, commentId: 99 })).toBe('/posts/1/comments/99');
  });

  it('throws RouteNotFoundException for unknown route names', () => {
    expect(() => route('nonexistent')).toThrow(RouteNotFoundException);
  });

  it('throws RouteNotFoundException with the route name in the message', () => {
    expect(() => route('missing.route')).toThrow('missing.route');
  });

  it('appends leftover params as a query string', () => {
    const router = app.make<Router>('router');
    router.get('/posts/:id', (_req) => Promise.resolve(Response.json({}))).name('posts.show');
    expect(route('posts.show', { id: 1, search: 'rocket' })).toBe('/posts/1?search=rocket');
  });

  it('encodes query string values safely', () => {
    const router = app.make<Router>('router');
    router.get('/posts', (_req) => Promise.resolve(Response.json({}))).name('posts.index');
    expect(route('posts.index', { q: 'a b&c' })).toBe('/posts?q=a+b%26c');
  });

  it('unwraps a model-like value via getRouteKey()', () => {
    const router = app.make<Router>('router');
    router.get('/posts/:post', (_req) => Promise.resolve(Response.json({}))).name('posts.show');
    const post = { getRouteKey: () => 7 };
    expect(route('posts.show', { post })).toBe('/posts/7');
  });

  it('falls back to URL defaults for unsupplied placeholders', () => {
    const router = app.make<Router>('router');
    router.get('/{locale}/posts', (_req) => Promise.resolve(Response.json({}))).name('posts.index');
    setUrlDefaults({ locale: 'en' });
    expect(route('posts.index')).toBe('/en/posts');
  });

  it('lets explicit params override URL defaults', () => {
    const router = app.make<Router>('router');
    router.get('/{locale}/posts', (_req) => Promise.resolve(Response.json({}))).name('posts.index');
    setUrlDefaults({ locale: 'en' });
    expect(route('posts.index', { locale: 'fr' })).toBe('/fr/posts');
  });

  it('strips unfilled optional segments', () => {
    const router = app.make<Router>('router');
    router.get('/users/{id?}', (_req) => Promise.resolve(Response.json({}))).name('users.maybe');
    expect(route('users.maybe')).toBe('/users');
  });
});
