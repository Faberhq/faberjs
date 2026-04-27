export interface TestResponseContract {
  assertStatus(expected: number): this;
  assertOk(): this;
  assertCreated(): this;
  assertNoContent(): this;
  assertNotFound(): this;
  assertUnauthorized(): this;
  assertForbidden(): this;
  assertUnprocessable(): this;
  assertJsonPath(path: string, expected: unknown): this;
  assertJson(subset: Record<string, unknown>): this;
  json(): unknown;
  status(): number;
  header(key: string): string | undefined;
}
