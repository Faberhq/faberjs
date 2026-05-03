import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { transformSync } from 'esbuild';
import { log } from '../ui';

function collectViewFiles(dir: string, base: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectViewFiles(full, base));
    } else if (entry.name.endsWith('.view.tsx') || entry.name.endsWith('.view.ts')) {
      results.push(full);
    }
  }
  return results;
}

export async function cacheViews(cwd: string): Promise<void> {
  const viewsDir = join(cwd, 'resources', 'views');
  const cacheDir = join(cwd, 'storage', 'framework', 'views');

  const files = collectViewFiles(viewsDir, viewsDir);
  if (files.length === 0) {
    log.info('No view files found in resources/views.');
    return;
  }

  let compiled = 0;
  let skipped = 0;

  for (const filePath of files) {
    const rel = relative(viewsDir, filePath);
    const cacheFile = join(cacheDir, `${rel}.js`);

    // Skip if cache is already newer than source
    if (existsSync(cacheFile)) {
      const sourceMtime = statSync(filePath).mtimeMs;
      const cacheMtime = statSync(cacheFile).mtimeMs;
      if (cacheMtime > sourceMtime) {
        skipped++;
        continue;
      }
    }

    const source = readFileSync(filePath, 'utf8');
    const { code } = transformSync(source, {
      loader: filePath.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'cjs',
      jsx: 'automatic',
      jsxImportSource: '@faber-js/view',
      target: 'node16',
    });

    const outDir = dirname(cacheFile);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(cacheFile, code, 'utf8');
    log.created(cacheFile);
    compiled++;
  }

  process.stdout.write(`\nView cache: ${compiled} compiled, ${skipped} already up-to-date.\n`);
}

export function clearViewCache(cwd: string): void {
  const cacheDir = join(cwd, 'storage', 'framework', 'views');
  if (!existsSync(cacheDir)) {
    process.stdout.write('View cache directory does not exist — nothing to clear.\n');
    return;
  }
  rmSync(cacheDir, { recursive: true });
  process.stdout.write('View cache cleared.\n');
}
