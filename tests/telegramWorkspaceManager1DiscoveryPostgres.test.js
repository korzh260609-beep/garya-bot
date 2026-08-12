import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createPostgresTelegramUpdateStore } from '../src/telegram/postgresTelegramUpdateStore.js';
import { createTelegramProductionIntegration } from '../src/telegram/telegramProductionIntegration.js';
import { createPostgresTelegramWorkspaceRegistry } from '../src/telegramWorkspace/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

function chatIds() {
  const uuid = randomUUID().replaceAll('-', '');
  const base = BigInt(`0x${uuid.slice(0, 12)}`);
  return {
    group: `-${base}`,
    supergroup: `-${base + 1n}`,
    channel: `-${base + 2n}`,
    other: `-${base + 3n}`
  };
}

function numeric(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('fixture Telegram id must fit safe integer');
  return parsed;
}

function fakeIdentityResolver({ platformFacts, scopeFacts }) {
  return {
    identityContext: { globalUserId: `global:${platformFacts.platformUserId}`, roles: ['guest'], grants: [], authenticationLevel: 'platform' },
    scopeContext: {
      userScope: `global:${platformFacts.platformUserId}`,
      projectScope: scopeFacts.projectId ?? 'sg2.1',
      groupScope: scopeFacts.groupId,
      threadScope: scopeFacts.threadId,
      requestedUserScope: `global:${platformFacts.platformUserId}`,
      requestedProjectScope: scopeFacts.projectId ?? 'sg2.1',
      requestedGroupScope: scopeFacts.groupId,
      requestedThreadScope: scopeFacts.threadId,
      allowedCapabilities: []
    }
  };
}

