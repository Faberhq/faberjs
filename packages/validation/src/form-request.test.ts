import { describe, expect, it } from 'vitest';
import { ForbiddenException, Request, ValidationException } from '@faberjs/http';
import { FormRequest } from './form-request';
import type { InputData, ValidationRules } from './types';

function makeRequest(body: Record<string, unknown> = {}): Request {
  return new Request({
    method: 'POST',
    path: '/test',
    body,
    headers: { 'content-type': 'application/json' },
  });
}

class CreateUserRequest extends FormRequest {
  rules(): ValidationRules {
    return {
      name: 'required|string',
      email: 'required|email',
    };
  }
}

class AuthorizedRequest extends FormRequest {
  rules(): ValidationRules {
    return { name: 'required' };
  }

  override authorize(): boolean {
    return false;
  }
}

class AsyncAuthorizedRequest extends FormRequest {
  rules(): ValidationRules {
    return { name: 'required' };
  }

  override async authorize(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

class AlwaysPassRequest extends FormRequest {
  rules(): ValidationRules {
    return { name: 'required' };
  }

  override authorize(): boolean {
    return true;
  }
}

describe('FormRequest', () => {
  describe('validate() — happy path', () => {
    it('returns validated input data when rules pass', async () => {
      const req = makeRequest({ name: 'Alice', email: 'alice@test.com' });
      const formReq = new CreateUserRequest(req);
      const data: InputData = await formReq.validate();
      expect(data['name']).toBe('Alice');
      expect(data['email']).toBe('alice@test.com');
    });

    it('passes when authorize() returns true', async () => {
      const req = makeRequest({ name: 'Bob' });
      const formReq = new AlwaysPassRequest(req);
      await expect(formReq.validate()).resolves.toBeDefined();
    });
  });

  describe('validate() — validation failure → 422', () => {
    it('throws ValidationException when required field is missing', async () => {
      const req = makeRequest({});
      const formReq = new CreateUserRequest(req);
      await expect(formReq.validate()).rejects.toThrow(ValidationException);
    });

    it('throws ValidationException with 422 status code', async () => {
      const req = makeRequest({ name: '' });
      const formReq = new CreateUserRequest(req);
      try {
        await formReq.validate();
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationException);
        const ve = e as ValidationException;
        expect(ve.statusCode).toBe(422);
      }
    });

    it('ValidationException carries the full error bag', async () => {
      const req = makeRequest({ name: '', email: 'not-an-email' });
      const formReq = new CreateUserRequest(req);
      try {
        await formReq.validate();
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationException);
        const ve = e as ValidationException;
        expect(ve.errors['name']).toBeDefined();
        expect(ve.errors['name']).toBeInstanceOf(Array);
      }
    });

    it('error bag message is a non-empty string', async () => {
      const req = makeRequest({ name: '' });
      const formReq = new CreateUserRequest(req);
      try {
        await formReq.validate();
        expect.fail('should have thrown');
      } catch (e) {
        const ve = e as ValidationException;
        expect((ve.errors['name']?.[0] ?? '').length).toBeGreaterThan(0);
      }
    });

    it('ValidationException message is set', async () => {
      const req = makeRequest({ name: '' });
      const formReq = new CreateUserRequest(req);
      try {
        await formReq.validate();
        expect.fail('should have thrown');
      } catch (e) {
        const ve = e as ValidationException;
        expect(ve.message).toBe('The given data was invalid.');
      }
    });
  });

  describe('authorize() returning false → 403', () => {
    it('throws ForbiddenException when authorize() returns false', async () => {
      const req = makeRequest({ name: 'Alice' });
      const formReq = new AuthorizedRequest(req);
      await expect(formReq.validate()).rejects.toThrow(ForbiddenException);
    });

    it('ForbiddenException has 403 status code', async () => {
      const req = makeRequest({ name: 'Alice' });
      const formReq = new AuthorizedRequest(req);
      try {
        await formReq.validate();
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ForbiddenException);
        const fe = e as ForbiddenException;
        expect(fe.statusCode).toBe(403);
      }
    });

    it('throws ForbiddenException before validation runs (async authorize)', async () => {
      const req = makeRequest({ name: 'Alice' });
      const formReq = new AsyncAuthorizedRequest(req);
      await expect(formReq.validate()).rejects.toThrow(ForbiddenException);
    });

    it('ForbiddenException is not a ValidationException', async () => {
      const req = makeRequest({ name: 'Alice' });
      const formReq = new AuthorizedRequest(req);
      try {
        await formReq.validate();
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).not.toBeInstanceOf(ValidationException);
      }
    });
  });
});
