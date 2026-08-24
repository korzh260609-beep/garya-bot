export const TELEGRAM_WORKSPACE_PRODUCTION_ACCEPTANCE_VERSION = 'twm1.12';

export const TELEGRAM_WORKSPACE_ACCEPTANCE_SCENARIOS = Object.freeze({
  group: Object.freeze([
    'new-user',
    'workspace-added',
    'workspace-discovered',
    'authority-verified',
    'bot-permissions-verified',
    'setup-completed',
    'config-saved',
    'runtime-behavior-changed',
    'restart-preserved-config',
    'ordinary-member-denied',
    'admin-mutation-allowed',
    'admin-rights-lost',
    'mutation-denied-after-rights-loss',
    'second-workspace-isolated',
    'audit-history-correct'
  ]),
  channel: Object.freeze([
    'new-user',
    'workspace-added',
    'workspace-discovered',
    'authority-verified',
    'bot-permissions-verified',
    'setup-completed',
    'publication-config-saved',
    'publication-behavior-changed',
    'restart-preserved-config',
    'ordinary-member-denied',
    'admin-mutation-allowed',
    'admin-rights-lost',
    'mutation-denied-after-rights-loss',
    'second-workspace-isolated',
    'audit-history-correct'
  ])
});

const LIVE_SOURCE = 'telegram-production';

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = Object.freeze({ ...details });
  throw error;
}

function normalized(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function assertOpaqueId(value, field) {
  const text = normalized(value);
  if (!text || text.length < 3) fail('twm1.12-invalid-evidence', `${field} is required`, { field });
  return text;
}

function assertTimestamp(value, field) {
  const text = normalized(value);
  if (!text || Number.isNaN(Date.parse(text))) fail('twm1.12-invalid-evidence', `${field} must be an ISO timestamp`, { field });
  return text;
}

function assertObservation(observation, scenario, step, index) {
  if (!observation || typeof observation !== 'object') {
    fail('twm1.12-missing-observation', `Missing live observation for ${scenario}:${step}`, { scenario, step, index });
  }
  if (observation.step !== step) {
    fail('twm1.12-step-order-mismatch', `Expected ${scenario}:${step}`, {
      scenario,
      expected: step,
      actual: observation.step ?? null,
      index
    });
  }
  if (observation.source !== LIVE_SOURCE) {
    fail('twm1.12-non-live-evidence', `Acceptance evidence must come from ${LIVE_SOURCE}`, {
      scenario,
      step,
      source: observation.source ?? null
    });
  }
  if (observation.passed !== true) {
    fail('twm1.12-step-failed', `Live acceptance step failed: ${scenario}:${step}`, {
      scenario,
      step,
      reason: observation.reason ?? null
    });
  }

  const timestamp = assertTimestamp(observation.timestamp, `${scenario}.${step}.timestamp`);
  const traceId = assertOpaqueId(observation.traceId, `${scenario}.${step}.traceId`);
  const requestId = assertOpaqueId(observation.requestId, `${scenario}.${step}.requestId`);

  return Object.freeze({
    step,
    source: LIVE_SOURCE,
    passed: true,
    timestamp,
    traceId,
    requestId,
    workspaceId: normalized(observation.workspaceId) || null,
    telegramChatId: normalized(observation.telegramChatId) || null,
    actorGlobalUserId: normalized(observation.actorGlobalUserId) || null,
    configVersion: Number.isInteger(observation.configVersion) ? observation.configVersion : null,
    reason: normalized(observation.reason) || null
  });
}

function validateScenario(name, manifest) {
  const expected = TELEGRAM_WORKSPACE_ACCEPTANCE_SCENARIOS[name];
  if (!manifest || typeof manifest !== 'object') {
    fail('twm1.12-missing-scenario', `Missing ${name} acceptance manifest`, { scenario: name });
  }
  const observations = Array.isArray(manifest.observations) ? manifest.observations : [];
  if (observations.length !== expected.length) {
    fail('twm1.12-incomplete-scenario', `${name} acceptance requires ${expected.length} observations`, {
      scenario: name,
      expected: expected.length,
      actual: observations.length
    });
  }

  const checked = expected.map((step, index) => assertObservation(observations[index], name, step, index));
  const workspaceIds = new Set(checked.map((entry) => entry.workspaceId).filter(Boolean));
  const telegramChatIds = new Set(checked.map((entry) => entry.telegramChatId).filter(Boolean));

  if (workspaceIds.size < 2) {
    fail('twm1.12-isolation-evidence-missing', `${name} acceptance must prove a second isolated workspace`, {
      scenario: name,
      workspaceIds: [...workspaceIds]
    });
  }
  if (telegramChatIds.size < 2) {
    fail('twm1.12-isolation-evidence-missing', `${name} acceptance must include two distinct Telegram chats`, {
      scenario: name,
      telegramChatIds: [...telegramChatIds]
    });
  }

  const primaryWorkspaceId = assertOpaqueId(manifest.primaryWorkspaceId, `${name}.primaryWorkspaceId`);
  const isolatedWorkspaceId = assertOpaqueId(manifest.isolatedWorkspaceId, `${name}.isolatedWorkspaceId`);
  if (primaryWorkspaceId === isolatedWorkspaceId) {
    fail('twm1.12-isolation-evidence-invalid', `${name} primary and isolated workspace IDs must differ`, { scenario: name });
  }
  if (!workspaceIds.has(primaryWorkspaceId) || !workspaceIds.has(isolatedWorkspaceId)) {
    fail('twm1.12-isolation-evidence-invalid', `${name} workspace IDs are not represented by live observations`, {
      scenario: name,
      primaryWorkspaceId,
      isolatedWorkspaceId
    });
  }

  return Object.freeze({
    scenario: name,
    primaryWorkspaceId,
    isolatedWorkspaceId,
    observations: Object.freeze(checked),
    passed: true
  });
}

function assertCrossScenarioIsolation(group, channel) {
  const ids = [
    group.primaryWorkspaceId,
    group.isolatedWorkspaceId,
    channel.primaryWorkspaceId,
    channel.isolatedWorkspaceId
  ];
  if (new Set(ids).size !== ids.length) {
    fail('twm1.12-cross-workspace-isolation-invalid', 'Group and channel acceptance workspaces must be distinct', { workspaceIds: ids });
  }
}

export function createTelegramWorkspaceProductionAcceptance({
  revisionProvider = () => process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
  environmentProvider = () => process.env.NODE_ENV || 'unknown'
} = {}) {
  return Object.freeze({
    async verify(manifest = {}) {
      const revision = normalized(manifest.revision) || normalized(await revisionProvider());
      if (!revision) fail('twm1.12-revision-required', 'Production acceptance must be bound to a deployed revision');
      const environment = normalized(manifest.environment) || normalized(await environmentProvider());
      if (environment !== 'production') {
        fail('twm1.12-production-required', 'TWM1.12 live acceptance must run against production', { environment });
      }
      const executedAt = assertTimestamp(manifest.executedAt, 'executedAt');
      const group = validateScenario('group', manifest.group);
      const channel = validateScenario('channel', manifest.channel);
      assertCrossScenarioIsolation(group, channel);

      return Object.freeze({
        version: TELEGRAM_WORKSPACE_PRODUCTION_ACCEPTANCE_VERSION,
        status: 'passed',
        source: LIVE_SOURCE,
        environment,
        revision,
        executedAt,
        group,
        channel
      });
    }
  });
}
