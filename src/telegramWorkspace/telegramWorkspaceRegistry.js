import {
  createTelegramWorkspace,
  migrateTelegramWorkspaceToSupergroup,
  transitionTelegramWorkspace
} from './workspaceContract.js';

function requiredStore(store) {
  const required = ['putWorkspace', 'getWorkspace', 'getWorkspaceByTelegramChatId'];
  for (const name of required) if (!store || typeof store[name] !== 'function') throw new TypeError(`workspace store.${name} is required`);
  return store;
}

function lifecycleForObservation(existing) {
  if (!existing) return 'DISCOVERED';
  if (existing.lifecycleState === 'DISCONNECTED') return 'CONNECTED';
  return existing.lifecycleState;
}

function monotonicAt(existing, detectedAt, clock) {
  const candidate = detectedAt ?? clock().toISOString();
  if (!existing?.updatedAt) return candidate;
  return new Date(candidate) > new Date(existing.updatedAt) ? candidate : existing.updatedAt;
}

function updateMetadata(existing, event, lifecycleState, clock) {
  const at = monotonicAt(existing, event.detectedAt, clock);
  return createTelegramWorkspace({
    ...(existing ?? {}),
    workspaceId: existing?.workspaceId,
    telegramChatId: event.telegramChatId ?? existing?.telegramChatId,
    workspaceType: event.workspaceType ?? existing?.workspaceType,
    title: event.title ?? existing?.title ?? null,
    username: event.username ?? existing?.username ?? null,
    lifecycleState: lifecycleState ?? existing?.lifecycleState ?? 'DISCOVERED',
    botMembershipState: event.membershipState ?? existing?.botMembershipState ?? 'UNKNOWN',
    migration: existing?.migration ?? null,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at
  });
}

export function createTelegramWorkspaceRegistry({ store, clock = () => new Date() } = {}) {
  const persistence = requiredStore(store);

  async function observe(event) {
    const existing = await persistence.getWorkspaceByTelegramChatId(event.telegramChatId);
    const workspace = updateMetadata(existing, event, lifecycleForObservation(existing), clock);
    return persistence.putWorkspace(workspace);
  }

  async function migrate(event) {
    const source = await persistence.getWorkspaceByTelegramChatId(event.fromTelegramChatId);
    const target = await persistence.getWorkspaceByTelegramChatId(event.toTelegramChatId);
    if (target && source && target.workspaceId !== source.workspaceId) {
      const error = new Error('telegram migration target already belongs to another workspace');
      error.code = 'twm-workspace-migration-conflict';
      throw error;
    }
    if (target && !source) return target;
    if (!source) {
      const at = event.detectedAt ?? clock().toISOString();
      return persistence.putWorkspace(createTelegramWorkspace({
        telegramChatId: event.toTelegramChatId,
        workspaceType: 'supergroup',
        title: event.title ?? null,
        username: event.username ?? null,
        lifecycleState: 'DISCOVERED',
        botMembershipState: 'UNKNOWN',
        createdAt: at,
        updatedAt: at
      }));
    }
    if (source.workspaceType === 'supergroup' && source.telegramChatId === String(event.toTelegramChatId)) return source;
    const migrationAt = monotonicAt(source, event.detectedAt, clock);
    const migrated = migrateTelegramWorkspaceToSupergroup(source, {
      newTelegramChatId: event.toTelegramChatId,
      detectedAt: migrationAt
    });
    return persistence.putWorkspace(createTelegramWorkspace({
      ...migrated,
      title: event.title ?? migrated.title,
      username: event.username ?? migrated.username
    }));
  }

  async function membership(event) {
    let workspace = await persistence.getWorkspaceByTelegramChatId(event.telegramChatId);
    if (!workspace) workspace = await observe(event);
    let nextState = workspace.lifecycleState;
    if (event.connectionState === 'connected' && workspace.lifecycleState === 'DISCONNECTED') nextState = 'CONNECTED';
    if (event.connectionState === 'connected' && workspace.lifecycleState === 'DISCOVERED') nextState = 'CONNECTED';
    if (event.connectionState === 'disconnected' && workspace.lifecycleState !== 'REVOKED') nextState = 'DISCONNECTED';
    let updated = updateMetadata(workspace, event, workspace.lifecycleState, clock);
    if (nextState !== updated.lifecycleState) updated = transitionTelegramWorkspace(updated, nextState, { at: updated.updatedAt });
    return persistence.putWorkspace(updated);
  }

  async function apply(event) {
    if (!event || typeof event !== 'object') throw new TypeError('workspace discovery event is required');
    if (event.kind === 'workspace_observed') return observe(event);
    if (event.kind === 'workspace_migrated') return migrate(event);
    if (event.kind === 'bot_membership_changed') return membership(event);
    const error = new Error(`unsupported workspace discovery event: ${event.kind}`);
    error.code = 'twm-workspace-discovery-event-unsupported';
    throw error;
  }

  async function applyAll(events = []) {
    const results = [];
    for (const event of events) results.push(await apply(event));
    return Object.freeze(results);
  }

  async function resolveTelegramChatId(telegramChatId) {
    return persistence.getWorkspaceByTelegramChatId(String(telegramChatId));
  }

  return Object.freeze({ apply, applyAll, resolveTelegramChatId });
}
