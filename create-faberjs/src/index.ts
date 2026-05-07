import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { scaffoldProject } from './scaffold';
import type { ScaffoldOptions, StepCallback } from './scaffold';

type DbDriver = ScaffoldOptions['dbDriver'];
type Frontend = ScaffoldOptions['frontend'];
type Agent = NonNullable<ScaffoldOptions['agents']>[number];
type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';
type RecipeId = 'api' | 'fullstack-react' | 'fullstack-vue' | 'ai-agent' | 'saas' | 'custom';

const VALID_DBS: readonly DbDriver[] = ['sqlite', 'sqlite-wasm', 'postgres', 'mysql'];
const VALID_FRONTENDS: readonly Frontend[] = ['none', 'tsx', 'ejs', 'react', 'vue'];
const VALID_AGENTS: readonly Agent[] = ['claude', 'cursor', 'copilot', 'windsurf'];
const VALID_RECIPES: readonly RecipeId[] = [
  'api',
  'fullstack-react',
  'fullstack-vue',
  'ai-agent',
  'saas',
  'custom',
];

interface RecipePreset {
  readonly dbDriver: DbDriver;
  readonly includeAuth: boolean;
  readonly frontend: Frontend;
}

interface Recipe {
  readonly id: RecipeId;
  readonly label: string;
  readonly hint: string;
  readonly preset?: RecipePreset;
}

const RECIPES: readonly Recipe[] = [
  {
    id: 'api',
    label: 'API only',
    hint: 'sqlite · auth · no frontend — JSON API on day one',
    preset: { dbDriver: 'sqlite', includeAuth: true, frontend: 'none' },
  },
  {
    id: 'fullstack-react',
    label: 'Full-stack (React)',
    hint: 'sqlite · auth · React via Bridge',
    preset: { dbDriver: 'sqlite', includeAuth: true, frontend: 'react' },
  },
  {
    id: 'fullstack-vue',
    label: 'Full-stack (Vue)',
    hint: 'sqlite · auth · Vue 3 via Bridge',
    preset: { dbDriver: 'sqlite', includeAuth: true, frontend: 'vue' },
  },
  {
    id: 'ai-agent',
    label: 'AI agent app',
    hint: 'sqlite · auth · JSX views — agents + tool routes',
    preset: { dbDriver: 'sqlite', includeAuth: true, frontend: 'tsx' },
  },
  {
    id: 'saas',
    label: 'SaaS starter',
    hint: 'postgres · auth · React Bridge — production-shaped',
    preset: { dbDriver: 'postgres', includeAuth: true, frontend: 'react' },
  },
  {
    id: 'custom',
    label: 'Custom',
    hint: 'pick each option yourself',
  },
];

interface Args {
  projectName?: string;
  recipe?: RecipeId;
  db?: DbDriver;
  auth?: boolean;
  frontend?: Frontend;
  agents?: Agent[];
  yes: boolean;
  install?: boolean;
  git?: boolean;
  migrate?: boolean;
  help: boolean;
  version: boolean;
  unknown: string[];
}

function parseAgents(raw: string): Agent[] {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'none' || trimmed === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Agent => (VALID_AGENTS as readonly string[]).includes(s));
}

