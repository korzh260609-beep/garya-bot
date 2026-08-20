import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityManifest, createSystemCapabilityCatalog } from '../src/capability/systemCapabilityCatalog.js';
import { createDeploymentSelfKnowledgeSources } from '../src/selfKnowledge/deploymentSelfKnowledge.js';
import { createInMemorySelfKnowledgeStore, createSelfKnowledgeBuilder, createSelfKnowledgeService } from '../src/selfKnowledge/selfKnowledge.js';

test('system capability catalog aggregates runtime, GH3 and subsystem manifests', () => {
  const catalog = createSystemCapabilityCatalog({ runtimeCapabilityNames: ['memory2-recall', 'task-create'], sourceRevision: 'r1' });
  const ids = new Set(catalog.capabilities.map((item) => item.id));
  assert.ok(ids.has('memory2-recall'));
  assert.ok(ids.has('task-create'));
  assert.ok(ids.has('github.repository.read'));
  assert.ok(ids.has('telegram.group.observe'));
  assert.ok(ids.has('telegram.channel.publish'));
  assert.ok(ids.has('history.semantic-hybrid-search'));
  assert.ok(ids.has('project-memory.hybrid-retrieval'));
  assert.ok(ids.has('pdk.development-search'));
  assert.equal(catalog.perRequestExternalScan, false);
  assert.equal(catalog.grantsAuthority, false);
});

test('new subsystem capability appears through manifest registration without catalog logic changes', () => {
  const future = createCapabilityManifest({
    sourceId: 'test:future-subsystem',
    domain: 'future',
    capabilities: [{ id: 'future.interface.example', status: 'implemented', requiresAuthorization: false }]
  });
  const catalog = createSystemCapabilityCatalog({ runtimeCapabilityNames: [], sourceRevision: 'r2', additionalManifests: [future] });
  const capability = catalog.capabilities.find((item) => item.id === 'future.interface.example');
  assert.ok(capability);
  assert.equal(capability.domain, 'future');
  assert.equal(capability.status, 'implemented');
});

test('deployment Self Knowledge consumes compact cached catalog without external live scans', async () => {
  const noRead = new Proxy({}, { get() { throw new Error('external registry access is forbidden'); } });
  const custom = createCapabilityManifest({ sourceId: 'test:manifest', domain: 'custom', capabilities: [{ id: 'custom.dynamic.capability' }] });
  const store = createInMemorySelfKnowledgeStore();
  const sources = createDeploymentSelfKnowledgeSources({
    config: { revision: 'catalog-r1', environment: 'test' },
    capabilityNames: ['memory2-recall'],
    capabilityManifests: [custom],
    connectionRegistry: noRead,
    resourceAuthorityRegistry: noRead
  });
  const builder = createSelfKnowledgeBuilder({ store, sources });
  await builder.rebuild({ sourceRevision: 'catalog-r1', environment: 'test' });
  const service = createSelfKnowledgeService({ store });
  const result = await service.query({ environment: 'test', maxFacts: 20 });
  const fact = result.facts.find((item) => item.category === 'capabilities' && item.key === 'capability-catalog');
  assert.ok(fact);
  assert.equal(fact.value.perRequestExternalScan, false);
  assert.equal(fact.value.grantsAuthority, false);
  assert.ok(fact.value.domains.custom.includes('custom.dynamic.capability'));
  assert.ok(fact.value.domains.telegram.includes('telegram.group.observe'));
  assert.ok(fact.value.domains.github.includes('github.code.search'));
  assert.ok(fact.value.domains['historical-search'].includes('history.fact-history'));
  assert.equal(fact.value.defaultStatus, 'implemented');
  assert.equal(fact.value.statusOverrides['telegram.subscription.lifecycle'], 'partial');
  assert.ok(fact.value.permissionDependent.includes('github.contents.write'));
  assert.equal(Object.hasOwn(fact.value, 'capabilities'), false, 'bounded Self Knowledge must not duplicate full catalog metadata on every response');
});

test('catalog distinguishes partial and authorization-dependent capabilities', () => {
  const catalog = createSystemCapabilityCatalog({ sourceRevision: 'r3' });
  const subscription = catalog.capabilities.find((item) => item.id === 'telegram.subscription.lifecycle');
  const githubWrite = catalog.capabilities.find((item) => item.id === 'github.contents.write');
  assert.equal(subscription.status, 'partial');
  assert.equal(githubWrite.requiresAuthorization, true);
  assert.equal(githubWrite.grantsAuthority, false);
});
