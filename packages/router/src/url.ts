import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  getCurrentRequest,
  InvalidSignatureException,
  type Middleware,
  type NextFunction,
  type Request,
  type Response,
} from '@faber-js/http';
import { route, setUrlDefaults, type RouteParams, type RouteParamValue } from './helpers';

function appKey(): string {
  const key = process.env['APP_KEY'] ?? '';
  if (!key) throw new Error('APP_KEY is not set. Cannot generate signed URLs.');
  return key;
}

function signString(canonical: string): string {
  return createHmac('sha256', appKey()).update(canonical).digest('hex');
}

/**
 * Build a canonical signing string. When `absolute` is true, the host and scheme are
 * included in the canonical form so that the signature is bound to a specific origin.
 * `_signature` is always excluded; `ignoreParameters` are also excluded so callers can
 * carry through query params (e.g. pagination) that aren't part of the signed envelope.
 */
function buildCanonical(
  urlString: string,
  opts: { absolute: boolean; ignoreParameters?: readonly string[] | undefined },
): string {
  const wrapped = urlString.startsWith('http') ? urlString : `http://localhost${urlString}`;
  const u = new globalThis.URL(wrapped);
  u.searchParams.delete('_signature');
  for (const key of opts.ignoreParameters ?? []) {
    u.searchParams.delete(key);
  }
  u.searchParams.sort();
  const tail = u.pathname + (u.search || '');
  return opts.absolute ? `${u.protocol}//${u.host}${tail}` : tail;
}

function currentSchemeAndHost(): string {
  const request = getCurrentRequest();
  if (!request) {
    return '';
  }
  return request.schemeAndHttpHost();
}

function previousUrlFromSession(): string | undefined {
  const request = getCurrentRequest();
  if (!request) return undefined;
  const session = request.getAttribute<{ previousUrl(): string | undefined }>('session');
  return session?.previousUrl();
}

export interface SignedRouteOptions {
  /** Include the absolute origin (scheme + host) in the signature. Defaults to true. */
  readonly absolute?: boolean;
}

export interface ValidateSignatureOptions {
  /** When false, expects the signed URL to include the absolute origin. Defaults to true. */
  readonly absolute?: boolean;
  /** Query parameters to ignore when computing the signature. */
  readonly ignoreParameters?: readonly string[];
}

function joinHost(base: string, path: string): string {
  if (!base) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function appendQuery(url: string, params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) search.append(k, v);
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${search.toString()}`;
}

export const URL = {
  signedRoute(name: string, params: RouteParams = {}, opts: SignedRouteOptions = {}): string {
    const absolute = opts.absolute !== false;
    const base = route(name, params);
    const target = absolute ? joinHost(currentSchemeAndHost(), base) : base;
    const withFlag = appendQuery(target, { _signed: '1' });
    const signature = signString(buildCanonical(withFlag, { absolute }));
    return appendQuery(withFlag, { _signature: signature });
  },

  temporarySignedRoute(
    name: string,
    expiresAt: Date | number,
    params: RouteParams = {},
    opts: SignedRouteOptions = {},
  ): string {
    const absolute = opts.absolute !== false;
    const base = route(name, params);
    const target = absolute ? joinHost(currentSchemeAndHost(), base) : base;
    const expiresUnix =
      expiresAt instanceof Date
        ? Math.floor(expiresAt.getTime() / 1000)
        : Math.floor(Date.now() / 1000) + expiresAt;
    const withFlags = appendQuery(target, { _signed: '1', _expires: String(expiresUnix) });
    const signature = signString(buildCanonical(withFlags, { absolute }));
    return appendQuery(withFlags, { _signature: signature });
  },

  hasValidSignature(requestUrl: string, opts: ValidateSignatureOptions = {}): boolean {
    try {
      const absolute = opts.absolute !== false;
      const wrapped = requestUrl.startsWith('http') ? requestUrl : `http://localhost${requestUrl}`;
      const u = new globalThis.URL(wrapped);
      const signature = u.searchParams.get('_signature');
      if (!signature) return false;

      const expires = u.searchParams.get('_expires');
      if (expires && parseInt(expires, 10) < Math.floor(Date.now() / 1000)) return false;

      const canonicalOpts: { absolute: boolean; ignoreParameters?: readonly string[] } = {
        absolute,
      };
      if (opts.ignoreParameters) canonicalOpts.ignoreParameters = opts.ignoreParameters;
      const canonical = buildCanonical(requestUrl, canonicalOpts);
      const expected = signString(canonical);

      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length === 0 || sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  },

  hasValidSignatureWhileIgnoring(
    requestUrl: string,
    ignoreParameters: readonly string[],
    opts: Omit<ValidateSignatureOptions, 'ignoreParameters'> = {},
  ): boolean {
    return URL.hasValidSignature(requestUrl, { ...opts, ignoreParameters });
  },

  /** Path of the current request (no query string). */
  current(): string {
    const request = getCurrentRequest();
    return request?.url().split('?')[0] ?? '';
  },

  /** Full absolute URL of the current request, including query string. */
  full(): string {
    const request = getCurrentRequest();
    return request?.fullUrl() ?? '';
  },

  /** Previous URL recorded on the session, falling back to `/`. */
  previous(fallback = '/'): string {
    return previousUrlFromSession() ?? joinHost(currentSchemeAndHost(), fallback);
  },

  /** Path-only form of the previous URL. */
  previousPath(fallback = '/'): string {
    const previous = previousUrlFromSession();
    if (!previous) return fallback;
    try {
      const wrapped = previous.startsWith('http') ? previous : `http://localhost${previous}`;
      return new globalThis.URL(wrapped).pathname;
    } catch {
      return fallback;
    }
  },

  /** Set request-scoped default values for path placeholders. */
  defaults(params: Record<string, RouteParamValue>): void {
    setUrlDefaults(params);
  },
};

