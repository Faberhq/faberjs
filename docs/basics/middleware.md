# Middleware

Middleware sits between the HTTP layer and your controllers. Each middleware receives a `Request`, can modify it or terminate the request cycle early, and then calls `next(request)` to pass control to the next layer.

## Writing middleware

Implement the `Middleware` interface from `@faber-js/http`. Generate a stub with the CLI:

```bash
faber make:middleware ThrottleMiddleware
```

Generated file (`app/middleware/ThrottleMiddleware.ts`):

```typescript
import type { Middleware, NextFunction } from '@faber-js/http';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';

export class ThrottleMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    return next(request);
  }
}
```

### A real example — logging middleware

```typescript
import type { Middleware, NextFunction, Request, Response } from '@faber-js/http';

export class LogMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    const start = Date.now();
    const response = await next(request);
    const duration = Date.now() - start;
    console.log(`${request.method()} ${request.path()} → ${response.getStatus()} (${duration}ms)`);
    return response;
  }
}
```

### Terminating early

Return a `Response` without calling `next()` to short-circuit the pipeline:

```typescript
import type { Middleware, NextFunction, Request, Response } from '@faber-js/http';

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

    request.user = user;
    return next(request);
  }
}
```

FaberJS ships `AuthMiddleware` from `@faber-js/auth` — you do not need to write this yourself.

## Registering middleware

Middleware is registered by its string key in the `HttpKernel`. The `HttpKernel` is configured in `bootstrap/app.ts` or in your `HttpServiceProvider`.

```typescript
import { HttpKernel } from '@faber-js/http';
import { AuthMiddleware } from '@faber-js/auth';
import { LogMiddleware } from '../app/middleware/LogMiddleware';

const kernel = new HttpKernel();

// Global middleware — runs on every request
kernel.pushGlobal(new LogMiddleware());

// Named middleware — referenced by key in routes
kernel.register('auth', new AuthMiddleware());
kernel.register('throttle', new ThrottleMiddleware());
```

## Applying middleware to routes

Use the string key you registered:

```typescript
// Single route
Route.get('/profile', [ProfileController, 'show']).middleware(['auth']);

// Route group
Route.group({ middleware: ['auth', 'throttle'] }, () => {
  Route.get('/posts', [PostController, 'index']);
  Route.post('/posts', [PostController, 'store']);
});
```

## Middleware order

Middleware runs in the order it is applied — global middleware first, then route middleware in array order. The pipeline is built using a recursive chain, so the first middleware in the list is the outermost wrapper:

```
Global Log → Auth → Throttle → Controller
```

## Built-in middleware

FaberJS ships one ready-to-use middleware:

| Key (suggested) | Class            | Package          | Description                                |
| --------------- | ---------------- | ---------------- | ------------------------------------------ |
| `auth`          | `AuthMiddleware` | `@faber-js/auth` | Validates a Bearer JWT and sets `req.user` |

Register it in your kernel:

```typescript
import { AuthMiddleware } from '@faber-js/auth';

kernel.register('auth', new AuthMiddleware());
```
