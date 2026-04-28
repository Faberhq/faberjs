import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { escape, raw, RawHtml } from './escape';
import { jsx, jsxs, h, Fragment, Unsafe } from './jsx-runtime';
import { ViewRenderer } from './ViewRenderer';
import { ViewNotFoundException } from './ViewNotFoundException';

// ── escape() ────────────────────────────────────────────────────────

describe('escape()', () => {
  it('escapes & < > " \' in strings', () => {
    expect(escape('A & <B> "C" \'D\'')).toBe('A &amp; &lt;B&gt; &quot;C&quot; &#39;D&#39;');
  });

  it('returns empty string for null', () => {
    expect(escape(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escape(undefined)).toBe('');
  });

  it('returns empty string for false', () => {
    expect(escape(false)).toBe('');
  });

  it('coerces numbers to string without escaping', () => {
    expect(escape(42)).toBe('42');
  });

  it('passes RawHtml through without escaping', () => {
    const r = new RawHtml('<b>bold</b>');
    expect(escape(r)).toBe('<b>bold</b>');
  });
});

// ── h() ─────────────────────────────────────────────────────────────

describe('h()', () => {
  it('renders an intrinsic element with text child', () => {
    expect(h('div', null, 'Hello').html).toBe('<div>Hello</div>');
  });

  it('escapes text children', () => {
    expect(h('p', null, '<script>alert(1)</script>').html).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('renders element with attributes', () => {
    expect(h('a', { href: '/path', class: 'btn' }, 'Click').html).toBe(
      '<a href="/path" class="btn">Click</a>',
    );
  });

  it('maps className to class', () => {
    expect(h('div', { className: 'container' }).html).toBe('<div class="container"></div>');
  });

  it('renders void elements without closing tag', () => {
    expect(h('br', null).html).toBe('<br>');
    expect(h('img', { src: '/img.png', alt: 'test' }).html).toBe('<img src="/img.png" alt="test">');
  });

  it('renders boolean attributes as bare name when true', () => {
    expect(h('input', { type: 'checkbox', checked: true }).html).toBe(
      '<input type="checkbox" checked>',
    );
  });

  it('omits boolean attributes when false', () => {
    expect(h('input', { type: 'checkbox', checked: false }).html).toBe('<input type="checkbox">');
  });

  it('omits null and undefined attributes', () => {
    expect(h('div', { id: null, class: undefined }).html).toBe('<div></div>');
  });

  it('renders a component function', () => {
    const Greeting = ({ name }: Record<string, unknown>): RawHtml =>
      new RawHtml(`<p>Hello, ${String(name)}!</p>`);
    expect(h(Greeting, { name: 'World' }).html).toBe('<p>Hello, World!</p>');
  });

  it('renders multiple children', () => {
    expect(h('ul', null, h('li', null, 'A'), h('li', null, 'B')).html).toBe(
      '<ul><li>A</li><li>B</li></ul>',
    );
  });

  it('skips null/undefined/false children', () => {
    expect(h('div', null, null, false, undefined, 'text').html).toBe('<div>text</div>');
  });

  it('renders numeric children', () => {
    expect(h('span', null, 42).html).toBe('<span>42</span>');
  });

  it('returns a RawHtml instance', () => {
    expect(h('div', null)).toBeInstanceOf(RawHtml);
  });
});

// ── jsx() ────────────────────────────────────────────────────────────

describe('jsx()', () => {
  it('renders element with children in props', () => {
    expect(jsx('span', { children: 'hi' }).html).toBe('<span>hi</span>');
  });

  it('escapes string children', () => {
    expect(jsx('p', { children: '<evil>' }).html).toBe('<p>&lt;evil&gt;</p>');
  });

  it('renders a component function', () => {
    const Bold = ({ children }: Record<string, unknown>): RawHtml =>
      new RawHtml(`<b>${String(children)}</b>`);
    expect(jsx(Bold, { children: 'text' }).html).toBe('<b>text</b>');
  });

  it('returns a RawHtml instance', () => {
    expect(jsx('div', {})).toBeInstanceOf(RawHtml);
  });
});

// ── jsxs() ───────────────────────────────────────────────────────────

describe('jsxs()', () => {
  it('renders element with array children', () => {
    const a = h('li', null, 'A');
    const b = h('li', null, 'B');
    expect(jsxs('ul', { children: [a, b] }).html).toBe('<ul><li>A</li><li>B</li></ul>');
  });

  it('skips false entries in children array', () => {
    expect(jsxs('div', { children: [false, h('span', null, 'yes')] }).html).toBe(
      '<div><span>yes</span></div>',
    );
  });
});

// ── Fragment ──────────────────────────────────────────────────────────

describe('Fragment', () => {
  it('renders children without a wrapper element', () => {
    const result = Fragment({
      children: [h('span', null, 'A'), h('span', null, 'B')],
    });
    expect(result.html).toBe('<span>A</span><span>B</span>');
  });

  it('returns empty string for no children', () => {
    expect(Fragment({}).html).toBe('');
  });
});

// ── Unsafe ────────────────────────────────────────────────────────────

describe('Unsafe', () => {
  it('renders raw HTML without escaping', () => {
    const result = Unsafe({ html: '<b>bold</b><script>alert(1)</script>' });
    expect(result.html).toBe('<b>bold</b><script>alert(1)</script>');
  });

  it('passes through as-is when used as child of an element', () => {
    const inner = Unsafe({ html: '<em>hi</em>' });
    expect(h('div', null, inner).html).toBe('<div><em>hi</em></div>');
  });

  it('returns a RawHtml instance', () => {
    expect(Unsafe({ html: '' })).toBeInstanceOf(RawHtml);
  });
});

// ── raw() helper ──────────────────────────────────────────────────────

describe('raw()', () => {
  it('creates a RawHtml that is not escaped when used as child', () => {
    const r = raw('<strong>bold</strong>');
    expect(h('p', null, r).html).toBe('<p><strong>bold</strong></p>');
  });
});

// ── ViewRenderer ──────────────────────────────────────────────────────

describe('ViewRenderer', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `faber-view-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  describe('renderComponent()', () => {
    it('calls the component with props and returns HTML string', () => {
      const renderer = new ViewRenderer({ viewsDir: tmpDir });
      const component = ({ title }: { title: string }): RawHtml => new RawHtml(`<h1>${title}</h1>`);
      expect(renderer.renderComponent(component, { title: 'Hello' })).toBe('<h1>Hello</h1>');
    });
  });

  describe('render()', () => {
    it('loads and renders a view file by name', async () => {
      const fileName = `view-${Date.now()}.view.mjs`;
      writeFileSync(
        join(tmpDir, fileName),
        `export default function View({ title }) { return { html: '<h1>' + title + '</h1>' }; }\n`,
      );
      const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: `.view.mjs` });
      const name = fileName.replace('.view.mjs', '');
      const result = await renderer.render(name, { title: 'Hello' });
      expect(result).toBe('<h1>Hello</h1>');
    });

    it('prepends <!DOCTYPE html> when root element begins with <html', async () => {
      const fileName = `page-${Date.now()}.view.mjs`;
      writeFileSync(
        join(tmpDir, fileName),
        `export default function Page() { return { html: '<html><head></head><body>hi</body></html>' }; }\n`,
      );
      const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
      const name = fileName.replace('.view.mjs', '');
      const result = await renderer.render(name, {});
      expect(result).toBe('<!DOCTYPE html><html><head></head><body>hi</body></html>');
    });

    it('throws ViewNotFoundException when view file does not exist', async () => {
      const renderer = new ViewRenderer({ viewsDir: tmpDir });
      await expect(renderer.render('nonexistent', {})).rejects.toThrow(ViewNotFoundException);
    });

    it('includes the attempted path in the ViewNotFoundException message', async () => {
      const renderer = new ViewRenderer({ viewsDir: tmpDir });
      await expect(renderer.render('missing/view', {})).rejects.toThrow(/missing/);
    });

    it('resolves index file for directory-style view names', async () => {
      const subDir = join(tmpDir, 'users');
      mkdirSync(subDir);
      const fileName = `idx-${Date.now()}.view.mjs`;
      writeFileSync(
        join(subDir, fileName),
        `export default function UserIndex({ count }) { return { html: '<p>' + count + ' users</p>' }; }\n`,
      );
      const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
      const name = `users/${fileName.replace('.view.mjs', '')}`;
      const result = await renderer.render(name, { count: 5 });
      expect(result).toBe('<p>5 users</p>');
    });
  });
});

// ── ViewNotFoundException ─────────────────────────────────────────────

describe('ViewNotFoundException', () => {
  it('includes the view name and attempted path in the message', () => {
    const err = new ViewNotFoundException(
      'users/index',
      '/app/resources/views/users/index.view.tsx',
    );
    expect(err.message).toContain('users/index');
    expect(err.message).toContain('/app/resources/views/users/index.view.tsx');
    expect(err.name).toBe('ViewNotFoundException');
  });
});
