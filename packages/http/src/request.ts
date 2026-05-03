import type { AuthUser, RouteDefinition, SessionLike, UploadedFile } from './types';

export interface RequestOptions {
  readonly method: string;
  readonly path: string;
  readonly url?: string;
  readonly scheme?: string;
  readonly headers?: Record<string, string | string[] | undefined>;
  readonly body?: unknown;
  readonly query?: Record<string, string | string[] | undefined>;
  readonly params?: Record<string, string>;
  readonly ip?: string;
  readonly files?: Record<string, UploadedFile | UploadedFile[]>;
}

export class Request {
  #user: AuthUser | null = null;
  #attributes = new Map<string, unknown>();

  user<T extends AuthUser = AuthUser>(): T | null {
    return this.#user as T | null;
  }

  setUser(user: AuthUser | null): this {
    this.#user = user;
    return this;
  }

  // Arbitrary per-request attribute store — use this to pass resolved objects
  // (tenant, plan, rate-limit info, etc.) from middleware to controllers without
  // re-querying the database. Keys are namespaced strings by convention.
  setAttribute(key: string, value: unknown): this {
    this.#attributes.set(key, value);
    return this;
  }

  getAttribute<T = unknown>(key: string, fallback?: T): T | undefined {
    if (this.#attributes.has(key)) return this.#attributes.get(key) as T;
    return fallback;
  }

  hasAttribute(key: string): boolean {
    return this.#attributes.has(key);
  }

  readonly #method: string;
  readonly #path: string;
  readonly #rawUrl: string;
  #scheme: string;
  readonly #headers: Record<string, string | string[] | undefined>;
  readonly #body: Record<string, unknown>;
  readonly #query: Record<string, string | string[] | undefined>;
  #params: Record<string, string>;
  #ip: string;
  readonly #files: Record<string, UploadedFile | UploadedFile[]>;
  #validated: Record<string, unknown> | null = null;
  #mergedInput: Record<string, unknown> = {};

  constructor(options: RequestOptions) {
    this.#method = options.method.toUpperCase();
    this.#path = options.path;
    this.#rawUrl = options.url ?? options.path;
    this.#scheme = options.scheme ?? 'http';
    this.#headers = Request.normalizeHeaders(options.headers ?? {});
    this.#body = Request.parseBody(options.body);
    this.#query = options.query ?? {};
    this.#params = options.params ?? {};
    this.#ip = options.ip ?? '127.0.0.1';
    this.#files = options.files ?? {};
  }

  private static normalizeHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): Record<string, string | string[] | undefined> {
    const normalized: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }

