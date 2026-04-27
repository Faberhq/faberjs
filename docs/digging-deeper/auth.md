# Authentication

FaberJS ships JWT-based authentication via `@faber-js/auth`. The guard issues and verifies tokens signed with HS256. Protecting routes is a single `middleware(['auth'])` call.

## Setup

### 1. Create a `UserProvider`

A `UserProvider` bridges the auth guard to your database. It has two methods: find a user by credentials (for login) and find a user by ID (for token verification).

```typescript
// app/providers/UserProvider.ts
import type { UserProviderContract } from '@faber-js/auth';
import type { AuthUser } from '@faber-js/http';
import { User } from '../models/User';
import * as bcrypt from 'bcrypt';

export class UserProvider implements UserProviderContract {
  async findByCredentials(credentials: Record<string, unknown>): Promise<AuthUser | null> {
    const email = credentials['email'] as string;
    const password = credentials['password'] as string;

    const user = await User.where<User>('email', email).first();
    if (!user) return null;

    const hash = user.getAttribute('password') as string;
    const valid = await bcrypt.compare(password, hash);
    if (!valid) return null;

    return {
      id: user.getAttribute('id') as number,
      email: user.getAttribute('email') as string,
    };
  }

  async findById(id: string | number): Promise<AuthUser | null> {
    const user = await User.find<User>(Number(id));
    if (!user) return null;
    return {
      id: user.getAttribute('id') as number,
      email: user.getAttribute('email') as string,
    };
  }
}
```

### 2. Register `AuthServiceProvider`

Create a concrete service provider that extends `AuthServiceProvider`:

```typescript
// app/providers/AppAuthServiceProvider.ts
import { AuthServiceProvider } from '@faber-js/auth';
import type { AuthConfig, UserProviderContract } from '@faber-js/auth';
import { env } from '@faber-js/config';
import { UserProvider } from './UserProvider';

export class AppAuthServiceProvider extends AuthServiceProvider {
  protected authConfig(): AuthConfig {
    return {
      secret: env('JWT_SECRET', 'change-me'),
      expiresIn: env('JWT_EXPIRES_IN', '7d'),
      algorithm: 'HS256',
    };
  }

  protected userProvider(): UserProviderContract {
    return new UserProvider();
  }
}
```

Register it in `bootstrap/app.ts`:

```typescript
import { AppAuthServiceProvider } from '../app/providers/AppAuthServiceProvider';

app.register(new AppAuthServiceProvider(app));
```

### 3. Register the `AuthMiddleware`

```typescript
import { AuthMiddleware } from '@faber-js/auth';

kernel.register('auth', new AuthMiddleware());
```

## Logging in

The `Auth` facade's `attempt()` method validates credentials and returns a signed JWT, or `null` if the credentials are invalid.

```typescript
// app/controllers/AuthController.ts
import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import { Auth } from '@faber-js/auth';
import type { Request } from '@faber-js/http';
import { Response, UnauthorizedException } from '@faber-js/http';

@Injectable()
export class AuthController extends Controller {
  async login(req: Request): Promise<Response> {
    const token = await Auth.attempt({
      email: req.input('email'),
      password: req.input('password'),
    });

    if (!token) throw new UnauthorizedException('Invalid credentials.');

    return this.json({ token });
  }

  async me(req: Request): Promise<Response> {
    return this.json({ data: req.user });
  }
}
```

```typescript
// routes/api.ts
Route.post('/auth/login', [AuthController, 'login']);
Route.get('/auth/me', [AuthController, 'me']).middleware(['auth']);
```

## Protecting routes

Apply the `auth` middleware to any route or group:

```typescript
// Single route
Route.get('/profile', [ProfileController, 'show']).middleware(['auth']);

// Group of routes
Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.get('/users', [UserController, 'index']);
  Route.post('/users', [UserController, 'store']);
  Route.resource('posts', PostController);
});
```

The `AuthMiddleware` reads the `Authorization: Bearer <token>` header, verifies the JWT, and attaches the user to `req.user`. If the token is missing or invalid, it throws a `401 UnauthorizedException`.

## Accessing the authenticated user

```typescript
async profile(req: Request): Promise<Response> {
  const user = req.user;  // AuthUser | null

  if (!user) throw new UnauthorizedException();

  return this.json({
    id: user.id,
    email: user.email,
  });
}
```

## The `Auth` facade

```typescript
import { Auth } from '@faber-js/auth';

// Validate credentials and return a token
const token = await Auth.attempt({ email, password }); // string | null

// Get the user from a token
const user = await Auth.user(token); // AuthUser | null

// Check if a token is valid
const valid = await Auth.check(token); // boolean

// Get the user ID from a token
const id = await Auth.id(token); // string | number | null
```

## Authorization — Policies

Policies answer "can this user do this action to this model?". Create a policy:

```bash
# Create manually in app/policies/
```

```typescript
// app/policies/PostPolicy.ts
import { Policy } from '@faber-js/auth';
import type { AuthUser } from '@faber-js/http';
import { Post } from '../models/Post';

export class PostPolicy extends Policy {
  async update(user: AuthUser, post: Post): Promise<boolean> {
    return post.getAttribute('user_id') === user.id;
  }

  async delete(user: AuthUser, post: Post): Promise<boolean> {
    return post.getAttribute('user_id') === user.id;
  }

  // Optional: runs before all other checks
  override before(user: AuthUser, _ability: string): boolean | undefined {
    // Admins can do everything
    if ((user as { role?: string }).role === 'admin') return true;
    return undefined; // undefined means "continue to the specific check"
  }
}
```

### Registering a policy

In your `AuthServiceProvider` or a boot hook:

```typescript
import { Gate } from '@faber-js/auth';
import { Post } from '../models/Post';
import { PostPolicy } from '../policies/PostPolicy';

// In a service provider's boot():
const gate = Application.getInstance().make<Gate>('gate');
gate.registerPolicy(Post, PostPolicy);
```

### Enforcing a policy

Use `this.authorize()` in a controller:

```typescript
async update(req: Request): Promise<Response> {
  const post = await Post.findOrFail<Post>(Number(req.route('id')));
  await this.authorize(req.user, 'update', post);
  // Throws 403 if the policy returns false

  await post.update(req.only('title', 'body'));
  return this.json({ data: post });
}
```

## Token configuration

| `AuthConfig` field | Description                                                 | Example                  |
| ------------------ | ----------------------------------------------------------- | ------------------------ |
| `secret`           | HMAC signing secret — must be long and random in production | `env('JWT_SECRET')`      |
| `expiresIn`        | Token TTL in vercel/ms format                               | `'7d'`, `'24h'`, `'15m'` |
| `algorithm`        | Signing algorithm                                           | `'HS256'` (default)      |
