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

test('BoundedResponseContext includes only confirmed memory in the verified actor scope', async () => {
  const memoryProvider = createInMemoryMemoryProvider();
  await memoryProvider.write({ layer: 'user-memory', key: 'name', value: 'Alice', scope: scopeA, provenance: { sourceType: 'user', sourceId: 'a', actorId: 'user:a' }, trust: 'confirmed', confirmed: true });
  await memoryProvider.write({ layer: 'user-memory', key: 'private', value: 'Bob secret', scope: scopeB, provenance: { sourceType: 'user', sourceId: 'b', actorId: 'user:b' }, trust: 'confirmed', confirmed: true });
  await memoryProvider.write({ layer: 'session', key: 'raw-dialogue', value: 'not confirmed', scope: scopeA, provenance: { sourceType: 'dialogue', sourceId: 'x', actorId: 'user:a' }, trust: 'reported', confirmed: false });
  const selfKnowledgeService = await seededSelfKnowledge();
  const assembler = createBoundedResponseContextAssembler({ memoryProvider, selfKnowledgeService, environment: 'test' });
  const context = await assembler.assemble({ request: requestFor('user:a', scopeA) });
  assert.equal(context.identity.globalUserId, 'user:a');
  assert.deepEqual(context.confirmedUserMemory.map((item) => item.value), ['Alice']);
  assert.equal(JSON.stringify(context).includes('Bob secret'), false);
  assert.equal(JSON.stringify(context).includes('not confirmed'), false);
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
  for (let index = 0; index < 20; index += 1) {
    await memoryProvider.write({ layer: 'user-memory', key: `k${index}`, value: 'x'.repeat(500), scope: scopeA, provenance: { sourceType: 'user', sourceId: String(index), actorId: 'user:a' }, trust: 'confirmed', confirmed: true });
  }
  const selfKnowledgeService = await seededSelfKnowledge();
  const assembler = createBoundedResponseContextAssembler({ memoryProvider, selfKnowledgeService, environment: 'test', maxUserMemory: 8, maxCharacters: 4000 });
  const context = await assembler.assemble({ request: requestFor('user:a', scopeA) });
  assert.ok(JSON.stringify(context).length <= 4000);
  assert.equal(context.truncationEvidence.userMemory, true);
  assert.ok(context.confirmedUserMemory.length <= 8);
});
