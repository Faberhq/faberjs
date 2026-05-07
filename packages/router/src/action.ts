import type { Constructor } from '@faber-js/core';
import type { ControllerAction } from '@faber-js/http';
import { buildUrl, getRouter, type RouteParams } from './helpers';

export class ActionNotFoundException extends Error {
  constructor(controller: string, method?: string) {
    const target = method ? `${controller}@${method}` : controller;
    super(`No route is registered for action [${target}].`);
    this.name = 'ActionNotFoundException';
  }
}

type ActionTarget = Constructor | readonly [Constructor] | readonly [Constructor, string];

function matches(handler: ControllerAction, target: ActionTarget): boolean {
  if (typeof target === 'function') {
    if (typeof handler === 'function') return handler === target;
    if (Array.isArray(handler)) return handler[0] === target && handler.length === 1;
    return false;
  }
  const [klass, method] = target as readonly [Constructor, string?];
  if (typeof handler === 'function') {
    return handler === klass && method === undefined;
  }
  if (Array.isArray(handler)) {
    if (handler[0] !== klass) return false;
    return handler[1] === method || (handler.length === 1 && method === undefined);
  }
  return false;
}

/**
 * Generate a URL for a controller action. Searches registered routes for one
 * whose handler matches the given `[Controller, method]` tuple (or invokable
 * `Controller`) and substitutes parameters into its path.
 */
export function action(target: ActionTarget, params: RouteParams = {}): string {
  const router = getRouter();
  const found = router.getRoutes().find((def) => matches(def.handler, target));
  if (!found) {
    const klass = typeof target === 'function' ? target : target[0];
    const method = Array.isArray(target) ? target[1] : undefined;
    throw new ActionNotFoundException(klass.name, method);
  }
  return buildUrl(found.path, params);
}
