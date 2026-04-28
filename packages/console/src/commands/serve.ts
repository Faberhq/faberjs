import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import pc from 'picocolors';
import { printServeBanner, log } from '../ui';

const READY_MARKER = '\x00__FABER_READY__';

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(start: number, max = 20): Promise<number> {
  for (let offset = 0; offset < max; offset++) {
    if (await isPortAvailable(start + offset)) return start + offset;
  }
  throw new Error(`No available port found in range ${start}–${start + max - 1}`);
}

export async function startServer(cwd: string, port = 3000, version?: string): Promise<void> {
  const entry = join(cwd, 'bootstrap', 'app.ts');
  const actualPort = await findAvailablePort(port);

  if (actualPort !== port) {
    process.stdout.write(`  ${pc.yellow(`Port ${port} in use — using ${actualPort} instead`)}\n`);
  }

  const startTime = Date.now();

  const child = spawn(
    'node',
    ['--require', 'ts-node/register', '--env-file', '.env', '--watch', entry],
    {
      cwd,
      stdio: ['inherit', 'pipe', 'inherit'],
      env: { ...process.env, PORT: String(actualPort), APP_PORT: String(actualPort) },
    },
  );

  let bannerPrinted = false;
  let buffer = '';

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const markerIdx = line.indexOf(READY_MARKER);
      if (!bannerPrinted && markerIdx !== -1) {
        bannerPrinted = true;
        try {
          const json = line.slice(markerIdx + READY_MARKER.length).trim();
          const { routes, providers } = JSON.parse(json) as {
            routes: number;
            providers: number;
          };
          printServeBanner(version, actualPort, routes, providers, Date.now() - startTime);
        } catch {
          printServeBanner(version, actualPort, 0, 0, Date.now() - startTime);
        }
      } else {
        const markerPos = line.indexOf(READY_MARKER);
        const clean = markerPos !== -1 ? line.slice(0, markerPos) : line;
        if (clean.trim()) process.stdout.write(clean + '\n');
      }
    }
  });

  child.on('error', (err) => {
    log.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });
}
