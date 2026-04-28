import { Application, Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import { Response } from '@faber-js/http';
import type { ViewRenderer } from './ViewRenderer';

@Injectable()
export abstract class ViewController extends Controller {
  protected async view<P extends Record<string, unknown>>(
    name: string,
    props: P = {} as P,
  ): Promise<Response> {
    const renderer = Application.getInstance().make<ViewRenderer>('view.renderer');
    const html = await renderer.render(name, props);
    return Response.html(html);
  }
}
