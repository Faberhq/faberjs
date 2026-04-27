# Services

Services contain your business logic. Controllers call services; services orchestrate models, jobs, and events. This strict separation keeps controllers thin and business logic testable.

## Generating a service

```bash
npx faber make:service UserService
```

Generated file (`app/services/UserService.ts`):

```typescript
import { Injectable, Service } from '@faber-js/core';

@Injectable()
export class UserService extends Service {
  // Add your business logic here
}
```

## Writing a service

```typescript
import { Injectable, Service } from '@faber-js/core';
import { User } from '../models/User';

@Injectable()
export class UserService extends Service {
  async all(): Promise<User[]> {
    return User.all<User>();
  }

  async find(id: number): Promise<User | null> {
    return User.find<User>(id);
  }

  async create(attrs: Record<string, unknown>): Promise<User> {
    return User.create<User>(attrs as Record<string, string | number | boolean | null>);
  }

  async update(id: number, attrs: Record<string, unknown>): Promise<User | null> {
    const user = await User.findOrFail<User>(id);
    return user.update(attrs as Record<string, string | number | boolean | null>);
  }

  async delete(id: number): Promise<void> {
    const user = await User.findOrFail<User>(id);
    await user.delete();
  }
}
```

## Dependency injection

Services are resolved from the IoC container. Declare constructor dependencies and they are injected automatically. The `@Injectable()` decorator enables this.

```typescript
import { Injectable, Service } from '@faber-js/core';
import { dispatch } from '@faber-js/queue';
import { event } from '@faber-js/events';
import { User } from '../models/User';
import { PasswordHasher } from './PasswordHasher';
import { SendWelcomeEmailJob } from '../jobs/SendWelcomeEmailJob';

@Injectable()
export class UserService extends Service {
  constructor(private readonly hasher: PasswordHasher) {
    super();
  }

  async register(attrs: { name: string; email: string; password: string }): Promise<User> {
    const user = await User.create<User>({
      name: attrs.name,
      email: attrs.email,
      password: await this.hasher.hash(attrs.password),
    });

    await dispatch(new SendWelcomeEmailJob(user));
    await event({ type: 'UserRegistered', userId: user.getAttribute('id') });

    return user;
  }
}
```

## Injecting services into controllers

A controller declares its service dependencies in the constructor. The container resolves the full dependency graph automatically — you never `new` a service yourself.

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

  async store(req: Request): Promise<Response> {
    const user = await this.userService.register({
      name: req.input('name') as string,
      email: req.input('email') as string,
      password: req.input('password') as string,
    });
    return this.json({ data: user }, 201);
  }
}
```

## Injecting services into services

Services can depend on other services. The container handles the entire tree:

```typescript
@Injectable()
export class PostService extends Service {
  constructor(
    private readonly userService: UserService,
    private readonly tagService: TagService,
  ) {
    super();
  }

  async publish(postId: number, userId: number): Promise<void> {
    const user = await this.userService.find(userId);
    if (!user) throw new Error('User not found');
    // ...
  }
}
```

## The `Service` base class

`Service` is a thin base class from `@faber-js/core`. It exists to mark injectable base-level classes and provides a single place to add framework-level service utilities in the future. You always extend it for convention, but it requires no implementation.

```typescript
import { Service } from '@faber-js/core';

export abstract class Service {}
```

## When to create a service

Create a service when:

- The logic involves more than one model
- The operation dispatches jobs or events
- The logic is shared between multiple controllers
- You need to test the logic in isolation

Keep controllers to a single service call per action. If a controller method calls three services, consider whether one service should orchestrate the others.
