import { afterEach, beforeEach, describe, it } from 'vitest';
import { Application } from '@faber-js/core';
import { HttpKernel, Response } from '@faber-js/http';
import type { RouteDefinition, RouterContract } from '@faber-js/http';
import { TestCase } from './test-case';

class StubRouter implements RouterContract {
  private readonly routes: RouteDefinition[] = [];

  add(def: RouteDefinition): void {
    this.routes.push(def);
  }

  getRoutes(): readonly RouteDefinition[] {
    return this.routes;
  }

  findByName(_name: string): RouteDefinition | undefined {
    return undefined;
  }
}

let app: Application;
let kernel: HttpKernel;
let router: StubRouter;

class SampleTestCase extends TestCase {
  protected createKernel(): HttpKernel {
    return kernel;
  }
}

describe('TestCase', () => {
  const tc = new SampleTestCase();

  beforeEach(async () => {
    app = new Application();
    kernel = new HttpKernel(app);
    router = new StubRouter();

    router.add({
      method: 'GET',
      path: '/ping',
      handler: () => Promise.resolve(Response.json({ pong: true })),
      middleware: [],
    });

    router.add({
      method: 'POST',
      path: '/items',
      handler: (req) => Promise.resolve(Response.json({ created: true, ...req.all() }, 201)),
      middleware: [],
    });

    router.add({
      method: 'GET',
      path: '/secret',
      handler: (req) => {
        const token = req.bearerToken();
        if (!token) return Promise.resolve(Response.json({ message: 'Unauthorized' }, 401));
        return Promise.resolve(Response.json({ secret: 'data' }));
      },
      middleware: [],
    });

    app.instance('router', router);
    await tc.beforeEach();
  });

  afterEach(async () => {
    await tc.afterEach();
    Application.clearInstance();
  });

  describe('getJson()', () => {
    it('makes a GET request and returns a TestResponse', async () => {
      const res = await tc.getJson('/ping');
      res.assertOk();
      res.assertJsonPath('pong', true);
    });
  });

  describe('postJson()', () => {
    it('makes a POST request with a body', async () => {
      const res = await tc.postJson('/items', { name: 'Widget' });
      res.assertCreated();
      res.assertJsonPath('name', 'Widget');
    });
  });

  describe('actingAs()', () => {
    it('sets the Authorization header for subsequent requests', async () => {
      tc.actingAs('test-token');
      const res = await tc.getJson('/secret');
      res.assertOk();
      res.assertJsonPath('secret', 'data');
    });
  });
});
