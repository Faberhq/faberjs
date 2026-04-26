import { describe, expect, it } from 'vitest';
import {
  ForbiddenException,
  HttpException,
  ModelNotFoundException,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
} from './exceptions';

describe('HttpException', () => {
  it('stores message and status code', () => {
    const ex = new HttpException('Something went wrong', 500);
    expect(ex.message).toBe('Something went wrong');
    expect(ex.statusCode).toBe(500);
  });

  it('stores optional data payload', () => {
    const data = { field: ['required'] };
    const ex = new HttpException('Invalid', 422, data);
    expect(ex.data).toEqual(data);
  });

  it('extends Error', () => {
    expect(new HttpException('oops', 400)).toBeInstanceOf(Error);
  });
});

describe('NotFoundException', () => {
  it('has status 404 and default message', () => {
    const ex = new NotFoundException();
    expect(ex.statusCode).toBe(404);
    expect(ex.message).toBe('Not Found');
  });

  it('accepts a custom message', () => {
    expect(new NotFoundException('User not found').message).toBe('User not found');
  });
});

describe('UnauthorizedException', () => {
  it('has status 401', () => {
    expect(new UnauthorizedException().statusCode).toBe(401);
  });
});

describe('ForbiddenException', () => {
  it('has status 403', () => {
    expect(new ForbiddenException().statusCode).toBe(403);
  });
});

describe('ValidationException', () => {
  it('has status 422 and stores errors bag', () => {
    const errors = { email: ['Email is required'] };
    const ex = new ValidationException(errors);
    expect(ex.statusCode).toBe(422);
    expect(ex.errors).toEqual(errors);
    expect(ex.message).toBe('The given data was invalid.');
  });
});

describe('ModelNotFoundException', () => {
  it('has status 404 with model name in message', () => {
    const ex = new ModelNotFoundException('User');
    expect(ex.statusCode).toBe(404);
    expect(ex.message).toContain('User');
  });

  it('uses default model name when not provided', () => {
    expect(new ModelNotFoundException().message).toContain('Model');
  });
});
