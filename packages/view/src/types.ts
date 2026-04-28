import type { RawHtml } from './escape';

export interface ViewRendererConfig {
  readonly viewsDir: string;
  readonly extension?: string;
}

export type ViewComponent<P extends Record<string, unknown> = Record<string, unknown>> = (
  props: P,
) => RawHtml;
