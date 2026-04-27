import { describe, expect, it } from 'vitest';
import { TestResponse } from './test-response';

function makeResponse(
  status: number,
  body: unknown,
  contentType = 'application/json',
): TestResponse {
  return new TestResponse(status, body, { 'content-type': contentType });
}

describe('TestResponse', () => {
  describe('status()', () => {
    it('returns the HTTP status code', () => {
      expect(makeResponse(200, null).status()).toBe(200);
    });
  });

  describe('json()', () => {
    it('returns the parsed body', () => {
      const body = { id: 1, name: 'Alice' };
      expect(makeResponse(200, body).json()).toEqual(body);
    });
  });

  describe('header()', () => {
    it('returns the header value', () => {
      const res = new TestResponse(200, null, { 'x-custom': 'hello' });
      expect(res.header('x-custom')).toBe('hello');
    });

    it('returns undefined for missing headers', () => {
      expect(makeResponse(200, null).header('x-missing')).toBeUndefined();
    });
  });

  describe('assertStatus()', () => {
    it('passes when status matches', () => {
      expect(() => makeResponse(201, null).assertStatus(201)).not.toThrow();
    });

    it('throws when status does not match', () => {
      expect(() => makeResponse(200, null).assertStatus(201)).toThrow(
        'Expected HTTP status 201 but received 200',
      );
    });

    it('is chainable', () => {
      const res = makeResponse(200, null);
      expect(res.assertStatus(200)).toBe(res);
    });
  });

  describe('status assertion helpers', () => {
    it('assertOk passes on 200', () => {
      expect(() => makeResponse(200, null).assertOk()).not.toThrow();
    });

    it('assertCreated passes on 201', () => {
      expect(() => makeResponse(201, null).assertCreated()).not.toThrow();
    });

    it('assertNoContent passes on 204', () => {
      expect(() => makeResponse(204, null).assertNoContent()).not.toThrow();
    });

    it('assertNotFound passes on 404', () => {
      expect(() => makeResponse(404, null).assertNotFound()).not.toThrow();
    });

    it('assertUnauthorized passes on 401', () => {
      expect(() => makeResponse(401, null).assertUnauthorized()).not.toThrow();
    });

    it('assertForbidden passes on 403', () => {
      expect(() => makeResponse(403, null).assertForbidden()).not.toThrow();
    });

    it('assertUnprocessable passes on 422', () => {
      expect(() => makeResponse(422, null).assertUnprocessable()).not.toThrow();
    });
  });

  describe('assertJsonPath()', () => {
    it('passes when the value at the path matches', () => {
      const body = { data: { email: 'alice@example.com' } };
      expect(() =>
        makeResponse(200, body).assertJsonPath('data.email', 'alice@example.com'),
      ).not.toThrow();
    });

    it('throws when the value does not match', () => {
      const body = { data: { email: 'alice@example.com' } };
      expect(() => makeResponse(200, body).assertJsonPath('data.email', 'bob@example.com')).toThrow(
        'Expected "bob@example.com" at path "data.email" but found "alice@example.com"',
      );
    });

    it('throws when the path does not exist', () => {
      const body = { data: null };
      expect(() => makeResponse(200, body).assertJsonPath('data.email', 'x')).toThrow(
        'Path "data.email" not found',
      );
    });
  });

  describe('assertJson()', () => {
    it('passes when all subset keys match', () => {
      const body = { id: 1, name: 'Alice', email: 'alice@example.com' };
      expect(() => makeResponse(200, body).assertJson({ name: 'Alice' })).not.toThrow();
    });

    it('throws when a key does not match', () => {
      const body = { name: 'Alice' };
      expect(() => makeResponse(200, body).assertJson({ name: 'Bob' })).toThrow(
        'Expected response to contain "name"',
      );
    });

    it('throws when body is not an object', () => {
      expect(() => makeResponse(200, 'plain text').assertJson({ key: 'val' })).toThrow(
        'Response body is not a JSON object',
      );
    });
  });
});
