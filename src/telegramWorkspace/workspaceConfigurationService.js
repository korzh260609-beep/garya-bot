import { randomUUID } from 'node:crypto';
import {
  TELEGRAM_WORKSPACE_CONFIG_NAMESPACES,
  telegramWorkspaceConfigNamespace
} from './workspaceContract.js';
import { assertWorkspaceConfigContainsNoSecrets } from './postgresWorkspaceStore.js';

export const TELEGRAM_WORKSPACE_CONFIGURATION_NAMESPACES = Object.freeze([
  'general',
  'responses',
  'moderation',
  'memory',
  'ai',
  'publication',
  'automation',
  'notifications',
  'members'
]);

const MANAGED_NAMESPACE_SET = new Set(TELEGRAM_WORKSPACE_CONFIGURATION_NAMESPACES);
const RISK_ORDER = Object.freeze(['low', 'medium', 'high', 'critical']);
const NAMESPACE_RISK = Object.freeze({
  general: 'low',
  responses: 'low',
  moderation: 'medium',
  memory: 'low',
  ai: 'low',
  publication: 'medium',
  automation: 'medium',
  notifications: 'low',
  members: 'high'
});
const MAX_CONFIG_BYTES = 32 * 1024;
const MAX_CONFIG_DEPTH = 8;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 128;
const MAX_STRING_LENGTH = 4096;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${name} must be a plain object`);
  }
  return value;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function clone(value) { return value == null ? value : structuredClone(value); }
function fail(message, code, details = null) {
  const error = new TelegramWorkspaceConfigurationError(message, code, details);
  throw error;
}
function managedNamespace(value) {
  const name = required(value, 'namespace');
  telegramWorkspaceConfigNamespace(name);
  if (!MANAGED_NAMESPACE_SET.has(name)) fail(`workspace configuration namespace is reserved for a later TWM stage: ${name}`, 'twm-workspace-config-namespace-not-managed');
  return name;
}
function assertBooleanIfPresent(object, key, path) {
  if (object[key] !== undefined && typeof object[key] !== 'boolean') fail(`${path}.${key} must be boolean`, 'twm-workspace-config-schema-invalid');
}
function assertStringIfPresent(object, key, path, maxLength = 128) {
  if (object[key] === undefined) return;
  if (typeof object[key] !== 'string' || object[key].trim() === '' || object[key].length > maxLength) {
    fail(`${path}.${key} must be a non-empty string of at most ${maxLength} characters`, 'twm-workspace-config-schema-invalid');
  }
}
function assertEnabledObjectIfPresent(object, key, path) {
  if (object[key] === undefined) return;
  plainObject(object[key], `${path}.${key}`);
  assertBooleanIfPresent(object[key], 'enabled', `${path}.${key}`);
}
function validateJsonValue(value, path = 'config', depth = 0) {
  if (depth > MAX_CONFIG_DEPTH) fail(`${path} exceeds maximum nesting depth`, 'twm-workspace-config-schema-invalid');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${path} must be a finite number`, 'twm-workspace-config-schema-invalid');
    return;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) fail(`${path} exceeds maximum string length`, 'twm-workspace-config-schema-invalid');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) fail(`${path} has too many array items`, 'twm-workspace-config-schema-invalid');
    value.forEach((item, index) => validateJsonValue(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${path} contains a non-JSON value`, 'twm-workspace-config-schema-invalid');
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_OBJECT_KEYS) fail(`${path} has too many keys`, 'twm-workspace-config-schema-invalid');
  for (const [key, nested] of entries) {
    if (key.trim() === '' || key.length > 128) fail(`${path} contains an invalid key`, 'twm-workspace-config-schema-invalid');
    validateJsonValue(nested, `${path}.${key}`, depth + 1);
  }
}
function validateKnownFields(namespace, config) {
  assertBooleanIfPresent(config, 'enabled', `workspace.${namespace}`);
  if (namespace === 'responses') {
    assertStringIfPresent(config, 'mode', 'workspace.responses', 64);
    assertBooleanIfPresent(config, 'reply_enabled', 'workspace.responses');
  }
  if (namespace === 'moderation') {
    if (config.warning_limit !== undefined && (!Number.isInteger(config.warning_limit) || config.warning_limit < 1 || config.warning_limit > 100)) {
      fail('workspace.moderation.warning_limit must be an integer from 1 to 100', 'twm-workspace-config-schema-invalid');
    }
    assertEnabledObjectIfPresent(config, 'spam', 'workspace.moderation');
    assertEnabledObjectIfPresent(config, 'links', 'workspace.moderation');
    assertEnabledObjectIfPresent(config, 'flood', 'workspace.moderation');
  }
  if (namespace === 'publication') assertBooleanIfPresent(config, 'preview_before_publish', 'workspace.publication');
}
export function validateTelegramWorkspaceConfiguration(namespaceValue, configValue) {
  const namespace = managedNamespace(namespaceValue);
  const config = plainObject(configValue, `workspace.${namespace}`);
  assertWorkspaceConfigContainsNoSecrets(config);
  validateJsonValue(config);
  const bytes = Buffer.byteLength(JSON.stringify(config), 'utf8');
  if (bytes > MAX_CONFIG_BYTES) fail(`workspace.${namespace} exceeds ${MAX_CONFIG_BYTES} bytes`, 'twm-workspace-config-schema-invalid');
  validateKnownFields(namespace, config);
  return freeze(clone(config));
}
function compareValue(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function changedPaths(before, after, prefix = '') {
  if (compareValue(before, after)) return [];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) return [prefix || '$'];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const result = [];
  for (const key of keys) result.push(...changedPaths(before[key], after[key], prefix ? `${prefix}.${key}` : key));
  return result;
}
function riskFor(namespace, operation = 'apply') {
  const risk = operation === 'rollback' ? 'medium' : NAMESPACE_RISK[namespace];
  return freeze({
    risk,
    confirmationRequired: RISK_ORDER.indexOf(risk) >= RISK_ORDER.indexOf('medium'),
    operation
  });
}
function configRowOrDefault({ workspaceId, namespace, row }) {
  if (row) return row;
  return freeze({ workspaceId, namespace, config: freeze({}), version: 0, updatedByGlobalUserId: null, traceId: null, updatedAt: null });
}
function historyValue(row, camel, snake) { return row?.[camel] ?? row?.[snake] ?? null; }
function publicAuthority(decision) {
  return freeze({ allowed: decision.allowed, reason: decision.reason, workspaceRole: decision.workspaceRole ?? null, verificationTime: decision.verificationTime ?? null });
}

export class TelegramWorkspaceConfigurationError extends Error {
  constructor(message, code = 'twm-workspace-configuration-error', details = null) {
    super(message);
    this.name = 'TelegramWorkspaceConfigurationError';
    this.code = code;
    this.details = details;
  }
}

export function createTelegramWorkspaceConfigurationService({
  workspaceStore,
  authorityResolver,
  eventBus = null,
  projectScope = 'sg2.1',
  environment = null,
  revision = null,
  idFactory = () => `twc_${randomUUID()}`,
  audit = async () => {}
} = {}) {
  for (const method of ['getConfig', 'listConfigs', 'setConfig', 'configHistory']) {
    if (typeof workspaceStore?.[method] !== 'function') throw new TypeError(`workspaceStore.${method} is required`);
  }
  if (typeof authorityResolver?.verify !== 'function') throw new TypeError('authorityResolver.verify is required');
  if (eventBus !== null && typeof eventBus?.publish !== 'function') throw new TypeError('eventBus.publish is required');
  const project = required(projectScope, 'projectScope');
  if (typeof idFactory !== 'function' || typeof audit !== 'function') throw new TypeError('invalid workspace configuration service dependency');

  async function emitAudit(event) {
    try { await audit(freeze({ eventClass: 'telegram_workspace_configuration', ...event })); } catch {}
  }
  async function emitMutationEvent({ operation, workspaceId, namespace, actorGlobalUserId, traceId, version, previousVersion, risk, confirmationRequired, paths }) {
    if (!eventBus) return false;
    try {
      await eventBus.publish({
        eventType: 'resource.updated',
        traceContext: { traceId, requestId: traceId, environment, revision },
        scope: { projectScope: project, globalUserId: actorGlobalUserId, resourceId: workspaceId },
        actorGlobalUserId,
        privacyClass: 'internal',
        orderingKey: `workspace-config:${workspaceId}:${namespace}`,
        provenance: { source: 'twm1.6', operation },
        payload: { updateKind: 'workspace_configuration', operation, namespace, version, previousVersion, risk, confirmationRequired, changedPaths: paths }
      });
      return true;
    } catch {
      return false;
    }
  }
  async function authorize({ workspaceId, actorGlobalUserId, telegramUserId, requestedAction, forceFresh }) {
    const decision = await authorityResolver.verify({
      workspaceId: required(workspaceId, 'workspaceId'),
      telegramUserId: required(String(telegramUserId), 'telegramUserId'),
      expectedGlobalUserId: required(actorGlobalUserId, 'actorGlobalUserId'),
      requestedAction,
      forceFresh
    });
    if (!decision?.allowed) {
      await emitAudit({ operation: 'authorize', outcome: 'deny', workspaceId, actorGlobalUserId, requestedAction, reason: decision?.reason ?? 'twm-workspace-config-authority-denied' });
      fail('workspace configuration authority denied', decision?.reason ?? 'twm-workspace-config-authority-denied', publicAuthority(decision ?? { allowed: false, reason: 'unknown' }));
    }
    return decision;
  }
  async function getConfig({ workspaceId, namespace, actorGlobalUserId, telegramUserId } = {}) {
    const name = managedNamespace(namespace);
    await authorize({ workspaceId, actorGlobalUserId, telegramUserId, requestedAction: 'workspace:view', forceFresh: false });
    return configRowOrDefault({ workspaceId, namespace: name, row: await workspaceStore.getConfig({ workspaceId, namespace: name }) });
  }
  async function listConfigs({ workspaceId, actorGlobalUserId, telegramUserId } = {}) {
    await authorize({ workspaceId, actorGlobalUserId, telegramUserId, requestedAction: 'workspace:view', forceFresh: false });
    const rows = await workspaceStore.listConfigs({ workspaceId });
    return freeze(rows.filter((row) => MANAGED_NAMESPACE_SET.has(row.namespace)));
  }
  async function proposeChange({ workspaceId, namespace, nextConfig, actorGlobalUserId, telegramUserId, traceId, reason = null } = {}) {
    const name = managedNamespace(namespace);
    const trace = required(traceId, 'traceId');
    const actor = required(actorGlobalUserId, 'actorGlobalUserId');
    const validated = validateTelegramWorkspaceConfiguration(name, nextConfig);
    const authority = await authorize({ workspaceId, actorGlobalUserId: actor, telegramUserId, requestedAction: 'workspace:configure', forceFresh: true });
    const current = configRowOrDefault({ workspaceId, namespace: name, row: await workspaceStore.getConfig({ workspaceId, namespace: name }) });
    const paths = changedPaths(current.config, validated);
    if (paths.length === 0) fail('workspace configuration proposal contains no changes', 'twm-workspace-config-noop');
    const classification = riskFor(name, 'apply');
    const proposal = freeze({
      kind: 'telegram-workspace-config-proposal',
      proposalId: idFactory(),
      workspaceId: required(workspaceId, 'workspaceId'),
      namespace: name,
      actorGlobalUserId: actor,
      traceId: trace,
      reason: reason == null ? null : String(reason).slice(0, 500),
      baseVersion: current.version,
      nextConfig: validated,
      changedPaths: freeze(paths),
      risk: classification.risk,
      confirmationRequired: classification.confirmationRequired,
      authority: publicAuthority(authority)
    });
    await emitAudit({ operation: 'propose', outcome: 'success', workspaceId: proposal.workspaceId, namespace: name, actorGlobalUserId: actor, traceId: trace, baseVersion: current.version, risk: proposal.risk, confirmationRequired: proposal.confirmationRequired, changedPaths: proposal.changedPaths });
    return proposal;
  }
  async function applyProposal({ proposal, actorGlobalUserId, telegramUserId, confirmed = false } = {}) {
    plainObject(proposal, 'proposal');
    if (proposal.kind !== 'telegram-workspace-config-proposal') fail('unsupported workspace configuration proposal', 'twm-workspace-config-proposal-invalid');
    const actor = required(actorGlobalUserId, 'actorGlobalUserId');
    if (actor !== proposal.actorGlobalUserId) fail('workspace configuration proposal actor mismatch', 'twm-workspace-config-proposal-actor-mismatch');
    const name = managedNamespace(proposal.namespace);
    const validated = validateTelegramWorkspaceConfiguration(name, proposal.nextConfig);
    const paths = changedPaths((await workspaceStore.getConfig({ workspaceId: proposal.workspaceId, namespace: name }))?.config ?? {}, validated);
    const classification = riskFor(name, 'apply');
    if (classification.confirmationRequired && confirmed !== true) fail('workspace configuration confirmation required', 'twm-workspace-config-confirmation-required', classification);
    await authorize({ workspaceId: proposal.workspaceId, actorGlobalUserId: actor, telegramUserId, requestedAction: 'workspace:configure', forceFresh: true });
    let applied;
    try {
      applied = await workspaceStore.setConfig({
        workspaceId: proposal.workspaceId,
        namespace: name,
        config: validated,
        actorGlobalUserId: actor,
        traceId: required(proposal.traceId, 'proposal.traceId'),
        expectedVersion: Number(proposal.baseVersion),
        reason: proposal.reason ?? 'twm1.6 configuration apply'
      });
    } catch (error) {
      await emitAudit({ operation: 'apply', outcome: 'failure', workspaceId: proposal.workspaceId, namespace: name, actorGlobalUserId: actor, traceId: proposal.traceId, reason: error?.code ?? 'workspace-config-write-failed' });
      throw error;
    }
    const eventEmitted = await emitMutationEvent({ operation: 'apply', workspaceId: proposal.workspaceId, namespace: name, actorGlobalUserId: actor, traceId: proposal.traceId, version: applied.version, previousVersion: Number(proposal.baseVersion), risk: classification.risk, confirmationRequired: classification.confirmationRequired, paths });
    await emitAudit({ operation: 'apply', outcome: 'success', workspaceId: proposal.workspaceId, namespace: name, actorGlobalUserId: actor, traceId: proposal.traceId, version: applied.version, previousVersion: Number(proposal.baseVersion), risk: classification.risk, confirmationRequired: classification.confirmationRequired, changedPaths: paths, eventEmitted });
    return freeze({ config: applied, risk: classification.risk, confirmationRequired: classification.confirmationRequired, eventEmitted });
  }
  async function applyChange(input = {}) {
    const proposal = await proposeChange(input);
    return applyProposal({ proposal, actorGlobalUserId: input.actorGlobalUserId, telegramUserId: input.telegramUserId, confirmed: input.confirmed === true });
  }
  async function history({ workspaceId, namespace, actorGlobalUserId, telegramUserId, limit = 100 } = {}) {
    const name = managedNamespace(namespace);
    await authorize({ workspaceId, actorGlobalUserId, telegramUserId, requestedAction: 'workspace:view', forceFresh: false });
    return workspaceStore.configHistory({ workspaceId, namespace: name, limit });
  }
  async function rollback({ workspaceId, namespace, targetVersion, actorGlobalUserId, telegramUserId, traceId, reason = null, confirmed = false } = {}) {
    const name = managedNamespace(namespace);
    const target = Number(targetVersion);
    if (!Number.isInteger(target) || target < 1) fail('targetVersion must be a positive integer', 'twm-workspace-config-rollback-version-invalid');
    const actor = required(actorGlobalUserId, 'actorGlobalUserId');
    const trace = required(traceId, 'traceId');
    const classification = riskFor(name, 'rollback');
    if (classification.confirmationRequired && confirmed !== true) fail('workspace configuration rollback confirmation required', 'twm-workspace-config-confirmation-required', classification);
    await authorize({ workspaceId, actorGlobalUserId: actor, telegramUserId, requestedAction: 'workspace:configure', forceFresh: true });
    const current = configRowOrDefault({ workspaceId, namespace: name, row: await workspaceStore.getConfig({ workspaceId, namespace: name }) });
    if (current.version === 0) fail('workspace configuration does not exist', 'twm-workspace-config-not-found');
    if (current.version === target) fail('rollback target is already current', 'twm-workspace-config-noop');
    const rows = await workspaceStore.configHistory({ workspaceId, namespace: name, limit: 500 });
    const targetRow = rows.find((row) => Number(historyValue(row, 'version', 'version')) === target);
    if (!targetRow) fail('rollback target version is not available in bounded history', 'twm-workspace-config-rollback-version-not-found');
    const targetConfig = validateTelegramWorkspaceConfiguration(name, historyValue(targetRow, 'newConfig', 'new_config'));
    const paths = changedPaths(current.config, targetConfig);
    const applied = await workspaceStore.setConfig({
      workspaceId,
      namespace: name,
      config: targetConfig,
      actorGlobalUserId: actor,
      traceId: trace,
      expectedVersion: current.version,
      reason: reason == null ? `rollback-to-version:${target}` : String(reason).slice(0, 500)
    });
    const eventEmitted = await emitMutationEvent({ operation: 'rollback', workspaceId, namespace: name, actorGlobalUserId: actor, traceId: trace, version: applied.version, previousVersion: current.version, risk: classification.risk, confirmationRequired: true, paths });
    await emitAudit({ operation: 'rollback', outcome: 'success', workspaceId, namespace: name, actorGlobalUserId: actor, traceId: trace, version: applied.version, previousVersion: current.version, targetVersion: target, risk: classification.risk, confirmationRequired: true, changedPaths: paths, eventEmitted });
    return freeze({ config: applied, rolledBackToVersion: target, risk: classification.risk, confirmationRequired: true, eventEmitted });
  }

  return Object.freeze({
    getConfig,
    listConfigs,
    proposeChange,
    applyProposal,
    applyChange,
    history,
    rollback,
    validate: validateTelegramWorkspaceConfiguration,
    namespaces: TELEGRAM_WORKSPACE_CONFIGURATION_NAMESPACES
  });
}

export const TELEGRAM_WORKSPACE_PERSISTENCE_NAMESPACES = TELEGRAM_WORKSPACE_CONFIG_NAMESPACES;
