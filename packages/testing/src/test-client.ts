import type { HttpKernel } from '@faberjs/http';
import { TestResponse } from './test-response';

export class TestClient {
  readonly #kernel: HttpKernel;
  readonly #baseUrl: string;
  #headers: Record<string, string>;

  constructor(kernel: HttpKernel, baseUrl: string, headers: Record<string, string> = {}) {
    this.#kernel = kernel;
    this.#baseUrl = baseUrl;
    this.#headers = {
      'content-type': 'application/json',
      accept: 'application/json',
      ...headers,
    };
  }

  actingAs(token: string): TestClient {
    return new TestClient(this.#kernel, this.#baseUrl, {
      ...this.#headers,
      authorization: `Bearer ${token}`,
    });
  }

  withHeaders(headers: Record<string, string>): TestClient {
    return new TestClient(this.#kernel, this.#baseUrl, { ...this.#headers, ...headers });
  }

  async get(path: string, headers?: Record<string, string>): Promise<TestResponse> {
    const res = await fetch(`${this.#baseUrl}${path}`, {
      method: 'GET',
      headers: { ...this.#headers, ...headers },
    });
    return TestResponse.fromFetchResponse(res);
  }

  async post(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<TestResponse> {
    const res = await fetch(`${this.#baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.#headers, ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return TestResponse.fromFetchResponse(res);
  }

  async put(path: string, body?: unknown, headers?: Record<string, string>): Promise<TestResponse> {
    const res = await fetch(`${this.#baseUrl}${path}`, {
      method: 'PUT',
      headers: { ...this.#headers, ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return TestResponse.fromFetchResponse(res);
  }

  async patch(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<TestResponse> {
    const res = await fetch(`${this.#baseUrl}${path}`, {
      method: 'PATCH',
      headers: { ...this.#headers, ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return TestResponse.fromFetchResponse(res);
  }

  async delete(path: string, headers?: Record<string, string>): Promise<TestResponse> {
    const res = await fetch(`${this.#baseUrl}${path}`, {
      method: 'DELETE',
      headers: { ...this.#headers, ...headers },
    });
    return TestResponse.fromFetchResponse(res);
  }

  async close(): Promise<void> {
    await this.#kernel.close();
  }
}

export async function createTestApp(kernel: HttpKernel): Promise<TestClient> {
  await kernel.listen(0);
  const baseUrl = kernel.getUrl();
  return new TestClient(kernel, baseUrl);
}
