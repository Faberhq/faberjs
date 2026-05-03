import type { SessionDriver } from './types';

interface Entry {
  data: Record<string, unknown>;
  expiresAt: number;
}

export class MemorySessionDriver implements SessionDriver {
  readonly #store = new Map<string, Entry>();

  async read(id: string): Promise<Record<string, unknown>> {
    const entry = this.#store.get(id);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.#store.delete(id);
      return {};
    }
    return { ...entry.data };
  }

  async write(id: string, data: Record<string, unknown>, ttlSeconds: number): Promise<void> {
    this.#store.set(id, {
      data: { ...data },
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async destroy(id: string): Promise<void> {
    this.#store.delete(id);
  }

  async gc(maxLifetimeSeconds: number): Promise<void> {
    const cutoff = Date.now() - maxLifetimeSeconds * 1000;
    for (const [key, entry] of this.#store.entries()) {
      if (entry.expiresAt <= cutoff) {
        this.#store.delete(key);
      }
    }
  }
}
