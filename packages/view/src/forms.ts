import { raw, escape, RawHtml } from './escape';
import { getRenderContext } from './render-context';
import { renderChildren } from './jsx-runtime';

// ── ValidationErrors ──────────────────────────────────────────────────

export class ValidationErrors {
  readonly #errors: Record<string, string | string[]>;

  constructor(errors: Record<string, string | string[]> = {}) {
    this.#errors = errors;
  }

  /** Returns true if the field has at least one error message. */
  has(field: string): boolean {
    const e = this.#errors[field];
    if (!e) return false;
    return Array.isArray(e) ? e.length > 0 : e.length > 0;
  }

  /** Returns the first error message for the field, or undefined. */
  first(field: string): string | undefined {
    const e = this.#errors[field];
    if (!e) return undefined;
    return Array.isArray(e) ? e[0] : e;
  }

  /** Returns all error messages for the field. */
  all(field: string): string[] {
    const e = this.#errors[field];
    if (!e) return [];
    return Array.isArray(e) ? e : [e];
  }

  isEmpty(): boolean {
    return Object.keys(this.#errors).length === 0;
  }

  isNotEmpty(): boolean {
    return !this.isEmpty();
  }
}

// ── CsrfField ─────────────────────────────────────────────────────────

/**
 * Renders a hidden CSRF token input. Equivalent to Blade's @csrf directive.
 * Reads the token from the render context (set via ViewRenderer options) or
 * from an explicit `token` prop.
 *
 * @example
 * <form method="POST" action="/profile">
 *   <CsrfField />
 * </form>
 */
export function CsrfField({ token }: { token?: string } = {}): RawHtml {
  const ctx = getRenderContext();
  const tok = token ?? ctx?.csrf ?? '';
  return raw(`<input type="hidden" name="_token" value="${escape(tok)}">`);
}

// ── MethodField ───────────────────────────────────────────────────────

/**
 * Renders a hidden `_method` field for HTTP verb spoofing.
 * Equivalent to Blade's @method directive.
 *
 * @example
 * <form method="POST" action="/posts/1">
 *   <MethodField method="PUT" />
 * </form>
 */
export function MethodField({ method }: { method: string }): RawHtml {
  return raw(`<input type="hidden" name="_method" value="${escape(method.toUpperCase())}">`);
}

// ── FieldError ────────────────────────────────────────────────────────

/**
 * Renders validation error content for a named field. Equivalent to Blade's
 * @error directive.
 *
 * Errors are resolved in this priority:
 *  1. Explicit `errors` prop (a ValidationErrors instance or plain object)
 *  2. Errors stored in the render context (set via ViewRenderer options)
 *
 * If `children` is a function `(message: string) => RawHtml`, it is called
 * with the first error message. Otherwise, static children are rendered when
 * an error exists. If no children are provided, a default `<p>` is rendered.
 *
 * @example
 * <FieldError field="title" errors={errors} />
 *
 * <FieldError field="email" errors={errors}>
 *   {(msg) => <p class="text-red-500">{msg}</p>}
 * </FieldError>
 */
export function FieldError({
  field,
  errors: prop,
  children,
}: {
  field: string;
  errors?: ValidationErrors | Record<string, string | string[]>;
  children?: unknown;
}): RawHtml {
  let bag: ValidationErrors;

  if (prop instanceof ValidationErrors) {
    bag = prop;
  } else if (prop && typeof prop === 'object') {
    bag = new ValidationErrors(prop as Record<string, string | string[]>);
  } else {
    const ctx = getRenderContext();
    bag = new ValidationErrors(ctx?.errors ?? {});
  }

  const message = bag.first(field);
  if (!message) return raw('');

  if (typeof children === 'function') {
    return (children as (msg: string) => RawHtml)(message);
  }

  if (children !== undefined && children !== null) {
    return new RawHtml(renderChildren(children));
  }

  return raw(`<p class="faber-error">${escape(message)}</p>`);
}
