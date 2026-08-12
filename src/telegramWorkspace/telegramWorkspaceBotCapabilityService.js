export const TELEGRAM_WORKSPACE_BOT_CAPABILITIES = Object.freeze([
  'telegram.message.send',
  'telegram.message.edit',
  'telegram.message.delete',
  'telegram.message.pin',
  'telegram.member.restrict',
  'telegram.member.invite',
  'telegram.chat.manage',
  'telegram.topic.manage',
  'telegram.channel.post',
  'telegram.poll.send',
  'telegram.media.send'
]);

const CAPABILITY_SET = new Set(TELEGRAM_WORKSPACE_BOT_CAPABILITIES);
const CONNECTED_STATUSES = new Set(['creator', 'administrator', 'member', 'restricted']);
const KNOWN_PERMISSION_FIELDS = Object.freeze([
  'is_member',
  'can_manage_chat',
  'can_delete_messages',
  'can_manage_video_chats',
  'can_restrict_members',
  'can_promote_members',
  'can_change_info',
  'can_invite_users',
  'can_post_stories',
  'can_edit_stories',
  'can_delete_stories',
  'can_post_messages',
  'can_edit_messages',
  'can_pin_messages',
  'can_manage_topics',
  'can_send_messages',
  'can_send_audios',
  'can_send_documents',
  'can_send_photos',
  'can_send_videos',
  'can_send_video_notes',
  'can_send_voice_notes',
  'can_send_polls',
  'can_send_other_messages',
  'can_add_web_page_previews',
  'can_manage_direct_messages'
]);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new TypeError(`${name} must be a positive integer`);
  return parsed;
}

