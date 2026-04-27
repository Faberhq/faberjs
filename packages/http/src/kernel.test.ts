import { Application } from '@faber-js/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpException, UnauthorizedException } from './exceptions';
import { HttpKernel } from './kernel';
import type { Request } from './request';
import { Response } from './response';
import type { Middleware, NextFunction, RouteDefinition, RouterContract } from './types';

class StubRouter implements RouterContract {
  private readonly routeList: RouteDefinition[] = [];

  add(def: RouteDefinition): void {
    this.routeList.push(def);
  }

  getRoutes(): readonly RouteDefinition[] {
    return this.routeList;
  }

  findByName(_name: string): RouteDefinition | undefined {
    return undefined;
  }
}

describe('HttpKernel', () => {
  let app: Application;
  let kernel: HttpKernel;

  beforeEach(() => {
    app = new Application();
    kernel = new HttpKernel(app);
  });

  afterEach(async () => {
    await kernel.close();
    Application.clearInstance();
  });

  it('starts listening and responds to GET /health', async () => {
    const router = new StubRouter();
    router.add({
      method: 'GET',
      path: '/health',
      handler: (_req) => Promise.resolve(Response.json({ status: 'ok' })),
      middleware: [],
    });
    app.instance('router', router);

    await kernel.listen(0);
    const url = kernel.getUrl();

    const res = await fetch(`${url}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toEqual({ status: 'ok' });
  });

  it('returns 404 for unregistered routes', async () => {
    await kernel.listen(0);
    const url = kernel.getUrl();
    const res = await fetch(`${url}/not-found`);
    expect(res.status).toBe(404);
  });

  it('maps HttpException to the correct status code', async () => {
    const router = new StubRouter();
    router.add({
      method: 'GET',
      path: '/protected',
      handler: (_req) => {
        throw new UnauthorizedException();
      },
      middleware: [],
    });
    app.instance('router', router);

    await kernel.listen(0);
    const url = kernel.getUrl();
    const res = await fetch(`${url}/protected`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe('Unauthorized');
  });

  it('converts unhandled errors to 500', async () => {
    const router = new StubRouter();
    router.add({
      method: 'GET',
      path: '/boom',
      handler: (_req) => {
        throw new Error('Something broke');
      },
      middleware: [],
    });
    app.instance('router', router);

    await kernel.listen(0);
    const url = kernel.getUrl();
    const res = await fetch(`${url}/boom`);
    expect(res.status).toBe(500);
  });

  it('runs global middleware in order before the handler', async () => {
    const order: string[] = [];
    const mw1: Middleware = {
      handle: async (req: Request, next: NextFunction) => {
        order.push('mw1-before');
        const res = await next(req);
        order.push('mw1-after');
        return res;
      },
    };
    const mw2: Middleware = {
      handle: async (req: Request, next: NextFunction) => {
        order.push('mw2-before');
        const res = await next(req);
        order.push('mw2-after');
        return res;
      },
    };

    kernel.use(mw1).use(mw2);

    const router = new StubRouter();
    router.add({
      method: 'GET',
      path: '/test',
      handler: (_req) => {
        order.push('handler');
        return Promise.resolve(Response.json({ ok: true }));
      },
      middleware: [],
    });
    app.instance('router', router);

    await kernel.listen(0);
    await fetch(`${kernel.getUrl()}/test`);

    expect(order).toEqual(['mw1-before', 'mw2-before', 'handler', 'mw2-after', 'mw1-after']);
  });

  it('global middleware can short-circuit the request', async () => {
    const authGuard: Middleware = {
      handle: async (_req, _next) => {
        throw new HttpException('Forbidden', 403);
      },
    };

    kernel.use(authGuard);

    const router = new StubRouter();
    router.add({
      method: 'GET',
      path: '/admin',
      handler: (_req) => Promise.resolve(Response.json({ secret: true })),
      middleware: [],
    });
    app.instance('router', router);

    await kernel.listen(0);
    const res = await fetch(`${kernel.getUrl()}/admin`);
    expect(res.status).toBe(403);
  });
});
