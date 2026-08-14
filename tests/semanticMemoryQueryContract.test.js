import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticInterpretation } from '../src/contracts/semantic.js';
import { createDecisionEngine } from '../src/decision/decisionEngine.js';
import { createBoundedResponseContextAssembler } from '../src/response/boundedResponseContext.js';
import { createContextResolver } from '../src/memory/contextResolver.js';

const scope = { userScope: 'usr-a', projectScope: 'sg2.1', groupScope: null, threadScope: null };
const actor = { globalUserId: 'usr-a', roles: ['guest'], grants: [], authenticationLevel: 'verified' };

function semantic(overrides = {}) {
  return createSemanticInterpretation({
    meaning: 'Recall the user device',
    goal: 'answer-user',
    intent: 'personal_fact_recall',
    entities: [],
    constraints: [],
    uncertainty: 0,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: ['user-memory'],
    evidenceNeeds: [],
    memoryQuery: 'primary laptop used by current user',
    memoryCandidates: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: 'Semantic recall is needed.',
    ...overrides
  });
}

function selfKnowledgeService() {
  return {
    async query() {
      return {
        snapshot: { version: 'test', sourceRevision: 'test', validationStatus: 'valid' },
        facts: [],
        diagnostics: { conflictCount: 0, truncated: false }
      };
    }
  };
}

function reportedMemory() {
  return {
    id: 'mem-1',
    layer: 'user-memory',
    key: 'device.primary-laptop',
    value: 'The laptop I use every day is a ThinkPad T14.',
    trust: 'reported',
    confirmed: false,
    updatedAt: '2026-08-14T05:00:00.000Z',
    privacyClass: 'private',
    memoryScope: { kind: 'user', ownerGlobalUserId: 'usr-a', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    provenance: { sourceType: 'automatic-capture', sourceId: 'req-1' }
  };
}

function request(input = {}) {
  return {
    actor,
    scope,
    input: { text: 'Какой у меня ноутбук?', ...input },
    traceContext: { traceId: 'trace-1', requestId: 'req-2', environment: 'test', revision: 'test' }
  };
}

test('semantic contract and SG decision preserve memoryQuery and normalized candidates', () => {
  const interpretation = semantic({
    memoryCandidates: [{
      key: 'device.primary-laptop',
      value: 'ThinkPad T14',
      scopeKind: 'user',
      shared: false,
      tags: ['device']
    }]
  });
  const result = createDecisionEngine().decide({
    canonicalInput: { text: 'Мой ноутбук ThinkPad T14.', locale: 'ru', traceContext: { traceId: 't', requestId: 'r' } },
    interpretation
  });

  assert.equal(result.decisionEnvelope.selectedAction.name, 'compose-answer');
  assert.equal(result.decisionEnvelope.selectedAction.payload.memoryQuery, 'primary laptop used by current user');
  assert.equal(result.decisionEnvelope.selectedAction.payload.memoryCandidates.length, 1);
  assert.equal(result.decisionEnvelope.diagnostics.semanticMemoryQueryAvailable, true);
  assert.equal(result.decisionEnvelope.diagnostics.semanticMemoryCandidateCount, 1);
});

test('bounded conversational recall prefers semantic memoryQuery over raw user text', async () => {
  let recalledQuery = null;
  const memoryProvider = {
    async query() { return { records: [], diagnostics: {} }; },
    async recall({ query }) {
      recalledQuery = query;
      return { records: [reportedMemory()], conflicts: [], diagnostics: { candidateCount: 1, returnedCount: 1, conflictCount: 0, truncated: false } };
    }
  };
  const assembler = createBoundedResponseContextAssembler({ memoryProvider, selfKnowledgeService: selfKnowledgeService(), environment: 'test', revision: 'test' });
  const context = await assembler.assemble({ request: request({ memoryQuery: 'primary laptop used by current user' }), semanticMessage: 'raw fallback should not win' });

  assert.equal(recalledQuery, 'primary laptop used by current user');
  assert.equal(context.memoryRecall.querySource, 'semantic-memory-query');
  assert.equal(context.memoryRecall.knowledgeState, 'UNCERTAIN');
  assert.equal(context.reportedUserMemory.length, 1);
});

test('knowledge state distinguishes UNKNOWN, OUTDATED and CONFLICTED', async () => {
  const responses = [
    { records: [], conflicts: [], diagnostics: { candidateCount: 0, returnedCount: 0, conflictCount: 0 } },
    { records: [], conflicts: [], diagnostics: { candidateCount: 1, returnedCount: 0, conflictCount: 0, excludedLifecycle: 1 } },
    { records: [reportedMemory()], conflicts: [{ key: 'device.primary-laptop', memoryIds: ['mem-1', 'mem-2'] }], diagnostics: { candidateCount: 2, returnedCount: 2, conflictCount: 1 } }
  ];
  const memoryProvider = {
    async query() { return { records: [], diagnostics: {} }; },
    async recall() { return responses.shift(); }
  };
  const assembler = createBoundedResponseContextAssembler({ memoryProvider, selfKnowledgeService: selfKnowledgeService(), environment: 'test', revision: 'test' });

  assert.equal((await assembler.assemble({ request: request({ memoryQuery: 'x' }) })).memoryRecall.knowledgeState, 'UNKNOWN');
  assert.equal((await assembler.assemble({ request: request({ memoryQuery: 'x' }) })).memoryRecall.knowledgeState, 'OUTDATED');
  assert.equal((await assembler.assemble({ request: request({ memoryQuery: 'x' }) })).memoryRecall.knowledgeState, 'CONFLICTED');
});

test('ContextResolver bridges Memory2 record shape and forwards structured capture', async () => {
  const captures = [];
  const memory2Record = {
    id: 'm2-1',
    layer: 'user-memory',
    key: 'device.primary-laptop',
    value: 'ThinkPad T14',
    memoryScope: { kind: 'user', ownerGlobalUserId: 'usr-a', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    provenance: { sourceType: 'automatic-capture', sourceId: 'source-1', actorId: 'usr-a' },
    trust: 'reported',
    confirmed: false,
    createdAt: '2026-08-14T05:00:00.000Z',
    updatedAt: '2026-08-14T05:00:00.000Z',
    expiresAt: null,
    tags: ['device']
  };
  const provider = {
    async query() { return { records: [memory2Record], diagnostics: { excludedExpired: 0, excludedScope: 0 } }; },
    async write() { return { status: 'written' }; },
    async capture(input) { captures.push(input); return { status: 'written', persisted: true }; }
  };
  const resolver = createContextResolver({ memoryProvider: provider });
  const bundle = await resolver.resolve({ traceId: 't', requestId: 'r', scope, layers: ['user-memory'], keys: [], maxRecords: 5, now: '2026-08-14T06:00:00.000Z' });

  assert.equal(bundle.records[0].scope.userScope, 'usr-a');
  assert.equal(bundle.records[0].scope.projectScope, 'sg2.1');
  await resolver.capture({ text: 'fact', scope, actor, metadata: { memoryCandidate: { key: 'x' } } });
  assert.equal(captures.length, 1);
});
