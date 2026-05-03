import { raw } from './escape';
import type { RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';

export const FRAGMENT_START = (name: string): string => `<!--FABER-FRAGMENT:${name}:S-->`;
export const FRAGMENT_END = (name: string): string => `<!--FABER-FRAGMENT:${name}:E-->`;

/**
 * Marks a named fragment region. Use with ViewRenderer.renderFragment() or
 * ViewResponse.toFragmentResponse() to return only that region in the HTTP
 * response. Equivalent to Blade's @fragment / @endfragment directives.
 *
 * @example
 * <ViewFragment name="user-list">
 *   <ul>
 *     {users.map(u => <li key={u.id}>{u.name}</li>)}
 *   </ul>
 * </ViewFragment>
 *
 * // Controller:
 * return this.viewFragment('dashboard', 'user-list', { users });
 */
export function ViewFragment({ name, children }: { name: string; children?: unknown }): RawHtml {
  const content = renderChildren(children);
  return raw(`${FRAGMENT_START(name)}${content}${FRAGMENT_END(name)}`);
}

/** Extract a single named fragment from an already-rendered HTML string. */
export function extractFragment(html: string, name: string): string {
  const re = new RegExp(
    `<!--FABER-FRAGMENT:${name}:S-->([\\s\\S]*?)<!--FABER-FRAGMENT:${name}:E-->`,
  );
  const match = html.match(re);
  if (!match) throw new Error(`Fragment "${name}" was not found in the rendered view.`);
  return match[1] ?? '';
}

/** Extract multiple named fragments and concatenate them. */
export function extractFragments(html: string, names: string[]): string {
  return names.map((n) => extractFragment(html, n)).join('');
}
