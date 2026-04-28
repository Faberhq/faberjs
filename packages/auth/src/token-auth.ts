import { Application } from '@faber-js/core';
import type { AuthUser } from '@faber-js/http';
import type { TokenGuard, NewTokenResult } from './token-guard';
import type { PersonalAccessToken } from './personal-access-token';

export class TokenAuth {
  /** Issue a new named token for the given user, optionally scoped to specific abilities. */
  static async createToken(
    userId: string | number,
    name: string,
    abilities: string[] = ['*'],
  ): Promise<NewTokenResult> {
    const guard = Application.getInstance().make<TokenGuard>('auth.token.guard');
    return guard.issueToken(userId, name, abilities);
  }

  /** Check whether the token attached to the current request has the given ability. */
  static tokenCan(user: AuthUser | null, ability: string): boolean {
    if (!user) return false;
    const token = (user as Record<string, unknown>)['_token'] as PersonalAccessToken | undefined;
    if (!token) return false;
    const abilities = token.getAbilities();
    return abilities.includes('*') || abilities.includes(ability);
  }

  /** Revoke a single token by its database ID. */
  static async revokeToken(tokenId: number): Promise<void> {
    const { PersonalAccessToken } = await import('./personal-access-token');
    const record = await PersonalAccessToken.find<PersonalAccessToken>(tokenId);
    if (record) await record.delete();
  }

  /** Revoke all tokens for a user (e.g. on password change). */
  static async revokeAllTokens(userId: string | number): Promise<void> {
    const { PersonalAccessToken } = await import('./personal-access-token');
    await PersonalAccessToken.where<PersonalAccessToken>('tokenable_id', userId).delete();
  }

  /** List all active tokens for a user (safe to expose — hashes are never returned). */
  static async listTokens(userId: string | number): Promise<PersonalAccessToken[]> {
    const { PersonalAccessToken } = await import('./personal-access-token');
    return PersonalAccessToken.where<PersonalAccessToken>('tokenable_id', userId).get();
  }
}
