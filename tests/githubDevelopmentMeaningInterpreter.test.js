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
  const interpreter = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => baseInterpretation() }, aiRouter: router({ route: 'execute', instruction: 'Implement LA1 in korzh260609-beep/garya-bot on dev/sg2.1-semantic.', target: { repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', block: null, stage: 'LA1', scopeId: null, paths: [] }, confidence: 0.97, rationale: 'continuation of repository implementation task' }, calls) });
  const result = await interpreter.interpret(input());
  assert.equal(result.intent, 'github-development');
  assert.equal(result.candidateActions[0].name, 'github.development.execute');
  assert.equal(result.candidateActions[0].actionClass, 'state-change');
  assert.equal(result.candidateActions[0].payload.mode, 'execute');
  assert.match(result.candidateActions[0].payload.instruction, /LA1/);
  assert.equal(result.target.stage, 'LA1');
  assert.match(calls[0].messages[1].content, /Не удалось обработать сообщение/);
});

test('GH3 semantic router sends access questions to deterministic runtime status', async () => {
  const interpreter = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => baseInterpretation() }, aiRouter: router({ route: 'status', instruction: null, target: null, confidence: 0.99, rationale: 'asks about GitHub access' }) });
  const result = await interpreter.interpret(input('У тебя есть доступ к своему GitHub репозиторию?'));
  assert.equal(result.intent, 'github-development-status');
  assert.equal(result.candidateActions[0].type, 'github-development');
  assert.equal(result.candidateActions[0].name, 'github.repository.inspect');
  assert.equal(result.candidateActions[0].actionClass, 'read-only');
  assert.deepEqual(result.candidateActions[0].payload, { mode: 'status' });
});

test('GH3 semantic router distinguishes repository-content inspection from access status', async () => {
  const interpreter = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => baseInterpretation() }, aiRouter: router({ route: 'inspect', instruction: 'Find and inspect the LA block in the current SG 2.1 repository.', target: { repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', block: 'LA', stage: null, scopeId: null, paths: [] }, confidence: 0.96, rationale: 'asks to inspect actual repository content' }) });
  const result = await interpreter.interpret(input('Ты видишь блок LA в репозитории?'));
  assert.equal(result.intent, 'github-repository-inspect');
  assert.equal(result.candidateActions[0].name, 'github.repository.inspect');
  assert.equal(result.candidateActions[0].actionClass, 'read-only');
  assert.equal(result.candidateActions[0].payload.mode, 'inspect');
  assert.match(result.candidateActions[0].payload.instruction, /LA/);
  assert.equal(result.target.block, 'LA');
});

test('GH3 semantic router preserves ordinary conversation only when route is none', async () => {
  const base = baseInterpretation();
  const none = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => base }, aiRouter: router({ route: 'none', instruction: null, target: null, confidence: 0.99, rationale: 'not repository execution' }) });
  assert.equal(await none.interpret(input('Объясни что такое git')), base);
});

test('GH3 closed route remains executable instead of asking again after execute was already selected', async () => {
  const base = baseInterpretation();
  const weak = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => base }, aiRouter: router({ route: 'execute', instruction: 'do work', target: null, confidence: 0.4, rationale: 'uncertain' }) });
  const result = await weak.interpret(input());
  assert.equal(result.intent, 'github-development');
  assert.equal(result.candidateActions[0].name, 'github.development.execute');
  assert.equal(result.confidence, 0.8);
  assert.ok(result.uncertainty <= 0.2);
  assert.equal(result.clarificationQuestion, null);
  assert.deepEqual(result.missingInformation, []);
});

test('GH3 router cannot discard a canonical GitHub action already resolved by the primary interpreter', async () => {
  const primary = Object.freeze({
    ...baseInterpretation(),
    intent: 'github-repository-inspect',
    uncertainty: 0.05,
    candidateActions: [Object.freeze({ type: 'github-development', name: 'github.repository.inspect', actionClass: 'read-only', payload: Object.freeze({ mode: 'inspect', instruction: 'Проверь фактическое содержимое репозитория.' }) })]
  });
  const interpreter = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => primary }, aiRouter: router({ route: 'none', instruction: null, target: null, confidence: 0.7, rationale: 'secondary classifier missed the repository action' }) });
  const result = await interpreter.interpret(input('Ты видишь нужный блок в репозитории?'));
  assert.equal(result.candidateActions[0].name, 'github.repository.inspect');
  assert.equal(result.candidateActions[0].payload.mode, 'inspect');
  assert.ok(result.confidence >= 0.8);
});

test('GH3 router cannot lower confidence of the same canonical GitHub route below primary semantic evidence', async () => {
  const primary = Object.freeze({ ...baseInterpretation(), uncertainty: 0.05, candidateActions: [Object.freeze({ type: 'github-development', name: 'github.repository.inspect', actionClass: 'read-only', payload: Object.freeze({ mode: 'inspect' }) })] });
  const interpreter = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: { interpret: async () => primary }, aiRouter: router({ route: 'inspect', instruction: 'Inspect repository evidence.', target: null, confidence: 0.2, rationale: 'weak duplicate classification' }) });
  const result = await interpreter.interpret(input('Проверь репозиторий'));
  assert.ok(result.confidence >= 0.8);
  assert.equal(result.candidateActions[0].payload.mode, 'inspect');
});
