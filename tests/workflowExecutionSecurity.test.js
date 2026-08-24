import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKFLOW_EXECUTION_SECURITY_CHECKS,
  createWorkflowExecutionSecurity
} from '../src/automation/workflowExecutionSecurity.js';

function protectedContext() {
  return {
    taskId: 'task:aw2.4:security',
    workflow: { automationId: 'automation:aw2.4:security' },
    step: { type: 'invoke-capability', security: { protected: true } },
    stepIndex: 0,
    handoff: { workflowInputs: {} },
    traceContext: { traceId: 'trace:1', requestId: 'request:1' }
  };
}

function allowedChecks(calls = []) {
  return Object.fromEntries(WORKFLOW_EXECUTION_SECURITY_CHECKS.map((name) => [name, async () => {
    calls.push(name);
    return { allowed: true, evidenceRefs: [`security:${name}`] };
  }]));
}

test('AW2.4 rechecks every required security dimension in deterministic order', async () => {
  const calls = [];
  const security = createWorkflowExecutionSecurity({
    checks: allowedChecks(calls),
    clock: () => '2026-08-16T14:30:00.000Z'
  });

  const verdict = await security.recheckProtectedStep(protectedContext());

  assert.equal(verdict.allowed, true);
  assert.equal(verdict.protected, true);
  assert.deepEqual(calls, WORKFLOW_EXECUTION_SECURITY_CHECKS);
  assert.deepEqual(verdict.evidenceRefs, WORKFLOW_EXECUTION_SECURITY_CHECKS.map((name) => `security:${name}`));
  assert.equal(verdict.evaluatedAt, '2026-08-16T14:30:00.000Z');
});

test('AW2.4 stops at first current-authority denial and does not run later checks', async () => {
  const calls = [];
  const checks = allowedChecks(calls);
  checks.resourceAuthority = async () => {
    calls.push('resourceAuthority');
    return { allowed: false, reason: 'resource-authority-revoked', evidenceRefs: ['authority:revoked'] };
  };
  const security = createWorkflowExecutionSecurity({ checks });

  const verdict = await security.recheckProtectedStep(protectedContext());

  assert.equal(verdict.allowed, false);
  assert.equal(verdict.failedCheck, 'resourceAuthority');
  assert.equal(verdict.reason, 'resource-authority-revoked');
  assert.deepEqual(calls, ['identity', 'access', 'resourceAuthority']);
});

test('AW2.4 fails closed when a current security check throws', async () => {
  const calls = [];
  const checks = allowedChecks(calls);
  checks.credentials = async () => {
    calls.push('credentials');
    const error = new Error('credential manager unavailable');
    error.code = 'credential_manager_unavailable';
    throw error;
  };
  const security = createWorkflowExecutionSecurity({ checks });

  const verdict = await security.recheckProtectedStep(protectedContext());

  assert.equal(verdict.allowed, false);
  assert.equal(verdict.failedCheck, 'credentials');
  assert.equal(verdict.errorCode, 'credential_manager_unavailable');
  assert.deepEqual(calls, ['identity', 'access', 'resourceAuthority', 'actionGate', 'credentials']);
});

test('AW2.4 does not invoke security checks for explicitly unprotected steps', async () => {
  const calls = [];
  const security = createWorkflowExecutionSecurity({ checks: allowedChecks(calls) });
  const context = protectedContext();
  context.step = { type: 'compose' };

  const verdict = await security.recheckProtectedStep(context);

  assert.equal(verdict.allowed, true);
  assert.equal(verdict.protected, false);
  assert.deepEqual(calls, []);
});
