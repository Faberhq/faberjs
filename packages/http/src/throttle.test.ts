import { describe, expect, it } from 'vitest';
import { ThrottleRequests } from './throttle';
import { TooManyRequestsException } from './exceptions';
import { Request } from './request';
import { Response } from './response';
import type { RateLimiterInterface } from './types';
import type { NextFunction } from './types';

function makeRequest(): Request {
  return new Request({ method: 'GET', path: '/test' });
}

const passthrough: NextFunction = () => Promise.resolve(Response.json({ ok: true }));

function makeLimiter(overrides: Partial<RateLimiterInterface> = {}): RateLimiterInterface {
  return {
    tooManyAttempts: async () => false,
    increment: async () => 1,
    availableIn: async () => 30,
    clear: async () => {
      return;
    },
    ...overrides,
  };
}

describe('ThrottleRequests', () => {
  it('allows request when under the rate limit', async () => {
    const mw = new ThrottleRequests(makeLimiter());
    const res = await mw.handle(makeRequest(), passthrough, '10');
    expect(res.getStatus()).toBe(200);
  });

  it('throws TooManyRequestsException when rate limit is exceeded', async () => {
    const mw = new ThrottleRequests(makeLimiter({ tooManyAttempts: async () => true }));
    await expect(mw.handle(makeRequest(), passthrough, '10')).rejects.toBeInstanceOf(
      TooManyRequestsException,
    );
  });

  it('includes retryAfter on the exception', async () => {
    const mw = new ThrottleRequests(
      makeLimiter({ tooManyAttempts: async () => true, availableIn: async () => 45 }),
    );
    let caught: TooManyRequestsException | undefined;
    try {
      await mw.handle(makeRequest(), passthrough, '10');
    } catch (e) {
      caught = e as TooManyRequestsException;
    }
    expect(caught?.retryAfter).toBe(45);
  });

  it('increments the counter on allowed requests', async () => {
    let incremented = false;
    const mw = new ThrottleRequests(
      makeLimiter({
        increment: async () => {
          incremented = true;
          return 1;
        },
      }),
    );
    await mw.handle(makeRequest(), passthrough, '5');
    expect(incremented).toBe(true);
  });
});
