# React Adapter

`@faber-js/bridge-react` provides a React adapter for the FaberJS bridge protocol. It ships `createBridgeApp`, `usePage`, `useForm`, `<Link>`, and `<Head>`.

## Prerequisites

Install React and the adapter:

```bash
pnpm add react react-dom @faber-js/bridge-react
pnpm add -D @types/react @types/react-dom @vitejs/plugin-react
```

Add `@vitejs/plugin-react` to your Vite config:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { faberBridge } from '@faber-js/bridge/vite';

export default defineConfig({
  plugins: [react(), faberBridge({ framework: 'react' })],
});
```

## Bootstrapping

Create your frontend entry point:

```tsx
// resources/js/app.tsx
import { createBridgeApp } from '@faber-js/bridge-react';

createBridgeApp({
  resolve: (name) => import(`../pages/${name}`),
});
```

`resolve` receives the component name from the server (e.g. `'Users/Index'`) and returns the component. Dynamic imports let the bundler split each page into its own chunk automatically.

For explicit imports (no dynamic chunks):

```tsx
import UsersIndex from '../pages/Users/Index';
import UsersShow from '../pages/Users/Show';

const pages: Record<string, React.ComponentType> = {
  'Users/Index': UsersIndex,
  'Users/Show': UsersShow,
};

createBridgeApp({
  resolve: (name) => pages[name],
});
```

## Page components

Each server `render()` call maps to a page component in `resources/pages/`. Props passed from the server are received as component props:

```tsx
// resources/pages/Users/Index.tsx
import { usePage } from '@faber-js/bridge-react';

interface User {
  id: number;
  name: string;
  email: string;
}

