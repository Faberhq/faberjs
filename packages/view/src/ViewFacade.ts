import { Application } from '@faber-js/core';
import type { ComposerHandler } from './types';
import type { ViewRenderer } from './ViewRenderer';
import { ViewResponse } from './ViewResponse';

function renderer(): ViewRenderer {
  return Application.getInstance().make<ViewRenderer>('view.renderer');
}

export const View = {
  make(name: string, data: Record<string, unknown> = {}): ViewResponse {
    return new ViewResponse(name, data);
  },

  exists(name: string): boolean {
    return renderer().exists(name);
  },

  first(names: string[], data: Record<string, unknown> = {}): ViewResponse {
    const found = renderer().findFirst(names);
    return new ViewResponse(found, data);
  },

  share(key: string, value: unknown): void {
    renderer().share(key, value);
  },

  composer(views: string | string[], handler: ComposerHandler): void {
    renderer().addComposer(views, handler);
  },

  creator(views: string | string[], handler: ComposerHandler): void {
    renderer().addCreator(views, handler);
  },
};
