import 'reflect-metadata';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest as RawFastifyRequest, FastifyReply } from 'fastify';
import type { ApplicationContract, Constructor } from '@faber-js/core';
import { Request } from './request';
import { Response } from './response';
import { Pipeline } from './pipeline';
import { HttpException } from './exceptions';
import { runWithRequest } from './request-context';
import { runWithCookieQueue, Cookie } from './cookie';
import { UploadedFileImpl } from './uploaded-file';
import type {
  BindingEntry,
  ControllerAction,
  ExceptionHandler,
  HttpKernelContract,
  Middleware,
  RouteDefinition,
  RouterContract,
  TerminableMiddleware,
  UploadedFile,
} from './types';

class ModelMissingError extends Error {
  constructor(readonly missingHandler: ControllerAction) {
    super('Route model binding not found');
  }
}

function lcFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function matchPathParams(pattern: string, pathname: string): Record<string, string> | null {
  const normalize = (s: string): string => s.replace(/\/$/, '') || '/';
  const patternParts = normalize(pattern).split('/');
  const pathParts = normalize(pathname).split('/');

  const lastPattern = patternParts[patternParts.length - 1] ?? '';
  const isLastOptional = /^\{[^}]+\?\}$/.test(lastPattern);

  if (isLastOptional) {
    if (pathParts.length !== patternParts.length && pathParts.length !== patternParts.length - 1) {
      return null;
    }
  } else if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i] ?? '';
    const vp = pathParts[i] ?? '';

    const optBrace = pp.match(/^\{(\w+)\?\}$/);
    if (optBrace) {
      if (vp) params[optBrace[1] ?? ''] = decodeURIComponent(vp);
      continue;
    }

    const reqBrace = pp.match(/^\{(\w+)\}$/);
    if (reqBrace) {
      params[reqBrace[1] ?? ''] = decodeURIComponent(vp);
      continue;
    }

    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(vp);
      continue;
    }

    if (pp !== vp) return null;
  }
  return params;
}

