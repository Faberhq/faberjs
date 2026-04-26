# Security Policy

## Supported Versions

FaberJS is currently in active pre-release development. Only the latest commit on the `main` branch is supported.

| Version            | Supported            |
| ------------------ | -------------------- |
| `main` (latest)    | ✅ Yes               |
| Any tagged release | ✅ Yes (latest only) |
| Older releases     | ❌ No                |

Once v1.0.0 ships, a formal support window will be established.

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Security issues should be disclosed privately to give maintainers time to produce a fix before details become public. Use one of the following channels:

1. **GitHub Private Security Advisory** (preferred):  
   [Report a vulnerability](https://github.com/YOUR_ORG/faberjs/security/advisories/new)

2. **Email**: security@faberjs.dev  
   Encrypt sensitive reports using the PGP key published on our security page.

### What to include

- Description of the vulnerability and its potential impact
- Steps to reproduce (include code if possible)
- Affected package(s) and version(s)
- Any suggested mitigations you have identified

### Response timeline

| Stage                   | Target                                     |
| ----------------------- | ------------------------------------------ |
| Acknowledgement         | Within 48 hours                            |
| Initial assessment      | Within 5 business days                     |
| Fix for critical issues | Within 7 days                              |
| Fix for high issues     | Within 14 days                             |
| Fix for medium/low      | Next planned release                       |
| Public disclosure       | After fix is released + 7-day grace period |

We will credit reporters in the security advisory unless you request anonymity.

---

## Security Standards

FaberJS is designed and implemented with security as a first-class concern.

### Input Validation

- All HTTP request data must pass through `/validation` before use
- No raw user data is ever interpolated into SQL queries — parameterized queries via Knex only
- File paths from user input are resolved and sandboxed to allowed directories

### Authentication & Tokens

- Passwords are hashed with bcrypt (minimum cost factor 12) — never stored in plaintext
- JWTs are signed with HS256 or RS256 — the `none` algorithm is explicitly rejected
- Token comparison uses timing-safe equality functions to prevent timing attacks
- JWT secrets are loaded from environment variables, never hardcoded

### Authorization

- Authorization policies default to **deny** — access is granted only when all conditions are explicitly met
- Route-level auth middleware validates tokens on every request
- Policy checks use `/auth`'s `Gate` — never roll your own permission checks

### Error Handling & Information Disclosure

- Stack traces are never serialized into HTTP responses
- Internal error messages are logged server-side only — clients receive safe, typed error responses
- `Model.hidden` is enforced before serialization to prevent accidental field exposure

### Secrets & Configuration

- All sensitive configuration uses environment variables via `/config`'s `env()` helper
- `.env` files are in `.gitignore` — `.env.example` serves as the template with no real values
- Dependencies are audited with `pnpm audit` on every CI run

### Dependencies

- Production dependencies are kept minimal and regularly audited
- Dependencies with known critical or high vulnerabilities block CI
- Supply chain: lockfile (`pnpm-lock.yaml`) is committed and `--frozen-lockfile` is enforced in CI

---

## Scope

The following are considered security vulnerabilities:

- SQL injection or NoSQL injection in ORM or query builder
- Authentication bypass in the `/auth` guard
- JWT algorithm confusion or validation bypass
- Authorization policy bypass
- Sensitive data exposure in HTTP responses or logs
- Remote code execution via any public API
- Prototype pollution in the IoC container or config system
- Path traversal in any file-handling code
- Denial of service via uncontrolled resource consumption in core packages

The following are **not** in scope:

- Security issues in user application code built with FaberJS
- Vulnerabilities requiring physical access to a server
- Social engineering attacks
- Issues in development-only dependencies
