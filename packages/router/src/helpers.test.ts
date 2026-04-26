import { Application } from '@faberjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Router } from './router';
import { RouteNotFoundException, route } from './helpers';
import { Response } from '@faberjs/http';

describe('route()', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application();
    const router = new Router();
    app.instance('router', router);
  });

  afterEach(() => {
    Application.clearInstance();
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
});
