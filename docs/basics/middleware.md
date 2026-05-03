# Middleware

Middleware sits between the HTTP layer and your controllers. Each middleware receives a `Request`, can inspect or modify it, and then calls `next(request)` to pass control to the next layer — or returns a `Response` directly to short-circuit the pipeline.

## Writing middleware

Implement the `Middleware` interface from `@faber-js/http`. Generate a stub with the CLI:

```bash
npx faber make:middleware EnsureTokenIsValid
```

Generated file (`app/middleware/EnsureTokenIsValidMiddleware.ts`):

```typescript
import type { Middleware, NextFunction } from '@faber-js/http';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';

export class EnsureTokenIsValidMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    return next(request);
  }
}
```

### Before / after patterns

Middleware can act **before** the request reaches the controller, **after** the response is built, or both:

```typescript
// Before only
export class BeforeMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    // runs before the controller
    return next(request);
  }
}

// After only
export class AfterMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    const response = await next(request);
    // runs after the controller
    return response;
  }
}
```

### Terminating early

Return a `Response` without calling `next()` to short-circuit the pipeline:

```typescript
export class MaintenanceModeMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    if (process.env['MAINTENANCE'] === 'true') {
      return Response.error('Service is currently under maintenance.', 503);
    }
    return next(request);
  }
}
```

### Modifying the request

Middleware can attach data to the request before passing it along. The most common case is setting `request.user` after verifying a token:

```typescript
import { Application } from '@faber-js/core';
import { UnauthorizedException } from '@faber-js/http';
import type { Middleware, NextFunction, Request, Response } from '@faber-js/http';
import type { GuardContract } from '@faber-js/auth';

export class AuthMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    const token = request.bearerToken();
    if (!token) throw new UnauthorizedException();

    const guard = Application.getInstance().make<GuardContract>('auth.guard');
    const user = await guard.user(token);
    if (!user) throw new UnauthorizedException();

    request.setUser(user);
    return next(request);
  }
}
```

FaberJS ships `AuthMiddleware` from `@faber-js/auth` — you do not need to write this yourself.

## Registering middleware

Register middleware in your `HttpKernel` (typically in `bootstrap/app.ts` or a service provider).

### Global middleware

Global middleware runs on **every** request, in registration order:

```typescript
import { HttpKernel } from '@faber-js/http';
import { LogMiddleware } from '../app/middleware/LogMiddleware';

const kernel = new HttpKernel(app);

kernel.use(new LogMiddleware());
// or equivalently:
kernel.pushGlobal(new LogMiddleware());
```

### Named middleware (aliases)

Register named middleware by a string key so routes can reference them:

```typescript
import { AuthMiddleware } from '@faber-js/auth';

kernel.alias('auth', new AuthMiddleware());
kernel.alias('throttle', new ThrottleMiddleware());

// kernel.register() is an alias for kernel.alias()
kernel.register('log', new LogMiddleware());
```

## Applying middleware to routes

Reference the registered key on a route or group:

```typescript
// Single route
Route.get('/profile', [ProfileController, 'show']).middleware(['auth']);

// Multiple middleware
Route.get('/dashboard', [DashboardController, 'index']).middleware(['auth', 'throttle']);

// Route group — all routes inside inherit the middleware
Route.group({ middleware: ['auth'] }, () => {
  Route.get('/posts', [PostController, 'index']);
  Route.post('/posts', [PostController, 'store']);
});
```

### Middleware parameters

Pass arguments to a middleware using the `name:param` syntax — separate multiple params with commas:

```typescript
Route.put('/post/:id', [PostController, 'update']).middleware(['role:editor']);

Route.delete('/post/:id', [PostController, 'destroy']).middleware(['role:editor,publisher']);
```

Declare the parameters after `next` in your middleware's `handle` method:

```typescript
export class RoleMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction, ...roles: string[]): Promise<Response> {
    const user = request.user();
    if (!user || !roles.includes(user.role as string)) {
      throw new ForbiddenException();
    }
    return next(request);
  }
}
```

Register it by alias:

