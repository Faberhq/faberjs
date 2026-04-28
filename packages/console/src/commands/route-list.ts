import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { log } from '../ui';

const METHOD_COLORS: Record<string, (s: string) => string> = {
  GET: pc.green,
  POST: pc.cyan,
  PUT: pc.yellow,
  PATCH: pc.yellow,
  DELETE: pc.red,
  HEAD: pc.dim,
  OPTIONS: pc.dim,
};

function colorMethod(method: string): string {
  const color = METHOD_COLORS[method.toUpperCase()] ?? pc.white;
  return color(method.toUpperCase().padEnd(8));
}

interface RouteRow {
  method: string;
  path: string;
  name?: string;
  middleware: string[];
}

// Spawns a child node process with ts-node registered so it can import the
// user's TypeScript route files in their own module context, then serialises
// the discovered routes as JSON for us to display.
function loadRoutesFromApp(cwd: string): Promise<RouteRow[]> {
  const script = `
    require('ts-node').register({ transpileOnly: true });
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
    }));

    process.stdout.write(JSON.stringify(rows));
  `;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('node', ['-e', script], {
      cwd,
      env: { ...process.env },
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
        resolve(JSON.parse(stdout) as RouteRow[]);
      } catch {
        reject(new Error(`Failed to parse route output:\n${stdout}`));
      }
    });
    child.on('error', reject);
  });
}

export async function listRoutes(cwd: string): Promise<void> {
  const routesDir = join(cwd, 'routes');
  if (!existsSync(routesDir)) {
    process.stdout.write(`  ${pc.dim('No routes directory found.')}\n`);
    return;
  }

  try {
    const routes = await loadRoutesFromApp(cwd);

    if (routes.length === 0) {
      process.stdout.write(`  ${pc.dim('No routes registered.')}\n`);
      return;
    }

    const COL_PATH = 36;
    const COL_MW = 24;
    const COL_NAME = 20;
    const header =
      `  ${pc.bold(pc.dim('Method'.padEnd(8)))}  ` +
      `${pc.bold(pc.dim('Path'.padEnd(COL_PATH)))}  ` +
      `${pc.bold(pc.dim('Middleware'.padEnd(COL_MW)))}  ` +
      `${pc.bold(pc.dim('Name'.padEnd(COL_NAME)))}`;
    const divider =
      `  ${pc.dim('─'.repeat(8))}  ` +
      `${pc.dim('─'.repeat(COL_PATH))}  ` +
      `${pc.dim('─'.repeat(COL_MW))}  ` +
      `${pc.dim('─'.repeat(COL_NAME))}`;

    process.stdout.write('\n');
    process.stdout.write(header + '\n');
    process.stdout.write(divider + '\n');
    for (const r of routes) {
      const method = colorMethod(r.method);
      const path = pc.white(r.path.padEnd(COL_PATH));
      const mw = pc.dim(r.middleware.join(', ').padEnd(COL_MW));
      const name = pc.dim((r.name ?? '').padEnd(COL_NAME));
      process.stdout.write(`  ${method}  ${path}  ${mw}  ${name}\n`);
    }
    process.stdout.write('\n');
  } catch (e) {
    log.error(`Could not load routes: ${e instanceof Error ? e.message : String(e)}`);
  }
}
