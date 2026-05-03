import type { Constructor } from '@faber-js/core';
import type {
  BindingEntry,
  ControllerAction,
  HttpMethod,
  ModelBindingResolver,
  RouteDefinition,
  RouterContract,
} from '@faber-js/http';
import { Response } from '@faber-js/http';
import { RouteBuilder, makeRouteDefinition } from './route-builder';
import { ResourceBuilder, singularize } from './resource-builder';
import { SingletonBuilder } from './singleton-builder';
import type { ResolvedGroup, RouteGroupOptions } from './types';

// ── Resource verb localisation ────────────────────────────────────────────────

interface ResourceVerbs {
  create: string;
  edit: string;
}

let _verbs: ResourceVerbs = { create: 'create', edit: 'edit' };

type ResourceAction = 'index' | 'create' | 'store' | 'show' | 'edit' | 'update' | 'destroy';

const ALL_RESOURCE_ACTIONS: ResourceAction[] = [
  'index',
  'create',
  'store',
  'show',
  'edit',
  'update',
  'destroy',
];

// ── Path helpers ──────────────────────────────────────────────────────────────

function buildResourceBase(segments: string[]): { basePath: string; paramName: string } {
  let basePath = '';
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i] ?? '';
    basePath += `/${seg}/:${singularize(seg)}`;
  }
  const last = segments[segments.length - 1] ?? '';
  basePath += `/${last}`;
  return { basePath, paramName: singularize(last) };
}

function buildSingletonBase(segments: string[]): string {
  let base = '';
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i] ?? '';
    base += `/${seg}/:${singularize(seg)}`;
  }
  base += `/${segments[segments.length - 1]}`;
  return base;
}

// ── Router ────────────────────────────────────────────────────────────────────

export class Router implements RouterContract {
  private readonly routes: RouteDefinition[] = [];
  private readonly namedRoutes = new Map<string, RouteDefinition>();
  private readonly groupStack: ResolvedGroup[] = [];
  private readonly globalPatterns = new Map<string, string>();
  private readonly _bindings = new Map<string, BindingEntry>();
  private _fallbackHandler?: ControllerAction;

  // ── Static configuration ──────────────────────────────────────────────────

  static resourceVerbs(verbs: Partial<ResourceVerbs>): void {
    _verbs = { ..._verbs, ...verbs };
  }

  // ── Verb methods ──────────────────────────────────────────────────────────

  get(path: string, handler: ControllerAction | string): RouteBuilder {
    return this.addRoute('GET', path, handler);
  }

  post(path: string, handler: ControllerAction | string): RouteBuilder {
    return this.addRoute('POST', path, handler);
  }

  put(path: string, handler: ControllerAction | string): RouteBuilder {
    return this.addRoute('PUT', path, handler);
  }

  patch(path: string, handler: ControllerAction | string): RouteBuilder {
    return this.addRoute('PATCH', path, handler);
  }

  delete(path: string, handler: ControllerAction | string): RouteBuilder {
    return this.addRoute('DELETE', path, handler);
  }

  options(path: string, handler: ControllerAction | string): RouteBuilder {
    return this.addRoute('OPTIONS', path, handler);
  }

  match(methods: HttpMethod[], path: string, handler: ControllerAction | string): RouteBuilder {
    let builder!: RouteBuilder;
    for (const method of methods) {
      builder = this.addRoute(method, path, handler);
    }
    return builder;
  }

