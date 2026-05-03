import { Application } from '@faber-js/core';
import type { Constructor } from '@faber-js/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpException, UnauthorizedException } from './exceptions';
import { HttpKernel } from './kernel';
import { Request } from './request';
import { Response } from './response';
import type {
  BindingEntry,
  ControllerAction,
  Middleware,
  ModelBindingResolver,
  NextFunction,
  RouteDefinition,
  RouterContract,
  TerminableMiddleware,
} from './types';

function makeRoute(
  path: string,
  handler: RouteDefinition['handler'],
  middleware: string[] = [],
  excludedMiddleware?: string[],
): RouteDefinition {
  return {
    method: 'GET',
    path,
    handler,
    middleware,
    constraints: {},
    ...(excludedMiddleware !== undefined && { excludedMiddleware }),
  };
}

class StubRouter implements RouterContract {
  private readonly routeList: RouteDefinition[] = [];
  private readonly _bindings = new Map<string, BindingEntry>();
  private _fallback?: ControllerAction;

  add(def: RouteDefinition): void {
    this.routeList.push(def);
  }

  getRoutes(): readonly RouteDefinition[] {
    return this.routeList;
  }

  findByName(_name: string): RouteDefinition | undefined {
    return undefined;
  }

  getGlobalPatterns(): ReadonlyMap<string, string> {
    return new Map();
  }

  getFallbackHandler(): ControllerAction | undefined {
    return this._fallback;
  }

  model(paramName: string, klass: Constructor, column?: string): void {
    this._bindings.set(paramName, {
      kind: 'model',
      klass,
      ...(column !== undefined ? { column } : {}),
    });
  }

  bind(paramName: string, resolver: ModelBindingResolver): void {
    this._bindings.set(paramName, { kind: 'resolver', fn: resolver });
  }

