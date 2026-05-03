# Controllers

Controllers are the HTTP entry point for your application. They receive a `Request`, call one or more services, and return a `Response`. Controllers should contain no business logic — that belongs in [Services](/digging-deeper/services).

---

## Generating a controller

```bash
# Plain controller (index, show, store, update, destroy)
npx faber make:controller User

# Full resource controller (all 7 methods: index, create, store, show, edit, update, destroy)
npx faber make:controller Post --resource

# API resource controller (5 methods: index, store, show, update, destroy — no HTML forms)
npx faber make:controller Post --api

# Single-action invokable controller
npx faber make:controller Archive --invokable

# Associate with a model (sets route param name in stubs)
npx faber make:controller Post --resource --model=Post

# Also generate StorePostRequest and UpdatePostRequest
npx faber make:controller Post --resource --model=Post --requests
```

**Flags summary:**

| Flag                  | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `-i, --invokable`     | Generate a single-action controller with `__invoke()`                |
| `-r, --resource`      | Generate a full resource controller (all 7 CRUD methods)             |
| `-a, --api`           | Generate an API resource controller (5 methods, no create/edit)      |
| `-m, --model <Model>` | Set the model name used for route param names in the stub            |
| `-R, --requests`      | Also generate `Store{Model}Request` and `Update{Model}Request` files |

---

## Basic controllers

`make:controller` creates `app/controllers/UserController.ts`:

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

Register in `routes/api.ts`:

```typescript
import { Route } from '@faber-js/router';
import { UserController } from '../app/controllers/UserController';

Route.get('/users', [UserController, 'index']);
Route.post('/users', [UserController, 'store']);
Route.get('/users/:id', [UserController, 'show']);
Route.put('/users/:id', [UserController, 'update']);
Route.delete('/users/:id', [UserController, 'destroy']);
```

