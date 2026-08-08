import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresExternalConnectionStore } from '../src/connections/postgresExternalConnectionStore.js';
import { createExternalConnectionsRegistry } from '../src/connections/externalConnectionsRegistry.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;
const grants = ['connection:manage','connection:read','connection:verify'];

integration('Block 16.9 PostgreSQL registry survives restart and remains owner/project isolated', async () => {
  const suffix = randomUUID();
  const owner = `user:${suffix}`;
  const project = `project:${suffix}`;
  const actor = { globalUserId: owner, grants };
  const credentialManager = { describeCredential(id) { return { credentialId: id }; } };

  const first = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-16-9-connections-write' });
  await first.start();
  const registry = createExternalConnectionsRegistry({ store: createPostgresExternalConnectionStore({ database: first.database }), credentialManager });
  await registry.connect({ connectionId: `connection:${suffix}`, provider: 'fixture', serviceType: 'api', ownerGlobalUserId: owner, projectScope: project, externalAccountId: 'account-1', externalAccount: { displayName: 'Durable Account' }, credentialId: 'credential-handle-only', grantedScopes: ['read'], permissions: ['records:read'], capabilities: ['fixture.read'], actor });
  await registry.recordVerification({ connectionId: `connection:${suffix}`, actor, projectScope: project, healthy: true });
  await first.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-16-9-connections-read' });
  await restarted.start();
  const restartedRegistry = createExternalConnectionsRegistry({ store: createPostgresExternalConnectionStore({ database: restarted.database }), credentialManager });
  const restored = await restartedRegistry.describe({ connectionId: `connection:${suffix}`, actor, projectScope: project });
  assert.equal(restored.externalAccount.displayName, 'Durable Account');
  assert.equal(restored.credentialId, 'credential-handle-only');
  assert.equal(restored.healthState, 'healthy');
  await assert.rejects(() => restartedRegistry.describe({ connectionId: restored.connectionId, actor: { globalUserId: `other:${suffix}`, grants }, projectScope: project }), (error) => error.code === 'connection-owner-mismatch');
  await assert.rejects(() => restartedRegistry.describe({ connectionId: restored.connectionId, actor, projectScope: `other:${suffix}` }), (error) => error.code === 'connection-project-scope-mismatch');
  await restarted.close();
});
