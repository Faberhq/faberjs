# Events & Listeners

FaberJS events are lightweight payloads that describe something that happened in your system. Listeners react to those events. This decouples your services — `UserService.register()` fires a `UserRegistered` event without knowing what happens next.

Like Laravel's `event(new UserRegistered($user))`, FaberJS exposes a global `event()` helper.

## Prerequisites

Register `EventServiceProvider` in `bootstrap/app.ts`:

```typescript
import { EventServiceProvider } from '@faber-js/events';

app.register(new EventServiceProvider(app));
```

## Defining an event

Generate a stub:

```bash
faber make:event UserRegistered
```

Events are plain TypeScript interfaces (or objects). There is no base class required. The only convention is a `type` field:

```typescript
// app/events/UserRegisteredEvent.ts
export interface UserRegisteredEvent {
  readonly type: 'UserRegistered';
  readonly userId: number;
  readonly email: string;
  readonly name: string;
}
```

You can also use plain objects inline:

```typescript
await event({ type: 'UserRegistered', userId: user.id });
```

## Defining a listener

```bash
faber make:listener SendWelcomeEmailListener
```

```typescript
// app/listeners/SendWelcomeEmailListener.ts
import { Listener } from '@faber-js/events';
import type { EventPayload } from '@faber-js/events';

export class SendWelcomeEmailListener extends Listener {
  async handle(event: EventPayload): Promise<void> {
    const { userId, email, name } = event as { userId: number; email: string; name: string };
    // Send the email
    await mailer.send({ to: email, subject: `Welcome, ${name}!` });
  }
}
```

### Queued listeners

Set `readonly queue = 'default'` (or any queue name) to run the listener asynchronously via BullMQ:

```typescript
export class SyncToAnalyticsListener extends Listener {
  override readonly queue = 'analytics';

  async handle(event: EventPayload): Promise<void> {
    await analytics.track(event['userId'] as number, 'registered');
  }
}
```

## Registering listeners

Map event types to listener classes in your `EventServiceProvider` (or in a custom service provider):

```typescript
import { EventServiceProvider as BaseEventServiceProvider } from '@faber-js/events';
import { Event } from '@faber-js/events';
import { SendWelcomeEmailListener } from '../listeners/SendWelcomeEmailListener';
import { SyncToAnalyticsListener } from '../listeners/SyncToAnalyticsListener';

export class EventServiceProvider extends BaseEventServiceProvider {
  override boot(): void {
    Event.listen('UserRegistered', SendWelcomeEmailListener);
    Event.listen('UserRegistered', SyncToAnalyticsListener);
    Event.listen('PostPublished', NotifyFollowersListener);
  }
}
```

## Dispatching an event

Use the `event()` helper from `@faber-js/events`:

```typescript
import { event } from '@faber-js/events';

await event({ type: 'UserRegistered', userId: user.id, email: user.email });
```

Or use `Event.dispatch()` directly:

```typescript
import { Event } from '@faber-js/events';

await Event.dispatch({ type: 'PostPublished', postId: post.id });
```

## Wildcard listeners

Listen to every event with `'*'`:

```typescript
Event.listen('*', async (payload) => {
  console.log('Event fired:', payload['type']);
});
```

Wildcard handlers receive the full payload and fire before typed listeners.

## Full example

```typescript
// app/services/UserService.ts
import { Injectable, Service } from '@faber-js/core';
import { event } from '@faber-js/events';
import { User } from '../models/User';

@Injectable()
export class UserService extends Service {
  async register(attrs: { name: string; email: string; password: string }): Promise<User> {
    const user = await User.create<User>(attrs);

    await event({
      type: 'UserRegistered',
      userId: user.getAttribute('id') as number,
      email: attrs.email,
      name: attrs.name,
    });

    return user;
  }
}
```

```typescript
// app/listeners/SendWelcomeEmailListener.ts
import { Listener } from '@faber-js/events';
import type { EventPayload } from '@faber-js/events';

export class SendWelcomeEmailListener extends Listener {
  async handle(event: EventPayload): Promise<void> {
    console.log(`Sending welcome email to ${event['email']}`);
  }
}
```

```typescript
// bootstrap/events.ts or inside your EventServiceProvider.boot():
import { Event } from '@faber-js/events';
import { SendWelcomeEmailListener } from '../app/listeners/SendWelcomeEmailListener';

Event.listen('UserRegistered', SendWelcomeEmailListener);
```

## Sync vs. queued dispatch summary

| Listener type | How                          | When to use                                                |
| ------------- | ---------------------------- | ---------------------------------------------------------- |
| Synchronous   | No `queue` property          | Fast operations that must complete before the response     |
| Queued        | `readonly queue = 'default'` | Slow or unreliable operations (email, analytics, webhooks) |

Queued listeners require BullMQ and Redis. See [Jobs & Queues](/digging-deeper/jobs-queues).
