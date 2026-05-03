import type { Constructor } from '@faber-js/core';
import type { HttpMethod, RouteDefinition } from '@faber-js/http';
import { makeRouteDefinition } from './route-builder';

export type SingletonAction = 'create' | 'store' | 'show' | 'edit' | 'update' | 'destroy';

export interface SingletonBuilderState {
  singletonRoutes: RouteDefinition[];
  allRoutes: RouteDefinition[];
  addName: (name: string, def: RouteDefinition) => void;
  removeName: (name: string) => void;
  resourceName: string;
  groupName: string;
  groupPrefix: string;
  groupMiddleware: readonly string[];
  basePath: string;
  controller: Constructor;
  createVerb: string;
}

export class SingletonBuilder {
  readonly #state: SingletonBuilderState;
  #activeRoutes: RouteDefinition[];

  constructor(state: SingletonBuilderState) {
    this.#state = state;
    this.#activeRoutes = [...state.singletonRoutes];
    this.#registerDefaultNames();
  }

  #registerDefaultNames(): void {
    const { groupName, resourceName } = this.#state;
    for (const route of this.#activeRoutes) {
      if (route.resourceAction) {
        const name = `${groupName}${resourceName}.${route.resourceAction}`;
        route.name = name;
        this.#state.addName(name, route);
      }
    }
  }

  #addAction(method: HttpMethod, path: string, action: string): RouteDefinition {
    const { controller, groupMiddleware, groupName, resourceName, allRoutes, addName } =
      this.#state;
    const def = makeRouteDefinition(method, path, [controller, action], groupMiddleware);
    def.resourceAction = action;
    def.resourceName = `${groupName}${resourceName}`.replace(/\.$/, '');
    allRoutes.push(def);
    this.#activeRoutes.push(def);
    const name = `${groupName}${resourceName}.${action}`;
    def.name = name;
    addName(name, def);
    return def;
  }

  creatable(): this {
    const { basePath, createVerb } = this.#state;
    const existing = new Set(this.#activeRoutes.map((r) => r.resourceAction));
    if (!existing.has('create')) this.#addAction('GET', `${basePath}/${createVerb}`, 'create');
    if (!existing.has('store')) this.#addAction('POST', basePath, 'store');
    if (!existing.has('destroy')) this.#addAction('DELETE', basePath, 'destroy');
    return this;
  }

  destroyable(): this {
    const existing = new Set(this.#activeRoutes.map((r) => r.resourceAction));
    if (!existing.has('destroy')) this.#addAction('DELETE', this.#state.basePath, 'destroy');
    return this;
  }

  middleware(names: string | string[]): this {
    const mws = Array.isArray(names) ? names : [names];
    for (const route of this.#activeRoutes) route.middleware.push(...mws);
    return this;
  }

  middlewareFor(actions: SingletonAction | SingletonAction[], names: string | string[]): this {
    const acts = new Set<string>(Array.isArray(actions) ? actions : [actions]);
    const mws = Array.isArray(names) ? names : [names];
    for (const route of this.#activeRoutes) {
      if (acts.has(route.resourceAction ?? '')) route.middleware.push(...mws);
    }
    return this;
  }

  withoutMiddlewareFor(
    actions: SingletonAction | SingletonAction[],
    names: string | string[],
  ): this {
    const acts = new Set<string>(Array.isArray(actions) ? actions : [actions]);
    const mws = Array.isArray(names) ? names : [names];
    for (const route of this.#activeRoutes) {
      if (acts.has(route.resourceAction ?? '')) {
        (route.excludedMiddleware ??= []).push(...mws);
      }
    }
    return this;
  }
}
