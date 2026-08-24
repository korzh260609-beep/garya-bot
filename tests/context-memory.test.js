import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryMemoryProvider } from '../src/memory/inMemoryMemoryProvider.js';
import { createContextResolver } from '../src/memory/contextResolver.js';
import { createContextAwareSemanticPipeline } from '../src/memory/contextAwareSemanticPipeline.js';
import { createSemanticKernel } from '../src/semantic/semanticKernel.js';
import { createFixtureMeaningInterpreter } from '../src/semantic/meaningInterpreter.js';
import { createIdentityContext, createScopeContext, createTraceContext } from '../src/contracts/context.js';

const fixedNow = new Date('2026-08-06T08:00:00.000Z');
const clock = () => fixedNow;
const SAFE_RESPONSE_FALLBACK = 'SG could not compose a conversational answer. Please try the request again.';

function scope(user = 'user:1', project = 'sg2.1', groupScope = null, threadScope = null) {
  return { userScope: user, projectScope: project, groupScope, threadScope };
}

function writeRequest(overrides = {}) {
  return {
    layer: 'user-memory',
    key: 'preferred-language',
    value: 'ru',
    scope: scope(),
    provenance: { sourceType: 'user-confirmation', sourceId: 'msg-1', actorId: 'user:1' },
    trust: 'confirmed',
    confirmed: true,
    ...overrides
  };
}

test('confirmed memory is written and resolved with provenance', async () => {
  const provider = createInMemoryMemoryProvider({ clock });
  const resolver = createContextResolver({ memoryProvider: provider });
  const write = await resolver.write(writeRequest());
  assert.equal(write.status, 'written');

  const bundle = await resolver.resolve({
    traceId: 'trace-1', requestId: 'request-1', scope: scope(), layers: ['user-memory'], now: fixedNow.toISOString()
  });
  assert.equal(bundle.records.length, 1);
  assert.equal(bundle.records[0].provenance.sourceId, 'msg-1');
  assert.equal(bundle.records[0].trust, 'confirmed');
});

test('cross-user and cross-project memory never leaks', async () => {
  const provider = createInMemoryMemoryProvider({ clock });
  const resolver = createContextResolver({ memoryProvider: provider });
  await resolver.write(writeRequest());

  const otherUser = await resolver.resolve({
    traceId: 't2', requestId: 'r2', scope: scope('user:2'), layers: ['user-memory']
  });
  const otherProject = await resolver.resolve({
    traceId: 't3', requestId: 'r3', scope: scope('user:1', 'other'), layers: ['user-memory']
  });
  assert.equal(otherUser.records.length, 0);
  assert.equal(otherProject.records.length, 0);
});

test('dialogue archive cannot be promoted to confirmed memory automatically', async () => {
  const provider = createInMemoryMemoryProvider({ clock });
  await assert.rejects(() => provider.write(writeRequest({
    layer: 'dialogue-archive', confirmed: true, trust: 'confirmed'
  })), /dialogue archive cannot be written as confirmed memory/);
  await assert.rejects(() => provider.write(writeRequest({
    layer: 'user-memory', confirmed: false, trust: 'reported'
  })), /confirmed memory layers require confirmed=true/);
});

test('duplicates are reported without creating a second record', async () => {
  const provider = createInMemoryMemoryProvider({ clock });
  assert.equal((await provider.write(writeRequest())).status, 'written');
  assert.equal((await provider.write(writeRequest())).status, 'duplicate');
  assert.equal((await provider.listAll()).length, 1);
});

test('conflicting values are preserved and reported', async () => {
  const provider = createInMemoryMemoryProvider({ clock });
  const first = await provider.write(writeRequest());
  const second = await provider.write(writeRequest({ value: 'uk', provenance: { sourceType: 'user-confirmation', sourceId: 'msg-2', actorId: 'user:1' } }));
  assert.equal(second.status, 'conflict');
  assert.deepEqual(second.conflictIds, [first.record.id]);
  assert.equal((await provider.listAll()).length, 2);
});

test('expired records are excluded', async () => {
  const provider = createInMemoryMemoryProvider({ clock });
  await provider.write(writeRequest({ expiresAt: '2026-08-06T07:59:59.000Z' }));
  const resolver = createContextResolver({ memoryProvider: provider });
  const bundle = await resolver.resolve({ traceId: 't', requestId: 'r', scope: scope(), layers: ['user-memory'], now: fixedNow.toISOString() });
  assert.equal(bundle.records.length, 0);
  assert.equal(bundle.diagnostics.excludedExpired, 1);
});

test('context bundle is deterministic and bounded', async () => {
  const provider = createInMemoryMemoryProvider({ clock });
  for (const key of ['c', 'a', 'b']) {
    await provider.write(writeRequest({ key, value: key }));
  }
  const resolver = createContextResolver({ memoryProvider: provider });
  const bundle = await resolver.resolve({
    traceId: 't', requestId: 'r', scope: scope(), layers: ['user-memory'], maxRecords: 2
  });
  assert.deepEqual(bundle.records.map((record) => record.key), ['a', 'b']);
  assert.equal(bundle.diagnostics.truncated, true);
});

test('only requested layers are loaded', async () => {
  const provider = createInMemoryMemoryProvider({ clock });
  await provider.write(writeRequest());
  await provider.write(writeRequest({
    layer: 'session', key: 'active-topic', value: 'memory', confirmed: false, trust: 'reported'
  }));
  const resolver = createContextResolver({ memoryProvider: provider });
  const bundle = await resolver.resolve({ traceId: 't', requestId: 'r', scope: scope(), layers: ['session'] });
  assert.deepEqual(bundle.records.map((record) => record.layer), ['session']);
});

test('semantic pipeline receives resolved context while response plan never exposes canonical user text', async () => {
  const provider = createInMemoryMemoryProvider({ clock });
  await provider.write(writeRequest());
  const resolver = createContextResolver({ memoryProvider: provider });
  let calls = 0;
  let finalMeaning = null;
  const interpreter = createFixtureMeaningInterpreter((input) => {
    calls += 1;
    const hasContext = Boolean(input.metadata.contextBundle);
    finalMeaning = hasContext ? 'Answer with memory' : 'Need memory';
    return {
      meaning: finalMeaning,
      goal: 'answer-user',
      intent: 'answer',
      contextNeeds: ['user-memory'],
      candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
      rationale: hasContext ? 'Context loaded' : 'Context requested'
    };
  });
  const pipeline = createContextAwareSemanticPipeline({
    semanticKernel: createSemanticKernel({ meaningInterpreter: interpreter }),
    contextResolver: resolver
  });
  const identityContext = createIdentityContext({ globalUserId: 'user:1', platform: 'local', platformUserId: '1' });
  const scopeContext = createScopeContext({ userScope: 'user:1', projectScope: 'sg2.1', allowedCapabilities: [] });
  const traceContext = createTraceContext({ traceId: 'trace', requestId: 'request', environment: 'test', revision: 'block-2' });
  const result = await pipeline.process({ text: 'Continue', locale: 'en', identityContext, scopeContext, traceContext });
  assert.equal(calls, 2);
  assert.equal(result.contextBundle.records.length, 1);
  assert.equal(finalMeaning, 'Answer with memory');
  assert.equal(result.responsePlan.message, SAFE_RESPONSE_FALLBACK);
  assert.notEqual(result.responsePlan.message, 'Continue');
  assert.notEqual(result.responsePlan.message, finalMeaning);
});