```typescript
kernel.alias('role', new RoleMiddleware());
```

### Excluding middleware from a route

Use `.withoutMiddleware()` to prevent a specific middleware from running on a route, even if it was inherited from a group:

```typescript
Route.group({ middleware: ['auth', 'throttle'] }, () => {
  Route.get('/', [HomeController, 'index']);

  // auth still runs, throttle is skipped on this route
  Route.get('/status', [StatusController, 'index']).withoutMiddleware(['throttle']);
});
```

::: tip
`withoutMiddleware` only removes **route middleware** (including group-inherited ones). It cannot remove global middleware registered via `kernel.use()`.
:::

## Middleware groups

Group several named middleware under a single key to make routes cleaner.

### Defining a group

```typescript
kernel.middlewareGroup('api', ['throttle', 'auth']);
kernel.middlewareGroup('web', ['session', 'csrf', 'auth']);
```

Assign the group name on a route just like any other middleware key:

```typescript
Route.get('/posts', [PostController, 'index']).middleware(['api']);

Route.group({ middleware: ['web'] }, () => {
  Route.get('/dashboard', [DashboardController, 'index']);
});
```

### Appending and prepending to groups

Add middleware to an existing group without redefining it:

```typescript
kernel.middlewareGroup('api', ['throttle', 'auth']);

// Add to the end
kernel.appendToGroup('api', ['log']);

// Add to the beginning
kernel.prependToGroup('api', ['cors']);

// 'api' group is now: ['cors', 'throttle', 'auth', 'log']
```

This is useful in service providers where each package can extend a shared group without knowing about the others.

## Middleware priority

By default, middleware run in the order they are declared on the route. Use `priority()` to enforce a stable execution order regardless of declaration order — a common need when multiple packages register middleware into the same group:

```typescript
kernel.priority(['cors', 'session', 'auth', 'throttle']);
```

When building the pipeline, FaberJS sorts any route middleware whose name appears in the priority list before those that don't:

```
// Declared as: ['throttle', 'log', 'auth']
// After priority(['cors', 'auth', 'throttle']):
// Executed as: ['auth', 'throttle', 'log']
```

Global middleware (registered via `kernel.use()`) always run first, in registration order, and are not affected by the priority list.

## Terminable middleware

Some middleware need to perform work **after** the HTTP response has been sent — flushing metrics, recording timing, releasing resources. Implement the `TerminableMiddleware` interface:

```typescript
import type { TerminableMiddleware, NextFunction, Request, Response } from '@faber-js/http';

export class MetricsMiddleware implements TerminableMiddleware {
  private start = 0;

  async handle(request: Request, next: NextFunction): Promise<Response> {
    this.start = Date.now();
    return next(request);
  }

  terminate(request: Request, response: Response): void {
    const duration = Date.now() - this.start;
    console.log(`${request.method()} ${request.path()} → ${response.getStatus()} (${duration}ms)`);
  }
}
```

Register it like any other middleware:

```typescript
kernel.use(new MetricsMiddleware());
// or as a named middleware
kernel.alias('metrics', new MetricsMiddleware());
```

FaberJS calls `terminate()` on every middleware in the pipeline (global + route) that implements `TerminableMiddleware`, after the response has been dispatched. Terminable middleware that was wrapped with parameters still has its `terminate` method called correctly.

::: tip
The `terminate()` method receives both `request` and `response`, but it cannot modify them — the response has already been sent. Use it only for side effects like logging, metrics, or cleanup.
:::

## Middleware execution order

For a request to `GET /posts` with `kernel.use(LogMiddleware)` and route middleware `['auth', 'throttle']`:

```
Global:  LogMiddleware (before)
Route:   AuthMiddleware (before)
Route:   ThrottleMiddleware (before)
         → PostController.index()
Route:   ThrottleMiddleware (after)
Route:   AuthMiddleware (after)
Global:  LogMiddleware (after)
         → response sent
         → terminate() called on all TerminableMiddleware
```

## Built-in middleware

### CORS — `HandleCors`

