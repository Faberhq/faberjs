<script setup>
import { ref, computed, onMounted } from 'vue'

// ── Hero terminal animation ────────────────────────────────
const heroLines = ref([])
const heroScript = [
  { text: '$ npx create-faberjs@latest my-app', type: 'cmd',  delay: 500  },
  { text: '',                                    type: 'gap',  delay: 1100 },
  { text: '  ✔ Scaffolding project structure',  type: 'ok',   delay: 1300 },
  { text: '  ✔ Creating app skeleton',          type: 'ok',   delay: 1750 },
  { text: '  ✔ Configuring SQLite database',    type: 'ok',   delay: 2150 },
  { text: '  ✔ Done in 1.2s',                   type: 'ok',   delay: 2550 },
  { text: '',                                    type: 'gap',  delay: 2900 },
  { text: '$ cd my-app && npx faber serve',     type: 'cmd',  delay: 3100 },
  { text: '',                                    type: 'gap',  delay: 3700 },
  { text: '  ▶  FaberJS v1.0.0',                type: 'info', delay: 3900 },
  { text: '  ▶  http://localhost:3000',          type: 'info', delay: 4100 },
]

onMounted(() => {
  heroScript.forEach(({ text, type, delay }) =>
    setTimeout(() => heroLines.value.push({ text, type }), delay)
  )
})

// ── Syntax highlighter ─────────────────────────────────────
// Uses placeholder tokens so later passes never match inside
// already-inserted span tags (prevents class="hl-k"> leaking).
function makeHighlighter(passes) {
  return function (raw) {
    let c = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const tokens = []
    const protect = (cls, text) => {
      tokens.push(`<span class="${cls}">${text}</span>`)
      return `\x00${tokens.length - 1}\x00`
    }
    for (const { re, cls } of passes) {
      c = c.replace(re, (m, g1) => protect(cls, g1 ?? m))
    }
    // restore in reverse so nested indices stay valid
    return c.replace(/\x00(\d+)\x00/g, (_, i) => tokens[+i])
  }
}

