import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityContext, createScopeContext } from '../src/contracts/context.js';
import { createActionRequest, createActionRequestFromDecision } from '../src/contracts/action.js';
import { createActionGate } from '../src/action/actionGate.js';
import { createActionPolicy } from '../src/action/actionPolicy.js';
import { createInMemoryIdempotencyStore } from '../src/action/inMemoryIdempotencyStore.js';
import { createActionGatePipeline } from '../src/action/actionGatePipeline.js';

const traceContext = Object.freeze({ traceId: 'trace-1', requestId: 'request-1' });

function actor(overrides = {}) {
  return createIdentityContext({
    globalUserId: 'user-1',
    platform: 'local',
    platformUserId: 'user-1',
    roles: [],
    grants: [],
    authenticationLevel: 'verified',
    ...overrides
  });
}

function scope(overrides = {}) {
  return createScopeContext({
    userScope: 'user-1',
    projectScope: 'sg2.1',
    allowedCapabilities: ['read-project'],
    ...overrides
  });
}

function request(overrides = {}) {
  return createActionRequest({
    capability: 'read-project',
    actionType: 'read',
    actionClass: 'read-only',
    actor: actor(),
    scope: scope(),
    risk: 'low',
    traceContext,
    ...overrides
  });
}

test('allows an available low-risk read-only action without executing it', () => {
  const decision = createActionGate({ clock: () => '2026-08-06T00:00:00.000Z' }).evaluate(request());
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.authorized, true);
  assert.equal(decision.executionPerformed, false);
  assert.equal(decision.audit.gate, 'sg-action-gate-v1');
});

test('denies a cross-scope action', () => {
  const decision = createActionGate().evaluate(request({ requestedScope: undefined, scope: scope(), payload: {}, actionClass: 'read-only' }));
  assert.equal(decision.outcome, 'allow');

  const mismatched = createActionRequest({
    capability: 'read-project', actionType: 'read', actionClass: 'read-only', actor: actor(), scope: scope(),
    requestedScope: { projectScope: 'other-project' }, risk: 'low', traceContext
  });
  const blocked = createActionGate().evaluate(mismatched);
  assert.equal(blocked.outcome, 'deny');
  assert.ok(blocked.reasons.includes('scope-mismatch'));
});

test('downgrades protected action when permission is absent', () => {
  const protectedRequest = request({
    actionClass: 'state-changing',
    actionType: 'update',
    requiredPermission: 'project:update',
    confirmationRequired: true
  });
  const decision = createActionGate().evaluate(protectedRequest);
  assert.equal(decision.outcome, 'downgrade-to-prepare');
  assert.equal(decision.effectiveActionClass, 'prepare-only');
  assert.ok(decision.reasons.includes('permission-denied'));
});

test('requires matching confirmation for protected action', () => {
  const protectedRequest = request({
    actionClass: 'state-changing',
    actionType: 'update',
    actor: actor({ grants: ['project:update'] }),
    requiredPermission: 'project:update'
  });
  const decision = createActionGate().evaluate(protectedRequest);
  assert.equal(decision.outcome, 'require-confirmation');

  const confirmed = request({
    actionClass: 'state-changing',
    actionType: 'update',
    actor: actor({ grants: ['project:update'] }),
    requiredPermission: 'project:update',
    confirmation: { confirmed: true, requestId: 'request-1' }
  });
  assert.equal(createActionGate().evaluate(confirmed).outcome, 'allow');
});

test('critical risk is denied even when permission exists', () => {
  const critical = request({
    actionClass: 'state-changing',
    actionType: 'delete',
    actor: actor({ roles: ['monarch'] }),
    risk: 'critical',
    confirmation: { confirmed: true, requestId: 'request-1' }
  });
  const decision = createActionGate().evaluate(critical);
  assert.equal(decision.outcome, 'deny');
  assert.ok(decision.reasons.includes('critical-risk'));
});

test('high cost requires confirmation', () => {
  const costly = request({
    actionClass: 'expensive-costly',
    actor: actor({ grants: ['capability:read-project'] }),
    estimatedCostUsd: 0.06
  });
  const decision = createActionGate({ policy: createActionPolicy({ maxAutoCostUsd: 0.05 }) }).evaluate(costly);
  assert.equal(decision.outcome, 'require-confirmation');
  assert.ok(decision.reasons.includes('cost-confirmation-required'));
});

test('unavailable capability, source or tool downgrades to prepare-only', () => {
  const unavailable = request({ requiredSources: ['github'], requiredTools: ['writer'] });
  const decision = createActionGate({ availableSources: [], availableTools: [] }).evaluate(unavailable);
  assert.equal(decision.outcome, 'downgrade-to-prepare');
  assert.ok(decision.reasons.includes('source-unavailable'));
  assert.ok(decision.reasons.includes('tool-unavailable'));
});

test('idempotency prevents duplicate authorization', () => {
  const store = createInMemoryIdempotencyStore();
  const gate = createActionGate({ idempotencyStore: store });
  const idempotent = request({ idempotencyKey: 'operation-1' });
  assert.equal(gate.evaluate(idempotent).outcome, 'allow');
  const duplicate = gate.evaluate(idempotent);
  assert.equal(duplicate.outcome, 'deny');
  assert.ok(duplicate.reasons.includes('duplicate-idempotency-key'));
});

test('DecisionEnvelope is converted to ActionRequest without interpreting text', () => {
  const actionRequest = createActionRequestFromDecision({
    decisionEnvelope: {
      traceId: 'trace-1',
      requestId: 'request-1',
      selectedAction: { type: 'prepare', name: 'update-project', actionClass: 'state-change' }
    },
    identityContext: actor({ roles: ['monarch'] }),
    scopeContext: scope({ allowedCapabilities: ['update-project'] })
  });
  assert.equal(actionRequest.actionClass, 'state-changing');
  assert.equal(actionRequest.capability, 'update-project');
});

test('pipeline evaluates a semantic result and never executes a capability', () => {
  const pipeline = createActionGatePipeline({ actionGate: createActionGate() });
  const result = pipeline.evaluateSemanticResult({
    semanticResult: {
      decisionEnvelope: {
        traceId: 'trace-1', requestId: 'request-1',
        selectedAction: { type: 'answer', name: 'read-project', actionClass: 'read-only' }
      }
    },
    identityContext: actor(),
    scopeContext: scope()
  });
  assert.equal(result.gateDecision.outcome, 'allow');
  assert.equal(result.gateDecision.executionPerformed, false);
});
