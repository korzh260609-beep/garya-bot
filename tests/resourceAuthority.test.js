import test from 'node:test';
import assert from 'node:assert/strict';
import { createResourceAuthorityRegistry, createInMemoryResourceAuthorityStore } from '../src/authority/resourceAuthorityRegistry.js';
import { createActionGate } from '../src/action/actionGate.js';
import { createActionRequest } from '../src/contracts/action.js';

const manager = { globalUserId: 'system:runtime', grants: ['resource-authority:manage','resource-authority:read'] };

function fixture(clock = () => new Date('2026-08-08T16:00:00Z')) {
  const events = [];
  const registry = createResourceAuthorityRegistry({ store: createInMemoryResourceAuthorityStore(), clock, audit: (event) => events.push(event) });
  return { registry, events };
}
async function verifiedResource(registry, { resourceId, projectScope = 'sg2.1', parentResourceId = null, externalResourceId = resourceId } = {}) {
  return registry.registerResource({ resourceId, resourceType: parentResourceId ? 'channel' : 'workspace', provider: 'fixture', projectScope, externalResourceId, parentResourceId, verificationState: 'verified', provenance: { source: 'fixture-verification' }, actor: manager });
}
async function authority(registry, { authorityId, resourceId, user, relation, projectScope = 'sg2.1', appliesToDescendants = false, delegatedByGlobalUserId = null, expiresAt = null } = {}) {
  return registry.grantAuthority({ authorityId, resourceId, actorGlobalUserId: user, projectScope, relation, appliesToDescendants, delegatedByGlobalUserId, verificationSource: 'fixture-proof', expiresAt, actor: manager });
}

test('Block 16.10 distinguishes owner, administrator, manager and ordinary participant', async () => {
  const { registry } = fixture();
  await verifiedResource(registry, { resourceId: 'resource:one' });
  await authority(registry, { authorityId: 'auth:owner', resourceId: 'resource:one', user: 'user:owner', relation: 'owns' });
  await authority(registry, { authorityId: 'auth:admin', resourceId: 'resource:one', user: 'user:admin', relation: 'administers' });
  await authority(registry, { authorityId: 'auth:manager', resourceId: 'resource:one', user: 'user:manager', relation: 'manages' });

  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:owner', resourceId: 'resource:one', projectScope: 'sg2.1', relation: 'can_modify' })).allowed, true);
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:admin', resourceId: 'resource:one', projectScope: 'sg2.1', relation: 'can_publish' })).allowed, true);
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:manager', resourceId: 'resource:one', projectScope: 'sg2.1', relation: 'owns' })).allowed, false);
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:participant', resourceId: 'resource:one', projectScope: 'sg2.1', relation: 'can_read' })).allowed, false);
});

test('Block 16.10 keeps resources independently addressable and project isolated', async () => {
  const { registry } = fixture();
  await verifiedResource(registry, { resourceId: 'channel:a', projectScope: 'project:a' });
  await verifiedResource(registry, { resourceId: 'channel:b', projectScope: 'project:a' });
  await verifiedResource(registry, { resourceId: 'channel:c', projectScope: 'project:b' });
  await authority(registry, { authorityId: 'auth:a', resourceId: 'channel:a', user: 'user:1', relation: 'owns', projectScope: 'project:a' });

  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:1', resourceId: 'channel:a', projectScope: 'project:a', relation: 'can_publish' })).allowed, true);
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:1', resourceId: 'channel:b', projectScope: 'project:a', relation: 'can_publish' })).allowed, false);
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:1', resourceId: 'channel:c', projectScope: 'project:a', relation: 'can_read' })).reason, 'resource-project-scope-mismatch');
});

test('Block 16.10 hierarchy inheritance is explicit and never implied by membership', async () => {
  const { registry } = fixture();
  await verifiedResource(registry, { resourceId: 'server:1' });
  await verifiedResource(registry, { resourceId: 'channel:1', parentResourceId: 'server:1' });
  await authority(registry, { authorityId: 'auth:no-inherit', resourceId: 'server:1', user: 'user:admin', relation: 'administers', appliesToDescendants: false });
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:admin', resourceId: 'channel:1', projectScope: 'sg2.1', relation: 'can_modify' })).allowed, false);

  await authority(registry, { authorityId: 'auth:inherit', resourceId: 'server:1', user: 'user:owner', relation: 'owns', appliesToDescendants: true });
  const inherited = await registry.checkAuthority({ actorGlobalUserId: 'user:owner', resourceId: 'channel:1', projectScope: 'sg2.1', relation: 'can_modify' });
  assert.equal(inherited.allowed, true);
  assert.equal(inherited.evidence.inherited, true);
  assert.equal(inherited.evidence.authorityResourceId, 'server:1');
});

