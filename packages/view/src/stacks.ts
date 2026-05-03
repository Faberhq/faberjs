import { raw, RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';
import { getRenderContext } from './render-context';

// ── Push ──────────────────────────────────────────────────────────────

/**
 * Appends content to a named stack. Equivalent to Blade's @push directive.
 * Returns empty — the content is collected and rendered by <Stack>.
 *
 * @example
 * <Push stack="scripts">
 *   <script src="/app.js"></script>
 * </Push>
 */
export function Push({ stack, children }: { stack: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (ctx) ctx.stacks.push(stack, renderChildren(children));
  return raw('');
}

// ── Prepend ───────────────────────────────────────────────────────────

/**
 * Prepends content to the beginning of a named stack.
 * Equivalent to Blade's @prepend directive.
 */
export function Prepend({ stack, children }: { stack: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (ctx) ctx.stacks.prepend(stack, renderChildren(children));
  return raw('');
}

// ── PushIf ────────────────────────────────────────────────────────────

/**
 * Conditionally pushes content to a named stack.
 * Equivalent to Blade's @pushIf directive.
 *
 * @example
 * <PushIf when={shouldPush} stack="scripts">
 *   <script src="/analytics.js"></script>
 * </PushIf>
 */
export function PushIf({
  when: condition,
  stack,
  children,
}: {
  when: boolean;
  stack: string;
  children?: unknown;
}): RawHtml {
  if (!condition) return raw('');
  const ctx = getRenderContext();
  if (ctx) ctx.stacks.push(stack, renderChildren(children));
  return raw('');
}

// ── PushOnce ──────────────────────────────────────────────────────────

/**
 * Pushes content to a named stack only once per render cycle, identified by
 * `id`. Subsequent calls with the same stack+id are no-ops.
 * Equivalent to Blade's @pushOnce directive.
 *
 * @example
 * <PushOnce stack="scripts" id="chart.js">
 *   <script src="/chart.js"></script>
 * </PushOnce>
 */
export function PushOnce({
  stack,
  id,
  children,
}: {
  stack: string;
  id: string;
  children?: unknown;
}): RawHtml {
  const ctx = getRenderContext();
  if (!ctx) return raw('');
  const key = `push:${stack}:${id}`;
  if (ctx.once.has(key)) return raw('');
  ctx.once.add(key);
  ctx.stacks.push(stack, renderChildren(children));
  return raw('');
}

// ── PrependOnce ───────────────────────────────────────────────────────

/**
 * Prepends content to a named stack only once per render cycle.
 * Equivalent to Blade's @prependOnce directive.
 */
export function PrependOnce({
  stack,
  id,
  children,
}: {
  stack: string;
  id: string;
  children?: unknown;
}): RawHtml {
  const ctx = getRenderContext();
  if (!ctx) return raw('');
  const key = `prepend:${stack}:${id}`;
  if (ctx.once.has(key)) return raw('');
  ctx.once.add(key);
  ctx.stacks.prepend(stack, renderChildren(children));
  return raw('');
}

// ── Stack ─────────────────────────────────────────────────────────────

/**
 * Renders all content that has been pushed/prepended to a named stack.
 * Equivalent to Blade's @stack directive.
 *
 * @example
 * <head>
 *   <Stack name="scripts" />
 * </head>
 */
export function Stack({ name }: { name: string }): RawHtml {
  const ctx = getRenderContext();
  if (!ctx) return raw('');
  return raw(ctx.stacks.render(name));
}

// ── HasStack ──────────────────────────────────────────────────────────

/**
 * Renders children only when the named stack has content.
 * Equivalent to Blade's @hasstack directive.
 *
 * @example
 * <HasStack name="list">
 *   <ul><Stack name="list" /></ul>
 * </HasStack>
 */
export function HasStack({ name, children }: { name: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (!ctx?.stacks.has(name)) return raw('');
  return new RawHtml(renderChildren(children));
}

// ── Once ──────────────────────────────────────────────────────────────

/**
 * Renders children only once per render cycle for a given `id`.
 * Subsequent calls with the same id return empty.
 * Equivalent to Blade's @once directive.
 *
 * @example
 * <Once id="welcome-script">
 *   <script>console.log('hello')</script>
 * </Once>
 */
export function Once({ id = '__once__', children }: { id?: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (!ctx) return new RawHtml(renderChildren(children));
  if (ctx.once.has(id)) return raw('');
  ctx.once.add(id);
  return new RawHtml(renderChildren(children));
}
