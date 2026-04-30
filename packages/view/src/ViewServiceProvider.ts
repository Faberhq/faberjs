import { ServiceProvider } from '@faber-js/core';
import { join } from 'node:path';
import { ViewRenderer } from './ViewRenderer';

export class ViewServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('view.renderer', () => {
      const driver = (process.env['VIEW_DRIVER'] as 'tsx' | 'ejs' | undefined) ?? 'tsx';
      return new ViewRenderer({
        viewsDir: join(this.app.getBasePath(), 'resources', 'views'),
        driver,
      });
    });
  }
}
