import type { AgentTrace, DevToolsConfig, EventTrace, RequestTrace, SqlTrace } from './types';

class RingBuffer<T> {
  readonly #items: T[] = [];
  readonly #maxSize: number;

  constructor(maxSize: number) {
    this.#maxSize = maxSize;
  }

  push(item: T): void {
    if (this.#items.length >= this.#maxSize) this.#items.shift();
    this.#items.push(item);
  }

  all(): T[] {
    return [...this.#items].reverse();
  }

  size(): number {
    return this.#items.length;
  }

  clear(): void {
    this.#items.length = 0;
  }
}

export class TraceStore {
  readonly #requests: RingBuffer<RequestTrace>;
  readonly #queries: RingBuffer<SqlTrace>;
  readonly #events: RingBuffer<EventTrace>;
  readonly #agents: RingBuffer<AgentTrace>;
  readonly #requestQueries = new Map<string, SqlTrace[]>();

  constructor(config?: Partial<DevToolsConfig>) {
    this.#requests = new RingBuffer(config?.maxRequests ?? 200);
    this.#queries = new RingBuffer(config?.maxQueries ?? 500);
    this.#events = new RingBuffer(config?.maxEvents ?? 500);
    this.#agents = new RingBuffer(config?.maxAgentTraces ?? 100);
  }

  addRequest(trace: RequestTrace): void {
    this.#requests.push(trace);
    setTimeout(() => this.#requestQueries.delete(trace.id), 60_000);
  }

  addQuery(trace: SqlTrace): void {
    this.#queries.push(trace);
    if (trace.requestId) {
      const existing = this.#requestQueries.get(trace.requestId) ?? [];
      existing.push(trace);
      this.#requestQueries.set(trace.requestId, existing);
    }
  }

  addEvent(trace: EventTrace): void {
    this.#events.push(trace);
  }

  addAgent(trace: AgentTrace): void {
    this.#agents.push(trace);
  }

  getQueriesForRequest(requestId: string): readonly SqlTrace[] {
    return this.#requestQueries.get(requestId) ?? [];
  }

  getRequests(): RequestTrace[] {
    return this.#requests.all();
  }

  getQueries(): SqlTrace[] {
    return this.#queries.all();
  }

  getEvents(): EventTrace[] {
    return this.#events.all();
  }

  getAgents(): AgentTrace[] {
    return this.#agents.all();
  }

  clear(): void {
    this.#requests.clear();
    this.#queries.clear();
    this.#events.clear();
    this.#agents.clear();
    this.#requestQueries.clear();
  }
}
