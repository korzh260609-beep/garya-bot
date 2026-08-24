import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCredentialManager,
  createInMemorySecretStore
} from '../src/secrets/credentialManager.js';
import {
  WORKFLOW_EXECUTION_SECURITY_CHECKS,
  createWorkflowExecutionSecurity
} from '../src/automation/workflowExecutionSecurity.js';
import { createRuntimeFreshDataCollectHandler } from '../src/automation/runtimeFreshDataCollection.js';

const actor = Object.freeze({
  globalUserId: 'user:aw219',
  grants: Object.freeze(['credential:use'])
});
const scope = Object.freeze({
  globalUserId: actor.globalUserId,
  projectScope: 'sg2.1',
  groupScope: null,
  threadScope: null
});

function registeredCredential({ secretStore, audit = () => {} }) {
  const manager = createCredentialManager({
    secretStore,
    audit,
    clock: () => new Date('2026-08-17T20:00:00.000Z')
  });
  manager.registerCredential({
    credentialId: 'credential:aw219',
    type: 'api-key',
    secretRef: { provider: 'memory', key: 'AW219_SECRET' },
    ownerUserId: actor.globalUserId,
    projectScope: scope.projectScope,
    requiredPermission: 'credential:use',
    metadata: { purpose: 'aw2.19-regression' }
  });
  return manager;
}

test('AW2.19 keeps credential secret material inside the authorized callback and out of public/audit evidence', async () => {
  const secret = 'aw219-secret-material-must-not-escape';
  const audit = [];
  const manager = registeredCredential({
    secretStore: createInMemorySecretStore({ AW219_SECRET: secret }),
    audit: (event) => audit.push(event)
  });

  let callbackSecret = null;
  const result = await manager.useCredential({
    credentialId: 'credential:aw219',
    actor,
    scope,
    purpose: 'aw2.19-authorized-use',
    operation: async (raw, record) => {
      callbackSecret = raw;
      assert.equal(record.credentialId, 'credential:aw219');
      assert.equal(JSON.stringify(record).includes(secret), false);
      return { ok: true };
    }
  });

  assert.equal(callbackSecret, secret);
  assert.deepEqual(result, { ok: true });
  const externallyVisible = JSON.stringify({
    described: manager.describeCredential('credential:aw219'),
    listed: manager.listCredentials(),
    audit,
    result
  });
  assert.equal(externallyVisible.includes(secret), false);
  assert.equal(externallyVisible.includes('AW219_SECRET'), false);
  assert.throws(
    () => manager.registerCredential({
      credentialId: 'credential:aw219:unsafe',
      type: 'api-key',
      secretRef: { provider: 'memory', key: 'AW219_SECRET' },
      ownerUserId: actor.globalUserId,
      projectScope: scope.projectScope,
      metadata: { apiKey: secret }
    }),
    /metadata must not contain secret material/
  );
});

test('AW2.19 rejects cross-scope credential use before reading secret storage', async () => {
  const secret = 'aw219-cross-scope-secret';
  let reads = 0;
  const manager = registeredCredential({
    secretStore: {
      async read() {
        reads += 1;
        return secret;
      }
    }
  });

  await assert.rejects(
    () => manager.useCredential({
      credentialId: 'credential:aw219',
      actor: { globalUserId: 'user:other', grants: ['credential:use'] },
      scope,
      purpose: 'aw2.19-cross-scope-attempt',
      operation: async () => ({ ok: true })
    }),
    (error) => error.code === 'credential-user-scope-mismatch'
  );
  assert.equal(reads, 0);
});

test('AW2.19 bounds and redacts current-security snapshots before runtime handlers or history can receive them', async () => {
  const secret = 'aw219-snapshot-secret';
  const checks = Object.fromEntries(
    WORKFLOW_EXECUTION_SECURITY_CHECKS.map((name) => [name, async () => ({
      allowed: true,
      reason: `${name}-allowed`,
      evidenceRefs: [`security:${name}`],
      snapshot: name === 'credentials'
        ? {
            credentialId: 'credential:aw219',
            accessToken: secret,
            nested: { password: secret },
            privateProfile: { email: 'private@example.invalid' },
            note: 'x'.repeat(900)
          }
        : { status: 'current' }
    })])
  );
  const security = createWorkflowExecutionSecurity({
    checks,
    clock: () => '2026-08-17T20:00:00.000Z'
  });
  const verdict = await security.recheckProtectedStep({
    taskId: 'task:aw219',
    workflow: { automationId: 'automation:aw219', version: 1, scope },
    stepIndex: 0,
    step: { type: 'collect', security: { protected: true } }
  });

  assert.equal(verdict.allowed, true);
  const credentialSnapshot = verdict.checks.credentials.snapshot;
  assert.equal(credentialSnapshot.accessToken, '[REDACTED]');
  assert.equal(credentialSnapshot.nested.password, '[REDACTED]');
  assert.equal(credentialSnapshot.privateProfile, '[REDACTED]');
  assert.match(credentialSnapshot.note, /\[TRUNCATED\]$/);
  assert.equal(JSON.stringify(verdict).includes(secret), false);
  assert.equal(Object.isFrozen(credentialSnapshot), true);
});

test('AW2.19 fresh-data runtime exposes current scoped evidence but not stored private workflow inputs or prior handoff', async () => {
  const storedPrivate = 'aw219-stored-private-value';
  const priorPrivate = 'aw219-prior-private-value';
  let collectorContext = null;
  const handler = createRuntimeFreshDataCollectHandler({
    collectCurrent: async (context) => {
      collectorContext = context;
      return {
        data: { current: true },
        sourceMetadata: { source: 'aw2.19-current' },
        evidenceRefs: ['source:aw219']
      };
    },
    clock: () => '2026-08-17T20:00:01.000Z'
  });

  const result = await handler({
    taskId: 'task:aw219',
    workflow: {
      automationId: 'automation:aw219',
      version: 1,
      scope,
      inputs: { privateData: storedPrivate }
    },
    stepIndex: 0,
    step: {
      type: 'collect',
      security: { protected: true },
      source: { capability: 'workspace-activity' }
    },
    handoff: { output: { privateData: priorPrivate } },
    securityVerdict: {
      allowed: true,
      evaluatedAt: '2026-08-17T20:00:00.000Z',
      evidenceRefs: ['security:current']
    },
    traceContext: { traceId: 'trace:aw219', requestId: 'request:aw219' }
  });

  const serializedContext = JSON.stringify(collectorContext);
  assert.equal(serializedContext.includes(storedPrivate), false);
  assert.equal(serializedContext.includes(priorPrivate), false);
  assert.equal(Object.hasOwn(collectorContext, 'workflowInputs'), false);
  assert.equal(Object.hasOwn(collectorContext, 'handoff'), false);
  assert.deepEqual(result.output.data, { current: true });
  assert.deepEqual(result.evidenceRefs, ['source:aw219']);
});
