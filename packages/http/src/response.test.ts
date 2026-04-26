import { describe, expect, it } from 'vitest';
import { Response, ResponseFactory, response } from './response';

describe('Response', () => {
  describe('json()', () => {
    it('creates a 200 JSON response by default', () => {
      const res = Response.json({ data: [1, 2] });
      expect(res.getStatus()).toBe(200);
      expect(res.getBody()).toEqual({ data: [1, 2] });
      expect(res.getHeaders()['content-type']).toBe('application/json');
    });

    it('accepts a custom status code', () => {
      const res = Response.json({ id: 1 }, 201);
      expect(res.getStatus()).toBe(201);
    });
  });

  describe('noContent()', () => {
    it('creates a 204 response with no body', () => {
      const res = Response.noContent();
      expect(res.getStatus()).toBe(204);
      expect(res.getBody()).toBeNull();
    });
  });

  describe('notFound()', () => {
    it('creates a 404 response with default message', () => {
      const res = Response.notFound();
      expect(res.getStatus()).toBe(404);
      expect(res.getBody()).toEqual({ message: 'Not Found' });
    });

    it('accepts a custom message', () => {
      const res = Response.notFound('User not found');
      expect(res.getBody()).toEqual({ message: 'User not found' });
    });
  });

  describe('error()', () => {
    it('creates a 500 response by default', () => {
      const res = Response.error('Boom');
      expect(res.getStatus()).toBe(500);
      expect(res.getBody()).toEqual({ message: 'Boom' });
    });

    it('accepts a custom status code', () => {
      const res = Response.error('Unauthorized', 401);
      expect(res.getStatus()).toBe(401);
    });
  });

  describe('redirect()', () => {
    it('creates a 302 redirect with location header', () => {
      const res = Response.redirect('/login');
      expect(res.getStatus()).toBe(302);
      expect(res.getHeaders()['location']).toBe('/login');
    });

    it('accepts a custom status code', () => {
      const res = Response.redirect('/home', 301);
      expect(res.getStatus()).toBe(301);
    });
  });
});

describe('ResponseFactory', () => {
  it('delegates json() to Response.json()', () => {
    const factory = new ResponseFactory();
    const res = factory.json({ ok: true }, 201);
    expect(res.getStatus()).toBe(201);
    expect(res.getBody()).toEqual({ ok: true });
  });

  it('delegates noContent() to Response.noContent()', () => {
    expect(new ResponseFactory().noContent().getStatus()).toBe(204);
  });

  it('delegates notFound() without message', () => {
    expect(new ResponseFactory().notFound().getStatus()).toBe(404);
  });

  it('delegates redirect() to Response.redirect()', () => {
    const res = new ResponseFactory().redirect('/dashboard');
    expect(res.getStatus()).toBe(302);
  });
});

describe('response()', () => {
  it('returns a ResponseFactory instance', () => {
    expect(response()).toBeInstanceOf(ResponseFactory);
  });

  it('can build a json response via factory', () => {
    const res = response().json({ hello: 'world' });
    expect(res.getStatus()).toBe(200);
    expect(res.getBody()).toEqual({ hello: 'world' });
  });
});