const hl = makeHighlighter([
  { re: /(\/\/[^\n]+)/g,                                                                                           cls: 'hl-cm' },
  { re: /('[^'\n]*'|"[^"\n]*"|`[^`]*`)/g,                                                                         cls: 'hl-s'  },
  { re: /\b(import|export|from|const|let|var|async|await|return|new|this|class|extends|static|private|public|readonly|void|true|false|null|undefined|type|interface|Promise)\b/g, cls: 'hl-k'  },
  { re: /(@\w+)/g,                                                                                                  cls: 'hl-d'  },
  { re: /\b([A-Z][a-zA-Z0-9]*)\b/g,                                                                                cls: 'hl-t'  },
])

const hlBash = makeHighlighter([
  { re: /(#[^\n]+)/g,                   cls: 'hl-cm' },
  { re: /(make:\w+|db:\w+|route:\w+)/g, cls: 'hl-t'  },
  { re: /\b(npx|faber|cd)\b/g,          cls: 'hl-k'  },
  { re: /('[^'\n]*'|"[^"\n]*")/g,       cls: 'hl-s'  },
])

const hlPhp = makeHighlighter([
  { re: /(\/\/[^\n]+)/g,                                                                              cls: 'hl-cm' },
  { re: /('[^'\n]*'|"[^"\n]*")/g,                                                                     cls: 'hl-s'  },
  { re: /\b(public|private|readonly|function|return|new|class|extends|use|namespace)\b/g,             cls: 'hl-k'  },
  { re: /(\$\w+)/g,                                                                                    cls: 'hl-v'  },
  { re: /\b([A-Z][a-zA-Z0-9]*)\b/g,                                                                   cls: 'hl-t'  },
])

// ── Flow tabs ──────────────────────────────────────────────
const activeTab = ref('route')
const tabs = [
  { id: 'route',      label: 'Route',      file: 'routes/api.ts' },
  { id: 'controller', label: 'Controller', file: 'app/controllers/PostController.ts' },
  { id: 'service',    label: 'Service',    file: 'app/services/PostService.ts' },
  { id: 'model',      label: 'Model',      file: 'app/models/Post.ts' },
]

const flowCode = {
  route: `import { Route } from '@faber-js/router'
import { PostController } from '../app/controllers/PostController'

Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.get('/posts',     [PostController, 'index'])
  Route.post('/posts',    [PostController, 'store'])
  Route.get('/posts/:id', [PostController, 'show'])
  Route.put('/posts/:id', [PostController, 'update'])
  Route.delete('/posts/:id', [PostController, 'destroy'])
})`,

  controller: `import { Controller } from '@faber-js/router'
import { Request, Response } from '@faber-js/http'
import { PostService } from '../services/PostService'

export class PostController extends Controller {
  constructor(private posts: PostService) { super() }

  async index(req: Request): Promise<Response> {
    return this.json(
      await this.posts.paginate(req.query('page', 1))
    )
  }

  async store(req: Request): Promise<Response> {
    const post = await this.posts.create(req.validated())
    return this.json(post, 201)
  }
}`,

  service: `import { Service } from '@faber-js/core'
import { Post } from '../models/Post'
import { event } from '@faber-js/events'
import { dispatch } from '@faber-js/queue'
import { PostCreated } from '../events/PostCreated'
import { NotifyFollowers } from '../jobs/NotifyFollowers'

export class PostService extends Service {
  async paginate(page: number) {
    return Post.with('author').paginate(page, 15)
  }

  async create(data: CreatePostDto) {
    const post = await Post.create(data)
    await event(new PostCreated(post))
    await dispatch(new NotifyFollowers(post))
    return post
  }
}`,

  model: `import { Model } from '@faber-js/orm'
import { User } from './User'
import { Comment } from './Comment'

export class Post extends Model {
  static table = 'posts'

  author() {
    return this.belongsTo(User, 'author_id')
  }

  comments() {
    return this.hasMany(Comment, 'post_id')
  }

  // Query scope
  scopePublished(query: QueryBuilder) {
    return query.where('published', true)
                .orderBy('created_at', 'desc')
  }
}`,
}

const activeCode    = computed(() => hl(flowCode[activeTab.value]))
const activeTabMeta = computed(() => tabs.find(t => t.id === activeTab.value))

// ── Feature cards ──────────────────────────────────────────
const features = [
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 11h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="11" cy="11" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M13 9.5L18 6M13 12.5L18 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'Expressive Routing',
    desc: 'Route groups, resource routes, named routes, and model binding — fluent API, zero config.',
    lang: 'ts',
    code: `Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.resource('posts', PostController)
  Route.get('/me', [UserController, 'me'])
})`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="11" cy="6" rx="7" ry="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M4 6v4.5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6" stroke="currentColor" stroke-width="1.5"/><path d="M4 10.5V15c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-4.5" stroke="currentColor" stroke-width="1.5"/></svg>',
    name: 'ActiveRecord ORM',
    desc: 'Eloquent-style models with relationships, scopes, and an expressive query builder. SQLite, PostgreSQL, MySQL — swap drivers with one config line.',
    lang: 'ts',
    code: `const posts = await Post
  .where('published', true)
  .with('author', 'tags')
  .orderBy('created_at', 'desc')
  .paginate(20)

// Drivers: better-sqlite3 · sqlite-wasm · pg · mysql2`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h11M3 11h8M3 15h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M16 12.5l4-2.5-4-2.5v5z" fill="currentColor"/></svg>',
    name: 'Queues & Jobs',
    desc: 'BullMQ-backed queues with a one-liner dispatch API. Retry, delay, prioritise.',
    lang: 'ts',
    code: `await dispatch(new SendWelcomeEmail(user))

await dispatch(new ProcessPayment(order))
  .onQueue('payments')
  .delay(60)`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 3L5 12h6.5L9 19l10-9H12l1-7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    name: 'Events & Listeners',
    desc: 'Decouple your app with a typed event bus. Listeners can run synchronously or queued.',
    lang: 'ts',
    code: `await event(new UserRegistered(user))

// Listener — auto-discovered
class SendWelcomeEmail {
  async handle(e: UserRegistered) {
    await mail(e.user, new WelcomeMail())
  }
}`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="10" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 10V7.5a3 3 0 016 0V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="11" cy="15" r="1.5" fill="currentColor"/></svg>',
    name: 'Auth & Policies',
    desc: 'JWT authentication guards and granular resource policies, wired in automatically.',
    lang: 'ts',
    code: `// Protect a route group
Route.middleware('auth').group(() => {
  Route.get('/dashboard', [DashController, 'index'])
})

// Inside controller
const user = req.user<User>()
await this.authorize('update', post)`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 9.5l3 2.5-3 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 14.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'Artisan-style CLI',
    desc: 'Generate controllers, models, jobs, migrations, and more from a single command.',
    lang: 'bash',
    code: `npx faber make:model Post -m
npx faber make:controller PostController
npx faber make:job NotifyFollowers
npx faber db:migrate
npx faber serve`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M13 8h4a2 2 0 012 2v4a2 2 0 01-2 2h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 11h4M12 9l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    name: 'Frontend Bridge',
    desc: 'Build React or Vue SPAs using server-side routing — no separate API. End-to-end type safety.',
    lang: 'ts',
    code: `// Server controller
return this.render('Users/Index', {
  users: await this.userService.all(),
})

// React page component
const { props } = usePage<{ users: User[] }>()
<Link href="/users/create">Create</Link>`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M5 19c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M16 4l1.5 1.5L19 4M16 8l1.5-1.5L19 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    name: 'AI-Native Agents',
    desc: 'Build AI agents with DI, typed tool schemas, per-session memory, authorization, structured output, and SSE streaming.',
    lang: 'ts',
    code: `class SupportAgent extends Agent {
  output = t.object({ summary: t.string(), severity: t.enum(['low','high']) })

  @Tool({ desc: 'Lookup order', input: { id: t.string() } })
  @Authorize('view-order', ([{ id }]) => id)
  async lookupOrder({ id }: { id: string }) {
    return Order.find(id)
  }
}

// Controller — stream tokens via SSE
async chat(req: Request): Promise<Response> {
  return this.sse(agent.stream(req.input('message'), req.user().id))
}`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 11a7 7 0 0114 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="11" cy="11" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 11a9 9 0 0118 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".4"/></svg>',
    name: 'Real-Time Channels',
    desc: 'WebSocket channels that feel like HTTP routes — public, private, and presence channels with the same DI and auth.',
    lang: 'ts',
    code: `// routes/channels.ts
Channel.presence('room.{slug}', [AuthMiddleware], [RoomChannel, 'join'])

// app/channels/RoomChannel.ts
async join(socket: Socket, slug: string) {
  socket.joinPresence(\`room.\${slug}\`, { id: user.id, name: user.name })
  socket.on('message', (msg) => socket.to(\`room.\${slug}\`).emit('message', msg))
}

// From any service — no socket reference needed
await broadcast(\`user.\${userId}\`, 'order.shipped', { trackingNumber })`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 7l-3 4 3 4M15 7l3 4-3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 5.5l-3 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'Server-Side Views',
    desc: 'JSX views that render to HTML strings — type-safe props, auto-escaping, layout composition. No Blade magic.',
    lang: 'ts',
    code: `/** @jsxImportSource @faber-js/view */
import { AppLayout } from '../layouts/app.view'

export default function UsersIndex({ users }) {
  return (
    <AppLayout title="Users">
      <ul>
        {users.map(u => (
          <li key={u.id}>{u.name}</li>
        ))}
      </ul>
    </AppLayout>
  )
}`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="12" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="12" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M12 15.5h7M15.5 12v7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'Schema-first Models',
    desc: 'One declaration drives your model, migrations, validation rules, factory, and OpenAPI spec — all type-inferred.',
    lang: 'ts',
    code: `const User = schema('users', {
  id:        t.id(),
  name:      t.string().min(2).max(100),
  email:     t.email().unique(),
  role:      t.enum(['admin','editor','viewer']).default('viewer'),
  createdAt: t.timestamp().auto(),
})

// Inferred: { id: number; name: string; email: string; role: 'admin'|'editor'|'viewer'; createdAt: Date }`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 10h2M7 13h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="16" r="4" fill="#030d18" stroke="currentColor" stroke-width="1.5"/><path d="M14.5 16h3M16 14.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'DevTools Dashboard',
    desc: 'Zero-config request, query, and event tracing. Live at /_faber in dev — disabled in production automatically.',
    lang: 'ts',
    code: `// bootstrap/app.ts — one line to enable
app.register(new DevToolsServiceProvider(app, {
  db: getConnection(),
  dispatcher: eventDispatcher,
}))

// Then open http://localhost:3000/_faber`,
  },
  {
    icon: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 3C7 3 4 6 4 10s3 7 7 7 7-3 7-7-3-7-7-7z" stroke="currentColor" stroke-width="1.5"/><path d="M4 10h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11 3c-2 2-3 4.5-3 7s1 5 3 7M11 3c2 2 3 4.5 3 7s-1 5-3 7" stroke="currentColor" stroke-width="1.5"/></svg>',
    name: 'Runtime Adapters',
    desc: 'One codebase, multiple deployment targets. Swap between Fastify, Bun, Lambda, and Cloudflare Workers via a single config line.',
    lang: 'ts',
    code: `// AWS Lambda — zero-overhead handler
import { createLambdaHandler } from '@faber-js/adapters/lambda'
export const handler = createLambdaHandler(app)

// Cloudflare Workers — global edge
import { createWorkerHandler } from '@faber-js/adapters/cloudflare'
export default createWorkerHandler(myHandler)`,
  },
]

const highlightFeature = (f) =>
  f.lang === 'bash' ? hlBash(f.code) : hl(f.code)

// ── Ecosystem packages ─────────────────────────────────────
const packages = [
  { name: 'core',       desc: 'IoC container, providers, facades' },
  { name: 'router',     desc: 'Routing, groups, model binding'     },
  { name: 'orm',        desc: 'ActiveRecord ORM, migrations'       },
  { name: 'http',       desc: 'Request / Response, middleware'     },
  { name: 'console',    desc: 'CLI, generators, tinker'            },
  { name: 'queue',      desc: 'BullMQ jobs and workers'            },
  { name: 'events',     desc: 'Event / Listener bus'               },
  { name: 'auth',       desc: 'JWT guards, policies'               },
  { name: 'validation', desc: 'Rules engine, FormRequest'          },
  { name: 'config',     desc: '.env and typed config'              },
  { name: 'ai',         desc: 'AI-native agents — tools, streaming, auth, schema I/O' },
  { name: 'bridge',     desc: 'Frontend bridge protocol + Vite plugin' },
  { name: 'bridge-react', desc: 'React adapter — usePage, useForm, Link' },
  { name: 'bridge-vue', desc: 'Vue 3 adapter — usePage, useForm, BridgeLink' },
  { name: 'view',       desc: 'JSX server-side views with auto-escaping'   },
  { name: 'schema',    desc: 'Schema-first models: types, migrations, validation, OpenAPI' },
  { name: 'channels',  desc: 'Real-time WebSocket channels — public, private, presence, broadcast' },
  { name: 'devtools',  desc: 'Dev observability dashboard — requests, queries, events'     },
  { name: 'adapters',  desc: 'Pluggable HTTP adapters: Fastify, Bun, Lambda, Cloudflare'  },
  { name: 'testing',    desc: 'HTTP test client, DB assertions'            },
]

// ── Comparison code ────────────────────────────────────────
const laravelCode = `// app/Http/Controllers/UserController.php

class UserController extends Controller
{
    public function __construct(
        private readonly UserService $users,
    ) {}

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->users->create($request->validated());
        event(new UserRegistered($user));

        return response()->json($user, 201);
    }
}`

const faberCode = `// app/controllers/UserController.ts

export class UserController extends Controller {
  constructor(private users: UserService) {
    super()
  }

  async store(req: Request): Promise<Response> {
    const user = await this.users.create(req.validated())
    await event(new UserRegistered(user))

    return this.json(user, 201)
  }
}`
</script>

<template>
  <div class="landing">

    <!-- ══════════════════════════════════════════════
         HERO
    ══════════════════════════════════════════════ -->
    <section class="hero">
      <div class="hero-grid-bg" aria-hidden="true"/>
      <div class="hero-glow"    aria-hidden="true"/>

      <div class="container hero-layout">
        <div class="hero-left">
          <div class="hero-badge">
            <span class="badge-dot"/>
            v1.0 · MIT · Node · Bun · Lambda · Cloudflare · WebSockets · AI-Native
          </div>

          <h1 class="hero-headline">
            The Laravel<br>
            experience.<br>
            <span class="hero-accent">Now in Node.js.</span>
          </h1>

          <p class="hero-sub">
            Full-stack TypeScript backend framework with routing, ORM,
            queues, auth, and a CLI — all wired up, conventions in place,
            ready on day one.
          </p>

          <div class="hero-ctas">
            <a href="/getting-started/installation" class="btn btn-primary">
              Get Started
            </a>
            <a href="https://github.com/faberjs/faberjs" class="btn btn-ghost" target="_blank" rel="noopener">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              GitHub
            </a>
          </div>

          <div class="hero-stats">
            <div class="stat">
              <span class="stat-val">20</span>
              <span class="stat-label">packages</span>
            </div>
            <div class="stat-div"/>
            <div class="stat">
              <span class="stat-val">TypeScript</span>
              <span class="stat-label">strict mode</span>
            </div>
            <div class="stat-div"/>
            <div class="stat">
              <span class="stat-val">Bun-Ready</span>
              <span class="stat-label">pluggable runtime</span>
            </div>
          </div>
        </div>

        <div class="hero-right">
          <div class="terminal">
            <div class="terminal-bar">
              <span class="tb tb-r"/><span class="tb tb-y"/><span class="tb tb-g"/>
              <span class="terminal-title">bash</span>
            </div>
            <div class="terminal-body">
              <div
                v-for="(line, i) in heroLines"
                :key="i"
                :class="['t-line', `t-${line.type}`]"
              >{{ line.text }}</div>
              <span class="t-cursor" v-if="heroLines.length < heroScript.length">▋</span>
            </div>
          </div>
        </div>
      </div>

      <div class="mental-model">
        <div class="container mental-inner">
          <span class="mm-label">Framework flow</span>
          <div class="mm-chain">
            <a href="/basics/routing"             class="mm-node">Route</a>
            <span class="mm-arrow"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7.5 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <a href="/basics/controllers"          class="mm-node">Controller</a>
            <span class="mm-arrow"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7.5 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <a href="/digging-deeper/services"     class="mm-node">Service</a>
            <span class="mm-arrow"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7.5 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <a href="/orm/models"                  class="mm-node">Model</a>
            <span class="mm-arrow"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7.5 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <a href="/digging-deeper/jobs-queues"  class="mm-node">Job</a>
            <span class="mm-arrow">/</span>
            <a href="/digging-deeper/events-listeners" class="mm-node">Event</a>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         COMPARISON — Zero mental translation
    ══════════════════════════════════════════════ -->
    <section class="section comparison-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Zero mental translation.</h2>
          <p class="section-sub">
            If you've built with Laravel, you already speak FaberJS.<br>
            Same patterns. Same flow. TypeScript type safety on top.
          </p>
        </div>

        <div class="comparison-grid">
          <div class="code-card">
            <div class="code-card-header">
              <span class="lang-badge lang-php">PHP · Laravel</span>
            </div>
            <pre class="code-block"><code v-html="hlPhp(laravelCode)"/></pre>
          </div>

          <div class="comparison-vs">
            <div class="vs-line"/>
            <span class="vs-text">vs</span>
            <div class="vs-line"/>
          </div>

          <div class="code-card code-card-active">
            <div class="code-card-header">
              <span class="lang-badge lang-ts">TypeScript · FaberJS</span>
              <span class="card-glow-dot"/>
            </div>
            <pre class="code-block"><code v-html="hl(faberCode)"/></pre>
          </div>
        </div>

        <div class="comparison-callouts">
          <div class="callout">
            <span class="callout-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h9M8.5 4l4 3-4 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            Same constructor injection
          </div>
          <div class="callout">
            <span class="callout-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h9M8.5 4l4 3-4 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            Same <code>validated()</code> pattern
          </div>
          <div class="callout">
            <span class="callout-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h9M8.5 4l4 3-4 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            Same <code>event()</code> helper
          </div>
          <div class="callout">
            <span class="callout-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h9M8.5 4l4 3-4 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            Same response shape
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         FEATURES
    ══════════════════════════════════════════════ -->
    <section class="section features-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Everything you need.<br>Nothing you don't.</h2>
          <p class="section-sub">
            Every feature a production backend requires — routing, ORM, queues,
            auth, validation — shipped as first-class packages.
          </p>
        </div>

        <div class="feature-grid">
          <div
            v-for="f in features"
            :key="f.name"
            class="feature-card"
          >
            <div class="feature-top">
              <span class="feature-icon" v-html="f.icon"/>
              <h3 class="feature-name">{{ f.name }}</h3>
              <p class="feature-desc">{{ f.desc }}</p>
            </div>
            <pre class="feature-code"><code v-html="highlightFeature(f)"/></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         FLOW SHOWCASE — full stack
    ══════════════════════════════════════════════ -->
    <section class="section flow-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">See the full stack.</h2>
          <p class="section-sub">
            Every layer connected, every concern separated.
            Click through a real request — from route definition to database model.
          </p>
        </div>

        <div class="flow-showcase">
          <div class="flow-tabs">
            <button
              v-for="t in tabs"
              :key="t.id"
              :class="['flow-tab', { active: activeTab === t.id }]"
              @click="activeTab = t.id"
            >
              {{ t.label }}
            </button>
          </div>

          <div class="flow-code-wrap">
            <div class="flow-file-bar">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="opacity:0.4"><rect x="1" y="1" width="7" height="9" rx="1" stroke="currentColor" stroke-width="1"/><path d="M3 4h5M3 6h4M3 8h3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
              <span>{{ activeTabMeta?.file }}</span>
            </div>
            <pre class="flow-code"><code v-html="activeCode"/></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         CLI SHOWCASE
    ══════════════════════════════════════════════ -->
    <section class="section cli-section">
      <div class="container cli-layout">
        <div class="cli-left">
          <h2 class="section-title" style="text-align:left;">Meet <span class="hero-accent">faber</span>.<br>Your new Artisan.</h2>
          <p class="section-sub" style="text-align:left; margin:0;">
            A full-featured CLI that generates anything your app needs.
            Modelled on Laravel's Artisan so you already know every command.
          </p>

          <div class="cli-commands">
            <div class="cli-group">
              <div class="cli-group-label">Generate</div>
              <div v-for="cmd in ['make:controller', 'make:model -m', 'make:service', 'make:job', 'make:event', 'make:listener', 'make:middleware', 'make:migration', 'make:provider', 'make:agent', 'make:view', 'make:schema', 'make:channel']" :key="cmd" class="cli-cmd">
                <span class="cmd-prefix">faber</span> {{ cmd }}
              </div>
            </div>
            <div class="cli-group">
              <div class="cli-group-label">Database</div>
              <div v-for="cmd in ['db:migrate', 'db:rollback', 'db:seed', 'db:status']" :key="cmd" class="cli-cmd">
                <span class="cmd-prefix">faber</span> {{ cmd }}
              </div>
            </div>
            <div class="cli-group">
              <div class="cli-group-label">Dev</div>
              <div v-for="cmd in ['serve', 'tinker', 'route:list']" :key="cmd" class="cli-cmd">
                <span class="cmd-prefix">faber</span> {{ cmd }}
              </div>
            </div>
          </div>
        </div>

        <div class="cli-right">
          <div class="terminal terminal-large">
            <div class="terminal-bar">
              <span class="tb tb-r"/><span class="tb tb-y"/><span class="tb tb-g"/>
              <span class="terminal-title">faber CLI</span>
            </div>
            <div class="terminal-body">
              <div class="t-line t-cmd">$ npx faber make:model Post -m</div>
              <div class="t-line t-ok">  ✔ Created app/models/Post.ts</div>
              <div class="t-line t-ok">  ✔ Created database/migrations/2024_create_posts_table.ts</div>
              <div class="t-line t-gap">&nbsp;</div>
              <div class="t-line t-cmd">$ npx faber make:job NotifyFollowers</div>
              <div class="t-line t-ok">  ✔ Created app/jobs/NotifyFollowers.ts</div>
              <div class="t-line t-gap">&nbsp;</div>
              <div class="t-line t-cmd">$ npx faber db:migrate</div>
              <div class="t-line t-ok">  ✔ Ran migration: 2024_create_users_table</div>
              <div class="t-line t-ok">  ✔ Ran migration: 2024_create_posts_table</div>
              <div class="t-line t-info">  2 migrations ran successfully.</div>
              <div class="t-line t-gap">&nbsp;</div>
              <div class="t-line t-cmd">$ npx faber route:list</div>
              <div class="t-line t-gap">&nbsp;</div>
              <div class="t-line t-muted">  GET     /api/posts         PostController@index</div>
              <div class="t-line t-muted">  POST    /api/posts         PostController@store</div>
              <div class="t-line t-muted">  GET     /api/posts/:id     PostController@show</div>
              <div class="t-line t-muted">  PUT     /api/posts/:id     PostController@update</div>
              <div class="t-line t-muted">  DELETE  /api/posts/:id     PostController@destroy</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         ECOSYSTEM
    ══════════════════════════════════════════════ -->
    <section class="section ecosystem-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">One framework, twenty packages.</h2>
          <p class="section-sub">
            Every package is independently versioned and published under <code class="inline-code">@faber-js</code>.
            Install only what you need — or scaffold everything at once.
          </p>
        </div>

        <div class="pkg-grid">
          <div v-for="p in packages" :key="p.name" class="pkg-card">
            <div class="pkg-dot"/>
            <div class="pkg-name">@faber-js/{{ p.name }}</div>
            <div class="pkg-desc">{{ p.desc }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         CTA
    ══════════════════════════════════════════════ -->
    <section class="cta-section">
      <div class="cta-grid-bg" aria-hidden="true"/>
      <div class="container cta-inner">
        <h2 class="cta-headline">Start building in<br><span class="hero-accent">60 seconds.</span></h2>

        <div class="cta-terminal">
          <span class="cta-prompt">$</span>
          <span class="cta-cmd">npx create-faberjs@latest my-app</span>
        </div>

        <div class="cta-btns">
          <a href="/getting-started/installation" class="btn btn-primary btn-lg">Read the docs</a>
          <a href="https://github.com/faberjs/faberjs" class="btn btn-ghost btn-lg" target="_blank" rel="noopener">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
            Star on GitHub
          </a>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         FOOTER
    ══════════════════════════════════════════════ -->
    <footer class="landing-footer">
      <div class="container footer-inner">
        <span class="footer-copy">&copy; 2026 FaberJS. MIT License.</span>
        <div class="footer-links">
          <a href="/getting-started/installation">Docs</a>
          <a href="https://github.com/faberjs/faberjs" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/org/faber-js" target="_blank" rel="noopener">npm</a>
        </div>
      </div>
    </footer>

  </div>
</template>

<style scoped>
/* ── Tokens ──────────────────────────────────────────────── */
.landing {
  --c-abyss:    #030d18;
  --c-deep:     #040f1c;
  --c-navy:     #081828;
  --c-mid:      #0e2236;
  --c-border:   #0d2a45;
  --c-cyan:     #00d4ff;
  --c-teal:     #007a99;
  --c-ice:      #deedf5;
  --c-muted:    #7aabb8;
  --c-dim:      #2a5a70;
  --ff-mono:    'JetBrains Mono', 'Fira Code', monospace;
  --ff-sans:    'Inter', system-ui, sans-serif;

  background: var(--c-abyss);
  color: var(--c-ice);
  font-family: var(--ff-sans);
  line-height: 1.6;
  overflow-x: hidden;
}

/* ── Container ───────────────────────────────────────────── */
/* Replicates VitePress nav's exact edge formula:
   wrapper padding (32px) + container centering offset.
   Nav left edge = 32 + max(0, (100vw - 1200px) / 2)
                 = max(32px, (100vw - 1136px) / 2)          */
.container {
  padding: 0 max(32px, calc((100vw - 1136px) / 2));
}

/* ── Sections ────────────────────────────────────────────── */
.section {
  padding: 100px 0;
}

.section-header {
  text-align: center;
  margin-bottom: 64px;
}

.section-title {
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--c-ice);
  line-height: 1.15;
  margin-bottom: 16px;
}

.section-sub {
  font-size: 16px;
  color: var(--c-muted);
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.7;
}

/* ── Hero ────────────────────────────────────────────────── */
.hero {
  position: relative;
  min-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hero-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--c-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--c-border) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.35;
  pointer-events: none;
}

.hero-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 600px;
  background: radial-gradient(ellipse at center, rgba(0,212,255,0.07) 0%, transparent 70%);
  pointer-events: none;
}

.hero-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
  padding-top: 80px;
  padding-bottom: 80px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: 100px;
  border: 1px solid var(--c-border);
  background: rgba(0,212,255,0.04);
  font-family: var(--ff-mono);
  font-size: 11px;
  color: var(--c-teal);
  margin-bottom: 28px;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-cyan);
  box-shadow: 0 0 6px var(--c-cyan);
}