test('Block 16.10 delegation cannot exceed delegator authority and revoke is immediate and auditable', async () => {
  const { registry, events } = fixture();
  await verifiedResource(registry, { resourceId: 'repo:1' });
  await authority(registry, { authorityId: 'auth:owner', resourceId: 'repo:1', user: 'user:owner', relation: 'owns' });
  await authority(registry, { authorityId: 'auth:delegated', resourceId: 'repo:1', user: 'user:editor', relation: 'can_modify', delegatedByGlobalUserId: 'user:owner' });
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:editor', resourceId: 'repo:1', projectScope: 'sg2.1', relation: 'can_modify' })).allowed, true);

  await assert.rejects(() => authority(registry, { authorityId: 'auth:bad', resourceId: 'repo:1', user: 'user:other', relation: 'owns', delegatedByGlobalUserId: 'user:editor' }), (error) => error.code === 'authority-delegation-denied');
  await registry.revokeAuthority({ authorityId: 'auth:delegated', projectScope: 'sg2.1', actor: manager });
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:editor', resourceId: 'repo:1', projectScope: 'sg2.1', relation: 'can_modify' })).allowed, false);
  assert.ok(events.some((event) => event.data.operation === 'delegate'));
  assert.ok(events.some((event) => event.data.operation === 'revoke'));
});

test('Block 16.10 expired or unverified authority fails closed', async () => {
  const { registry } = fixture(() => new Date('2026-08-08T16:00:00Z'));
  await verifiedResource(registry, { resourceId: 'doc:1' });
  await authority(registry, { authorityId: 'auth:expired', resourceId: 'doc:1', user: 'user:1', relation: 'can_read', expiresAt: '2026-08-08T15:59:59Z' });
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:1', resourceId: 'doc:1', projectScope: 'sg2.1', relation: 'can_read' })).allowed, false);

  await registry.registerResource({ resourceId: 'doc:2', resourceType: 'document', provider: 'fixture', projectScope: 'sg2.1', externalResourceId: '2', verificationState: 'unverified', actor: manager });
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: 'user:1', resourceId: 'doc:2', projectScope: 'sg2.1', relation: 'can_read' })).reason, 'resource-not-verified');
});

test('Action Gate requires matching resource authority evidence in addition to generic permission', () => {
  const gate = createActionGate();
  const base = {
    capability: 'publish', actionType: 'publish', actionClass: 'external-action',
    actor: { globalUserId: 'user:1', roles: [], grants: ['capability:publish'], authenticationLevel: 'verified' },
    scope: { userScope: 'user:1', projectScope: 'sg2.1', allowedCapabilities: ['publish'] },
    requiredPermission: 'capability:publish', risk: 'low', traceContext: { traceId: 'trace-1', requestId: 'request-1' },
    resourceRequirement: { resourceId: 'channel:1', relation: 'can_publish' }
  };
  const denied = gate.evaluate(createActionRequest({ ...base, resourceAuthority: { allowed: false, reason: 'resource-authority-missing', actorGlobalUserId: 'user:1', projectScope: 'sg2.1', resourceId: 'channel:1', requiredRelation: 'can_publish' } }));
  assert.equal(denied.outcome, 'deny');
  assert.ok(denied.reasons.includes('resource-authority-missing'));

  const allowed = gate.evaluate(createActionRequest({ ...base, resourceAuthority: { allowed: true, reason: 'resource-authority-verified', actorGlobalUserId: 'user:1', projectScope: 'sg2.1', resourceId: 'channel:1', requiredRelation: 'can_publish', evidence: { authorityId: 'auth:1' } } }));
  assert.equal(allowed.outcome, 'require-confirmation');
  assert.equal(allowed.checks.resourceAuthority, true);

  const forged = gate.evaluate(createActionRequest({ ...base, resourceAuthority: { allowed: true, actorGlobalUserId: 'user:2', projectScope: 'sg2.1', resourceId: 'channel:1', requiredRelation: 'can_publish' } }));
  assert.equal(forged.outcome, 'deny');
});
