import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceNaturalLanguageService.js';

function privateUpdate(text = 'Покажи мои группы') {
  return Object.freeze({
    update_id: 21001,
    message: Object.freeze({
      message_id: 21001,
      text,
      chat: Object.freeze({ id: 7001, type: 'private' }),
      from: Object.freeze({ id: 7001, first_name: 'Owner', language_code: 'ru' })
    })
  });
}

function fixture({ allowed = true } = {}) {
  const deliveries = [];
  const aiCalls = [];
  const workspaces = [
    Object.freeze({ workspaceId: 'tgw_group_alpha', telegramChatId: '-100111', workspaceType: 'supergroup', title: 'Alpha' }),
    Object.freeze({ workspaceId: 'tgw_group_beta', telegramChatId: '-100222', workspaceType: 'supergroup', title: 'Beta' })
  ];
  const service = createTelegramWorkspaceNaturalLanguageService({
    aiRouter: Object.freeze({ async route(input) { aiCalls.push(input); throw new Error('workspace-list must not require second AI interpretation'); } }),
    botClient: Object.freeze({
      async sendMessage(input) { deliveries.push(input); return Object.freeze({ ok: true }); },
      async editMessageText() {},
      async answerCallbackQuery() {}
    }),
    identityResolver: async () => Object.freeze({ identityContext: Object.freeze({ globalUserId: 'usr_owner' }) }),
    workspaceRegistry: Object.freeze({
      async listWorkspaces() { return workspaces; },
      async resolveTelegramChatId() { return null; }
    }),
    authorityResolver: Object.freeze({ async verify() { return Object.freeze({ allowed }); } }),
    configurationService: Object.freeze({
      async getConfig() {}, async proposeChange() {}, async applyProposal() {}, async history() { return []; }
    }),
    pendingStore: Object.freeze({
      async create() {}, async claim() {}, async complete() {}, async fail() {}, async cancel() {}
    })
  });
  return { service, deliveries, aiCalls };
}

test('private-chat workspace-list returns only authority-verified registered workspaces without second AI call', async () => {
  const fx = fixture();
  const result = await fx.service.handleUpdate(privateUpdate(), {
    semanticRoute: Object.freeze({ destination: 'telegram-workspace-manager', workspaceOperation: 'workspace-list', reason: 'workspace inventory' })
  });
  assert.equal(result.handled, true);
  assert.equal(result.outcome, 'workspace-list');
  assert.deepEqual(result.workspaceIds, ['tgw_group_alpha', 'tgw_group_beta']);
  assert.equal(fx.aiCalls.length, 0);
  assert.equal(fx.deliveries.length, 1);
  assert.match(fx.deliveries[0].text, /Alpha/);
  assert.match(fx.deliveries[0].text, /tgw_group_alpha/);
  assert.match(fx.deliveries[0].text, /Beta/);
});

test('workspace-list does not expose registered workspaces when current authority verification denies access', async () => {
  const fx = fixture({ allowed: false });
  const result = await fx.service.handleUpdate(privateUpdate(), {
    semanticRoute: Object.freeze({ destination: 'telegram-workspace-manager', workspaceOperation: 'workspace-list', reason: 'workspace inventory' })
  });
  assert.equal(result.handled, true);
  assert.equal(result.outcome, 'workspace-list-empty');
  assert.equal(fx.aiCalls.length, 0);
  assert.equal(fx.deliveries.length, 1);
  assert.doesNotMatch(fx.deliveries[0].text, /tgw_group_alpha/);
});
