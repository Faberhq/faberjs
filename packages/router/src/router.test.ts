import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Response } from '@faber-js/http';
import type { ModelBindingResolver, Request } from '@faber-js/http';
import type { Constructor } from '@faber-js/core';
import { Router } from './router';
import { Middleware, Authorize } from './decorators';

class FakeController {
  index(_req: Request): Response {
    return Response.json({ action: 'index' });
  }
  create(_req: Request): Response {
    return Response.json({ action: 'create' });
  }
  store(_req: Request): Response {
    return Response.json({ action: 'store' }, 201);
  }
  show(_req: Request): Response {
    return Response.json({ action: 'show' });
  }
  edit(_req: Request): Response {
    return Response.json({ action: 'edit' });
  }
  update(_req: Request): Response {
    return Response.json({ action: 'update' });
  }
  destroy(_req: Request): Response {
    return Response.noContent();
  }
}

describe('Router', () => {
  describe('basic route registration', () => {
    it('registers a GET route', () => {
      const router = new Router();
      router.get('/users', [FakeController, 'index']);
      const routes = router.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0]?.method).toBe('GET');
      expect(routes[0]?.path).toBe('/users');
    });

    it('registers POST, PUT, PATCH, DELETE routes', () => {
      const router = new Router();
      router.post('/users', [FakeController, 'store']);
      router.put('/users/:id', [FakeController, 'update']);
      router.patch('/users/:id', [FakeController, 'update']);
      router.delete('/users/:id', [FakeController, 'destroy']);
      expect(router.getRoutes()).toHaveLength(4);
    });

    it('registers closure handlers', () => {
      const router = new Router();
      const handler = (_req: Request): Promise<Response> =>
        Promise.resolve(Response.json({ ok: true }));
      router.get('/health', handler);
      expect(router.getRoutes()[0]?.handler).toBe(handler);
    });
  });

  describe('group()', () => {
    it('applies prefix to all routes inside the group', () => {
      const router = new Router();
      router.group({ prefix: '/api/v1' }, () => {
        router.get('/users', [FakeController, 'index']);
      });
      expect(router.getRoutes()[0]?.path).toBe('/api/v1/users');
    });

    it('applies middleware to all routes inside the group', () => {
      const router = new Router();
      router.group({ middleware: ['auth'] }, () => {
        router.get('/profile', [FakeController, 'show']);
      });
      expect(router.getRoutes()[0]?.middleware).toEqual(['auth']);
    });

    it('merges nested group prefixes', () => {
      const router = new Router();
      router.group({ prefix: '/api' }, () => {
        router.group({ prefix: '/v1' }, () => {
          router.get('/users', [FakeController, 'index']);
        });
      });
      expect(router.getRoutes()[0]?.path).toBe('/api/v1/users');
    });

    it('merges nested group middleware', () => {
      const router = new Router();
      router.group({ middleware: ['auth'] }, () => {
        router.group({ middleware: ['throttle'] }, () => {
          router.get('/data', [FakeController, 'index']);
        });
      });
      expect(router.getRoutes()[0]?.middleware).toEqual(['auth', 'throttle']);
    });

    it('does not leak group context outside the callback', () => {
      const router = new Router();
      router.group({ prefix: '/admin' }, () => {
        router.get('/dashboard', [FakeController, 'index']);
      });
      router.get('/public', [FakeController, 'index']);
      expect(router.getRoutes()[1]?.path).toBe('/public');
    });
  });

  describe('resource()', () => {
    it('generates 7 CRUD routes (index, create, store, show, edit, update, destroy)', () => {
      const router = new Router();
      router.resource('posts', FakeController);
      expect(router.getRoutes()).toHaveLength(7);
    });

    it('generates correct paths', () => {
      const router = new Router();
      router.resource('posts', FakeController);
      const paths = router.getRoutes().map((r) => `${r.method} ${r.path}`);
      expect(paths).toContain('GET /posts');
      expect(paths).toContain('GET /posts/create');
      expect(paths).toContain('POST /posts');
      expect(paths).toContain('GET /posts/:post');
      expect(paths).toContain('GET /posts/:post/edit');
      expect(paths).toContain('PUT /posts/:post');
      expect(paths).toContain('DELETE /posts/:post');
    });

    it('applies group prefix to resource routes', () => {
      const router = new Router();
      router.group({ prefix: '/api' }, () => {
        router.resource('posts', FakeController);
      });
      const indexRoute = router
        .getRoutes()
        .find((r) => r.method === 'GET' && r.path === '/api/posts');
      expect(indexRoute).toBeDefined();
    });
  });

  describe('withoutMiddleware()', () => {
    it('adds names to excludedMiddleware on the route definition', () => {
      const router = new Router();
      router
        .get('/open', [FakeController, 'index'])
        .middleware(['auth', 'throttle'])
        .withoutMiddleware(['auth']);
      const route = router.getRoutes()[0];
      expect(route?.excludedMiddleware).toEqual(['auth']);
    });

    it('can chain multiple withoutMiddleware calls', () => {
      const router = new Router();
      router
        .get('/open', [FakeController, 'index'])
        .middleware(['auth', 'throttle', 'log'])
        .withoutMiddleware(['auth'])
        .withoutMiddleware(['log']);
      const route = router.getRoutes()[0];
      expect(route?.excludedMiddleware).toEqual(['auth', 'log']);
    });
  });

  describe('HTTP method variants', () => {
    it('registers an OPTIONS route', () => {
      const router = new Router();
      router.options('/resource', [FakeController, 'index']);
      expect(router.getRoutes()[0]?.method).toBe('OPTIONS');
    });

    it('match() registers one route per method', () => {
      const router = new Router();
      router.match(['GET', 'POST'], '/multi', [FakeController, 'index']);
      expect(router.getRoutes()).toHaveLength(2);
      const methods = router.getRoutes().map((r) => r.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
    });

    it('any() registers routes for all HTTP methods', () => {
      const router = new Router();
      router.any('/wildcard', [FakeController, 'index']);
      expect(router.getRoutes().length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('redirect routes', () => {
    it('redirect() creates a GET route that issues a 302', async () => {
      const router = new Router();
      router.redirect('/old', '/new');
      const route = router.getRoutes()[0];
      expect(route?.method).toBe('GET');
      expect(route?.path).toBe('/old');
      if (!route) return;
      const res = await (route.handler as (r: Request) => Promise<Response>)(
        null as unknown as Request,
      );
      expect(res.getStatus()).toBe(302);
      expect(res.getHeaders()['location']).toBe('/new');
    });

    it('permanentRedirect() creates a 301 redirect', async () => {
      const router = new Router();
      router.permanentRedirect('/legacy', '/current');
      const route = router.getRoutes()[0];
      if (!route) return;
      const res = await (route.handler as (r: Request) => Promise<Response>)(
        null as unknown as Request,
      );
      expect(res.getStatus()).toBe(301);
    });

    it('redirect() accepts a custom status code', async () => {
      const router = new Router();
      router.redirect('/here', '/there', 307);
      const route = router.getRoutes()[0];
      if (!route) return;
      const res = await (route.handler as (r: Request) => Promise<Response>)(
        null as unknown as Request,
      );
      expect(res.getStatus()).toBe(307);
    });
  });

  describe('fallback route', () => {
    it('stores a fallback handler', () => {
      const router = new Router();
      expect(router.getFallbackHandler()).toBeUndefined();
      const handler = (_req: Request): Promise<Response> =>
        Promise.resolve(Response.json({ error: 'not found' }, 404));
      router.fallback(handler);
      expect(router.getFallbackHandler()).toBe(handler);
    });
  });

  describe('route constraints', () => {
    it('where() stores a regex constraint on the definition', () => {
      const router = new Router();
      router.get('/users/{id}', [FakeController, 'show']).where('id', '[0-9]+');
      expect(router.getRoutes()[0]?.constraints).toEqual({ id: '[0-9]+' });
    });

    it('whereNumber() constrains param to digits', () => {
      const router = new Router();
      router.get('/items/{id}', [FakeController, 'show']).whereNumber('id');
      expect(router.getRoutes()[0]?.constraints['id']).toBe('[0-9]+');
    });

    it('whereAlpha() constrains param to letters', () => {
      const router = new Router();
      router.get('/cats/{name}', [FakeController, 'show']).whereAlpha('name');
      expect(router.getRoutes()[0]?.constraints['name']).toBe('[a-zA-Z]+');
    });

    it('whereAlphaNumeric() constrains param to letters and digits', () => {
      const router = new Router();
      router.get('/slugs/{slug}', [FakeController, 'show']).whereAlphaNumeric('slug');
      expect(router.getRoutes()[0]?.constraints['slug']).toBe('[a-zA-Z0-9]+');
    });

    it('whereIn() constrains param to a list of values', () => {
      const router = new Router();
      router.get('/type/{type}', [FakeController, 'show']).whereIn('type', ['video', 'audio']);
      expect(router.getRoutes()[0]?.constraints['type']).toBe('video|audio');
    });

    it('pattern() registers a global constraint applied to all matching params', () => {
      const router = new Router();
      router.pattern('id', '[0-9]+');
      expect(router.getGlobalPatterns().get('id')).toBe('[0-9]+');
    });

    it('missing() stores a missing handler on the definition', () => {
      const router = new Router();
      const missingHandler = (_req: Request): Promise<Response> =>
        Promise.resolve(Response.notFound('Gone'));
      router.get('/users/{id}', [FakeController, 'show']).missing(missingHandler);
      expect(router.getRoutes()[0]?.missingHandler).toBe(missingHandler);
    });
  });

  describe('named routes', () => {
    it('registers a named route', () => {
      const router = new Router();
      router.get('/users/:id', [FakeController, 'show']).name('users.show');
      expect(router.findByName('users.show')).toBeDefined();
    });

    it('returns undefined for unknown route name', () => {
      expect(new Router().findByName('unknown')).toBeUndefined();
    });

    it('applies group name prefix to named routes', () => {
      const router = new Router();
      router.group({ name: 'admin.' }, () => {
        router.get('/dashboard', [FakeController, 'index']).name('dashboard');
      });
      expect(router.findByName('admin.dashboard')).toBeDefined();
    });
  });

  describe('ResourceBuilder', () => {
    it('only() keeps only the specified actions', () => {
      const router = new Router();
      router.resource('posts', FakeController).only(['index', 'show']);
      expect(router.getRoutes()).toHaveLength(2);
      const methods = router.getRoutes().map((r) => r.resourceAction);
      expect(methods).toContain('index');
      expect(methods).toContain('show');
    });

    it('except() removes the specified actions', () => {
      const router = new Router();
      router.resource('posts', FakeController).except(['create', 'edit']);
      expect(router.getRoutes()).toHaveLength(5);
      const methods = router.getRoutes().map((r) => r.resourceAction);
      expect(methods).not.toContain('create');
      expect(methods).not.toContain('edit');
    });

    it('names() overrides a specific route name', () => {
      const router = new Router();
      router.resource('posts', FakeController).names({ index: 'posts.list' });
      expect(router.findByName('posts.list')).toBeDefined();
      expect(router.findByName('posts.index')).toBeUndefined();
    });

    it('middleware() adds middleware to all resource routes', () => {
      const router = new Router();
      router.resource('posts', FakeController).middleware('auth');
      for (const route of router.getRoutes()) {
        expect(route.middleware).toContain('auth');
      }
    });

    it('middlewareFor() adds middleware only to specified actions', () => {
      const router = new Router();
      router.resource('posts', FakeController).middlewareFor(['store', 'update'], 'auth');
      const storeRoute = router.getRoutes().find((r) => r.resourceAction === 'store');
      const indexRoute = router.getRoutes().find((r) => r.resourceAction === 'index');
      expect(storeRoute?.middleware).toContain('auth');
      expect(indexRoute?.middleware).not.toContain('auth');
    });

    it('withoutMiddlewareFor() adds to excludedMiddleware', () => {
      const router = new Router();
      router.resource('posts', FakeController).withoutMiddlewareFor('show', 'cache');
      const showRoute = router.getRoutes().find((r) => r.resourceAction === 'show');
      expect(showRoute?.excludedMiddleware).toContain('cache');
    });

    it('auto-registers named routes using resource name + action', () => {
      const router = new Router();
      router.resource('posts', FakeController);
      expect(router.findByName('posts.index')).toBeDefined();
      expect(router.findByName('posts.show')).toBeDefined();
      expect(router.findByName('posts.destroy')).toBeDefined();
    });
  });

  describe('nested resources', () => {
    it('generates correct nested paths', () => {
      const router = new Router();
      router.resource('posts.comments', FakeController);
      const paths = router.getRoutes().map((r) => r.path);
      expect(paths).toContain('/posts/:post/comments');
      expect(paths).toContain('/posts/:post/comments/:comment');
    });

    it('shallow() flattens member routes to top-level', () => {
      const router = new Router();
      router.resource('posts.comments', FakeController).shallow();
      const showRoute = router.getRoutes().find((r) => r.resourceAction === 'show');
      expect(showRoute?.path).toBe('/comments/:comment');
    });
  });

  describe('apiResource()', () => {
    it('generates 5 routes (no create/edit)', () => {
      const router = new Router();
      router.apiResource('posts', FakeController);
      expect(router.getRoutes()).toHaveLength(5);
      const actions = router.getRoutes().map((r) => r.resourceAction);
      expect(actions).not.toContain('create');
      expect(actions).not.toContain('edit');
    });
  });

  describe('singleton()', () => {
    it('generates show, edit, update routes', () => {
      const router = new Router();
      router.singleton('profile', FakeController);
      expect(router.getRoutes()).toHaveLength(3);
      const actions = router.getRoutes().map((r) => r.resourceAction);
      expect(actions).toContain('show');
      expect(actions).toContain('edit');
      expect(actions).toContain('update');
    });

    it('generates correct paths', () => {
      const router = new Router();
      router.singleton('profile', FakeController);
      const paths = router.getRoutes().map((r) => `${r.method} ${r.path}`);
      expect(paths).toContain('GET /profile');
      expect(paths).toContain('GET /profile/edit');
      expect(paths).toContain('PUT /profile');
    });

    it('creatable() adds create, store, destroy routes', () => {
      const router = new Router();
      router.singleton('profile', FakeController).creatable();
      const actions = router.getRoutes().map((r) => r.resourceAction);
      expect(actions).toContain('create');
      expect(actions).toContain('store');
      expect(actions).toContain('destroy');
    });

    it('auto-registers named routes', () => {
      const router = new Router();
      router.singleton('profile', FakeController);
      expect(router.findByName('profile.show')).toBeDefined();
      expect(router.findByName('profile.update')).toBeDefined();
    });
  });

  describe('apiSingleton()', () => {
    it('generates show and update routes only', () => {
      const router = new Router();
      router.apiSingleton('profile', FakeController);
      expect(router.getRoutes()).toHaveLength(2);
      const actions = router.getRoutes().map((r) => r.resourceAction);
      expect(actions).toContain('show');
      expect(actions).toContain('update');
      expect(actions).not.toContain('edit');
    });
  });

  describe('@Middleware decorator', () => {
    it('stores class-level middleware in reflect metadata', () => {
      @Middleware('auth')
      class AuthedController {
        index(_req: Request): Response {
          return Response.json({});
        }
      }
      const CTRL_MW_KEY = Symbol.for('faber:controller:middleware');
      const entries = Reflect.getMetadata(CTRL_MW_KEY, AuthedController) as Array<{ name: string }>;
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe('auth');
    });

    it('supports only/except filters on class-level decorator', () => {
      @Middleware('log', { only: ['index'] })
      class LoggedController {
        index(_req: Request): Response {
          return Response.json({});
        }
      }
      const CTRL_MW_KEY = Symbol.for('faber:controller:middleware');
      const entries = Reflect.getMetadata(CTRL_MW_KEY, LoggedController) as Array<{
        name: string;
        only?: string[];
      }>;
      expect(entries[0]?.only).toEqual(['index']);
    });

    it('stores method-level middleware in reflect metadata', () => {
      class PartialController {
        @Middleware('throttle')
        store(_req: Request): Response {
          return Response.json({});
        }
      }
      const METHOD_MW_KEY = Symbol.for('faber:method:middleware');
      const entries = Reflect.getMetadata(
        METHOD_MW_KEY,
        PartialController.prototype,
        'store',
      ) as Array<{ name: string }>;
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe('throttle');
    });
  });

  describe('model binding registration', () => {
    it('registers a model binding and retrieves via getExplicitBindings()', () => {
      class User {}
      const router = new Router();
      router.model('user', User as unknown as Constructor);
      const binding = router.getExplicitBindings().get('user');
      expect(binding?.kind).toBe('model');
      expect((binding as { kind: 'model'; klass: unknown })?.klass).toBe(User);
    });

    it('registers a model binding with custom column', () => {
      class Post {}
      const router = new Router();
      router.model('post', Post as unknown as Constructor, 'slug');
      const binding = router.getExplicitBindings().get('post');
      expect(binding?.kind).toBe('model');
      expect((binding as { kind: 'model'; column?: string })?.column).toBe('slug');
    });

    it('registers a resolver binding via bind()', () => {
      const resolver = (value: string): { id: string } => ({ id: value });
      const router = new Router();
      router.bind('widget', resolver as ModelBindingResolver);
      const binding = router.getExplicitBindings().get('widget');
      expect(binding?.kind).toBe('resolver');
    });

    it('explicit binding overrides by param name', () => {
      class V1 {}
      class V2 {}
      const router = new Router();
      router.model('item', V1 as unknown as Constructor);
      router.model('item', V2 as unknown as Constructor);
      const binding = router.getExplicitBindings().get('item');
      expect((binding as { kind: 'model'; klass: unknown })?.klass).toBe(V2);
    });
  });

  describe('@Authorize decorator', () => {
    it('stores ability and model in reflect metadata', () => {
      class PostController {
        @Authorize('view', 'post')
        show(_req: Request): Response {
          return Response.json({});
        }
      }
      const AUTHORIZE_KEY = Symbol.for('faber:authorize');
      const entries = Reflect.getMetadata(
        AUTHORIZE_KEY,
        PostController.prototype,
        'show',
      ) as Array<{ ability: string; model: unknown }>;
      expect(entries).toHaveLength(1);
      expect(entries[0]?.ability).toBe('view');
      expect(entries[0]?.model).toBe('post');
    });

    it('supports multiple @Authorize decorators on the same method', () => {
      class MultiController {
        @Authorize('create')
        @Authorize('view', 'post')
        index(_req: Request): Response {
          return Response.json({});
        }
      }
      const AUTHORIZE_KEY = Symbol.for('faber:authorize');
      const entries = Reflect.getMetadata(
        AUTHORIZE_KEY,
        MultiController.prototype,
        'index',
      ) as Array<{ ability: string }>;
      expect(entries).toHaveLength(2);
    });
  });
});
