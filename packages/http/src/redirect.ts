import type { Constructor } from '@faber-js/core';
import { Response } from './response';
import { getCurrentRequest } from './request-context';
import type { RouterContract } from './types';

// ── URL builder ────────────────────────────────────────────────────────────

function buildRouteUrl(path: string, params: Record<string, string | number> = {}): string {
  const remaining: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    remaining[k] = String(v);
  }

  // Replace {param} and {param?} placeholders with provided values
  const url = path.replace(/\{(\w+)\??}/g, (_, name: string) => {
    if (Object.prototype.hasOwnProperty.call(remaining, name)) {
      const val = remaining[name] as string;
      delete remaining[name];
      return encodeURIComponent(val);
    }
    return '';
  });

  const leftover = Object.entries(remaining);
  if (leftover.length > 0) {
    const qs = new URLSearchParams(leftover).toString();
    return `${url}?${qs}`;
  }
  return url || '/';
}

// ── Session duck-type ──────────────────────────────────────────────────────

interface SessionLike {
  flash(key: string, value: unknown): unknown;
}

function tryGetSession(): SessionLike | undefined {
  const request = getCurrentRequest();
  if (!request) return undefined;
  try {
    // SESSION_ATTRIBUTE is 'session' — avoid import to keep the dep optional
    return request.getAttribute<SessionLike>('session');
  } catch {
    return undefined;
  }
}

// ── AppLike minimal contract ───────────────────────────────────────────────

interface AppLike {
  bound(key: string): boolean;
  make<T>(key: string): T;
}

// ── RedirectBuilder ────────────────────────────────────────────────────────

export class RedirectBuilder {
  readonly #flash: Record<string, unknown> = {};
  #withInput = false;

  constructor(private readonly app?: AppLike) {}

  /** Redirect to an absolute or relative URL. */
  to(url: string, status = 302): Response {
    this.#applyFlash();
    return Response.redirect(url, status);
  }

  /**
   * Redirect to a named route.
   * Extra params not matched to path segments are appended as query string.
   */
  route(name: string, params: Record<string, string | number> = {}, status = 302): Response {
    if (this.app === undefined || !this.app.bound('router')) {
      throw new Error('Cannot redirect to route: router is not bound to the container.');
    }
    const router = this.app.make<RouterContract>('router');
    const routeDef = router.findByName(name);
    if (routeDef === undefined) {
      throw new Error(`Route [${name}] is not defined.`);
    }
    return this.to(buildRouteUrl(routeDef.path, params), status);
  }

  /**
   * Redirect to a controller action.
   * The router must have a route registered for the given handler tuple.
   */
  action(
    handler: readonly [Constructor, string],
    params: Record<string, string | number> = {},
    status = 302,
  ): Response {
    if (this.app === undefined || !this.app.bound('router')) {
      throw new Error('Cannot redirect to action: router is not bound to the container.');
    }
    const router = this.app.make<RouterContract>('router');
    const [ControllerClass, method] = handler;
    const matched = router.getRoutes().find((r) => {
      if (!Array.isArray(r.handler)) return false;
      const [cls, m] = r.handler as [Constructor, string?];
      return cls === ControllerClass && (m ?? '__invoke') === method;
    });
    if (matched === undefined) {
      throw new Error(`Route not defined for action [${ControllerClass.name}@${method}].`);
    }
    return this.to(buildRouteUrl(matched.path, params), status);
  }

  /**
   * Redirect to the previous URL (Referer header), falling back to `fallback`.
   */
  back(fallback = '/'): Response {
    const request = getCurrentRequest();
    const url = request?.header('referer') ?? fallback;
    return this.to(url);
  }

  /**
   * Redirect to an external domain without any URL encoding or validation.
   */
  away(url: string): Response {
    return Response.redirect(url, 302);
  }

  /**
   * Flash a key/value pair to the session before redirecting.
   * Requires @faber-js/session's StartSession middleware to be active.
   */
  with(key: string, value: unknown): this {
    this.#flash[key] = value;
    return this;
  }

  /**
   * Flash the current request's input to the session under '_old_input'.
   * Requires @faber-js/session's StartSession middleware to be active.
   */
  withInput(): this {
    this.#withInput = true;
    return this;
  }

  #applyFlash(): void {
    const hasFlash = Object.keys(this.#flash).length > 0 || this.#withInput;
    if (!hasFlash) return;

    const sess = tryGetSession();
    if (sess === undefined) return;

    for (const [k, v] of Object.entries(this.#flash)) {
      sess.flash(k, v);
    }

    if (this.#withInput) {
      const request = getCurrentRequest();
      if (request !== undefined) {
        sess.flash('_old_input', request.all());
      }
    }
  }
}

// ── Global helpers ─────────────────────────────────────────────────────────

/**
 * Returns a RedirectBuilder.
 * Pass the application container to enable redirect()->route() and ->action().
 */
export function redirect(app?: AppLike): RedirectBuilder {
  return new RedirectBuilder(app);
}

/**
 * Redirect to the previous URL (Referer header), falling back to `fallback`.
 */
export function back(fallback = '/'): Response {
  return new RedirectBuilder().back(fallback);
}
