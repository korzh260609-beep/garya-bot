import { randomUUID } from 'node:crypto';
import { createPostgresObservabilityStore, createPostgresPersistence } from '../persistence/index.js';
import { createObservabilityService } from '../observability/observabilityService.js';
import { createTemporalContextService } from '../temporal/temporalContextService.js';
import { createRecurrenceEngine } from '../temporal/recurrenceEngine.js';
import { createOwnerSecurityConfig, createOwnerSecurityGateway, createSecurityPolicyRegistry } from '../security/ownerSecurity.js';
import { createSecurityOperationsConfig } from '../operations/securityOperations.js';
import { createPostgresTaskQueue } from './postgresTaskQueue.js';
import { createPostgresRecurringScheduler } from './postgresRecurringScheduler.js';
import { createDurableWorker } from './durableWorker.js';
import { createProductionWorkerActionGate, createProductionWorkerExecutor } from './productionWorkerExecution.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for durable worker');

const persistence = createPostgresPersistence({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true',
  applicationName: 'sg-2-1-durable-worker'
});
await persistence.start();

const baseQueue = createPostgresTaskQueue({ database: persistence.database });
const temporalService = createTemporalContextService();
const recurrenceEngine = createRecurrenceEngine({ temporalService });
const recurringScheduler = createPostgresRecurringScheduler({ database: persistence.database, recurrenceEngine });
const queue = Object.freeze({
  ...baseQueue,
  async releaseDue(limit = 100) {
    await recurringScheduler.materializeDue({ limit });
    return baseQueue.releaseDue(limit);
  }
});
const observabilityStore = createPostgresObservabilityStore({ observabilityRepository: persistence.repositories.observability });
const observability = createObservabilityService({ store: observabilityStore });
const environment = process.env.SG_ENVIRONMENT ?? 'worker';
const revision = process.env.SG_REVISION ?? 'unknown';
const ownerSecurityGateway = createOwnerSecurityGateway({
  config: createOwnerSecurityConfig(process.env),
  policyRegistry: createSecurityPolicyRegistry(),
  observability,
  environment,
  revision
});
const verifyMode = process.env.SG_WORKER_VERIFY === '1' || process.env.SG_ENVIRONMENT === 'ci';
const operationsConfig = createSecurityOperationsConfig(process.env);

if (operationsConfig.automationDisabled && !verifyMode) {
  console.log(JSON.stringify({ status: 'worker-disabled', reason: 'automation-emergency-disabled', revision }));
  await observabilityStore.close();
  await persistence.close();
  process.exit(0);
}

const workerId = process.env.SG_WORKER_ID ?? `worker:${randomUUID()}`;
const worker = createDurableWorker({
  workerId,
  queue,
  observability,
  environment,
  revision,
  actionGate: createProductionWorkerActionGate({ verifyMode, ownerSecurityGateway }),
  executor: createProductionWorkerExecutor({ verifyMode }),
  leaseMs: Number(process.env.SG_WORKER_LEASE_MS ?? 30000),
  heartbeatMs: Number(process.env.SG_WORKER_HEARTBEAT_MS ?? 10000),
  pollMs: Number(process.env.SG_WORKER_POLL_MS ?? 1000)
});

async function shutdown(signal) {
  await worker.stop();
  await observabilityStore.close();
  await persistence.close();
  console.log(JSON.stringify({ status: 'worker-stopped', signal, health: worker.health() }));
}

if (verifyMode) {
  const suffix = randomUUID();
  await persistence.database.query(`UPDATE tasks SET status='cancelled',cancellation_reason='worker_verification_isolation',lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,updated_at=now()
    WHERE status IN ('scheduled','waiting_approval','queued','running')`);
  await queue.submit({
    taskId: `worker-verification:${suffix}`,
    kind: 'worker-verification',
    scope: { globalUserId: `worker-verification:${suffix}`, projectScope: process.env.SG_PROJECT_SCOPE ?? 'sg2.1' },
    payload: { verification: true, traceContext: { traceId: suffix, requestId: suffix } },
    maxAttempts: 1,
    idempotencyKey: `worker-verification:${suffix}`
  });
  const result = await worker.runOnce();
  if (result?.task_id !== `worker-verification:${suffix}` || result.status !== 'completed') throw new Error('durable worker task verification failed');
  await observabilityStore.flush();
  const persistedEvents = await persistence.database.query(
    `SELECT payload->'data'->>'workerEvent' AS worker_event FROM observability_events WHERE trace_id=$1 AND stage='durable-worker' ORDER BY event_id`,
    [suffix]
  );
  const workerEvents = persistedEvents.rows.map((row) => row.worker_event);
  if (!workerEvents.includes('worker_task_claimed') || !workerEvents.includes('worker_task_completed')) throw new Error('durable worker observability verification failed');
  console.log(JSON.stringify({ status: 'worker-ready', health: worker.health(), task: { id: result.task_id, status: result.status }, durableObservabilityEvents: workerEvents }));
  await shutdown('verification-complete');
} else {
  await worker.start();
  console.log(JSON.stringify({ status: 'worker-ready', health: worker.health(), ownerSecurity: ownerSecurityGateway.status(), operations: { automationDisabled: operationsConfig.automationDisabled } }));
  process.once('SIGTERM', () => shutdown('SIGTERM').then(() => process.exit(0)));
  process.once('SIGINT', () => shutdown('SIGINT').then(() => process.exit(0)));
}
