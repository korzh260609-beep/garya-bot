import http from 'node:http';
import { createIdentityContext, createScopeContext } from '../contracts/context.js';
import { PRODUCTION_CAPABILITY_NAMES } from '../capability/productionCapabilities.js';
import { TEMPORAL_CAPABILITY_NAMES, TEMPORAL_SAFE_CAPABILITY_NAMES } from '../temporal/temporalCapabilities.js';
import { LANGUAGE_CAPABILITY_NAMES, LANGUAGE_SAFE_CAPABILITY_NAMES } from '../language/languageCapabilities.js';
import { USER_SETTINGS_CAPABILITY_NAMES, USER_SETTINGS_SAFE_CAPABILITY_NAMES } from '../settings/userSettingsCapabilities.js';
import { createLocalProductionHarness } from './localProductionHarness.js';
import { loadTelegramConfig } from '../telegram/telegramConfig.js';
import { createTelegramBotApiClient } from '../telegram/telegramBotApiClient.js';
import { createPostgresTelegramUpdateStore } from '../telegram/postgresTelegramUpdateStore.js';
import { createTelegramProductionIntegration } from '../telegram/telegramProductionIntegration.js';
import { createTelegramWebhookHttpHandler } from '../telegram/telegramWebhookHttpHandler.js';
import { createDeploymentDeliveryRouter } from '../delivery/deploymentDeliveryRouter.js';
import { createTelegramDeliveryTransport } from '../delivery/telegramDeliveryTransport.js';

