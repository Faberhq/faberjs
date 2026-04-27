# Queries

FaberJS's query builder chains off model static methods and wraps Knex internally. You get an Eloquent-style API without touching SQL.

## Retrieving records

### `all()`

Fetch every row from the table.

```typescript
const users = await User.all<User>();
```

### `find(id)` and `findOrFail(id)`

```typescript
const user = await User.find<User>(1); // User | null
const post = await Post.findOrFail<Post>(5); // Post (or throws 404)
```

### `first()`

Fetch the first matching record.

```typescript
const admin = await User.where<User>('role', 'admin').first(); // User | null
```

### `firstOrFail()`

Like `first()` but throws `ModelNotFoundException` if no record is found.

```typescript
const admin = await User.where<User>('role', 'admin').firstOrFail();
```

## Filtering — `where()`

### Simple equality

```typescript
const active = await User.where<User>('active', true).get();
```

### With an operator

```typescript
const expensive = await Product.where<Product>('price', '>', 100).get();
const recent = await Post.where<Post>('created_at', '>=', '2024-01-01').get();
```

Supported operators: `=`, `!=`, `<`, `<=`, `>`, `>=`, `like`, `not like`.

### Chaining multiple `where` calls

```typescript
const results = await User.where<User>('active', true).where('role', 'editor').get();
```

### `orWhere()`

```typescript
const results = await User.where<User>('role', 'admin').orWhere('role', 'superadmin').get();
```

## Ordering

```typescript
const newest = await Post.orderBy<Post>('created_at', 'desc').get();
const alpha = await User.orderBy<User>('name').get(); // 'asc' is the default
```

Chain multiple `orderBy` calls:

```typescript
const sorted = await Product.where<Product>('active', true)
  .orderBy('category', 'asc')
  .orderBy('price', 'desc')
  .get();
```

## Limiting and offsetting

```typescript
const top5 = await Post.orderBy<Post>('views', 'desc').limit(5).get();
const page2 = await Post.orderBy<Post>('id').limit(10).offset(10).get();
```

## Aggregates

### `count()`

```typescript
const total = await User.count<User>();
const admins = await User.where<User>('role', 'admin').count();
```

### `avg(column)`

```typescript
const avgPrice = await Product.where<Product>('active', true).avg('price');
```

## Pagination

```typescript
const page = await Post.orderBy<Post>('created_at', 'desc').paginate(15, 1);
```

The return shape:

```typescript
{
  data: Post[],
  meta: {
    current_page: 1,
    last_page: 4,
    per_page: 15,
    total: 60,
  },
  links: {
    first: null,
    last: null,
    prev: null,
    next: null,
  },
}
```

## Bulk updates and deletes

### `update(attrs)` on a query

Update all rows matching the query.

```typescript
await User.where<User>('role', 'guest').update({ active: false });
```

### `delete()` on a query

Delete all rows matching the query. If `softDeletes` is enabled, sets `deleted_at`.

```typescript
await Post.where<Post>('published', false).delete();
```

## Soft deletes

When `static override softDeletes = true` is set on a model, all queries automatically exclude soft-deleted rows (`WHERE deleted_at IS NULL`).

```typescript
// Only returns non-deleted posts
const posts = await Post.all<Post>();

// Include soft-deleted rows
const allPosts = await Post.withTrashed<Post>().get();

// Restore a single record
const post = await Post.withTrashed<Post>().where('id', 1).first();
await post?.restore();
```

## Eager loading

Load relationships in a single additional query instead of N+1 queries.

```typescript
const posts = await Post.with<Post>('comments').get();
```

Access the loaded relation via `getRelation()`:

```typescript
for (const post of posts) {
  const comments = post.getRelation<Comment[]>('comments');
}
```

See [Relationships](/orm/relationships) for defining `hasMany`, `hasOne`, `belongsTo`, and `belongsToMany`.

## Raw model static API summary

| Method                    | Returns                        | Description             |
| ------------------------- | ------------------------------ | ----------------------- |
| `Model.all()`             | `Promise<T[]>`                 | All records             |
| `Model.find(id)`          | `Promise<T \| null>`           | Find by primary key     |
| `Model.findOrFail(id)`    | `Promise<T>`                   | Find or throw 404       |
| `Model.create(attrs)`     | `Promise<T>`                   | Create and persist      |
| `Model.where(col, val)`   | `QueryBuilder<T>`              | Start filtered query    |
| `Model.orWhere(col, val)` | `QueryBuilder<T>`              | Start OR-filtered query |
| `Model.orderBy(col, dir)` | `QueryBuilder<T>`              | Start ordered query     |
| `Model.withTrashed()`     | `QueryBuilder<T>`              | Include soft-deleted    |
| `Model.with(...rels)`     | `QueryBuilder<T>`              | Eager-load relations    |
| `Model.count()`           | `Promise<number>`              | Count all records       |
| `Model.paginate(n, p)`    | `Promise<PaginationResult<T>>` | Paginate                |

## QueryBuilder chaining summary

| Method                 | Description               |
| ---------------------- | ------------------------- |
| `.where(col, val)`     | Add WHERE condition       |
| `.where(col, op, val)` | Add WHERE with operator   |
| `.orWhere(col, val)`   | Add OR WHERE              |
| `.orderBy(col, dir)`   | Add ORDER BY              |
| `.limit(n)`            | Set LIMIT                 |
| `.offset(n)`           | Set OFFSET                |
| `.withTrashed()`       | Include soft-deleted rows |
| `.with(...rels)`       | Eager-load relations      |
| `.get()`               | Execute and return array  |
| `.first()`             | Execute and return first  |
| `.firstOrFail()`       | Execute or throw          |
| `.count()`             | Count matching rows       |
| `.avg(col)`            | Average of a column       |
| `.update(attrs)`       | Bulk update               |
| `.delete()`            | Bulk delete               |
| `.paginate(n, p)`      | Paginate                  |
