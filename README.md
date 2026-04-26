<div align="center">

# FaberJS

**The Laravel experience for Node.js**

[![CI](https://github.com/YOUR_ORG/faberjs/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/faberjs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](tsconfig.base.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A full-featured, opinionated Node.js/TypeScript backend framework that mirrors<br>
Laravel's developer experience — conventions, architecture, CLI, and ecosystem.

</div>

---

> **Status:** FaberJS is in active development (Phase 1 complete). It is not yet suitable for production use. Follow the [Roadmap](#roadmap) for progress updates.

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
const users = await User.where('active', true)
  .where('age', '>', 18)
  .with('posts', 'profile')
  .orderBy('created_at', 'desc')
  .paginate(15);

await SendWelcomeEmail.dispatch(user);
await Event.dispatch(new UserRegistered(user));
```

---

## Packages

All packages are published under the `/` scope and versioned independently.

| Package                              | Description                                                | Version                                                 |
| ------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------- |
| [`/core`](packages/core)             | IoC container, service providers, facades                  | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/router`](packages/router)         | HTTP routing, resource routes, route model binding         | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/orm`](packages/orm)               | Eloquent-style ActiveRecord ORM, migrations, relationships | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/http`](packages/http)             | Request/Response abstraction, middleware pipeline          | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/console`](packages/console)       | The `faberjs` CLI — `make:*`, `db:*`, `queue:*`, tinker    | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/queue`](packages/queue)           | Background jobs and workers via BullMQ + Redis             | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/events`](packages/events)         | Event/listener system with queued listener support         | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/auth`](packages/auth)             | JWT authentication guards and authorization policies       | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/config`](packages/config)         | Typed configuration from `.env` and config files           | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/validation`](packages/validation) | Fluent rule engine, FormRequest, auto-422 responses        | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/cache`](packages/cache)           | Redis and in-memory cache abstraction                      | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |
| [`/testing`](packages/testing)       | HTTP test client, `assertDatabaseHas`, `actingAs`          | ![npm](https://img.shields.io/badge/npm-soon-lightgrey) |

---

## Roadmap

| Phase | Scope                                                | Status  |
| ----- | ---------------------------------------------------- | ------- |
| 1     | Monorepo scaffolding (pnpm workspaces, tsup, vitest) | ✅ Done |
| 2     | `/core` IoC container + `/config`                    | 🔄 Next |
| 3     | `/http` kernel + `/router`                           | Pending |
| 4     | `/orm` + migrations                                  | Pending |
| 5     | `/validation`                                        | Pending |
| 6     | `/console` (`faberjs` CLI)                           | Pending |
| 7     | `/queue`                                             | Pending |
| 8     | `/events`                                            | Pending |
| 9     | `/auth`                                              | Pending |
| 10    | `/testing` + `npm create faberjs@latest`             | Pending |

---

## Tech Stack

| Concern             | Choice                                              |
| ------------------- | --------------------------------------------------- |
| Runtime             | Node.js >= 20 LTS                                   |
| Language            | TypeScript 5.x (strict mode)                        |
| HTTP Adapter        | Fastify (internal — never exposed to users)         |
| ORM Transport       | Knex (internal — users see only Eloquent-style API) |
| Queue Backend       | BullMQ + Redis                                      |
| Auth Tokens         | JWT via `jose`                                      |
| Supported Databases | PostgreSQL, MySQL, SQLite                           |
| Test Runner         | Vitest                                              |
| Build Tool          | tsup (CJS + ESM output per package)                 |

---

## Development Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_ORG/faberjs.git
cd faberjs

# Install dependencies (requires pnpm >= 9)
pnpm install

# Build all packages
pnpm build

# Run the test suite
pnpm test

# Type-check all packages
pnpm type-check

# Lint
pnpm lint
```

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0

---

## Contributing

Contributions are welcome and encouraged. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

- Bug reports → [GitHub Issues](https://github.com/YOUR_ORG/faberjs/issues)
- Security vulnerabilities → [Private Security Advisory](SECURITY.md) (do not open a public issue)
- Discussions → [GitHub Discussions](https://github.com/YOUR_ORG/faberjs/discussions)

---

## License

[MIT](LICENSE) © 2026 FaberJS Contributors
