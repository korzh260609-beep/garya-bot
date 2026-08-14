import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresResourceAuthorityStore } from '../src/authority/postgresResourceAuthorityStore.js';
import { createResourceAuthorityRegistry } from '../src/authority/resourceAuthorityRegistry.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;
const manager = { globalUserId: 'system:runtime', grants: ['resource-authority:manage','resource-authority:read'] };

integration('Block 16.10 resource authority survives PostgreSQL restart and remains scope isolated', async () => {
  const suffix = randomUUID();
  const project = `project:${suffix}`;
  const resourceId = `resource:${suffix}`;
  const authorityId = `authority:${suffix}`;
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-1610-authority-test' });
  await persistence.start();
  const store = createPostgresResourceAuthorityStore({ database: persistence.database });
  const registry = createResourceAuthorityRegistry({ store });

  await registry.registerResource({ resourceId, resourceType: 'channel', provider: 'telegram', projectScope: project, externalResourceId: `external:${suffix}`, verificationState: 'verified', provenance: { source: 'integration-test' }, actor: manager });
  await registry.grantAuthority({ authorityId, resourceId, actorGlobalUserId: `user:${suffix}`, projectScope: project, relation: 'can_publish', verificationSource: 'integration-proof', actor: manager });
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: `user:${suffix}`, resourceId, projectScope: project, relation: 'can_publish' })).allowed, true);
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: `other:${suffix}`, resourceId, projectScope: project, relation: 'can_publish' })).allowed, false);
  assert.equal((await registry.checkAuthority({ actorGlobalUserId: `user:${suffix}`, resourceId, projectScope: `other:${project}`, relation: 'can_publish' })).reason, 'resource-project-scope-mismatch');
  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-1610-authority-restart-test' });
  await restarted.start();
  const restartedRegistry = createResourceAuthorityRegistry({ store: createPostgresResourceAuthorityStore({ database: restarted.database }) });
  const afterRestart = await restartedRegistry.checkAuthority({ actorGlobalUserId: `user:${suffix}`, resourceId, projectScope: project, relation: 'can_publish' });
  assert.equal(afterRestart.allowed, true);
  assert.equal(afterRestart.evidence.authorityId, authorityId);
  await restartedRegistry.revokeAuthority({ authorityId, projectScope: project, actor: manager });
  assert.equal((await restartedRegistry.checkAuthority({ actorGlobalUserId: `user:${suffix}`, resourceId, projectScope: project, relation: 'can_publish' })).allowed, false);
  await restarted.close();
});
