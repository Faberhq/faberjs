import { raw } from './escape';
import type { RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';

const S = (name: string): string => `<!--SLOT:${name}:S-->`;
const E = (name: string): string => `<!--SLOT:${name}:E-->`;

/**
 * Marks a named slot region. Use inside a parent component and extract with
 * `useSlots()`. Equivalent to Blade's `<x-slot:name>` syntax.
 *
 * @example
 * <Layout>
 *   <Slot name="title">My Page Title</Slot>
 *   <p>Main body content goes to the default slot.</p>
 * </Layout>
 */
export function Slot({ name, children }: { name: string; children?: unknown }): RawHtml {
  const content = renderChildren(children);
  return raw(`${S(name)}${content}${E(name)}`);
}

export interface Slots {
  /** Default (unnamed) slot content — everything not wrapped in a named Slot. */
  readonly slot: RawHtml;
  [name: string]: RawHtml;
}

/**
 * Extracts named slots from rendered children. Call inside a layout component
 * to separate named regions from the default slot content.
 *
 * Multiple `<Slot name="x">` occurrences for the same name are concatenated.
 *
 * @example
 * function Layout({ children }: { children?: unknown }) {
 *   const { title, slot } = useSlots(children);
 *   return (
 *     <html>
 *       <head><title>{title}</title></head>
 *       <body>{slot}</body>
 *     </html>
 *   );
 * }
 */
export function useSlots(children: unknown): Slots {
  const html = renderChildren(children);

  const named: Record<string, string> = {};
  const SLOT_RE = /<!--SLOT:([^:]+):S-->([\s\S]*?)<!--SLOT:\1:E-->/g;

  const remaining = html.replace(SLOT_RE, (_, name: string, content: string) => {
    named[name] = (named[name] ?? '') + content;
    return '';
  });

  const slots: Record<string, RawHtml> = { slot: raw(remaining) };
  for (const [name, content] of Object.entries(named)) {
    slots[name] = raw(content);
  }
  return slots as Slots;
}
