import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryMemoryProvider } from '../src/memory/inMemoryMemoryProvider.js';
import { createInMemorySelfKnowledgeStore, createSelfKnowledgeBuilder, createSelfKnowledgeService } from '../src/selfKnowledge/selfKnowledge.js';
import { createBoundedResponseContextAssembler } from '../src/response/boundedResponseContext.js';

const scopeA = { userScope: 'user:a', projectScope: 'sg2.1', groupScope: null, threadScope: null };
const scopeB = { userScope: 'user:b', projectScope: 'sg2.1', groupScope: null, threadScope: null };

async function seededSelfKnowledge() {
  const store = createInMemorySelfKnowledgeStore();
  const builder = createSelfKnowledgeBuilder({ store, sources: [{ id: 'canonical', async collect() { return { facts: [{ category: 'identity', key: 'system-name', value: 'SG', status: 'implemented', kind: 'authority', provenance: { sourceType: 'authority', sourceId: 'pillars/SG_ENTITY.md', sourceRevision: 'r1' } }] }; } }] });
  await builder.rebuild({ sourceRevision: 'r1', environment: 'test' });
  return createSelfKnowledgeService({ store });
}
function requestFor(globalUserId, scope, input = {}, profile = null) {
  return { actor: { globalUserId, platform: 'telegram', platformUserId: globalUserId, roles: ['guest'], grants: ['capability:compose-answer'], authenticationLevel: 'verified', profile }, scope, input, traceContext: { traceId: `trace:${globalUserId}`, requestId: `request:${globalUserId}`, environment: 'test', revision: 'r1' } };
}
function recalledRecord({ id, key, value, ownerGlobalUserId = 'user:a', trust = 'reported', confirmed = false }) {
  return { id, layer: 'user-memory', key, value, trust, confirmed, updatedAt: '2026-08-14T05:00:00.000Z', privacyClass: 'private', memoryScope: { kind: 'user', ownerGlobalUserId, projectScope: 'sg2.1', groupScope: null, threadScope: null }, provenance: { sourceType: confirmed ? 'user' : 'automatic-capture', sourceId: id } };
}

test('BoundedResponseContext separates confirmed and reported user memory inside verified actor scope', async () => {
  const records = [recalledRecord({ id: 'confirmed-a', key: 'name', value: 'Alice', trust: 'confirmed', confirmed: true }), recalledRecord({ id: 'reported-a', key: 'vehicle.primary', value: 'Freelander 2' }), recalledRecord({ id: 'confirmed-b', key: 'private', value: 'Bob secret', ownerGlobalUserId: 'user:b', trust: 'confirmed', confirmed: true })];
  const memoryProvider = { async query() { return { records: [], diagnostics: {} }; }, async recall({ actor }) { const visible = records.filter((record) => record.memoryScope.ownerGlobalUserId === actor.globalUserId); return { records: visible, conflicts: [], diagnostics: { candidateCount: visible.length, returnedCount: visible.length, conflictCount: 0, truncated: false } }; } };
  const selfKnowledgeService = await seededSelfKnowledge();
  const assembler = createBoundedResponseContextAssembler({ memoryProvider, selfKnowledgeService, environment: 'test' });
  const context = await assembler.assemble({ request: requestFor('user:a', scopeA) });
  assert.equal(context.identity.globalUserId, 'user:a');
  assert.deepEqual(context.confirmedUserMemory.map((item) => item.value), ['Alice']);
  assert.deepEqual(context.reportedUserMemory.map((item) => item.value), ['Freelander 2']);
  assert.equal(context.reportedUserMemory[0].confirmed, false);
  assert.equal(context.reportedUserMemory[0].trust, 'reported');
  assert.equal(JSON.stringify(context).includes('Bob secret'), false);
  assert.equal(context.selfKnowledge.facts[0].value, 'SG');
});

test('BoundedResponseContext exposes descriptive profile only alongside already verified global identity', async () => {
  const memoryProvider = createInMemoryMemoryProvider();
  const selfKnowledgeService = await seededSelfKnowledge();
  const assembler = createBoundedResponseContextAssembler({ memoryProvider, selfKnowledgeService, environment: 'test' });
  const context = await assembler.assemble({ request: requestFor('user:a', scopeA, {}, { displayName: 'Игорь Корж', username: 'same_name', source: 'telegram' }) });
  assert.equal(context.identity.globalUserId, 'user:a');
  assert.equal(context.identity.profile.displayName, 'Игорь Корж');
  assert.equal(context.identity.profile.username, 'same_name');
  assert.equal(context.identity.profileAuthority, 'descriptive-only');
  assert.deepEqual(context.identity.roles, ['guest']);
});

