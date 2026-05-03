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

The second argument is a tuple of `[ControllerClass, 'methodName']`. The controller is resolved from the IoC container, so its dependencies are injected automatically.

## Route parameters

Parameters are defined with a colon prefix. Read them in the controller via `req.route('param')`:

```typescript
Route.get('/posts/:postId/comments/:id', [CommentController, 'show']);
```

```typescript
// app/controllers/CommentController.ts
async show(req: Request): Promise<Response> {
  const postId = req.route('postId');
  const id = req.route('id');
  return this.json({ postId, id });
}
```

## HTTP methods

| Method           | Usage                       |
| ---------------- | --------------------------- |
| `Route.get()`    | Retrieve a resource         |
| `Route.post()`   | Create a resource           |
| `Route.put()`    | Replace a resource          |
| `Route.patch()`  | Partially update a resource |
| `Route.delete()` | Delete a resource           |

## Route groups

Groups let you apply a shared prefix or middleware set to multiple routes.

```typescript
Route.group({ prefix: '/api/v1' }, () => {
  Route.get('/users', [UserController, 'index']);
  Route.post('/users', [UserController, 'store']);
});
// Registers: GET /api/v1/users, POST /api/v1/users
```

### Middleware on a group

```typescript
Route.group({ prefix: '/admin', middleware: ['auth'] }, () => {
  Route.get('/dashboard', [DashboardController, 'index']);
  Route.resource('posts', PostController);
});
```

### Nested groups

Groups can nest. Prefixes and middleware arrays are merged:

```typescript
Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.group({ prefix: '/v2', middleware: ['throttle'] }, () => {
    Route.get('/users', [UserController, 'index']);
    // Route: GET /api/v2/users with middleware: ['auth', 'throttle']
  });
});
```

## Resource routes

`Route.resource()` registers the five conventional REST routes for a controller at once. Like Laravel's `Route::resource()`:

```typescript
Route.resource('posts', PostController);
```

This registers:

| Method | Path         | Controller method |
| ------ | ------------ | ----------------- |
| GET    | `/posts`     | `index`           |
| POST   | `/posts`     | `store`           |
| GET    | `/posts/:id` | `show`            |
| PUT    | `/posts/:id` | `update`          |
| DELETE | `/posts/:id` | `destroy`         |

Your controller should define all five methods:

```typescript
@Injectable()
export class PostController extends Controller {
  async index(_req: Request): Promise<Response> { ... }
  async store(req: Request): Promise<Response> { ... }
  async show(req: Request): Promise<Response> { ... }
  async update(req: Request): Promise<Response> { ... }
  async destroy(req: Request): Promise<Response> { ... }
}
```

## Named routes

Chain `.name()` on any route to give it a name. Named routes can be inspected with `npx faber route:list`.

```typescript
Route.get('/users', [UserController, 'index']).name('users.index');
Route.post('/users', [UserController, 'store']).name('users.store');
```

## Route middleware

Apply middleware to a single route by chaining `.middleware()`:

```typescript
Route.get('/profile', [ProfileController, 'show']).middleware(['auth']);

// Multiple middleware
Route.get('/dashboard', [DashboardController, 'index']).middleware(['auth', 'throttle']);

// With parameters (name:param syntax)
Route.put('/post/:id', [PostController, 'update']).middleware(['role:editor']);
```

Exclude specific middleware that was inherited from a group:

```typescript
Route.group({ middleware: ['auth', 'throttle'] }, () => {
  Route.get('/', [HomeController, 'index']);
  Route.get('/status', [StatusController, 'index']).withoutMiddleware(['throttle']);
});
```

Middleware strings refer to keys registered in your `HttpKernel`. See [Middleware](/basics/middleware) for full registration and configuration details.

## Listing routes

Use the CLI to see all registered routes:

```bash
npx faber route:list
```

Output:

```
Method  Path              Controller           Action
GET     /users            UserController       index
POST    /users            UserController       store
GET     /users/:id        UserController       show
PUT     /users/:id        UserController       update
DELETE  /users/:id        UserController       destroy
```
