import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../persistence/index.js';
import { createPostgresTaskQueue } from './postgresTaskQueue.js';
import { createDurableWorker } from './durableWorker.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for durable worker');

const persistence = createPostgresPersistence({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true',
  applicationName: 'sg-2-1-durable-worker'
});
await persistence.start();

const queue = createPostgresTaskQueue({ database: persistence.database });
const verifyMode = process.env.SG_WORKER_VERIFY === '1' || process.env.SG_ENVIRONMENT === 'ci';
const workerId = process.env.SG_WORKER_ID ?? `worker:${randomUUID()}`;

const worker = createDurableWorker({
  workerId,
  queue,
  actionGate: async () => ({ outcome: 'allow', allowed: true }),
  executor: async ({ kind, payload }) => {
    if (!verifyMode) throw new Error(`No production executor registered for task kind: ${kind}`);
    return { verified: true, kind, payload };
  },
  leaseMs: Number(process.env.SG_WORKER_LEASE_MS ?? 30000),
  heartbeatMs: Number(process.env.SG_WORKER_HEARTBEAT_MS ?? 10000),
  pollMs: Number(process.env.SG_WORKER_POLL_MS ?? 1000)
});

async function shutdown(signal) {
  await worker.stop();
  await persistence.close();
  console.log(JSON.stringify({ status: 'worker-stopped', signal, health: worker.health() }));
}

if (verifyMode) {
  const suffix = randomUUID();
  await queue.submit({
    taskId: `worker-verification:${suffix}`,
    kind: 'worker-verification',
    scope: { globalUserId: `worker-verification:${suffix}`, projectScope: process.env.SG_PROJECT_SCOPE ?? 'sg2.1' },
    payload: { verification: true },
    maxAttempts: 1,
    idempotencyKey: `worker-verification:${suffix}`
  });
  const result = await worker.runOnce();
  console.log(JSON.stringify({ status: 'worker-ready', health: worker.health(), task: { id: result.task_id, status: result.status } }));
  await shutdown('verification-complete');
} else {
  await worker.start();
  console.log(JSON.stringify({ status: 'worker-ready', health: worker.health() }));
  process.once('SIGTERM', () => shutdown('SIGTERM').then(() => process.exit(0)));
  process.once('SIGINT', () => shutdown('SIGINT').then(() => process.exit(0)));
}
