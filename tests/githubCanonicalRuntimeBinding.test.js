import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionEngine } from '../src/decision/decisionEngine.js';
import { directUserConfirmation } from '../src/runtime/createProductionRuntime.js';

function canonicalInput() {
  return { text: 'Реализуй этап LA1', locale: 'ru', traceContext: { traceId: 't-github-runtime-binding', requestId: 'r-github-runtime-binding' } };
}
function interpretation(action) {
  return { intent: 'github-development', goal: 'execute-github-development', uncertainty: 0.01, clarificationQuestion: null, missingInformation: [], evidenceNeeds: [], contextNeeds: [], candidateActions: [action], memoryCandidates: [], memoryQuery: null, conversationHistoryQuery: null, subsystemRequest: null, rationale: 'runtime binding regression' };
}
function canonicalModel(action) {
  return { version: '1.0', resolutionStatus: 'resolved', intent: 'github-development', goal: 'execute-github-development', action, target: { repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', stage: 'LA1', paths: [] }, parameters: { instruction: 'Implement LA1' }, provenance: { resolver: 'semantic-request-resolver' }, diagnostics: { selectedCandidateIndex: 0, selectedCandidatePriority: 0 }, confidence: 0.99 };
}

test('canonical github development action binds to the single runtime capability without changing canonical meaning', () => {
  const action = { type: 'github-development', name: 'github.development.execute', actionClass: 'state-change', payload: { mode: 'execute', instruction: 'Implement LA1' } };
  const result = createDecisionEngine().decide({ canonicalInput: canonicalInput(), interpretation: interpretation(action), canonicalSemanticModel: canonicalModel(action), interpreterName: 'production-ai-meaning-interpreter' });
  assert.equal(result.decisionEnvelope.decisionType, 'execute');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'github-development');
  assert.equal(result.decisionEnvelope.selectedAction.type, 'github-development');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalAction, 'github.development.execute');
  assert.equal(result.decisionEnvelope.selectedAction.payload.instruction, 'Implement LA1');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalTarget.repository, 'korzh260609-beep/garya-bot');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalTarget.branch, 'dev/sg2.1-semantic');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalTarget.stage, 'LA1');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalResolution.status, 'resolved');
  assert.equal(result.decisionEnvelope.diagnostics.canonicalGitHubAction, 'github.development.execute');
});

test('github status request binds to the same single capability in read-only status mode', () => {
  const action = { type: 'github-development', name: 'github.repository.inspect', actionClass: 'read-only', payload: { mode: 'status' } };
  const result = createDecisionEngine().decide({ canonicalInput: canonicalInput(), interpretation: interpretation(action), canonicalSemanticModel: canonicalModel(action), interpreterName: 'production-ai-meaning-interpreter' });
  assert.equal(result.decisionEnvelope.decisionType, 'answer');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'github-development');
  assert.equal(result.decisionEnvelope.selectedAction.type, 'github-development-status');
  assert.equal(result.decisionEnvelope.selectedAction.payload.mode, 'status');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalAction, 'github.repository.inspect');
});

test('canonical owner GitHub execution receives direct user confirmation without transport metadata coupling', () => {
  const confirmation = directUserConfirmation('github-development', { canonicalAction: 'github.development.execute', mode: 'execute' }, { identityContext: { roles: ['monarch'] }, metadata: {} }, { traceId: 'trace-owner-execute', requestId: 'request-owner-execute' });
  assert.deepEqual(confirmation, { confirmed: true, requestId: 'request-owner-execute', source: 'canonical-owner-github-development-instruction' });
  assert.equal(directUserConfirmation('github-development', { canonicalAction: 'github.development.execute' }, { identityContext: { roles: ['citizen'] }, metadata: {} }, { requestId: 'request-citizen' }), undefined);
  assert.equal(directUserConfirmation('github-development', { canonicalAction: 'github.repository.inspect', mode: 'inspect' }, { identityContext: { roles: ['monarch'] }, metadata: {} }, { requestId: 'request-inspect' }), undefined);
});
