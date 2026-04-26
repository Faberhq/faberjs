import type { Middleware, NextFunction } from './types';
import type { Request } from './request';
import type { Response } from './response';

export class Pipeline {
  constructor(
    private readonly layers: readonly Middleware[],
    private readonly destination: (req: Request) => Promise<Response>,
  ) {}

  send(request: Request): Promise<Response> {
    return this.buildChain(0)(request);
  }

  private buildChain(index: number): NextFunction {
    if (index >= this.layers.length) {
      return this.destination;
    }
    const layer = this.layers[index];
    const next = this.buildChain(index + 1);
    return (req) => layer.handle(req, next);
  }
}
