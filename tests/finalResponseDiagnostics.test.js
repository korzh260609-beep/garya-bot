import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFinalResponse, fingerprintFinalResponse } from '../src/response/finalResponseGuard.js';
import { createTelegramProductionIntegration, createInMemoryTelegramUpdateStore } from '../src/telegram/telegramProductionIntegration.js';
import { createDiagnosticEvidence } from '../src/diagnostics/contracts.js';
import { createExpectedPathRegistry } from '../src/diagnostics/pathRegistry.js';
import { reconstructTrace } from '../src/diagnostics/analyzer.js';
import { evaluateTraceInvariants } from '../src/diagnostics/invariants.js';
import { createInMemoryObservabilityStore } from '../src/observability/inMemoryObservabilityStore.js';
import { createObservabilityService } from '../src/observability/observabilityService.js';

function identityResolver({ platformFacts, scopeFacts }) {
  return {
    identityContext: {
      globalUserId: `global:${platformFacts.platformUserId}`,
      roles: ['guest'],
      grants: ['capability:compose-answer'],
      authenticationLevel: 'platform'
    },
    scopeContext: {
      userScope: `global:${platformFacts.platformUserId}`,
      projectScope: scopeFacts.projectId ?? 'sg2.1',
      groupScope: scopeFacts.groupId,
      threadScope: scopeFacts.threadId,
      requestedUserScope: `global:${platformFacts.platformUserId}`,
      requestedProjectScope: scopeFacts.projectId ?? 'sg2.1',
      requestedGroupScope: scopeFacts.groupId,
      requestedThreadScope: scopeFacts.threadId,
      allowedCapabilities: ['compose-answer']
    }
  };
}

function telegramUpdate(text = 'привет') {
  return {
    update_id: 9001,
    message: {
      message_id: 501,
      from: { id: 7, is_bot: false, language_code: 'ru' },
      chat: { id: 70, type: 'private' },
      text
    }
  };
}

function realObservability() {
  let i = 0;
  const store = createInMemoryObservabilityStore();
  const service = createObservabilityService({
    store,
    clock: () => '2026-08-09T18:20:00.000Z',
    idFactory: () => `event-${++i}`
  });
  return { store, service };
}

test('final response fingerprint is normalized, deterministic and salt-scoped', () => {
  assert.equal(assessFinalResponse({ userText: ' Привет ', candidateText: 'привет' }).reason, 'exact-user-echo');
  const a = fingerprintFinalResponse(' Привет ', { salt: 'trace-a' });
  const b = fingerprintFinalResponse('привет', { salt: 'trace-a' });
  const c = fingerprintFinalResponse('привет', { salt: 'trace-b' });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{64}$/u);
});

test('Telegram delivery boundary works with the real observability contract and emits privacy-safe echo evidence', async () => {
  const sent = [];
  const { service } = realObservability();
  const integration = createTelegramProductionIntegration({
    secretToken: 'secret',
    botClient: { sendMessage: async (payload) => sent.push(payload) },
    updateStore: createInMemoryTelegramUpdateStore(),
    identityResolver,
    runtime: { handle: async (input) => ({ status: 'success', message: input.text, data: {} }) },
    observability: service,
    environment: 'test',
    revision: 'echo-test',
    idFactory: (() => { let i = 0; return () => `echo-${++i}`; })()
  });

  const result = await integration.handleWebhook({ headers: { 'x-telegram-bot-api-secret-token': 'secret' }, body: telegramUpdate() });
  assert.equal(result.statusCode, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, 'привет');

  const events = service.list({ traceId: 'echo-1' });
  const observed = events.find((event) => event.eventClass === 'final_response_observed');
  assert.ok(observed);
  assert.equal(observed.stage, 'response');
  assert.equal(observed.outcome, 'rejected');
  assert.equal(observed.data.exactEcho, true);
  assert.equal(observed.data.reason, 'exact-user-echo');
  assert.equal(observed.data.inputHash, observed.data.outputHash);
  assert.ok(events.some((event) => event.eventClass === 'delivery_attempt'));
  assert.ok(events.some((event) => event.eventClass === 'delivery_completed'));
  assert.ok(events.some((event) => event.eventClass === 'telegram_update_completed'));
  const serialized = JSON.stringify(observed);
  assert.equal(serialized.includes('привет'), false);
});

