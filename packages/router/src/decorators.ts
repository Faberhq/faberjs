import 'reflect-metadata';
import type { Constructor } from '@faber-js/core';

const CTRL_MW_KEY = Symbol.for('faber:controller:middleware');
const METHOD_MW_KEY = Symbol.for('faber:method:middleware');
const AUTHORIZE_KEY = Symbol.for('faber:authorize');

export interface MiddlewareEntry {
  name: string;
  only?: string[];
  except?: string[];
}

export interface AuthorizeEntry {
  ability: string;
  model: Constructor | string | readonly [Constructor, string] | undefined;
}

/**
 * Assigns named middleware to a controller class or individual method.
 *
 * Class-level: applies to every method unless `only`/`except` is specified.
 * Method-level: applies only to that method.
 *
 * @example
 * \@Middleware('auth')
 * \@Middleware('log', { only: ['index'] })
 * export class UserController extends Controller { ... }
 */
export function Middleware(
  name: string,
  options?: { only?: string[]; except?: string[] },
): ClassDecorator & MethodDecorator {
  return function (target: object, propertyKey?: string | symbol): void {
    const entry: MiddlewareEntry = { name, ...options };

    if (propertyKey !== undefined) {
      const key = String(propertyKey);
      const existing: MiddlewareEntry[] = Reflect.getMetadata(METHOD_MW_KEY, target, key) ?? [];
      existing.push(entry);
      Reflect.defineMetadata(METHOD_MW_KEY, existing, target, key);
    } else {
      const existing: MiddlewareEntry[] = Reflect.getMetadata(CTRL_MW_KEY, target) ?? [];
      existing.push(entry);
      Reflect.defineMetadata(CTRL_MW_KEY, existing, target);
    }
  } as ClassDecorator & MethodDecorator;
}

/**
 * Authorizes a controller method using the gate service.
 *
 * The second argument can be:
 * - A model Constructor: uses that class to find the policy
 * - A string: treated as a route parameter name; its value is passed to the policy
 * - A tuple [Constructor, string]: model class + route param for policies with a parent
 *
 * @example
 * \@Authorize('view', Comment)
 * \@Authorize('delete', 'comment')
 * \@Authorize('create', [Comment, 'post'])
 */
export function Authorize(
  ability: string,
  model?: Constructor | string | readonly [Constructor, string],
): MethodDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const key = String(propertyKey);
    const existing: AuthorizeEntry[] = Reflect.getMetadata(AUTHORIZE_KEY, target, key) ?? [];
    existing.push({ ability, model });
    Reflect.defineMetadata(AUTHORIZE_KEY, existing, target, key);
  };
}

export { CTRL_MW_KEY, METHOD_MW_KEY, AUTHORIZE_KEY };