test('BoundedResponseContext preserves project/group/thread isolation and redacts secret-shaped data', async () => {
  const memoryProvider = createInMemoryMemoryProvider();
  const scoped = { userScope: 'user:a', projectScope: 'sg2.1', groupScope: 'group:1', threadScope: 'thread:1' };
  await memoryProvider.write({ layer: 'project-memory', key: 'credential-metadata', value: { token: 'must-not-leak', safe: 'ok' }, scope: scoped, provenance: { sourceType: 'project', sourceId: 'p', actorId: 'user:a' }, trust: 'confirmed', confirmed: true });
  const selfKnowledgeService = await seededSelfKnowledge();
  const assembler = createBoundedResponseContextAssembler({ memoryProvider, selfKnowledgeService, environment: 'test' });
  const context = await assembler.assemble({ request: requestFor('user:a', scoped) });
  assert.equal(context.scope.groupScope, 'group:1');
  assert.equal(context.scope.threadScope, 'thread:1');
  assert.equal(context.confirmedProjectMemory[0].value.token, '[REDACTED]');
  assert.equal(context.confirmedProjectMemory[0].value.safe, 'ok');
});

test('BoundedResponseContext enforces deterministic budget instead of dumping whole stores', async () => {
  const memoryProvider = createInMemoryMemoryProvider();
  for (let index = 0; index < 20; index += 1) await memoryProvider.write({ layer: 'user-memory', key: `k${index}`, value: 'x'.repeat(500), scope: scopeA, provenance: { sourceType: 'user', sourceId: String(index), actorId: 'user:a' }, trust: 'confirmed', confirmed: true });
  const selfKnowledgeService = await seededSelfKnowledge();
  const assembler = createBoundedResponseContextAssembler({ memoryProvider, selfKnowledgeService, environment: 'test', maxUserMemory: 8, maxCharacters: 4000 });
  const context = await assembler.assemble({ request: requestFor('user:a', scopeA) });
  assert.ok(JSON.stringify(context).length <= 4000);
  assert.equal(context.truncationEvidence.userMemory, true);
  assert.ok(context.confirmedUserMemory.length <= 8);
});

test('BoundedResponseContext keeps Conversation History separate from Memory 2.0', async () => {
  const memoryProvider = createInMemoryMemoryProvider();
  const selfKnowledgeService = await seededSelfKnowledge();
  const historyCalls = [];
  const conversationContextStore = {
    async listRecentMessages() { return []; },
    async retrieveHistory(input) {
      historyCalls.push(input);
      return { query: input.query, temporalRange: input.temporalRange, turns: [
        { direction: 'inbound', text: 'старое сообщение', createdAt: '2026-08-13T08:00:00.000Z' },
        { direction: 'outbound', text: 'старый ответ', createdAt: '2026-08-13T08:00:01.000Z' }
      ] };
    }
  };
  const temporalService = { async resolveForUser(_id, expression) { return { status: 'resolved', originalExpression: expression, utcStart: '2026-08-13T00:00:00.000Z', utcEndExclusive: '2026-08-14T00:00:00.000Z' }; } };
  const assembler = createBoundedResponseContextAssembler({ memoryProvider, selfKnowledgeService, environment: 'test', conversationContextStore, temporalService });
  const context = await assembler.assemble({ request: requestFor('user:a', scopeA, { conversationHistoryQuery: { query: 'prior discussion', temporalExpression: 'previous day', scope: 'current-scope', maxRecords: 100 } }) });
  assert.equal(historyCalls.length, 1);
  assert.equal(context.conversationHistory.query, 'prior discussion');
  assert.deepEqual(context.conversationHistory.turns.map((turn) => turn.text), ['старое сообщение', 'старый ответ']);
  assert.deepEqual(context.confirmedUserMemory, []);
  assert.equal(context.provenance.conversationHistoryReturned, 2);
});
