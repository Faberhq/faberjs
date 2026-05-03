import { timingSafeEqual, randomBytes } from 'node:crypto';
import { Response } from '@faber-js/http';
import type { Middleware, NextFunction, Request } from '@faber-js/http';
import { session } from './start-session';
import { serializeCookie } from './cookie';
import type { CsrfOptions, SessionCookieOptions } from './types';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const XSRF_COOKIE = 'XSRF-TOKEN';

function matchesExclude(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const normalized = pattern.startsWith('http') ? new URL(pattern).pathname : pattern;
    if (normalized.endsWith('*')) {
      if (path.startsWith(normalized.slice(0, -1))) return true;
    } else if (normalized === path) {
      return true;
    }
  }
  return false;
}

function tokensMatch(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function getRequestToken(request: Request): string | null {
  const fromBody = request.input('_token');
  if (typeof fromBody === 'string' && fromBody.length > 0) return fromBody;

  const fromHeader = request.header('x-csrf-token');
  if (fromHeader) return fromHeader;

  return null;
}

function encryptXsrfToken(token: string): string {
  const iv = randomBytes(8).toString('hex');
  return `${iv}.${token}`;
}

function decryptXsrfToken(value: string): string | null {
  const dot = value.indexOf('.');
  if (dot === -1) return null;
  return value.slice(dot + 1);
}

export class PreventRequestForgery implements Middleware {
  readonly #options: Required<CsrfOptions>;
  readonly #cookieOptions: SessionCookieOptions;

  constructor(options: CsrfOptions = {}, cookieOptions: SessionCookieOptions = {}) {
    this.#options = {
      except: options.except ?? [],
      originOnly: options.originOnly ?? false,
      allowSameSite: options.allowSameSite ?? false,
    };
    this.#cookieOptions = cookieOptions;
  }

  async handle(request: Request, next: NextFunction): Promise<Response> {
    if (SAFE_METHODS.has(request.method())) {
      return this.addXsrfCookie(await next(request), request);
    }

    if (matchesExclude(request.path(), this.#options.except)) {
      return next(request);
    }

    if (!this.tokenValid(request)) {
      const status = this.#options.originOnly ? 403 : 419;
      return Response.json({ message: 'CSRF token mismatch.' }, status);
    }

    return this.addXsrfCookie(await next(request), request);
  }

  private tokenValid(request: Request): boolean {
    const secFetchSite = request.header('sec-fetch-site');

    if (secFetchSite === 'same-origin') return true;
    if (this.#options.allowSameSite && secFetchSite === 'same-site') return true;

    if (this.#options.originOnly) return false;

    const xsrfHeader = request.header('x-xsrf-token');
    if (xsrfHeader) {
      const decrypted = decryptXsrfToken(xsrfHeader);
      if (decrypted !== null) {
        const sessionToken = this.getSessionToken(request);
        if (sessionToken && tokensMatch(decrypted, sessionToken)) return true;
      }
    }

    const requestToken = getRequestToken(request);
    if (!requestToken) return false;

    const sessionToken = this.getSessionToken(request);
    if (!sessionToken) return false;

    return tokensMatch(requestToken, sessionToken);
  }

  private getSessionToken(request: Request): string | null {
    try {
      return session(request).token();
    } catch {
      return null;
    }
  }

  private addXsrfCookie(response: Response, request: Request): Response {
    try {
      const token = session(request).token();
      const encrypted = encryptXsrfToken(token);
      const cookieOpts: SessionCookieOptions = {
        ...this.#cookieOptions,
        name: XSRF_COOKIE,
        httpOnly: false,
      };
      return response.withCookie(serializeCookie(XSRF_COOKIE, encrypted, cookieOpts));
    } catch {
      return response;
    }
  }
}
