import type { Request } from './request';
import type { Middleware, NextFunction } from './types';
import { Response } from './response';

export interface TrustHostsOptions {
  /** Regex patterns the Host header must match. Also accepts a resolver closure. */
  patterns: string[] | (() => string[]);
  /**
   * When true (default), subdomains of each pattern are automatically trusted
   * by prepending a `[^.]+\.` wildcard prefix to each pattern.
   */
  subdomains?: boolean;
}

export class TrustHosts implements Middleware {
  readonly #patterns: string[] | (() => string[]);
  readonly #subdomains: boolean;

  constructor(options: TrustHostsOptions) {
    this.#patterns = options.patterns;
    this.#subdomains = options.subdomains ?? true;
  }

  async handle(request: Request, next: NextFunction): Promise<Response> {
    const host = request.host();
    const resolved = typeof this.#patterns === 'function' ? this.#patterns() : this.#patterns;

    const patterns = this.buildPatterns(resolved);
    const trusted = patterns.some((p) => {
      try {
        return new RegExp(p, 'i').test(host);
      } catch {
        return false;
      }
    });

    if (!trusted) {
      return Response.json({ message: 'Forbidden' }, 403);
    }

    return next(request);
  }

  private buildPatterns(base: string[]): string[] {
    if (!this.#subdomains) return base;
    const expanded: string[] = [...base];
    for (const pattern of base) {
      // Strip leading ^ and trailing $ anchors, then re-wrap with subdomain prefix
      const inner = pattern.replace(/^\^/, '').replace(/\$$/, '');
      expanded.push(`^.+\\.${inner}$`);
    }
    return expanded;
  }
}
