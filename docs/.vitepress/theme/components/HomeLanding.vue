<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ── Mouse spotlight tracking ───────────────────────────────
const mouseX = ref(50)
const mouseY = ref(30)

function handleMouseMove(e) {
  const target = e.currentTarget
  if (!target) return
  const rect = target.getBoundingClientRect()
  mouseX.value = ((e.clientX - rect.left) / rect.width) * 100
  mouseY.value = ((e.clientY - rect.top) / rect.height) * 100
}

const spotlightStyle = computed(() => ({
  background: `radial-gradient(600px circle at ${mouseX.value}% ${mouseY.value}%, rgba(0,212,255,0.08), transparent 40%)`,
}))

// ── Hero terminal animation ────────────────────────────────
const heroLines = ref([])
const heroScript = [
  { text: '$ npm create faberjs@latest my-app',  type: 'cmd',  delay: 400  },
  { text: '',                                     type: 'gap',  delay: 1000 },
  { text: '  ✔ Scaffolding project structure',   type: 'ok',   delay: 1200 },
  { text: '  ✔ Creating app skeleton',           type: 'ok',   delay: 1500 },
  { text: '  ✔ Configuring SQLite database',     type: 'ok',   delay: 1800 },
  { text: '  ✔ Setting up authentication',       type: 'ok',   delay: 2100 },
  { text: '  ✔ Done in 1.2s',                    type: 'ok',   delay: 2400 },
  { text: '',                                     type: 'gap',  delay: 2700 },
  { text: '$ cd my-app && npx faber serve',      type: 'cmd',  delay: 2900 },
  { text: '',                                     type: 'gap',  delay: 3500 },
  { text: '  ╭───────────────────────────────╮', type: 'box',  delay: 3700 },
  { text: '  │  ▲ FaberJS  v1.1              │', type: 'box',  delay: 3800 },
  { text: '  │                               │', type: 'box',  delay: 3900 },
  { text: '  │  ➜ http://localhost:3000      │', type: 'box',  delay: 4000 },
  { text: '  │  ➜ Routes: 12 · Providers: 4  │', type: 'box',  delay: 4100 },
  { text: '  │  ➜ Ready in 287ms             │', type: 'box',  delay: 4200 },
  { text: '  ╰───────────────────────────────╯', type: 'box',  delay: 4300 },
]

let heroTimers = []
onMounted(() => {
  heroScript.forEach(({ text, type, delay }) => {
    heroTimers.push(setTimeout(() => heroLines.value.push({ text, type }), delay))
  })
})
onUnmounted(() => heroTimers.forEach(clearTimeout))

// ── Syntax highlighter ─────────────────────────────────────
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
    return c.replace(/\x00(\d+)\x00/g, (_, i) => tokens[+i])
  }
}

