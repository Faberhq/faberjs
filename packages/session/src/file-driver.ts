import { readFile, writeFile, unlink, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SessionDriver } from './types';

export class FileSessionDriver implements SessionDriver {
  readonly #directory: string;

  constructor(directory?: string) {
    this.#directory = directory ?? join(tmpdir(), 'faber-sessions');
  }

  private filePath(id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return join(this.#directory, `sess_${safeId}.json`);
  }

  async read(id: string): Promise<Record<string, unknown>> {
    try {
      const raw = await readFile(this.filePath(id), 'utf8');
      const parsed = JSON.parse(raw) as { data: Record<string, unknown>; expiresAt: number };
      if (parsed.expiresAt <= Date.now()) {
        await this.destroy(id);
        return {};
      }
      return parsed.data;
    } catch {
      return {};
    }
  }

  async write(id: string, data: Record<string, unknown>, ttlSeconds: number): Promise<void> {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(this.#directory, { recursive: true });
    const payload = JSON.stringify({ data, expiresAt: Date.now() + ttlSeconds * 1000 });
    await writeFile(this.filePath(id), payload, 'utf8');
  }

  async destroy(id: string): Promise<void> {
    try {
      await unlink(this.filePath(id));
    } catch {
      // File may not exist — that's fine
    }
  }

  async gc(maxLifetimeSeconds: number): Promise<void> {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(this.#directory, { recursive: true });
    const cutoff = Date.now() - maxLifetimeSeconds * 1000;
    try {
      const files = await readdir(this.#directory);
      await Promise.all(
        files
          .filter((f) => f.startsWith('sess_') && f.endsWith('.json'))
          .map(async (file) => {
            const path = join(this.#directory, file);
            const info = await stat(path).catch(() => null);
            if (!info) return;
            if (info.mtimeMs <= cutoff) {
              await unlink(path).catch(() => undefined);
            }
          }),
      );
    } catch {
      // Directory may not exist yet
    }
  }
}