.hero-headline {
  font-size: clamp(36px, 5vw, 58px);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.1;
  color: var(--c-ice);
  margin-bottom: 24px;
}

.hero-accent {
  color: var(--c-cyan);
}

.hero-sub {
  font-size: 17px;
  color: var(--c-muted);
  line-height: 1.7;
  margin-bottom: 36px;
  max-width: 440px;
}

.hero-ctas {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 48px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: var(--c-cyan);
  color: var(--c-abyss);
}
.btn-primary:hover {
  background: #33ddff;
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0,212,255,0.3);
}

.btn-ghost {
  background: transparent;
  color: var(--c-muted);
  border: 1px solid var(--c-border);
}
.btn-ghost:hover {
  border-color: var(--c-cyan);
  color: var(--c-cyan);
}

.btn-lg { padding: 14px 32px; font-size: 15px; }

.hero-stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat { display: flex; flex-direction: column; gap: 2px; }
.stat-val   { font-size: 14px; font-weight: 600; color: var(--c-ice); }
.stat-label { font-size: 11px; color: var(--c-dim); }
.stat-div   { width: 1px; height: 28px; background: var(--c-border); }

/* ── Terminal ────────────────────────────────────────────── */
.terminal {
  background: #020a14;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.05);
}

.terminal-large .terminal-body { min-height: 320px; }

