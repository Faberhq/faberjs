import { Application } from '@faberjs/core';
import type { RouterContract } from '@faberjs/http';

export class RouteNotFoundException extends Error {
  constructor(name: string) {
    super(`Route [${name}] is not defined.`);
    this.name = 'RouteNotFoundException';
  }
}

export function route(name: string, params: Record<string, string | number> = {}): string {
  const router = Application.getInstance().make<RouterContract>('router');
  const definition = router.findByName(name);

  if (!definition) {
    throw new RouteNotFoundException(name);
  }

  let url = definition.path;
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, String(value));
  }
  return url;
}
