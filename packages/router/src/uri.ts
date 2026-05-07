import type { Constructor } from '@faber-js/core';
import { getCurrentRequest } from '@faber-js/http';
import { route, type RouteParams } from './helpers';
import { URL as FaberURL, type SignedRouteOptions } from './url';
import { action } from './action';

type ActionTarget = Constructor | readonly [Constructor] | readonly [Constructor, string];

/**
 * Immutable, fluent URI builder. Backed by the WHATWG `URL`, but accepts
 * relative paths (e.g. `/users`) by treating them as host-less. Methods
 * return a new `Uri` rather than mutating in place.
 */
export class Uri {
  readonly #raw: string;
  readonly #relative: boolean;

  private constructor(raw: string, relative: boolean) {
    this.#raw = raw;
    this.#relative = relative;
  }

  // --- Static factories ----------------------------------------------------

  static of(value: string): Uri {
    const isAbsolute = /^[a-z][a-z0-9+\-.]*:\/\//i.test(value);
    return new Uri(value, !isAbsolute);
  }

  static to(path: string): Uri {
    return Uri.of(path);
  }

  static route(name: string, params: RouteParams = {}): Uri {
    return Uri.of(route(name, params));
  }

  static signedRoute(name: string, params: RouteParams = {}, opts?: SignedRouteOptions): Uri {
    return Uri.of(FaberURL.signedRoute(name, params, opts));
  }

  static temporarySignedRoute(
    name: string,
    expiresAt: Date | number,
    params: RouteParams = {},
    opts?: SignedRouteOptions,
  ): Uri {
    return Uri.of(FaberURL.temporarySignedRoute(name, expiresAt, params, opts));
  }

  static action(target: ActionTarget, params: RouteParams = {}): Uri {
    return Uri.of(action(target, params));
  }

  /** Build a Uri for the current request's URL. */
  static current(): Uri {
    const request = getCurrentRequest();
    return Uri.of(request?.fullUrl() ?? '');
  }

  /**
   * Build a Uri for the previously-visited URL recorded on the session.
   * Returns `undefined` if no previous URL is recorded.
   */
  static previous(): Uri | undefined {
    const request = getCurrentRequest();
    const session = request?.getAttribute<{ previousUrl(): string | undefined }>('session');
    const url = session?.previousUrl();
    return url ? Uri.of(url) : undefined;
  }

  // --- Internal: parse with placeholder host -------------------------------

  #parse(): { url: globalThis.URL; placeholder: boolean } {
    if (!this.#relative) {
      return { url: new globalThis.URL(this.#raw), placeholder: false };
    }
    const path = this.#raw.startsWith('/') ? this.#raw : `/${this.#raw}`;
    return { url: new globalThis.URL(`http://__faber_placeholder__${path}`), placeholder: true };
  }

  #serialize(u: globalThis.URL, placeholder: boolean): Uri {
    if (placeholder) {
      const tail = `${u.pathname}${u.search}${u.hash}`;
      return new Uri(tail, true);
    }
    return new Uri(u.toString(), false);
  }

  // --- Accessors -----------------------------------------------------------

  scheme(): string {
    if (this.#relative) return '';
    return new globalThis.URL(this.#raw).protocol.replace(/:$/, '');
  }

  host(): string {
    if (this.#relative) return '';
    return new globalThis.URL(this.#raw).hostname;
  }

  port(): number | null {
    if (this.#relative) return null;
    const port = new globalThis.URL(this.#raw).port;
    return port ? Number(port) : null;
  }

  path(): string {
    return this.#parse().url.pathname;
  }

  query(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.#parse().url.searchParams) {
      out[k] = v;
    }
    return out;
  }

  fragment(): string {
    return this.#parse().url.hash.replace(/^#/, '');
  }

  // --- Mutators (return new Uri) -------------------------------------------

  withScheme(scheme: string): Uri {
    if (this.#relative) {
      return Uri.of(
        `${scheme}://localhost${this.#raw.startsWith('/') ? this.#raw : `/${this.#raw}`}`,
      );
    }
    const u = new globalThis.URL(this.#raw);
    u.protocol = scheme.endsWith(':') ? scheme : `${scheme}:`;
    return new Uri(u.toString(), false);
  }

  withHost(host: string): Uri {
    if (this.#relative) {
      return Uri.of(`http://${host}${this.#raw.startsWith('/') ? this.#raw : `/${this.#raw}`}`);
    }
    const u = new globalThis.URL(this.#raw);
    u.hostname = host;
    return new Uri(u.toString(), false);
  }

  withPort(port: number | null): Uri {
    if (this.#relative) {
      return this.withHost('localhost').withPort(port);
    }
    const u = new globalThis.URL(this.#raw);
    u.port = port === null ? '' : String(port);
    return new Uri(u.toString(), false);
  }

  withPath(path: string): Uri {
    const { url, placeholder } = this.#parse();
    url.pathname = path.startsWith('/') ? path : `/${path}`;
    return this.#serialize(url, placeholder);
  }

  withQuery(params: Record<string, string | number | boolean | null | undefined>): Uri {
    const { url, placeholder } = this.#parse();
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) {
        url.searchParams.delete(k);
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    return this.#serialize(url, placeholder);
  }

  withQueryIfMissing(params: Record<string, string | number | boolean>): Uri {
    const { url, placeholder } = this.#parse();
    for (const [k, v] of Object.entries(params)) {
      if (!url.searchParams.has(k)) {
        url.searchParams.set(k, String(v));
      }
    }
    return this.#serialize(url, placeholder);
  }

  withoutQuery(...keys: string[]): Uri {
    const { url, placeholder } = this.#parse();
    for (const key of keys) url.searchParams.delete(key);
    return this.#serialize(url, placeholder);
  }

  withFragment(fragment: string): Uri {
    const { url, placeholder } = this.#parse();
    url.hash = fragment.startsWith('#') ? fragment : `#${fragment}`;
    return this.#serialize(url, placeholder);
  }

  withoutFragment(): Uri {
    const { url, placeholder } = this.#parse();
    url.hash = '';
    return this.#serialize(url, placeholder);
  }

  // --- Output --------------------------------------------------------------

  toString(): string {
    return this.#raw;
  }

  toJSON(): string {
    return this.#raw;
  }

  valueOf(): string {
    return this.#raw;
  }
}