const hl = makeHighlighter([
  { re: /(\/\/[^\n]+)/g,                                                                                           cls: 'hl-cm' },
  { re: /('[^'\n]*'|"[^"\n]*"|`[^`]*`)/g,                                                                         cls: 'hl-s'  },
  { re: /\b(import|export|from|const|let|var|async|await|return|new|this|class|extends|static|private|public|readonly|void|true|false|null|undefined|type|interface|Promise|if|else|for|of|in|throw)\b/g, cls: 'hl-k'  },
  { re: /(@\w+)/g,                                                                                                  cls: 'hl-d'  },
  { re: /\b([A-Z][a-zA-Z0-9]*)\b/g,                                                                                cls: 'hl-t'  },
])

const hlBash = makeHighlighter([
  { re: /(#[^\n]+)/g,                            cls: 'hl-cm' },
  { re: /(make:\w+|db:\w+|route:\w+|key:\w+)/g,  cls: 'hl-t'  },
  { re: /\b(npx|faber|cd|npm|pnpm)\b/g,          cls: 'hl-k'  },
  { re: /('[^'\n]*'|"[^"\n]*")/g,                cls: 'hl-s'  },
])

const hlPhp = makeHighlighter([
  { re: /(\/\/[^\n]+)/g,                                                                              cls: 'hl-cm' },
  { re: /('[^'\n]*'|"[^"\n]*")/g,                                                                     cls: 'hl-s'  },
  { re: /\b(public|private|readonly|function|return|new|class|extends|use|namespace)\b/g,             cls: 'hl-k'  },
  { re: /(\$\w+)/g,                                                                                    cls: 'hl-v'  },
  { re: /\b([A-Z][a-zA-Z0-9]*)\b/g,                                                                   cls: 'hl-t'  },
])

// ── Three pillars ──────────────────────────────────────────
const pillars = [
  {
    label: 'Zero config',
    title: 'Auto-discovered.\nAuto-wired.',
    desc: 'Controllers, services, providers — all auto-resolved from the IoC container. Drop a file in the right folder, it just works.',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m0-12.14l2.83 2.83m4.48 4.48l2.83 2.83" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  },
  {
    label: 'Zero translation',
    title: 'Laravel patterns.\nNative TypeScript.',
    desc: 'Route → Controller → Service → Model. Every Laravel idiom maps 1:1 — Eloquent queries, FormRequests, Policies, Events. Type-safe end-to-end.',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="20" cy="18" r="2" stroke="currentColor" stroke-width="1.5"/></svg>',
  },
  {
    label: 'Zero limits',
    title: 'AI-native.\nMulti-runtime.',
    desc: 'Built-in agents with tool schemas and streaming. Deploy to Node, Bun, Lambda, or Cloudflare Workers without rewriting a single route.',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  },
]

// ── Flow tabs (full stack showcase) ────────────────────────
const activeTab = ref('route')
const tabs = [
  { id: 'route',      label: 'Route',      file: 'routes/api.ts',                          icon: '01' },
  { id: 'controller', label: 'Controller', file: 'app/controllers/PostController.ts',      icon: '02' },
  { id: 'service',    label: 'Service',    file: 'app/services/PostService.ts',            icon: '03' },
  { id: 'model',      label: 'Model',      file: 'app/models/Post.ts',                     icon: '04' },
]

const flowCode = {
  route: `import { Route } from '@faber-js/router'
import { PostController } from '../app/controllers/PostController'

Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.get('/posts',         [PostController, 'index'])
  Route.post('/posts',        [PostController, 'store'])
  Route.get('/posts/:id',     [PostController, 'show'])
  Route.put('/posts/:id',     [PostController, 'update'])
  Route.delete('/posts/:id',  [PostController, 'destroy'])
})`,

  controller: `import { Controller } from '@faber-js/router'
import { Request, Response } from '@faber-js/http'
import { PostService } from '../services/PostService'

@Injectable()
export class PostController extends Controller {
  constructor(private posts: PostService) { super() }

  async index(req: Request): Promise<Response> {
    return this.json(
      await this.posts.paginate(req.input('page', 1))
    )
  }

  async store(req: Request): Promise<Response> {
    const post = await this.posts.create(req.validated())
    return this.json(post, 201)
  }
}`,

  service: `import { Service, Injectable } from '@faber-js/core'
import { Post } from '../models/Post'
import { event } from '@faber-js/events'
import { dispatch } from '@faber-js/queue'
import { PostCreated } from '../events/PostCreated'
import { NotifyFollowers } from '../jobs/NotifyFollowers'

@Injectable()
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
  static override table = 'posts'
  static override fillable = ['title', 'body', 'author_id']

  author() {
    return this.belongsTo(User, 'author_id')
  }

  comments() {
    return this.hasMany(Comment, 'post_id')
  }

  scopePublished(query: QueryBuilder) {
    return query.where('published', true)
                .orderBy('created_at', 'desc')
  }
}`,
}

const activeCode    = computed(() => hl(flowCode[activeTab.value]))
const activeTabMeta = computed(() => tabs.find(t => t.id === activeTab.value))

// ── AI showcase ────────────────────────────────────────────
const aiCode = `import { Agent, Tool, Authorize, t } from '@faber-js/ai'
import { Order } from '../models/Order'

export class SupportAgent extends Agent {
  override model = 'claude-sonnet-4-6'

  override output = t.object({
    summary:  t.string(),
    severity: t.enum(['low', 'medium', 'high']),
    nextStep: t.string().optional(),
  })

  @Tool({
    description: 'Look up an order by ID',
    input: { id: t.string() },
  })
  @Authorize('view-order', ([{ id }]) => id)
  async lookupOrder({ id }: { id: string }) {
    return Order.with('items', 'shipment').findOrFail(id)
  }

  @Tool({
    description: 'Refund an order — requires manager role',
    input: { id: t.string(), reason: t.string() },
  })
  @Authorize('refund-order', ([{ id }]) => id)
  async refund({ id, reason }) {
    return await this.refundService.process(id, reason)
  }
}`

const streamIcons = {
  thinking: '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M7 1.5a5.5 5.5 0 0 1 0 11V1.5z" fill="currentColor" opacity="0.5"/></svg>',
  tool:     '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5a2.5 2.5 0 0 0 3 3L7 10l-3-3 5.5-5.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 10l-4.5 2.5L4 8" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  stream:   '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M8 1L3 8h4l-1 5 5-7H7l1-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="currentColor" fill-opacity="0.2"/></svg>',
  output:   '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.2" stroke="currentColor" stroke-width="1.4"/><path d="M2 5.5h10" stroke="currentColor" stroke-width="1.4"/><path d="M5 5.5v6.5" stroke="currentColor" stroke-width="1.4"/></svg>',
  check:    '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow:    '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M10 6H2M5 3L2 6l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
}

const aiStream = ref([])
const aiStreamScript = [
  { text: '> agent.stream("Where is order #1234?")',                        type: 'cmd' },
  { text: '',                                                                type: 'gap' },
  { text: 'thinking…',                                                       type: 'thinking', icon: 'thinking' },
  { text: '',                                                                type: 'gap' },
  { text: 'tool: lookupOrder({ id: "1234" })',                               type: 'tool',     icon: 'tool' },
  { text: 'authorized via @Authorize("view-order")',                         type: 'auth',     icon: 'check', indent: true },
  { text: '{ id: "1234", status: "shipped", carrier: "UPS" }',               type: 'return',   icon: 'arrow', indent: true },
  { text: '',                                                                type: 'gap' },
  { text: 'streaming response…',                                             type: 'stream',   icon: 'stream' },
  { text: '   "Your order shipped April 25 via UPS.',                        type: 'token' },
  { text: '    Tracking: 1Z999AA10123456784. Expected',                      type: 'token' },
  { text: '    delivery is April 30."',                                      type: 'token' },
  { text: '',                                                                type: 'gap' },
  { text: 'structured output:',                                              type: 'output',   icon: 'output' },
  { text: '   { summary: "Order shipped",',                                  type: 'json' },
  { text: '     severity: "low",',                                           type: 'json' },
  { text: '     nextStep: "Await delivery" }',                               type: 'json' },
]

const aiPlaying = ref(false)
let aiTimers = []

function playAi() {
  aiStream.value = []
  aiPlaying.value = true
  aiTimers.forEach(clearTimeout)
  aiTimers = []
  aiStreamScript.forEach((line, i) => {
    aiTimers.push(setTimeout(() => {
      aiStream.value.push(line)
      if (i === aiStreamScript.length - 1) aiPlaying.value = false
    }, i * 380))
  })
}

onMounted(() => setTimeout(playAi, 1500))
onUnmounted(() => aiTimers.forEach(clearTimeout))

// ── Multi-runtime showcase ─────────────────────────────────
const activeRuntime = ref('node')
const runtimes = [
  { id: 'node',       label: 'Node.js',     tag: 'default',     icon: 'N' },
  { id: 'bun',        label: 'Bun',         tag: 'fast',        icon: 'B' },
  { id: 'lambda',     label: 'AWS Lambda',  tag: 'serverless',  icon: 'λ' },
  { id: 'cloudflare', label: 'Cloudflare',  tag: 'edge',        iconSvg: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M14 11.5c0 1.66-1.34 3-3 3H5a3.5 3.5 0 1 1 .5-6.97A4.5 4.5 0 0 1 14 9.5c0 .68-.15 1.32-.42 1.9.27.04.55.1.42.1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/></svg>' },
]

const runtimeCode = {
  node: `// server.ts — production Node deployment
import { app } from './bootstrap/app'
import { createFastifyAdapter } from '@faber-js/adapters/fastify'

const adapter = createFastifyAdapter(app)
await adapter.listen({ port: 3000, host: '0.0.0.0' })`,

  bun: `// server.ts — Bun runtime, near-zero cold start
import { app } from './bootstrap/app'
import { createBunAdapter } from '@faber-js/adapters/bun'

Bun.serve({
  port:  3000,
  fetch: createBunAdapter(app),
})`,

  lambda: `// handler.ts — AWS Lambda
import { app } from './bootstrap/app'
import { createLambdaHandler } from '@faber-js/adapters/lambda'

export const handler = createLambdaHandler(app)`,

  cloudflare: `// worker.ts — Cloudflare Workers, deployed to the edge
import { app } from './bootstrap/app'
import { createWorkerHandler } from '@faber-js/adapters/cloudflare'

export default {
  fetch: createWorkerHandler(app),
}`,
}

const activeRuntimeCode = computed(() => hl(runtimeCode[activeRuntime.value]))
const activeRuntimeMeta = computed(() => runtimes.find(r => r.id === activeRuntime.value))

// ── Feature cards ──────────────────────────────────────────
const features = [
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M3 11h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="11" cy="11" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M13 9.5L18 6M13 12.5L18 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'Expressive Routing',
    desc: 'Route groups, resource routes, named routes, and model binding — fluent API, zero config.',
    lang: 'ts',
    code: `Route.group({ prefix: '/api', middleware: ['auth'] }, () => {
  Route.resource('posts', PostController)
  Route.get('/me', [UserController, 'me'])
})`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><ellipse cx="11" cy="6" rx="7" ry="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M4 6v4.5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6" stroke="currentColor" stroke-width="1.5"/><path d="M4 10.5V15c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-4.5" stroke="currentColor" stroke-width="1.5"/></svg>',
    name: 'ActiveRecord ORM',
    desc: 'Eloquent-style models with relationships, scopes, and an expressive query builder. SQLite, PostgreSQL, MySQL — swap drivers with one line.',
    lang: 'ts',
    code: `const posts = await Post
  .where('published', true)
  .with('author', 'tags')
  .orderBy('created_at', 'desc')
  .paginate(20)`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M3 7h11M3 11h8M3 15h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M16 12.5l4-2.5-4-2.5v5z" fill="currentColor"/></svg>',
    name: 'Queues & Jobs',
    desc: 'BullMQ-backed queues with a one-liner dispatch API. Retry, delay, prioritise. Or use the sync driver — no Redis required for local dev.',
    lang: 'ts',
    code: `await dispatch(new SendWelcomeEmail(user))

await dispatch(new ProcessPayment(order))
  .onQueue('payments')
  .delay(60)`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M13 3L5 12h6.5L9 19l10-9H12l1-7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    name: 'Events & Listeners',
    desc: 'Decouple your app with a typed event bus. Listeners can run synchronously or queued.',
    lang: 'ts',
    code: `await event(new UserRegistered(user))

class SendWelcomeEmail {
  async handle(e: UserRegistered) {
    await Mail.to(e.user.email).send(new WelcomeMail())
  }
}`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="5" y="10" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 10V7.5a3 3 0 016 0V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="11" cy="15" r="1.5" fill="currentColor"/></svg>',
    name: 'Auth & Policies',
    desc: 'JWT guards, API tokens with scoped abilities, password reset, and resource policies — wired in automatically.',
    lang: 'ts',
    code: `Route.group({ middleware: ['auth'] }, () => {
  Route.get('/dashboard', [DashController, 'index'])
})

const user = req.user<User>()
await this.authorize('update', post)`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="3" y="4" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 9.5l3 2.5-3 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 14.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'Artisan-style CLI',
    desc: 'Generate controllers, models, jobs, mailables, agents, migrations and more from a single command.',
    lang: 'bash',
    code: `npx faber make:model Post -m
npx faber make:agent SupportAgent
npx faber make:mail WelcomeMail
npx faber db:migrate
npx faber serve`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="3" y="5" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M13 8h4a2 2 0 012 2v4a2 2 0 01-2 2h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 11h4M12 9l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    name: 'Frontend Bridge',
    desc: 'Build React or Vue SPAs using server-side routing — no separate API, no manual JSON wiring. End-to-end type safety.',
    lang: 'ts',
    code: `return this.render('Users/Index', {
  users: await this.userService.all(),
})

const { props } = usePage<{ users: User[] }>()
<Link href="/users/create">Create</Link>`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M4 11a7 7 0 0114 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="11" cy="11" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 11a9 9 0 0118 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".4"/></svg>',
    name: 'Real-Time Channels',
    desc: 'WebSocket channels that feel like HTTP routes — public, private, presence — same DI, same auth, same shape.',
    lang: 'ts',
    code: `Channel.presence('room.{slug}', [RoomChannel, 'join'])

async join(socket: Socket, slug: string) {
  socket.joinPresence(\`room.\${slug}\`, { id, name })
  socket.on('msg', (m) => socket.broadcast(m))
}`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="12" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="12" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M12 15.5h7M15.5 12v7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'Schema-First Models',
    desc: 'One declaration drives your model, migrations, validation rules, factory, and OpenAPI spec — all type-inferred.',
    lang: 'ts',
    code: `const User = schema('users', {
  id:    t.id(),
  name:  t.string().min(2).max(100),
  email: t.email().unique(),
  role:  t.enum(['admin','editor','viewer']),
})`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 10h2M7 13h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="16" r="4" fill="#030d18" stroke="currentColor" stroke-width="1.5"/><path d="M14.5 16h3M16 14.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'DevTools Dashboard',
    desc: 'Zero-config request, query, and event tracing. Live at /_faber in dev — disabled in production automatically.',
    lang: 'ts',
    code: `app.register(new DevToolsServiceProvider(app, {
  db: getConnection(),
  dispatcher: eventDispatcher,
}))

// Open http://localhost:3000/_faber`,
  },
  {
    icon: '<svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M11 18a7 7 0 100-14 7 7 0 000 14z" stroke="currentColor" stroke-width="1.5"/><path d="M3 11h2M17 11h2M11 3v2M11 17v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    name: 'Caching & Locks',
    desc: 'Redis, memory, and database drivers with the same fluent API. Atomic locks and a built-in rate limiter.',
    lang: 'ts',
    code: `await Cache.remember('users:active', 60, async () => {
  return User.where('active', true).get()
})

await Cache.lock('process-order:1234', 10).get(async () => {
  await processOrder(order)
})`,
  },
]

const highlightFeature = (f) =>
  f.lang === 'bash' ? hlBash(f.code) : hl(f.code)

// ── Ecosystem (categorized) ────────────────────────────────
const ecosystem = [
  {
    title: 'Core',
    icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="currentColor" fill-opacity="0.15"/><path d="M8 1.5v13M2.5 4.5L13.5 11.5M2.5 11.5L13.5 4.5" stroke="currentColor" stroke-width="1.4" opacity="0.4"/></svg>',
    color: 'cyan',
    pkgs: [
      { name: 'core',    desc: 'IoC, providers, facades' },
      { name: 'config',  desc: '.env + typed config' },
      { name: 'http',    desc: 'Request, Response, middleware' },
      { name: 'router',  desc: 'Routing, groups, model binding' },
      { name: 'console', desc: 'CLI, generators, tinker' },
    ],
  },
  {
    title: 'Data',
    icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="3.5" rx="5.5" ry="1.8" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 3.5v4c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8v-4M2.5 7.5v4c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8v-4" stroke="currentColor" stroke-width="1.4"/></svg>',
    color: 'cyan',
    pkgs: [
      { name: 'orm',        desc: 'ActiveRecord, migrations' },
      { name: 'schema',     desc: 'Schema-first models' },
      { name: 'validation', desc: 'Rules engine, FormRequest' },
    ],
  },
  {
    title: 'Async',
    icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8a5.5 5.5 0 0 1 9.7-3.5L13.5 3v3.5h-3.5l1.4-1.5a4 4 0 0 0-7 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 8a5.5 5.5 0 0 1-9.7 3.5L2.5 13V9.5h3.5l-1.4 1.5a4 4 0 0 0 7-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    color: 'cyan',
    pkgs: [
      { name: 'queue',    desc: 'BullMQ jobs, sync driver' },
      { name: 'events',   desc: 'Typed event/listener bus' },
      { name: 'channels', desc: 'WebSockets, presence, broadcast' },
    ],
  },
  {
    title: 'Auth & Security',
    icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l5.5 2v4c0 3.3-2.5 5.5-5.5 6.5-3-1-5.5-3.2-5.5-6.5v-4L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/><path d="M5.5 7.5l2 2 3-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    color: 'cyan',
    pkgs: [
      { name: 'auth',  desc: 'JWT, API tokens, policies, password reset' },
      { name: 'crypt', desc: 'Hash, AES-256-GCM, signed URLs' },
    ],
  },
  {
    title: 'Communication',
    icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3.5" width="12" height="9" rx="1.2" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 4.5L8 9l5.5-4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    color: 'cyan',
    pkgs: [
      { name: 'mail',        desc: 'Mailable classes, SMTP, fakes' },
      { name: 'http-client', desc: 'Fluent fetch, retries, faking' },
    ],
  },
  {
    title: 'AI-Native',
    icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L9.5 6l4.5 1.5L9.5 9 8 13.5 6.5 9 2 7.5 6.5 6 8 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="currentColor" fill-opacity="0.2"/><circle cx="13" cy="3" r=".8" fill="currentColor"/><circle cx="3" cy="12.5" r=".5" fill="currentColor"/></svg>',
    color: 'purple',
    pkgs: [
      { name: 'ai', desc: 'Agents, tools, streaming, structured output' },
    ],
  },
  {
    title: 'Frontend',
    icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="11" rx="1.2" stroke="currentColor" stroke-width="1.4"/><path d="M2 5.5h12" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 5.5v8" stroke="currentColor" stroke-width="1.4"/><circle cx="3.7" cy="4" r=".4" fill="currentColor"/><circle cx="5" cy="4" r=".4" fill="currentColor"/></svg>',
    color: 'cyan',
    pkgs: [
      { name: 'bridge',       desc: 'Bridge protocol + Vite plugin' },
      { name: 'bridge-react', desc: 'usePage, useForm, Link' },
      { name: 'bridge-vue',   desc: 'usePage, useForm, BridgeLink' },
      { name: 'view',         desc: 'JSX server-side views' },
    ],
  },
  {
    title: 'Infrastructure',
    icon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="4" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="9.5" width="12" height="4" rx="1" stroke="currentColor" stroke-width="1.4"/><circle cx="4.5" cy="4.5" r=".7" fill="currentColor"/><circle cx="4.5" cy="11.5" r=".7" fill="currentColor"/><path d="M7 4.5h5M7 11.5h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/></svg>',
    color: 'cyan',
    pkgs: [
      { name: 'cache',    desc: 'Redis, memory, DB, locks, rate limiter' },
      { name: 'devtools', desc: 'Request, query, event tracing' },
      { name: 'adapters', desc: 'Fastify, Bun, Lambda, Cloudflare' },
      { name: 'support',  desc: 'Collection, Str, Arr, Pipeline' },
      { name: 'testing',  desc: 'HTTP test client, DB assertions' },
    ],
  },
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

// ── Copy command helper ───────────────────────────────────
const copied = ref(false)
function copyCommand() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText('npm create faberjs@latest my-app')
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  }
}

const faberCode = `// app/controllers/UserController.ts

@Injectable()
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
    <section class="hero" @mousemove="handleMouseMove">
      <div class="hero-spotlight" :style="spotlightStyle" aria-hidden="true"/>
      <div class="hero-grid-bg"   aria-hidden="true"/>
      <div class="hero-glow"      aria-hidden="true"/>
      <div class="hero-orb hero-orb-a" aria-hidden="true"/>
      <div class="hero-orb hero-orb-b" aria-hidden="true"/>

      <div class="container hero-layout">
        <div class="hero-left">
          <div class="hero-badge">
            <span class="badge-dot"/>
            v1.1 · MIT · Node · Bun · Lambda · Cloudflare · AI-Native
          </div>

          <h1 class="hero-headline">
            <span class="headline-line">The Laravel</span>
            <span class="headline-line">experience.</span>
            <span class="headline-line"><span class="hero-accent">Now in Node.js.</span></span>
          </h1>

          <p class="hero-sub">
            A full-stack TypeScript backend framework with routing, ORM, queues,
            auth, real-time, and AI agents. All wired up.
            <span class="sub-accent">Conventions in place.</span>
            Ready on day one.
          </p>

          <div class="hero-ctas">
            <a href="/getting-started/installation" class="btn btn-primary">
              Get Started
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h9M8.5 4l4 3-4 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
            <a href="https://github.com/faberjs/faberjs" class="btn btn-ghost" target="_blank" rel="noopener">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              Star on GitHub
            </a>
          </div>

          <div class="hero-stats">
            <div class="stat">
              <span class="stat-val">25</span>
              <span class="stat-label">packages</span>
            </div>
            <div class="stat-div"/>
            <div class="stat">
              <span class="stat-val">100%</span>
              <span class="stat-label">TypeScript</span>
            </div>
            <div class="stat-div"/>
            <div class="stat">
              <span class="stat-val">4</span>
              <span class="stat-label">runtimes</span>
            </div>
            <div class="stat-div"/>
            <div class="stat">
              <span class="stat-val">AI</span>
              <span class="stat-label">native</span>
            </div>
          </div>
        </div>

        <div class="hero-right">
          <!-- Floating preview cards behind the terminal -->
          <div class="floater floater-a" aria-hidden="true">
            <div class="floater-bar">
              <span class="floater-dot"/>
              <span>route</span>
            </div>
            <div class="floater-body">
              <span class="hl-k">Route</span>.<span class="hl-t">get</span>(<span class="hl-s">'/posts'</span>, [<span class="hl-t">PostController</span>])
            </div>
          </div>

          <div class="floater floater-b" aria-hidden="true">
            <div class="floater-bar">
              <span class="floater-dot floater-dot-purple"/>
              <span>agent.stream</span>
            </div>
            <div class="floater-body">
              <span class="hl-cm">// streaming SSE…</span><br>
              <span class="hl-d">@Tool</span> <span class="hl-t">lookupOrder</span>
            </div>
          </div>

          <div class="terminal terminal-hero">
            <div class="terminal-bar">
              <span class="tb tb-r"/><span class="tb tb-y"/><span class="tb tb-g"/>
              <span class="terminal-title">~ / my-app</span>
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
            <a href="/basics/controllers"         class="mm-node">Controller</a>
            <span class="mm-arrow"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7.5 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <a href="/digging-deeper/services"    class="mm-node">Service</a>
            <span class="mm-arrow"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7.5 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <a href="/orm/models"                 class="mm-node">Model</a>
            <span class="mm-arrow"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7.5 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <a href="/digging-deeper/jobs-queues" class="mm-node">Job</a>
            <span class="mm-arrow">/</span>
            <a href="/digging-deeper/events-listeners" class="mm-node">Event</a>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         THREE PILLARS — Zero config, translation, limits
    ══════════════════════════════════════════════ -->
    <section class="section pillars-section">
      <div class="container">
        <div class="section-header">
          <span class="eyebrow">Why FaberJS</span>
          <h2 class="section-title">Three things you'll never<br>need to think about again.</h2>
        </div>

        <div class="pillars-grid">
          <div v-for="p in pillars" :key="p.label" class="pillar-card">
            <div class="pillar-top">
              <span class="pillar-icon" v-html="p.icon"/>
              <span class="pillar-label">{{ p.label }}</span>
            </div>
            <h3 class="pillar-title">{{ p.title }}</h3>
            <p class="pillar-desc">{{ p.desc }}</p>
            <div class="pillar-edge"/>
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
          <span class="eyebrow">Zero mental translation</span>
          <h2 class="section-title">If you've built with Laravel,<br>you already speak FaberJS.</h2>
          <p class="section-sub">
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
            <span class="vs-text">→</span>
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
            <span class="callout-icon">✓</span>
            Same constructor injection
          </div>
          <div class="callout">
            <span class="callout-icon">✓</span>
            Same <code>validated()</code> pattern
          </div>
          <div class="callout">
            <span class="callout-icon">✓</span>
            Same <code>event()</code> helper
          </div>
          <div class="callout">
            <span class="callout-icon">✓</span>
            Same response shape
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
          <span class="eyebrow">The full stack</span>
          <h2 class="section-title">Every layer, one mental model.</h2>
          <p class="section-sub">
            Click through a real request — from route definition all the way down
            to the database model.
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
              <span class="tab-num">{{ t.icon }}</span>
              {{ t.label }}
            </button>
          </div>

          <div class="flow-code-wrap">
            <div class="flow-file-bar">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="opacity:0.5"><rect x="1" y="1" width="7" height="9" rx="1" stroke="currentColor" stroke-width="1"/><path d="M3 4h5M3 6h4M3 8h3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
              <span>{{ activeTabMeta?.file }}</span>
            </div>
            <pre class="flow-code"><code v-html="activeCode"/></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         AI-NATIVE — the moat
    ══════════════════════════════════════════════ -->
    <section class="section ai-section">
      <div class="ai-glow" aria-hidden="true"/>
      <div class="container">
        <div class="section-header">
          <span class="eyebrow eyebrow-purple">AI-native</span>
          <h2 class="section-title">
            Agents are
            <span class="ai-accent">infrastructure</span><br>
            now. Treat them like it.
          </h2>
          <p class="section-sub">
            DI, typed tool schemas, per-session memory, authorization, structured
            output, and SSE streaming. Built into the framework — not bolted on.
          </p>
        </div>

        <div class="ai-showcase">
          <div class="ai-code-card">
            <div class="ai-card-header">
              <span class="ai-tag">@faber-js/ai</span>
              <span class="ai-file">app/agents/SupportAgent.ts</span>
            </div>
            <pre class="code-block ai-code"><code v-html="hl(aiCode)"/></pre>
          </div>

          <div class="ai-stream-card">
            <div class="ai-card-header">
              <span class="ai-tag ai-tag-live">
                <span class="ai-pulse"/>
                live
              </span>
              <span class="ai-file">SSE stream</span>
              <button class="ai-replay" @click="playAi" :disabled="aiPlaying">
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 4l4-2v4L2 4z" fill="currentColor"/><path d="M6 7a5 5 0 109-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
                replay
              </button>
            </div>
            <div class="ai-stream-body">
              <div
                v-for="(l, i) in aiStream"
                :key="i"
                :class="['ai-line', `ai-${l.type}`, { 'ai-line-flex': l.icon, 'ai-line-indent': l.indent }]"
              >
                <span v-if="l.icon" class="ai-line-icon" v-html="streamIcons[l.icon]"/>
                <span v-if="l.text || !l.icon" class="ai-line-text">{{ l.text || ' ' }}</span>
              </div>
              <span v-if="aiPlaying" class="t-cursor">▋</span>
            </div>
          </div>
        </div>

        <div class="ai-features">
          <div class="ai-feat">
            <span class="ai-feat-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M14 4a3 3 0 0 0 4 4l-9 9-3-3 8-8 0-2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
                <circle cx="15.5" cy="5.5" r=".9" fill="currentColor"/>
                <path d="M9 17l-5 2 2-5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </span>
            <div>
              <div class="ai-feat-title">Typed tools</div>
              <div class="ai-feat-desc">Schemas, validation, authorization</div>
            </div>
          </div>
          <div class="ai-feat">
            <span class="ai-feat-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="3" y="4" width="16" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.06"/>
                <rect x="3" y="12" width="16" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.06"/>
                <circle cx="6.5" cy="7" r=".8" fill="currentColor"/>
                <circle cx="6.5" cy="15" r=".8" fill="currentColor"/>
                <path d="M9.5 7h7M9.5 15h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </span>
            <div>
              <div class="ai-feat-title">Structured output</div>
              <div class="ai-feat-desc">Type-safe responses by contract</div>
            </div>
          </div>
          <div class="ai-feat">
            <span class="ai-feat-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M12 2L4 13h6l-1 7 9-12h-6l1-6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.15"/>
              </svg>
            </span>
            <div>
              <div class="ai-feat-title">SSE streaming</div>
              <div class="ai-feat-desc">Token-by-token to the browser</div>
            </div>
          </div>
          <div class="ai-feat">
            <span class="ai-feat-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 3a4 4 0 0 0-4 4v1a3 3 0 0 0-2 5.5A3.5 3.5 0 0 0 8 19a3 3 0 0 0 3-2v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M11 3a4 4 0 0 1 4 4v1a3 3 0 0 1 2 5.5 3.5 3.5 0 0 1-3 5.5 3 3 0 0 1-3-2v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M11 3v17M7 8h2M13 8h2M7 12h2M13 12h2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
              </svg>
            </span>
            <div>
              <div class="ai-feat-title">Per-session memory</div>
              <div class="ai-feat-desc">Conversation persistence built in</div>
            </div>
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
          <span class="eyebrow">Batteries included</span>
          <h2 class="section-title">Everything you need.<br>Nothing you don't.</h2>
          <p class="section-sub">
            Every feature a production backend requires — shipped as
            first-class, independently versioned packages.
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
         MULTI-RUNTIME
    ══════════════════════════════════════════════ -->
    <section class="section runtime-section">
      <div class="container">
        <div class="section-header">
          <span class="eyebrow">Run anywhere</span>
          <h2 class="section-title">Same code.<br>Four runtimes.</h2>
          <p class="section-sub">
            Pick the runtime that fits your deployment. Swap any time —
            the rest of your app doesn't change.
          </p>
        </div>

        <div class="runtime-showcase">
          <div class="runtime-tabs">
            <button
              v-for="r in runtimes"
              :key="r.id"
              :class="['runtime-tab', { active: activeRuntime === r.id }]"
              @click="activeRuntime = r.id"
            >
              <span class="rt-icon" v-if="r.iconSvg" v-html="r.iconSvg"/>
              <span class="rt-icon" v-else>{{ r.icon }}</span>
              <div class="rt-meta">
                <span class="rt-label">{{ r.label }}</span>
                <span class="rt-tag">{{ r.tag }}</span>
              </div>
            </button>
          </div>

          <div class="runtime-code-wrap">
            <div class="flow-file-bar">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="opacity:0.5"><rect x="1" y="1" width="7" height="9" rx="1" stroke="currentColor" stroke-width="1"/><path d="M3 4h5M3 6h4M3 8h3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
              <span>Adapter for {{ activeRuntimeMeta?.label }}</span>
              <span class="rt-badge">{{ activeRuntimeMeta?.tag }}</span>
            </div>
            <pre class="flow-code"><code v-html="activeRuntimeCode"/></pre>
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
          <span class="eyebrow">Meet your new Artisan</span>
          <h2 class="section-title cli-title">
            <span class="hero-accent">faber.</span><br>
            Your CLI superpower.
          </h2>
          <p class="section-sub cli-sub">
            A full-featured CLI that generates anything your app needs.
            Modelled on Laravel's Artisan so every command feels familiar.
          </p>

          <div class="cli-commands">
            <div class="cli-group">
              <div class="cli-group-label">Generate</div>
              <div v-for="cmd in ['make:controller', 'make:model -m', 'make:service', 'make:job', 'make:event', 'make:listener', 'make:middleware', 'make:migration', 'make:provider', 'make:agent', 'make:mail', 'make:view', 'make:schema', 'make:channel']" :key="cmd" class="cli-cmd">
                <span class="cmd-prefix">faber</span> {{ cmd }}
              </div>
            </div>
            <div class="cli-group">
              <div class="cli-group-label">Database</div>
              <div v-for="cmd in ['db:migrate', 'db:rollback', 'db:fresh', 'db:refresh', 'db:seed', 'db:status']" :key="cmd" class="cli-cmd">
                <span class="cmd-prefix">faber</span> {{ cmd }}
              </div>
            </div>
            <div class="cli-group">
              <div class="cli-group-label">Dev</div>
              <div v-for="cmd in ['serve', 'tinker', 'route:list', 'key:generate']" :key="cmd" class="cli-cmd">
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
              <div class="t-line t-ok">  ✔ Created database/migrations/2026_create_posts_table.ts</div>
              <div class="t-line t-gap">&nbsp;</div>
              <div class="t-line t-cmd">$ npx faber make:agent SupportAgent</div>
              <div class="t-line t-ok">  ✔ Created app/agents/SupportAgent.ts</div>
              <div class="t-line t-gap">&nbsp;</div>
              <div class="t-line t-cmd">$ npx faber db:migrate</div>
              <div class="t-line t-ok">  ✔ Ran migration: 2026_create_users_table</div>
              <div class="t-line t-ok">  ✔ Ran migration: 2026_create_posts_table</div>
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
         ECOSYSTEM (categorized)
    ══════════════════════════════════════════════ -->
    <section class="section ecosystem-section">
      <div class="container">
        <div class="section-header">
          <span class="eyebrow">The ecosystem</span>
          <h2 class="section-title">Twenty-five packages.<br>One framework.</h2>
          <p class="section-sub">
            Every package is independently versioned and published under
            <code class="inline-code">@faber-js</code>.
            Install only what you need — or scaffold everything at once.
          </p>
        </div>

        <div class="eco-groups">
          <div
            v-for="g in ecosystem"
            :key="g.title"
            :class="['eco-group', { 'eco-purple': g.color === 'purple' }]"
          >
            <div class="eco-group-header">
              <span class="eco-group-icon" v-html="g.icon"/>
              <span class="eco-group-title">{{ g.title }}</span>
              <span class="eco-group-count">{{ g.pkgs.length }}</span>
            </div>
            <div class="eco-pkg-list">
              <div v-for="p in g.pkgs" :key="p.name" class="eco-pkg">
                <span class="eco-pkg-name">@faber-js/{{ p.name }}</span>
                <span class="eco-pkg-desc">{{ p.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════════════
         CTA
    ══════════════════════════════════════════════ -->
    <section class="cta-section">
      <div class="cta-grid-bg" aria-hidden="true"/>
      <div class="cta-glow"    aria-hidden="true"/>
      <div class="container cta-inner">
        <span class="eyebrow">Build something real</span>
        <h2 class="cta-headline">Start in <span class="hero-accent">60 seconds.</span></h2>
        <p class="cta-sub">
          One command. Conventions in place. Production-ready from day one.
        </p>

        <div class="cta-terminal">
          <span class="cta-prompt">$</span>
          <span class="cta-cmd">npm create faberjs@latest my-app</span>
          <button class="cta-copy" @click="copyCommand" :title="copied ? 'Copied!' : 'Copy'">
            <svg v-if="!copied" width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 1.5h6a1 1 0 011 1v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
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
        <span class="footer-copy">&copy; 2026 FaberJS · MIT License</span>
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
  --c-abyss:    #030710;
  --c-deep:     #050d1c;
  --c-navy:     #081828;
  --c-mid:      #0e2236;
  --c-border:   #0d2a45;
  --c-cyan:     #00d4ff;
  --c-teal:     #007a99;
  --c-purple:   #c084fc;
  --c-amber:    #fbbf24;
  --c-emerald:  #34d399;
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
.container {
  padding: 0 max(32px, calc((100vw - 1136px) / 2));
}

/* ── Sections ────────────────────────────────────────────── */
.section {
  padding: 110px 0;
  position: relative;
}

.section-header {
  text-align: center;
  margin-bottom: 72px;
}

.eyebrow {
  display: inline-block;
  font-family: var(--ff-mono);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--c-cyan);
  margin-bottom: 16px;
  padding: 5px 12px;
  border: 1px solid rgba(0,212,255,0.2);
  border-radius: 100px;
  background: rgba(0,212,255,0.04);
}

.eyebrow-purple {
  color: var(--c-purple);
  border-color: rgba(192,132,252,0.25);
  background: rgba(192,132,252,0.05);
}

.section-title {
  font-size: clamp(32px, 4.5vw, 48px);
  font-weight: 700;
  letter-spacing: -0.035em;
  color: var(--c-ice);
  line-height: 1.1;
  margin-bottom: 16px;
}

.section-sub {
  font-size: 16px;
  color: var(--c-muted);
  max-width: 580px;
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
  background-size: 56px 56px;
  opacity: 0.3;
  pointer-events: none;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 30%, black 0%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 30%, black 0%, transparent 80%);
}

.hero-spotlight {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: background 0.15s;
  z-index: 1;
}

.hero-glow {
  position: absolute;
  top: -10%;
  left: 50%;
  transform: translateX(-50%);
  width: 900px;
  height: 700px;
  background: radial-gradient(ellipse at center, rgba(0,212,255,0.1) 0%, transparent 65%);
  pointer-events: none;
}

.hero-orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(80px);
}

.hero-orb-a {
  width: 320px; height: 320px;
  top: 15%; left: -80px;
  background: rgba(0,212,255,0.12);
  animation: drift 18s ease-in-out infinite;
}

.hero-orb-b {
  width: 380px; height: 380px;
  bottom: 5%; right: -120px;
  background: rgba(192,132,252,0.08);
  animation: drift 22s ease-in-out infinite reverse;
}

@keyframes drift {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(40px, -30px); }
}

.hero-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 64px;
  align-items: center;
  padding-top: 80px;
  padding-bottom: 100px;
  position: relative;
  z-index: 2;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 100px;
  border: 1px solid var(--c-border);
  background: rgba(0,212,255,0.04);
  font-family: var(--ff-mono);
  font-size: 11px;
  color: var(--c-teal);
  margin-bottom: 32px;
  backdrop-filter: blur(8px);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-cyan);
  box-shadow: 0 0 8px var(--c-cyan);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.6; transform: scale(0.85); }
}

.hero-headline {
  font-size: clamp(40px, 6vw, 68px);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.05;
  color: var(--c-ice);
  margin-bottom: 28px;
}

.headline-line {
  display: block;
  opacity: 0;
  transform: translateY(12px);
  animation: rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

.headline-line:nth-child(1) { animation-delay: 0.1s; }
.headline-line:nth-child(2) { animation-delay: 0.25s; }
.headline-line:nth-child(3) { animation-delay: 0.4s; }

@keyframes rise {
  to { opacity: 1; transform: translateY(0); }
}

.hero-accent {
  background: linear-gradient(120deg, var(--c-cyan), #6ee7ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-sub {
  font-size: 17px;
  color: var(--c-muted);
  line-height: 1.7;
  margin-bottom: 40px;
  max-width: 480px;
  opacity: 0;
  animation: rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.55s forwards;
}

.sub-accent {
  color: var(--c-ice);
  font-weight: 500;
}

.hero-ctas {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 56px;
  opacity: 0;
  animation: rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.7s forwards;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s;
  cursor: pointer;
  border: none;
  font-family: var(--ff-sans);
}

.btn-primary {
  background: var(--c-cyan);
  color: var(--c-abyss);
  box-shadow: 0 4px 24px rgba(0,212,255,0.2);
}
.btn-primary:hover {
  background: #33ddff;
  transform: translateY(-1px);
  box-shadow: 0 6px 32px rgba(0,212,255,0.4);
}

.btn-ghost {
  background: rgba(13,42,69,0.4);
  color: var(--c-muted);
  border: 1px solid var(--c-border);
  backdrop-filter: blur(8px);
}
.btn-ghost:hover {
  border-color: rgba(0,212,255,0.4);
  color: var(--c-cyan);
  background: rgba(0,212,255,0.05);
}

.btn-lg { padding: 14px 28px; font-size: 15px; }

.hero-stats {
  display: flex;
  align-items: center;
  gap: 18px;
  opacity: 0;
  animation: rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.85s forwards;
}

.stat { display: flex; flex-direction: column; gap: 2px; }
.stat-val   { font-size: 16px; font-weight: 700; color: var(--c-ice); letter-spacing: -0.02em; }
.stat-label { font-size: 11px; color: var(--c-dim); text-transform: uppercase; letter-spacing: 0.1em; }
.stat-div   { width: 1px; height: 32px; background: var(--c-border); }

/* ── Hero right side: terminal + floaters ──────────────── */
.hero-right {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floater {
  position: absolute;
  background: rgba(8,24,40,0.7);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 10px 14px;
  font-family: var(--ff-mono);
  font-size: 11px;
  color: var(--c-muted);
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.4);
  z-index: 1;
  opacity: 0;
  animation: float-in 0.8s ease-out forwards;
}

.floater-a {
  top: -12%;
  left: -8%;
  animation-delay: 1.2s;
  animation-name: float-in, float-a;
  animation-duration: 0.8s, 8s;
  animation-iteration-count: 1, infinite;
  animation-timing-function: ease-out, ease-in-out;
  animation-fill-mode: forwards, none;
  animation-delay: 1.2s, 2s;
}

.floater-b {
  bottom: -8%;
  right: -10%;
  animation-delay: 1.5s;
  animation-name: float-in, float-b;
  animation-duration: 0.8s, 10s;
  animation-iteration-count: 1, infinite;
  animation-timing-function: ease-out, ease-in-out;
  animation-fill-mode: forwards, none;
  animation-delay: 1.5s, 2.3s;
}

@keyframes float-in {
  to { opacity: 1; }
}

@keyframes float-a {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(-10px, -8px); }
}

@keyframes float-b {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(8px, -12px); }
}

.floater-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--c-dim);
  margin-bottom: 6px;
}

.floater-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--c-cyan);
  box-shadow: 0 0 6px var(--c-cyan);
}

.floater-dot-purple {
  background: var(--c-purple);
  box-shadow: 0 0 6px var(--c-purple);
}

.floater-body {
  color: var(--c-ice);
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.6;
}

/* ── Terminal ────────────────────────────────────────────── */
.terminal {
  background: linear-gradient(180deg, #020a14 0%, #010815 100%);
  border: 1px solid var(--c-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 32px 80px rgba(0,0,0,0.65),
    0 0 0 1px rgba(0,212,255,0.06),
    inset 0 1px 0 rgba(255,255,255,0.04);
  position: relative;
  z-index: 2;
}

.terminal-hero {
  width: 100%;
  max-width: 540px;
}

.terminal-large .terminal-body { min-height: 360px; }

.terminal-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 14px;
  background: #030d18;
  border-bottom: 1px solid var(--c-border);
}

.tb { width: 11px; height: 11px; border-radius: 50%; }
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
  padding: 22px;
  font-family: var(--ff-mono);
  font-size: 12.5px;
  line-height: 1.85;
  min-height: 280px;
}

.t-line { white-space: pre; }
.t-cmd   { color: var(--c-ice); }
.t-ok    { color: var(--c-emerald); }
.t-info  { color: var(--c-cyan); }
.t-muted { color: var(--c-dim); }
.t-box   { color: var(--c-cyan); font-weight: 500; }
.t-gap   { height: 8px; }

.t-cursor {
  display: inline-block;
  color: var(--c-cyan);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}

/* ── Mental model bar ────────────────────────────────────── */
.mental-model {
  border-top: 1px solid var(--c-border);
  background: rgba(8, 24, 40, 0.6);
  backdrop-filter: blur(12px);
  position: relative;
  z-index: 3;
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
  letter-spacing: 0.14em;
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
  padding: 4px 10px;
  border-radius: 5px;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.mm-node:hover {
  color: var(--c-cyan);
  border-color: rgba(0,212,255,0.25);
  background: rgba(0,212,255,0.06);
}

.mm-arrow { color: var(--c-border); display: inline-flex; align-items: center; }

/* ── Pillars ─────────────────────────────────────────────── */
.pillars-section { background: var(--c-abyss); }

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.pillar-card {
  position: relative;
  padding: 36px 32px;
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--c-deep) 0%, var(--c-abyss) 100%);
  overflow: hidden;
  transition: transform 0.3s, border-color 0.3s;
}

.pillar-card:hover {
  transform: translateY(-4px);
  border-color: rgba(0,212,255,0.3);
}

.pillar-edge {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--c-cyan), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.pillar-card:hover .pillar-edge { opacity: 1; }

.pillar-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
}

.pillar-icon {
  display: inline-flex;
  width: 36px; height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--c-border);
  background: rgba(0,212,255,0.05);
  color: var(--c-cyan);
}

.pillar-label {
  font-family: var(--ff-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--c-cyan);
}

.pillar-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
  color: var(--c-ice);
  margin-bottom: 14px;
  white-space: pre-line;
}

.pillar-desc {
  font-size: 14px;
  color: var(--c-muted);
  line-height: 1.65;
}

/* ── Comparison ──────────────────────────────────────────── */
.comparison-section { background: var(--c-deep); }

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0;
  align-items: start;
  margin-bottom: 36px;
}

.code-card {
  border: 1px solid var(--c-border);
  border-radius: 12px;
  overflow: hidden;
  background: #020a14;
  box-shadow: 0 16px 40px rgba(0,0,0,0.3);
}

.code-card-active {
  border-color: rgba(0,212,255,0.3);
  box-shadow: 0 0 60px rgba(0,212,255,0.08), 0 16px 40px rgba(0,0,0,0.3);
}

.code-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: var(--c-deep);
  border-bottom: 1px solid var(--c-border);
}

.lang-badge {
  font-family: var(--ff-mono);
  font-size: 10px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 4px;
  letter-spacing: 0.06em;
}

.lang-php { background: rgba(120,80,200,0.15); color: var(--c-purple); border: 1px solid rgba(120,80,200,0.25); }
.lang-ts  { background: rgba(0,212,255,0.08);  color: var(--c-cyan);   border: 1px solid rgba(0,212,255,0.2); }

.card-glow-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--c-cyan);
  box-shadow: 0 0 8px var(--c-cyan);
  animation: pulse 2s ease-in-out infinite;
}

.comparison-vs {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px;
  gap: 8px;
  padding-top: 90px;
}

.vs-line { flex: 1; width: 1px; background: var(--c-border); min-height: 50px; }
.vs-text {
  font-size: 18px;
  color: var(--c-cyan);
  font-weight: 700;
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(0,212,255,0.3);
  background: rgba(0,212,255,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}

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

.callout-icon { color: var(--c-emerald); font-weight: 700; }
.callout code { font-family: var(--ff-mono); font-size: 11px; color: var(--c-teal); }

/* ── Code blocks (shared) ────────────────────────────────── */
.code-block, .feature-code, .flow-code, .ai-code {
  margin: 0;
  padding: 22px;
  font-family: var(--ff-mono);
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--c-ice);
  overflow-x: auto;
  background: transparent;
}

.code-block code, .feature-code code, .flow-code code, .ai-code code {
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
:deep(.hl-d)  { color: var(--c-purple); }
:deep(.hl-v)  { color: #fb923c; }

/* ── Flow showcase ───────────────────────────────────────── */
.flow-section { background: var(--c-navy); }

.flow-showcase {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  overflow: hidden;
  background: #020a14;
  box-shadow: 0 24px 64px rgba(0,0,0,0.4);
}

.flow-tabs {
  display: flex;
  border-bottom: 1px solid var(--c-border);
  background: var(--c-deep);
}

.flow-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  font-family: var(--ff-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--c-dim);
  background: transparent;
  border: none;
  border-right: 1px solid var(--c-border);
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.flow-tab:last-child { border-right: none; }

.tab-num {
  font-family: var(--ff-mono);
  font-size: 10px;
  color: var(--c-dim);
  letter-spacing: 0.05em;
}

.flow-tab:hover { color: var(--c-muted); background: rgba(0,212,255,0.03); }
.flow-tab:hover .tab-num { color: var(--c-teal); }

.flow-tab.active {
  color: var(--c-cyan);
  background: rgba(0,212,255,0.06);
}

.flow-tab.active .tab-num { color: var(--c-cyan); }

.flow-tab.active::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: -1px;
  height: 2px;
  background: var(--c-cyan);
  box-shadow: 0 0 12px var(--c-cyan);
}

.flow-file-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 22px;
  border-bottom: 1px solid var(--c-border);
  font-family: var(--ff-mono);
  font-size: 11px;
  color: var(--c-dim);
  background: var(--c-navy);
}

.flow-code { min-height: 320px; font-size: 13px; padding: 26px; }

/* ── AI section ──────────────────────────────────────────── */
.ai-section {
  background: var(--c-abyss);
  position: relative;
  overflow: hidden;
}

.ai-glow {
  position: absolute;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  width: 1000px;
  height: 600px;
  background: radial-gradient(ellipse at center, rgba(192,132,252,0.08) 0%, transparent 60%);
  pointer-events: none;
}

.ai-accent {
  background: linear-gradient(120deg, var(--c-purple), #f9a8d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.ai-showcase {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 20px;
  margin-bottom: 48px;
  position: relative;
  z-index: 1;
}

.ai-code-card, .ai-stream-card {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  overflow: hidden;
  background: #020a14;
  box-shadow: 0 24px 64px rgba(0,0,0,0.4);
}

.ai-stream-card {
  border-color: rgba(192,132,252,0.25);
  box-shadow: 0 0 60px rgba(192,132,252,0.08), 0 24px 64px rgba(0,0,0,0.4);
}

.ai-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: var(--c-deep);
  border-bottom: 1px solid var(--c-border);
}

.ai-tag {
  font-family: var(--ff-mono);
  font-size: 10px;
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(192,132,252,0.1);
  color: var(--c-purple);
  border: 1px solid rgba(192,132,252,0.2);
  letter-spacing: 0.05em;
}

.ai-tag-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ai-pulse {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--c-purple);
  box-shadow: 0 0 8px var(--c-purple);
  animation: pulse 1.5s ease-in-out infinite;
}

.ai-file {
  font-family: var(--ff-mono);
  font-size: 11px;
  color: var(--c-dim);
}

.ai-replay {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--ff-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 4px 10px;
  background: transparent;
  color: var(--c-teal);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-replay:hover:not(:disabled) {
  color: var(--c-cyan);
  border-color: var(--c-cyan);
}

.ai-replay:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ai-stream-body {
  padding: 22px;
  font-family: var(--ff-mono);
  font-size: 12px;
  line-height: 1.85;
}

.ai-line { white-space: pre-wrap; }
.ai-line-flex {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: normal;
}
.ai-line-indent { padding-left: 18px; }
.ai-line-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}
.ai-line-text { flex: 1; min-width: 0; }
.ai-cmd       { color: var(--c-ice); }
.ai-thinking  { color: var(--c-purple); font-style: italic; }
.ai-tool      { color: var(--c-amber); }
.ai-auth      { color: var(--c-emerald); font-size: 11px; }
.ai-return    { color: var(--c-teal); font-size: 11px; }
.ai-stream    { color: var(--c-cyan); }
.ai-token     { color: var(--c-ice); }
.ai-output    { color: var(--c-purple); }
.ai-json      { color: #a8d8a8; font-size: 11px; }
.ai-gap       { height: 8px; }

.ai-features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  position: relative;
  z-index: 1;
}

.ai-feat {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: rgba(8,24,40,0.4);
  backdrop-filter: blur(8px);
  transition: border-color 0.2s;
}

.ai-feat:hover { border-color: rgba(192,132,252,0.3); }

.ai-feat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid rgba(192,132,252,0.25);
  background: rgba(192,132,252,0.08);
  color: var(--c-purple);
}
.ai-feat-title { font-size: 14px; font-weight: 600; color: var(--c-ice); margin-bottom: 4px; }
.ai-feat-desc  { font-size: 12px; color: var(--c-muted); line-height: 1.5; }

/* ── Feature grid ────────────────────────────────────────── */
.features-section { background: var(--c-deep); }

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.feature-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(180deg, var(--c-deep) 0%, #020a14 100%);
  transition: border-color 0.2s, transform 0.2s;
  position: relative;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0; left: 50%; transform: translateX(-50%);
  width: 60%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--c-cyan), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.feature-card:hover {
  border-color: rgba(0,212,255,0.25);
  transform: translateY(-2px);
}

.feature-card:hover::before { opacity: 0.6; }

.feature-top {
  padding: 24px 24px 16px;
  flex: 1;
}

.feature-icon {
  display: inline-flex;
  width: 36px; height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--c-border);
  background: rgba(0,212,255,0.05);
  color: var(--c-cyan);
  margin-bottom: 14px;
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
  padding: 18px 22px;
}

/* ── Runtime section ─────────────────────────────────────── */
.runtime-section { background: var(--c-abyss); }

.runtime-showcase {
  border: 1px solid var(--c-border);
  border-radius: 14px;
  overflow: hidden;
  background: #020a14;
  box-shadow: 0 24px 64px rgba(0,0,0,0.4);
}

.runtime-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid var(--c-border);
  background: var(--c-deep);
}

.runtime-tab {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  font-family: var(--ff-sans);
  color: var(--c-muted);
  background: transparent;
  border: none;
  border-right: 1px solid var(--c-border);
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  position: relative;
}

.runtime-tab:last-child { border-right: none; }

.rt-icon {
  font-family: var(--ff-mono);
  font-size: 18px;
  font-weight: 700;
  width: 32px; height: 32px;
  border-radius: 6px;
  border: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-teal);
  background: rgba(0,212,255,0.04);
}

.rt-meta { display: flex; flex-direction: column; gap: 2px; }
.rt-label { font-size: 13px; font-weight: 600; color: inherit; }
.rt-tag {
  font-family: var(--ff-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--c-dim);
}

.runtime-tab:hover {
  background: rgba(0,212,255,0.04);
  color: var(--c-ice);
}

.runtime-tab.active {
  background: rgba(0,212,255,0.08);
  color: var(--c-ice);
}

.runtime-tab.active .rt-icon {
  color: var(--c-cyan);
  border-color: rgba(0,212,255,0.4);
  background: rgba(0,212,255,0.08);
  box-shadow: 0 0 16px rgba(0,212,255,0.2);
}

.runtime-tab.active::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: -1px;
  height: 2px;
  background: var(--c-cyan);
  box-shadow: 0 0 12px var(--c-cyan);
}

.rt-badge {
  margin-left: auto;
  font-family: var(--ff-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--c-cyan);
  padding: 3px 8px;
  border: 1px solid rgba(0,212,255,0.2);
  border-radius: 4px;
  background: rgba(0,212,255,0.05);
}

/* ── CLI section ─────────────────────────────────────────── */
.cli-section { background: var(--c-deep); }

.cli-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: start;
}

.cli-title { text-align: left; margin-bottom: 16px; }
.cli-sub { text-align: left; margin: 0; max-width: none; }

.cli-commands {
  margin-top: 36px;
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.cli-group-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--c-dim);
  margin-bottom: 10px;
}

.cli-cmd {
  font-family: var(--ff-mono);
  font-size: 12.5px;
  color: var(--c-muted);
  padding: 3px 0;
  transition: color 0.15s;
}

.cli-cmd:hover { color: var(--c-ice); }

.cmd-prefix {
  color: var(--c-teal);
  margin-right: 4px;
}

/* ── Ecosystem ───────────────────────────────────────────── */
.ecosystem-section { background: var(--c-navy); }

.eco-groups {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.eco-group {
  padding: 22px;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--c-deep) 0%, #020a14 100%);
  transition: border-color 0.2s, transform 0.2s;
}

.eco-group:hover {
  border-color: rgba(0,212,255,0.25);
  transform: translateY(-2px);
}

.eco-purple {
  border-color: rgba(192,132,252,0.25);
  background: linear-gradient(180deg, rgba(192,132,252,0.05) 0%, #020a14 100%);
}

.eco-purple:hover { border-color: rgba(192,132,252,0.4); }

.eco-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--c-border);
}

.eco-group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(0,212,255,0.2);
  background: rgba(0,212,255,0.06);
  color: var(--c-cyan);
}

.eco-purple .eco-group-icon {
  color: var(--c-purple);
  border-color: rgba(192,132,252,0.25);
  background: rgba(192,132,252,0.08);
}

.eco-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ice);
}

.eco-group-count {
  margin-left: auto;
  font-family: var(--ff-mono);
  font-size: 10px;
  color: var(--c-dim);
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(13,42,69,0.4);
}

.eco-pkg-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.eco-pkg {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.eco-pkg-name {
  font-family: var(--ff-mono);
  font-size: 11.5px;
  color: var(--c-teal);
}

.eco-purple .eco-pkg-name { color: var(--c-purple); }

.eco-pkg-desc {
  font-size: 11.5px;
  color: var(--c-dim);
  line-height: 1.4;
}

/* ── CTA ─────────────────────────────────────────────────── */
.cta-section {
  position: relative;
  padding: 130px 0;
  overflow: hidden;
  background: var(--c-deep);
  border-top: 1px solid var(--c-border);
  border-bottom: 1px solid var(--c-border);
}

.cta-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--c-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--c-border) 1px, transparent 1px);
  background-size: 56px 56px;
  opacity: 0.2;
  pointer-events: none;
  mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent 80%);
}

.cta-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 800px;
  height: 400px;
  background: radial-gradient(ellipse at center, rgba(0,212,255,0.1) 0%, transparent 60%);
  pointer-events: none;
}

.cta-inner {
  position: relative;
  text-align: center;
  z-index: 1;
}

.cta-headline {
  font-size: clamp(36px, 5.5vw, 60px);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.1;
  margin-top: 16px;
  margin-bottom: 16px;
  color: var(--c-ice);
}

.cta-sub {
  font-size: 17px;
  color: var(--c-muted);
  margin: 0 auto 40px;
  max-width: 460px;
}

.cta-terminal {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 16px 24px;
  background: #020a14;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  font-family: var(--ff-mono);
  font-size: 14px;
  margin-bottom: 40px;
  box-shadow: 0 0 60px rgba(0,212,255,0.1);
}

.cta-prompt { color: var(--c-teal); }
.cta-cmd    { color: var(--c-ice); }

.cta-copy {
  background: transparent;
  color: var(--c-dim);
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.cta-copy:hover { color: var(--c-cyan); }

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
  padding: 28px 0;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-copy { font-size: 12px; color: var(--c-dim); font-family: var(--ff-mono); }

.footer-links { display: flex; gap: 24px; }

.footer-links a {
  font-size: 12px;
  color: var(--c-dim);
  text-decoration: none;
  transition: color 0.15s;
  font-family: var(--ff-mono);
}

.footer-links a:hover { color: var(--c-cyan); }

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 1100px) {
  .feature-grid { grid-template-columns: repeat(2, 1fr); }
  .eco-groups   { grid-template-columns: repeat(3, 1fr); }
  .pillars-grid { grid-template-columns: 1fr; }
  .ai-features  { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 900px) {
  .hero-layout       { grid-template-columns: 1fr; padding-top: 56px; padding-bottom: 0; gap: 48px; }
  .hero-sub          { max-width: 100%; }
  .floater           { display: none; }
  .comparison-grid   { grid-template-columns: 1fr; }
  .comparison-vs     { flex-direction: row; padding: 16px 0; }
  .vs-line           { min-height: 0; min-width: 40px; height: 1px; flex: none; }
  .feature-grid      { grid-template-columns: 1fr; }
  .cli-layout        { grid-template-columns: 1fr; }
  .eco-groups        { grid-template-columns: repeat(2, 1fr); }
  .ai-showcase       { grid-template-columns: 1fr; }
  .runtime-tabs      { grid-template-columns: repeat(2, 1fr); }
  .runtime-tab:nth-child(2) { border-right: none; }
  .runtime-tab:nth-child(1), .runtime-tab:nth-child(2) { border-bottom: 1px solid var(--c-border); }
  .flow-tabs         { overflow-x: auto; }
}

@media (max-width: 600px) {
  .container         { padding: 0 20px; }
  .section           { padding: 72px 0; }
  .eco-groups        { grid-template-columns: 1fr; }
  .ai-features       { grid-template-columns: 1fr; }
  .mental-inner      { flex-direction: column; align-items: flex-start; gap: 10px; }
  .hero-stats        { gap: 14px; }
  .stat-val          { font-size: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>

<!-- ── Light mode overrides (non-scoped so html selector works) ── -->
<style>
html:not(.dark) .landing {
  --c-abyss:  #f0f7fc;
  --c-deep:   #e6f0f8;
  --c-navy:   #dceaf5;
  --c-mid:    #cce0ee;
  --c-border: #a8cee0;
  --c-cyan:   #0090b8;
  --c-teal:   #006d8f;
  --c-purple: #8b3fc7;
  --c-amber:  #b87a00;
  --c-emerald: #047857;
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
  background: radial-gradient(ellipse at center, rgba(0,144,184,0.12) 0%, transparent 65%);
}

html:not(.dark) .landing .hero-orb-a {
  background: rgba(0,144,184,0.15);
}

html:not(.dark) .landing .hero-orb-b {
  background: rgba(139,63,199,0.1);
}

/* Mental model bar */
html:not(.dark) .landing .mental-model {
  background: rgba(220, 234, 245, 0.85);
}

/* Hardcoded dark bg overrides */
html:not(.dark) .landing .code-card         { background: #ffffff; }
html:not(.dark) .landing .code-card-active  { box-shadow: 0 0 32px rgba(0,144,184,0.1); }
html:not(.dark) .landing .flow-showcase     { background: #ffffff; }
html:not(.dark) .landing .flow-file-bar     { background: var(--c-navy); }
html:not(.dark) .landing .feature-card      { background: #ffffff; }
html:not(.dark) .landing .feature-code      { background: #f0f8fd; }
html:not(.dark) .landing .pillar-card       { background: #ffffff; }
html:not(.dark) .landing .ai-code-card      { background: #ffffff; }
html:not(.dark) .landing .ai-stream-card    { background: #ffffff; }
html:not(.dark) .landing .runtime-showcase  { background: #ffffff; }
html:not(.dark) .landing .eco-group         { background: #ffffff; }
html:not(.dark) .landing .eco-purple        { background: linear-gradient(180deg, rgba(139,63,199,0.05), #ffffff); }
html:not(.dark) .landing .cta-terminal      { background: #ffffff; }

/* Floater */
html:not(.dark) .landing .floater { background: rgba(255,255,255,0.85); }

/* Button ghost */
html:not(.dark) .landing .btn-ghost {
  color: var(--c-teal);
  border-color: var(--c-border);
  background: rgba(255,255,255,0.5);
}
html:not(.dark) .landing .btn-ghost:hover {
  border-color: var(--c-cyan);
  color: var(--c-cyan);
  background: rgba(0,144,184,0.05);
}

/* Callout pills */
html:not(.dark) .landing .callout {
  background: var(--c-deep);
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
}

/* Runtime tabs */
html:not(.dark) .landing .runtime-tab.active {
  background: rgba(0,144,184,0.08);
}

/* Syntax highlight — adjusted for light backgrounds */
html:not(.dark) .landing .hl-k  { color: #0055c0; }
html:not(.dark) .landing .hl-s  { color: #1a6b1a; }
html:not(.dark) .landing .hl-cm { color: #5a8a9f; font-style: italic; }
html:not(.dark) .landing .hl-t  { color: #7a5a00; }
html:not(.dark) .landing .hl-d  { color: var(--c-purple); }
html:not(.dark) .landing .hl-v  { color: #b84500; }

/* Terminals always stay dark — override any light-mode bleed */
html:not(.dark) .landing .terminal         { background: linear-gradient(180deg, #020a14 0%, #010815 100%); }
html:not(.dark) .landing .terminal-bar     { background: #030d18; border-color: #0d2a45; }
html:not(.dark) .landing .terminal-body    { color: #deedf5; }
html:not(.dark) .landing .terminal .t-cmd            { color: #deedf5; }
html:not(.dark) .landing .terminal .t-ok             { color: #4ade80; }
html:not(.dark) .landing .terminal .t-info           { color: #00d4ff; }
html:not(.dark) .landing .terminal .t-muted          { color: #2a5a70; }
html:not(.dark) .landing .terminal .t-box            { color: #00d4ff; }
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
html:not(.dark) .landing .cta-glow {
  background: radial-gradient(ellipse at center, rgba(0,144,184,0.12), transparent 60%);
}

/* AI section in light mode */
html:not(.dark) .landing .ai-glow {
  background: radial-gradient(ellipse at center, rgba(139,63,199,0.1), transparent 60%);
}

html:not(.dark) .landing .ai-tag {
  background: rgba(139,63,199,0.1);
  color: var(--c-purple);
  border-color: rgba(139,63,199,0.25);
}

html:not(.dark) .landing .ai-stream-card {
  border-color: rgba(139,63,199,0.3);
  box-shadow: 0 0 60px rgba(139,63,199,0.08);
}

html:not(.dark) .landing .ai-feat {
  background: rgba(255,255,255,0.6);
}

/* Eco purple */
html:not(.dark) .landing .eco-purple {
  border-color: rgba(139,63,199,0.3);
}
</style>
