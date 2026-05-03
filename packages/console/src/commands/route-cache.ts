import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve as resolvePath } from 'node:path';
import pc from 'picocolors';
import { log } from '../ui';

const CACHE_FILE = 'bootstrap/cache/routes.json';

interface CachedRoute {
  method: string;
  path: string;
  name?: string | null;
  middleware: string[];
  constraints: Record<string, string>;
  domain?: string | null;
  resourceName?: string | null;
  resourceAction?: string | null;
}

function loadRoutesFromApp(cwd: string): Promise<CachedRoute[]> {
  const script = `
    const { Application } = require('@faber-js/core');
    const { RouterServiceProvider } = require('@faber-js/router');
    const path = require('node:path');
    const fs = require('node:fs');

    const app = new Application();
    app.register(new RouterServiceProvider(app));

    const routesDir = path.join(process.cwd(), 'routes');
    if (!fs.existsSync(routesDir)) {
      process.stdout.write(JSON.stringify([]));
      process.exit(0);
    }

    const files = fs.readdirSync(routesDir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'));

    for (const file of files) {
      require(path.join(routesDir, file));
    }

    const router = app.make('router');
    const rows = router.getRoutes().map(r => ({
      method: r.method,
      path: r.path,
      name: r.name ?? null,
      middleware: r.middleware ?? [],
      constraints: r.constraints ?? {},
      domain: r.domain ?? null,
      resourceName: r.resourceName ?? null,
      resourceAction: r.resourceAction ?? null,
    }));

    process.stdout.write(JSON.stringify(rows));
  `;

  const tsNodeRegister = resolvePath(cwd, 'node_modules', 'ts-node', 'register');

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('node', ['--require', tsNodeRegister, '-e', script], {
      cwd,
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
    });
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as CachedRoute[]);
      } catch {
        reject(new Error(`Failed to parse route output:\n${stdout}`));
      }
    });
    child.on('error', reject);
  });
}

export async function cacheRoutes(cwd: string): Promise<void> {
  try {
    const routes = await loadRoutesFromApp(cwd);
    const cacheDir = join(cwd, 'bootstrap', 'cache');
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

    const cachePath = join(cwd, CACHE_FILE);
    writeFileSync(
      cachePath,
      JSON.stringify({ cachedAt: new Date().toISOString(), routes }, null, 2),
    );

    process.stdout.write(
      `  ${pc.green('✓')} Route cache written: ${pc.dim(CACHE_FILE)} ${pc.dim(`(${routes.length} routes)`)}\n`,
    );
  } catch (e) {
    log.error(`Could not cache routes: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function clearRouteCache(cwd: string): void {
  const cachePath = join(cwd, CACHE_FILE);
  if (!existsSync(cachePath)) {
    process.stdout.write(`  ${pc.dim('Route cache file does not exist.')}\n`);
    return;
  }
  unlinkSync(cachePath);
  process.stdout.write(`  ${pc.green('✓')} Route cache cleared.\n`);
}
