export interface KnowledgeSection {
  title: string;
  keywords: string[];
  content: string;
}

export const knowledge: KnowledgeSection[] = [
  {
    title: 'FaberJS Overview',
    keywords: [
      'overview',
      'intro',
      'what',
      'faberjs',
      'framework',
      'laravel',
      'node',
      'typescript',
    ],
    content: `
FaberJS is a full-featured, opinionated Node.js/TypeScript backend framework that mirrors the Laravel developer experience. It targets Laravel developers moving to Node.js who want a unified framework with conventions, a CLI (faber), routing, ORM, queues, events, and DI — all in one package.

All packages are published under the @faber-js/ npm scope. The CLI binary is "faber" (Artisan equivalent). v1.0 is shipped and stable.

Core philosophy: Convention over configuration. Zero mental translation from Laravel. Route → Controller → Service → Model → Job/Event.

Tech stack: Node.js >= 20, TypeScript 5.x strict, Fastify v5 (hidden), Knex (hidden), BullMQ, JWT via jose, pnpm workspaces.

IMPORTANT: Fastify and Knex are implementation details — never import from them directly. All user code goes through @faber-js/* packages.
`.trim(),
  },

  {
    title: 'Project Structure',
    keywords: ['structure', 'directory', 'folders', 'layout', 'project', 'files'],
    content: `
Standard FaberJS project layout:

  app/
    controllers/    HTTP controllers (extend Controller)
    models/         ORM models (extend Model)
    services/       Business logic (extend Service)
    jobs/           Queue jobs (extend Job)
    events/         Event classes
    listeners/      Event listeners
    policies/       Authorization policies
    providers/      Service providers
    commands/       Custom CLI commands
  bootstrap/
    app.ts          Application bootstrap — registers providers, loads routes
  config/
    app.ts          App config
    database.ts     Database connection config
  database/
    migrations/     Migration files
    seeders/        Seeder files
  routes/
    api.ts          Route definitions
  storage/
    logs/
    cache/
  tests/
    Feature/
    Unit/
  .env              Environment variables
  faber.config.ts   Framework config (name, port)

Entry point: bootstrap/app.ts. The app boots providers, loads routes, then starts the HTTP server.
`.trim(),
  },

  {
    title: 'Routing — @faber-js/router',
    keywords: [
      'route',
      'routing',
      'router',
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'group',
      'resource',
      'middleware',
      'prefix',
      'redirect',
      'fallback',
      'domain',
      'where',
      'pattern',
      'singleton',
      'match',
      'any',
      'spoofing',
      'method spoofing',
      'route cache',
      'signed url',
    ],
    content: `
Import: import { Route } from '@faber-js/router';

Basic routes:
  Route.get('/path', [Controller, 'method']);
  Route.post('/path', [Controller, 'method']);
  Route.put('/path/:id', [Controller, 'method']);
  Route.patch('/path/:id', [Controller, 'method']);
  Route.delete('/path/:id', [Controller, 'method']);
  Route.options('/path', [Controller, 'method']);
  Route.match(['GET', 'POST'], '/path', [Controller, 'method']);
  Route.any('/path', [Controller, 'method']);

Route with inline handler:
  Route.get('/health', () => Promise.resolve(Response.json({ status: 'ok' })));

Route parameters — colon and brace syntax are both valid:
  Route.get('/users/:id', [UserController, 'show']);
  Route.get('/users/{id}', [UserController, 'show']);   // same thing

Optional parameter:
  Route.get('/posts/{slug?}', [PostController, 'index']);

Pattern constraints:
  Route.get('/users/{id}', [UserController, 'show']).where('id', '[0-9]+');
  Router.pattern('id', '[0-9]+');  // global pattern for all routes

Redirect routes:
  Route.redirect('/old', '/new');             // 302
  Route.permanentRedirect('/old', '/new');    // 301
  Route.redirect('/old', '/new', 307);        // custom status

Fallback route (catches all unmatched requests):
  Route.fallback((_req) => Promise.resolve(Response.json({ message: 'Not Found' }, 404)));

Route groups (prefix + middleware):
  Route.group({ prefix: '/api/v1', middleware: ['auth'] }, () => {
    Route.get('/users', [UserController, 'index']);
    Route.post('/users', [UserController, 'store']);
  });

Domain routing — domain params are merged into route params:
  Route.group({ domain: '{account}.example.com' }, () => {
    Route.get('/dashboard', [DashController, 'index']);
  });

Resource routes (generates 7 CRUD routes):
  Route.resource('posts', PostController);
  // GET /posts         → index
  // GET /posts/create  → create
  // POST /posts        → store
  // GET /posts/:post   → show
  // GET /posts/:post/edit → edit
  // PUT /posts/:post   → update
  // DELETE /posts/:post → destroy

  Route.resource('photos', PhotoController, { only: ['index', 'show'] });
  Route.resource('comments', CommentController, { except: ['create', 'edit'] });

Singleton resource (one-per-parent, e.g. profile):
  Route.singleton('profile', ProfileController);
  // GET /profile       → show
  // GET /profile/edit  → edit
  // PUT /profile       → update

Named routes:
  Route.get('/users', [UserController, 'index']).name('users.index');

Signed URLs:
  import { URL } from '@faber-js/router';
  const link = URL.signedRoute('users.show', { id: 42 });
  const temp = URL.temporarySignedRoute('invite', 3600, { token: 'abc' });

Route model binding (implicit):
  Route.get('/users/{user}', [UserController, 'show']);
  // FaberJS auto-fetches User by primary key — injects null → 404

  Route.get('/posts/{post}', [PostController, 'show'])
    .missing((_req) => Promise.resolve(Response.json({ error: 'not found' }, 404)));

Explicit binding:
  Route.model('user', User);            // by primary key
  Route.model('post', Post, 'slug');    // by column
  Route.bind('order', async (value) => Order.where('uuid', value).first());

Route parameter are accessed in controllers via req.route('paramName').

Routes are defined in routes/api.ts and loaded in bootstrap/app.ts after app.boot().

Route cache CLI:
  npx faber route:cache   — serialize routes to bootstrap/cache/routes.json
  npx faber route:clear   — delete the cache file
`.trim(),
  },

  {
    title: 'Route Model Binding — @faber-js/router + @faber-js/orm',
    keywords: [
      'model binding',
      'route binding',
      'implicit binding',
      'explicit binding',
      'resolveRouteBinding',
      'Route.model',
      'Route.bind',
      'missing handler',
      '404 model',
      'inject model',
    ],
    content: `
Route model binding automatically resolves ORM model instances from route parameters.

IMPLICIT BINDING — any ORM Model whose class name (lcFirst) matches a route param is auto-fetched:
  Route.get('/users/{user}', [UserController, 'show']);

  // UserController.ts — user is auto-injected (404 if not found)
  async show(_req: Request, user: User): Promise<Response> {
    return this.json({ data: user });
  }

Requirements for implicit binding:
  - Route param name must equal lcFirst(ClassName) — e.g. {user} → User, {blogPost} → BlogPost
  - The class must have a static resolveRouteBinding(value, field?) method
  - All @faber-js/orm Models have this by default; custom classes can add it

Custom missing handler (per-route):
  Route.get('/posts/{post}', [PostController, 'show'])
    .missing((_req) => Promise.resolve(Response.json({ error: 'not found' }, 404)));

EXPLICIT BINDING — registered globally via Route.model() or Route.bind():

  Route.model('user', User);              // resolves by primary key
  Route.model('post', Post, 'slug');      // resolves by slug column

  Route.bind('order', async (value, _req) => {
    return Order.where('uuid', value).first();
  });

Explicit bindings override implicit ones. Register them in routes/api.ts or a service provider.

IMPORTANT: Implicit binding uses design:paramtypes from reflect-metadata — controllers must be decorated with @Injectable() and TypeScript must have emitDecoratorMetadata enabled.
`.trim(),
  },

  {
    title: 'Built-in HTTP Middleware — @faber-js/http',
    keywords: [
      'cors',
      'handle cors',
      'cross origin',
      'method spoofing',
      'form method',
      '_method',
      'throttle',
      'rate limit',
      'too many requests',
      '429',
      'built-in middleware',
    ],
    content: `
@faber-js/http ships three production-ready middleware classes.

--- HandleCors ---
Import: import { HandleCors } from '@faber-js/http';

Handles CORS headers and pre-flight OPTIONS requests.

Usage (global — runs before routing):
  kernel.use(new HandleCors());

With options:
  kernel.use(new HandleCors({
    origin: ['https://app.example.com'],  // allow specific origins (omit for wildcard)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    headers: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }));

For pre-flight requests (OPTIONS), HandleCors returns a 204 No Content immediately.
For regular requests, it appends CORS headers to the existing response.

--- MethodSpoofing ---
Import: import { MethodSpoofing } from '@faber-js/http';

Lets HTML forms (POST-only) tunnel PUT, PATCH, DELETE via a _method hidden field.

Usage (global middleware):
  kernel.use(new MethodSpoofing());

HTML form example:
  <input type="hidden" name="_method" value="PUT" />

  After middleware runs:
  request.method()      → 'PUT'   (spoofed)
  request.realMethod()  → 'POST'  (original)

Supported spoof values: PUT, PATCH, DELETE (other values are ignored).

--- ThrottleRequests ---
Import: import { ThrottleRequests, TooManyRequestsException } from '@faber-js/http';

Rate-limits requests per IP. Requires a RateLimiterInterface-compatible backend:
  import { RateLimiter } from '@faber-js/cache';
  const limiter = new RateLimiter(cacheStore);
  kernel.alias('throttle', new ThrottleRequests(limiter));

Route usage:
  .middleware(['throttle'])           // 60 requests / 60 seconds (default)
  .middleware(['throttle:10,30'])     // 10 requests / 30 seconds

Throws TooManyRequestsException (HTTP 429) with retryAfter property when limit exceeded.

RateLimiterInterface (duck-typed — no cache package dependency):
  interface RateLimiterInterface {
    tooManyAttempts(key: string, maxAttempts: number): Promise<boolean>;
    increment(key: string, decaySeconds?: number): Promise<number>;
    availableIn(key: string): Promise<number>;
    clear(key: string): Promise<void>;
  }
`.trim(),
  },

  {
    title: 'Controllers — @faber-js/router',
    keywords: ['controller', 'controllers', 'handler', 'json', 'response', 'request', 'inject'],
    content: `
Import: import { Controller } from '@faber-js/router';
        import type { Request } from '@faber-js/http';
        import { Response } from '@faber-js/http';
        import { Injectable } from '@faber-js/core';

Controllers extend Controller and must be decorated with @Injectable():

  @Injectable()
  export class PostController extends Controller {
    constructor(private readonly postService: PostService) {
      super();
    }

    async index(req: Request): Promise<Response> {
      const posts = await this.postService.all();
      return this.json({ data: posts });
    }

    async store(req: Request): Promise<Response> {
      const post = await this.postService.create(req.validated());
      return this.json({ data: post }, 201);
    }

    async show(req: Request): Promise<Response> {
      const post = await this.postService.find(Number(req.route('id')));
      return this.json({ data: post });
    }

    async update(req: Request): Promise<Response> {
      const post = await this.postService.update(Number(req.route('id')), req.validated());
      return this.json({ data: post });
    }

    async destroy(req: Request): Promise<Response> {
      await this.postService.delete(Number(req.route('id')));
      return this.noContent();
    }
  }

Controller helper methods:
  this.json(data, statusCode?)   — returns JSON response (default 200)
  this.noContent()               — returns 204 No Content
  this.authorize(ability, model) — throws 403 if policy denies

NEVER use @Injectable manually on services/models that extend base classes — it's automatic.
Wait — controllers DO need @Injectable() because the DI container resolves them.
`.trim(),
  },

  {
    title: 'Services — @faber-js/core',
    keywords: ['service', 'services', 'business logic', 'injectable', 'dependency injection', 'di'],
    content: `
Import: import { Injectable, Service } from '@faber-js/core';

Services extend Service and hold business logic. They are injected into controllers via constructor injection.

  @Injectable()
  export class PostService extends Service {
    async all(): Promise<Post[]> {
      return Post.all<Post>();
    }

    async find(id: number): Promise<Post | null> {
      return Post.find<Post>(id);
    }

    async create(data: Record<string, unknown>): Promise<Post> {
      const post = await Post.create<Post>(data as any);
      await event(new PostCreated(post));
      await dispatch(new NotifyFollowers(post));
      return post;
    }

    async update(id: number, data: Record<string, unknown>): Promise<Post | null> {
      const post = await Post.find<Post>(id);
      if (!post) return null;
      await post.update(data as any);
      return post;
    }

    async delete(id: number): Promise<void> {
      const post = await Post.find<Post>(id);
      if (post) await post.delete();
    }
  }

Services are auto-wired by the IoC container. No manual registration needed.
Generate: npx faber make:service PostService
`.trim(),
  },

  {
    title: 'ORM Models — @faber-js/orm',
    keywords: [
      'model',
      'models',
      'orm',
      'database',
      'query',
      'eloquent',
      'active record',
      'where',
      'find',
      'all',
      'create',
      'update',
      'delete',
    ],
    content: `
Import: import { Model } from '@faber-js/orm';

Models extend Model and map to database tables:

  export class Post extends Model {
    static table = 'posts';
    static fillable = ['title', 'body', 'author_id', 'published'];
    static hidden = [];    // fields excluded from JSON serialization

    // Relationships
    author() {
      return this.belongsTo(User, 'author_id');
    }

    comments() {
      return this.hasMany(Comment, 'post_id');
    }

    tags() {
      return this.belongsToMany(Tag, 'post_tags', 'post_id', 'tag_id');
    }

    // Query scopes — called as Post.published()
    scopePublished(query: any) {
      return query.where('published', true).orderBy('created_at', 'desc');
    }
  }

Static query methods:
  Post.all<Post>()                          — all records
  Post.find<Post>(id)                       — find by primary key (returns null if not found)
  Post.findOrFail<Post>(id)                 — find or throw 404
  Post.where('column', value)               — start a query
  Post.where('column', 'operator', value)   — with operator (>, <, >=, <=, !=, like)
  Post.orderBy('created_at', 'desc')
  Post.limit(n)
  Post.offset(n)
  Post.with('author', 'tags')               — eager load relationships
  Post.paginate(page, perPage)              — returns { data, total, page, perPage, lastPage }
  Post.count()
  Post.create<Post>(data)                   — insert and return instance

Instance methods:
  post.update({ title: 'New Title' })       — update attributes
  post.delete()                             — delete record
  post.author                               — loaded relation (after .with())

NEVER import from knex directly. All queries go through the Model API.
Generate: npx faber make:model Post -m   (creates model + migration)
`.trim(),
  },

  {
    title: 'Migrations — @faber-js/orm',
    keywords: [
      'migration',
      'migrations',
      'schema',
      'table',
      'column',
      'database schema',
      'up',
      'down',
    ],
    content: `
Import: import { Migration, Schema } from '@faber-js/orm';

Migration class:

  export default class CreatePostsTable extends Migration {
    async up(): Promise<void> {
      await Schema.create('posts', (table) => {
        table.id();                              // auto-increment primary key
        table.string('title');
        table.text('body').nullable();
        table.string('slug').unique();
        table.boolean('published').defaultTo(false);
        table.integer('author_id').unsigned();
        table.foreign('author_id').references('users.id').onDelete('cascade');
        table.decimal('price', 10, 2).nullable();
        table.json('metadata').nullable();
        table.timestamps();                       // created_at + updated_at
      });
    }

    async down(): Promise<void> {
      await Schema.dropIfExists('posts');
    }
  }

Column types:
  table.id()                    — bigIncrements primary key
  table.string(name, length?)   — VARCHAR
  table.text(name)              — TEXT
  table.integer(name)           — INT
  table.bigInteger(name)        — BIGINT
  table.boolean(name)           — BOOLEAN
  table.decimal(name, p, s)     — DECIMAL
  table.float(name)             — FLOAT
  table.json(name)              — JSON
  table.timestamp(name)         — TIMESTAMP
  table.timestamps()            — created_at + updated_at
  table.softDeletes()           — deleted_at
  table.uuid(name)              — UUID

Modifiers:
  .nullable()
  .defaultTo(value)
  .unique()
  .unsigned()
  .index()

Schema modification (alter table):
  await Schema.table('posts', (table) => {
    table.string('excerpt').nullable();
  });

CLI commands:
  npx faber db:migrate           — run pending migrations
  npx faber db:rollback          — rollback last batch
  npx faber db:status            — show migration status
  npx faber make:migration CreatePostsTable
`.trim(),
  },

  {
    title: 'Request & Response — @faber-js/http',
    keywords: [
      'request',
      'response',
      'req',
      'res',
      'body',
      'query',
      'params',
      'headers',
      'validated',
      'input',
      'all',
    ],
    content: `
Import: import type { Request } from '@faber-js/http';
        import { Response } from '@faber-js/http';

Request methods:
  req.all()                     — all body + query params merged
  req.input(key, default?)      — single value from body or query
  req.body()                    — raw request body object
  req.query(key, default?)      — query string value
  req.route(param)              — URL route parameter (e.g. :id)
  req.header(name)              — request header value
  req.validated()               — validated data (after FormRequest passes)
  req.user<UserType>()          — authenticated user (requires auth middleware)
  req.ip()                      — client IP address
  req.method()                  — HTTP method string
  req.url()                     — request URL

Response static methods:
  Response.json(data, status?)  — JSON response
  Response.redirect(url)        — redirect response
  Response.noContent()          — 204 response

In controllers, use shorthand:
  this.json(data, status?)      — same as Response.json()
  this.noContent()              — same as Response.noContent()

NEVER access req.body directly for user input in production — always use req.validated() after validation, or req.input() / req.all() for unvalidated access.
`.trim(),
  },

  {
    title: 'Queues & Jobs — @faber-js/queue',
    keywords: [
      'queue',
      'job',
      'jobs',
      'dispatch',
      'worker',
      'bullmq',
      'delay',
      'retry',
      'background',
    ],
    content: `
Import: import { dispatch } from '@faber-js/queue';
        import { Job } from '@faber-js/queue';

Dispatch a job (one-liner):
  await dispatch(new SendWelcomeEmail(user));

With options:
  await dispatch(new ProcessPayment(order))
    .onQueue('payments')
    .delay(60)         // delay in seconds
    .attempts(3)       // max retry attempts
    .backoff(30);      // backoff in seconds between retries

Job class:
  import { Job } from '@faber-js/queue';

  export class SendWelcomeEmail extends Job {
    constructor(public readonly user: User) {
      super();
    }

    async handle(): Promise<void> {
      // Send the email
      await mailer.send(this.user.email, new WelcomeMailTemplate(this.user));
    }

    // Optional: configure queue
    static queue = 'emails';
    static attempts = 3;
    static backoff = 30;
  }

Jobs are backed by BullMQ + Redis. Configure Redis in your .env:
  REDIS_HOST=127.0.0.1
  REDIS_PORT=6379

Generate: npx faber make:job SendWelcomeEmail
`.trim(),
  },

  {
    title: 'Events & Listeners — @faber-js/events',
    keywords: [
      'event',
      'events',
      'listener',
      'listeners',
      'event bus',
      'fire',
      'emit',
      'dispatch event',
    ],
    content: `
Import: import { event } from '@faber-js/events';
        import { Event } from '@faber-js/events';
        import { Listener, ListenFor } from '@faber-js/events';

Fire an event:
  await event(new UserRegistered(user));
  await event(new PostPublished(post));

Event class:
  import { Event } from '@faber-js/events';

  export class UserRegistered extends Event {
    constructor(public readonly user: User) {
      super();
    }
  }

Listener class:
  import { Listener, ListenFor } from '@faber-js/events';
  import { UserRegistered } from '../events/UserRegistered';

  @ListenFor(UserRegistered)
  export class SendWelcomeEmailListener extends Listener {
    async handle(event: UserRegistered): Promise<void> {
      await dispatch(new SendWelcomeEmail(event.user));
    }
  }

Listeners are auto-discovered from app/listeners/. No manual registration needed.

Queued listeners: extend QueuedListener instead of Listener to run the handle() in a BullMQ job.

Generate:
  npx faber make:event UserRegistered
  npx faber make:listener SendWelcomeEmailListener
`.trim(),
  },

  {
    title: 'Authentication & Policies — @faber-js/auth',
    keywords: [
      'auth',
      'authentication',
      'authorization',
      'jwt',
      'token',
      'guard',
      'policy',
      'policies',
      'login',
      'user',
      'middleware auth',
    ],
    content: `
Import: import { AuthServiceProvider } from '@faber-js/auth';
        import { Policy } from '@faber-js/auth';

Setup (bootstrap/app.ts):
  import { AuthServiceProvider } from '../app/providers/AuthServiceProvider';
  app.register(new AuthServiceProvider(app));

Configure AuthServiceProvider (app/providers/AuthServiceProvider.ts):
  export class AuthServiceProvider extends BaseAuthServiceProvider {
    protected authConfig(): AuthConfig {
      return {
        secret: process.env['JWT_SECRET'] ?? 'change-me',
        expiresIn: '7d',
      };
    }

    protected userProvider(): UserProviderContract {
      return {
        async findByCredentials(credentials) {
          return User.where('email', credentials.email).first<User>();
        },
        async findById(id) {
          return User.find<User>(Number(id));
        },
      };
    }
  }

Protect routes with 'auth' middleware:
  Route.group({ middleware: ['auth'] }, () => {
    Route.get('/profile', [UserController, 'profile']);
  });

  // Or:
  Route.middleware('auth').group(() => {
    Route.resource('posts', PostController);
  });

Access authenticated user in controller:
  const user = req.user<User>();

Authorization policies:
  export class PostPolicy extends Policy {
    async update(user: User, post: Post): Promise<boolean> {
      return post.author_id === user.id;
    }

    async delete(user: User, post: Post): Promise<boolean> {
      return post.author_id === user.id || user.role === 'admin';
    }
  }

Check policy in controller (throws 403 if denied):
  await this.authorize('update', post);

JWT token endpoint (typically in AuthController):
  const token = await req.login(credentials);  // returns JWT string
  return this.json({ token });
`.trim(),
  },

  {
    title: 'Validation — @faber-js/validation',
    keywords: [
      'validation',
      'validate',
      'rules',
      'form request',
      'formrequest',
      'required',
      'validated',
    ],
    content: `
Import: import { FormRequest } from '@faber-js/validation';

Create a FormRequest:
  export class CreatePostRequest extends FormRequest {
    rules(): Record<string, string | string[]> {
      return {
        title:   'required|string|min:3|max:255',
        body:    'required|string',
        slug:    'required|string|unique:posts,slug',
        price:   'numeric|min:0',
        tags:    'array',
        'tags.*': 'integer',
      };
    }

    messages(): Record<string, string> {
      return {
        'title.required': 'A title is required.',
        'title.min':      'Title must be at least 3 characters.',
      };
    }
  }

Use in controller (inject as constructor param):
  @Injectable()
  export class PostController extends Controller {
    constructor(
      private readonly request: CreatePostRequest,
      private readonly posts: PostService,
    ) { super(); }

    async store(req: Request): Promise<Response> {
      const data = req.validated();   // throws 422 if validation fails
      const post = await this.posts.create(data);
      return this.json({ data: post }, 201);
    }
  }

Available rules:
  required, string, integer, numeric, boolean, array, email
  min:n, max:n, between:n,m
  in:a,b,c, not_in:a,b,c
  unique:table,column, exists:table,column
  confirmed (checks field_confirmation)
  url, ip, uuid
  nullable (allows null/empty)
  sometimes (only validate if present)

Validation failure automatically returns HTTP 422 with errors JSON:
  { "errors": { "title": ["A title is required."] } }

Generate: npx faber make:validation CreatePostRequest
`.trim(),
  },

  {
    title: 'Configuration — @faber-js/config',
    keywords: ['config', 'configuration', 'env', 'environment', '.env', 'settings'],
    content: `
Import: import { env } from '@faber-js/config';

Read environment variables with type coercion:
  const port = env('APP_PORT', 3000);          // returns number if default is number
  const name = env('APP_NAME', 'faberjs');      // returns string
  const debug = env('APP_DEBUG', false);        // returns boolean

Config files live in config/:
  config/app.ts:
    import { env } from '@faber-js/config';
    export default {
      name: env('APP_NAME', 'faberjs'),
      port: env('APP_PORT', 3000),
      debug: env('APP_DEBUG', false),
    };

  config/database.ts — database connection config (generated by scaffolder)

.env variables for a typical app:
  APP_NAME=my-app
  APP_PORT=3000
  DB_CONNECTION=better-sqlite3  (or pg, mysql2)
  DB_DATABASE=./storage/database.sqlite
  JWT_SECRET=change-me-in-production
  REDIS_HOST=127.0.0.1
  REDIS_PORT=6379
`.trim(),
  },

  {
    title: 'Bootstrap & Service Providers — @faber-js/core',
    keywords: [
      'bootstrap',
      'app',
      'application',
      'provider',
      'service provider',
      'register',
      'boot',
      'container',
      'ioc',
    ],
    content: `
bootstrap/app.ts — the application entry point:

  import 'reflect-metadata';
  import { Application } from '@faber-js/core';
  import { HttpServiceProvider, HttpKernel } from '@faber-js/http';
  import { RouterServiceProvider } from '@faber-js/router';
  import { OrmServiceProvider } from '@faber-js/orm';

  void (async () => {
    const app = new Application();

    app.register(new HttpServiceProvider(app));
    app.register(new RouterServiceProvider(app));
    app.register(new OrmServiceProvider(app));

    await app.boot();

    require('../routes/api');  // load routes after boot

    const kernel = app.make<HttpKernel>('http.kernel');
    await kernel.listen(Number(process.env['APP_PORT'] ?? 3000));
  })();

Custom service provider:
  import { ServiceProvider } from '@faber-js/core';

  export class AppServiceProvider extends ServiceProvider {
    register(): void {
      // bind things into the container
      this.app.bind('my-service', () => new MyService());
    }

    async boot(): Promise<void> {
      // runs after all providers are registered
    }
  }

IMPORTANT: reflect-metadata must be the very first import in bootstrap/app.ts.
The app uses ts-node, not tsx/esbuild, because emitDecoratorMetadata requires ts-node.
`.trim(),
  },

  {
    title: 'AI Agents — @faber-js/ai',
    keywords: ['ai', 'agent', 'agents', 'claude', 'anthropic', 'tool', 'chat', 'stream', 'llm'],
    content: `
Import: import { Agent, Tool } from '@faber-js/ai';
        import { Injectable } from '@faber-js/core';

Create an AI agent:
  @Injectable()
  export class SupportAgent extends Agent {
    protected model = 'claude-sonnet-4-6';
    protected maxTokens = 4096;
    protected systemPrompt = 'You are a helpful support agent for our platform.';

    @Tool({ description: 'Look up a user by their email address' })
    async lookupUser(input: { email: string }): Promise<string> {
      const user = await User.where('email', input.email).first<User>();
      return user ? JSON.stringify(user) : 'User not found';
    }

    @Tool({
      description: 'Create a support ticket',
      inputSchema: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Ticket subject' },
          body:    { type: 'string', description: 'Ticket body' },
        },
        required: ['subject', 'body'],
      },
    })
    async createTicket(input: { subject: string; body: string }): Promise<string> {
      const ticket = await Ticket.create(input);
      return \`Ticket #\${ticket.id} created\`;
    }
  }

Use in a controller:
  @Injectable()
  export class SupportController extends Controller {
    constructor(private agent: SupportAgent) { super(); }

    async chat(req: Request): Promise<Response> {
      const reply = await this.agent.chat(req.input('message'));
      return this.json({ reply });
    }

    async stream(req: Request): Promise<Response> {
      // Returns an async generator of string chunks
      const stream = this.agent.stream(req.input('message'));
      // ... handle streaming response
    }
  }

Default model: claude-sonnet-4-6 (can be overridden per-agent).
Tools are auto-discovered via @Tool() decorator + reflect-metadata.
Generate: npx faber make:agent SupportAgent
`.trim(),
  },

  {
    title: 'CLI Commands — @faber-js/console',
    keywords: ['cli', 'command', 'commands', 'faber', 'make', 'generate', 'artisan', 'console'],
    content: `
All CLI commands use colon-separated style matching Laravel Artisan.

Code generation:
  npx faber make:controller PostController
  npx faber make:controller Post --resource        (7 CRUD methods)
  npx faber make:controller Post --api             (5 API methods, no create/edit)
  npx faber make:controller Archive --invokable    (single __invoke method)
  npx faber make:model Post -m          (-m creates migration too)
  npx faber make:service PostService
  npx faber make:job NotifyFollowers
  npx faber make:event UserRegistered
  npx faber make:listener SendWelcomeEmailListener
  npx faber make:middleware RateLimitMiddleware
  npx faber make:migration CreatePostsTable
  npx faber make:provider AppServiceProvider
  npx faber make:command SyncDataCommand
  npx faber make:agent SupportAgent
  npx faber make:validation CreatePostRequest
  npx faber make:schema Post              (schema-first model — @faber-js/schema)
  npx faber make:view users/index         (JSX view — @faber-js/view)
  npx faber make:channel Room             (WebSocket channel — @faber-js/channels)
  npx faber make:mail WelcomeMail         (Mailable class — @faber-js/mail)
  npx faber make:policy PostPolicy        (authorization policy — @faber-js/auth)
  npx faber make:form-request CreatePost  (FormRequest — @faber-js/validation)

Database:
  npx faber db:migrate          — run all pending migrations
  npx faber db:rollback         — rollback last batch
  npx faber db:seed             — run seeders
  npx faber db:status           — show migration status

Development:
  npx faber serve               — start dev server with hot reload
  npx faber tinker              — interactive REPL with app context
  npx faber route:list          — list all registered routes
  npx faber route:cache         — serialize routes to bootstrap/cache/routes.json
  npx faber route:clear         — delete the route cache file

Security:
  npx faber key:generate        — generate APP_KEY for @faber-js/crypt, writes to .env

Frontend Bridge:
  npx faber bridge:types        — generate BridgePages type map from resources/pages/

Custom commands (app/commands/):
  import { Command } from '@faber-js/console';

  export class SyncDataCommand extends Command {
    static signature = 'sync:data';
    static description = 'Sync external data';

    async handle(): Promise<void> {
      this.info('Syncing data...');
      // do work
      this.success('Done!');
    }
  }
`.trim(),
  },

  {
    title: 'Common Patterns & Anti-Patterns',
    keywords: [
      'pattern',
      'patterns',
      'anti-pattern',
      'best practice',
      'common',
      'mistake',
      'wrong',
      'correct',
    ],
    content: `
CORRECT patterns:

1. Always use constructor injection — never instantiate services manually:
   // CORRECT
   constructor(private readonly postService: PostService) { super(); }
   // WRONG
   const service = new PostService();  // never do this

2. Use req.validated() for safe input — not req.body() or req.all() in production:
   const data = req.validated();

3. Route params via req.route(), query via req.query(), body via req.input():
   const id = Number(req.route('id'));
   const page = req.query('page', 1);
   const title = req.input('title');

4. Always return Response from controllers:
   return this.json({ data: post });
   return this.noContent();

5. Events and jobs via global helpers — never dispatch manually:
   await event(new UserRegistered(user));
   await dispatch(new SendWelcomeEmail(user));

6. Static table name on models:
   static table = 'posts';

7. Use .with() for eager loading to avoid N+1:
   Post.with('author', 'comments').all<Post>()

ANTI-PATTERNS to avoid:

- Never import from 'fastify' directly
- Never import from 'knex' directly
- Never write @Injectable() on classes that extend Service or Model — only on Controllers
- Never use req.body directly in route handlers without validation
- Never skip reflect-metadata import in bootstrap/app.ts
- Never use ESM imports in app code — FaberJS apps use CommonJS + ts-node
`.trim(),
  },

  {
    title: 'Sessions — @faber-js/session',
    keywords: [
      'session',
      'sessions',
      'flash',
      'cookie',
      'start session',
      'regenerate',
      'invalidate',
      'flash data',
      'previous url',
    ],
    content: `
Import: import { session, StartSession, SessionServiceProvider } from '@faber-js/session';

Register the provider (bootstrap/app.ts):
  import { SessionServiceProvider } from '@faber-js/session';
  app.register(new SessionServiceProvider(app, {
    driver: 'file',       // 'file' | 'memory'
    cookie: {
      name: 'faber_session',
      ttlMinutes: 120,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  }));

Register session middleware (bootstrap/app.ts):
  kernel.middlewareGroup('web', ['session', 'csrf']);
  kernel.priority(['session', 'csrf', 'auth']);

Access the session in a controller or middleware:
  import { session } from '@faber-js/session';

  const s = session(req);         // throws if StartSession not in pipeline

  s.put('user_id', 42);           // store
  s.get('user_id');               // read
  s.get('locale', 'en');          // read with default
  s.has('user_id');               // exists?
  s.forget('temp');               // remove
  s.flush();                      // clear all
  s.pull('code');                 // read and remove
  s.all();                        // all session data

Flash data (available in the next request only):
  s.flash('status', 'Profile updated!');
  s.reflash();                    // keep all flash for one more request
  s.keep('status', 'errors');     // keep specific keys

Session lifecycle:
  await s.regenerate();           // new ID, preserve data (call after login)
  await s.regenerate(true);       // new ID, destroy old session
  await s.invalidate();           // destroy + flush + new ID

CSRF token:
  const token = s.token();        // get or generate the session's CSRF token

Drivers: 'file' (default, production-safe single server), 'memory' (tests only).
Custom driver: implement SessionDriver interface (read/write/destroy/gc).
`.trim(),
  },

  {
    title: 'Cache — @faber-js/cache',
    keywords: [
      'cache',
      'caching',
      'redis',
      'remember',
      'rate limiter',
      'rate limit',
      'atomic lock',
      'lock',
      'cache driver',
      'cache.get',
      'cache.put',
      'cache.remember',
    ],
    content: `
Import: import { Cache, RateLimiter } from '@faber-js/cache';

Register provider (bootstrap/app.ts):
  import { CacheServiceProvider } from '@faber-js/cache';
  app.register(new CacheServiceProvider(app, {
    driver: 'memory',  // 'memory' | 'redis' | 'database'
    redis: { host: '127.0.0.1', port: 6379 },
    prefix: 'faberjs_cache',
  }));

Basic operations:
  await Cache.get('key');               // returns value or null
  await Cache.get('key', []);           // returns default when missing
  await Cache.put('key', value, 60);    // store for 60 seconds
  await Cache.forever('key', value);    // store indefinitely
  await Cache.has('key');               // true if exists
  await Cache.missing('key');           // true if absent
  await Cache.forget('key');            // remove one key
  await Cache.flush();                  // clear all
  await Cache.pull('key');              // read and remove

Remember (most common pattern):
  const users = await Cache.remember('users:all', 300, async () => User.all());
  const settings = await Cache.rememberForever('app:settings', async () => Setting.all());

Atomic counters:
  await Cache.increment('page_views');     // +1
  await Cache.increment('downloads', 5);  // +5
  await Cache.decrement('seats');         // -1

Atomic locks (prevent race conditions):
  const lock = Cache.lock('process-invoices', 30);  // 30s TTL
  if (await lock.get()) {
    try { await processInvoices(); } finally { await lock.release(); }
  }
  // run-and-release shorthand:
  await Cache.lock('send-report', 30).get(async () => { await sendWeeklyReport(); });

Rate limiter:
  const key = \`login:\${req.ip()}\`;
  if (await RateLimiter.tooManyAttempts(key, 5)) {
    const retryAfter = await RateLimiter.availableIn(key);
    return this.json({ message: \`Retry in \${retryAfter}s.\` }, 429);
  }
  await RateLimiter.hit(key, 60);
  // shorthand:
  const executed = await RateLimiter.attempt(key, 5, async () => login(req), 60);

Testing:
  Cache.fake();                          // in-memory stub, no real driver
  // write to it normally, then assert Cache.has() / Cache.get()

.env:
  CACHE_DRIVER=memory    # memory | redis | database
  REDIS_HOST=127.0.0.1
`.trim(),
  },

  {
    title: 'Encryption & Hashing — @faber-js/crypt',
    keywords: [
      'hash',
      'bcrypt',
      'password',
      'encrypt',
      'decrypt',
      'aes',
      'crypt',
      'signed url',
      'temporary url',
      'app key',
      'key generate',
      'DecryptException',
    ],
    content: `
Import: import { Hash, Crypt, URL } from '@faber-js/crypt';

Register provider (bootstrap/app.ts):
  import { CryptServiceProvider } from '@faber-js/crypt';
  app.register(new CryptServiceProvider(app, {
    key: process.env.APP_KEY ?? '',   // 256-bit base64 key
    bcrypt: { rounds: 12 },
  }));

Generate APP_KEY:
  npx faber key:generate             // writes to .env

--- Hashing (one-way — passwords) ---
  const hashed = await Hash.make('secret');        // bcrypt hash
  const ok     = await Hash.check('secret', hashed); // verify
  const stale  = await Hash.needsRehash(hashed);   // true if made with fewer rounds

Full login example:
  const user = await User.where('email', email).first();
  if (!user || !await Hash.check(password, user.getAttribute('password'))) {
    throw new UnauthorizedException();
  }

--- Encryption (two-way — store-and-retrieve) ---
  const enc = await Crypt.encryptString('my-token');   // AES-256-GCM
  const dec = await Crypt.decryptString(enc);           // original value
  // throws DecryptException on tamper / wrong key

  import { DecryptException } from '@faber-js/crypt';
  try { await Crypt.decryptString(stored); }
  catch (e) { if (e instanceof DecryptException) { ... } }

Testing:
  Crypt.fake();  // replace with identity codec (base64), no real APP_KEY needed

--- Signed URLs ---
  import { URL, SignedMiddleware } from '@faber-js/crypt';

  // Permanent signed URL
  const link = URL.signedRoute('email.verify', { id: user.id });

  // Expires in 1 hour
  const reset = URL.temporarySignedRoute('password.reset', 3600, { email });

  // Validate without middleware
  URL.hasValidSignature(url);  // boolean

  // Protect routes:
  kernel.register('signed', new SignedMiddleware());
  Route.get('/email/verify', [Controller, 'verify']).middleware(['signed']);
  // Returns 403 automatically when signature invalid or expired
`.trim(),
  },

  {
    title: 'HTTP Client — @faber-js/http-client',
    keywords: [
      'http client',
      'outbound',
      'fetch',
      'Http.get',
      'Http.post',
      'withToken',
      'retry',
      'timeout',
      'Http.fake',
      'HttpResponse',
      'external api',
    ],
    content: `
Import: import { Http } from '@faber-js/http-client';
No service provider needed — available immediately after import.

Basic requests:
  const res = await Http.get('https://api.example.com/users');
  const res = await Http.post('https://api.example.com/users', { name: 'Alice' });
  await Http.put('/users/1', { name: 'Alice Smith' });
  await Http.patch('/users/1', { active: true });
  await Http.delete('/users/1');

  // GET with query params
  await Http.get('/users', { page: 1, per_page: 25 });

Builder methods (chain before sending):
  Http.withToken(token)                         // Authorization: Bearer
  Http.withBasicAuth('user', 'pass')
  Http.withHeaders({ 'X-Request-ID': uuid() })
  Http.baseUrl('https://api.example.com/v1')    // prepend to every path
  Http.timeout(5000)                            // ms — throws RequestTimeoutException
  Http.retry(3, 500)                            // 3 attempts, 500ms initial delay (exponential backoff)
  Http.asForm()                                 // form-urlencoded instead of JSON
  Http.withBody('<xml/>', 'application/xml')    // raw body

Reusable client:
  const client = Http.baseUrl('https://api.github.com').withToken(token);
  const user = await client.get('/users/octocat').then(r => r.json());

HttpResponse API:
  res.status()        // number (200, 404, etc.)
  res.ok()            // true for 2xx
  res.failed()        // true for 4xx / 5xx
  res.clientError()   // 4xx
  res.serverError()   // 5xx
  await res.json()    // parsed JSON
  await res.body()    // raw string
  res.header('Content-Type')
  res.throw()         // throws HttpRequestException if failed()
  res.throwIf(cond)   // conditional throw

Testing (no network):
  Http.fake({
    'https://api.example.com/users': Http.response([{ id: 1 }], 200),
    'https://payments.example.com/*': Http.response({ error: 'Declined' }, 422),
  });
  // After test:
  Http.assertSent((req) => req.url() === '...' && req.method() === 'POST');
  Http.assertNothingSent();
  Http.assertSentCount(2);
  Http.clearFakes();  // call in afterEach
`.trim(),
  },

  {
    title: 'Mail — @faber-js/mail',
    keywords: [
      'mail',
      'email',
      'mailable',
      'smtp',
      'send mail',
      'Mail.to',
      'Mail.fake',
      'nodemailer',
      'welcome email',
      'queue mail',
    ],
    content: `
Import: import { Mail, Mailable } from '@faber-js/mail';

Register provider (bootstrap/app.ts):
  import { MailServiceProvider } from '@faber-js/mail';
  app.register(new MailServiceProvider(app, {
    driver: 'smtp',  // 'smtp' | 'log'
    smtp: { host: 'smtp.mailtrap.io', port: 587, encryption: 'tls', auth: { user: '', pass: '' } },
    from: { address: 'hello@example.com', name: 'My App' },
  }));

Generate a mailable:
  npx faber make:mail WelcomeMail
  // creates app/mail/WelcomeMail.ts

Mailable class:
  import { Mailable } from '@faber-js/mail';

  export class WelcomeMail extends Mailable {
    constructor(private readonly user: User) { super(); }

    build(): unknown {
      const name = this.user.getAttribute('name') as string;
      return this.to(name).subject(\`Welcome, \${name}!\`).html(\`<h1>Welcome!</h1>\`);
    }
  }

Mailable fluent API:
  .to(address, name?)    .cc(address)    .bcc(address)
  .from(address, name?)  .replyTo(address)
  .subject(text)         .html(html)     .text(plainText)
  .attach(path, options?)
  .priority('high' | 'normal' | 'low')

Sending:
  await Mail.send(new WelcomeMail(user));
  await Mail.to(user.email).send(new WelcomeMail(user));
  await Mail.to(email).cc(manager).bcc(audit).send(new InvoiceMail(invoice));

  // Queue to avoid blocking HTTP response (requires @faber-js/queue):
  await Mail.to(email).queue(new WelcomeMail(user));
  await Mail.to(email).onQueue('emails').queue(new WelcomeMail(user));

Testing:
  Mail.fake();                               // no real sends, records in memory
  Mail.assertSent(WelcomeMail);
  Mail.assertSent(WelcomeMail, (mail) => mail.hasTo('alice@example.com'));
  Mail.assertNotSent(InvoiceMail);
  Mail.assertNothingSent();
  Mail.assertSentCount(WelcomeMail, 1);
  Mail.assertQueued(WelcomeMail);

.env:
  MAIL_DRIVER=smtp
  MAIL_HOST=smtp.mailtrap.io
  MAIL_PORT=587
  MAIL_ENCRYPTION=tls
  MAIL_USERNAME=...
  MAIL_PASSWORD=...
  MAIL_FROM_ADDRESS=hello@example.com
  MAIL_FROM_NAME="My App"
`.trim(),
  },

  {
    title: 'Schema-first Models — @faber-js/schema',
    keywords: [
      'schema',
      'schema-first',
      'factory',
      'openapi',
      't.string',
      't.email',
      't.id',
      'InferSchemaType',
      'test factory',
      'schema factory',
    ],
    content: `
Import: import { schema, t } from '@faber-js/schema';
No service provider needed.

Define a schema (declares table, types, validation, OpenAPI, factory):
  export const User = schema('users', {
    id:        t.id(),
    name:      t.string().min(2).max(100),
    email:     t.email().unique(),
    password:  t.string().hidden(),
    role:      t.enum(['admin', 'editor', 'viewer'] as const).default('viewer'),
    bio:       t.text().nullable(),
    createdAt: t.timestamp().auto(),
    updatedAt: t.timestamp().auto(),
  });

Infer TypeScript type:
  import type { InferSchemaType } from '@faber-js/schema';
  type UserRow = InferSchemaType<typeof User>;

Field types:
  t.id()                 — number, auto-increment PK
  t.string(length?)      — string (VARCHAR)
  t.text()               — string (TEXT)
  t.email()              — string + email validation
  t.integer()            — number
  t.boolean()            — boolean
  t.timestamp()          — Date
  t.uuid()               — string
  t.enum(values as const) — union type
  t.foreignId()          — number (foreign key)
  t.json()               — unknown

Modifiers (chainable):
  .nullable()   .default(val)   .unique()   .index()
  .hidden()     .auto()          .min(n)     .max(n)
  .unsigned()

ORM — schema class extends Model, all standard methods work:
  await User.find(1);
  await User.all();
  await User.create({ name: 'Ada', email: 'ada@example.com' });
  await User.where('role', 'admin').get();

Validation rules (auto-generated):
  User.rules()  // compatible with FormRequest.rules() and Validator.validate()

OpenAPI spec:
  User.openapi()  // returns OpenAPI 3.1 schema object

Test factory:
  const user  = await User.factory().createOne();         // persist
  const users = await User.factory().times(10).create();  // persist many
  const admin = await User.factory().state({ role: 'admin' }).createOne();
  const stub  = User.factory().makeOne();                  // no DB

CLI:
  npx faber make:schema Post
  // creates app/schema/Post.ts with id + timestamps stub
`.trim(),
  },

  {
    title: 'Testing — @faber-js/testing',
    keywords: [
      'testing',
      'test',
      'testclient',
      'test response',
      'assertok',
      'assertcreated',
      'assertjsonpath',
      'refreshdatabase',
      'assertdatabasehas',
      'actingas',
    ],
    content: `
Import: import { createTestApp, TestClient } from '@faber-js/testing';
Install as dev dependency: pnpm add -D @faber-js/testing

TestClient — makes real HTTP requests against your running app:
  let client: TestClient;

  beforeEach(async () => {
    client = await createTestApp(await buildKernel());
  });

  afterEach(async () => {
    await client.close();
  });

Making requests:
  const res = await client.get('/api/users');
  const res = await client.post('/api/users', { name: 'Alice', email: 'alice@example.com' });
  await client.put('/api/users/1', { name: 'Alice Smith' });
  await client.patch('/api/users/1', { active: true });
  await client.delete('/api/users/1');
  // with extra headers:
  await client.get('/admin/stats', { 'x-internal-key': 'secret' });

Authenticated requests:
  const authed = client.actingAs('my-bearer-token');  // returns new client
  await authed.get('/api/profile');

  // or with custom headers:
  await client.withHeaders({ 'x-tenant-id': '42' }).get('/api/users');

TestResponse assertions (all chainable):
  res.assertOk()           // 200
  res.assertCreated()      // 201
  res.assertNoContent()    // 204
  res.assertNotFound()     // 404
  res.assertUnauthorized() // 401
  res.assertForbidden()    // 403
  res.assertUnprocessable() // 422
  res.assertStatus(302)
  res.assertJson({ message: 'Created' })
  res.assertJsonPath('data.email', 'alice@example.com')

  // read response:
  res.status()             // number
  res.json()               // parsed body
  res.header('content-type')

Database assertions (standalone):
  import { assertDatabaseHas, assertDatabaseMissing, assertDatabaseCount } from '@faber-js/testing';

  await assertDatabaseHas('users', { email: 'alice@example.com' });
  await assertDatabaseMissing('users', { id: 1 });
  await assertDatabaseCount('users', 3);

TestCase base class (full lifecycle wiring):
  class PostsTest extends TestCase {
    protected createKernel(): Promise<HttpKernel> { return buildKernel(); }
    protected async setup() { await this.refreshDatabase(); }
  }
  // provides: t.getJson, t.postJson, t.putJson, t.patchJson, t.deleteJson
  // t.actingAs('token'), t.assertDatabaseHas(table, record)
`.trim(),
  },

  {
    title: 'Server-side Views — @faber-js/view',
    keywords: [
      'view',
      'views',
      'jsx',
      'server-side rendering',
      'ssr',
      'view controller',
      'this.view',
      'layout',
      'template',
      'raw html',
      'Unsafe',
    ],
    content: `
Import: import { ViewServiceProvider, ViewController } from '@faber-js/view';

Register provider (bootstrap/app.ts):
  app.register(new ViewServiceProvider(app));

View files live in resources/views/ and have .view.tsx extension.
Each file must include the JSX import source pragma:
  /** @jsxImportSource @faber-js/view */

Example view (resources/views/users/index.view.tsx):
  /** @jsxImportSource @faber-js/view */

  interface Props { users: Array<{ id: number; name: string }> }

  export default function UsersIndex({ users }: Props) {
    return (
      <html lang="en"><body>
        <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>
      </body></html>
    );
  }

Rendering from a controller (extend ViewController, not Controller):
  import { ViewController } from '@faber-js/view';

  @Injectable()
  export class UserController extends ViewController {
    async index(_req: Request): Promise<Response> {
      return this.view('users/index', { users: await User.all() });
    }
  }

this.view(name, props):
  - resolves resources/views/{name}.view.tsx
  - calls default export with props
  - returns Response with content-type: text/html
  - prepends <!DOCTYPE html> when root element is <html>

Layout composition — import and call like any component:
  import { AppLayout } from '../layouts/app.view';
  export default function Page({ users }: Props) {
    return <AppLayout title="Users"><ul>...</ul></AppLayout>;
  }
  // AppLayout receives children as RawHtml (already-rendered, not escaped)

Auto-escaping: all interpolated values are HTML-escaped (XSS-safe).
  {userInput}    // "&lt;script&gt;" — always safe

Raw HTML (trusted content only):
  import { Unsafe, raw } from '@faber-js/view';
  <Unsafe html={article.renderedMarkdown} />
  <p>{raw('<strong>bold</strong>')}</p>

Boolean attributes:
  <input checked={true} disabled={false} />  // → <input checked>

Fragment:
  import { Fragment } from '@faber-js/view';
  <><td>{name}</td><td>{email}</td></>

ViewRenderer API (advanced):
  import { ViewRenderer } from '@faber-js/view';
  const html = await renderer.render('users/index', { users });
  const html = renderer.renderComponent(UsersIndex, { users });
  // throws ViewNotFoundException when file not found

CLI:
  npx faber make:view users/index   // creates resources/views/users/Index.view.tsx
`.trim(),
  },

  {
    title: 'Collections & Support Utilities — @faber-js/support',
    keywords: [
      'collection',
      'collect',
      'str',
      'string helpers',
      'arr',
      'array helpers',
      'pipeline',
      'slug',
      'camel',
      'snake',
      'groupby',
      'pluck',
      'chunk',
    ],
    content: `
Import: import { collect, Collection, Str, Arr, Pipeline } from '@faber-js/support';
No service provider needed.

--- Collections ---
  const users = collect([{ id: 1, name: 'Alice', score: 95 }, ...]);
  // or: Collection.make([...])  or  collect(await User.all())

Chain methods:
  users.map((u) => u.name)          // transform
  users.filter((u) => u.score > 80) // keep matching
  users.pluck('name')               // extract field → Collection
  users.pluck('id').all()           // → plain array
  users.first()                     // first item
  users.first((u) => u.role === 'admin')
  users.groupBy('role')             // → Map<string, ...>
  users.sortBy('name')              // ascending
  users.sortByDesc('score')         // descending
  users.chunk(10)                   // paginate
  users.skip(10).take(10)           // offset+limit
  users.unique('email')             // deduplicate by field
  users.partition((u) => u.admin)   // → [Collection, Collection]
  users.sum('score')   users.avg('score')   users.min()   users.max()
  users.count()        users.isEmpty()       users.isNotEmpty()
  users.all()          users.toJson()
  users.reduce((carry, u) => carry + u.score, 0)
  users.each((u) => console.log(u.name))
  users.flatMap((u) => u.tags)

--- Str (string helpers) ---
  Str.camel('hello_world')      // 'helloWorld'
  Str.snake('HelloWorld')       // 'hello_world'
  Str.kebab('HelloWorld')       // 'hello-world'
  Str.studly('hello_world')     // 'HelloWorld'
  Str.slug('Hello World!')      // 'hello-world'
  Str.title('hello world')      // 'Hello World'
  Str.limit('long text', 10)    // 'long text...'
  Str.uuid()                    // UUID v4
  Str.random(16)                // random alphanumeric
  Str.plural('user')            // 'users'
  Str.singular('users')         // 'user'

  // Fluent API:
  Str.of('  Hello World!  ').trim().lower().slug().value()  // 'hello-world'

--- Arr (array helpers) ---
  Arr.wrap('hello')              // ['hello']
  Arr.wrap(null)                 // []
  Arr.chunk([1,2,3,4,5], 2)     // [[1,2],[3,4],[5]]
  Arr.flatten([1,[2,[3]]])       // [1,2,3]
  Arr.unique([1,1,2,3])         // [1,2,3]
  Arr.pluck(users, 'id')        // [1,2,3]
  Arr.groupBy(users, 'role')    // { admin:[...], editor:[...] }
  Arr.shuffle([1,2,3,4])        // random order
  Arr.zip([1,2], ['a','b'])     // [[1,'a'],[2,'b']]
  Arr.first(arr)   Arr.last(arr)

--- Pipeline ---
  const result = await Pipeline.make()
    .send({ name: '  Alice  ', email: 'ALICE@EXAMPLE.COM' })
    .through(
      (p, next) => next({ ...p, name: p.name.trim() }),
      (p, next) => next({ ...p, email: p.email.toLowerCase() }),
    )
    .thenReturn();

  // Custom terminal step:
  const user = await Pipeline.make()
    .send(rawInput)
    .through(trimStrings, normalizeEmail, hashPassword)
    .then(async (data) => User.create(data));
`.trim(),
  },

  {
    title: 'Frontend Bridge — @faber-js/bridge',
    keywords: [
      'bridge',
      'frontend',
      'spa',
      'inertia',
      'bridge controller',
      'this.render',
      'shared data',
      'BridgeController',
      'BridgeServiceProvider',
      'bridge types',
      'full-stack',
      'vite',
    ],
    content: `
Import (server): import { BridgeController, BridgeServiceProvider, SharedData } from '@faber-js/bridge';

Register provider (bootstrap/app.ts — after HTTP kernel):
  app.register(new BridgeServiceProvider(app));
  // BridgeMiddleware is auto-registered as global middleware

BridgeController — extends Controller, adds this.render():
  @Injectable()
  export class UserController extends BridgeController {
    async index(_req: Request): Promise<Response> {
      return this.render('Users/Index', { users: await this.users.all() });
    }

    async show(req: Request): Promise<Response> {
      const user = await this.users.find(Number(req.route('id')));
      return this.render('Users/Show', { user });
    }
  }

this.render(componentName, props):
  - componentName is a path relative to resources/pages/ (e.g. 'Users/Index')
  - On first visit: returns full HTML page with JSON embedded in <div id="app" data-page="...">
  - On XHR navigation (X-Faber-Bridge: true header): returns JSON only

HTML shell (resources/views/app.html):
  <div id="app" data-page="__BRIDGE_PAGE__"></div>
  <script type="module" src="/resources/js/app.tsx"></script>

Shared data (available on every page):
  const shared = app.make<SharedData>('bridge.shared');
  shared.share('appName', 'My App');
  shared.share((req) => ({ auth: { user: req.user ? { id: req.user.id } : null } }));
  shared.share(async (req) => ({ unread: await Notification.count() }));
  // per-render props override shared data on key collision

Asset versioning:
  // 409 Conflict triggers hard reload when client version != server version
  // @faber-js/bridge/vite plugin computes version from entry file hash

Vite config:
  import { faberBridge } from '@faber-js/bridge/vite';
  plugins: [react(), faberBridge({ framework: 'react' })]
  // or: [vue(), faberBridge({ framework: 'vue' })]

Generate types (run after adding page components):
  npx faber bridge:types
  // creates resources/types/bridge.generated.ts with BridgePages type map
`.trim(),
  },

  {
    title: 'React Adapter — @faber-js/bridge-react',
    keywords: [
      'bridge react',
      'createBridgeApp',
      'usePage',
      'useForm',
      'Link',
      'Head',
      'react bridge',
      'bridge react hooks',
      'form submission',
    ],
    content: `
Import: import { createBridgeApp, usePage, useForm, Link, Head } from '@faber-js/bridge-react';

Bootstrap (resources/js/app.tsx):
  import { createBridgeApp } from '@faber-js/bridge-react';
  createBridgeApp({ resolve: (name) => import(\`../pages/\${name}\`) });

Page components (resources/pages/Users/Index.tsx):
  export default function UsersIndex() {
    const { props } = usePage<{ users: User[] }>();
    return <ul>{props.users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
  }

usePage<T>() — returns current bridge page:
  const { props, url, component } = usePage<{ users: User[]; auth: { user: User | null } }>();
  // With generated types:
  import type { BridgePages } from '../../types/bridge.generated';
  const { props } = usePage<BridgePages['Users/Index']>();

<Link> — bridge XHR navigation (no full page reload):
  <Link href="/users">All users</Link>
  <Link href="/posts/1" method="delete" preserveScroll>Delete</Link>

useForm<T>(initialValues) — manages form state + server validation errors:
  const form = useForm({ name: '', email: '' });

  form.data.name                  // field value
  form.errors.email               // server validation error
  form.processing                 // true while request in-flight
  form.hasErrors                  // any errors?
  form.setData('name', value)     // update field
  form.reset()                    // reset to initial values
  form.post('/users')             // POST with form data as JSON
  form.put('/users/1')
  form.patch('/users/1')
  form.delete('/users/1')
  form.post('/users', {
    onSuccess: (page) => ...,
    onError: (errors) => ...,
    onFinish: () => ...,
  });

  // Handles 422 automatically — populates form.errors from response body

<Head> — sets document.title:
  <Head title="Users — My App" />

Real-time hooks (requires setChannelsClient setup):
  import { useChannel, usePresence } from '@faber-js/bridge-react';
  useChannel('room.general', { 'message': (data) => setMessages(m => [...m, data]) });
  const { members } = usePresence('room.general');
`.trim(),
  },

  {
    title: 'Vue Adapter — @faber-js/bridge-vue',
    keywords: [
      'bridge vue',
      'vue bridge',
      'BridgeLink',
      'BridgeHead',
      'useForm vue',
      'usePage vue',
      'v-model form',
      'vue bridge hooks',
    ],
    content: `
Import: import { createBridgeApp, usePage, useForm, BridgeLink, BridgeHead } from '@faber-js/bridge-vue';

Bootstrap (resources/js/app.ts):
  import { createBridgeApp } from '@faber-js/bridge-vue';
  createBridgeApp({ resolve: (name) => import(\`../pages/\${name}.vue\`) });

Page components (resources/pages/Users/Index.vue):
  <script setup lang="ts">
  import { usePage } from '@faber-js/bridge-vue';
  const page = usePage<{ users: User[] }>();
  </script>
  <template>
    <li v-for="user in page.props.users" :key="user.id">{{ user.name }}</li>
  </template>

usePage<T>() — returns ComputedRef<BridgePage>:
  const page = usePage<{ user: User }>();
  page.value.props.user    // User
  page.value.url           // current URL
  page.value.component     // component name
  const user = computed(() => page.value.props.user);

<BridgeLink> — bridge XHR navigation:
  <BridgeLink href="/users">All users</BridgeLink>
  <BridgeLink href="/users" method="post" :preserve-scroll="true">Submit</BridgeLink>

useForm<T>(initialValues) — reactive form:
  const form = useForm({ name: '', email: '' });

  // v-model works directly (form.data is reactive)
  <input v-model="form.data.name" />
  <span v-if="form.errors.name">{{ form.errors.name }}</span>
  <button :disabled="form.processing">Submit</button>

  form.post('/users')      form.put('/users/1')
  form.patch('/users/1')   form.delete('/users/1')
  form.reset()             form.clearErrors()
  form.post('/users', { onSuccess: (page) => ..., onError: (errs) => ... });

<BridgeHead> — sets document.title:
  <BridgeHead title="Users — My App" />

React vs Vue differences:
  usePage()    → React returns BridgePage, Vue returns ComputedRef<BridgePage>
  Navigation   → React uses <Link>,          Vue uses <BridgeLink>
  Head         → React uses <Head>,          Vue uses <BridgeHead>
  Form v-model → N/A in React (use setData), works directly in Vue

Real-time hooks:
  import { useChannel, usePresence } from '@faber-js/bridge-vue';
  const { on } = useChannel('room.general');
  on('message', (data) => messages.value.push(data));
  const { members } = usePresence('room.general');  // Ref<MemberData[]>
`.trim(),
  },

  {
    title: 'Real-Time Channels — @faber-js/channels',
    keywords: [
      'channels',
      'websocket',
      'realtime',
      'broadcast',
      'Channel.public',
      'Channel.private',
      'Channel.presence',
      'socket',
      'FaberChannels',
      'presence channel',
      'useChannel',
      'usePresence',
    ],
    content: `
Import: import { Channel, broadcast } from '@faber-js/channels';

Register provider (bootstrap/app.ts):
  import { ChannelsServiceProvider } from '@faber-js/channels';
  app.register(new ChannelsServiceProvider(app));

Register channels (routes/channels.ts):
  import { Channel } from '@faber-js/channels';
  Channel.public('notifications', [NotificationChannel, 'subscribe']);
  Channel.private('user.{id}', [AuthMiddleware], [UserChannel, 'presence']);
  Channel.presence('room.{slug}', [AuthMiddleware], [RoomChannel, 'join']);

Generate: npx faber make:channel Room
  // creates app/channels/RoomChannel.ts

Channel handler (app/channels/RoomChannel.ts):
  @Injectable()
  export class RoomChannel extends Channel {
    async join(socket: Socket, slug: string): Promise<void> {
      const user = socket.user<User>();
      socket.joinPresence(\`room.\${slug}\`, { id: user.id, name: user.name });

      socket.on('message', async (content) => {
        socket.to(\`room.\${slug}\`).emit('message', { user, content });
      });

      socket.on('disconnect', () => { /* cleanup */ });
    }
  }

Socket API:
  socket.join(channel)               // subscribe to channel
  socket.joinPresence(channel, data) // subscribe with member tracking
  socket.leave(channel)              // unsubscribe
  socket.emit(event, data)           // emit to all my channels
  socket.to(channel).emit(...)       // emit to everyone on channel
  socket.broadcast(event, data)      // everyone except this socket
  socket.on(event, handler)          // handle client events
  socket.user<T>()                   // authenticated user
  socket.disconnect()                // force disconnect

Presence events (auto-emitted):
  'presence.init'    → { members: [] }    (on connect)
  'presence.joined'  → { member }         (when someone connects)
  'presence.left'    → { member }         (when someone disconnects)

broadcast() from anywhere (services, jobs, controllers):
  import { broadcast } from '@faber-js/channels';
  await broadcast('user.' + userId, 'order.shipped', { orderId, trackingNumber });
  await broadcast('notifications', 'new-post', { postId });

Browser client:
  import { FaberChannels } from '@faber-js/channels/client';
  const ch = new FaberChannels({ url: 'ws://localhost:3000/_faber/ws', token });
  const room = ch.presence('room.general');
  room.here((members) => console.log(members));
  room.joining((m) => console.log('joined:', m.name));
  room.leaving((m) => console.log('left:', m.name));
  ch.disconnect();

Multi-process (Redis adapter):
  // config/channels.ts: { driver: 'redis', redis: { host, port, channel: 'faberjs_channels' } }
  // CHANNELS_DRIVER=redis in .env
  // pnpm add ioredis
`.trim(),
  },

  {
    title: 'Runtime Adapters — @faber-js/adapters',
    keywords: [
      'adapters',
      'runtime',
      'bun',
      'lambda',
      'cloudflare',
      'workers',
      'serverless',
      'edge',
      'BunAdapter',
      'FastifyAdapter',
      'createLambdaHandler',
      'createWorkerHandler',
      'detectRuntime',
    ],
    content: `
Import: import { FastifyAdapter, BunAdapter, createLambdaHandler, createWorkerHandler, detectRuntime, createAdapter } from '@faber-js/adapters';

Detect runtime:
  const runtime = detectRuntime();  // 'node' | 'bun' | 'lambda' | 'cloudflare'
  const adapter = createAdapter();  // auto-picks the right adapter

FastifyAdapter (default — Node.js):
  // Already used internally by HttpKernel. Only needed for manual use.
  const adapter = new FastifyAdapter();
  await adapter.start(handler, { port: 3000, host: '0.0.0.0' });
  await adapter.stop();

BunAdapter (requires Bun runtime):
  import { BunAdapter } from '@faber-js/adapters/bun';
  const adapter = new BunAdapter();
  await adapter.start(handler, { port: 3000 });
  // Run: bun run bootstrap/app.ts (~4× faster cold start)
  // Throws if used outside Bun

Lambda adapter (AWS Lambda):
  // lambda.ts
  import { createLambdaHandler } from '@faber-js/adapters/lambda';
  import app from './bootstrap/app';
  export const handler = createLambdaHandler(app);
  // Signature: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
  // app.boot() is called once on cold start; warm invocations skip it

  // Manual bridge functions:
  import { fromLambdaEvent, toLambdaResponse } from '@faber-js/adapters/lambda';

Cloudflare Workers adapter:
  // worker.ts
  import { createWorkerHandler } from '@faber-js/adapters/cloudflare';
  export default createWorkerHandler(async (req) => Response.json({ edge: true }));
  // Returns { fetch } compatible with Cloudflare ExportedHandler

  // Manual bridge:
  import { fromWorkerRequest, toWorkerResponse } from '@faber-js/adapters/cloudflare';

HttpAdapter interface (implement custom adapters):
  interface HttpAdapter {
    start(handler: RequestHandler, options?: AdapterOptions): Promise<void>;
    stop(): Promise<void>;
  }

  type RequestHandler = (request: Request) => Promise<Response>;

HttpKernel.handleRequest (used internally by adapters):
  const kernel = app.make<HttpKernel>('http.kernel');
  const response = await kernel.handleRequest(req);  // no TCP server

Feature support by runtime:
  Routing/Validation/Auth: all runtimes
  ORM (Knex): Node, Bun, Lambda
  ORM: NOT available on Cloudflare Workers (use D1 or external API)
`.trim(),
  },

  {
    title: 'DevTools Dashboard — @faber-js/devtools',
    keywords: [
      'devtools',
      'dashboard',
      'traces',
      'observability',
      '_faber',
      'TraceStore',
      'DevToolsServiceProvider',
      'slow query',
      'request trace',
      'sql trace',
    ],
    content: `
Import: import { DevToolsServiceProvider, TraceStore } from '@faber-js/devtools';

Registration (bootstrap/app.ts — after ORM and Events providers):
  app.register(new DevToolsServiceProvider(app, {
    db:         getConnection(),     // optional — enables SQL tracing tab
    dispatcher: app.make('events'), // optional — enables Events tracing tab
  }));

Dashboard: http://localhost:3000/_faber (automatically disabled when APP_ENV=production)

Three tabs:
  Requests — HTTP method, path, status, duration, SQL query count, heap delta
  Queries  — SQL statement, duration, correlated request ID (if triggered by a request)
  Events   — Event type, duration, timestamp

Slow highlighting: queries >100ms amber, >200ms red; requests >500ms amber, >1s red.

Configuration options:
  {
    enabled:            true,        // default: APP_ENV !== 'production'
    path:               '/_faber',
    slowQueryThreshold: 100,         // ms
    maxRequests:        200,         // ring buffer sizes
    maxQueries:         500,
    maxEvents:          500,
    maxAgentTraces:     100,
  }

How it works:
  DevHttpTracer  — global middleware; uses AsyncLocalStorage to correlate SQL ↔ request
  DevOrmTracer   — hooks into Knex query events
  DevEventTracer — calls dispatcher.listenWildcard()

API endpoints (polled every 3s by dashboard):
  GET /_faber/api/requests   — RequestTrace[]
  GET /_faber/api/queries    — SqlTrace[]
  GET /_faber/api/events     — EventTrace[]
  GET /_faber/api/agents     — AgentTrace[]
  DELETE /_faber/api/clear   — clears all buffers

Using TraceStore in tests:
  const store = Application.getInstance().make(TraceStore);
  const requests = store.getRequests();
  expect(requests[0].queryCount).toBe(1);
  expect(requests[0].status).toBe(200);

Ring buffer: fixed-size in-memory, oldest entries dropped when full. Nothing persists to disk.
`.trim(),
  },

  {
    title: 'CSRF Protection — @faber-js/session',
    keywords: [
      'csrf',
      'cross site',
      'request forgery',
      'xsrf',
      'x-csrf-token',
      'x-xsrf-token',
      'prevent request forgery',
      'csrf token',
      'sec-fetch-site',
      'origin verification',
      'webhook exclude',
    ],
    content: `
Import: import { PreventRequestForgery } from '@faber-js/session';

The PreventRequestForgery middleware is registered automatically when using SessionServiceProvider.
The 'csrf' middleware alias is available after registering the provider.

How it works — two-layer check for POST/PUT/PATCH/DELETE:
  1. Sec-Fetch-Site header: if 'same-origin' → allow immediately (no token needed)
  2. Token fallback (for older browsers / non-HTTPS):
     - Check _token field in POST body
     - Check X-CSRF-TOKEN request header
     - Check X-XSRF-TOKEN request header (from XSRF-TOKEN encrypted cookie)
  Returns 419 if check fails (403 in originOnly mode).

GET/HEAD/OPTIONS are always allowed — no token required.

Setting the token in forms:
  const token = session(req).token();
  // embed in HTML form as: <input type="hidden" name="_token" value="{{ token }}" />

SPA / Axios:
  The middleware automatically sets an XSRF-TOKEN cookie on every response.
  Axios reads this cookie and sends it as X-XSRF-TOKEN automatically.
  No manual configuration needed.

Excluding webhook URIs:
  app.register(new SessionServiceProvider(app, sessionConfig, {
    except: ['/webhooks/stripe', '/webhooks/*'],
  }));

Origin-only mode (disables token fallback entirely):
  app.register(new SessionServiceProvider(app, sessionConfig, {
    originOnly: true,   // returns 403 (not 419) on failure; requires HTTPS
  }));

Allow same-site requests (cross-subdomain):
  app.register(new SessionServiceProvider(app, sessionConfig, {
    allowSameSite: true,
  }));

IMPORTANT:
- CSRF middleware requires StartSession to run first (session must be attached to request)
- Webhook routes should set except[] OR be placed outside the 'web' middleware group
- originOnly mode only works over HTTPS
`.trim(),
  },
];

export function searchKnowledge(query: string): KnowledgeSection[] {
  const q = query.toLowerCase().trim();
  if (!q) return knowledge;

  const scored = knowledge.map((section) => {
    let score = 0;
    if (section.title.toLowerCase().includes(q)) score += 10;
    if (section.keywords.some((k) => q.includes(k) || k.includes(q))) score += 5;
    if (section.content.toLowerCase().includes(q)) score += 2;
    return { section, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.section);
}