  private static parseBody(body: unknown): Record<string, unknown> {
    if (body === null || body === undefined) return {};
    if (typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return {};
  }

  private get inputData(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.#query)) {
      result[key] = value;
    }
    for (const [key, value] of Object.entries(this.#body)) {
      result[key] = value;
    }
    for (const [key, value] of Object.entries(this.#mergedInput)) {
      result[key] = value;
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Path, Host & URL
  // -------------------------------------------------------------------------

  path(): string {
    return this.#path;
  }

  /** Request URL path only, no query string (e.g. `/users`). */
  url(): string {
    return this.#rawUrl;
  }

  /** Full absolute URL including query string (e.g. `http://example.com/users?page=1`). */
  fullUrl(): string {
    return `${this.schemeAndHttpHost()}${this.#rawUrl}`;
  }

  /** Full absolute URL with additional query parameters merged in. */
  fullUrlWithQuery(params: Record<string, string>): string {
    const wrapped = this.#rawUrl.startsWith('http')
      ? this.#rawUrl
      : `http://localhost${this.#rawUrl}`;
    const urlObj = new globalThis.URL(wrapped);
    for (const [key, value] of Object.entries(params)) {
      urlObj.searchParams.set(key, value);
    }
    return `${this.schemeAndHttpHost()}${urlObj.pathname}${urlObj.search}`;
  }

  /** Full absolute URL with specified query parameters removed. */
  fullUrlWithoutQuery(keys: string[]): string {
    const wrapped = this.#rawUrl.startsWith('http')
      ? this.#rawUrl
      : `http://localhost${this.#rawUrl}`;
    const urlObj = new globalThis.URL(wrapped);
    for (const key of keys) {
      urlObj.searchParams.delete(key);
    }
    const search = urlObj.search;
    return `${this.schemeAndHttpHost()}${urlObj.pathname}${search}`;
  }

  /** Hostname only, without port (e.g. `example.com`). */
  host(): string {
    return (this.header('host') ?? '').split(':')[0] ?? '';
  }

  /** Hostname with port if non-standard (e.g. `example.com:8080`). */
  httpHost(): string {
    return this.header('host') ?? '';
  }

  /** Scheme + hostname + port (e.g. `https://example.com:8080`). */
  schemeAndHttpHost(): string {
    return `${this.#scheme}://${this.httpHost()}`;
  }

  /**
   * Check if the request path matches any of the given patterns.
   * Use `*` as a wildcard (e.g. `'admin/*'`).
   */
  is(pattern: string | string[], ...rest: string[]): boolean {
    const patterns = Array.isArray(pattern) ? [...pattern, ...rest] : [pattern, ...rest];
    const p = this.path().replace(/^\//, '');
    return patterns.some((pat) => {
      const regexStr = '^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      return new RegExp(regexStr).test(p) || new RegExp(regexStr).test(this.path());
    });
  }

  /**
   * Check if the current route's name matches a pattern.
   * Use `*` as a wildcard (e.g. `'admin.*'`).
   */
  routeIs(pattern: string | string[], ...rest: string[]): boolean {
    const name = this.#currentRoute?.name;
    if (!name) return false;
    const patterns = Array.isArray(pattern) ? [...pattern, ...rest] : [pattern, ...rest];
    return patterns.some((pat) => {
      const regexStr = '^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      return new RegExp(regexStr).test(name);
    });
  }

  // -------------------------------------------------------------------------
  // HTTP Method
  // -------------------------------------------------------------------------

  method(): string {
    return this.#methodOverride ?? this.#method;
  }

  /** The real HTTP method, ignoring any spoofed override. */
  realMethod(): string {
    return this.#method;
  }

  /** Check whether the HTTP verb matches the given string (case-insensitive). */
  isMethod(method: string): boolean {
    return this.method() === method.toUpperCase();
  }

  // -------------------------------------------------------------------------
  // Headers
  // -------------------------------------------------------------------------

  header(key: string): string | null;
  header(key: string, fallback: string): string;
  header(key: string, fallback?: string): string | null {
    const value = this.#headers[key.toLowerCase()];
    if (Array.isArray(value)) return value[0] ?? fallback ?? null;
    return value ?? fallback ?? null;
  }

  hasHeader(key: string): boolean {
    const value = this.#headers[key.toLowerCase()];
    return value !== undefined && value !== null;
  }

  bearerToken(): string | null {
    const authorization = this.header('authorization');
    if (!authorization) return null;
    const match = /^[Bb]earer (.+)$/.exec(authorization);
    return match?.[1] ?? null;
  }

  // -------------------------------------------------------------------------
  // IP Address
  // -------------------------------------------------------------------------

  ip(): string {
    return this.#ip;
  }

  /** @internal Overwritten by TrustProxies after resolving X-Forwarded-For. */
  setIp(ip: string): void {
    this.#ip = ip;
  }

  /** @internal Overwritten by TrustProxies after resolving X-Forwarded-Proto. */
  setScheme(scheme: string): void {
    this.#scheme = scheme;
  }

  /**
   * All IP addresses in the proxy chain, with the originating client IP last.
   * Only reliable when TrustProxies middleware is active.
   */
  ips(): string[] {
    const xff = this.#headers['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff.join(',') : (xff ?? '');
    const chain = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    chain.push(this.#ip);
    return chain;
  }

  // -------------------------------------------------------------------------
  // Content Negotiation
  // -------------------------------------------------------------------------

  /** Returns all content types the client accepts, sorted by quality factor. */
  getAcceptableContentTypes(): string[] {
    const accept = this.header('accept') ?? '';
    if (!accept) return ['*/*'];
    return accept
      .split(',')
      .map((part) => {
        const [rawType, ...params] = part.trim().split(';');
        const type = rawType?.trim() ?? '';
        const qParam = params.find((p) => p.trim().startsWith('q='));
        const q = qParam ? parseFloat(qParam.split('=')[1] ?? '1') : 1;
        return { type, q };
      })
      .filter((e) => e.type)
      .sort((a, b) => b.q - a.q)
      .map((e) => e.type);
  }

  /** Returns true if any of the given content types are acceptable to the client. */
  accepts(types: string[]): boolean {
    const acceptable = this.getAcceptableContentTypes();
    return types.some((type) =>
      acceptable.some((a) => {
        if (a === '*/*') return true;
        if (a === type) return true;
        const [aMain] = a.split('/');
        const [tMain] = type.split('/');
        return a.endsWith('/*') && aMain === tMain;
      }),
    );
  }

  /**
   * Returns the most preferred type from the given list, or null if none are acceptable.
   */
  prefers(types: string[]): string | null {
    const acceptable = this.getAcceptableContentTypes();
    for (const a of acceptable) {
      for (const type of types) {
        if (a === '*/*') return type;
        if (a === type) return type;
        const [aMain] = a.split('/');
        const [tMain] = type.split('/');
        if (a.endsWith('/*') && aMain === tMain) return type;
      }
    }
    return null;
  }

  isJson(): boolean {
    const contentType = this.header('content-type') ?? '';
    return contentType.includes('application/json');
  }

  /** True when the client's most-preferred Accept type is JSON (not merely *\/*). */
  wantsJson(): boolean {
    const top = this.getAcceptableContentTypes()[0] ?? '';
    return top.includes('/json') || top.includes('+json');
  }

  /** True when the request carries a JSON body OR the client accepts JSON responses. */
  expectsJson(): boolean {
    return this.isJson() || this.accepts(['application/json']);
  }

  /** True when the client's most-preferred Accept type is `text/markdown`. */
  wantsMarkdown(): boolean {
    return (this.getAcceptableContentTypes()[0] ?? '') === 'text/markdown';
  }

  /** True when the client accepts `text/markdown` responses. */
  acceptsMarkdown(): boolean {
    return this.accepts(['text/markdown']);
  }

  // -------------------------------------------------------------------------
  // Input — retrieval
  // -------------------------------------------------------------------------

  input(key: string, fallback?: unknown): unknown {
    const data = this.inputData;
    if (key in data) return data[key];
    return fallback;
  }

  all(): Record<string, unknown> {
    return { ...this.inputData };
  }

  body(): Record<string, unknown> {
    return { ...this.#body };
  }

  query(): Record<string, string | string[] | undefined>;
  query(key: string): string | string[] | undefined;
  query(key: string, fallback: string): string;
  query(key?: string, fallback?: string | string[]): unknown {
    if (key === undefined) return { ...this.#query };
    const value = this.#query[key];
    return value !== undefined ? value : (fallback ?? null);
  }

  only(keys: string | string[], ...rest: string[]): Record<string, unknown> {
    const all = Array.isArray(keys) ? [...keys, ...rest] : [keys, ...rest];
    const data = this.inputData;
    return Object.fromEntries(all.filter((k) => k in data).map((k) => [k, data[k]]));
  }

  except(keys: string | string[], ...rest: string[]): Record<string, unknown> {
    const all = Array.isArray(keys) ? [...keys, ...rest] : [keys, ...rest];
    const data = this.inputData;
    const excluded = new Set(all);
    return Object.fromEntries(Object.entries(data).filter(([k]) => !excluded.has(k)));
  }

  // -------------------------------------------------------------------------
  // Input — type casting
  // -------------------------------------------------------------------------

  /** Returns the input value as a string, or empty string if absent. */
  string(key: string, fallback = ''): string {
    const value = this.input(key);
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  /** Returns the input value cast to an integer, or the fallback if absent/unparseable. */
  integer(key: string, fallback = 0): number {
    const value = this.input(key);
    if (value === null || value === undefined) return fallback;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Returns the input value as a boolean.
   * Truthy strings: `"1"`, `"true"`, `"on"`, `"yes"`.
   */
  boolean(key: string): boolean {
    const value = this.input(key);
    if (value === null || value === undefined || value === false) return false;
    if (value === true) return true;
    return ['1', 'true', 'on', 'yes'].includes(String(value).toLowerCase().trim());
  }

  /** Returns the input value as an array. Always returns an array; `[]` if absent. */
  array(key: string): unknown[] {
    const value = this.input(key);
    if (value === null || value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  }

  /**
   * Returns the input value as a Date.
   * Throws if the value is present but cannot be parsed.
   * Returns null if the key is absent.
   */
  date(key: string): Date | null {
    const value = this.input(key);
    if (value === null || value === undefined) return null;
    const d = new Date(String(value));
    if (isNaN(d.getTime())) {
      throw new Error(`The '${key}' field is not a valid date.`);
    }
    return d;
  }

  // -------------------------------------------------------------------------
  // Input — presence
  // -------------------------------------------------------------------------

  has(key: string): boolean;
  has(keys: string[]): boolean;
  has(key: string | string[]): boolean {
    const keys = Array.isArray(key) ? key : [key];
    const data = this.inputData;
    return keys.every((k) => k in data);
  }

  /** Returns true if any of the given keys are present in the input. */
  hasAny(keys: string | string[], ...rest: string[]): boolean {
    const all = Array.isArray(keys) ? [...keys, ...rest] : [keys, ...rest];
    const data = this.inputData;
    return all.some((k) => k in data);
  }

  /** Executes the callback if the key is present; optionally calls `fallback` otherwise. */
  whenHas(key: string, callback: (value: unknown) => void, fallback?: () => void): this {
    if (this.has(key)) {
      callback(this.input(key));
    } else {
      fallback?.();
    }
    return this;
  }

  filled(key: string): boolean {
    const value = this.input(key);
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  }

  /** Returns true if the key is absent or its value is an empty string. */
  isNotFilled(key: string | string[]): boolean {
    const keys = Array.isArray(key) ? key : [key];
    return keys.every((k) => !this.filled(k));
  }

  /** Returns true if any of the given keys have a non-empty value. */
  anyFilled(keys: string[]): boolean {
    return keys.some((k) => this.filled(k));
  }

  /** Executes the callback if the key is present and non-empty; optionally calls `fallback` otherwise. */
  whenFilled(key: string, callback: (value: unknown) => void, fallback?: () => void): this {
    if (this.filled(key)) {
      callback(this.input(key));
    } else {
      fallback?.();
    }
    return this;
  }

  missing(key: string): boolean {
    return !this.has(key);
  }

  /** Executes the callback if the key is absent; optionally calls `fallback` if it is present. */
  whenMissing(key: string, callback: () => void, fallback?: (value: unknown) => void): this {
    if (this.missing(key)) {
      callback();
    } else {
      fallback?.(this.input(key));
    }
    return this;
  }

  // -------------------------------------------------------------------------
  // Input — merging
  // -------------------------------------------------------------------------

  /** Merges additional data into the request input, overwriting existing keys. */
  merge(data: Record<string, unknown>): this {
    Object.assign(this.#mergedInput, data);
    return this;
  }

  /** Merges data into the request input only for keys not already present. */
  mergeIfMissing(data: Record<string, unknown>): this {
    const existing = this.inputData;
    for (const [key, value] of Object.entries(data)) {
      if (!(key in existing)) {
        this.#mergedInput[key] = value;
      }
    }
    return this;
  }

  // -------------------------------------------------------------------------
  // Validated data
  // -------------------------------------------------------------------------

  setValidated(data: Record<string, unknown>): void {
    this.#validated = data;
  }

  validated<T = Record<string, unknown>>(): T {
    if (this.#validated === null) {
      throw new Error(
        'Request data has not been validated. Call validate() on a FormRequest first.',
      );
    }
    return this.#validated as T;
  }

  // -------------------------------------------------------------------------
  // Session, flash & cookies
  // -------------------------------------------------------------------------

  /**
   * Returns the session attached by StartSession middleware, or null if none.
   * Typed as SessionLike so @faber-js/http stays decoupled from @faber-js/session.
   */
  session(): SessionLike | null {
    return this.getAttribute<SessionLike>('session') ?? null;
  }

  /** Flash all current input to the session for the next request. */
  flash(): void {
    const s = this.session();
    if (!s) return;
    for (const [key, value] of Object.entries(this.all())) {
      s.flash(key, value);
    }
  }

  /** Flash only the specified input keys to the session. */
  flashOnly(keys: string[]): void {
    const s = this.session();
    if (!s) return;
    for (const [key, value] of Object.entries(this.only(keys))) {
      s.flash(key, value);
    }
  }

  /** Flash all input except the specified keys to the session. */
  flashExcept(keys: string[]): void {
    const s = this.session();
    if (!s) return;
    for (const [key, value] of Object.entries(this.except(keys))) {
      s.flash(key, value);
    }
  }

  /**
   * Retrieve a value that was flashed to the session during the previous request.
   * Returns `defaultValue` if the key was not flashed.
   */
  old<T = string>(key: string, defaultValue?: T): T | undefined {
    return this.session()?.get<T>(key, defaultValue);
  }

  /**
   * Read a cookie from the incoming Cookie header.
   * Inlined to avoid a circular dependency with cookie.ts.
   */
  cookie(name: string, fallback?: string): string | undefined {
    const cookieHeader = this.header('cookie') ?? '';
    for (const pair of cookieHeader.split(';')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      try {
        const key = decodeURIComponent(pair.slice(0, eqIdx).trim());
        if (key === name) return decodeURIComponent(pair.slice(eqIdx + 1).trim());
      } catch {
        // malformed segment — skip
      }
    }
    return fallback;
  }

  // -------------------------------------------------------------------------
  // Files
  // -------------------------------------------------------------------------

  file(key: string): UploadedFile | null {
    const f = this.#files[key];
    if (!f) return null;
    return Array.isArray(f) ? (f[0] ?? null) : f;
  }

  files(key: string): UploadedFile[] {
    const f = this.#files[key];
    if (!f) return [];
    return Array.isArray(f) ? f : [f];
  }

  allFiles(): Record<string, UploadedFile | UploadedFile[]> {
    return { ...this.#files };
  }

  hasFile(key: string): boolean {
    return key in this.#files;
  }

  // -------------------------------------------------------------------------
  // Route / params
  // -------------------------------------------------------------------------

  route(param: string): string {
    return this.#params[param] ?? '';
  }

  params(): Readonly<Record<string, string>> {
    return this.#params;
  }

  /** @internal Used by the kernel to inject matched route parameters after path matching. */
  setRouteParams(params: Record<string, string>): void {
    this.#params = { ...params };
  }

  #currentRoute: RouteDefinition | null = null;

  /** @internal Set by the kernel after route matching. */
  setCurrentRoute(route: RouteDefinition): void {
    this.#currentRoute = route;
  }

  currentRoute(): RouteDefinition | null {
    return this.#currentRoute;
  }

  #methodOverride?: string;

  /** Override the HTTP method (used by method spoofing). */
  setMethodOverride(method: string): void {
    this.#methodOverride = method.toUpperCase();
  }
}
