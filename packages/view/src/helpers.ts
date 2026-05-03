import { ViewResponse } from './ViewResponse';

export function view(name: string, data: Record<string, unknown> = {}): ViewResponse {
  return new ViewResponse(name, data);
}

// ── Conditional class helper ──────────────────────────────────────────

type ClassArg =
  | string
  | Record<string, boolean | undefined | null | 0>
  | undefined
  | null
  | false
  | 0;

/**
 * Conditionally join CSS class names. Equivalent to Blade's @class directive.
 *
 * @example
 * cls('p-4', { 'font-bold': isActive, 'text-gray-500': !isActive })
 * // → "p-4 text-gray-500"
 */
export function cls(...args: ClassArg[]): string {
  const out: string[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') {
      const t = arg.trim();
      if (t) out.push(t);
    } else if (typeof arg === 'object') {
      for (const [key, val] of Object.entries(arg)) {
        if (val) out.push(key);
      }
    }
  }
  return out.join(' ');
}

// ── Conditional style helper ──────────────────────────────────────────

/**
 * Conditionally join inline CSS style rules. Equivalent to Blade's @style directive.
 *
 * @example
 * styleMap({ 'background-color: red': true, 'font-weight: bold': isActive })
 * // → "background-color: red; font-weight: bold"
 */
export function styleMap(rules: Record<string, boolean | undefined | null>): string {
  const out: string[] = [];
  for (const [rule, include] of Object.entries(rules)) {
    if (include) out.push(rule.trim());
  }
  return out.join('; ');
}

// ── Form attribute boolean helpers ───────────────────────────────────
// Return `true` so JSX renders the attribute bare, or `undefined` to omit it.

/** Equivalent to Blade's @checked directive. */
export const checked = (cond: unknown): true | undefined => (cond ? true : undefined);

/** Equivalent to Blade's @selected directive. */
export const selected = (cond: unknown): true | undefined => (cond ? true : undefined);

/** Equivalent to Blade's @disabled directive. */
export const disabled = (cond: unknown): true | undefined => (cond ? true : undefined);

/** Equivalent to Blade's @readonly directive. */
export const readonly = (cond: unknown): true | undefined => (cond ? true : undefined);

/** Equivalent to Blade's @required directive. */
export const required = (cond: unknown): true | undefined => (cond ? true : undefined);
