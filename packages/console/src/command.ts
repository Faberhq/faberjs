import { log } from './ui';

export abstract class Command {
  abstract readonly signature: string;
  abstract readonly description: string;

  abstract handle(...args: unknown[]): Promise<void> | void;

  info(message: string): void {
    log.info(message);
  }
  success(message: string): void {
    log.done(message);
  }
  warn(message: string): void {
    log.warn(message);
  }
  error(message: string): void {
    log.error(message);
  }

  line(message = ''): void {
    process.stdout.write(`${message}\n`);
  }

  // Returns the value of --name or --name=value from process.argv.
  // Falls back to defaultValue if the flag is absent.
  option(name: string, defaultValue?: string): string | undefined {
    const argv = process.argv;
    const eqPrefix = `--${name}=`;
    const eqArg = argv.find((a) => a.startsWith(eqPrefix));
    if (eqArg !== undefined) return eqArg.slice(eqPrefix.length);
    const idx = argv.indexOf(`--${name}`);
    if (idx !== -1) {
      const next = argv[idx + 1];
      // If the next token looks like another flag, treat this as a boolean flag with no value.
      if (next !== undefined && !next.startsWith('--')) return next;
      return defaultValue ?? '';
    }
    return defaultValue;
  }

  // Returns true when --name is present in process.argv (with or without a value).
  hasOption(name: string): boolean {
    const argv = process.argv;
    return argv.includes(`--${name}`) || argv.some((a) => a.startsWith(`--${name}=`));
  }
}
