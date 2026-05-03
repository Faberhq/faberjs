import { describe, expect, it, vi } from 'vitest';
import { Request } from './request';
import { ConvertEmptyStringsToNull } from './convert-empty-strings-to-null';
import { Response } from './response';

function makeRequest(
  body: Record<string, unknown> = {},
  query: Record<string, string> = {},
): Request {
  return new Request({ method: 'POST', path: '/test', body, query });
}

const noop = (): Promise<Response> => Promise.resolve(Response.json(null));

describe('ConvertEmptyStringsToNull', () => {
  it('converts empty string values to null', async () => {
    const req = makeRequest({ name: '', email: 'a@b.com' });
    await new ConvertEmptyStringsToNull().handle(req, noop);
    expect(req.input('name')).toBeNull();
    expect(req.input('email')).toBe('a@b.com');
  });

  it('converts empty strings in query params to null', async () => {
    const req = makeRequest({}, { filter: '' });
    await new ConvertEmptyStringsToNull().handle(req, noop);
    expect(req.input('filter')).toBeNull();
  });

  it('leaves non-empty strings untouched', async () => {
    const req = makeRequest({ name: 'Alice', title: ' ' });
    await new ConvertEmptyStringsToNull().handle(req, noop);
    expect(req.input('name')).toBe('Alice');
    expect(req.input('title')).toBe(' ');
  });

  it('leaves non-string values untouched', async () => {
    const req = makeRequest({ count: 0, active: false, data: null });
    await new ConvertEmptyStringsToNull().handle(req, noop);
    expect(req.input('count')).toBe(0);
    expect(req.input('active')).toBe(false);
    expect(req.input('data')).toBeNull();
  });

  it('converts empty strings inside arrays to null', async () => {
    const req = makeRequest({ tags: ['a', '', 'b'] });
    await new ConvertEmptyStringsToNull().handle(req, noop);
    expect(req.array('tags')).toEqual(['a', null, 'b']);
  });

  it('converts empty strings inside nested objects to null', async () => {
    const req = makeRequest({ address: { city: 'Paris', region: '' } });
    await new ConvertEmptyStringsToNull().handle(req, noop);
    expect(req.input('address')).toEqual({ city: 'Paris', region: null });
  });

  it('does not convert keys in the except list', async () => {
    const req = makeRequest({ name: '', notes: '' });
    await new ConvertEmptyStringsToNull(['notes']).handle(req, noop);
    expect(req.input('name')).toBeNull();
    expect(req.input('notes')).toBe('');
  });

  it('calls next and returns its response', async () => {
    const req = makeRequest({ name: '' });
    const expected = Response.json({ ok: true });
    const next = vi.fn().mockResolvedValue(expected);
    const result = await new ConvertEmptyStringsToNull().handle(req, next);
    expect(next).toHaveBeenCalledWith(req);
    expect(result).toBe(expected);
  });

  it('works correctly when composed after TrimStrings', async () => {
    // Whitespace-only → TrimStrings → '' → ConvertEmptyStringsToNull → null
    const req = makeRequest({ name: '   ' });
    req.merge({ name: '' }); // simulate TrimStrings already ran
    await new ConvertEmptyStringsToNull().handle(req, noop);
    expect(req.input('name')).toBeNull();
  });
});
