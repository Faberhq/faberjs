import type { TestResponseContract } from './types';

export class TestResponse implements TestResponseContract {
  readonly #status: number;
  readonly #body: unknown;
  readonly #headers: Record<string, string>;

  constructor(status: number, body: unknown, headers: Record<string, string>) {
    this.#status = status;
    this.#body = body;
    this.#headers = headers;
  }

  static async fromFetchResponse(res: Response): Promise<TestResponse> {
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body: unknown = null;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = (await res.json()) as unknown;
    } else {
      body = await res.text();
    }

    return new TestResponse(res.status, body, headers);
  }

  status(): number {
    return this.#status;
  }

  json(): unknown {
    return this.#body;
  }

  header(key: string): string | undefined {
    return this.#headers[key.toLowerCase()];
  }

  assertStatus(expected: number): this {
    if (this.#status !== expected) {
      throw new Error(
        `Expected HTTP status ${expected.toString()} but received ${this.#status.toString()}.\nBody: ${JSON.stringify(this.#body, null, 2)}`,
      );
    }
    return this;
  }

  assertOk(): this {
    return this.assertStatus(200);
  }

  assertCreated(): this {
    return this.assertStatus(201);
  }

  assertNoContent(): this {
    return this.assertStatus(204);
  }

  assertNotFound(): this {
    return this.assertStatus(404);
  }

  assertUnauthorized(): this {
    return this.assertStatus(401);
  }

  assertForbidden(): this {
    return this.assertStatus(403);
  }

  assertUnprocessable(): this {
    return this.assertStatus(422);
  }

  assertJsonPath(path: string, expected: unknown): this {
    const parts = path.split('.');
    let current: unknown = this.#body;

    for (const part of parts) {
      if (typeof current !== 'object' || current === null) {
        throw new Error(`Path "${path}" not found in response body at segment "${part}".`);
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (current !== expected) {
      throw new Error(
        `Expected "${String(expected)}" at path "${path}" but found "${String(current)}".`,
      );
    }
    return this;
  }

  assertJson(subset: Record<string, unknown>): this {
    if (typeof this.#body !== 'object' || this.#body === null) {
      throw new Error(`Response body is not a JSON object.`);
    }
    const body = this.#body as Record<string, unknown>;
    for (const [key, value] of Object.entries(subset)) {
      if (body[key] !== value) {
        throw new Error(
          `Expected response to contain "${key}": ${JSON.stringify(value)} but got ${JSON.stringify(body[key])}.`,
        );
      }
    }
    return this;
  }
}
