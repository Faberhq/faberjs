# Real-Time Channels

`@faber-js/channels` adds first-class WebSocket channels to FaberJS. Channel registration feels like HTTP routing — same DI container, same middleware pipeline, same auth guards — just over a persistent connection.

## Prerequisites

```bash
pnpm add @faber-js/channels
```

Register `ChannelsServiceProvider` in `bootstrap/app.ts`:

```typescript
import { ChannelsServiceProvider } from '@faber-js/channels';

app.register(new ChannelsServiceProvider(app));
```

## Registering channels

Create `routes/channels.ts` and use the `Channel` facade:

```typescript
import { Channel } from '@faber-js/channels';
import { NotificationChannel } from '../app/channels/NotificationChannel';
import { UserChannel } from '../app/channels/UserChannel';
import { RoomChannel } from '../app/channels/RoomChannel';

Channel.public('notifications', [NotificationChannel, 'subscribe']);
Channel.private('user.{id}', [AuthMiddleware], [UserChannel, 'presence']);
Channel.presence('room.{slug}', [AuthMiddleware], [RoomChannel, 'join']);
```

**Channel types:**

| Type | Auth required | Presence tracking |
|---|---|---|
| `Channel.public()` | No | No |
| `Channel.private()` | Yes | No |
| `Channel.presence()` | Yes | Yes |

## Generating a channel

```bash
npx faber make:channel Room
```

Generated file (`app/channels/RoomChannel.ts`):

```typescript
import { Injectable } from '@faber-js/core';
import { Channel, Socket } from '@faber-js/channels';

@Injectable()
export class RoomChannel extends Channel {
  async handle(socket: Socket): Promise<void> {
    socket.on('disconnect', () => {
      // cleanup
    });
  }
}
```

## The `Socket` class

Every channel handler receives a `Socket` instance as its first argument.

| Method | Description |
|---|---|
| `socket.join(channel)` | Subscribe to a channel |
| `socket.joinPresence(channel, memberData)` | Subscribe with presence tracking |
| `socket.leave(channel)` | Unsubscribe from a channel |
| `socket.emit(event, data)` | Emit to all subscribed channels |
| `socket.to(channel).emit(event, data)` | Emit to everyone on a channel |
| `socket.broadcast(event, data)` | Emit to everyone except this socket |
| `socket.on(event, handler)` | Listen for incoming client events |
| `socket.user<T>()` | Get the authenticated user (from auth middleware) |
| `socket.disconnect()` | Force-disconnect the socket |

## Private channels

Private channels require authentication. The JWT token is passed in the subscribe message and verified by your auth middleware.

```typescript
// routes/channels.ts
import { AuthMiddleware } from '@faber-js/auth';

Channel.private('user.{id}', [AuthMiddleware], [UserChannel, 'presence']);
```

```typescript
// app/channels/UserChannel.ts
import { Injectable } from '@faber-js/core';
import { Channel, Socket } from '@faber-js/channels';
import { UserService } from '../services/UserService';
import type { User } from '../models/User';

@Injectable()
export class UserChannel extends Channel {
  constructor(private readonly users: UserService) {
    super();
  }

  async presence(socket: Socket, userId: string): Promise<void> {
    const user = socket.user<User>();
    socket.join(`user.${userId}`);
    socket.emit('connected', { user });

    socket.on('ping', () => {
      socket.emit('pong', { time: Date.now() });
    });

    socket.on('disconnect', () => {
      // cleanup
    });
  }
}
```

## Presence channels

Presence channels track all connected members and broadcast membership events to everyone on the channel.

```typescript
// app/channels/RoomChannel.ts
@Injectable()
export class RoomChannel extends Channel {
  async join(socket: Socket, slug: string): Promise<void> {
    const room = await Room.where('slug', slug).firstOrFail();
    const user = socket.user<User>();

    socket.joinPresence(`room.${slug}`, {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
    });

    socket.on('message', async (content: unknown) => {
      const message = await Message.create({
        roomId: room.id,
        userId: user.id,
        content,
      });
      socket.to(`room.${slug}`).emit('message', message);
    });
  }
}
```

Clients automatically receive three presence lifecycle events:

| Event | Payload | When |
|---|---|---|
| `presence.init` | `{ members: MemberData[] }` | On connection — the full member list |
| `presence.joined` | `{ member: MemberData }` | When another member connects |
| `presence.left` | `{ member: MemberData }` | When a member disconnects |

## Broadcasting from anywhere

Use the `broadcast()` global to push events from any service, job, or controller — no socket reference needed.

```typescript
import { broadcast } from '@faber-js/channels';

// From a service
async markShipped(orderId: number): Promise<void> {
  const order = await Order.findOrFail(orderId);
  order.status = 'shipped';
  await order.save();

  await broadcast(`user.${order.userId}`, 'order.shipped', {
    orderId: order.id,
    trackingNumber: order.trackingNumber,
  });
}

// From a job
async handle(): Promise<void> {
  await broadcast('notifications', 'new-post', { postId: this.postId });
}
```

## Connection protocol

