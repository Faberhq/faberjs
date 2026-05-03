import { describe, expect, it } from 'vitest';
import { Response, ResponseFactory, response, StreamedEvent } from './response';

describe('Response', () => {
  describe('json()', () => {
    it('creates a 200 JSON response by default', () => {
      const res = Response.json({ data: [1, 2] });
      expect(res.getStatus()).toBe(200);
      expect(res.getBody()).toEqual({ data: [1, 2] });
      expect(res.getHeaders()['content-type']).toBe('application/json');
    });

    it('accepts a custom status code', () => {
      const res = Response.json({ id: 1 }, 201);
      expect(res.getStatus()).toBe(201);
    });
  });

  describe('noContent()', () => {
    it('creates a 204 response with no body', () => {
      const res = Response.noContent();
      expect(res.getStatus()).toBe(204);
      expect(res.getBody()).toBeNull();
    });
  });

  describe('notFound()', () => {
    it('creates a 404 response with default message', () => {
      const res = Response.notFound();
      expect(res.getStatus()).toBe(404);
      expect(res.getBody()).toEqual({ message: 'Not Found' });
    });

    it('accepts a custom message', () => {
      const res = Response.notFound('User not found');
      expect(res.getBody()).toEqual({ message: 'User not found' });
    });
  });

  describe('error()', () => {
    it('creates a 500 response by default', () => {
      const res = Response.error('Boom');
      expect(res.getStatus()).toBe(500);
      expect(res.getBody()).toEqual({ message: 'Boom' });
    });

    it('accepts a custom status code', () => {
      const res = Response.error('Unauthorized', 401);
      expect(res.getStatus()).toBe(401);
    });
  });

  describe('redirect()', () => {
    it('creates a 302 redirect with location header', () => {
      const res = Response.redirect('/login');
      expect(res.getStatus()).toBe(302);
      expect(res.getHeaders()['location']).toBe('/login');
    });

    it('accepts a custom status code', () => {
      const res = Response.redirect('/home', 301);
      expect(res.getStatus()).toBe(301);
    });
  });

  describe('withHeader()', () => {
    it('adds a header without mutating the original', () => {
      const original = Response.json({});
      const updated = original.withHeader('X-Custom', 'hello');
      expect(updated.getHeaders()['x-custom']).toBe('hello');
      expect(original.getHeaders()['x-custom']).toBeUndefined();
    });

    it('normalises key to lowercase', () => {
      const res = Response.json({}).withHeader('X-REQUEST-ID', 'abc');
      expect(res.getHeaders()['x-request-id']).toBe('abc');
    });
  });

  describe('withHeaders()', () => {
    it('merges multiple headers at once', () => {
      const res = Response.json({}).withHeaders({ 'X-Foo': 'a', 'X-Bar': 'b' });
      expect(res.getHeaders()['x-foo']).toBe('a');
      expect(res.getHeaders()['x-bar']).toBe('b');
    });

    it('normalises keys to lowercase', () => {
      const res = Response.json({}).withHeaders({ 'Content-Language': 'en' });
      expect(res.getHeaders()['content-language']).toBe('en');
    });

    it('preserves existing headers', () => {
      const res = Response.json({}).withHeaders({ 'X-New': '1' });
      expect(res.getHeaders()['content-type']).toBe('application/json');
    });
  });

  describe('withoutHeader()', () => {
    it('removes a single header', () => {
      const res = Response.json({}).withHeader('X-Debug', 'true').withoutHeader('X-Debug');
      expect(res.getHeaders()['x-debug']).toBeUndefined();
    });

    it('removes multiple headers given an array', () => {
      const res = Response.json({})
        .withHeader('X-A', '1')
        .withHeader('X-B', '2')
        .withoutHeader(['X-A', 'X-B']);
      expect(res.getHeaders()['x-a']).toBeUndefined();
      expect(res.getHeaders()['x-b']).toBeUndefined();
    });

    it('is case-insensitive', () => {
      const res = Response.json({})
        .withHeader('x-powered-by', 'FaberJS')
        .withoutHeader('X-Powered-By');
      expect(res.getHeaders()['x-powered-by']).toBeUndefined();
    });

    it('is a no-op for a header that does not exist', () => {
      const res = Response.json({}).withoutHeader('X-Ghost');
      expect(res.getStatus()).toBe(200);
    });
  });

  describe('withCookie()', () => {
    it('appends a Set-Cookie header', () => {
      const res = Response.json({}).withCookie('token=abc; Path=/');
      expect(res.getHeaders()['set-cookie']).toEqual(['token=abc; Path=/']);
    });

    it('accumulates multiple cookies as an array', () => {
      const res = Response.json({}).withCookie('a=1').withCookie('b=2');
      expect(res.getHeaders()['set-cookie']).toEqual(['a=1', 'b=2']);
    });
  });

  describe('cookie()', () => {
    it('serialises and attaches a cookie with Max-Age', () => {
      const res = Response.json({}).cookie('session', 'xyz', 60);
      const header = res.getHeaders()['set-cookie'] as string[];
      expect(header).toHaveLength(1);
      expect(header[0]).toContain('session=xyz');
      expect(header[0]).toContain('Max-Age=3600');
      expect(header[0]).toContain('Path=/');
      expect(header[0]).toContain('HttpOnly');
    });

    it('supports custom path, domain, and sameSite', () => {
      const res = Response.json({}).cookie('pref', 'dark', 1440, {
        path: '/app',
        domain: 'example.com',
        secure: true,
        sameSite: 'Lax',
      });
      const [header] = res.getHeaders()['set-cookie'] as string[];
      expect(header).toContain('Path=/app');
      expect(header).toContain('Domain=example.com');
      expect(header).toContain('Secure');
      expect(header).toContain('SameSite=Lax');
    });

    it('omits Max-Age for session cookies (minutes=0)', () => {
      const res = Response.json({}).cookie('tmp', 'val', -1);
      const [header] = res.getHeaders()['set-cookie'] as string[];
      expect(header).not.toContain('Max-Age');
    });
  });

  describe('withoutCookie()', () => {
    it('sets an expired cookie to delete the named cookie', () => {
      const res = Response.json({}).withoutCookie('session');
      const [header] = res.getHeaders()['set-cookie'] as string[];
      expect(header).toContain('session=');
      expect(header).toContain('Max-Age=0');
      expect(header).toContain('Path=/');
    });
  });

  describe('withCallback()', () => {
    it('wraps the JSON body in the callback name', () => {
      const res = Response.json({ id: 1 }).withCallback('myFn');
      expect(res.getBody()).toBe('myFn({"id":1});');
      expect(res.getHeaders()['content-type']).toContain('application/javascript');
    });
  });

  describe('sse()', () => {
    it('sets the correct SSE headers', () => {
      async function* src(): AsyncGenerator<string> {
        yield 'hello';
      }
      const res = Response.sse(src());
      const h = res.getHeaders();
      expect(h['content-type']).toBe('text/event-stream');
      expect(h['cache-control']).toBe('no-cache');
    });

    it('formats string chunks as data: lines', async () => {
      async function* src(): AsyncGenerator<string> {
        yield 'first';
        yield 'second';
      }
      const res = Response.sse(src());
      const chunks: string[] = [];
      for await (const chunk of res.getBody() as AsyncIterable<string>) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['data: first\n\n', 'data: second\n\n']);
    });

    it('formats StreamedEvent instances with event name', async () => {
      const event = new StreamedEvent({ event: 'update', data: 'payload' });
      async function* src(): AsyncGenerator<StreamedEvent> {
        yield event;
      }
      const res = Response.sse(src());
      const chunks: string[] = [];
      for await (const chunk of res.getBody() as AsyncIterable<string>) {
        chunks.push(chunk);
      }
      expect(chunks[0]).toContain('event: update');
      expect(chunks[0]).toContain('data: payload');
    });
  });

  describe('eventStream()', () => {
    it('appends a </stream> terminator by default', async () => {
      async function* src(): AsyncGenerator<string> {
        yield 'msg';
      }
      const res = Response.eventStream(src());
      const chunks: string[] = [];
      for await (const chunk of res.getBody() as AsyncIterable<string>) {
        chunks.push(chunk);
      }
      expect(chunks.at(-1)).toContain('</stream>');
    });

    it('uses a custom endStreamWith event', async () => {
      async function* src(): AsyncGenerator<string> {
        yield 'done';
      }
      const end = new StreamedEvent({ event: 'close', data: 'bye' });
      const res = Response.eventStream(src(), { endStreamWith: end });
      const chunks: string[] = [];
      for await (const chunk of res.getBody() as AsyncIterable<string>) {
        chunks.push(chunk);
      }
      const last = chunks.at(-1) as string;
      expect(last).toContain('event: close');
      expect(last).toContain('data: bye');
    });
  });

  describe('streamJson()', () => {
    it('yields a valid JSON object for plain values', async () => {
      const res = Response.streamJson({ name: 'Alice', age: 30 });
      const chunks: string[] = [];
      for await (const chunk of res.getBody() as AsyncIterable<string>) {
        chunks.push(chunk);
      }
      const joined = chunks.join('');
      expect(JSON.parse(joined)).toEqual({ name: 'Alice', age: 30 });
    });

    it('yields a JSON array for async iterable values', async () => {
      async function* cursor(): AsyncGenerator<{ id: number }> {
        yield { id: 1 };
        yield { id: 2 };
      }
      const res = Response.streamJson({ users: cursor() });
      const chunks: string[] = [];
      for await (const chunk of res.getBody() as AsyncIterable<string>) {
        chunks.push(chunk);
      }
      const parsed = JSON.parse(chunks.join('')) as { users: Array<{ id: number }> };
      expect(parsed.users).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('sets content-type to application/json', () => {
      const res = Response.streamJson({});
      expect(res.getHeaders()['content-type']).toBe('application/json');
    });
  });

  describe('fileDownload()', () => {
    it('sets Content-Disposition attachment with the filename', () => {
      const res = Response.fileDownload('/tmp/report.pdf', 'my-report.pdf');
      expect(res.getHeaders()['content-disposition']).toBe('attachment; filename="my-report.pdf"');
      expect(res.getHeaders()['content-type']).toBe('application/pdf');
    });

    it('infers filename from path when not provided', () => {
      const res = Response.fileDownload('/exports/data.csv');
      expect(res.getHeaders()['content-disposition']).toBe('attachment; filename="data.csv"');
    });
  });

  describe('fileInline()', () => {
    it('sets Content-Disposition inline', () => {
      const res = Response.fileInline('/uploads/photo.jpg');
      expect(res.getHeaders()['content-disposition']).toBe('inline');
      expect(res.getHeaders()['content-type']).toBe('image/jpeg');
    });
  });

  describe('streamDownload()', () => {
    it('sets attachment headers for generated content', async () => {
      async function* gen(): AsyncGenerator<string> {
        yield 'col1,col2\n';
        yield '1,2\n';
      }
      const res = Response.streamDownload(gen, 'export.csv');
      expect(res.getHeaders()['content-disposition']).toBe('attachment; filename="export.csv"');
      const chunks: string[] = [];
      for await (const chunk of res.getBody() as AsyncIterable<string>) {
        chunks.push(chunk);
      }
      expect(chunks.join('')).toBe('col1,col2\n1,2\n');
    });

    it('accepts an iterable directly', async () => {
      async function* gen(): AsyncGenerator<string> {
        yield 'data';
      }
      const res = Response.streamDownload(gen(), 'out.txt');
      expect(res.getHeaders()['content-disposition']).toContain('attachment');
    });
  });

  describe('macro()', () => {
    it('registers a callable macro on ResponseFactory', () => {
      Response.macro('caps', (value: unknown) => Response.html(String(value).toUpperCase()));
      const res = (response() as unknown as Record<string, (v: string) => Response>).caps('hello');
      expect(res.getBody()).toBe('HELLO');
      expect(res.getHeaders()['content-type']).toBe('text/html; charset=utf-8');
    });
  });
});

describe('StreamedEvent', () => {
  it('formats a named event with string data', () => {
    const ev = new StreamedEvent({ event: 'update', data: 'hello' });
    expect(ev.format()).toBe('event: update\ndata: hello\n\n');
  });

  it('formats data-only events', () => {
    const ev = new StreamedEvent({ data: 'ping' });
    expect(ev.format()).toBe('data: ping\n\n');
  });

  it('JSON-serialises non-string data', () => {
    const ev = new StreamedEvent({ data: { x: 1 } });
    expect(ev.format()).toBe('data: {"x":1}\n\n');
  });

  it('includes id and retry when provided', () => {
    const ev = new StreamedEvent({ data: 'msg', id: '42', retry: 3000 });
    expect(ev.format()).toContain('id: 42');
    expect(ev.format()).toContain('retry: 3000');
  });
});

describe('ResponseFactory', () => {
  it('delegates json() to Response.json()', () => {
    const res = new ResponseFactory().json({ ok: true }, 201);
    expect(res.getStatus()).toBe(201);
    expect(res.getBody()).toEqual({ ok: true });
  });

  it('delegates noContent()', () => {
    expect(new ResponseFactory().noContent().getStatus()).toBe(204);
  });

  it('delegates notFound()', () => {
    expect(new ResponseFactory().notFound().getStatus()).toBe(404);
  });

  it('delegates redirect()', () => {
    expect(new ResponseFactory().redirect('/dashboard').getStatus()).toBe(302);
  });

  it('stream() accepts an async iterable', async () => {
    async function* src(): AsyncGenerator<string> {
      yield 'a';
      yield 'b';
    }
    const res = new ResponseFactory().stream(src());
    const chunks: string[] = [];
    for await (const chunk of res.getBody() as AsyncIterable<string>) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['a', 'b']);
  });

  it('stream() accepts a factory function', async () => {
    async function* src(): AsyncGenerator<string> {
      yield 'x';
    }
    const res = new ResponseFactory().stream(src);
    const chunks: string[] = [];
    for await (const chunk of res.getBody() as AsyncIterable<string>) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['x']);
  });

  it('download() sets attachment header', () => {
    const res = new ResponseFactory().download('/files/report.pdf');
    expect(res.getHeaders()['content-disposition']).toContain('attachment');
  });

  it('file() sets inline header', () => {
    const res = new ResponseFactory().file('/images/logo.png');
    expect(res.getHeaders()['content-disposition']).toBe('inline');
  });

  it('streamDownload() creates a streaming attachment', () => {
    async function* src(): AsyncGenerator<string> {
      yield 'line';
    }
    const res = new ResponseFactory().streamDownload(src, 'out.txt');
    expect(res.getHeaders()['content-disposition']).toContain('attachment');
  });

  it('streamJson() returns a JSON content-type streaming response', () => {
    const res = new ResponseFactory().streamJson({ items: [1, 2] });
    expect(res.getHeaders()['content-type']).toBe('application/json');
  });

  it('eventStream() returns a text/event-stream response', () => {
    async function* src(): AsyncGenerator<string> {
      yield 'msg';
    }
    const res = new ResponseFactory().eventStream(src());
    expect(res.getHeaders()['content-type']).toBe('text/event-stream');
  });
});

describe('response()', () => {
  it('returns a ResponseFactory instance', () => {
    expect(response()).toBeInstanceOf(ResponseFactory);
  });

  it('can build a JSON response via factory', () => {
    const res = response().json({ hello: 'world' });
    expect(res.getStatus()).toBe(200);
    expect(res.getBody()).toEqual({ hello: 'world' });
  });
});
