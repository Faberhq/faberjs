import { Injectable } from '@faber-js/core';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';
import { Controller } from '@faber-js/router';
import { DASHBOARD_HTML } from './dashboard-ui';
import type { TraceStore } from './trace-store';

@Injectable()
export class DashboardController extends Controller {
  readonly #store: TraceStore;

  constructor(store: TraceStore) {
    super();
    this.#store = store;
  }

  index(_req: Request): Response {
    return Response.html(DASHBOARD_HTML);
  }

  requests(_req: Request): Response {
    return this.json(this.#store.getRequests());
  }

  queries(_req: Request): Response {
    return this.json(this.#store.getQueries());
  }

  events(_req: Request): Response {
    return this.json(this.#store.getEvents());
  }

  agents(_req: Request): Response {
    return this.json(this.#store.getAgents());
  }

  clear(_req: Request): Response {
    this.#store.clear();
    return this.noContent();
  }
}
