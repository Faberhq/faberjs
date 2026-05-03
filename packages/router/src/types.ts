export interface RouteGroupOptions {
  readonly prefix?: string;
  readonly middleware?: string[];
  readonly name?: string;
  readonly domain?: string;
  readonly controller?: new (...args: never[]) => unknown;
}

export interface ResolvedGroup {
  readonly prefix: string;
  readonly middleware: readonly string[];
  readonly name: string;
  readonly domain?: string;
  readonly controller?: new (...args: never[]) => unknown;
}
