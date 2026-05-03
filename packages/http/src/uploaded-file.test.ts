import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { UploadedFileImpl } from './uploaded-file';

function makeFile(
  content = 'hello world',
  filename = 'test.txt',
  mimetype = 'text/plain',
): UploadedFileImpl {
  return new UploadedFileImpl({
    fieldname: 'file',
    filename,
    mimetype,
    buffer: Buffer.from(content),
  });
}

describe('UploadedFileImpl', () => {
  describe('basic properties', () => {
    it('exposes fieldname, filename, mimetype and size', () => {
      const f = makeFile('hello', 'photo.jpg', 'image/jpeg');
      expect(f.fieldname).toBe('file');
      expect(f.filename).toBe('photo.jpg');
      expect(f.mimetype).toBe('image/jpeg');
      expect(f.size).toBe(5);
    });

    it('size reflects actual buffer byte length', () => {
      const f = makeFile('abc');
      expect(f.size).toBe(3);
    });
  });

  describe('extension()', () => {
    it('extracts extension from filename', () => {
      expect(makeFile('data', 'report.pdf').extension()).toBe('pdf');
    });

    it('lowercases the extension', () => {
      expect(makeFile('data', 'IMAGE.PNG').extension()).toBe('png');
    });

    it('handles filenames with multiple dots', () => {
      expect(makeFile('data', 'archive.tar.gz').extension()).toBe('gz');
    });

    it('returns empty string for filename without extension', () => {
      expect(makeFile('data', 'Makefile').extension()).toBe('');
    });

    it('returns empty string when filename is empty', () => {
      expect(makeFile('data', '').extension()).toBe('');
    });
  });

  describe('toBuffer()', () => {
    it('returns the original buffer content', async () => {
      const f = makeFile('hello world');
      const buf = await f.toBuffer();
      expect(buf.toString()).toBe('hello world');
    });
  });

  describe('isValid()', () => {
    it('returns true for a non-empty file', () => {
      expect(makeFile('some content').isValid()).toBe(true);
    });

    it('returns false for an empty (zero-byte) file', () => {
      const f = new UploadedFileImpl({
        fieldname: 'file',
        filename: 'empty.txt',
        mimetype: 'text/plain',
        buffer: Buffer.alloc(0),
      });
      expect(f.isValid()).toBe(false);
    });
  });

  describe('path()', () => {
    it('writes the file to a temp directory and returns the path', async () => {
      const f = makeFile('content for disk', 'disk-test.txt');
      const p = await f.path();
      expect(typeof p).toBe('string');
      expect(existsSync(p)).toBe(true);
      const written = await readFile(p);
      expect(written.toString()).toBe('content for disk');
    });

    it('includes a sanitised filename in the temp path', async () => {
      const f = makeFile('x', 'my file.txt');
      const p = await f.path();
      expect(p).toMatch(/my_file\.txt$/);
    });

    it('returns the same path on subsequent calls (cached)', async () => {
      const f = makeFile('cached');
      const first = await f.path();
      const second = await f.path();
      expect(first).toBe(second);
    });

    it('produces unique paths for distinct UploadedFile instances', async () => {
      const a = makeFile('a', 'same.txt');
      const b = makeFile('b', 'same.txt');
      const [pa, pb] = await Promise.all([a.path(), b.path()]);
      expect(pa).not.toBe(pb);
    });
  });

  describe('store() and storeAs()', () => {
    it('store() throws with a helpful message about @faber-js/storage', async () => {
      const f = makeFile();
      await expect(f.store('images')).rejects.toThrow('@faber-js/storage');
    });

    it('storeAs() throws with a helpful message about @faber-js/storage', async () => {
      const f = makeFile();
      await expect(f.storeAs('images', 'photo.jpg')).rejects.toThrow('@faber-js/storage');
    });

    it('store() error mentions v2.1', async () => {
      await expect(makeFile().store('images')).rejects.toThrow('v2.1');
    });
  });
});