.terminal-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: #030d18;
  border-bottom: 1px solid var(--c-border);
}

.tb { width: 10px; height: 10px; border-radius: 50%; }
.tb-r { background: #ff5f56; }
.tb-y { background: #ffbd2e; }
.tb-g { background: #27c93f; }

.terminal-title {
  margin-left: auto;
  font-family: var(--ff-mono);
  font-size: 10px;
  color: var(--c-dim);
}

.terminal-body {
  padding: 20px;
  font-family: var(--ff-mono);
  font-size: 13px;
  line-height: 1.8;
  min-height: 240px;
}

.t-line { white-space: pre; }
.t-cmd   { color: var(--c-ice); }
.t-ok    { color: #4ade80; }
.t-info  { color: var(--c-cyan); }
.t-muted { color: var(--c-dim); }
.t-gap   { height: 8px; }

.t-cursor {
  display: inline-block;
  color: var(--c-cyan);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* ── Mental model bar ────────────────────────────────────── */
.mental-model {
  border-top: 1px solid var(--c-border);
  background: rgba(8, 24, 40, 0.8);
  backdrop-filter: blur(8px);
}

.mental-inner {
  display: flex;
  align-items: center;
  gap: 24px;
  padding-top: 18px;
  padding-bottom: 18px;
  flex-wrap: wrap;
}

.mm-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--c-dim);
  white-space: nowrap;
}

.mm-chain {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.mm-node {
  font-family: var(--ff-mono);
  font-size: 12px;
  color: var(--c-teal);
  text-decoration: none;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.mm-node:hover {
  color: var(--c-cyan);
  border-color: rgba(0,212,255,0.2);
  background: rgba(0,212,255,0.05);
}

.mm-arrow { color: var(--c-border); display: inline-flex; align-items: center; }

/* ── Comparison ──────────────────────────────────────────── */
.comparison-section { background: var(--c-deep); }

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0;
  align-items: start;
  margin-bottom: 32px;
}

.code-card {
  border: 1px solid var(--c-border);
  border-radius: 12px;
  overflow: hidden;
  background: #020a14;
}

.code-card-active {
  border-color: rgba(0,212,255,0.25);
  box-shadow: 0 0 40px rgba(0,212,255,0.06);
}

.code-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--c-deep);
  border-bottom: 1px solid var(--c-border);
}

.lang-badge {
  font-family: var(--ff-mono);
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.lang-php { background: rgba(120,80,200,0.15); color: #c084fc; border: 1px solid rgba(120,80,200,0.2); }
.lang-ts  { background: rgba(0,212,255,0.08);  color: var(--c-cyan); border: 1px solid rgba(0,212,255,0.2); }

.card-glow-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--c-cyan);
  box-shadow: 0 0 6px var(--c-cyan);
}

.comparison-vs {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px;
  gap: 8px;
  padding-top: 80px;
}

.vs-line { flex: 1; width: 1px; background: var(--c-border); min-height: 40px; }
.vs-text { font-size: 11px; color: var(--c-dim); font-weight: 600; letter-spacing: 0.1em; }

.comparison-callouts {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.callout {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--c-border);
  border-radius: 100px;
  font-size: 13px;
  color: var(--c-muted);
  background: var(--c-navy);
}

.callout-icon { color: var(--c-cyan); display: inline-flex; align-items: center; }
.callout code { font-family: var(--ff-mono); font-size: 11px; color: var(--c-teal); }

/* ── Code blocks (shared) ────────────────────────────────── */
.code-block, .feature-code, .flow-code {
  margin: 0;
  padding: 20px;
  font-family: var(--ff-mono);
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--c-ice);
  overflow-x: auto;
  background: transparent;
}

.code-block code, .feature-code code, .flow-code code {
  background: none;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
}

/* Syntax highlight classes */
:deep(.hl-k)  { color: #7aadff; }
:deep(.hl-s)  { color: #a8d8a8; }
:deep(.hl-cm) { color: #2e6070; font-style: italic; }
:deep(.hl-t)  { color: #e8c882; }
:deep(.hl-d)  { color: #c084fc; }
:deep(.hl-v)  { color: #fb923c; }

/* ── Feature grid ────────────────────────────────────────── */
.features-section { background: var(--c-abyss); }

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.feature-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--c-deep);
  transition: border-color 0.2s, transform 0.2s;
}

.feature-card:hover {
  border-color: rgba(0,212,255,0.25);
  transform: translateY(-2px);
}

.feature-top {
  padding: 24px 24px 16px;
  flex: 1;
}

.feature-icon {
  display: block;
  line-height: 0;
  color: var(--c-cyan);
  margin-bottom: 12px;
}

.feature-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--c-ice);
  margin-bottom: 8px;
  letter-spacing: -0.01em;
}

.feature-desc {
  font-size: 13px;
  color: var(--c-muted);
  line-height: 1.6;
}

.feature-code {
  border-top: 1px solid var(--c-border);
  background: #020a14;
  font-size: 11.5px;
}

/* ── Flow showcase ───────────────────────────────────────── */
.flow-section { background: var(--c-navy); }

.flow-showcase {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  overflow: hidden;
  background: #020a14;
}

.flow-tabs {
  display: flex;
  border-bottom: 1px solid var(--c-border);
  background: var(--c-deep);
}

.flow-tab {
  flex: 1;
  padding: 14px 20px;
  font-family: var(--ff-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--c-dim);
  background: transparent;
  border: none;
  border-right: 1px solid var(--c-border);
  cursor: pointer;
  transition: all 0.15s;
}

.flow-tab:last-child { border-right: none; }

.flow-tab:hover { color: var(--c-muted); background: rgba(0,212,255,0.03); }

.flow-tab.active {
  color: var(--c-cyan);
  background: rgba(0,212,255,0.06);
  border-bottom: 2px solid var(--c-cyan);
  margin-bottom: -1px;
}

.flow-file-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--c-border);
  font-family: var(--ff-mono);
  font-size: 11px;
  color: var(--c-dim);
  background: var(--c-navy);
}

.flow-code { min-height: 280px; font-size: 13px; padding: 24px; }

/* ── CLI section ─────────────────────────────────────────── */
.cli-section { background: var(--c-deep); }

.cli-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: start;
}

