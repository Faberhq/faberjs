import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ViewRendererConfig, ViewComponent } from './types';
import type { RawHtml } from './escape';
import { ViewNotFoundException } from './ViewNotFoundException';

export class ViewRenderer {
  readonly #config: ViewRendererConfig;

  constructor(config: ViewRendererConfig) {
    this.#config = config;
  }

  renderComponent<P extends Record<string, unknown>>(
    component: ViewComponent<P>,
    props: P,
  ): string {
    return component(props).html;
  }

  async render<P extends Record<string, unknown>>(name: string, props: P): Promise<string> {
    const resolved = this.#resolveViewPath(name);
    const url = pathToFileURL(resolved).href;
    const mod = (await import(url)) as { default?: ViewComponent<P> | ((props: P) => RawHtml) };

    if (typeof mod.default !== 'function') {
      throw new ViewNotFoundException(name, resolved);
    }

    const result = mod.default(props);
    const html = result.html;
    return html.trimStart().startsWith('<html') ? `<!DOCTYPE html>${html}` : html;
  }

  #resolveViewPath(name: string): string {
    const ext = this.#config.extension ?? '.view.tsx';
    const normalized = name.replace(/\\/g, '/');
    const base = join(this.#config.viewsDir, normalized);
    const candidates = [`${base}${ext}`, join(base, `index${ext}`)];

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }

    throw new ViewNotFoundException(name, candidates[0]);
  }
}
