import type { RawHtml } from './escape';

export interface ViewRendererConfig {
  readonly viewsDir: string;
  readonly extension?: string;
  readonly driver?: 'tsx' | 'ejs';
  readonly cacheDir?: string;
}

export type ViewComponent<P extends Record<string, unknown> = Record<string, unknown>> = (
  props: P,
) => RawHtml;

export interface IViewResponse {
  with(key: string, value: unknown): this;
  with(data: Record<string, unknown>): this;
  getName(): string;
  getData(): Record<string, unknown>;
}

export type ComposerFn = (view: IViewResponse) => void | Promise<void>;

export interface ComposerClassInstance {
  compose(view: IViewResponse): void | Promise<void>;
}

export type ComposerClass = new (...args: unknown[]) => ComposerClassInstance;

export type ComposerHandler = ComposerFn | ComposerClass;

export interface HookEntry {
  pattern: string;
  handler: ComposerHandler;
}