test('any diagnostics telemetry record failure cannot suppress Telegram delivery', async () => {
  for (const failingEventClass of ['final_response_observed', 'delivery_attempt', 'delivery_completed', 'telegram_update_completed']) {
    const sent = [];
    const events = [];
    const observability = {
      record(event) {
        events.push(event);
        if (event.eventClass === failingEventClass) throw new Error(`simulated ${failingEventClass} failure`);
      },
      recordFailure(event) { events.push({ ...event, failure: true }); }
    };
    const integration = createTelegramProductionIntegration({
      secretToken: 'secret',
      botClient: { sendMessage: async (payload) => sent.push(payload) },
      updateStore: createInMemoryTelegramUpdateStore(),
      identityResolver,
      runtime: { handle: async () => ({ status: 'success', message: 'Здравствуйте!', data: {} }) },
      observability,
      environment: 'test',
      revision: 'sensor-isolation-test',
      idFactory: (() => { let i = 0; return () => `${failingEventClass}-${++i}`; })()
    });

    const result = await integration.handleWebhook({ headers: { 'x-telegram-bot-api-secret-token': 'secret' }, body: telegramUpdate() });
    assert.equal(result.statusCode, 200, failingEventClass);
    assert.equal(sent.length, 1, failingEventClass);
    assert.equal(sent[0].text, 'Здравствуйте!', failingEventClass);
    assert.ok(events.some((event) => event.failure === true && event.stage === 'diagnostic-sensor'), failingEventClass);
  }
});

test('Universal Diagnostics classifies delivery-boundary exact echo as confirmed RESPONSE invariant', () => {
  const traceId = 'trace-exact-echo';
  const hash = fingerprintFinalResponse('привет', { salt: traceId });
  const evidence = [
    createDiagnosticEvidence({ source: 'sg-observability', traceId, stage: 'request_received', status: 'completed', payload: { eventClass: 'request_received', outcome: 'completed' } }),
    createDiagnosticEvidence({ source: 'sg-observability', traceId, stage: 'semantic_decision_created', status: 'completed', payload: { eventClass: 'semantic_decision_created', outcome: 'completed' } }),
    createDiagnosticEvidence({ source: 'sg-observability', traceId, stage: 'action_gate_decision', status: 'completed', payload: { eventClass: 'action_gate_decision', outcome: 'allow' } }),
    createDiagnosticEvidence({ source: 'sg-observability', traceId, stage: 'capability_started', status: 'unknown', payload: { eventClass: 'capability_started', outcome: 'started' } }),
    createDiagnosticEvidence({ source: 'sg-observability', traceId, stage: 'capability_completed', status: 'completed', payload: { eventClass: 'capability_completed', outcome: 'success' } }),
    createDiagnosticEvidence({ source: 'sg-observability', traceId, stage: 'response', status: 'unknown', payload: { eventClass: 'final_response_observed', outcome: 'rejected', data: { responseEventClass: 'final_response_observed', reason: 'exact-user-echo', exactEcho: true, inputHash: hash, outputHash: hash } } }),
    createDiagnosticEvidence({ source: 'sg-observability', traceId, stage: 'telegram-delivery', status: 'completed', payload: { eventClass: 'delivery_completed', outcome: 'delivered' } })
  ];
  const trace = reconstructTrace({ expectedPath: createExpectedPathRegistry().get('conversation'), evidence });
  const findings = evaluateTraceInvariants(trace);
  const echo = findings.find((finding) => finding.data?.reason === 'exact-user-echo');
  assert.ok(echo);
  assert.equal(echo.errorClass, 'RESPONSE');
  assert.equal(echo.component, 'final-response-delivery-boundary');
  assert.equal(echo.confidence, 'CONFIRMED');
  assert.equal(echo.data.invariant, 'final-response-must-not-exactly-echo-user');
});
