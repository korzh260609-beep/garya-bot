import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticKernel } from '../src/semantic/semanticKernel.js';
import { createSemanticRequestResolver } from '../src/semantic/semanticRequestResolver.js';
import { createGitHubDevelopmentMeaningInterpreter } from '../src/githubDevelopment/githubDevelopmentMeaningInterpreter.js';
import { createSemanticInterpretation } from '../src/contracts/semantic.js';

function baseInterpreter() {
  return {
    name: 'fixture-base',
    async interpret() {
      return createSemanticInterpretation({
        meaning: 'generic conversational request',
        goal: 'respond',
        intent: 'answer',
        uncertainty: 0.1,
        entities: [], constraints: [], missingInformation: [], clarificationQuestion: null,
        contextNeeds: [], evidenceNeeds: [], memoryCandidates: [],
        candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
        rationale: 'base fixture'
      });
    }
  };
}

function router(result) {
  return {
    async route(request) {
      return {
        text: JSON.stringify(result), provider: 'fixture', model: 'fixture', latencyMs: 0,
        usage: {}, costUsd: 0, traceId: request.traceContext.traceId,
        requestId: request.traceContext.requestId, reason: request.reason,
        attempts: 1, fallbackUsed: false, rawMetadata: {}
      };
    }
  };
}

function input(text) {
  return {
    text,
    locale: 'ru',
    identityContext: { globalUserId: 'telegram:owner', roles: ['monarch'], grants: ['capability:github-development'] },
    scopeContext: { userScope: 'telegram:owner', projectScope: 'sg2.1', groupScope: null, threadScope: null, allowedCapabilities: ['github-development'] },
    traceContext: { traceId: 't-live-la1', requestId: 'r-live-la1' },
    metadata: {
      transport: 'telegram',
      conversationContext: {
        recentTurns: [
          { direction: 'inbound', text: 'Рабочая ветка dev/sg2.1-semantic, main не использовать.' }
        ]
      }
    }
  };
}

test('live-style Telegram LA1 request reaches existing GH3 capability through canonical GitHub action', async () => {
  const interpreter = createGitHubDevelopmentMeaningInterpreter({
    baseInterpreter: baseInterpreter(),
    aiRouter: router({
      route: 'execute',
      instruction: 'Implement LA1 Activity Event Core in SG 2.1 on dev/sg2.1-semantic; do not use main.',
      target: {
        repository: 'korzh260609-beep/garya-bot',
        branch: 'dev/sg2.1-semantic',
        block: null,
        stage: 'LA1',
        scopeId: null,
        paths: []
      },
      confidence: 0.96,
      rationale: 'explicit repository implementation instruction'
    })
  });
  const kernel = createSemanticKernel({
    meaningInterpreter: interpreter,
    semanticRequestResolver: createSemanticRequestResolver({ minimumConfidence: 0.35 })
  });

  const result = await kernel.process(input('Реализуй этап LA1 — Activity Event Core в проекте SG 2.1. Репозиторий korzh260609-beep/garya-bot. Рабочая ветка dev/sg2.1-semantic, main не использовать.'));

  assert.equal(result.canonicalSemanticModel.resolutionStatus, 'resolved');
  assert.equal(result.canonicalSemanticModel.action.name, 'github.development.execute');
  assert.equal(result.canonicalSemanticModel.target.stage, 'LA1');
  assert.equal(result.decisionEnvelope.decisionType, 'execute');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'github-development');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalAction, 'github.development.execute');
  assert.match(result.decisionEnvelope.selectedAction.payload.instruction, /LA1/);
  assert.equal(result.decisionEnvelope.diagnostics.githubExecutionBound, true);
});

test('GitHub access question reaches deterministic GH3 status capability instead of conversational self-denial', async () => {
  const interpreter = createGitHubDevelopmentMeaningInterpreter({
    baseInterpreter: baseInterpreter(),
    aiRouter: router({ route: 'status', instruction: null, target: null, confidence: 0.98, rationale: 'asks runtime GitHub availability' })
  });
  const kernel = createSemanticKernel({ meaningInterpreter: interpreter, semanticRequestResolver: createSemanticRequestResolver() });
  const result = await kernel.process(input('Ты видишь блок LA в репозитории?'));

  assert.equal(result.canonicalSemanticModel.action.name, 'github.repository.inspect');
  assert.equal(result.decisionEnvelope.selectedAction.name, 'github-development');
  assert.equal(result.decisionEnvelope.selectedAction.type, 'github-development-status');
  assert.equal(result.decisionEnvelope.selectedAction.payload.mode, 'status');
  assert.equal(result.decisionEnvelope.selectedAction.payload.canonicalAction, 'github.repository.inspect');
});
