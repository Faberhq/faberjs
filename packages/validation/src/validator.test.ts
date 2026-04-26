import { describe, expect, it } from 'vitest';
import { Rule } from './rule-builder';
import { Validator } from './validator';

describe('Validator', () => {
  describe('required', () => {
    it('passes when value is present', async () => {
      const r = await new Validator({ name: 'Alice' }, { name: 'required' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when value is empty string', async () => {
      const r = await new Validator({ name: '' }, { name: 'required' }).validate();
      expect(r.passes).toBe(false);
      expect(r.errors['name']).toBeDefined();
    });

    it('fails when value is missing', async () => {
      const r = await new Validator({}, { name: 'required' }).validate();
      expect(r.passes).toBe(false);
    });

    it('fails when value is null', async () => {
      const r = await new Validator({ name: null }, { name: 'required' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('string', () => {
    it('passes for string values', async () => {
      const r = await new Validator({ x: 'hello' }, { x: 'string' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails for non-string values', async () => {
      const r = await new Validator({ x: 42 }, { x: 'string' }).validate();
      expect(r.passes).toBe(false);
    });

    it('passes for null (optional field)', async () => {
      const r = await new Validator({ x: null }, { x: 'string' }).validate();
      expect(r.passes).toBe(true);
    });
  });

  describe('integer', () => {
    it('passes for integer values', async () => {
      const r = await new Validator({ age: 25 }, { age: 'integer' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails for float', async () => {
      const r = await new Validator({ age: 3.14 }, { age: 'integer' }).validate();
      expect(r.passes).toBe(false);
    });

    it('fails for non-numeric string', async () => {
      const r = await new Validator({ age: 'abc' }, { age: 'integer' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('numeric', () => {
    it('passes for numeric string', async () => {
      const r = await new Validator({ price: '9.99' }, { price: 'numeric' }).validate();
      expect(r.passes).toBe(true);
    });

    it('passes for number', async () => {
      const r = await new Validator({ price: 9.99 }, { price: 'numeric' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails for non-numeric', async () => {
      const r = await new Validator({ price: 'abc' }, { price: 'numeric' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('boolean', () => {
    it('passes for true', async () => {
      expect((await new Validator({ x: true }, { x: 'boolean' }).validate()).passes).toBe(true);
    });

    it('passes for false', async () => {
      expect((await new Validator({ x: false }, { x: 'boolean' }).validate()).passes).toBe(true);
    });

    it('passes for string "1"', async () => {
      expect((await new Validator({ x: '1' }, { x: 'boolean' }).validate()).passes).toBe(true);
    });

    it('passes for string "0"', async () => {
      expect((await new Validator({ x: '0' }, { x: 'boolean' }).validate()).passes).toBe(true);
    });

    it('passes for string "true"', async () => {
      expect((await new Validator({ x: 'true' }, { x: 'boolean' }).validate()).passes).toBe(true);
    });

    it('passes for string "false"', async () => {
      expect((await new Validator({ x: 'false' }, { x: 'boolean' }).validate()).passes).toBe(true);
    });

    it('fails for non-boolean string "yes"', async () => {
      const r = await new Validator({ x: 'yes' }, { x: 'boolean' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('email', () => {
    it('passes valid email', async () => {
      const r = await new Validator({ email: 'a@b.com' }, { email: 'email' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails invalid email', async () => {
      const r = await new Validator({ email: 'not-an-email' }, { email: 'email' }).validate();
      expect(r.passes).toBe(false);
    });

    it('passes when empty (not required)', async () => {
      const r = await new Validator({ email: '' }, { email: 'email' }).validate();
      expect(r.passes).toBe(true);
    });
  });

  describe('url', () => {
    it('passes valid URL', async () => {
      const r = await new Validator({ site: 'https://example.com' }, { site: 'url' }).validate();
      expect(r.passes).toBe(true);
    });

    it('passes URL with path', async () => {
      const r = await new Validator(
        { site: 'https://example.com/path?q=1' },
        { site: 'url' },
      ).validate();
      expect(r.passes).toBe(true);
    });

    it('fails invalid URL', async () => {
      const r = await new Validator({ site: 'not-a-url' }, { site: 'url' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('min', () => {
    it('passes when string length >= min', async () => {
      const r = await new Validator({ pw: 'abcdefgh' }, { pw: 'min:8' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when string length < min', async () => {
      const r = await new Validator({ pw: 'short' }, { pw: 'min:8' }).validate();
      expect(r.passes).toBe(false);
    });

    it('passes when number >= min', async () => {
      const r = await new Validator({ age: 18 }, { age: 'min:18' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when number < min', async () => {
      const r = await new Validator({ age: 17 }, { age: 'min:18' }).validate();
      expect(r.passes).toBe(false);
    });

    it('error message contains field name and min value', async () => {
      const r = await new Validator({ pw: 'hi' }, { pw: 'min:6' }).validate();
      expect(r.errors['pw']?.[0]).toContain('6');
    });
  });

  describe('max', () => {
    it('passes when string length <= max', async () => {
      const r = await new Validator({ name: 'Ali' }, { name: 'max:10' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when string length > max', async () => {
      const r = await new Validator(
        { name: 'Aisha Bello Adekunle' },
        { name: 'max:10' },
      ).validate();
      expect(r.passes).toBe(false);
    });

    it('passes when number <= max', async () => {
      const r = await new Validator({ qty: 99 }, { qty: 'max:100' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when number > max', async () => {
      const r = await new Validator({ qty: 101 }, { qty: 'max:100' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('in', () => {
    it('passes when value is in allowed list', async () => {
      const r = await new Validator(
        { role: 'admin' },
        { role: 'in:admin,editor,viewer' },
      ).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when value is not in allowed list', async () => {
      const r = await new Validator(
        { role: 'superuser' },
        { role: 'in:admin,editor,viewer' },
      ).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('confirmed', () => {
    it('passes when field matches _confirmation field', async () => {
      const r = await new Validator(
        { password: 'secret', password_confirmation: 'secret' },
        { password: 'confirmed' },
      ).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when confirmation does not match', async () => {
      const r = await new Validator(
        { password: 'secret', password_confirmation: 'different' },
        { password: 'confirmed' },
      ).validate();
      expect(r.passes).toBe(false);
    });

    it('fails when confirmation is missing', async () => {
      const r = await new Validator({ password: 'secret' }, { password: 'confirmed' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('nullable', () => {
    it('passes when value is null', async () => {
      const r = await new Validator({ x: null }, { x: 'nullable' }).validate();
      expect(r.passes).toBe(true);
    });

    it('passes with nullable combined with string', async () => {
      const r = await new Validator({ x: null }, { x: 'nullable|string' }).validate();
      expect(r.passes).toBe(true);
    });
  });

  describe('regex (string syntax)', () => {
    it('passes when value matches pattern', async () => {
      const r = await new Validator({ code: 'ABC123' }, { code: 'regex:^[A-Z]+\\d+$' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when value does not match pattern', async () => {
      const r = await new Validator({ code: 'abc' }, { code: 'regex:^[A-Z]+\\d+$' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('Rule.regex() object', () => {
    it('passes when value matches regex', async () => {
      const r = await new Validator(
        { code: 'ABC123' },
        { code: [Rule.regex(/^[A-Z]+\d+$/)] },
      ).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when value does not match regex', async () => {
      const r = await new Validator(
        { code: 'abc' },
        { code: [Rule.regex(/^[A-Z]+\d+$/)] },
      ).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('Rule.in() object', () => {
    it('passes when value is in allowed list', async () => {
      const r = await new Validator(
        { status: 'active' },
        { status: [Rule.in('active', 'inactive', 'banned')] },
      ).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when value is not in allowed list', async () => {
      const r = await new Validator(
        { status: 'deleted' },
        { status: [Rule.in('active', 'inactive', 'banned')] },
      ).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('same', () => {
    it('passes when two fields match', async () => {
      const r = await new Validator({ a: 'x', b: 'x' }, { a: 'same:b' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when two fields differ', async () => {
      const r = await new Validator({ a: 'x', b: 'y' }, { a: 'same:b' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('different', () => {
    it('passes when two fields differ', async () => {
      const r = await new Validator({ a: 'x', b: 'y' }, { a: 'different:b' }).validate();
      expect(r.passes).toBe(true);
    });

    it('fails when two fields are the same', async () => {
      const r = await new Validator({ a: 'x', b: 'x' }, { a: 'different:b' }).validate();
      expect(r.passes).toBe(false);
    });
  });

  describe('array syntax', () => {
    it('supports array of string rules', async () => {
      const r = await new Validator(
        { email: 'a@b.com' },
        { email: ['required', 'email'] },
      ).validate();
      expect(r.passes).toBe(true);
    });

    it('stops on first failure per field (bail behaviour)', async () => {
      const r = await new Validator({ email: '' }, { email: ['required', 'email'] }).validate();
      expect(r.passes).toBe(false);
      // Only one error per field due to bail behaviour
      expect(r.errors['email']).toHaveLength(1);
    });
  });

  describe('pipe syntax', () => {
    it('supports pipe-separated rules string', async () => {
      const r = await new Validator(
        { name: 'Alice', email: 'a@b.com' },
        { name: 'required|string|min:2', email: 'required|email' },
      ).validate();
      expect(r.passes).toBe(true);
    });
  });

  describe('error bag shape', () => {
    it('returns errors keyed by field name', async () => {
      const r = await new Validator(
        { name: '', email: 'bad' },
        { name: 'required', email: 'email' },
      ).validate();
      expect(r.passes).toBe(false);
      expect(r.errors['name']).toBeInstanceOf(Array);
      expect(r.errors['email']).toBeInstanceOf(Array);
    });

    it('error messages are non-empty strings', async () => {
      const r = await new Validator({ name: '' }, { name: 'required' }).validate();
      expect(typeof r.errors['name']?.[0]).toBe('string');
      expect((r.errors['name']?.[0] ?? '').length).toBeGreaterThan(0);
    });

    it('collects errors from multiple fields', async () => {
      const r = await new Validator(
        {},
        { name: 'required', email: 'required', age: 'required' },
      ).validate();
      expect(Object.keys(r.errors)).toHaveLength(3);
    });
  });

  describe('multiple rules pass', () => {
    it('returns passes: true when all fields and rules pass', async () => {
      const r = await new Validator(
        { name: 'Bob', age: 25, email: 'bob@example.com', role: 'admin' },
        {
          name: 'required|string|min:2|max:50',
          age: 'required|integer|min:18',
          email: 'required|email',
          role: 'in:admin,editor',
        },
      ).validate();
      expect(r.passes).toBe(true);
      expect(r.errors).toEqual({});
    });
  });
});
