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

  static stream(source: AsyncIterable<string>, status = 200): Response {
    return new Response({
      body: source,
      status,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' },
    });
  }

  static sse(source: AsyncIterable<string>, status = 200): Response {
    async function* toSseEvents(): AsyncGenerator<string> {
      for await (const chunk of source) {
        yield `data: ${JSON.stringify({ delta: chunk })}\n\n`;
      }
    }
    return new Response({
      body: toSseEvents(),
      status,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  }

  getStatus(): number {
    return this.#status;
  }

  getBody(): unknown {
    return this.#body;
  }

  getHeaders(): Readonly<Record<string, string | string[]>> {
    return this.#headers;
  }

  withHeader(key: string, value: string): Response {
    return new Response({
      body: this.#body,
      status: this.#status,
      headers: { ...this.#headers, [key.toLowerCase()]: value },
    });
  }

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
}

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
}

export function response(): ResponseFactory {
  return new ResponseFactory();
}
