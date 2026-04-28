<div align="center">

# FaberJS

**The Laravel experience. Native to Node.js.**

[![npm](https://img.shields.io/npm/v/@faber-js/core?label=%40faber-js%2Fcore)](https://www.npmjs.com/package/@faber-js/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](tsconfig.base.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

An opinionated, full-stack Node.js/TypeScript backend framework built for developers who know what<br>
good conventions feel like — routing, ORM, queues, auth, mail, cache, and AI agents, all in one install.

[Documentation](https://faberjs.dev) · [Quick Start](#quick-start) · [Why FaberJS?](#why-faberjs) · [Packages](#packages)

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

That's it. A running server with routing, dependency injection, ORM, migrations, queues, and auth — zero configuration.

---

## Why FaberJS?

Node.js has great micro-libraries. What it lacks is a **framework** — something opinionated enough that you don't spend the first week of every project assembling the same stack.

FaberJS brings the mental model Laravel developers already have:

| Concern       | Laravel     | Node.js (before FaberJS)            | FaberJS                   |
| ------------- | ----------- | ----------------------------------- | ------------------------- |
| HTTP routing  | Built-in    | Pick from 20+ options               | Built-in                  |
| ORM           | Eloquent    | Wire Prisma, Drizzle, or Sequelize  | Built-in (Eloquent-style) |
| Queues        | Built-in    | Integrate BullMQ yourself           | Built-in                  |
| DI container  | Built-in    | InversifyJS + extensive boilerplate | Built-in                  |
| Cache + locks | Built-in    | Third-party (ioredis, node-cache)   | Built-in                  |
| Mail          | Built-in    | Configure Nodemailer yourself       | Built-in                  |
| CLI           | `artisan`   | Write your own                      | `faber` (built-in)        |
| AI agents     | Third-party | Third-party                         | Built-in                  |
| Conventions   | Enforced    | None                                | Enforced                  |

### What it feels like

```typescript
// routes/api.ts
Route.get('/users', [UserController, 'index']);
Route.post('/users', [UserController, 'store']);
Route.group({ prefix: '/admin', middleware: ['auth'] }, () => {
  Route.resource('posts', PostController);
});
```

```typescript
// app/controllers/UserController.ts
@Injectable()
export class UserController extends Controller {
  constructor(private readonly users: UserService) {
    super();
  }

  async index(_req: Request): Promise<Response> {
    return this.json(await this.users.all());
  }

  async store(req: Request): Promise<Response> {
    const user = await this.users.create(req.validated());
    await dispatch(new SendWelcomeEmail(user));
    await event(new UserRegistered(user));
    return this.json(user, 201);
  }
}
```

```typescript
// app/models/User.ts — Eloquent-style, schema-first
const users = await User.where('active', true).orderBy('created_at', 'desc').paginate(15);
```

---

## AI Agents — Native to the Framework

FaberJS is the only backend framework with AI agents built in as infrastructure — not a third-party addon.

```bash
npx faber make:agent SupportAgent
```

```typescript
// app/agents/SupportAgent.ts
@Injectable()
export class SupportAgent extends Agent {
  protected model = 'claude-3-5-sonnet-latest';
  protected systemPrompt = 'You are a helpful customer support agent.';

  @Tool({ description: 'Look up a user account by email' })
  async lookupUser(email: string) {
    return User.where('email', email).first();
  }

  @Tool({ description: 'Create a support ticket' })
  async createTicket(userId: number, issue: string) {
    return await dispatch(new CreateSupportTicket(userId, issue));
  }
}
```

Call it from any controller or job — the container wires it automatically.

---

## Who Is This For?

**Laravel developers moving to Node.js.** You already know the mental model — Route → Controller → Service → Model → Job/Event. FaberJS maps directly to it with zero translation.

**Node.js developers tired of assembly.** If you've bootstrapped Express + Prisma + BullMQ + Joi + custom DI one too many times, FaberJS gives you the whole stack with conventions.

**Teams building AI-powered applications.** `@faber-js/ai` gives you structured agents, tool decorators, conversation memory, and multi-agent orchestration as first-class framework citizens.

---

## Packages

All packages are published under the `@faber-js/` scope and versioned together.

| Package                                         | Description                                           | Version                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`@faber-js/core`](packages/core)               | IoC container, service providers, `@Injectable`       | [![npm](https://img.shields.io/npm/v/@faber-js/core)](https://www.npmjs.com/package/@faber-js/core)               |
| [`@faber-js/http`](packages/http)               | Request/Response, middleware pipeline, multipart      | [![npm](https://img.shields.io/npm/v/@faber-js/http)](https://www.npmjs.com/package/@faber-js/http)               |
| [`@faber-js/router`](packages/router)           | HTTP routing, route groups, signed URLs               | [![npm](https://img.shields.io/npm/v/@faber-js/router)](https://www.npmjs.com/package/@faber-js/router)           |
| [`@faber-js/orm`](packages/orm)                 | ActiveRecord ORM, migrations, relationships           | [![npm](https://img.shields.io/npm/v/@faber-js/orm)](https://www.npmjs.com/package/@faber-js/orm)                 |
| [`@faber-js/console`](packages/console)         | The `faber` CLI — `make:*`, `db:*`, `serve`, `tinker` | [![npm](https://img.shields.io/npm/v/@faber-js/console)](https://www.npmjs.com/package/@faber-js/console)         |
| [`@faber-js/queue`](packages/queue)             | Background jobs via BullMQ + `dispatch()` global      | [![npm](https://img.shields.io/npm/v/@faber-js/queue)](https://www.npmjs.com/package/@faber-js/queue)             |
| [`@faber-js/events`](packages/events)           | Event/listener bus with queued listener support       | [![npm](https://img.shields.io/npm/v/@faber-js/events)](https://www.npmjs.com/package/@faber-js/events)           |
| [`@faber-js/auth`](packages/auth)               | JWT guards, API tokens, policies, password reset      | [![npm](https://img.shields.io/npm/v/@faber-js/auth)](https://www.npmjs.com/package/@faber-js/auth)               |
| [`@faber-js/cache`](packages/cache)             | Redis/memory/DB cache, atomic locks, rate limiter     | [![npm](https://img.shields.io/npm/v/@faber-js/cache)](https://www.npmjs.com/package/@faber-js/cache)             |
| [`@faber-js/mail`](packages/mail)               | Mailable classes, SMTP, `Mail.fake()`                 | [![npm](https://img.shields.io/npm/v/@faber-js/mail)](https://www.npmjs.com/package/@faber-js/mail)               |
| [`@faber-js/crypt`](packages/crypt)             | `Hash.make/check`, `Crypt.encryptString`              | [![npm](https://img.shields.io/npm/v/@faber-js/crypt)](https://www.npmjs.com/package/@faber-js/crypt)             |
| [`@faber-js/http-client`](packages/http-client) | Fluent fetch client with retries and `Http.fake()`    | [![npm](https://img.shields.io/npm/v/@faber-js/http-client)](https://www.npmjs.com/package/@faber-js/http-client) |
| [`@faber-js/support`](packages/support)         | `Collection`, `Str`, `Arr`, `Pipeline`, `collect()`   | [![npm](https://img.shields.io/npm/v/@faber-js/support)](https://www.npmjs.com/package/@faber-js/support)         |
| [`@faber-js/validation`](packages/validation)   | Fluent rule engine, FormRequest, auto-422             | [![npm](https://img.shields.io/npm/v/@faber-js/validation)](https://www.npmjs.com/package/@faber-js/validation)   |
| [`@faber-js/config`](packages/config)           | Typed config from `.env` and config files             | [![npm](https://img.shields.io/npm/v/@faber-js/config)](https://www.npmjs.com/package/@faber-js/config)           |
| [`@faber-js/ai`](packages/ai)                   | AI agents, `@Tool` decorator, conversation memory     | [![npm](https://img.shields.io/npm/v/@faber-js/ai)](https://www.npmjs.com/package/@faber-js/ai)                   |
| [`@faber-js/channels`](packages/channels)       | Real-time WebSocket channels and presence             | [![npm](https://img.shields.io/npm/v/@faber-js/channels)](https://www.npmjs.com/package/@faber-js/channels)       |
| [`@faber-js/schema`](packages/schema)           | Schema-first model definitions with type inference    | [![npm](https://img.shields.io/npm/v/@faber-js/schema)](https://www.npmjs.com/package/@faber-js/schema)           |
| [`@faber-js/testing`](packages/testing)         | HTTP test client, `assertDatabaseHas`, `actingAs`     | [![npm](https://img.shields.io/npm/v/@faber-js/testing)](https://www.npmjs.com/package/@faber-js/testing)         |

---

## CLI

```bash
# Development
npx faber serve                      # start dev server
npx faber tinker                     # interactive REPL

# Code generation
npx faber make:controller <Name>
npx faber make:model <Name> [-m]     # -m also generates a migration
npx faber make:service <Name>
npx faber make:job <Name>
npx faber make:event <Name>
npx faber make:listener <Name>
npx faber make:middleware <Name>
npx faber make:migration <Name>
npx faber make:mail <Name>
npx faber make:agent <Name>          # AI agent

# Database
npx faber db:migrate
npx faber db:rollback
npx faber db:seed
npx faber db:status
npx faber route:list
```

---

## Development Setup

```bash
git clone https://github.com/echovick/faberjs.git
cd faberjs

pnpm install       # requires pnpm >= 9
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
