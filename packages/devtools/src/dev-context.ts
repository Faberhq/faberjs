import { AsyncLocalStorage } from 'node:async_hooks';

export class DevContext {
  readonly #storage = new AsyncLocalStorage<string>();

  run<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
    return this.#storage.run(requestId, fn);
  }

  currentRequestId(): string | null {
    return this.#storage.getStore() ?? null;
  }
}
