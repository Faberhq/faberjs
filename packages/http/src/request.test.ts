import { describe, expect, it, vi } from 'vitest';
import { Request } from './request';
import type { SessionLike } from './types';

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

    it('merged input takes precedence over body', () => {
      const req = makeRequest({ body: { key: 'body-value' } });
      req.merge({ key: 'merged-value' });
      expect(req.input('key')).toBe('merged-value');
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

    it('includes merged input', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      req.merge({ role: 'admin' });
      expect(req.all()).toEqual({ name: 'Alice', role: 'admin' });
    });
  });

  describe('only()', () => {
    it('returns only specified keys (spread)', () => {
      const req = makeRequest({ body: { name: 'Alice', email: 'a@test.com', age: 30 } });
      expect(req.only('name', 'email')).toEqual({ name: 'Alice', email: 'a@test.com' });
    });

    it('returns only specified keys (array)', () => {
      const req = makeRequest({ body: { name: 'Alice', email: 'a@test.com', age: 30 } });
      expect(req.only(['name', 'email'])).toEqual({ name: 'Alice', email: 'a@test.com' });
    });

    it('omits keys that are not present', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      expect(req.only('name', 'missing')).toEqual({ name: 'Alice' });
    });
  });

  describe('except()', () => {
    it('returns input without excluded keys (spread)', () => {
      const req = makeRequest({ body: { name: 'Alice', password: 'secret' } });
      expect(req.except('password')).toEqual({ name: 'Alice' });
    });

    it('returns input without excluded keys (array)', () => {
      const req = makeRequest({ body: { name: 'Alice', password: 'secret' } });
      expect(req.except(['password'])).toEqual({ name: 'Alice' });
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

    it('returns true when all keys in array are present', () => {
      const req = makeRequest({ body: { name: 'Alice', email: 'a@b.com' } });
      expect(req.has(['name', 'email'])).toBe(true);
    });

    it('returns false when any key in array is missing', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      expect(req.has(['name', 'email'])).toBe(false);
    });
  });

  describe('hasAny()', () => {
    it('returns true when at least one key is present', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      expect(req.hasAny('name', 'email')).toBe(true);
    });

    it('returns true when given an array and at least one key is present', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      expect(req.hasAny(['name', 'email'])).toBe(true);
    });

    it('returns false when none of the keys are present', () => {
      const req = makeRequest();
      expect(req.hasAny('name', 'email')).toBe(false);
    });
  });

  describe('whenHas()', () => {
    it('executes callback when key is present', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      let called = false;
      req.whenHas('name', () => {
        called = true;
      });
      expect(called).toBe(true);
    });

    it('executes fallback when key is absent', () => {
      const req = makeRequest();
      let fell = false;
      req.whenHas('name', vi.fn(), () => {
        fell = true;
      });
      expect(fell).toBe(true);
    });

    it('passes the value to the callback', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      let received: unknown;
      req.whenHas('name', (v) => {
        received = v;
      });
      expect(received).toBe('Alice');
    });

    it('is chainable', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      expect(req.whenHas('name', vi.fn())).toBe(req);
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

  describe('isNotFilled()', () => {
    it('returns true for missing key', () => {
      expect(makeRequest().isNotFilled('name')).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(makeRequest({ body: { name: '' } }).isNotFilled('name')).toBe(true);
    });

    it('returns false for non-empty value', () => {
      expect(makeRequest({ body: { name: 'Alice' } }).isNotFilled('name')).toBe(false);
    });

    it('returns true when all keys in array are empty', () => {
      const req = makeRequest({ body: { name: '', email: '' } });
      expect(req.isNotFilled(['name', 'email'])).toBe(true);
    });

    it('returns false when any key in array has a value', () => {
      const req = makeRequest({ body: { name: 'Alice', email: '' } });
      expect(req.isNotFilled(['name', 'email'])).toBe(false);
    });
  });

  describe('anyFilled()', () => {
    it('returns true when at least one key has a non-empty value', () => {
      const req = makeRequest({ body: { name: 'Alice', email: '' } });
      expect(req.anyFilled(['name', 'email'])).toBe(true);
    });

    it('returns false when all keys are empty', () => {
      const req = makeRequest({ body: { name: '' } });
      expect(req.anyFilled(['name', 'email'])).toBe(false);
    });
  });

  describe('whenFilled()', () => {
    it('executes callback when value is non-empty', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      let called = false;
      req.whenFilled('name', () => {
        called = true;
      });
      expect(called).toBe(true);
    });

    it('executes fallback when value is empty', () => {
      const req = makeRequest({ body: { name: '' } });
      let fell = false;
      req.whenFilled('name', vi.fn(), () => {
        fell = true;
      });
      expect(fell).toBe(true);
    });

    it('is chainable', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      expect(req.whenFilled('name', vi.fn())).toBe(req);
    });
  });

  describe('missing()', () => {
    it('returns true when key is absent', () => {
      expect(makeRequest().missing('name')).toBe(true);
    });

    it('returns false when key is present', () => {
      expect(makeRequest({ body: { name: 'Alice' } }).missing('name')).toBe(false);
    });
  });

  describe('whenMissing()', () => {
    it('executes callback when key is absent', () => {
      const req = makeRequest();
      let called = false;
      req.whenMissing('name', () => {
        called = true;
      });
      expect(called).toBe(true);
    });

    it('executes fallback when key is present', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      let fell = false;
      req.whenMissing('name', vi.fn(), () => {
        fell = true;
      });
      expect(fell).toBe(true);
    });

    it('is chainable', () => {
      expect(makeRequest().whenMissing('name', vi.fn())).toBeInstanceOf(Request);
    });
  });

  describe('merge()', () => {
    it('adds new keys to input', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      req.merge({ role: 'admin' });
      expect(req.input('role')).toBe('admin');
    });

    it('overwrites existing keys', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      req.merge({ name: 'Bob' });
      expect(req.input('name')).toBe('Bob');
    });

    it('is chainable', () => {
      const req = makeRequest();
      expect(req.merge({ a: 1 })).toBe(req);
    });
  });

  describe('mergeIfMissing()', () => {
    it('adds keys that are not present', () => {
      const req = makeRequest({ body: { name: 'Alice' } });
      req.mergeIfMissing({ role: 'user', name: 'ignored' });
      expect(req.input('role')).toBe('user');
      expect(req.input('name')).toBe('Alice');
    });

    it('is chainable', () => {
      const req = makeRequest();
      expect(req.mergeIfMissing({ a: 1 })).toBe(req);
    });
  });

  describe('string()', () => {
    it('returns string value', () => {
      expect(makeRequest({ body: { name: 'Alice' } }).string('name')).toBe('Alice');
    });

    it('converts non-string values to string', () => {
      expect(makeRequest({ body: { count: 42 } }).string('count')).toBe('42');
    });

    it('returns empty string for missing key', () => {
      expect(makeRequest().string('name')).toBe('');
    });

    it('returns custom fallback for missing key', () => {
      expect(makeRequest().string('name', 'fallback')).toBe('fallback');
    });
  });

  describe('integer()', () => {
    it('returns parsed integer', () => {
      expect(makeRequest({ body: { page: '3' } }).integer('page')).toBe(3);
    });

    it('returns 0 for missing key', () => {
      expect(makeRequest().integer('page')).toBe(0);
    });

    it('returns custom fallback for missing key', () => {
      expect(makeRequest().integer('page', 10)).toBe(10);
    });

    it('returns fallback for unparseable value', () => {
      expect(makeRequest({ body: { page: 'abc' } }).integer('page', 1)).toBe(1);
    });

    it('truncates floats', () => {
      expect(makeRequest({ body: { n: '3.9' } }).integer('n')).toBe(3);
    });
  });

  describe('boolean()', () => {
    it.each([
      ['1', true],
      ['true', true],
      ['on', true],
      ['yes', true],
      [true, true],
      ['0', false],
      ['false', false],
      ['no', false],
      [false, false],
    ])('coerces %s to %s', (raw, expected) => {
      expect(makeRequest({ body: { v: raw } }).boolean('v')).toBe(expected);
    });

    it('returns false for missing key', () => {
      expect(makeRequest().boolean('v')).toBe(false);
    });
  });

  describe('array()', () => {
    it('wraps scalar in array', () => {
      expect(makeRequest({ body: { tag: 'a' } }).array('tag')).toEqual(['a']);
    });

    it('returns existing array as-is', () => {
      expect(makeRequest({ body: { tags: ['a', 'b'] } }).array('tags')).toEqual(['a', 'b']);
    });

    it('returns empty array for missing key', () => {
      expect(makeRequest().array('tags')).toEqual([]);
    });
  });

  describe('date()', () => {
    it('returns a Date for a valid date string', () => {
      const d = makeRequest({ body: { dob: '2000-01-15' } }).date('dob');
      expect(d).toBeInstanceOf(Date);
      expect((d as Date).getFullYear()).toBe(2000);
    });

    it('returns null for missing key', () => {
      expect(makeRequest().date('dob')).toBeNull();
    });

    it('throws for an invalid date string', () => {
      expect(() => makeRequest({ body: { dob: 'not-a-date' } }).date('dob')).toThrow();
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
    it('returns true when Accept prefers application/json', () => {
      const req = makeRequest({ headers: { accept: 'application/json' } });
      expect(req.wantsJson()).toBe(true);
    });

    it('returns false when Accept is only wildcard', () => {
      const req = makeRequest({ headers: { accept: '*/*' } });
      expect(req.wantsJson()).toBe(false);
    });

    it('returns false when Accept prefers text/html', () => {
      const req = makeRequest({ headers: { accept: 'text/html,application/json;q=0.9' } });
      expect(req.wantsJson()).toBe(false);
    });
  });

  describe('expectsJson()', () => {
    it('returns true when Content-Type is JSON', () => {
      const req = makeRequest({ headers: { 'content-type': 'application/json' } });
      expect(req.expectsJson()).toBe(true);
    });

    it('returns true when Accept includes application/json', () => {
      const req = makeRequest({ headers: { accept: 'application/json' } });
      expect(req.expectsJson()).toBe(true);
    });

    it('returns true when Accept is wildcard (accepts anything including JSON)', () => {
      const req = makeRequest({ headers: { accept: '*/*' } });
      expect(req.expectsJson()).toBe(true);
    });

    it('returns false for plain text/html Accept with no JSON body', () => {
      const req = makeRequest({ headers: { accept: 'text/html' } });
      expect(req.expectsJson()).toBe(false);
    });
  });

  describe('getAcceptableContentTypes()', () => {
    it('returns all accepted types sorted by quality', () => {
      const req = makeRequest({
        headers: { accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
      });
      const types = req.getAcceptableContentTypes();
      expect(types[0]).toBe('text/html');
      expect(types).toContain('application/json');
      expect(types).toContain('*/*');
    });

    it('returns ["*/*"] when no Accept header', () => {
      expect(makeRequest().getAcceptableContentTypes()).toEqual(['*/*']);
    });
  });

  describe('accepts()', () => {
    it('returns true when type is in Accept header', () => {
      const req = makeRequest({ headers: { accept: 'application/json' } });
      expect(req.accepts(['application/json'])).toBe(true);
    });

    it('returns true when Accept is wildcard', () => {
      const req = makeRequest({ headers: { accept: '*/*' } });
      expect(req.accepts(['text/html'])).toBe(true);
    });

    it('returns false when type is not accepted', () => {
      const req = makeRequest({ headers: { accept: 'text/html' } });
      expect(req.accepts(['application/json'])).toBe(false);
    });
  });

  describe('prefers()', () => {
    it('returns the most preferred type from the given list', () => {
      const req = makeRequest({
        headers: { accept: 'application/json,text/html;q=0.9' },
      });
      expect(req.prefers(['text/html', 'application/json'])).toBe('application/json');
    });

    it('returns null when none of the types are acceptable', () => {
      const req = makeRequest({ headers: { accept: 'text/html' } });
      expect(req.prefers(['application/json'])).toBeNull();
    });
  });

  describe('wantsMarkdown()', () => {
    it('returns true when most preferred type is text/markdown', () => {
      const req = makeRequest({ headers: { accept: 'text/markdown' } });
      expect(req.wantsMarkdown()).toBe(true);
    });

    it('returns false when markdown is not the top preference', () => {
      const req = makeRequest({ headers: { accept: 'text/html,text/markdown;q=0.9' } });
      expect(req.wantsMarkdown()).toBe(false);
    });
  });

  describe('acceptsMarkdown()', () => {
    it('returns true when markdown is in the accepted types', () => {
      const req = makeRequest({ headers: { accept: 'text/html,text/markdown;q=0.5' } });
      expect(req.acceptsMarkdown()).toBe(true);
    });

    it('returns false when markdown is not accepted', () => {
      const req = makeRequest({ headers: { accept: 'text/html' } });
      expect(req.acceptsMarkdown()).toBe(false);
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

  describe('ips()', () => {
    it('returns proxy chain IPs with direct IP last', () => {
      const req = makeRequest({
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
      });
      expect(req.ips()).toEqual(['203.0.113.1', '198.51.100.1', '10.0.0.1']);
    });

    it('returns only direct IP when no X-Forwarded-For header', () => {
      expect(makeRequest({ ip: '10.0.0.1' }).ips()).toEqual(['10.0.0.1']);
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

    it('returns fallback when header is missing', () => {
      expect(makeRequest().header('x-missing', 'default')).toBe('default');
    });
  });

  describe('hasHeader()', () => {
    it('returns true when header is present', () => {
      const req = makeRequest({ headers: { 'x-custom': 'value' } });
      expect(req.hasHeader('x-custom')).toBe(true);
    });

    it('returns false when header is absent', () => {
      expect(makeRequest().hasHeader('x-custom')).toBe(false);
    });
  });

  describe('path()', () => {
    it('returns request path', () => {
      expect(makeRequest({ path: '/users/42' }).path()).toBe('/users/42');
    });
  });

  describe('url()', () => {
    it('returns the raw URL including query string', () => {
      const req = makeRequest({ path: '/users', url: '/users?page=2' });
      expect(req.url()).toBe('/users?page=2');
    });
  });

  describe('fullUrl()', () => {
    it('returns absolute URL with scheme, host and query string', () => {
      const req = makeRequest({
        scheme: 'https',
        path: '/users',
        url: '/users?page=2',
        headers: { host: 'example.com' },
      });
      expect(req.fullUrl()).toBe('https://example.com/users?page=2');
    });
  });

  describe('fullUrlWithQuery()', () => {
    it('merges new params into the current URL', () => {
      const req = makeRequest({
        scheme: 'http',
        path: '/users',
        url: '/users?sort=name',
        headers: { host: 'example.com' },
      });
      const result = req.fullUrlWithQuery({ page: '2' });
      expect(result).toContain('sort=name');
      expect(result).toContain('page=2');
      expect(result.startsWith('http://example.com')).toBe(true);
    });

    it('overwrites an existing param', () => {
      const req = makeRequest({
        scheme: 'http',
        path: '/users',
        url: '/users?page=1',
        headers: { host: 'example.com' },
      });
      expect(req.fullUrlWithQuery({ page: '3' })).toContain('page=3');
      expect(req.fullUrlWithQuery({ page: '3' })).not.toContain('page=1');
    });
  });

  describe('fullUrlWithoutQuery()', () => {
    it('removes specified query params', () => {
      const req = makeRequest({
        scheme: 'http',
        path: '/users',
        url: '/users?page=1&sort=name',
        headers: { host: 'example.com' },
      });
      const result = req.fullUrlWithoutQuery(['page']);
      expect(result).not.toContain('page');
      expect(result).toContain('sort=name');
    });
  });

  describe('host()', () => {
    it('returns hostname without port', () => {
      expect(makeRequest({ headers: { host: 'example.com:8080' } }).host()).toBe('example.com');
    });

    it('returns hostname when no port is present', () => {
      expect(makeRequest({ headers: { host: 'example.com' } }).host()).toBe('example.com');
    });
  });

  describe('httpHost()', () => {
    it('returns host header value as-is', () => {
      expect(makeRequest({ headers: { host: 'example.com:8080' } }).httpHost()).toBe(
        'example.com:8080',
      );
    });
  });

  describe('schemeAndHttpHost()', () => {
    it('returns scheme + host', () => {
      const req = makeRequest({ scheme: 'https', headers: { host: 'example.com' } });
      expect(req.schemeAndHttpHost()).toBe('https://example.com');
    });

    it('defaults to http scheme', () => {
      expect(makeRequest({ headers: { host: 'example.com' } }).schemeAndHttpHost()).toBe(
        'http://example.com',
      );
    });
  });

  describe('isMethod()', () => {
    it('returns true for matching method (case-insensitive)', () => {
      expect(makeRequest({ method: 'POST' }).isMethod('post')).toBe(true);
      expect(makeRequest({ method: 'post' }).isMethod('POST')).toBe(true);
    });

    it('returns false for non-matching method', () => {
      expect(makeRequest({ method: 'GET' }).isMethod('POST')).toBe(false);
    });
  });

  describe('is()', () => {
    it('matches exact path', () => {
      expect(makeRequest({ path: '/admin/users' }).is('admin/users')).toBe(true);
    });

    it('matches path with leading slash', () => {
      expect(makeRequest({ path: '/admin/users' }).is('/admin/users')).toBe(true);
    });

    it('matches wildcard pattern', () => {
      expect(makeRequest({ path: '/admin/users' }).is('admin/*')).toBe(true);
    });

    it('does not match unrelated path', () => {
      expect(makeRequest({ path: '/api/users' }).is('admin/*')).toBe(false);
    });

    it('accepts multiple patterns', () => {
      expect(makeRequest({ path: '/api/users' }).is('admin/*', 'api/*')).toBe(true);
    });

    it('accepts array of patterns', () => {
      expect(makeRequest({ path: '/api/users' }).is(['admin/*', 'api/*'])).toBe(true);
    });
  });

  describe('routeIs()', () => {
    it('returns false when route has no name', () => {
      expect(makeRequest().routeIs('users.index')).toBe(false);
    });

    it('matches exact route name', () => {
      const req = makeRequest();
      req.setCurrentRoute({
        method: 'GET',
        path: '/users',
        handler: () => {
          throw new Error('stub');
        },
        middleware: [],
        constraints: {},
        name: 'users.index',
      });
      expect(req.routeIs('users.index')).toBe(true);
    });

    it('matches wildcard route name pattern', () => {
      const req = makeRequest();
      req.setCurrentRoute({
        method: 'GET',
        path: '/users',
        handler: () => {
          throw new Error('stub');
        },
        middleware: [],
        constraints: {},
        name: 'users.index',
      });
      expect(req.routeIs('users.*')).toBe(true);
    });

    it('does not match unrelated pattern', () => {
      const req = makeRequest();
      req.setCurrentRoute({
        method: 'GET',
        path: '/users',
        handler: () => {
          throw new Error('stub');
        },
        middleware: [],
        constraints: {},
        name: 'users.index',
      });
      expect(req.routeIs('admin.*')).toBe(false);
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

  describe('setAttribute / getAttribute / hasAttribute', () => {
    it('stores and retrieves an arbitrary value', () => {
      const req = makeRequest();
      req.setAttribute('tenant', { id: 1, name: 'Acme' });
      expect(req.getAttribute('tenant')).toEqual({ id: 1, name: 'Acme' });
    });

    it('returns undefined for a missing key', () => {
      expect(makeRequest().getAttribute('missing')).toBeUndefined();
    });

    it('returns the fallback for a missing key', () => {
      expect(makeRequest().getAttribute('missing', 'default')).toBe('default');
    });

    it('hasAttribute returns false before set, true after', () => {
      const req = makeRequest();
      expect(req.hasAttribute('plan')).toBe(false);
      req.setAttribute('plan', 'pro');
      expect(req.hasAttribute('plan')).toBe(true);
    });

    it('setAttribute is chainable', () => {
      const req = makeRequest();
      req.setAttribute('a', 1).setAttribute('b', 2);
      expect(req.getAttribute('a')).toBe(1);
      expect(req.getAttribute('b')).toBe(2);
    });

    it('typed getAttribute narrows the return type', () => {
      const req = makeRequest();
      req.setAttribute('count', 42);
      const count = req.getAttribute<number>('count');
      expect(count).toBe(42);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase B: session, flash & cookies
  // ---------------------------------------------------------------------------

  function makeSessionMock(store: Record<string, unknown> = {}): SessionLike {
    return {
      flash(key: string, value: unknown) {
        store[key] = value;
        return this;
      },
      get<T = unknown>(key: string, defaultValue?: T): T | undefined {
        return (key in store ? store[key] : defaultValue) as T | undefined;
      },
    };
  }

  describe('session()', () => {
    it('returns null when no session is attached', () => {
      expect(makeRequest().session()).toBeNull();
    });

    it('returns the session stored under the "session" attribute', () => {
      const req = makeRequest();
      const s = makeSessionMock();
      req.setAttribute('session', s);
      expect(req.session()).toBe(s);
    });
  });

  describe('flash()', () => {
    it('flashes all current input to the session', () => {
      const req = makeRequest({ body: { name: 'Alice', email: 'a@b.com' } });
      const store: Record<string, unknown> = {};
      req.setAttribute('session', makeSessionMock(store));
      req.flash();
      expect(store).toMatchObject({ name: 'Alice', email: 'a@b.com' });
    });

    it('does nothing when no session is attached', () => {
      expect(() => makeRequest({ body: { name: 'Alice' } }).flash()).not.toThrow();
    });
  });

  describe('flashOnly()', () => {
    it('flashes only the specified keys', () => {
      const req = makeRequest({ body: { name: 'Alice', password: 'secret' } });
      const store: Record<string, unknown> = {};
      req.setAttribute('session', makeSessionMock(store));
      req.flashOnly(['name']);
      expect(store).toHaveProperty('name', 'Alice');
      expect(store).not.toHaveProperty('password');
    });

    it('does nothing when no session is attached', () => {
      expect(() => makeRequest().flashOnly(['name'])).not.toThrow();
    });
  });

  describe('flashExcept()', () => {
    it('flashes all input except the specified keys', () => {
      const req = makeRequest({ body: { name: 'Alice', password: 'secret' } });
      const store: Record<string, unknown> = {};
      req.setAttribute('session', makeSessionMock(store));
      req.flashExcept(['password']);
      expect(store).toHaveProperty('name', 'Alice');
      expect(store).not.toHaveProperty('password');
    });

    it('does nothing when no session is attached', () => {
      expect(() => makeRequest().flashExcept(['password'])).not.toThrow();
    });
  });

  describe('old()', () => {
    it('reads a previously flashed value from the session', () => {
      const req = makeRequest();
      req.setAttribute('session', makeSessionMock({ username: 'alice' }));
      expect(req.old('username')).toBe('alice');
    });

    it('returns the defaultValue when the key was not flashed', () => {
      const req = makeRequest();
      req.setAttribute('session', makeSessionMock({}));
      expect(req.old('missing', 'fallback')).toBe('fallback');
    });

    it('returns undefined when no session is attached', () => {
      expect(makeRequest().old('username')).toBeUndefined();
    });
  });

  describe('cookie()', () => {
    it('reads a cookie value from the Cookie header', () => {
      const req = makeRequest({ headers: { cookie: 'session_id=abc123; theme=dark' } });
      expect(req.cookie('session_id')).toBe('abc123');
      expect(req.cookie('theme')).toBe('dark');
    });

    it('returns undefined when the cookie is not present', () => {
      expect(makeRequest().cookie('missing')).toBeUndefined();
    });

    it('returns the fallback when the cookie is not present', () => {
      expect(makeRequest().cookie('missing', 'default')).toBe('default');
    });

    it('handles URL-encoded cookie names and values', () => {
      const req = makeRequest({
        headers: { cookie: 'my%20key=hello%20world' },
      });
      expect(req.cookie('my key')).toBe('hello world');
    });

    it('returns undefined when Cookie header is absent', () => {
      expect(makeRequest().cookie('any')).toBeUndefined();
    });
  });
});
