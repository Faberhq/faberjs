import { describe, expect, it } from 'vitest';
import { Request } from './request';

const makeRequest = (overrides: Partial<ConstructorParameters<typeof Request>[0]> = {}): Request =>
  new Request({
    method: 'GET',
    path: '/test',
    ...overrides,
  });

describe('Request', () => {
  describe('input()', () => {
    it('reads from body', () => {
      const req = makeRequest({ method: 'POST', body: { name: 'Alice' } });
      expect(req.input('name')).toBe('Alice');
    });

    it('reads from query string', () => {
      const req = makeRequest({ query: { page: '2' } });
      expect(req.input('page')).toBe('2');
    });

    it('body takes precedence over query', () => {
      const req = makeRequest({ body: { key: 'body-value' }, query: { key: 'query-value' } });
      expect(req.input('key')).toBe('body-value');
    });

    it('returns fallback when key is absent', () => {
      const req = makeRequest();
      expect(req.input('missing', 'default')).toBe('default');
    });

    it('returns undefined fallback when nothing provided', () => {
      const req = makeRequest();
      expect(req.input('missing')).toBeUndefined();
    });
  });

  describe('all()', () => {
    it('merges body and query', () => {
      const req = makeRequest({ body: { name: 'Alice' }, query: { page: '1' } });
      expect(req.all()).toEqual({ name: 'Alice', page: '1' });
    });
  });

  describe('only()', () => {
    it('returns only specified keys', () => {
      const req = makeRequest({ body: { name: 'Alice', email: 'a@test.com', age: 30 } });
      expect(req.only('name', 'email')).toEqual({ name: 'Alice', email: 'a@test.com' });
    });

    it('omits keys that are not present', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      expect(req.only('name', 'missing')).toEqual({ name: 'Alice' });
    });
  });

  describe('except()', () => {
    it('returns input without excluded keys', () => {
      const req = makeRequest({ body: { name: 'Alice', password: 'secret' } });
      expect(req.except('password')).toEqual({ name: 'Alice' });
    });
  });

  describe('has()', () => {
    it('returns true when key exists', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      expect(req.has('name')).toBe(true);
    });

    it('returns false when key is absent', () => {
      const req = makeRequest();
      expect(req.has('missing')).toBe(false);
    });
  });

  describe('filled()', () => {
    it('returns false for missing key', () => {
      expect(makeRequest().filled('name')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(makeRequest({ body: { name: '' } }).filled('name')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(makeRequest({ body: { name: '   ' } }).filled('name')).toBe(false);
    });

    it('returns true for non-empty string', () => {
      expect(makeRequest({ body: { name: 'Alice' } }).filled('name')).toBe(true);
    });

    it('returns true for non-string truthy values', () => {
      expect(makeRequest({ body: { count: 0 } }).filled('count')).toBe(true);
    });
  });

  describe('bearerToken()', () => {
    it('extracts bearer token from Authorization header', () => {
      const req = makeRequest({ headers: { authorization: 'Bearer mytoken123' } });
      expect(req.bearerToken()).toBe('mytoken123');
    });

    it('is case-insensitive for "Bearer" prefix', () => {
      const req = makeRequest({ headers: { authorization: 'bearer mytoken123' } });
      expect(req.bearerToken()).toBe('mytoken123');
    });

    it('returns null when Authorization header is absent', () => {
      expect(makeRequest().bearerToken()).toBeNull();
    });

    it('returns null when header does not contain a bearer token', () => {
      const req = makeRequest({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });
      expect(req.bearerToken()).toBeNull();
    });
  });

  describe('isJson()', () => {
    it('returns true when Content-Type is application/json', () => {
      const req = makeRequest({ headers: { 'content-type': 'application/json' } });
      expect(req.isJson()).toBe(true);
    });

    it('returns false for non-JSON Content-Type', () => {
      const req = makeRequest({ headers: { 'content-type': 'text/html' } });
      expect(req.isJson()).toBe(false);
    });
  });

  describe('wantsJson()', () => {
    it('returns true when Accept includes application/json', () => {
      const req = makeRequest({ headers: { accept: 'application/json' } });
      expect(req.wantsJson()).toBe(true);
    });

    it('returns true for wildcard Accept', () => {
      const req = makeRequest({ headers: { accept: '*/*' } });
      expect(req.wantsJson()).toBe(true);
    });
  });

  describe('ip()', () => {
    it('returns the IP address', () => {
      const req = makeRequest({ ip: '192.168.1.100' });
      expect(req.ip()).toBe('192.168.1.100');
    });

    it('defaults to 127.0.0.1', () => {
      expect(makeRequest().ip()).toBe('127.0.0.1');
    });
  });

  describe('header()', () => {
    it('returns header value (case-insensitive)', () => {
      const req = makeRequest({ headers: { 'X-Custom': 'value' } });
      expect(req.header('x-custom')).toBe('value');
    });

    it('returns null for missing header', () => {
      expect(makeRequest().header('x-missing')).toBeNull();
    });

    it('returns first value for array headers', () => {
      const req = makeRequest({ headers: { accept: ['application/json', 'text/html'] } });
      expect(req.header('accept')).toBe('application/json');
    });
  });

  describe('route()', () => {
    it('returns route parameter', () => {
      const req = makeRequest({ params: { id: '42' } });
      expect(req.route('id')).toBe('42');
    });

    it('returns empty string for missing param', () => {
      expect(makeRequest().route('id')).toBe('');
    });
  });

  describe('method()', () => {
    it('normalizes method to uppercase', () => {
      expect(makeRequest({ method: 'post' }).method()).toBe('POST');
    });
  });
});