export default function UsersIndex() {
  const { props } = usePage<{ users: User[] }>();

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {props.users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## `usePage<T>()`

Returns the current bridge page, including typed props. The generic `T` narrows the `props` field.

```tsx
import { usePage } from '@faber-js/bridge-react';

const { props, url, component } = usePage<{ user: User; posts: Post[] }>();

// props.user     — User
// props.posts    — Post[]
// url            — current URL string
// component      — component name string (e.g. 'Users/Show')
```

When using the generated `BridgePages` type map:

```tsx
import type { BridgePages } from '../../types/bridge.generated';
import { usePage } from '@faber-js/bridge-react';

const { props } = usePage<BridgePages['Users/Index']>();
// props.users — typed correctly
```

## `<Link>`

Renders an anchor tag that performs bridge XHR navigation instead of a full page load:

```tsx
import { Link } from '@faber-js/bridge-react';

<Link href="/users">All users</Link>
<Link href="/users/create">Create user</Link>
```

### Props

| Prop            | Type                                         | Default   | Description                              |
| --------------- | -------------------------------------------- | --------- | ---------------------------------------- |
| `href`          | `string`                                     | —         | Target URL                               |
| `method`        | `'get' \| 'post' \| 'put' \| 'patch' \| 'delete'` | `'get'` | HTTP method to use for the request       |
| `preserveScroll` | `boolean`                                  | `false`   | Do not scroll to top after navigation    |

Modifier keys (`Cmd`, `Ctrl`, `Shift`, `Alt`) bypass the intercept and open the link normally.

## `useForm<T>(initialValues)`

Manages a form's data, validation errors, and submission state.

```tsx
import { useForm, Link } from '@faber-js/bridge-react';

export default function CreateUser() {
  const form = useForm({
    name: '',
    email: '',
    password: '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    form.post('/users');
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          value={form.data.name}
          onChange={(e) => form.setData('name', e.target.value)}
          placeholder="Name"
        />
        {form.errors.name && <span>{form.errors.name}</span>}
      </div>

      <div>
        <input
          type="email"
          value={form.data.email}
          onChange={(e) => form.setData('email', e.target.value)}
          placeholder="Email"
        />
        {form.errors.email && <span>{form.errors.email}</span>}
      </div>

      <div>
        <input
          type="password"
          value={form.data.password}
          onChange={(e) => form.setData('password', e.target.value)}
          placeholder="Password"
        />
        {form.errors.password && <span>{form.errors.password}</span>}
      </div>

      <button type="submit" disabled={form.processing}>
        {form.processing ? 'Saving…' : 'Create user'}
      </button>
    </form>
  );
}
```

### Form state

| Property      | Type                               | Description                                      |
| ------------- | ---------------------------------- | ------------------------------------------------ |
| `data`        | `T`                                | Current field values                             |
| `errors`      | `Partial<Record<keyof T, string>>` | Validation errors returned by the server         |
| `processing`  | `boolean`                          | `true` while the request is in-flight            |
| `hasErrors`   | `boolean`                          | `true` when `errors` has at least one key        |

### Form methods

| Method              | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `setData(key, val)` | Update a single field value                               |
| `reset()`           | Reset data to initial values and clear errors             |
| `clearErrors()`     | Clear all validation errors                               |
| `post(url, opts?)`  | Send a `POST` request with current form data as JSON body |
| `put(url, opts?)`   | Send a `PUT` request                                      |
| `patch(url, opts?)` | Send a `PATCH` request                                    |
| `delete(url, opts?)`| Send a `DELETE` request                                   |

### Submission options

Each submit method accepts an optional options object:

```tsx
form.post('/users', {
  onSuccess: (page) => console.log('Navigated to', page.url),
  onError: (errors) => console.error('Validation failed', errors),
  onFinish: () => console.log('Request complete'),
});
```

### Handling 422 validation errors

When the server returns a `422` response, `useForm` automatically populates `form.errors` with the error bag from the response body. No extra configuration needed.

The server-side validation exception shape that `useForm` expects:

```json
{ "errors": { "email": "The email has already been taken." } }
```

This matches exactly what `ValidationException` produces in `@faber-js/validation`.

## `<Head>`

Manages the document title:

```tsx
import { Head } from '@faber-js/bridge-react';

export default function UsersIndex() {
  return (
    <>
      <Head title="Users — My App" />
      <h1>Users</h1>
    </>
  );
}
```

`<Head>` uses a `useEffect` to set `document.title` reactively. On navigation, the title updates automatically when the new page component mounts.

## Shared data in React

Shared data registered with `SharedData.share()` is merged into `props`. Access it the same way as per-page props:

```tsx
interface SharedProps {
  auth: { user: { id: number; name: string } | null };
  appName: string;
}

const { props } = usePage<SharedProps & { users: User[] }>();

const { auth, appName, users } = props;
```

## Full example

**Server — `app/controllers/PostController.ts`:**

```typescript
import { Injectable } from '@faber-js/core';
import { BridgeController } from '@faber-js/bridge';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';
import { PostService } from '../services/PostService';

@Injectable()
export class PostController extends BridgeController {
  constructor(private readonly postService: PostService) {
    super();
  }

  async index(_req: Request): Promise<Response> {
    return this.render('Posts/Index', {
      posts: await this.postService.recent(20),
    });
  }

  async create(_req: Request): Promise<Response> {
    return this.render('Posts/Create');
  }

  async store(req: Request): Promise<Response> {
    const post = await this.postService.create(req.only('title', 'body'));
    return this.redirect(`/posts/${post.id}`);
  }
}
```

**Client — `resources/pages/Posts/Create.tsx`:**

```tsx
import { useForm, Link, Head } from '@faber-js/bridge-react';

export default function PostCreate() {
  const form = useForm({ title: '', body: '' });

  return (
    <>
      <Head title="New Post" />
      <h1>New Post</h1>

      <form onSubmit={(e) => { e.preventDefault(); form.post('/posts'); }}>
        <div>
          <input
            value={form.data.title}
            onChange={(e) => form.setData('title', e.target.value)}
            placeholder="Title"
          />
          {form.errors.title && <p className="error">{form.errors.title}</p>}
        </div>

        <div>
          <textarea
            value={form.data.body}
            onChange={(e) => form.setData('body', e.target.value)}
            placeholder="Write something..."
          />
          {form.errors.body && <p className="error">{form.errors.body}</p>}
        </div>

        <div>
          <Link href="/posts">Cancel</Link>
          <button type="submit" disabled={form.processing}>
            {form.processing ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </form>
    </>
  );
}
```
