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

The scaffolder generates a database config that matches the driver you chose. All four drivers are supported:

**SQLite (default — fastest local dev, requires native compilation):**

```typescript
import { env } from '@faber-js/config';

export default {
  default: env('DB_CONNECTION', 'better-sqlite3'),
  connections: {
    'better-sqlite3': {
      client: 'better-sqlite3',
      connection: { filename: env('DB_DATABASE', './storage/database.sqlite') },
    },
  },
};
```

**SQLite WASM (pure WebAssembly — works on Termux, ARM, and edge runtimes):**

```typescript
export default {
  default: env('DB_CONNECTION', 'sqlite-wasm'),
  connections: {
    'sqlite-wasm': {
      client: 'sqlite-wasm',
      connection: { filename: env('DB_DATABASE', './storage/database.sqlite') },
    },
  },
};
```

Requires `sql.js` (`pnpm add sql.js`). No native compilation — works anywhere Node.js runs.

**PostgreSQL:**

```typescript
export default {
  default: env('DB_CONNECTION', 'pg'),
  connections: {
    pg: {
      client: 'pg',
      connection: {
        host: env('DB_HOST', '127.0.0.1'),
        port: env('DB_PORT', 5432),
        database: env('DB_DATABASE', 'my_app'),
        user: env('DB_USERNAME', 'postgres'),
        password: env('DB_PASSWORD', ''),
      },
    },
  },
};
```

**MySQL:**

```typescript
export default {
  default: env('DB_CONNECTION', 'mysql2'),
  connections: {
    mysql2: {
      client: 'mysql2',
      connection: {
        host: env('DB_HOST', '127.0.0.1'),
        port: env('DB_PORT', 3306),
        database: env('DB_DATABASE', 'my_app'),
        user: env('DB_USERNAME', 'root'),
        password: env('DB_PASSWORD', ''),
      },
    },
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
