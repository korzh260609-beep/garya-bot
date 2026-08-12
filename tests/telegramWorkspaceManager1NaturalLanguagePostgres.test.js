import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import {
  createPostgresTelegramWorkspaceStore,
  createTelegramWorkspace,
  createPostgresTelegramWorkspaceNaturalLanguagePendingStore
} from '../src/telegramWorkspace/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('TWM1.9 PostgreSQL pending proposal survives restart and can be claimed only once by bound actor', async () => {
  const id = randomUUID().replaceAll('-', '');
  const workspaceId = `tgw_${id}`;
  const telegramChatId = `-${BigInt(`0x${id.slice(0, 12)}`).toString()}`;
  const actorGlobalUserId = 'usr_twm19_pg_owner';
  const telegramUserId = '19091';
  const requestId = `request:twm19:${id}`;
  const traceId = `trace:twm19:${id}`;
  const proposal = Object.freeze({
    kind: 'telegram-workspace-config-proposal',
    proposalId: `proposal:${id}`,
    requestId,
    workspaceId,
    namespace: 'responses',
    actorGlobalUserId,
    traceId,
    baseVersion: 0,
    nextConfig: Object.freeze({ enabled: true, mode: 'mention_only' }),
    changedPaths: Object.freeze(['enabled', 'mode']),
    risk: 'low',
    confirmationRequired: false,
    authority: Object.freeze({ allowed: true })
  });

  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.9-pending-pg' });
  await persistence.start();
  const workspaceStore = createPostgresTelegramWorkspaceStore(persistence.database);
  await workspaceStore.putWorkspace(createTelegramWorkspace({ workspaceId, telegramChatId, workspaceType: 'supergroup', title: 'TWM19 PG', lifecycleState: 'CONNECTED' }));
  const pendingStore = createPostgresTelegramWorkspaceNaturalLanguagePendingStore(persistence.database, { ttlMs: 300_000 });
  const created = await pendingStore.create({ workspaceId, actorGlobalUserId, telegramUserId, requestId, traceId, proposal });
  assert.equal(created.status, 'pending');
  assert.equal(created.proposal.requestId, requestId);
  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.9-pending-pg-restart' });
  await restarted.start();
  const restartedPending = createPostgresTelegramWorkspaceNaturalLanguagePendingStore(restarted.database, { ttlMs: 300_000 });
  const wrongActor = await restartedPending.claim({ token: created.token, actorGlobalUserId: 'usr_wrong_actor', telegramUserId });
  assert.equal(wrongActor, null);
  const claimed = await restartedPending.claim({ token: created.token, actorGlobalUserId, telegramUserId });
  assert.equal(claimed.status, 'processing');
  assert.equal(claimed.proposal.workspaceId, workspaceId);
  const replay = await restartedPending.claim({ token: created.token, actorGlobalUserId, telegramUserId });
  assert.equal(replay.status, 'processing');
  await restartedPending.complete(created.token);
  const completed = await restartedPending.claim({ token: created.token, actorGlobalUserId, telegramUserId });
  assert.equal(completed.status, 'completed');
  await restarted.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=$1', [workspaceId]);
  await restarted.close();
});

integration('TWM1.9 PostgreSQL pending proposal expires fail-closed', async () => {
  const id = randomUUID().replaceAll('-', '');
  const workspaceId = `tgw_${id}`;
  const telegramChatId = `-${BigInt(`0x${id.slice(0, 12)}`).toString()}`;
  let now = new Date('2026-08-12T13:00:00.000Z');
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.9-pending-expiry' });
  await persistence.start();
  const workspaceStore = createPostgresTelegramWorkspaceStore(persistence.database);
  await workspaceStore.putWorkspace(createTelegramWorkspace({ workspaceId, telegramChatId, workspaceType: 'supergroup', title: 'TWM19 expiry', lifecycleState: 'CONNECTED' }));
  const pendingStore = createPostgresTelegramWorkspaceNaturalLanguagePendingStore(persistence.database, { clock: () => now, ttlMs: 30_000 });
  const created = await pendingStore.create({
    workspaceId,
    actorGlobalUserId: 'usr_twm19_expiry',
    telegramUserId: '19092',
    requestId: `request:${id}`,
    traceId: `trace:${id}`,
    proposal: Object.freeze({ kind: 'telegram-workspace-config-proposal', requestId: `request:${id}`, workspaceId })
  });
  now = new Date('2026-08-12T13:00:31.000Z');
  const expired = await pendingStore.claim({ token: created.token, actorGlobalUserId: 'usr_twm19_expiry', telegramUserId: '19092' });
  assert.equal(expired.status, 'pending');
  await persistence.database.query('DELETE FROM telegram_workspaces WHERE workspace_id=$1', [workspaceId]);
  await persistence.close();
});
