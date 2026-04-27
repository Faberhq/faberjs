# Configuration

FaberJS uses two layers of configuration: a `.env` file for environment-specific secrets and typed config files for everything else.

## Environment variables — `.env`

Copy `.env.example` to `.env` and fill in your values. The `.env` file is loaded at boot time by `@faber-js/config`.

```ini
APP_NAME=my-app
APP_ENV=local
APP_PORT=3000

DB_CLIENT=pg
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=my_app
DB_USER=postgres
DB_PASSWORD=secret

QUEUE_REDIS_HOST=127.0.0.1
QUEUE_REDIS_PORT=6379

JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d

ANTHROPIC_API_KEY=sk-ant-...
```

## The `env()` helper

Read environment variables anywhere in your application with the `env()` helper from `@faber-js/config`. It is type-safe: the return type matches the type of the fallback you provide.

```typescript
import { env } from '@faber-js/config';

// Returns string | undefined
const name = env('APP_NAME');

// Returns string (fallback ensures non-undefined)
const host = env('DB_HOST', 'localhost');

// Returns number — parses the env var as a number
const port = env('APP_PORT', 3000);

// Returns boolean — 'true' and '1' both resolve to true
const debug = env('APP_DEBUG', false);
```

## Config files

Config files live in `config/` and are plain TypeScript modules. They can call `env()` to read from the environment.

### `config/app.ts`

```typescript
import { env } from '@faber-js/config';

export default {
  name: env('APP_NAME', 'FaberJS'),
  env: env('APP_ENV', 'production'),
  port: env('APP_PORT', 3000),
  url: env('APP_URL', 'http://localhost:3000'),
};
```

### `config/database.ts`

```typescript
import { env } from '@faber-js/config';

export default {
  client: env('DB_CLIENT', 'pg'),
  connection: {
    host: env('DB_HOST', '127.0.0.1'),
    port: env('DB_PORT', 5432),
    database: env('DB_DATABASE', 'my_app'),
    user: env('DB_USER', 'postgres'),
    password: env('DB_PASSWORD', ''),
  },
};
```

### `config/queue.ts`

```typescript
import { env } from '@faber-js/config';

export default {
  connection: {
    host: env('QUEUE_REDIS_HOST', '127.0.0.1'),
    port: env('QUEUE_REDIS_PORT', 6379),
  },
  defaultQueue: 'default',
};
```

## Loading config in service providers

Config files are loaded by your service providers in `bootstrap/app.ts`. Pass the loaded config to the provider:

```typescript
import databaseConfig from '../config/database';
import { OrmServiceProvider } from '@faber-js/orm';

app.register(new OrmServiceProvider(app, databaseConfig));
```

## Environment-specific behaviour

Use `env('APP_ENV')` to branch on environment:

```typescript
if (env('APP_ENV') === 'production') {
  // production-only behaviour
}
```

Common values: `local`, `testing`, `staging`, `production`.
