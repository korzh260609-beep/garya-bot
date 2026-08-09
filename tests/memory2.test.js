import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryMemory2Store } from '../src/memory2/inMemoryMemory2Store.js';
import { createMemory2Scope, createMemory2Service, createMemory2Provider } from '../src/memory2/memory2.js';

function mutableClock(initial = '2026-08-09T08:00:00.000Z') {
  let current = new Date(initial);
  return { now: () => new Date(current), set: (value) => { current = new Date(value); } };
}
function scope(user = 'usr_a', groupScope = null, threadScope = null, projectScope = 'sg2.1') {
  return { userScope: user, projectScope, groupScope, threadScope };
}
function actor(id = 'usr_a', roles = ['citizen'], grants = []) {
  return { globalUserId: id, roles, grants, authenticationLevel: 'verified' };
}
function serviceFixture(initial) {
  const time = mutableClock(initial);
  const store = createInMemoryMemory2Store();
  const events = [];
  const service = createMemory2Service({ store, clock: time.now, audit: (event) => events.push(event) });
  return { time, store, events, service, provider: createMemory2Provider({ service, clock: time.now }) };
}

// M1 — Memory Scope Model
test('M1: shared group scope is first-class and has no fake global user owner', () => {
  const group = createMemory2Scope({ kind: 'group', projectScope: 'sg2.1', groupScope: 'group:1' });
  assert.equal(group.ownerGlobalUserId, null);
  assert.equal(group.groupScope, 'group:1');
  assert.throws(() => createMemory2Scope({ kind: 'thread', projectScope: 'sg2.1', threadScope: 'thread:1' }), /requires group/i);
  assert.throws(() => createMemory2Scope({ kind: 'group', ownerGlobalUserId: 'usr_a', projectScope: 'sg2.1', groupScope: 'group:1' }), /no owner/i);
});

test('M1: personal, user-group, group, thread and project scopes do not contaminate each other', async () => {
  const { service } = serviceFixture();
  await service.write({ key: 'personal', value: 'A', scope: scope(), actor: actor(), confirmed: true });
  await service.write({ key: 'local', value: 'A@G1', scope: scope('usr_a','g1'), actor: actor(), scopeKind: 'user-group', confirmed: true });
  await service.write({ key: 'shared', value: 'G1', scope: scope('usr_a','g1'), actor: actor('usr_a',['manager']), scopeKind: 'group', shared: true, confirmed: true });
  await service.write({ key: 'thread', value: 'T1', scope: scope('usr_a','g1','t1'), actor: actor('usr_a',['manager']), scopeKind: 'thread', shared: true, confirmed: true });
  await service.write({ key: 'project', value: 'P', scope: scope(), actor: actor('usr_a',['monarch']), scopeKind: 'project', shared: true, confirmed: true });

  assert.deepEqual((await service.recall({ scope: scope(), actor: actor(), query: '' })).records.map((r) => r.key), ['personal']);
  assert.deepEqual(new Set((await service.recall({ scope: scope('usr_a','g1'), actor: actor(), query: '' })).records.map((r) => r.key)), new Set(['local','shared']));
  assert.deepEqual(new Set((await service.recall({ scope: scope('usr_a','g1','t1'), actor: actor(), query: '' })).records.map((r) => r.key)), new Set(['thread']));
});

// M2 — Shared Group Memory
test('M2: shared group fact is readable by another participant in same group but not another group', async () => {
  const { service } = serviceFixture();
  const write = await service.write({ key: 'release-date', value: '2026-09-01', scope: scope('usr_a','g1'), actor: actor('usr_a',['manager']), scopeKind: 'group', shared: true, confirmed: true, provenance: { sourceType: 'group-decision', sourceId: 'msg-1' } });
  assert.equal(write.record.memoryScope.ownerGlobalUserId, null);
  assert.equal(write.record.provenance.actorId, 'usr_a');

  const sameGroup = await service.recall({ scope: scope('usr_b','g1'), actor: actor('usr_b'), query: 'release date' });
  const otherGroup = await service.recall({ scope: scope('usr_b','g2'), actor: actor('usr_b'), query: 'release date' });
  assert.equal(sameGroup.records.length, 1);
  assert.equal(sameGroup.records[0].value, '2026-09-01');
  assert.equal(otherGroup.records.length, 0);
});