function iso(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowValue(row, camel, snake) {
  return row?.[camel] ?? row?.[snake] ?? null;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function normalizedRawPermissions(member) {
  return Object.freeze(Object.fromEntries(
    KNOWN_PERMISSION_FIELDS
      .filter((field) => typeof member?.[field] === 'boolean')
      .map((field) => [field, member[field]])
  ));
}

function permission(raw, key) {
  return raw[key] === true;
}

function capability(available, requiredPermission = null) {
  return Object.freeze({ available: Boolean(available), requiredPermission: available ? null : requiredPermission });
}

function normalizeCapabilities({ workspaceType, status, raw }) {
  const creator = status === 'creator';
  const admin = status === 'administrator';
  const member = status === 'member';
  const restricted = status === 'restricted' && permission(raw, 'is_member');
  const connected = creator || admin || member || restricted;

  const groupSend = creator || admin || member || (restricted && permission(raw, 'can_send_messages'));
  const channelPost = creator || (admin && permission(raw, 'can_post_messages'));
  const send = workspaceType === 'channel' ? channelPost : groupSend;
  const mediaSend = workspaceType === 'channel'
    ? channelPost
    : creator || admin || member || (restricted && (
      permission(raw, 'can_send_photos') || permission(raw, 'can_send_videos') || permission(raw, 'can_send_documents')
    ));
  const pollSend = workspaceType === 'channel'
    ? false
    : creator || admin || member || (restricted && permission(raw, 'can_send_polls'));
  const edit = creator || (admin && permission(raw, 'can_edit_messages'));
  const remove = creator || (admin && permission(raw, 'can_delete_messages'));
  const restrict = creator || (admin && permission(raw, 'can_restrict_members'));
  const invite = creator || (admin && permission(raw, 'can_invite_users'));
  const manageChat = creator || (admin && permission(raw, 'can_manage_chat'));
  const manageTopics = creator || (admin && permission(raw, 'can_manage_topics'));
  const pin = creator || (admin && (workspaceType === 'channel' ? permission(raw, 'can_edit_messages') : permission(raw, 'can_pin_messages')));

  return deepFreeze({
    'telegram.message.send': capability(send, workspaceType === 'channel' ? 'can_post_messages' : 'membership:send_messages'),
    'telegram.message.edit': capability(edit, 'can_edit_messages'),
    'telegram.message.delete': capability(remove, 'can_delete_messages'),
    'telegram.message.pin': capability(pin, workspaceType === 'channel' ? 'can_edit_messages' : 'can_pin_messages'),
    'telegram.member.restrict': capability(restrict, 'can_restrict_members'),
    'telegram.member.invite': capability(invite, 'can_invite_users'),
    'telegram.chat.manage': capability(manageChat, 'can_manage_chat'),
    'telegram.topic.manage': capability(manageTopics, 'can_manage_topics'),
    'telegram.channel.post': capability(workspaceType === 'channel' && channelPost, workspaceType === 'channel' ? 'can_post_messages' : 'workspace_type:channel'),
    'telegram.poll.send': capability(pollSend, workspaceType === 'channel' ? 'workspace_type:group_or_supergroup' : 'can_send_polls'),
    'telegram.media.send': capability(mediaSend, workspaceType === 'channel' ? 'can_post_messages' : 'membership:send_media'),
    connected
  });
}

function snapshotFromTelegram({ workspace, member, fetchedAt, expiresAt }) {
  const status = String(member?.status ?? 'unknown').toLowerCase();
  const raw = normalizedRawPermissions(member);
  const normalized = normalizeCapabilities({ workspaceType: workspace.workspaceType, status, raw });
  const { connected, ...capabilities } = normalized;
  return deepFreeze({
    workspaceId: workspace.workspaceId,
    telegramChatId: String(workspace.telegramChatId),
    workspaceType: workspace.workspaceType,
    membershipState: status.toUpperCase(),
    connected,
    permissions: Object.freeze({
      telegramStatus: status,
      raw,
      capabilities
    }),
    fetchedAt,
    expiresAt
  });
}

function snapshotFromStored(workspace, row) {
  if (!row) return null;
  const permissions = row.permissions ?? {};
  const status = String(permissions.telegramStatus ?? rowValue(row, 'membershipState', 'membership_state') ?? 'unknown').toLowerCase();
  const raw = permissions.raw ?? {};
  const capabilities = permissions.capabilities ?? normalizeCapabilities({ workspaceType: workspace.workspaceType, status, raw });
  const connected = CONNECTED_STATUSES.has(status) && !(status === 'restricted' && raw.is_member === false);
  return deepFreeze({
    workspaceId: workspace.workspaceId,
    telegramChatId: String(workspace.telegramChatId),
    workspaceType: workspace.workspaceType,
    membershipState: String(rowValue(row, 'membershipState', 'membership_state') ?? status).toUpperCase(),
    connected,
    permissions: Object.freeze({ telegramStatus: status, raw: Object.freeze({ ...raw }), capabilities: deepFreeze({ ...capabilities }) }),
    fetchedAt: iso(rowValue(row, 'fetchedAt', 'fetched_at')),
    expiresAt: iso(rowValue(row, 'expiresAt', 'expires_at'))
  });
}

function isFresh(snapshot, now) {
  if (!snapshot?.expiresAt) return false;
  return new Date(snapshot.expiresAt).getTime() > now.getTime();
}

function healthFromSnapshot(snapshot, requiredCapabilities = [], source = 'cache') {
  const missingCapabilities = [];
  const missingPermissions = [];
  for (const name of requiredCapabilities) {
    const state = snapshot.permissions.capabilities[name];
    if (!state?.available) {
      missingCapabilities.push(name);
      if (state?.requiredPermission) missingPermissions.push(state.requiredPermission);
    }
  }
  const available = snapshot.connected && missingCapabilities.length === 0;
  return deepFreeze({
    available,
    status: !snapshot.connected ? 'disconnected' : available ? 'healthy' : 'degraded',
    reason: !snapshot.connected ? 'telegram-bot-not-connected' : available ? 'telegram-bot-capability-available' : 'telegram-bot-permission-missing',
    workspaceId: snapshot.workspaceId,
    workspaceType: snapshot.workspaceType,
    membershipState: snapshot.membershipState,
    requiredCapabilities: Object.freeze([...requiredCapabilities]),
    missingCapabilities: Object.freeze(missingCapabilities),
    missingPermissions: Object.freeze([...new Set(missingPermissions)]),
    fetchedAt: snapshot.fetchedAt,
    expiresAt: snapshot.expiresAt,
    source,
    snapshot
  });
}

function verificationFailure({ workspace, requiredCapabilities, error, staleSnapshot = null }) {
  return deepFreeze({
    available: false,
    status: 'verification-failed',
    reason: error?.code ?? 'telegram-bot-capability-verification-failed',
    workspaceId: workspace.workspaceId,
    workspaceType: workspace.workspaceType,
    membershipState: staleSnapshot?.membershipState ?? 'UNKNOWN',
    requiredCapabilities: Object.freeze([...requiredCapabilities]),
    missingCapabilities: Object.freeze([...requiredCapabilities]),
    missingPermissions: Object.freeze([]),
    fetchedAt: staleSnapshot?.fetchedAt ?? null,
    expiresAt: staleSnapshot?.expiresAt ?? null,
    source: 'live-verification-failed',
    snapshot: staleSnapshot
  });
}

async function callTelegram(client, method, payload) {
  if (typeof client?.call === 'function') return client.call(method, payload);
  if (method === 'getChatMember' && typeof client?.getChatMember === 'function') return client.getChatMember({ chatId: payload.chat_id, userId: payload.user_id });
  if (method === 'getMe' && typeof client?.getMe === 'function') return client.getMe();
  throw new TypeError(`telegramApiClient cannot call ${method}`);
}

export class TelegramWorkspaceBotCapabilityError extends Error {
  constructor(message, { code = 'telegram-bot-capability-denied', health = null } = {}) {
    super(message);
    this.name = 'TelegramWorkspaceBotCapabilityError';
    this.code = code;
    this.health = health;
    this.retryable = health?.status === 'verification-failed';
  }
}

export function createTelegramWorkspaceBotCapabilityService({
  workspaceStore,
  telegramApiClient,
  botUserId = null,
  clock = () => new Date(),
  snapshotTtlMs = 5 * 60 * 1000,
  audit = async () => {}
} = {}) {
  if (!workspaceStore?.getWorkspace || !workspaceStore?.getBotPermissions || !workspaceStore?.putBotPermissions) throw new TypeError('workspaceStore bot-permission persistence is required');
  if (!telegramApiClient) throw new TypeError('telegramApiClient is required');
  if (typeof clock !== 'function' || typeof audit !== 'function') throw new TypeError('invalid bot capability dependency');
  const ttl = positiveInteger(snapshotTtlMs, 'snapshotTtlMs');
  let resolvedBotUserId = botUserId == null || String(botUserId).trim() === '' ? null : required(String(botUserId), 'botUserId');

  function normalizeRequired(capabilities = []) {
    if (!Array.isArray(capabilities)) throw new TypeError('requiredCapabilities must be an array');
    return capabilities.map((name) => {
      const normalized = required(name, 'capability');
      if (!CAPABILITY_SET.has(normalized)) throw new TypeError(`unsupported Telegram bot capability: ${normalized}`);
      return normalized;
    });
  }

  async function emit(health, operation) {
    await audit(Object.freeze({
      eventClass: 'telegram_workspace_bot_capability',
      operation,
      outcome: health.available ? 'healthy' : health.status,
      workspaceId: health.workspaceId,
      membershipState: health.membershipState,
      reason: health.reason,
      missingCapabilities: health.missingCapabilities,
      missingPermissions: health.missingPermissions,
      fetchedAt: health.fetchedAt
    }));
    return health;
  }

  async function getBotUserId() {
    if (resolvedBotUserId) return resolvedBotUserId;
    const me = await callTelegram(telegramApiClient, 'getMe', {});
    if (me?.id == null) {
      const error = new Error('Telegram getMe did not return bot id');
      error.code = 'telegram-bot-identity-unavailable';
      throw error;
    }
    resolvedBotUserId = required(String(me.id), 'Telegram bot id');
    return resolvedBotUserId;
  }

  async function refresh({ workspaceId, requiredCapabilities = [] } = {}) {
    const id = required(workspaceId, 'workspaceId');
    const requiredList = normalizeRequired(requiredCapabilities);
    const workspace = await workspaceStore.getWorkspace(id);
    if (!workspace) {
      const error = new Error('Telegram workspace not found');
      error.code = 'twm-workspace-not-found';
      throw error;
    }
    const stored = snapshotFromStored(workspace, await workspaceStore.getBotPermissions(id));
    try {
      const currentBotUserId = await getBotUserId();
      const member = await callTelegram(telegramApiClient, 'getChatMember', { chat_id: workspace.telegramChatId, user_id: currentBotUserId });
      const now = clock();
      if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('clock must return a valid Date');
      const fetchedAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + ttl).toISOString();
      const snapshot = snapshotFromTelegram({ workspace, member, fetchedAt, expiresAt });
      await workspaceStore.putBotPermissions({
        workspaceId: id,
        membershipState: snapshot.membershipState,
        permissions: snapshot.permissions,
        fetchedAt,
        expiresAt
      });
      return emit(healthFromSnapshot(snapshot, requiredList, 'live'), 'refresh');
    } catch (error) {
      return emit(verificationFailure({ workspace, requiredCapabilities: requiredList, error, staleSnapshot: stored }), 'refresh');
    }
  }

  async function getHealth({ workspaceId, requiredCapabilities = [], requireFresh = false } = {}) {
    const id = required(workspaceId, 'workspaceId');
    const requiredList = normalizeRequired(requiredCapabilities);
    const workspace = await workspaceStore.getWorkspace(id);
    if (!workspace) {
      const error = new Error('Telegram workspace not found');
      error.code = 'twm-workspace-not-found';
      throw error;
    }
    const snapshot = snapshotFromStored(workspace, await workspaceStore.getBotPermissions(id));
    const now = clock();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('clock must return a valid Date');
    if (!requireFresh && snapshot && isFresh(snapshot, now)) return emit(healthFromSnapshot(snapshot, requiredList, 'cache'), 'read');
    return refresh({ workspaceId: id, requiredCapabilities: requiredList });
  }

  async function checkCapabilities({ workspaceId, requiredCapabilities = [], requireFresh = true } = {}) {
    return getHealth({ workspaceId, requiredCapabilities, requireFresh });
  }

  async function requireCapabilities({ workspaceId, requiredCapabilities = [], requireFresh = true } = {}) {
    const health = await checkCapabilities({ workspaceId, requiredCapabilities, requireFresh });
    if (health.available) return health;
    const detail = health.missingPermissions.length > 0 ? `: missing ${health.missingPermissions.join(', ')}` : '';
    throw new TelegramWorkspaceBotCapabilityError(`Telegram bot capability unavailable${detail}`, {
      code: health.reason,
      health
    });
  }

  async function getSnapshot(workspaceId) {
    const id = required(workspaceId, 'workspaceId');
    const workspace = await workspaceStore.getWorkspace(id);
    if (!workspace) return null;
    return snapshotFromStored(workspace, await workspaceStore.getBotPermissions(id));
  }

  return Object.freeze({ refresh, getHealth, checkCapabilities, requireCapabilities, getSnapshot, getBotUserId });
}
