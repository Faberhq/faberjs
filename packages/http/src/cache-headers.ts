import { createHash } from 'node:crypto';
import type { Request } from './request';
import type { Response } from './response';
import type { Middleware, NextFunction } from './types';

/**
 * Sets Cache-Control headers on responses for a route group.
 *
 * Directives are passed as a semicolon-separated string in snake_case.
 * If `etag` is included, an MD5 ETag is generated from string response bodies.
 *
 * @example
 * Route.middleware('cache.headers:public;max_age=3600;etag').group(() => {
 *   Route.get('/about', [PageController, 'about']);
 * });
 */
export class CacheHeaders implements Middleware {
  constructor(private readonly directives: string) {}

  async handle(request: Request, next: NextFunction): Promise<Response> {
    const response = await next(request);

    const directiveMap = this.#parseDirectives(this.directives);
    const ccParts: string[] = [];
    let generateEtag = false;

    for (const [key, value] of directiveMap) {
      if (key === 'etag') {
        generateEtag = true;
        continue;
      }
      const ccKey = key.replace(/_/g, '-');
      ccParts.push(value !== null ? `${ccKey}=${value}` : ccKey);
    }

    let result =
      ccParts.length > 0 ? response.withHeader('cache-control', ccParts.join(', ')) : response;

    if (generateEtag) {
      const body = response.getBody();
      if (typeof body === 'string') {
        const hash = createHash('md5').update(body).digest('hex');
        result = result.withHeader('etag', `"${hash}"`);
      }
    }

    return result;
  }

  #parseDirectives(input: string): Map<string, string | null> {
    const map = new Map<string, string | null>();
    for (const part of input.split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) {
        map.set(trimmed, null);
      } else {
        map.set(trimmed.slice(0, eqIdx), trimmed.slice(eqIdx + 1));
      }
    }
    return map;
  }
}