.cli-commands {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.cli-group-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--c-dim);
  margin-bottom: 8px;
}

.cli-cmd {
  font-family: var(--ff-mono);
  font-size: 12.5px;
  color: var(--c-muted);
  padding: 3px 0;
}

.cmd-prefix {
  color: var(--c-teal);
  margin-right: 4px;
}

/* ── Ecosystem ───────────────────────────────────────────── */
.ecosystem-section { background: var(--c-abyss); }

.pkg-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.pkg-card {
  padding: 18px 20px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: var(--c-deep);
  transition: border-color 0.15s, background 0.15s;
}

.pkg-card:hover {
  border-color: rgba(0,212,255,0.2);
  background: var(--c-navy);
}

.pkg-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--c-cyan);
  opacity: 0.5;
  margin-bottom: 10px;
}

.pkg-card:hover .pkg-dot { opacity: 1; box-shadow: 0 0 6px var(--c-cyan); }

.pkg-name {
  font-family: var(--ff-mono);
  font-size: 11.5px;
  color: var(--c-teal);
  margin-bottom: 6px;
}

.pkg-desc { font-size: 12px; color: var(--c-dim); line-height: 1.4; }

/* ── CTA ─────────────────────────────────────────────────── */
.cta-section {
  position: relative;
  padding: 120px 0;
  overflow: hidden;
  background: var(--c-deep);
  border-top: 1px solid var(--c-border);
}

