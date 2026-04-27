import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scaffoldProject } from './scaffold';
import type { ScaffoldOptions } from './scaffold';

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(os.tmpdir(), `create-faberjs-test-${Date.now().toString()}`);
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeOpts(overrides: Partial<ScaffoldOptions> = {}): ScaffoldOptions {
  return {
    projectName: 'test-app',
    targetDir: tempDir,
    dbDriver: 'sqlite',
    includeAuth: false,
    ...overrides,
  };
}

async function readJson(file: string): Promise<unknown> {
  const content = await readFile(path.join(tempDir, file), 'utf8');
  return JSON.parse(content) as unknown;
}

async function readText(file: string): Promise<string> {
  return readFile(path.join(tempDir, file), 'utf8');
}

describe('scaffoldProject()', () => {
  it('returns a list of written file paths', async () => {
    const written = await scaffoldProject(makeOpts());
    expect(written.length).toBeGreaterThan(0);
    expect(written).toContain('package.json');
    expect(written).toContain('tsconfig.json');
  });

  it('creates a valid package.json with the project name', async () => {
    await scaffoldProject(makeOpts({ projectName: 'my-blog' }));
    const pkg = (await readJson('package.json')) as {
      name: string;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBe('my-blog');
    expect(pkg.scripts).toHaveProperty('dev');
  });

  it('creates a tsconfig.json with experimentalDecorators enabled', async () => {
    await scaffoldProject(makeOpts());
    const tsconfig = (await readJson('tsconfig.json')) as {
      compilerOptions: { experimentalDecorators: boolean; emitDecoratorMetadata: boolean };
    };
    expect(tsconfig.compilerOptions.experimentalDecorators).toBe(true);
    expect(tsconfig.compilerOptions.emitDecoratorMetadata).toBe(true);
  });

  it('creates a .env file with DB_CONNECTION for sqlite', async () => {
    await scaffoldProject(makeOpts({ dbDriver: 'sqlite' }));
    const env = await readText('.env');
    expect(env).toContain('DB_CONNECTION=better-sqlite3');
  });

  it('creates a .env file with DB_CONNECTION for postgres', async () => {
    await scaffoldProject(makeOpts({ dbDriver: 'postgres' }));
    const env = await readText('.env');
    expect(env).toContain('DB_CONNECTION=pg');
  });

  it('creates bootstrap/app.ts', async () => {
    await scaffoldProject(makeOpts());
    const bootstrap = await readText('bootstrap/app.ts');
    expect(bootstrap).toContain('Application');
    expect(bootstrap).toContain('kernel.listen');
  });

  it('creates routes/api.ts with route definitions', async () => {
    await scaffoldProject(makeOpts());
    const routes = await readText('routes/api.ts');
    expect(routes).toContain('Route.group');
    expect(routes).toContain('UserController');
  });

  it('creates the User model', async () => {
    await scaffoldProject(makeOpts());
    const model = await readText('app/models/User.ts');
    expect(model).toContain('extends Model');
    expect(model).toContain("static table = 'users'");
  });

  it('creates a migration for the users table', async () => {
    await scaffoldProject(makeOpts());
    const migration = await readText('database/migrations/0001_create_users_table.ts');
    expect(migration).toContain('CreateUsersTable');
    expect(migration).toContain("Schema.create('users'");
  });

  it('includes auth import in bootstrap/app.ts when includeAuth is true', async () => {
    await scaffoldProject(makeOpts({ includeAuth: true }));
    const bootstrap = await readText('bootstrap/app.ts');
    expect(bootstrap).toContain('AuthServiceProvider');
  });

  it('omits auth import in bootstrap/app.ts when includeAuth is false', async () => {
    await scaffoldProject(makeOpts({ includeAuth: false }));
    const bootstrap = await readText('bootstrap/app.ts');
    expect(bootstrap).not.toContain('AuthServiceProvider');
  });

  it('creates a .gitignore that excludes node_modules and .env', async () => {
    await scaffoldProject(makeOpts());
    const gitignore = await readText('.gitignore');
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('.env');
  });
});
