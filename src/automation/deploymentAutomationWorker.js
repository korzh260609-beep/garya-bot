import { createDurableWorker } from './durableWorker.js';
import { createProductionWorkerActionGate, createProductionWorkerExecutor } from './productionWorkerExecution.js';
import { createSecurityOperationsConfig } from '../operations/securityOperations.js';

export function createDeploymentAutomationWorker({ harness, deliveryRouter, env = process.env } = {}) {
  if (!harness?.durableTaskQueue || !harness?.recurringScheduler) throw new TypeError('durable task queue and recurring scheduler are required');
  if (!deliveryRouter?.route) throw new TypeError('deliveryRouter.route is required');

  const operations = createSecurityOperationsConfig(env);
  const queue = Object.freeze({
    ...harness.durableTaskQueue,
    async releaseDue(limit = 100) {
      await harness.recurringScheduler.materializeDue({ limit });
      return harness.durableTaskQueue.releaseDue(limit);
    }
  });

  const worker = createDurableWorker({
    workerId: `web-automation:${harness.config.revision}`,
    queue,
    observability: harness.observability,
    environment: harness.config.environment,
    revision: harness.config.revision,
    actionGate: createProductionWorkerActionGate({ ownerSecurityGateway: harness.ownerSecurityGateway }),
    executor: createProductionWorkerExecutor({ deliveryRouter }),
    leaseMs: Number(env.SG_WORKER_LEASE_MS ?? 30000),
    heartbeatMs: Number(env.SG_WORKER_HEARTBEAT_MS ?? 10000),
    pollMs: Number(env.SG_WORKER_POLL_MS ?? 1000)
  });

  let disabled = operations.automationDisabled;
  return Object.freeze({
    async start() {
      if (disabled) return this.health();
      return worker.start();
    },
    async stop() {
      if (disabled) return this.health();
      return worker.stop();
    },
    async runOnce() {
      if (disabled) return null;
      return worker.runOnce();
    },
    health() {
      if (disabled) return Object.freeze({ ok: true, phase: 'disabled', accepting: false, reason: 'automation-emergency-disabled' });
      return worker.health();
    },
    enabled: !disabled
  });
}