test('M2/M7: private member memory is never implicitly returned as shared group memory', async () => {
  const { service } = serviceFixture();
  await service.write({ key: 'preference', value: 'private-value', scope: scope('usr_a','g1'), actor: actor('usr_a'), scopeKind: 'user-group', confirmed: true });
  const otherMember = await service.recall({ scope: scope('usr_b','g1'), actor: actor('usr_b'), query: 'preference' });
  assert.equal(otherMember.records.length, 0);
});

// M7 — Permissions & Privacy
test('M7: unauthorized shared mutation fails before persistence', async () => {
  const { service, store } = serviceFixture();
  await assert.rejects(() => service.write({ key: 'rule', value: 'x', scope: scope('usr_a','g1'), actor: actor('usr_a',['citizen']), scopeKind: 'group', shared: true, confirmed: true }), (error) => error.code === 'memory-write-denied');
  assert.equal((await store.listAll()).length, 0);
});

test('M7: system privacy cannot be created through ordinary memory path and secrets are rejected', async () => {
  const { service, store } = serviceFixture();
  await assert.rejects(() => service.write({ key: 'self', value: 'SG identity', scope: scope(), actor: actor(), privacyClass: 'system', confirmed: true }), /system\/self knowledge/i);
  await assert.rejects(() => service.write({ key: 'credential', value: { api_key: 'abc123' }, scope: scope(), actor: actor(), confirmed: true }), (error) => error.code === 'memory-secret-rejected');
  assert.equal((await store.listAll()).length, 0);
});

test('M7: private-to-shared promotion is explicit and authority-bound', async () => {
  const { service } = serviceFixture();
  const personal = await service.write({ key: 'approved-fact', value: 'share-me', scope: scope(), actor: actor(), confirmed: true });
  await assert.rejects(() => service.promote({ memoryId: personal.record.id, scope: scope('usr_a','g1'), actor: actor('usr_a',['citizen']), targetScopeKind: 'group' }), (error) => error.code === 'memory-promote-denied');
  const promoted = await service.promote({ memoryId: personal.record.id, scope: scope('usr_a','g1'), actor: actor('usr_a',['manager']), targetScopeKind: 'group' });
  assert.equal(promoted.record.memoryScope.kind, 'group');
  assert.equal(promoted.record.metadata.promotedFrom, personal.record.id);
});

// M3 — Automatic Memory Capture
test('M3: chatter and sensitive text are suppressed while useful preferences remain proposed, not confirmed', async () => {
  const { service } = serviceFixture();
  assert.equal((await service.capture({ text: 'Привет', scope: scope(), actor: actor() })).status, 'suppressed');
  assert.equal((await service.capture({ text: 'my api_key is abc123', scope: scope(), actor: actor() })).reason, 'sensitive');
  const captured = await service.capture({ text: 'Я предпочитаю короткие ответы', scope: scope(), actor: actor(), metadata: { sourceId: 'm-pref' } });
  assert.equal(captured.persisted, true);
  assert.equal(captured.record.memoryScope.kind, 'user');
  assert.equal(captured.record.confirmed, false);
  assert.equal(captured.record.trust, 'reported');
});

test('M3: group decisions route to shared thread/group only when write policy permits', async () => {
  const { service } = serviceFixture();
  const denied = await service.capture({ text: 'Мы решили релиз 1 сентября', scope: scope('usr_a','g1'), actor: actor('usr_a',['citizen']), metadata: { sourceId: 'm1' } });
  assert.equal(denied.status, 'proposed');
  assert.equal(denied.persisted, false);

  const group = await service.capture({ text: 'Мы решили релиз 1 сентября', scope: scope('usr_a','g1'), actor: actor('usr_a',['manager']), metadata: { sourceId: 'm2' } });
  assert.equal(group.record.memoryScope.kind, 'group');
  assert.equal(group.record.confirmed, false);

  const thread = await service.capture({ text: 'Мы решили обсуждать это здесь', scope: scope('usr_a','g1','t1'), actor: actor('usr_a',['manager']), metadata: { sourceId: 'm3' } });
  assert.equal(thread.record.memoryScope.kind, 'thread');
  assert.equal(thread.record.memoryScope.threadScope, 't1');
});