Handles Cross-Origin Resource Sharing (CORS) headers and pre-flight `OPTIONS` requests:

```typescript
import { HandleCors } from '@faber-js/http';

kernel.use(new HandleCors());
// or with options:
kernel.use(
  new HandleCors({
    origin: ['https://app.example.com', 'https://admin.example.com'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    headers: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }),
);
```

`HandleCors` should run as a **global** middleware (before routing) so that pre-flight `OPTIONS` requests are handled even for protected routes. When `origin` is omitted, it reflects the request origin (`Access-Control-Allow-Origin: *` for non-credentialed requests).

### Method spoofing — `MethodSpoofing`

Allows HTML forms (which only support `GET`/`POST`) to tunnel `PUT`, `PATCH`, or `DELETE` by reading a `_method` hidden field:

```typescript
import { MethodSpoofing } from '@faber-js/http';

kernel.use(new MethodSpoofing());
```

```html
<form method="POST" action="/posts/1">
  <input type="hidden" name="_method" value="PUT" />
  ...
</form>
```

After `MethodSpoofing` processes the request, `request.method()` returns the spoofed method (`PUT`) while `request.realMethod()` always returns the original HTTP method (`POST`).

### Rate limiting — `ThrottleRequests`

Limits requests per IP using any `RateLimiterInterface`-compatible backend (e.g. `@faber-js/cache`):

```typescript
import { ThrottleRequests } from '@faber-js/http';
import { RateLimiter } from '@faber-js/cache';

const limiter = app.make<RateLimiter>('rate-limiter');
kernel.alias('throttle', new ThrottleRequests(limiter));
```

Apply per-route with optional `maxAttempts:decaySeconds` parameters:

```typescript
// 60 requests per 60 seconds (defaults)
Route.get('/api/data', [DataController, 'index']).middleware(['throttle']);

// 10 requests per 30 seconds
Route.post('/api/upload', [UploadController, 'store']).middleware(['throttle:10,30']);
```

When exceeded, throws `TooManyRequestsException` (HTTP 429) with a `retryAfter` value in seconds.

### Other built-in middleware

| Key (suggested) | Class                   | Package             | Description                                                                 |
| --------------- | ----------------------- | ------------------- | --------------------------------------------------------------------------- |
| `cors`          | `HandleCors`            | `@faber-js/http`    | CORS headers + pre-flight `OPTIONS` responses                               |
| `throttle`      | `ThrottleRequests`      | `@faber-js/http`    | Rate limiting by IP — throws 429 when exceeded                              |
| `session`       | `StartSession`          | `@faber-js/session` | Loads session from cookie, saves on response, sets `Set-Cookie`             |
| `csrf`          | `PreventRequestForgery` | `@faber-js/session` | CSRF protection — origin check + token fallback for `POST/PUT/PATCH/DELETE` |
| `auth`          | `AuthMiddleware`        | `@faber-js/auth`    | Validates a Bearer JWT and calls `request.setUser()`                        |
| `signed`        | `SignedMiddleware`      | `@faber-js/router`  | Validates signed/temporary-signed route URLs                                |

Register built-in middleware in your kernel:

```typescript
import { HandleCors, MethodSpoofing, ThrottleRequests } from '@faber-js/http';
import { AuthMiddleware } from '@faber-js/auth';
import { SignedMiddleware } from '@faber-js/router';
import { StartSession, PreventRequestForgery } from '@faber-js/session';

// Global — runs on every request
kernel.use(new HandleCors());
kernel.use(new MethodSpoofing());

// Named aliases — applied per-route
kernel.alias('throttle', new ThrottleRequests(rateLimiter));
kernel.alias('auth', new AuthMiddleware());
kernel.alias('signed', new SignedMiddleware());
kernel.alias('session', new StartSession(driver, sessionConfig.cookie));
kernel.alias('csrf', new PreventRequestForgery());
```

::: tip
The `SessionServiceProvider` registers `session` and `csrf` automatically — you only need to wire them manually when using a custom driver or CSRF options. See the [Sessions & CSRF](/digging-deeper/sessions) guide.
:::