  any(path: string, handler: ControllerAction | string): RouteBuilder {
    return this.match(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], path, handler);
  }

  redirect(from: string, to: string, status = 302): RouteBuilder {
    return this.addRoute('GET', from, (_req) => Promise.resolve(Response.redirect(to, status)));
  }

  permanentRedirect(from: string, to: string): RouteBuilder {
    return this.redirect(from, to, 301);
  }

  // ── Group ─────────────────────────────────────────────────────────────────

  group(options: RouteGroupOptions, callback: () => void): void {
    const parent = this.currentGroup();
    const resolvedDomain = options.domain ?? parent.domain;
    const resolvedController = options.controller ?? parent.controller;
    const resolved: ResolvedGroup = {
      prefix: parent.prefix + (options.prefix ?? ''),
      middleware: [...parent.middleware, ...(options.middleware ?? [])],
      name: parent.name + (options.name ?? ''),
      ...(resolvedDomain !== undefined ? { domain: resolvedDomain } : {}),
      ...(resolvedController !== undefined ? { controller: resolvedController } : {}),
    };
    this.groupStack.push(resolved);
    callback();
    this.groupStack.pop();
  }

  // ── Fallback / global patterns ────────────────────────────────────────────

  fallback(handler: ControllerAction): void {
    this._fallbackHandler = handler;
  }

  getFallbackHandler(): ControllerAction | undefined {
    return this._fallbackHandler;
  }

  pattern(name: string, regex: string): void {
    this.globalPatterns.set(name, regex);
  }

  getGlobalPatterns(): ReadonlyMap<string, string> {
    return this.globalPatterns;
  }

  model(paramName: string, klass: Constructor, column?: string): void {
    this._bindings.set(paramName, {
      kind: 'model',
      klass,
      ...(column !== undefined ? { column } : {}),
    });
  }

  bind(paramName: string, resolver: ModelBindingResolver): void {
    this._bindings.set(paramName, { kind: 'resolver', fn: resolver });
  }

  getExplicitBindings(): ReadonlyMap<string, BindingEntry> {
    return this._bindings;
  }

  // ── Resource routes ───────────────────────────────────────────────────────

  resource(name: string, controller: Constructor): ResourceBuilder {
    const group = this.currentGroup();
    const segments = name.split('.');
    const { basePath, paramName } = buildResourceBase(segments);
    const fullBase = group.prefix + basePath;
    const v = _verbs;

    const pathMap: Record<ResourceAction, { method: HttpMethod; suffix: string }> = {
      index: { method: 'GET', suffix: '' },
      create: { method: 'GET', suffix: `/${v.create}` },
      store: { method: 'POST', suffix: '' },
      show: { method: 'GET', suffix: `/:${paramName}` },
      edit: { method: 'GET', suffix: `/:${paramName}/${v.edit}` },
      update: { method: 'PUT', suffix: `/:${paramName}` },
      destroy: { method: 'DELETE', suffix: `/:${paramName}` },
    };

    const resourceRoutes: RouteDefinition[] = [];
    const resourceName = segments.join('.');
    const qualifiedName = group.name + resourceName;

    for (const action of ALL_RESOURCE_ACTIONS) {
      const { method, suffix } = pathMap[action];
      const def = makeRouteDefinition(
        method,
        `${fullBase}${suffix}`,
        [controller, action],
        group.middleware,
      );
      def.resourceAction = action;
      def.resourceName = qualifiedName;
      this.routes.push(def);
      resourceRoutes.push(def);
    }

    return new ResourceBuilder({
      resourceRoutes,
      allRoutes: this.routes,
      addName: (n, d) => this.namedRoutes.set(n, d),
      removeName: (n) => this.namedRoutes.delete(n),
      resourceName,
      groupName: group.name,
      groupPrefix: group.prefix,
      isNested: segments.length > 1,
    });
  }

  resources(map: Record<string, Constructor>): void {
    for (const [name, ctrl] of Object.entries(map)) this.resource(name, ctrl);
  }

  apiResource(name: string, controller: Constructor): ResourceBuilder {
    return this.resource(name, controller).only(['index', 'store', 'show', 'update', 'destroy']);
  }

  apiResources(map: Record<string, Constructor>): void {
    for (const [name, ctrl] of Object.entries(map)) this.apiResource(name, ctrl);
  }

  softDeletableResources(map: Record<string, Constructor>): void {
    for (const [name, ctrl] of Object.entries(map)) this.resource(name, ctrl).withTrashed();
  }

  // ── Singleton resource routes ─────────────────────────────────────────────

  singleton(name: string, controller: Constructor): SingletonBuilder {
    const group = this.currentGroup();
    const segments = name.split('.');
    const basePath = group.prefix + buildSingletonBase(segments);
    const v = _verbs;

    const singletonRoutes: RouteDefinition[] = [];
    const resourceName = segments.join('.');
    const qualifiedName = group.name + resourceName;

    for (const { method, suffix, action } of [
      { method: 'GET' as const, suffix: '', action: 'show' },
      { method: 'GET' as const, suffix: `/${v.edit}`, action: 'edit' },
      { method: 'PUT' as const, suffix: '', action: 'update' },
    ]) {
      const def = makeRouteDefinition(
        method,
        `${basePath}${suffix}`,
        [controller, action],
        group.middleware,
      );
      def.resourceAction = action;
      def.resourceName = qualifiedName;
      this.routes.push(def);
      singletonRoutes.push(def);
    }

    return new SingletonBuilder({
      singletonRoutes,
      allRoutes: this.routes,
      addName: (n, d) => this.namedRoutes.set(n, d),
      removeName: (n) => this.namedRoutes.delete(n),
      resourceName,
      groupName: group.name,
      groupPrefix: group.prefix,
      groupMiddleware: group.middleware,
      basePath,
      controller,
      createVerb: v.create,
    });
  }

  apiSingleton(name: string, controller: Constructor): SingletonBuilder {
    const group = this.currentGroup();
    const segments = name.split('.');
    const basePath = group.prefix + buildSingletonBase(segments);

    const singletonRoutes: RouteDefinition[] = [];
    const resourceName = segments.join('.');
    const qualifiedName = group.name + resourceName;

    for (const [method, action] of [
      ['GET', 'show'],
      ['PUT', 'update'],
    ] as const) {
      const def = makeRouteDefinition(method, basePath, [controller, action], group.middleware);
      def.resourceAction = action;
      def.resourceName = qualifiedName;
      this.routes.push(def);
      singletonRoutes.push(def);
    }

    return new SingletonBuilder({
      singletonRoutes,
      allRoutes: this.routes,
      addName: (n, d) => this.namedRoutes.set(n, d),
      removeName: (n) => this.namedRoutes.delete(n),
      resourceName,
      groupName: group.name,
      groupPrefix: group.prefix,
      groupMiddleware: group.middleware,
      basePath,
      controller,
      createVerb: _verbs.create,
    });
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  getRoutes(): readonly RouteDefinition[] {
    return this.routes;
  }

  findByName(name: string): RouteDefinition | undefined {
    return this.namedRoutes.get(name);
  }

  private addRoute(
    method: HttpMethod,
    path: string,
    handler: ControllerAction | string,
  ): RouteBuilder {
    const group = this.currentGroup();
    const fullPath = group.prefix + path;
    const resolvedHandler = this.resolveHandler(handler, group);
    const definition = makeRouteDefinition(method, fullPath, resolvedHandler, group.middleware);
    if (group.domain) definition.domain = group.domain;
    this.routes.push(definition);

    return new RouteBuilder(definition, (routeName, def) => {
      const qualifiedName = group.name + routeName;
      this.namedRoutes.set(qualifiedName, def);
    });
  }

  private resolveHandler(
    handler: ControllerAction | string,
    group: ResolvedGroup,
  ): ControllerAction {
    if (typeof handler === 'string') {
      if (!group.controller) {
        throw new Error(`Cannot use method name '${handler}' without a controller group.`);
      }
      return [group.controller as Constructor, handler];
    }
    return handler;
  }

  private currentGroup(): ResolvedGroup {
    return this.groupStack[this.groupStack.length - 1] ?? { prefix: '', middleware: [], name: '' };
  }
}
