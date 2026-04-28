import { getConnection } from '@faber-js/orm';
import type { ConversationMemory, MemoryMessage, MessageRole } from './types';

interface ConversationRow {
  id: number;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export class DatabaseConversationMemory implements ConversationMemory {
  readonly #table: string;
  #pending: Array<Promise<void>> = [];

  constructor(table: string) {
    this.#table = table;
  }

  add(message: MemoryMessage, sessionId = 'default'): void {
    const p = getConnection()(this.#table)
      .insert({
        session_id: sessionId,
        role: message.role,
        content: message.content,
        created_at: new Date().toISOString(),
      })
      .then(() => undefined);
    this.#pending.push(p);
  }

  async getHistory(sessionId = 'default'): Promise<readonly MemoryMessage[]> {
    if (this.#pending.length > 0) {
      await Promise.all(this.#pending);
      this.#pending = [];
    }

    const rows = await getConnection()(this.#table)
      .where('session_id', sessionId)
      .orderBy('id', 'asc')
      .select<ConversationRow[]>('role', 'content');

    return rows.map((row) => ({
      role: row.role as MessageRole,
      content: row.content,
    }));
  }

  async clear(sessionId = 'default'): Promise<void> {
    if (this.#pending.length > 0) {
      await Promise.all(this.#pending);
      this.#pending = [];
    }
    await getConnection()(this.#table).where('session_id', sessionId).delete();
  }
}
