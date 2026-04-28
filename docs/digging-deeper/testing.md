# Testing

`@faber-js/testing` ships an HTTP test client, a base `TestCase` class, and database assertion helpers — everything you need to write integration tests against a real running app.

```bash
pnpm add -D @faber-js/testing
```

Tests in this guide use [Vitest](https://vitest.dev), which the scaffolded project configures automatically.

---

## TestClient

`TestClient` boots your app on a random port and makes real HTTP requests against it. No mocking, no faking — the full stack runs.

### Setup

```typescript
// tests/Feature/users.test.ts
import { describe, it, beforeEach, afterEach } from 'vitest'
import { createTestApp, TestClient } from '@faber-js/testing'
import { buildKernel } from '../../bootstrap/app'

let client: TestClient

beforeEach(async () => {
  client = await createTestApp(await buildKernel())
})

afterEach(async () => {
  await client.close()
})
```

`createTestApp(kernel)` calls `kernel.listen(0)` (port 0 = OS-assigned random port) and returns a `TestClient` pointed at that address.

### Making requests

```typescript
// GET
const res = await client.get('/api/v1/users')

// POST with body
const res = await client.post('/api/v1/users', {
  name: 'Alice',
  email: 'alice@example.com',
})

// PUT / PATCH / DELETE
await client.put('/api/v1/users/1', { name: 'Alice Smith' })
await client.patch('/api/v1/users/1', { name: 'Alice Smith' })
await client.delete('/api/v1/users/1')
```

All methods accept an optional final `headers` argument:

```typescript
const res = await client.get('/admin/stats', { 'x-internal-key': 'secret' })
```

### Authenticated requests

```typescript
const res = await client
  .actingAs('my-bearer-token')
  .get('/api/v1/profile')
```

`actingAs` returns a **new** `TestClient` with the `Authorization: Bearer <token>` header set — the original client is unchanged.

For custom headers without a bearer token:

```typescript
const res = await client
  .withHeaders({ 'x-tenant-id': '42' })
  .get('/api/v1/users')
```

---

## TestResponse

Every request method returns a `TestResponse`. It supports fluent assertion chaining.

### Status assertions

```typescript
res.assertOk()            // 200
res.assertCreated()       // 201
res.assertNoContent()     // 204
res.assertNotFound()      // 404
res.assertUnauthorized()  // 401
res.assertForbidden()     // 403
res.assertUnprocessable() // 422
res.assertStatus(302)     // any status code
```

All assertion methods return `this`, so they chain:

```typescript
const user = await client
  .post('/api/v1/users', { name: 'Alice', email: 'alice@example.com' })
  .then(r => r.assertCreated().json())
```

### Body assertions

```typescript
// Assert a top-level key/value pair
res.assertJson({ message: 'Created' })

// Assert a nested value using dot notation
res.assertJsonPath('data.email', 'alice@example.com')
res.assertJsonPath('meta.total', 25)
```

### Reading the response

```typescript
const status  = res.status()             // number
const body    = res.json()               // parsed JSON body (unknown)
const ct      = res.header('content-type') // header value or undefined
```

### Full example

```typescript
it('creates a user', async () => {
  const res = await client.post('/api/v1/users', {
    name: 'Alice',
    email: 'alice@example.com',
  })

  res
    .assertCreated()
    .assertJsonPath('data.name', 'Alice')
    .assertJsonPath('data.email', 'alice@example.com')
})

it('rejects missing fields', async () => {
  const res = await client.post('/api/v1/users', {})
  res.assertUnprocessable()
})

it('requires auth', async () => {
  const res = await client.get('/api/v1/profile')
  res.assertUnauthorized()
})
```

---

## TestCase

`TestCase` is an abstract base class that wires up `TestClient` lifecycle and database helpers for you.

```typescript
// tests/Feature/PostsTest.ts
import { describe, it, beforeEach, afterEach } from 'vitest'
import { TestCase } from '@faber-js/testing'
import type { HttpKernel } from '@faber-js/http'
import { buildKernel } from '../../bootstrap/app'

class PostsTest extends TestCase {
  protected createKernel(): Promise<HttpKernel> {
    return buildKernel()
  }

  protected async setup(): Promise<void> {
    await this.refreshDatabase()
  }
}

const t = new PostsTest()
beforeEach(() => t.beforeEach())
afterEach(() => t.afterEach())

describe('Posts', () => {
  it('lists posts', async () => {
    const res = await t.getJson('/api/v1/posts')
    res.assertOk()
  })

  it('creates a post when authenticated', async () => {
    t.actingAs('my-token')
    const res = await t.postJson('/api/v1/posts', { title: 'Hello', body: 'World' })
    res.assertCreated()
  })
})
```

### Request methods

`TestCase` wraps `TestClient` under methods named `getJson`, `postJson`, `putJson`, `patchJson`, `deleteJson` — same signatures as `TestClient`.

### `actingAs(token)`

Sets a bearer token for all subsequent requests on this test instance:

```typescript
t.actingAs('my-bearer-token')
const res = await t.getJson('/api/v1/profile')
res.assertOk()
```

### `refreshDatabase()`

Calls `migrations.reset()` then `migrations.run()` — useful in `setup()` to start each test with a clean schema:

```typescript
protected async setup(): Promise<void> {
  await this.refreshDatabase()
}
```

To enable `refreshDatabase`, override `createMigrations()`:

```typescript
import { MigrationRunner } from '@faber-js/orm'

protected createMigrations(): MigrationRunner {
  return new MigrationRunner(getConnection(), path.resolve('database/migrations'))
}
```

---

## Database assertions

Use these either inside `TestCase` methods or as standalone imports.

### Inside `TestCase`

```typescript
await t.assertDatabaseHas('users', { email: 'alice@example.com' })
await t.assertDatabaseMissing('users', { email: 'deleted@example.com' })
```

### Standalone

```typescript
import {
  assertDatabaseHas,
  assertDatabaseMissing,
  assertDatabaseCount,
} from '@faber-js/testing'

it('persists the user', async () => {
  await client.post('/api/v1/users', { name: 'Alice', email: 'alice@example.com' })
  await assertDatabaseHas('users', { email: 'alice@example.com' })
})

it('removes the user', async () => {
  await client.delete('/api/v1/users/1')
  await assertDatabaseMissing('users', { id: 1 })
})

it('seeds exactly three records', async () => {
  await assertDatabaseCount('users', 3)
})
```

All three functions query the active ORM connection — no setup required beyond having a database configured.

---

## API reference

### `createTestApp(kernel)`

Boots `kernel` on port 0 and returns a `TestClient`.

### `TestClient`

| Method | Description |
|---|---|
| `get(path, headers?)` | `GET` request |
| `post(path, body?, headers?)` | `POST` request |
| `put(path, body?, headers?)` | `PUT` request |
| `patch(path, body?, headers?)` | `PATCH` request |
| `delete(path, headers?)` | `DELETE` request |
| `actingAs(token)` | Returns a new client with `Authorization: Bearer` set |
| `withHeaders(headers)` | Returns a new client with extra headers merged |
| `close()` | Shuts down the HTTP server |

### `TestResponse`

| Method | Description |
|---|---|
| `status()` | Raw HTTP status code |
| `json()` | Parsed response body |
| `header(key)` | Response header value |
| `assertStatus(n)` | Assert exact status |
| `assertOk()` | Assert 200 |
| `assertCreated()` | Assert 201 |
| `assertNoContent()` | Assert 204 |
| `assertNotFound()` | Assert 404 |
| `assertUnauthorized()` | Assert 401 |
| `assertForbidden()` | Assert 403 |
| `assertUnprocessable()` | Assert 422 |
| `assertJson(subset)` | Assert top-level key/value pairs |
| `assertJsonPath(path, value)` | Assert a nested value by dot-path |

### Database assertions

| Function | Description |
|---|---|
| `assertDatabaseHas(table, record)` | Fail if no matching row exists |
| `assertDatabaseMissing(table, record)` | Fail if a matching row exists |
| `assertDatabaseCount(table, n)` | Fail if row count ≠ n |
