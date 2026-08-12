import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceNaturalLanguageService } from '../src/telegramWorkspace/index.js';

const workspaceA = Object.freeze({ workspaceId: 'tgw_nltest0001', telegramChatId: '-91001', workspaceType: 'supergroup', title: 'Crypto', username: 'crypto_group' });
const workspaceB = Object.freeze({ workspaceId: 'tgw_nltest0002', telegramChatId: '-91002', workspaceType: 'supergroup', title: 'Witch', username: 'witch_group' });
const actorGlobalUserId = 'usr_twm19_owner';
const telegramUserId = '19001';

function identityResolver() {
  return Object.freeze({
    identityContext: Object.freeze({ globalUserId: actorGlobalUserId, roles: Object.freeze(['citizen']), grants: Object.freeze([]) }),
    scopeContext: Object.freeze({ userScope: actorGlobalUserId, projectScope: 'sg2.1', groupScope: null, threadScope: null, allowedCapabilities: Object.freeze([]) })
  });
}

function privateMessage(text, id = 1) {
  return Object.freeze({
    update_id: id,
    message: Object.freeze({ message_id: id, text, chat: Object.freeze({ id: Number(telegramUserId), type: 'private' }), from: Object.freeze({ id: Number(telegramUserId), first_name: 'Owner', language_code: 'ru' }) })
  });
}

function groupMessage(text, workspace = workspaceA, id = 2) {
  return Object.freeze({
    update_id: id,
    message: Object.freeze({ message_id: id, text, chat: Object.freeze({ id: Number(workspace.telegramChatId), type: 'supergroup', title: workspace.title }), from: Object.freeze({ id: Number(telegramUserId), first_name: 'Owner', language_code: 'ru' }) })
  });
}

function callback(token, id = 3, action = 'confirm') {
  return Object.freeze({
    update_id: id,
    callback_query: Object.freeze({
      id: `cb-${id}`,
      data: `twm19|${action}|${token}`,
      from: Object.freeze({ id: Number(telegramUserId), first_name: 'Owner', language_code: 'ru' }),
      message: Object.freeze({ message_id: 77, chat: Object.freeze({ id: Number(telegramUserId), type: 'private' }) })
    })
  });
}

function pendingStore() {
  const rows = new Map();
  let seq = 0;
  return Object.freeze({
    async create(input) {
      const token = `twn_testtoken${++seq}abcdefghijkl`;
      const row = Object.freeze({ token, ...input, status: 'pending' });
      rows.set(token, row);
      return row;
    },
    async claim({ token, actorGlobalUserId: actor, telegramUserId: telegram }) {
      const row = rows.get(token);
      if (!row || row.status !== 'pending' || row.actorGlobalUserId !== actor || row.telegramUserId !== telegram) return row ?? null;
      const claimed = Object.freeze({ ...row, status: 'processing' });
      rows.set(token, claimed);
      return claimed;
    },
    async complete(token) { const row = rows.get(token); const next = row ? Object.freeze({ ...row, status: 'completed' }) : null; if (next) rows.set(token, next); return next; },
    async fail(token) { const row = rows.get(token); const next = row ? Object.freeze({ ...row, status: 'failed' }) : null; if (next) rows.set(token, next); return next; },
    async cancel({ token, actorGlobalUserId: actor, telegramUserId: telegram }) {
      const row = rows.get(token);
      if (!row || row.status !== 'pending' || row.actorGlobalUserId !== actor || row.telegramUserId !== telegram) return null;
      const next = Object.freeze({ ...row, status: 'cancelled' }); rows.set(token, next); return next;
    },
    snapshot: () => new Map(rows)
  });
}

function fixture({ outputs = [], authority = () => true, histories = [] } = {}) {
  const sent = [];
  const edited = [];
  const answered = [];
  const proposed = [];
  const applied = [];
  const pending = pendingStore();
  let aiIndex = 0;
  const service = createTelegramWorkspaceNaturalLanguageService({
    aiRouter: Object.freeze({
      async route(input) {
        const output = outputs[Math.min(aiIndex++, outputs.length - 1)] ?? { kind: 'not-twm', workspaceId: null, namespace: null, nextConfigJson: null, historyPath: null, summary: 'ordinary' };
        return Object.freeze({ text: JSON.stringify(output), provider: 'fake', model: 'fake', latencyMs: 1, usage: {}, costUsd: 0, traceId: input.traceContext.traceId, requestId: input.traceContext.requestId, reason: input.reason, attempts: 1, fallbackUsed: false, rawMetadata: {} });
      }
    }),
    botClient: Object.freeze({
      async sendMessage(input) { sent.push(input); return Object.freeze({ message_id: 100 }); },
      async editMessageText(input) { edited.push(input); return Object.freeze({ message_id: input.messageId }); },
      async answerCallbackQuery(input) { answered.push(input); return true; }
    }),
    identityResolver: async () => identityResolver(),
    workspaceRegistry: Object.freeze({
      async listWorkspaces() { return Object.freeze([workspaceA, workspaceB]); },
      async resolveTelegramChatId(chatId) { return [workspaceA, workspaceB].find((item) => item.telegramChatId === String(chatId)) ?? null; }
    }),
    authorityResolver: Object.freeze({
      async verify(input) { return Object.freeze({ allowed: authority(input), reason: 'verified', workspaceRole: 'OWNER', verificationTime: '2026-08-12T13:00:00.000Z' }); }
    }),
    configurationService: Object.freeze({
      async proposeChange(input) {
        proposed.push(input);
        return Object.freeze({ kind: 'telegram-workspace-config-proposal', proposalId: 'p1', requestId: input.requestId, workspaceId: input.workspaceId, namespace: input.namespace, actorGlobalUserId: input.actorGlobalUserId, traceId: input.traceId, reason: input.reason, baseVersion: 0, nextConfig: input.nextConfig, changedPaths: Object.freeze(['enabled']), risk: 'low', confirmationRequired: false, authority: Object.freeze({ allowed: true }) });
      },
      async applyProposal(input) { applied.push(input); return Object.freeze({ config: Object.freeze({ version: 1 }), actionGate: Object.freeze({ outcome: 'allow' }) }); },
      async history() { return histories; }
    }),
    pendingStore: pending,
    projectScope: 'sg2.1',
    idFactory: (() => { let n = 0; return () => `id-${++n}`; })()
  });
  return { service, sent, edited, answered, proposed, applied, pending };
}

