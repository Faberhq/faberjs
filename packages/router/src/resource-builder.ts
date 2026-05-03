import type { ControllerAction, RouteDefinition } from '@faber-js/http';

export type ResourceAction = 'index' | 'create' | 'store' | 'show' | 'edit' | 'update' | 'destroy';

const MEMBER_ACTIONS: ReadonlySet<ResourceAction> = new Set(['show', 'edit', 'update', 'destroy']);

export function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (
    word.endsWith('sses') ||
    word.endsWith('shes') ||
    word.endsWith('ches') ||
    word.endsWith('xes') ||
    word.endsWith('zes')
  ) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export interface ResourceBuilderState {
  resourceRoutes: RouteDefinition[];
  allRoutes: RouteDefinition[];
  addName: (name: string, def: RouteDefinition) => void;
  removeName: (name: string) => void;
  resourceName: string;
  groupName: string;
  groupPrefix: string;
  isNested: boolean;
}

export class ResourceBuilder {
  readonly #state: ResourceBuilderState;
  #activeRoutes: RouteDefinition[];

  constructor(state: ResourceBuilderState) {
    this.#state = state;
    this.#activeRoutes = [...state.resourceRoutes];
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

  #removeRoute(route: RouteDefinition): void {
    const idx = this.#state.allRoutes.indexOf(route);
    if (idx !== -1) this.#state.allRoutes.splice(idx, 1);
    const activeIdx = this.#activeRoutes.indexOf(route);
    if (activeIdx !== -1) this.#activeRoutes.splice(activeIdx, 1);
    if (route.name) this.#state.removeName(route.name);
  }

  only(actions: ResourceAction[]): this {
    const keep = new Set<string>(actions);
    for (const route of [...this.#activeRoutes]) {
      if (!keep.has(route.resourceAction ?? '')) this.#removeRoute(route);
    }
    return this;
  }

  except(actions: ResourceAction[]): this {
    const exclude = new Set<string>(actions);
    for (const route of [...this.#activeRoutes]) {
      if (exclude.has(route.resourceAction ?? '')) this.#removeRoute(route);
    }
    return this;
  }

  names(overrides: Partial<Record<ResourceAction, string>>): this {
    for (const route of this.#activeRoutes) {
      const action = route.resourceAction as ResourceAction | undefined;
      if (!action) continue;
      const newName = overrides[action];
      if (newName === undefined) continue;
      if (route.name) this.#state.removeName(route.name);
      route.name = newName;
      this.#state.addName(newName, route);
    }
    return this;
  }

  parameters(overrides: Record<string, string>): this {
    for (const [segment, newParam] of Object.entries(overrides)) {
      const currentParam = singularize(segment);
      const pattern = new RegExp(`:${currentParam}(?=[^a-zA-Z0-9_]|$)`, 'g');
      for (const route of this.#activeRoutes) {
        route.path = route.path.replace(pattern, `:${newParam}`);
      }
    }
    return this;
  }

  shallow(): this {
    if (!this.#state.isNested) return this;
    const { resourceName, groupName, groupPrefix } = this.#state;
    const segments = resourceName.split('.');
    const childSegment = segments[segments.length - 1] ?? '';
    const paramName = singularize(childSegment);

    for (const route of this.#activeRoutes) {
      const action = route.resourceAction as ResourceAction | undefined;
      if (!action || !MEMBER_ACTIONS.has(action)) continue;

      let newPath = `${groupPrefix}/${childSegment}/:${paramName}`;
      if (action === 'edit') newPath += '/edit';
      route.path = newPath;

      const newName = `${groupName}${childSegment}.${action}`;
      if (route.name) this.#state.removeName(route.name);
      route.name = newName;
      this.#state.addName(newName, route);
    }
    return this;
  }

  scoped(fields: Record<string, string>): this {
    for (const route of this.#activeRoutes) {
      route.scoped = { ...(route.scoped ?? {}), ...fields };
    }
    return this;
  }

  missing(handler: ControllerAction): this {
    for (const route of this.#activeRoutes) {
      route.missingHandler = handler;
    }
    return this;
  }

  withTrashed(actions?: ResourceAction[]): this {
    const targets = actions
      ? this.#activeRoutes.filter((r) => actions.includes(r.resourceAction as ResourceAction))
      : this.#activeRoutes;
    for (const route of targets) {
      route.withTrashed = true;
    }
    return this;
  }

  middleware(names: string | string[]): this {
    const mws = Array.isArray(names) ? names : [names];
    for (const route of this.#activeRoutes) {
      route.middleware.push(...mws);
    }
    return this;
  }

  middlewareFor(actions: ResourceAction | ResourceAction[], names: string | string[]): this {
    const acts = new Set<string>(Array.isArray(actions) ? actions : [actions]);
    const mws = Array.isArray(names) ? names : [names];
    for (const route of this.#activeRoutes) {
      if (acts.has(route.resourceAction ?? '')) route.middleware.push(...mws);
    }
    return this;
  }

  withoutMiddlewareFor(actions: ResourceAction | ResourceAction[], names: string | string[]): this {
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
