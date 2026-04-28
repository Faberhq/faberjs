import type { Knex } from 'knex';
import { getConnection } from './connection';

export type TransactionCallback<T> = (trx: Knex.Transaction) => Promise<T>;

export class DB {
  static async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    return getConnection().transaction(callback);
  }

  static raw(sql: string, bindings?: Knex.RawBinding | readonly Knex.RawBinding[]): Knex.Raw {
    if (bindings === undefined) return getConnection().raw(sql);
    return getConnection().raw(sql, bindings as Knex.RawBinding);
  }
}