function domainToRegex(domain: string): RegExp {
  // Convert {param} placeholders to [^.]+ and escape everything else
  const pattern = domain
    .split('.')
    .map((seg) => (/^\{[^}]+\}$/.test(seg) ? '[^.]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('\\.');
  return new RegExp(`^${pattern}$`, 'i');
}

function buildFastifyUrls(
  path: string,
  constraints: Record<string, string>,
  globalPatterns: ReadonlyMap<string, string>,
): string[] {
  const segments = path.split('/');
  let baseUrl: string | null = null;

  const converted = segments.map((segment, index) => {
    const optBrace = segment.match(/^\{(\w+)\?\}$/);
    if (optBrace) {
      if (index !== segments.length - 1) {
        throw new Error(
          `Optional route parameter '{${optBrace[1]}?}' must be the last segment in: ${path}`,
        );
      }
      baseUrl = segments.slice(0, index).join('/') || '/';
      const paramName = optBrace[1] ?? '';
      const regex = constraints[paramName] ?? globalPatterns.get(paramName);
      return regex ? `:${paramName}(${regex})` : `:${paramName}`;
    }

    const reqBrace = segment.match(/^\{(\w+)\}$/);
    if (reqBrace) {
      const paramName = reqBrace[1] ?? '';
      const regex = constraints[paramName] ?? globalPatterns.get(paramName);
      return regex ? `:${paramName}(${regex})` : `:${paramName}`;
    }

    if (segment.startsWith(':')) {
      const paramName = segment.slice(1);
      const regex = constraints[paramName] ?? globalPatterns.get(paramName);
      return regex ? `:${paramName}(${regex})` : segment;
    }

    return segment;
  });

  const primaryUrl = converted.join('/') || '/';
  return baseUrl !== null ? [baseUrl as string, primaryUrl] : [primaryUrl];
}

function matchRoute(
  routes: readonly RouteDefinition[],
  method: string,
  pathname: string,
  host?: string,
): { route: RouteDefinition; params: Record<string, string> } | null {
  const upperMethod = method.toUpperCase();
  for (const route of routes) {
    if (route.method !== upperMethod) continue;
    const params = matchPathParams(route.path, pathname);
    if (params === null) continue;
    if (route.domain) {
      const domainPattern = domainToRegex(route.domain);
      const hostOnly = (host ?? '').split(':')[0] ?? '';
      if (!domainPattern.test(hostOnly)) continue;
      const domainParams = matchDomainParams(route.domain, hostOnly);
      return { route, params: { ...params, ...domainParams } };
    }
    return { route, params };
  }
  return null;
}

function matchDomainParams(domainPattern: string, host: string): Record<string, string> {
  const patternSegs = domainPattern.split('.');
  const hostSegs = host.split('.');
  const params: Record<string, string> = {};
  if (patternSegs.length !== hostSegs.length) return params;
  for (let i = 0; i < patternSegs.length; i++) {
    const ps = patternSegs[i] ?? '';
    const hs = hostSegs[i] ?? '';
    const m = ps.match(/^\{(\w+)\}$/);
    if (m) params[m[1] ?? ''] = hs;
  }
  return params;
}

/** Internal wrapper that pre-binds middleware parameters, preserving terminate if present. */
class BoundMiddleware implements Middleware {
  constructor(
    readonly inner: Middleware,
    private readonly boundParams: string[],
  ) {}

  handle(request: Request, next: (req: Request) => Promise<Response>): Promise<Response> {
    return this.inner.handle(request, next, ...this.boundParams);
  }
}

export class HttpKernel implements HttpKernelContract {
  private readonly fastify: FastifyInstance;
  private readonly globalMiddleware: Middleware[] = [];
  private readonly namedMiddleware = new Map<string, Middleware>();
  private readonly middlewareGroups = new Map<string, string[]>();
  private priorityList: string[] = [];
  private address = '';

  constructor(private readonly app: ApplicationContract) {
    this.fastify = Fastify({ logger: false });
    void this.fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  }

  use(middleware: Middleware): this {
    this.globalMiddleware.push(middleware);
    return this;
  }

  alias(name: string, middleware: Middleware): this {
    this.namedMiddleware.set(name, middleware);
    return this;
  }

  register(name: string, middleware: Middleware): this {
    return this.alias(name, middleware);
  }

  pushGlobal(middleware: Middleware): this {
    return this.use(middleware);
  }

  appendToGroup(name: string, middlewares: string[]): this {
    const existing = this.middlewareGroups.get(name) ?? [];
    this.middlewareGroups.set(name, [...existing, ...middlewares]);
    return this;
  }

  prependToGroup(name: string, middlewares: string[]): this {
    const existing = this.middlewareGroups.get(name) ?? [];
    this.middlewareGroups.set(name, [...middlewares, ...existing]);
    return this;
  }

  middlewareGroup(name: string, middlewares: string[]): this {
    this.middlewareGroups.set(name, middlewares);
    return this;
  }

  priority(orderedNames: string[]): this {
    this.priorityList = orderedNames;
    return this;
  }

  async listen(port: number, host = '127.0.0.1'): Promise<void> {
    let routeCount = 0;
    if (this.app.bound('router')) {
      const router = this.app.make<RouterContract>('router');
      routeCount = router.getRoutes().length;
      this.registerRoutes(router);
    }
    await this.fastify.listen({ port, host });
    const addrs = this.fastify.addresses();
    if (addrs.length > 0) {
      const first = addrs[0];
      this.address = `http://${first.address}:${first.port}`;
    }
    const providers = this.app.providerCount();
    process.stdout.write(
      `\x00__FABER_READY__${JSON.stringify({ routes: routeCount, providers, port })}\n`,
    );
  }

  async close(): Promise<void> {
    await this.fastify.close();
  }

  async handleRequest(
    request: Request,
    _files?: Record<string, UploadedFile | UploadedFile[]>,
  ): Promise<Response> {
    if (!this.app.bound('router')) {
      return Response.notFound('Not Found');
    }

    const router = this.app.make<RouterContract>('router');
    const host = request.header('host') ?? undefined;
    const match = matchRoute(router.getRoutes(), request.method(), request.path(), host);

    if (match === null) {
      const fallback = router.getFallbackHandler();
      if (fallback) {
        const pipeline = new Pipeline([...this.globalMiddleware], (req) =>
          this.invokeHandler(fallback, req),
        );
        try {
          const response = await runWithRequest(request, () => pipeline.send(request));
          await this.runTerminate([...this.globalMiddleware], request, response);
          return response;
        } catch (error: unknown) {
          return this.buildErrorResponse(error);
        }
      }
      return Response.notFound('Route not found');
    }

    const { route, params } = match;
    request.setRouteParams(params);
    request.setCurrentRoute(route);

    const routeMiddleware = this.resolveRouteMiddleware(route);
    const decoratorMiddleware = this.getDecoratorMiddleware(route.handler);
    const allMiddleware = [...this.globalMiddleware, ...routeMiddleware, ...decoratorMiddleware];

    const pipeline = new Pipeline(allMiddleware, (req) => this.invokeHandler(route.handler, req));

    try {
      const response = await runWithRequest(request, () => pipeline.send(request));
      await this.runTerminate(allMiddleware, request, response);
      return response;
    } catch (error: unknown) {
      return this.buildErrorResponse(error);
    }
  }

  getUrl(): string {
    return this.address;
  }

  /** Resolves and sorts route-specific middleware, applying exclusions, group expansion, and priority. */
  private resolveRouteMiddleware(route: RouteDefinition): Middleware[] {
    const excluded = route.excludedMiddleware ?? [];
    const effectiveNames = route.middleware.filter((name) => !excluded.includes(name));
    const sortedNames = this.sortNamesByPriority(effectiveNames);
    return this.expandAndResolve(sortedNames);
  }

  /**
   * Expands group names and resolves each middleware entry to an instance.
   * Parses `name:param1,param2` syntax and pre-binds params via BoundMiddleware.
   */
  private expandAndResolve(names: string[]): Middleware[] {
    const result: Middleware[] = [];
    for (const entry of names) {
      const colonIndex = entry.indexOf(':');
      const name = colonIndex === -1 ? entry : entry.slice(0, colonIndex);
      const paramString = colonIndex === -1 ? undefined : entry.slice(colonIndex + 1);
      const params = paramString ? paramString.split(',') : [];

      if (this.middlewareGroups.has(name) && params.length === 0) {
        result.push(...this.expandAndResolve(this.middlewareGroups.get(name) ?? []));
      } else {
        const mw = this.resolveMiddleware(name);
        if (mw !== undefined) {
          result.push(params.length > 0 ? new BoundMiddleware(mw, params) : mw);
        }
      }
    }
    return result;
  }

  private sortNamesByPriority(names: string[]): string[] {
    if (this.priorityList.length === 0) return names;

    // Strip params for priority comparison, then sort priority-listed ones first
    const indexOf = (entry: string): number => {
      const name = entry.includes(':') ? entry.slice(0, entry.indexOf(':')) : entry;
      return this.priorityList.indexOf(name);
    };

    const prioritized = names.filter((n) => indexOf(n) !== -1);
    const rest = names.filter((n) => indexOf(n) === -1);

    prioritized.sort((a, b) => indexOf(a) - indexOf(b));
    return [...prioritized, ...rest];
  }

  private resolveMiddleware(name: string): Middleware | undefined {
    const fromMap = this.namedMiddleware.get(name);
    if (fromMap) return fromMap;
    const containerKey = `middleware.${name}`;
    if (this.app.bound(containerKey)) {
      return this.app.make<Middleware>(containerKey);
    }
    return undefined;
  }

  private async runTerminate(
    middlewares: Middleware[],
    request: Request,
    response: Response,
  ): Promise<void> {
    for (const mw of middlewares) {
      const target = mw instanceof BoundMiddleware ? mw.inner : mw;
      if (
        'terminate' in target &&
        typeof (target as TerminableMiddleware).terminate === 'function'
      ) {
        await Promise.resolve((target as TerminableMiddleware).terminate(request, response));
      }
    }
  }

  private registerRoutes(router: RouterContract): void {
    const globalPatterns = router.getGlobalPatterns();

    for (const route of router.getRoutes()) {
      const { method, handler } = route;
      const fastifyUrls = buildFastifyUrls(route.path, route.constraints, globalPatterns);

      const domainPattern = route.domain ? domainToRegex(route.domain) : null;

      for (const url of fastifyUrls) {
        this.fastify.route({
          method,
          url,
          handler: async (rawReq: RawFastifyRequest, reply: FastifyReply) => {
            try {
              let extraParams: Record<string, string> = {};
              if (domainPattern && route.domain) {
                const host = (rawReq.headers['host'] ?? '').split(':')[0] ?? '';
                if (!domainPattern.test(host)) {
                  await reply.status(404).send({ message: 'Not Found' });
                  return;
                }
                extraParams = matchDomainParams(route.domain, host);
              }

              const { body, files } = await this.parseRequestBody(rawReq);
              const request = this.adaptRequest(rawReq, body, files);
              if (Object.keys(extraParams).length > 0) {
                request.setRouteParams({ ...request.params(), ...extraParams });
              }
              request.setCurrentRoute(route);

              const routeMiddleware = this.resolveRouteMiddleware(route);
              const decoratorMiddleware = this.getDecoratorMiddleware(handler);
              const allMiddleware = [
                ...this.globalMiddleware,
                ...routeMiddleware,
                ...decoratorMiddleware,
              ];

              const pipeline = new Pipeline(allMiddleware, (req) =>
                this.invokeHandler(handler, req),
              );
              const res = await runWithCookieQueue(() =>
                runWithRequest(request, () => pipeline.send(request)),
              );
              await this.sendResponse(reply, this.applyQueuedCookies(res));
              await this.runTerminate(allMiddleware, request, res);
            } catch (error: unknown) {
              await this.handleError(reply, error);
            }
          },
        });
      }
    }

    const fallback = router.getFallbackHandler();
    if (fallback) {
      this.fastify.setNotFoundHandler(async (rawReq: RawFastifyRequest, reply: FastifyReply) => {
        try {
          const { body, files } = await this.parseRequestBody(rawReq);
          const request = this.adaptRequest(rawReq, body, files);
          const pipeline = new Pipeline([...this.globalMiddleware], (req) =>
            this.invokeHandler(fallback, req),
          );
          const res = await runWithCookieQueue(() =>
            runWithRequest(request, () => pipeline.send(request)),
          );
          await this.sendResponse(reply, this.applyQueuedCookies(res));
        } catch (error: unknown) {
          await this.handleError(reply, error);
        }
      });
    }
  }

  private async parseRequestBody(rawReq: RawFastifyRequest): Promise<{
    body: Record<string, unknown>;
    files: Record<string, UploadedFile | UploadedFile[]>;
  }> {
    const contentType = (rawReq.headers['content-type'] ?? '').toLowerCase();
    if (!contentType.includes('multipart/form-data')) {
      const body =
        typeof rawReq.body === 'object' && rawReq.body !== null
          ? (rawReq.body as Record<string, unknown>)
          : {};
      return { body, files: {} };
    }

    const body: Record<string, unknown> = {};
    const files: Record<string, UploadedFile | UploadedFile[]> = {};

    // @fastify/multipart is registered; rawReq.parts() is available
    const req = rawReq as RawFastifyRequest & {
      parts(): AsyncIterable<{
        type: 'field' | 'file';
        fieldname: string;
        value?: unknown;
        filename?: string;
        mimetype?: string;
        toBuffer(): Promise<Buffer>;
      }>;
    };

    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        const uploadedFile: UploadedFile = new UploadedFileImpl({
          fieldname: part.fieldname,
          filename: part.filename ?? '',
          mimetype: part.mimetype ?? 'application/octet-stream',
          buffer,
        });
        const existing = files[part.fieldname];
        if (existing !== undefined) {
          files[part.fieldname] = [
            ...(Array.isArray(existing) ? existing : [existing]),
            uploadedFile,
          ];
        } else {
          files[part.fieldname] = uploadedFile;
        }
      } else {
        body[part.fieldname] = part.value;
      }
    }

    return { body, files };
  }

  private adaptRequest(
    rawReq: RawFastifyRequest,
    body?: Record<string, unknown>,
    files?: Record<string, UploadedFile | UploadedFile[]>,
  ): Request {
    const params =
      typeof rawReq.params === 'object' && rawReq.params !== null
        ? (rawReq.params as Record<string, string>)
        : {};
    const query =
      typeof rawReq.query === 'object' && rawReq.query !== null
        ? (rawReq.query as Record<string, string>)
        : {};

    return new Request({
      method: rawReq.method,
      path: rawReq.url.split('?')[0],
      url: rawReq.url,
      scheme: rawReq.protocol,
      headers: rawReq.headers as Record<string, string | string[] | undefined>,
      body: body ?? rawReq.body,
      query,
      params,
      ip: rawReq.ip,
      ...(files !== undefined && { files }),
    });
  }

  private async invokeHandler(handler: ControllerAction, request: Request): Promise<Response> {
    if (Array.isArray(handler)) {
      const tuple = handler as readonly [Constructor?, string?];
      const ControllerClass = tuple[0];
      if (!ControllerClass)
        throw new Error('Handler tuple must have a constructor as first element.');
      const methodName = tuple[1] ?? '__invoke';
      const controller = this.app.make(ControllerClass);
      const record = controller as Record<string, (...args: unknown[]) => Promise<Response>>;
      if (typeof record[methodName] !== 'function') {
        throw new Error(`Method [${methodName}] not found on [${ControllerClass.name}].`);
      }
      await this.checkAuthorize(ControllerClass, methodName, request);
      try {
        const args = await this.resolveMethodArgs(ControllerClass, methodName, request);
        return record[methodName].apply(controller, args);
      } catch (e) {
        if (e instanceof ModelMissingError) return this.invokeHandler(e.missingHandler, request);
        throw e;
      }
    }

    if (typeof handler === 'function') {
      const isClass = /^\s*class[\s{]/.test(Function.prototype.toString.call(handler));
      if (!isClass) {
        return (handler as (req: Request) => Promise<Response>)(request);
      }
      const ControllerClass = handler as Constructor;
      const controller = this.app.make(ControllerClass);
      const record = controller as Record<string, (...args: unknown[]) => Promise<Response>>;
      if (typeof record['__invoke'] !== 'function') {
        throw new Error(`Method [__invoke] not found on [${ControllerClass.name}].`);
      }
      await this.checkAuthorize(ControllerClass, '__invoke', request);
      try {
        const args = await this.resolveMethodArgs(ControllerClass, '__invoke', request);
        return record['__invoke'].apply(controller, args);
      } catch (e) {
        if (e instanceof ModelMissingError) return this.invokeHandler(e.missingHandler, request);
        throw e;
      }
    }

    throw new Error('Unrecognized handler type in invokeHandler.');
  }

  private getDecoratorMiddleware(handler: ControllerAction): Middleware[] {
    let ControllerClass: Constructor | undefined;
    let methodName: string | undefined;

    if (Array.isArray(handler)) {
      const tuple = handler as readonly [Constructor, string?];
      ControllerClass = tuple[0];
      methodName = tuple[1] ?? '__invoke';
    } else if (typeof handler === 'function') {
      const isClass = /^\s*class[\s{]/.test(Function.prototype.toString.call(handler));
      if (isClass) {
        ControllerClass = handler as Constructor;
        methodName = '__invoke';
      }
    }

    if (!ControllerClass || !methodName) return [];

    const CTRL_MW_KEY = Symbol.for('faber:controller:middleware');
    const METHOD_MW_KEY = Symbol.for('faber:method:middleware');

    interface MwEntry {
      name: string;
      only?: string[];
      except?: string[];
    }

    const classEntries: MwEntry[] = Reflect.getMetadata(CTRL_MW_KEY, ControllerClass) ?? [];
    const methodEntries: MwEntry[] =
      Reflect.getMetadata(METHOD_MW_KEY, ControllerClass.prototype, methodName) ?? [];

    const method = methodName;
    const effectiveClass = classEntries.filter((e) => {
      if (e.only && !e.only.includes(method)) return false;
      if (e.except && e.except.includes(method)) return false;
      return true;
    });

    const names = [...effectiveClass.map((e) => e.name), ...methodEntries.map((e) => e.name)];
    return this.expandAndResolve(names);
  }

  private async checkAuthorize(
    ControllerClass: Constructor,
    methodName: string,
    request: Request,
  ): Promise<void> {
    const AUTHORIZE_KEY = Symbol.for('faber:authorize');

    interface AuthEntry {
      ability: string;
      model?: Constructor | string | readonly [Constructor, string];
    }

    const entries: AuthEntry[] =
      Reflect.getMetadata(AUTHORIZE_KEY, ControllerClass.prototype, methodName) ?? [];

    if (entries.length === 0 || !this.app.bound('gate')) return;

    const gate = this.app.make<{
      allows(ability: string, ...args: unknown[]): Promise<boolean> | boolean;
    }>('gate');

    for (const { ability, model } of entries) {
      let allowed: boolean;

      if (model === undefined) {
        allowed = await Promise.resolve(gate.allows(ability));
      } else if (typeof model === 'string') {
        allowed = await Promise.resolve(gate.allows(ability, request.route(model)));
      } else if (Array.isArray(model)) {
        const [ModelClass, paramName] = model as [Constructor, string];
        allowed = await Promise.resolve(gate.allows(ability, ModelClass, request.route(paramName)));
      } else {
        allowed = await Promise.resolve(gate.allows(ability, model));
      }

      if (!allowed) {
        throw new HttpException('This action is unauthorized.', 403);
      }
    }
  }

  private async resolveMethodArgs(
    ControllerClass: Constructor,
    methodName: string,
    request: Request,
  ): Promise<unknown[]> {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      ControllerClass.prototype,
      methodName,
    ) as Array<Constructor | undefined> | undefined;

    if (!paramTypes || paramTypes.length === 0) return [request];

    const results: unknown[] = [];
    for (const ParamType of paramTypes) {
      if (!ParamType) {
        results.push(undefined);
        continue;
      }
      if (ParamType === (Request as unknown as Constructor)) {
        results.push(request);
        continue;
      }

      if (this.isRouteBindable(ParamType)) {
        const paramName = lcFirst(ParamType.name);
        const resolved = await this.resolveModelParam(ParamType, paramName, request);
        if (resolved === null || resolved === undefined) {
          const route = request.currentRoute();
          if (route?.missingHandler) throw new ModelMissingError(route.missingHandler);
          throw new HttpException(`No query results for model [${ParamType.name}].`, 404);
        }
        results.push(resolved);
        continue;
      }

      results.push(this.app.bound(ParamType) ? this.app.make(ParamType) : undefined);
    }
    return results;
  }

  private isRouteBindable(klass: Constructor): boolean {
    return typeof (klass as unknown as Record<string, unknown>).resolveRouteBinding === 'function';
  }

  private async resolveModelParam(
    ModelClass: Constructor,
    paramName: string,
    request: Request,
  ): Promise<unknown> {
    const routeValue = request.route(paramName);
    if (!routeValue) return null;

    if (this.app.bound('router')) {
      const router = this.app.make<RouterContract>('router');
      const binding = router.getExplicitBindings().get(paramName) as BindingEntry | undefined;
      if (binding) {
        if (binding.kind === 'resolver') return binding.fn(routeValue, request);
        const { klass, column } = binding;
        const resolver = (
          klass as unknown as Record<string, (v: string, f?: string) => Promise<unknown>>
        ).resolveRouteBinding;
        return typeof resolver === 'function' ? resolver.call(klass, routeValue, column) : null;
      }
    }

    const implicitResolver = (
      ModelClass as unknown as Record<string, (v: string) => Promise<unknown>>
    ).resolveRouteBinding;
    return typeof implicitResolver === 'function'
      ? implicitResolver.call(ModelClass, routeValue)
      : null;
  }

  private applyQueuedCookies(res: Response): Response {
    const queued = Cookie.getQueued();
    return queued.reduce((r, serialized) => r.withCookie(serialized), res);
  }

  private async sendResponse(reply: FastifyReply, res: Response): Promise<void> {
    const headers = res.getHeaders();
    for (const [key, value] of Object.entries(headers)) {
      void reply.header(key, value as string | string[]);
    }

    const body = res.getBody();
    if (body === null) {
      const ctRaw = res.getHeaders()['content-type'] ?? '';
      const contentType = Array.isArray(ctRaw) ? ctRaw.join(',') : ctRaw;
      if (contentType.includes('application/json')) {
        await reply.status(res.getStatus()).send('null');
        return;
      }
      await reply.status(res.getStatus()).send();
      return;
    }

    if (typeof body === 'object' && body !== null && Symbol.asyncIterator in body) {
      const { Readable } = await import('node:stream');
      const readable = Readable.from(body as AsyncIterable<string>);
      await reply.status(res.getStatus()).send(readable);
      return;
    }

    await reply.status(res.getStatus()).send(body);
  }

  private async buildErrorResponse(error: unknown): Promise<Response> {
    // Call the global exception reporter (Sentry / Bugsnag integration point)
    if (this.app.bound('exception.reporter')) {
      const reporter = this.app.make<(e: unknown) => Promise<void>>('exception.reporter');
      await Promise.resolve(reporter(error)).catch((_reporterError: unknown) => {
        // Suppress reporter errors so they never mask the original exception.
      });
    }

    if (this.app.bound('exception.handler')) {
      const handler = this.app.make<ExceptionHandler>('exception.handler');
      const response = await Promise.resolve(handler.handle(error));
      if (response !== null) return response;
    }

    if (error instanceof HttpException) {
      const body: Record<string, unknown> = { message: error.message };
      if (error.data !== undefined) body['errors'] = error.data;
      return Response.json(body, error.statusCode);
    }

    if (error instanceof Error && 'statusCode' in error) {
      const statusCode = (error as { statusCode: number }).statusCode;
      const data = (error as { data?: unknown }).data;
      const body: Record<string, unknown> = { message: error.message };
      if (data !== undefined) body['errors'] = data;
      return Response.json(body, statusCode);
    }

    if (error instanceof Error && 'code' in error) {
      const code = (error as { code: string }).code;
      const isUniqueViolation =
        code === 'ER_DUP_ENTRY' ||
        code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        code === 'SQLITE_CONSTRAINT' ||
        code === '23505';
      if (isUniqueViolation) {
        return Response.json({ message: 'A conflicting record already exists.' }, 409);
      }
      if ('errno' in error || 'sqlMessage' in error || 'sql' in error) {
        const logMsg = error instanceof Error ? (error.stack ?? error.message) : String(error);
        this.logError(logMsg);
        return Response.error('Internal Server Error', 500);
      }
    }

    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    this.logError(message);
    return Response.error('Internal Server Error', 500);
  }

  private logError(message: string): void {
    if (this.app.bound('log')) {
      const logger = this.app.make<{ error(msg: string): void }>('log');
      logger.error(message);
    } else {
      process.stderr.write(`\x1b[31mERROR\x1b[0m ${message}\n`);
    }
  }

  private async handleError(reply: FastifyReply, error: unknown): Promise<void> {
    const res = await this.buildErrorResponse(error);
    await this.sendResponse(reply, res);
  }
}