.cta-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--c-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--c-border) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.2;
  pointer-events: none;
}

.cta-inner {
  position: relative;
  text-align: center;
}

.cta-headline {
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin-bottom: 40px;
  color: var(--c-ice);
}

.cta-terminal {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  background: #020a14;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  font-family: var(--ff-mono);
  font-size: 14px;
  margin-bottom: 40px;
  box-shadow: 0 0 40px rgba(0,212,255,0.06);
}

.cta-prompt { color: var(--c-teal); }
.cta-cmd    { color: var(--c-ice);  }

.cta-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }

/* ── Inline code ─────────────────────────────────────────── */
.inline-code {
  font-family: var(--ff-mono);
  font-size: 13px;
  color: var(--c-cyan);
  background: rgba(0,212,255,0.06);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(0,212,255,0.15);
}

/* ── Footer ──────────────────────────────────────────────── */
.landing-footer {
  border-top: 1px solid var(--c-border);
  background: var(--c-abyss);
  padding: 24px 0;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-copy {
  font-size: 12px;
  color: var(--c-dim);
}

.footer-links {
  display: flex;
  gap: 20px;
}

.footer-links a {
  font-size: 12px;
  color: var(--c-dim);
  text-decoration: none;
  transition: color 0.15s;
}

.footer-links a:hover { color: var(--c-cyan); }

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 900px) {
  .hero-layout       { grid-template-columns: 1fr; padding-top: 48px; padding-bottom: 0; }
  .hero-sub          { max-width: 100%; }
  .comparison-grid   { grid-template-columns: 1fr; }
  .comparison-vs     { flex-direction: row; padding: 16px 0; }
  .vs-line           { min-height: 0; min-width: 40px; height: 1px; flex: none; }
  .feature-grid      { grid-template-columns: 1fr; }
  .cli-layout        { grid-template-columns: 1fr; }
  .pkg-grid          { grid-template-columns: repeat(2, 1fr); }
  .flow-tabs         { overflow-x: auto; }
}

