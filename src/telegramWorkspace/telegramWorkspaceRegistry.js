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

function eventValue(event, field, fallback) {
  return Object.prototype.hasOwnProperty.call(event, field) ? event[field] : fallback;
}

function updateMetadata(existing, event, lifecycleState, clock) {
  const at = monotonicAt(existing, event.detectedAt, clock);
  return createTelegramWorkspace({
    ...(existing ?? {}),
    workspaceId: existing?.workspaceId,
    telegramChatId: event.telegramChatId ?? existing?.telegramChatId,
    workspaceType: event.workspaceType ?? existing?.workspaceType,
    title: eventValue(event, 'title', existing?.title ?? null),
    username: eventValue(event, 'username', existing?.username ?? null),
    lifecycleState: lifecycleState ?? existing?.lifecycleState ?? 'DISCOVERED',
    botMembershipState: event.membershipState ?? existing?.botMembershipState ?? 'UNKNOWN',
    migration: existing?.migration ?? null,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at
  });
}

export function createTelegramWorkspaceRegistry({ store, clock = () => new Date() } = {}) {
  const persistence = requiredStore(store);

  async function resolveKnown(telegramChatId) {
    const chatId = String(telegramChatId);
    const direct = await persistence.getWorkspaceByTelegramChatId(chatId);
    if (direct) return Object.freeze({ workspace: direct, viaAlias: false });
    if (typeof persistence.getWorkspaceByMigrationSourceTelegramChatId === 'function') {
      const alias = await persistence.getWorkspaceByMigrationSourceTelegramChatId(chatId);
      if (alias) return Object.freeze({ workspace: alias, viaAlias: true });
    }
    return Object.freeze({ workspace: null, viaAlias: false });
  }

  async function persistNewOrConcurrent(workspace, event) {
    try {
      return await persistence.putWorkspace(workspace);
    } catch (error) {
      const concurrent = await persistence.getWorkspaceByTelegramChatId(workspace.telegramChatId);
      if (!concurrent) throw error;
      const reconciled = updateMetadata(concurrent, event, lifecycleForObservation(concurrent), clock);
      return persistence.putWorkspace(reconciled);
    }
  }

  async function observe(event) {
    const resolved = await resolveKnown(event.telegramChatId);
    // A replayed pre-migration update may carry the historical group id. Preserve the
    // migrated canonical root and current locator instead of recreating or moving it back.
    if (resolved.viaAlias) return resolved.workspace;
    const workspace = updateMetadata(resolved.workspace, event, lifecycleForObservation(resolved.workspace), clock);
    if (resolved.workspace) return persistence.putWorkspace(workspace);
    return persistNewOrConcurrent(workspace, event);
  }

  async function migrate(event) {
    const sourceResolved = await resolveKnown(event.fromTelegramChatId);
    const targetResolved = await resolveKnown(event.toTelegramChatId);
    const source = sourceResolved.workspace;
    const target = targetResolved.workspace;
    if (target && source && target.workspaceId !== source.workspaceId) {
      const error = new Error('telegram migration target already belongs to another workspace');
      error.code = 'twm-workspace-migration-conflict';
      throw error;
    }
    if (target && (!source || target.workspaceId === source.workspaceId)) return target;
    if (!source) {
      const at = event.detectedAt ?? clock().toISOString();
      const discovered = createTelegramWorkspace({
        telegramChatId: event.toTelegramChatId,
        workspaceType: 'supergroup',
        title: eventValue(event, 'title', null),
        username: eventValue(event, 'username', null),
        lifecycleState: 'DISCOVERED',
        botMembershipState: 'UNKNOWN',
        createdAt: at,
        updatedAt: at
      });
      try {
        return await persistence.putWorkspace(discovered);
      } catch (error) {
        const concurrent = await persistence.getWorkspaceByTelegramChatId(event.toTelegramChatId);
        if (concurrent) return concurrent;
        throw error;
      }
    }
    if (source.workspaceType === 'supergroup' && source.telegramChatId === String(event.toTelegramChatId)) return source;
    const migrationAt = monotonicAt(source, event.detectedAt, clock);
    const migrated = migrateTelegramWorkspaceToSupergroup(source, {
      newTelegramChatId: event.toTelegramChatId,
      detectedAt: migrationAt
    });
    return persistence.putWorkspace(createTelegramWorkspace({
      ...migrated,
      title: eventValue(event, 'title', migrated.title),
      username: eventValue(event, 'username', migrated.username)
    }));
  }

  async function membership(event) {
    const resolved = await resolveKnown(event.telegramChatId);
    // Historical membership updates for a migrated-from group cannot mutate the live
    // supergroup state when they are replayed later.
    if (resolved.viaAlias) return resolved.workspace;
    let workspace = resolved.workspace;
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
    return (await resolveKnown(telegramChatId)).workspace;
  }

  return Object.freeze({ apply, applyAll, resolveTelegramChatId });
}
