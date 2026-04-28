# Runtime Adapters

`@faber-js/adapters` makes FaberJS runtime-agnostic. One codebase, multiple deployment targets. The container, routing, ORM, and business logic run unchanged — only the HTTP I/O layer swaps via a pluggable adapter.

## Installation

```bash
pnpm add @faber-js/adapters
```

## Available adapters

| Adapter | Runtime | Use case |
|---|---|---|
| `FastifyAdapter` | Node.js | Default — full features, production-ready |
| `BunAdapter` | Bun | Native Bun server, ~4× faster cold starts |
| `createLambdaHandler` | AWS Lambda | Serverless — warm invocation reuse, <50ms cold start |
| `createWorkerHandler` | Cloudflare Workers | Edge — stateless, global PoP |

## Automatic detection

FaberJS detects the current runtime automatically:

```typescript
import { detectRuntime } from '@faber-js/adapters';

const runtime = detectRuntime();
// 'node' | 'bun' | 'lambda' | 'cloudflare'
```

Detection logic:
1. `AWS_LAMBDA_FUNCTION_NAME` env var → `'lambda'`
2. `Bun` global present → `'bun'`
3. Otherwise → `'node'`

Use `createAdapter()` to get the right adapter automatically:

```typescript
import { createAdapter } from '@faber-js/adapters';

const adapter = createAdapter(); // auto-detects runtime
```

## FastifyAdapter (default)

The default adapter. No configuration needed for existing apps — this is what `HttpKernel` uses internally.

```typescript
import { FastifyAdapter } from '@faber-js/adapters';
import type { RequestHandler } from '@faber-js/adapters';

const adapter = new FastifyAdapter();

const handler: RequestHandler = async (req) => {
  return Response.json({ hello: 'world' });
};

await adapter.start(handler, { port: 3000, host: '0.0.0.0' });

// Later, to stop:
await adapter.stop();
```

## BunAdapter

Requires the [Bun runtime](https://bun.sh). Uses `Bun.serve()` natively — no Fastify overhead, TypeScript runs without ts-node.

```typescript
import { BunAdapter } from '@faber-js/adapters/bun';

const adapter = new BunAdapter();
await adapter.start(handler, { port: 3000 });
```

Running with Bun:

```bash
bun run bootstrap/app.ts
# ~4× faster startup vs Node + Fastify
```

::: warning Runtime required
`BunAdapter` throws if used outside the Bun runtime. Import and instantiate it only when `detectRuntime() === 'bun'`.
:::

## Lambda adapter

Deploy a FaberJS app to AWS Lambda with a single wrapper. The app boots once on cold start and is reused across warm invocations.

### Installation

```bash
pnpm add @faber-js/adapters
```

### Lambda entry file

```typescript
// lambda.ts
import { createLambdaHandler } from '@faber-js/adapters/lambda';
import app from './bootstrap/app';

export const handler = createLambdaHandler(app);
```

The returned function has the signature:

```typescript
(event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
```

### How it works

```
Cold start:
  Lambda event → app.boot() → kernel.handleRequest(req) → response

Warm invocation:
  Lambda event → kernel.handleRequest(req) → response
```

`app.boot()` is called exactly once. Every subsequent invocation skips it, keeping warm-invocation latency minimal.

### Bundling for Lambda

```bash
bun build lambda.ts --outfile dist/handler.js --target=node
# or
esbuild lambda.ts --bundle --outfile=dist/handler.js --platform=node
```

### Low-level bridge functions

If you need to convert Lambda events manually:

```typescript
import { fromLambdaEvent, toLambdaResponse } from '@faber-js/adapters/lambda';
import type { APIGatewayProxyEvent } from '@faber-js/adapters/lambda';

const faberReq = fromLambdaEvent(event);
const faberRes = await myHandler(faberReq);
const lambdaResult = toLambdaResponse(faberRes);
```

## Cloudflare Workers adapter

Deploy routing, validation, JWT auth, and AI agents to Cloudflare's global edge network. The adapter translates between the Web Fetch API and FaberJS types.

### Worker entry file

```typescript
// worker.ts
import { createWorkerHandler } from '@faber-js/adapters/cloudflare';
import { Response } from '@faber-js/http';

export default createWorkerHandler(async (req) => {
  return Response.json({ edge: true, path: req.path() });
});
```

The returned object has a `fetch` method compatible with Cloudflare's `ExportedHandler` interface.

### Available on the edge

| Feature | Available |
|---|---|
| Routing + controllers | Yes |
| Validation | Yes |
| JWT auth | Yes |
| `@faber-js/ai` | Yes |
| ORM / Knex | No — use D1 driver or external API |
| BullMQ queues | No — use Cloudflare Queues |
| Redis events | No — use Durable Objects or Pub/Sub |

### Low-level bridge functions

```typescript
import { fromWorkerRequest, toWorkerResponse } from '@faber-js/adapters/cloudflare';

// In your own Worker fetch handler:
export default {
  async fetch(request: Request): Promise<Response> {
    const faberReq = await fromWorkerRequest(request);
    const faberRes = await myHandler(faberReq);
    return toWorkerResponse(faberRes);
  },
};
```

## The HttpAdapter interface

All server adapters implement the same interface, defined in `@faber-js/http`:

```typescript
interface HttpAdapter {
  start(handler: RequestHandler, options?: AdapterOptions): Promise<void>;
  stop(): Promise<void>;
}

type RequestHandler = (request: Request) => Promise<Response>;

interface AdapterOptions {
  readonly port?: number;
  readonly host?: string;
}
```

You can implement your own adapter for any runtime:

```typescript
import type { HttpAdapter, RequestHandler, AdapterOptions } from '@faber-js/http';
import { Request } from '@faber-js/http';

export class MyAdapter implements HttpAdapter {
  async start(handler: RequestHandler, options: AdapterOptions = {}): Promise<void> {
    // Start your server, convert requests, call handler
  }

  async stop(): Promise<void> {
    // Shut down gracefully
  }
}
```

## handleRequest on HttpKernel

`HttpKernel` exposes `handleRequest(request)` for adapter use — it routes the request through the full middleware pipeline without starting a TCP server:

```typescript
import { HttpKernel } from '@faber-js/http';

const kernel = app.make<HttpKernel>('http.kernel');
const response = await kernel.handleRequest(req);
```

This is how `createLambdaHandler` works internally: it calls `kernel.handleRequest()` for each Lambda invocation without Fastify's server overhead.

## ORM compatibility

| Runtime | ORM | Notes |
|---|---|---|
| Node.js + Fastify | Full | PostgreSQL, MySQL, SQLite |
| Bun | Full | Bun is Node-compatible |
| AWS Lambda | Full | PostgreSQL, MySQL via connection pooling |
| Cloudflare Workers | No | Use D1 (planned) or external API |
