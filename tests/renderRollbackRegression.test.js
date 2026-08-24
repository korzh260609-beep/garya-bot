import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderWebApplication } from '../src/runtime/renderWebApplication.js';

function fakePersistence() {
  return {
    database: { async query() { return { rows: [], rowCount: 0 }; } },
    health: () => ({ started: true }),
    repositories: {
      identities: { async resolve() { return null; }, async link(input) { return input; } },
      access: { async grantRole() {}, async grantPermission() {}, async list() { return { roles: [], grants: [] }; } }
    }
  };
}

function fakeAutomationRuntime() {
  return {
    durableTaskQueue: {
      async releaseDue() { return []; },
      async recoverAbandoned() { return []; },
      async claim() { return null; },
      async heartbeat() { return null; },
      async complete() { return null; },
      async fail() { return { outcome: 'retry', task: null }; }
    },
    recurringScheduler: {
      async materializeDue() { return []; }
    }
  };
}

test('audit regression: Render startup rolls back HTTP/runtime when webhook registration fails', async () => {
  const persistence = fakePersistence();
  let started = 0;
  let stopped = 0;
  const runtime = {
    health: () => ({ ok: true, phase: started && !stopped ? 'ready' : 'created', accepting: Boolean(started && !stopped) }),
    readiness: () => ({ ready: Boolean(started && !stopped), phase: started && !stopped ? 'ready' : 'created', accepting: Boolean(started && !stopped) }),
    async start() { started += 1; },
    async stop() { stopped += 1; },
    async handle() { return { status: 'success', message: 'ok' }; }
  };
  const credentialAccessContext = { actor: { globalUserId: 'system:runtime', grants: ['credential:use:system'] }, scope: { projectScope: 'sg2.1' } };
  const credentialManager = {
    async useCredential({ connectionId, operation }) {
      return operation(connectionId === 'telegram-webhook' ? 'webhook-secret' : 'bot-token');
    }
  };
  const connectionAccessContext = { actor: { globalUserId: 'system:runtime', grants: ['connection:read'] }, projectScope: 'sg2.1' };
  const connectionRegistry = { async requireUsable() { return { status: 'connected', capabilities: ['telegram.bot-api'] }; } };
  const harnessFactory = ({ env }) => ({
    persistence,
    config: { projectScope: 'sg2.1', environment: 'production', revision: env.SG_REVISION },
    runtime,
    temporalService: null,
    languageContextService: null,
    userSettingsService: null,
    resourceAuthorityRegistry: null,
    observability: { record() {}, recordFailure() {} },
    credentialManager,
    credentialAccessContext,
    connectionRegistry,
    connectionAccessContext,
    ...fakeAutomationRuntime()
  });

  const app = await createRenderWebApplication({
    env: {
      PORT: '39127',
      DATABASE_URL: 'postgres://example',
      TELEGRAM_BOT_TOKEN: 'configured-token-handle-source',
      BASE_URL: 'https://garya-bot.onrender.com',
      RENDER_GIT_COMMIT: 'rollback-test',
      TELEGRAM_REGISTER_WEBHOOK: 'true'
    },
    fetchImpl: async () => { const error = new Error('forced webhook failure'); error.code = 'network-failed'; throw error; },
    harnessFactory
  });

  await assert.rejects(() => app.start(), /forced webhook failure|Telegram/);
  assert.equal(started, 1);
  assert.equal(stopped, 1);
});