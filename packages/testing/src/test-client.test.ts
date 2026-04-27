import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Application } from '@faber-js/core';
import { HttpKernel, Response } from '@faber-js/http';
import type { RouteDefinition, RouterContract } from '@faber-js/http';
import { createTestApp } from './test-client';

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

describe('TestClient / createTestApp()', () => {
  let app: Application;
  let kernel: HttpKernel;
  let router: StubRouter;

  beforeEach(() => {
    app = new Application();
    kernel = new HttpKernel(app);
    router = new StubRouter();

    router.add({
      method: 'GET',
      path: '/hello',
      handler: () => Promise.resolve(Response.json({ message: 'hello' })),
      middleware: [],
    });

    router.add({
      method: 'POST',
      path: '/echo',
      handler: (req) => Promise.resolve(Response.json(req.all(), 201)),
      middleware: [],
    });

    router.add({
      method: 'GET',
      path: '/protected',
      handler: (req) => {
        const token = req.bearerToken();
        if (!token) return Promise.resolve(Response.json({ message: 'Unauthorized' }, 401));
        return Promise.resolve(Response.json({ user: 'alice' }));
      },
      middleware: [],
    });

    app.instance('router', router);
  });

  afterEach(async () => {
    await kernel.close();
    Application.clearInstance();
  });

  it('makes a GET request and returns a TestResponse', async () => {
    const client = await createTestApp(kernel);
    const res = await client.get('/hello');
    res.assertOk();
    res.assertJsonPath('message', 'hello');
  });

  it('makes a POST request with a body', async () => {
    const client = await createTestApp(kernel);
    const res = await client.post('/echo', { name: 'Alice' });
    res.assertCreated();
    res.assertJsonPath('name', 'Alice');
  });

  it('actingAs() sets the Authorization header', async () => {
    const client = await createTestApp(kernel);
    const authed = client.actingAs('my-test-token');
    const res = await authed.get('/protected');
    res.assertOk();
    res.assertJsonPath('user', 'alice');
  });

  it('returns 401 when no token is provided on a protected route', async () => {
    const client = await createTestApp(kernel);
    const res = await client.get('/protected');
    res.assertUnauthorized();
  });

  it('withHeaders() merges additional headers', async () => {
    const client = await createTestApp(kernel);
    const withCustom = client.withHeaders({ 'x-request-id': 'abc123' });
    const res = await withCustom.get('/hello');
    res.assertOk();
  });

  it('close() shuts down the kernel', async () => {
    const client = await createTestApp(kernel);
    await expect(client.close()).resolves.toBeUndefined();
  });
});
