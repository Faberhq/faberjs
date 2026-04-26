# Contributing to FaberJS

Thank you for your interest in contributing to FaberJS. This document covers everything you need to know to contribute effectively.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Testing](#testing)
- [Security](#security)
- [Versioning & Changesets](#versioning--changesets)

---

## Code of Conduct

By participating in this project you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to the maintainers.

---

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0 (`node --version`)
- **pnpm** >= 9.0.0 (`npm install -g pnpm`)
- **Git**

### Setup

```bash
# 1. Fork the repo, then clone your fork
git clone https://github.com/YOUR_USERNAME/faberjs.git
cd faberjs

# 2. Install dependencies
pnpm install

# 3. Build all packages to verify your setup
pnpm build

# 4. Run the full test suite
pnpm test
```

If `pnpm build` and `pnpm test` both pass, your environment is ready.

---

## Project Structure

```
faberjs/
├── packages/              # All /* npm packages
│   ├── core/              # IoC container, service providers, facades
│   ├── router/            # HTTP routing engine
│   ├── orm/               # ActiveRecord ORM + migrations
│   ├── http/              # Request/Response, middleware pipeline
│   ├── console/           # faberjs CLI
│   ├── queue/             # BullMQ job queue
│   ├── events/            # Event/listener system
│   ├── auth/              # JWT auth + policies
│   ├── config/            # Config + env loading
│   ├── validation/        # Rule engine + FormRequest
│   ├── cache/             # Cache abstraction
│   └── testing/           # Test helpers
├── create-faberjs/        # npm create faberjs@latest scaffolder
├── stubs/                 # Code generation templates
└── examples/              # Example applications
```

Each package follows this structure:

```
packages/example/
├── src/
│   ├── index.ts           # Public API barrel — only export what's public
│   ├── feature.ts         # Implementation
│   └── feature.test.ts    # Co-located tests
├── package.json
├── tsconfig.json          # Extends ../../tsconfig.base.json
└── tsup.config.ts
```

---

## Development Workflow

### Branching

Branch from `main` and use the following naming conventions:

| Type          | Pattern                          | Example                        |
| ------------- | -------------------------------- | ------------------------------ |
| Feature       | `feat/<scope>/<description>`     | `feat/core/ioc-container`      |
| Bug fix       | `fix/<scope>/<description>`      | `fix/orm/soft-delete-restore`  |
| Documentation | `docs/<description>`             | `docs/contributing-guide`      |
| Refactor      | `refactor/<scope>/<description>` | `refactor/router/route-groups` |
| Test          | `test/<scope>/<description>`     | `test/validation/unique-rule`  |
| CI/Tooling    | `chore/<description>`            | `chore/update-typescript`      |

### Working on a Package

```bash
# Build a single package in watch mode
pnpm --filter /core dev

# Run tests for a single package
pnpm --filter /core test

# Run tests in watch mode
pnpm --filter /core test -- --watch

# Type-check a single package
pnpm --filter /core type-check
```

### Useful Commands

```bash
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm type-check       # TypeScript check across all packages
pnpm lint             # ESLint all packages
pnpm lint:fix         # ESLint with auto-fix
pnpm format           # Prettier format
pnpm format:check     # Prettier check (no writes)
pnpm clean            # Delete all dist/ directories
```

---

## Coding Standards

### TypeScript

- **No `any` types** — use `unknown` and narrow, or proper generics
- **Explicit return types** on all public functions and methods
- **Strict null checks** — handle `null` and `undefined` explicitly
- **`import type`** for type-only imports
- **`readonly`** on properties that are set once at construction

```typescript
// Bad
function resolve(key: any): any {
  return this.bindings[key];
}

// Good
function resolve<T>(key: string | Constructable<T>): T {
  const binding = this.bindings.get(key);
  if (!binding) throw new ContainerException(`No binding for ${String(key)}`);
  return binding() as T;
}
```

### Architecture

- Every service registers via a `ServiceProvider` — never bind directly in application code
- `register()` only binds — no side effects. Side effects go in `boot()`
- Never directly instantiate services that have dependencies — resolve them from the container
- Keep implementation details out of public type exports

### API Design (Laravel Parity)

FaberJS APIs must feel immediately familiar to Laravel developers:

- Method names: `find`, `where`, `with`, `paginate`, `create`, `update`, `delete` — not `findById`, `filter`, `include`
- Chainable methods return `this` (the concrete type, not `any`)
- Async terminal methods return `Promise<T>`
- Static methods on facades: `DB.table('users')`, not `new DB().table('users')`

### Security

- Validate all inputs at system boundaries (HTTP, external APIs, config)
- Never interpolate user data into raw SQL — use parameterized queries
- Never expose stack traces or internal errors to HTTP clients
- Sensitive config values always come from environment variables

See [SECURITY.md](SECURITY.md) for the full security policy.

---

## Commit Messages

FaberJS uses [Conventional Commits](https://www.conventionalcommits.org/). This is enforced by commitlint on every commit.

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes:** Use the package name: `core`, `router`, `orm`, `http`, `console`, `queue`, `events`, `auth`, `config`, `validation`, `cache`, `testing`, `create-faberjs`

**Subject rules:**

- Imperative mood: "add feature" not "adds feature" or "added feature"
- Lowercase first letter
- No period at the end
- Max 72 characters

**Examples:**

```bash
feat(core): implement IoC container with singleton and transient bindings
fix(orm): prevent mass assignment on non-fillable attributes
test(validation): add coverage for unique rule with ignore option
docs(contributing): add branching naming conventions
chore: upgrade typescript to 5.5
```

**Breaking changes:**

```bash
feat(orm)!: change Model.find() to throw ModelNotFoundException instead of returning null

BREAKING CHANGE: Model.find() now throws ModelNotFoundException when the record
is not found. Use Model.findOrNull() for the previous nullable behavior.
```

---

## Pull Requests

### Before opening a PR

- [ ] `pnpm build` passes with zero errors
- [ ] `pnpm test` passes (all tests green)
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes
- [ ] You have added or updated tests for your changes
- [ ] You have added a changeset (see below)
- [ ] For new public APIs: JSDoc on each exported symbol
- [ ] For breaking changes: documented in the changeset body

### PR Scope

Keep PRs focused. A PR should do one thing. Separate refactoring from features; separate bug fixes from new functionality. Reviewers appreciate small, reviewable diffs.

### Review Process

1. Open a PR against `main`
2. CI must pass before review
3. At least one maintainer approval required to merge
4. Squash and merge is preferred for feature PRs; rebase is fine for clean commit histories

---

## Testing

### Writing Tests

Tests live co-located with the source: `packages/core/src/container.test.ts` tests `packages/core/src/container.ts`.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from './container';

describe('Container', () => {
  describe('make()', () => {
    it('resolves a registered singleton on every call', () => {
      // Arrange
      const container = new Container();
      container.singleton('db', () => ({ connected: true }));

      // Act
      const first = container.make('db');
      const second = container.make('db');

      // Assert
      expect(first).toBe(second); // same instance
    });

    it('throws ContainerException when binding is not registered', () => {
      // Arrange
      const container = new Container();

      // Act & Assert
      expect(() => container.make('unknown')).toThrow(ContainerException);
    });
  });
});
```

### Running Tests

```bash
pnpm test                                    # all packages
pnpm --filter /core test             # single package
pnpm --filter /core test -- --watch  # watch mode
pnpm test:coverage                           # with coverage report
```

### Coverage Requirements

Every phase's acceptance criteria must have corresponding tests. For Phase 2+ packages, aim for > 90% coverage on the public API surface.

---

## Security

**Do not open public issues for security vulnerabilities.**

Report security issues privately via [GitHub Security Advisories](https://github.com/YOUR_ORG/faberjs/security/advisories/new) or email the maintainers directly.

See [SECURITY.md](SECURITY.md) for the full disclosure process.

---

## Versioning & Changesets

FaberJS uses [Changesets](https://github.com/changesets/changesets) for versioning.

### Adding a changeset

Every PR that changes public behavior should include a changeset:

```bash
pnpm changeset
```

This opens an interactive prompt asking you to:

1. Select which packages are affected
2. Choose the bump type (major / minor / patch)
3. Write a summary of the change (this appears in the CHANGELOG)

Commit the generated `.changeset/*.md` file with your PR.

### When NOT to add a changeset

- Documentation-only changes
- CI/tooling changes that don't affect package output
- Changes to test files only
- Dependency updates with no behavior change

### Release process (maintainers only)

```bash
# Create version PRs
pnpm version-packages

# After merging version PR, publish to npm
pnpm release
```
