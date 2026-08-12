const SECRET_KEY = /(?:token|secret|password|api[_-]?key|private[_-]?key|credential|authorization|cookie)/i;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function bounded(value, fallback = 20, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.trunc(parsed), max));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function safeValue(value, seen = new WeakSet()) {
  if (Array.isArray(value)) return value.map((item) => safeValue(item, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    SECRET_KEY.test(key) ? '[REDACTED]' : safeValue(child, seen)
  ]));
}

function eventData(event) {
  return event && typeof event.data === 'object' && event.data ? event.data : {};
}

function latest(events, predicate) {
  return events.filter(predicate).sort((a, b) => String(b.occurredAt ?? '').localeCompare(String(a.occurredAt ?? '')))[0] ?? null;
}

function summarizeEvent(event) {
  if (!event) return null;
  const data = eventData(event);
  return freeze({
    occurredAt: event.occurredAt ?? null,
    outcome: event.outcome ?? null,
    reason: event.reason ?? null,
    operation: data.operation ?? data.requestedAction ?? null,
    namespace: data.namespace ?? null,
    version: data.version ?? null,
    traceId: event.traceContext?.traceId ?? null,
    requestId: event.traceContext?.requestId ?? null
  });
}

export const TELEGRAM_WORKSPACE_DIAGNOSTICS_CONTRACT_VERSION = 1;

