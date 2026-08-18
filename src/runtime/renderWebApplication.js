import http from 'node:http';
import { createLocalProductionHarness } from './localProductionHarness.js';
import { loadTelegramConfig } from '../telegram/telegramConfig.js';
import { createTelegramBotApiClient } from '../telegram/telegramBotApiClient.js';
import { createPostgresTelegramUpdateStore } from '../telegram/postgresTelegramUpdateStore.js';
import { createTelegramProductionIntegration } from '../telegram/telegramProductionIntegration.js';
import { createTelegramWebhookHttpHandler } from '../telegram/telegramWebhookHttpHandler.js';
import { createTelegramWorkspaceProductionOperations } from '../telegramWorkspace/telegramWorkspaceProductionOperations.js';
import { createTelegramWorkspaceOperationsNaturalLanguageService } from '../telegramWorkspace/telegramWorkspaceOperationsNaturalLanguageService.js';
import { createTelegramWorkspaceUnifiedNaturalLanguageService } from '../telegramWorkspace/telegramWorkspaceUnifiedNaturalLanguageService.js';
import {
  createPostgresTelegramWorkspaceAuthorityResolver,
  createTelegramWorkspaceBotCapabilityService,
  createTelegramWorkspaceActionGateIntegration,
  createTelegramWorkspaceConfigurationService,
  createTelegramWorkspaceNativeUi,
  createTelegramWorkspaceNaturalLanguageService,
  createPostgresTelegramWorkspaceNaturalLanguagePendingStore,
  createTelegramWorkspaceRuntimeWiring,
  verifyTelegramMiniAppInitData,
  createTelegramWorkspaceMiniAppService,
  createTelegramWorkspaceMiniAppHttpHandler
} from '../telegramWorkspace/index.js';
import { createDeploymentDeliveryRouter } from '../delivery/deploymentDeliveryRouter.js';
import { createTelegramDeliveryTransport } from '../delivery/telegramDeliveryTransport.js';
import { createDiscordDeliveryTransport } from '../delivery/discordDeliveryTransport.js';
import { createDeploymentAutomationWorker } from '../automation/deploymentAutomationWorker.js';
import { createProductionExecutableWorkflowRuntime } from '../automation/productionExecutableWorkflowRuntime.js';
import { createPostgresWorkflowExecutionStore } from '../automation/postgresWorkflowExecutionStore.js';
import { createProductionTelegramIdentityResolver } from '../identity/productionTelegramIdentityResolver.js';
import { createProductionDiscordIdentityResolver } from '../identity/productionDiscordIdentityResolver.js';
import { loadDiscordConfig } from '../discord/discordConfig.js';
import { createDiscordRestClient } from '../discord/discordRestClient.js';
import { createPostgresDiscordEventStore } from '../discord/postgresDiscordEventStore.js';
import { createDiscordProductionIntegration } from '../discord/discordProductionIntegration.js';
import { createDiscordGatewayClient } from '../discord/discordGatewayClient.js';
import { registerDiscordDeploymentCredential, bootstrapDiscordExternalConnection } from '../discord/discordDeployment.js';

