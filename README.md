<div align="center">

# FaberJS

**The Laravel experience for Node.js**

[![npm](https://img.shields.io/npm/v/@faber-js/core?label=%40faber-js%2Fcore)](https://www.npmjs.com/package/@faber-js/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](tsconfig.base.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A full-featured, opinionated Node.js/TypeScript backend framework that mirrors<br>
Laravel's developer experience — conventions, architecture, CLI, and ecosystem.

</div>

---

## Quick Start

```bash
npm create faberjs@latest my-app
cd my-app
pnpm install
npx faber db:migrate
npx faber serve
```

That's it. You have a running server with routing, DI, ORM, and a migrations system.

---

## Why FaberJS?

Laravel developers moving to Node.js face a fragmented ecosystem. Every project starts with the same decision fatigue:

| Concern      | Laravel   | Node.js Today                         |
| ------------ | --------- | ------------------------------------- |
| HTTP routing | Built-in  | Choose from 20+ options               |
| ORM          | Eloquent  | Wire up Prisma, Drizzle, or Sequelize |
| Queues       | Built-in  | Integrate BullMQ yourself             |
| DI Container | Built-in  | InversifyJS + extensive boilerplate   |
| CLI          | `artisan` | Write your own from scratch           |
| Conventions  | Enforced  | None                                  |

FaberJS solves this with a single, coherent framework:

```typescript
// Feels like home if you know Laravel
const users = await User.where('active', true).orderBy('created_at', 'desc').paginate(15);

await dispatch(new SendWelcomeEmail(user));
await event(new UserRegistered(user));
```

---

## Packages

All packages are published under the `@faber-js/` scope.

| Package                                       | Description                                               | Version                                                                                                         |
| --------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`@faber-js/core`](packages/core)             | IoC container, service providers, `@Injectable`           | [![npm](https://img.shields.io/npm/v/@faber-js/core)](https://www.npmjs.com/package/@faber-js/core)             |
| [`@faber-js/http`](packages/http)             | Request/Response, middleware pipeline, HttpKernel         | [![npm](https://img.shields.io/npm/v/@faber-js/http)](https://www.npmjs.com/package/@faber-js/http)             |
| [`@faber-js/router`](packages/router)         | HTTP routing, route groups, Controller base               | [![npm](https://img.shields.io/npm/v/@faber-js/router)](https://www.npmjs.com/package/@faber-js/router)         |
| [`@faber-js/orm`](packages/orm)               | ActiveRecord ORM, migrations, relationships               | [![npm](https://img.shields.io/npm/v/@faber-js/orm)](https://www.npmjs.com/package/@faber-js/orm)               |
| [`@faber-js/console`](packages/console)       | The `faber` CLI — `make:*`, `db:*`, `serve`, `tinker`     | [![npm](https://img.shields.io/npm/v/@faber-js/console)](https://www.npmjs.com/package/@faber-js/console)       |
| [`@faber-js/queue`](packages/queue)           | Background jobs via BullMQ + Redis                        | [![npm](https://img.shields.io/npm/v/@faber-js/queue)](https://www.npmjs.com/package/@faber-js/queue)           |
| [`@faber-js/events`](packages/events)         | Event/listener bus with queued listener support           | [![npm](https://img.shields.io/npm/v/@faber-js/events)](https://www.npmjs.com/package/@faber-js/events)         |
| [`@faber-js/auth`](packages/auth)             | JWT authentication guards and authorization policies      | [![npm](https://img.shields.io/npm/v/@faber-js/auth)](https://www.npmjs.com/package/@faber-js/auth)             |
| [`@faber-js/config`](packages/config)         | Typed config from `.env` and config files                 | [![npm](https://img.shields.io/npm/v/@faber-js/config)](https://www.npmjs.com/package/@faber-js/config)         |
| [`@faber-js/validation`](packages/validation) | Fluent rule engine, FormRequest, auto-422 responses       | [![npm](https://img.shields.io/npm/v/@faber-js/validation)](https://www.npmjs.com/package/@faber-js/validation) |
| [`@faber-js/ai`](packages/ai)                 | AI agent scaffolding, Tool decorator, conversation memory | [![npm](https://img.shields.io/npm/v/@faber-js/ai)](https://www.npmjs.com/package/@faber-js/ai)                 |
| [`@faber-js/testing`](packages/testing)       | HTTP test client, `assertDatabaseHas`, `actingAs`         | [![npm](https://img.shields.io/npm/v/@faber-js/testing)](https://www.npmjs.com/package/@faber-js/testing)       |

---

## CLI

The `faber` CLI (installed with `@faber-js/console`) covers the full development workflow:

```bash
# Development
npx faber serve                      # start dev server with hot reload
npx faber tinker                     # interactive REPL

# Code generation
npx faber make:controller <Name>
npx faber make:model <Name> [-m]     # -m also creates a migration
npx faber make:service <Name>
npx faber make:job <Name>
npx faber make:event <Name>
npx faber make:listener <Name>
npx faber make:middleware <Name>
npx faber make:migration <Name>
npx faber make:provider <Name>
npx faber make:command <Name>
npx faber make:agent <Name>          # AI agent

# Database
npx faber db:migrate
npx faber db:rollback
npx faber db:seed
npx faber db:status

# Routing
npx faber route:list
```

---

## Tech Stack

| Concern       | Choice                                                |
| ------------- | ----------------------------------------------------- |
| Runtime       | Node.js >= 20 LTS                                     |
| Language      | TypeScript 5.x strict mode                            |
| HTTP Adapter  | Fastify (internal — never exposed to users)           |
| ORM Transport | Knex (internal — users see only the ActiveRecord API) |
| Queue Backend | BullMQ + Redis                                        |
| Auth Tokens   | JWT via `jose`                                        |
| Databases     | PostgreSQL, MySQL, SQLite                             |
| Test Runner   | Vitest                                                |
| Build Tool    | tsup (CJS + ESM output per package)                   |

---

## Development Setup

```bash
git clone https://github.com/echovick/faberjs.git
cd faberjs

pnpm install   # requires pnpm >= 9
pnpm build
pnpm test
pnpm type-check
```

To test the scaffolder locally without publishing:

```bash
node scripts/test-scaffold.mjs sqlite
node scripts/test-scaffold.mjs sqlite --auth
```

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

- Bug reports → [GitHub Issues](https://github.com/echovick/faberjs/issues)
- Security vulnerabilities → [SECURITY.md](SECURITY.md) — do not open a public issue
- Discussions → [GitHub Discussions](https://github.com/echovick/faberjs/discussions)

---

## License

[MIT](LICENSE) © 2026 FaberJS Contributors