@media (max-width: 600px) {
  .container         { padding: 0 20px; }
  .section           { padding: 64px 0; }
  .pkg-grid          { grid-template-columns: 1fr; }
  .mental-inner      { flex-direction: column; align-items: flex-start; gap: 10px; }
}
</style>

<!-- ── Light mode overrides (non-scoped so html selector works) ── -->
<style>
html:not(.dark) .landing {
  /* ── Token overrides ────────────────────────────────────── */
  --c-abyss:  #f0f7fc;
  --c-deep:   #e6f0f8;
  --c-navy:   #dceaf5;
  --c-mid:    #cce0ee;
  --c-border: #a8cee0;
  --c-cyan:   #0090b8;
  --c-teal:   #006d8f;
  --c-ice:    #0a1e2d;
  --c-muted:  #2a5470;
  --c-dim:    #4a7a95;

  background: var(--c-abyss);
  color: var(--c-ice);
}

/* Hero */
html:not(.dark) .landing .hero-grid-bg {
  background-image:
    linear-gradient(#9dc4d8 1px, transparent 1px),
    linear-gradient(90deg, #9dc4d8 1px, transparent 1px);
  opacity: 0.3;
}

html:not(.dark) .landing .hero-glow {
  background: radial-gradient(ellipse at center, rgba(0,144,184,0.1) 0%, transparent 70%);
}

/* Mental model bar */
html:not(.dark) .landing .mental-model {
  background: rgba(220, 234, 245, 0.9);
}

/* Hardcoded dark bg overrides — code cards, flow, feature code */
html:not(.dark) .landing .code-card         { background: #ffffff; }
html:not(.dark) .landing .code-card-active  { box-shadow: 0 0 32px rgba(0,144,184,0.1); }
html:not(.dark) .landing .flow-showcase     { background: #ffffff; }
html:not(.dark) .landing .flow-file-bar     { background: var(--c-navy); }
html:not(.dark) .landing .feature-code      { background: #f0f8fd; }
html:not(.dark) .landing .cta-terminal      { background: #ffffff; }

/* Button ghost */
html:not(.dark) .landing .btn-ghost {
  color: var(--c-teal);
  border-color: var(--c-border);
}
html:not(.dark) .landing .btn-ghost:hover {
  border-color: var(--c-cyan);
  color: var(--c-cyan);
}

/* Callout pills */
html:not(.dark) .landing .callout {
  background: var(--c-deep);
}

/* Package cards */
html:not(.dark) .landing .pkg-card {
  background: #ffffff;
  border-color: var(--c-border);
}
html:not(.dark) .landing .pkg-card:hover {
  background: var(--c-deep);
}

/* Feature cards */
html:not(.dark) .landing .feature-card {
  background: #ffffff;
}

/* Inline code */
html:not(.dark) .landing .inline-code {
  color: var(--c-teal);
  background: rgba(0,144,184,0.08);
  border-color: rgba(0,144,184,0.2);
}

/* Flow tabs */
html:not(.dark) .landing .flow-tab        { color: var(--c-muted); }
html:not(.dark) .landing .flow-tab:hover  { background: rgba(0,144,184,0.04); }
html:not(.dark) .landing .flow-tab.active {
  color: var(--c-cyan);
  background: rgba(0,144,184,0.08);
  border-bottom-color: var(--c-cyan);
}

/* Syntax highlight — adjusted for light code backgrounds */
html:not(.dark) .landing .hl-k  { color: #0055c0; }
html:not(.dark) .landing .hl-s  { color: #1a6b1a; }
html:not(.dark) .landing .hl-cm { color: #5a8a9f; font-style: italic; }
html:not(.dark) .landing .hl-t  { color: #7a5a00; }
html:not(.dark) .landing .hl-d  { color: #6a2a99; }
html:not(.dark) .landing .hl-v  { color: #b84500; }

/* Terminals always stay dark — override any light-mode bleed */
html:not(.dark) .landing .terminal         { background: #020a14; }
html:not(.dark) .landing .terminal-bar     { background: #030d18; }
html:not(.dark) .landing .terminal-body    { color: #deedf5; }
html:not(.dark) .landing .t-cmd            { color: #deedf5; }
html:not(.dark) .landing .t-ok             { color: #4ade80; }
html:not(.dark) .landing .t-info           { color: #00d4ff; }
html:not(.dark) .landing .t-muted          { color: #2a5a70; }
html:not(.dark) .landing .cta-prompt       { color: #007a99; }
html:not(.dark) .landing .cta-cmd          { color: #0a1e2d; }

/* CTA section */
html:not(.dark) .landing .cta-section {
  background: var(--c-deep);
}
html:not(.dark) .landing .cta-grid-bg {
  background-image:
    linear-gradient(#9dc4d8 1px, transparent 1px),
    linear-gradient(90deg, #9dc4d8 1px, transparent 1px);
}
html:not(.dark) .landing .cta-terminal {
  border-color: var(--c-border);
}
</style>
