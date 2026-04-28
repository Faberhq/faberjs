import { ServiceProvider } from '@faber-js/core';
import { join } from 'node:path';
import { ViewRenderer } from './ViewRenderer';

export class ViewServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('view.renderer', () => {
      return new ViewRenderer({
        viewsDir: join(this.app.getBasePath(), 'resources', 'views'),
      });
    });
  }
}
