import type { DevContext } from './dev-context';
import type { TraceStore } from './trace-store';

export interface KnexQueryEvent {
  readonly sql: string;
  readonly bindings?: readonly unknown[];
  readonly __knexQueryUid: string;
}

export interface KnexInstance {
  on(event: 'query', handler: (query: KnexQueryEvent) => void): void;
  on(event: 'query-response', handler: (response: unknown, query: KnexQueryEvent) => void): void;
  on(event: 'query-error', handler: (error: Error, query: KnexQueryEvent) => void): void;
}

export class DevOrmTracer {
  readonly #store: TraceStore;
  readonly #context: DevContext;
  readonly #pending = new Map<
    string,
    { sql: string; bindings: readonly unknown[]; startMs: number }
  >();

  constructor(store: TraceStore, context: DevContext) {
    this.#store = store;
    this.#context = context;
  }

  attach(db: KnexInstance): void {
    db.on('query', (query) => {
      this.#pending.set(query.__knexQueryUid, {
        sql: query.sql,
        bindings: query.bindings ?? [],
        startMs: Date.now(),
      });
    });

    db.on('query-response', (_response, query) => {
      this.#complete(query.__knexQueryUid);
    });

    db.on('query-error', (_error, query) => {
      this.#complete(query.__knexQueryUid);
    });
  }

  #complete(uid: string): void {
    const pending = this.#pending.get(uid);
    if (!pending) return;
    this.#pending.delete(uid);

    this.#store.addQuery({
      sql: pending.sql,
      bindings: pending.bindings,
      durationMs: Date.now() - pending.startMs,
      requestId: this.#context.currentRequestId(),
      executedAt: new Date().toISOString(),
    });
  }
}
