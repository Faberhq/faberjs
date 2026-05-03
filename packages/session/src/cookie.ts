import type { SessionCookieOptions } from './types';

export function serializeCookie(name: string, value: string, opts: SessionCookieOptions): string {
  const ttlMinutes = opts.ttlMinutes ?? 120;
  const maxAge = ttlMinutes * 60;
  const path = opts.path ?? '/';
  const httpOnly = opts.httpOnly !== false;
  const sameSite = opts.sameSite ?? 'Lax';
  const secure = opts.secure ?? false;

  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  cookie += `; Max-Age=${maxAge}`;
  cookie += `; Path=${path}`;
  if (httpOnly) cookie += '; HttpOnly';
  cookie += `; SameSite=${sameSite}`;
  if (secure) cookie += '; Secure';
  if (opts.domain) cookie += `; Domain=${opts.domain}`;
  return cookie;
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    try {
      cookies[decodeURIComponent(key)] = decodeURIComponent(val);
    } catch {
      // Malformed cookie segment — skip
    }
  }
  return cookies;
}