export function createTelegramWorkspaceDiagnosticsObservabilityService({
  workspaceStore,
  authorityResolver,
  configurationService,
  botCapabilityService = null,
  observability = null,
  environment = 'production',
  revision = 'sg2.1',
  clock = () => new Date()
} = {}) {
  for (const method of ['getWorkspace']) if (typeof workspaceStore?.[method] !== 'function') throw new TypeError(`workspaceStore.${method} is required`);
  if (typeof authorityResolver?.verify !== 'function') throw new TypeError('authorityResolver.verify is required');
  for (const method of ['listConfigs', 'history', 'rollback']) if (typeof configurationService?.[method] !== 'function') throw new TypeError(`configurationService.${method} is required`);
  if (botCapabilityService !== null && typeof botCapabilityService?.getHealth !== 'function') throw new TypeError('botCapabilityService.getHealth is required');
  if (observability !== null && (typeof observability?.record !== 'function' || typeof observability?.list !== 'function')) throw new TypeError('observability record/list are required');

  const env = required(environment, 'environment');
  const rev = required(revision, 'revision');

  function generatedAt() {
    const date = new Date(clock()?.toISOString?.() ?? clock());
    if (Number.isNaN(date.getTime())) throw new TypeError('clock must return a valid time');
    return date.toISOString();
  }

  async function authorize({ workspaceId, actorGlobalUserId, telegramUserId, forceFresh = true }) {
    const decision = await authorityResolver.verify({
      workspaceId: required(workspaceId, 'workspaceId'),
      telegramUserId: required(String(telegramUserId ?? ''), 'telegramUserId'),
      expectedGlobalUserId: required(actorGlobalUserId, 'actorGlobalUserId'),
      requestedAction: 'workspace:view',
      forceFresh
    });
    if (!decision?.allowed) {
      const error = new Error('workspace diagnostics authority denied');
      error.code = decision?.reason ?? 'twm-workspace-diagnostics-authority-denied';
      throw error;
    }
    return decision;
  }

  function workspaceEvents(workspaceId) {
    if (!observability) return [];
    return observability.list({ eventClass: 'audit_event' }).filter((event) => {
      const data = eventData(event);
      return data.workspaceId === workspaceId || event.scopeRef === workspaceId;
    });
  }

  function metricsFor(events) {
    const configuration = events.filter((event) => event.stage === 'telegram-workspace-configuration');
    const authority = events.filter((event) => event.stage === 'telegram-workspace-authority');
    const actionGate = events.filter((event) => event.stage === 'telegram-workspace-action-gate');
    return freeze({
      configurationActions: configuration.length,
      configurationSuccesses: configuration.filter((event) => event.outcome === 'success').length,
      configurationFailures: configuration.filter((event) => event.outcome !== 'success').length,
      authorizationDenials: authority.filter((event) => event.outcome !== 'success').length,
      actionGateDenials: actionGate.filter((event) => event.outcome !== 'success').length
    });
  }

  async function history({ workspaceId, namespace, actorGlobalUserId, telegramUserId, limit = 20 } = {}) {
    const rows = await configurationService.history({
      workspaceId,
      namespace,
      actorGlobalUserId,
      telegramUserId,
      limit: bounded(limit, 20, 100)
    });
    return freeze(rows.map((row) => ({
      version: Number(row.version),
      who: row.actor_global_user_id ?? null,
      what: freeze({ namespace: row.namespace ?? namespace, reason: row.reason ?? null }),
      when: row.created_at ?? null,
      before: safeValue(row.previous_config ?? null),
      after: safeValue(row.new_config ?? null),
      traceId: row.trace_id ?? null
    })));
  }

  async function rollback(input = {}) {
    return configurationService.rollback(input);
  }

  async function health({ workspaceId, actorGlobalUserId, telegramUserId, requireFresh = true, traceId = null, requestId = null } = {}) {
    const canonicalWorkspaceId = required(workspaceId, 'workspaceId');
    const authority = await authorize({ workspaceId: canonicalWorkspaceId, actorGlobalUserId, telegramUserId, forceFresh: requireFresh });
    const [workspace, configs, bot] = await Promise.all([
      workspaceStore.getWorkspace(canonicalWorkspaceId),
      configurationService.listConfigs({ workspaceId: canonicalWorkspaceId, actorGlobalUserId, telegramUserId }),
      botCapabilityService ? botCapabilityService.getHealth({ workspaceId: canonicalWorkspaceId, requireFresh }) : Promise.resolve(null)
    ]);
    if (!workspace) {
      const error = new Error('workspace not found');
      error.code = 'twm-workspace-not-found';
      throw error;
    }

    const events = workspaceEvents(canonicalWorkspaceId);
    const latestSuccess = latest(events, (event) => event.stage === 'telegram-workspace-configuration' && event.outcome === 'success');
    const latestFailure = latest(events, (event) => event.stage === 'telegram-workspace-configuration' && event.outcome !== 'success');
    const configVersions = Object.fromEntries(configs.map((row) => [row.namespace, Number(row.version ?? 0)]));
    const connectionState = bot?.status === 'disconnected' ? 'disconnected' : workspace.lifecycleState === 'active' ? 'connected' : 'degraded';
    const reasons = [];
    if (connectionState !== 'connected') reasons.push(bot?.reason ?? `workspace-${workspace.lifecycleState ?? 'unknown'}`);
    if (bot && bot.status !== 'healthy') reasons.push(bot.reason ?? bot.status);
    const status = reasons.length ? 'degraded' : 'healthy';
    const report = freeze({
      contractVersion: TELEGRAM_WORKSPACE_DIAGNOSTICS_CONTRACT_VERSION,
      kind: 'TelegramWorkspaceDiagnostics',
      workspaceId: canonicalWorkspaceId,
      status,
      ok: status === 'healthy',
      generatedAt: generatedAt(),
      connection: freeze({ state: connectionState, lifecycleState: workspace.lifecycleState ?? null, botMembershipState: workspace.botMembershipState ?? null }),
      authority: freeze({ state: authority.allowed ? 'authorized' : 'denied', role: authority.workspaceRole ?? null, verificationTime: authority.verificationTime ?? null, reason: authority.reason ?? null }),
      botPermissions: bot ? freeze({ status: bot.status, available: bot.available === true, reason: bot.reason ?? null, missingCapabilities: bot.missingCapabilities ?? [], missingPermissions: bot.missingPermissions ?? [], fetchedAt: bot.fetchedAt ?? null }) : freeze({ status: 'unavailable', available: false, reason: 'bot-capability-service-not-configured', missingCapabilities: [], missingPermissions: [], fetchedAt: null }),
      configuration: freeze({ namespaceCount: configs.length, versions: configVersions, maxVersion: Math.max(0, ...Object.values(configVersions)) }),
      degradedReasons: freeze([...new Set(reasons.filter(Boolean))]),
      lastMutation: freeze({ success: summarizeEvent(latestSuccess), failure: summarizeEvent(latestFailure) }),
      metrics: metricsFor(events)
    });

    if (observability) {
      const correlation = traceId ?? `twm1.11:${canonicalWorkspaceId}:diagnostics`;
      observability.record({
        eventClass: 'audit_event',
        channel: 'telemetry',
        stage: 'telegram-workspace-diagnostics',
        traceContext: { traceId: correlation, requestId: requestId ?? correlation, environment: env, revision: rev },
        actorRef: actorGlobalUserId,
        scopeRef: canonicalWorkspaceId,
        outcome: status === 'healthy' ? 'success' : 'degraded',
        reason: report.degradedReasons[0] ?? null,
        data: {
          diagnosticsEventClass: 'telegram_workspace_diagnostics',
          workspaceId: canonicalWorkspaceId,
          status,
          connectionState,
          botPermissionStatus: report.botPermissions.status,
          configurationNamespaceCount: configs.length,
          authorizationDenials: report.metrics.authorizationDenials,
          actionGateDenials: report.metrics.actionGateDenials
        }
      });
    }
    return report;
  }

  return Object.freeze({ history, rollback, health });
}
