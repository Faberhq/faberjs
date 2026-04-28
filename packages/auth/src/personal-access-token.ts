import { Model } from '@faber-js/orm';

export class PersonalAccessToken extends Model {
  static table = 'personal_access_tokens';
  static fillable = [
    'tokenable_type',
    'tokenable_id',
    'name',
    'token',
    'abilities',
    'last_used_at',
    'expires_at',
  ];

  getAbilities(): string[] {
    const raw = this.getAttribute('abilities') as string | null;
    if (!raw) return ['*'];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return ['*'];
    }
  }
}
