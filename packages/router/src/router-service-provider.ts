import { ServiceProvider } from '@faberjs/core';
import { Router } from './router';

export class RouterServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('router', () => new Router());
  }
}
