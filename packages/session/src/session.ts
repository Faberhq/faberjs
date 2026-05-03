import { randomBytes } from 'node:crypto';
import type { SessionDriver } from './types';

const FLASH_NEW_KEY = '_flash_new';
const FLASH_OLD_KEY = '_flash_old';
const CSRF_KEY = '_token';

function generateId(): string {
  return randomBytes(32).toString('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export class Session {
  #id: string;
  #data: Record<string, unknown> = {};
  #dirty = false;
  readonly #driver: SessionDriver;
  readonly #ttlSeconds: number;

  constructor(driver: SessionDriver, id?: string, ttlSeconds = 7200) {
    this.#driver = driver;
    this.#id = id ?? generateId();
    this.#ttlSeconds = ttlSeconds;
  }

  getId(): string {
    return this.#id;
  }

  async start(): Promise<void> {
    this.#data = await this.#driver.read(this.#id);
    this.ageFlashData();
  }

  private ageFlashData(): void {
    const old = (this.#data[FLASH_OLD_KEY] as string[] | undefined) ?? [];
    for (const key of old) {
      delete this.#data[key];
    }
    const newKeys = (this.#data[FLASH_NEW_KEY] as string[] | undefined) ?? [];
    this.#data[FLASH_OLD_KEY] = newKeys;
    this.#data[FLASH_NEW_KEY] = [];
    if (old.length > 0 || newKeys.length > 0) {
      this.#dirty = true;
    }
  }

  async save(): Promise<void> {
    if (this.#dirty) {
      await this.#driver.write(this.#id, this.#data, this.#ttlSeconds);
      this.#dirty = false;
    }
  }

  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    if (key in this.#data) return this.#data[key] as T;
    return defaultValue;
  }

  put(key: string, value: unknown): this {
    this.#data[key] = value;
    this.#dirty = true;
    return this;
  }

  has(key: string): boolean {
    return key in this.#data && this.#data[key] !== null && this.#data[key] !== undefined;
  }

  missing(key: string): boolean {
    return !this.has(key);
  }

  all(): Record<string, unknown> {
    return { ...this.#data };
  }

  forget(...keys: string[]): this {
    for (const key of keys) {
      delete this.#data[key];
    }
    this.#dirty = true;
    return this;
  }

  flush(): this {
    this.#data = {};
    this.#dirty = true;
    return this;
  }

  flash(key: string, value: unknown): this {
    this.put(key, value);
    const newKeys = (this.#data[FLASH_NEW_KEY] as string[] | undefined) ?? [];
    if (!newKeys.includes(key)) {
      this.#data[FLASH_NEW_KEY] = [...newKeys, key];
    }
    return this;
  }

  reflash(): this {
    const old = (this.#data[FLASH_OLD_KEY] as string[] | undefined) ?? [];
    const current = (this.#data[FLASH_NEW_KEY] as string[] | undefined) ?? [];
    this.#data[FLASH_NEW_KEY] = [...new Set([...current, ...old])];
    this.#data[FLASH_OLD_KEY] = [];
    this.#dirty = true;
    return this;
  }

  keep(...keys: string[]): this {
    const current = (this.#data[FLASH_NEW_KEY] as string[] | undefined) ?? [];
    this.#data[FLASH_NEW_KEY] = [...new Set([...current, ...keys])];
    this.#dirty = true;
    return this;
  }

  now(key: string, value: unknown): this {
    this.put(key, value);
    const old = (this.#data[FLASH_OLD_KEY] as string[] | undefined) ?? [];
    if (!old.includes(key)) {
      this.#data[FLASH_OLD_KEY] = [...old, key];
    }
    return this;
  }

  async regenerate(destroy = false): Promise<this> {
    if (destroy) {
      await this.#driver.destroy(this.#id);
    }
    this.#id = generateId();
    this.#dirty = true;
    return this;
  }

  async invalidate(): Promise<this> {
    await this.#driver.destroy(this.#id);
    this.flush();
    this.#id = generateId();
    return this;
  }

  token(): string {
    const existing = this.#data[CSRF_KEY];
    if (typeof existing === 'string' && existing.length > 0) {
      return existing;
    }
    const token = generateToken();
    this.#data[CSRF_KEY] = token;
    this.#dirty = true;
    return token;
  }

  pull<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const value = this.get<T>(key, defaultValue);
    this.forget(key);
    return value;
  }

  increment(key: string, amount = 1): number {
    const current = Number(this.#data[key] ?? 0);
    const next = current + amount;
    this.put(key, next);
    return next;
  }

  decrement(key: string, amount = 1): number {
    return this.increment(key, -amount);
  }

  previousUrl(): string | undefined {
    return this.get<string>('_previous_url');
  }

  setPreviousUrl(url: string): this {
    return this.put('_previous_url', url);
  }
}
