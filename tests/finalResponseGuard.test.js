import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFinalResponse } from '../src/response/finalResponseGuard.js';
import { createProductionCapabilities } from '../src/capability/productionCapabilities.js';
import { createCapabilityRegistry } from '../src/capability/capabilityRegistry.js';
import { createCapabilityExecutor } from '../src/capability/capabilityExecutor.js';
import { createActionRequest, createGateDecision } from '../src/contracts/action.js';

const memoryProvider = Object.freeze({
  async query() { return { records: [], diagnostics: {} }; },
  async write() { return { status: 'written' }; }
});

test('final response guard rejects exact user echoes for representative Russian conversational inputs', () => {
  for (const text of ['привет', 'кто ты?', 'кто я?']) {
    const result = assessFinalResponse({ userText: text, candidateText: text });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'exact-user-echo');
  }
});

test('final response guard rejects internal conversational placeholders', () => {
  const result = assessFinalResponse({
    userText: 'Что ты знаешь обо мне?',
    candidateText: 'SG could not produce a final conversational response.'
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'internal-placeholder');
});

test('final response guard accepts a real conversational answer', () => {
  const result = assessFinalResponse({ userText: 'кто ты?', candidateText: 'Я — СГ, Советник GARYA.' });
  assert.equal(result.ok, true);
});

test('compose-answer execution budget covers AI retry and model fallback path', () => {
  const compose = createProductionCapabilities({ memoryProvider }).find((item) => item.name === 'compose-answer');
  assert.ok(compose);
  assert.equal(compose.timeoutMs, 300000);
});

test('compose-answer failure is fail-closed and cannot fall through to semantic response text', async () => {
  const compose = createProductionCapabilities({
    memoryProvider,
    conversationResponder: async () => {
      const error = new Error('compose failed');
      error.code = 'compose-failed';
      throw error;
    }
  }).find((item) => item.name === 'compose-answer');
  const registry = createCapabilityRegistry({ capabilities: [compose] });
  const executor = createCapabilityExecutor({ registry });
  const actionRequest = createActionRequest({
    capability: 'compose-answer',
    actionType: 'answer',
    actionClass: 'analysis-only',
    actor: { globalUserId: 'usr_test', roles: ['guest'], grants: [] },
    scope: { userScope: 'usr_test', projectScope: 'sg2.1', allowedCapabilities: ['compose-answer'] },
    payload: { text: 'кто ты?' },
    requiredPermission: 'capability:compose-answer',
    traceContext: { traceId: 'trace-compose-failure', requestId: 'request-compose-failure' }
  });
  const gateDecision = createGateDecision({
    outcome: 'allow',
    actionRequest,
    effectiveActionClass: 'analysis-only',
    checks: {}
  });

  await assert.rejects(
    executor.execute({ actionRequest, gateDecision }),
    (error) => error?.code === 'compose-failed' && /compose failed/.test(error.message)
  );
});
