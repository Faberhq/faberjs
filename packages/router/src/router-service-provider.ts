import { ServiceProvider } from '@faber-js/core';
import { Router } from './router';

export class RouterServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('router', () => new Router());
  }
}
