# Routing

Routes are defined in `routes/api.ts` using the `Route` facade from `@faber-js/router`. Like Laravel's `routes/api.php`, this file is loaded during the boot sequence.

## Basic routes

```typescript
import { Route } from '@faber-js/router';
import { UserController } from '../app/controllers/UserController';

Route.get('/users', [UserController, 'index']);
Route.post('/users', [UserController, 'store']);
Route.get('/users/:id', [UserController, 'show']);
Route.put('/users/:id', [UserController, 'update']);
Route.patch('/users/:id', [UserController, 'update']);
Route.delete('/users/:id', [UserController, 'destroy']);
```

The second argument is a tuple of `[ControllerClass, 'methodName']`. The controller is resolved from the IoC container automatically.

## Route parameters

Parameters are defined with a colon prefix. Read them in the controller via `req.route('param')`:

```typescript
Route.get('/posts/:postId/comments/:id', [CommentController, 'show']);
```

```typescript
async show(req: Request): Promise<Response> {
  const postId = req.route('postId');
  const id = req.route('id');
  return this.json({ postId, id });
}
```

## HTTP methods

| Method            | Usage                       |
| ----------------- | --------------------------- |
| `Route.get()`     | Retrieve a resource         |
| `Route.post()`    | Create a resource           |
| `Route.put()`     | Replace a resource          |
| `Route.patch()`   | Partially update a resource |
| `Route.delete()`  | Delete a resource           |
| `Route.options()` | Handle OPTIONS requests     |
| `Route.match()`   | Multiple methods at once    |
| `Route.any()`     | All HTTP methods            |

### `match()` and `any()`

```typescript
// Respond to GET and POST with the same handler
Route.match(['GET', 'POST'], '/login', [AuthController, 'login']);

// Respond to all HTTP methods
Route.any('/webhook', [WebhookController, 'handle']);
```

## Route groups

Groups let you apply a shared prefix, middleware, name prefix, or controller to multiple routes.

```typescript
Route.group({ prefix: '/api/v1' }, () => {
  Route.get('/users', [UserController, 'index']);
  Route.post('/users', [UserController, 'store']);
});
// Registers: GET /api/v1/users, POST /api/v1/users
```

### Group options

| Option       | Type        | Description                                      |
| ------------ | ----------- | ------------------------------------------------ |
| `prefix`     | string      | Path prefix for all routes in the group          |
| `middleware` | string[]    | Middleware applied to every route in the group   |
| `name`       | string      | Name prefix applied to all named routes          |
| `domain`     | string      | Domain constraint (supports `{param}`)           |
| `controller` | Constructor | Default controller (lets you use method strings) |

### Group with controller

When you set a `controller` on a group, you can pass method names as strings instead of tuples:

```typescript
Route.group({ prefix: '/admin', controller: AdminController }, () => {
  Route.get('/dashboard', 'dashboard');
  Route.get('/users', 'users');
});
```

### Nested groups

Groups can nest. Prefixes and middleware arrays are merged:

```typescript
Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.group({ prefix: '/v2', middleware: ['throttle'] }, () => {
    Route.get('/users', [UserController, 'index']);
    // Path: /api/v2/users — middleware: ['auth', 'throttle']
  });
});
```

### Group name prefixes

```typescript
Route.group({ name: 'admin.' }, () => {
  Route.get('/dashboard', [AdminController, 'dashboard']).name('dashboard');
  // Full name: admin.dashboard
});
```

---

## Resource routes

`Route.resource()` registers all seven conventional REST routes at once:

```typescript
Route.resource('posts', PostController);
```

| Verb   | Path                | Controller method | Route name      |
| ------ | ------------------- | ----------------- | --------------- |
| GET    | `/posts`            | `index`           | `posts.index`   |
| GET    | `/posts/create`     | `create`          | `posts.create`  |
| POST   | `/posts`            | `store`           | `posts.store`   |
| GET    | `/posts/:post`      | `show`            | `posts.show`    |
| GET    | `/posts/:post/edit` | `edit`            | `posts.edit`    |
| PUT    | `/posts/:post`      | `update`          | `posts.update`  |
| DELETE | `/posts/:post`      | `destroy`         | `posts.destroy` |

The route parameter name is the **singularized** resource name (`:post` for `posts`, `:photo` for `photos`).

### Partial resource routes

```typescript
// Only the routes listed
Route.resource('photos', PhotoController).only(['index', 'show', 'store']);

// All routes except the ones listed
Route.resource('photos', PhotoController).except(['create', 'edit']);
```

### Multiple resources at once

```typescript
Route.resources({
  photos: PhotoController,
  posts: PostController,
  videos: VideoController,
});
```

### API resources

For JSON APIs (no HTML form views), `apiResource()` registers five routes — no `create` or `edit`:

```typescript
Route.apiResource('posts', PostController);

// Multiple at once
Route.apiResources({
  posts: PostController,
  comments: CommentController,
});
```

