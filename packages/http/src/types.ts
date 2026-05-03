import type { Constructor } from '@faber-js/core';
import type { Request } from './request';
import type { Response } from './response';

export type RuntimeName = 'node' | 'bun' | 'lambda' | 'cloudflare';

export interface AdapterOptions {
  readonly port?: number;
  readonly host?: string;
}

export type RequestHandler = (request: Request) => Promise<Response>;

export interface HttpAdapter {
  start(handler: RequestHandler, options?: AdapterOptions): Promise<void>;
  stop(): Promise<void>;
}

export interface AuthUser {
  id: string | number;
  [key: string]: unknown;
}

export interface UploadedFile {
  readonly fieldname: string;
  readonly filename: string;
  readonly mimetype: string;
  readonly size: number;
  toBuffer(): Promise<Buffer>;
  extension(): string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type NextFunction = (request: Request) => Promise<Response>;

export interface Middleware {
  handle(request: Request, next: NextFunction, ...params: string[]): Promise<Response>;
}

export interface TerminableMiddleware extends Middleware {
  terminate(request: Request, response: Response): Promise<void> | void;
}

export type ControllerAction =
  | readonly [Constructor, string]
  | readonly [Constructor]
  | Constructor
  | ((request: Request) => Promise<Response> | Response);

export interface RouteDefinition {
  readonly method: HttpMethod;
  path: string;
  readonly handler: ControllerAction;
  middleware: string[];
  excludedMiddleware?: string[];
  name?: string;
  constraints: Record<string, string>;
  missingHandler?: ControllerAction;
  domain?: string;
  resourceAction?: string;
  resourceName?: string;
  withTrashed?: boolean;
  scoped?: Record<string, string>;
}

export interface RateLimiterInterface {
  tooManyAttempts(key: string, maxAttempts: number): Promise<boolean>;
  increment(key: string, decaySeconds?: number): Promise<number>;
  availableIn(key: string): Promise<number>;
  clear(key: string): Promise<void>;
}

export type ModelBindingResolver = (
  value: string,
  request: Request,
) => Promise<unknown | null> | unknown | null;

export type BindingEntry =
  | { readonly kind: 'model'; readonly klass: Constructor; readonly column?: string }
  | { readonly kind: 'resolver'; readonly fn: ModelBindingResolver };

export interface RouterContract {
  getRoutes(): readonly RouteDefinition[];
  findByName(name: string): RouteDefinition | undefined;
  getGlobalPatterns(): ReadonlyMap<string, string>;
  getFallbackHandler(): ControllerAction | undefined;
  model(paramName: string, klass: Constructor, column?: string): void;
  bind(paramName: string, resolver: ModelBindingResolver): void;
  getExplicitBindings(): ReadonlyMap<string, BindingEntry>;
}

export interface PaginationMeta {
  readonly current_page: number;
  readonly last_page: number;
  readonly per_page: number;
  readonly total: number;
}

export interface PaginationLinks {
  readonly first: string | null;
  readonly last: string | null;
  readonly prev: string | null;
  readonly next: string | null;
}

export interface PaginatedResponse<T = unknown> {
  readonly data: T[];
  readonly meta: PaginationMeta;
  readonly links: PaginationLinks;
}

export interface ExceptionHandler {
  handle(error: unknown): Promise<Response | null> | Response | null;
}

export interface HttpKernelContract {
  use(middleware: Middleware): this;
  alias(name: string, middleware: Middleware): this;
  register(name: string, middleware: Middleware): this;
  pushGlobal(middleware: Middleware): this;
  appendToGroup(name: string, middlewares: string[]): this;
  prependToGroup(name: string, middlewares: string[]): this;
  middlewareGroup(name: string, middlewares: string[]): this;
  priority(orderedNames: string[]): this;
  listen(port: number, host?: string): Promise<void>;
  close(): Promise<void>;
  handleRequest(request: Request): Promise<Response>;
}
