import type { Request } from './request';
import type { Middleware, NextFunction } from './types';
import type { Response } from './response';

export class ConvertEmptyStringsToNull implements Middleware {
  readonly #except: Set<string>;

  constructor(except: string[] = []) {
    this.#except = new Set(except);
  }

  handle(request: Request, next: NextFunction): Promise<Response> {
    const all = request.all();
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(all)) {
      converted[key] = this.#except.has(key) ? value : this.transform(value);
    }
    request.merge(converted);
    return next(request);
  }

  private transform(value: unknown): unknown {
    if (value === '') return null;
    if (Array.isArray(value)) return value.map((v) => this.transform(v));
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = this.transform(v);
      }
      return result;
    }
    return value;
  }
}
