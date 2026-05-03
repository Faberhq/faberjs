# CLI Commands

The `faber` CLI is the Artisan equivalent for FaberJS. It handles code generation, database management, the dev server, route inspection, and an interactive REPL.

Like Artisan, every `faber` command has a description you can see with `--help`:

```bash
npx faber --help
npx faber make --help
npx faber db --help
```

---

## Development server

### `npx faber serve`

Start the development server with hot reload. Watches for file changes using `tsx --watch`.

```bash
npx faber serve
npx faber serve --port 8080
```

**Options:**

| Flag                | Default | Description       |
| ------------------- | ------- | ----------------- |
| `-p, --port <port>` | `3000`  | Port to listen on |

The server reads your `bootstrap/app.ts` file and re-starts automatically on changes. The entry point is `bootstrap/app.ts`.

---

## Database commands

### `npx faber db:migrate`

Run all pending migrations in chronological order. Each migration batch is tracked so rollback knows which files to reverse.

```bash
npx faber db:migrate
```

Output:

```
Migrating: 2024_01_01_000000_create_users_table
Migrated:  2024_01_01_000000_create_users_table (23ms)
Migrating: 2024_01_02_120000_create_posts_table
Migrated:  2024_01_02_120000_create_posts_table (11ms)
```

### `npx faber db:rollback`

Roll back the last batch of migrations by running each `down()` method.

```bash
npx faber db:rollback
```

### `npx faber db:status`

Show which migrations have run and which are pending.

```bash
npx faber db:status
```

Output:

```
Ran                                                   Batch
✓ 2024_01_01_000000_create_users_table               1
✓ 2024_01_02_120000_create_posts_table               1
✗ 2024_01_03_090000_add_bio_to_users_table           -
```

### `npx faber db:seed`

Run all database seeders found in `database/seeders/`.

```bash
npx faber db:seed
```

### `npx faber db:fresh`

Drop **all** tables in the database, then re-run every migration from scratch. Useful for resetting local state without worrying about `down()` methods.

```bash
npx faber db:fresh
```

> **Warning:** This destroys all data. Never run in production.

### `npx faber db:refresh`

Roll back every migration in reverse order (calling each `down()` method), then re-run them all. Unlike `db:fresh`, this exercises your `down()` implementations.

```bash
npx faber db:refresh
```

---

## Code generators

All generators follow the same pattern: they create a new file in the appropriate directory with a stub. File paths are printed to the console on creation.

### `npx faber make:controller <Name>`

Creates a controller in `app/controllers/`. Without flags, generates a plain controller. Use flags to tailor the output:

```bash
npx faber make:controller User
# CREATED app/controllers/UserController.ts

# Full resource (7 methods: index, create, store, show, edit, update, destroy)
npx faber make:controller Post --resource

# API resource (5 methods: no create/edit)
npx faber make:controller Post --api

# Single-action invokable controller (__invoke method)
npx faber make:controller Archive --invokable

# With model name for route param stubs
npx faber make:controller Post --resource --model=Post

# Also generate StorePostRequest and UpdatePostRequest
npx faber make:controller Post --resource --model=Post --requests
```

**Options:**

| Flag                  | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `-i, --invokable`     | Generate a single-action controller with `__invoke()`                |
| `-r, --resource`      | Generate a full resource controller (all 7 CRUD methods)             |
| `-a, --api`           | Generate an API resource controller (5 methods, no create/edit)      |
| `-m, --model <Model>` | Set the model name used for route param names in the stub            |
| `-R, --requests`      | Also generate `Store{Model}Request` and `Update{Model}Request` files |

### `npx faber make:model <Name>`

Creates `app/models/<Name>.ts` with `table` and `fillable` stubs.

```bash
npx faber make:model Post
# CREATED app/models/Post.ts
```

**Options:**

| Flag              | Description                            |
| ----------------- | -------------------------------------- |
| `-m, --migration` | Also create a migration for this model |

```bash
npx faber make:model Post -m
# CREATED app/models/Post.ts
# CREATED database/migrations/2024_01_15_120000_create_posts_table.ts
```

### `npx faber make:service <Name>`

Creates `app/services/<Name>Service.ts` with `@Injectable()` and `extends Service`.

```bash
npx faber make:service User
# CREATED app/services/UserService.ts
```

### `npx faber make:migration <Name>`

Creates a timestamped migration file in `database/migrations/`.

```bash
npx faber make:migration create_comments_table
# CREATED database/migrations/2024_01_15_130000_create_comments_table.ts

npx faber make:migration add_avatar_to_users_table
# CREATED database/migrations/2024_01_15_130001_add_avatar_to_users_table.ts
```

### `npx faber make:job <Name>`

Creates `app/jobs/<Name>Job.ts` with `queue`, `tries`, and a `handle()` stub.

```bash
npx faber make:job SendWelcomeEmail
# CREATED app/jobs/SendWelcomeEmailJob.ts
```

### `npx faber make:event <Name>`

Creates `app/events/<Name>Event.ts` as an interface with a `type` field.