integration('TWM1.3: production Telegram ingestion discovers ignored groups/channels, tracks membership, migrates and survives restart', async () => {
  const ids = chatIds();
  const updateBase = Number(`8${String(Date.now()).slice(-8)}`);
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.3-discovery-test' });
  await persistence.start();
  const updateStore = createPostgresTelegramUpdateStore(persistence.database);
  const runtimeInputs = [];
  const tg = createTelegramProductionIntegration({
    secretToken: 'twm13-secret',
    botClient: { sendMessage: async () => {} },
    updateStore,
    identityResolver: fakeIdentityResolver,
    runtime: { handle: async (input) => { runtimeInputs.push(input); return { status: 'success', message: 'ok', data: {} }; } },
    botUserId: 999,
    botUsername: 'garya_bot'
  });
  const headers = { 'x-telegram-bot-api-secret-token': 'twm13-secret' };

  const ignoredGroup = {
    update_id: updateBase,
    message: {
      message_id: 1,
      date: 1786527000,
      from: { id: 7, is_bot: false },
      chat: { id: numeric(ids.group), type: 'group', title: 'TWM Discovery Group', username: 'twm_old' },
      text: 'ordinary group message'
    }
  };
  const first = await tg.handleWebhook({ headers, body: ignoredGroup });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.ignored, true);
  assert.equal(runtimeInputs.length, 0);

  const groupWorkspace = await updateStore.workspaceRegistry.resolveTelegramChatId(ids.group);
  assert.ok(groupWorkspace?.workspaceId.startsWith('tgw_'));
  assert.equal(groupWorkspace.workspaceType, 'group');
  assert.equal(groupWorkspace.title, 'TWM Discovery Group');
  assert.equal(groupWorkspace.username, 'twm_old');

  const duplicate = await tg.handleWebhook({ headers, body: ignoredGroup });
  assert.equal(duplicate.body.duplicate, true);
  assert.equal((await updateStore.workspaceRegistry.resolveTelegramChatId(ids.group)).workspaceId, groupWorkspace.workspaceId);

  const metadataRefresh = {
    update_id: updateBase + 1,
    message: {
      ...ignoredGroup.message,
      message_id: 2,
      date: 1786527001,
      chat: { id: numeric(ids.group), type: 'group', title: 'TWM Discovery Group Renamed' }
    }
  };
  await tg.handleWebhook({ headers, body: metadataRefresh });
  const refreshed = await updateStore.workspaceRegistry.resolveTelegramChatId(ids.group);
  assert.equal(refreshed.workspaceId, groupWorkspace.workspaceId);
  assert.equal(refreshed.title, 'TWM Discovery Group Renamed');
  assert.equal(refreshed.username, null);

  const channelUpdate = {
    update_id: updateBase + 2,
    channel_post: {
      message_id: 3,
      date: 1786527002,
      chat: { id: numeric(ids.channel), type: 'channel', title: 'TWM Discovery Channel', username: 'twm_channel' },
      text: 'channel post'
    }
  };
  const channelResult = await tg.handleWebhook({ headers, body: channelUpdate });
  assert.equal(channelResult.body.ignored, true);
  const channelWorkspace = await updateStore.workspaceRegistry.resolveTelegramChatId(ids.channel);
  assert.equal(channelWorkspace.workspaceType, 'channel');
  assert.notEqual(channelWorkspace.workspaceId, groupWorkspace.workspaceId);

  const removed = {
    update_id: updateBase + 3,
    my_chat_member: {
      date: 1786527003,
      from: { id: 7 },
      chat: { id: numeric(ids.group), type: 'group', title: 'TWM Discovery Group Renamed' },
      old_chat_member: { user: { id: 999, is_bot: true }, status: 'member' },
      new_chat_member: { user: { id: 999, is_bot: true }, status: 'left' }
    }
  };
  const removedResult = await tg.handleWebhook({ headers, body: removed });
  assert.equal(removedResult.body.ignored, true);
  assert.equal((await updateStore.workspaceRegistry.resolveTelegramChatId(ids.group)).lifecycleState, 'DISCONNECTED');

  const reconnected = {
    update_id: updateBase + 4,
    my_chat_member: {
      date: 1786527004,
      from: { id: 7 },
      chat: { id: numeric(ids.group), type: 'group', title: 'TWM Discovery Group Renamed' },
      old_chat_member: { user: { id: 999, is_bot: true }, status: 'left' },
      new_chat_member: { user: { id: 999, is_bot: true }, status: 'administrator' }
    }
  };
  await tg.handleWebhook({ headers, body: reconnected });
  const connected = await updateStore.workspaceRegistry.resolveTelegramChatId(ids.group);
  assert.equal(connected.lifecycleState, 'CONNECTED');
  assert.equal(connected.botMembershipState, 'ADMINISTRATOR');

  const migration = {
    update_id: updateBase + 5,
    message: {
      message_id: 6,
      date: 1786527005,
      from: { id: 777000, is_bot: true },
      chat: { id: numeric(ids.group), type: 'group', title: 'TWM Discovery Group Renamed' },
      migrate_to_chat_id: numeric(ids.supergroup)
    }
  };
  const migrationResult = await tg.handleWebhook({ headers, body: migration });
  assert.equal(migrationResult.body.ignored, true);
  assert.equal(await updateStore.workspaceRegistry.resolveTelegramChatId(ids.group), null);
  const migrated = await updateStore.workspaceRegistry.resolveTelegramChatId(ids.supergroup);
  assert.equal(migrated.workspaceId, groupWorkspace.workspaceId);
  assert.equal(migrated.workspaceType, 'supergroup');
  assert.equal(migrated.migration.fromTelegramChatId, ids.group);
  assert.equal(migrated.migration.toTelegramChatId, ids.supergroup);

  const replayMigration = { ...migration, update_id: updateBase + 6 };
  await tg.handleWebhook({ headers, body: replayMigration });
  assert.equal((await updateStore.workspaceRegistry.resolveTelegramChatId(ids.supergroup)).workspaceId, groupWorkspace.workspaceId);

  const listed = await updateStore.workspaceRegistry.listWorkspaces({ limit: 500 });
  const ours = listed.filter((workspace) => [ids.supergroup, ids.channel].includes(workspace.telegramChatId));
  assert.equal(ours.length, 2);
  assert.equal(new Set(ours.map((workspace) => workspace.workspaceId)).size, 2);

  await persistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'twm1.3-discovery-restart-test' });
  await restarted.start();
  const restartedRegistry = createPostgresTelegramWorkspaceRegistry(restarted.database);
  assert.equal((await restartedRegistry.resolveTelegramChatId(ids.supergroup)).workspaceId, groupWorkspace.workspaceId);
  assert.equal((await restartedRegistry.resolveTelegramChatId(ids.channel)).workspaceId, channelWorkspace.workspaceId);

  await restarted.database.query('DELETE FROM telegram_updates WHERE update_id BETWEEN $1 AND $2', [updateBase, updateBase + 6]);
  await restarted.database.query('DELETE FROM telegram_workspaces WHERE telegram_chat_id=ANY($1::text[])', [[ids.group, ids.supergroup, ids.channel, ids.other]]);
  await restarted.close();
});
