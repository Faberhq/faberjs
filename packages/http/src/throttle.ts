import type { Request } from './request';
import type { Middleware, NextFunction, RateLimiterInterface } from './types';
import type { Response } from './response';
import { TooManyRequestsException } from './exceptions';

export class ThrottleRequests implements Middleware {
  constructor(private readonly limiter: RateLimiterInterface) {}

  async handle(
    request: Request,
    next: NextFunction,
    maxAttempts = '60',
    decaySeconds = '60',
  ): Promise<Response> {
    const key = this.resolveKey(request, maxAttempts);
    const max = parseInt(maxAttempts, 10);
    const decay = parseInt(decaySeconds, 10);

    if (await this.limiter.tooManyAttempts(key, max)) {
      const retryAfter = await this.limiter.availableIn(key);
      throw new TooManyRequestsException(
        `Too Many Requests. Retry after ${retryAfter} seconds.`,
        retryAfter,
      );
    }

    await this.limiter.increment(key, decay);
    return next(request);
  }

  protected resolveKey(request: Request, _maxAttempts: string): string {
    return `throttle:${request.ip()}`;
  }
}