const ALL_CAPABILITY_NAMES = Object.freeze([...PRODUCTION_CAPABILITY_NAMES, ...TEMPORAL_CAPABILITY_NAMES, ...LANGUAGE_CAPABILITY_NAMES, ...USER_SETTINGS_CAPABILITY_NAMES]);
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
  const revision = envString(env, 'SG_REVISION', envString(env, 'RENDER_GIT_COMMIT', 'sg2.1'));
  return Object.freeze({
    ...env,
    SG_ENVIRONMENT: envString(env, 'SG_ENVIRONMENT', 'production'),
    SG_REVISION: revision,
    SG_PROJECT_SCOPE: envString(env, 'SG_PROJECT_SCOPE', 'sg2.1'),
    SG_PERSISTENCE_MODE: envString(env, 'SG_PERSISTENCE_MODE', envString(env, 'DATABASE_URL') ? 'postgres' : 'memory'),
    SG_MONARCH_TELEGRAM_USER_ID: monarchTelegramUserId,
    SG_MONARCH_TIMEZONE: envString(env, 'SG_MONARCH_TIMEZONE'),
    SG_MONARCH_LANGUAGE: envString(env, 'SG_MONARCH_LANGUAGE')
  });
}
function publicEnvironmentView(env) { return Object.freeze(Object.fromEntries(Object.entries(env).filter(([key]) => !SENSITIVE_ENV_KEY.test(key)))); }
function json(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

export function createProductionTelegramIdentityResolver({ persistence, projectScope, monarchTelegramUserId = null, temporalService = null, monarchTimeZone = null, languageContextService = null, monarchLanguage = null } = {}) {
  if (!persistence?.repositories?.identities || !persistence?.repositories?.access) throw new TypeError('PostgreSQL persistence repositories are required');
  const monarchId = monarchTelegramUserId == null ? null : String(monarchTelegramUserId).trim();
  const configuredMonarchTimeZone = monarchTimeZone == null ? null : String(monarchTimeZone).trim();
  const configuredMonarchLanguage = monarchLanguage == null ? null : String(monarchLanguage).trim().toLowerCase();
  if (configuredMonarchTimeZone && (!temporalService || !temporalService.isValidTimeZone(configuredMonarchTimeZone))) throw new TypeError('SG_MONARCH_TIMEZONE must be a valid IANA timezone');

  async function ensureGrant(globalUserId, project, currentGrants, name) {
    const grantName = `capability:${name}`;
    if (!currentGrants.has(grantName)) { await persistence.repositories.access.grantPermission({ globalUserId, projectScope: project, grantName }); currentGrants.add(grantName); }
  }

  return async ({ platformFacts, scopeFacts }) => {
    const platform = String(platformFacts?.platform ?? '').trim();
    const platformUserId = String(platformFacts?.platformUserId ?? '').trim();
    if (platform !== 'telegram' || !platformUserId) throw new TypeError('Telegram platform identity is required');
    const effectiveProjectScope = String(scopeFacts?.projectId ?? projectScope).trim();
    const existingLink = await persistence.repositories.identities.resolve(platform, platformUserId);
    const globalUserId = existingLink?.global_user_id ?? `telegram:${platformUserId}`;
    if (!existingLink) await persistence.repositories.identities.link({ platform, platformUserId, globalUserId, metadata: { source: 'telegram-production' } });

    let access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    const existing = new Set(access.grants.map((grant) => grant.grant_name));
    if (platformUserId === monarchId) {
      if (!access.roles.includes('monarch')) await persistence.repositories.access.grantRole({ globalUserId, projectScope: effectiveProjectScope, role: 'monarch' });
      for (const name of ALL_CAPABILITY_NAMES) await ensureGrant(globalUserId, effectiveProjectScope, existing, name);
      if (configuredMonarchTimeZone && temporalService && !(await temporalService.getUserTimezone(globalUserId))) await temporalService.setUserTimezone(globalUserId, configuredMonarchTimeZone, { source: 'deployment-config', provenance: { env: 'SG_MONARCH_TIMEZONE' } });
      if (configuredMonarchLanguage && languageContextService && !(await languageContextService.getPreferred(globalUserId))) await languageContextService.setPreferred(globalUserId, configuredMonarchLanguage, { source: 'deployment-config', provenance: { env: 'SG_MONARCH_LANGUAGE' } });
      access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    } else {
      if (access.roles.length === 0 && access.grants.length === 0) { await persistence.repositories.access.grantRole({ globalUserId, projectScope: effectiveProjectScope, role: 'guest' }); await ensureGrant(globalUserId, effectiveProjectScope, existing, 'compose-answer'); }
      for (const name of [...TEMPORAL_SAFE_CAPABILITY_NAMES, ...LANGUAGE_SAFE_CAPABILITY_NAMES, ...USER_SETTINGS_SAFE_CAPABILITY_NAMES]) await ensureGrant(globalUserId, effectiveProjectScope, existing, name);
      access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    }
    const grants = access.grants.map((grant) => grant.grant_name);
    const allowedCapabilities = grants.filter((grant) => grant.startsWith('capability:')).map((grant) => grant.slice('capability:'.length));
    return { identityContext: createIdentityContext({ globalUserId, platform, platformUserId, linkStatus: 'linked', roles: access.roles, grants, authenticationLevel: 'telegram-webhook' }), scopeContext: createScopeContext({ userScope: globalUserId, projectScope: effectiveProjectScope, groupScope: scopeFacts?.groupId ?? null, threadScope: scopeFacts?.threadId ?? null, allowedCapabilities }) };
  };
}

export async function createRenderWebApplication({ env = process.env, fetchImpl = globalThis.fetch, harnessFactory = createLocalProductionHarness } = {}) {
  const effectiveEnv = productionEnv(env);
  const harness = harnessFactory({ env: effectiveEnv, fetchImpl });
  if (!harness.persistence) throw new Error('Render web service requires DATABASE_URL / PostgreSQL persistence');
  if (!harness.credentialManager || !harness.credentialAccessContext) throw new Error('Render web service requires credential management');
  if (!harness.connectionRegistry || !harness.connectionAccessContext) throw new Error('Render web service requires external connections registry');
  const telegramConfig = loadTelegramConfig(effectiveEnv);
  const botClient = createTelegramBotApiClient({ credentialManager: harness.credentialManager, credentialAccessContext: harness.credentialAccessContext, credentialId: telegramConfig.botTokenCredentialId, connectionRegistry: harness.connectionRegistry, connectionAccessContext: harness.connectionAccessContext, connectionId: 'telegram', fetchImpl, timeoutMs: telegramConfig.apiTimeoutMs, maxRetries: telegramConfig.apiMaxRetries });
  const deliveryDeployment = createDeploymentDeliveryRouter({ persistence: harness.persistence, userSettingsService: harness.userSettingsService, resourceAuthorityRegistry: harness.resourceAuthorityRegistry, connectionRegistry: harness.connectionRegistry, observability: harness.observability });
  deliveryDeployment.transportRegistry.register(createTelegramDeliveryTransport({ botClient }));
  const identityResolver = createProductionTelegramIdentityResolver({ persistence: harness.persistence, projectScope: harness.config.projectScope, monarchTelegramUserId: effectiveEnv.SG_MONARCH_TELEGRAM_USER_ID, temporalService: harness.temporalService, monarchTimeZone: effectiveEnv.SG_MONARCH_TIMEZONE, languageContextService: harness.languageContextService, monarchLanguage: effectiveEnv.SG_MONARCH_LANGUAGE });
  const integration = createTelegramProductionIntegration({ credentialManager: harness.credentialManager, credentialAccessContext: harness.credentialAccessContext, webhookCredentialId: telegramConfig.webhookSecretCredentialId, botClient, deliveryRouter: deliveryDeployment.router, updateStore: createPostgresTelegramUpdateStore(harness.persistence.database), identityResolver, runtime: harness.runtime, observability: harness.observability, botUserId: telegramConfig.botUserId, botUsername: telegramConfig.botUsername, environment: harness.config.environment, revision: harness.config.revision });
  const telegramHandler = createTelegramWebhookHttpHandler({ integration, path: telegramConfig.webhookPath });

  const requestHandler = async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') { const runtimeHealth = harness.runtime.health(); json(response, runtimeHealth.ok ? 200 : 503, { ok: runtimeHealth.ok, service: 'sg-2-1-web', runtime: runtimeHealth, revision: harness.config.revision }); return; }
    if (url.pathname === '/ready') { const runtimeReadiness = harness.runtime.readiness(); const databaseHealth = harness.persistence.health(); const ready = runtimeReadiness.ready && databaseHealth.started; json(response, ready ? 200 : 503, { ok: ready, service: 'sg-2-1-web', runtime: runtimeReadiness, database: { started: databaseHealth.started }, revision: harness.config.revision }); return; }
    if (await telegramHandler(request, response)) return;
    json(response, 404, { ok: false, code: 'not-found' });
  };

  let server = null;
  async function start() {
    await harness.runtime.start();
    server = http.createServer((request, response) => requestHandler(request, response).catch(() => json(response, 500, { ok: false, code: 'internal-error' })));
    const port = envPort(effectiveEnv);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', resolve); });
    if (envString(effectiveEnv, 'TELEGRAM_REGISTER_WEBHOOK', 'true').toLowerCase() !== 'false') {
      await harness.credentialManager.useCredential({ credentialId: telegramConfig.webhookSecretCredentialId, actor: harness.credentialAccessContext.actor, scope: harness.credentialAccessContext.scope, purpose: 'telegram.webhook.register', connectionId: 'telegram-webhook', operation: (webhookSecret) => botClient.setWebhook({ url: telegramConfig.webhookUrl, secretToken: webhookSecret }) });
    }
    return Object.freeze({ port, health: harness.runtime.health(), readiness: harness.runtime.readiness(), revision: harness.config.revision });
  }
  async function stop() { if (server) { await new Promise((resolve) => server.close(resolve)); server = null; } await harness.runtime.stop(); }
  return Object.freeze({ effectiveEnv: publicEnvironmentView(effectiveEnv), harness, deliveryRouter: deliveryDeployment.router, deliveryStore: deliveryDeployment.store, deliveryTransportRegistry: deliveryDeployment.transportRegistry, requestHandler, start, stop });
}
