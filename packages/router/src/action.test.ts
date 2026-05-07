import { Application } from '@faber-js/core';
import { Response } from '@faber-js/http';
import type { Request } from '@faber-js/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Router } from './router';
import { Controller } from './controller';
import { action, ActionNotFoundException } from './action';

class UserController extends Controller {
  index(_req: Request): Promise<Response> {
    return Promise.resolve(Response.json([]));
  }
  show(_req: Request): Promise<Response> {
    return Promise.resolve(Response.json({}));
  }
}

class InvokableController extends Controller {
  handle(_req: Request): Promise<Response> {
    return Promise.resolve(Response.json({}));
  }
}

describe('action()', () => {
  let app: Application;
  let router: Router;

  beforeEach(() => {
    app = new Application();
    router = new Router();
    app.instance('router', router);
  });

  afterEach(() => {
    Application.clearInstance();
  });

  it('builds a URL for a [Controller, method] tuple', () => {
    void app;
    router.get('/users', [UserController, 'index']);
    expect(action([UserController, 'index'])).toBe('/users');
  });

  it('substitutes parameters into the matched route path', () => {
    router.get('/users/:id', [UserController, 'show']);
    expect(action([UserController, 'show'], { id: 42 })).toBe('/users/42');
  });

  it('matches an invokable controller passed as a single Constructor', () => {
    router.get('/run', InvokableController);
    expect(action(InvokableController)).toBe('/run');
  });

  it('throws ActionNotFoundException when no matching route exists', () => {
    expect(() => action([UserController, 'index'])).toThrow(ActionNotFoundException);
  });

  it('appends leftover params as query string', () => {
    router.get('/users/:id', [UserController, 'show']);
    expect(action([UserController, 'show'], { id: 1, ref: 'email' })).toBe('/users/1?ref=email');
  });
});