Clients connect to `/_faber/ws` and send a subscribe message:

```json
{ "type": "subscribe", "channel": "room.general", "token": "..." }
```

The server resolves the channel, runs middleware, and calls the handler method. After that, messages flow freely in both directions.

Outbound messages from the server have the shape:

```json
{ "type": "event", "channel": "room.general", "event": "message", "data": { ... } }
```

## Browser client

The `@faber-js/channels/client` export is a browser-only bundle with no Node.js dependencies.

```typescript
import { FaberChannels } from '@faber-js/channels/client';

const channels = new FaberChannels({
  url: 'ws://localhost:3000/_faber/ws',
  token: authToken,   // optional — required for private/presence channels
});

// Public or private channel
const notifications = channels.public('notifications');
notifications.listen('new-post', (data) => {
  console.log('New post!', data);
});

// Presence channel
const room = channels.presence('room.general');

room.here((members) => {
  console.log('Connected members:', members);
});

room.joining((member) => {
  console.log('Joined:', member.name);
});

room.leaving((member) => {
  console.log('Left:', member.name);
});

// Disconnect
channels.disconnect();
```

## React hooks

`@faber-js/bridge-react` exports `useChannel` and `usePresence`.

### Setup

Call `setChannelsClient` once at application startup, before any components mount:

```typescript
import { FaberChannels } from '@faber-js/channels/client';
import { setChannelsClient } from '@faber-js/bridge-react';

const channelsClient = new FaberChannels({
  url: 'ws://localhost:3000/_faber/ws',
  token: localStorage.getItem('token') ?? undefined,
});

setChannelsClient(channelsClient);
```

### `useChannel`

Listen for events on any channel:

```typescript
import { useChannel } from '@faber-js/bridge-react';

function OrderTracker({ orderId }: { orderId: number }) {
  const [status, setStatus] = useState('pending');

  useChannel(`user.${currentUser.id}`, {
    'order.shipped': (data) => {
      const { trackingNumber } = data as { trackingNumber: string };
      setStatus('shipped');
      showNotification(`Shipped! Tracking: ${trackingNumber}`);
    },
  });

  return <div>Order status: {status}</div>;
}
```

### `usePresence`

Track members on a presence channel:

```typescript
import { usePresence } from '@faber-js/bridge-react';

function ChatRoom({ slug }: { slug: string }) {
  const { members } = usePresence(`room.${slug}`);

  return (
    <div>
      <p>{members.length} member(s) online</p>
      <ul>
        {members.map((m) => (
          <li key={String(m['id'])}>{String(m['name'])}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Vue composables

`@faber-js/bridge-vue` exports `useChannel` and `usePresence`.

### Setup

```typescript
import { FaberChannels } from '@faber-js/channels/client';
import { setChannelsClient } from '@faber-js/bridge-vue';

const channelsClient = new FaberChannels({
  url: 'ws://localhost:3000/_faber/ws',
  token: localStorage.getItem('token') ?? undefined,
});

setChannelsClient(channelsClient);
```

### `useChannel`

```vue
<script setup lang="ts">
import { useChannel } from '@faber-js/bridge-vue';
import { ref } from 'vue';

const { on } = useChannel(`user.${props.userId}`);
const status = ref('pending');

on('order.shipped', (data) => {
  status.value = 'shipped';
});
</script>
```

### `usePresence`

```vue
<script setup lang="ts">
import { usePresence } from '@faber-js/bridge-vue';

const { members } = usePresence(`room.${props.slug}`);
// members is a reactive Ref<MemberData[]>
</script>

<template>
  <p>{{ members.length }} member(s) online</p>
</template>
```

## Multi-process with Redis

For multi-server deployments, configure the Redis adapter. All server instances subscribe to Redis pub/sub and forward events to their locally-connected sockets.

Install the optional peer dependency:

```bash
pnpm add ioredis
```

Add `config/channels.ts`:

```typescript
export default {
  driver: process.env.CHANNELS_DRIVER ?? 'memory',   // 'memory' | 'redis'
  redis: {
    host:    process.env.REDIS_HOST ?? 'localhost',
    port:    parseInt(process.env.REDIS_PORT ?? '6379'),
    channel: 'faberjs_channels',
  },
};
```

Set `CHANNELS_DRIVER=redis` in your `.env`. The `ChannelsServiceProvider` reads this config and picks the right adapter automatically.

## Custom broadcast adapter

Implement `BroadcastAdapterContract` to integrate any pub/sub backend:

```typescript
import type { BroadcastAdapterContract } from '@faber-js/channels';

export class MyAdapter implements BroadcastAdapterContract {
  async publish(channel: string, event: string, data: unknown): Promise<void> {
    // publish to your backend
  }

  subscribe(channel: string, handler: (event: string, data: unknown) => void): void {
    // subscribe and call handler on receive
  }

  unsubscribe(channel: string): void {
    // unsubscribe
  }

  async close(): Promise<void> {
    // cleanup
  }
}
```

Pass it to the provider:

```typescript
app.register(new ChannelsServiceProvider(app, new MyAdapter()));
```
