import { AsyncLocalStorage } from 'node:async_hooks';
import { Application } from '@faber-js/core';
import type { RouterContract } from '@faber-js/http';

export class RouteNotFoundException extends Error {
  constructor(name: string) {
    super(`Route [${name}] is not defined.`);
    this.name = 'RouteNotFoundException';
  }
}

export type RouteParamValue = string | number | boolean | { getRouteKey(): unknown };
export type RouteParams = Record<string, RouteParamValue | null | undefined>;

const defaultsStorage = new AsyncLocalStorage<Map<string, string>>();

export function getRouter(): RouterContract {
  return Application.getInstance().make<RouterContract>('router');
}

function unwrap(value: RouteParamValue): string {
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { getRouteKey: () => unknown }).getRouteKey === 'function'
  ) {
    return String((value as { getRouteKey: () => unknown }).getRouteKey());
  }
  return String(value);
}

export function getUrlDefaults(): ReadonlyMap<string, string> {
  return defaultsStorage.getStore() ?? new Map();
}

export function setUrlDefaults(params: Record<string, RouteParamValue>): void {
  let store = defaultsStorage.getStore();
  if (!store) {
    store = new Map();
    defaultsStorage.enterWith(store);
  }
  for (const [key, value] of Object.entries(params)) {
    store.set(key, unwrap(value));
  }
}

export function clearUrlDefaults(): void {
  defaultsStorage.getStore()?.clear();
}

/**
 * Build a URL by substituting path placeholders in `pattern` and appending any
 * leftover params as query string. Used by `route()` and `action()`.
 *
 * Path placeholders (`:id`, `{id}`, `{id?}`) are substituted with values from
 * `params`, falling back to URL.defaults() if a value isn't supplied.
 */
export function buildUrl(pattern: string, params: RouteParams = {}): string {
  const defaults = getUrlDefaults();
  const remaining = new Map<string, string>();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    remaining.set(key, unwrap(value));
  }

  let url = pattern.replace(
    /\{([a-zA-Z_][a-zA-Z0-9_]*)\??\}|:([a-zA-Z_][a-zA-Z0-9_]*)/g,
    (match, braceName, colonName) => {
      const key = (braceName ?? colonName) as string;
      const supplied = remaining.get(key);
      if (supplied !== undefined) {
        remaining.delete(key);
        return encodeURIComponent(supplied);
      }
      const fallback = defaults.get(key);
      if (fallback !== undefined) {
        return encodeURIComponent(fallback);
      }
      return match;
    },
  );

  // Strip unfilled optional segments (e.g. `/{name?}` with no value provided).
  url = url.replace(/\/\{[a-zA-Z_][a-zA-Z0-9_]*\?\}/g, '');

  if (remaining.size > 0) {
    const search = new URLSearchParams();
    for (const [key, value] of remaining) {
      search.append(key, value);
    }
    url = `${url || '/'}${url.includes('?') ? '&' : '?'}${search.toString()}`;
  }

  return url || '/';
}

/**
 * Build a URL for a named route. See `buildUrl` for substitution rules.
 * Values that look like a Model (have a `getRouteKey()` method) are unwrapped.
 */
export function route(name: string, params: RouteParams = {}): string {
  const router = getRouter();
  const definition = router.findByName(name);

  if (!definition) {
    throw new RouteNotFoundException(name);
  }

  return buildUrl(definition.path, params);
}
