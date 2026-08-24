import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceMediaPublicationOperation } from '../src/telegramWorkspace/workspaceMediaPublicationOperation.js';

test('media publication is one confirmed publish-authority operation and sends the real Telegram file id', async () => {
  const gateCalls = [];
  const capabilityCalls = [];
  const sent = [];
  const events = [];
  const records = new Map();
  let version = 0;

  const store = {
    async createRecord(input) {
      version += 1;
      const row = { ...input, version, payload: structuredClone(input.payload ?? {}) };
      records.set(`${input.domain}:${input.recordId}`, row);
      return row;
    },
    async updateRecord(input) {
      const key = `${input.domain}:${input.recordId}`;
      const current = records.get(key);
      assert.ok(current);
      assert.equal(input.expectedVersion, current.version);
      version += 1;
      const row = { ...current, ...input, version, payload: structuredClone(input.payload ?? current.payload) };
      records.set(key, row);
      return row;
    },
    async appendEvent(input) {
      events.push(input);
      return { inserted: true, deduplicated: false };
    }
  };

  const core = {
    store,
    async workspace(workspaceId) {
      assert.equal(workspaceId, 'telegram:workspace:100');
      return { workspaceId, telegramChatId: '-100100', workspaceType: 'supergroup' };
    },
    async capabilities(workspaceId, required) {
      capabilityCalls.push({ workspaceId, required });
      return { available: true };
    },
    async gate(ctx, operation, work) {
      gateCalls.push({ ctx, operation });
      assert.equal(ctx.confirmation.confirmed, true);
      assert.equal(ctx.confirmation.requestId, ctx.requestId);
      return work({});
    }
  };

  const operation = createWorkspaceMediaPublicationOperation({
    core,
    botClient: {
      async sendPhoto(input) {
        sent.push(input);
        return { message_id: 321 };
      }
    }
  });

  const result = await operation.publish({
    workspaceId: 'telegram:workspace:100',
    actorGlobalUserId: 'user:owner',
    telegramUserId: '42',
    requestId: 'request-1',
    traceId: 'trace-1',
    confirmation: { confirmed: true, requestId: 'request-1' }
  }, {
    mediaType: 'photo',
    fileId: 'telegram-real-photo-file-id',
    fileUniqueId: 'unique-photo-id',
    caption: 'Проверка',
    provenance: { source: 'telegram-update', updateId: 77 }
  });

  assert.equal(gateCalls.length, 1);
  assert.deepEqual(gateCalls[0].operation, {
    operation: 'media.publish',
    domain: 'media',
    risk: 'medium',
    confirmationRequired: true,
    authorityAction: 'workspace:publish',
    requiredPermission: 'workspace:publish'
  });
  assert.deepEqual(capabilityCalls, [{ workspaceId: 'telegram:workspace:100', required: ['telegram.media.send'] }]);
  assert.deepEqual(sent, [{ chatId: '-100100', caption: 'Проверка', photo: 'telegram-real-photo-file-id' }]);
  assert.equal(result.status, 'published');
  assert.equal(result.payload.telegramMessageId, 321);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'content.published');
  assert.equal(events[0].evidence.mediaType, 'photo');
});

test('media publication checks capability before persisting content', async () => {
  let writes = 0;
  const core = {
    store: {
      async createRecord() { writes += 1; throw new Error('must not persist'); },
      async updateRecord() { writes += 1; throw new Error('must not persist'); },
      async appendEvent() { writes += 1; throw new Error('must not persist'); }
    },
    async workspace() { return { telegramChatId: '-100100', workspaceType: 'supergroup' }; },
    async capabilities() { throw Object.assign(new Error('media permission missing'), { code: 'telegram-bot-capability-denied' }); },
    async gate(_ctx, _operation, work) { return work({}); }
  };
  const operation = createWorkspaceMediaPublicationOperation({ core, botClient: { async sendPhoto() { throw new Error('must not send'); } } });
  await assert.rejects(() => operation.publish({ workspaceId: 'telegram:workspace:100', actorGlobalUserId: 'user:owner', requestId: 'r', traceId: 't', confirmation: { confirmed: true, requestId: 'r' } }, { mediaType: 'photo', fileId: 'photo-file' }), /media permission missing/);
  assert.equal(writes, 0);
});
