# AI Agents

`@faber-js/ai` provides first-class scaffolding for Claude-powered AI agents. An agent is an injectable class with typed tools, conversation memory, and streaming support — backed by the Anthropic SDK.

## Prerequisites

Set your Anthropic API key in `.env`:

```ini
ANTHROPIC_API_KEY=sk-ant-...
```

Register `AiServiceProvider` in `bootstrap/app.ts`:

```typescript
import { AiServiceProvider } from '@faber-js/ai';

app.register(new AiServiceProvider(app));
```

Install the package if not already present:

```bash
pnpm add @faber-js/ai
```

## Generating an agent

```bash
faber make:agent Support
```

Generated file (`app/agents/SupportAgent.ts`):

```typescript
import { Injectable } from '@faber-js/core';
import { Agent, Tool } from '@faber-js/ai';

@Injectable()
export class SupportAgent extends Agent {
  override model = 'claude-sonnet-4-6';
  override systemPrompt = 'You are a helpful assistant.';

  @Tool({ description: 'Example tool — replace with your own' })
  async exampleTool(_input: Record<string, unknown>): Promise<string> {
    return 'result';
  }
}
```

## The `Agent` base class

| Property       | Type                 | Default                      | Description                         |
| -------------- | -------------------- | ---------------------------- | ----------------------------------- |
| `model`        | `string`             | `'claude-sonnet-4-6'`        | Claude model to use                 |
| `systemPrompt` | `string`             | `''`                         | System prompt sent on every request |
| `maxTokens`    | `number`             | `4096`                       | Maximum tokens in the response      |
| `memory`       | `ConversationMemory` | `InMemoryConversationMemory` | Conversation history store          |

## Chat and streaming

### `agent.chat(message)`

Send a message and receive a complete response. Tool use is handled automatically in a loop.

```typescript
const agent = new SupportAgent();
const reply = await agent.chat('How do I reset my password?');
console.log(reply);
```

### `agent.stream(message)`

Stream the response token by token. Returns an `AsyncGenerator<string>`.

```typescript
const agent = new SupportAgent();
for await (const chunk of agent.stream('Explain how FaberJS routing works.')) {
  process.stdout.write(chunk);
}
```

## Defining tools with `@Tool`

The `@Tool` decorator turns an agent method into a Claude tool. When Claude decides to call a tool, FaberJS automatically invokes the corresponding method and feeds the result back.

```typescript
import { Injectable } from '@faber-js/core';
import { Agent, Tool } from '@faber-js/ai';

@Injectable()
export class ProductAgent extends Agent {
  override model = 'claude-sonnet-4-6';
  override systemPrompt = `You are a helpful product assistant.
    Use the available tools to answer questions about products.`;

  @Tool({
    description: 'Search for products by name or keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Maximum results to return' },
      },
      required: ['query'],
    },
  })
  async searchProducts(input: { query: string; limit?: number }): Promise<string> {
    const products = await Product.where<Product>('name', 'like', `%${input.query}%`)
      .limit(input.limit ?? 5)
      .get();

    return JSON.stringify(products.map((p) => p.toObject()));
  }

  @Tool({
    description: 'Get the current price and stock for a product ID',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number', description: 'Product ID' },
      },
      required: ['productId'],
    },
  })
  async getProductDetails(input: { productId: number }): Promise<string> {
    const product = await Product.find<Product>(input.productId);
    if (!product) return 'Product not found.';
    return JSON.stringify(product.toObject());
  }
}
```

## `@Tool` options

| Option        | Type     | Required | Description                                                                        |
| ------------- | -------- | -------- | ---------------------------------------------------------------------------------- |
| `description` | `string` | Yes      | Tells Claude what this tool does                                                   |
| `inputSchema` | `object` | No       | JSON Schema for the tool's input. Defaults to `{ type: 'object', properties: {} }` |

Tools are registered with Claude as part of every request automatically. You do not call them directly — Claude decides when to use them.

## Conversation memory

By default, agents use `InMemoryConversationMemory`, which keeps the full conversation history for the lifetime of the agent instance. Each `chat()` or `stream()` call reads and updates this history.

```typescript
const agent = new SupportAgent();

await agent.chat('My name is Alice.');
const reply = await agent.chat('What is my name?');
// reply: "Your name is Alice."
```

### Clearing memory

```typescript
agent.memory.clear();
```

### Accessing history

```typescript
const history = agent.memory.getHistory();
// ReadonlyArray<{ role: 'user' | 'assistant', content: string }>
```

### Custom memory

Implement `ConversationMemory` to persist history to Redis or a database:

```typescript
import type { ConversationMemory, MemoryMessage } from '@faber-js/ai';
import { Redis } from 'ioredis';

export class RedisConversationMemory implements ConversationMemory {
  constructor(
    private readonly redis: Redis,
    private readonly sessionId: string,
  ) {}

  async add(message: MemoryMessage): Promise<void> {
    await this.redis.rpush(`chat:${this.sessionId}`, JSON.stringify(message));
  }

  getHistory(): readonly MemoryMessage[] {
    // Synchronous — load eagerly in constructor for simple use cases
    return this.#cached;
  }

  clear(): void {
    void this.redis.del(`chat:${this.sessionId}`);
  }

  #cached: MemoryMessage[] = [];
}
```

Assign a custom memory instance:

```typescript
const agent = new SupportAgent();
agent.memory = new RedisConversationMemory(redis, sessionId);
```

## Using an agent in a controller

```typescript
import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';
import { SupportAgent } from '../agents/SupportAgent';

@Injectable()
export class ChatController extends Controller {
  constructor(private readonly agent: SupportAgent) {
    super();
  }

  async message(req: Request): Promise<Response> {
    const message = req.input('message') as string;
    const reply = await this.agent.chat(message);
    return this.json({ reply });
  }

  async stream(req: Request): Promise<Response> {
    const message = req.input('message') as string;

    async function* generate(agent: SupportAgent): AsyncGenerator<string> {
      for await (const chunk of agent.stream(message)) {
        yield chunk;
      }
    }

    return Response.stream(generate(this.agent));
  }
}
```

```typescript
// routes/api.ts
Route.group({ prefix: '/chat', middleware: ['auth'] }, () => {
  Route.post('/message', [ChatController, 'message']);
  Route.post('/stream', [ChatController, 'stream']);
});
```

## Changing the model

Override `model` to use any Claude model:

```typescript
@Injectable()
export class AnalysisAgent extends Agent {
  override model = 'claude-opus-4-5';
  override maxTokens = 8192;
  override systemPrompt = 'You are an expert data analyst.';
}
```
