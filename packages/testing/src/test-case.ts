import type { HttpKernel } from '@faberjs/http';
import type { MigrationRunner } from '@faberjs/orm';
import { assertDatabaseHas, assertDatabaseMissing } from './db-assertions';
import type { TestClient } from './test-client';
import { createTestApp } from './test-client';
import type { TestResponse } from './test-response';

export abstract class TestCase {
  #client: TestClient | null = null;
  #token: string | null = null;

  protected abstract createKernel(): HttpKernel | Promise<HttpKernel>;

  protected createMigrations(): MigrationRunner | undefined {
    return undefined;
  }

  async beforeEach(): Promise<void> {
    const kernel = await this.createKernel();
    this.#client = await createTestApp(kernel);
    await this.setup();
  }

  async afterEach(): Promise<void> {
    await this.teardown();
    await this.#client?.close();
    this.#client = null;
    this.#token = null;
  }

  protected async setup(): Promise<void> {
    // Override in subclasses
  }

  protected async teardown(): Promise<void> {
    // Override in subclasses
  }

  actingAs(token: string): this {
    this.#token = token;
    return this;
  }

  async refreshDatabase(): Promise<void> {
    const migrations = this.createMigrations();
    if (!migrations) return;
    await migrations.reset();
    await migrations.run();
  }

  #resolveClient(): TestClient {
    if (!this.#client) {
      throw new Error('TestCase client not initialized. Did you call beforeEach()?');
    }
    return this.#token !== null ? this.#client.actingAs(this.#token) : this.#client;
  }

  async getJson(path: string, headers?: Record<string, string>): Promise<TestResponse> {
    return this.#resolveClient().get(path, headers);
  }

  async postJson(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<TestResponse> {
    return this.#resolveClient().post(path, body, headers);
  }

  async putJson(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<TestResponse> {
    return this.#resolveClient().put(path, body, headers);
  }

  async patchJson(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<TestResponse> {
    return this.#resolveClient().patch(path, body, headers);
  }

  async deleteJson(path: string, headers?: Record<string, string>): Promise<TestResponse> {
    return this.#resolveClient().delete(path, headers);
  }

  async assertDatabaseHas(table: string, record: Record<string, unknown>): Promise<void> {
    return assertDatabaseHas(table, record);
  }

  async assertDatabaseMissing(table: string, record: Record<string, unknown>): Promise<void> {
    return assertDatabaseMissing(table, record);
  }
}
