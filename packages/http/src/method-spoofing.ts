import type { Request } from './request';
import type { Middleware, NextFunction } from './types';
import type { Response } from './response';

const SPOOFABLE = new Set(['PUT', 'PATCH', 'DELETE']);

export class MethodSpoofing implements Middleware {
  handle(request: Request, next: NextFunction): Promise<Response> {
    if (request.realMethod() === 'POST') {
      const override = String(request.input('_method') ?? '').toUpperCase();
      if (SPOOFABLE.has(override)) {
        request.setMethodOverride(override);
      }
    }
    return next(request);
  }
}
