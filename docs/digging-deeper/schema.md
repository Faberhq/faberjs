# Schema-first Models

`@faber-js/schema` lets you declare a model's shape once and derive everything else from it — TypeScript types, ORM model class, migration schema, validation rules, OpenAPI spec, and a test factory. No repetition, no drift.

## Prerequisites

```bash
pnpm add @faber-js/schema
```

No service provider registration is required.

## Defining a schema

```typescript
import { schema, t } from '@faber-js/schema';

export const User = schema('users', {
  id:        t.id(),
  name:      t.string().min(2).max(100),
  email:     t.email().unique(),
  password:  t.string().hidden(),
  role:      t.enum(['admin', 'editor', 'viewer'] as const).default('viewer'),
  bio:       t.text().nullable(),
  createdAt: t.timestamp().auto(),
  updatedAt: t.timestamp().auto(),
});
```

`schema(table, shape)` returns a fully-typed class. The TypeScript type of each row is inferred from the shape — no separate interface needed:

```typescript
import type { InferSchemaType } from '@faber-js/schema';

type UserRow = InferSchemaType<typeof UserSchema>;
// { id: number; name: string; email: string; password: string; role: 'admin'|'editor'|'viewer'; bio: string|null; createdAt: Date; updatedAt: Date }
```

## Field types

| Builder | TypeScript type | Notes |
|---|---|---|
| `t.id()` | `number` | Auto-increment primary key |
| `t.string(length?)` | `string` | VARCHAR, optional max length |
| `t.text()` | `string` | TEXT column |
| `t.email()` | `string` | Adds email validation rule |
| `t.integer()` | `number` | |
| `t.bigInteger()` | `number` | |
| `t.float()` | `number` | |
| `t.decimal(precision?, scale?)` | `number` | |
| `t.boolean()` | `boolean` | |
| `t.date()` | `Date` | |
| `t.timestamp()` | `Date` | |
| `t.json()` | `unknown` | |
| `t.uuid()` | `string` | |
| `t.enum(values)` | Union of values | Pass `as const` array for inference |
| `t.foreignId()` | `number` | Foreign key column |

## Field modifiers

All field builders share these chainable modifiers:

```typescript
t.string()
  .nullable()          // allows null — type becomes string | null
  .default('hello')    // database default value
  .unique()            // adds unique index
  .index()             // adds regular index
  .hidden()            // excluded from serialisation (like $hidden in Eloquent)
  .auto()              // managed automatically (excluded from fillable)
  .min(2)              // minimum length / value (for validation)
  .max(100)            // maximum length / value
  .unsigned()          // numeric: UNSIGNED constraint
```

## ORM operations

The returned class extends `Model` from `@faber-js/orm`, so all standard ActiveRecord methods are available:

```typescript
// Read
const user = await User.find(1);
const all  = await User.all<typeof User>();

// Create
const user = await User.create({ name: 'Ada', email: 'ada@example.com' });

// Query builder
const admins = await User.where('role', 'admin').get();

// Update
await User.update(user.id, { role: 'editor' });

// Delete
await User.delete(user.id);

// Relationships (inherit from Model)
const posts = await user.hasMany(Post, 'user_id');
```

## Validation rules

`User.rules()` returns a validation rule object compatible with `@faber-js/validation`. Use it in a `FormRequest` or call it directly:

```typescript
import { User } from '../schema/User';
import { Validator } from '@faber-js/validation';

// In a FormRequest
export class StoreUserRequest extends FormRequest {
  rules() {
    return User.rules();
    // → { name: ['required','string','min:2','max:100'], email: ['required','email','unique:users'], ... }
  }
}

// Or manually
const errors = await Validator.validate(req.body(), User.rules());
```

Auto-rules includes `nullable` on nullable fields, `required` on non-nullable fields, `min`/`max`, `email`, `unique`, and enum validation.

## OpenAPI spec

`User.openapi()` returns an OpenAPI 3.1 schema object. Use it in your API documentation:

```typescript
import { User } from '../schema/User';

const spec = {
  paths: {
    '/users': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: User.openapi(),
            },
          },
        },
      },
    },
  },
};
```

## Test factory

`User.factory()` returns a `SchemaFactory` for generating test fixtures. It uses `@faker-js/faker` under the hood:

```typescript
import { User } from '../schema/User';

// Create one record in the database
const user = await User.factory().createOne();

// Create many
const users = await User.factory().times(10).create();

// Override specific fields
const admin = await User.factory().state({ role: 'admin' }).createOne();

// Build without persisting
const stub = User.factory().makeOne();

// State as a function (receives faker)
const user = await User.factory()
  .state((faker) => ({ name: faker.person.fullName() }))
  .createOne();
```

For the factory to infer realistic values, fields named `email`, `name`, and `uuid` fields receive sensible faker defaults. Everything else is populated with random safe values.

## CLI generator

```bash
npx faber make:schema Post
# CREATED app/schema/Post.ts
```

The generated stub:

```typescript
import { schema, t } from '@faber-js/schema';

export const Post = schema('posts', {
  id:        t.id(),
  createdAt: t.timestamp().auto(),
  updatedAt: t.timestamp().auto(),
});
```

Add your fields and the TypeScript types, validation rules, and OpenAPI spec are all automatically inferred.

## Using a schema model in a controller

```typescript
import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';
import { User } from '../schema/User';

@Injectable()
export class UserController extends Controller {
  async index(_req: Request): Promise<Response> {
    return this.json(await User.all());
  }

  async store(req: Request): Promise<Response> {
    const user = await User.create(req.validated());
    return this.json(user, 201);
  }
}
```

## Migrating

Schema models do not auto-generate or run migrations. Use `@faber-js/orm`'s migration runner:

```typescript
// database/migrations/2026_create_users_table.ts
import { Migration } from '@faber-js/orm';

export class CreateUsersTable extends Migration {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('users', (table) => {
      table.increments('id');
      table.string('name', 100).notNullable();
      table.string('email').unique().notNullable();
      table.string('password').notNullable();
      table.enum('role', ['admin', 'editor', 'viewer']).defaultTo('viewer');
      table.text('bio').nullable();
      table.timestamps(true, true);
    });
  }

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropTable('users');
  }
}
```

A future `faber schema:migrate` command that auto-generates migrations from the schema shape is on the roadmap.
