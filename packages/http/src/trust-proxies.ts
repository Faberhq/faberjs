import type { Request } from './request';
import type { Middleware, NextFunction } from './types';
import type { Response } from './response';

// ── Forwarded-header name constants ──────────────────────────────────────────
export const HEADER_X_FORWARDED_FOR = 'x-forwarded-for' as const;
export const HEADER_X_FORWARDED_HOST = 'x-forwarded-host' as const;
export const HEADER_X_FORWARDED_PORT = 'x-forwarded-port' as const;
export const HEADER_X_FORWARDED_PROTO = 'x-forwarded-proto' as const;
export const HEADER_FORWARDED = 'forwarded' as const;

// ── IPv4 CIDR helper ──────────────────────────────────────────────────────────

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

function cidrContains(cidr: string, ip: string): boolean {
  const slash = cidr.indexOf('/');
  if (slash === -1) return false;
  const network = cidr.slice(0, slash);
  const prefix = parseInt(cidr.slice(slash + 1), 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  const networkInt = ipv4ToInt(network);
  const ipInt = ipv4ToInt(ip);
  if (networkInt === null || ipInt === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (networkInt & mask) === (ipInt & mask);
}

// ── Middleware ────────────────────────────────────────────────────────────────

export interface TrustProxiesOptions {
  /** Trusted proxy IPs or CIDR ranges, or '*' to trust all proxies. */
  proxies?: string[] | '*';
  /**
   * Which forwarded headers to honour.
   * Defaults to [HEADER_X_FORWARDED_FOR, HEADER_X_FORWARDED_PROTO].
   */
  headers?: string[];
}

const DEFAULT_HEADERS: string[] = [HEADER_X_FORWARDED_FOR, HEADER_X_FORWARDED_PROTO];

export class TrustProxies implements Middleware {
  readonly #proxies: string[] | '*';
  readonly #trustedHeaders: Set<string>;

  constructor(options: TrustProxiesOptions = {}) {
    this.#proxies = options.proxies ?? [];
    this.#trustedHeaders = new Set(options.headers ?? DEFAULT_HEADERS);
  }

  handle(request: Request, next: NextFunction): Promise<Response> {
    if (this.isTrusted(request.ip())) {
      if (this.#trustedHeaders.has(HEADER_X_FORWARDED_FOR)) {
        const resolved = this.resolveClientIp(request);
        if (resolved !== null) request.setIp(resolved);
      }

      if (this.#trustedHeaders.has(HEADER_X_FORWARDED_PROTO)) {
        const proto = (request.header(HEADER_X_FORWARDED_PROTO) ?? '').toLowerCase().trim();
        if (proto === 'https' || proto === 'http') request.setScheme(proto);
      }
    }

    return next(request);
  }

  private isTrusted(ip: string): boolean {
    if (this.#proxies === '*') return true;
    return this.#proxies.some(
      (proxy) => proxy === ip || (proxy.includes('/') && cidrContains(proxy, ip)),
    );
  }

  /**
   * Walk the X-Forwarded-For chain right-to-left, skipping trusted proxies,
   * and return the first untrusted IP (= real client).
   * Falls back to the leftmost IP if all entries are trusted.
   */
  private resolveClientIp(request: Request): string | null {
    const xff = request.header(HEADER_X_FORWARDED_FOR);
    if (!xff) return null;
    const chain = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (let i = chain.length - 1; i >= 0; i--) {
      const candidate = chain[i];
      if (candidate && !this.isTrusted(candidate)) return candidate;
    }
    return chain[0] ?? null;
  }
}
