import { ServiceProvider } from '@faber-js/core';
import { HttpKernel } from './kernel';

export class HttpServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('http.kernel', () => new HttpKernel(this.app));
  }
}
