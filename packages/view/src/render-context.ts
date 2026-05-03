import { AsyncLocalStorage } from 'node:async_hooks';

export class StackManager {
  readonly #stacks = new Map<string, string[]>();

  push(name: string, content: string): void {
    const arr = this.#stacks.get(name) ?? [];
    this.#stacks.set(name, arr);
    arr.push(content);
  }

  prepend(name: string, content: string): void {
    const arr = this.#stacks.get(name) ?? [];
    this.#stacks.set(name, arr);
    arr.unshift(content);
  }

  render(name: string): string {
    return (this.#stacks.get(name) ?? []).join('');
  }

  has(name: string): boolean {
    const s = this.#stacks.get(name);
    return s !== undefined && s.length > 0;
  }
}

export class SectionRegistry {
  readonly #map = new Map<string, string>();

  define(name: string, content: string): void {
    this.#map.set(name, content);
  }

  get(name: string): string | undefined {
    return this.#map.get(name);
  }

  has(name: string): boolean {
    return this.#map.has(name);
  }
}

export interface RenderContextStore {
  readonly stacks: StackManager;
  readonly once: Set<string>;
  readonly sections: SectionRegistry;
  csrf: string;
  errors: Record<string, string | string[]>;
}

const storage = new AsyncLocalStorage<RenderContextStore>();

export function getRenderContext(): RenderContextStore | undefined {
  return storage.getStore();
}

export function createRenderContext(
  overrides: Partial<Pick<RenderContextStore, 'csrf' | 'errors'>> = {},
): RenderContextStore {
  return {
    stacks: new StackManager(),
    once: new Set(),
    sections: new SectionRegistry(),
    csrf: overrides.csrf ?? '',
    errors: overrides.errors ?? {},
  };
}

export function withRenderContext<T>(
  fn: () => T,
  overrides: Partial<Pick<RenderContextStore, 'csrf' | 'errors'>> = {},
): T {
  return storage.run(createRenderContext(overrides), fn);
}

export { storage as renderStorage };
