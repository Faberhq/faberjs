import { raw, RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';

function currentEnv(): string {
  return process.env['APP_ENV'] ?? process.env['NODE_ENV'] ?? 'development';
}

// ── Env ───────────────────────────────────────────────────────────────

/**
 * Renders children only when the application is running in one of the given
 * environments. Reads from APP_ENV, falling back to NODE_ENV.
 * Equivalent to Blade's @env directive.
 *
 * @example
 * <Env name="production"><GoogleAnalytics /></Env>
 * <Env name={['staging', 'production']}><DebugBanner /></Env>
 */
export function Env({ name, children }: { name: string | string[]; children?: unknown }): RawHtml {
  const env = currentEnv();
  const names = Array.isArray(name) ? name : [name];
  if (!names.includes(env)) return raw('');
  return new RawHtml(renderChildren(children));
}

// ── EnvNot ────────────────────────────────────────────────────────────

/**
 * Renders children when the application is NOT in the given environment(s).
 */
export function EnvNot({
  name,
  children,
}: {
  name: string | string[];
  children?: unknown;
}): RawHtml {
  const env = currentEnv();
  const names = Array.isArray(name) ? name : [name];
  if (names.includes(env)) return raw('');
  return new RawHtml(renderChildren(children));
}

// ── Production ────────────────────────────────────────────────────────

/**
 * Renders children only when APP_ENV / NODE_ENV is "production".
 * Equivalent to Blade's @production directive.
 *
 * @example
 * <Production><MinifiedBundle /></Production>
 */
export function Production({ children }: { children?: unknown }): RawHtml {
  return Env({ name: 'production', children });
}