export { createProductionTelegramIdentityResolver } from '../identity/productionTelegramIdentityResolver.js';
export { createProductionDiscordIdentityResolver } from '../identity/productionDiscordIdentityResolver.js';

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
  const monarchDiscordUserId = envString(env, 'SG_MONARCH_DISCORD_USER_ID');
  const revision = envString(env, 'SG_REVISION', envString(env, 'RENDER_GIT_COMMIT', 'sg2.1'));
  const explicitAiEnabled = envString(env, 'SG_AI_ENABLED');
  const openAiCredentialPresent = envString(env, 'OPENAI_API_KEY') !== '';
  const aiEnabled = explicitAiEnabled || (openAiCredentialPresent ? 'true' : 'false');
  return Object.freeze({
    ...env,
    SG_ENVIRONMENT: envString(env, 'SG_ENVIRONMENT', 'production'),
    SG_REVISION: revision,
    SG_PROJECT_SCOPE: envString(env, 'SG_PROJECT_SCOPE', 'sg2.1'),
    SG_PERSISTENCE_MODE: envString(env, 'SG_PERSISTENCE_MODE', envString(env, 'DATABASE_URL') ? 'postgres' : 'memory'),
    SG_AI_ENABLED: aiEnabled,
    SG_MONARCH_TELEGRAM_USER_ID: monarchTelegramUserId,
    SG_MONARCH_DISCORD_USER_ID: monarchDiscordUserId,
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
  const telegramWorkspaceRuntimeAvailable = Boolean(harness.resourceAuthorityRegistry && harness.resourceAuthorityAccessContext);
  if (telegramWorkspaceRuntimeAvailable && !harness.actionGate?.evaluate) throw new Error('Render Telegram workspace runtime requires canonical SG Action Gate');
  if (effectiveEnv.SG_AI_ENABLED === 'true' && !harness.productionAI) throw new Error('Production AI was enabled but did not initialize');

  const telegramConfig = loadTelegramConfig(effectiveEnv);
  const discordConfig = loadDiscordConfig(effectiveEnv);
  if (discordConfig.enabled) registerDiscordDeploymentCredential({ credentialManager: harness.credentialManager, env: effectiveEnv, projectScope: harness.config.projectScope });

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

  const discordRestClient = discordConfig.enabled ? createDiscordRestClient({
    credentialManager: harness.credentialManager,
    credentialAccessContext: harness.credentialAccessContext,
    credentialId: discordConfig.botTokenCredentialId,
    connectionRegistry: harness.connectionRegistry,
    connectionAccessContext: harness.connectionAccessContext,
    connectionId: 'discord',
    fetchImpl,
    timeoutMs: discordConfig.apiTimeoutMs,
    maxRetries: discordConfig.apiMaxRetries
  }) : null;

  const deliveryDeployment = createDeploymentDeliveryRouter({
    persistence: harness.persistence,
    userSettingsService: harness.userSettingsService,
    resourceAuthorityRegistry: harness.resourceAuthorityRegistry,
    connectionRegistry: harness.connectionRegistry,
    connectionAccessContext: harness.connectionAccessContext,
    observability: harness.observability
  });
  deliveryDeployment.transportRegistry.register(createTelegramDeliveryTransport({ botClient }));
  if (discordRestClient) deliveryDeployment.transportRegistry.register(createDiscordDeliveryTransport({ restClient: discordRestClient }));
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

  const discordIdentityResolver = discordConfig.enabled ? createProductionDiscordIdentityResolver({
    persistence: harness.persistence,
    projectScope: harness.config.projectScope,
    monarchDiscordUserId: effectiveEnv.SG_MONARCH_DISCORD_USER_ID,
    monarchGlobalUserId: effectiveEnv.SG_MONARCH_GLOBAL_USER_ID,
    temporalService: harness.temporalService,
    monarchTimeZone: effectiveEnv.SG_MONARCH_TIMEZONE,
    languageContextService: harness.languageContextService,
    monarchLanguage: effectiveEnv.SG_MONARCH_LANGUAGE
  }) : null;

  const telegramUpdateStore = createPostgresTelegramUpdateStore(harness.persistence.database);
  const workspaceStore = telegramUpdateStore.workspaceRegistry?.store ?? null;
  const telegramBotCapabilities = workspaceStore
    ? createTelegramWorkspaceBotCapabilityService({
        workspaceStore,
        telegramApiClient: botClient,
        botUserId: telegramConfig.botUserId,
        audit: async (event) => {
          const correlation = `twm1.5:${event.workspaceId ?? 'unknown'}:${event.operation}`;
          return harness.observability.record({
            eventClass: 'audit_event',
            channel: 'telemetry',
            stage: 'telegram-workspace-bot-capability',
            traceContext: { traceId: correlation, requestId: correlation, environment: harness.config.environment, revision: harness.config.revision },
            outcome: event.outcome,
            data: { capabilityEventClass: event.eventClass, workspaceId: event.workspaceId, membershipState: event.membershipState, reason: event.reason, missingCapabilities: event.missingCapabilities, missingPermissions: event.missingPermissions, fetchedAt: event.fetchedAt }
          });
        }
      })
    : null;

  const telegramWorkspaceAuthority = workspaceStore && telegramWorkspaceRuntimeAvailable
    ? createPostgresTelegramWorkspaceAuthorityResolver({
        persistence: harness.persistence,
        workspaceRegistry: telegramUpdateStore.workspaceRegistry,
        telegramApiClient: botClient,
        resourceAuthorityRegistry: harness.resourceAuthorityRegistry,
        resourceAuthorityAccessContext: harness.resourceAuthorityAccessContext,
        projectScope: harness.config.projectScope,
        audit: async (event) => {
          const correlation = `twm1.4:${event.workspaceId ?? 'unknown'}:${event.requestedAction ?? 'authority'}`;
          return harness.observability.record({
            eventClass: 'audit_event',
            channel: 'telemetry',
            stage: 'telegram-workspace-authority',
            traceContext: { traceId: correlation, requestId: correlation, environment: harness.config.environment, revision: harness.config.revision },
            actorRef: event.actorGlobalUserId ?? null,
            outcome: event.outcome,
            reason: event.reason,
            data: { authorityEventClass: event.eventClass, workspaceId: event.workspaceId, requestedAction: event.requestedAction, workspaceRole: event.workspaceRole, verificationTime: event.verificationTime }
          });
        }
      })
    : null;

  const telegramWorkspaceMutationGate = telegramWorkspaceAuthority
    ? createTelegramWorkspaceActionGateIntegration({
        actionGate: harness.actionGate,
        projectScope: harness.config.projectScope,
        policyContextResolver: () => harness.policyLayer?.resolve?.() ?? null,
        audit: async (event) => {
          const correlation = event.traceId ?? `twm1.7:${event.workspaceId ?? 'unknown'}:${event.operation ?? 'mutation'}`;
          return harness.observability.record({
            eventClass: 'audit_event',
            channel: 'audit',
            stage: 'telegram-workspace-action-gate',
            traceContext: { traceId: correlation, requestId: event.requestId ?? correlation, environment: harness.config.environment, revision: harness.config.revision },
            actorRef: event.actorGlobalUserId ?? null,
            outcome: event.outcome,
            reason: event.reasons?.[0] ?? null,
            data: {
              actionGateEventClass: event.eventClass,
              operation: event.operation,
              workspaceId: event.workspaceId,
              namespace: event.namespace,
              domain: event.domain ?? null,
              recordId: event.recordId ?? null,
              risk: event.risk,
              confirmationRequired: event.confirmationRequired,
              reasons: event.reasons ?? []
            }
          });
        }
      })
    : null;

  const telegramWorkspaceOperations = workspaceStore && telegramWorkspaceAuthority && telegramWorkspaceMutationGate && telegramBotCapabilities
    ? createTelegramWorkspaceProductionOperations({
        harness,
        botClient,
        workspaceRegistry: telegramUpdateStore.workspaceRegistry,
        workspaceStore,
        authorityResolver: telegramWorkspaceAuthority,
        mutationGate: telegramWorkspaceMutationGate,
        botCapabilityService: telegramBotCapabilities,
        identityResolver
      })
    : null;

  const workflowExecution = telegramWorkspaceOperations?.store && harness.taskStore?.workflowStore
    ? createProductionExecutableWorkflowRuntime({
        workflowStore: harness.taskStore.workflowStore,
        stepRunStore: createPostgresWorkflowExecutionStore({ database: harness.persistence.database }),
        workspaceOperationsStore: telegramWorkspaceOperations.store,
        workspaceRegistry: telegramUpdateStore.workspaceRegistry,
        workspaceAuthority: telegramWorkspaceAuthority,
        botCapabilityService: telegramBotCapabilities,
        actionGate: harness.actionGate,
        policyContextResolver: () => harness.policyLayer?.resolve?.() ?? null,
        credentialManager: harness.credentialManager,
        deliveryRouter: deliveryDeployment.router,
        aiRouter: harness.productionAI?.aiRouter ?? null
      })
    : null;
  const automationWorker = createDeploymentAutomationWorker({
    harness,
    deliveryRouter: deliveryDeployment.router,
    workflowExecution,
    env: effectiveEnv
  });

  const telegramWorkspaceConfiguration = workspaceStore && telegramWorkspaceAuthority && telegramWorkspaceMutationGate
    ? createTelegramWorkspaceConfigurationService({
        workspaceStore,
        authorityResolver: telegramWorkspaceAuthority,
        mutationGate: telegramWorkspaceMutationGate,
        eventBus: harness.eventBus ?? null,
        projectScope: harness.config.projectScope,
        environment: harness.config.environment,
        revision: harness.config.revision,
        audit: async (event) => {
          const correlation = event.traceId ?? `twm1.7:${event.workspaceId ?? 'unknown'}:${event.operation ?? 'configuration'}`;
          return harness.observability.record({
            eventClass: 'audit_event',
            channel: 'telemetry',
            stage: 'telegram-workspace-configuration',
            traceContext: { traceId: correlation, requestId: event.requestId ?? correlation, environment: harness.config.environment, revision: harness.config.revision },
            actorRef: event.actorGlobalUserId ?? null,
            outcome: event.outcome,
            reason: event.reason ?? null,
            data: {
              configurationEventClass: event.eventClass,
              operation: event.operation,
              workspaceId: event.workspaceId,
              namespace: event.namespace ?? null,
              version: event.version ?? null,
              previousVersion: event.previousVersion ?? null,
              targetVersion: event.targetVersion ?? null,
              risk: event.risk ?? null,
              confirmationRequired: event.confirmationRequired ?? null,
              changedPaths: event.changedPaths ?? null,
              gateOutcome: event.gateOutcome ?? null,
              eventEmitted: event.eventEmitted ?? null
            }
          });
        }
      })
    : null;

  const telegramWorkspaceNativeUi = telegramWorkspaceConfiguration && telegramUpdateStore.workspaceRegistry
    ? createTelegramWorkspaceNativeUi({
        botClient,
        identityResolver,
        workspaceRegistry: telegramUpdateStore.workspaceRegistry,
        authorityResolver: telegramWorkspaceAuthority,
        configurationService: telegramWorkspaceConfiguration,
        botCapabilityService: telegramBotCapabilities,
        projectScope: harness.config.projectScope,
        audit: async (event) => {
          const correlation = `twm1.8:${event.actorGlobalUserId ?? 'unknown'}:${event.action ?? 'ui'}`;
          return harness.observability.record({
            eventClass: 'audit_event',
            channel: 'telemetry',
            stage: 'telegram-workspace-native-ui',
            traceContext: { traceId: correlation, requestId: correlation, environment: harness.config.environment, revision: harness.config.revision },
            actorRef: event.actorGlobalUserId ?? null,
            outcome: event.outcome,
            reason: event.reason ?? null,
            data: { nativeUiEventClass: event.eventClass, action: event.action ?? null }
          });
        }
      })
    : null;

  const telegramWorkspaceNaturalLanguagePendingStore = telegramWorkspaceConfiguration && telegramUpdateStore.workspaceRegistry && harness.productionAI?.aiRouter
    ? createPostgresTelegramWorkspaceNaturalLanguagePendingStore(harness.persistence.database)
    : null;

  const telegramWorkspaceConfigurationNaturalLanguage = telegramWorkspaceNaturalLanguagePendingStore
    ? createTelegramWorkspaceNaturalLanguageService({
        aiRouter: harness.productionAI.aiRouter,
        botClient,
        identityResolver,
        workspaceRegistry: telegramUpdateStore.workspaceRegistry,
        authorityResolver: telegramWorkspaceAuthority,
        configurationService: telegramWorkspaceConfiguration,
        pendingStore: telegramWorkspaceNaturalLanguagePendingStore,
        projectScope: harness.config.projectScope,
        audit: async (event) => {
          const correlation = `twm1.9:${event.outcome ?? 'nl'}`;
          return harness.observability.record({
            eventClass: 'audit_event',
            channel: 'telemetry',
            stage: 'telegram-workspace-natural-language',
            traceContext: { traceId: correlation, requestId: correlation, environment: harness.config.environment, revision: harness.config.revision },
            outcome: event.outcome ?? 'unknown',
            data: { naturalLanguageEventClass: event.eventClass }
          });
        }
      })
    : null;

  const telegramWorkspaceOperationsNaturalLanguage = telegramWorkspaceNaturalLanguagePendingStore && telegramWorkspaceOperations?.service
    ? createTelegramWorkspaceOperationsNaturalLanguageService({
        aiRouter: harness.productionAI.aiRouter,
        botClient,
        identityResolver,
        workspaceRegistry: telegramUpdateStore.workspaceRegistry,
        authorityResolver: telegramWorkspaceAuthority,
        operationsService: telegramWorkspaceOperations.service,
        pendingStore: telegramWorkspaceNaturalLanguagePendingStore,
        projectScope: harness.config.projectScope,
        audit: async (event) => {
          const correlation = event.traceId ?? `twm1.14-1.15:${event.operation ?? 'operation'}`;
          return harness.observability.record({
            eventClass: 'audit_event',
            channel: 'audit',
            stage: 'telegram-workspace-operations-natural-language',
            traceContext: { traceId: correlation, requestId: event.requestId ?? correlation, environment: harness.config.environment, revision: harness.config.revision },
            actorRef: event.actorGlobalUserId ?? null,
            outcome: event.outcome ?? 'unknown',
            data: { operation: event.operation ?? null, workspaceId: event.workspaceId ?? null }
          });
        }
      })
    : null;

  const telegramWorkspaceNaturalLanguage = telegramWorkspaceConfigurationNaturalLanguage && telegramWorkspaceOperationsNaturalLanguage
    ? createTelegramWorkspaceUnifiedNaturalLanguageService({
        configurationNaturalLanguage: telegramWorkspaceConfigurationNaturalLanguage,
        operationsNaturalLanguage: telegramWorkspaceOperationsNaturalLanguage
      })
    : telegramWorkspaceConfigurationNaturalLanguage;

  const telegramWorkspaceMiniApp = telegramWorkspaceConfiguration && telegramUpdateStore.workspaceRegistry
    ? createTelegramWorkspaceMiniAppService({
        verifyInitData: (initData) => harness.credentialManager.useCredential({
          credentialId: telegramConfig.botTokenCredentialId,
          actor: harness.credentialAccessContext.actor,
          scope: harness.credentialAccessContext.scope,
          purpose: 'telegram.mini-app.verify-init-data',
          connectionId: 'telegram',
          operation: (botToken) => verifyTelegramMiniAppInitData(initData, botToken)
        }),
        identityResolver,
        workspaceRegistry: telegramUpdateStore.workspaceRegistry,
        authorityResolver: telegramWorkspaceAuthority,
        configurationService: telegramWorkspaceConfiguration,
        botCapabilityService: telegramBotCapabilities,
        projectScope: harness.config.projectScope,
        audit: async (event) => {
          const correlation = `twm1.13:${event.actorGlobalUserId ?? 'unknown'}:${event.action ?? 'mini-app'}`;
          return harness.observability.record({
            eventClass: 'audit_event',
            channel: 'telemetry',
            stage: 'telegram-workspace-mini-app',
            traceContext: { traceId: correlation, requestId: correlation, environment: harness.config.environment, revision: harness.config.revision },
            actorRef: event.actorGlobalUserId ?? null,
            outcome: event.outcome ?? 'unknown',
            reason: event.reason ?? null,
            data: {
              miniAppEventClass: event.eventClass,
              action: event.action ?? null,
              workspaceId: event.workspaceId ?? null,
              namespace: event.namespace ?? null,
              version: event.version ?? null,
              targetVersion: event.targetVersion ?? null,
              workspaceCount: event.workspaceCount ?? null
            }
          });
        }
      })
    : null;
  const telegramMiniAppHandler = telegramWorkspaceMiniApp
    ? createTelegramWorkspaceMiniAppHttpHandler({ service: telegramWorkspaceMiniApp, path: telegramConfig.miniAppPath })
    : null;

  const telegramWorkspaceRuntime = workspaceStore && telegramUpdateStore.workspaceRegistry
    ? createTelegramWorkspaceRuntimeWiring({
        runtime: harness.runtime,
        workspaceRegistry: telegramUpdateStore.workspaceRegistry,
        workspaceStore
      })
    : null;

  const integration = createTelegramProductionIntegration({
    credentialManager: harness.credentialManager,
    credentialAccessContext: harness.credentialAccessContext,
    webhookCredentialId: telegramConfig.webhookSecretCredentialId,
    botClient,
    deliveryRouter: deliveryDeployment.router,
    updateStore: telegramUpdateStore,
    identityResolver,
    runtime: harness.runtime,
    workspaceRuntime: telegramWorkspaceRuntime,
    nativeUi: telegramWorkspaceNativeUi,
    naturalLanguage: telegramWorkspaceNaturalLanguage,
    pollUpdates: telegramWorkspaceOperations?.pollUpdates ?? null,
    observability: harness.observability,
    botUserId: telegramConfig.botUserId,
    botUsername: telegramConfig.botUsername,
    environment: harness.config.environment,
    revision: harness.config.revision,
    acknowledgeBeforeProcessing: true
  });
  const telegramHandler = createTelegramWebhookHttpHandler({ integration, path: telegramConfig.webhookPath });

  const discordIntegration = discordConfig.enabled ? createDiscordProductionIntegration({
    restClient: discordRestClient,
    deliveryRouter: deliveryDeployment.router,
    eventStore: createPostgresDiscordEventStore(harness.persistence.database),
    identityResolver: discordIdentityResolver,
    runtime: harness.runtime,
    observability: harness.observability,
    botUserId: discordConfig.botUserId,
    environment: harness.config.environment,
    revision: harness.config.revision
  }) : null;

  const discordGateway = discordConfig.enabled ? createDiscordGatewayClient({
    restClient: discordRestClient,
    credentialManager: harness.credentialManager,
    credentialAccessContext: harness.credentialAccessContext,
    credentialId: discordConfig.botTokenCredentialId,
    intents: discordConfig.gatewayIntents,
    onDispatch: (dispatch) => discordIntegration.handleDispatch(dispatch),
    observability: harness.observability,
    readyTimeoutMs: discordConfig.gatewayReadyTimeoutMs,
    reconnectMinMs: discordConfig.reconnectMinMs,
    reconnectMaxMs: discordConfig.reconnectMaxMs
  }) : null;

  function discordHealth() {
    return discordGateway ? discordGateway.status() : Object.freeze({ phase: 'disabled', connected: false });
  }

  function automationHealth() {
    return automationWorker.health();
  }

  const requestHandler = async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      const runtimeHealth = harness.runtime.health();
      const discord = discordHealth();
      const automation = automationHealth();
      const ok = runtimeHealth.ok && automation.ok;
      json(response, ok ? 200 : 503, { ok, service: 'sg-2-1-web', runtime: runtimeHealth, automation, discord: { enabled: discordConfig.enabled, ...discord }, revision: harness.config.revision });
      return;
    }
    if (url.pathname === '/ready') {
      const runtimeReadiness = harness.runtime.readiness();
      const databaseHealth = harness.persistence.health();
      const discord = discordHealth();
      const automation = automationHealth();
      const discordReady = !discordConfig.enabled || discord.connected === true;
      const automationReady = !automationWorker.enabled || (automation.phase === 'ready' && automation.accepting === true);
      const ready = runtimeReadiness.ready && databaseHealth.started && discordReady && automationReady;
      json(response, ready ? 200 : 503, { ok: ready, service: 'sg-2-1-web', runtime: runtimeReadiness, database: { started: databaseHealth.started }, ai: { enabled: effectiveEnv.SG_AI_ENABLED === 'true', initialized: Boolean(harness.productionAI) }, automation: { enabled: automationWorker.enabled, ready: automationReady, ...automation }, discord: { enabled: discordConfig.enabled, ready: discordReady, ...discord }, revision: harness.config.revision });
      return;
    }
    if (telegramMiniAppHandler && await telegramMiniAppHandler(request, response)) return;
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
    let discordStarted = false;
    let automationStarted = false;
    try {
      await harness.runtime.start();
      runtimeStarted = true;
      if (discordConfig.enabled) {
        await bootstrapDiscordExternalConnection({
          connectionRegistry: harness.connectionRegistry,
          connectionAccessContext: harness.connectionAccessContext,
          credentialManager: harness.credentialManager,
          config: harness.config,
          applicationId: discordConfig.applicationId,
          botUserId: discordConfig.botUserId
        });
      }
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
      if (telegramWorkspaceMiniApp && envString(effectiveEnv, 'TELEGRAM_REGISTER_MINI_APP_MENU', 'true').toLowerCase() !== 'false') {
        try {
          await botClient.setChatMenuButton({ text: 'Управление', webAppUrl: telegramConfig.miniAppUrl });
        } catch (error) {
          try {
            await harness.observability.record({
              eventClass: 'error_event',
              channel: 'telemetry',
              stage: 'telegram-workspace-mini-app-menu',
              traceContext: { traceId: 'twm1.13:menu-registration', requestId: 'twm1.13:menu-registration', environment: harness.config.environment, revision: harness.config.revision },
              outcome: 'failure',
              reason: error?.code ?? 'twm-mini-app-menu-registration-failed',
              data: { miniAppUrlConfigured: true }
            });
          } catch {}
        }
      }
      await automationWorker.start();
      automationStarted = automationWorker.enabled;
      if (discordGateway) {
        await discordGateway.start();
        discordStarted = true;
      }
      return Object.freeze({ port, health: harness.runtime.health(), readiness: harness.runtime.readiness(), automation: automationHealth(), discord: discordHealth(), miniApp: { enabled: Boolean(telegramWorkspaceMiniApp), path: telegramConfig.miniAppPath }, workspaceOperations: { enabled: Boolean(telegramWorkspaceOperations), naturalLanguage: Boolean(telegramWorkspaceOperationsNaturalLanguage) }, revision: harness.config.revision });
    } catch (error) {
      if (automationStarted) {
        try { await automationWorker.stop(); } catch {}
      }
      if (discordStarted || discordGateway) {
        try { await discordGateway?.stop?.(); } catch {}
      }
      try { await closeServer(); } catch {}
      if (runtimeStarted) {
        try { await harness.runtime.stop(); } catch {}
      }
      throw error;
    }
  }

  async function stop() {
    await automationWorker.stop();
    await discordIntegration?.drainPending?.();
    await discordGateway?.stop?.();
    await integration.drainPending();
    await closeServer();
    await harness.runtime.stop();
  }

  return Object.freeze({
    effectiveEnv: publicEnvironmentView(effectiveEnv),
    harness,
    telegramIntegration: integration,
    telegramUpdateStore,
    telegramBotCapabilities,
    telegramWorkspaceAuthority,
    telegramWorkspaceMutationGate,
    telegramWorkspaceOperations,
    telegramWorkspaceConfiguration,
    telegramWorkspaceNativeUi,
    telegramWorkspaceConfigurationNaturalLanguage,
    telegramWorkspaceOperationsNaturalLanguage,
    telegramWorkspaceNaturalLanguage,
    telegramWorkspaceMiniApp,
    telegramMiniAppHandler,
    telegramWorkspaceRuntime,
    automationWorker,
    discordIntegration,
    discordGateway,
    discordRestClient,
    deliveryRouter: deliveryDeployment.router,
    deliveryStore: deliveryDeployment.store,
    deliveryTransportRegistry: deliveryDeployment.transportRegistry,
    requestHandler,
    start,
    stop
  });
}
