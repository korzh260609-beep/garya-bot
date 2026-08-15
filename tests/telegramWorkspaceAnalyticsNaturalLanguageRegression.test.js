import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceOperationsNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceOperationsNaturalLanguageService.js';

function pendingStore() {
  return Object.freeze({
    async create() { throw new Error('analytics must not require confirmation'); },
    async claim() { return null; },
    async complete() { return null; },
    async fail() { return null; },
    async cancel() { return null; }
  });
}

test('analytics period is canonically taken from TemporalService and output is human readable persisted data', async () => {
  const workspace = { workspaceId: 'telegram:workspace:100', telegramChatId: '-100100', workspaceType: 'supergroup', title: 'Sandbox' };
  const sent = [];
  let capturedArgs = null;
  const from = '2026-08-15T00:00:00.000Z';
  const to = '2026-08-16T00:00:00.000Z';

  const service = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: {
      async route() {
        return { text: JSON.stringify({
          kind: 'operation',
          workspaceId: workspace.workspaceId,
          operation: 'analytics.snapshot',
          argumentsJson: '{}',
          summary: 'Показать аналитику за сегодня'
        }) };
      }
    },
    botClient: {
      async sendMessage(input) { sent.push(input); return { message_id: 1 }; },
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
      temporalService: {
        async resolveForUser(globalUserId, text) {
          assert.equal(globalUserId, 'user:owner');
          assert.match(text, /сегодня/);
          return { status: 'resolved', ambiguous: false, utcStart: from, utcEndExclusive: to, timeZone: 'Europe/Kyiv' };
        }
      },
      async analyticsSnapshot(_ctx, args) {
        capturedArgs = args;
        return {
          snapshotId: 'analytics_1',
          workspaceId: workspace.workspaceId,
          from,
          to,
          metrics: {
            eventCounts: { 'content.published': 6, 'test.completed': 1, 'poll.answer-update': 2 },
            recordCounts: { poll: 2, test: 2, content: 8 },
            interaction: { uniqueActors: 2, interactionEvents: 3 },
            totalStructuredEvents: 9
          }
        };
      }
    },
    pendingStore: pendingStore(),
    projectScope: 'sg2.1',
    idFactory: (() => { let n = 0; return () => String(++n); })()
  });

  const result = await service.handleUpdate({
    update_id: 900,
    message: {
      message_id: 10,
      chat: { id: 42, type: 'private' },
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      text: 'Покажи аналитику по Sandbox за сегодня'
    }
  }, { semanticRoute: { destination: 'telegram-workspace-manager', workspaceOperation: 'operate' } });

  assert.equal(result.outcome, 'operation-executed');
  assert.deepEqual(capturedArgs, { from, to });
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /опубликовано сообщений: 6/);
  assert.match(sent[0].text, /создано опросов: 2/);
  assert.match(sent[0].text, /создано тестов: 2/);
  assert.match(sent[0].text, /уникальных участников взаимодействий: 2/);
  assert.match(sent[0].text, /persisted records\/events/);
  assert.equal(sent[0].text.includes('"recordCounts"'), false);
});