test('TWM1.9 ordinary conversation returns pass-through without configuration write', async () => {
  const fx = fixture({ outputs: [{ kind: 'not-twm', workspaceId: null, namespace: null, nextConfigJson: null, historyPath: null, summary: 'ordinary' }] });
  const result = await fx.service.handleUpdate(privateMessage('как дела?'));
  assert.equal(result.handled, false);
  assert.equal(fx.proposed.length, 0);
  assert.equal(fx.sent.length, 0);
});

test('TWM1.9 private natural language creates bounded proposal and writes nothing before confirmation', async () => {
  const fx = fixture({ outputs: [{ kind: 'configure', workspaceId: workspaceA.workspaceId, namespace: 'responses', nextConfigJson: '{"enabled":true,"reply_enabled":true,"mode":"mention_only"}', historyPath: null, summary: 'Отвечать только при обращении' }] });
  const result = await fx.service.handleUpdate(privateMessage('В Crypto отвечай только когда тебя упоминают'));
  assert.equal(result.handled, true);
  assert.equal(result.outcome, 'proposal-pending');
  assert.equal(fx.proposed.length, 1);
  assert.equal(fx.proposed[0].workspaceId, workspaceA.workspaceId);
  assert.equal(fx.applied.length, 0);
  assert.match(fx.sent[0].replyMarkup.inline_keyboard[0][0].callback_data, /^twm19\|confirm\|twn_/);
});

test('TWM1.9 confirmation applies the exact stored proposal with request-bound Action Gate confirmation once', async () => {
  const fx = fixture({ outputs: [{ kind: 'configure', workspaceId: workspaceA.workspaceId, namespace: 'responses', nextConfigJson: '{"enabled":true,"mode":"mention_only"}', historyPath: null, summary: 'mention only' }] });
  const prepared = await fx.service.handleUpdate(privateMessage('Настрой Crypto только на упоминания', 10));
  const confirmed = await fx.service.handleUpdate(callback(prepared.token, 11));
  assert.equal(confirmed.outcome, 'applied');
  assert.equal(fx.applied.length, 1);
  assert.equal(fx.applied[0].proposal.workspaceId, workspaceA.workspaceId);
  assert.equal(fx.applied[0].confirmation.confirmed, true);
  assert.equal(fx.applied[0].confirmation.requestId, fx.applied[0].proposal.requestId);
  const replay = await fx.service.handleUpdate(callback(prepared.token, 12));
  assert.equal(replay.outcome, 'not-pending');
  assert.equal(fx.applied.length, 1);
});

test('TWM1.9 group scope is authoritative and AI cannot redirect configuration to another workspace', async () => {
  const fx = fixture({ outputs: [{ kind: 'configure', workspaceId: workspaceB.workspaceId, namespace: 'moderation', nextConfigJson: '{"enabled":true}', historyPath: null, summary: 'moderation on' }] });
  await assert.rejects(() => fx.service.handleUpdate(groupMessage('включи модерацию в этой группе')), (error) => error.code === 'twm19-workspace-override-denied');
  assert.equal(fx.proposed.length, 0);
});

test('TWM1.9 ambiguous private request asks workspace selection instead of guessing', async () => {
  const fx = fixture({ outputs: [{ kind: 'configure', workspaceId: null, namespace: 'moderation', nextConfigJson: '{"enabled":true}', historyPath: null, summary: 'enable moderation' }] });
  const result = await fx.service.handleUpdate(privateMessage('включи модерацию'));
  assert.equal(result.outcome, 'workspace-selection-required');
  assert.equal(fx.proposed.length, 0);
  assert.match(fx.sent[0].text, /Уточни/);
});

test('TWM1.9 history query reports deterministic stored actor/version rather than invented AI facts', async () => {
  const fx = fixture({
    outputs: [{ kind: 'history-query', workspaceId: workspaceB.workspaceId, namespace: 'moderation', nextConfigJson: null, historyPath: 'links.enabled', summary: 'who changed links' }],
    histories: [Object.freeze({ version: 3, previous_config: { links: { enabled: true } }, new_config: { links: { enabled: false } }, actor_global_user_id: 'usr_real_actor', created_at: '2026-08-12T12:00:00.000Z' })]
  });
  const result = await fx.service.handleUpdate(privateMessage('кто отключил ссылки в Witch?'));
  assert.equal(result.outcome, 'history-query');
  assert.match(fx.sent[0].text, /usr_real_actor/);
  assert.match(fx.sent[0].text, /версия 3/);
});
