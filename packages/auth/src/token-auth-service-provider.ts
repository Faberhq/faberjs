import { ServiceProvider } from '@faber-js/core';
import { Gate } from './gate';
import { TokenGuard } from './token-guard';
import type { TokenConfig, UserProviderContract } from './types';

export abstract class TokenAuthServiceProvider extends ServiceProvider {
  protected abstract userProvider(): UserProviderContract;

  protected tokenConfig(): TokenConfig {
    return {};
  }

  register(): void {
    const guard = new TokenGuard(this.userProvider(), this.tokenConfig());
    // Register under both names — 'auth.guard' is the default the AuthMiddleware resolves,
    // 'auth.token.guard' is what TokenAuth facade uses directly.
    this.app.singleton('auth.guard', () => guard);
    this.app.singleton('auth.token.guard', () => guard);
    this.app.singleton('gate', () => new Gate());
  }
}
