import { randomUUID } from 'node:crypto';
import type { TraceStore } from './trace-store';

interface EventDispatcherLike {
  listenWildcard(handler: (payload: Record<string, unknown>) => void | Promise<void>): void;
}

export class DevEventTracer {
  readonly #store: TraceStore;

  constructor(store: TraceStore) {
    this.#store = store;
  }

  attach(dispatcher: EventDispatcherLike): void {
    dispatcher.listenWildcard((payload) => {
      const startMs = Date.now();
      const eventType = String(payload['type'] ?? 'unknown');

      this.#store.addEvent({
        id: randomUUID(),
        eventType,
        firedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      });
    });
  }
}
