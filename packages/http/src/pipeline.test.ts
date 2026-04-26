import { describe, expect, it, vi } from 'vitest';
import { Pipeline } from './pipeline';
import { Request } from './request';
import { Response } from './response';
import type { Middleware, NextFunction } from './types';

const makeRequest = (): Request => new Request({ method: 'GET', path: '/test' });
const okResponse = (): Promise<Response> => Promise.resolve(Response.json({ ok: true }));

const makeMiddleware = (
  fn: (req: Request, next: NextFunction) => Promise<Response>,
): Middleware => ({ handle: fn });

describe('Pipeline', () => {
  describe('send()', () => {
    it('reaches the destination when no middleware is present', async () => {
      const destination = vi.fn(okResponse);
      const pipeline = new Pipeline([], destination);
      const res = await pipeline.send(makeRequest());

      expect(destination).toHaveBeenCalledOnce();
      expect(res.getStatus()).toBe(200);
    });

    it('runs middleware in order before the destination', async () => {
      const order: number[] = [];
      const mw1 = makeMiddleware(async (req, next) => {
        order.push(1);
        const res = await next(req);
        order.push(4);
        return res;
      });
      const mw2 = makeMiddleware(async (req, next) => {
        order.push(2);
        const res = await next(req);
        order.push(3);
        return res;
      });

      const pipeline = new Pipeline([mw1, mw2], (_req) => {
        order.push(0);
        return okResponse();
      });

      await pipeline.send(makeRequest());
      expect(order).toEqual([1, 2, 0, 3, 4]);
    });

    it('allows middleware to short-circuit without calling next', async () => {
      const destination = vi.fn(okResponse);
      const guard = makeMiddleware(async (_req, _next) => Response.error('Unauthorized', 401));

      const pipeline = new Pipeline([guard], destination);
      const res = await pipeline.send(makeRequest());

      expect(destination).not.toHaveBeenCalled();
      expect(res.getStatus()).toBe(401);
    });

    it('allows middleware to modify the request before passing it along', async () => {
      let seenUser: unknown = null;
      const setUser = makeMiddleware(async (req, next) => {
        req.user = { id: 99 };
        return next(req);
      });
      const destination = (req: Request): Promise<Response> => {
        seenUser = req.user;
        return okResponse();
      };

      await new Pipeline([setUser], destination).send(makeRequest());
      expect(seenUser).toEqual({ id: 99 });
    });

    it('allows middleware to transform the response', async () => {
      const addHeader = makeMiddleware(async (req, next) => {
        const res = await next(req);
        expect(res).toBeInstanceOf(Response);
        return Response.json({ wrapped: true }, res.getStatus());
      });

      const pipeline = new Pipeline([addHeader], okResponse);
      const res = await pipeline.send(makeRequest());
      expect(res.getBody()).toEqual({ wrapped: true });
    });
  });
});
