import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TraceStore } from './trace-store';
import { DevContext } from './dev-context';
import { DevHttpTracer } from './http-tracer';
import { DevOrmTracer } from './orm-tracer';
import { DevEventTracer } from './event-tracer';
import type { EventTrace, RequestTrace, SqlTrace } from './types';

// ── TraceStore ────────────────────────────────────────────────────────────────

describe('TraceStore', () => {
  it('stores and retrieves requests in newest-first order', () => {
    const store = new TraceStore();
    const a: RequestTrace = {
      id: '1',
      method: 'GET',
      path: '/a',
      status: 200,
      durationMs: 10,
      startedAt: '',
      queryCount: 0,
      memoryDeltaKb: 0,
    };
    const b: RequestTrace = { ...a, id: '2', path: '/b' };
    store.addRequest(a);
    store.addRequest(b);
    const all = store.getRequests();
    expect((all[0] as RequestTrace).path).toBe('/b');
    expect((all[1] as RequestTrace).path).toBe('/a');
  });

  it('evicts oldest entry when ring buffer is full', () => {
    const store = new TraceStore({ maxRequests: 2 });
    const req = (id: string): RequestTrace => ({
      id,
      method: 'GET',
      path: `/${id}`,
      status: 200,
      durationMs: 5,
      startedAt: '',
      queryCount: 0,
      memoryDeltaKb: 0,
    });
    store.addRequest(req('a'));
    store.addRequest(req('b'));
    store.addRequest(req('c'));
    const ids = store.getRequests().map((r) => r.id);
    expect(ids).toContain('b');
    expect(ids).toContain('c');
    expect(ids).not.toContain('a');
  });

  it('correlates queries to request ids', () => {
    const store = new TraceStore();
    const q: SqlTrace = {
      sql: 'select 1',
      bindings: [],
      durationMs: 5,
      requestId: 'req-1',
      executedAt: '',
    };
    store.addQuery(q);
    expect(store.getQueriesForRequest('req-1')).toHaveLength(1);
    expect(store.getQueriesForRequest('req-9')).toHaveLength(0);
  });

  it('stores background queries with null requestId', () => {
    const store = new TraceStore();
    const q: SqlTrace = {
      sql: 'select 1',
      bindings: [],
      durationMs: 5,
      requestId: null,
      executedAt: '',
    };
    store.addQuery(q);
    expect(store.getQueries()).toHaveLength(1);
    expect((store.getQueries()[0] as SqlTrace).requestId).toBeNull();
  });

  it('clear() empties all buffers', () => {
    const store = new TraceStore();
    store.addRequest({
      id: '1',
      method: 'GET',
      path: '/',
      status: 200,
      durationMs: 1,
      startedAt: '',
      queryCount: 0,
      memoryDeltaKb: 0,
    });
    store.addQuery({
      sql: 'select 1',
      bindings: [],
      durationMs: 1,
      requestId: null,
      executedAt: '',
    });
    store.addEvent({ id: '1', eventType: 'test', firedAt: '', durationMs: 1 });
    store.clear();
    expect(store.getRequests()).toHaveLength(0);
    expect(store.getQueries()).toHaveLength(0);
    expect(store.getEvents()).toHaveLength(0);
  });
});

// ── DevContext ────────────────────────────────────────────────────────────────

describe('DevContext', () => {
  it('propagates requestId through async context', async () => {
    const ctx = new DevContext();
    let captured: string | null = null;
    await ctx.run('req-abc', async () => {
      await Promise.resolve();
      captured = ctx.currentRequestId();
    });
    expect(captured).toBe('req-abc');
  });

  it('returns null outside a run() scope', () => {
    const ctx = new DevContext();
    expect(ctx.currentRequestId()).toBeNull();
  });

  it('isolates concurrent request contexts', async () => {
    const ctx = new DevContext();
    const results: Array<string | null> = [];

    await Promise.all([
      ctx.run('req-1', async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(ctx.currentRequestId());
      }),
      ctx.run('req-2', async () => {
        await new Promise((r) => setTimeout(r, 1));
        results.push(ctx.currentRequestId());
      }),
    ]);

    expect(results).toContain('req-1');
    expect(results).toContain('req-2');
  });
});

// ── DevHttpTracer ─────────────────────────────────────────────────────────────

