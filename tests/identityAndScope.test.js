import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityRegistry } from '../src/identity/identityRegistry.js';
import { createIdentityResolver } from '../src/identity/identityResolver.js';
import { createScopeResolver } from '../src/identity/scopeResolver.js';
import { createIdentityAndScopeService } from '../src/identity/identityAndScopeService.js';

function fixture() {
  const registry = createIdentityRegistry({ clock: () => '2026-08-06T00:00:00.000Z' });
  registry.registerUser({ globalUserId: 'user:gary', roles: ['monarch'], grants: ['project:admin'] });
  const identityResolver = createIdentityResolver({ registry });
  const scopeResolver = createScopeResolver({
    capabilityPolicy: ({ identityContext }) => identityContext.roles.includes('monarch') ? ['repository.write'] : []
  });
  const service = createIdentityAndScopeService({ identityResolver, scopeResolver });
  return { registry, identityResolver, scopeResolver, service };
}

test('linked platform identities resolve to the same global user', () => {
  const { registry, identityResolver } = fixture();
  registry.link({ globalUserId: 'user:gary', platform: 'telegram', platformUserId: '100', actorGlobalUserId: 'user:gary', traceId: 't1' });
  registry.link({ globalUserId: 'user:gary', platform: 'discord', platformUserId: '200', actorGlobalUserId: 'user:gary', traceId: 't2' });
  assert.equal(identityResolver.resolve({ platform: 'telegram', platformUserId: '100' }).globalUserId, 'user:gary');
  assert.equal(identityResolver.resolve({ platform: 'discord', platformUserId: '200' }).globalUserId, 'user:gary');
});

test('transport facts cannot grant roles or grants', () => {
  const { identityResolver } = fixture();
  const guest = identityResolver.resolve({ platform: 'telegram', platformUserId: '999', roles: ['monarch'], grants: ['*'] });
  assert.deepEqual(guest.roles, ['guest']);
  assert.deepEqual(guest.grants, []);
});

test('guest identities remain isolated by platform identity', () => {
  const { identityResolver } = fixture();
  const first = identityResolver.resolve({ platform: 'telegram', platformUserId: '1' });
  const second = identityResolver.resolve({ platform: 'telegram', platformUserId: '2' });
  assert.notEqual(first.globalUserId, second.globalUserId);
});

test('scope construction fails closed without project scope', () => {
  const { service } = fixture();
  assert.throws(() => service.resolve({ platform: 'telegram', platformUserId: '1' }), /projectScope is required/);
});

test('thread scope requires group scope', () => {
  const { service } = fixture();
  assert.throws(() => service.resolve({ platform: 'telegram', platformUserId: '1', projectScope: 'sg2.1', threadScope: 'thread:1' }), /requires groupScope/);
});

test('scope is bound to resolved identity and policy capabilities', () => {
  const { registry, service, scopeResolver } = fixture();
  registry.link({ globalUserId: 'user:gary', platform: 'telegram', platformUserId: '100', actorGlobalUserId: 'user:gary', traceId: 't1' });
  const result = service.resolve({ platform: 'telegram', platformUserId: '100', projectScope: 'sg2.1', groupScope: 'group:1', threadScope: 'thread:1' });
  assert.equal(result.scopeContext.userScope, 'user:gary');
  assert.deepEqual(result.scopeContext.allowedCapabilities, ['repository.write']);
  assert.throws(() => scopeResolver.assertBounded(result.identityContext, { ...result.scopeContext, userScope: 'user:other' }), /does not belong/);
});

test('link and unlink operations are audited', () => {
  const { registry } = fixture();
  registry.link({ globalUserId: 'user:gary', platform: 'telegram', platformUserId: '100', actorGlobalUserId: 'user:gary', traceId: 't1' });
  assert.equal(registry.unlink({ platform: 'telegram', platformUserId: '100', actorGlobalUserId: 'user:gary', traceId: 't2' }), true);
  assert.deepEqual(registry.listAudit().map((entry) => entry.event), ['identity-linked', 'identity-unlinked']);
});
