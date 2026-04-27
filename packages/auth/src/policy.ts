import type { AuthUser } from '@faber-js/http';
import type { PolicyContract } from './types';

export abstract class Policy implements PolicyContract {
  before?(user: AuthUser, ability: string): boolean | undefined | Promise<boolean | undefined>;
}
