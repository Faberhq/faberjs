import { ServiceProvider } from '@faber-js/core';
import { createConnection } from './connection';
import type { ConnectionConfig } from './types';

export class OrmServiceProvider extends ServiceProvider {
  register(): void {
    const config = this.app.bound('config.database')
      ? this.app.make<ConnectionConfig>('config.database')
      : { client: 'sqlite3' as const, connection: { filename: './database.sqlite' } };

    createConnection(config);
  }
}
