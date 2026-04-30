import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import type { ViewRendererConfig, ViewComponent } from './types';
import type { RawHtml } from './escape';
import { ViewNotFoundException } from './ViewNotFoundException';

export class ViewRenderer {
  readonly #config: ViewRendererConfig;

  constructor(config: ViewRendererConfig) {
    this.#config = config;
  }

  get driver(): 'tsx' | 'ejs' {
    return this.#config.driver ?? 'tsx';
  }

  renderComponent<P extends Record<string, unknown>>(
    component: ViewComponent<P>,
    props: P,
  ): string {
    return component(props).html;
  }

  async render<P extends Record<string, unknown>>(name: string, props: P): Promise<string> {
    const resolved = this.#resolveViewPath(name);

    if (this.driver === 'ejs') {
      return this.#renderEjs(resolved, props);
    }

    // .tsx/.ts files: compile via esbuild so Node never sees the raw extension.
    // Plain .js/.mjs files: use Node's native import() as before.
    const mod =
      resolved.endsWith('.tsx') || resolved.endsWith('.ts')
        ? this.#compileTsxModule<P>(resolved)
        : ((await import(pathToFileURL(resolved).href)) as {
            default?: ViewComponent<P> | ((props: P) => RawHtml);
          });

    if (typeof mod.default !== 'function') {
      throw new ViewNotFoundException(name, resolved);
    }

    const result = mod.default(props);
    const html = result.html;
    return html.trimStart().startsWith('<html') ? `<!DOCTYPE html>${html}` : html;
  }

  #compileTsxModule<P extends Record<string, unknown>>(
    filePath: string,
  ): { default?: ViewComponent<P> | ((props: P) => RawHtml) } {
    const source = readFileSync(filePath, 'utf8');
    const { code } = transformSync(source, {
      loader: 'tsx',
      format: 'cjs',
      jsx: 'automatic',
      jsxImportSource: '@faber-js/view',
      target: 'node16',
    });

    // Node's internal Module._compile executes in-memory CJS without going through
    // the file extension resolver — this is the fix for the Termux/.tsx error.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const NodeModule = require('module') as any;
    const m = new NodeModule(filePath) as {
      filename: string;
      paths: string[];
      require: NodeRequire;
      exports: unknown;
      _compile(code: string, filename: string): void;
    };
    m.filename = filePath;
    m.paths = NodeModule._nodeModulePaths(dirname(filePath)) as string[];
    m.require = createRequire(filePath);
    m._compile(code, filePath);
    return m.exports as { default?: ViewComponent<P> | ((props: P) => RawHtml) };
  }

  #renderEjs(filePath: string, props: Record<string, unknown>): string {
    // ejs is an optional peer dependency — only loaded when driver === 'ejs'.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ejs = require('ejs') as {
      render(
        template: string,
        data: Record<string, unknown>,
        opts?: Record<string, unknown>,
      ): string;
    };
    const template = readFileSync(filePath, 'utf8');
    return ejs.render(template, props, { filename: filePath });
  }

  #resolveViewPath(name: string): string {
    const defaultExt = this.driver === 'ejs' ? '.view.ejs' : '.view.tsx';
    const ext = this.#config.extension ?? defaultExt;
    const normalized = name.replace(/\\/g, '/');
    const base = join(this.#config.viewsDir, normalized);
    const candidates = [`${base}${ext}`, join(base, `index${ext}`)];

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }

    throw new ViewNotFoundException(name, candidates[0]);
  }
}
