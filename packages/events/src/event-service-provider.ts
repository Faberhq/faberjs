import { ServiceProvider } from '@faber-js/core';
import type { ListenMap, ListenerConstructor } from './types';
import { EventDispatcher } from './event-dispatcher';
import { getListenFor } from './listen-for';

export abstract class EventServiceProvider extends ServiceProvider {
  protected readonly listen: ListenMap = {};
  protected readonly listeners: ListenerConstructor[] = [];

  register(): void {
    this.app.singleton('events', () => {
      const dispatcher = new EventDispatcher();
      for (const [eventType, listenerCtors] of Object.entries(this.listen)) {
        for (const ListenerCtor of listenerCtors) {
          dispatcher.listen(eventType, ListenerCtor);
        }
      }
      for (const ListenerCtor of this.listeners) {
        const eventType = getListenFor(ListenerCtor as new (...args: unknown[]) => unknown);
        if (eventType) {
          dispatcher.listen(eventType, ListenerCtor);
        }
      }
      return dispatcher;
    });
  }
}
