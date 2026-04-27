# Responses

Every controller method must return a `Response` instance from `@faber-js/http`. Responses are created using static factory methods — you never call `new Response()` directly.

## JSON responses

### `Response.json(data, status?)`

The most common response. Returns a JSON body with `Content-Type: application/json`. Status defaults to `200`.

```typescript
import { Response } from '@faber-js/http';

return Response.json({ data: users });
return Response.json({ data: user }, 201);
return Response.json({ message: 'Payment required' }, 402);
```

You can also use the `this.json()` helper in controllers, which delegates to `Response.json()`:

```typescript
// Equivalent to Response.json({ data: users })
return this.json({ data: users });
```

## Empty responses

### `Response.noContent()`

Returns a `204 No Content` response with no body. Use for successful `DELETE` requests.

```typescript
return Response.noContent();
// or inside a controller:
return this.noContent();
```

## Error responses

### `Response.notFound(message?)`

Shorthand for a `404` JSON response.

```typescript
return Response.notFound();
return Response.notFound('Post not found');
// { "message": "Not Found" } with status 404
```

### `Response.error(message, status?)`

Generic error response. Status defaults to `500`.

```typescript
return Response.error('Something went wrong');
return Response.error('Unprocessable entity', 422);
```

## Redirects

### `Response.redirect(url, status?)`

Returns a redirect response. Status defaults to `302`.

```typescript
return Response.redirect('/login');
return Response.redirect('/dashboard', 301); // permanent redirect
// or inside a controller:
return this.redirect('/login');
```

## Streaming responses

### `Response.stream(source, status?)`

Streams an `AsyncIterable<string>` to the client. The content type is set to `text/plain; charset=utf-8`. This is the primary mechanism for streaming AI agent output.

```typescript
async stream(req: Request): Promise<Response> {
  const agent = new SupportAgent();
  const message = req.input('message') as string;

  async function* generate(): AsyncGenerator<string> {
    for await (const chunk of agent.stream(message)) {
      yield chunk;
    }
  }

  return Response.stream(generate());
}
```

## Inspecting responses

If you need to inspect a response (e.g. in middleware or tests), use the getter methods:

```typescript
const response = Response.json({ id: 1 }, 201);

response.getStatus(); // 201
response.getBody(); // { id: 1 }
response.getHeaders(); // { 'content-type': 'application/json' }
```

## Common status codes

| Code | Meaning              | Helper                                           |
| ---- | -------------------- | ------------------------------------------------ |
| 200  | OK                   | `Response.json(data)`                            |
| 201  | Created              | `Response.json(data, 201)`                       |
| 204  | No Content           | `Response.noContent()`                           |
| 301  | Moved Permanently    | `Response.redirect(url, 301)`                    |
| 302  | Found (redirect)     | `Response.redirect(url)`                         |
| 400  | Bad Request          | `Response.error('Bad Request', 400)`             |
| 401  | Unauthorized         | thrown by `AuthMiddleware` automatically         |
| 403  | Forbidden            | thrown by `this.authorize()` automatically       |
| 404  | Not Found            | `Response.notFound()`                            |
| 422  | Unprocessable Entity | thrown by `FormRequest.validate()` automatically |
| 500  | Server Error         | `Response.error('...')`                          |

## Exception-based error handling

The `HttpKernel` catches known exceptions and converts them to the appropriate HTTP response automatically. You rarely need to return error responses manually:

```typescript
// These are caught globally by the HttpKernel:
throw new NotFoundException('Post not found'); // 404
throw new UnauthorizedException(); // 401
throw new ForbiddenException(); // 403
throw new ValidationException(errors); // 422
```

Import from `@faber-js/http`:

```typescript
import {
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ValidationException,
} from '@faber-js/http';
```