  getExplicitBindings(): ReadonlyMap<string, BindingEntry> {
    return this._bindings;
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
    router.add(makeRoute('/health', (_req) => Promise.resolve(Response.json({ status: 'ok' }))));
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
    router.add(
      makeRoute('/protected', (_req) => {
        throw new UnauthorizedException();
      }),
    );
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
    router.add(
      makeRoute('/boom', (_req) => {
        throw new Error('Something broke');
      }),
    );
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
    router.add(
      makeRoute('/test', (_req) => {
        order.push('handler');
        return Promise.resolve(Response.json({ ok: true }));
      }),
    );
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
    router.add(makeRoute('/admin', (_req) => Promise.resolve(Response.json({ secret: true }))));
    app.instance('router', router);

    await kernel.listen(0);
    const res = await fetch(`${kernel.getUrl()}/admin`);
    expect(res.status).toBe(403);
  });

  describe('middleware parameters (name:param syntax)', () => {
    it('passes colon-separated params to the middleware handle method', async () => {
      let receivedParams: string[] = [];
      const roleMw: Middleware = {
        handle: async (req, next, ...params) => {
          receivedParams = params;
          return next(req);
        },
      };
      kernel.alias('role', roleMw);

      const router = new StubRouter();
      router.add(
        makeRoute('/admin', (_req) => Promise.resolve(Response.json({ ok: true })), [
          'role:editor,publisher',
        ]),
      );
      app.instance('router', router);

      await kernel.listen(0);
      await fetch(`${kernel.getUrl()}/admin`);

      expect(receivedParams).toEqual(['editor', 'publisher']);
    });

    it('works with a single param', async () => {
      let receivedRole = '';
      const roleMw: Middleware = {
        handle: async (req, next, role = '') => {
          receivedRole = role;
          return next(req);
        },
      };
      kernel.alias('role', roleMw);

      const router = new StubRouter();
      router.add(
        makeRoute('/secure', (_req) => Promise.resolve(Response.json({ ok: true })), [
          'role:admin',
        ]),
      );
      app.instance('router', router);

      await kernel.listen(0);
      await fetch(`${kernel.getUrl()}/secure`);

      expect(receivedRole).toBe('admin');
    });
  });

  describe('withoutMiddleware (excluded middleware)', () => {
    it('does not run middleware listed in excludedMiddleware', async () => {
      const touched: string[] = [];
      kernel.alias('auth', {
        handle: async (req, next) => {
          touched.push('auth');
          return next(req);
        },
      });
      kernel.alias('log', {
        handle: async (req, next) => {
          touched.push('log');
          return next(req);
        },
      });

      const router = new StubRouter();
      router.add(
        makeRoute(
          '/open',
          (_req) => Promise.resolve(Response.json({ ok: true })),
          ['auth', 'log'],
          ['auth'],
        ),
      );
      app.instance('router', router);

      await kernel.listen(0);
      await fetch(`${kernel.getUrl()}/open`);

      expect(touched).toEqual(['log']);
      expect(touched).not.toContain('auth');
    });
  });

  describe('named middleware groups', () => {
    it('expands a group name into its constituent middleware', async () => {
      const order: string[] = [];
      kernel.alias('first', {
        handle: async (req, next) => {
          order.push('first');
          return next(req);
        },
      });
      kernel.alias('second', {
        handle: async (req, next) => {
          order.push('second');
          return next(req);
        },
      });
      kernel.middlewareGroup('api', ['first', 'second']);

      const router = new StubRouter();
      router.add(
        makeRoute('/data', (_req) => Promise.resolve(Response.json({ ok: true })), ['api']),
      );
      app.instance('router', router);

      await kernel.listen(0);
      await fetch(`${kernel.getUrl()}/data`);

      expect(order).toEqual(['first', 'second']);
    });

    it('appendToGroup adds middleware at the end of an existing group', async () => {
      const order: string[] = [];
      kernel.alias('a', {
        handle: async (req, next) => {
          order.push('a');
          return next(req);
        },
      });
      kernel.alias('b', {
        handle: async (req, next) => {
          order.push('b');
          return next(req);
        },
      });
      kernel.alias('c', {
        handle: async (req, next) => {
          order.push('c');
          return next(req);
        },
      });

      kernel.middlewareGroup('web', ['a', 'b']);
      kernel.appendToGroup('web', ['c']);

      const router = new StubRouter();
      router.add(
        makeRoute('/page', (_req) => Promise.resolve(Response.json({ ok: true })), ['web']),
      );
      app.instance('router', router);

      await kernel.listen(0);
      await fetch(`${kernel.getUrl()}/page`);

      expect(order).toEqual(['a', 'b', 'c']);
    });

    it('prependToGroup adds middleware at the start of an existing group', async () => {
      const order: string[] = [];
      kernel.alias('a', {
        handle: async (req, next) => {
          order.push('a');
          return next(req);
        },
      });
      kernel.alias('b', {
        handle: async (req, next) => {
          order.push('b');
          return next(req);
        },
      });
      kernel.alias('z', {
        handle: async (req, next) => {
          order.push('z');
          return next(req);
        },
      });

      kernel.middlewareGroup('web', ['a', 'b']);
      kernel.prependToGroup('web', ['z']);

      const router = new StubRouter();
      router.add(
        makeRoute('/page', (_req) => Promise.resolve(Response.json({ ok: true })), ['web']),
      );
      app.instance('router', router);

      await kernel.listen(0);
      await fetch(`${kernel.getUrl()}/page`);

      expect(order).toEqual(['z', 'a', 'b']);
    });
  });

  describe('terminable middleware', () => {
    it('calls terminate on TerminableMiddleware after the response is sent', async () => {
      const log: string[] = [];
      const terminable: TerminableMiddleware = {
        handle: async (req, next) => {
          log.push('handle');
          return next(req);
        },
        terminate: (_req, _res) => {
          log.push('terminate');
        },
      };
      kernel.use(terminable);

      const router = new StubRouter();
      router.add(makeRoute('/t', (_req) => Promise.resolve(Response.json({ ok: true }))));
      app.instance('router', router);

      await kernel.listen(0);
      await fetch(`${kernel.getUrl()}/t`);

      // Give the terminate hook a tick to execute (it runs after sendResponse in Fastify handler)
      await new Promise((r) => setTimeout(r, 10));

      expect(log).toEqual(['handle', 'terminate']);
    });

    it('calls terminate on parameterized terminable middleware and passes the correct instance', async () => {
      const log: string[] = [];
      const terminable: TerminableMiddleware = {
        handle: async (req, next, ...params) => {
          log.push(`handle:${params.join(',')}`);
          return next(req);
        },
        terminate: () => {
          log.push('terminate');
        },
      };
      kernel.alias('trm', terminable);

      const router = new StubRouter();
      router.add(
        makeRoute('/t2', (_req) => Promise.resolve(Response.json({ ok: true })), ['trm:foo']),
      );
      app.instance('router', router);

      await kernel.listen(0);
      await fetch(`${kernel.getUrl()}/t2`);
      await new Promise((r) => setTimeout(r, 10));

      expect(log).toEqual(['handle:foo', 'terminate']);
    });
  });

  describe('middleware priority', () => {
    it('runs priority-listed middleware before non-priority middleware', async () => {
      const order: string[] = [];
      kernel.alias('throttle', {
        handle: async (req, next) => {
          order.push('throttle');
          return next(req);
        },
      });
      kernel.alias('auth', {
        handle: async (req, next) => {
          order.push('auth');
          return next(req);
        },
      });
      kernel.alias('log', {
        handle: async (req, next) => {
          order.push('log');
          return next(req);
        },
      });

      kernel.priority(['auth', 'throttle']);

      const router = new StubRouter();
      // Register in the "wrong" order — priority should fix it
      router.add(
        makeRoute('/p', (_req) => Promise.resolve(Response.json({ ok: true })), [
          'log',
          'throttle',
          'auth',
        ]),
      );
      app.instance('router', router);

      await kernel.listen(0);
      await fetch(`${kernel.getUrl()}/p`);

      expect(order).toEqual(['auth', 'throttle', 'log']);
    });
  });

  // ── Phase C: domain routing, controller groups, Route.current() ───────────

  describe('domain routing (via handleRequest)', () => {
    it('responds when Host header matches static domain', async () => {
      const router = new StubRouter();
      router.add({
        ...makeRoute('/api/test', () => Promise.resolve(Response.json({ ok: true }))),
        domain: 'api.example.com',
      });
      app.instance('router', router);

      const req = new Request({
        method: 'GET',
        path: '/api/test',
        headers: { host: 'api.example.com' },
      });
      const res = await kernel.handleRequest(req);
      expect(res.getStatus()).toBe(200);
    });

    it('returns 404 when Host header does not match domain', async () => {
      const router = new StubRouter();
      router.add({
        ...makeRoute('/api/test', () => Promise.resolve(Response.json({ ok: true }))),
        domain: 'api.example.com',
      });
      app.instance('router', router);

      const req = new Request({
        method: 'GET',
        path: '/api/test',
        headers: { host: 'other.example.com' },
      });
      const res = await kernel.handleRequest(req);
      expect(res.getStatus()).toBe(404);
    });

    it('captures wildcard subdomain in {account} placeholder', async () => {
      let captured = '';
      const router = new StubRouter();
      router.add({
        ...makeRoute('/dashboard', (req) => {
          captured = (req as Request).route('account');
          return Promise.resolve(Response.json({ ok: true }));
        }),
        domain: '{account}.example.com',
      });
      app.instance('router', router);

      const req = new Request({
        method: 'GET',
        path: '/dashboard',
        headers: { host: 'acme.example.com' },
      });
      await kernel.handleRequest(req);
      expect(captured).toBe('acme');
    });
  });

  describe('route inspection (Route.current)', () => {
    it('sets currentRoute on the request inside the handler', async () => {
      let capturedName: string | undefined;
      const router = new StubRouter();
      const def = makeRoute('/inspection', (req) => {
        capturedName = (req as Request).currentRoute()?.name;
        return Promise.resolve(Response.json({ ok: true }));
      });
      def.name = 'test.inspection';
      router.add(def);
      app.instance('router', router);

      const req = new Request({ method: 'GET', path: '/inspection' });
      await kernel.handleRequest(req);
      expect(capturedName).toBe('test.inspection');
    });
  });

  // ── Phase D: model binding ─────────────────────────────────────────────────

  describe('model binding', () => {
    it('resolves route param via implicit resolveRouteBinding and injects into method', async () => {
      class FakeUser {
        id = '';
        static resolveRouteBinding(value: string): Promise<FakeUser | null> {
          const u = new FakeUser();
          u.id = value;
          return Promise.resolve(u);
        }
      }

      let injectedUser: FakeUser | undefined;
      class UserController {
        show(_req: Request, user: FakeUser): Response {
          injectedUser = user;
          return Response.json({ ok: true });
        }
      }

      Reflect.defineMetadata(
        'design:paramtypes',
        [Request, FakeUser],
        UserController.prototype,
        'show',
      );
      app.instance(UserController as unknown as Constructor, new UserController());

      const router = new StubRouter();
      router.add(
        makeRoute('/users/{fakeUser}', [UserController as unknown as Constructor, 'show']),
      );
      app.instance('router', router);

      const req = new Request({ method: 'GET', path: '/users/42', params: { fakeUser: '42' } });
      const res = await kernel.handleRequest(req);
      expect(res.getStatus()).toBe(200);
      expect(injectedUser?.id).toBe('42');
    });

    it('returns 404 when implicit model resolves to null', async () => {
      class GhostModel {
        static resolveRouteBinding(): Promise<null> {
          return Promise.resolve(null);
        }
      }

      class TestCtrl {
        show(_req: Request, _m: GhostModel): Response {
          return Response.json({ ok: true });
        }
      }

      Reflect.defineMetadata(
        'design:paramtypes',
        [Request, GhostModel],
        TestCtrl.prototype,
        'show',
      );
      app.instance(TestCtrl as unknown as Constructor, new TestCtrl());

      const router = new StubRouter();
      router.add(makeRoute('/ghosts/{ghostModel}', [TestCtrl as unknown as Constructor, 'show']));
      app.instance('router', router);

      const req = new Request({
        method: 'GET',
        path: '/ghosts/999',
        params: { ghostModel: '999' },
      });
      const res = await kernel.handleRequest(req);
      expect(res.getStatus()).toBe(404);
    });

    it('calls missingHandler when model resolves to null', async () => {
      class GoneModel {
        static resolveRouteBinding(): Promise<null> {
          return Promise.resolve(null);
        }
      }

      class TestCtrl {
        show(_req: Request, _m: GoneModel): Response {
          return Response.json({ found: true });
        }
      }

      Reflect.defineMetadata('design:paramtypes', [Request, GoneModel], TestCtrl.prototype, 'show');
      app.instance(TestCtrl as unknown as Constructor, new TestCtrl());

      const def = makeRoute('/things/{goneModel}', [TestCtrl as unknown as Constructor, 'show']);
      def.missingHandler = () => Promise.resolve(Response.json({ missing: true }));

      const router = new StubRouter();
      router.add(def);
      app.instance('router', router);

      const req = new Request({ method: 'GET', path: '/things/999', params: { goneModel: '999' } });
      const res = await kernel.handleRequest(req);
      const body = res.getBody() as Record<string, unknown>;
      expect(body.missing).toBe(true);
    });

    it('resolves via explicit Route.bind resolver', async () => {
      class Widget {
        slug = '';
        static resolveRouteBinding(): Promise<null> {
          return Promise.resolve(null);
        }
      }

      let resolvedValue = '';
      class WidgetCtrl {
        show(_req: Request, _w: Widget): Response {
          return Response.json({ ok: true });
        }
      }

      Reflect.defineMetadata('design:paramtypes', [Request, Widget], WidgetCtrl.prototype, 'show');
      app.instance(WidgetCtrl as unknown as Constructor, new WidgetCtrl());

      const router = new StubRouter();
      router.bind('widget', (value: string) => {
        resolvedValue = value;
        const w = new Widget();
        w.slug = value;
        return w;
      });
      router.add(makeRoute('/widgets/{widget}', [WidgetCtrl as unknown as Constructor, 'show']));
      app.instance('router', router);

      const req = new Request({
        method: 'GET',
        path: '/widgets/my-widget',
        params: { widget: 'my-widget' },
      });
      const res = await kernel.handleRequest(req);
      expect(res.getStatus()).toBe(200);
      expect(resolvedValue).toBe('my-widget');
    });

    it('resolves via explicit Route.model binding (class-based)', async () => {
      class Post {
        id = '';
        static resolveRouteBinding(value: string): Promise<Post | null> {
          const p = new Post();
          p.id = value;
          return Promise.resolve(p);
        }
      }

      let injectedPost: Post | undefined;
      class PostCtrl {
        show(_req: Request, post: Post): Response {
          injectedPost = post;
          return Response.json({ ok: true });
        }
      }

      Reflect.defineMetadata('design:paramtypes', [Request, Post], PostCtrl.prototype, 'show');
      app.instance(PostCtrl as unknown as Constructor, new PostCtrl());

      const router = new StubRouter();
      router.model('post', Post as unknown as Constructor);
      router.add(makeRoute('/posts/{post}', [PostCtrl as unknown as Constructor, 'show']));
      app.instance('router', router);

      const req = new Request({ method: 'GET', path: '/posts/99', params: { post: '99' } });
      const res = await kernel.handleRequest(req);
      expect(res.getStatus()).toBe(200);
      expect(injectedPost?.id).toBe('99');
    });
  });
});
