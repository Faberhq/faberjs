export interface LoopMeta {
  /** Zero-based index of the current iteration. */
  readonly index: number;
  /** One-based iteration counter. */
  readonly iteration: number;
  /** Iterations remaining after the current one. */
  readonly remaining: number;
  /** Total number of items in the array. */
  readonly count: number;
  /** True on the first iteration. */
  readonly first: boolean;
  /** True on the last iteration. */
  readonly last: boolean;
  /** True on even iterations (0, 2, 4 …). */
  readonly even: boolean;
  /** True on odd iterations (1, 3, 5 …). */
  readonly odd: boolean;
  /** Nesting depth — 1 for the outermost loop. */
  readonly depth: number;
  /** The parent loop's LoopMeta, or null when not nested. */
  readonly parent: LoopMeta | null;
}

// Module-level stack is safe because JSX component rendering is fully
// synchronous — no awaits happen inside component function bodies.
const loopStack: LoopMeta[] = [];

/**
 * Wrap an Array.map() callback to receive a `$loop` metadata object as a
 * second argument. Equivalent to Blade's `$loop` variable.
 *
 * @example
 * users.map(loop((user, $loop) => (
 *   <li class={cls({ first: $loop.first, last: $loop.last })}>{user.name}</li>
 * )))
 */
export function loop<T, R>(
  fn: (item: T, $loop: LoopMeta) => R,
): (item: T, index: number, arr: T[]) => R {
  return (item: T, index: number, arr: T[]): R => {
    const parent = loopStack.at(-1) ?? null;
    const meta: LoopMeta = {
      index,
      iteration: index + 1,
      remaining: arr.length - 1 - index,
      count: arr.length,
      first: index === 0,
      last: index === arr.length - 1,
      even: index % 2 === 0,
      odd: index % 2 !== 0,
      depth: loopStack.length + 1,
      parent,
    };
    loopStack.push(meta);
    try {
      return fn(item, meta);
    } finally {
      loopStack.pop();
    }
  };
}
