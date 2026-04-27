import { Application } from '@faber-js/core';
import type { JobContract, QueueContract } from './types';

export async function dispatch(job: JobContract): Promise<void> {
  const app = Application.getInstance();

  if (!app.bound('queue')) {
    throw new Error(
      'No queue service registered. Add QueueServiceProvider to your bootstrap/app.ts.',
    );
  }

  return app.make<QueueContract>('queue').dispatch(job);
}
