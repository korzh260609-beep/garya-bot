import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresResourceAuthorityStore } from '../src/authority/postgresResourceAuthorityStore.js';
import { createResourceAuthorityRegistry } from '../src/authority/resourceAuthorityRegistry.js';
import { createPostgresTelegramWorkspaceRegistry, createPostgresTelegramWorkspaceAuthorityResolver } from '../src/telegramWorkspace/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('TWM1.4 PostgreSQL authority verification persists scoped role/evidence across restart and revokes on live Telegram loss', async () => {
  const suffix = randomUUID().replaceAll('-', '');
  const workspaceId = `tgw_${suffix}`;
  const telegramChatId = `-${BigInt(`0x${suffix.slice(0, 12)}`)}`;
  const telegramUserId = String(BigInt(`0x${suffix.slice(12, 24)}`));
  const globalUserId = `usr_twm14_${suffix.slice(0, 16)}`;
  const projectScope = 'sg2.1';
  const actor = { globalUserId: 'system:twm1.4-test', grants: ['resource-authority:manage', 'resource-authority:read'] };
  let status = 'administrator';
  let sequence = 0;

  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.4-authority-test' });
  await persistence.start();
  const workspaceRegistry = createPostgresTelegramWorkspaceRegistry(persistence.database);
  await workspaceRegistry.store.putWorkspace({
    workspaceId,
    telegramChatId,
    workspaceType: 'supergroup',
    title: 'TWM1.4 authority integration',
    lifecycleState: 'CONNECTED',
    botMembershipState: 'ADMINISTRATOR'
  });
  await persistence.repositories.identities.link({ platform: 'telegram', platformUserId: telegramUserId, globalUserId, metadata: { test: 'twm1.4' } });

  const registry = createResourceAuthorityRegistry({ store: createPostgresResourceAuthorityStore({ database: persistence.database }) });
  const resolver = createPostgresTelegramWorkspaceAuthorityResolver({
    persistence,
    workspaceRegistry,
    telegramApiClient: { call: async (method, payload) => { assert.equal(method, 'getChatMember'); assert.equal(String(payload.chat_id), telegramChatId); assert.equal(String(payload.user_id), telegramUserId); return { status }; } },
    resourceAuthorityRegistry: registry,
    resourceAuthorityAccessContext: { actor, projectScope },
    projectScope,
    authorityTtlMs: 120_000,
    idFactory: () => `twa_pg_${suffix}_${++sequence}`
  });

  const allowed = await resolver.verify({ workspaceId, telegramUserId, requestedAction: 'workspace:configure', expectedGlobalUserId: globalUserId });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.workspaceRole, 'ADMIN');
  assert.equal(allowed.telegramEvidence.status, 'administrator');
  assert.equal((await persistence.repositories.access.list({ globalUserId, projectScope })).roles.length, 0, 'workspace admin must not become SG-global admin/Monarch');
  assert.equal((await workspaceRegistry.store.getMember({ workspaceId, globalUserId })).status, 'active');
  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.4-authority-restart-test' });
  await restarted.start();
  const restartedWorkspaceRegistry = createPostgresTelegramWorkspaceRegistry(restarted.database);
  const persistedMember = await restartedWorkspaceRegistry.store.getMember({ workspaceId, globalUserId });
  assert.equal(persistedMember.role, 'ADMIN');
  assert.equal(persistedMember.status, 'active');

  const restartedRegistry = createResourceAuthorityRegistry({ store: createPostgresResourceAuthorityStore({ database: restarted.database }) });
  const persistedAuthority = await restartedRegistry.checkAuthority({ actorGlobalUserId: globalUserId, resourceId: workspaceId, projectScope, relation: 'administers', includeHierarchy: false });
  assert.equal(persistedAuthority.allowed, true);

  status = 'member';
  const restartedResolver = createPostgresTelegramWorkspaceAuthorityResolver({
    persistence: restarted,
    workspaceRegistry: restartedWorkspaceRegistry,
    telegramApiClient: { call: async () => ({ status }) },
    resourceAuthorityRegistry: restartedRegistry,
    resourceAuthorityAccessContext: { actor, projectScope },
    projectScope,
    authorityTtlMs: 120_000,
    idFactory: () => `twa_pg_${suffix}_${++sequence}`
  });
  const denied = await restartedResolver.verify({ workspaceId, telegramUserId, requestedAction: 'workspace:configure', expectedGlobalUserId: globalUserId });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'twm-telegram-resource-authority-denied');
  assert.equal((await restartedWorkspaceRegistry.store.getMember({ workspaceId, globalUserId })).status, 'revoked');
  assert.equal((await restartedRegistry.checkAuthority({ actorGlobalUserId: globalUserId, resourceId: workspaceId, projectScope, relation: 'administers', includeHierarchy: false })).allowed, false);

  await restarted.database.query('DELETE FROM resource_authorities WHERE resource_id=$1', [workspaceId]);
  await restarted.database.query('DELETE FROM managed_resources WHERE resource_id=$1', [workspaceId]);
  await restarted.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=$1', [workspaceId]);
  await restarted.database.query("DELETE FROM identity_links WHERE platform='telegram' AND platform_user_id=$1", [telegramUserId]);
  await restarted.database.query('DELETE FROM users WHERE global_user_id=$1', [globalUserId]);
  await restarted.close();
});