```bash
npx faber make:event UserRegistered
# CREATED app/events/UserRegisteredEvent.ts
```

### `npx faber make:listener <Name>`

Creates `app/listeners/<Name>Listener.ts` with a `handle(event)` stub.

```bash
npx faber make:listener SendWelcomeEmail
# CREATED app/listeners/SendWelcomeEmailListener.ts
```

### `npx faber make:middleware <Name>`

Creates `app/middleware/<Name>Middleware.ts` implementing the `Middleware` interface.

```bash
npx faber make:middleware Throttle
# CREATED app/middleware/ThrottleMiddleware.ts
```

### `npx faber make:provider <Name>`

Creates `app/providers/<Name>ServiceProvider.ts` with `register()` and `boot()` stubs.

```bash
npx faber make:provider Payment
# CREATED app/providers/PaymentServiceProvider.ts
```

### `npx faber make:command <Name>`

Creates `app/commands/<Name>Command.ts` with a `signature`, `description`, and `handle()` method.

```bash
npx faber make:command SendDailyReport
# CREATED app/commands/SendDailyReportCommand.ts
```

The generated stub:

```typescript
import { Command } from '@faber-js/console';

export class SendDailyReportCommand extends Command {
  readonly signature = 'send-daily-report';
  readonly description = 'SendDailyReport command description';

  async handle(): Promise<void> {
    this.info('Running send-daily-report...');
  }
}
```

### `npx faber make:agent <Name>`

Creates `app/agents/<Name>Agent.ts` with a `model`, `systemPrompt`, and an example `@Tool` method.

```bash
npx faber make:agent Support
# CREATED app/agents/SupportAgent.ts
```

### `npx faber make:channel <Name>`

Creates `app/channels/<Name>Channel.ts` with a `handle(socket)` stub. Register the channel in `routes/channels.ts`.

```bash
npx faber make:channel Room
# CREATED app/channels/RoomChannel.ts
```

The generated stub:

```typescript
import { Injectable } from '@faber-js/core';
import { Channel, Socket } from '@faber-js/channels';

@Injectable()
export class RoomChannel extends Channel {
  async handle(socket: Socket): Promise<void> {
    socket.on('disconnect', () => {
      // cleanup
    });
  }
}
```

See [Real-Time Channels](/digging-deeper/channels) for full usage.

### `npx faber make:view <Name>`

Creates a `.view.tsx` file in `resources/views/` with the `@jsxImportSource` pragma and a typed `Props` interface. Supports nested paths.

```bash
npx faber make:view Dashboard
# CREATED resources/views/Dashboard.view.tsx

npx faber make:view users/index
# CREATED resources/views/users/Index.view.tsx
```

### `npx faber make:schema <Name>`

Creates a schema-first model declaration in `schema/<Name>.ts` using `@faber-js/schema`. Schemas describe your model's fields and types in one place; the ORM, validation, and migration layers can all derive from them.

```bash
npx faber make:schema Post
# CREATED schema/Post.ts
```

The generated stub:

```typescript
import { schema, t } from '@faber-js/schema';

export const Post = schema('posts', {
  id: t.id(),
  // Add your fields here:
  // name:   t.string().min(2).max(255),
  // email:  t.email().unique(),
  // bio:    t.text().nullable(),
  // role:   t.enum(['admin', 'editor', 'viewer'] as const).default('viewer'),
  createdAt: t.timestamp().auto(),
  updatedAt: t.timestamp().auto(),
});
```

See [Schema-First Models](/digging-deeper/schema) for full usage.

### `npx faber make:mail <Name>`

Creates `app/mail/<Name>Mail.ts` extending `Mailable`. Fill in the `build()` method to set recipients, subject, and body.

```bash
npx faber make:mail WelcomeEmail
# CREATED app/mail/WelcomeEmailMail.ts
```

The generated stub:

```typescript
import { Mailable } from '@faber-js/mail';

export class WelcomeEmailMail extends Mailable {
  constructor(private readonly recipient: string) {
    super();
  }

  build(): void {
    this.to(this.recipient).subject('WelcomeEmail').html('<p>Hello from FaberJS!</p>');
  }
}
```

See [Mail](/digging-deeper/mail) for full usage.

### `npx faber make:policy <Name>`

Creates `app/policies/<Name>Policy.ts` with `view`, `create`, `update`, and `delete` authorization methods.

```bash
npx faber make:policy Post
# CREATED app/policies/PostPolicy.ts
```

The generated stub:

```typescript
import type { AuthUser } from '@faber-js/http';
import { Policy } from '@faber-js/auth';

export class PostPolicy extends Policy {
  async view(_user: AuthUser, _model: unknown): Promise<boolean> {
    return true;
  }

  async create(_user: AuthUser): Promise<boolean> {
    return true;
  }

  async update(_user: AuthUser, _model: unknown): Promise<boolean> {
    return true;
  }

  async delete(_user: AuthUser, _model: unknown): Promise<boolean> {
    return true;
  }
}
```

See [Authentication & Authorization](/digging-deeper/auth) for full usage.

---

## Key generation

