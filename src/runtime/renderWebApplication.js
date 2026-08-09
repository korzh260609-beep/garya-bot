import http from 'node:http';
import { createLocalProductionHarness } from './localProductionHarness.js';
import { loadTelegramConfig } from '../telegram/telegramConfig.js';
import { createTelegramBotApiClient } from '../telegram/telegramBotApiClient.js';
import { createPostgresTelegramUpdateStore } from '../telegram/postgresTelegramUpdateStore.js';
import { createTelegramProductionIntegration } from '../telegram/telegramProductionIntegration.js';
import { createTelegramWebhookHttpHandler } from '../telegram/telegramWebhookHttpHandler.js';
import { createDeploymentDeliveryRouter } from '../delivery/deploymentDeliveryRouter.js';
import { createTelegramDeliveryTransport } from '../delivery/telegramDeliveryTransport.js';
import { createProductionTelegramIdentityResolver } from '../identity/productionTelegramIdentityResolver.js';

export { createProductionTelegramIdentityResolver } from '../identity/productionTelegramIdentityResolver.js';

const SENSITIVE_ENV_KEY = /(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY|DATABASE_URL|PRIVATE[_-]?KEY|CREDENTIAL)/i;

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
  const monarchGlobalUserId = envString(env, 'SG_MONARCH_GLOBAL_USER_ID', envString(env, 'MONARCH_GLOBAL_USER_ID'));
  const revision = envString(env, 'SG_REVISION', envString(env, 'RENDER_GIT_COMMIT', 'sg2.1'));
  return Object.freeze({
    ...env,
    SG_ENVIRONMENT: envString(env, 'SG_ENVIRONMENT', 'production'),
    SG_REVISION: revision,
    SG_PROJECT_SCOPE: envString(env, 'SG_PROJECT_SCOPE', 'sg2.1'),
    SG_PERSISTENCE_MODE: envString(env, 'SG_PERSISTENCE_MODE', envString(env, 'DATABASE_URL') ? 'postgres' : 'memory'),
    SG_MONARCH_TELEGRAM_USER_ID: monarchTelegramUserId,
    SG_MONARCH_GLOBAL_USER_ID: monarchGlobalUserId,
    SG_MONARCH_TIMEZONE: envString(env, 'SG_MONARCH_TIMEZONE'),
    SG_MONARCH_LANGUAGE: envString(env, 'SG_MONARCH_LANGUAGE')
  });
}

function publicEnvironmentView(env) {
  return Object.freeze(Object.fromEntries(Object.entries(env).filter(([key]) => !SENSITIVE_ENV_KEY.test(key))));
}

function json(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

export async function createRenderWebApplication({ env = process.env, fetchImpl = globalThis.fetch, harnessFactory = createLocalProductionHarness } = {}) {
  const effectiveEnv = productionEnv(env);
  const harness = harnessFactory({ env: effectiveEnv, fetchImpl });
  if (!harness.persistence) throw new Error('Render web service requires DATABASE_URL / PostgreSQL persistence');
  if (!harness.credentialManager || !harness.credentialAccessContext) throw new Error('Render web service requires credential management');
  if (!harness.connectionRegistry || !harness.connectionAccessContext) throw new Error('Render web service requires external connections registry');

  const telegramConfig = loadTelegramConfig(effectiveEnv);
  const botClient = createTelegramBotApiClient({
    credentialManager: harness.credentialManager,
    credentialAccessContext: harness.credentialAccessContext,
    credentialId: telegramConfig.botTokenCredentialId,
    connectionRegistry: harness.connectionRegistry,
    connectionAccessContext: harness.connectionAccessContext,
    connectionId: 'telegram',
    fetchImpl,
    timeoutMs: telegramConfig.apiTimeoutMs,
    maxRetries: telegramConfig.apiMaxRetries
  });

  const deliveryDeployment = createDeploymentDeliveryRouter({
    persistence: harness.persistence,
    userSettingsService: harness.userSettingsService,
    resourceAuthorityRegistry: harness.resourceAuthorityRegistry,
    connectionRegistry: harness.connectionRegistry,
    connectionAccessContext: harness.connectionAccessContext,
    observability: harness.observability
  });
  deliveryDeployment.transportRegistry.register(createTelegramDeliveryTransport({ botClient }));

  const identityResolver = createProductionTelegramIdentityResolver({
    persistence: harness.persistence,
    projectScope: harness.config.projectScope,
    monarchTelegramUserId: effectiveEnv.SG_MONARCH_TELEGRAM_USER_ID,
    monarchGlobalUserId: effectiveEnv.SG_MONARCH_GLOBAL_USER_ID,
    temporalService: harness.temporalService,
    monarchTimeZone: effectiveEnv.SG_MONARCH_TIMEZONE,
    languageContextService: harness.languageContextService,
    monarchLanguage: effectiveEnv.SG_MONARCH_LANGUAGE
  });

  const integration = createTelegramProductionIntegration({
    credentialManager: harness.credentialManager,
    credentialAccessContext: harness.credentialAccessContext,
    webhookCredentialId: telegramConfig.webhookSecretCredentialId,
    botClient,
    deliveryRouter: deliveryDeployment.router,
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
  async function closeServer() {
    const current = server;
    server = null;
    if (!current?.listening) return;
    await new Promise((resolve, reject) => current.close((error) => error ? reject(error) : resolve()));
  }

  async function start() {
    let runtimeStarted = false;
    try {
      await harness.runtime.start();
      runtimeStarted = true;
      server = http.createServer((request, response) => requestHandler(request, response).catch(() => json(response, 500, { ok: false, code: 'internal-error' })));
      const port = envPort(effectiveEnv);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '0.0.0.0', resolve);
      });
      if (envString(effectiveEnv, 'TELEGRAM_REGISTER_WEBHOOK', 'true').toLowerCase() !== 'false') {
        await harness.credentialManager.useCredential({
          credentialId: telegramConfig.webhookSecretCredentialId,
          actor: harness.credentialAccessContext.actor,
          scope: harness.credentialAccessContext.scope,
          purpose: 'telegram.webhook.register',
          connectionId: 'telegram-webhook',
          operation: (webhookSecret) => botClient.setWebhook({ url: telegramConfig.webhookUrl, secretToken: webhookSecret })
        });
      }
      return Object.freeze({ port, health: harness.runtime.health(), readiness: harness.runtime.readiness(), revision: harness.config.revision });
    } catch (error) {
      try { await closeServer(); } catch {}
      if (runtimeStarted) {
        try { await harness.runtime.stop(); } catch {}
      }
      throw error;
    }
  }

  async function stop() {
    await closeServer();
    await harness.runtime.stop();
  }

  return Object.freeze({
    effectiveEnv: publicEnvironmentView(effectiveEnv),
    harness,
    deliveryRouter: deliveryDeployment.router,
    deliveryStore: deliveryDeployment.store,
    deliveryTransportRegistry: deliveryDeployment.transportRegistry,
    requestHandler,
    start,
    stop
  });
}
