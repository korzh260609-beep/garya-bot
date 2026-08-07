import http from 'node:http';
import { createIdentityContext, createScopeContext } from '../contracts/context.js';
import { PRODUCTION_CAPABILITY_NAMES } from '../capability/productionCapabilities.js';
import { createLocalProductionHarness } from './localProductionHarness.js';
import { loadTelegramConfig } from '../telegram/telegramConfig.js';
import { createTelegramBotApiClient } from '../telegram/telegramBotApiClient.js';
import { createPostgresTelegramUpdateStore } from '../telegram/postgresTelegramUpdateStore.js';
import { createTelegramProductionIntegration } from '../telegram/telegramProductionIntegration.js';
import { createTelegramWebhookHttpHandler } from '../telegram/telegramWebhookHttpHandler.js';

function envString(env, key, fallback = '') {
  const value = env[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function envPort(env) {
  const value = Number(env.PORT ?? 10000);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 65535) throw new TypeError('PORT must be a valid TCP port');
  return value;
}

function productionEnv(env) {
  const monarchTelegramUserId = envString(env, 'SG_MONARCH_TELEGRAM_USER_ID', envString(env, 'MONARCH_USER_ID'));
  return Object.freeze({
    ...env,
    SG_ENVIRONMENT: envString(env, 'SG_ENVIRONMENT', 'production'),
    SG_PROJECT_SCOPE: envString(env, 'SG_PROJECT_SCOPE', 'sg2.1'),
    SG_PERSISTENCE_MODE: envString(env, 'SG_PERSISTENCE_MODE', envString(env, 'DATABASE_URL') ? 'postgres' : 'memory'),
    SG_MONARCH_TELEGRAM_USER_ID: monarchTelegramUserId
  });
}

function json(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

export function createProductionTelegramIdentityResolver({ persistence, projectScope, monarchTelegramUserId = null } = {}) {
  if (!persistence?.repositories?.identities || !persistence?.repositories?.access) throw new TypeError('PostgreSQL persistence repositories are required');
  const monarchId = monarchTelegramUserId == null ? null : String(monarchTelegramUserId).trim();

  return async ({ platformFacts, scopeFacts }) => {
    const platform = String(platformFacts?.platform ?? '').trim();
    const platformUserId = String(platformFacts?.platformUserId ?? '').trim();
    if (platform !== 'telegram' || !platformUserId) throw new TypeError('Telegram platform identity is required');
    const effectiveProjectScope = String(scopeFacts?.projectId ?? projectScope).trim();
    const existingLink = await persistence.repositories.identities.resolve(platform, platformUserId);
    const globalUserId = existingLink?.global_user_id ?? `telegram:${platformUserId}`;
    if (!existingLink) {
      await persistence.repositories.identities.link({ platform, platformUserId, globalUserId, metadata: { source: 'telegram-production' } });
    }

    let access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    if (platformUserId === monarchId) {
      if (!access.roles.includes('monarch')) await persistence.repositories.access.grantRole({ globalUserId, projectScope: effectiveProjectScope, role: 'monarch' });
      const existing = new Set(access.grants.map((grant) => grant.grant_name));
      for (const name of PRODUCTION_CAPABILITY_NAMES) {
        const grantName = `capability:${name}`;
        if (!existing.has(grantName)) await persistence.repositories.access.grantPermission({ globalUserId, projectScope: effectiveProjectScope, grantName });
      }
      access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    } else if (access.roles.length === 0 && access.grants.length === 0) {
      await persistence.repositories.access.grantRole({ globalUserId, projectScope: effectiveProjectScope, role: 'guest' });
      await persistence.repositories.access.grantPermission({ globalUserId, projectScope: effectiveProjectScope, grantName: 'capability:compose-answer' });
      access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    }

    const grants = access.grants.map((grant) => grant.grant_name);
    const allowedCapabilities = grants.filter((grant) => grant.startsWith('capability:')).map((grant) => grant.slice('capability:'.length));
    return {
      identityContext: createIdentityContext({
        globalUserId,
        platform,
        platformUserId,
        linkStatus: 'linked',
        roles: access.roles,
        grants,
        authenticationLevel: 'telegram-webhook'
      }),
      scopeContext: createScopeContext({
        userScope: globalUserId,
        projectScope: effectiveProjectScope,
        groupScope: scopeFacts?.groupId ?? null,
        threadScope: scopeFacts?.threadId ?? null,
        allowedCapabilities
      })
    };
  };
}

export async function createRenderWebApplication({ env = process.env, fetchImpl = globalThis.fetch, harnessFactory = createLocalProductionHarness } = {}) {
  const effectiveEnv = productionEnv(env);
  const harness = harnessFactory({ env: effectiveEnv, fetchImpl });
  if (!harness.persistence) throw new Error('Render web service requires DATABASE_URL / PostgreSQL persistence');
  const telegramConfig = loadTelegramConfig(effectiveEnv);
  const botClient = createTelegramBotApiClient({ token: telegramConfig.token, fetchImpl, timeoutMs: telegramConfig.apiTimeoutMs, maxRetries: telegramConfig.apiMaxRetries });
  const identityResolver = createProductionTelegramIdentityResolver({ persistence: harness.persistence, projectScope: harness.config.projectScope, monarchTelegramUserId: effectiveEnv.SG_MONARCH_TELEGRAM_USER_ID });
  const integration = createTelegramProductionIntegration({
    secretToken: telegramConfig.webhookSecret,
    botClient,
    updateStore: createPostgresTelegramUpdateStore(harness.persistence.database),
    identityResolver,
    runtime: harness.runtime,
    observability: harness.observability,
    botUserId: telegramConfig.botUserId,
    botUsername: telegramConfig.botUsername,
    environment: harness.config.environment,
    revision: harness.config.revision
  });
  const telegramHandler = createTelegramWebhookHttpHandler({ integration, path: telegramConfig.webhookPath });

  const requestHandler = async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      const runtimeHealth = harness.runtime.health();
      json(response, runtimeHealth.ok ? 200 : 503, { ok: runtimeHealth.ok, service: 'sg-2-1-web', runtime: runtimeHealth, revision: harness.config.revision });
      return;
    }
    if (url.pathname === '/ready') {
      const runtimeReadiness = harness.runtime.readiness();
      const databaseHealth = harness.persistence.health();
      const ready = runtimeReadiness.ready && databaseHealth.started;
      json(response, ready ? 200 : 503, { ok: ready, service: 'sg-2-1-web', runtime: runtimeReadiness, database: { started: databaseHealth.started }, revision: harness.config.revision });
      return;
    }
    if (await telegramHandler(request, response)) return;
    json(response, 404, { ok: false, code: 'not-found' });
  };

  let server = null;
  async function start() {
    await harness.runtime.start();
    server = http.createServer((request, response) => requestHandler(request, response).catch(() => json(response, 500, { ok: false, code: 'internal-error' })));
    const port = envPort(effectiveEnv);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '0.0.0.0', resolve);
    });
    if (envString(effectiveEnv, 'TELEGRAM_REGISTER_WEBHOOK', 'true').toLowerCase() !== 'false') {
      await botClient.setWebhook({ url: telegramConfig.webhookUrl, secretToken: telegramConfig.webhookSecret });
    }
    return { port, webhookPath: telegramConfig.webhookPath, revision: harness.config.revision };
  }

  async function stop() {
    if (server) await new Promise((resolve) => server.close(resolve));
    await harness.runtime.stop();
  }

  return Object.freeze({ harness, telegramConfig, requestHandler, start, stop });
}
