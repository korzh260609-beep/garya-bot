import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubDevelopmentMeaningInterpreter } from '../src/githubDevelopment/githubDevelopmentMeaningInterpreter.js';

function baseInterpretation() {
  return Object.freeze({
    meaning: 'continue requested work', goal: 'respond', intent: 'answer', entities: [], constraints: [], uncertainty: 0.1,
    missingInformation: [], clarificationQuestion: null, contextNeeds: [], evidenceNeeds: [], memoryQuery: null,
    conversationHistoryQuery: null, subsystemRequest: null, memoryCandidates: [],
    candidateActions: [Object.freeze({ type: 'answer', name: 'compose-answer', actionClass: 'analysis' })], rationale: 'base'
  });
}
function input(text = 'реализуй LA1') {
  return Object.freeze({
    text, locale: 'ru',
    identityContext: Object.freeze({ globalUserId: 'telegram:1', roles: ['monarch'] }),
    scopeContext: Object.freeze({ projectScope: 'sg2.1', userScope: 'telegram:1' }),
    traceContext: Object.freeze({ traceId: 't-gh3-route', requestId: 'r-gh3-route' }),
    metadata: Object.freeze({ conversationContext: Object.freeze({ recentTurns: Object.freeze([
      Object.freeze({ direction: 'inbound', text: 'Реализуй LA1 в dev/sg2.1-semantic' }),
      Object.freeze({ direction: 'outbound', text: 'Не удалось обработать сообщение' })
    ]) }) })
  });
}
function router(output, calls = []) {
  return { async route(request) { calls.push(request); return { text: JSON.stringify(output), provider: 'fixture', model: 'fixture', latencyMs: 0, usage: {}, costUsd: 0, traceId: request.traceContext.traceId, requestId: request.traceContext.requestId, reason: request.reason, attempts: 1, fallbackUsed: false, rawMetadata: {} }; } };
}

test('GH3 semantic router turns short continuation into executable development action', async () => {
  const calls = [];
  const interpreter = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => baseInterpretation() }, aiRouter: router({ route: 'execute', instruction: 'Implement LA1 in korzh260609-beep/garya-bot on dev/sg2.1-semantic.', confidence: 0.97, rationale: 'continuation of repository implementation task' }, calls) });
  const result = await interpreter.interpret(input());
  assert.equal(result.intent, 'github-development');
  assert.equal(result.candidateActions[0].name, 'github-development');
  assert.equal(result.candidateActions[0].actionClass, 'state-change');
  assert.equal(result.candidateActions[0].payload.mode, 'execute');
  assert.match(result.candidateActions[0].payload.instruction, /LA1/);
  assert.match(calls[0].messages[1].content, /Не удалось обработать сообщение/);
});

test('GH3 semantic router sends access questions to deterministic runtime status', async () => {
  const interpreter = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => baseInterpretation() }, aiRouter: router({ route: 'status', instruction: null, confidence: 0.99, rationale: 'asks about GitHub access' }) });
  const result = await interpreter.interpret(input('У тебя есть доступ к своему GitHub репозиторию?'));
  assert.equal(result.intent, 'github-development-status');
  assert.equal(result.candidateActions[0].type, 'github-development-status');
  assert.equal(result.candidateActions[0].actionClass, 'read-only');
  assert.deepEqual(result.candidateActions[0].payload, { mode: 'status' });
});

test('GH3 semantic router preserves ordinary conversation when route is none or confidence is weak', async () => {
  const base = baseInterpretation();
  const none = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => base }, aiRouter: router({ route: 'none', instruction: null, confidence: 0.99, rationale: 'not repository execution' }) });
  assert.equal(await none.interpret(input('Объясни что такое git')), base);
  const weak = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => base }, aiRouter: router({ route: 'execute', instruction: 'do work', confidence: 0.4, rationale: 'uncertain' }) });
  assert.equal(await weak.interpret(input()), base);
});
