import { ServiceProvider } from '@faber-js/core';
import { StartSession } from './start-session';
import { PreventRequestForgery } from './prevent-request-forgery';
import { MemorySessionDriver } from './memory-driver';
import { FileSessionDriver } from './file-driver';
import type { SessionConfig, CsrfOptions } from './types';

export class SessionServiceProvider extends ServiceProvider {
  readonly #config: SessionConfig;
  readonly #csrfOptions: CsrfOptions;

  constructor(
    app: ConstructorParameters<typeof ServiceProvider>[0],
    config: SessionConfig = {},
    csrfOptions: CsrfOptions = {},
  ) {
    super(app);
    this.#config = config;
    this.#csrfOptions = csrfOptions;
  }

  register(): void {
    const driver =
      this.#config.driver ?? (process.env['SESSION_DRIVER'] as SessionConfig['driver']) ?? 'file';

    const cookieOptions = this.#config.cookie ?? {};

    const sessionDriver =
      driver === 'memory'
        ? new MemorySessionDriver()
        : new FileSessionDriver(this.#config.files?.path);

    this.app.singleton('session.driver', () => sessionDriver);

    this.app.singleton('middleware.session', () => new StartSession(sessionDriver, cookieOptions));

    this.app.singleton(
      'middleware.csrf',
      () => new PreventRequestForgery(this.#csrfOptions, cookieOptions),
    );
  }
}
