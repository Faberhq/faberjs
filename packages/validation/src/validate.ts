import { ValidationException } from '@faber-js/http';
import type { InputData, ValidationRules } from './types';
import { Validator } from './validator';

export async function validate(data: InputData, rules: ValidationRules): Promise<InputData> {
  const validator = new Validator(data, rules);
  const result = await validator.validate();
  if (!result.passes) {
    throw new ValidationException(result.errors);
  }
  return data;
}
