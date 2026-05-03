# Sessions & CSRF Protection

`@faber-js/session` provides multi-driver session management and full CSRF protection following Laravel's two-layer approach.

---

## Installation

```bash
pnpm add @faber-js/session
```

---

## Configuration

### Register the provider

```typescript
// bootstrap/app.ts
import { SessionServiceProvider } from '@faber-js/session';
import sessionConfig from '../config/session';

app.register(new SessionServiceProvider(app, sessionConfig));
```

### Create the config file

```typescript
// config/session.ts
import { env } from '@faber-js/config';

export default {
  driver: env('SESSION_DRIVER', 'file') as 'file' | 'memory',

  cookie: {
    name: 'faber_session',
    ttlMinutes: 120,
    path: '/',
    secure: env('APP_ENV', 'local') === 'production',
    httpOnly: true,
    sameSite: 'Lax' as const,
  },

  files: {
    path: './storage/sessions',
  },
};
```

### `.env` reference

```ini
SESSION_DRIVER=file    # file | memory
APP_ENV=local
```

---

## Registering the middleware

The `SessionServiceProvider` registers two named middleware in the container:

- **`session`** — `StartSession` — loads and saves the session, sets the session cookie
- **`csrf`** — `PreventRequestForgery` — enforces CSRF protection on state-changing requests

Add them to your web middleware group:

```typescript
// bootstrap/app.ts
const kernel = app.make<HttpKernel>('http.kernel');

kernel.middlewareGroup('web', ['session', 'csrf']);

kernel.priority(['session', 'csrf', 'auth']);
```

Apply the group to your routes:

```typescript
// routes/web.ts
Route.group({ middleware: ['web'] }, () => {
  Route.get('/dashboard', [DashboardController, 'index']);
  Route.post('/profile', [ProfileController, 'update']);
});
```

::: tip
Session must run **before** CSRF, which must run **before** auth. Using `kernel.priority(['session', 'csrf', 'auth'])` enforces this order regardless of how routes declare middleware.
:::

---

## Accessing the session

Use the `session()` helper from `@faber-js/session` inside any middleware or controller that runs after `StartSession`:

```typescript
import { session } from '@faber-js/session';

async index(req: Request): Promise<Response> {
  const s = session(req);
  const userId = s.get('user_id');
  return this.json({ userId });
}
```

---

## Reading and writing data

```typescript
const s = session(req);

// Store a value
s.put('user_id', 42);

// Read a value (with optional default)
const id = s.get('user_id');
const lang = s.get('locale', 'en');

// Check existence
s.has('user_id'); // true if set and not null/undefined
s.missing('token'); // true if not set

// Remove a key
s.forget('temp_key');

// Remove all data
s.flush();

// Read all session data
const all = s.all();

// Read and immediately remove
const code = s.pull('verification_code');
```

---

## Flash data

Flash data is available for **exactly one** subsequent request, then automatically removed. Useful for success/error messages after redirects.

```typescript
// Write flash data (available in the next request)
s.flash('status', 'Profile updated!');
s.flash('errors', ['Email is required.']);

// In the next request — read the flash data
const status = s.get('status'); // 'Profile updated!'
```

### Reflash and keep

```typescript
// Keep all current flash data for one more request
s.reflash();

// Keep specific keys for one more request
s.keep('status', 'errors');

// Flash that is only visible in the *current* request (not the next one)
s.now('warning', 'Unsaved changes');
```

---

## Session regeneration

Regenerate the session ID after login to prevent session fixation attacks:

```typescript
// New ID — data is preserved
await s.regenerate();

// New ID — old session data is destroyed
await s.regenerate(true);

// Destroy old session and flush all data
await s.invalidate();
```

---

## Incrementing and decrementing

```typescript
s.increment('page_views'); // returns 1
s.increment('page_views', 5); // returns 6
s.decrement('credits'); // returns -1
```

---

## Previous URL

```typescript
// Store the previous URL (useful for redirects after login)
s.setPreviousUrl(req.url());

// Read it back
const prev = s.previousUrl();
```

---

## CSRF Protection

CSRF protection is handled automatically by the `PreventRequestForgery` middleware when the `csrf` middleware is in your route pipeline. There is nothing to configure for most applications.

### How it works

Every `POST`, `PUT`, `PATCH`, or `DELETE` request goes through a two-layer check:

**Layer 1 — Origin verification (Sec-Fetch-Site)**

Modern browsers set the `Sec-Fetch-Site` header automatically. If it reads `same-origin`, the request is allowed without any token check.

**Layer 2 — CSRF token fallback**

For requests without a valid `Sec-Fetch-Site` header (older browsers, API clients, non-HTTPS):

1. Check `_token` field in the POST body
2. Check `X-CSRF-TOKEN` request header
3. Check `X-XSRF-TOKEN` request header (using the encrypted cookie value)

If none match the session token, the request is rejected with HTTP `419`.

---

### Using the CSRF token in forms

Retrieve the token from the session and embed it as a hidden field:

