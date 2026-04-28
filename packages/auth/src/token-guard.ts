import crypto from 'node:crypto';
import type { AuthUser } from '@faber-js/http';
import type { GuardContract, TokenConfig, UserProviderContract } from './types';
import { PersonalAccessToken } from './personal-access-token';

export interface NewTokenResult {
  /** The plaintext `{id}|{secret}` token — show this to the user exactly once. */
  readonly plainTextToken: string;
  readonly accessToken: PersonalAccessToken;
}

export class TokenGuard implements GuardContract {
  readonly #provider: UserProviderContract;
  readonly #config: TokenConfig;

  constructor(provider: UserProviderContract, config: TokenConfig = {}) {
    this.#provider = provider;
    this.#config = config;
  }

  async attempt(credentials: Record<string, unknown>): Promise<string | null> {
    const user = await this.#provider.findByCredentials(credentials);
    if (!user) return null;
    const { plainTextToken } = await this.issueToken(user.id, 'default');
    return plainTextToken;
  }

  async issueToken(
    userId: string | number,
    name: string,
    abilities: string[] = ['*'],
  ): Promise<NewTokenResult> {
    const secret = crypto.randomBytes(40).toString('hex');
    const hash = crypto.createHash('sha256').update(secret).digest('hex');

    const record = await PersonalAccessToken.create<PersonalAccessToken>({
      tokenable_type: 'users',
      tokenable_id: userId,
      name,
      token: hash,
      abilities: JSON.stringify(abilities),
      expires_at: this.#config.expiresIn ? resolveExpiry(this.#config.expiresIn) : null,
    });

    const id = record.getAttribute('id') as number;
    return { plainTextToken: `${id}|${secret}`, accessToken: record };
  }

  async user(rawToken: string): Promise<AuthUser | null> {
    const record = await this.#resolveToken(rawToken);
    if (!record) return null;

    const userId = record.getAttribute('tokenable_id') as string | number;
    const user = await this.#provider.findById(userId);
    if (!user) return null;

    // Fire-and-forget last_used_at update — never blocks the request
    void record.update({ last_used_at: new Date().toISOString() });

    // Attach token so TokenAuth.tokenCan() works
    (user as Record<string, unknown>)['_token'] = record;
    return user;
  }

  async check(rawToken: string): Promise<boolean> {
    return (await this.#resolveToken(rawToken)) !== null;
  }

  async id(rawToken: string): Promise<string | number | null> {
    const record = await this.#resolveToken(rawToken);
    return record ? (record.getAttribute('tokenable_id') as string | number) : null;
  }

  async #resolveToken(rawToken: string): Promise<PersonalAccessToken | null> {
    const pipe = rawToken.indexOf('|');
    if (pipe === -1) return null;

    const idNum = Number(rawToken.slice(0, pipe));
    const secret = rawToken.slice(pipe + 1);
    if (!Number.isFinite(idNum) || idNum <= 0) return null;

    const record = await PersonalAccessToken.find<PersonalAccessToken>(idNum);
    if (!record) return null;

    // Check expiry
    const expiresAt = record.getAttribute('expires_at') as string | null;
    if (expiresAt && new Date(expiresAt) < new Date()) return null;

    // Timing-safe hash comparison
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const stored = record.getAttribute('token') as string;
    if (
      hash.length !== stored.length ||
      !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(stored))
    ) {
      return null;
    }

    return record;
  }
}

function resolveExpiry(expiresIn: string): string {
  const match = /^(\d+)(ms|s|m|h|d|w)$/.exec(expiresIn);
  if (!match) {
    throw new Error(`Invalid expiresIn: "${expiresIn}". Use e.g. "30d", "24h", "15m".`);
  }
  const n = Number(match[1]);
  const units: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  return new Date(Date.now() + n * (units[match[2]] ?? 1_000)).toISOString();
}
