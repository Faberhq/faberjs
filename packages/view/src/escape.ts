export class RawHtml {
  constructor(readonly html: string) {}
}

export function raw(html: string): RawHtml {
  return new RawHtml(html);
}

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escape(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof RawHtml) return value.html;
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}
