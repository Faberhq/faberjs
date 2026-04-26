import { describe, expect, it } from 'vitest';
import type { Response } from '@faberjs/http';
import { Controller } from './controller';

class TestController extends Controller {
  makeJson(data: unknown, status?: number): Response {
    return status !== undefined ? this.json(data, status) : this.json(data);
  }
  makeRedirect(url: string, status?: number): Response {
    return status !== undefined ? this.redirect(url, status) : this.redirect(url);
  }
  makeNoContent(): Response {
    return this.noContent();
  }
}

describe('Controller', () => {
  const ctrl = new TestController();

  describe('json()', () => {
    it('returns a 200 JSON response by default', () => {
      const res = ctrl.makeJson({ hello: 'world' });
      expect(res.getStatus()).toBe(200);
      expect(res.getBody()).toEqual({ hello: 'world' });
    });

    it('accepts a custom status code', () => {
      const res = ctrl.makeJson({ id: 1 }, 201);
      expect(res.getStatus()).toBe(201);
    });
  });

  describe('redirect()', () => {
    it('returns a 302 redirect by default', () => {
      const res = ctrl.makeRedirect('/dashboard');
      expect(res.getStatus()).toBe(302);
      expect(res.getHeaders()['location']).toBe('/dashboard');
    });

    it('accepts a custom status code', () => {
      const res = ctrl.makeRedirect('/home', 301);
      expect(res.getStatus()).toBe(301);
    });
  });

  describe('noContent()', () => {
    it('returns a 204 response', () => {
      expect(ctrl.makeNoContent().getStatus()).toBe(204);
    });
  });
});
