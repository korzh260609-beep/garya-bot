import { randomUUID } from 'node:crypto';

export const TELEGRAM_WORKSPACE_PLATFORM = 'telegram';

export const TELEGRAM_WORKSPACE_TYPES = Object.freeze([
  'group',
  'supergroup',
  'channel'
]);

export const TELEGRAM_WORKSPACE_LIFECYCLE = Object.freeze([
  'DISCOVERED',
  'CONNECTED',
  'CONFIGURING',
  'ACTIVE',
  'DEGRADED',
  'DISCONNECTED',
  'REVOKED'
]);

export const TELEGRAM_WORKSPACE_ROLES = Object.freeze([
  'OWNER',
  'ADMIN',
  'EDITOR',
  'MODERATOR',
  'VIEWER'
]);

export const TELEGRAM_WORKSPACE_CONFIG_NAMESPACES = Object.freeze([
  'general',
  'responses',
  'moderation',
  'memory',
  'ai',
  'publication',
  'content',
  'polls',
  'media',
  'automation',
  'notifications',
  'members'
]);

const LIFECYCLE_TRANSITIONS = Object.freeze({
  DISCOVERED: Object.freeze(['CONNECTED', 'DISCONNECTED', 'REVOKED']),
  CONNECTED: Object.freeze(['CONFIGURING', 'ACTIVE', 'DEGRADED', 'DISCONNECTED', 'REVOKED']),
  CONFIGURING: Object.freeze(['CONNECTED', 'ACTIVE', 'DEGRADED', 'DISCONNECTED', 'REVOKED']),
  ACTIVE: Object.freeze(['CONFIGURING', 'DEGRADED', 'DISCONNECTED', 'REVOKED']),
  DEGRADED: Object.freeze(['CONFIGURING', 'ACTIVE', 'DISCONNECTED', 'REVOKED']),
  DISCONNECTED: Object.freeze(['CONNECTED', 'REVOKED']),
  REVOKED: Object.freeze([])
});

function invariant(condition, message, code) {
  if (condition) return;
  const error = new Error(message);
  error.code = code;
  throw error;
}

function nonEmptyString(value, field) {
  invariant(typeof value === 'string' && value.trim().length > 0, `${field} is required`, 'twm-workspace-contract-invalid');
  return value.trim();
}

function nullableString(value, field) {
  if (value === null || value === undefined || value === '') return null;
  invariant(typeof value === 'string', `${field} must be a string or null`, 'twm-workspace-contract-invalid');
  return value.trim() || null;
}

function normalizeTelegramChatId(value) {
  invariant(
    (typeof value === 'string' && /^-?\d+$/.test(value.trim())) || Number.isSafeInteger(value),
    'telegramChatId must be an integer-compatible Telegram chat id',
    'twm-workspace-contract-invalid'
  );
  return String(value).trim();
}

function normalizeDate(value, field, clock) {
  const raw = value ?? clock().toISOString();
  const date = raw instanceof Date ? raw : new Date(raw);
  invariant(!Number.isNaN(date.getTime()), `${field} must be a valid timestamp`, 'twm-workspace-contract-invalid');
  return date.toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function normalizeWorkspaceId(value, idFactory) {
  const workspaceId = value ?? `tgw_${idFactory().replaceAll('-', '')}`;
  invariant(/^tgw_[a-zA-Z0-9_-]{8,}$/.test(workspaceId), 'workspaceId must be an SG-issued tgw_* identifier', 'twm-workspace-contract-invalid');
  return workspaceId;
}

export function createTelegramWorkspace(input, { clock = () => new Date(), idFactory = randomUUID } = {}) {
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'workspace input is required', 'twm-workspace-contract-invalid');

  const workspaceType = nonEmptyString(input.workspaceType, 'workspaceType');
  invariant(TELEGRAM_WORKSPACE_TYPES.includes(workspaceType), `unsupported workspaceType: ${workspaceType}`, 'twm-workspace-type-unsupported');

  const lifecycleState = input.lifecycleState ?? 'DISCOVERED';
  invariant(TELEGRAM_WORKSPACE_LIFECYCLE.includes(lifecycleState), `unsupported lifecycleState: ${lifecycleState}`, 'twm-workspace-lifecycle-invalid');

  const createdAt = normalizeDate(input.createdAt, 'createdAt', clock);
  const updatedAt = normalizeDate(input.updatedAt ?? createdAt, 'updatedAt', clock);
  invariant(new Date(updatedAt) >= new Date(createdAt), 'updatedAt cannot be earlier than createdAt', 'twm-workspace-contract-invalid');

  const workspace = {
    workspaceId: normalizeWorkspaceId(input.workspaceId, idFactory),
    platform: TELEGRAM_WORKSPACE_PLATFORM,
    telegramChatId: normalizeTelegramChatId(input.telegramChatId),
    workspaceType,
    title: nullableString(input.title, 'title'),
    username: nullableString(input.username, 'username'),
    lifecycleState,
    botMembershipState: input.botMembershipState ?? 'UNKNOWN',
    migration: input.migration ? normalizeWorkspaceMigration(input.migration) : null,
    createdAt,
    updatedAt
  };

  invariant(input.platform === undefined || input.platform === TELEGRAM_WORKSPACE_PLATFORM, 'platform must be telegram', 'twm-workspace-platform-invalid');

  return deepFreeze(workspace);
}

export function normalizeWorkspaceMigration(input) {
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'migration must be an object', 'twm-workspace-migration-invalid');
  const kind = nonEmptyString(input.kind, 'migration.kind');
  invariant(kind === 'group_to_supergroup', 'only group_to_supergroup migration is supported', 'twm-workspace-migration-invalid');

  return deepFreeze({
    kind,
    fromTelegramChatId: normalizeTelegramChatId(input.fromTelegramChatId),
    toTelegramChatId: normalizeTelegramChatId(input.toTelegramChatId),
    detectedAt: normalizeDate(input.detectedAt, 'migration.detectedAt', () => new Date())
  });
}

