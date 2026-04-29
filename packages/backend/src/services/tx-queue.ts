import { randomUUID } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import type { Logger } from 'pino';
import * as superjson from 'superjson';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type JobRecord = {
  readonly id: string;
  readonly name: string;
  readonly status: JobStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
  readonly result?: string;
  readonly error?: string;
};

type QueueTask = {
  readonly id: string;
  readonly run: () => Promise<unknown>;
};

const serializeError = (error: unknown, depth = 0): string => {
  if (depth > 4) return '[max depth]';
  if (error == null) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const record = error as unknown as Record<string, unknown>;
    const parts = [`${error.name}: ${error.message}`];
    for (const key of ['cause', 'reason', 'details', 'code']) {
      if (record[key] != null) parts.push(`${key}: ${serializeError(record[key], depth + 1)}`);
    }
    return parts.join(' | ');
  }
  if (typeof error === 'object') {
    try {
      const record = error as Record<string, unknown>;
      const parts = Object.entries(record)
        .filter(([, value]) => value != null)
        .map(([key, value]) => `${key}: ${serializeError(value, depth + 1)}`);
      return parts.length > 0 ? parts.join(' | ') : JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

export class TxQueue {
  private readonly jobs: Collection<JobRecord>;
  private readonly tasks: QueueTask[] = [];
  private processing = false;

  constructor(db: Db, private readonly logger: Logger) {
    this.jobs = db.collection<JobRecord>('veil_tx_jobs');
  }

  async init(): Promise<void> {
    await this.jobs.createIndex({ id: 1 }, { unique: true });
    await this.jobs.createIndex({ status: 1, createdAt: 1 });
  }

  async enqueue(name: string, run: () => Promise<unknown>): Promise<JobRecord> {
    const now = new Date();
    const job: JobRecord = {
      id: randomUUID(),
      name,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };

    await this.jobs.insertOne(job);
    this.tasks.push({ id: job.id, run });
    void this.drain();
    return job;
  }

  async get(id: string): Promise<JobRecord | null> {
    return this.jobs.findOne({ id });
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.tasks.length > 0) {
        const task = this.tasks.shift();
        if (!task) continue;
        await this.runTask(task);
      }
    } finally {
      this.processing = false;
    }
  }

  private async runTask(task: QueueTask): Promise<void> {
    await this.jobs.updateOne(
      { id: task.id },
      { $set: { status: 'running', startedAt: new Date(), updatedAt: new Date() } },
    );

    try {
      const result = await task.run();
      await this.jobs.updateOne(
        { id: task.id },
        {
          $set: {
            status: 'succeeded',
            result: superjson.stringify(result),
            finishedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
    } catch (error) {
      const message = serializeError(error);
      this.logger.error({ jobId: task.id, err: error, message }, 'Queued transaction failed');
      await this.jobs.updateOne(
        { id: task.id },
        {
          $set: {
            status: 'failed',
            error: message,
            finishedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
    }
  }
}

export const formatJob = (job: JobRecord): Record<string, unknown> => ({
  id: job.id,
  name: job.name,
  status: job.status,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  result: job.result ? superjson.parse(job.result) : undefined,
  error: job.error,
});
