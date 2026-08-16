import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceOperationsNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceOperationsNaturalLanguageService.js';

function createPendingStore() {
  let item = null;
  return Object.freeze({
    async create(input) { item = { ...input, token: 'pending-reference', status: 'pending' }; return item; },
    async claim() { return item; },
    async complete() { return item; },
    async fail() { return item; },
    async cancel() { return null; },
    snapshot: () => item
  });
}

test('TWM follow-up publication receives prior generated quiz from canonical conversation context', async () => {
  const workspace = { workspaceId: 'telegram:workspace:100', telegramChatId: '-100100', workspaceType: 'supergroup', title: 'GARYA_пісочниця' };
  const pendingStore = createPendingStore();
  let aiPayload = null;
  let resolvedTurnInput = null;

  const service = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: {
      async route(input) {
        aiPayload = JSON.parse(input.messages[1].content);
        return {
          text: JSON.stringify({
            kind: 'operation',
            workspaceId: workspace.workspaceId,
            operation: 'test.create',
            argumentsJson: JSON.stringify({
              title: 'Викторина: Океаны',
              questions: [
                { text: 'Какой океан самый большой по площади?', options: ['Тихий океан', 'Атлантический океан', 'Индийский океан', 'Северный Ледовитый океан'], correctOptionIndex: 0 },
                { text: 'Какой океан самый холодный?', options: ['Тихий океан', 'Атлантический океан', 'Индийский океан', 'Северный Ледовитый океан'], correctOptionIndex: 3 }
              ]
            }),
            temporalRequested: false,
            summary: 'Опубликовать ранее созданную викторину об океанах'
          })
        };
      }
    },
    botClient: {
      async sendMessage() { return { message_id: 900 }; },
      async editMessageText() { return true; },
      async answerCallbackQuery() { return true; }
    },
    identityResolver: async () => ({ identityContext: { globalUserId: 'user:owner' } }),
    workspaceRegistry: {
      async listWorkspaces() { return [workspace]; },
      async resolveTelegramChatId() { return null; },
      async getWorkspace() { return workspace; }
    },
    authorityResolver: { async verify() { return { allowed: true }; } },
    operationsService: {
      core: { store: { async listRecords() { return []; } } },
      conversationContextService: {
        async resolveTurn(input) {
          resolvedTurnInput = input;
          return {
            recentTurns: [
              { direction: 'inbound', text: 'Придумай маленькую викторину на тему океанов', createdAt: '2026-08-16T12:40:00.000Z' },
              { direction: 'outbound', text: 'Викторина: Океаны\n1. Какой океан самый большой по площади? Тихий океан ✅ ...\n2. Какой океан самый холодный? Северный Ледовитый океан ✅', createdAt: '2026-08-16T12:40:01.000Z' },
              { direction: 'inbound', text: 'Размести теперь эту викторину в группе GARYA_пісочниця', createdAt: '2026-08-16T12:41:00.000Z' }
            ]
          };
        }
      }
    },
    pendingStore,
    projectScope: 'sg2.1',
    idFactory: (() => { let n = 0; return () => String(++n); })()
  });

  const result = await service.handleUpdate({
    update_id: 800,
    message: {
      message_id: 77,
      chat: { id: 42, type: 'private' },
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      text: 'Размести теперь эту викторину в группе GARYA_пісочниця'
    }
  }, { semanticRoute: { destination: 'telegram-workspace-manager', workspaceOperation: 'operate' } });

  assert.equal(result.outcome, 'operation-pending');
  assert.equal(result.operation, 'test.create');
  assert.equal(resolvedTurnInput.globalUserId, 'user:owner');
  assert.equal(resolvedTurnInput.transport, 'telegram');
  assert.equal(resolvedTurnInput.platformMessageId, '77');
  assert.equal(aiPayload.text, 'Размести теперь эту викторину в группе GARYA_пісочниця');
  assert.ok(aiPayload.recentConversationTurns.some((turn) => turn.direction === 'outbound' && turn.text.includes('Викторина: Океаны')));
  assert.equal(pendingStore.snapshot().proposal.operation, 'test.create');
  assert.equal(pendingStore.snapshot().proposal.arguments.questions.length, 2);
  assert.equal(pendingStore.snapshot().proposal.arguments.questions[0].correctOptionIndex, 0);
});
