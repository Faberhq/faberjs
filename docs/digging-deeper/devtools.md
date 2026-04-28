# DevTools Dashboard

`@faber-js/devtools` gives you a live observability dashboard for your FaberJS app at `/_faber` with zero configuration. It records every HTTP request, SQL query, and dispatched event — with timing, status codes, memory deltas, and request↔query correlation — and displays them in a dark-themed browser UI that auto-refreshes every three seconds.

The dashboard is **automatically disabled** when `APP_ENV=production`.

## Prerequisites

```bash
pnpm add @faber-js/devtools
```

## Registration

Add `DevToolsServiceProvider` to your `bootstrap/app.ts`. Pass optional `db` and `dispatcher` references to enable SQL and event tracing:

```typescript
// bootstrap/app.ts
import { DevToolsServiceProvider } from '@faber-js/devtools';
import { getConnection } from '@faber-js/orm';
import { Application } from '@faber-js/core';

const app = Application.getInstance();

// Register your other providers first...
app.register(new OrmServiceProvider(app));
app.register(new EventServiceProvider(app));

// Then register DevTools, passing the live instances
app.register(new DevToolsServiceProvider(app, {
  db: getConnection(),                              // optional — enables SQL tab
  dispatcher: app.make('events'),                  // optional — enables Events tab
}));
```

Both `db` and `dispatcher` are optional. Omit either to skip that tracing category.

## Opening the dashboard

Start your dev server and navigate to `/_faber` in your browser:

```bash
npx faber serve
# → http://localhost:3000/_faber
```

The dashboard has three tabs:

| Tab | What it shows |
|---|---|
| **Requests** | HTTP method, path, status, duration, SQL query count, heap delta, timestamp |
| **Queries** | SQL statement, duration, whether it was triggered by a request or ran in the background |
| **Events** | Event type, duration, timestamp |

Rows are newest-first. Slow queries (>100ms) and slow requests (>500ms) are highlighted in amber; very slow (>200ms / >1s) in red.

## Configuration

Pass any of these options as the second argument to the provider:

```typescript
app.register(new DevToolsServiceProvider(app, {
  enabled:            true,    // default: APP_ENV !== 'production'
  path:               '/_faber', // dashboard base URL
  slowQueryThreshold: 100,     // ms — queries above this are highlighted
  maxRequests:        200,     // ring buffer size
  maxQueries:         500,
  maxEvents:          500,
  maxAgentTraces:     100,
}));
```

### Explicitly disabling in staging

```typescript
app.register(new DevToolsServiceProvider(app, {
  enabled: process.env.APP_ENV === 'local',
}));
```

## How it works

### HTTP tracing

`DevHttpTracer` is a `Middleware` automatically pushed to the front of the global middleware stack. For every request that does **not** start with `/_faber` it:

1. Generates a UUID request ID and opens an `AsyncLocalStorage` scope.
2. Awaits `next(request)` (your entire controller stack runs inside this scope).
3. Records method, path, status code, duration, heap delta, and correlated query count.

The `AsyncLocalStorage` scope means any SQL query executed during that request automatically inherits the request ID, so the **Queries** tab can show which request triggered each query.

### SQL tracing

`DevOrmTracer` hooks into Knex's `query`, `query-response`, and `query-error` events. It records the SQL, bindings, duration, and links the trace to the current request ID (if any).

### Event tracing

`DevEventTracer` calls `dispatcher.listenWildcard()` to receive every dispatched event. It records the event type and duration.

## API endpoints

The dashboard shell polls these JSON endpoints every three seconds:

| Route | Returns |
|---|---|
| `GET /_faber` | Dashboard HTML |
| `GET /_faber/api/requests` | `RequestTrace[]` |
| `GET /_faber/api/queries` | `SqlTrace[]` |
| `GET /_faber/api/events` | `EventTrace[]` |
| `GET /_faber/api/agents` | `AgentTrace[]` |
| `DELETE /_faber/api/clear` | Clears all buffers |

These endpoints are served by `DashboardController`, which is registered automatically by the service provider.

## Using traces in tests

If you need to inspect traces during integration tests, resolve `TraceStore` from the container:

```typescript
import { TraceStore } from '@faber-js/devtools';
import { Application } from '@faber-js/core';

const store = Application.getInstance().make(TraceStore);

// After making an HTTP request in your test:
const requests = store.getRequests();
expect(requests[0].queryCount).toBe(1);
expect(requests[0].status).toBe(200);
```

## Ring buffer

Traces are held in fixed-size in-memory ring buffers. When a buffer is full, the oldest entry is dropped. Buffer sizes are configurable via `maxRequests`, `maxQueries`, `maxEvents`, and `maxAgentTraces`. No data is written to disk and nothing persists across restarts.
