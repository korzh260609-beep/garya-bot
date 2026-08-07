import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProductionTelegramIdentityResolver, createRenderWebApplication } from '../src/runtime/renderWebApplication.js';
import { createProductionWorkerActionGate, createProductionWorkerExecutor } from '../src/automation/productionWorkerExecution.js';

function fakeResponse() {
  const headers = {};
  return {
    statusCode: 0,
    body: '',
    setHeader(name, value) { headers[name] = value; },
    end(value = '') { this.body += value; },
    headers
  };
}

function fakePersistence() {
  const links = new Map();
  const roles = new Map();
  const grants = new Map();
  const key = (user, project) => `${user}:${project}`;
  return {
    database: { async query() { return { rows: [], rowCount: 0 }; } },
    health: () => ({ started: true }),
    repositories: {
      identities: {
        async resolve(platform, platformUserId) { return links.get(`${platform}:${platformUserId}`) ?? null; },
        async link({ platform, platformUserId, globalUserId }) {
          const row = { platform, platform_user_id: platformUserId, global_user_id: globalUserId };
          links.set(`${platform}:${platformUserId}`, row);
          return row;
        }
      },
      access: {
        async grantRole({ globalUserId, projectScope, role }) {
          const k = key(globalUserId, projectScope);
          roles.set(k, [...new Set([...(roles.get(k) ?? []), role])]);
        },
        async grantPermission({ globalUserId, projectScope, grantName }) {
          const k = key(globalUserId, projectScope);
          grants.set(k, [...new Set([...(grants.get(k) ?? []), grantName])]);
        },
        async list({ globalUserId, projectScope }) {
          const k = key(globalUserId, projectScope);
          return { roles: roles.get(k) ?? [], grants: (grants.get(k) ?? []).map((grant_name) => ({ grant_name, constraints: {} })) };
        }
      }
    }
  };
}

test('Block 17 reuses the existing SG 2.0 Render service settings', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const entrypoint = await readFile(new URL('../src/runtime/entrypoint.js', import.meta.url), 'utf8');
  const renderEntrypoint = await readFile(new URL('../src/runtime/renderWebEntrypoint.js', import.meta.url), 'utf8');
  assert.equal(pkg.scripts.start, 'node src/runtime/entrypoint.js');
  assert.match(entrypoint, /RENDER_EXTERNAL_URL/);
  assert.match(entrypoint, /BASE_URL/);
  assert.match(entrypoint, /renderWebEntrypoint\.js/);
  assert.match(renderEntrypoint, /RUN_MIGRATIONS_ON_BOOT/);
  assert.match(renderEntrypoint, /runMigrations/);
  await assert.rejects(readFile(new URL('../render.yaml', import.meta.url), 'utf8'));
});

test('production Telegram identity resolver bootstraps only configured monarch and bounds guests', async () => {
  const persistence = fakePersistence();
  const resolver = createProductionTelegramIdentityResolver({ persistence, projectScope: 'sg2.1', monarchTelegramUserId: '100' });
  const monarch = await resolver({ platformFacts: { platform: 'telegram', platformUserId: '100' }, scopeFacts: { projectId: 'sg2.1' } });
  assert.ok(monarch.identityContext.roles.includes('monarch'));
  assert.ok(monarch.scopeContext.allowedCapabilities.includes('compose-answer'));
  assert.ok(monarch.scopeContext.allowedCapabilities.includes('memory-write'));

  const guest = await resolver({ platformFacts: { platform: 'telegram', platformUserId: '200' }, scopeFacts: { projectId: 'sg2.1', groupId: 'g', threadId: 't' } });
  assert.deepEqual(guest.identityContext.roles, ['guest']);
  assert.deepEqual(guest.scopeContext.allowedCapabilities, ['compose-answer']);
  assert.equal(guest.scopeContext.groupScope, 'g');
  assert.equal(guest.scopeContext.threadScope, 't');
});

test('Render web application reuses SG 2.0-style environment and monarch alias', async () => {
  const persistence = fakePersistence();
  const runtime = {
    health: () => ({ ok: true, phase: 'created', accepting: false }),
    readiness: () => ({ ready: false, phase: 'created', accepting: false }),
    async start() {}, async stop() {}, async handle() { return { status: 'success', message: 'ok' }; }
  };
  let receivedEnv = null;
  const harnessFactory = ({ env }) => {
    receivedEnv = env;
    return {
      persistence,
      config: { projectScope: env.SG_PROJECT_SCOPE, environment: env.SG_ENVIRONMENT, revision: 'block-17' },
      runtime,
      observability: { record() {}, recordFailure() {} }
    };
  };
  const app = await createRenderWebApplication({
    env: {
      DATABASE_URL: 'postgres://example',
      DATABASE_SSL: 'true',
      TELEGRAM_BOT_TOKEN: 'test-token',
      BASE_URL: 'https://garya-bot.onrender.com',
      MONARCH_USER_ID: '100',
      TELEGRAM_REGISTER_WEBHOOK: 'false'
    },
    fetchImpl: async () => { throw new Error('network should not be called'); },
    harnessFactory
  });

  assert.equal(receivedEnv.SG_ENVIRONMENT, 'production');
  assert.equal(receivedEnv.SG_PROJECT_SCOPE, 'sg2.1');
  assert.equal(receivedEnv.SG_PERSISTENCE_MODE, 'postgres');
  assert.equal(receivedEnv.SG_MONARCH_TELEGRAM_USER_ID, '100');

  const healthResponse = fakeResponse();
  await app.requestHandler({ url: '/health', method: 'GET', headers: {} }, healthResponse);
  assert.equal(healthResponse.statusCode, 200);
  assert.equal(JSON.parse(healthResponse.body).ok, true);

  const readyResponse = fakeResponse();
  await app.requestHandler({ url: '/ready', method: 'GET', headers: {} }, readyResponse);
  assert.equal(readyResponse.statusCode, 503);
  assert.equal(JSON.parse(readyResponse.body).ok, false);
});

test('production worker completes safe user tasks and fails closed for protected execution', async () => {
  const executor = createProductionWorkerExecutor();
  const result = await executor({ taskId: 't-1', kind: 'user-task', payload: { text: 'bounded' }, attempt: 1 });
  assert.deepEqual(result, { status: 'completed', taskId: 't-1', kind: 'user-task', attempt: 1, acknowledged: true });

  const gate = createProductionWorkerActionGate();
  const decision = await gate({ kind: 'external-write' });
  assert.equal(decision.outcome, 'deny');
  assert.equal(decision.allowed, false);

  await assert.rejects(() => executor({ taskId: 't-2', kind: 'external-write', payload: {}, attempt: 1 }), /No production executor registered/);
});
