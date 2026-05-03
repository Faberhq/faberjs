import type { Request } from './request';
import type { Middleware, NextFunction } from './types';
import { Response } from './response';

export interface CorsOptions {
  readonly origin?: string | string[] | ((origin: string) => boolean);
  readonly methods?: string[];
  readonly headers?: string[];
  readonly exposedHeaders?: string[];
  readonly maxAge?: number;
  readonly credentials?: boolean;
}

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'];

export class HandleCors implements Middleware {
  private readonly origin: string | string[] | ((o: string) => boolean);
  private readonly methods: string[];
  private readonly headers: string[];
  private readonly exposedHeaders: string[];
  private readonly maxAge: number;
  private readonly credentials: boolean;

  constructor(options: CorsOptions = {}) {
    this.origin = options.origin ?? '*';
    this.methods = options.methods ?? DEFAULT_METHODS;
    this.headers = options.headers ?? DEFAULT_HEADERS;
    this.exposedHeaders = options.exposedHeaders ?? [];
    this.maxAge = options.maxAge ?? 0;
    this.credentials = options.credentials ?? false;
  }

  async handle(request: Request, next: NextFunction): Promise<Response> {
    const origin = request.header('origin') ?? '';
    const allowedOrigin = this.resolveOrigin(origin);

    if (request.method() === 'OPTIONS') {
      const res = Response.noContent();
      return this.applyHeaders(res, allowedOrigin);
    }

    const response = await next(request);
    return this.applyHeaders(response, allowedOrigin);
  }

  private resolveOrigin(origin: string): string {
    if (this.origin === '*') return '*';
    if (typeof this.origin === 'string') return this.origin === origin ? origin : '';
    if (Array.isArray(this.origin)) return this.origin.includes(origin) ? origin : '';
    return this.origin(origin) ? origin : '';
  }

  private applyHeaders(response: Response, allowedOrigin: string): Response {
    if (!allowedOrigin) return response;
    let res = response
      .withHeader('access-control-allow-origin', allowedOrigin)
      .withHeader('access-control-allow-methods', this.methods.join(', '))
      .withHeader('access-control-allow-headers', this.headers.join(', '));
    if (this.exposedHeaders.length > 0) {
      res = res.withHeader('access-control-expose-headers', this.exposedHeaders.join(', '));
    }
    if (this.maxAge > 0) {
      res = res.withHeader('access-control-max-age', String(this.maxAge));
    }
    if (this.credentials) {
      res = res.withHeader('access-control-allow-credentials', 'true');
    }
    if (allowedOrigin !== '*') {
      res = res.withHeader('vary', 'Origin');
    }
    return res;
  }
}