export function migrateTelegramWorkspaceToSupergroup(workspace, {
  newTelegramChatId,
  detectedAt = new Date().toISOString()
} = {}) {
  assertTelegramWorkspace(workspace);
  invariant(workspace.workspaceType === 'group', 'only a group workspace may migrate to supergroup', 'twm-workspace-migration-invalid');

  const nextChatId = normalizeTelegramChatId(newTelegramChatId);
  invariant(nextChatId !== workspace.telegramChatId, 'migration target chat id must differ from source', 'twm-workspace-migration-invalid');

  return createTelegramWorkspace({
    ...workspace,
    workspaceId: workspace.workspaceId,
    telegramChatId: nextChatId,
    workspaceType: 'supergroup',
    migration: {
      kind: 'group_to_supergroup',
      fromTelegramChatId: workspace.telegramChatId,
      toTelegramChatId: nextChatId,
      detectedAt
    },
    updatedAt: detectedAt
  });
}

export function canTransitionTelegramWorkspace(fromState, toState) {
  invariant(TELEGRAM_WORKSPACE_LIFECYCLE.includes(fromState), `unsupported lifecycleState: ${fromState}`, 'twm-workspace-lifecycle-invalid');
  invariant(TELEGRAM_WORKSPACE_LIFECYCLE.includes(toState), `unsupported lifecycleState: ${toState}`, 'twm-workspace-lifecycle-invalid');
  return fromState === toState || LIFECYCLE_TRANSITIONS[fromState].includes(toState);
}

export function transitionTelegramWorkspace(workspace, toState, {
  at = new Date().toISOString()
} = {}) {
  assertTelegramWorkspace(workspace);
  invariant(canTransitionTelegramWorkspace(workspace.lifecycleState, toState), `invalid lifecycle transition ${workspace.lifecycleState} -> ${toState}`, 'twm-workspace-lifecycle-transition-denied');

  if (workspace.lifecycleState === toState) return workspace;

  return createTelegramWorkspace({
    ...workspace,
    lifecycleState: toState,
    updatedAt: at
  });
}

export function createTelegramWorkspaceScope({ workspaceId, globalUserId, traceId, action = null }) {
  const scope = {
    platform: TELEGRAM_WORKSPACE_PLATFORM,
    workspaceId: nonEmptyString(workspaceId, 'workspaceId'),
    globalUserId: nonEmptyString(globalUserId, 'globalUserId'),
    traceId: nonEmptyString(traceId, 'traceId'),
    action: action === null ? null : nonEmptyString(action, 'action')
  };
  invariant(scope.workspaceId.startsWith('tgw_'), 'workspaceId must be canonical', 'twm-workspace-scope-invalid');
  return deepFreeze(scope);
}

export function assertTelegramWorkspaceScope(scope, expectedWorkspaceId) {
  invariant(scope && typeof scope === 'object', 'workspace scope is required', 'twm-workspace-scope-invalid');
  invariant(scope.platform === TELEGRAM_WORKSPACE_PLATFORM, 'workspace scope platform must be telegram', 'twm-workspace-scope-invalid');
  invariant(typeof scope.workspaceId === 'string' && scope.workspaceId.startsWith('tgw_'), 'canonical workspaceId is required', 'twm-workspace-scope-invalid');
  invariant(typeof scope.globalUserId === 'string' && scope.globalUserId.length > 0, 'globalUserId is required', 'twm-workspace-scope-invalid');
  invariant(typeof scope.traceId === 'string' && scope.traceId.length > 0, 'traceId is required', 'twm-workspace-scope-invalid');
  if (expectedWorkspaceId !== undefined) {
    invariant(scope.workspaceId === expectedWorkspaceId, 'cross-workspace scope denied', 'twm-cross-workspace-denied');
  }
  return scope;
}

export function assertTelegramWorkspace(workspace) {
  invariant(workspace && typeof workspace === 'object', 'workspace is required', 'twm-workspace-contract-invalid');
  invariant(workspace.platform === TELEGRAM_WORKSPACE_PLATFORM, 'workspace platform must be telegram', 'twm-workspace-platform-invalid');
  invariant(typeof workspace.workspaceId === 'string' && workspace.workspaceId.startsWith('tgw_'), 'canonical workspaceId is required', 'twm-workspace-contract-invalid');
  invariant(TELEGRAM_WORKSPACE_TYPES.includes(workspace.workspaceType), 'unsupported workspace type', 'twm-workspace-type-unsupported');
  invariant(TELEGRAM_WORKSPACE_LIFECYCLE.includes(workspace.lifecycleState), 'unsupported lifecycle state', 'twm-workspace-lifecycle-invalid');
  normalizeTelegramChatId(workspace.telegramChatId);
  return workspace;
}

export function assertSameTelegramWorkspace(left, right) {
  assertTelegramWorkspace(left);
  assertTelegramWorkspace(right);
  invariant(left.workspaceId === right.workspaceId, 'cross-workspace identity denied', 'twm-cross-workspace-denied');
  return true;
}

export function telegramWorkspaceConfigNamespace(name) {
  const namespace = nonEmptyString(name, 'namespace');
  invariant(TELEGRAM_WORKSPACE_CONFIG_NAMESPACES.includes(namespace), `unsupported workspace config namespace: ${namespace}`, 'twm-workspace-config-namespace-unsupported');
  return `workspace.${namespace}`;
}
