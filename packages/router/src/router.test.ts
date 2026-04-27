import { describe, expect, it } from 'vitest';
import { Response } from '@faber-js/http';
import type { Request } from '@faber-js/http';
import { Router } from './router';

class FakeController {
  index(_req: Request): Response {
    return Response.json({ action: 'index' });
  }
  store(_req: Request): Response {
    return Response.json({ action: 'store' }, 201);
  }
  show(_req: Request): Response {
    return Response.json({ action: 'show' });
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
    it('generates 5 CRUD routes', () => {
      const router = new Router();
      router.resource('posts', FakeController);
      expect(router.getRoutes()).toHaveLength(5);
    });

    it('generates correct paths', () => {
      const router = new Router();
      router.resource('posts', FakeController);
      const paths = router.getRoutes().map((r) => `${r.method} ${r.path}`);
      expect(paths).toContain('GET /posts');
      expect(paths).toContain('POST /posts');
      expect(paths).toContain('GET /posts/:id');
      expect(paths).toContain('PUT /posts/:id');
      expect(paths).toContain('DELETE /posts/:id');
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
});
