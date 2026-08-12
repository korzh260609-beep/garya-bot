const WORKSPACE_TYPES = new Set(['group', 'supergroup', 'channel']);
const CONNECTED_MEMBER_STATUSES = new Set(['creator', 'administrator', 'member', 'restricted']);
const DISCONNECTED_MEMBER_STATUSES = new Set(['left', 'kicked']);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freeze(nested);
  return Object.freeze(value);
}

function chatMetadata(chat) {
  if (!chat || !WORKSPACE_TYPES.has(chat.type) || chat.id == null) return null;
  return {
    telegramChatId: String(chat.id),
    workspaceType: chat.type,
    title: typeof chat.title === 'string' && chat.title.trim() ? chat.title.trim() : null,
    username: typeof chat.username === 'string' && chat.username.trim() ? chat.username.trim() : null
  };
}

function messageFrom(update) {
  return update?.message ?? update?.edited_message ?? update?.channel_post ?? update?.edited_channel_post ?? null;
}

function detectedAt(payload) {
  const unixSeconds = Number(payload?.date);
  if (Number.isSafeInteger(unixSeconds) && unixSeconds >= 0) return new Date(unixSeconds * 1000).toISOString();
  return null;
}

function sourceUpdateId(update) {
  const updateId = Number(update?.update_id);
  return Number.isSafeInteger(updateId) && updateId >= 0 ? updateId : null;
}

function observationEvent(update, message) {
  const chat = chatMetadata(message?.chat);
  if (!chat) return null;
  return freeze({
    kind: 'workspace_observed',
    ...chat,
    detectedAt: detectedAt(message),
    sourceUpdateId: sourceUpdateId(update)
  });
}

function migrationEvent(update, message) {
  const chat = chatMetadata(message?.chat);
  if (!chat) return null;
  if (message.migrate_to_chat_id != null) {
    return freeze({
      kind: 'workspace_migrated',
      fromTelegramChatId: chat.telegramChatId,
      toTelegramChatId: String(message.migrate_to_chat_id),
      workspaceType: 'supergroup',
      title: chat.title,
      username: chat.username,
      detectedAt: detectedAt(message),
      sourceUpdateId: sourceUpdateId(update)
    });
  }
  if (message.migrate_from_chat_id != null && chat.workspaceType === 'supergroup') {
    return freeze({
      kind: 'workspace_migrated',
      fromTelegramChatId: String(message.migrate_from_chat_id),
      toTelegramChatId: chat.telegramChatId,
      workspaceType: 'supergroup',
      title: chat.title,
      username: chat.username,
      detectedAt: detectedAt(message),
      sourceUpdateId: sourceUpdateId(update)
    });
  }
  return null;
}

function membershipEvent(update) {
  const payload = update?.my_chat_member;
  const chat = chatMetadata(payload?.chat);
  if (!payload || !chat) return null;
  const rawStatus = String(payload.new_chat_member?.status ?? '').toLowerCase();
  if (!rawStatus) return null;
  const connectionState = CONNECTED_MEMBER_STATUSES.has(rawStatus)
    ? 'connected'
    : DISCONNECTED_MEMBER_STATUSES.has(rawStatus)
      ? 'disconnected'
      : 'unknown';
  return freeze({
    kind: 'bot_membership_changed',
    ...chat,
    membershipState: rawStatus.toUpperCase(),
    connectionState,
    detectedAt: detectedAt(payload),
    sourceUpdateId: sourceUpdateId(update)
  });
}

export function extractTelegramWorkspaceEvents(update) {
  if (!update || typeof update !== 'object' || Array.isArray(update)) return Object.freeze([]);
  const events = [];
  const message = messageFrom(update);
  if (message) {
    const migration = migrationEvent(update, message);
    if (migration) events.push(migration);
    else {
      const observation = observationEvent(update, message);
      if (observation) events.push(observation);
    }
  }
  const membership = membershipEvent(update);
  if (membership) events.push(membership);
  return freeze(events);
}