function parseArgs(argv: readonly string[]): Args {
  const out: Args = { yes: false, help: false, version: false, unknown: [] };
  const take = (i: number, name: string): [string, number] => {
    const eq = argv[i].indexOf('=');
    if (eq >= 0) return [argv[i].slice(eq + 1), i + 1];
    if (i + 1 >= argv.length) throw new Error(`${name} requires a value`);
    return [argv[i + 1], i + 2];
  };

  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    const flag = a.includes('=') ? a.slice(0, a.indexOf('=')) : a;

    if (flag === '--help' || flag === '-h') {
      out.help = true;
      i++;
      continue;
    }
    if (flag === '--version' || flag === '-v') {
      out.version = true;
      i++;
      continue;
    }
    if (flag === '--yes' || flag === '-y') {
      out.yes = true;
      i++;
      continue;
    }
    if (flag === '--auth') {
      out.auth = true;
      i++;
      continue;
    }
    if (flag === '--no-auth') {
      out.auth = false;
      i++;
      continue;
    }
    if (flag === '--install') {
      out.install = true;
      i++;
      continue;
    }
    if (flag === '--no-install') {
      out.install = false;
      i++;
      continue;
    }
    if (flag === '--git') {
      out.git = true;
      i++;
      continue;
    }
    if (flag === '--no-git') {
      out.git = false;
      i++;
      continue;
    }
    if (flag === '--migrate') {
      out.migrate = true;
      i++;
      continue;
    }
    if (flag === '--no-migrate') {
      out.migrate = false;
      i++;
      continue;
    }

    if (flag === '--db') {
      const [v, ni] = take(i, '--db');
      out.db = v as DbDriver;
      i = ni;
      continue;
    }
    if (flag === '--frontend') {
      const [v, ni] = take(i, '--frontend');
      out.frontend = v as Frontend;
      i = ni;
      continue;
    }
    if (flag === '--recipe') {
      const [v, ni] = take(i, '--recipe');
      out.recipe = v as RecipeId;
      i = ni;
      continue;
    }
    if (flag === '--agents') {
      const [v, ni] = take(i, '--agents');
      out.agents = parseAgents(v);
      i = ni;
      continue;
    }

    if (!a.startsWith('-') && out.projectName === undefined) {
      out.projectName = a;
      i++;
      continue;
    }

    out.unknown.push(a);
    i++;
  }
  return out;
}

function readPackageVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printHelp(): void {
  const bin = pc.cyan('create-faberjs');
  process.stdout.write(`
${pc.bold('FaberJS')} — scaffold a new project

${pc.bold('Usage')}
  ${bin} ${pc.dim('[project-name]')} ${pc.dim('[options]')}

${pc.bold('Options')}
  -y, --yes                  Accept all defaults (non-interactive)
      --recipe <id>          ${pc.dim('api | fullstack-react | fullstack-vue | ai-agent | saas | custom')}
      --db <driver>          ${pc.dim('sqlite | sqlite-wasm | postgres | mysql')}
      --auth, --no-auth      Include or skip auth scaffolding
      --frontend <kind>      ${pc.dim('none | tsx | ejs | react | vue')}
      --agents <list>        ${pc.dim('comma-separated: claude,cursor,copilot,windsurf,none')}
      --install, --no-install   Install dependencies after scaffold
      --git,     --no-git       Initialize a git repository
      --migrate, --no-migrate   Run db:migrate after install
  -h, --help                 Show this help
  -v, --version              Show version

${pc.bold('Examples')}
  ${pc.dim('# interactive')}
  npm create faberjs@latest my-app

  ${pc.dim('# pnpm passes flags directly')}
  pnpm create faberjs@latest my-app --recipe saas --yes

  ${pc.dim('# npm needs -- to pass flags through')}
  npm create faberjs@latest my-app -- --db postgres --frontend react --auth

  ${pc.dim('# fully non-interactive in CI')}
  npm create faberjs@latest my-app -- --recipe api --yes --no-install --no-git

`);
}

function detectPackageManager(): PackageManager {
  const ua = process.env.npm_config_user_agent ?? '';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  if (ua.startsWith('bun')) return 'bun';
  return 'npm';
}

function pmExec(pm: PackageManager): { cmd: string; args: string[] } {
  if (pm === 'pnpm') return { cmd: 'pnpm', args: ['exec'] };
  if (pm === 'yarn') return { cmd: 'yarn', args: [] };
  if (pm === 'bun') return { cmd: 'bunx', args: [] };
  return { cmd: 'npx', args: [] };
}

function runSilent(
  cmd: string,
  args: readonly string[],
  cwd: string,
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, [...args], {
      cwd,
      shell: process.platform === 'win32',
    });
    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('error', (err) => {
      resolve({ ok: false, output: `${output}\n${err.message}` });
    });
    child.on('exit', (code) => {
      resolve({ ok: code === 0, output });
    });
  });
}

function commandExists(bin: string): boolean {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(which, [bin], { encoding: 'utf8' });
  return result.status === 0;
}

function validateProjectName(name: string): string | undefined {
  if (!name) return 'Project name cannot be empty';
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    return 'Use letters, numbers, dots, dashes, or underscores; must start with letter or number';
  }
  return undefined;
}

function isCancelled<T>(value: T | symbol): value is symbol {
  return p.isCancel(value);
}

function ensureNotCancelled<T>(value: T | symbol): T {
  if (isCancelled(value)) {
    p.cancel('Cancelled. No files written.');
    process.exit(0);
  }
  return value;
}

