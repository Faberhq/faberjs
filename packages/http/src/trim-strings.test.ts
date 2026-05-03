import { describe, expect, it, vi } from 'vitest';
import { Request } from './request';
import { TrimStrings } from './trim-strings';
import { Response } from './response';

function makeRequest(
  body: Record<string, unknown> = {},
  query: Record<string, string> = {},
): Request {
  return new Request({ method: 'POST', path: '/test', body, query });
}

const noop = (): Promise<Response> => Promise.resolve(Response.json(null));

describe('TrimStrings', () => {
  it('trims whitespace from string values in the body', async () => {
    const req = makeRequest({ name: '  Alice  ', email: ' a@b.com ' });
    await new TrimStrings().handle(req, noop);
    expect(req.input('name')).toBe('Alice');
    expect(req.input('email')).toBe('a@b.com');
  });

  it('trims string values in the query string', async () => {
    const req = makeRequest({}, { search: '  hello  ' });
    await new TrimStrings().handle(req, noop);
    expect(req.input('search')).toBe('hello');
  });

  it('leaves non-string values untouched', async () => {
    const req = makeRequest({ count: 42, active: true, data: null });
    await new TrimStrings().handle(req, noop);
    expect(req.input('count')).toBe(42);
    expect(req.input('active')).toBe(true);
    expect(req.input('data')).toBeNull();
  });

  it('trims strings inside arrays', async () => {
    const req = makeRequest({ tags: ['  a  ', '  b  ', '  c  '] });
    await new TrimStrings().handle(req, noop);
    expect(req.array('tags')).toEqual(['a', 'b', 'c']);
  });

  it('trims strings inside nested objects', async () => {
    const req = makeRequest({ address: { city: '  Paris  ', zip: '  75001  ' } });
    await new TrimStrings().handle(req, noop);
    expect(req.input('address')).toEqual({ city: 'Paris', zip: '75001' });
  });

  it('does not trim keys in the except list', async () => {
    const req = makeRequest({ name: '  Alice  ', password: '  secret  ' });
    await new TrimStrings().handle(req, noop);
    expect(req.input('name')).toBe('Alice');
    expect(req.input('password')).toBe('  secret  ');
  });

  it('respects a custom except list', async () => {
    const req = makeRequest({ name: '  Alice  ', api_key: '  key123  ' });
    await new TrimStrings(['api_key']).handle(req, noop);
    expect(req.input('name')).toBe('Alice');
    expect(req.input('api_key')).toBe('  key123  ');
  });

  it('converts whitespace-only strings to empty string', async () => {
    const req = makeRequest({ title: '   ' });
    await new TrimStrings().handle(req, noop);
    expect(req.input('title')).toBe('');
  });

  it('calls next and returns its response', async () => {
    const req = makeRequest({ name: 'Alice' });
    const expected = Response.json({ ok: true });
    const next = vi.fn().mockResolvedValue(expected);
    const result = await new TrimStrings().handle(req, next);
    expect(next).toHaveBeenCalledWith(req);
    expect(result).toBe(expected);
  });
});
