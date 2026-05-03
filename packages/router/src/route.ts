import { Application } from '@faber-js/core';
import type { Constructor } from '@faber-js/core';
import { getCurrentRequest } from '@faber-js/http';
import type {
  ControllerAction,
  HttpMethod,
  ModelBindingResolver,
  RouteDefinition,
} from '@faber-js/http';
import { Router } from './router';
import type { RouteBuilder } from './route-builder';
import type { ResourceBuilder } from './resource-builder';
import type { SingletonBuilder } from './singleton-builder';
import type { RouteGroupOptions } from './types';

function getRouter(): Router {
  return Application.getInstance().make<Router>('router');
}

export const Route = {
  get(path: string, handler: ControllerAction | string): RouteBuilder {
    return getRouter().get(path, handler);
  },

  post(path: string, handler: ControllerAction | string): RouteBuilder {
    return getRouter().post(path, handler);
  },

  put(path: string, handler: ControllerAction | string): RouteBuilder {
    return getRouter().put(path, handler);
  },

  patch(path: string, handler: ControllerAction | string): RouteBuilder {
    return getRouter().patch(path, handler);
  },

  delete(path: string, handler: ControllerAction | string): RouteBuilder {
    return getRouter().delete(path, handler);
  },

  options(path: string, handler: ControllerAction | string): RouteBuilder {
    return getRouter().options(path, handler);
  },

  match(methods: HttpMethod[], path: string, handler: ControllerAction | string): RouteBuilder {
    return getRouter().match(methods, path, handler);
  },

  any(path: string, handler: ControllerAction | string): RouteBuilder {
    return getRouter().any(path, handler);
  },

  redirect(from: string, to: string, status = 302): RouteBuilder {
    return getRouter().redirect(from, to, status);
  },

  permanentRedirect(from: string, to: string): RouteBuilder {
    return getRouter().permanentRedirect(from, to);
  },

  fallback(handler: ControllerAction): void {
    getRouter().fallback(handler);
  },

  pattern(name: string, regex: string): void {
    getRouter().pattern(name, regex);
  },

  group(options: RouteGroupOptions, callback: () => void): void {
    getRouter().group(options, callback);
  },

  resource(name: string, controller: Constructor): ResourceBuilder {
    return getRouter().resource(name, controller);
  },

  resources(map: Record<string, Constructor>): void {
    getRouter().resources(map);
  },

  apiResource(name: string, controller: Constructor): ResourceBuilder {
    return getRouter().apiResource(name, controller);
  },

  apiResources(map: Record<string, Constructor>): void {
    getRouter().apiResources(map);
  },

  singleton(name: string, controller: Constructor): SingletonBuilder {
    return getRouter().singleton(name, controller);
  },

  apiSingleton(name: string, controller: Constructor): SingletonBuilder {
    return getRouter().apiSingleton(name, controller);
  },

  softDeletableResources(map: Record<string, Constructor>): void {
    getRouter().softDeletableResources(map);
  },

  resourceVerbs(verbs: Partial<{ create: string; edit: string }>): void {
    Router.resourceVerbs(verbs);
  },

  model(paramName: string, klass: Constructor, column?: string): void {
    getRouter().model(paramName, klass, column);
  },

  bind(paramName: string, resolver: ModelBindingResolver): void {
    getRouter().bind(paramName, resolver);
  },

  current(): RouteDefinition | null {
    return getCurrentRequest()?.currentRoute() ?? null;
  },

  currentRouteName(): string | undefined {
    return Route.current()?.name;
  },

  currentRouteAction(): ControllerAction | undefined {
    return Route.current()?.handler;
  },
} as const;
