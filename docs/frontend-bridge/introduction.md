# Frontend Bridge

`@faber-js/bridge` lets you build full-stack applications with React or Vue using your existing FaberJS controllers — no separate API needed. Controllers return rendered page components and their data in a single response; the client-side adapter handles navigation without full page reloads.

This is FaberJS's answer to [Inertia.js](https://inertiajs.com), with two improvements: end-to-end TypeScript type safety between your server props and client components, and first-class Vite integration baked in.

## How it works

On the first visit, the server returns a complete HTML page containing the component name and props as a JSON attribute:

```html
<div id="app" data-page='{"component":"Users/Index","props":{...},"url":"/users","version":"abc123"}'></div>
```

On every subsequent navigation, the browser sends an XHR request with an `X-Faber-Bridge: true` header. The server returns only JSON — no full HTML — and the adapter swaps the component in place:

```json
{ "component": "Users/Index", "props": { "users": [...] }, "url": "/users", "version": "abc123" }
```

The result is SPA-style navigation built on server-side routing with no duplication between your routes file and a separate API.

## Installation

Install the server-side package:

```bash
pnpm add @faber-js/bridge
```

Install the adapter for your chosen framework:

```bash
pnpm add @faber-js/bridge-react   # React
pnpm add @faber-js/bridge-vue     # Vue 3
```

## Server setup

### 1. Register the service provider

In `bootstrap/app.ts`, register `BridgeServiceProvider` **after** the HTTP kernel is registered:

```typescript
import { BridgeServiceProvider } from '@faber-js/bridge';

app.register(new BridgeServiceProvider(app));
await app.boot();
```

`BridgeServiceProvider` automatically registers `BridgeMiddleware` as global middleware, so every response from a `BridgeController` is intercepted and transformed.

### 2. Create a bridge controller

Extend `BridgeController` instead of `Controller`. This adds the `this.render()` helper:

```typescript
import { Injectable } from '@faber-js/core';
import { BridgeController } from '@faber-js/bridge';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';
import { UserService } from '../services/UserService';

@Injectable()
export class UserController extends BridgeController {
  constructor(private readonly userService: UserService) {
    super();
  }

  async index(_req: Request): Promise<Response> {
    return this.render('Users/Index', {
      users: await this.userService.all(),
    });
  }

  async show(req: Request): Promise<Response> {
    const user = await this.userService.find(Number(req.route('id')));
    return this.render('Users/Show', { user });
  }
}
```

The first argument to `render()` is the component name — a path relative to your `resources/pages/` directory. The second argument is the props object passed to the component.

### 3. Add an HTML template

Create `resources/views/app.html`. This is the shell served on first visits. Add your Vite entry point here:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
</head>
<body>
  <div id="app" data-page="__BRIDGE_PAGE__"></div>
  <script type="module" src="/resources/js/app.tsx"></script>
</body>
</html>
```

The `__BRIDGE_PAGE__` placeholder is replaced by the bridge middleware with the serialized page JSON.

### 4. Vite configuration

Install and configure the Vite plugin:

```bash
pnpm add -D vite
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { faberBridge } from '@faber-js/bridge/vite';

export default defineConfig({
  plugins: [
    react(),
    faberBridge({ framework: 'react' }),
  ],
});
```

The plugin exposes `__FABER_BRIDGE_VERSION__` as a build-time constant and sets the asset version header during development.

## Shared data

Use `SharedData` to share data with every page without passing it in every `render()` call. This is the right place for the authenticated user, flash messages, locale, etc.

```typescript
// bootstrap/app.ts
import { SharedData } from '@faber-js/bridge';

await app.boot();

const shared = app.make<SharedData>('bridge.shared');

// Static value
shared.share('appName', 'My App');

// Per-request value (receives the current Request)
shared.share((req) => ({
  auth: {
    user: req.user ? { id: req.user.id, name: req.user.name } : null,
  },
}));

// Async provider
shared.share(async (req) => ({
  unread: await Notification.where('user_id', req.user?.id ?? 0).count(),
}));
```

Shared data is merged into the `props` of every bridge response. Per-render props take precedence over shared data when keys collide.

## Asset versioning

When you deploy a new frontend build, clients with old cached scripts may be out of sync. The bridge handles this automatically: if `X-Faber-Bridge-Version` from the client doesn't match the current server version, the server responds with `409 Conflict` and the client performs a hard reload.

Configure the version in your service provider boot code:

```typescript
import { BridgeConfig } from '@faber-js/bridge';

const config = app.make<BridgeConfig>('bridge.config');
// Set to your build hash, git SHA, or anything that changes on deploy
(config as { version: string }).version = process.env.ASSET_VERSION ?? '';
```

The `@faber-js/bridge/vite` plugin computes a hash from your entry file and makes it available as `__FABER_BRIDGE_VERSION__` on the client side.

## Generating types

Run the type generator to create a `BridgePages` type map from your page components:

```bash
npx faber bridge:types
```

This scans `resources/pages/` and emits `resources/types/bridge.generated.ts`:

```typescript
// Auto-generated by faber bridge:types — do not edit manually
export type BridgePages = {
  'Users/Index': Record<string, unknown>;
  'Users/Show': Record<string, unknown>;
  'Posts/Create': Record<string, unknown>;
};
```

Re-run this command whenever you add a new page component. Once generated, the server-side `render()` call and the client-side `usePage()` hook both benefit from TypeScript checking.
