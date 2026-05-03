import type { ControllerAction, HttpMethod, RouteDefinition } from '@faber-js/http';

export class RouteBuilder {
  readonly #definition: RouteDefinition;
  readonly #onName: (name: string, definition: RouteDefinition) => void;

  constructor(
    definition: RouteDefinition,
    onName: (name: string, definition: RouteDefinition) => void,
  ) {
    this.#definition = definition;
    this.#onName = onName;
  }

  name(routeName: string): this {
    this.#definition.name = routeName;
    this.#onName(routeName, this.#definition);
    return this;
  }

  middleware(names: string[]): this {
    this.#definition.middleware.push(...names);
    return this;
  }

  withoutMiddleware(names: string[]): this {
    (this.#definition.excludedMiddleware ??= []).push(...names);
    return this;
  }

  where(param: string, pattern: string): this {
    this.#definition.constraints[param] = pattern;
    return this;
  }

  whereNumber(...params: string[]): this {
    for (const p of params) this.where(p, '[0-9]+');
    return this;
  }

  whereAlpha(...params: string[]): this {
    for (const p of params) this.where(p, '[a-zA-Z]+');
    return this;
  }

  whereAlphaNumeric(...params: string[]): this {
    for (const p of params) this.where(p, '[a-zA-Z0-9]+');
    return this;
  }

  whereUuid(...params: string[]): this {
    for (const p of params)
      this.where(p, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
    return this;
  }

  whereUlid(...params: string[]): this {
    for (const p of params) this.where(p, '[0-9A-HJKMNP-TV-Z]{26}');
    return this;
  }

  whereIn(param: string, values: string[]): this {
    return this.where(param, values.map((v) => escapeRegex(v)).join('|'));
  }

  missing(handler: ControllerAction): this {
    this.#definition.missingHandler = handler;
    return this;
  }

  getDefinition(): RouteDefinition {
    return this.#definition;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function makeRouteDefinition(
  method: HttpMethod,
  path: string,
  handler: ControllerAction,
  middleware: readonly string[],
): RouteDefinition {
  return { method, path, handler, middleware: [...middleware], constraints: {} };
}