### `npx faber key:generate`

Generate a cryptographically secure `APP_KEY` and write it to your `.env` file. Run this once after creating a new project.

```bash
npx faber key:generate
# Application key set: base64:xQ3r...
```

**Options:**

| Flag     | Description                                    |
| -------- | ---------------------------------------------- |
| `--show` | Print the key to stdout without writing `.env` |

```bash
# Print without writing
npx faber key:generate --show
# base64:xQ3rL8mNpT...
```

---

## Frontend Bridge

### `npx faber bridge:types`

Scan `resources/pages/` for page components and generate a `BridgePages` type map. The output file is `resources/types/bridge.generated.ts` by default.

```bash
npx faber bridge:types
```

Output:

```
CREATED     resources/types/bridge.generated.ts
INFO        Generated 6 page type(s)
```

The generated file maps each component name (relative to `resources/pages/`) to `Record<string, unknown>`. Edit the generated file or create a `bridge.ts` alongside it to override prop types with your own interfaces.

**Options:**

| Flag            | Default                               | Description                           |
| --------------- | ------------------------------------- | ------------------------------------- |
| `--pages <dir>` | `resources/pages`                     | Directory to scan for page components |
| `--out <file>`  | `resources/types/bridge.generated.ts` | Output file path                      |

```bash
# Custom paths
npx faber bridge:types --pages src/views --out src/types/pages.ts
```

---

## Route inspection

### `npx faber route:list`

List all registered routes. Reads your application's route files and prints a table.

```bash
npx faber route:list
```

Output:

```
Method   Path                          Controller            Action
GET      /users                        UserController        index
POST     /users                        UserController        store
GET      /users/:id                    UserController        show
PUT      /users/:id                    UserController        update
DELETE   /users/:id                    UserController        destroy
GET      /admin/posts                  PostController        index
POST     /admin/posts                  PostController        store
```

### `npx faber route:cache`

Serialize all registered routes to `bootstrap/cache/routes.json`. In production, FaberJS reads this file instead of re-evaluating your route definitions on every cold start.

```bash
npx faber route:cache
# CREATED bootstrap/cache/routes.json
```

### `npx faber route:clear`

Remove the cached routes file so FaberJS falls back to evaluating your route files at runtime.

```bash
npx faber route:clear
# REMOVED bootstrap/cache/routes.json
```

---

## Interactive REPL

### `npx faber tinker`

Start an interactive Node.js REPL with your application already bootstrapped. Like Laravel's `php artisan tinker`, this gives you a live console to test queries, dispatch jobs, and inspect your data.

```bash
npx faber tinker
```

```
FaberJS Tinker — application ready
> await User.all()
> await User.create({ name: 'Alice', email: 'alice@example.com' })
> await dispatch(new SendWelcomeEmailJob(1))
```

---

## Command quick reference

| Command                                                         | Description                                   |
| --------------------------------------------------------------- | --------------------------------------------- |
| `npx faber serve`                                               | Start the dev server (hot reload)             |
| `npx faber db:migrate`                                          | Run pending migrations                        |
| `npx faber db:rollback`                                         | Roll back the last migration batch            |
| `npx faber db:fresh`                                            | Drop all tables and re-run all migrations     |
| `npx faber db:refresh`                                          | Rollback all + re-run all migrations          |
| `npx faber db:status`                                           | Show migration status                         |
| `npx faber db:seed`                                             | Run database seeders                          |
| `npx faber make:controller <Name> [-i\|-r\|-a] [-m Model] [-R]` | Generate a controller                         |
| `npx faber make:model <Name> [-m]`                              | Generate a model (and optionally a migration) |
| `npx faber make:service <Name>`                                 | Generate a service                            |
| `npx faber make:migration <Name>`                               | Generate a migration                          |
| `npx faber make:job <Name>`                                     | Generate a job                                |
| `npx faber make:event <Name>`                                   | Generate an event interface                   |
| `npx faber make:listener <Name>`                                | Generate a listener                           |
| `npx faber make:middleware <Name>`                              | Generate middleware                           |
| `npx faber make:provider <Name>`                                | Generate a service provider                   |
| `npx faber make:command <Name>`                                 | Generate a custom CLI command                 |
| `npx faber make:agent <Name>`                                   | Generate an AI agent                          |
| `npx faber make:view <Name>`                                    | Generate a JSX server-side view               |
| `npx faber make:schema <Name>`                                  | Generate a schema-first model declaration     |
| `npx faber make:mail <Name>`                                    | Generate a Mailable class                     |
| `npx faber make:policy <Name>`                                  | Generate an authorization policy              |
| `npx faber key:generate [--show]`                               | Generate and write APP_KEY to .env            |
| `npx faber bridge:types`                                        | Generate BridgePages type map from pages dir  |
| `npx faber route:list`                                          | List all registered routes                    |
| `npx faber route:cache`                                         | Cache routes to bootstrap/cache/routes.json   |
| `npx faber route:clear`                                         | Remove the cached routes file                 |
| `npx faber tinker`                                              | Start an interactive REPL                     |
