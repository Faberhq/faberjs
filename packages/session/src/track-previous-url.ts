import type { Middleware, NextFunction, Request, Response } from '@faber-js/http';
import { session } from './start-session';

/**
 * Records the URL of "interesting" GET requests on the session so that
 * `URL.previous()` and `Uri.previous()` can return it later. Mirrors Laravel's
 * `Illuminate\Routing\Middleware\TrackPreviousUrl` behaviour:
 *
 * - Only stores `GET` requests
 * - Skips XHR / fetch / JSON requests (they're rarely meaningful "back" targets)
 * - Skips redirect responses (3xx) so a redirect chain doesn't overwrite the
 *   real previous URL
 */
export class TrackPreviousUrl implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    const response = await next(request);

    if (request.method() !== 'GET') return response;
    if (request.wantsJson()) return response;
    if (response.getStatus() >= 300 && response.getStatus() < 400) return response;

    const s = request.getAttribute<{
      setPreviousUrl(u: string): unknown;
      setPreviousRoute(n: string | undefined): unknown;
    }>('session');
    if (!s) return response;

    s.setPreviousUrl(request.fullUrl());
    s.setPreviousRoute(request.currentRoute()?.name);
    return response;
  }
}

export function trackPreviousUrl(request: Request): void {
  const s = session(request);
  s.setPreviousUrl(request.fullUrl());
  s.setPreviousRoute(request.currentRoute()?.name ?? undefined);
}
