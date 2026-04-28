import { ServiceProvider } from '@faber-js/core';
import type { ApplicationContract } from '@faber-js/core';
import type { HttpKernelContract } from '@faber-js/http';
import { Route } from '@faber-js/router';
import { DashboardController } from './dashboard-controller';
import { DevContext } from './dev-context';
import { DevEventTracer } from './event-tracer';
import { DevHttpTracer } from './http-tracer';
import type { KnexInstance } from './orm-tracer';
import { DevOrmTracer } from './orm-tracer';
import { TraceStore } from './trace-store';
import type { DevToolsConfig } from './types';
import { DEFAULT_CONFIG } from './types';

interface DispatcherLike {
  listenWildcard(handler: (payload: Record<string, unknown>) => void | Promise<void>): void;
}

export interface DevToolsOptions extends Partial<DevToolsConfig> {
  db?: KnexInstance;
  dispatcher?: DispatcherLike;
}

export class DevToolsServiceProvider extends ServiceProvider {
  readonly #config: DevToolsConfig;
  readonly #db: KnexInstance | undefined;
  readonly #dispatcher: DispatcherLike | undefined;

  constructor(app: ApplicationContract, options: DevToolsOptions = {}) {
    super(app);
    const { db, dispatcher, ...config } = options;
    this.#config = { ...DEFAULT_CONFIG, ...config };
    this.#db = db;
    this.#dispatcher = dispatcher;
  }

  register(): void {
    if (!this.#config.enabled) return;

    const store = new TraceStore(this.#config);
    const context = new DevContext();

    this.app.instance('devtools.store', store);
    this.app.instance('devtools.context', context);
    this.app.instance(TraceStore, store);
    this.app.instance(DevContext, context);
  }

  boot(): void {
    if (!this.#config.enabled) return;

    const store = this.app.make<TraceStore>('devtools.store');
    const context = this.app.make<DevContext>('devtools.context');
    const kernel = this.app.make<HttpKernelContract>('http.kernel');

    kernel.pushGlobal(new DevHttpTracer(store, context));

    if (this.#db) {
      new DevOrmTracer(store, context).attach(this.#db);
    }

    if (this.#dispatcher) {
      new DevEventTracer(store).attach(this.#dispatcher);
    }

    const base = this.#config.path;

    Route.get(base, [DashboardController, 'index']);
    Route.get(`${base}/api/requests`, [DashboardController, 'requests']);
    Route.get(`${base}/api/queries`, [DashboardController, 'queries']);
    Route.get(`${base}/api/events`, [DashboardController, 'events']);
    Route.get(`${base}/api/agents`, [DashboardController, 'agents']);
    Route.delete(`${base}/api/clear`, [DashboardController, 'clear']);
  }
}