describe('DevHttpTracer', () => {
  let store: TraceStore;
  let context: DevContext;
  let tracer: DevHttpTracer;

  interface FakeRequest {
    path(): string;
    method(): string;
  }
  interface FakeResponse {
    getStatus(): number;
  }

  const makeRequest = (path: string): FakeRequest => ({
    path: () => path,
    method: () => 'GET',
  });

  const makeResponse = (status: number): FakeResponse => ({
    getStatus: () => status,
  });

  beforeEach(() => {
    store = new TraceStore();
    context = new DevContext();
    tracer = new DevHttpTracer(store, context);
  });

  it('records a request trace after next() resolves', async () => {
    const req = makeRequest('/users');
    const res = makeResponse(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tracer.handle(req as any, async () => res as any);
    const traces = store.getRequests();
    expect(traces).toHaveLength(1);
    expect((traces[0] as RequestTrace).path).toBe('/users');
    expect((traces[0] as RequestTrace).status).toBe(200);
    expect((traces[0] as RequestTrace).method).toBe('GET');
  });

  it('skips tracing for /_faber/* paths', async () => {
    const req = makeRequest('/_faber/api/requests');
    const res = makeResponse(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tracer.handle(req as any, async () => res as any);
    expect(store.getRequests()).toHaveLength(0);
  });

  it('records query count from correlated queries', async () => {
    const req = makeRequest('/orders');
    const res = makeResponse(200);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tracer.handle(req as any, async () => {
      const requestId = context.currentRequestId();
      if (requestId) {
        store.addQuery({ sql: 'select 1', bindings: [], durationMs: 2, requestId, executedAt: '' });
        store.addQuery({ sql: 'select 2', bindings: [], durationMs: 3, requestId, executedAt: '' });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res as any;
    });

    expect((store.getRequests()[0] as RequestTrace).queryCount).toBe(2);
  });
});

// ── DevOrmTracer ──────────────────────────────────────────────────────────────

describe('DevOrmTracer', () => {
  let store: TraceStore;
  let context: DevContext;
  let tracer: DevOrmTracer;

  type KnexEventHandler = (...args: unknown[]) => void;
  interface FakeKnex {
    on(event: string, handler: KnexEventHandler): void;
    emit(event: string, ...args: unknown[]): void;
  }

  const makeKnex = (): FakeKnex => {
    const handlers = new Map<string, KnexEventHandler>();
    return {
      on(event: string, handler: KnexEventHandler): void {
        handlers.set(event, handler);
      },
      emit(event: string, ...args: unknown[]): void {
        handlers.get(event)?.(...args);
      },
    };
  };

  beforeEach(() => {
    store = new TraceStore();
    context = new DevContext();
    tracer = new DevOrmTracer(store, context);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records a completed query with duration', () => {
    const db = makeKnex();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tracer.attach(db as any);

    db.emit('query', { sql: 'select * from users', bindings: [], __knexQueryUid: 'uid-1' });
    vi.advanceTimersByTime(50);
    db.emit('query-response', {}, { __knexQueryUid: 'uid-1' });

    const queries = store.getQueries();
    expect(queries).toHaveLength(1);
    expect((queries[0] as SqlTrace).sql).toBe('select * from users');
    expect((queries[0] as SqlTrace).durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records a query that errors', () => {
    const db = makeKnex();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tracer.attach(db as any);

    db.emit('query', { sql: 'bad sql', bindings: [], __knexQueryUid: 'uid-err' });
    db.emit('query-error', new Error('syntax error'), { __knexQueryUid: 'uid-err' });

    expect(store.getQueries()).toHaveLength(1);
  });

  it('does not double-record the same query', () => {
    const db = makeKnex();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tracer.attach(db as any);

    db.emit('query', { sql: 'select 1', bindings: [], __knexQueryUid: 'uid-2' });
    db.emit('query-response', {}, { __knexQueryUid: 'uid-2' });
    db.emit('query-response', {}, { __knexQueryUid: 'uid-2' }); // duplicate

    expect(store.getQueries()).toHaveLength(1);
  });
});

// ── DevEventTracer ────────────────────────────────────────────────────────────

type WildcardHandler = (payload: Record<string, unknown>) => void;

const makeDispatcher = (): {
  dispatcher: { listenWildcard(h: WildcardHandler): void };
  fire(p: Record<string, unknown>): void;
} => {
  let handler: WildcardHandler | null = null;
  return {
    dispatcher: {
      listenWildcard(h: WildcardHandler): void {
        handler = h;
      },
    },
    fire(p: Record<string, unknown>): void {
      (handler as WildcardHandler)(p);
    },
  };
};

describe('DevEventTracer', () => {
  it('records an event when the wildcard handler fires', () => {
    const store = new TraceStore();
    const tracer = new DevEventTracer(store);
    const { dispatcher, fire } = makeDispatcher();

    tracer.attach(dispatcher);
    fire({ type: 'UserRegistered', userId: 1 });

    const events = store.getEvents();
    expect(events).toHaveLength(1);
    expect((events[0] as EventTrace).eventType).toBe('UserRegistered');
  });

  it('records unknown event type when type field is missing', () => {
    const store = new TraceStore();
    const tracer = new DevEventTracer(store);
    const { dispatcher, fire } = makeDispatcher();

    tracer.attach(dispatcher);
    fire({ foo: 'bar' });

    expect((store.getEvents()[0] as EventTrace).eventType).toBe('unknown');
  });

  it('records multiple events', () => {
    const store = new TraceStore();
    const tracer = new DevEventTracer(store);
    const { dispatcher, fire } = makeDispatcher();

    tracer.attach(dispatcher);
    fire({ type: 'EventA' });
    fire({ type: 'EventB' });
    fire({ type: 'EventC' });

    expect(store.getEvents()).toHaveLength(3);
  });

  it('stores unique id per event', () => {
    const store = new TraceStore();
    const tracer = new DevEventTracer(store);
    const { dispatcher, fire } = makeDispatcher();

    tracer.attach(dispatcher);
    fire({ type: 'X' });
    fire({ type: 'X' });

    const events = store.getEvents();
    expect((events[0] as EventTrace).id).not.toBe((events[1] as EventTrace).id);
  });
});

// ── EventTrace shape ──────────────────────────────────────────────────────────

describe('EventTrace shape', () => {
  it('has all required fields', () => {
    const store = new TraceStore();
    const tracer = new DevEventTracer(store);
    const { dispatcher, fire } = makeDispatcher();

    tracer.attach(dispatcher);
    fire({ type: 'OrderPlaced' });

    const evt = store.getEvents()[0] as EventTrace;
    expect(typeof evt.id).toBe('string');
    expect(typeof evt.eventType).toBe('string');
    expect(typeof evt.firedAt).toBe('string');
    expect(typeof evt.durationMs).toBe('number');
  });
});
