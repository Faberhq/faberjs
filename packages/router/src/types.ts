export interface RouteGroupOptions {
  readonly prefix?: string;
  readonly middleware?: string[];
  readonly name?: string;
}

export interface ResolvedGroup {
  readonly prefix: string;
  readonly middleware: readonly string[];
  readonly name: string;
}
