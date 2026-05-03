import { raw, RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';
import { getRenderContext } from './render-context';

// How it works:
//
// JSX evaluates children *before* calling the parent component function.
// So when a Page component renders:
//
//   <Layout>
//     <Section name="title">My Title</Section>
//     <p>Body</p>
//   </Layout>
//
// The execution order is:
//   1. Section({ name: 'title', children: 'My Title' }) — registers in context → returns ''
//   2. jsx('p', ...) → returns '<p>Body</p>'
//   3. Layout({ children: ['', '<p>Body</p>'] }) is called
//   4. Inside Layout, Yield({ name: 'title' }) reads from context → 'My Title'
//
// This relies on all rendering being synchronous and the render context being
// established by ViewRenderer before any component function executes.

// ── Section ───────────────────────────────────────────────────────────

/**
 * Defines a named content section. Equivalent to Blade's @section directive.
 *
 * When rendered inside a layout component's children, the content is registered
 * in the render context and later emitted by <Yield>. Returns empty HTML.
 *
 * @example
 * <AppLayout>
 *   <Section name="title">My Page</Section>
 *   <p>Body content</p>
 * </AppLayout>
 */
export function Section({ name, children }: { name: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (ctx) {
    ctx.sections.define(name, renderChildren(children));
  }
  return raw('');
}

// ── Yield ─────────────────────────────────────────────────────────────

/**
 * Outputs the content of a named section. Equivalent to Blade's @yield directive.
 * If no section with that name was registered, renders the optional default children.
 *
 * @example
 * <html>
 *   <head><title><Yield name="title">Default Title</Yield></title></head>
 *   <body><Yield name="content" /></body>
 * </html>
 */
export function Yield({ name, children }: { name: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (ctx) {
    const content = ctx.sections.get(name);
    if (content !== undefined) return raw(content);
  }
  if (children !== undefined && children !== null) {
    return new RawHtml(renderChildren(children));
  }
  return raw('');
}

// ── HasSection ────────────────────────────────────────────────────────

/**
 * Renders children only when a section with the given name has been defined.
 * Equivalent to Blade's @hasSection directive.
 *
 * @example
 * <HasSection name="navigation">
 *   <nav><Yield name="navigation" /></nav>
 * </HasSection>
 */
export function HasSection({ name, children }: { name: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (!ctx?.sections.has(name)) return raw('');
  return new RawHtml(renderChildren(children));
}

// ── SectionMissing ────────────────────────────────────────────────────

/**
 * Renders children only when no section with the given name was defined.
 * Equivalent to Blade's @sectionMissing directive.
 *
 * @example
 * <SectionMissing name="navigation">
 *   <DefaultNavigation />
 * </SectionMissing>
 */
export function SectionMissing({ name, children }: { name: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (ctx?.sections.has(name)) return raw('');
  return new RawHtml(renderChildren(children));
}
