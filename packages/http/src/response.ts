import { extname } from 'node:path';
import { serializeCookieHeader } from './cookie';
import type { CookieOptions } from './cookie';

// ── MIME type table ────────────────────────────────────────────────────────

const MIME_TYPES: Readonly<Record<string, string>> = {
  aac: 'audio/aac',
  avif: 'image/avif',
  css: 'text/css; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  gif: 'image/gif',
  gz: 'application/gzip',
  htm: 'text/html; charset=utf-8',
  html: 'text/html; charset=utf-8',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  tar: 'application/x-tar',
  txt: 'text/plain; charset=utf-8',
  wasm: 'application/wasm',
  webm: 'video/webm',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  xml: 'application/xml',
  zip: 'application/zip',
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).replace('.', '').toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

// ── StreamedEvent ──────────────────────────────────────────────────────────

export interface StreamedEventOptions {
  readonly event?: string;
  readonly data: unknown;
  readonly id?: string;
  readonly retry?: number;
}

/** Represents a single Server-Sent Event with optional name, id, and retry. */
export class StreamedEvent {
  readonly event: string | undefined;
  readonly data: unknown;
  readonly id: string | undefined;
  readonly retry: number | undefined;

  constructor(options: StreamedEventOptions) {
    this.event = options.event;
    this.data = options.data;
    this.id = options.id;
    this.retry = options.retry;
  }

  /** Serialises to the SSE wire format. */
  format(): string {
    const lines: string[] = [];
    if (this.event !== undefined) lines.push(`event: ${this.event}`);
    if (this.id !== undefined) lines.push(`id: ${this.id}`);
    if (this.retry !== undefined) lines.push(`retry: ${this.retry}`);
    const payload = typeof this.data === 'string' ? this.data : JSON.stringify(this.data);
    lines.push(`data: ${payload}`);
    return lines.join('\n') + '\n\n';
  }
}

// ── Async file stream helper ───────────────────────────────────────────────

async function* fileStream(filePath: string): AsyncGenerator<Buffer> {
  const { createReadStream } = await import('node:fs');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    yield chunk as Buffer;
  }
}

// ── Streaming JSON encoder ─────────────────────────────────────────────────

async function* encodeStreamJson(data: Record<string, unknown>): AsyncGenerator<string> {
  yield '{';
  const keys = Object.keys(data);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i] as string;
    const value = data[key];
    yield `"${key}":`;
    if (value !== null && typeof value === 'object' && Symbol.asyncIterator in (value as object)) {
      yield '[';
      let first = true;
      for await (const item of value as AsyncIterable<unknown>) {
        if (!first) yield ',';
        yield JSON.stringify(item);
        first = false;
      }
      yield ']';
    } else {
      yield JSON.stringify(value);
    }
    if (i < keys.length - 1) yield ',';
  }
  yield '}';
}

// ── Macro registry ─────────────────────────────────────────────────────────

const macroRegistry = new Map<string, (...args: unknown[]) => Response>();

// ── Response ───────────────────────────────────────────────────────────────

interface ResponseData {
  readonly body: unknown;
  readonly status: number;
  readonly headers: Record<string, string | string[]>;
}

export class Response {
  readonly #body: unknown;
  readonly #status: number;
  readonly #headers: Record<string, string | string[]>;

  private constructor(data: ResponseData) {
    this.#body = data.body;
    this.#status = data.status;
    this.#headers = { ...data.headers };
  }

  // ── Static factories ──────────────────────────────────────────────────

  static json(
    data: unknown,
    status = 200,
    extraHeaders: Record<string, string | string[]> = {},
  ): Response {
    return new Response({
      body: data,
      status,
      headers: { 'content-type': 'application/json', ...extraHeaders },
    });
  }

