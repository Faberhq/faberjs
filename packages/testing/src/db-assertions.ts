import { getConnection } from '@faber-js/orm';

type SqlValue = string | number | boolean | null;

export async function assertDatabaseHas(
  table: string,
  record: Record<string, unknown>,
): Promise<void> {
  const db = getConnection();
  let query = db(table);
  for (const [key, value] of Object.entries(record)) {
    query = query.where(key, value as SqlValue);
  }
  const rows = (await query.select('*')) as unknown[];
  if (rows.length === 0) {
    throw new Error(
      `assertDatabaseHas failed: no row matching ${JSON.stringify(record)} found in table "${table}".`,
    );
  }
}

export async function assertDatabaseMissing(
  table: string,
  record: Record<string, unknown>,
): Promise<void> {
  const db = getConnection();
  let query = db(table);
  for (const [key, value] of Object.entries(record)) {
    query = query.where(key, value as SqlValue);
  }
  const rows = (await query.select('*')) as unknown[];
  if (rows.length > 0) {
    throw new Error(
      `assertDatabaseMissing failed: found row matching ${JSON.stringify(record)} in table "${table}".`,
    );
  }
}

export async function assertDatabaseCount(table: string, expected: number): Promise<void> {
  const db = getConnection();
  const result = await db(table).count('* as count');
  const row = (result as Array<Record<string, unknown>>)[0];
  const actual = Number(row?.['count'] ?? 0);
  if (actual !== expected) {
    throw new Error(
      `assertDatabaseCount failed: expected ${expected.toString()} rows in "${table}" but found ${actual.toString()}.`,
    );
  }
}