test('M3: automatic path can never mark captured text as confirmed truth', async () => {
  const { service } = serviceFixture();
  await assert.rejects(() => service.write({ automatic: true, key: 'x', value: 'fact', scope: scope(), actor: actor(), confirmed: true }), (error) => error.code === 'memory-auto-confirmation-denied');
});

// M4 — Consolidation
test('M4: semantic-equivalent duplicate is rejected before growth', async () => {
  const { service, store } = serviceFixture();
  assert.equal((await service.write({ key: 'color', value: 'Blue car', scope: scope(), actor: actor(), confirmed: true })).status, 'written');
  assert.equal((await service.write({ key: 'color', value: 'blue-car', scope: scope(), actor: actor(), confirmed: true })).status, 'duplicate');
  assert.equal((await store.listAll()).length, 1);
});

test('M4: newer confirmed value supersedes older value while preserving history', async () => {
  const { service, store, time } = serviceFixture('2026-08-09T08:00:00.000Z');
  const first = await service.write({ key: 'city', value: 'Kyiv', scope: scope(), actor: actor(), confirmed: true });
  time.set('2026-08-10T08:00:00.000Z');
  const second = await service.write({ key: 'city', value: 'Amsterdam', scope: scope(), actor: actor(), confirmed: true });
  assert.equal(second.status, 'conflict');
  const result = await service.consolidate({ scope: scope(), actor: actor() });
  assert.equal(result.superseded, 1);
  const old = await store.get(first.record.id);
  assert.equal(old.lifecycleState, 'superseded');
  assert.equal(old.supersededBy, second.record.id);
  const history = await service.inspect({ memoryId: first.record.id, scope: scope(), actor: actor() });
  assert.equal(history.chain.length, 2);
});

test('M4: topic digest keeps source record links and never upgrades trust automatically', async () => {
  const { service } = serviceFixture();
  await service.write({ key: 'project-alpha', value: 'deadline Monday', scope: scope(), actor: actor(), confirmed: true });
  const digest = await service.createDigest({ scope: scope(), actor: actor(), topic: 'project alpha' });
  assert.equal(digest.status, 'written');
  assert.equal(digest.record.layer, 'topic-digest');
  assert.equal(digest.record.confirmed, false);
  assert.equal(digest.record.trust, 'reported');
  assert.ok(digest.record.value.sourceIds.length >= 1);
});

// M5 — Intelligent Recall
test('M5: exact key/topic and relevance rank above unrelated memory and recall is bounded', async () => {
  const { service } = serviceFixture();
  await service.write({ key: 'timezone', value: 'Europe/Amsterdam', scope: scope(), actor: actor(), confirmed: true });
  await service.write({ key: 'food', value: 'pasta', scope: scope(), actor: actor(), confirmed: true });
  await service.write({ key: 'car', value: 'Passat', scope: scope(), actor: actor(), confirmed: true });
  const recall = await service.recall({ scope: scope(), actor: actor(), query: 'what is my timezone', keys: ['timezone'], maxRecords: 1, maxCharacters: 2000 });
  assert.equal(recall.records.length, 1);
  assert.equal(recall.records[0].key, 'timezone');
  assert.equal(recall.diagnostics.truncated, false);
});

test('M5: conflicting active facts are returned as explicit conflict, not false certainty', async () => {
  const { service, time } = serviceFixture();
  await service.write({ key: 'status', value: 'A', scope: scope(), actor: actor(), confirmed: false, trust: 'reported' });
  time.set('2026-08-09T08:01:00.000Z');
  await service.write({ key: 'status', value: 'B', scope: scope(), actor: actor(), confirmed: false, trust: 'reported' });
  const recall = await service.recall({ scope: scope(), actor: actor(), query: 'status' });
  assert.equal(recall.records.length, 2);
  assert.equal(recall.conflicts.length, 1);
});