interface ResolvedOptions {
  readonly opts: ScaffoldOptions;
  readonly recipeLabel: string;
}

async function resolveOptions(args: Args): Promise<ResolvedOptions> {
  const cwdName = path.basename(process.cwd());
  const defaultName = cwdName && cwdName !== '/' ? cwdName : 'my-faberjs-app';

  // 1. Project name
  let projectName = args.projectName;
  if (!projectName) {
    if (args.yes) {
      projectName = defaultName;
    } else {
      const result = await p.text({
        message: 'Project name',
        placeholder: defaultName,
        defaultValue: defaultName,
        validate: validateProjectName,
      });
      projectName = ensureNotCancelled(result);
    }
  }

  const targetDir = path.resolve(process.cwd(), projectName);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    if (args.yes) {
      throw new Error(`Target directory "${projectName}" is not empty`);
    }
    const proceed = await p.confirm({
      message: `Directory "${projectName}" is not empty. Continue and overwrite?`,
      initialValue: false,
    });
    if (!ensureNotCancelled(proceed)) {
      p.cancel('Aborted.');
      process.exit(0);
    }
  }

  // 2. Recipe
  let recipeId: RecipeId;
  if (args.recipe) {
    if (!(VALID_RECIPES as readonly string[]).includes(args.recipe)) {
      throw new Error(`Unknown --recipe "${args.recipe}". Valid: ${VALID_RECIPES.join(', ')}`);
    }
    recipeId = args.recipe;
  } else if (
    args.yes ||
    args.db !== undefined ||
    args.frontend !== undefined ||
    args.auth !== undefined
  ) {
    recipeId = 'custom';
  } else {
    const choice = await p.select<RecipeId>({
      message: 'Choose a starting point',
      options: RECIPES.map((r) => ({ value: r.id, label: r.label, hint: r.hint })),
      initialValue: 'api',
    });
    recipeId = ensureNotCancelled(choice);
  }
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);

  // 3. Build options — recipe preset + flag overrides + (custom-only) prompts
  const preset: Partial<RecipePreset> = recipe.preset ?? {};

  let dbDriver: DbDriver | undefined = args.db ?? preset.dbDriver;
  let includeAuth: boolean | undefined = args.auth ?? preset.includeAuth;
  let frontend: Frontend | undefined = args.frontend ?? preset.frontend;

  if (recipeId === 'custom') {
    if (dbDriver === undefined) {
      if (args.yes) {
        dbDriver = 'sqlite';
      } else {
        const v = await p.select<DbDriver>({
          message: 'Database driver',
          options: [
            { value: 'sqlite', label: 'SQLite', hint: 'fastest start, single file' },
            { value: 'sqlite-wasm', label: 'SQLite (WASM)', hint: 'pure-JS, edge-compatible' },
            { value: 'postgres', label: 'PostgreSQL', hint: 'production default' },
            { value: 'mysql', label: 'MySQL', hint: '' },
          ],
          initialValue: 'sqlite',
        });
        dbDriver = ensureNotCancelled(v);
      }
    }
    if (includeAuth === undefined) {
      if (args.yes) {
        includeAuth = true;
      } else {
        const v = await p.confirm({ message: 'Include auth scaffolding?', initialValue: true });
        includeAuth = ensureNotCancelled(v);
      }
    }
    if (frontend === undefined) {
      if (args.yes) {
        frontend = 'none';
      } else {
        const v = await p.select<Frontend>({
          message: 'Frontend / view engine',
          options: [
            { value: 'none', label: 'None', hint: 'JSON API only' },
            { value: 'tsx', label: 'JSX views', hint: 'Blade-equivalent server-side rendering' },
            { value: 'ejs', label: 'EJS views', hint: '' },
            { value: 'react', label: 'React (Bridge)', hint: 'Inertia-style SPA' },
            { value: 'vue', label: 'Vue 3 (Bridge)', hint: 'Inertia-style SPA' },
          ],
          initialValue: 'none',
        });
        frontend = ensureNotCancelled(v);
      }
    }
  }

  if (dbDriver === undefined || !(VALID_DBS as readonly string[]).includes(dbDriver)) {
    throw new Error(`Invalid --db "${String(dbDriver)}". Valid: ${VALID_DBS.join(', ')}`);
  }
  if (frontend === undefined || !(VALID_FRONTENDS as readonly string[]).includes(frontend)) {
    throw new Error(
      `Invalid --frontend "${String(frontend)}". Valid: ${VALID_FRONTENDS.join(', ')}`,
    );
  }
  if (includeAuth === undefined) includeAuth = true;

  // 4. Agents
  let agents: Agent[];
  if (args.agents !== undefined) {
    agents = args.agents;
  } else if (args.yes) {
    agents = ['claude'];
  } else {
    const v = await p.multiselect<Agent>({
      message: 'Coding agent integrations',
      options: [
        { value: 'claude', label: 'Claude Code', hint: 'CLAUDE.md + .claude/' },
        { value: 'cursor', label: 'Cursor', hint: '.cursor/rules/' },
        { value: 'copilot', label: 'GitHub Copilot', hint: '.github/copilot-instructions.md' },
        { value: 'windsurf', label: 'Windsurf', hint: '.windsurf/rules/' },
      ],
      initialValues: ['claude'],
      required: false,
    });
    agents = ensureNotCancelled(v);
  }

  return {
    opts: { projectName, targetDir, dbDriver, includeAuth, frontend, agents },
    recipeLabel: recipe.label,
  };
}

