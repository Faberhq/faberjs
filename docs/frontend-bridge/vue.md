# Vue 3 Adapter

`@faber-js/bridge-vue` provides a Vue 3 adapter for the FaberJS bridge protocol. It ships `createBridgeApp`, `usePage`, `useForm`, `<BridgeLink>`, and `<BridgeHead>`.

## Prerequisites

Install Vue and the adapter:

```bash
pnpm add vue @faber-js/bridge-vue
pnpm add -D @vitejs/plugin-vue
```

Add `@vitejs/plugin-vue` to your Vite config:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { faberBridge } from '@faber-js/bridge/vite';

export default defineConfig({
  plugins: [vue(), faberBridge({ framework: 'vue' })],
});
```

## Bootstrapping

Create your frontend entry point:

```typescript
// resources/js/app.ts
import { createBridgeApp } from '@faber-js/bridge-vue';

createBridgeApp({
  resolve: (name) => import(`../pages/${name}.vue`),
});
```

`resolve` receives the component name from the server (e.g. `'Users/Index'`) and returns the Vue component. Dynamic imports automatically split each page into its own chunk.

For explicit imports:

```typescript
import UsersIndex from '../pages/Users/Index.vue';
import UsersShow from '../pages/Users/Show.vue';

const pages: Record<string, object> = {
  'Users/Index': UsersIndex,
  'Users/Show': UsersShow,
};

createBridgeApp({
  resolve: (name) => pages[name],
});
```

## Page components

Each page is a standard Vue SFC. Props passed from the server are available via `usePage()`:

```vue
<!-- resources/pages/Users/Index.vue -->
<script setup lang="ts">
import { usePage } from '@faber-js/bridge-vue';

interface User {
  id: number;
  name: string;
  email: string;
}

const page = usePage<{ users: User[] }>();
</script>

<template>
  <div>
    <h1>Users</h1>
    <ul>
      <li v-for="user in page.props.users" :key="user.id">
        {{ user.name }}
      </li>
    </ul>
  </div>
</template>
```

## `usePage<T>()`

Returns a reactive `ComputedRef` of the current bridge page. The generic `T` narrows the `props` field.

```typescript
import { usePage } from '@faber-js/bridge-vue';

const page = usePage<{ user: User; posts: Post[] }>();

// page.value.props.user   — User
// page.value.props.posts  — Post[]
// page.value.url          — current URL string
// page.value.component    — component name (e.g. 'Users/Show')
```

Because `usePage()` returns a `ComputedRef`, you can use it directly in templates:

```vue
<template>
  <p>Welcome, {{ page.props.user.name }}</p>
</template>
```

Or destructure with `toRefs` for cleaner templates:

```typescript
import { computed } from 'vue';
import { usePage } from '@faber-js/bridge-vue';

const page = usePage<{ user: User }>();
const user = computed(() => page.value.props.user);
```

## `<BridgeLink>`

Renders an anchor tag that performs bridge XHR navigation instead of a full page load:

```vue
<script setup lang="ts">
import { BridgeLink } from '@faber-js/bridge-vue';
</script>

<template>
  <BridgeLink href="/users">All users</BridgeLink>
  <BridgeLink href="/users/create">Create user</BridgeLink>
</template>
```

### Props

| Prop             | Type      | Default  | Description                           |
| ---------------- | --------- | -------- | ------------------------------------- |
| `href`           | `string`  | —        | Target URL                            |
| `method`         | `string`  | `'get'`  | HTTP method (get, post, put, etc.)    |
| `preserveScroll` | `boolean` | `false`  | Do not scroll to top after navigation |

### Events

| Event   | Payload       | Description              |
| ------- | ------------- | ------------------------ |
| `click` | `MouseEvent`  | Emitted before XHR fires |

Modifier keys (`Cmd`, `Ctrl`, `Shift`, `Alt`) bypass the intercept and open the link normally.

## `useForm<T>(initialValues)`

Manages a form's data, validation errors, and submission state. Returns a reactive form object:

```vue
<!-- resources/pages/Users/Create.vue -->
<script setup lang="ts">
import { useForm } from '@faber-js/bridge-vue';
import { BridgeLink } from '@faber-js/bridge-vue';

const form = useForm({
  name: '',
  email: '',
  password: '',
});

function submit() {
  form.post('/users');
}
</script>

