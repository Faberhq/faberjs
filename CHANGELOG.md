# Changelog

All notable changes to FaberJS packages will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
FaberJS adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Releases are managed with [Changesets](https://github.com/changesets/changesets).

---

## [Unreleased]

### Added

- Monorepo scaffold: pnpm workspaces, tsup build, vitest test runner, changesets versioning
- Package stubs for all 12 `/*` packages and `create-faberjs`
- Root `tsconfig.base.json` with TypeScript 5.x strict mode, decorators, and `reflect-metadata`
- Unified vitest configuration across all packages
- ESLint flat config with TypeScript strict rules
- Prettier formatting
- Husky + lint-staged pre-commit hooks
- Commitlint with Conventional Commits enforcement
- GitHub Actions CI (build, type-check, test, lint, security audit)
- GitHub Actions release workflow via Changesets
- GitHub issue templates (bug report, feature request)
- Contributing guide, security policy, and code of conduct

### Changed

### Deprecated

### Removed

### Fixed

### Security

---

<!-- Releases will be automatically added above this line by `pnpm version-packages` -->