  static html(content: string, status = 200): Response {
    return new Response({
      body: content,
      status,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  static noContent(): Response {
    return new Response({ body: null, status: 204, headers: {} });
  }

  static notFound(message = 'Not Found', body?: Record<string, unknown>): Response {
    return Response.json(body ?? { message }, 404);
  }

  static error(message: string, status = 500, body?: Record<string, unknown>): Response {
    return Response.json(body ?? { message }, status);
  }

  static redirect(url: string, status = 302): Response {
    return new Response({ body: null, status, headers: { location: url } });
  }

  static stream(
    source: AsyncIterable<string>,
    status = 200,
    extraHeaders: Record<string, string> = {},
  ): Response {
    return new Response({
      body: source,
      status,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-accel-buffering': 'no',
        ...extraHeaders,
      },
    });
  }

  /**
   * Server-Sent Events response. Each string chunk is emitted as a raw
   * `data: <chunk>\n\n` line. Pass a StreamedEvent to emit named events.
   */
  static sse(source: AsyncIterable<string | StreamedEvent>, status = 200): Response {
    async function* toSseEvents(): AsyncGenerator<string> {
      for await (const chunk of source) {
        if (chunk instanceof StreamedEvent) {
          yield chunk.format();
        } else {
          yield `data: ${chunk}\n\n`;
        }
      }
    }
    return new Response({
      body: toSseEvents(),
      status,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    });
  }

  /**
   * Streams a file to the client as a download attachment.
   * MIME type is inferred from the file extension.
   */
  static fileDownload(
    filePath: string,
    filename?: string,
    extraHeaders: Record<string, string> = {},
  ): Response {
    const name = filename ?? filePath.split('/').pop() ?? 'download';
    const sanitized = name.replace(/[^\w.-]/g, '_');
    return new Response({
      body: fileStream(filePath),
      status: 200,
      headers: {
        'content-type': getMimeType(filePath),
        'content-disposition': `attachment; filename="${sanitized}"`,
        'x-accel-buffering': 'no',
        ...extraHeaders,
      },
    });
  }

  /**
   * Serves a file inline in the browser.
   * MIME type is inferred from the file extension.
   */
  static fileInline(filePath: string, extraHeaders: Record<string, string> = {}): Response {
    return new Response({
      body: fileStream(filePath),
      status: 200,
      headers: {
        'content-type': getMimeType(filePath),
        'content-disposition': 'inline',
        'x-accel-buffering': 'no',
        ...extraHeaders,
      },
    });
  }

  /**
   * Streams generated content to the client as a named download attachment.
   * Nothing is written to disk.
   */
  static streamDownload(
    source: AsyncIterable<string> | (() => AsyncIterable<string>),
    filename: string,
    extraHeaders: Record<string, string> = {},
  ): Response {
    const sanitized = filename.replace(/[^\w.-]/g, '_');
    const iterable = typeof source === 'function' ? source() : source;
    return new Response({
      body: iterable,
      status: 200,
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${sanitized}"`,
        'x-accel-buffering': 'no',
        ...extraHeaders,
      },
    });
  }

  /**
   * Streams a JSON-serialised object to the client. Values that are
   * AsyncIterables (e.g. database cursors) are streamed as JSON arrays.
   */
  static streamJson(data: Record<string, unknown>, status = 200): Response {
    return new Response({
      body: encodeStreamJson(data),
      status,
      headers: {
        'content-type': 'application/json',
        'x-accel-buffering': 'no',
      },
    });
  }

  /**
   * Server-Sent Events response using the standard `text/event-stream` protocol.
   * Automatically appends a `data: </stream>\n\n` terminator when the source
   * is exhausted, unless a custom endStreamWith event is provided.
   */
  static eventStream(
    source: AsyncIterable<string | StreamedEvent>,
    options: { endStreamWith?: StreamedEvent } = {},
  ): Response {
    const endEvent =
      options.endStreamWith ?? new StreamedEvent({ event: 'update', data: '</stream>' });

    async function* toEvents(): AsyncGenerator<string> {
      for await (const chunk of source) {
        if (chunk instanceof StreamedEvent) {
          yield chunk.format();
        } else {
          yield `data: ${chunk}\n\n`;
        }
      }
      yield endEvent.format();
    }

    return new Response({
      body: toEvents(),
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    });
  }

  /**
   * Register a custom response type available on ResponseFactory.
   * Call from a service provider's boot() method.
   *
   * @example
   * Response.macro('caps', (value: string) => Response.html(value.toUpperCase()));
   * // Then: response().caps('hello') → HTML response with 'HELLO'
   */
  static macro(name: string, fn: (...args: unknown[]) => Response): void {
    macroRegistry.set(name, fn);
    (ResponseFactory.prototype as unknown as Record<string, unknown>)[name] = fn;
  }

  // ── Instance methods ──────────────────────────────────────────────────

  getStatus(): number {
    return this.#status;
  }

  getBody(): unknown {
    return this.#body;
  }

  getHeaders(): Readonly<Record<string, string | string[]>> {
    return this.#headers;
  }

  /** Return a new Response with one header added or replaced. */
  withHeader(key: string, value: string): Response {
    return new Response({
      body: this.#body,
      status: this.#status,
      headers: { ...this.#headers, [key.toLowerCase()]: value },
    });
  }

  /** Return a new Response with multiple headers merged in. */
  withHeaders(headers: Record<string, string>): Response {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      normalized[k.toLowerCase()] = v;
    }
    return new Response({
      body: this.#body,
      status: this.#status,
      headers: { ...this.#headers, ...normalized },
    });
  }

  /** Return a new Response with one or more headers removed. */
  withoutHeader(key: string | readonly string[]): Response {
    const keys = typeof key === 'string' ? [key] : [...key];
    const updated = { ...this.#headers };
    for (const k of keys) {
      delete updated[k.toLowerCase()];
    }
    return new Response({ body: this.#body, status: this.#status, headers: updated });
  }

  /**
   * Return a new Response with a serialised Set-Cookie header appended.
   * Accepts a pre-serialised cookie string (low-level; prefer cookie()).
   */
  withCookie(serialized: string): Response {
    const existing = this.#headers['set-cookie'];
    const cookies =
      existing === undefined
        ? [serialized]
        : Array.isArray(existing)
          ? [...existing, serialized]
          : [existing, serialized];
    return new Response({
      body: this.#body,
      status: this.#status,
      headers: { ...this.#headers, 'set-cookie': cookies },
    });
  }

  /**
   * Attach a cookie to the response.
   * `minutes` is the lifetime; pass 0 to create a session cookie.
   */
  cookie(name: string, value: string, minutes: number, options: CookieOptions = {}): Response {
    return this.withCookie(serializeCookieHeader(name, value, minutes, options));
  }

  /**
   * Expire (delete) a cookie on the client by sending an empty cookie
   * with Max-Age=0.
   */
  withoutCookie(name: string, path = '/', domain?: string): Response {
    const opts: CookieOptions = domain !== undefined ? { path, domain } : { path };
    return this.withCookie(serializeCookieHeader(name, '', 0, opts));
  }

  /**
   * Wrap the JSON body in a JSONP callback.
   * Changes Content-Type to application/javascript.
   */
  withCallback(callbackName: string): Response {
    const payload = JSON.stringify(this.#body);
    const wrapped = `${callbackName}(${payload});`;
    return new Response({
      body: wrapped,
      status: this.#status,
      headers: {
        ...this.#headers,
        'content-type': 'application/javascript; charset=utf-8',
      },
    });
  }
}

// ── ResponseFactory ────────────────────────────────────────────────────────

export class ResponseFactory {
  json(data: unknown, status = 200): Response {
    return Response.json(data, status);
  }

  noContent(): Response {
    return Response.noContent();
  }

  notFound(message?: string, body?: Record<string, unknown>): Response {
    return Response.notFound(message, body);
  }

  error(message: string, status?: number, body?: Record<string, unknown>): Response {
    return Response.error(message, status, body);
  }

  redirect(url: string, status?: number): Response {
    return Response.redirect(url, status);
  }

  /**
   * Stream raw text chunks. Accepts an async iterable or a generator factory.
   */
  stream(
    source: AsyncIterable<string> | (() => AsyncIterable<string>),
    status = 200,
    extraHeaders: Record<string, string> = {},
  ): Response {
    const iterable = typeof source === 'function' ? source() : source;
    return Response.stream(iterable, status, extraHeaders);
  }

  /**
   * Stream a JSON-serialised object. Values that are async iterables
   * (e.g. database cursors) are streamed as JSON arrays.
   */
  streamJson(data: Record<string, unknown>, status = 200): Response {
    return Response.streamJson(data, status);
  }

  /**
   * Server-Sent Events stream. Automatically appends a `</stream>` terminator.
   */
  eventStream(
    source: AsyncIterable<string | StreamedEvent>,
    options: { endStreamWith?: StreamedEvent } = {},
  ): Response {
    return Response.eventStream(source, options);
  }

  /**
   * Stream generated content to the client as a named download.
   * No data is written to disk.
   */
  streamDownload(
    source: AsyncIterable<string> | (() => AsyncIterable<string>),
    filename: string,
    extraHeaders: Record<string, string> = {},
  ): Response {
    return Response.streamDownload(source, filename, extraHeaders);
  }

  /**
   * Force-download a file from the given absolute path.
   */
  download(
    filePath: string,
    filename?: string,
    extraHeaders: Record<string, string> = {},
  ): Response {
    return Response.fileDownload(filePath, filename, extraHeaders);
  }

  /**
   * Serve a file inline in the browser (e.g. images, PDFs).
   */
  file(filePath: string, extraHeaders: Record<string, string> = {}): Response {
    return Response.fileInline(filePath, extraHeaders);
  }
}

export function response(): ResponseFactory {
  return new ResponseFactory();
}
