import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceOperationsNaturalLanguageService } from '../src/telegramWorkspace/telegramWorkspaceOperationsNaturalLanguageService.js';
import { createInMemoryUserSettingsStore, createUserSettingsService } from '../src/settings/userSettingsService.js';
import { createTimezoneSettingsAdapter } from '../src/settings/userSettingsAdapters.js';
import { createTemporalContextService } from '../src/temporal/temporalContextService.js';

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
          temporalRequested: true,
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
  assert.match(sent[0].text, /Период UTC:/);
  assert.match(sent[0].text, /persisted records\/events/);
  assert.equal(sent[0].text.includes('"recordCounts"'), false);
});

test('analytics with a temporal expression fails closed when user timezone is unknown', async () => {
  const workspace = { workspaceId: 'telegram:workspace:100', telegramChatId: '-100100', workspaceType: 'supergroup', title: 'Sandbox' };
  const sent = [];
  let analyticsCalls = 0;
  const referenceInstant = '2026-08-15T18:00:00.000Z';

  const service = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: {
      async route() {
        return { text: JSON.stringify({
          kind: 'operation',
          workspaceId: workspace.workspaceId,
          operation: 'analytics.snapshot',
          argumentsJson: '{}',
          temporalRequested: true,
          summary: 'Показать аналитику за сегодня'
        }) };
      }
    },
    botClient: {
      async sendMessage(input) { sent.push(input); return { message_id: 2 }; },
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
          return { status: 'timezone-required', originalExpression: text, referenceInstant, timeZone: null, reason: 'user-timezone-unknown' };
        },
        resolveExpression(text, options) {
          assert.match(text, /сегодня/);
          assert.equal(options.timeZone, 'UTC');
          assert.equal(options.referenceInstant, referenceInstant);
          return {
            status: 'resolved', ambiguous: false, precision: 'day',
            utcStart: '2026-08-15T00:00:00.000Z', utcEndExclusive: '2026-08-16T00:00:00.000Z'
          };
        }
      },
      async analyticsSnapshot() {
        analyticsCalls += 1;
        return { metrics: {} };
      }
    },
    pendingStore: pendingStore(),
    projectScope: 'sg2.1',
    idFactory: (() => { let n = 0; return () => String(++n); })()
  });

  const result = await service.handleUpdate({
    update_id: 901,
    message: {
      message_id: 11,
      chat: { id: 42, type: 'private' },
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      text: 'Покажи аналитику по Sandbox за сегодня'
    }
  }, { semanticRoute: { destination: 'telegram-workspace-manager', workspaceOperation: 'operate' } });

  assert.equal(result.outcome, 'analytics-timezone-required');
  assert.equal(analyticsCalls, 0);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /часовой пояс/);
  assert.match(sent[0].text, /не буду подменять/);
});

test('analytics temporal request never falls back to all-time when TemporalService resolution fails', async () => {
  const workspace = { workspaceId: 'telegram:workspace:100', telegramChatId: '-100100', workspaceType: 'supergroup', title: 'Sandbox' };
  const sent = [];
  let analyticsCalls = 0;

  const service = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: {
      async route() {
        return { text: JSON.stringify({
          kind: 'operation',
          workspaceId: workspace.workspaceId,
          operation: 'analytics.snapshot',
          argumentsJson: '{}',
          temporalRequested: true,
          summary: 'Показать аналитику за выбранный период'
        }) };
      }
    },
    botClient: {
      async sendMessage(input) { sent.push(input); return { message_id: 3 }; },
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
        async resolveForUser() {
          throw Object.assign(new Error('timezone store unavailable'), { code: 'timezone-store-unavailable' });
        }
      },
      async analyticsSnapshot() {
        analyticsCalls += 1;
        return { metrics: {} };
      }
    },
    pendingStore: pendingStore(),
    projectScope: 'sg2.1',
    idFactory: (() => { let n = 0; return () => String(++n); })()
  });

  const result = await service.handleUpdate({
    update_id: 902,
    message: {
      message_id: 12,
      chat: { id: 42, type: 'private' },
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      text: 'Покажи аналитику по Sandbox за выбранный период'
    }
  }, { semanticRoute: { destination: 'telegram-workspace-manager', workspaceOperation: 'operate' } });

  assert.equal(result.outcome, 'analytics-period-unresolved');
  assert.equal(analyticsCalls, 0);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /TemporalService/);
  assert.match(sent[0].text, /за всё время/);
});

test('real timezone settings binding resolves today into analytics from/to after timezone is set', async () => {
  const workspace = { workspaceId: 'telegram:workspace:100', telegramChatId: '-100100', workspaceType: 'supergroup', title: 'Sandbox' };
  const sent = [];
  let capturedArgs = null;
  const settingsStore = createInMemoryUserSettingsStore();
  const userSettingsService = createUserSettingsService({ settingsStore, store: settingsStore, clock: () => new Date('2026-08-16T03:00:00.000Z') });
  const timezoneStore = createTimezoneSettingsAdapter({ userSettingsService });
  const temporalService = createTemporalContextService({ clock: () => new Date('2026-08-16T03:00:00.000Z'), timezoneStore });
  await temporalService.setUserTimezone('user:owner', 'Europe/Kyiv', { source: 'user-explicit' });

  const service = createTelegramWorkspaceOperationsNaturalLanguageService({
    aiRouter: {
      async route() {
        return { text: JSON.stringify({
          kind: 'operation',
          workspaceId: workspace.workspaceId,
          operation: 'analytics.snapshot',
          argumentsJson: '{}',
          temporalRequested: true,
          summary: 'Показать аналитику за сегодня'
        }) };
      }
    },
    botClient: {
      async sendMessage(input) { sent.push(input); return { message_id: 4 }; },
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
      temporalService,
      async analyticsSnapshot(_ctx, args) {
        capturedArgs = args;
        return {
          workspaceId: workspace.workspaceId,
          from: args.from,
          to: args.to,
          metrics: { eventCounts: {}, recordCounts: {}, interaction: { uniqueActors: 0, interactionEvents: 0 } }
        };
      }
    },
    pendingStore: pendingStore(),
    projectScope: 'sg2.1',
    idFactory: (() => { let n = 0; return () => String(++n); })()
  });

  const result = await service.handleUpdate({
    update_id: 903,
    message: {
      message_id: 13,
      chat: { id: 42, type: 'private' },
      from: { id: 42, first_name: 'Owner', language_code: 'ru' },
      text: 'Покажи аналитику по Sandbox за сегодня'
    }
  }, { semanticRoute: { destination: 'telegram-workspace-manager', workspaceOperation: 'operate' } });

  assert.equal(result.outcome, 'operation-executed');
  assert.deepEqual(capturedArgs, {
    from: '2026-08-15T21:00:00.000Z',
    to: '2026-08-16T21:00:00.000Z'
  });
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Период UTC: 2026-08-15T21:00:00.000Z — 2026-08-16T21:00:00.000Z/);
});