Or use a single resource declaration — see [Resource controllers](#resource-controllers).

---

## Single-action (invokable) controllers

When a controller handles exactly one action, use `--invokable`. The method is named `__invoke`:

```typescript
@Injectable()
export class ArchivePostController extends Controller {
  async __invoke(req: Request): Promise<Response> {
    const post = await Post.findOrFail(Number(req.route('post')));
    await post.update({ archived: true });
    return this.noContent();
  }
}
```

Register with just the class (no method name):

```typescript
Route.post('/posts/:post/archive', [ArchivePostController]);
// or
Route.post('/posts/:post/archive', ArchivePostController);
```

---

## Dependency injection

Declare services in the constructor. The IoC container resolves them automatically because the class is decorated with `@Injectable()`:

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

The container also injects services into **method parameters** automatically. Any parameter type that is registered in the container will be resolved — `Request` is always passed as-is:

```typescript
async index(req: Request, postService: PostService): Promise<Response> {
  const posts = await postService.all();
  return this.json({ data: posts });
}
```

---

## Resource controllers

`Route.resource()` registers all seven conventional REST routes at once. Generate the full stub with `--resource`:

```bash
npx faber make:controller Post --resource --model=Post
```

This produces a controller with all seven methods. Register it with:

```typescript
Route.resource('posts', PostController);
```

The seven routes registered:

| Verb   | Path                | Controller method | Route name      |
| ------ | ------------------- | ----------------- | --------------- |
| GET    | `/posts`            | `index`           | `posts.index`   |
| GET    | `/posts/create`     | `create`          | `posts.create`  |
| POST   | `/posts`            | `store`           | `posts.store`   |
| GET    | `/posts/:post`      | `show`            | `posts.show`    |
| GET    | `/posts/:post/edit` | `edit`            | `posts.edit`    |
| PUT    | `/posts/:post`      | `update`          | `posts.update`  |
| DELETE | `/posts/:post`      | `destroy`         | `posts.destroy` |

The route parameter name is the singularized resource name (`:post` for `posts`, `:photo` for `photos`).

### Partial resource routes

Use `only()` or `except()` to limit registered routes:

```typescript
// Only index, show, and store
Route.resource('photos', PhotoController).only(['index', 'show', 'store']);

// All routes except create and edit (useful for SPAs)
Route.resource('photos', PhotoController).except(['create', 'edit']);
```

### API resource controllers

For JSON APIs (no HTML form views needed), use `apiResource()` — it registers five routes (no `create`/`edit`):

```typescript
Route.apiResource('posts', PostController);

// Multiple at once
Route.apiResources({
  posts: PostController,
  comments: CommentController,
});
```

Generate the stub with `--api`:

```bash
npx faber make:controller Post --api
```

### Multiple resource controllers

Register several resources at once with `resources()`:

```typescript
Route.resources({
  photos: PhotoController,
  posts: PostController,
  videos: VideoController,
});
```

---

## Nested resources

Dot notation creates nested resource routes:

```typescript
Route.resource('photos.comments', CommentController);
```

Registers:

| Verb   | Path                                    | Controller method |
| ------ | --------------------------------------- | ----------------- |
| GET    | `/photos/:photo/comments`               | `index`           |
| GET    | `/photos/:photo/comments/create`        | `create`          |
| POST   | `/photos/:photo/comments`               | `store`           |
| GET    | `/photos/:photo/comments/:comment`      | `show`            |
| GET    | `/photos/:photo/comments/:comment/edit` | `edit`            |
| PUT    | `/photos/:photo/comments/:comment`      | `update`          |
| DELETE | `/photos/:photo/comments/:comment`      | `destroy`         |

### Shallow nesting

Use `.shallow()` to only nest the routes that require a parent ID. Member routes (`show`, `edit`, `update`, `destroy`) are promoted to the top level:

```typescript
Route.resource('photos.comments', CommentController).shallow();
```

This means:

- `GET /photos/:photo/comments` — collection routes stay nested
- `GET /comments/:comment` — member routes are un-nested

---

## Singleton resources

Singleton resources represent a single object (no ID required), like a user's profile:

```typescript
Route.singleton('profile', ProfileController);
```

Registers three routes:

| Verb | Path            | Controller method |
| ---- | --------------- | ----------------- |
| GET  | `/profile`      | `show`            |
| GET  | `/profile/edit` | `edit`            |
| PUT  | `/profile`      | `update`          |

Add creation/deletion with `creatable()`:

```typescript
Route.singleton('profile', ProfileController).creatable();
// Adds GET /profile/create, POST /profile, DELETE /profile
```

Or just destroy:

```typescript
Route.singleton('profile', ProfileController).destroyable();
```

For JSON APIs, use `apiSingleton()` (show + update only):

```typescript
Route.apiSingleton('profile', ProfileController);
```

Singletons can be nested inside resources:

```typescript
Route.resource('users').singleton('photos.thumbnail', ThumbnailController);
```

---

## Customising resource routes

### Naming routes

Override the default route names with `names()`:

```typescript
Route.resource('photos', PhotoController).names({
  index: 'images.list',
  create: 'images.new',
});
```

### Customising parameter names

Override the singularized parameter name with `parameters()`:

```typescript
Route.resource('users', UserController).parameters({
  users: 'admin_user',
});
// Creates /users/:admin_user instead of /users/:user
```

### Scoped bindings

When nesting, enforce that a child resource belongs to its parent:

```typescript
Route.resource('users.photos', PhotoController).scoped({
  photos: 'slug',
});
// Passes { photos: 'slug' } to the binding resolver
```

### Handling missing models

Provide a custom 404 response when model binding fails:

```typescript
Route.resource('posts', PostController).missing((_req) =>
  Promise.resolve(Response.notFound('Post not found')),
);
```

### Soft-deleted models

Include trashed records in binding lookups:

```typescript
Route.resource('posts', PostController).withTrashed();
// Only for specific actions:
Route.resource('posts', PostController).withTrashed(['show', 'update']);

// Convenience shorthand for multiple resources:
Route.softDeletableResources({
  posts: PostController,
  comments: CommentController,
});
```

---

## Resource verb localisation

Override the `create` and `edit` URL segments for non-English applications:

```typescript
import { Router } from '@faber-js/router';

// Spanish: /posts/crear  and  /posts/:post/editar
Router.resourceVerbs({ create: 'crear', edit: 'editar' });
```

Call this before your routes are registered (e.g., in a `RouteServiceProvider`).

---

## Controller middleware

### `@Middleware` decorator

Apply named middleware to a controller class. It will run for every method:

```typescript
import { Middleware } from '@faber-js/router';

@Middleware('auth')
@Injectable()
export class AdminController extends Controller {
  async index(_req: Request): Promise<Response> {
    // auth middleware always runs here
  }
}
```

Apply to specific methods only or exclude specific methods using `only`/`except`:

```typescript
@Middleware('verified', { only: ['create', 'store', 'update', 'destroy'] })
@Middleware('auth')
@Injectable()
export class PostController extends Controller { ... }
```

Apply directly to a single method:

```typescript
@Injectable()
export class CommentController extends Controller {
  @Middleware('throttle:60,1')
  async store(req: Request): Promise<Response> { ... }
}
```

### Middleware on resource builders

Attach middleware to every route in a resource:

```typescript
Route.resource('posts', PostController).middleware('auth');
```

Attach to specific actions only:

```typescript
Route.resource('posts', PostController).middlewareFor(['store', 'update', 'destroy'], 'auth');
```

Exclude middleware inherited from a group for specific actions:

```typescript
Route.group({ middleware: ['auth'] }, () => {
  Route.resource('posts', PostController).withoutMiddlewareFor(['index', 'show'], 'auth');
});
```

---

## `@Authorize` decorator

The `@Authorize` decorator performs a gate check before the method runs. It throws a `403 Forbidden` if the check fails. Requires the `gate` service to be bound in the container (provided by `@faber-js/auth`).

```typescript
import { Authorize } from '@faber-js/router';

@Injectable()
export class PostController extends Controller {
  // Ability only — no model
  @Authorize('create-post')
  async create(_req: Request): Promise<Response> { ... }

  // Pass a route parameter name — the value is passed to the policy
  @Authorize('update', 'post')
  async update(req: Request): Promise<Response> { ... }

  // Pass a constructor — the policy is looked up by class
  @Authorize('delete', Post)
  async destroy(req: Request): Promise<Response> { ... }

  // Tuple: model class + route param for policies that need both
  @Authorize('add-comment', [Post, 'post'])
  async store(req: Request): Promise<Response> { ... }
}
```

See [Authentication](/digging-deeper/auth) for how to define policies.

---

## Response helpers

`Controller` provides three helpers for the most common responses:

### `this.json(data, status?)`

Returns a JSON response. Status defaults to `200`.

```typescript
return this.json({ data: users }); // 200
return this.json({ data: user }, 201); // 201 Created
return this.json({ message: 'Gone' }, 410); // any 4xx/5xx
```

### `this.noContent()`

Returns an empty `204 No Content` response. Use for successful `DELETE` operations.

```typescript
return this.noContent();
```

### `this.redirect(url, status?)`

Returns a redirect response. Status defaults to `302`.

```typescript
return this.redirect('/login');
return this.redirect('/dashboard', 301);
```

### `Response` static methods

For cases the helpers don't cover, use `Response` directly:

```typescript
import { Response } from '@faber-js/http';

return Response.json({ error: 'custom' }, 422);
return Response.notFound('User not found');
return Response.error('Something went wrong', 500);
return Response.stream(asyncGenerator, 200);
```

See [Responses](/basics/responses) for all available static methods.
