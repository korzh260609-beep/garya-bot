import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceNativeUi } from '../src/telegramWorkspace/index.js';

const actorGlobalUserId = 'usr_twm18_owner';
const telegramUserId = '18001';
const workspaceId = 'tgw_ui1';
const deniedWorkspaceId = 'tgw_ui2';

function fixture() {
  const sent = [];
  const edited = [];
  const answered = [];
  const applied = [];
  const rolledBack = [];
  const configs = new Map();
  configs.set(`${workspaceId}:responses`, { workspaceId, namespace: 'responses', config: { enabled: true, mode: 'all' }, version: 2 });

  const botClient = Object.freeze({
    async sendMessage(input) { sent.push(structuredClone(input)); return { message_id: 1 }; },
    async editMessageText(input) { edited.push(structuredClone(input)); return { message_id: input.messageId }; },
    async answerCallbackQuery(input) { answered.push(structuredClone(input)); return true; }
  });
  const identityResolver = async () => Object.freeze({
    identityContext: Object.freeze({ globalUserId: actorGlobalUserId }),
    scopeContext: Object.freeze({ projectScope: 'sg2.1' })
  });
  const workspaces = Object.freeze([
    Object.freeze({ workspaceId, telegramChatId: '-10018001', workspaceType: 'supergroup', title: 'Crypto Lab', lifecycleState: 'ACTIVE' }),
    Object.freeze({ workspaceId: deniedWorkspaceId, telegramChatId: '-10018002', workspaceType: 'channel', title: 'Private Channel', lifecycleState: 'ACTIVE' })
  ]);
  const workspaceRegistry = Object.freeze({ async listWorkspaces() { return workspaces; } });
  const authorityResolver = Object.freeze({
    async verify(input) {
      const allowed = input.workspaceId === workspaceId;
      return Object.freeze({ allowed, reason: allowed ? 'verified' : 'denied', workspaceRole: allowed ? 'OWNER' : null, verificationTime: '2026-08-12T13:00:00.000Z' });
    }
  });
  const configurationService = Object.freeze({
    async getConfig({ workspaceId: wid, namespace }) {
      return configs.get(`${wid}:${namespace}`) ?? Object.freeze({ workspaceId: wid, namespace, config: Object.freeze({}), version: 0 });
    },
    async listConfigs({ workspaceId: wid }) {
      return [...configs.values()].filter((row) => row.workspaceId === wid);
    },
    async applyChange(input) {
      applied.push(structuredClone(input));
      const current = configs.get(`${input.workspaceId}:${input.namespace}`);
      const next = Object.freeze({ workspaceId: input.workspaceId, namespace: input.namespace, config: structuredClone(input.nextConfig), version: (current?.version ?? 0) + 1 });
      configs.set(`${input.workspaceId}:${input.namespace}`, next);
      return Object.freeze({ config: next });
    },
    async history({ workspaceId: wid, namespace }) {
      if (wid !== workspaceId || namespace !== 'responses') return Object.freeze([]);
      return Object.freeze([
        Object.freeze({ version: 2, newConfig: Object.freeze({ enabled: true, mode: 'all' }) }),
        Object.freeze({ version: 1, newConfig: Object.freeze({ enabled: true, mode: 'mention_only' }) })
      ]);
    },
    async rollback(input) {
      rolledBack.push(structuredClone(input));
      return Object.freeze({ config: Object.freeze({ version: 3 }), rolledBackToVersion: Number(input.targetVersion) });
    }
  });
  const botCapabilityService = Object.freeze({
    async getHealth() { return Object.freeze({ available: true, reason: 'healthy', missingPermissions: Object.freeze([]) }); }
  });
  const ui = createTelegramWorkspaceNativeUi({
    botClient,
    identityResolver,
    workspaceRegistry,
    authorityResolver,
    configurationService,
    botCapabilityService,
    projectScope: 'sg2.1',
    idFactory: () => 'fixed-id'
  });
  return { ui, sent, edited, answered, applied, rolledBack };
}

function privateCommand(text = '/workspaces') {
  return Object.freeze({
    update_id: 1801,
    message: Object.freeze({
      message_id: 11,
      text,
      chat: Object.freeze({ id: 18001, type: 'private' }),
      from: Object.freeze({ id: 18001, first_name: 'Owner', language_code: 'ru' })
    })
  });
}

