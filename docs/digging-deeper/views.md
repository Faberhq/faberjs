# Server-Side Views

`@faber-js/view` provides a JSX-based server-side view renderer — FaberJS's answer to Laravel Blade. Views are `.view.tsx` files that compile to HTML strings via a custom JSX runtime. No React, no VDOM, no client-side JavaScript required.

## Prerequisites

```bash
pnpm add @faber-js/view
```

Register the service provider in `bootstrap/app.ts`:

```typescript
import { ViewServiceProvider } from '@faber-js/view';

app.register(new ViewServiceProvider(app));
```

## Writing views

Create `.view.tsx` files in `resources/views/`. Add the `@jsxImportSource` pragma to enable the custom runtime:

```tsx
// resources/views/users/index.view.tsx
/** @jsxImportSource @faber-js/view */

interface Props {
  users: Array<{ id: number; name: string; email: string }>;
}

export default function UsersIndex({ users }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Users</title>
      </head>
      <body>
        <h1>Users</h1>
        <ul>
          {users.map((user) => (
            <li key={user.id}>{user.name} — {user.email}</li>
          ))}
        </ul>
      </body>
    </html>
  );
}
```

## Rendering from a controller

Extend `ViewController` instead of `Controller` to get `this.view()`:

```typescript
import { Injectable } from '@faber-js/core';
import { ViewController } from '@faber-js/view';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';
import { User } from '../models/User';

@Injectable()
export class UserController extends ViewController {
  async index(_req: Request): Promise<Response> {
    return this.view('users/index', {
      users: await User.all(),
    });
  }
}
```

`this.view(name, props)` resolves `resources/views/{name}.view.tsx`, calls the default export with props, and returns a `Response` with `content-type: text/html`. When the root element is `<html>`, `<!DOCTYPE html>` is prepended automatically.

## Layout composition

Layouts are plain TypeScript functions — no `@extends` or `@section` directives. Import and call the layout component like any other:

```tsx
// resources/views/layouts/app.view.tsx
/** @jsxImportSource @faber-js/view */
import type { RawHtml } from '@faber-js/view';

interface Props {
  title: string;
  children: RawHtml;
}

export function AppLayout({ title, children }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>{title} — My App</title>
        <link rel="stylesheet" href="/build/app.css" />
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/users">Users</a>
        </nav>
        <main>{children}</main>
        <script src="/build/app.js" defer />
      </body>
    </html>
  );
}
```

```tsx
// resources/views/users/index.view.tsx
/** @jsxImportSource @faber-js/view */
import { AppLayout } from '../layouts/app.view';

interface Props {
  users: Array<{ id: number; name: string }>;
}

export default function UsersIndex({ users }: Props) {
  return (
    <AppLayout title="Users">
      <h1>Users</h1>
      <ul>
        {users.map((u) => (
          <li key={u.id}>{u.name}</li>
        ))}
      </ul>
    </AppLayout>
  );
}
```

The layout receives `children` as a `RawHtml` instance (already-rendered HTML), so it renders without escaping when used inside another element.

## Auto-escaping

All user-interpolated values are HTML-escaped automatically. You can never accidentally render an XSS payload:

```tsx
// userInput is "<script>alert(1)</script>"
// renders: <p>&lt;script&gt;alert(1)&lt;/script&gt;</p>
<p>{userInput}</p>
```

Values that are `null`, `undefined`, or `false` produce no output:

```tsx
<p>{user.bio ?? null}</p>  {/* renders <p></p> when bio is null */}
{isAdmin && <a href="/admin">Admin</a>}  {/* nothing when isAdmin is false */}
```

## Raw HTML

When you have trusted HTML that should not be escaped, use `<Unsafe>` or the `raw()` helper:

```tsx
import { Unsafe, raw } from '@faber-js/view';

// Component style
<div>
  <Unsafe html={article.renderedMarkdown} />
</div>

// Inline style
<p>{raw('<strong>Important</strong>')}</p>
```

Only use `<Unsafe>` and `raw()` with content you control or have already sanitized.

## Boolean attributes

Boolean HTML attributes are handled automatically. Pass `true` to render the bare attribute name, `false` to omit it:

```tsx
<input type="checkbox" checked={isChecked} disabled={isDisabled} />

// isChecked=true, isDisabled=false → <input type="checkbox" checked>
// isChecked=false, isDisabled=true → <input type="checkbox" disabled>
```

## `className` alias

Both `class` and `className` are supported. `className` is mapped to `class` for React familiarity:

```tsx
<div className="container mx-auto">...</div>
// → <div class="container mx-auto">...</div>
```

## Fragment

Use `Fragment` (or the `<>...</>` shorthand) to group elements without a wrapper:

```tsx
import { Fragment } from '@faber-js/view';

export default function UserRow({ user }: { user: User }) {
  return (
    <>
      <td>{user.name}</td>
      <td>{user.email}</td>
    </>
  );
}
```

## CLI generator

```bash
npx faber make:view users/index
# CREATED resources/views/users/Index.view.tsx

npx faber make:view Dashboard
# CREATED resources/views/Dashboard.view.tsx
```

The generated stub includes the `@jsxImportSource` pragma and a typed `Props` interface.

## TypeScript configuration

Add `resources/views/**/*` to the `include` array in your app's `tsconfig.json` so TypeScript type-checks your view files:

```json
{
  "compilerOptions": {
    "jsxImportSource": "@faber-js/view"
  },
  "include": [
    "app/**/*",
    "bootstrap/**/*",
    "routes/**/*",
    "resources/views/**/*"
  ]
}
```

The `@jsxImportSource` compiler option sets the default for all `.tsx` files in scope. The per-file `/** @jsxImportSource @faber-js/view */` pragma overrides this for each view file, making it self-documenting.

## `ViewRenderer` API

For advanced usage (custom view directories, testing):

```typescript
import { ViewRenderer } from '@faber-js/view';

const renderer = new ViewRenderer({
  viewsDir: '/absolute/path/to/views',
  extension: '.view.tsx',  // default
});

// Load and render a file
const html = await renderer.render('users/index', { users });

// Render a component function directly (no file I/O)
const html = renderer.renderComponent(UsersIndex, { users });
```

`ViewNotFoundException` is thrown when the view file cannot be found, with the attempted path in the message.
