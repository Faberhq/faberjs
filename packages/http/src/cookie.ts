import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from './request';

const cookieQueue = new AsyncLocalStorage<string[]>();

export interface CookieOptions {
  readonly path?: string;
  readonly domain?: string;
  readonly secure?: boolean;
  /** Defaults to true. */
  readonly httpOnly?: boolean;
  readonly sameSite?: 'Strict' | 'Lax' | 'None';
}

export function serializeCookieHeader(
  name: string,
  value: string,
  minutes: number,
  options: CookieOptions = {},
): string {
  const parts: string[] = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (minutes > 0) {
    const maxAge = minutes * 60;
    const expires = new Date(Date.now() + maxAge * 1000);
    parts.push(`Max-Age=${maxAge}`);
    parts.push(`Expires=${expires.toUTCString()}`);
  } else if (minutes === 0) {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }

  parts.push(`Path=${options.path ?? '/'}`);
  if (options.domain !== undefined) parts.push(`Domain=${options.domain}`);
  if (options.secure === true) parts.push('Secure');
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.sameSite !== undefined) parts.push(`SameSite=${options.sameSite}`);

  return parts.join('; ');
}

/**
 * Initialises a per-request cookie queue via AsyncLocalStorage.
 * Call this before any code that may call Cookie.queue() / Cookie.expire().
 */
export function runWithCookieQueue<T>(fn: () => Promise<T>): Promise<T> {
  return cookieQueue.run([], fn);
}

export class Cookie {
  /**
   * Serialise a cookie string without attaching it to a response.
   */
  static make(name: string, value: string, minutes: number, options: CookieOptions = {}): string {
    return serializeCookieHeader(name, value, minutes, options);
  }

  /**
   * Queue a cookie for attachment to the outgoing response.
   * Must be called within a request lifecycle started with runWithCookieQueue().
   */
  static queue(name: string, value: string, minutes: number, options: CookieOptions = {}): void {
    const queue = cookieQueue.getStore();
    if (queue !== undefined) {
      queue.push(serializeCookieHeader(name, value, minutes, options));
    }
  }

  /**
   * Queue an expired cookie to delete it from the client.
   */
  static expire(name: string, path = '/', domain?: string): void {
    const queue = cookieQueue.getStore();
    if (queue !== undefined) {
      const opts: CookieOptions = domain !== undefined ? { path, domain } : { path };
      queue.push(serializeCookieHeader(name, '', 0, opts));
    }
  }

  /**
   * Read a named cookie value from a request's Cookie header.
   */
  static get(request: Request, name: string): string | undefined {
    const cookieHeader = request.header('cookie') ?? '';
    if (!cookieHeader) return undefined;
    for (const pair of cookieHeader.split(';')) {
      const trimmed = pair.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = decodeURIComponent(trimmed.slice(0, eqIdx).trim());
      if (key === name) {
        return decodeURIComponent(trimmed.slice(eqIdx + 1).trim());
      }
    }
    return undefined;
  }

  /**
   * Return all cookies queued for the current request cycle.
   */
  static getQueued(): readonly string[] {
    return cookieQueue.getStore() ?? [];
  }
}