function callbackUpdate(id, data) {
  return Object.freeze({
    update_id: 1900 + Number(id.replace(/\D/g, '') || 0),
    callback_query: Object.freeze({
      id,
      data,
      from: Object.freeze({ id: 18001, first_name: 'Owner', language_code: 'ru' }),
      message: Object.freeze({ message_id: 21, chat: Object.freeze({ id: 18001, type: 'private' }) })
    })
  });
}

function callbacks(call) {
  return call.replyMarkup.inline_keyboard.flat().map((item) => item.callback_data);
}

test('TWM1.8 /workspaces lists only workspaces authorized for the canonical actor', async () => {
  const fx = fixture();
  const result = await fx.ui.handleUpdate(privateCommand());
  assert.equal(result.handled, true);
  assert.equal(fx.sent.length, 1);
  assert.match(fx.sent[0].text, /Telegram Workspace Manager/);
  const data = callbacks(fx.sent[0]);
  assert.ok(data.includes(`twm|w|${workspaceId}`));
  assert.ok(!data.some((value) => value.includes(deniedWorkspaceId)));
  assert.equal(fx.applied.length, 0);
});

test('TWM1.8 progressive workspace menu exposes quick setup before advanced settings', async () => {
  const fx = fixture();
  await fx.ui.handleUpdate(callbackUpdate('cb1', `twm|w|${workspaceId}`));
  assert.equal(fx.edited.length, 1);
  assert.match(fx.edited[0].text, /Быстрая настройка/);
  const data = callbacks(fx.edited[0]);
  assert.ok(data.includes(`twm|menu|${workspaceId}|setup`));
  assert.ok(data.includes(`twm|menu|${workspaceId}|advanced`));
  assert.equal(fx.answered.at(-1).callbackQueryId, 'cb1');
});

test('TWM1.8 preview never mutates; explicit second click produces request-bound confirmed apply', async () => {
  const fx = fixture();
  await fx.ui.handleUpdate(callbackUpdate('cb2', `twm|preview|${workspaceId}|responses:mention`));
  assert.equal(fx.applied.length, 0);
  assert.match(fx.edited.at(-1).text, /Подтвердить изменение/);
  assert.ok(callbacks(fx.edited.at(-1)).includes(`twm|apply|${workspaceId}|responses:mention`));

  await fx.ui.handleUpdate(callbackUpdate('cb3', `twm|apply|${workspaceId}|responses:mention`));
  assert.equal(fx.applied.length, 1);
  const mutation = fx.applied[0];
  assert.equal(mutation.workspaceId, workspaceId);
  assert.equal(mutation.actorGlobalUserId, actorGlobalUserId);
  assert.equal(mutation.telegramUserId, telegramUserId);
  assert.equal(mutation.namespace, 'responses');
  assert.equal(mutation.requestId, 'twm-ui:cb3');
  assert.deepEqual(mutation.confirmation, { confirmed: true, requestId: 'twm-ui:cb3' });
  assert.deepEqual(mutation.nextConfig, { enabled: true, reply_enabled: true, mode: 'mention_only' });
});

test('TWM1.8 cross-workspace callback is denied before configuration mutation', async () => {
  const fx = fixture();
  await assert.rejects(
    () => fx.ui.handleUpdate(callbackUpdate('cb4', `twm|preview|${deniedWorkspaceId}|responses:all`)),
    (error) => error.code === 'denied'
  );
  assert.equal(fx.applied.length, 0);
  assert.equal(fx.answered.at(-1).showAlert, true);
});

test('TWM1.8 rollback requires preview then separate callback-bound confirmation', async () => {
  const fx = fixture();
  await fx.ui.handleUpdate(callbackUpdate('cb5', `twm|rbp|${workspaceId}|responses|1`));
  assert.equal(fx.rolledBack.length, 0);
  assert.match(fx.edited.at(-1).text, /Подтвердить откат/);

  await fx.ui.handleUpdate(callbackUpdate('cb6', `twm|rba|${workspaceId}|responses|1`));
  assert.equal(fx.rolledBack.length, 1);
  assert.equal(fx.rolledBack[0].targetVersion, 1);
  assert.equal(fx.rolledBack[0].requestId, 'twm-ui:cb6');
  assert.deepEqual(fx.rolledBack[0].confirmation, { confirmed: true, requestId: 'twm-ui:cb6' });
});

test('TWM1.8 ordinary private text is not consumed by native UI', async () => {
  const fx = fixture();
  const result = await fx.ui.handleUpdate(privateCommand('расскажи о проекте'));
  assert.equal(result.handled, false);
  assert.equal(fx.sent.length, 0);
  assert.equal(fx.edited.length, 0);
});
