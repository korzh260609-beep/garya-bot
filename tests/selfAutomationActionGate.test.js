import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionGate } from '../src/action/actionGate.js';
import { createActionRequest } from '../src/contracts/action.js';
import { createIdentityContext, createScopeContext } from '../src/contracts/context.js';

const traceContext = Object.freeze({ traceId: 'trace-self-automation', requestId: 'request-self-automation' });

function actor(overrides = {}) {
  return createIdentityContext({
    globalUserId: 'usr_self',
    platform: 'telegram',
    platformUserId: '12345',
    roles: ['guest'],
    grants: ['capability:compose-answer'],
    authenticationLevel: 'telegram-webhook',
    ...overrides
  });
}

function scope(overrides = {}) {
  return createScopeContext({
    userScope: 'usr_self',
    projectScope: 'sg2.1',
    groupScope: null,
    threadScope: null,
    allowedCapabilities: ['compose-answer'],
    ...overrides
  });
}

function originPayload(extra = {}) {
  return {
    userInitiatedCanonicalRequest: true,
    originTarget: { transport: 'telegram', address: '12345' },
    ...extra
  };
}

function request({ capability, actionClass = 'read-only', confirmationRequired = false, payload = {}, requestActor = actor(), requestScope = scope() }) {
  return createActionRequest({
    capability,
    actionType: capability,
    actionClass,
    actor: requestActor,
    scope: requestScope,
    requiredPermission: `capability:${capability}`,
    confirmationRequired,
    risk: 'low',
    traceContext,
    payload
  });
}

test('authenticated user can list own recurring schedules even when legacy scope capabilities omit schedule-list', () => {
  const gate = createActionGate();
  const decision = gate.evaluate(request({ capability: 'schedule-list', payload: originPayload() }));
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.checks.selfAutomation, true);
  assert.equal(decision.checks.capability, true);
});

test('explicit own recurring lifecycle mutation is confirmed deterministically inside Action Gate', () => {
  const gate = createActionGate();
  const decision = gate.evaluate(request({
    capability: 'schedule-pause',
    actionClass: 'state-changing',
    confirmationRequired: true,
    payload: originPayload({ scheduleId: 'schedule-1' })
  }));
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.checks.selfAutomation, true);
  assert.equal(decision.checks.confirmation, true);
});

test('canonical scheduled self-notification create is allowed through Action Gate without legacy capability grant', () => {
  const gate = createActionGate();
  const decision = gate.evaluate(request({
    capability: 'task-create',
    actionClass: 'state-changing',
    confirmationRequired: true,
    payload: originPayload({
      kind: 'self-notification',
      notificationMessage: 'hello',
      recurrence: 'FREQ=DAILY',
      localTime: '07:00'
    })
  }));
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.checks.selfAutomation, true);
});

test('self automation policy never authorizes cross-user scope', () => {
  const gate = createActionGate();
  const decision = gate.evaluate(request({
    capability: 'schedule-list',
    payload: originPayload(),
    requestScope: scope({ userScope: 'usr_other' })
  }));
  assert.equal(decision.outcome, 'deny');
  assert.equal(decision.checks.selfAutomation, false);
  assert.ok(decision.reasons.includes('scope-mismatch'));
});

test('self automation policy does not activate without verified origin target', () => {
  const gate = createActionGate();
  const decision = gate.evaluate(request({ capability: 'schedule-list', payload: { userInitiatedCanonicalRequest: true } }));
  assert.equal(decision.outcome, 'downgrade-to-prepare');
  assert.equal(decision.checks.selfAutomation, false);
  assert.ok(decision.reasons.includes('capability-unavailable'));
});