```typescript
// In a controller
async create(req: Request): Promise<Response> {
  const token = session(req).token();
  return Response.html(`
    <form method="POST" action="/profile">
      <input type="hidden" name="_token" value="${token}" />
      <input type="text" name="name" />
      <button type="submit">Save</button>
    </form>
  `);
}
```

### Fetch / Axios (SPA)

For SPA clients, the `PreventRequestForgery` middleware automatically sets an `XSRF-TOKEN` cookie on every response. Axios reads this cookie and includes it as the `X-XSRF-TOKEN` header on every subsequent request automatically — no configuration required.

For plain `fetch`, pass the token manually:

```typescript
const token = document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1];

await fetch('/api/profile', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-TOKEN': decodeURIComponent(token ?? ''),
  },
  body: JSON.stringify({ name: 'Alice' }),
});
```

Or store the token in a meta tag and reference it:

```html
<meta name="csrf-token" content="{{ csrfToken }}" />
```

```typescript
const meta = document.querySelector('meta[name="csrf-token"]');
const token = meta?.getAttribute('content') ?? '';
```

---

### Excluding URIs from CSRF protection

Exclude webhook endpoints or third-party callbacks that cannot include a CSRF token:

```typescript
// bootstrap/app.ts
import { SessionServiceProvider } from '@faber-js/session';

app.register(
  new SessionServiceProvider(app, sessionConfig, {
    except: [
      '/webhooks/stripe',
      '/webhooks/github',
      '/webhooks/*', // wildcard suffix
    ],
  }),
);
```

::: warning
Place webhook routes **outside** any middleware group that includes `session` or `csrf`. Excluded URIs still pass through the middleware — they just skip the token check.
:::

---

### Origin-only mode

Rely exclusively on `Sec-Fetch-Site` and disable the token fallback entirely:

```typescript
app.register(
  new SessionServiceProvider(app, sessionConfig, {
    originOnly: true,
  }),
);
```

In this mode, requests that fail origin verification return HTTP `403` instead of `419`.

::: warning
Origin-only mode only works over HTTPS. Browsers only send `Sec-Fetch-Site` on secure connections. If your app is served over HTTP, all requests will fail.
:::

---

### Allowing same-site requests

Allow requests from subdomains or same-site origins in addition to the same origin:

```typescript
app.register(
  new SessionServiceProvider(app, sessionConfig, {
    allowSameSite: true,
  }),
);
```

---

## Drivers

| Driver   | Class                 | Use case                                  |
| -------- | --------------------- | ----------------------------------------- |
| `file`   | `FileSessionDriver`   | Development and single-server production  |
| `memory` | `MemorySessionDriver` | Tests — data lives only in process memory |

### Custom driver

Implement the `SessionDriver` interface to use any backing store (Redis, DynamoDB, database, etc.):

```typescript
import type { SessionDriver } from '@faber-js/session';

export class RedisSessionDriver implements SessionDriver {
  async read(id: string): Promise<Record<string, unknown>> {
    const raw = await redis.get(`session:${id}`);
    return raw ? JSON.parse(raw) : {};
  }

  async write(id: string, data: Record<string, unknown>, ttlSeconds: number): Promise<void> {
    await redis.setex(`session:${id}`, ttlSeconds, JSON.stringify(data));
  }

  async destroy(id: string): Promise<void> {
    await redis.del(`session:${id}`);
  }

  async gc(maxLifetimeSeconds: number): Promise<void> {
    // Redis handles expiry natively — no-op
  }
}
```

Pass the driver directly to `StartSession`:

```typescript
import { StartSession, PreventRequestForgery } from '@faber-js/session';

const driver = new RedisSessionDriver();

kernel.alias('session', new StartSession(driver, sessionConfig.cookie));
kernel.alias('csrf', new PreventRequestForgery({ except: ['/webhooks/*'] }, sessionConfig.cookie));
```

---

## `Session` API reference

| Method                 | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `get(key, default?)`   | Read a value                                      |
| `put(key, value)`      | Write a value                                     |
| `has(key)`             | `true` if key is set and not null/undefined       |
| `missing(key)`         | `true` if key is not set                          |
| `all()`                | All session data as a plain object                |
| `forget(...keys)`      | Remove one or more keys                           |
| `flush()`              | Remove all session data                           |
| `pull(key, default?)`  | Read and immediately remove                       |
| `flash(key, value)`    | Write data available for the next request only    |
| `reflash()`            | Keep all flash data for one more request          |
| `keep(...keys)`        | Keep specific flash keys for one more request     |
| `now(key, value)`      | Flash visible in the current request only         |
| `increment(key, by?)`  | Increment a numeric counter                       |
| `decrement(key, by?)`  | Decrement a numeric counter                       |
| `token()`              | Get (or generate) the CSRF token for this session |
| `getId()`              | Get the session ID                                |
| `regenerate(destroy?)` | Assign a new session ID                           |
| `invalidate()`         | Destroy old session, flush data, new ID           |
| `setPreviousUrl(url)`  | Store the previous URL                            |
| `previousUrl()`        | Read the previous URL                             |
