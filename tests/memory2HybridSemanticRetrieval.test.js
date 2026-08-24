import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryMemory2Store } from '../src/memory2/inMemoryMemory2Store.js';
import { createMemory2Service } from '../src/memory2/memory2.js';

const scope = (user = 'usr_a', groupScope = null) => ({ userScope: user, projectScope: 'sg2.1', groupScope, threadScope: null });
const actor = (id = 'usr_a', roles = ['citizen']) => ({ globalUserId: id, roles, grants: [], authenticationLevel: 'verified' });

function fakeRouter(handler) {
  const calls = [];
  return Object.freeze({ calls, async route(request) { calls.push(request); return handler(request); } });
}
function scoresFromRequest(request, scoreFor) {
  const payload = JSON.parse(request.messages.at(-1).content);
  return { payload, result: { text: JSON.stringify({ scores: payload.candidates.map((candidate) => ({ id: candidate.id, relevance: scoreFor(candidate) })) }) } };
}

async function write(service, input) {
  return service.write({ scope: scope(), actor: actor(), confirmed: true, trust: 'confirmed', provenance: { sourceType: 'test', sourceId: input.id ?? input.key, sourceTimestamp: '2026-08-18T10:00:00.000Z' }, ...input });
}

test('HS2: semantic-only relevance can surface an authorized Memory 2.0 fact', async () => {
  const router = fakeRouter((request) => scoresFromRequest(request, (candidate) => candidate.key === 'haldex-maintenance' ? 1 : 0).result);
  const service = createMemory2Service({ store: createInMemoryMemory2Store(), clock: () => new Date('2026-08-18T12:00:00.000Z'), aiRouter: router });
  await write(service, { id: 'm1', key: 'haldex-maintenance', value: 'Fourth-generation coupling pump and filter service completed' });
  await write(service, { id: 'm2', key: 'food', value: 'Pasta preference' });
  const result = await service.recall({ scope: scope(), actor: actor(), query: 'обслуживание полного привода автомобиля', maxRecords: 1, maxCharacters: 5000 });
  assert.equal(result.records[0].key, 'haldex-maintenance');
  assert.equal(result.diagnostics.semanticUsed, true);
  assert.equal(router.calls[0].task, 'semantic-interpretation');
  assert.equal(router.calls[0].reason, 'memory2-hybrid-semantic-retrieval');
});

test('HS2: AI sees only bounded authorized current candidates after scope/privacy/lifecycle filtering', async () => {
  let seen = null;
  const router = fakeRouter((request) => { const parsed = scoresFromRequest(request, () => 0.5); seen = parsed.payload; return parsed.result; });
  const service = createMemory2Service({ store: createInMemoryMemory2Store(), clock: () => new Date('2026-08-18T12:00:00.000Z'), aiRouter: router });
  await write(service, { id: 'own', key: 'own-fact', value: 'authorized' });
  await service.write({ id: 'other', key: 'other-private', value: 'must-never-reach-ai', scope: scope('usr_b'), actor: actor('usr_b'), confirmed: true, provenance: { sourceType: 'test', sourceId: 'other' } });
  await service.write({ id: 'expired', key: 'expired-fact', value: 'expired-secret-like-content', scope: scope(), actor: actor(), confirmed: false, temporary: true, expiresAt: '2026-08-18T11:00:00.000Z', provenance: { sourceType: 'test', sourceId: 'expired' } });
  await service.recall({ scope: scope(), actor: actor(), query: 'fact', maxRecords: 5, maxCharacters: 5000 });
  assert.ok(seen);
  assert.deepEqual(seen.candidates.map((item) => item.id), ['own']);
  assert.equal(seen.candidates.some((item) => item.text.includes('must-never-reach-ai') || item.text.includes('expired-secret-like-content')), false);
  assert.ok(seen.candidates.length <= 100);
});

test('HS2: exact lexical boosts remain stronger than adverse semantic scores', async () => {
  const router = fakeRouter((request) => scoresFromRequest(request, (candidate) => candidate.key === 'unrelated' ? 1 : 0).result);
  const service = createMemory2Service({ store: createInMemoryMemory2Store(), clock: () => new Date('2026-08-18T12:00:00.000Z'), aiRouter: router });
  await write(service, { id: 'exact', key: 'timezone', value: 'Europe/Kyiv' });
  await write(service, { id: 'other', key: 'unrelated', value: 'miscellaneous' });
  const result = await service.recall({ scope: scope(), actor: actor(), query: 'timezone', keys: ['timezone'], maxRecords: 1, maxCharacters: 5000 });
  assert.equal(result.records[0].id, 'exact');
});

test('HS2: invalid AI output falls back to the deterministic legacy recall result', async () => {
  const router = fakeRouter(async () => ({ text: JSON.stringify({ scores: [{ id: 'not-authorized-candidate', relevance: 1 }] }) }));
  const service = createMemory2Service({ store: createInMemoryMemory2Store(), clock: () => new Date('2026-08-18T12:00:00.000Z'), aiRouter: router });
  await write(service, { id: 'a', key: 'timezone', value: 'Europe/Kyiv' });
  await write(service, { id: 'b', key: 'food', value: 'pasta' });
  const result = await service.recall({ scope: scope(), actor: actor(), query: 'timezone', maxRecords: 1, maxCharacters: 5000 });
  assert.equal(result.records[0].id, 'a');
  assert.equal(result.diagnostics.semanticUsed, undefined);
});

test('HS2: AI Router failure falls back deterministically without changing authorization', async () => {
  const router = fakeRouter(async () => { throw Object.assign(new Error('router unavailable'), { code: 'AI_PROVIDER_ERROR' }); });
  const service = createMemory2Service({ store: createInMemoryMemory2Store(), clock: () => new Date('2026-08-18T12:00:00.000Z'), aiRouter: router });
  await write(service, { id: 'a', key: 'timezone', value: 'Europe/Kyiv' });
  await write(service, { id: 'b', key: 'food', value: 'pasta' });
  const first = await service.recall({ scope: scope(), actor: actor(), query: 'timezone', maxRecords: 2, maxCharacters: 5000 });
  const second = await service.recall({ scope: scope(), actor: actor(), query: 'timezone', maxRecords: 2, maxCharacters: 5000 });
  assert.deepEqual(first, second);
  assert.equal(first.diagnostics.semanticUsed, undefined);
});
