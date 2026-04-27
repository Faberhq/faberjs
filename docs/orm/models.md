# Models

A FaberJS model is an ActiveRecord class that maps to a database table. Each model extends `Model` from `@faber-js/orm`.

## Generating a model

```bash
faber make:model Post
```

With a migration at the same time:

```bash
faber make:model Post -m
```

Generated file (`app/models/Post.ts`):

```typescript
import { Model } from '@faber-js/orm';

export class Post extends Model {
  static override table = 'posts';
  static override fillable: readonly string[] = [];
}
```

## Static properties

### `table`

The database table name. Must be set explicitly.

```typescript
export class Post extends Model {
  static override table = 'posts';
}
```

### `fillable`

An allowlist of columns that can be mass-assigned via `Model.create()` or `instance.fill()`. Any column not in `fillable` is ignored on mass assignment.

```typescript
static override fillable: readonly string[] = ['title', 'body', 'user_id'];
```

### `hidden`

Columns excluded from `toJSON()` and `toObject()`. Use this to prevent passwords and tokens from leaking into API responses.

```typescript
static override hidden: readonly string[] = ['password', 'remember_token'];
```

### `primaryKey`

Defaults to `'id'`. Override if your table uses a different primary key.

```typescript
static override primaryKey = 'uuid';
```

### `softDeletes`

Enable soft deletes. When `true`, `delete()` sets `deleted_at` instead of removing the row. Soft-deleted records are excluded from all queries by default.

```typescript
static override softDeletes = true;
```

## A complete example

```typescript
import { Model } from '@faber-js/orm';
import type { Post } from './Post';

export class User extends Model {
  static override table = 'users';
  static override fillable: readonly string[] = ['name', 'email', 'password'];
  static override hidden: readonly string[] = ['password'];
  static override softDeletes = true;

  posts(): HasMany<this, Post> {
    return this.hasMany(Post);
  }
}
```

## Instance methods

### `fill(attrs)`

Mass-assign attributes. Respects `fillable` — non-fillable keys are ignored.

```typescript
const user = new User();
user.fill({ name: 'Alice', email: 'alice@example.com' });
```

### `getAttribute(key)` / `setAttribute(key, value)`

Low-level attribute access. Prefer using `fill()` and `toObject()` in most cases.

```typescript
const name = user.getAttribute('name');
user.setAttribute('name', 'Bob');
```

### `toObject()` / `toJSON()`

Serialise the model to a plain object. Both methods apply `hidden` filtering. `toJSON()` is called automatically by `JSON.stringify()`.

```typescript
const plain = user.toObject();
const json = JSON.stringify(user);
```

### `save()`

Persist the model. Issues an `INSERT` if it is new, or an `UPDATE` if it already exists.

```typescript
const user = new User();
user.fill({ name: 'Alice', email: 'alice@example.com' });
await user.save();
```

### `update(attrs)`

Merge attributes and save in one call.

```typescript
await user.update({ name: 'Alice Smith' });
```

### `delete()`

Hard-delete or soft-delete depending on `softDeletes`.

```typescript
await user.delete();
```

### `restore()`

Restore a soft-deleted record. No-op if `softDeletes` is `false`.

```typescript
await user.restore();
```

## Static methods (CRUD)

### `Model.create(attrs)`

Create and persist a new record in one step.

```typescript
const user = await User.create({
  name: 'Alice',
  email: 'alice@example.com',
  password: hashedPassword,
});
```

### `Model.find(id)`

Find a record by primary key. Returns `null` if not found.

```typescript
const user = await User.find<User>(1);
if (!user) return Response.notFound();
```

### `Model.findOrFail(id)`

Like `find()` but throws `ModelNotFoundException` (caught by the kernel as a 404) if not found.

```typescript
const user = await User.findOrFail<User>(1);
```

### `Model.all()`

Return all records.

```typescript
const users = await User.all<User>();
```

### `Model.where()` / `Model.orWhere()`

Start a query builder chain. See [Queries](/orm/queries) for the full API.

```typescript
const active = await User.where<User>('active', true).get();
```

### `Model.count()`

Count all records (excluding soft-deleted rows if `softDeletes` is `true`).

```typescript
const total = await User.count<User>();
```

### `Model.paginate(perPage?, page?)`

Return a paginated result set.

```typescript
const result = await User.paginate<User>(15, 1);
// {
//   data: User[],
//   meta: { current_page, last_page, per_page, total },
//   links: { first, last, prev, next }
// }
```