export interface SignedMiddlewareOptions {
  readonly relative?: boolean;
  readonly ignoreParameters?: readonly string[];
}

export class SignedMiddleware implements Middleware {
  readonly #opts: SignedMiddlewareOptions;

  constructor(opts: SignedMiddlewareOptions = {}) {
    this.#opts = opts;
  }

  async handle(request: Request, next: NextFunction, ...params: string[]): Promise<Response> {
    const flags = new Set(params);
    const relative = this.#opts.relative ?? flags.has('relative');
    const ignoreParameters = this.#opts.ignoreParameters;

    const target = relative ? request.url() : request.fullUrl();
    const validateOpts = ignoreParameters
      ? { absolute: !relative, ignoreParameters }
      : { absolute: !relative };
    if (!URL.hasValidSignature(target, validateOpts)) {
      throw new InvalidSignatureException();
    }
    return next(request);
  }
}

/** Fluent helper returned by `url()` (no args). */
export class UrlGenerator {
  to(path: string, extra: ReadonlyArray<string | number> = []): string {
    const tail = extra.length > 0 ? `/${extra.map((p) => String(p)).join('/')}` : '';
    const cleaned = path.startsWith('/') ? path : `/${path}`;
    return joinHost(currentSchemeAndHost(), `${cleaned}${tail}`);
  }

  query(
    path: string,
    params: Record<string, string | number | ReadonlyArray<string | number>>,
  ): string {
    const wrappedSrc = path.startsWith('http')
      ? path
      : `http://__host__${path.startsWith('/') ? path : `/${path}`}`;
    const u = new globalThis.URL(wrappedSrc);

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        u.searchParams.delete(key);
        value.forEach((item, idx) => {
          u.searchParams.append(`${key}[${idx}]`, String(item));
        });
      } else {
        u.searchParams.set(key, String(value));
      }
    }

    const tail = `${u.pathname}${u.search}${u.hash}`;
    if (path.startsWith('http')) {
      return `${u.protocol}//${u.host}${tail}`;
    }
    return joinHost(currentSchemeAndHost(), tail);
  }

  current(): string {
    return URL.full();
  }

  full(): string {
    return URL.full();
  }

  previous(fallback = '/'): string {
    return URL.previous(fallback);
  }

  previousPath(fallback = '/'): string {
    return URL.previousPath(fallback);
  }
}

const generator = new UrlGenerator();

export function url(): UrlGenerator;
export function url(path: string, extra?: ReadonlyArray<string | number>): string;
export function url(
  path?: string,
  extra: ReadonlyArray<string | number> = [],
): UrlGenerator | string {
  if (path === undefined) return generator;
  return generator.to(path, extra);
}