// M6 — Cross-Platform Global Memory
test('M6: verified global identity carries personal memory across transports; different identity does not', async () => {
  const { service } = serviceFixture();
  const telegramActor = { ...actor('usr_global'), platform: 'telegram', platformUserId: '100' };
  const webActor = { ...actor('usr_global'), platform: 'web', platformUserId: 'session-2' };
  await service.write({ key: 'name', value: 'Gary', scope: scope('usr_global'), actor: telegramActor, confirmed: true });
  const linked = await service.recall({ scope: scope('usr_global'), actor: webActor, query: 'name' });
  const unlinked = await service.recall({ scope: scope('usr_other'), actor: { ...actor('usr_other'), platform: 'web' }, query: 'name' });
  assert.equal(linked.records[0].value, 'Gary');
  assert.equal(unlinked.records.length, 0);
});

test('M6: group memory stays resource-local even for same global identity', async () => {
  const { service } = serviceFixture();
  await service.write({ key: 'rule', value: 'G1 only', scope: scope('usr_global','g1'), actor: actor('usr_global',['manager']), scopeKind: 'group', shared: true, confirmed: true });
  assert.equal((await service.recall({ scope: scope('usr_global','g1'), actor: actor('usr_global'), query: 'rule' })).records.length, 1);
  assert.equal((await service.recall({ scope: scope('usr_global','g2'), actor: actor('usr_global'), query: 'rule' })).records.length, 0);
});

// M8 — Lifecycle
test('M8: temporary memory expires deterministically and remains available only in history', async () => {
  const { service, store, time } = serviceFixture('2026-08-09T08:00:00.000Z');
  const write = await service.write({ key: 'temporary', value: 'now', scope: scope(), actor: actor(), confirmed: false, temporary: true, expiresAt: '2026-08-09T09:00:00.000Z' });
  assert.equal((await service.recall({ scope: scope(), actor: actor(), query: 'temporary' })).records.length, 1);
  time.set('2026-08-09T10:00:00.000Z');
  assert.deepEqual(await service.reconcileLifecycle({ projectScope: 'sg2.1' }), { expired: 1 });
  assert.equal((await service.recall({ scope: scope(), actor: actor(), query: 'temporary' })).records.length, 0);
  assert.equal((await store.get(write.record.id)).lifecycleState, 'expired');
  assert.equal((await service.inspect({ memoryId: write.record.id, scope: scope(), actor: actor() })).record.lifecycleState, 'expired');
});

test('M8: permanent confirmed memory is protected from generic deletion', async () => {
  const { service } = serviceFixture();
  const write = await service.write({ key: 'permanent', value: 'keep', scope: scope(), actor: actor(), confirmed: true, retentionClass: 'permanent' });
  await assert.rejects(() => service.delete({ memoryId: write.record.id, scope: scope(), actor: actor() }), (error) => error.code === 'memory-retention-protected');
});

// M9 — Control / Diagnostics / Integrity
test('M9: diagnostics are scope-authorized and expose counters without memory payloads', async () => {
  const { service } = serviceFixture();
  await service.write({ key: 'a', value: 'one', scope: scope(), actor: actor(), confirmed: true });
  await service.write({ key: 'b', value: 'two', scope: scope(), actor: actor(), confirmed: true });
  const report = await service.diagnostics({ scope: scope(), actor: actor() });
  assert.equal(report.total, 2);
  assert.equal(report.byPrivacy.private, 2);
  assert.equal(JSON.stringify(report).includes('one'), false);
  assert.equal(JSON.stringify(report).includes('two'), false);
});

test('M9: integrity checker validates scope/supersession chains and audit never receives raw memory value', async () => {
  const { service, events } = serviceFixture();
  await service.write({ key: 'safe-key', value: 'private-content-that-must-not-be-telemetry', scope: scope(), actor: actor(), confirmed: true });
  const integrity = await service.integrityCheck({ projectScope: 'sg2.1' });
  assert.equal(integrity.ok, true);
  assert.equal(JSON.stringify(events).includes('private-content-that-must-not-be-telemetry'), false);
});