interface PostActions {
  readonly install: boolean;
  readonly git: boolean;
  readonly migrate: boolean;
}

async function resolvePostActions(args: Args, hasGit: boolean): Promise<PostActions> {
  const allFlagsSet =
    args.install !== undefined && args.git !== undefined && args.migrate !== undefined;

  if (allFlagsSet || args.yes) {
    return {
      install: args.install ?? true,
      git: (args.git ?? true) && hasGit,
      migrate: args.migrate ?? true,
    };
  }

  const initial: Array<'install' | 'git' | 'migrate'> = ['install', 'migrate'];
  if (hasGit) initial.unshift('git');

  const options = [
    { value: 'install' as const, label: 'Install dependencies', hint: 'so the app boots' },
    {
      value: 'git' as const,
      label: hasGit ? 'Initialize git repository' : pc.dim('Initialize git (git not found)'),
      hint: hasGit ? 'first commit included' : 'install git to enable',
    },
    { value: 'migrate' as const, label: 'Run first migration', hint: 'requires install' },
  ];

  const picked = await p.multiselect<'install' | 'git' | 'migrate'>({
    message: 'What should we do next?',
    options,
    initialValues: initial,
    required: false,
  });
  const set = new Set(ensureNotCancelled(picked));
  return {
    install: args.install ?? set.has('install'),
    git: (args.git ?? set.has('git')) && hasGit,
    migrate: args.migrate ?? set.has('migrate'),
  };
}

async function runPostActions(
  opts: ScaffoldOptions,
  actions: PostActions,
  pm: PackageManager,
): Promise<{ installed: boolean; migrated: boolean; gitInited: boolean }> {
  let installed = false;
  let migrated = false;
  let gitInited = false;

  if (actions.git) {
    const s = p.spinner();
    s.start('Initializing git repository');
    const init = await runSilent('git', ['init', '-q'], opts.targetDir);
    if (init.ok) {
      await runSilent('git', ['add', '.'], opts.targetDir);
      const commit = await runSilent(
        'git',
        ['commit', '-q', '-m', 'chore: initial commit from create-faberjs'],
        opts.targetDir,
      );
      if (commit.ok) {
        gitInited = true;
        s.stop('Initialized git repository');
      } else {
        s.stop(
          pc.yellow('Git initialized, but commit failed (configure user.email and user.name)'),
        );
        gitInited = true;
      }
    } else {
      s.stop(pc.yellow('Skipped git init'));
    }
  }

  if (actions.install) {
    const s = p.spinner();
    s.start(`Installing dependencies with ${pm}`);
    const result = await runSilent(pm, ['install'], opts.targetDir);
    if (result.ok) {
      installed = true;
      s.stop(`Installed dependencies with ${pm}`);
    } else {
      s.stop(pc.red(`${pm} install failed — run it manually to see the error`));
    }
  }

  if (actions.migrate) {
    if (!installed && !actions.install) {
      p.log.warn('Skipping migration — dependencies were not installed.');
    } else if (!installed) {
      p.log.warn('Skipping migration — dependency install did not complete.');
    } else {
      const s = p.spinner();
      s.start('Running first migration');
      const exec = pmExec(pm);
      const result = await runSilent(
        exec.cmd,
        [...exec.args, 'faber', 'db:migrate'],
        opts.targetDir,
      );
      if (result.ok) {
        migrated = true;
        s.stop('Database migrated');
      } else {
        s.stop(pc.red('Migration failed — run `faber db:migrate` manually to debug'));
      }
    }
  }

  return { installed, migrated, gitInited };
}

