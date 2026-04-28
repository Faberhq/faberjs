import { randomUUID } from 'node:crypto';
import type { Middleware, NextFunction } from '@faber-js/http';
import type { Request, Response } from '@faber-js/http';
import type { DevContext } from './dev-context';
import type { TraceStore } from './trace-store';

export class DevHttpTracer implements Middleware {
  readonly #store: TraceStore;
  readonly #context: DevContext;

  constructor(store: TraceStore, context: DevContext) {
    this.#store = store;
    this.#context = context;
  }

  async handle(request: Request, next: NextFunction): Promise<Response> {
    // Skip tracing the dashboard routes to avoid recursive noise
    if (request.path().startsWith('/_faber')) {
      return next(request);
    }

    const id = randomUUID();
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    const startHeap = process.memoryUsage().heapUsed;

    const response = await this.#context.run(id, () => next(request));

    const queries = this.#store.getQueriesForRequest(id);

    this.#store.addRequest({
      id,
      method: request.method(),
      path: request.path(),
      status: response.getStatus(),
      durationMs: Date.now() - startMs,
      startedAt,
      queryCount: queries.length,
      memoryDeltaKb: Math.round((process.memoryUsage().heapUsed - startHeap) / 1024),
    });

    return response;
  }
}
