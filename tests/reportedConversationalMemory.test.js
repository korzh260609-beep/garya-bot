import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoundedResponseContextAssembler } from '../src/response/boundedResponseContext.js';
import { createIdentityResponseContract } from '../src/identity/identityResponseContract.js';
import { conversationalMemoryInstruction } from '../src/language/conversationalMemoryPolicy.js';
import { createLanguageAwareConversationResponder } from '../src/language/languageAwareConversationResponder.js';

function reportedRecord(owner = 'usr-a') {
  return {
    id: 'mem-1',
    layer: 'user-memory',
    key: 'vehicle.primary',
    value: 'У меня автомобиль Freelander 2 2008 года.',
    trust: 'reported',
    confirmed: false,
    updatedAt: '2026-08-14T05:00:00.000Z',
    privacyClass: 'private',
    memoryScope: { kind: 'user', ownerGlobalUserId: owner, projectScope: 'sg2.1', groupScope: null, threadScope: null },
    provenance: { sourceType: 'automatic-capture', sourceId: 'req-1' }
  };
}

function request(globalUserId = 'usr-a') {
  return {
    actor: { globalUserId, roles: ['guest'], grants: [], authenticationLevel: 'verified', profile: null },
    scope: { userScope: globalUserId, projectScope: 'sg2.1', groupScope: null, threadScope: null },
    input: { text: 'Какая у меня машина?', languageContext: { responseLanguage: 'ru' }, semanticIntent: 'personal_fact_recall' },
    traceContext: { traceId: 'trace-1', requestId: 'req-2', environment: 'test', revision: 'test' }
  };
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

test('reported same-user memory reaches conversational context but not confirmed memory', async () => {
  const memoryProvider = {
    async query() { return { records: [], diagnostics: {} }; },
    async recall({ actor }) {
      const record = reportedRecord();
      const records = record.memoryScope.ownerGlobalUserId === actor.globalUserId ? [record] : [];
      return { records, conflicts: [], diagnostics: { candidateCount: records.length, returnedCount: records.length, conflictCount: 0, truncated: false } };
    }
  };
  const assembler = createBoundedResponseContextAssembler({
    memoryProvider,
    selfKnowledgeService: selfKnowledgeService(),
    environment: 'test',
    revision: 'test'
  });
  const context = await assembler.assemble({ request: request(), semanticMessage: 'vehicle owned by current user' });

  assert.equal(context.reportedUserMemory.length, 1);
  assert.equal(context.reportedUserMemory[0].key, 'vehicle.primary');
  assert.equal(context.reportedUserMemory[0].confirmed, false);
  assert.equal(context.confirmedUserMemory.length, 0);
});

test('reported private memory is not available to another user', async () => {
  const memoryProvider = {
    async query() { return { records: [], diagnostics: {} }; },
    async recall({ actor }) {
      const record = reportedRecord();
      const records = record.memoryScope.ownerGlobalUserId === actor.globalUserId ? [record] : [];
      return { records, conflicts: [], diagnostics: { candidateCount: records.length, returnedCount: records.length, conflictCount: 0, truncated: false } };
    }
  };
  const assembler = createBoundedResponseContextAssembler({
    memoryProvider,
    selfKnowledgeService: selfKnowledgeService(),
    environment: 'test',
    revision: 'test'
  });
  const context = await assembler.assemble({ request: request('usr-b'), semanticMessage: 'vehicle owned by current user' });

  assert.equal(context.reportedUserMemory.length, 0);
  assert.equal(context.confirmedUserMemory.length, 0);
});

test('identity contract never promotes reported conversational memory', () => {
  const context = {
    identity: {
      globalUserId: 'usr-a',
      roles: ['guest'],
      profile: null,
      profileAuthority: 'descriptive-only',
      authenticationLevel: 'verified'
    },
    confirmedUserMemory: [],
    reportedUserMemory: [reportedRecord()]
  };
  const contract = createIdentityResponseContract({ semanticIntent: 'user_identity', boundedResponseContext: context });

  assert.equal(contract.active, true);
  assert.equal(contract.payload.verifiedGlobalUserId, 'usr-a');
  assert.deepEqual(contract.payload.permittedConfirmedMemory, []);
  assert.equal(JSON.stringify(contract).includes('Freelander'), false);
});

test('response model receives reported memory plus explicit conversational policy', async () => {
  const context = {
    version: '2.1',
    identity: { globalUserId: 'usr-a', roles: ['guest'], profile: null, profileAuthority: 'descriptive-only' },
    confirmedUserMemory: [],
    reportedUserMemory: [reportedRecord()],
    selfKnowledge: { validationStatus: 'valid', facts: [] }
  };
  let routed = null;
  const responder = createLanguageAwareConversationResponder({
    responseContextAssembler: { async assemble() { return context; } },
    aiRouter: {
      async route(input) {
        routed = input;
        return { text: 'Ты раньше говорил, что у тебя Freelander 2 2008 года.' };
      }
    }
  });
  const output = await responder({ text: 'Какая у меня машина?', request: request() });

  assert.match(output, /Freelander 2/u);
  const systemText = routed.messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n');
  assert.match(systemText, /reportedUserMemory/u);
  assert.match(systemText, /Freelander 2/u);
  assert.match(systemText, /Never use reportedUserMemory to create, prove, change or upgrade identity/u);
});

test('conversational policy treats missing recall as knowledge gap and keeps reported facts non-authoritative', () => {
  const policy = conversationalMemoryInstruction();
  assert.match(policy, /normal knowledge gap/i);
  assert.match(policy, /Never use reportedUserMemory to create, prove, change or upgrade identity/i);
  assert.match(policy, /do not turn ordinary conversation into a questionnaire/i);
});
