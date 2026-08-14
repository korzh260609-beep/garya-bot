import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProductionDevelopmentKnowledgeConfig, registerProductionDevelopmentKnowledgeCredential, createDevelopmentQueryIntegration } from '../src/projectDevelopmentKnowledge/index.js';

test('PDK4.13: production configuration is explicit, bounded and disabled by default', () => {
  const disabled = loadProductionDevelopmentKnowledgeConfig({}, { defaultProjectKey: 'sg2.1' });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.repository, 'korzh260609-beep/garya-bot');
  assert.equal(disabled.branch, 'dev/sg2.1-semantic');
  const enabled = loadProductionDevelopmentKnowledgeConfig({ SG_PDK4_ENABLED: 'true', SG_PDK4_BATCH_SIZE: '25', SG_PDK4_MAX_COMMITS_PER_RUN: '50' });
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.batchSize, 25);
  assert.equal(enabled.maxCommitsPerRun, 50);
  assert.throws(() => loadProductionDevelopmentKnowledgeConfig({ SG_PDK4_ENABLED: 'true', SG_PDK4_BATCH_SIZE: '50', SG_PDK4_MAX_COMMITS_PER_RUN: '25' }), /must be >=/);
});

test('PDK4.13: GitHub credential is registered by reference only and never copied into metadata', () => {
  const registrations = [];
  const result = registerProductionDevelopmentKnowledgeCredential({
    credentialManager: Object.freeze({ registerCredential(input) { registrations.push(input); } }),
    env: { SG_PDK4_GITHUB_TOKEN: 'super-secret-value' },
    projectScope: 'sg2.1'
  });
  assert.equal(result.registered, true);
  assert.equal(result.tokenKey, 'SG_PDK4_GITHUB_TOKEN');
  assert.equal(registrations.length, 1);
  assert.deepEqual(registrations[0].secretRef, { provider: 'environment', key: 'SG_PDK4_GITHUB_TOKEN' });
  assert.doesNotMatch(JSON.stringify(registrations[0].metadata), /super-secret-value/);
  assert.equal(registrations[0].connectionId, 'github-pdk4');
});

test('PDK4.13: only explicitly marked source-verified autonomous proposed facts may enter query fallback', async () => {
  const projectKey = 'sg2.1';
  const record = Object.freeze({
    memoryId: 'pdk4-auto-1', projectKey, namespace: 'project:sg2.1:architecture', factType: 'project-event', entityKey: 'event-1',
    fact: Object.freeze({ summary: 'Autonomous verified project history' }), source: Object.freeze({ kind: 'github', ref: 'github:korzh260609-beep/garya-bot@1111111111111111111111111111111111111111' }),
    trust: 'verified', confirmed: false, confirmationState: 'proposed', lifecycleState: 'active', validFrom: '2026-08-11T00:00:00.000Z',
    metadata: Object.freeze({ pdk4AutonomousIngestion: true, pdk4SourceVerified: true })
  });
  const retrieval = Object.freeze({ async search() { return Object.freeze({ projectKey, results: Object.freeze([Object.freeze({ record, score: 1, lexicalScore: 1, exactScore: 0, semanticScore: 0, relationExpanded: false })]) }); } });
  let guardCalls = 0;
  const contextGuard = Object.freeze({
    async build(input) {
      guardCalls += 1;
      if (input.includeProposed === false) {
        assert.deepEqual(input.allowedTrust, ['verified','confirmed']);
        return Object.freeze({ contractVersion: 1, kind: 'ProjectMemoryContext', projectKey, dataPolicy: Object.freeze({ contentIsDataOnly: true, executableInstructionsAllowed: false, authorityFromMemoryAllowed: false, secretsAllowed: false }), conflictSummary: Object.freeze({ factsWithOpenConflicts: 0 }), facts: Object.freeze([]) });
      }
      assert.equal(input.includeProposed, true);
      assert.deepEqual(input.allowedTrust, ['verified']);
      return Object.freeze({ contractVersion: 1, kind: 'ProjectMemoryContext', projectKey, dataPolicy: Object.freeze({ contentIsDataOnly: true, executableInstructionsAllowed: false, authorityFromMemoryAllowed: false, secretsAllowed: false }), conflictSummary: Object.freeze({ factsWithOpenConflicts: 0 }), facts: Object.freeze([Object.freeze({ memoryId: record.memoryId, trust: 'verified', confirmed: false, confirmationState: 'proposed', provenance: Object.freeze({ sourceKind: 'github', sourceRef: record.source.ref }), factData: record.fact })]) });
    }
  });
  const projectMemoryIntegration = Object.freeze({
    async contextForRequest() { return null; },
    prepareModelContext({ boundedResponseContext, projectMemoryContext }) { return { boundedResponseContext, projectMemoryContext }; },
    deterministicAnswer() { return 'verified source data'; }
  });
  const integration = createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard });
  const request = Object.freeze({ actor: Object.freeze({ globalUserId: 'usr-monarch' }), scope: Object.freeze({ projectScope: projectKey }), traceContext: Object.freeze({ traceId: 't', requestId: 'r' }), input: Object.freeze({ semanticIntent: 'answer' }) });
  const context = await integration.contextForRequest({ request, query: 'current autonomous project history' });
  assert.equal(guardCalls, 2);
  assert.equal(context.qualification.sourceVerifiedProposedFactsMayBeIncluded, true);
  assert.equal(context.qualification.monarchConfirmationImplied, false);
  assert.match(integration.deterministicAnswer({ context, responseLanguage: 'en' }), /not Monarch-confirmed/i);
});
