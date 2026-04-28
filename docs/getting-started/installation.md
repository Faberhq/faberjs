# Installation

FaberJS is scaffolded with a single command. Like Laravel's `laravel new`, `npm create faberjs@latest` gives you a production-ready project structure in seconds.

## Requirements

- Node.js >= 20 LTS
- pnpm (recommended) or npm
- A database — PostgreSQL, MySQL, or SQLite (see options below)

## Creating a new project

```bash
npm create faberjs@latest my-app
cd my-app
```

The scaffolder will prompt you for your database driver and create a fully wired project directory.

### Database driver options

| Driver | Package | Notes |
|---|---|---|
| `sqlite` | `better-sqlite3` | Default. Fast native binary. Recommended for local dev on macOS/Linux/Windows. |
| `sqlite-wasm` | `sql.js` | Pure WebAssembly — no native compilation. Works on **Termux**, ARM, and edge environments. |
| `postgres` | `pg` | Recommended for production. |
| `mysql` | `mysql2` | MySQL / MariaDB. |

## What gets scaffolded

After running the create command you have:

```
my-app/
├── app/
│   ├── controllers/
│   ├── models/
│   ├── services/
│   ├── jobs/
│   ├── events/
│   ├── listeners/
│   ├── policies/
│   ├── providers/
│   └── commands/
├── bootstrap/
│   └── app.ts          ← application boot file
├── config/
│   ├── app.ts
│   └── database.ts
├── database/
│   └── migrations/
├── routes/
│   └── api.ts
├── storage/
├── tests/
├── .env
└── tsconfig.json
```

## First run

Install dependencies, run migrations, and start the dev server:

```bash
pnpm install
npx faber db:migrate
npx faber serve
```

The dev server starts on port `3000` by default with hot reload powered by `tsx --watch`.

```
Server running at http://localhost:3000
```

To use a different port:

```bash
npx faber serve --port 8080
```

## Installing into an existing project

If you want to add FaberJS packages incrementally rather than using the scaffolder:

```bash
pnpm add @faber-js/core @faber-js/config @faber-js/http @faber-js/router @faber-js/orm
```

Then add the packages you need:

```bash
pnpm add @faber-js/queue @faber-js/events @faber-js/auth @faber-js/validation
```

Install the CLI globally to get the `faber` command:

```bash
pnpm add -g @faber-js/console
```

## TypeScript configuration

Your `tsconfig.json` must enable decorators and decorator metadata:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "outDir": "dist"
  }
}
```

These two flags are required for `@Injectable()` and the IoC container to work.
