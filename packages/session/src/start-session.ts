import type { Middleware, NextFunction, Request, Response } from '@faber-js/http';
import { Session } from './session';
import type { SessionDriver, SessionCookieOptions } from './types';
import { parseCookies, serializeCookie } from './cookie';

export const SESSION_ATTRIBUTE = 'session';

export class StartSession implements Middleware {
  readonly #driver: SessionDriver;
  readonly #cookieName: string;
  readonly #cookieOptions: SessionCookieOptions;
  readonly #ttlSeconds: number;

  constructor(driver: SessionDriver, cookieOptions: SessionCookieOptions = {}) {
    this.#driver = driver;
    this.#cookieName = cookieOptions.name ?? 'faber_session';
    this.#cookieOptions = cookieOptions;
    this.#ttlSeconds = (cookieOptions.ttlMinutes ?? 120) * 60;
  }

  async handle(request: Request, next: NextFunction): Promise<Response> {
    const cookies = parseCookies(request.header('cookie'));
    const existingId = cookies[this.#cookieName];

    const sessionInstance = new Session(this.#driver, existingId, this.#ttlSeconds);
    await sessionInstance.start();

    request.setAttribute(SESSION_ATTRIBUTE, sessionInstance);

    let response = await next(request);

    await sessionInstance.save();

    response = response.withCookie(
      serializeCookie(this.#cookieName, sessionInstance.getId(), this.#cookieOptions),
    );

    return response;
  }
}

export function session(request: Request): Session {
  const s = request.getAttribute<Session>(SESSION_ATTRIBUTE);
  if (!s) {
    throw new Error('No session found on request. Ensure StartSession middleware is registered.');
  }
  return s;
}