<template>
  <form @submit.prevent="submit">
    <div>
      <input v-model="form.data.name" placeholder="Name" />
      <span v-if="form.errors.name">{{ form.errors.name }}</span>
    </div>

    <div>
      <input v-model="form.data.email" type="email" placeholder="Email" />
      <span v-if="form.errors.email">{{ form.errors.email }}</span>
    </div>

    <div>
      <input v-model="form.data.password" type="password" placeholder="Password" />
      <span v-if="form.errors.password">{{ form.errors.password }}</span>
    </div>

    <BridgeLink href="/users">Cancel</BridgeLink>
    <button type="submit" :disabled="form.processing">
      {{ form.processing ? 'Saving…' : 'Create user' }}
    </button>
  </form>
</template>
```

### Form state

| Property     | Type                               | Description                               |
| ------------ | ---------------------------------- | ----------------------------------------- |
| `data`       | `T`                                | Current field values                      |
| `errors`     | `Partial<Record<keyof T, string>>` | Validation errors from the server         |
| `processing` | `boolean`                          | `true` while the request is in-flight     |
| `hasErrors`  | `boolean`                          | `true` when `errors` has at least one key |

### Form methods

| Method               | Description                                |
| -------------------- | ------------------------------------------ |
| `setData(key, val)`  | Update a single field value                |
| `reset()`            | Reset data to initial values, clear errors |
| `clearErrors()`      | Clear all validation errors                |
| `post(url, opts?)`   | Send a `POST` request with form data       |
| `put(url, opts?)`    | Send a `PUT` request                       |
| `patch(url, opts?)`  | Send a `PATCH` request                     |
| `delete(url, opts?)` | Send a `DELETE` request                    |

### Submission options

```typescript
form.post('/users', {
  onSuccess: (page) => console.log('Navigated to', page.url),
  onError: (errors) => console.error('Validation failed', errors),
  onFinish: () => console.log('Request complete'),
});
```

### v-model support

`form.data` is reactive, so `v-model` works directly without `setData`:

```vue
<input v-model="form.data.name" />
```

Alternatively, use `setData` for explicit control:

```vue
<input :value="form.data.name" @input="form.setData('name', ($event.target as HTMLInputElement).value)" />
```

## `<BridgeHead>`

Sets the document title reactively:

```vue
<script setup lang="ts">
import { BridgeHead } from '@faber-js/bridge-vue';
</script>

<template>
  <BridgeHead title="Users — My App" />
  <h1>Users</h1>
</template>
```

The title is updated immediately via a `watch` with `{ immediate: true }`, so it applies on both initial render and subsequent navigation.

## Shared data in Vue

Shared data registered with `SharedData.share()` is merged into `props` and available on every page:

```typescript
interface SharedProps {
  auth: { user: { id: number; name: string } | null };
}

const page = usePage<SharedProps & { posts: Post[] }>();
const user = computed(() => page.value.props.auth.user);
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

**Client — `resources/pages/Posts/Create.vue`:**

```vue
<script setup lang="ts">
import { useForm } from '@faber-js/bridge-vue';
import { BridgeLink, BridgeHead } from '@faber-js/bridge-vue';

const form = useForm({ title: '', body: '' });
</script>

<template>
  <BridgeHead title="New Post" />
  <h1>New Post</h1>

  <form @submit.prevent="form.post('/posts')">
    <div>
      <input v-model="form.data.title" placeholder="Title" />
      <p v-if="form.errors.title" class="error">{{ form.errors.title }}</p>
    </div>

    <div>
      <textarea v-model="form.data.body" placeholder="Write something..." />
      <p v-if="form.errors.body" class="error">{{ form.errors.body }}</p>
    </div>

    <div>
      <BridgeLink href="/posts">Cancel</BridgeLink>
      <button type="submit" :disabled="form.processing">
        {{ form.processing ? 'Publishing…' : 'Publish' }}
      </button>
    </div>
  </form>
</template>
```

## Differences from the React adapter

| Feature            | React                   | Vue                          |
| ------------------ | ----------------------- | ---------------------------- |
| `usePage()`        | Returns `BridgePage`    | Returns `ComputedRef<BridgePage>` |
| Form access        | `form.data.field`       | `form.data.field` (reactive) |
| v-model            | N/A (use `setData`)     | Works directly on `form.data` |
| Navigation         | `<Link>`                | `<BridgeLink>`               |
| Head management    | `<Head>`                | `<BridgeHead>`               |