### Soft-deletable resources

Automatically include trashed models in binding lookups:

```typescript
Route.softDeletableResources({
  posts: PostController,
});
// Equivalent to Route.resource('posts', PostController).withTrashed()
```

---

## Nested resources

Dot notation nests one resource inside another:

```typescript
Route.resource('photos.comments', CommentController);
```

This registers paths like `/photos/:photo/comments` and `/photos/:photo/comments/:comment`.

### Shallow nesting

`.shallow()` keeps collection routes nested but promotes member routes (`show`, `edit`, `update`, `destroy`) to the top level:

```typescript
Route.resource('photos.comments', CommentController).shallow();
// GET /photos/:photo/comments   — index (stays nested)
// GET /comments/:comment        — show (un-nested)
// DELETE /comments/:comment     — destroy (un-nested)
```

---

## Singleton resources

A singleton resource represents a single object owned by the current context — like a user's profile. No ID parameter is used:

```typescript
Route.singleton('profile', ProfileController);
// GET /profile        → show
// GET /profile/edit   → edit
// PUT /profile        → update
```

Add creation/deletion support:

```typescript
Route.singleton('profile', ProfileController).creatable();
// Also registers: GET /profile/create, POST /profile, DELETE /profile
```

For JSON APIs (show + update only):

```typescript
Route.apiSingleton('profile', ProfileController);
```

Nested singletons:

```typescript
Route.resource('users', UserController);
Route.singleton('users.profile', ProfileController);
// GET /users/:user/profile
```

---

## Customising resource routes

### Naming routes

```typescript
Route.resource('photos', PhotoController).names({
  index: 'images.list',
  create: 'images.new',
});
```

### Customising parameter names

```typescript
Route.resource('users', UserController).parameters({
  users: 'admin_user',
});
// Creates /users/:admin_user instead of /users/:user
```

### Resource verb localisation

Override the `create` and `edit` URL segments globally:

```typescript
import { Router } from '@faber-js/router';

Router.resourceVerbs({ create: 'crear', edit: 'editar' });
// Routes become: /posts/crear  and  /posts/:post/editar
```

Call this once before your routes are registered (e.g., in a `RouteServiceProvider`).

### Missing model handler

Provide a custom 404 response when model binding fails:

```typescript
Route.resource('posts', PostController).missing((_req) =>
  Promise.resolve(Response.notFound('Post not found')),
);
```

---

## Redirect routes

```typescript
Route.redirect('/old', '/new'); // 302
Route.permanentRedirect('/legacy', '/current'); // 301
Route.redirect('/here', '/there', 307); // custom status
```

---

## Fallback route

Handle any request that matched no other route:

```typescript
Route.fallback((_req) => Promise.resolve(Response.notFound({ message: 'Route not found' })));
```

---

## Named routes

Chain `.name()` on any route. Named routes can be resolved to URLs with the `route()` helper and inspected with `npx faber route:list`:

```typescript
Route.get('/users', [UserController, 'index']).name('users.index');
Route.post('/users', [UserController, 'store']).name('users.store');
```

Resource routes are auto-named as `{resource}.{action}` (e.g., `posts.index`, `posts.show`).

---

## Route middleware

Apply middleware to a single route by chaining `.middleware()`:

```typescript
Route.get('/profile', [ProfileController, 'show']).middleware(['auth']);
Route.get('/dashboard', [DashboardController, 'index']).middleware(['auth', 'throttle']);

// With parameters (name:param syntax)
Route.put('/post/:id', [PostController, 'update']).middleware(['role:editor']);
```

Exclude specific middleware inherited from a group:

```typescript
Route.group({ middleware: ['auth', 'throttle'] }, () => {
  Route.get('/', [HomeController, 'index']);
  Route.get('/status', [StatusController, 'index']).withoutMiddleware(['throttle']);
});
```

Middleware strings refer to keys registered in your `HttpKernel`. See [Middleware](/basics/middleware) for full registration and configuration.

---

## Route constraints

Constrain route parameters to a regex pattern:

```typescript
Route.get('/users/{id}', [UserController, 'show']).where('id', '[0-9]+');

// Convenience helpers
route.whereNumber('id'); // [0-9]+
route.whereAlpha('name'); // [a-zA-Z]+
route.whereAlphaNumeric('slug'); // [a-zA-Z0-9]+
route.whereIn('type', ['video', 'audio']); // video|audio
```

Register global constraints applied to all routes with a matching param name:

```typescript
Route.pattern('id', '[0-9]+');
```

---

## Listing routes

Use the CLI to see all registered routes:

```bash
npx faber route:list
```

Output:

```
Method  Path                   Controller           Action
GET     /posts                 PostController       index
GET     /posts/create          PostController       create
POST    /posts                 PostController       store
GET     /posts/:post           PostController       show
GET     /posts/:post/edit      PostController       edit
PUT     /posts/:post           PostController       update
DELETE  /posts/:post           PostController       destroy
```