function printBanner(): void {
  const lines = ['  ◉━━━━━━━━━━━━━━━━◉', '  ┃', '  ◉━━━━━━━━━━━━◉', '  ┃', '  ◉'];
  const width = Math.max(...lines.map((l) => l.length));
  const name = pc.bold(pc.cyan('FaberJS'));
  const tagline = pc.dim('A Laravel-inspired backend framework');
  const sub = pc.dim('for Node.js + TypeScript');
  process.stdout.write('\n');
  for (let i = 0; i < lines.length; i++) {
    const glyph = pc.cyan(lines[i]);
    const pad = ' '.repeat(width - lines[i].length);
    if (i === 0) process.stdout.write(`${glyph}${pad}   ${pc.bold('Welcome to')} ${name}\n`);
    else if (i === 2) process.stdout.write(`${glyph}${pad}   ${tagline}\n`);
    else if (i === 4) process.stdout.write(`${glyph}${pad}   ${sub}\n`);
    else process.stdout.write(`${glyph}\n`);
  }
  process.stdout.write('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }
  if (args.version) {
    process.stdout.write(`${readPackageVersion()}\n`);
    return;
  }
  if (args.unknown.length > 0) {
    process.stderr.write(
      pc.yellow(`Ignoring unknown argument(s): ${args.unknown.join(', ')}\n`) +
        pc.dim('Run with --help for usage.\n'),
    );
  }

  printBanner();
  p.intro(pc.bgCyan(pc.black(' create-faberjs ')));

  const { opts, recipeLabel } = await resolveOptions(args);

  const start = Date.now();
  let activeSpinner: ReturnType<typeof p.spinner> | null = null;
  const onStep: StepCallback = (label, done) => {
    if (!done) {
      activeSpinner = p.spinner();
      activeSpinner.start(label);
    } else if (activeSpinner) {
      activeSpinner.stop(label);
      activeSpinner = null;
    }
  };

  await scaffoldProject(opts, onStep);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const summary = [
    `${pc.bold('Recipe')}    ${recipeLabel}`,
    `${pc.bold('Database')}  ${opts.dbDriver}`,
    `${pc.bold('Auth')}      ${opts.includeAuth ? 'yes' : 'no'}`,
    `${pc.bold('Frontend')}  ${opts.frontend}`,
    `${pc.bold('Agents')}    ${opts.agents && opts.agents.length > 0 ? opts.agents.join(', ') : 'none'}`,
    `${pc.bold('Time')}      ${elapsed}s`,
  ].join('\n');
  p.note(summary, 'Scaffold complete');

  const pm = detectPackageManager();
  const hasGit = commandExists('git');
  const actions = await resolvePostActions(args, hasGit);
  const ranAny = actions.install || actions.git || actions.migrate;
  const { installed, migrated, gitInited } = ranAny
    ? await runPostActions(opts, actions, pm)
    : { installed: false, migrated: false, gitInited: false };

  const exec = pmExec(pm);
  const execStr = `${exec.cmd}${exec.args.length > 0 ? ` ${exec.args.join(' ')}` : ''}`.trim();
  const next: string[] = [`${pc.cyan('cd')} ${opts.projectName}`];
  if (!installed) next.push(`${pc.cyan(pm)} install`);
  if (!migrated) next.push(`${pc.cyan(execStr)} faber db:migrate`);
  next.push(`${pc.cyan(execStr)} faber serve`);
  if (!gitInited && hasGit) {
    next.push(
      `${pc.cyan('git')} init && ${pc.cyan('git')} add . && ${pc.cyan('git')} commit -m "init"`,
    );
  }

  p.note(next.join('\n'), 'Next steps');
  p.outro(`${pc.green('✓')} ${pc.bold('Happy building!')}  ${pc.dim('https://faberjs.dev')}`);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `\n  ${pc.bold(pc.red('Error'))}  ${err instanceof Error ? err.message : String(err)}\n\n`,
  );
  process.exit(1);
});
