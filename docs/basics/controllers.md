# Controllers

Controllers are the HTTP entry point for your application. They receive a `Request`, call one or more services, and return a `Response`. Controllers should contain no business logic.

## Generating a controller

```bash
npx faber make:controller UserController
```

This creates `app/controllers/UserController.ts`:

```typescript
import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';

@Injectable()
export class UserController extends Controller {
  async index(_req: Request): Promise<Response> {
    return this.json({ data: [] });
  }

  async show(req: Request): Promise<Response> {
    const id = req.route('id');
    return this.json({ data: { id } });
  }

  async store(_req: Request): Promise<Response> {
    return this.json({ data: {} }, 201);
  }

  async update(_req: Request): Promise<Response> {
    return this.json({ data: {} });
  }

  async destroy(_req: Request): Promise<Response> {
    return this.noContent();
  }
}
```

## Dependency injection

Controllers extend `Controller`, which is already `@Injectable()`. Declare dependencies in the constructor and they are resolved from the IoC container automatically:

```typescript
import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';
import { UserService } from '../services/UserService';

@Injectable()
export class UserController extends Controller {
  constructor(private readonly userService: UserService) {
    super();
  }

  async index(_req: Request): Promise<Response> {
    const users = await this.userService.all();
    return this.json({ data: users });
  }

  async show(req: Request): Promise<Response> {
    const id = Number(req.route('id'));
    const user = await this.userService.find(id);
    if (!user) return Response.notFound();
    return this.json({ data: user });
  }

  async store(req: Request): Promise<Response> {
    const attrs = req.only('name', 'email', 'password');
    const user = await this.userService.create(attrs);
    return this.json({ data: user }, 201);
  }

  async destroy(req: Request): Promise<Response> {
    const id = Number(req.route('id'));
    await this.userService.delete(id);
    return this.noContent();
  }
}
```

## Response helpers

`Controller` provides three response helpers:

### `this.json(data, status?)`

Returns a JSON response. Status defaults to `200`.

```typescript
return this.json({ id: 1, name: 'Alice' }); // 200
return this.json({ data: user }, 201); // 201 Created
return this.json({ message: 'Gone' }, 410); // any 4xx/5xx
```

### `this.noContent()`

Returns an empty `204 No Content` response. Use this for successful `DELETE` operations.

```typescript
return this.noContent();
```

### `this.redirect(url, status?)`

Returns a redirect response. Status defaults to `302`.

```typescript
return this.redirect('/login');
return this.redirect('/dashboard', 301);
```

## Authorization

Controllers expose an `authorize()` helper that checks a policy. It throws a `ForbiddenException` (403) if the check fails:

```typescript
async update(req: Request): Promise<Response> {
  const post = await Post.findOrFail(Number(req.route('id')));
  await this.authorize(req.user, 'update', post);  // throws 403 if denied

  const updated = await post.update(req.only('title', 'body'));
  return this.json({ data: updated });
}
```

See [Authentication](/digging-deeper/auth) for how to define policies.

## Multiple services

Controllers can inject multiple services:

```typescript
@Injectable()
export class PostController extends Controller {
  constructor(
    private readonly postService: PostService,
    private readonly tagService: TagService,
  ) {
    super();
  }

  async store(req: Request): Promise<Response> {
    const post = await this.postService.create(req.only('title', 'body'));
    await this.tagService.attach(post, req.input('tags') as string[]);
    return this.json({ data: post }, 201);
  }
}
```

## Using `Response` directly

For cases where the helper methods are not enough, use `Response` static methods directly:

```typescript
import { Response } from '@faber-js/http';

// In a controller method:
return Response.json({ error: 'custom' }, 422);
return Response.notFound('User not found');
return Response.error('Something went wrong', 500);
return Response.stream(asyncGenerator, 200);
```

See [Responses](/basics/responses) for all available static methods.
