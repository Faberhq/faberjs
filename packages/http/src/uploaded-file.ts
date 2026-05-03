import { tmpdir } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { UploadedFile } from './types';

const STORAGE_NOT_AVAILABLE =
  '@faber-js/storage is not yet available (planned for v2.1). ' +
  'Use toBuffer() or path() to handle the upload in the meantime.';

export class UploadedFileImpl implements UploadedFile {
  readonly fieldname: string;
  readonly filename: string;
  readonly mimetype: string;
  readonly size: number;

  readonly #buffer: Buffer;
  readonly #ext: string;
  #tmpPath: string | undefined;

  constructor(opts: { fieldname: string; filename: string; mimetype: string; buffer: Buffer }) {
    this.fieldname = opts.fieldname;
    this.filename = opts.filename;
    this.mimetype = opts.mimetype;
    this.size = opts.buffer.length;
    this.#buffer = opts.buffer;
    const name = opts.filename;
    this.#ext = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '';
  }

  extension(): string {
    return this.#ext;
  }

  async toBuffer(): Promise<Buffer> {
    return this.#buffer;
  }

  isValid(): boolean {
    return this.size > 0;
  }

  async path(): Promise<string> {
    if (this.#tmpPath !== undefined) return this.#tmpPath;
    const token = randomBytes(8).toString('hex');
    const safeName = this.filename
      ? `faber_upload_${token}_${this.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      : `faber_upload_${token}`;
    const filePath = join(tmpdir(), safeName);
    await writeFile(filePath, this.#buffer);
    this.#tmpPath = filePath;
    return filePath;
  }

  async store(_directory: string, _disk?: string): Promise<string> {
    throw new Error(`UploadedFile.store(): ${STORAGE_NOT_AVAILABLE}`);
  }

  async storeAs(_directory: string, _name: string, _disk?: string): Promise<string> {
    throw new Error(`UploadedFile.storeAs(): ${STORAGE_NOT_AVAILABLE}`);
  }
}
