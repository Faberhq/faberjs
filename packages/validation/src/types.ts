export type RuleValue = string | number | boolean | null | undefined;
export type InputData = Record<string, RuleValue | RuleValue[]>;
export type ErrorBag = Record<string, string[]>;
export type RuleDefinition = string | RuleObject;
export type FieldRules = string | Array<string | RuleObject>;
export type ValidationRules = Record<string, FieldRules>;

export interface RuleObject {
  readonly name: string;
  validate(field: string, value: RuleValue, data: InputData): Promise<string | null>;
}

export interface ValidationResult {
  readonly passes: boolean;
  readonly errors: ErrorBag;
}

export interface AuthUser {
  readonly id: number | string;
  can(ability: string): boolean;
}
